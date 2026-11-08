// extract93_vol_worker.mjs — 93 "5/6" durum için hacim-setli işlem çıkarımı (worker)
// Her sembol, hacim sırasına göre top-N setlerine (50..300 + tümü) katkı verir.
// Çıktı: set başına işlem kovaları + set başına günlük özkaynak toplamları.
import { parentPort, workerData } from 'node:worker_threads';
import { BT_STRATEGIES } from './core.mjs';
import { makeCtx, clearMemCache } from './dataload.mjs';
import { simulateMulti } from './sim2.mjs';
import { loadMarketBase, marketView } from './market.mjs';
import { buildGates } from './filters.mjs';

const { symbols, states, symIndex, rankBySym, setNs } = workerData;
const TF_MS = { '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000, '1w': 604800000 };
const TFS = ['15m', '1h', '4h', '1d', '1w'];

// günlük ızgara (out/daily ile aynı: 2022-08-01 .. 2026-09-08 dahil)
const DGRID = (() => {
  const start = Date.UTC(2022, 7, 1), end = Date.UTC(2026, 8, 8), out = [];
  for (let t = start; t <= end; t += 86400000) out.push(t);
  return Float64Array.from(out);
})();
const GD = DGRID.length;

const SETS = [...setNs, Infinity];   // 50,100,150,200,250,300,tümü
const NSET = SETS.length;

// durumları tf ve id'ye göre grupla
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

// --- agg yapısı -------------------------------------------------------------
const NY = 5; // 2022..2026
function newYear(withCoin) {
  return {
    n: 0, w: 0, sumR: 0, sumLog: 0, durSum: 0,
    coin: withCoin ? new Map() : null,
    dow: new Float64Array(7 * 5),
    month: new Float64Array(12 * 5),
    season: new Float64Array(4 * 5),
    hour: new Float64Array(8 * 5),
    dur: new Float64Array(8 * 5),
    ret: new Float64Array(12),
  };
}
function newAgg(withCoin, withSamples) {
  return {
    withCoin, n: 0, w: 0, sumR: 0, sumLog: 0, durSum: 0,
    coins: withCoin ? new Map() : null,
    years: Array.from({ length: NY }, () => newYear(withCoin)),
    samples: withSamples ? [] : null, seen: 0, rng: 123456789,
    eqSums: new Float64Array(GD),
    eqCnts: new Int32Array(GD),
  };
}

// durum → set dizisi (son eleman: tümü)
const aggs = new Map();
for (const st of states) {
  const arr = [];
  for (let s = 0; s < NSET; s++) arr.push(newAgg(s === NSET - 1, s === NSET - 1));
  aggs.set(st.key, arr);
}

const DUR_EDGES = [0, 1, 6, 24, 72, 168, 720, 2160, Infinity];
const RET_EDGES = [-1, -0.2, -0.1, -0.05, -0.02, -0.01, 0, 0.01, 0.02, 0.05, 0.1, 0.2, Infinity];
function binOf(edges, v) {
  for (let i = 0; i < edges.length - 1; i++) if (v < edges[i + 1]) return i;
  return edges.length - 2;
}
const SEASON = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0];

function addBucket(arr, idx, r, lr, durH) {
  const o = idx * 5;
  arr[o]++; if (r > 0) arr[o + 1]++; arr[o + 2] += r; arr[o + 3] += lr; arr[o + 4] += durH;
}
function addMap(map, key, r, lr, durH) {
  let a = map.get(key);
  if (!a) { a = [0, 0, 0, 0, 0, 0, 0]; map.set(key, a); }
  a[0]++; if (r > 0) a[1]++; a[2] += r; a[3] += lr; a[4] += durH;
  if (r > 0) a[5] += r; else a[6] -= r;
}

class Tracker {
  constructor(key, aggList, ci, tfMs, firstT) {
    this.key = key;
    this.aggs = aggList;       // setStart..NSET-1
    this.ci = ci;
    this.tfMs = tfMs;
    this.n = 0;
    this.eq = 1;
    this.eqOut = new Float32Array(GD).fill(NaN);
    let gs = 0; while (gs < GD && DGRID[gs] < firstT) gs++;
    this.gStart = gs; this.gk = gs;
  }
  onTrade(r, bars, xt) {
    const entryT = xt - bars * this.tfMs;
    const d = new Date(entryT);
    const y = d.getUTCFullYear() - 2022;
    if (y < 0 || y >= NY) return;
    this.n++;
    const lr = Math.log1p(r);
    const durH = (bars * this.tfMs) / 3600000;
    const win = r > 0;
    const day = d.getUTCDay(), mon = d.getUTCMonth();
    const hourBin = Math.floor(d.getUTCHours() / 3), durBin = binOf(DUR_EDGES, durH), retBin = binOf(RET_EDGES, r);

    for (let si = 0; si < this.aggs.length; si++) {
      const A = this.aggs[si], Y = A.years[y];
      A.n++; A.w += win; A.sumR += r; A.sumLog += lr; A.durSum += durH;
      Y.n++; Y.w += win; Y.sumR += r; Y.sumLog += lr; Y.durSum += durH;
      addBucket(Y.dow, day, r, lr, durH);
      addBucket(Y.month, mon, r, lr, durH);
      addBucket(Y.season, SEASON[mon], r, lr, durH);
      addBucket(Y.hour, hourBin, r, lr, durH);
      addBucket(Y.dur, durBin, r, lr, durH);
      Y.ret[retBin]++;
      if (A.withCoin) {
        addMap(A.coins, this.ci, r, lr, durH);
        addMap(Y.coin, this.ci, r, lr, durH);
      }
    }

    // rezervuar örnek (yalnız tümü seti)
    const A0 = this.aggs[this.aggs.length - 1];
    const seen = ++A0.seen;
    const smp = [durH, r * 100, this.ci, y];
    if (A0.samples.length < 300) A0.samples.push(smp);
    else {
      A0.rng = (A0.rng * 1664525 + 1013904223) >>> 0;
      const j = A0.rng % seen;
      if (j < 300) A0.samples[j] = smp;
    }

    // günlük özkaynak eğrisi (DailyTracker birebir)
    const eqOut = this.eqOut, gStart = this.gStart;
    let gk = this.gk;
    while (gk < GD && DGRID[gk] < xt) { if (gk >= gStart) eqOut[gk] = Math.fround(this.eq); gk++; }
    this.gk = gk;
    this.eq *= 1 + r;
  }
  finish() {
    const eqOut = this.eqOut, gStart = this.gStart;
    let gk = this.gk;
    while (gk < GD) { if (gk >= gStart) eqOut[gk] = Math.fround(this.eq); gk++; }
    this.gk = gk;
  }
}

