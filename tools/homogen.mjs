// homogen.mjs — HOMOJENLİK ANALİZİ
// "Kâr birkaç güne/aya bağlı mı, yoksa zamana homojen mi yayılmış?" sorusunu
// günlük portföy eğrileri (out/daily) üzerinden ölçer ve raporlar.
//
// Kriterler (HOMOJEN için hepsi gerekir):
//  1) net kâr > 0
//  2) pozitif ay oranı ≥ %60
//  3) en büyük tek ayın katkısı ≤ net kârın %33'ü
//  4) en iyi %5 günün katkısı ≤ net kârın %40'ı
//  5) kümülatif kâr–zaman doğrusal uyum R² ≥ 0.80
//  6) tam yılların (2023–2025) her biri pozitif
// Çıktı: out/homojenlik.csv, out/homojenlik.json, out/HOMOJENLIK-RAPORU.md
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BP, TFS, BT_STRATEGIES, BT_CATEGORY_OF } from './core.mjs';
import { FILTERS, FILTER_CATS } from './filters.mjs';

const D = join(BP, 'out', 'daily');
const F2N = new Map(FILTERS.map((f) => [f.k, f.title]));
const F2C = new Map(FILTERS.map((f) => [f.k, f.cat]));
const FULL_YEARS = [2023, 2024, 2025];

/* ------------------------------ günlük eğri okuma --------------------------- */
const docs = [];
for (const f of await readdir(D)) {
  if (!f.endsWith('.json')) continue;
  docs.push(JSON.parse(await readFile(join(D, f), 'utf8')));
}
const qa = JSON.parse(await readFile(join(BP, 'out', 'daily_qa.json'), 'utf8'));

/* ----------------------- BTCUSDT günlük getiri (baz) ----------------------- */
// Ölçüt 4'ün "BTC'ye göre yoğunlaşma" varyantı için aynı takvim günlerinde
// BTCUSDT getirileri. 1d kline close'larından kurulur.
const BTC_DIR = 'D:/1mDataBinance/1d/BTCUSDT';
const btcClose = new Map();
try {
  const bfiles = (await readdir(BTC_DIR)).filter((f) => f.endsWith('.csv')).sort();
  for (const f of bfiles) {
    const txt = await readFile(join(BTC_DIR, f), 'utf8');
    const lines = txt.split(/\r?\n/);
    if (lines.length < 2) continue;
    const head = lines[0].split(',');
    const ci = head.indexOf('close');
    if (ci < 0) continue;
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      const p = lines[i].split(',');
      const t = +p[0], v = +p[ci];
      if (t && v > 0) btcClose.set(t, v);
    }
  }
} catch (e) {
  console.warn('[homogen] BTC verisi okunamadı:', e.message);
}
const btcTs = [...btcClose.keys()].sort((a, b) => a - b);
const btcRet = new Map();
for (let i = 1; i < btcTs.length; i++) {
  const a = btcClose.get(btcTs[i - 1]), b = btcClose.get(btcTs[i]);
  if (a > 0 && b > 0) btcRet.set(btcTs[i], b / a - 1);
}
const btcAll = [];
for (let i = 1; i < btcTs.length; i++) { const v = btcRet.get(btcTs[i]); if (v != null) btcAll.push(v); }
const btcAllSum = btcAll.reduce((s, v) => s + v, 0);
const btcAllSorted = [...btcAll].sort((a, b) => b - a);
const btcAllK5 = Math.max(1, Math.ceil(btcAll.length * 0.05));
const BTC_TOP5 = btcAllSum > 0 ? btcAllSorted.slice(0, btcAllK5).reduce((s, v) => s + v, 0) / btcAllSum : null;
console.log(`[homogen] BTC baz: ${btcAll.length} gün · top5 gün payı ${BTC_TOP5 == null ? '—' : (BTC_TOP5 * 100).toFixed(1) + '%'}`);

function fmtMonth(mk) { const y = Math.floor(mk / 12), m = mk % 12; return `${y}-${String(m + 1).padStart(2, '0')}`; }

