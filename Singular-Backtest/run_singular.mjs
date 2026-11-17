#!/usr/bin/env node
// Singular-Backtest — BigPlan tek-acik-islem kurali.
//
// Kural: secilen kapsamda (varsayilan: strateji + varyant = id|kind, tum
// zaman dilimleri birlikte) ayni coinde ayni anda en fazla bir acik islem.
// Yeni giris sinyali, onceki islem kapanmadan gelirse bloke edilir.
//
// Normal backtest sonuclari pro_bundle.json'dan okunmaz; motor yeniden
// kosulur ve normal metrikler pro_bundle ile birebir karsilastirilir.
//
// Kullanim:
//   node Singular-Backtest/run_singular.mjs
//   node Singular-Backtest/run_singular.mjs --scope=id --workers=7
//   node Singular-Backtest/run_singular.mjs --symbols=20 --out=Singular-Backtest/results_test
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v == null ? true : v];
  }),
);

const SCOPE = args.scope || 'config';
const SCOPES = ['config', 'id', 'id_tf', 'state'];
if (!SCOPES.includes(SCOPE)) throw new Error('gecersiz --scope: ' + SCOPE);

const NW = Math.max(1, Math.min(8, +(args.workers || (cpus().length - 1))));
const SYM_LIMIT = +(args.symbols || 0);
const OUT = args.out || join(HERE, 'results');
const PRO = args.pro || join(ROOT, 'out', 'pro_bundle.json');

const SCOPE_LABEL = {
  config: 'Strateji + varyant (id+kind), tum zaman dilimleri birlikte',
  id: 'Strateji ailesi (id), tum varyant ve TF\'ler birlikte',
  id_tf: 'Strateji + zaman dilimi (id+tf), tum varyantlar birlikte',
  state: 'Tek durum (id+tf+kind) — normal ile ayni',
};

const PRO_DATA = JSON.parse(await readFile(PRO, 'utf8'));
const GRID = PRO_DATA.grid;
const GD = GRID.len;

const idList = [...new Set(PRO_DATA.states.map((s) => s.id))].sort();
const idIdxOf = Object.fromEntries(idList.map((id, i) => [id, i]));
const symbolsAll = PRO_DATA.symbols;
const symbols = SYM_LIMIT ? symbolsAll.slice(0, SYM_LIMIT) : symbolsAll;
const symIndex = Object.fromEntries(symbolsAll.map((s, i) => [s, i]));

const states = PRO_DATA.states.map((s) => ({
  key: s.key,
  id: s.id,
  tf: s.tf,
  kind: s.kind,
  keys: s.keys || [],
  isSingle: !!s.isSingle,
  idIdx: idIdxOf[s.id],
}));

const num = (v) => (Number.isFinite(v) ? v : 0);

// ------------------------------- metrikler -------------------------------
function metrics(A, ctx) {
  const n = A.n;
  const w = A.w;
  const sumR = A.sumR;
  const wins = w;
  const losses = n - w;
  const y26 = A.years[4];
  const y25 = A.years[3];
  let kasa = 0, kasa2526 = 0, kasa2026 = 0;
  let peak = 0, maxDD = 0;
  let profitDays = 0, lossDays = 0;
  for (let d = 0; d < GD; d++) {
    const net = (A.dayPos[d] - A.dayNeg[d]) * 10;
    kasa += net;
    if (d >= ctx.idx2025) kasa2526 += net;
    if (d >= ctx.idx2026) kasa2026 += net;
    if (net > 0) profitDays++; else if (net < 0) lossDays++;
    peak = Math.max(peak, kasa);
    const dd = kasa - peak;
    if (dd < maxDD) maxDD = dd;
  }
  const avg = n ? sumR / n : 0;
  const avgPos = wins ? A.sumPos / wins : 0;
  const avgNeg = losses ? A.sumNeg / losses : 0;
  const winHoldH = wins ? A.durWin / wins : 0;
  return {
    trades: n,
    wins,
    losses,
    winRate: n ? w / n : 0,
    avgRet: avg * 100,
    retAll: avg * 100,
    ret2026: y26[0] ? (y26[2] / y26[0]) * 100 : 0,
    ret2025: y25[0] ? (y25[2] / y25[0]) * 100 : 0,
    winRatio: losses ? wins / losses : wins,
    winHoldH,
    winHoldSec: winHoldH * 3600,
    holdH: n ? A.durSum / n : 0,
    profitDays,
    lossDays,
    maxDD,
    sumR,
    kasaAll: kasa,
    kasa2526,
    kasa2026,
    pf: A.sumNeg > 1e-9 ? A.sumPos / A.sumNeg : 99,
    payoff: avgNeg > 1e-9 ? avgPos / avgNeg : 99,
    years: A.years.map((y) => [y.n, +num(y.sumR).toFixed(3)]),
  };
}

