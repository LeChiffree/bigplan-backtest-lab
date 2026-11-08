import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'D:/1mDataBinance/yeni_coinler';
for (const tf of ['5m', '15m', '1h', '4h', '1d', 'funding']) {
  let syms = [];
  try { syms = await readdir(join(ROOT, tf), { withFileTypes: true }); } catch { console.log(tf, 'yok'); continue; }
  let files = 0;
  for (const e of syms) {
    if (e.isDirectory()) { try { files += (await readdir(join(ROOT, tf, e.name))).length; } catch {} }
    else files++;
  }
  console.log(tf, '| girdi:', syms.length, '| dosya:', files);
}
