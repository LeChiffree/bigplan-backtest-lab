// _qa_homogen.mjs — homogen.mjs metriklerini BAĞIMSIZ yeniden hesapla ve karşılaştır.
// Farklı kod yolu: önce aylık/günlük serileri kur, sonra metrikleri türet.
import { readFile } from 'node:fs/promises';

const pick = process.argv.slice(2, 5); // örn: stochrsi 1d varyant1
const [id, tf, kind] = pick;
const doc = JSON.parse(await readFile(`D:/BigPlan/out/daily/${id}.json`, 'utf8'));
const cell = doc.tf[tf];
let curve, label;
if (kind === 'temel') { curve = cell.base.curve; label = 'temel'; }
else {
  const i = kind === 'varyant1' ? 0 : 1;
  curve = cell.variants[i].curve; label = cell.variants[i].keys.join('+');
}
const { start, step } = doc.grid;

// aktif aralık
let i0 = curve.findIndex((v) => v != null);
let i1 = curve.length - 1; while (curve[i1] == null) i1--;
const act = curve.slice(i0, i1 + 1);
const net = act[act.length - 1] / act[0] - 1;

// günlük getiriler
const rs = [];
for (let i = 1; i < act.length; i++) rs.push(act[i] / act[i - 1] - 1);
const daySum = rs.reduce((a, b) => a + b, 0);
const sorted = [...rs].sort((a, b) => b - a);
const k5 = Math.ceil(rs.length * 0.05), k1 = Math.ceil(rs.length * 0.01);
const top5 = sorted.slice(0, k5).reduce((a, b) => a + b, 0);
const top1 = sorted.slice(0, k1).reduce((a, b) => a + b, 0);

// aylık: her ayın SON değeri (bağımsız yol: grupla, sonu al)
const byM = new Map();
act.forEach((v, i) => {
  const ts = start + (i0 + i) * step;
  const d = new Date(ts), mk = d.getUTCFullYear() * 12 + d.getUTCMonth();
  byM.set(mk, v);
});
const mks = [...byM.keys()].sort((a, b) => a - b);
const mrs = []; let prev = act[0];
for (const mk of mks) { const v = byM.get(mk); mrs.push(v / prev - 1); prev = v; }
const mSum = mrs.reduce((a, b) => a + b, 0);
const posM = mrs.filter((r) => r > 0).length;
const top1M = Math.max(0, Math.max(...mrs)) / mSum;

// lineer R2 (kümülatif kâr ~ t)
let cum = 0; const cs = []; for (const r of rs) { cum += r; cs.push(cum); }
const N = cs.length;
const meanX = (N - 1) / 2, meanY = cs.reduce((a, b) => a + b, 0) / N;
let sxy = 0, sxx = 0, syy = 0;
for (let t = 0; t < N; t++) { sxy += (t - meanX) * (cs[t] - meanY); sxx += (t - meanX) ** 2; syy += (cs[t] - meanY) ** 2; }
const r2 = (sxy * sxy) / (sxx * syy);

// yıllar
const byY = new Map();
act.forEach((v, i) => { const y = new Date(start + (i0 + i) * step).getUTCFullYear(); byY.set(y, v); });
const ys = [...byY.keys()].sort((a, b) => a - b);
const yr = {}; let pv = act[0];
for (const y of ys) { yr[y] = byY.get(y) / pv - 1; pv = byY.get(y); }

console.log(`=== ${id} ${tf} ${kind} [${label}] ===`);
console.log(`net=${(net * 100).toFixed(2)}% | gün=${rs.length} | pozAy=${((posM / mrs.length) * 100).toFixed(1)}% | top1ay=${(top1M * 100).toFixed(1)}% | top5gün=${((top5 / daySum) * 100).toFixed(1)}% | R2=${r2.toFixed(3)}`);
console.log(`yıllar: ${JSON.stringify(Object.fromEntries(Object.entries(yr).map(([k, v]) => [k, +(v * 100).toFixed(1)])))}`);

// homogen json kaydı ile kıyas
const J = JSON.parse(await readFile('D:/BigPlan/out/homojenlik.json', 'utf8'));
const rec = J.rows.find((r) => r.id === id && r.tf === tf && r.kind === kind);
if (!rec) { console.log('JSON kaydı yok!'); process.exit(1); }
console.log(`kayıt: net=${(rec.net * 100).toFixed(2)}% | pozAy=${(rec.pozAy * 100).toFixed(1)}% | top1ay=${(rec.top1Ay * 100).toFixed(1)}% | top5gün=${(rec.top5Gun * 100).toFixed(1)}% | R2=${rec.r2.toFixed(3)}`);
const near = (a, b) => Math.abs(a - b) < 5e-4;
const checks = {
  net: near(net, rec.net), top5: near(top5 / daySum, rec.top5Gun),
  posAy: Math.abs(posM / mrs.length - rec.pozAy) < 2e-3, r2: Math.abs(r2 - rec.r2) < 2e-3,
};
console.log('uyum:', JSON.stringify(checks), Object.values(checks).every(Boolean) ? '✔' : '✘');
