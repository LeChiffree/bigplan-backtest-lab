// ultra.mjs — ULTRA 10x/15x dayanıklılık senaryosu
// 93 adayı 5 stres ekseninde tarar, hayatta kalanları ve tam sıralamayı üretir.
//
// Eksenler:
//  1) Kaldıraç: 1x, 5x, 10x, 15x, 20x (günlük bileşik; g<=0 tasfiye)
//  2) Likidite evreni: tümü + en hacimli 50/100/150/200/250/300
//  3) Zaman: 2023, 2024, 2025, 2026 YTD
//  4) BTC rejimi: boğa/ayı (SMA200) + yüksek/düşük volatilite (30g)
//  5) Uygulanabilirlik: TF, işlem sıklığı, filtre sayısı, stop, likidite, veri kalitesi
//
// Çıktı: out/ultra_data.json
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BP, BT_STRATEGIES } from './core.mjs';
import { FILTERS, FILTER_CATS } from './filters.mjs';

const D = JSON.parse(await readFile(join(BP, 'out', 'backtest93_data.json'), 'utf8'));
const H = JSON.parse(await readFile(join(BP, 'out', 'homojenlik.json'), 'utf8'));
const G = D.grid;
const DATES = Array.from({ length: G.len }, (_, i) => G.start + i * G.step);
const YEARS = DATES.map((t) => new Date(t).getUTCFullYear());
const HMAP = new Map(H.rows.map((r) => [r.id + '|' + r.tf + '|' + r.kind, r]));
const FMAP = new Map(FILTERS.map((f) => [f.k, f]));
const SMAP = new Map(BT_STRATEGIES.map((s) => [s.id, s]));

