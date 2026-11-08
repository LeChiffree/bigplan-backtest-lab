// extract_pro_worker.mjs — Hızlı, sıfır-tahsisli (zero-alloc) işlem bazlı veri çıkarımı (worker)
// Her sembol yalnızca kendi ayrık hacim katmanına (Tier 0..6) yazar; üst süreçte kümülatif toplam alınır.
import { parentPort, workerData } from 'node:worker_threads';
import { BT_STRATEGIES } from './core.mjs';
import { makeCtx, clearMemCache } from './dataload.mjs';
import { simulateMulti } from './sim2.mjs';
import { loadMarketBase, marketView } from './market.mjs';
import { buildGates } from './filters.mjs';

const { symbols, states, symIndex, tierBySym } = workerData;
const TF_MS = { '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000, '1w': 604800000 };
const TFS = ['15m', '1h', '4h', '1d', '1w'];

const DGRID_START = Date.UTC(2022, 7, 1);
const GD = 1500; // 2022-08-01 .. 2026-09-08
const NTIER = 7; // 0:1..50, 1:51..100, 2:101..150, 3:151..200, 4:201..250, 5:251..300, 6:301..520
const NY = 5;    // 2022..2026

// Günlük ızgara için tarih tablolarını önceden hesapla (onTrade içinde new Date() tahsisini sıfırlar)
const DAY_YEAR = new Uint8Array(GD);
const DAY_MONTH = new Uint8Array(GD);
const DAY_QUARTER = new Uint8Array(GD);
const DAY_SEASON = new Uint8Array(GD);
const DAY_DOW = new Uint8Array(GD);
const SEASON_MAP = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0]; // 0:Kış, 1:İlkbahar, 2:Yaz, 3:Sonbahar
for (let g = 0; g < GD; g++) {
  const d = new Date(DGRID_START + g * 86400000);
  const m = d.getUTCMonth();
  DAY_YEAR[g] = Math.max(0, Math.min(NY - 1, d.getUTCFullYear() - 2022));
  DAY_MONTH[g] = m;
  DAY_QUARTER[g] = (m / 3) | 0;
  DAY_SEASON[g] = SEASON_MAP[m];
  DAY_DOW[g] = d.getUTCDay();
}

// Kalma süresi dilimleri (saat cinsinden):
// 0: <1g (<24s), 1: 1-3g (24-72s), 2: 3-7g (72-168s), 3: 7-14g (168-336s),
// 4: 14-35g (336-840s), 5: 35-65g (840-1560s), 6: 65+g (>=1560s)
const DUR_EDGES = [0, 24, 72, 168, 336, 840, 1560, Infinity];
const NDUR = 7;
const RET_EDGES = [-1, -0.2, -0.1, -0.05, -0.02, -0.01, 0, 0.01, 0.02, 0.05, 0.1, 0.2, Infinity];
const NRET = 12;

function durBinOf(h) {
  if (h < 24) return 0;
  if (h < 72) return 1;
  if (h < 168) return 2;
  if (h < 336) return 3;
  if (h < 840) return 4;
  if (h < 1560) return 5;
  return 6;
}
function retBinOf(r) {
  if (r < -0.2) return 0;
  if (r < -0.1) return 1;
  if (r < -0.05) return 2;
  if (r < -0.02) return 3;
  if (r < -0.01) return 4;
  if (r < 0) return 5;
  if (r < 0.01) return 6;
  if (r < 0.02) return 7;
  if (r < 0.05) return 8;
  if (r < 0.1) return 9;
  if (r < 0.2) return 10;
  return 11;
}

// Kova stride = 7: [n, w, sumR, sumLog, durSum, sumPos, sumNeg]
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
    ret: new Float64Array(NRET * 3), // [n, sumPos, sumNeg]
    ls: new Float64Array(2 * 5),     // [n, w, sumR, sumPos, sumNeg] × (0:Long, 1:Short)
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

function addB7(arr, idx, r, lr, durH, pos, neg) {
  const o = idx * 7;
  arr[o]++;
  if (r > 0) arr[o + 1]++;
  arr[o + 2] += r;
  arr[o + 3] += lr;
  arr[o + 4] += durH;
  arr[o + 5] += pos;
  arr[o + 6] += neg;
}

