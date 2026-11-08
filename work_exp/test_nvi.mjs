// test_nvi.mjs — tek durum (nvi 4h temel) tüm sembollerde işlem sayısı doğrulaması
import { readFile } from 'node:fs/promises';
import { BT_STRATEGIES } from '../tools/core.mjs';
import { makeCtx, clearMemCache } from '../tools/dataload.mjs';
import { simulateMulti } from '../tools/sim2.mjs';

const U = JSON.parse(await readFile('D:/BigPlan/out/universe.json', 'utf8'));
const spec = BT_STRATEGIES.find((s) => s.id === 'nvi');
let total = 0, syms = 0, errs = 0;
const t0 = Date.now();
for (const sym of U.symbols) {
  let ctx;
  try { ctx = await makeCtx('4h', sym); } catch { errs++; continue; }
  const n = ctx.S.t.length;
  const ones = new Uint8Array(n).fill(1);
  const tr = { n: 0, onTrade() { this.n++; } };
  try { simulateMulti(spec, ctx, [ones], [ones], [tr]); } catch { errs++; clearMemCache(); continue; }
  total += tr.n; syms++;
  clearMemCache();
}
console.log('sembol:', syms, 'hata:', errs, 'islem:', total, 'sure:', ((Date.now() - t0) / 1000).toFixed(1) + 's');