function analyze(curve, grid) {
  const start = grid.start, step = grid.step;
  let i0 = 0; while (i0 < curve.length && curve[i0] == null) i0++;
  let i1 = curve.length - 1; while (i1 >= 0 && curve[i1] == null) i1--;
  if (i0 >= i1) return null;
  const active = curve.slice(i0, i1 + 1);
  const first = active[0];
  const net = active[active.length - 1] / first - 1;

  // günlük getiriler
  const rs = [];
  for (let i = 1; i < active.length; i++) {
    const a = active[i - 1], b = active[i];
    rs.push(a != null && b != null && a > 0 ? b / a - 1 : 0);
  }
  const nDays = rs.length;
  const daySum = rs.reduce((s, v) => s + v, 0);
  const nPos = rs.filter((v) => v > 0).length;
  const posDayPct = nDays ? nPos / nDays : 0;
  const sorted = [...rs].sort((a, b) => b - a);
  const k5 = Math.max(1, Math.ceil(nDays * 0.05));
  const k1 = Math.max(1, Math.ceil(nDays * 0.01));
  const top5Share = daySum > 0 ? sorted.slice(0, k5).reduce((s, v) => s + v, 0) / daySum : null;
  const top1Share = daySum > 0 ? sorted.slice(0, k1).reduce((s, v) => s + v, 0) / daySum : null;

  /* --------------------- ölçüt 4 varyantları (hepsi birlikte) ---------------- */
  // (a) "en iyi 10 gün çıkarılınca hâlâ kârlı mı?" — o 10 günün getirisini 0 kabul et.
  const idxSorted = rs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const topN = Math.min(10, rs.length);
  const top10Set = new Set(idxSorted.slice(0, topN).map((x) => x[1]));
  const top10Sum = idxSorted.slice(0, topN).reduce((s, x) => s + x[0], 0);
  let comp10 = 1;
  for (let i = 0; i < rs.length; i++) if (!top10Set.has(i)) comp10 *= 1 + rs[i];
  const top10Net = comp10 - 1;           // bileşik: en iyi 10 gün 0 getiri
  const top10NetAdd = daySum - top10Sum; // artımlı referans

  // (c) BTC'ye göre yoğunlaşma: aynı takvim günlerinde BTC getirileri
  const btcRs = [];
  for (let i = 0; i < rs.length; i++) {
    const ts = start + (i0 + i + 1) * step;
    const v = btcRet.get(ts);
    btcRs.push(v == null ? 0 : v);
  }
  const btcSum = btcRs.reduce((s, v) => s + v, 0);
  const btcSorted = [...btcRs].sort((a, b) => b - a);
  const btcTop5 = btcSum > 0 ? btcSorted.slice(0, k5).reduce((s, v) => s + v, 0) / btcSum : null;
  // BTC beta ve beta-arındırılmış (idiyosinkratik) getiri yoğunlaşması
  let bmx = 0, bmy = 0;
  for (let i = 0; i < rs.length; i++) { bmx += btcRs[i]; bmy += rs[i]; }
  bmx /= Math.max(1, rs.length); bmy /= Math.max(1, rs.length);
  let bcov = 0, bvar = 0;
  for (let i = 0; i < rs.length; i++) { const dx = btcRs[i] - bmx, dy = rs[i] - bmy; bcov += dx * dy; bvar += dx * dx; }
  const btcBeta = bvar > 0 ? bcov / bvar : null;
  const ex = rs.map((v, i) => v - (btcBeta || 0) * btcRs[i]);
  const exSum = ex.reduce((s, v) => s + v, 0);
  const exSorted = [...ex].sort((a, b) => b - a);
  const exTop5 = exSum > 0 ? exSorted.slice(0, k5).reduce((s, v) => s + v, 0) / exSum : null;

  // aylık zincir
  const monthEnd = new Map();
  for (let i = 0; i < active.length; i++) {
    const v = active[i];
    if (v == null) continue;
    const ts = start + (i0 + i) * step;
    const d = new Date(ts);
    monthEnd.set(d.getUTCFullYear() * 12 + d.getUTCMonth(), { ts, v });
  }
  const mks = [...monthEnd.keys()].sort((a, b) => a - b);
  const months = [];
  let prev = first;
  for (const mk of mks) {
    const v = monthEnd.get(mk).v;
    months.push({ mk, r: v / prev - 1 });
    prev = v;
  }
  const mSum = months.reduce((s, m) => s + m.r, 0);
  const nPosM = months.filter((m) => m.r > 0).length;
  const posMonthPct = months.length ? nPosM / months.length : 0;
  const bestM = months.reduce((a, b) => (b.r > a.r ? b : a), months[0]);
  const worstM = months.reduce((a, b) => (b.r < a.r ? b : a), months[0]);
  const top1MonthShare = mSum > 0 ? Math.max(0, bestM.r) / mSum : null;

  // doğrusallık: kümülatif kâr ~ zaman (OLS)
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0, cum = 0;
  const N = rs.length;
  for (let t = 0; t < N; t++) { cum += rs[t]; sx += t; sy += cum; sxx += t * t; sxy += t * cum; syy += cum * cum; }
  let linR2 = null, slopeAnnual = null;
  if (N > 10) {
    const den = N * sxx - sx * sx;
    const b = den !== 0 ? (N * sxy - sx * sy) / den : 0;
    const a = (sy - b * sx) / N;
    let ssres = 0, cum2 = 0;
    for (let t = 0; t < N; t++) { cum2 += rs[t]; const e = cum2 - (a + b * t); ssres += e * e; }
    const sstot = syy - sy * sy / N;
    linR2 = sstot > 0 ? 1 - ssres / sstot : null;
    slopeAnnual = b * 365;
  }

  // max dd + sualtı
  let peak = -Infinity, dd = 0, under = 0, maxUnder = 0;
  for (const v of active) {
    if (v == null) continue;
    if (v > peak) { peak = v; under = 0; } else { under++; if (under > maxUnder) maxUnder = under; }
    const d = v / peak - 1;
    if (d < dd) dd = d;
  }

  // yıllık
  const yearEnd = new Map();
  for (let i = 0; i < active.length; i++) {
    const v = active[i];
    if (v == null) continue;
    yearEnd.set(new Date(start + (i0 + i) * step).getUTCFullYear(), v);
  }
  const years = {};
  let pv = first;
  for (const y of [...yearEnd.keys()].sort((a, b) => a - b)) { years[y] = yearEnd.get(y) / pv - 1; pv = yearEnd.get(y); }
  const fullY = FULL_YEARS.filter((y) => years[y] != null);
  const minFullYear = fullY.length ? Math.min(...fullY.map((y) => years[y])) : null;

  return {
    t0: new Date(start + i0 * step).toISOString().slice(0, 10),
    t1: new Date(start + (i0 + active.length - 1) * step).toISOString().slice(0, 10),
    net, nDays, posDayPct, top5Share, top1Share, daySum,
    top10Net, top10NetAdd, top10Sum, btcTop5, btcBeta, btcSum, exSum, exTop5,
    months, mSum, posMonthPct, bestM: bestM.r, worstM: worstM.r, top1MonthShare,
    linR2, slopeAnnual, dd, maxUnder, years, minFullYear,
    best5: sorted.slice(0, 5), worst5: sorted.slice(-5).reverse(),
  };
}

