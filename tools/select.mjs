// Filtre Laboratuvarı — kombinasyon seçici
// Politik akış:
//   1) Tek filtre sonuçlarından (singles) YALNIZ train döneminde seçim yap
//   2) Kabul kapıları: train Δ>0, test Δ>0, test n>=30, retention>=%20,
//      sembol tutarlılığı, min toplam n
//   3) Hücre başına en iyi 8 filtre (kategori başına max 2)
//   4) İkili kombinasyonlar (C(8,2)<=28); negatif öne çıkan hücrelere ayrıca
//      tohum çiftler + üçüncü filtre ile 3'lü kombinasyonlar (<=12)
// Çıktı: out/combos_selection.json  (run2 combos bu dosyayı okur)
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { BP, TFS } from './core.mjs';
import { FILTER_BY_KEY, FILTER_CATS } from './filters.mjs';

const OUT = join(BP, 'out');
const S = join(OUT, 'singles');

const POLICY = {
  selectionPeriod: 'train (2022-08-01 → 2024-12-31)',
  acceptance: {
    trainDeltaAvg: '> 0',
    testDeltaAvg: '> 0',
    testNMin: 30,
    headlineTestN: 100,
    retentionMin: 0.2,
    symbolPosMin: 0.35,
    minTrades: 100,
  },
  topFilters: 8,
  maxPerCategory: 2,
  negativeStandout: 'base train avg<0 veya base avg<0 & n>=500',
  maxCombosPerCell: 40,
};

async function loadJson(p) { return JSON.parse(await readFile(p, 'utf8')); }

