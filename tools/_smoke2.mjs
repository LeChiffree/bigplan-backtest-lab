// Smoke 2: sim2 + agg2 (benim yolum) vs sim.mjs + agg.mjs (orijinal yol)
// Tek sembolde BİREBİR eşitlik beklenir; çok sembolde havuz toplamı sırası
// farkından 1e-12 mertebesi tolere edilir.
import { simConst, aggm, stratm } from './core.mjs';
import { makeCtx } from './dataload.mjs';
import { simulateMulti } from './sim2.mjs';
import { StateTracker, newCompactAcc, mergeSymbolInto, toIAAcc } from './agg2.mjs';

const { simulate, symbolStats, sampleEquity, newAcc, addSymbolResult, finalizeIndicator, GRID } = { ...simConst, ...aggm };
const STRATEGIES = stratm.BT_STRATEGIES;

let fails = 0, checks = 0, maxDiff = 0, maxDiffPath = '';
const diffs = [];

function cmpNum(a, b, path) {
  checks++;
  if (a === b) return;
  if (a == null || b == null) { if (a !== b) { fails++; diffs.push([path, a, b, 999]); } return; }
  const d = Math.abs(a - b);
  if (d > maxDiff) { maxDiff = d; maxDiffPath = path; }
  if (d > 2e-3) { fails++; diffs.push([path, a, b, d]); }
  else if (d > 2e-4) diffs.push([path, a, b, d]);
}
function cmpDeep(a, b, path) {
  if (a === null || b === null || typeof a === 'number' || typeof b === 'number') { cmpNum(a, b, path); return; }
  if (typeof a === 'string' || typeof a === 'boolean') { checks++; if (a !== b) { fails++; diffs.push([path, a, b, 999]); } return; }
  if (Array.isArray(a)) {
    checks++;
    if (!Array.isArray(b) || a.length !== b.length) { fails++; diffs.push([path, 'len', a.length + '/' + (b && b.length), 999]); return; }
    for (let i = 0; i < a.length; i++) cmpDeep(a[i], b[i], path + '[' + i + ']');
    return;
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b || {});
    checks++;
    if (ka.length !== kb.length) { fails++; diffs.push([path, 'keys', ka.length + '/' + kb.length, 999]); }
    for (const k of ka) cmpDeep(a[k], b[k], path + '.' + k);
    return;
  }
  cmpNum(a, b, path);
}

// Orijinal yol: tek strateji → finalize JSON
async function origCell(spec, ctx, symbol) {
  const { trades, errCount } = simulate(spec, ctx);
  const st = symbolStats(trades, ctx.S);
  const acc = newAcc();
  if (st) addSymbolResult(acc, symbol, trades, st, sampleEquity(trades, ctx.S, GRID));
  const out = finalizeIndicator(spec.id, { title: spec.title }, { [ctx.tf]: acc }, [symbol], [ctx.tf]);
  return { out, trades: trades.length, errCount };
}

// Benim yolum: K=1 (kapı yok)
async function mineCell(spec, ctx, symbol) {
  const n = ctx.S.t.length;
  const ones = new Uint8Array(n).fill(1);
  const tr = new StateTracker(ctx.S.t[0]);
  const r = simulateMulti(spec, ctx, [ones], [ones], [tr]);
  tr.finish();
  const bh = ctx.S.c[n - 1] / ctx.S.c[0] - 1;
  const acc = newCompactAcc(1);
  mergeSymbolInto(acc, tr, 0, bh);
  const out = finalizeIndicator(spec.id, { title: spec.title }, { [ctx.tf]: toIAAcc(acc, [symbol]) }, [symbol], [ctx.tf]);
  return { out, trades: tr.n, errCount: r.errCount };
}

// çok sembollü havuz testi
async function pooledCompare(tf, symbols, strategies, label) {
  const ctxs = [];
  for (const s of symbols) ctxs.push(await makeCtx(tf, s));
  for (const spec of strategies) {
    if (spec.skipTfs && spec.skipTfs.includes(tf)) continue;
    // orijinal
    const accA = newAcc();
    let nA = 0;
    for (let si = 0; si < symbols.length; si++) {
      const ctx = ctxs[si];
      const { trades } = simulate(spec, ctx);
      nA += trades.length;
      const st = symbolStats(trades, ctx.S);
      if (st) addSymbolResult(accA, symbols[si], trades, st, sampleEquity(trades, ctx.S, GRID));
    }
    const outA = finalizeIndicator(spec.id, { title: spec.title }, { [tf]: accA }, symbols, [tf]);
    // benim
    const accB = newCompactAcc(symbols.length);
    let nB = 0;
    for (let si = 0; si < symbols.length; si++) {
      const ctx = ctxs[si];
      const ones = new Uint8Array(ctx.S.t.length).fill(1);
      const tr = new StateTracker(ctx.S.t[0]);
      simulateMulti(spec, ctx, [ones], [ones], [tr]);
      tr.finish();
      nB += tr.n;
      const bh = ctx.S.c[ctx.S.t.length - 1] / ctx.S.c[0] - 1;
      mergeSymbolInto(accB, tr, si, bh);
    }
    const outB = finalizeIndicator(spec.id, { title: spec.title }, { [tf]: toIAAcc(accB, symbols) }, symbols, [tf]);
    checks++;
    if (nA !== nB) { fails++; diffs.push([`${label} ${spec.id} n`, nA, nB, 999]); continue; }
    cmpDeep(outA.sum[tf], outB.sum[tf], `${label} ${spec.id} sum`);
    cmpDeep(outA.heat[tf], outB.heat[tf], `${label} ${spec.id} heat`);
    cmpDeep(outA.years[tf], outB.years[tf], `${label} ${spec.id} years`);
    cmpDeep(outA.hist[tf], outB.hist[tf], `${label} ${spec.id} hist`);
    cmpDeep(outA.eq[tf], outB.eq[tf], `${label} ${spec.id} eq`);
  }
}

