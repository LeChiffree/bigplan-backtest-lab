// build93_vol.mjs — hacim-setli ham çıktıyı dashboard verisine dönüştürür
// Girdi: out/backtest93_vol.json (+ eski out/backtest93_data.json: grid/symbols/keyTitle/dret)
// Çıktı: out/backtest93_data.json (yedek: out/backtest93_data_v1.json)
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BP = 'D:/BigPlan';
const V = JSON.parse(await readFile(join(BP, 'out', 'backtest93_vol.json'), 'utf8'));
const OLD = JSON.parse(await readFile(join(BP, 'out', 'backtest93_data.json'), 'utf8'));

const oldByKey = new Map(OLD.states.map((s) => [s.key, s]));
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const r2 = (v) => Math.round(v * 100) / 100;

function roundStride(arr, stride, decimals) {
  const m = Math.pow(10, decimals);
  for (let i = 0; i < arr.length; i += stride) {
    for (let j = 1; j < stride; j++) arr[i + j] = Math.round(arr[i + j] * m) / m;
  }
  return arr;
}

const states = [];
let qaOk = 0, qaBad = 0, qaWorst = 0;
const qaRows = [];

for (const st of V.states) {
  const a = V.aggs[st.key];
  if (!a) continue;
  const old = oldByKey.get(st.key);

  // QA: tümü seti günlük eğrisi eski dret ile uyuşuyor mu?
  if (old) {
    let eq = 1;
    for (let i = 0; i < a.dretAll.length; i++) eq *= 1 + a.dretAll[i] / 10000;
    const net = eq - 1;
    let eqOld = 1;
    for (let i = 0; i < old.dret.length; i++) eqOld *= 1 + old.dret[i] / 10000;
    const d = Math.abs(net - (eqOld - 1));
    if (d < 0.02) qaOk++; else { qaBad++; qaWorst = Math.max(qaWorst, d); qaRows.push([st.key, (net * 100).toFixed(1), ((eqOld - 1) * 100).toFixed(1)]); }
  }

  const coinMap = (arr) => arr.map(([ci, e]) => [ci, e[0], e[1], r6(e[2]), r6(e[3]), r2(e[4]), r6(e[5] || 0), r6(e[6] || 0)]);

  const agg = {
    n: a.all.n, w: a.all.w, sumR: r6(a.all.sumR), sumLog: r6(a.all.sumLog), durSum: r2(a.all.durSum),
    coins: coinMap(a.all.coins),
    years: a.all.years.map((Y) => ({
      n: Y.n, w: Y.w, sumR: r6(Y.sumR), sumLog: r6(Y.sumLog), durSum: r2(Y.durSum),
      coin: coinMap(Y.coin || []),
      dow: roundStride(Array.from(Y.dow), 5, 6),
      month: roundStride(Array.from(Y.month), 5, 6),
      season: roundStride(Array.from(Y.season), 5, 6),
      hour: roundStride(Array.from(Y.hour), 5, 6),
      dur: roundStride(Array.from(Y.dur), 5, 6),
      ret: Y.ret.map((v) => Math.round(v)),
    })),
    samples: a.all.samples.map(([h, r, ci, y]) => [r2(h), r2(r), ci, y]),
  };

  const sets = a.sets.map((S) => ({
    n: S.n, w: S.w, sumR: r6(S.sumR), sumLog: r6(S.sumLog), durSum: r2(S.durSum),
    years: S.years.map((Y) => ({
      n: Y.n, w: Y.w, sumR: r6(Y.sumR), sumLog: r6(Y.sumLog), durSum: r2(Y.durSum),
      dow: roundStride(Array.from(Y.dow), 5, 6),
      month: roundStride(Array.from(Y.month), 5, 6),
      season: roundStride(Array.from(Y.season), 5, 6),
      hour: roundStride(Array.from(Y.hour), 5, 6),
      dur: roundStride(Array.from(Y.dur), 5, 6),
      ret: Y.ret.map((v) => Math.round(v)),
    })),
  }));

  states.push({
    key: st.key, id: st.id, tf: st.tf, kind: st.kind, keys: st.keys || [], keyTitles: (st.keys || []).map((k) => OLD.keyTitle[k] || k),
    ad: st.ad, n: st.n, net: st.net, pozAy: st.pozAy, top1Ay: st.top1Ay, top5Gun: st.top5Gun, r2: st.r2,
    pozGun: st.pozGun, dd: st.dd, y23: st.y23, y24: st.y24, y25: st.y25, teN: st.teN, baseAvg: st.baseAvg, kurt: st.kurt,
    dret: old ? old.dret : a.dretAll,   // tümü: bilinen iyi eğri
    dretSets: a.dretSets,               // 6 filtreli set
    agg,
    sets,
  });
}

const out = {
  gen: new Date().toISOString(),
  grid: OLD.grid,
  symbols: OLD.symbols,
  keyTitle: OLD.keyTitle,
  vol: V.vol,
  states,
};

await writeFile(join(BP, 'out', 'backtest93_data_v1.json'), JSON.stringify(OLD));
await writeFile(join(BP, 'out', 'backtest93_data.json'), JSON.stringify(out));
console.log(`[build93v] durum: ${states.length} · MB: ${(JSON.stringify(out).length / 1048576).toFixed(2)}`);
console.log(`[build93v] QA tümü-seti net: ${qaOk} uyumlu, ${qaBad} sapmalı (en büyük ${(qaWorst * 100).toFixed(2)} puan)`);
if (qaRows.length) console.log('  sapmalar:', qaRows.slice(0, 8));
console.log('[build93v] set işlem sayıları (ilk 3 durum):');
for (const s of states.slice(0, 3)) console.log('  ', s.key, 'tümü', s.n, '| setler', s.sets.map((x) => x.n).join('/'));