/* ------------------------------- BTC rejimi -------------------------------- */
const BTC_DIR = 'D:/1mDataBinance/1d/BTCUSDT';
const btcClose = new Map();
for (const f of (await readdir(BTC_DIR)).filter((f) => f.endsWith('.csv')).sort()) {
  const lines = (await readFile(join(BTC_DIR, f), 'utf8')).split(/\r?\n/);
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
const btc = new Array(G.len).fill(null);
let lastBtc = null;
for (let i = 0; i < G.len; i++) {
  const v = btcClose.get(DATES[i]);
  if (v != null) lastBtc = v;
  btc[i] = lastBtc;
}
const btcR = new Array(G.len).fill(0);
for (let i = 1; i < G.len; i++) {
  if (btc[i] != null && btc[i - 1] != null && btc[i - 1] > 0) btcR[i] = btc[i] / btc[i - 1] - 1;
}
const sma200 = new Array(G.len).fill(null);
for (let i = 199; i < G.len; i++) {
  let s = 0, ok = true;
  for (let j = i - 199; j <= i; j++) { if (btc[j] == null) { ok = false; break; } s += btc[j]; }
  if (ok) sma200[i] = s / 200;
}
const vol30 = new Array(G.len).fill(null);
for (let i = 29; i < G.len; i++) {
  let s = 0, s2 = 0;
  for (let j = i - 29; j <= i; j++) { s += btcR[j]; s2 += btcR[j] * btcR[j]; }
  const mu = s / 30;
  vol30[i] = Math.sqrt(Math.max(0, s2 / 30 - mu * mu)) * Math.sqrt(365);
}
const volVals = vol30.filter((v) => v != null).sort((a, b) => a - b);
const volMed = volVals.length ? volVals[Math.floor(volVals.length / 2)] : null;
const BULL = DATES.map((_, i) => sma200[i] == null ? null : btc[i] > sma200[i]);
const HIVOL = DATES.map((_, i) => vol30[i] == null || volMed == null ? null : vol30[i] > volMed);

/* ------------------------------- metrikler --------------------------------- */
function stats(dret, L) {
  let eq = 1, peak = 1, dd = 0, liq = false, liqDay = null, sum = 0, sum2 = 0, n = 0, minG = 1;
  for (let i = 0; i < dret.length; i++) {
    const g = 1 + L * (dret[i] / 10000);
    if (g <= 0) { liq = true; liqDay = i; break; }
    if (g < minG) minG = g;
    const lg = Math.log(g);
    sum += lg; sum2 += lg * lg; n++;
    eq *= g;
    if (eq > peak) peak = eq;
    const d = eq / peak - 1;
    if (d < dd) dd = d;
  }
  const mu = n ? sum / n : 0;
  const sd = n ? Math.sqrt(Math.max(0, sum2 / n - mu * mu)) : 0;
  return { net: eq - 1, dd, liq, liqDay, mu, sd, minG, n, g: Math.exp(mu * 365) - 1, sh: sd > 0 ? mu / sd * Math.sqrt(365) : null };
}
function compFilter(dret, L, pred) {
  let eq = 1, any = false;
  for (let i = 0; i < dret.length; i++) {
    if (!pred(i)) continue;
    const g = 1 + L * dret[i] / 10000;
    if (g <= 0) return { net: -1, liq: true, any: true };
    eq *= g; any = true;
  }
  return { net: any ? eq - 1 : null, liq: false, any };
}
function meanRegime(dret, L, mask) {
  let s = 0, n = 0;
  for (let i = 0; i < dret.length; i++) {
    if (!mask[i]) continue;
    s += L * dret[i] / 10000; n++;
  }
  return n ? (s / n) * 365 : null; // yıllıklandırılmış ortalama katkı
}
function med(a) { const b = [...a].filter((x) => x != null && isFinite(x)).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; }
function clamp(x, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, x)); }
function pctRank(vals, v, higher = true) {
  const a = vals.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y);
  if (!a.length || v == null || !isFinite(v)) return 0;
  let less = 0, le = 0;
  for (const x of a) { if (x < v) less++; if (x <= v) le++; }
  const p = (less + (le - less) / 2) / a.length;
  return higher ? p : 1 - p;
}
const TF_SCORE = { '1w': 1, '1d': 0.9, '4h': 0.7, '1h': 0.5, '15m': 0.25 };
const SET_LABELS = D.vol.sets || [50, 100, 150, 200, 250, 300];
const HOOKS = {
  mfi: 'Aşırı satım/alım dönüşü; hacim ve BTC likiditesi kapısı.',
  hma: 'Trend teyitli HMA kesişimi; likidite rejimi kapısı.',
  uo: 'Aşırı bölge dönüşü; RVOL ve 30 günlük momentum kapısı.',
  smi: 'Aşırı bölge dönüşü; piyasa genişliği ve kontra ROC kapısı.',
  nvi: 'Sessiz birikim trendi; yüksek volatilite ve RSI aşırı bölge yasağı.',
};

