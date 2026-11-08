// _qa_rescue.mjs — bağımsız dürüstlük kontrolü:
// out/baseline + out/singles + out/combos ham verisinden "kurtarılan hücre" sayısını
// yeniden hesaplar ve rapor iddiasıyla karşılaştırır. RAPOR KODUNU KULLANMAZ.
// Kapılar (rapordaki gibi): kabul: testN>=30, testD>0, trainD>0, keep>=0.20
//                          başlık: testN>=100 (diğerleri aynı)
// Kurtarılan: base avg<0 && en iyi (skor) varyant kabul/başlık VE avg>0.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BP = 'D:/BigPlan';
const TFS = ['5m', '15m', '1h', '4h', '1d', '1w'];

async function loadJson(p, d = null) { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return d; } }

// baseline
const baseline = new Map();
for (const f of await readdir(join(BP, 'out', 'baseline'))) {
  if (!f.endsWith('.json')) continue;
  const j = await loadJson(join(BP, 'out', 'baseline', f));
  if (j) baseline.set(f.replace(/\.json$/, ''), j);
}

// singles
const singles = new Map(); // id -> {A,B}
for (const f of await readdir(join(BP, 'out', 'singles'))) {
  const m = /^(.+)\.([AB])\.json$/.exec(f);
  if (!m) continue;
  if (!singles.has(m[1])) singles.set(m[1], {});
  singles.get(m[1])[m[2]] = await loadJson(join(BP, 'out', 'singles', f));
}

// combos
const combos = new Map();
for (const f of await readdir(join(BP, 'out', 'combos'))) {
  if (!f.endsWith('.json')) continue;
  const j = await loadJson(join(BP, 'out', 'combos', f));
  if (j) combos.set(f.replace(/\.json$/, ''), j);
}

const r4 = (x) => Math.round(x * 1e4) / 1e4;
let total = 0, neg = 0;
const rescued = [], rescuedHd = [];
const byTf = {};
const checkKeys = [];

for (const id of baseline.keys()) {
  const bdoc = baseline.get(id);
  const A = singles.get(id)?.A, B = singles.get(id)?.B;
  for (const tf of TFS) {
    const baseSum = bdoc?.sum?.[tf];
    if (!baseSum || !baseSum.n) continue;
    total++;
    const baseSrc = A?.tf?.[tf]?.base || B?.tf?.[tf]?.base || null;
    const baseTr = baseSrc?.split?.train ?? null;
    const baseTe = baseSrc?.split?.test ?? null;
    const baseAvg = baseSum.avg;
    if (baseAvg < 0) neg++;
    if (!baseTr || !baseTe) continue;

    // adaylar
    const cands = [];
    for (const [src, doc] of [['A', A], ['B', B]]) {
      const v = doc?.tf?.[tf]?.v || {};
      for (const [k, f] of Object.entries(v)) if (f && f.sum) cands.push({ keys: [k], f, src });
    }
    const cl = combos.get(id)?.tf?.[tf]?.combos || [];
    for (const c of cl) if (c && c.sum) cands.push({ keys: c.keys, f: c });

    let best = null, bestScore = -1e18;
    for (const c of cands) {
      const tr = c.f.split?.train, te = c.f.split?.test;
      if (!tr || !te) continue;
      const keep = c.f.keep ?? (c.f.sum.n / baseSum.n);
      const trainD = tr.avg - baseTr.avg;
      const testD = te.avg - baseTe.avg;
      const hdr = te.n >= 100 && testD > 0 && trainD > 0 && keep >= 0.2;
      const acc = te.n >= 30 && testD > 0 && trainD > 0 && keep >= 0.2;
      const score = acc ? (trainD + 0.8 * testD) * Math.min(1, Math.sqrt(te.n / 100)) + (hdr ? 1e-6 : 0) : -1e9 + Math.max(-1, (c.f.sum.avg - baseAvg));
      if (score > bestScore) { bestScore = score; best = { ...c, hdr, acc, trainD, testD, keep }; }
    }
    if (!best || !best.acc) continue;
    if (baseAvg < 0 && best.f.sum.avg > 0) {
      const hdr = best.hdr;
      rescued.push({ id, tf, keys: best.keys, baseAvg, afterAvg: best.f.sum.avg, trainD: r4(best.trainD), testD: r4(best.testD), testN: best.f.split.test.n, keep: r4(best.keep), hdr });
      if (hdr) rescuedHd.push({ id, tf, keys: best.keys });
      byTf[tf] = (byTf[tf] || 0) + 1;
    }
  }
}

console.log(`hücre: ${total}, baz negatif: ${neg}`);
console.log(`KURTARILAN: ${rescued.length} (başlık: ${rescuedHd.length})`);
console.log('tf dağılımı:', JSON.stringify(byTf));
console.log('ilk 12 kurtarılan:');
for (const r of rescued.slice(0, 12)) {
  console.log(`  ${r.id.padEnd(12)} ${r.tf.padEnd(3)} [${r.keys.join('+')}] ${r.hdr ? '🏅' : '  '} önce ${(r.baseAvg * 100).toFixed(2)}% → sonra ${(r.afterAvg * 100).toFixed(2)}% | trainΔ ${(r.trainD * 100).toFixed(2)}% testΔ ${(r.testD * 100).toFixed(2)}% testN ${r.testN} koruma ${(r.keep * 100).toFixed(0)}%`);
}

// uçtan uca örnek: ilk 3 kurtarılan başlık hücresi için ham sayıları yazdır
console.log('\n--- ham veri doğrulaması (ilk 3 başlık hücresi) ---');
for (let i = 0; i < Math.min(3, rescuedHd.length); i++) {
  const r = rescuedHd[i];
  const A = singles.get(r.id)?.A, B = singles.get(r.id)?.B;
  let f = null, srcDesc = '';
  if (r.keys.length === 1) {
    f = A?.tf?.[r.tf]?.v?.[r.keys[0]] || B?.tf?.[r.tf]?.v?.[r.keys[0]];
    srcDesc = 'tek';
  } else {
    const list = combos.get(r.id)?.tf?.[r.tf]?.combos || [];
    f = list.find((c) => c.keys.join('+') === r.keys.join('+'));
    srcDesc = 'kombo';
  }
  const bsum = baseline.get(r.id)?.sum?.[r.tf];
  console.log(`  ${r.id} ${r.tf} (${srcDesc}) base avg=${(bsum.avg * 100).toFixed(3)}% → varyant avg=${(f.sum.avg * 100).toFixed(3)}% | train n=${f.split.train.n} avg=${(f.split.train.avg * 100).toFixed(3)}% | test n=${f.split.test.n} avg=${(f.split.test.avg * 100).toFixed(3)}% | koruma=${(f.keep * 100).toFixed(1)}%`);
}
