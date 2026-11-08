// audit_extra.mjs — indirilen yeni_coinler verisinin bütünlük denetimi
// plan (work_exp/download_plan.json) ile diskteki CSV'leri karşılaştırır.
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'D:/1mDataBinance/yeni_coinler';
const WORK = 'D:/BigPlan/work_exp';
const TFS = ['5m', '15m', '1h', '4h', '1d'];
const planDoc = JSON.parse(await readFile(join(WORK, 'download_plan.json'), 'utf8'));
const plan = planDoc.plan;

const key = (mm) => String(mm).slice(0, 4) + '-' + String(mm).slice(4).padStart(2, '0');

let symOk = 0, symPart = 0, symEmpty = 0;
const rows = [];
const missByTf = Object.fromEntries(TFS.map((t) => [t, 0]));
const tfZero = Object.fromEntries(TFS.map((t) => [t, 0]));

for (const p of plan) {
  let mTotal = 0, mMiss = 0;
  const miss = {};
  for (const tf of TFS) {
    let files = [];
    try { files = (await readdir(join(ROOT, tf, p.sym))).filter((f) => f.endsWith('.csv')); } catch {}
    const set = new Set(files);
    let missTf = 0;
    for (const mm of p.months) {
      if (!set.has(`${p.sym}-${tf}-${key(mm)}.csv`)) { missTf++; mMiss++; missByTf[tf]++; }
    }
    mTotal += p.months.length;
    if (missTf && files.length === 0) tfZero[tf]++;
    if (missTf) miss[tf] = missTf;
  }
  if (mMiss === 0) symOk++;
  else if (mMiss < mTotal) symPart++;
  else symEmpty++;
  if (mMiss) rows.push({ sym: p.sym, months: p.months.length, missing: mMiss, miss });
}

console.log(`[audit] sembol: ${plan.length} | tam: ${symOk} | kısmi: ${symPart} | boş: ${symEmpty}`);
console.log(`[audit] eksik dosya: ${Object.values(missByTf).reduce((a, b) => a + b, 0)} | tf bazında:`, missByTf);
console.log(`[audit] ilgili tf'de hiç dosyası olmayan sembol sayısı:`, tfZero);
if (rows.length) {
  console.log('[audit] kısmi semboller (ilk 40):');
  for (const r of rows.slice(0, 40)) console.log(`   ${r.sym}  ay:${r.months} eksik:${r.missing}  ${JSON.stringify(r.miss)}`);
}
const txt = JSON.stringify({ gen: new Date().toISOString(), symbols: plan.length, symOk, symPart, symEmpty, missByTf, tfZero, partial: rows }, null, 1);
await (await import('node:fs/promises')).writeFile(join(WORK, 'audit_extra.json'), txt);
console.log('[audit] yazıldı: work_exp/audit_extra.json');
