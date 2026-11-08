// rundaily.mjs — GÜNLÜK eğri koşusu (homojenlik analizi için)
//   node tools/rundaily.mjs [--tfs=...] [--only=id1,id2] [--workers=N]
// Girdi: out/daily_spec.json (hücre başına baz + en iyi 3 varyant)
// Çıktı: out/daily/<id>.json (günlük portföy eğrileri) + out/daily_qa.json
import { Worker } from 'node:worker_threads';
import { writeFile, readFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { BP, TFS, BT_STRATEGIES, GRID } from './core.mjs';
import { listSymbolsAll } from './dataload.mjs';
import { finalizeDaily, mergeDailyAcc, newDailyAcc, DGRID, GD } from './dagg.mjs';

const argv = process.argv.slice(2);
const args = {};
for (const a of argv) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args[m[1]] = m[2] ?? true;
}
const tfs = args.tfs ? String(args.tfs).split(',') : TFS;
const WORKERS = Math.min(Number(args.workers || 11), 12);
const onlyIds = args.only ? String(args.only).split(',') : null;

const specDoc = JSON.parse(await readFile(join(BP, 'out', 'daily_spec.json'), 'utf8'));
const cells = specDoc.cells;
const symbols = (await listSymbolsAll()).sort();

// strateji listesi: spec'te olan ve BT_STRATEGIES'te bulunanlar
const idsInSpec = new Set(Object.keys(cells).map((k) => k.split(':')[0]));
const strategies = BT_STRATEGIES.filter((s) => idsInSpec.has(s.id) && (!onlyIds || onlyIds.includes(s.id)));

// işçiye gönderilecek specs: 'id:tf' → [ [keys], ... ]
const winSpec = {};
const stratsTf = new Map(); // id → Set(tf)
for (const [key, list] of Object.entries(cells)) {
  const [id, tf] = key.split(':');
  if (!tfs.includes(tf)) continue;
  if (!strategies.some((s) => s.id === id)) continue;
  winSpec[key] = list.map((v) => v.keys);
  if (!stratsTf.has(id)) stratsTf.set(id, new Set());
  stratsTf.get(id).add(tf);
}

// master akümülatörleri
const accs = {};
for (const spec of strategies) {
  accs[spec.id] = {};
  for (const tf of tfs) {
    const lst = cells[spec.id + ':' + tf];
    if (!lst) continue;
    const K = 1 + lst.length;
    const arr = [];
    for (let k = 0; k < K; k++) arr.push(newDailyAcc());
    accs[spec.id][tf] = arr;
  }
}

function chunkSymbols(list, w) {
  const n = list.length, size = Math.ceil(n / w), out = [];
  for (let i = 0; i < n; i += size) out.push(list.slice(i, i + size));
  return out;
}

const t0 = Date.now();
const chunks = chunkSymbols(symbols, WORKERS);
let offset = 0;
const jobs = chunks.map((chunk, wi) => {
  const off = offset; offset += chunk.length;
  return new Promise((res, rej) => {
    const w = new Worker(new URL('./dworker.mjs', import.meta.url), {
      workerData: { symbols: chunk, symbolOffset: off, tfs, specs: winSpec },
    });
    w.on('message', (m) => {
      if (m.type === 'progress') {
        if (wi === 0) {
          const s = (m.ms / 1000).toFixed(0);
          process.stdout.write(`\r[koşu] W0 ${m.symbol} (${s}s)      `);
        }
      } else if (m.type === 'result') {
        for (const spec of strategies) {
          const src = m.accs[spec.id];
          if (!src) continue;
          for (const tf of tfs) {
            const ss = src[tf];
            const dd = accs[spec.id][tf];
            if (!ss || !dd) continue;
            const K = Math.min(ss.length, dd.length);
            for (let k = 0; k < K; k++) mergeDailyAcc(dd[k], ss[k]);
          }
        }
        if (m.errors && m.errors.length) console.log(`\n[W${wi}] ${m.errors.length} hata (ör. ${JSON.stringify(m.errors[0])})`);
        res();
      }
    });
    w.on('error', rej);
    w.on('exit', (code) => { if (code !== 0) rej(new Error(`işçi ${wi} kod ${code} ile çıktı`)); });
  });
});
await Promise.all(jobs);
process.stdout.write('\r' + ' '.repeat(60) + '\r');
console.log(`[daily] koşu bitti (${((Date.now() - t0) / 1000).toFixed(0)}s), yazılıyor...`);

/* ------------------------------- yazım + QA -------------------------------- */
const r6 = (v) => (v == null ? null : Math.round(v * 1e6) / 1e6);

await mkdir(join(BP, 'out', 'daily'), { recursive: true });

