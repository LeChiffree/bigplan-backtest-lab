// Smoke 3: filtre kapıları sağlaması — tüm 66 kapı, birkaç sembol/tf
import { listSymbols, TFS } from './core.mjs';
import { makeCtx } from './dataload.mjs';
import { loadMarketBase, marketView } from './market.mjs';
import { buildGates, FILTERS, FILTER_CATS } from './filters.mjs';

const base = await loadMarketBase();
const symbols = (await listSymbols()).sort();
const testSet = [
  ['BTCUSDT', '5m'], ['ETHUSDT', '15m'], ['SOLUSDT', '1h'], ['BTCUSDT', '4h'], ['BNBUSDT', '1d'], ['BTCUSDT', '1w'],
];

let fail = 0;
const fills = new Map(); // key → {sum, cnt}

for (const [sym, tf] of testSet) {
  let ctx;
  try { ctx = await makeCtx(tf, sym); } catch (e) { console.log(`ATLA ${sym} ${tf}: ${e.message}`); continue; }
  const n = ctx.S.t.length;
  const M = marketView(base, ctx.S, tf);
  // piyasa serileri doluluk
  const mf = Object.entries(M).map(([k, a]) => `${k}:${a ? (100 * a.reduce((s, x) => s + (Number.isNaN(x) ? 0 : 1), 0) / n).toFixed(0) : 'yok'}%`).join(' ');
  console.log(`\n${sym} ${tf} (n=${n}) piyasa doluluk: ${mf}`);

  let gates;
  const t0 = performance.now();
  try {
    gates = buildGates(ctx, M, null);
  } catch (e) {
    console.log(`  HATA buildGates: ${e.message}`);
    fail++;
    continue;
  }
  const ms = performance.now() - t0;
  let zeroL = [], zeroS = [];
  for (const f of FILTERS) {
    const g = gates.L[f.k], gs = gates.S[f.k];
    let cl = 0, cs = 0;
    for (let i = 0; i < n; i++) { cl += g[i]; cs += gs[i]; }
    const a = fills.get(f.k) || { L: 0, S: 0, cnt: 0 };
    a.L += cl / n; a.S += cs / n; a.cnt++;
    fills.set(f.k, a);
    if (cl + cs === 0) (cl > cs ? zeroS : zeroL).push(f.k);
  }
  console.log(`  ${FILTERS.length} kapı üretildi (${ms.toFixed(0)}ms)` + (zeroL.length || zeroS.length ? ` | BOŞ: L=${zeroL.join(',')} S=${zeroS.join(',')}` : ''));
  if (zeroL.length || zeroS.length) fail++;
}

console.log('\n--- ortalama doluluk (tüm test hücreleri) ---');
const rows = [...fills.entries()].map(([k, a]) => [k, a.L / a.cnt, a.S / a.cnt, FILTERS.find((f) => f.k === k).cat])
  .sort((a, b) => (a[1] + a[2]) - (b[1] + b[2]));
for (const [k, L, S, cat] of rows) {
  console.log(`  ${k.padEnd(16)} L%${(L * 100).toFixed(1).padStart(5)} S%${(S * 100).toFixed(1).padStart(5)}  ${FILTER_CATS[cat]}`);
}
console.log(fail === 0 ? '\nSMOKE3 OK' : `\nSMOKE3: ${fail} sorun`);
