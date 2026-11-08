// extract93.mjs — 93 "5/6" durum için işlem bazlı veri çıkarımı (parent)
// Çıktı: out/backtest93_raw.json
import { readFile, writeFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { join } from 'node:path';

const BP = 'D:/BigPlan';
const NW = Math.max(2, Math.min(7, cpus().length - 1));

const H = JSON.parse(await readFile(join(BP, 'out', 'homojenlik.json'), 'utf8'));
const near = H.rows.filter((r) => r.net > 0 && r.eksik.length === 1 && String(r.eksik[0]).includes('top5'));
const states = near.map((r) => ({ key: r.id + '|' + r.tf + '|' + r.kind, id: r.id, tf: r.tf, kind: r.kind, keys: r.keys || [] }));

const U = JSON.parse(await readFile(join(BP, 'out', 'universe.json'), 'utf8'));
const symbols = U.symbols;
const symIndex = Object.fromEntries(symbols.map((s, i) => [s, i]));

console.log(`[extract93] durum: ${states.length}, sembol: ${symbols.length}, worker: ${NW}`);

function newYear() {
  return { n: 0, w: 0, sumR: 0, sumLog: 0, durSum: 0, coin: new Map(), dow: new Float64Array(35), month: new Float64Array(60), season: new Float64Array(20), hour: new Float64Array(40), dur: new Float64Array(40), ret: new Float64Array(12) };
}
function newAgg() {
  return { n: 0, w: 0, sumR: 0, sumLog: 0, durSum: 0, coins: new Map(), years: Array.from({ length: 5 }, newYear), samples: [] };
}
function addMap(dst, key, src) {
  let a = dst.get(key);
  if (!a) { a = [0, 0, 0, 0, 0]; dst.set(key, a); }
  for (let i = 0; i < 5; i++) a[i] += src[i];
}
function addArr(dst, src) { for (let i = 0; i < dst.length; i++) dst[i] += src[i]; }

const merged = new Map(states.map((s) => [s.key, newAgg()]));

function mergeInto(dst, src) {
  dst.n += src.n; dst.w += src.w; dst.sumR += src.sumR; dst.sumLog += src.sumLog; dst.durSum += src.durSum;
  for (const [k, v] of src.coins) addMap(dst.coins, k, v);
  for (let y = 0; y < 5; y++) {
    const a = dst.years[y], b = src.years[y];
    a.n += b.n; a.w += b.w; a.sumR += b.sumR; a.sumLog += b.sumLog; a.durSum += b.durSum;
    addArr(a.dow, b.dow); addArr(a.month, b.month); addArr(a.season, b.season);
    addArr(a.hour, b.hour); addArr(a.dur, b.dur); addArr(a.ret, b.ret);
    for (const [k, v] of b.coin) addMap(a.coin, k, v);
  }
  for (const s of src.samples) { if (dst.samples.length < 400) dst.samples.push(s); }
}

function runWorker(chunk, wi) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./extract93_worker.mjs', import.meta.url), { workerData: { symbols: chunk, states, symIndex } });
    let last = Date.now();
    w.on('message', (m) => {
      if (m.type === 'progress') {
        const now = Date.now();
        if (now - last > 15000) { last = now; console.log(`  [w${wi}] ${m.done}/${m.total} sembol · ${(m.ms / 1000).toFixed(0)}s`); }
      } else if (m.type === 'result') {
        console.log(`  [w${wi}] bitti · ${(m.ms / 1000).toFixed(0)}s · hata: ${m.errors.length}`);
        resolve(m);
      }
    });
    w.on('error', reject);
    w.on('exit', (c) => { if (c !== 0) reject(new Error('worker exit ' + c)); });
  });
}

const t0 = Date.now();
const chunks = Array.from({ length: NW }, (_, i) => symbols.filter((_, j) => j % NW === i));
const results = await Promise.all(chunks.map((c, i) => runWorker(c, i)));

let errs = [];
for (const r of results) {
  errs = errs.concat(r.errors || []);
  for (const [k, a] of Object.entries(r.aggs)) mergeInto(merged.get(k), a);
}
console.log(`[extract93] birleştirme bitti · ${((Date.now() - t0) / 60000).toFixed(1)} dk · hata: ${errs.length}`);
if (errs.length) console.log('  ilk hatalar:', errs.slice(0, 5));

const out = {
  gen: new Date().toISOString(),
  symbols,
  states: near.map((r) => ({
    key: r.id + '|' + r.tf + '|' + r.kind,
    id: r.id, tf: r.tf, kind: r.kind, keys: r.keys || [], ad: r.ad,
    n: r.n, net: r.net, pozAy: r.pozAy, top1Ay: r.top1Ay, top5Gun: r.top5Gun, r2: r.r2,
    pozGun: r.pozGun, dd: r.dd, y23: r.y23, y24: r.y24, y25: r.y25, teN: r.teN, baseAvg: r.baseAvg, kurt: r.kurt,
  })),
  aggs: {},
  errors: errs.slice(0, 50),
};
for (const [k, A] of merged) {
  out.aggs[k] = {
    n: A.n, w: A.w, sumR: A.sumR, sumLog: A.sumLog, durSum: A.durSum,
    coins: [...A.coins.entries()],
    years: A.years.map((Y) => ({
      n: Y.n, w: Y.w, sumR: Y.sumR, sumLog: Y.sumLog, durSum: Y.durSum,
      coin: [...Y.coin.entries()],
      dow: Array.from(Y.dow), month: Array.from(Y.month), season: Array.from(Y.season),
      hour: Array.from(Y.hour), dur: Array.from(Y.dur), ret: Array.from(Y.ret),
    })),
    samples: A.samples,
  };
}
await writeFile(join(BP, 'out', 'backtest93_raw.json'), JSON.stringify(out));
console.log('[extract93] yazıldı: out/backtest93_raw.json');
