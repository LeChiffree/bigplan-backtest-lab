// Filtre Laboratuvarı — koşu orkestratörü
//   node tools/run2.mjs verify   [--tfs=...] [--only=id1,id2] [--workers=N]
//   node tools/run2.mjs singles  --group=A|B [--tfs=...] [--only=...]
//   node tools/run2.mjs combos   [--tfs=...] [--only=...]
import { Worker } from 'node:worker_threads';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { BP, TFS, listSymbols, BT_STRATEGIES, BT_CATEGORY_OF, finalizeIndicator } from './core.mjs';
import { listSymbolsAll } from './dataload.mjs';
import { toIAAcc, mergeCompactAcc, newCompactAcc, finalize2 } from './agg2.mjs';
import { FILTER_GROUPS, FILTERS, FILTER_CATS } from './filters.mjs';

const IA_ASSETS = 'C:/Users/GIGABAYT/indikator-akademi/assets/bt';

const argv = process.argv.slice(2);
const cmd = argv[0];
const args = {};
for (const a of argv.slice(1)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args[m[1]] = m[2] ?? true;
}

const tfs = args.tfs ? String(args.tfs).split(',') : TFS;
const WORKERS = Math.min(Number(args.workers || 11), 12);
const only = args.only ? String(args.only).split(',') : null;
const STRATEGIES = only ? BT_STRATEGIES.filter((s) => only.includes(s.id)) : BT_STRATEGIES;
// verify: eski 58 (assets ile birebir karşılaştırma) — diğer komutlar: tüm evren
const symbols = (cmd === 'verify' ? (await listSymbols()).sort() : (await listSymbolsAll()).sort());
await mkdir(join(BP, 'out'), { recursive: true });
await writeFile(join(BP, 'out', 'universe.json'), JSON.stringify({ gen: new Date().toISOString(), cmd, count: symbols.length, symbols }));

function chunkSymbols(list, w) {
  const n = list.length, size = Math.ceil(n / w), out = [];
  for (let i = 0; i < n; i += size) out.push(list.slice(i, i + size));
  return out;
}

function cellComboList(id, tf, combos) {
  if (!combos) return null;
  const c = combos[id + ':' + tf];
  return c && c.length ? c : null;
}

