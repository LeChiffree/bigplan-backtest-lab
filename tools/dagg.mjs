// dagg.mjs — Filtre Laboratuvarı · GÜNLÜK örneklemeli toplayıcı
// agg2.StateTracker ile BİREBİR aynı işlem muhasebesi; tek fark: portföy
// eğrisi haftalık yerine GÜNLÜK ızgaraya örneklenir (ay ay / gün gün analiz).
// Aynı çapa ve bitiş kuralı: t = 2022-08-01 .. 2026-09-08 dahil (t <= end).
import { TEST_START, YEAR0, NYEARS, r4 } from './agg2.mjs';

export const DGRID = (() => {
  const start = Date.UTC(2022, 7, 1), end = Date.UTC(2026, 8, 8);
  const out = [];
  for (let t = start; t <= end; t += 86400000) out.push(t);
  return Float64Array.from(out);
})();
export const GD = DGRID.length;
export { TEST_START, YEAR0, NYEARS };

/* ------------------- tek (durum × sembol) artımlı izleyici ------------------ */
export class DailyTracker {
  constructor(firstT) {
    this.firstT = firstT;
    this.n = 0; this.sum = 0; this.sum2 = 0; this.wins = 0; this.grossW = 0; this.grossL = 0;
    this.bars = 0; this.best = -Infinity; this.worst = Infinity;
    this.years = new Float64Array(NYEARS * 2);
    this.tr = new Float64Array(5);
    this.te = new Float64Array(5);
    this.eq = 1; this.peak = 1; this.dd = 0;
    this.eqOut = new Float64Array(GD).fill(NaN);
    this.gk = 0;
    let gs = 0; while (gs < GD && DGRID[gs] < firstT) gs++;
    this.gStart = gs;
  }
  onTrade(r, bars, xt) {
    const n0 = this.n;
    this.n = n0 + 1; this.sum += r; this.sum2 += r * r;
    if (r > 0) { this.wins++; this.grossW += r; } else this.grossL -= r;
    this.bars += bars;
    if (r > this.best) this.best = r;
    if (r < this.worst) this.worst = r;
    if (xt >= DGRID[0]) {
      const y = new Date(xt).getUTCFullYear() - YEAR0;
      if (y >= 0 && y < NYEARS) { this.years[y * 2]++; if (r > 0) this.years[y * 2 + 1]++; }
    }
    const t = xt < TEST_START ? this.tr : this.te;
    t[0]++; t[1] += r; if (r > 0) { t[2]++; t[3] += r; } else t[4] -= r;
    // sampleEquity birebir: gt < xt olan ızgara noktaları işlemden ÖNCEKİ eğriyi alır
    const eqOut = this.eqOut, gStart = this.gStart;
    let gk = this.gk;
    while (gk < GD && DGRID[gk] < xt) { if (gk >= gStart) eqOut[gk] = Math.fround(this.eq); gk++; }
    this.gk = gk;
    this.eq *= 1 + r;
    if (this.eq > this.peak) this.peak = this.eq;
    const d = this.eq / this.peak - 1;
    if (d < this.dd) this.dd = d;
  }
  finish() {
    const eqOut = this.eqOut, gStart = this.gStart;
    let gk = this.gk;
    while (gk < GD) { if (gk >= gStart) eqOut[gk] = Math.fround(this.eq); gk++; }
    this.gk = gk;
  }
  reset() {
    this.n = 0; this.sum = 0; this.sum2 = 0; this.wins = 0; this.grossW = 0; this.grossL = 0;
    this.bars = 0; this.best = -Infinity; this.worst = Infinity;
    this.years.fill(0);
    this.tr.fill(0);
    this.te.fill(0);
    this.eq = 1; this.peak = 1; this.dd = 0;
    this.eqOut.fill(NaN);
    this.gk = 0;
  }
  stats() {
    const n = this.n;
    return {
      n, wr: this.wins / n, avg: this.sum / n,
      pf: this.grossL > 1e-9 ? this.grossW / this.grossL : (this.grossW > 0 ? 99 : 0),
      tot: this.eq - 1, dd: this.dd, bars: this.bars / n,
    };
  }
}

