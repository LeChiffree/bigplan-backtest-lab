// _homogen_deep.mjs — "tek eksik: top5 gün" grubunda en az gün-bağımlı adaylar
import { readFile } from 'node:fs/promises';
const J = JSON.parse(await readFile('D:/BigPlan/out/homojenlik.json', 'utf8'));
const pct = (v, d = 0) => (v == null ? '—' : (v * 100).toFixed(d) + '%');
const sg = (v, d = 0) => (v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%');

const R = J.rows;
const pos = R.filter((r) => r.net > 0);
const onlyTop5 = pos.filter((r) => r.eksik.length === 1 && r.eksik[0] === 'top5Gün≤%40');
console.log(`tek eksik top5 grubu: ${onlyTop5.length} durum`);
const sorted = [...onlyTop5].sort((a, b) => a.top5Gun - b.top5Gun);
console.log('en az gün-bağımlı 20:');
for (const r of sorted.slice(0, 20)) {
  console.log(`  ${r.id.padEnd(12)} ${r.tf.padEnd(3)} ${r.kind.padEnd(8)} [${(r.keys.join('+') || 'temel').slice(0, 34).padEnd(34)}] top5gün ${pct(r.top5Gun)} | pozAy ${pct(r.pozAy)} | top1ay ${pct(r.top1Ay)} | R² ${r.r2.toFixed(2)} | DD ${pct(r.dd)} | net ${sg(r.net)} | işlem ${r.n}`);
}
const t5 = sorted.map((r) => r.top5Gun);
console.log(`grup top5gün: min ${pct(t5[0])}, medyan ${pct(t5[t5.length >> 1])}, maks ${pct(t5[t5.length - 1])}`);

// gevşek eşik duyarlılığı: top5 ≤ X eklenirse kaç durum kalır
for (const x of [1.0, 1.5, 2.0, 2.5]) {
  const ok = onlyTop5.filter((r) => r.top5Gun <= x);
  console.log(`top5Gün ≤ ${x * 100}% eklersek: ${ok.length} durum homojen olur`);
}

// en düşük gün payı genel (net>0 içinde hangi hücreler)
const lowAll = [...pos].filter((r) => r.top5Gun != null).sort((a, b) => a.top5Gun - b.top5Gun).slice(0, 10);
console.log('\nTÜM pozitiflerde en düşük 10 gün payı:');
for (const r of lowAll) console.log(`  ${r.id} ${r.tf} ${r.kind} [${r.keys.join('+') || 'temel'}] top5gün ${pct(r.top5Gun)} | pozAy ${pct(r.pozAy)} | R² ${r.r2.toFixed(2)} | net ${sg(r.net)}`);
