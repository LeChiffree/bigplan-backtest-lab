// extract93_vol.mjs — 93 durum × top-N hacim setleri (parent)
// Çıktı: out/backtest93_vol.json
// Kullanım: node tools/extract93_vol.mjs [--symbols=5] [--states=3] [--out=out/test_vol.json]
import { readFile, writeFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { join } from 'node:path';

const BP = 'D:/BigPlan';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v == null ? true : v];
}));
const SYM_LIMIT = +args.symbols || 0;
const STATE_LIMIT = +args.states || 0;
const OUT = args.out || 'out/backtest93_vol.json';
const NW = Math.max(2, Math.min(7, cpus().length - 1));

const H = JSON.parse(await readFile(join(BP, 'out', 'homojenlik.json'), 'utf8'));
const near = H.rows.filter((r) => r.net > 0 && r.eksik.length === 1 && String(r.eksik[0]).includes('top5'));
const allStates = near.map((r) => ({ key: r.id + '|' + r.tf + '|' + r.kind, id: r.id, tf: r.tf, kind: r.kind, keys: r.keys || [] }));
const states = STATE_LIMIT ? allStates.slice(0, STATE_LIMIT) : allStates;

const U = JSON.parse(await readFile(join(BP, 'out', 'universe.json'), 'utf8'));
const symbolsAll = U.symbols;
const symIndex = Object.fromEntries(symbolsAll.map((s, i) => [s, i]));

// hacim sırası (5 yıl ortalaması)
const V = JSON.parse(await readFile(join(BP, 'out', 'coin_volume.json'), 'utf8'));
const volOrder = Object.keys(V.bySym).sort((a, b) => V.bySym[b].volAnnual5 - V.bySym[a].volAnnual5);
const rankBySym = Object.fromEntries(volOrder.map((s, i) => [s, i + 1]));
const annualBySym = Object.fromEntries(volOrder.map((s) => [s, V.bySym[s].volAnnual5]));

const TOP = +args.top || 0;
const baseSymbols = TOP ? volOrder.slice(0, TOP) : symbolsAll;
const symbols = SYM_LIMIT ? baseSymbols.slice(0, SYM_LIMIT) : baseSymbols;

const SET_NS = [50, 100, 150, 200, 250, 300];
const NSET = SET_NS.length + 1;
const GD = 1500;

console.log(`[extract93v] durum: ${states.length}, sembol: ${symbols.length}, worker: ${NW}, setler: ${SET_NS.join('/')}`);

const NY = 5;
function newYear(withCoin) {
  return {
    n: 0, w: 0, sumR: 0, sumLog: 0, durSum: 0,
    coin: withCoin ? new Map() : null,
    dow: new Float64Array(35), month: new Float64Array(60), season: new Float64Array(20),
    hour: new Float64Array(40), dur: new Float64Array(40), ret: new Float64Array(12),
  };
}
function newAgg(withCoin) {
  return {
    withCoin, n: 0, w: 0, sumR: 0, sumLog: 0, durSum: 0,
    coins: withCoin ? new Map() : null,
    years: Array.from({ length: NY }, () => newYear(withCoin)),
    samples: withCoin ? [] : null,
  };
}

const merged = new Map();
for (const s of states) {
  merged.set(s.key, {
    all: newAgg(true),
    sets: Array.from({ length: SET_NS.length }, () => newAgg(false)),
    eqSums: Array.from({ length: NSET }, () => new Float64Array(GD)),
    eqCnts: Array.from({ length: NSET }, () => new Int32Array(GD)),
  });
}

function addArr(dst, src) { for (let i = 0; i < dst.length; i++) dst[i] += src[i]; }
function addMap(dst, entries) {
  for (const [k, a] of entries) {
    let b = dst.get(k);
    if (!b) { b = new Array(a.length).fill(0); dst.set(k, b); }
    for (let i = 0; i < a.length; i++) b[i] += a[i];
  }
}
function mergeAgg(dst, src) {
  dst.n += src.n; dst.w += src.w; dst.sumR += src.sumR; dst.sumLog += src.sumLog; dst.durSum += src.durSum;
  if (dst.coins) addMap(dst.coins, src.coins);
  for (let y = 0; y < NY; y++) {
    const a = dst.years[y], b = src.years[y];
    a.n += b.n; a.w += b.w; a.sumR += b.sumR; a.sumLog += b.sumLog; a.durSum += b.durSum;
    addArr(a.dow, b.dow); addArr(a.month, b.month); addArr(a.season, b.season);
    addArr(a.hour, b.hour); addArr(a.dur, b.dur); addArr(a.ret, b.ret);
    if (a.coin) addMap(a.coin, b.coin);
  }
  if (dst.samples) for (const s of src.samples) { if (dst.samples.length < 400) dst.samples.push(s); }
}