async function main() {
  const files = await readdir(S);
  const ids = new Set();
  const byId = new Map();
  for (const f of files) {
    const m = /^(.+)\.([AB])\.json$/.exec(f);
    if (!m) continue;
    ids.add(m[1]);
    if (!byId.has(m[1])) byId.set(m[1], {});
    byId.get(m[1])[m[2]] = JSON.parse(await readFile(join(S, f), 'utf8'));
  }
  console.log(`[select] ${ids.size} indikatör, ${files.length} singles dosyası`);

  const cells = {};
  const meta = {};
  const filtAgg = new Map(); // key → {eval, pass, sumTrainD, sumTestD, posWins}
  let cellCount = 0, passCells = 0;

  for (const id of ids) {
    const docs = byId.get(id);
    const tfA = docs.A?.tf || {};
    const tfB = docs.B?.tf || {};
    const cellsId = {};
    for (const tf of TFS) {
      const base = tfA[tf]?.base || tfB[tf]?.base;
      if (!base || !base.sum || !base.sum.n) continue;
      const btr = base.split?.train, bte = base.split?.test;
      if (!btr || !bte) continue;

      // adayları topla
      const cands = [];
      for (const src of ['A', 'B']) {
        const v = (src === 'A' ? tfA : tfB)[tf]?.v;
        if (!v) continue;
        for (const [k, f] of Object.entries(v)) {
          if (!f || !f.sum || !f.sum.n) continue;
          const tr = f.split?.train, te = f.split?.test;
          if (!tr || !te) continue;
          const trainD = tr.avg - btr.avg;
          const testD = te.avg - bte.avg;
          const keep = f.sum.n / base.sum.n;
          const testN = te.n;
          let sTot = 0, sPos = 0;
          const h = f.heat;
          if (h && Array.isArray(h.syms)) {
            for (let i = 0; i < h.syms.length; i++) { if (h.n[i] >= 5) { sTot++; if (h.avg[i] > 0) sPos++; } }
          } else if (h && h.avg) {
            for (const sName of Object.keys(h.avg)) {
              const n = h.n[sName];
              if (n >= 5) { sTot++; if (h.avg[sName] > 0) sPos++; }
            }
          }
          const symPos = sTot ? sPos / sTot : 0;
          const pass = trainD > 0 && testD > 0 && testN >= POLICY.acceptance.testNMin
            && keep >= POLICY.acceptance.retentionMin && symPos >= POLICY.acceptance.symbolPosMin
            && f.sum.n >= POLICY.acceptance.minTrades;
          const score = (trainD + 0.8 * testD) * Math.min(1, Math.sqrt(testN / 100));
          const cat = FILTER_BY_KEY[k]?.cat || '?';
          cands.push({ k, cat, score: Math.round(score * 1e4) / 1e4, trainD: Math.round(trainD * 1e4) / 1e4, testD: Math.round(testD * 1e4) / 1e4, testN, keep: Math.round(keep * 1e4) / 1e4, symPos: Math.round(symPos * 1e3) / 1e3, n: f.sum.n, pass });
          const a = filtAgg.get(k) || { eval: 0, pass: 0, sumTrainD: 0, sumTestD: 0, passTrainD: 0, passTestD: 0 };
          a.eval++;
          a.sumTrainD += Math.max(0, trainD); a.sumTestD += Math.max(0, testD);
          if (pass) { a.pass++; a.passTrainD += trainD; a.passTestD += testD; }
          filtAgg.set(k, a);
        }
      }
      if (!cands.length) continue;
      cellCount++;

      // seçim: pass olanlardan skor sırasıyla, kategori başına max 2
      const passing = cands.filter((c) => c.pass).sort((a, b) => b.score - a.score);
      const catCnt = new Map();
      const selected = [];
      for (const c of passing) {
        const cc = catCnt.get(c.cat) || 0;
        if (cc >= POLICY.maxPerCategory) continue;
        catCnt.set(c.cat, cc + 1);
        selected.push(c);
        if (selected.length >= POLICY.topFilters) break;
      }
      if (selected.length < 2) continue;
      passCells++;

      // kombinasyonlar
      const combos = [];
      const keys = selected.map((c) => c.k);
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) combos.push([keys[i], keys[j]]);
      }

      // negatif öne çıkan hücreler: üçlüler
      const negStand = (btr.avg < 0) || (base.sum.avg < 0 && base.sum.n >= 500);
      let triples = 0;
      if (negStand && selected.length >= 3) {
        const seedPairs = [[0, 1], [0, 2]];
        const seen = new Set(combos.map((c) => c.join('+')));
        for (const [a, b] of seedPairs) {
          for (let x = 0; x < selected.length; x++) {
            if (x === a || x === b) continue;
            const triple = [keys[a], keys[b], keys[x]];
            // kategori kuralı: üçlüde max 2 aynı kategori
            const cc = new Map();
            let ok = true;
            for (const kk of triple) {
              const cat = FILTER_BY_KEY[kk]?.cat || '?';
              const v = (cc.get(cat) || 0) + 1;
              cc.set(cat, v);
              if (v > 2) { ok = false; break; }
            }
            if (!ok) continue;
            const sig = triple.join('+');
            if (seen.has(sig)) continue;
            seen.add(sig);
            combos.push(triple);
            triples++;
            if (combos.length >= POLICY.maxCombosPerCell) break;
          }
          if (combos.length >= POLICY.maxCombosPerCell) break;
        }
      }

      cellsId[tf] = combos;
      meta[id + ':' + tf] = {
        base: {
          n: base.sum.n, avg: base.sum.avg, wr: base.sum.wr,
          trainAvg: btr.avg, trainN: btr.n, testAvg: bte.avg, testN: bte.n,
        },
        negative: negStand,
        selected: selected.map((c) => ({ k: c.k, cat: c.cat, score: c.score, trainD: c.trainD, testD: c.testD, testN: c.testN, keep: c.keep })),
        pairs: combos.length - triples,
        triples,
      };
    }
    if (Object.keys(cellsId).length) cells[id] = cellsId;
  }

  const doc = {
    gen: new Date().toISOString().slice(0, 10),
    policy: POLICY,
    cells,
    meta,
  };
  await writeFile(join(OUT, 'combos_selection.json'), JSON.stringify(doc));
  const totalCombos = Object.values(cells).reduce((s, t) => s + Object.values(t).reduce((x, l) => x + l.length, 0), 0);
  console.log(`[select] hücre: ${cellCount}, aday geçen hücre: ${passCells}, yazılan hücre: ${Object.values(cells).reduce((s, t) => s + Object.keys(t).length, 0)}, kombinasyon: ${totalCombos}`);

  // filtre ligi özeti
  const lig = [...filtAgg.entries()].map(([k, a]) => ({
    k, cat: FILTER_BY_KEY[k]?.cat,
    pass: a.pass, eval: a.eval,
    ortalamaPassTrainD: a.pass ? Math.round((a.passTrainD / a.pass) * 1e4) / 1e4 : 0,
    ortalamaPassTestD: a.pass ? Math.round((a.passTestD / a.pass) * 1e4) / 1e4 : 0,
  })).sort((x, y) => y.pass - x.pass || y.ortalamaPassTrainD - x.ortalamaPassTrainD);
  console.log('[select] ilk 15 filtre (pass hücre sayısı):');
  for (const l of lig.slice(0, 15)) console.log(`   ${String(l.pass).padStart(4)}  ${l.k.padEnd(16)} ${FILTER_CATS[l.cat] || l.cat}  trainΔ+${l.ortalamaPassTrainD} testΔ+${l.ortalamaPassTestD}`);
  await writeFile(join(OUT, 'filter_league.json'), JSON.stringify(lig, null, 1));
}

await main();
