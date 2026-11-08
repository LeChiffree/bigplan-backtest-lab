// Filtre Laboratuvarı — GÜNLÜK işçi (worker_threads)
// Mod: 'daily' — hücre başına seçilen varyantlar (K = 1 + varyant sayısı),
// portföy eğrisi günlük ızgaraya örneklenir. İşlem muhasebesi agg2 ile birebir.
import { parentPort, workerData } from 'node:worker_threads';
import { BT_STRATEGIES } from './core.mjs';
import { makeCtx, clearMemCache } from './dataload.mjs';
import { simulateMulti } from './sim2.mjs';
import { DailyTracker, newDailyAcc, mergeSymbolIntoDaily } from './dagg.mjs';
import { loadMarketBase, marketView } from './market.mjs';
import { buildGates } from './filters.mjs';

const { symbols, tfs, specs, symbolOffset = 0 } = workerData;

// specs: { 'id:tf': [ [keys], ... ] } → hücre başına durum listesi (max 3)
const cellSpec = (id, tf) => specs[id + ':' + tf] || null;

const ids = new Set(Object.keys(specs).map((k) => k.split(':')[0]));
const STRATEGIES = BT_STRATEGIES.filter((s) => ids.has(s.id));

const baseMkt = await loadMarketBase();

// accs[id][tf] = [baseline, ...durumlar]
const accs = {};
for (const spec of STRATEGIES) {
  accs[spec.id] = {};
  for (const tf of tfs) {
    const lst = cellSpec(spec.id, tf);
    const K = lst ? 1 + lst.length : 0;
    const arr = [];
    for (let k = 0; k < K; k++) arr.push(newDailyAcc());
    accs[spec.id][tf] = arr;
  }
}

const errors = [];
const t0 = Date.now();

for (let si = 0; si < symbols.length; si++) {
  const symbol = symbols[si];
  for (const tf of tfs) {
    let ctx;
    try {
      ctx = await makeCtx(tf, symbol);
    } catch (e) {
      errors.push({ symbol, tf, id: '-', msg: e.message });
      continue;
    }
    const n = ctx.S.t.length;
    const ones = new Uint8Array(n).fill(1);

    // kapılar: bu tf'de gereken tüm anahtarlar için bir kez
    const need = new Set();
    for (const spec of STRATEGIES) {
      const lst = cellSpec(spec.id, tf);
      if (lst) for (const keys of lst) for (const k of keys) need.add(k);
    }
    let gates = null;
    if (need.size) {
      const M = marketView(baseMkt, ctx.S, tf);
      gates = buildGates(ctx, M, [...need]);
    }

    for (const spec of STRATEGIES) {
      if (spec.skipTfs && spec.skipTfs.includes(tf)) continue;
      const lst = cellSpec(spec.id, tf);
      if (!lst) continue;

      const K = 1 + lst.length;
      const gl = new Array(K), gs = new Array(K);
      gl[0] = ones; gs[0] = ones;
      for (let c = 0; c < lst.length; c++) {
        const keys = lst[c];
        const aL = new Uint8Array(n).fill(1), aS = new Uint8Array(n).fill(1);
        for (const kk of keys) {
          const l = gates.L[kk], s = gates.S[kk];
          for (let i = 0; i < n; i++) { aL[i] &= l[i]; aS[i] &= s[i]; }
        }
        gl[c + 1] = aL; gs[c + 1] = aS;
      }

      const trackers = [];
      for (let k = 0; k < K; k++) trackers.push(new DailyTracker(ctx.S.t[0]));
      let r;
      try {
        r = simulateMulti(spec, ctx, gl, gs, trackers);
      } catch (e) {
        errors.push({ symbol, tf, id: spec.id, msg: e.message });
        continue;
      }
      if (r.errCount) errors.push({ symbol, tf, id: spec.id, msg: 'sim: ' + r.firstErr, count: r.errCount });
      for (let k = 0; k < K; k++) {
        trackers[k].finish();
        mergeSymbolIntoDaily(accs[spec.id][tf][k], trackers[k]);
      }
    }
    parentPort.postMessage({ type: 'progress', symbol: `${symbol} ${tf}`, ms: Date.now() - t0 });
  }
  clearMemCache();
}

const transfer = [];
for (const spec of STRATEGIES) {
  for (const tf of tfs) {
    for (const acc of accs[spec.id][tf] || []) {
      transfer.push(acc.pool.buffer, acc.years.buffer, acc.tr.buffer, acc.te.buffer, acc.eqSums.buffer, acc.eqCnts.buffer);
    }
  }
}
parentPort.postMessage({ type: 'result', accs, errors, ms: Date.now() - t0 }, transfer);