async function runPass({ mode, groupKeys = [], combos = null, strategies = STRATEGIES }) {
  const accs = {};
  for (const spec of strategies) {
    accs[spec.id] = {};
    for (const tf of tfs) {
      const nCombos = cellComboList(spec.id, tf, combos)?.length || 0;
      const K = mode === 'singles' ? 1 + groupKeys.length : 1 + nCombos;
      const arr = [];
      for (let k = 0; k < K; k++) arr.push(newCompactAcc(symbols.length));
      accs[spec.id][tf] = arr;
    }
  }

  const chunks = chunkSymbols(symbols, WORKERS);
  let offset = 0;
  const jobs = chunks.map((chunk, wi) => {
    const off = offset; offset += chunk.length;
    return new Promise((res, rej) => {
      const w = new Worker(new URL('./worker2.mjs', import.meta.url), {
        workerData: {
          symbols: chunk, symbolOffset: off, totalSymbols: symbols.length,
          tfs, mode, groupKeys, combos, only: strategies.map((s) => s.id),
        },
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
              if (!ss) continue;
              const dd = accs[spec.id][tf];
              const K = Math.min(ss.length, dd.length);
              for (let k = 0; k < K; k++) mergeCompactAcc(dd[k], ss[k]);
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
  return accs;
}

function metaOf(spec) {
  return {
    title: spec.title,
    dir: spec.dir,
    cat: BT_CATEGORY_OF?.[spec.id] || null,
    rules: spec.rules || [],
    stop: spec.stop || null,
  };
}

/* ----------------------------- derin karşılaştırma ------------------------- */

let worst = { d: 0, path: '' };
let ROUNDING = [];
function numDiff(a, b, path, diffs) {
  if (a == null && b == null) return;
  if (a == null || b == null) { diffs.push([path, a, b]); return; }
  if (Number.isInteger(a) && Number.isInteger(b)) {
    if (a !== b) diffs.push([path, a, b]);
    return;
  }
  const d = Math.abs(a - b);
  if (d > worst.d) worst = { d, path };
  if (d > 1.5e-3) {
    // Patolojik durum: portföy eğrisi ~sıfıra çöktüğünde yıllık oran aşırı
    // büyür; burada kalan fark yalnızca toplama sırası (1e-16) artığıdır.
    if (path.includes('.years.') && d / Math.max(Math.abs(a), Math.abs(b), 1) < 1e-6) {
      ROUNDING.push([path, a, b]);
      return;
    }
    diffs.push([path, a, b]);
  }
}
function cmpDeep(a, b, path, diffs) {
  if (a === null || b === null || typeof a === 'number' || typeof b === 'number') { numDiff(a, b, path, diffs); return; }
  if (typeof a !== 'object') { if (a !== b) diffs.push([path, a, b]); return; }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) { diffs.push([path, 'len', a?.length, b?.length]); return; }
    for (let i = 0; i < a.length; i++) cmpDeep(a[i], b[i], `${path}[${i}]`, diffs);
    return;
  }
  const ka = Object.keys(a), kb = Object.keys(b || {});
  if (ka.length !== kb.length) diffs.push([path, 'keys', ka.length, kb.length]);
  for (const k of ka) cmpDeep(a[k], b?.[k], `${path}.${k}`, diffs);
}

async function cmdVerify() {
  console.log(`[verify] ${STRATEGIES.length} strateji × ${tfs.length} tf × ${symbols.length} sembol, ${WORKERS} işçi`);
  const t0 = Date.now();
  const accs = await runPass({ mode: 'baseline' });
  console.log(`[verify] koşu bitti (${((Date.now() - t0) / 1000).toFixed(0)}s), JSON yazılıyor...`);

  await mkdir(join(BP, 'out', 'baseline'), { recursive: true });
  const report = { gen: new Date().toISOString(), cells: 0, ok: 0, fail: 0, failures: [], worst: null };
  for (const spec of STRATEGIES) {
    const accByTf = {};
    for (const tf of tfs) accByTf[tf] = toIAAcc(accs[spec.id][tf][0], symbols);
    const out = finalizeIndicator(spec.id, metaOf(spec), accByTf, symbols, tfs);
    await writeFile(join(BP, 'out', 'baseline', spec.id + '.json'), JSON.stringify(out));

    // referansla karşılaştır
    let ref;
    try { ref = JSON.parse(await readFile(join(IA_ASSETS, spec.id + '.json'), 'utf8')); }
    catch { continue; }
    for (const tf of tfs) {
      report.cells++;
      const diffs = [];
      ROUNDING = [];
      cmpDeep(ref.sum[tf], out.sum[tf], `${spec.id}.${tf}.sum`, diffs);
      cmpDeep(ref.years[tf], out.years[tf], `${spec.id}.${tf}.years`, diffs);
      cmpDeep(ref.heat[tf], out.heat[tf], `${spec.id}.${tf}.heat`, diffs);
      cmpDeep(ref.hist[tf], out.hist[tf], `${spec.id}.${tf}.hist`, diffs);
      cmpDeep(ref.eq[tf], out.eq[tf], `${spec.id}.${tf}.eq`, diffs);
      if (ROUNDING.length) {
        report.rounding = (report.rounding || 0) + ROUNDING.length;
        report.roundingSamples = report.roundingSamples || [];
        if (report.roundingSamples.length < 6) report.roundingSamples.push({ id: spec.id, tf, sample: ROUNDING.slice(0, 2) });
      }
      if (diffs.length) {
        report.fail++;
        if (report.failures.length < 40) report.failures.push({ id: spec.id, tf, n: diffs.length, sample: diffs.slice(0, 5) });
      } else report.ok++;
    }
  }
  report.worst = worst;
  await writeFile(join(BP, 'out', 'verify_report.json'), JSON.stringify(report, null, 2));
  console.log(`[verify] hücre: ${report.cells}, eşleşen: ${report.ok}, FARKLI: ${report.fail}`);
  console.log(`[verify] en büyük sapma: ${worst.d.toExponential(3)} @ ${worst.path}`);
  if (report.rounding) console.log(`[verify] yuvarlama sınırı kaydı (patolojik yıl oranı, göreli <1e-6): ${report.rounding}`);
  if (report.fail) {
    console.log('[verify] örnek farklar:');
    for (const f of report.failures.slice(0, 5)) console.log('  ', JSON.stringify(f));
  }
  console.log(report.fail === 0 ? '[verify] SONUÇ: BİREBİR ✔' : '[verify] SONUÇ: FARK VAR ✘');
  return report.fail === 0;
}

async function cmdBaseline() {
  console.log(`[baseline] ${STRATEGIES.length} strateji × ${tfs.length} tf × ${symbols.length} sembol, ${WORKERS} işçi`);
  const t0 = Date.now();
  const accs = await runPass({ mode: 'baseline' });
  console.log(`[baseline] koşu bitti (${((Date.now() - t0) / 1000).toFixed(0)}s), yazılıyor...`);
  await mkdir(join(BP, 'out', 'baseline'), { recursive: true });
  for (const spec of STRATEGIES) {
    const accByTf = {};
    for (const tf of tfs) accByTf[tf] = toIAAcc(accs[spec.id][tf][0], symbols);
    const out = finalizeIndicator(spec.id, metaOf(spec), accByTf, symbols, tfs);
    await writeFile(join(BP, 'out', 'baseline', spec.id + '.json'), JSON.stringify(out));
  }
  console.log(`[baseline] ${STRATEGIES.length} indikatör yazıldı.`);
}

async function cmdSingles() {
  const group = String(args.group || 'A').toUpperCase();
  const groupKeys = FILTER_GROUPS[group];
  if (!groupKeys) throw new Error('grup yok: ' + group + ' (A|B)');
  console.log(`[singles-${group}] ${groupKeys.length} filtre + baseline, ${tfs.length} tf, ${WORKERS} işçi`);
  const t0 = Date.now();
  const accs = await runPass({ mode: 'singles', groupKeys });
  console.log(`[singles-${group}] koşu bitti (${((Date.now() - t0) / 1000).toFixed(0)}s), yazılıyor...`);

  const filtMeta = FILTERS.filter((f) => groupKeys.includes(f.k)).map((f) => ({ k: f.k, cat: f.cat, catTitle: FILTER_CATS[f.cat] || f.cat, title: f.title, desc: f.desc }));
  await mkdir(join(BP, 'out', 'singles'), { recursive: true });
  for (const spec of STRATEGIES) {
    const doc = { id: spec.id, group, gen: new Date().toISOString().slice(0, 10), filters: filtMeta, tf: {} };
    for (const tf of tfs) {
      const arr = accs[spec.id][tf];
      const base = finalize2(arr[0], symbols);
      const v = {};
      for (let k = 0; k < groupKeys.length; k++) {
        const key = groupKeys[k];
        const f = finalize2(arr[k + 1], symbols);
        if (!f) { v[key] = null; continue; }
        f.keep = base && base.sum?.n ? Math.round((f.sum.n / base.sum.n) * 1e4) / 1e4 : 0;
        v[key] = f;
      }
      doc.tf[tf] = { base, v };
    }
    await writeFile(join(BP, 'out', 'singles', spec.id + '.' + group + '.json'), JSON.stringify(doc));
  }
  console.log(`[singles-${group}] ${STRATEGIES.length} indikatör yazıldı.`);
}

async function cmdCombos() {
  const selPath = join(BP, 'out', 'combos_selection.json');
  const sel = JSON.parse(await readFile(selPath, 'utf8'));
  // combos map: 'id:tf' → [ [keys], ... ] ; ayrıca cellsOnly listesi
  const combos = {};
  let cells = 0;
  for (const [id, tfsObj] of Object.entries(sel.cells || {})) {
    for (const [tf, list] of Object.entries(tfsObj)) {
      if (!list || !list.length) continue;
      if (!tfs.includes(tf)) continue;
      combos[id + ':' + tf] = list;
      cells++;
    }
  }
  const onlyIds = Object.keys(sel.cells || {});
  const strat = BT_STRATEGIES.filter((s) => onlyIds.includes(s.id));
  console.log(`[combos] ${cells} hücre, ${strat.length} indikatör`);
  const t0 = Date.now();
  const accs = await runPass({ mode: 'combos', combos, strategies: strat });

  await mkdir(join(BP, 'out', 'combos'), { recursive: true });
  for (const spec of strat) {
    const doc = { id: spec.id, gen: new Date().toISOString().slice(0, 10), tf: {} };
    for (const tf of tfs) {
      const list = cellComboList(spec.id, tf, combos);
      if (!list) continue;
      const arr = accs[spec.id][tf];
      const base = finalize2(arr[0], symbols);
      const outList = list.map((keys, i) => {
        const f = finalize2(arr[i + 1], symbols);
        if (!f) return { keys, null: true };
        f.keep = base && base.sum?.n ? Math.round((f.sum.n / base.sum.n) * 1e4) / 1e4 : 0;
        return { keys, ...f };
      });
      doc.tf[tf] = { base, combos: outList };
    }
    await writeFile(join(BP, 'out', 'combos', spec.id + '.json'), JSON.stringify(doc));
  }
  console.log(`[combos] ${strat.length} indikatör yazıldı.`);
}

// belirli strateji kimlikleriyle koşu (combos) — runPass(strategies) yeterli

/* --------------------------------- çalıştır -------------------------------- */
if (cmd === 'verify') {
  const ok = await cmdVerify();
  process.exit(ok ? 0 : 2);
} else if (cmd === 'baseline') {
  await cmdBaseline();
} else if (cmd === 'singles') {
  await cmdSingles();
} else if (cmd === 'combos') {
  await cmdCombos();
} else {
  console.log('kullanım: node tools/run2.mjs verify|baseline|singles|combos [--tfs=] [--only=] [--workers=] [--group=]');
  process.exit(1);
}
