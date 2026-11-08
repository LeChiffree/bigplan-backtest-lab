// build93.mjs — ham işlem verisi + günlük eğrileri dashboard verisine dönüştürür
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FILTERS } from './filters.mjs';

const BP = 'D:/BigPlan';
const RAW = JSON.parse(await readFile(join(BP, 'out', 'backtest93_raw.json'), 'utf8'));
const U = JSON.parse(await readFile(join(BP, 'out', 'universe.json'), 'utf8'));

const keyTitle = Object.fromEntries(FILTERS.map((f) => [f.k, f.title || f.k]));
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const r2 = (v) => Math.round(v * 100) / 100;

function roundStride(arr, stride, decimals) {
  const m = Math.pow(10, decimals);
  for (let i = 0; i < arr.length; i += stride) {
    for (let j = 1; j < stride; j++) arr[i + j] = Math.round(arr[i + j] * m) / m;
  }
  return arr;
}

const gridRef = JSON.parse(await readFile(join(BP, 'out', 'daily', RAW.states[0].id + '.json'), 'utf8')).grid;
const states = [];

for (const st of RAW.states) {
  const d = JSON.parse(await readFile(join(BP, 'out', 'daily', st.id + '.json'), 'utf8'));
  const t = d.tf[st.tf];
  let node = st.kind === 'temel' ? t.base : t.variants[+st.kind.replace('varyant', '') - 1];
  if (!node) { console.log('GÜNLÜK YOK', st.key); continue; }
  const curve = node.curve;
  const dret = new Array(curve.length);
  dret[0] = 0;
  let prev = curve[0];
  for (let i = 1; i < curve.length; i++) {
    const v = curve[i];
    dret[i] = (v == null || prev == null || !(prev > 0)) ? 0 : Math.round((v / prev - 1) * 10000);
    prev = v;
  }
  const agg = RAW.aggs[st.key];
  const years = agg.years.map((Y) => ({
    n: Y.n, w: Y.w, sumR: r6(Y.sumR), sumLog: r6(Y.sumLog), durSum: r2(Y.durSum),
    coin: Y.coin.map(([ci, a]) => [ci, a[0], a[1], r6(a[2]), r6(a[3]), r2(a[4])]),
    dow: roundStride(Array.from(Y.dow), 5, 6),
    month: roundStride(Array.from(Y.month), 5, 6),
    season: roundStride(Array.from(Y.season), 5, 6),
    hour: roundStride(Array.from(Y.hour), 5, 6),
    dur: roundStride(Array.from(Y.dur), 5, 6),
    ret: Y.ret.map((v) => Math.round(v)),
  }));
  const aggOut = {
    n: agg.n, w: agg.w, sumR: r6(agg.sumR), sumLog: r6(agg.sumLog), durSum: r2(agg.durSum),
    coins: agg.coins.map(([ci, a]) => [ci, a[0], a[1], r6(a[2]), r6(a[3]), r2(a[4])]),
    years,
    samples: agg.samples.map(([h, r, ci, y]) => [r2(h), r2(r), ci, y]),
  };
  states.push({
    key: st.key, id: st.id, tf: st.tf, kind: st.kind, keys: st.keys, keyTitles: st.keys.map((k) => keyTitle[k] || k),
    ad: st.ad, n: st.n, net: st.net, pozAy: st.pozAy, top1Ay: st.top1Ay, top5Gun: st.top5Gun, r2: st.r2,
    pozGun: st.pozGun, dd: st.dd, y23: st.y23, y24: st.y24, y25: st.y25, teN: st.teN, baseAvg: st.baseAvg, kurt: st.kurt,
    dret,
    curveNet: curve[curve.length - 1] - 1,
    agg: aggOut,
  });
}

const out = {
  gen: new Date().toISOString(),
  grid: gridRef,
  symbols: U.symbols,
  keyTitle,
  states,
};
await writeFile(join(BP, 'out', 'backtest93_data.json'), JSON.stringify(out));
console.log('[build93] durum:', states.length, '| MB:', (JSON.stringify(out).length / 1048576).toFixed(2));
console.log('[build93] grid:', JSON.stringify(gridRef), '| ilk gün:', new Date(gridRef.start).toISOString().slice(0, 10));
console.log('[build93] net kontrol (günlük eğri sonu vs H.net):');
for (const s of states.slice(0, 5)) console.log('  ', s.key, (s.curveNet * 100).toFixed(1) + '%', 'vs', (s.net * 100).toFixed(1) + '%');
