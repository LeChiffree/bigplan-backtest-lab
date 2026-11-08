// agg2.mjs — Filtre Laboratuvarı · kompakt artımlı toplayıcı
// Amaç: 10 milyarlarca işlem nesnesi üretmeden, agg.mjs ile BİREBİR aynı
// metriği (havuz, hist, yıl, sembol, haftalık eğri) artımlı hesaplamak.
import { GRID, HIST_N, histIndex } from './core.mjs';

export const TEST_START = Date.UTC(2025, 0, 1); // train: < 2025-01-01, test: >=
export const YEAR0 = 2022, NYEARS = 5;
const G = GRID.length;

/* ------------------- tek (durum × sembol) artımlı izleyici ------------------ */
// agg.mjs symbolStats + sampleEquity ile birebir aynı sonuçları üretir.
export class StateTracker {
  constructor(firstT) {
    this.firstT = firstT;
    this.n = 0; this.sum = 0; this.sum2 = 0; this.wins = 0; this.grossW = 0; this.grossL = 0;
    this.bars = 0; this.best = -Infinity; this.worst = Infinity;
    this.hist = new Int32Array(HIST_N);
    this.years = new Float64Array(NYEARS * 2); // [n, wins] × yıl
    this.tr = new Float64Array(5);             // train: n, sum, wins, gW, gL
    this.te = new Float64Array(5);             // test
    this.eq = 1; this.peak = 1; this.dd = 0;
    this.eqOut = new Float64Array(G).fill(NaN);
    this.gk = 0;
    let gs = 0; while (gs < G && GRID[gs] < firstT) gs++;
    this.gStart = gs;
  }
  onTrade(r, bars, xt) {
    const n0 = this.n;
    this.n = n0 + 1; this.sum += r; this.sum2 += r * r;
    if (r > 0) { this.wins++; this.grossW += r; } else this.grossL -= r;
    this.bars += bars;
    if (r > this.best) this.best = r;
    if (r < this.worst) this.worst = r;
    this.hist[histIndex(r)]++;
    if (xt >= GRID[0]) {
      const y = new Date(xt).getUTCFullYear() - YEAR0;
      if (y >= 0 && y < NYEARS) { this.years[y * 2]++; if (r > 0) this.years[y * 2 + 1]++; }
    }
    const t = xt < TEST_START ? this.tr : this.te;
    t[0]++; t[1] += r; if (r > 0) { t[2]++; t[3] += r; } else t[4] -= r;
    // sampleEquity birebir: gt < xt olan grid noktaları bu işlemden ÖNCEKİ eğriyi alır
    // NOT: orijinal örneklem Float32Array'e yazar → depoda fround uygula
    const eqOut = this.eqOut, gStart = this.gStart;
    let gk = this.gk;
    while (gk < G && GRID[gk] < xt) { if (gk >= gStart) eqOut[gk] = Math.fround(this.eq); gk++; }
    this.gk = gk;
    this.eq *= 1 + r;
    if (this.eq > this.peak) this.peak = this.eq;
    const d = this.eq / this.peak - 1;
    if (d < this.dd) this.dd = d;
  }
  finish() {
    const eqOut = this.eqOut, gStart = this.gStart;
    let gk = this.gk;
    while (gk < G) { if (gk >= gStart) eqOut[gk] = Math.fround(this.eq); gk++; }
    this.gk = gk;
  }
  // Aynı (sembol, tf) içinde yeni strateji koşulacaksa baştan başlat
  reset() {
    this.n = 0; this.sum = 0; this.sum2 = 0; this.wins = 0; this.grossW = 0; this.grossL = 0;
    this.bars = 0; this.best = -Infinity; this.worst = Infinity;
    this.hist.fill(0);
    this.years.fill(0);
    this.tr.fill(0);
    this.te.fill(0);
    this.eq = 1; this.peak = 1; this.dd = 0;
    this.eqOut.fill(NaN);
    this.gk = 0;
  }
  // symbolStats eşdeğeri (n>0 çağrılmalı)
  stats(bh) {
    const n = this.n;
    return {
      n, wr: this.wins / n, avg: this.sum / n,
      pf: this.grossL > 1e-9 ? this.grossW / this.grossL : (this.grossW > 0 ? 99 : 0),
      tot: this.eq - 1, dd: this.dd, bars: this.bars / n, bh,
    };
  }
}

