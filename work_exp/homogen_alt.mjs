// homogen_alt.mjs — mevcut 6 kriter + alternatif "en iyi N günü çıkar" dayanıklılık testleri
// out/daily/*.json günlük eğrilerinden hesaplar (homogen.mjs ile aynı semantik).
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const D = 'D:/BigPlan/out/daily';
const FULL_YEARS = [2023, 2024, 2025];
const docs = [];
for (const f of await readdir(D)) if (f.endsWith('.json')) docs.push(JSON.parse(await readFile(join(D, f), 'utf8')));

function metrics(curve, grid) {
  const start = grid.start, step = grid.step;
  let i0 = 0; while (i0 < curve.length && curve[i0] == null) i0++;
  let i1 = curve.length - 1; while (i1 >= 0 && curve[i1] == null) i1--;
  if (i0 >= i1) return null;
  const active = curve.slice(i0, i1 + 1);
  const first = active[0];
  const net = active[active.length - 1] / first - 1;
  const rs = [];
  for (let i = 1; i < active.length; i++) {
    const a = active[i - 1], b = active[i];
    rs.push(a != null && b != null && a > 0 ? b / a - 1 : 0);
  }
  const nDays = rs.length;
  const daySum = rs.reduce((s, v) => s + v, 0);
  const sorted = [...rs].sort((a, b) => b - a);
  const k5 = Math.max(1, Math.ceil(nDays * 0.05));
  const top5Share = daySum > 0 ? sorted.slice(0, k5).reduce((s, v) => s + v, 0) / daySum : null;
  const best5 = sorted.slice(0, 5).reduce((s, v) => s + v, 0);
  const best10 = sorted.slice(0, 10).reduce((s, v) => s + v, 0);
  const best20 = sorted.slice(0, 20).reduce((s, v) => s + v, 0);

  const monthEnd = new Map();
  for (let i = 0; i < active.length; i++) {
    const v = active[i];
    if (v == null) continue;
    const ts = start + (i0 + i) * step;
    const d = new Date(ts);
    monthEnd.set(d.getUTCFullYear() * 12 + d.getUTCMonth(), v);
  }
  const mks = [...monthEnd.keys()].sort((a, b) => a - b);
  const months = [];
  let prev = first;
  for (const mk of mks) { const v = monthEnd.get(mk); months.push(v / prev - 1); prev = v; }
  const mSum = months.reduce((s, m) => s + m, 0);
  const bestM = Math.max(...months);
  const posM = months.filter((m) => m > 0).length / months.length;

  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0, cum = 0;
  const N = rs.length;
  for (let t = 0; t < N; t++) { cum += rs[t]; sx += t; sy += cum; sxx += t * t; sxy += t * cum; syy += cum * cum; }
  let r2 = null;
  if (N > 10) { const den = N * sxx - sx * sx; const b = den !== 0 ? (N * sxy - sx * sy) / den : 0; const a = (sy - b * sx) / N; let ss = 0, c2 = 0; for (let t = 0; t < N; t++) { c2 += rs[t]; const e = c2 - (a + b * t); ss += e * e; } const sst = syy - sy * sy / N; r2 = sst > 0 ? 1 - ss / sst : null; }

  const yearEnd = new Map();
  for (let i = 0; i < active.length; i++) { const v = active[i]; if (v == null) continue; yearEnd.set(new Date(start + (i0 + i) * step).getUTCFullYear(), v); }
  const years = {}; let pv = first;
  for (const y of [...yearEnd.keys()].sort((a, b) => a - b)) { years[y] = yearEnd.get(y) / pv - 1; pv = yearEnd.get(y); }

  return { net, posM, bestMShare: mSum > 0 ? bestM / mSum : null, top5Share, k5, nDays, r2, years, best5, best10, best20, daySum };
}

const rows = [];
for (const doc of docs) {
  for (const tf of ['5m', '15m', '1h', '4h', '1d', '1w']) {
    const cell = doc.tf?.[tf]; if (!cell) continue;
    const states = [{ kind: 'temel', keys: [], sum: cell.base.sum, curve: cell.base.curve },
      ...cell.variants.map((v, i) => ({ kind: 'varyant' + (i + 1), keys: v.keys, sum: v.sum, curve: v.curve }))];
    for (const st of states) {
      const m = metrics(st.curve, doc.grid); if (!m) continue;
      const y = FULL_YEARS.map((yy) => m.years[yy]);
      const yearsOk = y.every((v) => v != null) && Math.min(...y) > 0;
      const c1 = m.net > 0, c2 = m.posM >= 0.60, c3 = m.bestMShare != null && m.bestMShare <= 0.33;
      const c4 = m.top5Share != null && m.top5Share <= 0.40, c5 = (m.r2 ?? 0) >= 0.80;
      const rem5 = m.daySum - m.best5 > 0, rem10 = m.daySum - m.best10 > 0, rem20 = m.daySum - m.best20 > 0;
      rows.push({ id: doc.id, tf, kind: st.kind, keys: st.keys, ...m, c1, c2, c3, c4, c5, c6: yearsOk, rem5, rem10, rem20 });
    }
  }
}

