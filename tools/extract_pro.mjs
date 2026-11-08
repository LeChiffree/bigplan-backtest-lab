// extract_pro.mjs — Gelişmiş Backtest & Filtre Laboratuvarı veri üreticisi
// 42 strateji × 75 (id,tf) hücresi × (temel + varyant1..3 + tekil filtre anahtarları)
// Çıktı: out/pro_data.json
import { readFile, writeFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { join } from 'node:path';
import { BT_STRATEGIES } from './core.mjs';
import { FILTERS } from './filters.mjs';

const BP = 'D:/BigPlan';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v == null ? true : v];
}));
const SYM_LIMIT = +args.symbols || 0;
const OUT = args.out || 'out/pro_data.json';
const NW = Math.max(2, Math.min(7, cpus().length - 1));

const H = JSON.parse(await readFile(join(BP, 'out', 'homojenlik.json'), 'utf8'));
const OLD93 = JSON.parse(await readFile(join(BP, 'out', 'backtest93_data.json'), 'utf8'));
const oldByKey = new Map(OLD93.states.map((s) => [s.key, s]));

const ids42 = new Set(OLD93.states.map((s) => s.id));
const cells = new Set(OLD93.states.map((s) => s.id + '|' + s.tf));
for (const r of H.rows) {
  if (!ids42.has(r.id)) continue;
  if (!['1h', '4h', '1d', '1w'].includes(r.tf)) continue;
  if (r.net > 0 && (r.r2 || 0) >= 0.72 && (r.pozAy || 0) >= 0.55 && r.y23 > 0 && r.y24 > 0 && r.y25 > 0) {
    cells.add(r.id + '|' + r.tf);
  }
}

const filterMap = new Map(FILTERS.map((f) => [f.k, f]));
const stratMap = new Map(BT_STRATEGIES.map((s) => [s.id, s]));

const states = [];
for (const cell of cells) {
  const [id, tf] = cell.split('|');
  const rs = H.rows.filter((r) => r.id === id && r.tf === tf);
  const seenKeySets = new Set();
  const singleKeys = new Set();
  for (const r of rs) {
    const ks = (r.keys || []).slice();
    const sig = ks.slice().sort().join('+');
    seenKeySets.add(sig);
    for (const k of ks) singleKeys.add(k);
    states.push({
      key: `${r.id}|${r.tf}|${r.kind}`,
      id: r.id,
      tf: r.tf,
      kind: r.kind,
      keys: ks,
      ad: r.ad || (ks.length ? ks.map((k) => filterMap.get(k)?.title || k).join(' + ') : 'Filtresiz (Temel)'),
      isSingle: false,
      in93: oldByKey.has(`${r.id}|${r.tf}|${r.kind}`),
      hMeta: {
        net: r.net, pozAy: r.pozAy, top1Ay: r.top1Ay, top5Gun: r.top5Gun, r2: r.r2,
        pozGun: r.pozGun, dd: r.dd, y23: r.y23, y24: r.y24, y25: r.y25,
        teN: r.teN, baseAvg: r.baseAvg, kurt: r.kurt,
      },
    });
  }
  for (const k of singleKeys) {
    if (seenKeySets.has(k)) continue;
    const f = filterMap.get(k);
    states.push({
      key: `${id}|${tf}|single:${k}`,
      id,
      tf,
      kind: `single:${k}`,
      keys: [k],
      ad: `Tekil Filtre: ${f?.title || k}`,
      isSingle: true,
      in93: false,
      hMeta: null,
    });
  }
}

const U = JSON.parse(await readFile(join(BP, 'out', 'universe.json'), 'utf8'));
const symbolsAll = U.symbols;
const symIndex = Object.fromEntries(symbolsAll.map((s, i) => [s, i]));

const V = JSON.parse(await readFile(join(BP, 'out', 'coin_volume.json'), 'utf8'));
const volOrder = Object.keys(V.bySym).sort((a, b) => V.bySym[b].volAnnual5 - V.bySym[a].volAnnual5);
const rankBySym = Object.fromEntries(volOrder.map((s, i) => [s, i + 1]));
const annualBySym = Object.fromEntries(volOrder.map((s) => [s, V.bySym[s].volAnnual5]));

const SET_NS = [50, 100, 150, 200, 250, 300];
const NTIER = 7;
const tierBySym = {};
for (const s of symbolsAll) {
  const rk = rankBySym[s] || 999999;
  let t = SET_NS.findIndex((lim) => rk <= lim);
  if (t < 0) t = 6;
  tierBySym[s] = t;
}