/* ------------------------- kompakt havuz (durum başı) ----------------------- */
// syms düzlemi sembol başına 11 sayı: n, wr, avg, pf, tot, dd, trN, trAvg, teN, teAvg, bh
export function newCompactAcc(nSym) {
  return {
    pool: (() => { const p = new Float64Array(10); p[7] = -Infinity; p[8] = Infinity; return p; })(),
    hist: new Int32Array(HIST_N),
    years: new Float64Array(NYEARS * 2),
    tr: new Float64Array(5),
    te: new Float64Array(5),
    eqSums: new Float64Array(G),
    eqCnts: new Int32Array(G),
    syms: new Float64Array(nSym * 11),
  };
}

function addPool(dst, st) {
  dst[0] += st.n; dst[1] += st.sum; dst[2] += st.sum2; dst[3] += st.wins;
  dst[4] += st.grossW; dst[5] += st.grossL; dst[6] += st.bars;
  if (st.n) {
    if (st.best > dst[7]) dst[7] = st.best;
    if (st.worst < dst[8]) dst[8] = st.worst;
  }
}

// worker içi: sembol tamamlanınca kompakt havuza işle
// NOT: orijinal agg.mjs addSymbolResult'ı yalnız stats (n>0) varken çağırır;
// işlemsiz sembol portföy eğrisine KATKI VERMEZ. Aynen korunur.
export function mergeSymbolInto(acc, st, symIdx, bh) {
  addPool(acc.pool, st);
  for (let i = 0; i < HIST_N; i++) acc.hist[i] += st.hist[i];
  for (let i = 0; i < NYEARS * 2; i++) acc.years[i] += st.years[i];
  for (let i = 0; i < 5; i++) { acc.tr[i] += st.tr[i]; acc.te[i] += st.te[i]; }
  if (st.n > 0) {
    const eqSums = acc.eqSums, eqCnts = acc.eqCnts, eqOut = st.eqOut;
    for (let g = 0; g < G; g++) {
      const v = eqOut[g];
      if (!Number.isNaN(v)) { eqSums[g] += v; eqCnts[g]++; }
    }
  }
  const s = acc.syms, o = symIdx * 11;
  if (st.n > 0) {
    const q = st.stats(bh);
    s[o] = q.n; s[o + 1] = q.wr; s[o + 2] = q.avg; s[o + 3] = Math.min(q.pf, 99);
    s[o + 4] = q.tot; s[o + 5] = q.dd;
    const trN = st.tr[0];
    s[o + 6] = trN; s[o + 7] = trN > 0 ? st.tr[1] / trN : 0;
    const teN = st.te[0];
    s[o + 8] = teN; s[o + 9] = teN > 0 ? st.te[1] / teN : 0;
    s[o + 10] = bh;
  }
}

// ana süreç: iki kompakt havuzu birleştir (worker payload → master)
export function mergeCompact(dst, src) {
  for (let i = 0; i < 10; i++) {
    if (i === 7) { if (src[7] > dst[7]) dst[7] = src[7]; continue; }
    if (i === 8) { if (src[8] < dst[8]) dst[8] = src[8]; continue; }
    dst[i] += src[i];
  }
}

