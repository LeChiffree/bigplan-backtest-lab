// btc_check.mjs — BTCUSDT günlük getiri serisi ve yoğunlaşma bazı
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'D:/1mDataBinance/1d/BTCUSDT';
const T0 = Date.UTC(2022, 7, 1);
const files = (await readdir(DIR)).filter((f) => f.endsWith('.csv')).sort();
const map = new Map();
for (const f of files) {
  const txt = await readFile(join(DIR, f), 'utf8');
  const lines = txt.split(/\r?\n/);
  if (lines.length < 2) continue;
  const head = lines[0].split(',');
  const ci = head.indexOf('close');
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const p = lines[i].split(',');
    const t = +p[0];
    if (t >= T0) map.set(t, +p[ci]);
  }
}
const ts = [...map.keys()].sort((a, b) => a - b);
const closes = ts.map((t) => map.get(t));
const rs = [];
for (let i = 1; i < closes.length; i++) rs.push(closes[i] / closes[i - 1] - 1);
const n = rs.length;
const sum = rs.reduce((a, b) => a + b, 0);
const sorted = [...rs].sort((a, b) => b - a);
const k5 = Math.max(1, Math.ceil(n * 0.05));
const k1 = Math.max(1, Math.ceil(n * 0.01));
const top5 = sorted.slice(0, k5).reduce((a, b) => a + b, 0);
const top1 = sorted.slice(0, k1).reduce((a, b) => a + b, 0);
console.log('BTC gün:', n, 'ilk:', new Date(ts[0]).toISOString().slice(0, 10), 'son:', new Date(ts[n - 1]).toISOString().slice(0, 10));
console.log('BTC toplam getiri (additif):', (sum * 100).toFixed(1) + '%', '| bileşik:', ((closes[n] / closes[0] - 1) * 100).toFixed(1) + '%');
console.log('BTC top5 gün payı:', (top5 / sum * 100).toFixed(1) + '%', '| top1 gün payı:', (top1 / sum * 100).toFixed(1) + '%');
console.log('BTC en iyi 10 gün toplamı:', (sorted.slice(0, 10).reduce((a, b) => a + b, 0) * 100).toFixed(1) + '% | 10 gün çıkarınca additif:', ((sum - sorted.slice(0, 10).reduce((a, b) => a + b, 0)) * 100).toFixed(1) + '%');
// yıllık
const ymap = new Map();
for (let i = 1; i < closes.length; i++) {
  const y = new Date(ts[i]).getUTCFullYear();
  if (!ymap.has(y)) ymap.set(y, []);
  ymap.get(y).push(rs[i - 1]);
}
for (const [y, arr] of [...ymap.entries()].sort((a, b) => a[0] - b[0])) {
  const s = arr.reduce((a, b) => a + b, 0);
  const so = [...arr].sort((a, b) => b - a);
  const k = Math.max(1, Math.ceil(arr.length * 0.05));
  console.log('  ', y, 'gün', arr.length, 'top5 pay', (so.slice(0, k).reduce((a, b) => a + b, 0) / s * 100).toFixed(0) + '%', 'additif', (s * 100).toFixed(0) + '%');
}
