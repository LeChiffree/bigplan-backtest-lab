// plan_extra.mjs — genişleme planı: aktif USDT-M perp listesi − mevcut 58,
// ay aralıkları, indirme planı (work_exp/download_plan.json).
import { writeFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const sleep = (ms) => new Promise((t) => setTimeout(t, ms));
const g = async (u) => {
  for (let i = 0; i < 8; i++) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.status === 429) { await sleep(8000); continue; }
      const j = await r.json();
      if (j && j.code) { await sleep(8000); continue; } // -1003 rate limit vb.
      return j;
    } catch { await sleep(4000); }
  }
  throw new Error('fail ' + u);
};

const ROOT = 'D:/BigPlan/work_exp';
await mkdir(ROOT, { recursive: true });

const ex = await g('https://fapi.binance.com/fapi/v1/exchangeInfo');
await writeFile(join(ROOT, 'exchange_info.json'), JSON.stringify(ex));

const oldList = (await readdir('D:/1mDataBinance/5m', { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const oldSet = new Set(oldList);

const perp = ex.symbols.filter((s) => s.contractType === 'PERPETUAL' && s.status === 'TRADING' && s.quoteAsset === 'USDT');
const overl = perp.filter((s) => oldSet.has(s.symbol)).length;
const stables = new Set(['USDC', 'FDUSD', 'TUSD', 'BUSD', 'USDP', 'DAI', 'AEUR', 'EUR', 'USD1', 'XUSD', 'USDE', 'SUSDE', 'BFUSD', 'USDR', 'EURI']);
const cand = perp.filter((s) => !oldSet.has(s.symbol) && !stables.has(s.baseAsset)).map((s) => ({ sym: s.symbol, onboard: s.onboardDate }));

console.log('aktif USDT-M perp:', perp.length, '| eski 58 ile kesişim:', overl, '| yeni aday:', cand.length);
const notActive = [...oldSet].filter((x) => !perp.some((s) => s.symbol === x));
console.log('eskide olup aktif olmayan (' + notActive.length + '):', notActive.join(',') || 'yok');

// ay planı: 2022-08 .. 2026-08
const M = [];
for (let y = 2022; y <= 2026; y++) for (let m = 1; m <= 12; m++) { const k = y * 100 + m; if (k >= 202208 && k <= 202608) M.push(k); }
let tot = 0;
const noData = [];
const plan = [];
for (const c of cand) {
  const on = new Date(c.onboard);
  const start = Math.max(202208, on.getUTCFullYear() * 100 + on.getUTCMonth() + 1);
  const months = M.filter((k) => k >= start);
  if (!months.length) { noData.push(c.sym); continue; }
  plan.push({ sym: c.sym, onboard: c.onboard, months });
  tot += months.length;
}
console.log('planlanan sembol:', plan.length, '| pencere dışı (veri yok):', noData.length, noData.slice(0, 25).join(','));
console.log('toplam sembol-ay:', tot, '| indirilecek zip (5 tf):', tot * 5);
const mLens = plan.map((p) => p.months.length).sort((a, b) => a - b);
console.log('ay sayısı dağılımı: min', mLens[0], 'medyan', mLens[mLens.length >> 1], 'maks', mLens[mLens.length - 1]);
console.log('örnek yeni:', plan.slice(0, 6).map((p) => p.sym + '(' + p.months.length + 'ay)').join(', '));
const tfs = ['5m', '15m', '1h', '4h', '1d'];
await writeFile(join(ROOT, 'download_plan.json'), JSON.stringify({ gen: new Date().toISOString(), tfs, totSymbols: plan.length, totMonths: tot, plan, noData }));
console.log('yazıldı: work_exp/download_plan.json');
