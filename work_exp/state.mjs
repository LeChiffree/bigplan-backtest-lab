import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'D:/1mDataBinance/yeni_coinler';
const out = {};
let totalFiles = 0, totalBytes = 0;
for (const tf of ['5m', '15m', '1h', '4h', '1d', 'funding']) {
  let syms = [];
  try { syms = await readdir(join(ROOT, tf), { withFileTypes: true }); } catch { out[tf] = 'yok'; continue; }
  let files = 0, bytes = 0;
  for (const e of syms) {
    if (e.isDirectory()) {
      const fs = await readdir(join(ROOT, tf, e.name));
      files += fs.length;
      for (const f of fs) { try { bytes += (await stat(join(ROOT, tf, e.name, f))).size; } catch {} }
    } else { files++; try { bytes += (await stat(join(ROOT, tf, e.name))).size; } catch {} }
  }
  out[tf] = { entries: syms.length, files, mb: +(bytes / 1048576).toFixed(1) };
  totalFiles += files; totalBytes += bytes;
}
console.log(JSON.stringify(out, null, 1));
console.log('TOPLAM dosya:', totalFiles, '| GB:', (totalBytes / 1073741824).toFixed(2));
