// homojenlik.json üzerinden kriter bazlı geçiş istatistikleri
import { readFile } from 'node:fs/promises';
const J = JSON.parse(await readFile('D:/BigPlan/out/homojenlik.json', 'utf8'));
const rows = J.rows;
const pos = rows.filter((r) => r.net > 0);
const neg = rows.filter((r) => r.net <= 0);

const CRIT = [
  ['net>0', (r) => r.net > 0],
  ['pozAy≥%60', (r) => r.pozAy >= 0.60],
  ['top1Ay≤%33', (r) => r.top1Ay != null && r.top1Ay <= 0.33],
  ['top5Gün≤%40', (r) => r.top5Gun != null && r.top5Gun <= 0.40],
  ['R²≥0.80', (r) => (r.r2 ?? 0) >= 0.80],
  ['tamYıllar>0', (r) => r.y23 != null && r.y24 != null && r.y25 != null && Math.min(r.y23, r.y24, r.y25) > 0],
];

console.log(`Durum: ${rows.length} | net pozitif: ${pos.length} | net negatif: ${neg.length}`);
console.log('\n== Pozitiflerde ölçüt bazında geçiş ==');
for (const [n, fn] of CRIT.slice(1)) {
  const p = pos.filter(fn).length;
  console.log(`${n.padEnd(14)} ${String(p).padStart(4)} / ${pos.length}  (%${(100 * p / pos.length).toFixed(0)})`);
}
console.log('\n== Kaç ölçüt eksik (pozitifler) ==');
const byMiss = new Map();
for (const r of pos) { const k = r.eksik.length; byMiss.set(k, (byMiss.get(k) || 0) + 1); }
for (const k of [...byMiss.keys()].sort()) console.log(`${k} eksik: ${byMiss.get(k)}`);

console.log('\n== Tek ölçüt eksik olanların eksikleri ==');
const one = pos.filter((r) => r.eksik.length === 1);
const m1 = new Map();
for (const r of one) m1.set(r.eksik[0], (m1.get(r.eksik[0]) || 0) + 1);
for (const [k, v] of [...m1.entries()].sort((a, b) => b[1] - a[1])) console.log(`${k.padEnd(14)} ${v}`);

console.log('\n== Duyarlılık: top5 eşiği (pozitifler, diğer 4 kriter geçiyor) ==');
const nearT5 = pos.filter((r) => r.eksik.length === 1 && r.eksik[0] === 'top5Gün≤%40');
console.log('yalnız top5 eksiği olan:', nearT5.length);
for (const t of [0.4, 0.5, 0.6, 0.8, 1.0, 1.5, 2.0, 2.5, 3.0]) {
  const p2 = nearT5.filter((r) => r.top5Gun <= t).length;
  console.log(`≤ %${(t * 100).toFixed(0).padStart(4)} : ${p2}`);
}
// tam eşik gevşetme senaryoları
console.log('\n== Senaryolar (tüm durumlar) ==');
const scen = [
  ['Mevcut 6/6', (r) => r.net > 0 && r.pozAy >= 0.6 && r.top1Ay <= 0.33 && r.top5Gun <= 0.4 && (r.r2 ?? 0) >= 0.8 && r.y23 > 0 && r.y24 > 0 && r.y25 > 0],
  ['top5 ≤ %60', (r) => r.net > 0 && r.pozAy >= 0.6 && r.top1Ay <= 0.33 && r.top5Gun <= 0.6 && (r.r2 ?? 0) >= 0.8 && r.y23 > 0 && r.y24 > 0 && r.y25 > 0],
  ['top5 ≤ %100', (r) => r.net > 0 && r.pozAy >= 0.6 && r.top1Ay <= 0.33 && r.top5Gun <= 1.0 && (r.r2 ?? 0) >= 0.8 && r.y23 > 0 && r.y24 > 0 && r.y25 > 0],
  ['R²≥0.60 + top5≤%60', (r) => r.net > 0 && r.pozAy >= 0.6 && r.top1Ay <= 0.33 && r.top5Gun <= 0.6 && (r.r2 ?? 0) >= 0.6 && r.y23 > 0 && r.y24 > 0 && r.y25 > 0],
  ['pozAy≥%50 + top5≤%100', (r) => r.net > 0 && r.pozAy >= 0.5 && r.top1Ay <= 0.33 && r.top5Gun <= 1.0 && (r.r2 ?? 0) >= 0.8 && r.y23 > 0 && r.y24 > 0 && r.y25 > 0],
];
for (const [n, fn] of scen) console.log(`${n.padEnd(26)} ${rows.filter(fn).length}`);

console.log('\n== Pozitiflerde dağılım özetleri ==');
const q = (arr, p) => { const a = arr.filter((v) => v != null).slice().sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))] : null; };
for (const [n, key] of [['top5Gün payı', 'top5Gun'], ['top1Ay payı', 'top1Ay'], ['poz ay', 'pozAy'], ['R²', 'r2']]) {
  const a = pos.map((r) => r[key]).filter((v) => v != null);
  console.log(`${n.padEnd(12)} medyan ${(q(a, 0.5) * 100).toFixed(0)}% | çeyrekler ${(q(a, 0.25) * 100).toFixed(0)}–${(q(a, 0.75) * 100).toFixed(0)}% | min ${(q(a, 0) * 100).toFixed(0)}% | maks ${(q(a, 1) * 100).toFixed(0)}%`);
}
console.log('\n== Ortalama aktif gün sayısı ==');
console.log('pozitiflerde medyan gün:', q(pos.map((r) => 0), 0.5) === null ? '-' : '-');