const symbols = SYM_LIMIT ? symbolsAll.slice(0, SYM_LIMIT) : symbolsAll;
console.log(`[extract_pro] hücre: ${cells.size}, durum: ${states.length} (ana: ${states.filter((s) => !s.isSingle).length}, tekil: ${states.filter((s) => s.isSingle).length}), sembol: ${symbols.length}, worker: ${NW}`);

const GD = 1500;
const NY = 5;
const NDUR = 7;
const NRET = 12;

function newYear(withCoin) {
  return {
    n: 0, w: 0, sumR: 0, sumLog: 0, durSum: 0, sumPos: 0, sumNeg: 0,
    coin: withCoin ? new Map() : null,
    dow: new Float64Array(7 * 7),
    month: new Float64Array(12 * 7),
    quarter: new Float64Array(4 * 7),
    season: new Float64Array(4 * 7),
    hour: new Float64Array(8 * 7),
    dur: new Float64Array(NDUR * 7),
    ret: new Float64Array(NRET * 3),
    ls: new Float64Array(2 * 5),
  };
}
function newTierAgg(withCoin) {
  return {
    n: 0, w: 0, sumR: 0, sumLog: 0, durSum: 0, sumPos: 0, sumNeg: 0,
    years: Array.from({ length: NY }, () => newYear(withCoin)),
    dayPos: new Float64Array(GD),
    dayNeg: new Float64Array(GD),
    dayCnt: new Int32Array(GD),
  };
}

function addArr(dst, src) { for (let i = 0; i < dst.length; i++) dst[i] += src[i]; }
function addMap(dst, entries) {
  if (!dst || !entries) return;
  for (const [k, a] of entries) {
    let b = dst.get(k);
    if (!b) { b = [0, 0, 0, 0, 0, 0, 0]; dst.set(k, b); }
    for (let i = 0; i < 7; i++) b[i] += a[i];
  }
}

function mergeTier(dst, src) {
  dst.n += src.n; dst.w += src.w; dst.sumR += src.sumR; dst.sumLog += src.sumLog;
  dst.durSum += src.durSum; dst.sumPos += src.sumPos; dst.sumNeg += src.sumNeg;
  addArr(dst.dayPos, src.dayPos);
  addArr(dst.dayNeg, src.dayNeg);
  addArr(dst.dayCnt, src.dayCnt);
  for (let y = 0; y < NY; y++) {
    const a = dst.years[y], b = src.years[y];
    a.n += b.n; a.w += b.w; a.sumR += b.sumR; a.sumLog += b.sumLog;
    a.durSum += b.durSum; a.sumPos += b.sumPos; a.sumNeg += b.sumNeg;
    addArr(a.dow, b.dow);
    addArr(a.month, b.month);
    addArr(a.quarter, b.quarter);
    addArr(a.season, b.season);
    addArr(a.hour, b.hour);
    addArr(a.dur, b.dur);
    addArr(a.ret, b.ret);
    addArr(a.ls, b.ls);
    if (a.coin && b.coin) addMap(a.coin, b.coin);
  }
}

const merged = new Map();
for (const st of states) {
  const withCoin = !st.isSingle;
  merged.set(st.key, {
    tiers: Array.from({ length: NTIER }, () => newTierAgg(withCoin)),
    coins: withCoin ? new Map() : null,
    samples: withCoin ? [] : null,
  });
}

function runWorker(chunk, wi) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./extract_pro_worker.mjs', import.meta.url), {
      workerData: { symbols: chunk, states, symIndex, tierBySym },
    });
    let last = Date.now();
    w.on('message', (m) => {
      if (m.type === 'progress') {
        const now = Date.now();
        if (now - last > 15000) { last = now; console.log(`  [w${wi}] ${m.done}/${m.total} sembol · ${(m.ms / 1000).toFixed(0)}s`); }
      } else if (m.type === 'result') {
        console.log(`  [w${wi}] bitti · ${(m.ms / 1000).toFixed(0)}s · hata: ${m.errors.length}`);
        resolve(m);
      }
    });
    w.on('error', reject);
    w.on('exit', (c) => { if (c !== 0) reject(new Error('worker exit ' + c)); });
  });
}

const t0 = Date.now();
const chunks = Array.from({ length: NW }, (_, i) => symbols.filter((_, j) => j % NW === i));
const results = await Promise.all(chunks.map((c, i) => runWorker(c, i)));

