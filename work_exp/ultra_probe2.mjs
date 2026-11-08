// ultra_probe2.mjs — log-growth / leverage efficiency dağılımı
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BP } from '../tools/core.mjs';

const D = JSON.parse(await readFile(join(BP, 'out', 'backtest93_data.json'), 'utf8'));
const G = D.grid;
const DATES = Array.from({ length: G.len }, (_, i) => G.start + i * G.step);
const YEARS = DATES.map((t) => new Date(t).getUTCFullYear());

function stats(dret, L) {
  let eq = 1, peak = 1, dd = 0, liq = false, liqDay = null, sum = 0, sum2 = 0, n = 0, minG = 1;
  for (let i = 0; i < dret.length; i++) {
    const g = 1 + L * (dret[i] / 10000);
    if (g <= 0) { liq = true; liqDay = i; break; }
    if (g < minG) minG = g;
    const lg = Math.log(g);
    sum += lg; sum2 += lg * lg; n++;
    eq *= g;
    if (eq > peak) peak = eq;
    const d = eq / peak - 1;
    if (d < dd) dd = d;
  }
  const mu = n ? sum / n : 0;
  const sd = n ? Math.sqrt(Math.max(0, sum2 / n - mu * mu)) : 0;
  return { net: eq - 1, dd, liq, liqDay, mu, sd, minG, n };
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
const rows = D.states.map((s) => {
  const a = stats(s.dret, 1), b = stats(s.dret, 10), c = stats(s.dret, 15), d = stats(s.dret, 20);
  const g1 = Math.exp(a.mu * 365) - 1, g10 = Math.exp(b.mu * 365) - 1, g15 = Math.exp(c.mu * 365) - 1;
  const sh1 = a.sd > 0 ? a.mu / a.sd * Math.sqrt(365) : null;
  const sh10 = b.sd > 0 ? b.mu / b.sd * Math.sqrt(365) : null;
  const sh15 = c.sd > 0 ? c.mu / c.sd * Math.sqrt(365) : null;
  const eff10 = a.mu > 0 ? b.mu / (10 * a.mu) : null;
  const eff15 = a.mu > 0 ? c.mu / (15 * a.mu) : null;
  const sets10 = (s.dretSets || []).map((dr) => stats(dr, 10));
  const y10 = [2023, 2024, 2025, 2026].map((y) => comp(s.dret, YEARS.map((yy, i) => yy === y ? i : -1).filter((i) => i >= 0)));
  return { key: s.key, tf: s.tf, n: s.n, net1: a.net, g1, g10, g15, dd10: b.dd, dd15: c.dd, liq10: b.liq, liq15: c.liq, liq20: d.liq, minG15: c.minG, sh1, sh10, sh15, eff10, eff15, sets10, y10, top5: s.top5Gun };
});
const med = (arr) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
console.log('medyan g1/g10/g15', (med(rows.map(r=>r.g1))*100).toFixed(0)+'%', (med(rows.map(r=>r.g10))*100).toFixed(0)+'%', (med(rows.map(r=>r.g15))*100).toFixed(0)+'%');
console.log('medyan eff10/eff15', med(rows.map(r=>r.eff10)).toFixed(3), med(rows.map(r=>r.eff15)).toFixed(3));
console.log('medyan sh1/sh10/sh15', med(rows.map(r=>r.sh1)).toFixed(2), med(rows.map(r=>r.sh10)).toFixed(2), med(rows.map(r=>r.sh15)).toFixed(2));
console.log('medyan dd10/dd15', (med(rows.map(r=>r.dd10))*100).toFixed(0)+'%', (med(rows.map(r=>r.dd15))*100).toFixed(0)+'%');
console.log('--- eff15 en iyi 15 (liq yok, dd15 > -90%) ---');
rows.filter(r=>!r.liq15 && r.dd15 > -0.90).sort((a,b)=>b.eff15-a.eff15).slice(0,15).forEach(r=>{
  console.log(r.key.padEnd(30),'n',String(r.n).padStart(5),'g1',(r.g1*100).toFixed(0)+'%','g10',(r.g10*100).toFixed(0)+'%','g15',(r.g15*100).toFixed(0)+'%','eff15',r.eff15.toFixed(2),'sh15',r.sh15.toFixed(2),'dd10',(r.dd10*100).toFixed(0)+'%','dd15',(r.dd15*100).toFixed(0)+'%','minG15',r.minG15.toFixed(2),'sets+',r.sets10.filter(x=>x.net>0).length+'/6','top5',(r.top5*100).toFixed(0)+'%');
});
console.log('--- en düşük dd15 (liq yok) 15 ---');
rows.filter(r=>!r.liq15).sort((a,b)=>b.dd15-a.dd15).slice(0,15).forEach(r=>{
  console.log(r.key.padEnd(30),'dd10',(r.dd10*100).toFixed(0)+'%','dd15',(r.dd15*100).toFixed(0)+'%','g15',(r.g15*100).toFixed(0)+'%','eff15',r.eff15.toFixed(2),'minG15',r.minG15.toFixed(2),'n',r.n);
});
console.log('--- liq olmayan + dd15 > -80% + eff15 > 0.3 ---');
const cand = rows.filter(r=>!r.liq15 && r.dd15 > -0.80 && r.eff15 > 0.3 && r.g15 > 0).sort((a,b)=>b.eff15-a.eff15);
console.log('sayı', cand.length);
cand.slice(0,20).forEach(r=>console.log(r.key.padEnd(30),'g15',(r.g15*100).toFixed(0)+'%','eff15',r.eff15.toFixed(2),'sh15',r.sh15.toFixed(2),'dd15',(r.dd15*100).toFixed(0)+'%','minG15',r.minG15.toFixed(2),'sets+',r.sets10.filter(x=>x.net>0).length+'/6','n',r.n));