function prefixed(A, prefix, ctx) {
  const m = metrics(A, ctx);
  const out = {};
  for (const [k, v] of Object.entries(m)) out[prefix + k] = v;
  return out;
}

// -------------------------- aggregate yardimcilari --------------------------
function newAgg() {
  return {
    n: 0, w: 0, sumR: 0, sumPos: 0, sumNeg: 0, durSum: 0, durWin: 0,
    years: Array.from({ length: 5 }, () => [0, 0, 0, 0, 0, 0, 0]),
    dayPos: new Float64Array(GD),
    dayNeg: new Float64Array(GD),
  };
}

function addSerialized(dst, src) {
  dst.n += src.n; dst.w += src.w; dst.sumR += src.sumR;
  dst.sumPos += src.sumPos; dst.sumNeg += src.sumNeg;
  dst.durSum += src.durSum; dst.durWin += src.durWin;
  for (let y = 0; y < 5; y++) {
    const a = dst.years[y], b = src.years[y];
    for (let k = 0; k < 7; k++) a[k] += b[k];
  }
  const dp = src.dayPos, dn = src.dayNeg;
  for (let i = 0; i < GD; i++) { dst.dayPos[i] += dp[i]; dst.dayNeg[i] += dn[i]; }
}

// ------------------------------- worker'lar -------------------------------
function runWorker(chunk, wi) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./worker_singular.mjs', import.meta.url), {
      workerData: {
        symbols: chunk,
        states,
        gridStart: GRID.start,
        gridLen: GD,
        scope: SCOPE,
        coinCount: symbolsAll.length,
        idCount: idList.length,
        symIndex,
      },
    });
    let last = Date.now();
    w.on('message', (m) => {
      if (m.type === 'progress') {
        const now = Date.now();
        if (now - last > 20000) {
          last = now;
          console.log(`  [w${wi}] ${m.done}/${m.total} sembol - ${(m.ms / 1000).toFixed(0)}s`);
        }
      } else if (m.type === 'result') {
        console.log(`  [w${wi}] bitti - ${(m.ms / 1000).toFixed(0)}s - hata: ${m.errors.length} - birlestirme: ${m.merges}`);
        resolve(m);
      }
    });
    w.on('error', reject);
    w.on('exit', (c) => { if (c !== 0) reject(new Error('worker exit ' + c)); });
  });
}