export function mergeCompactAcc(dst, src) {
  mergeCompact(dst.pool, src.pool);
  for (let i = 0; i < HIST_N; i++) dst.hist[i] += src.hist[i];
  for (let i = 0; i < NYEARS * 2; i++) dst.years[i] += src.years[i];
  for (let i = 0; i < 5; i++) { dst.tr[i] += src.tr[i]; dst.te[i] += src.te[i]; }
  for (let g = 0; g < G; g++) { dst.eqSums[g] += src.eqSums[g]; dst.eqCnts[g] += src.eqCnts[g]; }
  // syms: 11'lik bloklar; son eleman (bh) toplanmaz, birebir kopyalanır
  const ds = dst.syms, ss = src.syms;
  for (let i = 0; i < ds.length; i += 11) {
    for (let j = 0; j < 10; j++) ds[i + j] += ss[i + j];
    if (ds[i + 10] === 0 && ss[i + 10] !== 0) ds[i + 10] = ss[i + 10];
  }
}

/* ------------------- kanonik (assets/bt) biçime dönüşüm -------------------- */
// Doğrulama için: kendi toplayıcımızın çıktısını agg.mjs finalize'ına ver.
export function toIAAcc(acc, symbols) {
  const p = acc.pool;
  const years = {};
  for (let y = 0; y < NYEARS; y++) {
    const n = acc.years[y * 2];
    if (n > 0) years[String(YEAR0 + y)] = { n, wins: acc.years[y * 2 + 1] };
  }
  const syms = {};
  for (let i = 0; i < symbols.length; i++) {
    const o = i * 11;
    if (acc.syms[o] > 0) {
      syms[symbols[i]] = {
        n: acc.syms[o], wr: acc.syms[o + 1], avg: acc.syms[o + 2],
        pf: acc.syms[o + 3], tot: acc.syms[o + 4], dd: acc.syms[o + 5],
        bh: acc.syms[o + 10],
      };
    }
  }
  return {
    pool: {
      n: p[0], sum: p[1], sum2: p[2], wins: p[3], grossW: p[4], grossL: p[5],
      bars: p[6], best: p[7] === -Infinity ? -1 : p[7], worst: p[8] === Infinity ? 1 : p[8],
    },
    hist: Int32Array.from(acc.hist),
    years, syms,
    eqSums: Float64Array.from(acc.eqSums),
    eqCnts: Int32Array.from(acc.eqCnts),
  };
}

/* ------------------------ metrik özetleme yardımcıları ---------------------- */
export const r3 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 1e3) / 1e3);
export const r4 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 1e4) / 1e4);

// pooled (havuz) metrik seti: n, wr, avg, sd, pf, tot(portföy), dd, bars, best, worst
export function poolMetrics(acc) {
  const p = acc.pool;
  const n = p[0];
  if (!n) return null;
  const avg = p[1] / n;
  const sd = Math.sqrt(Math.max(0, p[2] / n - avg * avg));
  const wr = p[3] / n;
  const pf = p[5] > 1e-9 ? p[4] / p[5] : (p[4] > 0 ? 99 : 0);
  let peak = -Infinity, dd = 0;
  for (let g = 0; g < G; g++) {
    if (!acc.eqCnts[g]) continue;
    const v = acc.eqSums[g] / acc.eqCnts[g];
    if (v > peak) peak = v;
    const d = v / peak - 1;
    if (d < dd) dd = d;
  }
  let lastEq = 1;
  for (let g = G - 1; g >= 0; g--) if (acc.eqCnts[g]) { lastEq = acc.eqSums[g] / acc.eqCnts[g]; break; }
  return {
    n, wr: r3(wr), avg: r4(avg), sd: r4(sd), pf: r3(Math.min(pf, 99)),
    tot: r4(lastEq - 1), dd: r4(dd), bars: r3(p[6] / n),
    best: r4(p[7]), worst: r4(p[8]),
  };
}

// train / test özet (havuz)
export function splitMetrics(acc) {
  const out = {};
  for (const [key, t] of [['train', acc.tr], ['test', acc.te]]) {
    const n = t[0];
    if (!n) { out[key] = null; continue; }
    out[key] = {
      n, wr: r3(t[2] / n), avg: r4(t[1] / n),
      pf: r3(Math.min(t[4] > 1e-9 ? t[3] / t[4] : (t[3] > 0 ? 99 : 0), 99)),
    };
  }
  return out;
}

