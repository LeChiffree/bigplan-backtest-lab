#!/usr/bin/env node
// Singular-Backtest dogrulama.
//
// 1. Normal (kilitsiz) metrikler pro_bundle.json ile birebir ayni mi?
// 2. Her durumda singular islem = normal islem - bloke mi?
// 3. Tek durumlu (tek TF) kapsamlarda bloke sifir mi?
// 4. Durum / config / hucre / strateji toplamlari birbirini tutuyor mu?
// 5. --scope=state kosusunda singular = normal mi?
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v == null ? true : v];
  }),
);
const RESULTS = args.results || join(HERE, 'results', 'singular_results.json');
const PRO = args.pro || join(ROOT, 'out', 'pro_bundle.json');

const R = JSON.parse(await readFile(RESULTS, 'utf8'));
const P = JSON.parse(await readFile(PRO, 'utf8'));

let fail = 0;
const problems = [];
function check(ok, msg) {
  if (!ok) { fail++; problems.push(msg); }
}

const proByKey = new Map(P.states.map((s) => [s.key, s]));
check(R.states.length === P.states.length, `durum sayisi: ${R.states.length} != ${P.states.length}`);

let maxNDiff = 0;
let maxSumDiff = 0;
let maxAvgDiff = 0;
let max26Diff = 0;
let maxTradesDiff = 0;
let missing = 0;

for (const st of R.states) {
  const pro = proByKey.get(st.key);
  if (!pro) { missing++; continue; }
  const dn = st.n_trades - pro.agg.n;
  if (Math.abs(dn) > 0) maxNDiff = Math.max(maxNDiff, Math.abs(dn));
  const ds = st.n_sumR - pro.agg.sumR;
  if (Math.abs(ds) > 0) maxSumDiff = Math.max(maxSumDiff, Math.abs(ds));
  const da = st.n_retAll - pro.totAvg * 100;
  if (Math.abs(da) > 0) maxAvgDiff = Math.max(maxAvgDiff, Math.abs(da));
  const d26 = st.n_ret2026 - pro.y26Avg * 100;
  if (Math.abs(d26) > 0) max26Diff = Math.max(max26Diff, Math.abs(d26));
  const dt = st.n_trades - st.s_trades - st.blocked;
  if (Math.abs(dt) > 0) maxTradesDiff = Math.max(maxTradesDiff, Math.abs(dt));
}

check(missing === 0, `pro_bundle'da bulunmayan durum: ${missing}`);
check(maxNDiff === 0, `normal islem sayisi farki: ${maxNDiff}`);
check(maxSumDiff < 0.01, `normal sumR farki: ${maxSumDiff}`);
check(maxAvgDiff < 0.001, `normal retAll farki: ${maxAvgDiff}`);
check(max26Diff < 0.01, `normal ret2026 farki: ${max26Diff}`);
check(maxTradesDiff === 0, `singular + bloke != normal: ${maxTradesDiff}`);

for (const st of R.states) {
  if (st.s_trades > st.n_trades) check(false, `singular > normal: ${st.key}`);
  if (st.blocked < 0) check(false, `negatif bloke: ${st.key}`);
}

// Kapsam = durum ise hicbir sey bloke edilmemeli (motor zaten ayni durumda
// ust uste pozisyon acmaz).
if (R.scope === 'state') {
  const blocked = R.states.reduce((a, s) => a + s.blocked, 0);
  check(blocked === 0, `scope=state iken bloke: ${blocked}`);
  const changed = R.states.filter((s) => s.s_trades !== s.n_trades).length;
  check(changed === 0, `scope=state iken degisen durum: ${changed}`);
}

// Tek durumlu config'lerde bloke imkansiz.
if (R.scope === 'config') {
  const single = R.configs.filter((c) => c.states === 1);
  const bad = single.filter((c) => c.blocked !== 0);
  check(bad.length === 0, `tek durumlu config'te bloke: ${bad.map((b) => b.key).slice(0, 5).join(', ')}`);
  check(single.length > 0, 'tek durumlu config bulunamadi');
}

// Toplam tutarliligi
const sumN = R.states.reduce((a, s) => a + s.n_trades, 0);
const sumS = R.states.reduce((a, s) => a + s.s_trades, 0);
const sumB = R.states.reduce((a, s) => a + s.blocked, 0);
check(sumN === R.totals.normal.trades, `durum toplami normal: ${sumN} != ${R.totals.normal.trades}`);
check(sumS === R.totals.singular.trades, `durum toplami singular: ${sumS} != ${R.totals.singular.trades}`);
check(sumB === R.totals.blocked, `durum toplami bloke: ${sumB} != ${R.totals.blocked}`);

const cfgN = R.configs.reduce((a, c) => a + c.n_trades, 0);
const cfgS = R.configs.reduce((a, c) => a + c.s_trades, 0);
const cfgB = R.configs.reduce((a, c) => a + c.blocked, 0);
check(cfgN === R.totals.normal.trades, `config toplami normal: ${cfgN} != ${R.totals.normal.trades}`);
check(cfgS === R.totals.singular.trades, `config toplami singular: ${cfgS} != ${R.totals.singular.trades}`);
check(cfgB === R.totals.blocked, `config toplami bloke: ${cfgB} != ${R.totals.blocked}`);

const cellN = R.cells.reduce((a, c) => a + c.n_trades, 0);
const cellS = R.cells.reduce((a, c) => a + c.s_trades, 0);
check(cellN === R.totals.normal.trades, `hucre toplami normal: ${cellN} != ${R.totals.normal.trades}`);
check(cellS === R.totals.singular.trades, `hucre toplami singular: ${cellS} != ${R.totals.singular.trades}`);

const idN = R.strategies.reduce((a, c) => a + c.n_trades, 0);
const idS = R.strategies.reduce((a, c) => a + c.s_trades, 0);
check(idN === R.totals.normal.trades, `strateji toplami normal: ${idN} != ${R.totals.normal.trades}`);
check(idS === R.totals.singular.trades, `strateji toplami singular: ${idS} != ${R.totals.singular.trades}`);

check((R.errors || []).length === 0, `motor hatasi: ${(R.errors || []).length}`);

// Kasa tutarliligi: kasaAll = 10 * sumR
const kasaDiff = Math.abs(R.totals.normal.kasaAll - 10 * R.totals.normal.sumR);
check(kasaDiff < 0.01, `normal kasa != 10*sumR: ${kasaDiff}`);

console.log(`kapsam            : ${R.scope} (${R.scope_label})`);
console.log(`durum             : ${R.states.length}`);
console.log(`normal islem      : ${R.totals.normal.trades.toLocaleString('en-US')}`);
console.log(`singular islem    : ${R.totals.singular.trades.toLocaleString('en-US')}`);
console.log(`bloke             : ${R.totals.blocked.toLocaleString('en-US')} (${R.totals.blocked_pct.toFixed(2)}%)`);
console.log(`normal/pro fark   : n=${maxNDiff} sumR=${maxSumDiff.toExponential(2)} retAll=${maxAvgDiff.toExponential(2)} ret2026=${max26Diff.toExponential(2)}`);
console.log(`kasa farki        : ${kasaDiff.toFixed(6)} USD`);
console.log('');
if (fail) {
  console.log(`HATA: ${fail} kontrol basarisiz`);
  for (const p of problems.slice(0, 20)) console.log(' - ' + p);
  process.exit(1);
}
console.log('OK - tum kontroller gecti');