const rawRows = [];
for (const s of D.states) {
  const h = HMAP.get(s.id + '|' + s.tf + '|' + s.kind);
  const strat = SMAP.get(s.id) || { title: s.id, dir: 'ls', rules: [], stop: '—' };
  const filters = (s.keys || []).map((k) => {
    const f = FMAP.get(k);
    return f ? { k, title: f.title, desc: f.desc, cat: f.cat, catTitle: FILTER_CATS[f.cat] || f.cat } : { k, title: k, desc: '', cat: '', catTitle: '' };
  });
  const l1 = stats(s.dret, 1);
  const l5 = stats(s.dret, 5);
  const l10 = stats(s.dret, 10);
  const l15 = stats(s.dret, 15);
  const l20 = stats(s.dret, 20);
  const eff10 = l1.mu > 0 ? l10.mu / (10 * l1.mu) : null;
  const eff15 = l1.mu > 0 ? l15.mu / (15 * l1.mu) : null;
  const sets = SET_LABELS.map((label, i) => {
    const a = stats(s.dretSets[i], 10), b = stats(s.dretSets[i], 15);
    return { label, net10: a.net, dd10: a.dd, liq10: a.liq, net15: b.net, dd15: b.dd, liq15: b.liq, g10: a.g };
  });
  const volPos = sets.filter((x) => !x.liq10 && x.net10 > 0).length;
  const liquidPos = sets.slice(0, 3).filter((x) => !x.liq10 && x.net10 > 0).length;
  const liquidLiq15 = sets.slice(0, 3).filter((x) => x.liq15).length;
  const calmarSets = sets.map((x) => x.liq10 ? -Infinity : (x.dd10 < 0 ? x.net10 / Math.abs(x.dd10) : null));
  const volMinCalmar10 = calmarSets.every((x) => x == null || !isFinite(x)) ? null : Math.min(...calmarSets.filter((x) => x != null));
  const maxSet = Math.max(...sets.map((x) => x.net10));
  const minSet = Math.min(...sets.map((x) => x.net10));
  const volSpread = (maxSet - minSet) / (1 + Math.max(0, maxSet));
  const liquidMedian = med(sets.slice(0, 3).map((x) => x.net10));

  const y10 = {};
  for (const y of [2023, 2024, 2025, 2026]) {
    y10[y] = compFilter(s.dret, 10, (i) => YEARS[i] === y).net;
  }
  const yMin10 = Math.min(...[2023, 2024, 2025].map((y) => y10[y] ?? 0));
  const yPos = [2023, 2024, 2025, 2026].filter((y) => (y10[y] ?? -1) > 0).length;

  const bull = meanRegime(s.dret, 10, BULL.map((v) => v === true));
  const bear = meanRegime(s.dret, 10, BULL.map((v) => v === false));
  const hi = meanRegime(s.dret, 10, HIVOL.map((v) => v === true));
  const lo = meanRegime(s.dret, 10, HIVOL.map((v) => v === false));
  const regimeVals = [bull, bear, hi, lo].filter((v) => v != null);
  const regimePos = regimeVals.filter((v) => v > 0).length;
  const regimeWorst = regimeVals.length ? Math.min(...regimeVals) : null;

  // likidite: işlem sayısına göre ağırlıklı ortalama hacim sırası
  const ranks = D.vol.rank || [];
  let nsum = 0, rsum = 0;
  for (const c of (s.agg?.coins || [])) {
    const n = c[1] || 0;
    if (!n) continue;
    const rk = ranks[c[0]] || 520;
    nsum += n; rsum += n * rk;
  }
  const avgRank = nsum ? rsum / nsum : 520;
  const liqRankScore = clamp(1 - (avgRank - 1) / 519);

  // uygulanabilirlik / güvenilirlik ham puanları
  const perYear = s.n / 4.09;
  const freqScore = perYear < 25 ? 0.3 : perYear < 60 ? 0.6 : perYear < 250 ? 0.9 : perYear < 2500 ? 1 : perYear < 12000 ? 0.85 : 0.65;
  const stop = strat.stop;
  const stopScore = stop && typeof stop === 'object' ? 1 : /Yok/i.test(String(stop)) ? 0.55 : /iz|chandelier|SAR/i.test(String(stop)) ? 0.75 : 0.7;
  const filterScore = clamp(1 - 0.15 * (s.keys?.length || 0), 0.4, 1);
  const dataScore = s.kurt ? 0.5 : s.hdr ? 0.9 : 1;
  const dirScore = strat.dir === 'long' ? 1 : 0.75;
  const sampleScore = clamp(Math.log10(s.n + 1) / 4);
  const testScore = clamp(Math.log10((s.teN || 0) + 1) / 3.6);
  const dd10Score = clamp(1 - Math.abs(l10.dd) / 0.85);

  rawRows.push({
    key: s.key, id: s.id, tf: s.tf, kind: s.kind, ad: s.ad, keys: s.keys || [], keyTitles: s.keyTitles || [],
    title: strat.title, stratCat: strat.dir, dir: strat.dir, rules: strat.rules || [], stop: typeof stop === 'object' ? 'ATR/Seviye stopu' : String(stop),
    hook: HOOKS[s.id] || '',
    filters,
    n: s.n, w: s.agg?.w || 0, winRate: s.agg?.n ? s.agg.w / s.agg.n : null, avgDurH: s.agg?.n ? s.agg.durSum / s.agg.n : null,
    teN: s.teN, baseAvg: s.baseAvg, kurt: s.kurt, hdr: s.hdr,
    net1: l1.net, dd1: l1.dd, net5: l5.net, dd5: l5.dd,
    net10: l10.net, dd10: l10.dd, liq10: l10.liq, net15: l15.net, dd15: l15.dd, liq15: l15.liq, net20: l20.net, dd20: l20.dd, liq20: l20.liq,
    g1: l1.g, g5: l5.g, g10: l10.g, g15: l15.g, eff10, eff15, sh1: l1.sh, sh5: l5.sh, sh10: l10.sh, sh15: l15.sh,
    minG15: l15.minG, mu10: l10.mu, sd10: l10.sd, mu15: l15.mu, sd15: l15.sd,
    y10, yMin10, yPos,
    bull, bear, hi, lo, regimePos, regimeWorst,
    sets, volPos, liquidPos, liquidLiq15, volMinCalmar10, volSpread, liquidMedian,
    avgRank, liqRankScore,
    hom: {
      top5: h?.top5Gun ?? s.top5Gun, pozAy: h?.pozAy ?? s.pozAy, top1: h?.top1Ay ?? s.top1Ay,
      r2: h?.r2 ?? s.r2, y23: h?.y23 ?? s.y23, y24: h?.y24 ?? s.y24, y25: h?.y25 ?? s.y25,
      alt10: h?.c4alt10 === 1, alt10c: h?.c4alt10c === 1, btc: h?.c4btc === 1, katman: h?.katman || '',
    },
    tfScore: TF_SCORE[s.tf] ?? 0.4,
    freqScore, stopScore, filterScore, dataScore, dirScore, sampleScore, testScore, dd10Score,
    dret: s.dret,
  });
}