// --- Tek sembol (BİREBİR beklenir) — tüm stratejiler, 4h ---
{
  const ctx = await makeCtx('4h', 'BTCUSDT');
  let cells = 0, tot = 0;
  for (const spec of STRATEGIES) {
    if (spec.skipTfs && spec.skipTfs.includes('4h')) continue;
    const a = await origCell(spec, ctx, 'BTCUSDT');
    const b = await mineCell(spec, ctx, 'BTCUSDT');
    cells++; tot += a.trades;
    if (a.trades !== b.trades) { fails++; diffs.push([`BTC 4h ${spec.id} tradeN`, a.trades, b.trades, 999]); }
    cmpDeep(a.out.sum['4h'], b.out.sum['4h'], `BTC 4h ${spec.id} sum`);
    cmpDeep(a.out.heat['4h'], b.out.heat['4h'], `BTC 4h ${spec.id} heat`);
    cmpDeep(a.out.years['4h'], b.out.years['4h'], `BTC 4h ${spec.id} years`);
  }
  console.log(`[smoke2] BTC 4h × ${cells} strateji (toplam ${tot} işlem) karşılaştırıldı`);
}

// --- Tek sembol 5m (ağır + kenar durumlar) ---
{
  const ctx = await makeCtx('5m', 'BTCUSDT');
  const only = ['rsi', 'macd', 'supertrend', 'bb', 'ichimoku', 'psar', 'keltner', 'adx', 'atr', 'percentb', 'stoch', 'ema'];
  for (const spec of STRATEGIES) {
    if (!only.includes(spec.id)) continue;
    const a = await origCell(spec, ctx, 'BTCUSDT');
    const b = await mineCell(spec, ctx, 'BTCUSDT');
    if (a.trades !== b.trades) { fails++; diffs.push([`BTC 5m ${spec.id} tradeN`, a.trades, b.trades, 999]); }
    cmpDeep(a.out.sum['5m'], b.out.sum['5m'], `BTC 5m ${spec.id} sum`);
    cmpDeep(a.out.years['5m'], b.out.years['5m'], `BTC 5m ${spec.id} years`);
  }
  console.log('[smoke2] BTC 5m × 12 strateji karşılaştırıldı');
}

// --- Çok sembollü havuz (3 sembol, 1h, tüm stratejiler) ---
await pooledCompare('1h', ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], STRATEGIES, '3sym 1h');
console.log('[smoke2] 3 sembol × 1h × tüm stratejiler havuz karşılaştırıldı');

// --- Perf: 5m tek hücrede K=34 maliyeti ---
{
  const ctx = await makeCtx('5m', 'BTCUSDT');
  const spec = STRATEGIES.find((s) => s.id === 'rsi');
  const n = ctx.S.t.length;
  const ones = new Uint8Array(n).fill(1);
  let t0 = performance.now();
  simulateMulti(spec, ctx, [ones], [ones], [new StateTracker(ctx.S.t[0])]);
  const tK1 = performance.now() - t0;
  const B = 34;
  const gl = [], gs = [];
  for (let k = 0; k < B; k++) { gl.push(ones); gs.push(ones); }
  const trs = gl.map(() => new StateTracker(ctx.S.t[0]));
  t0 = performance.now();
  simulateMulti(spec, ctx, gl, gs, trs);
  const tK34 = performance.now() - t0;
  console.log(`[smoke2] perf BTC 5m rsi: K=1 → ${tK1.toFixed(0)}ms, K=34 → ${tK34.toFixed(0)}ms (${(tK34 / Math.max(tK1, 0.1)).toFixed(1)}×)`);
}

console.log(diffs.slice(0, 25).map((d) => `  ${d[0]}: ${d[1]} vs ${d[2]} (Δ=${d[3]})`).join('\n'));
console.log(`[smoke2] kontrol: ${checks}, hata: ${fails}, en büyük fark: ${maxDiff.toExponential(3)} @ ${maxDiffPath}`);
console.log(fails === 0 ? 'SMOKE2 OK' : 'SMOKE2 BAŞARISIZ');
process.exit(fails === 0 ? 0 : 1);
