import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function probe(dir, name) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  const d = JSON.parse(await readFile(join(dir, files[0]), 'utf8'));
  const tf = Object.keys(d.tf || {})[0];
  const c = d.tf[tf];
  console.log(name, '| dosya:', files[0], '| tf hücre anahtarları:', Object.keys(c));
  const arrKey = Object.keys(c).find((k) => Array.isArray(c[k]));
  console.log('  dizi anahtarı:', arrKey, '| uzunluk:', arrKey ? c[arrKey].length : 0);
  if (arrKey && c[arrKey].length) {
    console.log('  eleman anahtarları:', Object.keys(c[arrKey][0]));
    console.log('  eleman:', JSON.stringify(c[arrKey][0]).slice(0, 500));
  }
  console.log('  base:', JSON.stringify(c.base).slice(0, 200));
}
await probe('D:/BigPlan/out/singles', 'SINGLES');
await probe('D:/BigPlan/out/combos', 'COMBOS');
