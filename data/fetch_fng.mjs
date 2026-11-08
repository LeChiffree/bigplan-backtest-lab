// Gerçek Kripto Korku & Açgözlülük endeksi geçmişini indir ve DONDUR.
// Kaynak: alternative.me (günlük). Veri 2018'den bugüne.
// Çıktı: data/fng_history.csv (ts,value günlük) + data/fng_raw.json (ham)
import { writeFile } from 'node:fs/promises';

const OUT_CSV = 'D:/BigPlan/data/fng_history.csv';
const OUT_RAW = 'D:/BigPlan/data/fng_raw.json';

const res = await fetch('https://api.alternative.me/fng/?limit=0&format=json', { signal: AbortSignal.timeout(60000) });
if (!res.ok) throw new Error('FNG HTTP ' + res.status);
const j = await res.json();
if (!Array.isArray(j.data) || !j.data.length) throw new Error('FNG veri boş');

const byDay = new Map();
for (const d of j.data) {
  const t = Number(d.timestamp) * 1000;
  if (!Number.isFinite(t)) continue;
  const day = Math.floor(t / 86400000) * 86400000;
  byDay.set(day, Number(d.value));
}
const days = [...byDay.entries()].sort((a, b) => a[0] - b[0]);
const lines = ['ts,value'];
for (const [day, v] of days) lines.push(`${day},${v}`);
await writeFile(OUT_CSV, lines.join('\n') + '\n');
await writeFile(OUT_RAW, JSON.stringify(j.data));

console.log('FNG gun sayisi:', days.length);
console.log('ilk:', new Date(days[0][0]).toISOString().slice(0, 10), 'deger', days[0][1]);
console.log('son:', new Date(days[days.length - 1][0]).toISOString().slice(0, 10), 'deger', days[days.length - 1][1]);
console.log('2022-08 sonrasi gun:', days.filter(([d]) => d >= Date.UTC(2022, 7, 1)).length);