/* ------------------------------ kapılar ------------------------------------ */
const gates = {
  liq10: (r) => !r.liq10,
  liq15: (r) => !r.liq15,
  dd15: (r) => r.dd15 > -0.90,
  sample: (r) => r.n >= 200 && (r.teN || 0) >= 50,
  vol: (r) => r.volPos >= 4,
  buffer: (r) => r.minG15 > 0.20,
  positive: (r) => r.g15 > 0,
};
for (const r of rawRows) {
  r.fail = [];
  if (!gates.liq10(r)) r.fail.push('10x tasfiye');
  if (!gates.liq15(r)) r.fail.push('15x tasfiye');
  if (!gates.dd15(r)) r.fail.push('15x maks DD ≤ -90%');
  if (!gates.sample(r)) r.fail.push('örneklem < 200 işlem / < 50 test');
  if (!gates.vol(r)) r.fail.push('hacim evreni < 4/6 pozitif');
  if (!gates.buffer(r)) r.fail.push('15x en kötü gün tamponu ≤ %20');
  if (!gates.positive(r)) r.fail.push('15x log büyümesi ≤ 0');
  r.survives = r.fail.length === 0;
}

/* ------------------------------- puanlar ----------------------------------- */
const ALL = rawRows;
const arr = (fn) => ALL.map(fn);
const pEff15 = arr((r) => r.eff15);
const pSh15 = arr((r) => r.sh15);
const pDd15 = arr((r) => r.dd15);
const pMinG15 = arr((r) => r.minG15);
const pTop5 = arr((r) => r.hom.top5);
const pTop1 = arr((r) => r.hom.top1);
const pYMin = arr((r) => r.yMin10);
const pVolCal = arr((r) => r.volMinCalmar10);
const pVolSpread = arr((r) => r.volSpread);
const pRegWorst = arr((r) => r.regimeWorst);