function addCoin(map, ci, r, lr, durH, pos, neg) {
  let a = map.get(ci);
  if (!a) { a = [0, 0, 0, 0, 0, 0, 0]; map.set(ci, a); }
  a[0]++;
  if (r > 0) a[1]++;
  a[2] += r;
  a[3] += lr;
  a[4] += durH;
  a[5] += pos;
  a[6] += neg;
}

// Durumları tf ve id'ye göre grupla
const byTf = {};
for (const st of states) (byTf[st.tf] ||= []).push(st);
const tfIds = {};
for (const tf of Object.keys(byTf)) {
  const m = new Map();
  for (const st of byTf[tf]) {
    if (!m.has(st.id)) m.set(st.id, []);
    m.get(st.id).push(st);
  }
  tfIds[tf] = m;
}
const stratById = new Map(BT_STRATEGIES.map((s) => [s.id, s]));

const stateData = new Map();
for (const st of states) {
  const withCoin = !st.isSingle;
  const tiers = Array.from({ length: NTIER }, () => newTierAgg(withCoin));
  stateData.set(st.key, {
    isSingle: !!st.isSingle,
    tiers,
    coins: withCoin ? new Map() : null,
    samples: withCoin ? [] : null,
    seen: 0,
    rng: 123456789,
  });
}

class ProTracker {
  constructor(sd, tierAgg, ci, tfMs) {
    this.sd = sd;
    this.T = tierAgg;
    this.ci = ci;
    this.tfMs = tfMs;
  }
  onTrade(r, bars, xt, side) {
    let gd = ((xt - DGRID_START) / 86400000) | 0;
    if (gd < 0) gd = 0;
    else if (gd >= GD) gd = GD - 1;

    const y = DAY_YEAR[gd];
    const mon = DAY_MONTH[gd];
    const qtr = DAY_QUARTER[gd];
    const sea = DAY_SEASON[gd];
    const dow = DAY_DOW[gd];

    const entryT = xt - bars * this.tfMs;
    const remMs = ((entryT % 86400000) + 86400000) % 86400000;
    const hourBin = (remMs / 10800000) | 0;

    const durH = (bars * this.tfMs) / 3600000;
    const dBin = durBinOf(durH);
    const rBin = retBinOf(r);
    const lr = Math.log1p(r);
    const win = r > 0 ? 1 : 0;
    const pos = r > 0 ? r : 0;
    const neg = r < 0 ? -r : 0;

    const T = this.T;
    T.n++; T.w += win; T.sumR += r; T.sumLog += lr; T.durSum += durH; T.sumPos += pos; T.sumNeg += neg;
    T.dayPos[gd] += pos;
    T.dayNeg[gd] += neg;
    T.dayCnt[gd]++;

    const Y = T.years[y];
    Y.n++; Y.w += win; Y.sumR += r; Y.sumLog += lr; Y.durSum += durH; Y.sumPos += pos; Y.sumNeg += neg;

    addB7(Y.dow, dow, r, lr, durH, pos, neg);
    addB7(Y.month, mon, r, lr, durH, pos, neg);
    addB7(Y.quarter, qtr, r, lr, durH, pos, neg);
    addB7(Y.season, sea, r, lr, durH, pos, neg);
    addB7(Y.hour, hourBin, r, lr, durH, pos, neg);
    addB7(Y.dur, dBin, r, lr, durH, pos, neg);

    const ro = rBin * 3;
    Y.ret[ro]++; Y.ret[ro + 1] += pos; Y.ret[ro + 2] += neg;

    const lso = (side === -1 ? 1 : 0) * 5;
    Y.ls[lso]++; Y.ls[lso + 1] += win; Y.ls[lso + 2] += r; Y.ls[lso + 3] += pos; Y.ls[lso + 4] += neg;

    const sd = this.sd;
    if (sd.coins) {
      addCoin(sd.coins, this.ci, r, lr, durH, pos, neg);
      addCoin(Y.coin, this.ci, r, lr, durH, pos, neg);
      const seen = ++sd.seen;
      const smp = [durH, r * 100, this.ci, y];
      if (sd.samples.length < 240) sd.samples.push(smp);
      else {
        sd.rng = (sd.rng * 1664525 + 1013904223) >>> 0;
        const j = sd.rng % seen;
        if (j < 240) sd.samples[j] = smp;
      }
    }
  }
}