const t0 = Date.now();
const chunks = Array.from({ length: NW }, (_, i) => symbols.filter((_, j) => j % NW === i));
console.log(`[singular] kapsam=${SCOPE} durum=${states.length} sembol=${symbols.length} worker=${NW}`);
const results = await Promise.all(chunks.map((c, i) => runWorker(c, i)));
console.log(`[singular] simulasyon bitti - ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// --------------------------------- birlestir --------------------------------
const normal = states.map(() => newAgg());
const singular = states.map(() => newAgg());
const blocked = new Float64Array(states.length);
const coinAgg = new Float64Array(idList.length * symbolsAll.length * 7);
let errors = [];

for (const r of results) {
  errors = errors.concat(r.errors || []);
  for (const st of r.states) {
    addSerialized(normal[st.i], st.normal);
    addSerialized(singular[st.i], st.singular);
    blocked[st.i] += st.blocked;
  }
  const ca = r.coinAgg;
  for (let i = 0; i < ca.length; i++) coinAgg[i] += ca[i];
}

const ctx = { idx2025: PRO_DATA.idx2025, idx2026: PRO_DATA.idx2026 };

// ------------------------------- satirlar -----------------------------------
function groupRows(keyFn, labelFn) {
  const map = new Map();
  for (let i = 0; i < states.length; i++) {
    const k = keyFn(states[i]);
    if (!map.has(k)) map.set(k, { key: k, idx: [], blocked: 0, normal: newAgg(), singular: newAgg() });
    map.get(k).idx.push(i);
  }
  const rows = [];
  for (const g of map.values()) {
    for (const i of g.idx) {
      addSerialized(g.normal, normal[i]);
      addSerialized(g.singular, singular[i]);
      g.blocked += blocked[i];
    }
    const base = labelFn(g.key, g.idx);
    const nTrades = g.normal.n;
    const row = {
      key: g.key,
      ...base,
      states: g.idx.length,
      blocked: g.blocked,
      blocked_pct: nTrades ? (g.blocked / nTrades) * 100 : 0,
    };
    Object.assign(row, prefixed(g.normal, 'n_', ctx));
    Object.assign(row, prefixed(g.singular, 's_', ctx));
    row.delta_retAll = row.s_retAll - row.n_retAll;
    row.delta_kasa = row.s_kasaAll - row.n_kasaAll;
    rows.push(row);
  }
  rows.sort((a, b) => (b.n_trades - a.n_trades) || String(a.key).localeCompare(String(b.key)));
  return rows;
}

const titleOf = Object.fromEntries(PRO_DATA.strategies.map((s) => [s.id, s.title]));

const stateRows = states.map((st, i) => {
  const row = {
    key: st.key,
    id: st.id,
    title: titleOf[st.id] || st.id.toUpperCase(),
    tf: st.tf,
    kind: st.kind,
    keys: st.keys,
    isSingle: st.isSingle,
    blocked: blocked[i],
    blocked_pct: normal[i].n ? (blocked[i] / normal[i].n) * 100 : 0,
  };
  Object.assign(row, prefixed(normal[i], 'n_', ctx));
  Object.assign(row, prefixed(singular[i], 's_', ctx));
  row.delta_retAll = row.s_retAll - row.n_retAll;
  row.delta_kasa = row.s_kasaAll - row.n_kasaAll;
  return row;
});

const configs = groupRows(
  (st) => st.id + '|' + st.kind,
  (k) => {
    const [id, kind] = k.split('|');
    return { id, kind, title: titleOf[id] || id.toUpperCase() };
  },
);
const cells = groupRows(
  (st) => st.id + '|' + st.tf,
  (k) => {
    const [id, tf] = k.split('|');
    return { id, tf, title: titleOf[id] || id.toUpperCase() };
  },
);
const strategies = groupRows(
  (st) => st.id,
  (k) => ({ id: k, title: titleOf[k] || k.toUpperCase() }),
);
const kindRows = groupRows(
  (st) => st.kind,
  (k) => ({ kind: k }),
);

// --------------------------------- coinler ----------------------------------
const NOB = 7;
const coins = [];
for (let idIdx = 0; idIdx < idList.length; idIdx++) {
  for (let ci = 0; ci < symbolsAll.length; ci++) {
    const o = (idIdx * symbolsAll.length + ci) * NOB;
    const n = coinAgg[o], w = coinAgg[o + 1], sumR = coinAgg[o + 2];
    const sn = coinAgg[o + 3], sw = coinAgg[o + 4], ssumR = coinAgg[o + 5];
    const bl = coinAgg[o + 6];
    if (!n) continue;
    coins.push({
      id: idList[idIdx],
      title: titleOf[idList[idIdx]] || idList[idIdx].toUpperCase(),
      symbol: symbolsAll[ci],
      n_trades: n,
      s_trades: sn,
      blocked: bl,
      blocked_pct: (bl / n) * 100,
      n_retAll: (sumR / n) * 100,
      s_retAll: sn ? (ssumR / sn) * 100 : 0,
      n_winRate: w / n,
      s_winRate: sn ? sw / sn : 0,
    });
  }
}
coins.sort((a, b) => (b.blocked - a.blocked) || a.symbol.localeCompare(b.symbol));

// Coin bazinda toplam (tum stratejiler)
const coinTotals = new Map();
for (const c of coins) {
  let g = coinTotals.get(c.symbol);
  if (!g) { g = { symbol: c.symbol, n_trades: 0, s_trades: 0, blocked: 0, n_sumR: 0, s_sumR: 0, n_wins: 0, s_wins: 0 }; coinTotals.set(c.symbol, g); }
  g.n_trades += c.n_trades; g.s_trades += c.s_trades; g.blocked += c.blocked;
  g.n_sumR += c.n_retAll * c.n_trades / 100;
  g.s_sumR += c.s_retAll * c.s_trades / 100;
  g.n_wins += c.n_winRate * c.n_trades;
  g.s_wins += c.s_winRate * c.s_trades;
}
const coinRows = [...coinTotals.values()].map((g) => ({
  symbol: g.symbol,
  n_trades: g.n_trades,
  s_trades: g.s_trades,
  blocked: g.blocked,
  blocked_pct: g.n_trades ? (g.blocked / g.n_trades) * 100 : 0,
  n_retAll: g.n_trades ? (g.n_sumR / g.n_trades) * 100 : 0,
  s_retAll: g.s_trades ? (g.s_sumR / g.s_trades) * 100 : 0,
  n_winRate: g.n_trades ? g.n_wins / g.n_trades : 0,
  s_winRate: g.s_trades ? g.s_wins / g.s_trades : 0,
}));
coinRows.sort((a, b) => (b.blocked - a.blocked) || a.symbol.localeCompare(b.symbol));

// --------------------------------- toplamlar --------------------------------
const totalNormal = newAgg();
const totalSingular = newAgg();
for (let i = 0; i < states.length; i++) {
  addSerialized(totalNormal, normal[i]);
  addSerialized(totalSingular, singular[i]);
}
const totalBlocked = blocked.reduce((a, b) => a + b, 0);

const payload = {
  repo: 'bigplan-backtest-lab',
  generated_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  rule: 'Secilen kapsamda ayni coinde ayni anda en fazla bir acik islem. Onceki islem kapanmadan gelen yeni giris sinyali bloke edilir.',
  scope: SCOPE,
  scope_label: SCOPE_LABEL[SCOPE],
  data: {
    source: 'out/pro_bundle.json + lokal 1m/5m/15m/1h/4h/1d verisi (D:\\1mDataBinance)',
    symbols: symbolsAll.length,
    symbols_run: symbols.length,
    states: states.length,
    configs: configs.length,
    ids: idList.length,
    tfs: [...new Set(states.map((s) => s.tf))].sort(),
    start: new Date(GRID.start).toISOString().slice(0, 10),
    end: new Date(GRID.start + (GD - 1) * GRID.step).toISOString().slice(0, 10),
    stake_usd: 10,
    cash_model: 'Islem basina sabit 10 USD; retAll = islem basina ortalama getiri (%)',
    priority: 'Ayni giris aninda kisa TF once: 15m > 1h > 4h > 1d > 1w, sonra long > short',
  },
  totals: {
    normal: metrics(totalNormal, ctx),
    singular: metrics(totalSingular, ctx),
    blocked: totalBlocked,
    blocked_pct: totalNormal.n ? (totalBlocked / totalNormal.n) * 100 : 0,
  },
  states: stateRows,
  configs,
  cells,
  strategies,
  kinds: kindRows,
  coins,
  coin_totals: coinRows,
  errors: errors.slice(0, 40),
};

await mkdir(OUT, { recursive: true });
const round = (obj) => {
  if (typeof obj === 'number') return Number.isInteger(obj) ? obj : Math.round(obj * 10000) / 10000;
  if (Array.isArray(obj)) return obj.map(round);
  if (obj && typeof obj === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(obj)) o[k] = round(v);
    return o;
  }
  return obj;
};
const compact = round(payload);
await writeFile(join(OUT, 'singular_results.json'), JSON.stringify(compact), 'utf8');
await writeFile(join(OUT, 'run_manifest.json'), JSON.stringify({
  repo: 'bigplan-backtest-lab',
  generated_at: payload.generated_at,
  scope: SCOPE,
  scope_label: SCOPE_LABEL[SCOPE],
  source: payload.data.source,
  symbols: payload.data.symbols,
  states: payload.data.states,
  configs: payload.data.configs,
  normal_trades: payload.totals.normal.trades,
  singular_trades: payload.totals.singular.trades,
  blocked: payload.totals.blocked,
  blocked_pct: Math.round(payload.totals.blocked_pct * 10000) / 10000,
  priority: payload.data.priority,
  stake_usd: payload.data.stake_usd,
  cash_model: payload.data.cash_model,
  elapsed_sec: Math.round((Date.now() - t0) / 1000),
}, null, 2), 'utf8');

// CSV yardimcilari
function toCsv(rows, cols) {
  const head = cols.join(',');
  const lines = rows.map((r) => cols.map((c) => {
    const v = r[c];
    if (v == null) return '';
    const s = String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(','));
  return [head, ...lines].join('\n');
}
const stateCols = ['key', 'id', 'tf', 'kind', 'isSingle', 'blocked', 'blocked_pct',
  'n_trades', 's_trades', 'n_winRate', 's_winRate', 'n_retAll', 's_retAll', 'delta_retAll',
  'n_ret2026', 's_ret2026', 'n_winRatio', 's_winRatio', 'n_winHoldH', 's_winHoldH',
  'n_profitDays', 's_profitDays', 'n_lossDays', 's_lossDays', 'n_maxDD', 's_maxDD',
  'n_kasaAll', 's_kasaAll'];
await writeFile(join(OUT, 'singular_states.csv'), toCsv(stateRows, stateCols), 'utf8');
await writeFile(join(OUT, 'singular_configs.csv'), toCsv(configs, ['key', 'id', 'kind', 'states', ...stateCols.filter((c) => c !== 'key' && c !== 'id' && c !== 'tf' && c !== 'kind' && c !== 'isSingle')]), 'utf8');
await writeFile(join(OUT, 'singular_cells.csv'), toCsv(cells, ['key', 'id', 'tf', 'states', ...stateCols.filter((c) => !['key', 'id', 'tf', 'kind', 'isSingle'].includes(c))]), 'utf8');
await writeFile(join(OUT, 'singular_strategies.csv'), toCsv(strategies, ['key', 'id', 'states', ...stateCols.filter((c) => !['key', 'id', 'tf', 'kind', 'isSingle'].includes(c))]), 'utf8');
await writeFile(join(OUT, 'singular_coins.csv'), toCsv(coins, ['id', 'title', 'symbol', 'n_trades', 's_trades', 'blocked', 'blocked_pct', 'n_retAll', 's_retAll', 'n_winRate', 's_winRate']), 'utf8');
await writeFile(join(OUT, 'singular_coin_totals.csv'), toCsv(coinRows, ['symbol', 'n_trades', 's_trades', 'blocked', 'blocked_pct', 'n_retAll', 's_retAll', 'n_winRate', 's_winRate']), 'utf8');

const t = payload.totals;
const clean = (m) => `${m.trades.toLocaleString('en-US')} islem | WR ${(m.winRate * 100).toFixed(2)}% | ort ${m.retAll.toFixed(4)}% | kasa $${m.kasaAll.toFixed(0)} | DD $${m.maxDD.toFixed(0)}`;
console.log('');
console.log(`[singular] kapsam      : ${SCOPE} (${SCOPE_LABEL[SCOPE]})`);
console.log(`[singular] normal      : ${clean(t.normal)}`);
console.log(`[singular] singular    : ${clean(t.singular)}`);
console.log(`[singular] bloke       : ${t.blocked.toLocaleString('en-US')} (${t.blocked_pct.toFixed(2)}%)`);
console.log(`[singular] dogrulama   : normal != pro_bundle olan durum icin verify_singular.mjs`);
console.log(`[singular] yazildi     : ${join(OUT, 'singular_results.json')}`);
if (t.normal.trades !== states.reduce((a, _, i) => a + normal[i].n, 0)) {
  console.log('[singular] UYARI: toplam islem sayisi tutarsiz');
}
