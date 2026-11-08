// fetch_extra.mjs — 58 dışı coinlerin Binance Vision aylık verilerini indirir.
//   Klines:  <tf> ∈ {5m,15m,1h,4h,1d} → D:\1mDataBinance\yeni_coinler\<tf>\<SYM>\<SYM>-<tf>-YYYY-MM.csv
//   Funding: D:\1mDataBinance\yeni_coinler\funding\<SYM>.csv  (symbol,funding_time,funding_rate,...)
// Zip'ler bellek içinde açılır (EOCD/CD parse + inflateRaw), diske sadece CSV yazılır.
// Yeniden başlatılabilir: var olan CSV atlanır. 404 (listelenmemiş ay) sayılır.
import { readFile, writeFile, mkdir, appendFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import zlib from 'node:zlib';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args[m[1]] = m[2] ?? true;
}
const ROOT = 'D:/1mDataBinance/yeni_coinler';
const WORK = 'D:/BigPlan/work_exp';
const CONC = Number(args.workers || 24);
const PHASE = args.phase || 'all';
const TEST = args.test || null;
const LIMIT = args.limit ? Number(args.limit) : 0;

/* --------------------------------- zip açma -------------------------------- */
export function unzipSingle(buf) {
  let eocd = -1;
  const lo = Math.max(0, buf.length - 22 - 65536);
  for (let i = buf.length - 22; i >= lo; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('EOCD yok');
  const cdCount = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let k = 0; k < cdCount; k++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('CD imzası yok');
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    if (buf.readUInt32LE(lho) !== 0x04034b50) throw new Error('LH imzası yok');
    const lNameLen = buf.readUInt16LE(lho + 26);
    const lExtraLen = buf.readUInt16LE(lho + 28);
    const dataStart = lho + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    const content = method === 0 ? data : zlib.inflateRawSync(data);
    out.push({ name, content: content.toString('utf8') });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/* ------------------------------- indirme yardımı ---------------------------- */
const sleep = (ms) => new Promise((t) => setTimeout(t, ms));
let bytesTotal = 0;
let downloaded = 0, skipped = 0, missing = 0, errs = 0;
const errorList = [];

async function downloadZip(url) {
  for (let a = 0; a < 3; a++) {
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 45000);
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: ac.signal });
      clearTimeout(to);
      if (r.status === 404) return { missing: true };
      if (!r.ok) { await sleep(800 + a * 1500); continue; }
      const ab = Buffer.from(await r.arrayBuffer());
      bytesTotal += ab.length;
      return { buf: ab };
    } catch { await sleep(800 + a * 1500); }
  }
  return { err: 'indirilemedi' };
}

/* --------------------------------- plan yükle ------------------------------- */
const planDoc = JSON.parse(await readFile(join(WORK, 'download_plan.json'), 'utf8'));
let plan = planDoc.plan;
if (TEST) plan = plan.filter((p) => p.sym === TEST);
const TFS_KL = ['5m', '15m', '1h', '4h', '1d'];

const t0 = Date.now();
const log = (s) => { console.log(s); appendFile(join(WORK, 'fetch_log.txt'), s + '\n').catch(() => {}); };