const baseMkt = await loadMarketBase();
const errors = [];
const t0 = Date.now();

for (let si = 0; si < symbols.length; si++) {
  const symbol = symbols[si];
  const ci = symIndex[symbol];
  const tier = tierBySym[symbol] ?? 6;

  for (const tf of TFS) {
    const groups = tfIds[tf];
    if (!groups) continue;
    let ctx;
    try { ctx = await makeCtx(tf, symbol); }
    catch (e) { continue; }
    const n = ctx.S.t.length;
    const ones = new Uint8Array(n).fill(1);

    const need = new Set();
    for (const list of groups.values()) for (const st of list) for (const k of st.keys) need.add(k);
    let gates = null;
    try {
      if (need.size) gates = buildGates(ctx, marketView(baseMkt, ctx.S, tf), [...need]);
    } catch (e) {
      errors.push({ symbol, tf, msg: 'gate: ' + e.message });
      clearMemCache();
      continue;
    }

    for (const [id, list] of groups) {
      const spec = stratById.get(id);
      if (!spec || (spec.skipTfs && spec.skipTfs.includes(tf))) continue;
      const gl = [], gs = [], trs = [];
      for (const st of list) {
        let L = ones, S = ones;
        if (st.keys.length === 1) {
          L = gates.L[st.keys[0]];
          S = gates.S[st.keys[0]];
        } else if (st.keys.length > 1) {
          L = new Uint8Array(n); S = new Uint8Array(n);
          L.set(gates.L[st.keys[0]]); S.set(gates.S[st.keys[0]]);
          for (let k = 1; k < st.keys.length; k++) {
            const l = gates.L[st.keys[k]], s = gates.S[st.keys[k]];
            for (let i = 0; i < n; i++) { L[i] &= l[i]; S[i] &= s[i]; }
          }
        }
        gl.push(L); gs.push(S);
        const sd = stateData.get(st.key);
        trs.push(new ProTracker(sd, sd.tiers[tier], ci, TF_MS[tf]));
      }
      try { simulateMulti(spec, ctx, gl, gs, trs); }
      catch (e) { errors.push({ symbol, tf, id, msg: 'sim: ' + e.message }); }
    }
    clearMemCache();
  }
  if (si % 20 === 0 || si === symbols.length - 1) {
    parentPort.postMessage({ type: 'progress', done: si + 1, total: symbols.length, ms: Date.now() - t0 });
  }
}

function serYear(Y) {
  return {
    n: Y.n, w: Y.w, sumR: Y.sumR, sumLog: Y.sumLog, durSum: Y.durSum, sumPos: Y.sumPos, sumNeg: Y.sumNeg,
    coin: Y.coin ? [...Y.coin.entries()] : null,
    dow: Array.from(Y.dow),
    month: Array.from(Y.month),
    quarter: Array.from(Y.quarter),
    season: Array.from(Y.season),
    hour: Array.from(Y.hour),
    dur: Array.from(Y.dur),
    ret: Array.from(Y.ret),
    ls: Array.from(Y.ls),
  };
}

function serTier(T) {
  return {
    n: T.n, w: T.w, sumR: T.sumR, sumLog: T.sumLog, durSum: T.durSum, sumPos: T.sumPos, sumNeg: T.sumNeg,
    years: T.years.map(serYear),
    dayPos: Array.from(T.dayPos),
    dayNeg: Array.from(T.dayNeg),
    dayCnt: Array.from(T.dayCnt),
  };
}

const out = {};
for (const [k, sd] of stateData) {
  out[k] = {
    tiers: sd.tiers.map(serTier),
    coins: sd.coins ? [...sd.coins.entries()] : null,
    samples: sd.samples || null,
  };
}
parentPort.postMessage({ type: 'result', aggs: out, errors, ms: Date.now() - t0 });