/* ------------------------- günlük kompakt havuz (durum başı) ---------------- */
export function newDailyAcc() {
  return {
    pool: (() => { const p = new Float64Array(10); p[7] = -Infinity; p[8] = Infinity; return p; })(),
    years: new Float64Array(NYEARS * 2),
    tr: new Float64Array(5),
    te: new Float64Array(5),
    eqSums: new Float64Array(GD),
    eqCnts: new Int32Array(GD),
  };
}

// worker içi: sembol tamamlanınca günlük havuza işle (agg2.mergeSymbolInto eşdeğeri)
export function mergeSymbolIntoDaily(acc, st) {
  const p = acc.pool;
  p[0] += st.n; p[1] += st.sum; p[2] += st.sum2; p[3] += st.wins;
  p[4] += st.grossW; p[5] += st.grossL; p[6] += st.bars;
  if (st.n) {
    if (st.best > p[7]) p[7] = st.best;
    if (st.worst < p[8]) p[8] = st.worst;
  }
  for (let i = 0; i < NYEARS * 2; i++) acc.years[i] += st.years[i];
  for (let i = 0; i < 5; i++) { acc.tr[i] += st.tr[i]; acc.te[i] += st.te[i]; }
  if (st.n > 0) {
    const eqSums = acc.eqSums, eqCnts = acc.eqCnts, eqOut = st.eqOut;
    for (let g = 0; g < GD; g++) {
      const v = eqOut[g];
      if (!Number.isNaN(v)) { eqSums[g] += v; eqCnts[g]++; }
    }
  }
}

export function mergeDailyAcc(dst, src) {
  const p = dst.pool, q = src.pool;
  for (let i = 0; i < 10; i++) {
    if (i === 7) { if (q[7] > p[7]) p[7] = q[7]; continue; }
    if (i === 8) { if (q[8] < p[8]) p[8] = q[8]; continue; }
    p[i] += q[i];
  }
  for (let i = 0; i < NYEARS * 2; i++) dst.years[i] += src.years[i];
  for (let i = 0; i < 5; i++) { dst.tr[i] += src.tr[i]; dst.te[i] += src.te[i]; }
  for (let g = 0; g < GD; g++) { dst.eqSums[g] += src.eqSums[g]; dst.eqCnts[g] += src.eqCnts[g]; }
}

/* ------------------------------ özet (havuz) -------------------------------- */
export function finalizeDaily(acc) {
  const p = acc.pool;
  const n = p[0];
  const curve = new Array(GD);
  for (let g = 0; g < GD; g++) curve[g] = acc.eqCnts[g] ? acc.eqSums[g] / acc.eqCnts[g] : null;
  if (!n) return { n: 0, curve, sum: null };
  const avg = p[1] / n;
  const sd = Math.sqrt(Math.max(0, p[2] / n - avg * avg));
  const wr = p[3] / n;
  const pf = p[5] > 1e-9 ? p[4] / p[5] : (p[4] > 0 ? 99 : 0);
  // portföy dd + son değer: günlük eğriden (haftalıkla uyumlu)
  let peak = -Infinity, dd = 0, firstEq = null, lastEq = 1;
  for (let g = 0; g < GD; g++) {
    const v = curve[g];
    if (v == null) continue;
    if (firstEq === null) firstEq = v;
    lastEq = v;
    if (v > peak) peak = v;
    const d = v / peak - 1;
    if (d < dd) dd = d;
  }
  return {
    n,
    sum: {
      n, wr: Math.round(wr * 1e3) / 1e3, avg: r4(avg), sd: r4(sd),
      pf: Math.round(Math.min(pf, 99) * 1e3) / 1e3, bars: Math.round((p[6] / n) * 1e3) / 1e3,
      best: r4(p[7]), worst: r4(p[8]), tot: r4(lastEq - 1), dd: r4(dd),
    },
    tr: acc.tr[0] ? { n: acc.tr[0], avg: r4(acc.tr[1] / acc.tr[0]), wr: Math.round((acc.tr[2] / acc.tr[0]) * 1e3) / 1e3 } : null,
    te: acc.te[0] ? { n: acc.te[0], avg: r4(acc.te[1] / acc.te[0]), wr: Math.round((acc.te[2] / acc.te[0]) * 1e3) / 1e3 } : null,
    curve,
  };
}