/* --------------------------------- kriterler -------------------------------- */
const CRIT = [
  ['net>0', (m) => m.net > 0],
  ['pozAy≥%60', (m) => m.posMonthPct >= 0.60],
  ['top1Ay≤%33', (m) => m.top1MonthShare != null && m.top1MonthShare <= 0.33],
  ['top5Gün≤%40', (m) => m.top5Share != null && m.top5Share <= 0.40],
  ['R²≥0.80', (m) => (m.linR2 ?? 0) >= 0.80],
  ['tamYıllar>0', (m) => m.minFullYear != null && m.minFullYear > 0],
];
const missedOf = (m) => CRIT.filter(([, fn]) => !fn(m)).map(([n]) => n);

const stateName = (keys) => (!keys || !keys.length ? 'temel' : keys.map((k) => F2N.get(k) || k).join(' + '));
const stateCat = (keys) => (!keys || !keys.length ? '—' : [...new Set(keys.map((k) => FILTER_CATS[F2C.get(k)] || F2C.get(k) || '—'))].join('/'));

/* ------------------------------ tüm durumlar ------------------------------- */
const rows = [];

for (const doc of docs) {
  const spec0 = BT_STRATEGIES.find((s) => s.id === doc.id);
  for (const tf of TFS) {
    const cell = doc.tf[tf];
    if (!cell) continue;
    const baseAvg = cell.base.sum?.avg ?? null;
    const states = [{ kind: 'temel', keys: [], keep: 1, hdr: false, sum: cell.base.sum, tr: cell.base.tr, te: cell.base.te, curve: cell.base.curve }];
    for (let i = 0; i < cell.variants.length; i++) {
      const v = cell.variants[i];
      states.push({ kind: i === 0 ? 'varyant1' : 'varyant' + (i + 1), keys: v.keys, hdr: v.hdr, acc: v.acc, keep: v.keep, sum: v.sum, tr: v.tr, te: v.te, curve: v.curve });
    }
    for (const st of states) {
      const m = analyze(st.curve, doc.grid);
      if (!m) continue;
      const rec = {
        id: doc.id, tf, kind: st.kind, keys: st.keys,
        stateName: stateName(st.keys), stateCat: stateCat(st.keys),
        title: spec0?.title || doc.id, stratCat: BT_CATEGORY_OF?.[doc.id] || null,
        n: st.sum?.n ?? 0, avg: st.sum?.avg ?? null,
        trAvg: st.tr?.avg ?? null, teAvg: st.te?.avg ?? null, testN: st.te?.n ?? 0,
        keep: st.keep, hdr: !!st.hdr,
        baseAvg,
        rescued: st.kind === 'varyant1' && baseAvg != null && baseAvg < 0 && m.net > 0,
        net: m.net, posMonthPct: m.posMonthPct, top1MonthShare: m.top1MonthShare, top5Share: m.top5Share,
        top10Net: m.top10Net, top10NetAdd: m.top10NetAdd, btcTop5: m.btcTop5, btcBeta: m.btcBeta, exTop5: m.exTop5,
        linR2: m.linR2, posDayPct: m.posDayPct, dd: m.dd, maxUnder: m.maxUnder,
        y2023: m.years['2023'] ?? null, y2024: m.years['2024'] ?? null, y2025: m.years['2025'] ?? null,
        minFullYear: m.minFullYear,
        months: m.months.map((x) => ({ m: fmtMonth(x.mk), r: x.r })),
        best5: m.best5.map((r) => Math.round(r * 1e6) / 1e6),
        worst5: m.worst5.map((r) => Math.round(r * 1e6) / 1e6),
        bestM: m.bestM, worstM: m.worstM,
        t0: m.t0, t1: m.t1, nDays: m.nDays,
      };
      rec.missed = missedOf(m);
      rec.homojen = rec.missed.length === 0;
      rec.score = (m.linR2 ?? 0) + m.posMonthPct - (m.top5Share ?? 1) - Math.abs(m.dd);
      // ölçüt 4 varyantları
      rec.c4alt10 = rec.net > 0 && m.top10NetAdd > 0;   // artımlı (homogen metodolojisiyle uyumlu)
      rec.c4alt10c = rec.net > 0 && m.top10Net > 0;     // bileşik (gerçek portföy)
      rec.c4btc = rec.net > 0 && m.top5Share != null && m.btcTop5 != null && m.top5Share <= m.btcTop5;
      rec.c4btcEx = rec.net > 0 && m.exSum > 0 && m.exTop5 != null && m.exTop5 <= 0.40;
      rec.near5 = rec.net > 0 && rec.missed.length === 1 && rec.missed[0] === 'top5Gün≤%40';
      rec.hom10 = rec.near5 && rec.c4alt10;
      rec.hom10c = rec.near5 && rec.c4alt10c;
      rec.homBtc = rec.near5 && rec.c4btc;
      rec.homBtcEx = rec.near5 && rec.c4btcEx;
      rec.katman = rec.homojen ? '6/6' : rec.hom10 ? '6/6-alt10' : rec.homBtc ? '6/6-BTC' : rec.near5 ? '5/6' : '';
      rows.push(rec);
    }
  }
}

