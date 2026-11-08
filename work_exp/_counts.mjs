// _counts.mjs — tek geçiş: toplam denenen varyant/kombinasyon, pozitif/negatif, hücre bazı
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BP = 'D:/BigPlan';
const files = async (dir) => (await readdir(join(BP, dir))).filter((f) => f.endsWith('.json'));

const S = { files: 0, cells: 0, variants: 0, avgPos: 0, avgNeg: 0, avgZero: 0, totPos: 0, totNeg: 0 };
let cellN = 0, cellBasePos = 0, cellBaseNeg = 0, cellBestPos = 0, cellBestNeg = 0;

for (const f of await files('out/singles')) {
  const d = JSON.parse(await readFile(join(BP, 'out/singles', f), 'utf8'));
  S.files++;
  for (const tf of Object.keys(d.tf || {})) {
    const c = d.tf[tf];
    if (!c.base || !c.base.sum) continue;
    cellN++;
    if (c.base.sum.avg > 0) cellBasePos++; else cellBaseNeg++;
    const vals = c.v ? Object.values(c.v) : [];
    let bestAvg = c.base.sum.avg;
    if (vals.length) {
      S.cells++;
      for (const v of vals) {
        if (!v || !v.sum) continue;
        S.variants++;
        const a = v.sum.avg, t = v.sum.tot;
        if (a > 0) S.avgPos++; else if (a < 0) S.avgNeg++; else S.avgZero++;
        if (t > 0) S.totPos++; else if (t < 0) S.totNeg++;
        if (a > bestAvg) bestAvg = a;
      }
    }
    if (bestAvg > 0) cellBestPos++; else cellBestNeg++;
  }
}

const C = { files: 0, cells: 0, combos: 0, avgPos: 0, avgNeg: 0, totPos: 0, totNeg: 0, len2: 0, len3: 0, len4: 0, other: 0 };
for (const f of await files('out/combos')) {
  const d = JSON.parse(await readFile(join(BP, 'out/combos', f), 'utf8'));
  C.files++;
  for (const tf of Object.keys(d.tf || {})) {
    const c = d.tf[tf];
    const arr = c.combos || [];
    if (!arr.length) continue;
    C.cells++;
    for (const v of arr) {
      if (!v || !v.sum) continue;
      C.combos++;
      const a = v.sum.avg, t = v.sum.tot;
      if (a > 0) C.avgPos++; else if (a < 0) C.avgNeg++;
      if (t > 0) C.totPos++; else if (t < 0) C.totNeg++;
      const k = (v.keys || []).length;
      if (k === 2) C.len2++; else if (k === 3) C.len3++; else if (k === 4) C.len4++; else C.other++;
    }
  }
}

console.log('SINGLES:', JSON.stringify({ ...S, perCell: (S.variants / S.cells).toFixed(1) }));
console.log('COMBOS :', JSON.stringify({ ...C, perCell: (C.combos / C.cells).toFixed(1) }));
console.log('TOPLAM denenen:', S.variants + C.combos, '| avg>0:', S.avgPos + C.avgPos, '| avg<0:', S.avgNeg + C.avgNeg, '| avg=0:', S.avgZero);
console.log('TOPLAM tot>0:', S.totPos + C.totPos, '| tot<0:', S.totNeg + C.totNeg);
console.log('HÜCRE  :', JSON.stringify({ cellN, cellBasePos, cellBaseNeg, cellBestPos, cellBestNeg, bestPosRate: (cellBestPos / cellN * 100).toFixed(1) + '%' }));
