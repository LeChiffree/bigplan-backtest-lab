// bin_audit.mjs — cache/series bin'lerinin hızlı bütünlük taraması
// Sadece başlık (magic, n) ve son bar zamanı okunur.
import { readdir, open } from 'node:fs/promises';
import { join } from 'node:path';

const CACHE = 'D:/BigPlan/cache/series';
const MAGIC = 0x42f10001;
const MIN_BARS = { '5m': 1000, '15m': 300, '1h': 100, '4h': 30, '1d': 60, '1w': 20 };
const rows = [];
for (const tf of ['5m', '15m', '1h', '4h', '1d', '1w']) {
  let files = [];
  try { files = (await readdir(join(CACHE, tf))).filter((f) => f.endsWith('.bin')); } catch { continue; }
  let ok = 0, bad = 0, small = 0;
  for (const f of files) {
    const p = join(CACHE, tf, f);
    const fh = await open(p, 'r');
    try {
      const hdr = Buffer.alloc(8);
      await fh.read(hdr, 0, 8, 0);
      const magic = hdr.readUInt32LE(0), n = hdr.readUInt32LE(4);
      if (magic !== MAGIC || !n) { bad++; rows.push({ tf, sym: f.replace(/\.bin$/, ''), issue: 'magic/n', magic, n }); continue; }
      const min = MIN_BARS[tf] ?? 60;
      if (n < min) { small++; rows.push({ tf, sym: f.replace(/\.bin$/, ''), issue: 'az bar', n }); }
      ok++;
    } finally { await fh.close(); }
  }
  console.log(`${tf}: ${files.length} bin | normal ${ok} | az bar ${small} | bozuk ${bad}`);
}
if (rows.length) {
  console.log('--- ayrıntı (ilk 40):');
  for (const r of rows.slice(0, 40)) console.log(`  ${r.tf} ${r.sym}: ${r.issue} (n=${r.n ?? '-'})`);
}
console.log('toplam sorun:', rows.length);