function runWorker(chunk, wi) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./extract93_vol_worker.mjs', import.meta.url), {
      workerData: { symbols: chunk, states, symIndex, rankBySym, setNs: SET_NS },
    });
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
  for (const st of states) {
    const src = r.aggs[st.key];
    if (!src) continue;
    const dst = merged.get(st.key);
    mergeAgg(dst.all, src.all);
    for (let s = 0; s < SET_NS.length; s++) mergeAgg(dst.sets[s], src.sets[s]);
    for (let s = 0; s < NSET; s++) {
      addArr(dst.eqSums[s], src.eqSums[s]);
      addArr(dst.eqCnts[s], src.eqCnts[s]);
    }
  }
}
console.log(`[extract93v] birleştirme bitti · ${((Date.now() - t0) / 60000).toFixed(1)} dk · hata: ${errs.length}`);
if (errs.length) console.log('  ilk hatalar:', errs.slice(0, 5));

function curveDret(sums, cnts) {
  const dret = new Array(GD);
  dret[0] = 0;
  let prev = cnts[0] ? sums[0] / cnts[0] : null;
  for (let i = 1; i < GD; i++) {
    const v = cnts[i] ? sums[i] / cnts[i] : null;
    dret[i] = (v == null || prev == null || !(prev > 0)) ? 0 : Math.round((v / prev - 1) * 10000);
    prev = v;
  }
  return dret;
}

function serAgg(A) {
  return {
    n: A.n, w: A.w, sumR: A.sumR, sumLog: A.sumLog, durSum: A.durSum,
    coins: A.coins ? [...A.coins.entries()] : [],
    years: A.years.map((Y) => ({
      n: Y.n, w: Y.w, sumR: Y.sumR, sumLog: Y.sumLog, durSum: Y.durSum,
      coin: Y.coin ? [...Y.coin.entries()] : [],
      dow: Array.from(Y.dow), month: Array.from(Y.month), season: Array.from(Y.season),
      hour: Array.from(Y.hour), dur: Array.from(Y.dur), ret: Array.from(Y.ret),
    })),
    samples: A.samples || [],
  };
}

const out = {
  gen: new Date().toISOString(),
  symbols: symbolsAll,
  vol: {
    sets: SET_NS,
    annual: symbolsAll.map((s) => annualBySym[s] || 0),
    rank: symbolsAll.map((s) => rankBySym[s] || 999999),
  },
  states: near.map((r) => ({
    key: r.id + '|' + r.tf + '|' + r.kind,
    id: r.id, tf: r.tf, kind: r.kind, keys: r.keys || [], ad: r.ad,
    n: r.n, net: r.net, pozAy: r.pozAy, top1Ay: r.top1Ay, top5Gun: r.top5Gun, r2: r.r2,
    pozGun: r.pozGun, dd: r.dd, y23: r.y23, y24: r.y24, y25: r.y25, teN: r.teN, baseAvg: r.baseAvg, kurt: r.kurt,
  })),
  aggs: {},
  errors: errs.slice(0, 50),
};
for (const st of states) {
  const M = merged.get(st.key);
  out.aggs[st.key] = {
    all: serAgg(M.all),
    sets: M.sets.map(serAgg),
    dretAll: curveDret(M.eqSums[NSET - 1], M.eqCnts[NSET - 1]),
    dretSets: M.sets.map((_, s) => curveDret(M.eqSums[s], M.eqCnts[s])),
  };
}

await writeFile(join(BP, OUT), JSON.stringify(out));
console.log(`[extract93v] yazıldı: ${OUT} · ${(JSON.stringify(out).length / 1048576).toFixed(2)} MB`);

// QA: tümü seti günlük neti, homojenlik netiyle uyuşuyor mu?
const Hmap = new Map(H.rows.map((r) => [r.id + '|' + r.tf + '|' + r.kind, r]));
let ok = 0, bad = 0, worst = 0;
for (const st of states) {
  const a = out.aggs[st.key];
  let eq = 1;
  for (let i = 0; i < a.dretAll.length; i++) eq *= 1 + a.dretAll[i] / 10000;
  const net = eq - 1;
  const h = Hmap.get(st.key);
  if (!h) continue;
  const d = Math.abs(net - h.net);
  if (d < 0.02) ok++; else { bad++; worst = Math.max(worst, d); }
  if (states.indexOf(st) < 5) console.log(`  QA ${st.key}: dretAll ${(net * 100).toFixed(1)}% vs H.net ${(h.net * 100).toFixed(1)}%`);
}
console.log(`[extract93v] QA tümü-seti net: ${ok} uyumlu, ${bad} sapmalı (en büyük ${(worst * 100).toFixed(2)} puan)`);