// haftalık alt-küme denetimi için hazırlık
const weeklyIdx = []; // günlük dizindeki haftalık noktalar
for (let k = 0; k < GRID.length; k++) {
  const d = (GRID[k] - DGRID[0]) / 86400000;
  weeklyIdx.push(Number.isInteger(d) ? d : -1);
}
const baselineById = new Map();
for (const f of await readdir(join(BP, 'out', 'baseline'))) {
  if (!f.endsWith('.json')) continue;
  baselineById.set(f.replace(/\.json$/, ''), JSON.parse(await readFile(join(BP, 'out', 'baseline', f), 'utf8')));
}
// tekil/kombo depo (varyant n karşılaştırması)
const singlesById = new Map();
for (const f of await readdir(join(BP, 'out', 'singles'))) {
  const m = /^(.+)\.([AB])\.json$/.exec(f);
  if (!m) continue;
  if (!singlesById.has(m[1])) singlesById.set(m[1], {});
  singlesById.get(m[1])[m[2]] = JSON.parse(await readFile(join(BP, 'out', 'singles', f), 'utf8'));
}
const combosById = new Map();
for (const f of await readdir(join(BP, 'out', 'combos'))) {
  if (!f.endsWith('.json')) continue;
  combosById.set(f.replace(/\.json$/, ''), JSON.parse(await readFile(join(BP, 'out', 'combos', f), 'utf8')));
}

const qa = { weeklyChecked: 0, weeklyMaxDiff: 0, weeklyMismatch: 0, weeklyExamples: [], variantChecked: 0, variantNok: 0, variantMismatch: [], cellsWritten: 0, statesWritten: 0 };

for (const spec of strategies) {
  const doc = { id: spec.id, grid: { start: DGRID[0], step: 86400000, len: GD }, tf: {} };
  for (const tf of tfs) {
    const lst = cells[spec.id + ':' + tf];
    const accList = accs[spec.id][tf];
    if (!lst || !accList) continue;
    const base = finalizeDaily(accList[0]);
    const bdoc = baselineById.get(spec.id);
    // (a) haftalık alt-küme denetimi (baz durum)
    const weq = bdoc?.eq?.[tf];
    if (weq && base.curve) {
      for (let k = 0; k < weq.length; k++) {
        const d = weeklyIdx[k];
        if (d < 0) continue;
        const mine = base.curve[d];
        const ref = weq[k];
        if (mine == null || ref == null) { qa.weeklyMismatch++; if (qa.weeklyExamples.length < 5) qa.weeklyExamples.push({ id: spec.id, tf, k, mine, ref }); continue; }
        const diff = Math.abs(mine - ref);
        qa.weeklyChecked++;
        if (diff > qa.weeklyMaxDiff) qa.weeklyMaxDiff = diff;
        // referans eğri r4 yuvarlanmış → en büyük beklenti 5e-5
        if (diff > 6e-5) { qa.weeklyMismatch++; if (qa.weeklyExamples.length < 5) qa.weeklyExamples.push({ id: spec.id, tf, k, mine, ref, diff }); }
      }
    }
    // varyantlar
    const vars = [];
    for (let c = 0; c < lst.length; c++) {
      const meta = lst[c];
      const f = finalizeDaily(accList[c + 1]);
      const keep = meta.keep != null ? meta.keep : (base.n ? r6(f.n / base.n) : null);
      const rec = { keys: meta.keys, hdr: !!meta.hdr, acc: !!meta.acc, testN: meta.testN, specKeep: meta.keep, keep: r6(f.n / base.n), sum: f.sum, tr: f.tr, te: f.te, curve: f.curve.map(r6) };
      vars.push(rec);

      // (b) varyant işlem sayısı/metrik denetimi (depo ile)
      let stored = null;
      if (meta.keys.length === 1) {
        stored = singlesById.get(spec.id)?.A?.tf?.[tf]?.v?.[meta.keys[0]] || singlesById.get(spec.id)?.B?.tf?.[tf]?.v?.[meta.keys[0]] || null;
      } else {
        const cl = combosById.get(spec.id)?.tf?.[tf]?.combos || [];
        stored = cl.find((x) => x.keys.join('+') === meta.keys.join('+')) || null;
      }
      if (stored) {
        qa.variantChecked++;
        const sn = stored.sum.n, mn = f.sum?.n ?? 0;
        const savg = stored.sum.avg, mavg = f.sum?.avg;
        const sKeep = stored.keep ?? null;
        const okN = sn === mn;
        const okAvg = savg == null ? true : Math.abs(savg - mavg) < 6e-5;
        const okKeep = sKeep == null || Math.abs(sKeep - (rec.keep ?? 0)) < 6e-5;
        if (!okN || !okAvg || !okKeep) {
          qa.variantNok++;
          if (qa.variantMismatch.length < 20) qa.variantMismatch.push({ id: spec.id, tf, keys: meta.keys, sn, mn, savg, mavg, sKeep, mKeep: rec.keep, okN, okAvg, okKeep });
        }
      }
    }
    doc.tf[tf] = { base: { sum: base.sum, tr: base.tr, te: base.te, curve: base.curve.map(r6) }, variants: vars };
    qa.cellsWritten++;
    qa.statesWritten += 1 + vars.length;
  }
  await writeFile(join(BP, 'out', 'daily', spec.id + '.json'), JSON.stringify(doc));
}

qa.weeklyMaxDiff = Number(qa.weeklyMaxDiff.toExponential(3));
await writeFile(join(BP, 'out', 'daily_qa.json'), JSON.stringify(qa, null, 1));
console.log(`[daily] hücre: ${qa.cellsWritten}, durum: ${qa.statesWritten}`);
console.log(`[daily] haftalık denetim: ${qa.weeklyChecked} nokta, maks fark ${qa.weeklyMaxDiff}, uyuşmazlık ${qa.weeklyMismatch}`);
console.log(`[daily] varyant denetimi: ${qa.variantChecked} varyant, uyuşmazlık ${qa.variantNok}`);