let errs = [];
for (const r of results) {
  errs = errs.concat(r.errors || []);
  for (const st of states) {
    const src = r.aggs[st.key];
    if (!src) continue;
    const dst = merged.get(st.key);
    for (let t = 0; t < NTIER; t++) mergeTier(dst.tiers[t], src.tiers[t]);
    if (dst.coins && src.coins) addMap(dst.coins, src.coins);
    if (dst.samples && src.samples) {
      for (const s of src.samples) if (dst.samples.length < 240) dst.samples.push(s);
    }
  }
}
console.log(`[extract_pro] birleştirme bitti · ${((Date.now() - t0) / 1000).toFixed(1)}s · hata: ${errs.length}`);

const r4 = (v) => Math.round(v * 10000) / 10000;
const r3 = (v) => Math.round(v * 1000) / 1000;
const r2 = (v) => Math.round(v * 100) / 100;

function roundArr(arr, dec = 3) {
  const m = Math.pow(10, dec);
  return Array.from(arr, (v) => Math.round(v * m) / m);
}

function buildCumulativeSets(tiers) {
  const cum = [];
  let acc = newTierAgg(false);
  for (let t = 0; t < NTIER; t++) {
    mergeTier(acc, tiers[t]);
    const snap = newTierAgg(false);
    mergeTier(snap, acc);
    cum.push(snap);
  }
  return cum;
}

function formatYear(Y) {
  return {
    n: Y.n, w: Y.w, sumR: r3(Y.sumR), sumLog: r3(Y.sumLog), durSum: r2(Y.durSum),
    sumPos: r3(Y.sumPos), sumNeg: r3(Y.sumNeg),
    dow: roundArr(Y.dow, 3),
    month: roundArr(Y.month, 3),
    quarter: roundArr(Y.quarter, 3),
    season: roundArr(Y.season, 3),
    hour: roundArr(Y.hour, 3),
    dur: roundArr(Y.dur, 3),
    ret: roundArr(Y.ret, 3),
    ls: roundArr(Y.ls, 3),
  };
}

// En çok kâr/zarar yazan ilk 35 + son 35 sembolü koru (boyut optimizasyonu + hacim sırası uyumlu)
function trimCoins(coinsMap) {
  if (!coinsMap) return [];
  const arr = [...coinsMap.entries()].map(([ci, a]) => [ci, a[0], a[1], r3(a[2]), r3(a[3]), r2(a[4]), r3(a[5]), r3(a[6])]);
  arr.sort((a, b) => b[3] - a[3]);
  if (arr.length <= 70) return arr;
  return arr.slice(0, 35).concat(arr.slice(-35));
}

const dailyCache = new Map();
async function getDailyNode(id, tf, kind) {
  if (!dailyCache.has(id)) {
    try {
      dailyCache.set(id, JSON.parse(await readFile(join(BP, 'out', 'daily', id + '.json'), 'utf8')));
    } catch {
      dailyCache.set(id, null);
    }
  }
  const d = dailyCache.get(id);
  if (!d || !d.tf || !d.tf[tf]) return null;
  const t = d.tf[tf];
  if (kind === 'temel') return t.base;
  if (kind.startsWith('varyant')) return (t.variants || [])[+kind.replace('varyant', '') - 1] || null;
  return null;
}

function curveToDret(curve) {
  if (!curve || !curve.length) return new Array(GD).fill(0);
  const dret = new Array(curve.length);
  dret[0] = 0;
  let prev = curve[0];
  for (let i = 1; i < curve.length; i++) {
    const v = curve[i];
    dret[i] = (v == null || prev == null || !(prev > 0)) ? 0 : Math.round((v / prev - 1) * 10000);
    prev = v;
  }
  return dret;
}

const outStates = [];
let excludedNeg = 0;