/* ================================= FAZ 1: klines ============================ */
if (PHASE === 'all' || PHASE === 'klines') {
  const tasks = [];
  for (const p of plan) {
    for (const tf of TFS_KL) {
      for (const mm of p.months) {
        const ms = String(mm).slice(4);
        const key = String(mm).slice(0, 4) + '-' + ms;
        const csv = join(ROOT, tf, p.sym, `${p.sym}-${tf}-${key}.csv`);
        if (existsSync(csv)) { skipped++; continue; }
        tasks.push({ sym: p.sym, tf, key, csv, url: `https://data.binance.vision/data/futures/um/monthly/klines/${p.sym}/${tf}/${p.sym}-${tf}-${key}.zip` });
      }
    }
  }
  console.log(`[fetch] klines görev: ${tasks.length} (mevcut atlanan: ${skipped})`);
  if (LIMIT && tasks.length > LIMIT) tasks.length = LIMIT;
  let done = 0;
  const total = tasks.length;
  let run = true;
  const worker = async () => {
    while (run) {
      const i = tasks.idx = (tasks.idx || 0);
      tasks.idx = i + 1;
      if (i >= tasks.length) return;
      const t = tasks[i];
      const res = await downloadZip(t.url);
      if (res.missing) missing++;
      else if (res.err) { errs++; if (errorList.length < 500) errorList.push({ sym: t.sym, tf: t.tf, month: t.key, err: res.err }); }
      else {
        try {
          const files = unzipSingle(res.buf);
          const f = files.find((x) => x.name.endsWith('.csv')) || files[0];
          if (!f || !f.content) throw new Error('zip içinde csv yok');
          await mkdir(join(ROOT, t.tf, t.sym), { recursive: true });
          await writeFile(t.csv + '.tmp', f.content);
          await rename(t.csv + '.tmp', t.csv);
          downloaded++;
        } catch (e) { errs++; if (errorList.length < 500) errorList.push({ sym: t.sym, tf: t.tf, month: t.key, err: e.message }); }
      }
      done++;
      if (done % 400 === 0) {
        const el = (Date.now() - t0) / 1000;
        const rate = done / el;
        log(`[fetch] ${done}/${total} | ${rate.toFixed(1)}/s | indirilen ${downloaded} | 404 ${missing} | hata ${errs} | ${(bytesTotal / 1048576).toFixed(0)} MB | kalan ~${((total - done) / rate / 60).toFixed(1)} dk`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONC }, worker));
  run = false;
  console.log(`[fetch] klines bitti: indirilen ${downloaded}, 404 ${missing}, hata ${errs}, ${(bytesTotal / 1073741824).toFixed(2)} GB, ${((Date.now() - t0) / 60000).toFixed(1)} dk`);
}

/* ================================ FAZ 2: funding ============================ */
if (PHASE === 'all' || PHASE === 'funding') {
  const ft = [];
  for (const p of plan) {
    const out = join(ROOT, 'funding', p.sym + '.csv');
    if (existsSync(out)) { skipped++; continue; }
    ft.push({ sym: p.sym, months: p.months, out });
  }
  console.log(`[fetch] funding görev (sembol): ${ft.length}`);
  let done = 0;
  const worker = async () => {
    while (true) {
      const i = ft.idx = ft.idx || 0;
      ft.idx = i + 1;
      if (i >= ft.length) return;
      const t = ft[i];
      const rows = [];
      let miss = 0, err = 0;
      for (const mm of t.months) {
        const key = String(mm).slice(0, 4) + '-' + String(mm).slice(4);
        const url = `https://data.binance.vision/data/futures/um/monthly/fundingRate/${t.sym}/${t.sym}-fundingRate-${key}.zip`;
        const res = await downloadZip(url);
        if (res.missing) { miss++; continue; }
        if (res.err) { err++; continue; }
        try {
          const files = unzipSingle(res.buf);
          const f = files.find((x) => x.name.endsWith('.csv')) || files[0];
          for (const ln of f.content.split('\n')) {
            if (!ln) continue;
            const p = ln.split(',');
            const tm = +p[0], rt = +p[2];
            if (!Number.isFinite(tm) || !Number.isFinite(rt)) continue;
            rows.push(`${t.sym},${tm},${rt}`);
          }
        } catch { err++; }
      }
      if (rows.length) {
        rows.sort((a, b) => +a.split(',')[1] - +b.split(',')[1]);
        await mkdir(join(ROOT, 'funding'), { recursive: true });
        await writeFile(t.out + '.tmp', 'symbol,funding_time,funding_rate\n' + rows.join('\n') + '\n');
        await rename(t.out + '.tmp', t.out);
        downloaded++;
      } else {
        if (miss) missing++;
        if (err) errs++;
      }
      done++;
      if (done % 25 === 0) log(`[fetch] funding ${done}/${ft.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, 16) }, worker));
  console.log(`[fetch] funding bitti: yazılan ${downloaded}, 404 ${missing}, hata ${errs}`);
}

await writeFile(join(WORK, 'fetch_summary.json'), JSON.stringify({
  gen: new Date().toISOString(), phase: PHASE, test: TEST,
  downloaded, skipped, missing404: missing, errs,
  gb: +(bytesTotal / 1073741824).toFixed(2),
  minutes: +((Date.now() - t0) / 60000).toFixed(1),
  errorsSample: errorList.slice(0, 200),
}, null, 1));
log(`[fetch] özet: indirilen ${downloaded}, atlanan ${skipped}, 404 ${missing}, hata ${errs}, ${(bytesTotal / 1073741824).toFixed(2)} GB, ${((Date.now() - t0) / 60000).toFixed(1)} dk`);
