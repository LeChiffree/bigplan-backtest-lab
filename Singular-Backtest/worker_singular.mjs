// Singular-Backtest worker — BigPlan tek-acik-islem varyanti.
//
// Her sembol icin ayni motoru (sim2.simulateMulti) calistirir, kapanan her
// islemin giris/cikis zamanini toplar ve secilen kapsama gore (varsayilan:
// strateji + varyant = id|kind, tum TF'ler birlikte) ayni coinde ust uste
// binen girisleri bloke eder.
//
// Cikti: durum basina normal/singular metrik sayaclari + bloke sayisi.
import { parentPort, workerData } from 'node:worker_threads';
import { BT_STRATEGIES, TF_MS } from '../tools/core.mjs';
import { makeCtx, clearMemCache } from '../tools/dataload.mjs';
import { simulateMulti } from '../tools/sim2.mjs';
import { loadMarketBase, marketView } from '../tools/market.mjs';
import { buildGates } from '../tools/filters.mjs';

const { symbols, states, gridStart, gridLen, scope, coinCount, idCount, symIndex } = workerData;
const TFS = ['15m', '1h', '4h', '1d', '1w'];
const TF_ORDER = Object.fromEntries(TFS.map((t, i) => [t, i]));
const NY = 5;
const GD = gridLen;
const DGRID_START = gridStart;

const DAY_YEAR = new Uint8Array(GD);
for (let g = 0; g < GD; g++) {
  DAY_YEAR[g] = Math.max(0, Math.min(NY - 1, new Date(DGRID_START + g * 86400000).getUTCFullYear() - 2022));
}

function newYearAgg() {
  return { n: 0, w: 0, sumR: 0, sumPos: 0, sumNeg: 0, durSum: 0, durWin: 0 };
}
function newAgg() {
  return {
    n: 0, w: 0, sumR: 0, sumPos: 0, sumNeg: 0, durSum: 0, durWin: 0,
    years: Array.from({ length: NY }, newYearAgg),
    dayPos: new Float64Array(GD),
    dayNeg: new Float64Array(GD),
  };
}

function addAgg(dst, src) {
  dst.n += src.n; dst.w += src.w; dst.sumR += src.sumR;
  dst.sumPos += src.sumPos; dst.sumNeg += src.sumNeg;
  dst.durSum += src.durSum; dst.durWin += src.durWin;
  for (let y = 0; y < NY; y++) {
    const a = dst.years[y], b = src.years[y];
    a.n += b.n; a.w += b.w; a.sumR += b.sumR;
    a.sumPos += b.sumPos; a.sumNeg += b.sumNeg;
    a.durSum += b.durSum; a.durWin += b.durWin;
  }
  for (let i = 0; i < GD; i++) { dst.dayPos[i] += src.dayPos[i]; dst.dayNeg[i] += src.dayNeg[i]; }
}

function addTrade(A, xt, r, durH) {
  const win = r > 0 ? 1 : 0;
  const pos = r > 0 ? r : 0;
  const neg = r < 0 ? -r : 0;
  A.n++; A.w += win; A.sumR += r; A.sumPos += pos; A.sumNeg += neg;
  A.durSum += durH; A.durWin += win ? durH : 0;
  let gd = ((xt - DGRID_START) / 86400000) | 0;
  if (gd < 0) gd = 0; else if (gd >= GD) gd = GD - 1;
  const Y = A.years[DAY_YEAR[gd]];
  Y.n++; Y.w += win; Y.sumR += r; Y.sumPos += pos; Y.sumNeg += neg;
  Y.durSum += durH; Y.durWin += win ? durH : 0;
  A.dayPos[gd] += pos; A.dayNeg[gd] += neg;
}

class Collector {
  constructor(tfMs) {
    this.tfMs = tfMs;
    this.et = []; this.xt = []; this.r = []; this.sd = []; this.dh = [];
  }
  onTrade(r, bars, xt, side, reason, et) {
    this.et.push(et);
    this.xt.push(xt);
    this.r.push(r);
    this.sd.push(side);
    this.dh.push((bars * this.tfMs) / 3600000);
  }
}

const NOB = 7; // n, w, sumR, sn, sw, ssumR, blocked  (id x coin)
const coinAgg = new Float64Array(idCount * coinCount * NOB);

const stratById = new Map(BT_STRATEGIES.map((s) => [s.id, s]));
const normal = states.map(() => newAgg());
const singular = states.map(() => newAgg());
const blockedByState = new Int32Array(states.length);
const singleMember = new Uint8Array(states.length);

// TF -> id -> durum indeksleri
const byTf = new Map();
for (let i = 0; i < states.length; i++) {
  const st = states[i];
  if (!byTf.has(st.tf)) byTf.set(st.tf, new Map());
  const m = byTf.get(st.tf);
  if (!m.has(st.id)) m.set(st.id, []);
  m.get(st.id).push(i);
}

// Kapsam gruplari
const groupMap = new Map();
for (let i = 0; i < states.length; i++) {
  const st = states[i];
  const k = scope === 'config' ? st.id + '|' + st.kind
    : scope === 'id' ? st.id
      : scope === 'id_tf' ? st.id + '|' + st.tf
        : st.key;
  if (!groupMap.has(k)) groupMap.set(k, []);
  groupMap.get(k).push(i);
}
const groups = [...groupMap.entries()];
for (const [, members] of groups) if (members.length === 1) singleMember[members[0]] = 1;

let merges = 0;