for (const st of states) {
  const M = merged.get(st.key);
  const cum = buildCumulativeSets(M.tiers);
  const allT = cum[NTIER - 1];

  const totAvg = allT.n ? allT.sumR / allT.n : 0;
  const y26 = allT.years[4];
  const y26Avg = y26 && y26.n ? y26.sumR / y26.n : 0;
  const posBoth = totAvg > 0 && y26Avg > 0;
  if (!posBoth && !st.isSingle && st.kind !== 'temel') excludedNeg++;

  const old = oldByKey.get(st.key);
  const dNode = await getDailyNode(st.id, st.tf, st.kind);
  const dret = old ? old.dret : (dNode ? curveToDret(dNode.curve) : roundArr(allT.dayPos.map((p, i) => (p - allT.dayNeg[i]) * 100), 0));

  const strat = stratMap.get(st.id) || {};
  const filtersMeta = st.keys.map((k) => {
    const f = filterMap.get(k);
    return { k, title: f?.title || k, desc: f?.desc || '', cat: f?.cat || '' };
  });

  // dayPos / dayNeg: centi-birim (v * 100, tam sayı; $10 işlemde 1 birim = $0.10)
  const dayPosC = Array.from(allT.dayPos, (v) => Math.round(v * 100));
  const dayNegC = Array.from(allT.dayNeg, (v) => Math.round(v * 100));

  const aggAll = {
    n: allT.n, w: allT.w, sumR: r3(allT.sumR), sumLog: r3(allT.sumLog), durSum: r2(allT.durSum),
    sumPos: r3(allT.sumPos), sumNeg: r3(allT.sumNeg),
    dayPosC,
    dayNegC,
    years: allT.years.map(formatYear),
    coins: trimCoins(M.coins),
    samples: (M.samples || []).slice(0, 140).map(([h, r, ci, y]) => [r2(h), r2(r), ci, y]),
  };

  // Hacim setleri (50..300) — ana durumlar için yıllık + kategori kovaları
  const sets = !st.isSingle ? cum.slice(0, 6).map((S) => ({
    n: S.n, w: S.w, sumR: r3(S.sumR), sumLog: r3(S.sumLog), durSum: r2(S.durSum),
    sumPos: r3(S.sumPos), sumNeg: r3(S.sumNeg),
    years: S.years.map(formatYear),
  })) : null;

  outStates.push({
    key: st.key,
    id: st.id,
    title: strat.title || st.id.toUpperCase(),
    dir: strat.dir || 'ls',
    rules: strat.rules || [],
    stop: typeof strat.stop === 'object' ? 'ATR/Seviye stopu' : String(strat.stop || 'Yok (ters sinyal)'),
    tf: st.tf,
    kind: st.kind,
    isSingle: st.isSingle,
    in93: st.in93,
    posBoth,
    totAvg: r4(totAvg),
    y26Avg: r4(y26Avg),
    keys: st.keys,
    keyTitles: st.keys.map((k) => filterMap.get(k)?.title || k),
    filters: filtersMeta,
    ad: st.ad,
    n: allT.n,
    net: st.hMeta?.net ?? (dNode?.sum?.tot ?? r3(allT.sumR)),
    pozAy: st.hMeta?.pozAy ?? null,
    top1Ay: st.hMeta?.top1Ay ?? null,
    top5Gun: st.hMeta?.top5Gun ?? null,
    r2: st.hMeta?.r2 ?? null,
    dd: st.hMeta?.dd ?? (dNode?.sum?.dd ?? null),
    y23: st.hMeta?.y23 ?? null,
    y24: st.hMeta?.y24 ?? null,
    y25: st.hMeta?.y25 ?? null,
    teN: st.hMeta?.teN ?? (dNode?.te?.n ?? null),
    kurt: st.hMeta?.kurt ?? 0,
    dret,
    dretSets: old?.dretSets || null,
    agg: aggAll,
    sets,
  });
}

const out = {
  gen: new Date().toISOString(),
  grid: OLD93.grid,
  symbols: symbolsAll,
  keyTitle: OLD93.keyTitle,
  vol: {
    sets: SET_NS,
    annual: symbolsAll.map((s) => annualBySym[s] || 0),
    rank: symbolsAll.map((s) => rankBySym[s] || 999999),
  },
  strategies: [...ids42].map((id) => {
    const s = stratMap.get(id) || {};
    return {
      id,
      title: s.title || id.toUpperCase(),
      dir: s.dir || 'ls',
      rules: s.rules || [],
      stop: typeof s.stop === 'object' ? 'ATR/Seviye stopu' : String(s.stop || 'Yok (ters sinyal)'),
    };
  }),
  states: outStates,
  errors: errs.slice(0, 30),
};

await writeFile(join(BP, OUT), JSON.stringify(out));
console.log(`[extract_pro] yazıldı: ${OUT} · durum: ${outStates.length} · posBoth olmayan varyant: ${excludedNeg} · MB: ${(JSON.stringify(out).length / 1048576).toFixed(2)}`);