for (const r of ALL) {
  const lev = 10 * pctRank(pEff15, r.eff15)
    + 10 * pctRank(pSh15, r.sh15)
    + 8 * pctRank(pDd15, r.dd15)
    + 4 * pctRank(pMinG15, r.minG15)
    + 3 * (r.liq15 ? 0 : 1);

  const hom = 8 * pctRank(pTop5, r.hom.top5, false)
    + 4 * clamp((r.hom.pozAy - 0.55) / 0.25)
    + 4 * clamp((r.hom.r2 - 0.60) / 0.35)
    + 3 * pctRank(pTop1, r.hom.top1, false)
    + 4 * pctRank(pYMin, r.yMin10)
    + (r.hom.alt10c ? 1 : 0)
    + (r.hom.btc ? 1 : 0);

  const vol = clamp(
    6 * (r.volPos / 6)
      + 5 * (r.liquidPos / 3)
      + 5 * pctRank(pVolCal, r.volMinCalmar10)
      + 4 * pctRank(pVolSpread, r.volSpread, false)
      - 2 * (r.liquidLiq15 || 0),
    0, 20,
  );

  const regime = 4 * (r.yPos / 4)
    + 3 * (r.regimePos / 4)
    + 3 * pctRank(pRegWorst, r.regimeWorst);

  const impl = 1.5 * r.tfScore
    + 1 * r.freqScore
    + 1 * r.filterScore
    + 0.5 * r.stopScore
    + 0.5 * r.liqRankScore
    + 0.5 * r.dataScore;

  const rel = 1.5 * r.sampleScore
    + 1.5 * r.testScore
    + 1 * (r.liq20 ? 0 : 1)
    + 1 * r.dd10Score;

  r.scores = {
    lev: Math.round(lev * 10) / 10,
    hom: Math.round(hom * 10) / 10,
    vol: Math.round(vol * 10) / 10,
    regime: Math.round(regime * 10) / 10,
    impl: Math.round(impl * 10) / 10,
    rel: Math.round(rel * 10) / 10,
    total: Math.round((lev + hom + vol + regime + impl + rel) * 10) / 10,
  };
}

/* ------------------------- sıralama ve ilk 5 ------------------------------- */
const survivors = ALL.filter((r) => r.survives).sort((a, b) => b.scores.total - a.scores.total);
const eliminated = ALL.filter((r) => !r.survives).sort((a, b) => b.scores.total - a.scores.total);
const ranked = [...survivors, ...eliminated];
ranked.forEach((r, i) => { r.rank = i + 1; r.bucket = r.survives ? 'hayatta' : 'elendi'; });

// aynı temel stratejinin en iyi konfigürasyonu = strateji sırası
const bestById = new Map();
for (const r of survivors) {
  const b = bestById.get(r.id);
  if (!b || r.scores.total > b.scores.total) bestById.set(r.id, r);
}
const distinctRanked = [...bestById.values()].sort((a, b) => b.scores.total - a.scores.total);
distinctRanked.forEach((r, i) => { r.strategyRank = i + 1; r.isBest = 1; });
for (const r of ranked) {
  if (!r.isBest) { r.strategyRank = null; r.altOf = bestById.get(r.id)?.key || null; }
}
const top5 = distinctRanked.slice(0, 5);
const top5Keys = top5.map((r) => r.key);
ranked.forEach((r) => {
  const ti = top5Keys.indexOf(r.key);
  r.top5 = ti >= 0 ? ti + 1 : 0;
  r.sameStratAlt = ti < 0 && top5.some((x) => x.id === r.id) ? 1 : 0;
});