function mergeGroup(members, trades, symCoinIdx) {
  merges++;
  const E = [], X = [], R = [], S = [], I = [], O = [], DH = [];
  for (const si of members) {
    const T = trades[si];
    if (!T) continue;
    const o = TF_ORDER[states[si].tf];
    for (let j = 0; j < T.et.length; j++) {
      E.push(T.et[j]); X.push(T.xt[j]); R.push(T.r[j]); S.push(T.sd[j]); DH.push(T.dh[j]);
      I.push(si); O.push(o);
    }
  }
  const m = E.length;
  if (!m) return;
  const ord = new Int32Array(m);
  for (let i = 0; i < m; i++) ord[i] = i;
  // Ayni giris aninda: kisa TF once, sonra long, sonra durum sirasi.
  ord.sort((a, b) => (E[a] - E[b]) || (O[a] - O[b]) || (S[b] - S[a]) || (I[a] - I[b]));

  let lastX = -Infinity;
  for (let q = 0; q < m; q++) {
    const i = ord[q];
    if (E[i] < lastX) {
      blockedByState[I[i]]++;
      const si = I[i];
      coinAgg[(states[si].idIdx * coinCount + symCoinIdx) * NOB + 6]++;
      continue;
    }
    lastX = X[i];
    addTrade(singular[I[i]], X[i], R[i], DH[i]);
    const si = I[i];
    const o = (states[si].idIdx * coinCount + symCoinIdx) * NOB;
    coinAgg[o + 3]++; coinAgg[o + 4] += R[i] > 0 ? 1 : 0; coinAgg[o + 5] += R[i];
  }
}

const baseMkt = await loadMarketBase();
const errors = [];
const t0 = Date.now();

for (let si = 0; si < symbols.length; si++) {
  const symbol = symbols[si];
  const ci = symIndex[symbol] ?? -1;
  const trades = new Array(states.length);

  for (const tf of TFS) {
    const idGroups = byTf.get(tf);
    if (!idGroups) continue;
    let ctx;
    try { ctx = await makeCtx(tf, symbol); } catch { continue; }
    const n = ctx.S.t.length;
    const ones = new Uint8Array(n).fill(1);

    const need = new Set();
    for (const list of idGroups.values()) for (const stIdx of list) for (const k of states[stIdx].keys) need.add(k);
    let gates = null;
    try {
      if (need.size) gates = buildGates(ctx, marketView(baseMkt, ctx.S, tf), [...need]);
    } catch (e) {
      errors.push({ symbol, tf, msg: 'gate: ' + e.message });
      clearMemCache();
      continue;
    }

    for (const [id, list] of idGroups) {
      const spec = stratById.get(id);
      if (!spec || (spec.skipTfs && spec.skipTfs.includes(tf))) continue;
      const gl = [], gs = [], trs = [];
      for (const stIdx of list) {
        const st = states[stIdx];
        let L = ones, S = ones;
        if (st.keys.length === 1) {
          L = gates.L[st.keys[0]];
          S = gates.S[st.keys[0]];
        } else if (st.keys.length > 1) {
          L = new Uint8Array(n); S = new Uint8Array(n);
          L.set(gates.L[st.keys[0]]); S.set(gates.S[st.keys[0]]);
          for (let k = 1; k < st.keys.length; k++) {
            const l = gates.L[st.keys[k]], s = gates.S[st.keys[k]];
            for (let i = 0; i < n; i++) { L[i] &= l[i]; S[i] &= s[i]; }
          }
        }
        gl.push(L); gs.push(S);
        const c = new Collector(TF_MS[tf]);
        trades[stIdx] = c;
        trs.push(c);
      }
      try { simulateMulti(spec, ctx, gl, gs, trs); }
      catch (e) { errors.push({ symbol, tf, id, msg: 'sim: ' + e.message }); }
    }
    clearMemCache();
  }

  // Normal metrikler + normal coin kirilimi
  for (let stIdx = 0; stIdx < states.length; stIdx++) {
    const T = trades[stIdx];
    if (!T) continue;
    const idIdx = states[stIdx].idIdx;
    const o = (idIdx * coinCount + ci) * NOB;
    for (let j = 0; j < T.et.length; j++) {
      addTrade(normal[stIdx], T.xt[j], T.r[j], T.dh[j]);
      coinAgg[o]++; coinAgg[o + 1] += T.r[j] > 0 ? 1 : 0; coinAgg[o + 2] += T.r[j];
    }
  }

  // Singular: her grup icin kronolojik birlestirme
  for (const [, members] of groups) {
    if (members.length === 1) continue;
    mergeGroup(members, trades, ci);
  }

  if (si % 10 === 0 || si === symbols.length - 1) {
    parentPort.postMessage({ type: 'progress', done: si + 1, total: symbols.length, ms: Date.now() - t0 });
  }
}

// Tek uyeli gruplarda singular = normal (blokaj imkansiz); tek seferde kopyala.
for (let i = 0; i < states.length; i++) if (singleMember[i]) addAgg(singular[i], normal[i]);

function serAgg(A) {
  return {
    n: A.n, w: A.w, sumR: A.sumR, sumPos: A.sumPos, sumNeg: A.sumNeg,
    durSum: A.durSum, durWin: A.durWin,
    years: A.years.map((y) => [y.n, y.w, y.sumR, y.sumPos, y.sumNeg, y.durSum, y.durWin]),
    dayPos: A.dayPos,
    dayNeg: A.dayNeg,
  };
}

parentPort.postMessage({
  type: 'result',
  states: states.map((st, i) => ({
    i,
    blocked: blockedByState[i],
    normal: serAgg(normal[i]),
    singular: serAgg(singular[i]),
  })),
  coinAgg,
  errors,
  merges,
  ms: Date.now() - t0,
});