const pos = rows.filter((r) => r.net > 0);
const cnt = (fn) => rows.filter(fn).length;
{
  const a = pos.map((r) => r.posM).filter((v) => v != null).sort((x, y) => x - y);
  console.log('DEBUG posM: n=', a.length, 'min', a[0], 'med', a[a.length >> 1], 'max', a[a.length - 1]);
  const b = pos.map((r) => r.bestMShare).filter((v) => v != null).sort((x, y) => x - y);
  console.log('DEBUG bestMShare: n=', b.length, 'min', b[0], 'med', b[b.length >> 1], 'max', b[b.length - 1]);
  const c = pos.map((r) => r.r2).filter((v) => v != null).sort((x, y) => x - y);
  console.log('DEBUG r2: n=', c.length, 'min', c[0], 'med', c[c.length >> 1], 'max', c[c.length - 1]);
  console.log('DEBUG sample:', JSON.stringify(pos.slice(0, 3).map((r) => ({ id: r.id, tf: r.tf, net: r.net, posM: r.posM, bestMShare: r.bestMShare, r2: r.r2, c2: r.c2, c3: r.c3 }))));
}
console.log('durum:', rows.length, '| net pozitif:', pos.length);
console.log('\n== Mevcut kriterler (tüm durumlar) ==');
console.log('C1 net>0                :', cnt((r) => r.c1));
console.log('C2 pozAy>=60            :', cnt((r) => r.c1 && r.c2));
console.log('C3 top1Ay<=33           :', cnt((r) => r.c1 && r.c2 && r.c3));
console.log('C4 top5Gun<=40          :', cnt((r) => r.c1 && r.c2 && r.c3 && r.c4));
console.log('C5 R2>=0.80             :', cnt((r) => r.c1 && r.c2 && r.c3 && r.c4 && r.c5));
console.log('C6 tam yillar >0 (6/6)  :', cnt((r) => r.c1 && r.c2 && r.c3 && r.c4 && r.c5 && r.c6));

console.log('\n== Alternatif A: C4 yerine "en iyi 5 gün çıkarılınca kâr > 0" ==');
console.log('A1 rem5 > 0             :', cnt((r) => r.c1 && r.rem5));
console.log('A1+C2+C3                :', cnt((r) => r.c1 && r.c2 && r.c3 && r.rem5));
console.log('A1+C2+C3+C5             :', cnt((r) => r.c1 && r.c2 && r.c3 && r.rem5 && r.c5));
console.log('A1+C2+C3+C5+C6 (tam)    :', cnt((r) => r.c1 && r.c2 && r.c3 && r.rem5 && r.c5 && r.c6));

console.log('\n== Alternatif B: en iyi 10 gün çıkarılınca kâr > 0 ==');
console.log('rem10 > 0               :', cnt((r) => r.c1 && r.rem10));
console.log('tam (C2,C3,C5,C6 ile)   :', cnt((r) => r.c1 && r.c2 && r.c3 && r.rem10 && r.c5 && r.c6));

console.log('\n== Alternatif C: en iyi 20 gün çıkarılınca kâr > 0 ==');
console.log('rem20 > 0               :', cnt((r) => r.c1 && r.rem20));
console.log('tam (C2,C3,C5,C6 ile)   :', cnt((r) => r.c1 && r.c2 && r.c3 && r.rem20 && r.c5 && r.c6));

console.log('\n== Mevcut 5/6 (yalnız top5 eksik) grubunda alternatifler ==');
const near = pos.filter((r) => (r.c2 && r.c3 && r.c5 && r.c6) && !r.c4);
console.log('grup:', near.length);
console.log('  rem5>0 :', near.filter((r) => r.rem5).length);
console.log('  rem10>0:', near.filter((r) => r.rem10).length);
console.log('  rem20>0:', near.filter((r) => r.rem20).length);

console.log('\n== Tam setleri geçenler (A: rem5) ==');
for (const r of rows.filter((r) => r.c1 && r.c2 && r.c3 && r.rem5 && r.c5 && r.c6).slice(0, 12)) {
  console.log(`  ${r.id} ${r.tf} ${r.kind} [${r.keys.join('+') || 'temel'}] net ${(r.net * 100).toFixed(0)}% | ay+ ${(r.posM * 100).toFixed(0)}% | top5 ${(r.top5Share * 100).toFixed(0)}% | rem5 ${((r.daySum - r.best5) * 100).toFixed(0)}% | R2 ${r.r2?.toFixed(2)}`);
}

const slim = rows.map((r) => ({
  id: r.id, tf: r.tf, kind: r.kind, keys: r.keys,
  rem5: r.rem5 ? 1 : 0, rem10: r.rem10 ? 1 : 0, rem20: r.rem20 ? 1 : 0,
  daySum: r.daySum, best5: r.best5, best10: r.best10, best20: r.best20, top5: r.top5Share,
}));
await writeFile('D:/BigPlan/out/homogen_alt.json', JSON.stringify({ gen: new Date().toISOString(), rows: slim }));
console.log('yazıldı: out/homogen_alt.json (' + slim.length + ' satır)');