// yıllık (havuz): işlem sayısı + kazanma oranı
export function yearStats(acc) {
  const years = {};
  for (let y = 0; y < NYEARS; y++) {
    const n = acc.years[y * 2];
    if (n > 0) years[YEAR0 + y] = [n, r3(acc.years[y * 2 + 1] / n)];
  }
  return years;
}

// sembol ısı tablosu — KOMPAKT: adlar bir kez, metrikler paralel dizilerde
// (520 sembollü evrende dosya boyutunu ~3-4× küçültür; tüketiciler paralel okur)
export function heatTable(acc, symbols) {
  const syms = [], n = [], wr = [], avg = [], pf = [], dd = [], tot = [], bh = [];
  for (let i = 0; i < symbols.length; i++) {
    const o = i * 11;
    if (!acc.syms[o]) continue;
    syms.push(symbols[i]);
    n.push(acc.syms[o]);
    avg.push(r4(acc.syms[o + 2]));
    wr.push(r3(acc.syms[o + 1]));
    pf.push(r3(acc.syms[o + 3]));
    dd.push(r4(acc.syms[o + 5]));
    tot.push(r4(acc.syms[o + 4]));
    bh.push(r4(acc.syms[o + 10]));
  }
  return { syms, n, wr, avg, pf, dd, tot, bh };
}

// pozitif sembol oranı (n>=3 semboller içinde avg>0)
export function posShare(acc, symbols) {
  let cnt = 0, pos = 0;
  for (let i = 0; i < symbols.length; i++) {
    const o = i * 11;
    if (acc.syms[o] >= 3) { cnt++; if (acc.syms[o + 2] > 0) pos++; }
  }
  return cnt ? pos / cnt : 0;
}

/* -------------------- finalize2: varyant özeti (agg.mjs uyumlu) ------------ */
// agg.mjs finalizeIndicator ile aynı matematik; girdi: kompakt havuz.
export function finalize2(acc, symbols) {
  const m = poolMetrics(acc);
  if (!m) return null;

  let cnt = 0, posN = 0, top = null, bot = null;
  for (let i = 0; i < symbols.length; i++) {
    const o = i * 11;
    if (acc.syms[o] < 3) continue;
    cnt++;
    const avg = acc.syms[o + 2];
    if (avg > 0) posN++;
    if (!top || avg > top[1]) top = [symbols[i], r4(avg)];
    if (!bot || avg < bot[1]) bot = [symbols[i], r4(avg)];
  }

  // yıllık getiri: portföy eğrisinin yıl sonu değerlerinden (agg.mjs birebir)
  const eqList = new Array(G);
  for (let g = 0; g < G; g++) eqList[g] = acc.eqCnts[g] ? acc.eqSums[g] / acc.eqCnts[g] : null;
  const yearEnds = new Map();
  let firstEq = null;
  for (let g = 0; g < G; g++) {
    if (eqList[g] == null) continue;
    if (firstEq === null) firstEq = eqList[g];
    yearEnds.set(new Date(GRID[g]).getUTCFullYear(), eqList[g]);
  }
  let prevEnd = firstEq ?? 1;
  const years = {};
  for (const y of [...yearEnds.keys()].sort((a, b) => a - b)) {
    const end = yearEnds.get(y);
    const yi = y - YEAR0;
    const n = yi >= 0 && yi < NYEARS ? acc.years[yi * 2] : 0;
    const wins = yi >= 0 && yi < NYEARS ? acc.years[yi * 2 + 1] : 0;
    years[y] = [r4(end / prevEnd - 1), r3(wins / Math.max(1, n)), n];
    prevEnd = end;
  }

  return {
    sum: { ...m, nsym: cnt, pos: cnt ? r3(posN / cnt) : 0, top, bot: cnt > 1 ? bot : null },
    years,
    heat: heatTable(acc, symbols),
    split: splitMetrics(acc),
  };
}
