// extract93_worker.mjs — 93 "5/6" durum için işlem bazlı toplama (worker)
// Her durum × sembol için simulateMulti çalışır; işlemler anında kovalara yazılır.
import { parentPort, workerData } from 'node:worker_threads';
import { BT_STRATEGIES } from './core.mjs';
import { makeCtx, clearMemCache } from './dataload.mjs';
import { simulateMulti } from './sim2.mjs';
import { loadMarketBase, marketView } from './market.mjs';
import { buildGates } from './filters.mjs';

const { symbols, states, symIndex } = workerData;
const TF_MS = { '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000, '1w': 604800000 };
const TFS = ['15m', '1h', '4h', '1d', '1w'];

// durumları tf ve id'ye göre grupla
const byTf = {};
for (const st of states) {
  (byTf[st.tf] ||= []).push(st);
}
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
function newYear() {
  return {
    n: 0, w: 0, sumR: 0, sumLog: 0, durSum: 0,
    coin: new Map(),
    dow: new Float64Array(7 * 5),
    month: new Float64Array(12 * 5),
    season: new Float64Array(4 * 5),
    hour: new Float64Array(8 * 5),
    dur: new Float64Array(8 * 5),
    ret: new Float64Array(12),
  };
}
function newAgg() {
  return {
    n: 0, w: 0, sumR: 0, sumLog: 0, durSum: 0,
    coins: new Map(),
    years: Array.from({ length: NY }, newYear),
    samples: [], seen: 0, rng: 123456789,
  };
}

const aggs = new Map();
for (const st of states) aggs.set(st.key, newAgg());

const DUR_EDGES = [0, 1, 6, 24, 72, 168, 720, 2160, Infinity];
const RET_EDGES = [-1, -0.2, -0.1, -0.05, -0.02, -0.01, 0, 0.01, 0.02, 0.05, 0.1, 0.2, Infinity];
function binOf(edges, v) {
  for (let i = 0; i < edges.length - 1; i++) if (v < edges[i + 1]) return i;
  return edges.length - 2;
}
const SEASON = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0]; // Oca..Ara → kış/ilkbahar/yaz/sonbahar

function addBucket(arr, idx, r, lr, durH) {
  const o = idx * 5;
  arr[o]++; if (r > 0) arr[o + 1]++; arr[o + 2] += r; arr[o + 3] += lr; arr[o + 4] += durH;
}
function addMap(map, key, r, lr, durH) {
  let a = map.get(key);
  if (!a) { a = [0, 0, 0, 0, 0]; map.set(key, a); }
  a[0]++; if (r > 0) a[1]++; a[2] += r; a[3] += lr; a[4] += durH;
}

class Tracker {
  constructor(agg, ci, tfMs) { this.agg = agg; this.ci = ci; this.tfMs = tfMs; }
  onTrade(r, bars, xt) {
    const entryT = xt - bars * this.tfMs;
    const d = new Date(entryT);
    const y = d.getUTCFullYear() - 2022;
    if (y < 0 || y >= NY) return;
    const A = this.agg, Y = A.years[y];
    const lr = Math.log1p(r);
    const durH = (bars * this.tfMs) / 3600000;
    const win = r > 0;

    A.n++; A.w += win; A.sumR += r; A.sumLog += lr; A.durSum += durH;
    Y.n++; Y.w += win; Y.sumR += r; Y.sumLog += lr; Y.durSum += durH;

    addMap(A.coins, this.ci, r, lr, durH);
    addMap(Y.coin, this.ci, r, lr, durH);

    addBucket(Y.dow, d.getUTCDay(), r, lr, durH);
    addBucket(Y.month, d.getUTCMonth(), r, lr, durH);
    addBucket(Y.season, SEASON[d.getUTCMonth()], r, lr, durH);
    addBucket(Y.hour, Math.floor(d.getUTCHours() / 3), r, lr, durH);
    addBucket(Y.dur, binOf(DUR_EDGES, durH), r, lr, durH);
    Y.ret[binOf(RET_EDGES, r)]++;

    // 300'lük rezervuar örnek (saçılım grafiği için)
    const seen = ++A.seen;
    const smp = [durH, r * 100, this.ci, y];
    if (A.samples.length < 300) A.samples.push(smp);
    else {
      A.rng = (A.rng * 1664525 + 1013904223) >>> 0;
      const j = A.rng % seen;
      if (j < 300) A.samples[j] = smp;
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
  for (const tf of TFS) {
    const groups = tfIds[tf];
    if (!groups) continue;
    let ctx;
    try { ctx = await makeCtx(tf, symbol); }
    catch (e) { continue; } // yetersiz bar vb.
    const n = ctx.S.t.length;
    const ones = new Uint8Array(n).fill(1);

    // gereken tüm kapı anahtarları
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
        trs.push(new Tracker(aggs.get(st.key), ci, TF_MS[tf]));
      }
      try { simulateMulti(spec, ctx, gl, gs, trs); }
      catch (e) { errors.push({ symbol, tf, id, msg: 'sim: ' + e.message }); }
    }
    clearMemCache();
  }
  if (si % 25 === 0 || si === symbols.length - 1) {
    parentPort.postMessage({ type: 'progress', done: si + 1, total: symbols.length, ms: Date.now() - t0 });
  }
}

// --- serileştir --------------------------------------------------------------
function serAgg(A) {
  return {
    n: A.n, w: A.w, sumR: A.sumR, sumLog: A.sumLog, durSum: A.durSum,
    coins: [...A.coins.entries()],
    years: A.years.map((Y) => ({
      n: Y.n, w: Y.w, sumR: Y.sumR, sumLog: Y.sumLog, durSum: Y.durSum,
      coin: [...Y.coin.entries()],
      dow: Array.from(Y.dow), month: Array.from(Y.month), season: Array.from(Y.season),
      hour: Array.from(Y.hour), dur: Array.from(Y.dur), ret: Array.from(Y.ret),
    })),
    samples: A.samples,
  };
}
const out = {};
for (const [k, A] of aggs) out[k] = serAgg(A);
parentPort.postMessage({ type: 'result', aggs: out, errors, ms: Date.now() - t0 });
