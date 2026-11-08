// coin_volume.mjs — 520 sembolün son 5 yıl (mevcut veri: 2022-08-01 → 2026-09-08)
// ortalama yıllık USDT hacmini 1d kline quote_volume'den hesaplar.
// Çıktı: out/coin_volume.json  { gen, window, bySym, order }
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BP = 'D:/BigPlan';
const OLD = 'D:/1mDataBinance/1d';
const NEW = 'D:/1mDataBinance/yeni_coinler/1d';
const T0 = Date.UTC(2022, 7, 1);       // 2022-08-01
const T1 = Date.UTC(2026, 8, 9);       // 2026-09-09 (hariç)
const WINDOW_DAYS = (T1 - T0) / 86400000;
const WINDOW_YEARS = WINDOW_DAYS / 365.25;

const U = JSON.parse(await readFile(join(BP, 'out', 'universe.json'), 'utf8'));
const symbols = U.symbols;

async function exists(p) { try { await readdir(p); return true; } catch { return false; } }

const bySym = {};
const errors = [];

for (let si = 0; si < symbols.length; si++) {
  const sym = symbols[si];
  let dir = null;
  if (await exists(join(NEW, sym))) dir = join(NEW, sym);
  else if (await exists(join(OLD, sym))) dir = join(OLD, sym);
  if (!dir) { errors.push({ sym, msg: 'klasör yok' }); continue; }

  let files;
  try { files = (await readdir(dir)).filter((f) => f.endsWith('.csv')); }
  catch (e) { errors.push({ sym, msg: 'readdir: ' + e.message }); continue; }
  files.sort();

  let total = 0, days = 0, rows = 0;
  const years = {}; // yıl → USDT
  let firstT = null, lastT = null;

  for (const f of files) {
    let text;
    try { text = await readFile(join(dir, f), 'utf8'); }
    catch (e) { errors.push({ sym, file: f, msg: e.message }); continue; }
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) continue;
    const head = lines[0].split(',');
    let qi = head.indexOf('quote_volume');
    if (qi < 0) qi = head.indexOf('quote_asset_volume');
    if (qi < 0) { errors.push({ sym, file: f, msg: 'quote kolonu yok' }); continue; }
    for (let i = 1; i < lines.length; i++) {
      const ln = lines[i];
      if (!ln) continue;
      const p = ln.split(',');
      if (p.length <= qi) continue;
      const t = +p[0];
      if (!(t >= T0 && t < T1)) continue;
      const qv = +p[qi];
      if (!isFinite(qv) || qv <= 0) continue;
      total += qv; days++; rows++;
      const y = new Date(t).getUTCFullYear();
      years[y] = (years[y] || 0) + qv;
      if (firstT == null || t < firstT) firstT = t;
      if (lastT == null || t > lastT) lastT = t;
    }
  }

  if (!days) { errors.push({ sym, msg: 'pencere içinde veri yok' }); continue; }

  // yıllık ortalama: mevcut gün sayısına göre yıllıklandırma (yeni coinler cezalı değil)
  const volAnnual = total / (days / 365.25);
  // katı 5 yıl ortalaması (mevcut tüm pencereye bölme) — referans
  const volAnnual5 = total / WINDOW_YEARS;
  bySym[sym] = {
    total: Math.round(total),
    days,
    years: Object.fromEntries(Object.entries(years).map(([k, v]) => [k, Math.round(v)])),
    volAnnual: Math.round(volAnnual),
    volAnnual5: Math.round(volAnnual5),
    first: firstT, last: lastT,
  };
  if (si % 50 === 0 || si === symbols.length - 1) {
    console.log(`[vol] ${si + 1}/${symbols.length} · ${sym}`);
  }
}

const order = Object.keys(bySym).sort((a, b) => bySym[b].volAnnual - bySym[a].volAnnual);
order.forEach((s, i) => { bySym[s].rank = i + 1; });

const out = {
  gen: new Date().toISOString(),
  window: { from: T0, to: T1 - 1, days: WINDOW_DAYS },
  metric: 'volAnnual = pencere içi toplam quote_volume / (veri günü/365.25)',
  count: order.length,
  order,
  bySym,
  errors,
};
await writeFile(join(BP, 'out', 'coin_volume.json'), JSON.stringify(out));
console.log(`\n[vol] yazıldı: out/coin_volume.json · ${order.length} sembol · hata ${errors.length}`);

const fmt = (v) => v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : String(v);
console.log('\nSıra  Sembol        Yıllık ort. USDT   Gün');
order.slice(0, 20).forEach((s, i) => console.log(String(i + 1).padStart(4), s.padEnd(14), fmt(bySym[s].volAnnual).padStart(14), String(bySym[s].days).padStart(6)));

console.log('\nTop-N eşikleri (yıllık ort. USDT):');
for (const n of [50, 100, 150, 200, 250, 300, 350, 400, 450, 500]) {
  const v = bySym[order[n - 1]];
  console.log(`  top ${String(n).padStart(3)}: min ${fmt(v.volAnnual).padStart(8)}  (${order[n - 1]})`);
}

const vals = order.map((s) => bySym[s].volAnnual).sort((a, b) => a - b);
const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * (vals.length - 1)))];
console.log('\nDağılım (yıllık ort. USDT):');
for (const [k, p] of [['min', 0], ['p10', 0.1], ['p25', 0.25], ['medyan', 0.5], ['p75', 0.75], ['p90', 0.9], ['maks', 1]]) {
  console.log(`  ${k.padEnd(7)} ${fmt(q(p))}`);
}
