// _qa_expand.mjs — genişletilmiş evren koşusu için çapraz tutarlılık denetimi
//   1) A ve B singles baz durumlarının birebir aynı olması
//   2) singles baz havuz n = kompakt heat n toplamı
//   3) baseline (io/agg) baz özeti = singles baz özeti
//   4) yeni sembollerin heat tablolarında görünmesi
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const BP = 'D:/BigPlan';
const OUT = join(BP, 'out');
const TFS = ['5m', '15m', '1h', '4h', '1d', '1w'];

const uni = JSON.parse(await readFile(join(OUT, 'universe.json'), 'utf8'));
console.log(`[qa] evren: ${uni.count} sembol (cmd=${uni.cmd})`);

const R = (v) => (v == null ? null : Math.round(v * 1e6) / 1e6);
let fails = 0;
const fail = (m) => { fails++; console.log('  ✘ ' + m); };

const files = (await readdir(join(OUT, 'singles'))).filter((f) => /\.(A|B)\.json$/.test(f));
console.log(`[qa] singles dosyası: ${files.length}`);
const byId = new Map();
for (const f of files) {
  const id = f.replace(/\.(A|B)\.json$/, '');
  const g = f.split('.').slice(-2)[0];
  if (!byId.has(id)) byId.set(id, {});
  byId.get(id)[g] = JSON.parse(await readFile(join(OUT, 'singles', f), 'utf8'));
}

let cellsChecked = 0, heatChecked = 0;
const sampleIds = [...byId.keys()].filter((_, i) => i % 7 === 0); // ~15 indikatör örneklem
for (const id of sampleIds) {
  const docs = byId.get(id);
  for (const tf of TFS) {
    const A = docs.A?.tf?.[tf]?.base, B = docs.B?.tf?.[tf]?.base;
    if (!A && !B) continue;
    cellsChecked++;
    if (!A || !B) { fail(`${id} ${tf}: A/B bazdan biri yok`); continue; }
    if (A.sum.n !== B.sum.n || R(A.sum.avg) !== R(B.sum.avg) || R(A.sum.tot) !== R(B.sum.tot)) {
      fail(`${id} ${tf}: A≠B baz (n ${A.sum.n}/${B.sum.n}, avg ${A.sum.avg}/${B.sum.avg})`);
    }
    const h = A.heat;
    if (h && Array.isArray(h.syms)) {
      heatChecked++;
      let sn = 0;
      for (let i = 0; i < h.n.length; i++) sn += h.n[i];
      if (sn !== A.sum.n) fail(`${id} ${tf}: heat n toplamı ${sn} ≠ havuz n ${A.sum.n}`);
    } else fail(`${id} ${tf}: heat kompakt değil`);
  }
}
console.log(`[qa] örneklenen hücre: ${cellsChecked}, heat kontrol: ${heatChecked}`);

const probes = ['TRXUSDT', 'ETCUSDT', 'XTZUSDT', 'ATOMUSDT'];
let newSymSeen = 0;
for (const id of sampleIds) {
  const docs = byId.get(id);
  for (const tf of TFS) {
    const h = docs.A?.tf?.[tf]?.base?.heat;
    if (!h || !Array.isArray(h.syms)) continue;
    for (const p of probes) if (h.syms.includes(p)) newSymSeen++;
  }
}
console.log(`[qa] yeni sembol (${probes.join(',')}) heat gözlemi: ${newSymSeen}`);
if (!newSymSeen) fail('yeni semboller heat tablolarında görünmüyor');

let baseChecked = 0;
for (const id of sampleIds) {
  let doc;
  try { doc = JSON.parse(await readFile(join(OUT, 'baseline', id + '.json'), 'utf8')); } catch { continue; }
  const docs = byId.get(id);
  for (const tf of TFS) {
    const bb = doc.sum?.[tf], sb = docs.A?.tf?.[tf]?.base?.sum;
    if (!bb || !sb) continue;
    baseChecked++;
    if (bb.n !== sb.n || R(bb.avg) !== R(sb.avg) || R(bb.tot) !== R(sb.tot)) {
      fail(`${id} ${tf}: baseline≠singles (n ${bb.n}/${sb.n}, avg ${bb.avg}/${sb.avg}, tot ${bb.tot}/${sb.tot})`);
    }
  }
}
console.log(`[qa] baseline karşılaştırması: ${baseChecked} hücre`);

console.log(fails === 0 ? '[qa] SONUÇ: TUTARLI ✔' : `[qa] SONUÇ: ${fails} SORUN ✘`);
process.exit(fails ? 2 : 0);