rows.sort((a, b) => (b.homojen - a.homojen) || (b.score - a.score));

/* --------------------------------- çıktılar -------------------------------- */
const pct = (v, d = 1) => (v == null ? '—' : (v * 100).toFixed(d) + '%');
const pf = (v, d = 1) => (v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%');

const csv = ['id,tf,durum,anahtarlar,ad,kategori,n,avg_isl,tr_avg,te_avg,testN,keep,hdr,net,poz_ay_pct,en_buyuk_ay_payi,top5gun_payi,lin_r2,poz_gun_pct,maxdd,sualti_gun,y2023,y2024,y2025,min_tam_yil,homojen,eksik_kriter,skor,top10_net,top10_add,top10_pass,top10_comp_pass,btc_top5,btc_beta,btc_rel_pass,btc_ex_top5,btc_ex_pass,katman'];
for (const r of rows) {
  csv.push([r.id, r.tf, r.kind, r.keys.join('+'), r.stateName.replace(/,/g, ';'), r.stateCat, r.n, r.avg, r.trAvg, r.teAvg, r.testN, r.keep, r.hdr ? 1 : 0,
    r.net, r.posMonthPct, r.top1MonthShare, r.top5Share, r.linR2, r.posDayPct, r.dd, r.maxUnder,
    r.y2023, r.y2024, r.y2025, r.minFullYear, r.homojen ? 1 : 0, r.missed.join('+')].join(',') + ',' + r.score
    + ',' + [r.top10Net ?? '', r.top10NetAdd ?? '', r.c4alt10 ? 1 : 0, r.c4alt10c ? 1 : 0, r.btcTop5 ?? '', r.btcBeta ?? '', r.c4btc ? 1 : 0, r.exTop5 ?? '', r.c4btcEx ? 1 : 0, r.katman].join(','));
}
await writeFile(join(BP, 'out', 'homojenlik.csv'), csv.join('\n'));

const posRows = rows.filter((r) => r.net > 0);
const near5Rows = rows.filter((r) => r.near5);
const hom10Rows = rows.filter((r) => r.hom10);
const hom10cRows = rows.filter((r) => r.hom10c);
const homBtcRows = rows.filter((r) => r.homBtc);
const homBtcExRows = rows.filter((r) => r.homBtcEx);

const jsonOut = {
  gen: new Date().toISOString(), qa,
  criteria: CRIT.map(([n]) => n),
  variants: {
    btcTop5: BTC_TOP5,
    btcDays: btcAll.length,
    original: { key: 'original', lbl: 'en iyi %5 gün payı ≤ %40', pass: rows.filter((r) => r.homojen).length, of93: near5Rows.filter((r) => r.homojen).length },
    alt10: { key: 'alt10', lbl: 'en iyi 10 gün çıkarılınca hâlâ kârlı (artımlı)', pass: hom10Rows.length, of93: near5Rows.filter((r) => r.c4alt10).length },
    alt10comp: { key: 'alt10comp', lbl: 'en iyi 10 gün çıkarılınca hâlâ kârlı (bileşik)', pass: hom10cRows.length, of93: near5Rows.filter((r) => r.c4alt10c).length },
    btcRel: { key: 'btcRel', lbl: 'top5 payı ≤ BTC top5 payı', pass: homBtcRows.length, of93: near5Rows.filter((r) => r.c4btc).length },
    btcExcess: { key: 'btcExcess', lbl: 'BTC-beta arındırılmış top5 ≤ %40', pass: homBtcExRows.length, of93: near5Rows.filter((r) => r.c4btcEx).length },
    near5: { key: 'near5', lbl: 'yalnız top5 eksik (5/6 dayanıklı)', pass: near5Rows.length, of93: near5Rows.length },
  },
  rows: rows.filter((r) => r.n > 0).map((r) => ({
    id: r.id, tf: r.tf, kind: r.kind, keys: r.keys, ad: r.stateName, kat: r.stateCat, n: r.n,
    net: r.net, pozAy: r.posMonthPct, top1Ay: r.top1MonthShare, top5Gun: r.top5Share, r2: r.linR2,
    pozGun: r.posDayPct, dd: r.dd, y23: r.y2023, y24: r.y2024, y25: r.y2025,
    hom: r.homojen, eksik: r.missed, score: r.score,
    top10Net: r.top10Net, top10Add: r.top10NetAdd, btcTop5: r.btcTop5, btcBeta: r.btcBeta, exTop5: r.exTop5,
    c4alt10: r.c4alt10 ? 1 : 0, c4alt10c: r.c4alt10c ? 1 : 0, c4btc: r.c4btc ? 1 : 0, c4btcEx: r.c4btcEx ? 1 : 0,
    near5: r.near5 ? 1 : 0, hom10: r.hom10 ? 1 : 0, hom10c: r.hom10c ? 1 : 0, homBtc: r.homBtc ? 1 : 0, katman: r.katman,
    teN: r.testN, hdr: r.hdr ? 1 : 0, keep: r.keep, baseAvg: r.baseAvg, kurt: r.rescued ? 1 : 0,
    aylik: r.months.map((x) => [x.m, Math.round(x.r * 1e6) / 1e6]),
  })),
};
await writeFile(join(BP, 'out', 'homojenlik.json'), JSON.stringify(jsonOut));

/* -------------------------- konsol özeti (hızlı bakış) ---------------------- */
const pos = rows.filter((r) => r.net > 0);
const hom = rows.filter((r) => r.homojen);
console.log(`[homogen] durum: ${rows.length} | net pozitif: ${pos.length} | HOMOJEN: ${hom.length} (temel: ${hom.filter((r) => r.kind === 'temel').length}, filtreli: ${hom.filter((r) => r.kind !== 'temel').length})`);
console.log(`[homogen] ölçüt4 varyantları → orijinal: ${rows.filter((r) => r.homojen).length} | alt10 (artımlı): ${hom10Rows.length} | alt10 (bileşik): ${hom10cRows.length} | BTC-göreli: ${homBtcRows.length} | BTC-beta-arındırılmış: ${homBtcExRows.length} | 5/6 katman: ${near5Rows.length}`);
if (pos.length) {
  const med = (arr) => arr.length ? arr.slice().sort((a, b) => a - b)[arr.length >> 1] : null;
  console.log(`[homogen] pozitiflerde medyan: top5gün payı ${pct(med(pos.map((r) => r.top5Share).filter((v) => v != null)), 0)} | poz ay ${pct(med(pos.map((r) => r.posMonthPct)), 0)} | R² ${med(pos.map((r) => r.linR2).filter((v) => v != null))?.toFixed(2)}`);
}
console.log('[homogen] ilk 12 homojen:');
for (const r of hom.slice(0, 12)) {
  console.log(`  ${r.id} ${r.tf} ${r.kind} [${r.keys.join('+') || 'temel'}] net ${pf(r.net)} | ay+ ${pct(r.posMonthPct, 0)} | top1ay ${pct(r.top1MonthShare, 0)} | top5gün ${pct(r.top5Share, 0)} | R² ${r.linR2?.toFixed(2)} | DD ${pct(r.dd, 0)} | minYıl ${pf(r.minFullYear, 0)}`);
}

/* ------------------------------- MD raporu --------------------------------- */
const L = [];
const now = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
L.push('# Homojenlik Raporu — "Kâr birkaç güne mi bağlı?"');
L.push('');
L.push(`Üretim: ${now} · Veri: günlük portföy eğrileri (\`out/daily/\`, 593 hücre × temel + en iyi 3 filtreli varyant)`);
L.push('');
L.push('## 1. Tanım ve ölçütler');
L.push('');
L.push('Bir strateji/tf/varyant kombinasyonu **"homojen kârlı"** sayılır — yalnızca aşağıdakilerin TAMAMI sağlandığında:');
L.push('');
L.push('| # | Ölçüt | Eşik | Neyi engeller |');
L.push('|---|---|---|---|');
L.push('| 1 | Net kâr | > 0 | Kaybettiren sonuç |');
L.push('| 2 | Pozitif ay oranı | ≥ %60 | Kötü ayların baskın olması |');
L.push('| 3 | En büyük tek ayın payı | ≤ net kârın %33\'ü | "Her şey bir ayda" hikâyesi |');
L.push('| 4 | En iyi %5 günün payı | ≤ net kârın %40\'ı | "Birkaç gün taşıyor" hikâyesi |');
L.push('| 5 | Kümülatif kâr–zaman doğrusal uyum | R² ≥ 0.80 | Sıçramalı/şekilsiz eğri |');
L.push('| 6 | Tam yıllar (2023, 2024, 2025) | Her biri > 0 | Yıllar arası tutarsızlık |');
L.push('');
L.push('Ölçüm notları: portföy eğrisi = işlem yapan sembollerin eşit ağırlıklı ortalaması (orijinal boru hattıyla aynı semantik; doğrulama §2). Aylık pay ve gün payı, artımlı (additive) getiri toplamına göre hesaplanır. R², kümülatif kâr ile zaman arasındaki en küçük kareler uyumudur; "lineer kâr" isteğinin doğrudan ölçüsüdür.');
L.push('');
L.push('## 2. Doğrulama (QA)');
L.push('');
L.push(`- Günlük eğrilerin haftalık alt-kümeleri referans haftalık eğrilerle birebir: ${qa.weeklyChecked} nokta, en büyük fark ${qa.weeklyMaxDiff} (referans eğriler r4 yuvarlanmış), uyuşmazlık **${qa.weeklyMismatch}**.`);
L.push(`- Varyant işlem sayısı/metrikleri ham depoyla birebir: ${qa.variantChecked} varyant, uyuşmazlık **${qa.variantNok}**.`);
L.push('');

// genel istatistik
const baseRows = rows.filter((r) => r.kind === 'temel');
const varRows = rows.filter((r) => r.kind === 'varyant1');
const resRows = rows.filter((r) => r.rescued);
L.push('## 3. Genel Sonuç');
L.push('');
L.push('| Grup | Durum | Net pozitif | Homojen (tüm kriterler) | Oran |');
L.push('|---|---|---|---|---|');
L.push(`| Temel (filtresiz) | ${baseRows.length} | ${baseRows.filter((r) => r.net > 0).length} | ${baseRows.filter((r) => r.homojen).length} | ${pct(baseRows.filter((r) => r.homojen).length / Math.max(1, baseRows.filter((r) => r.net > 0).length), 0)} |`);
L.push(`| En iyi filtreli (varyant1) | ${varRows.length} | ${varRows.filter((r) => r.net > 0).length} | ${varRows.filter((r) => r.homojen).length} | ${pct(varRows.filter((r) => r.homojen).length / Math.max(1, varRows.filter((r) => r.net > 0).length), 0)} |`);
L.push(`| Kurtarılan hücreler (baz negatif → filtreli pozitif) | ${resRows.length} | ${resRows.length} | ${resRows.filter((r) => r.homojen).length} | ${pct(resRows.filter((r) => r.homojen).length / Math.max(1, resRows.length), 0)} |`);
L.push('');
L.push('Not: "kurtarılan" burada günlük portföy eğrisi netine göre tanımlıdır; rapor2\'deki işlem-kapılı tanımda (test kapıları) bu sayı 61\'di — iki tanım küçük farklarla örtüşür.');
L.push('');
if (pos.length) {
  const med = (arr) => { const a = arr.filter((v) => v != null).slice().sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; };
  const t5 = pos.map((r) => r.top5Share).filter((v) => v != null).sort((a, b) => a - b);
  const q = (p) => t5[Math.min(t5.length - 1, Math.floor(p * (t5.length - 1)))];
  L.push('**Pozitif sonuçların tipik profili (çarpıcı bulgu):** net pozitif durumlarda en iyi %5 günün kâr payı medyanı **' + pct(med(t5), 0) + '**, üst çeyrek eşiği **' + pct(q(0.75), 0) + '**, en aşırı %5\'lik dilim **' + pct(t5[t5.length - 1], 0) + '**. Yani pozitiflerin büyük çoğunluğu az sayıda güne bağımlı.');
  L.push('');
  const bigNet = pos.filter((r) => r.net >= 0.5);
  const t5b = bigNet.map((r) => r.top5Share).filter((v) => v != null).sort((a, b) => a - b);
  L.push(`Net kârı ≥ %50 olan ${bigNet.length} "ciddi" pozitifte medyan gün payı **${pct(med(t5b), 0)}**; bu grupta gün payı hâlâ ≤ %100 olan: **${bigNet.filter((r) => r.top5Share != null && r.top5Share <= 1).length}** durum (${pct(bigNet.filter((r) => r.top5Share != null && r.top5Share <= 1).length / Math.max(1, bigNet.length), 0)}).`);
  L.push('');
  L.push('**Ölçüt bazında geçme oranları (yalnız pozitifler):**');
  L.push('');
  L.push('| Ölçüt | Geçen | Oran |');
  L.push('|---|---|---|');
  for (const [name, fn] of CRIT) {
    if (name === 'net>0') continue;
    const pass = pos.filter((r) => !r.missed.includes(name)).length;
    L.push(`| ${name} | ${pass} | ${pct(pass / pos.length, 0)} |`);
  }
  L.push('');
  const onlyTop5 = pos.filter((r) => r.missed.length === 1 && r.missed[0] === 'top5Gün≤%40');
  L.push(`Beş ölçütü geçip **yalnızca "en iyi %5 gün payı ≤ %40" ölçütüne takılan** durum: **${onlyTop5.length}**. Bu, dayanıklılığın önündeki tek yaygın duvarın **gün bazlı yoğunlaşma** olduğunu gösterir.`);
  L.push('');
}

/* ---------------------- 3b. Ölçüt 4 varyantları ---------------------- */
const medTop5 = (() => { const a = pos.map((r) => r.top5Share).filter((v) => v != null).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : null; })();
L.push('## 3b. Ölçüt 4 Varyantları — gün yoğunlaşması nasıl tanımlanmalı?');
L.push('');
L.push(`Orijinal ölçüt ("en iyi %5 günün payı ≤ net kârın %40'ı") günlük kripto serilerinde yapısal olarak ulaşılamaz: net pozitif durumlarda bu payın medyanı **${pct(medTop5, 0)}**. Bu yüzden dört tanımı **birlikte** raporluyoruz; hiçbiri tek başına "doğru" değildir.`);
L.push('');
L.push('| Varyant | Tanım | 6/6 geçen | 93 aday içinde |');
L.push('|---|---|---|---|');
L.push(`| Orijinal | en iyi %5 gün payı ≤ %40 | ${rows.filter((r) => r.homojen).length} | 0 |`);
L.push(`| Alt-10 (artımlı) | en iyi 10 gün çıkarılınca artımlı toplam hâlâ > 0 | ${hom10Rows.length} | ${hom10Rows.length} |`);
L.push(`| Alt-10 (bileşik) | en iyi 10 gün 0 getiri sayılınca bileşik net hâlâ > 0 | ${hom10cRows.length} | ${hom10cRows.length} |`);
L.push(`| BTC-göreli | top5 payı ≤ aynı dönemde BTCUSDT top5 payı (${pct(BTC_TOP5, 0)}) | ${homBtcRows.length} | ${homBtcRows.length} |`);
L.push(`| BTC-beta arındırılmış | BTC beta'sı çıkarıldıktan sonra top5 payı ≤ %40 | ${homBtcExRows.length} | ${homBtcExRows.length} |`);
L.push(`| 5/6 katman | yalnız top5 eksik; diğer 5 ölçüt tamam | ${near5Rows.length} | ${near5Rows.length} |`);
L.push('');
L.push('Not: "6/6 geçen" yalnızca diğer beş ölçütü de geçen durumları sayar; 93 aday zaten diğer beşi geçtiği için iki sütun aynıdır. Orijinal tanımda 6/6 geçen yoktur. BTC-göreli tanım, stratejinin **BTC tutmaktan daha fazla gün-bağımlı olmaması** gerektiğini söyler. BTC-beta arındırılmış tanım ise getiriden BTC beta değerini çıkarıp kalan idiyosinkratik kârın yine az sayıda güne bağlı olup olmadığını ölçer. Artımlı ve bileşik alt-10 tanımı arasındaki fark 2 adaydır (`aroon 4h temel`, `voi 4h varyant2`): bunlar artımlı toplamda pozitif kalırken bileşik nette negatife döner.');
L.push('');
L.push('### 3b.1 Alt-10 varyantını geçen adaylar (artımlı: en iyi 10 gün çıkarılınca kârlı)');
L.push('');
L.push('| # | Strateji | TF | Varyant | Net kâr | Top5 gün | 10 gün sonrası (art.) | 10 gün sonrası (bileş.) | BTC top5 |');
L.push('|---|---|---|---|---|---|---|---|---|');
[...hom10Rows].sort((a, b) => b.net - a.net).forEach((r, i) => {
  L.push(`| ${i + 1} | ${esc(r.title)} | ${r.tf} | ${esc(r.stateName)} | ${pf(r.net)} | ${pct(r.top5Share, 0)} | ${pf(r.top10NetAdd)} | ${pf(r.top10Net)} | ${pct(r.btcTop5, 0)} |`);
});
L.push('');
L.push('### 3b.2 BTC-göreli varyantı geçen adaylar (BTC\'den daha az gün-bağımlı)');
L.push('');
L.push('| # | Strateji | TF | Varyant | Net kâr | Top5 gün | BTC top5 | Fark |');
L.push('|---|---|---|---|---|---|---|---|');
[...homBtcRows].sort((a, b) => b.net - a.net).forEach((r, i) => {
  const fark = (r.btcTop5 != null && r.top5Share != null) ? r.top5Share - r.btcTop5 : null;
  L.push(`| ${i + 1} | ${esc(r.title)} | ${r.tf} | ${esc(r.stateName)} | ${pf(r.net)} | ${pct(r.top5Share, 0)} | ${pct(r.btcTop5, 0)} | ${fark == null ? '—' : (fark >= 0 ? '+' : '') + (fark * 100).toFixed(0) + ' puan'} |`);
});
L.push('');
L.push('> Bu iki liste `HOMOJENLIK.html` üzerinde "Katman" filtresiyle ayrıca görüntülenebilir; `out/homojenlik.csv` içinde `top10_pass`, `btc_rel_pass`, `katman` kolonları vardır.');
L.push('');

L.push('## 4. Homojen Adaylar (tüm kriterleri geçenler)');
L.push('');
const homList = rows.filter((r) => r.homojen);
function monthlyTable(r) {
  const map = new Map(r.months.map((x) => [x.m, x.r]));
  const years = [...new Set(r.months.map((x) => x.m.slice(0, 4)))].sort();
  const head = ['Yıl', ...Array.from({ length: 12 }, (_, i) => String(i + 1)), 'Yıl Toplamı'];
  const lines = ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|'];
  for (const y of years) {
    const cells = [];
    let prod = 1, any = false;
    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const v = map.get(key);
      if (v == null) { cells.push(''); continue; }
      any = true; prod *= (1 + v);
      const star = key === '2022-08' || key === '2026-09' ? '*' : '';
      cells.push((v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%' + star);
    }
    lines.push('| ' + y + ' | ' + cells.join(' | ') + ' | ' + (any ? ((prod - 1) >= 0 ? '+' : '') + ((prod - 1) * 100).toFixed(1) + '%' : '') + ' |');
  }
  return lines.join('\n');
}
if (homList.length === 0) {
  L.push('Bu kriter setiyle **hiçbir durum tüm kriterleri geçemedi**. Kritik ayrıntı: eşiğe yakın adayların (aşağı bakınız) **ortak tek eksiği** — "en iyi %5 günün payı ≤ %40" ölçütü. Yani birçok durum ay-ay/yıl-yıl tutarlı ve zaman içinde lineere yakın ilerliyor, ancak kâr toplamı yine de az sayıda günün sırtında. En yakın adaylar §5\'te.');
  L.push('');
  L.push('> Not: Buradaki “hiçbiri” **orijinal** ölçüt 4 (%40) içindir. Ölçüt 4’ü alternatif tanımlarla değiştirince 6/6 geçen aday sayısı **' + hom10Rows.length + '** (alt-10 artımlı) veya **' + homBtcRows.length + '** (BTC-göreli) olur; ayrıntı ve tam listeler §3b’de.');
  L.push('');
} else {
  L.push(`Kriter setlerinin tamamını geçen **${homList.length}** durum:`);
  L.push('');
  L.push('| # | Strateji | TF | Varyant | İşlem | Net kâr | Poz ay | Top1 ay | Top5 gün | R² | Maks DD | 2023 | 2024 | 2025 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  homList.forEach((r, i) => {
    L.push(`| ${i + 1} | ${esc(r.title)} | ${r.tf} | ${esc(r.stateName)} | ${r.n} | ${pf(r.net)} | ${pct(r.posMonthPct, 0)} | ${pct(r.top1MonthShare, 0)} | ${pct(r.top5Share, 0)} | ${r.linR2?.toFixed(2)} | ${pct(r.dd)} | ${pf(r.y2023, 0)} | ${pf(r.y2024, 0)} | ${pf(r.y2025, 0)} |`);
  });
  L.push('');
  for (const r of homList.slice(0, 12)) {
    L.push(`### ${esc(r.title)} · ${r.tf} · ${esc(r.stateName)}`);
    L.push('');
    L.push(`İşlem: ${r.n} · Net kâr: ${pf(r.net)} · Poz ay: ${pct(r.posMonthPct, 0)} · Top1 ay payı: ${pct(r.top1MonthShare, 0)} · Top5 gün payı: ${pct(r.top5Share, 0)} · R²: ${r.linR2?.toFixed(2)} · Maks DD: ${pct(r.dd)} · Dönem: ${r.t0} → ${r.t1}`);
    L.push('');
    L.push(monthlyTable(r));
    L.push('');
    L.push(`En iyi 5 gün: ${r.best5.map((v) => pf(v)).join(', ')} · En kötü 5 gün: ${r.worst5.map((v) => pf(v)).join(', ')}`);
    L.push('');
  }
}
L.push('## 5. Eşiğe Yakın Adaylar (tek kriter eksik)');
L.push('');
const near = rows.filter((r) => !r.homojen && r.missed.length === 1 && r.net > 0).slice(0, 15);
if (near.length === 0) L.push('—');
else {
  L.push('| Strateji | TF | Varyant | Eksik | Net kâr | Poz ay | Top1 ay | Top5 gün | R² | Maks DD |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of near) L.push(`| ${esc(r.title)} | ${r.tf} | ${esc(r.stateName)} | ${r.missed[0]} | ${pf(r.net)} | ${pct(r.posMonthPct, 0)} | ${pct(r.top1MonthShare, 0)} | ${pct(r.top5Share, 0)} | ${r.linR2?.toFixed(2)} | ${pct(r.dd)} |`);
  L.push('');
}
// §5b — tek eksiği top5 olan grupta en az gün-bağımlı adaylar + duyarlılık
{
  const onlyTop5 = rows.filter((r) => r.net > 0 && r.missed.length === 1 && r.missed[0] === 'top5Gün≤%40');
  if (onlyTop5.length) {
    const srt = [...onlyTop5].sort((a, b) => a.top5Share - b.top5Share);
    L.push('### 5b. En Az Gün-Bağımlı Adaylar (yalnız top5 ölçütüne takılanlar)');
    L.push('');
    L.push('| Strateji | TF | Varyant | Top5 gün payı | Poz ay | Top1 ay | R² | Maks DD | Net kâr | İşlem |');
    L.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const r of srt.slice(0, 15)) {
      L.push(`| ${esc(r.title)} | ${r.tf} | ${esc(r.stateName)} | ${pct(r.top5Share, 0)} | ${pct(r.posMonthPct, 0)} | ${pct(r.top1MonthShare, 0)} | ${r.linR2?.toFixed(2)} | ${pct(r.dd)} | ${pf(r.net)} | ${r.n} |`);
    }
    L.push('');
    const thr = [1.0, 1.5, 2.0, 2.5];
    L.push(`**Eşik duyarlılığı:** Bu grupta top5 eşiğini gevşetirsek — ≤%100: **${onlyTop5.filter((r) => r.top5Share <= 1).length}**, ≤%150: **${onlyTop5.filter((r) => r.top5Share <= 1.5).length}**, ≤%200: **${onlyTop5.filter((r) => r.top5Share <= 2).length}**, ≤%250: **${onlyTop5.filter((r) => r.top5Share <= 2.5).length}** durum "homojen" olurdu. Yani %40 eşiğinin katılığı sonucu belirliyor; %100'ü (kârın tamamının en iyi %5 günde olması) geçen TEK durum yok — bu, crypto trend sistemlerinin yapısal kuyruk bağımlılığıdır.`);
    L.push('');
    L.push('Uyarı: Tüm pozitifler içinde top5 payı **en düşük** ~%100-105 çıkan örnekler (ör. chop 4h, uo 1w) aslında *tek sıçramalı* bozuk eğrilerdir (pozitif ay oranı %6-16, R² < 0.6) — "az gün-bağımlı" görünüp aslında tanımsız/kırılgan sonuçlardır. Bu yüzden tek başına gün payı değil, altı ölçütün tümü aranır.');
    L.push('');
  }
}
L.push('## 6. Karşı-Örnekler — "Birkaç Güne Bağlı" Sonuçlar');
L.push('');
const dep = rows.filter((r) => r.net > 0 && r.top5Share != null).sort((a, b) => b.top5Share - a.top5Share).slice(0, 8);
L.push('| Strateji | TF | Varyant | Net kâr | Top5 gün payı | R² | En iyi gün |');
L.push('|---|---|---|---|---|---|---|');
for (const r of dep) L.push(`| ${esc(r.title)} | ${r.tf} | ${esc(r.stateName)} | ${pf(r.net)} | ${pct(r.top5Share, 0)} | ${r.linR2?.toFixed(2)} | ${pf(r.best5[0])} |`);
L.push('');
L.push('## 7. Sınırlar');
L.push('');
L.push('- Portföy eğrisi sembollerin eşit ağırlıklı ortalamasıdır; tek bir hesap bakiyesi değildir (boru hattı standardı).');
L.push('- Aylık/günlük getiriler özkaynak eğrisinden türetilir; işlem maliyetleri ve funding dahildir.');
L.push('- Bu analiz **veri madenciliği riskini ortadan kaldırmaz**; homojenlik kriterleri seçimden bağımsız uygulanmıştır ama aynı geçmiş veri üzerinde hesaplanmıştır.');
L.push('- Eğitim amaçlıdır; yatırım tavsiyesi değildir.');
L.push('');
L.push('> Ham veri: `out/homojenlik.csv` (tüm durumlar) · `out/homojenlik.json` · günlük eğriler: `out/daily/`');
await writeFile(join(BP, 'out', 'HOMOJENLIK-RAPORU.md'), L.join('\n'));
console.log('[homogen] yazıldı: out/homojenlik.csv, out/homojenlik.json, out/HOMOJENLIK-RAPORU.md');

function esc(s) { return String(s).replace(/\|/g, '\\|'); }