function mergeEq(aggArr, setStart, eqOut) {
  for (let s = setStart; s < NSET; s++) {
    const A = aggArr[s], sums = A.eqSums, cnts = A.eqCnts;
    for (let g = 0; g < GD; g++) {
      const v = eqOut[g];
      if (!Number.isNaN(v)) { sums[g] += v; cnts[g]++; }
    }
  }
}

// --- ana döngü ---------------------------------------------------------------
const baseMkt = await loadMarketBase();
const errors = [];
const t0 = Date.now();

for (let si = 0; si < symbols.length; si++) {
  const symbol = symbols[si];
  const ci = symIndex[symbol];
  // bu sembol hangi setlere girer?
  const rank = rankBySym[symbol] || 1e9;
  let setStart = SETS.findIndex((n) => rank <= n);
  if (setStart < 0) setStart = NSET - 1;

  for (const tf of TFS) {
    const groups = tfIds[tf];
    if (!groups) continue;
    let ctx;
    try { ctx = await makeCtx(tf, symbol); }
    catch (e) { continue; }
    const n = ctx.S.t.length;
    const firstT = ctx.S.t[0];
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
        if (st.keys.length) {
          L = new Uint8Array(n); S = new Uint8Array(n);
          L.set(gates.L[st.keys[0]]); S.set(gates.S[st.keys[0]]);
          for (let k = 1; k < st.keys.length; k++) {
            const l = gates.L[st.keys[k]], s = gates.S[st.keys[k]];
            for (let i = 0; i < n; i++) { L[i] &= l[i]; S[i] &= s[i]; }
          }
        }
        gl.push(L); gs.push(S);
        trs.push(new Tracker(st.key, aggs.get(st.key).slice(setStart), ci, TF_MS[tf], firstT));
      }
      try { simulateMulti(spec, ctx, gl, gs, trs); }
      catch (e) { errors.push({ symbol, tf, id, msg: 'sim: ' + e.message }); }
      for (const tr of trs) {
        tr.finish();
        if (tr.n > 0) mergeEq(aggs.get(tr.key), setStart, tr.eqOut);
      }
    }
    clearMemCache();
  }
  if (si % 25 === 0 || si === symbols.length - 1) {
    parentPort.postMessage({ type: 'progress', done: si + 1, total: symbols.length, ms: Date.now() - t0 });
  }
}

// --- serileştir --------------------------------------------------------------
function serAll(A) {
  return {
    n: A.n, w: A.w, sumR: A.sumR, sumLog: A.sumLog, durSum: A.durSum,
    coins: A.coins ? [...A.coins.entries()] : [],
    years: A.years.map((Y) => ({
      n: Y.n, w: Y.w, sumR: Y.sumR, sumLog: Y.sumLog, durSum: Y.durSum,
      coin: Y.coin ? [...Y.coin.entries()] : [],
      dow: Array.from(Y.dow), month: Array.from(Y.month), season: Array.from(Y.season),
      hour: Array.from(Y.hour), dur: Array.from(Y.dur), ret: Array.from(Y.ret),
    })),
    samples: A.samples || [],
  };
}
function serSet(A) {
  return {
    n: A.n, w: A.w, sumR: A.sumR, sumLog: A.sumLog, durSum: A.durSum,
    years: A.years.map((Y) => ({
      n: Y.n, w: Y.w, sumR: Y.sumR, sumLog: Y.sumLog, durSum: Y.durSum,
      dow: Array.from(Y.dow), month: Array.from(Y.month), season: Array.from(Y.season),
      hour: Array.from(Y.hour), dur: Array.from(Y.dur), ret: Array.from(Y.ret),
    })),
  };
}

const out = {};
const transfer = [];
for (const st of states) {
  const arr = aggs.get(st.key);
  out[st.key] = {
    all: serAll(arr[NSET - 1]),
    sets: arr.slice(0, NSET - 1).map(serSet),
    eqSums: arr.map((A) => A.eqSums),
    eqCnts: arr.map((A) => A.eqCnts),
  };
  for (const A of arr) transfer.push(A.eqSums.buffer, A.eqCnts.buffer);
}
parentPort.postMessage({ type: 'result', aggs: out, errors, ms: Date.now() - t0 }, transfer);
