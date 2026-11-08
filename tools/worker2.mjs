// Filtre Laboratuvarı — işçi (worker_threads)
// Modlar:
//   baseline : kapı yok (K=1) — doğrulama koşusu
//   singles  : baseline + groupKeys filtreleri (her filtre ayrı sanal portföy)
//   combos   : hücre başına seçilmiş kombinasyonlar (VE kapıları)
import { parentPort, workerData } from 'node:worker_threads';
import { BT_STRATEGIES } from './core.mjs';
import { makeCtx, clearMemCache } from './dataload.mjs';
import { simulateMulti } from './sim2.mjs';
import { StateTracker, newCompactAcc, mergeSymbolInto } from './agg2.mjs';
import { loadMarketBase, marketView } from './market.mjs';
import { buildGates } from './filters.mjs';

const { symbols, tfs, mode, groupKeys = [], only = null, combos = null, symbolOffset = 0, totalSymbols = 0 } = workerData;
const STRATEGIES = only && only.length
  ? BT_STRATEGIES.filter((s) => only.includes(s.id))
  : BT_STRATEGIES;

const baseMkt = mode === 'baseline' ? null : await loadMarketBase();

// kombo hücreleri: 'id:tf' → [ [k1,k2], [k1,k2,k3], ... ]
const comboMap = combos || {};

function cellCombos(id, tf) {
  if (mode === 'singles') return null; // groupKeys kullanılır
  const c = comboMap[id + ':' + tf];
  return c && c.length ? c : null;
}

// accs[id][tf] = [baseline, ...durumlar]
const NSYM = totalSymbols || symbols.length;
const accs = {};
for (const spec of STRATEGIES) {
  accs[spec.id] = {};
  for (const tf of tfs) {
    const nCombos = cellCombos(spec.id, tf)?.length || 0;
    const K = mode === 'singles' ? 1 + groupKeys.length : 1 + nCombos;
    const arr = [];
    for (let k = 0; k < K; k++) arr.push(newCompactAcc(NSYM));
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
    const bh = n && ctx.S.c[0] > 0 ? ctx.S.c[n - 1] / ctx.S.c[0] - 1 : 0;

    // kapıları bir kez üret
    let gates = null;
    if (mode === 'singles') {
      const M = marketView(baseMkt, ctx.S, tf);
      gates = buildGates(ctx, M, groupKeys);
    } else if (mode === 'combos') {
      const need = new Set();
      for (const spec of STRATEGIES) {
        const lst = cellCombos(spec.id, tf);
        if (lst) for (const c of lst) for (const k of c) need.add(k);
      }
      if (need.size) {
        const M = marketView(baseMkt, ctx.S, tf);
        gates = buildGates(ctx, M, [...need]);
      }
    }

    // durum izleyicileri — singles modunda sembol/tf başına bir kez ayrılıp yeniden kullanılır
    let reuseTrackers = null;
    if (mode === 'singles') {
      reuseTrackers = [];
      for (let k = 0; k < 1 + groupKeys.length; k++) reuseTrackers.push(new StateTracker(ctx.S.t[0]));
    }

    for (const spec of STRATEGIES) {
      if (spec.skipTfs && spec.skipTfs.includes(tf)) continue;
      const lst = mode === 'combos' ? cellCombos(spec.id, tf) : null;
      if (mode === 'combos' && !lst) continue;

      // durum kapı dizileri
      let gl, gs, K;
      if (mode === 'baseline') {
        gl = [ones]; gs = [ones]; K = 1;
      } else if (mode === 'singles') {
        K = 1 + groupKeys.length;
        gl = new Array(K); gs = new Array(K);
        gl[0] = ones; gs[0] = ones;
        for (let k = 0; k < groupKeys.length; k++) { gl[k + 1] = gates.L[groupKeys[k]]; gs[k + 1] = gates.S[groupKeys[k]]; }
      } else {
        K = 1 + lst.length;
        gl = new Array(K); gs = new Array(K);
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
      }

      const trackers = reuseTrackers || (() => { const t = new Array(K); for (let k = 0; k < K; k++) t[k] = new StateTracker(ctx.S.t[0]); return t; })();
      if (reuseTrackers) for (let k = 0; k < K; k++) reuseTrackers[k].reset();
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
        mergeSymbolInto(accs[spec.id][tf][k], trackers[k], symbolOffset + si, bh);
      }
    }
    parentPort.postMessage({ type: 'progress', symbol: `${symbol} ${tf}`, ms: Date.now() - t0 });
  }
  clearMemCache();
}

// büyük payload'ı sıfır-kopya gönder (transfer list) — bellek ve hız
const transfer = [];
for (const spec of STRATEGIES) {
  const tfsObj = accs[spec.id];
  for (const tf of tfs) {
    for (const acc of tfsObj[tf] || []) {
      transfer.push(acc.pool.buffer, acc.hist.buffer, acc.years.buffer, acc.tr.buffer, acc.te.buffer, acc.eqSums.buffer, acc.eqCnts.buffer, acc.syms.buffer);
    }
  }
}
parentPort.postMessage({ type: 'result', accs, errors, ms: Date.now() - t0 }, transfer);
