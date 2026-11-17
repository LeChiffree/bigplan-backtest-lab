#!/usr/bin/env node
// Singular-Backtest ozet raporu.
//
// Kullanim:
//   node Singular-Backtest/summarize_singular.mjs
//   node Singular-Backtest/summarize_singular.mjs --json=Singular-Backtest/results/singular_results.json
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v == null ? true : v];
  }),
);
const FILE = args.json || join(HERE, 'results', 'singular_results.json');
const D = JSON.parse(await readFile(FILE, 'utf8'));
const t = D.totals;

const f = (v, d = 2) => (v == null ? '-' : Number(v).toFixed(d));
const pct = (v, d = 2) => `${(v * 100).toFixed(d)}%`;
const int = (v) => Number(v).toLocaleString('en-US');

console.log(`dosya       : ${FILE}`);
console.log(`kapsam      : ${D.scope} (${D.scope_label})`);
console.log(`veri        : ${D.data.symbols} sembol / ${D.data.states} durum / ${D.data.configs} config / ${D.data.tfs.join(', ')}`);
console.log(`donem       : ${D.data.start} -> ${D.data.end}`);
console.log('');
console.log('                        normal        singular        fark');
const row = (label, key, fmt) => {
  const a = t.normal[key], b = t.singular[key];
  console.log(`${label.padEnd(16)} ${fmt(a).padStart(14)} ${fmt(b).padStart(14)} ${fmt(b - a).padStart(14)}`);
};
row('islem', 'trades', int);
row('kazanma', 'winRate', (v) => pct(v));
row('islem ort.', 'retAll', (v) => f(v, 4) + '%');
row('ret2026 ort.', 'ret2026', (v) => f(v, 4) + '%');
row('winRatio', 'winRatio', (v) => f(v, 3));
row('kazanc suresi', 'winHoldH', (v) => f(v, 1) + 's');
row('karli gun', 'profitDays', int);
row('zararli gun', 'lossDays', int);
row('maks DD', 'maxDD', (v) => '$' + f(v, 0));
row('kasa', 'kasaAll', (v) => '$' + f(v, 0));
console.log(`bloke       : ${int(t.blocked)} (${f(t.blocked_pct)}%)`);

// TF tablosu
console.log('\nZaman dilimi      islem      bloke    bloke%   normal ort   singular ort');
const tfOrder = ['15m', '1h', '4h', '1d', '1w'];
const tfMap = new Map();
for (const r of D.cells) {
  let g = tfMap.get(r.tf);
  if (!g) { g = { tf: r.tf, n: 0, s: 0, blocked: 0, nSum: 0, sSum: 0 }; tfMap.set(r.tf, g); }
  g.n += r.n_trades; g.s += r.s_trades; g.blocked += r.blocked;
  g.nSum += r.n_sumR; g.sSum += r.s_sumR;
}
for (const tf of tfOrder) {
  const r = tfMap.get(tf);
  if (!r) continue;
  console.log(`${tf.padEnd(16)} ${int(r.n).padStart(10)} ${int(r.blocked).padStart(10)} ${f((r.blocked / r.n) * 100, 2).padStart(8)}% ${f((r.nSum / r.n) * 100, 3).padStart(11)}% ${f((r.sSum / r.s) * 100, 3).padStart(12)}%`);
}

// Strateji tablosu
console.log('\nStrateji                         islem      bloke   bloke%   normal ort   singular ort');
const strat = [...D.strategies].sort((a, b) => b.blocked - a.blocked);
for (const r of strat) {
  console.log(`${r.id.padEnd(32)} ${int(r.n_trades).padStart(10)} ${int(r.blocked).padStart(10)} ${f(r.blocked_pct, 2).padStart(7)}% ${f(r.n_retAll, 3).padStart(11)}% ${f(r.s_retAll, 3).padStart(12)}%`);
}

// Iyilesen config'ler
const cfg = D.configs.filter((r) => r.n_trades >= 1000);
console.log(`\nEn cok iyilesen config'ler (retAll ort., >=1000 islem) — ${D.configs.length} config, ${cfg.length} tanesi >=1000 islem`);
for (const r of [...cfg].sort((a, b) => b.delta_retAll - a.delta_retAll).slice(0, 8)) {
  console.log(`${r.key.padEnd(30)} TF:${r.states} ${int(r.n_trades).padStart(9)} bloke ${f(r.blocked_pct, 1).padStart(5)}%  ${f(r.n_retAll, 2).padStart(8)}% -> ${f(r.s_retAll, 2).padStart(8)}%  (${r.delta_retAll >= 0 ? '+' : ''}${f(r.delta_retAll, 2)})`);
}
console.log('\nEn cok bozulan config\'ler');
for (const r of [...cfg].sort((a, b) => a.delta_retAll - b.delta_retAll).slice(0, 8)) {
  console.log(`${r.key.padEnd(30)} TF:${r.states} ${int(r.n_trades).padStart(9)} bloke ${f(r.blocked_pct, 1).padStart(5)}%  ${f(r.n_retAll, 2).padStart(8)}% -> ${f(r.s_retAll, 2).padStart(8)}%  (${r.delta_retAll >= 0 ? '+' : ''}${f(r.delta_retAll, 2)})`);
}

// Tur ozeti
console.log('\nTur                durum      islem      bloke   bloke%   normal ort  singular ort');
for (const r of D.kinds.sort((a, b) => b.blocked - a.blocked)) {
  const kind = r.kind.length > 26 ? r.kind.slice(0, 26) : r.kind;
  console.log(`${kind.padEnd(18)} ${String(r.states).padStart(5)} ${int(r.n_trades).padStart(10)} ${int(r.blocked).padStart(10)} ${f(r.blocked_pct, 2).padStart(7)}% ${f(r.n_retAll, 3).padStart(11)}% ${f(r.s_retAll, 3).padStart(12)}%`);
}

// En cok bloke edilen coinler
console.log('\nEn cok bloke edilen coinler (tum stratejiler)');
for (const r of (D.coin_totals || D.coins).slice(0, 12)) {
  console.log(`${r.symbol.padEnd(16)} normal ${int(r.n_trades).padStart(8)} bloke ${int(r.blocked).padStart(8)} (${f(r.blocked_pct, 1)}%)  ort ${f(r.n_retAll, 2)}% -> ${f(r.s_retAll, 2)}%`);
}

const improved = D.configs.filter((r) => r.delta_retAll > 0).length;
console.log(`\niyilesen config (retAll): ${improved}/${D.configs.length}`);
console.log(`iyilesen durum (retAll) : ${D.states.filter((r) => r.delta_retAll > 0).length}/${D.states.length}`);
