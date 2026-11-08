// ultra_probe.mjs — 93 adayın 10x/15x kaldıraç dağılımı
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BP } from '../tools/core.mjs';

const D = JSON.parse(await readFile(join(BP, 'out', 'backtest93_data.json'), 'utf8'));
const G = D.grid;
const DATES = Array.from({ length: G.len }, (_, i) => G.start + i * G.step);
const YEARS = DATES.map((t) => new Date(t).getUTCFullYear());

function levRun(dret, L) {
  let eq = 1, peak = 1, dd = 0, liq = false, liqDay = null;
  for (let i = 0; i < dret.length; i++) {
    const g = 1 + L * (dret[i] / 10000);
    if (g <= 0) { eq = 0; liq = true; liqDay = i; break; }
    eq *= g;
    if (eq > peak) peak = eq;
    const d = eq / peak - 1;
    if (d < dd) dd = d;
  }
  return { net: eq - 1, dd, liq, liqDay };
}
function comp(dret, idxs) {
  let eq = 1;
  for (const i of idxs) {
    const g = 1 + dret[i] / 10000;
    if (g <= 0) return -1;
    eq *= g;
  }
  return eq - 1;
}
console.log('states', D.states.length);
const rows = D.states.map((s) => {
  const l1 = levRun(s.dret, 1), l10 = levRun(s.dret, 10), l15 = levRun(s.dret, 15), l20 = levRun(s.dret, 20);
  const cal1 = l1.dd < 0 ? l1.net / Math.abs(l1.dd) : null;
  const cal10 = l10.dd < 0 ? l10.net / Math.abs(l10.dd) : null;
  const cal15 = l15.dd < 0 ? l15.net / Math.abs(l15.dd) : null;
  const sets10 = (s.dretSets || []).map((dr) => levRun(dr, 10));
  const sets15 = (s.dretSets || []).map((dr) => levRun(dr, 15));
  const y10 = [2023, 2024, 2025, 2026].map((y) => comp(s.dret, YEARS.map((yy, i) => yy === y ? i : -1).filter((i) => i >= 0)));
  return { key: s.key, tf: s.tf, n: s.n, net1: l1.net, net10: l10.net, dd10: l10.dd, liq10: l10.liq, net15: l15.net, dd15: l15.dd, liq15: l15.liq, liq20: l20.liq, cal1, cal10, cal15, sets10, sets15, y10, top5: s.top5Gun };
});
rows.sort((a, b) => (b.cal15 || -9) - (a.cal15 || -9));
console.log('--- cal15 ilk 12 ---');
for (const r of rows.slice(0, 12)) {
  console.log(r.key.padEnd(30), 'n', String(r.n).padStart(5), '1x', (r.net1 * 100).toFixed(0) + '%', '10x', (r.net10 * 100).toFixed(0) + '%', 'dd', (r.dd10 * 100).toFixed(0) + '%', '15x', (r.net15 * 100).toFixed(0) + '%', 'dd', (r.dd15 * 100).toFixed(0) + '%', 'liq', r.liq10 ? '10' : r.liq15 ? '15' : r.liq20 ? '20' : '-', 'cal15', r.cal15?.toFixed(2), 'sets+', r.sets10.filter((x) => x.net > 0).length + '/6');
}
console.log('--- liq sayıları ---', '10x', rows.filter((r) => r.liq10).length, '15x', rows.filter((r) => r.liq15).length, '20x', rows.filter((r) => r.liq20).length);
console.log('--- net10 medyan ---', (rows.map((r) => r.net10).sort((a, b) => a - b)[Math.floor(rows.length / 2)] * 100).toFixed(0) + '%');
console.log('--- dd10 medyan ---', (rows.map((r) => r.dd10).sort((a, b) => a - b)[Math.floor(rows.length / 2)] * 100).toFixed(0) + '%');
