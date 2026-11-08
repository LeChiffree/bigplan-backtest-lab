// Binary veri önbelleği oluşturucu (ana süreç)
// Kullanım: node tools/cache.mjs [--workers=10] [--tfs=5m,15m,1h,4h,1d,1w]
import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BP, TFS } from './core.mjs';
import { listSymbolsAll } from './dataload.mjs';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args[m[1]] = m[2] ?? true;
}

const symbols = await listSymbolsAll();
const tfs = args.tfs ? String(args.tfs).split(',') : TFS;
const workers = Math.min(Number(args.workers || 10), symbols.length);

// hangi (tf,symbol) eksik?
const todo = [];
for (const s of symbols) for (const tf of tfs) {
  if (args.force || !existsSync(join(BP, 'cache', 'series', tf, s + '.bin'))) todo.push([tf, s]);
}
if (!todo.length) { console.log('[cache] tüm dosyalar hazır'); process.exit(0); }
console.log(`[cache] ${todo.length} dosya üretilecek (${symbols.length} sembol × ${tfs.length} tf)`);

const chunks = Array.from({ length: workers }, () => []);
symbols.forEach((s, i) => chunks[i % workers].push(s));

const t0 = Date.now();
await new Promise((res, rej) => {
  let living = chunks.filter((c) => c.length).length;
  for (const chunk of chunks) {
    if (!chunk.length) continue;
    const w = new Worker(new URL('./cache-worker.mjs', import.meta.url), {
      workerData: { symbols: chunk, tfs, force: !!args.force },
    });
    let cnt = 0;
    w.on('message', (m) => {
      if (m.type === 'progress') { cnt++; }
      else if (m.type === 'err') console.log('[cache] hata:', m.msg);
    });
    w.on('error', rej);
    w.on('exit', () => {
      console.log(`[cache] işçi bitti (${cnt} sembol)`);
      if (--living === 0) res();
    });
  }
});
console.log(`[cache] hazır: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