const funnel = {
  total: ALL.length,
  liq10: ALL.filter((r) => r.liq10).length,
  liq15: ALL.filter((r) => r.liq15).length,
  deepDD: ALL.filter((r) => !gates.dd15(r)).length,
  lowSample: ALL.filter((r) => !gates.sample(r)).length,
  volFragile: ALL.filter((r) => !gates.vol(r)).length,
  thinBuffer: ALL.filter((r) => !gates.buffer(r)).length,
  nonPositive: ALL.filter((r) => !gates.positive(r)).length,
  survivors: survivors.length,
  distinct: new Set(survivors.map((r) => r.id)).size,
};
const gatePass = {
  liq10: ALL.filter(gates.liq10).length,
  liq15: ALL.filter(gates.liq15).length,
  dd15: ALL.filter(gates.dd15).length,
  sample: ALL.filter(gates.sample).length,
  vol: ALL.filter(gates.vol).length,
  buffer: ALL.filter(gates.buffer).length,
  positive: ALL.filter(gates.positive).length,
};

const out = {
  gen: new Date().toISOString(),
  scenario: {
    title: 'ULTRA 10x/15x Dayanıklılık Senaryosu',
    total: ALL.length,
    axes: [
      'Kaldıraç: 1x / 5x / 10x / 15x / 20x (günlük bileşik, tasfiye eşiği)',
      'Likidite: tümü + en hacimli 50/100/150/200/250/300',
      'Zaman: 2023 / 2024 / 2025 / 2026 YTD',
      'BTC rejimi: boğa-ayı (SMA200) + yüksek-düşük volatilite (30g)',
      'Uygulanabilirlik: TF, işlem sıklığı, filtre sayısı, stop, likidite, veri kalitesi',
    ],
    gates: [
      '10x ve 15x tasfiye yok',
      '15x maks DD > -90%',
      'en az 200 işlem ve 50 test işlemi',
      'en az 4/6 hacim evreninde 10x pozitif',
      '15x en kötü gün tamponu > %20',
      '15x log büyümesi > 0',
    ],
    weights: { lev: 35, hom: 25, vol: 20, regime: 10, impl: 5, rel: 5 },
    btc: { days: volVals.length, volMedian: volMed, bullDays: BULL.filter((v) => v === true).length, bearDays: BULL.filter((v) => v === false).length },
  },
  grid: D.grid,
  universe: D.symbols.length,
  volSets: SET_LABELS,
  funnel,
  gatePass,
  top5: top5Keys,
  states: ranked.map((r) => {
    const { dret, ...rest } = r;
    return { ...rest, dret };
  }),
};

await writeFile(join(BP, 'out', 'ultra_data.json'), JSON.stringify(out));
console.log('[ultra] yazıldı: out/ultra_data.json');
console.log('[ultra] huni:', JSON.stringify(funnel));
console.log('[ultra] ilk 5:');
for (const r of top5) {
  console.log(`  #${r.rank} ${r.key} · ${r.title} · ${r.tf} · skor ${r.scores.total} · 10x ${(r.net10 * 100).toFixed(0)}% / DD ${(r.dd10 * 100).toFixed(0)}% · 15x ${(r.net15 * 100).toFixed(0)}% / DD ${(r.dd15 * 100).toFixed(0)}% · eff15 ${r.eff15?.toFixed(2)} · sh15 ${r.sh15?.toFixed(2)} · n ${r.n}`);
}
console.log('[ultra] hayatta kalan diğerleri:');
for (const r of survivors.filter((x) => !top5Keys.includes(x.key))) {
  console.log(`  #${r.rank} ${r.key} · ${r.title} · ${r.tf} · skor ${r.scores.total} · 10x ${(r.net10 * 100).toFixed(0)}% / DD ${(r.dd10 * 100).toFixed(0)}% · 15x ${(r.net15 * 100).toFixed(0)}% / DD ${(r.dd15 * 100).toFixed(0)}%`);
}
