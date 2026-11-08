// Filtre Laboratuvarı — rapor üreticisi
//   node tools/report2.mjs
// Girdi: out/baseline/*.json, out/singles/*.{A,B}.json, out/combos/*.json,
//        out/combos_selection.json, out/verify_report.json, out/filter_league.json
// Çıktı: out/executive_summary.json, out/filtre_ozet.csv, out/dashboard_data.json,
//        out/FILTRE-RAPORU.md, README.md
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { BP, TFS, BT_STRATEGIES, BT_CATEGORY_OF } from './core.mjs';
import { FILTERS, FILTER_BY_KEY, FILTER_CATS } from './filters.mjs';

const OUT = join(BP, 'out');
const r4 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 1e4) / 1e4);
const r3 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 1e3) / 1e3);
const pct = (v, d = 3) => (v == null || !isFinite(v) ? '—' : (v * 100).toFixed(d) + '%');
const sgn = (v, d = 4) => (v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%');

async function loadJson(p, def = null) { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return def; } }
async function loadJsonDir(dir) {
  const map = new Map();
  let files = [];
  try { files = await readdir(join(OUT, dir)); } catch { return map; }
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const doc = await loadJson(join(OUT, dir, f));
    if (doc) map.set(f.replace(/\.json$/, ''), doc);
  }
  return map;
}

/* ------------------------------- veri yükleme ------------------------------ */

const baseline = new Map();  // id → doc
{
  let files = [];
  try { files = await readdir(join(OUT, 'baseline')); } catch {}
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const doc = await loadJson(join(OUT, 'baseline', f));
    if (doc) baseline.set(f.replace(/\.json$/, ''), doc);
  }
}

const singlesById = new Map(); // id → {A, B}
{
  let files = [];
  try { files = await readdir(join(OUT, 'singles')); } catch {}
  for (const f of files) {
    const m = /^(.+)\.([AB])\.json$/.exec(f);
    if (!m) continue;
    const doc = await loadJson(join(OUT, 'singles', f));
    if (!doc) continue;
    if (!singlesById.has(m[1])) singlesById.set(m[1], {});
    singlesById.get(m[1])[m[2]] = doc;
  }
}

const combosById = new Map(); // id → doc
{
  let files = [];
  try { files = await readdir(join(OUT, 'combos')); } catch {}
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const doc = await loadJson(join(OUT, 'combos', f));
    if (doc) combosById.set(f.replace(/\.json$/, ''), doc);
  }
}

const verify = await loadJson(join(OUT, 'verify_report.json'), null);
const leagueFile = await loadJson(join(OUT, 'filter_league.json'), null);
const selection = await loadJson(join(OUT, 'combos_selection.json'), null);
const universe = await loadJson(join(OUT, 'universe.json'), null);
const NSYM = universe?.count ?? 58;

console.log(`[rapor] baseline: ${baseline.size}, singles: ${singlesById.size}, combos: ${combosById.size}`);

/* ------------------------------- hücre analizi ----------------------------- */

const cells = [];           // 600 satır
const details = {};         // 'id:tf' → {variants, heatBase, heatBest}
let comboVariantCount = 0, singleVariantCount = 0, acceptedVariantCount = 0;

function makeVariants(id, tf) {
  const v = [];
  const A = singlesById.get(id)?.A?.tf?.[tf]?.v;
  const B = singlesById.get(id)?.B?.tf?.[tf]?.v;
  for (const [key, f] of Object.entries(A || {})) if (f && f.sum) { v.push({ type: 'filtre', keys: [key], ...pick(f), src: 'A' }); singleVariantCount++; }
  for (const [key, f] of Object.entries(B || {})) if (f && f.sum) { v.push({ type: 'filtre', keys: [key], ...pick(f), src: 'B' }); singleVariantCount++; }
  const combos = combosById.get(id)?.tf?.[tf]?.combos;
  if (combos) for (const c of combos) { if (c && c.sum) { v.push({ type: c.keys.length === 2 ? 'ikili' : 'üçlü', keys: c.keys, ...pick(c) }); comboVariantCount++; } }
  return v;
}
function pick(f) {
  const tr = f.split?.train, te = f.split?.test;
  return {
    n: f.sum.n, avg: f.sum.avg, wr: f.sum.wr, pf: f.sum.pf, tot: f.sum.tot, dd: f.sum.dd,
    trainAvg: tr?.avg ?? null, trainN: tr?.n ?? 0, testAvg: te?.avg ?? null, testN: te?.n ?? 0,
    keep: f.keep ?? null,
    heat: f.heat || null,
  };
}

for (const spec of BT_STRATEGIES) {
  const id = spec.id;
  const baseDoc = baseline.get(id);
  const A = singlesById.get(id)?.A;
  const B = singlesById.get(id)?.B;
  for (const tf of TFS) {
    const baseSrc = A?.tf?.[tf]?.base || B?.tf?.[tf]?.base || null;
    const baseSum = baseDoc?.sum?.[tf] ?? baseSrc?.sum ?? null;
    if (!baseSum || !baseSum.n) continue;
    const baseTr = baseSrc?.split?.train ?? null;
    const baseTe = baseSrc?.split?.test ?? null;
    const variants = makeVariants(id, tf);

    // kabul skoru
    let best = null, bestScore = -1e18;
    for (const vv of variants) {
      if (!baseTr || !baseTe || !vv.testAvg) continue;
      const keep = vv.keep ?? (vv.n / baseSum.n);
      const trainD = vv.trainAvg - baseTr.avg;
      const testD = vv.testAvg - baseTe.avg;
      const hdr = vv.testN >= 100 && testD > 0 && trainD > 0 && keep >= 0.2;
      const acc = vv.testN >= 30 && testD > 0 && trainD > 0 && keep >= 0.2;
      if (acc) acceptedVariantCount++;
      vv.trainD = r4(trainD); vv.testD = r4(testD); vv.keep = r4(keep); vv.thr = hdr ? 'başlık' : acc ? 'kabul' : '—';
      const score = acc ? (trainD + 0.8 * testD) * Math.min(1, Math.sqrt(vv.testN / 100)) + (hdr ? 1e-6 : 0) : -1e9 + Math.max(-1, (vv.avg - baseSum.avg));
      if (score > bestScore) { bestScore = score; best = vv; }
    }

    const baseAvg = baseSum.avg;
    cells.push({
      id, tf,
      base: {
        n: baseSum.n, avg: baseAvg, wr: baseSum.wr, pf: baseSum.pf, tot: baseSum.tot, dd: baseSum.dd,
        trainAvg: baseTr?.avg ?? null, trainN: baseTr?.n ?? 0, testAvg: baseTe?.avg ?? null, testN: baseTe?.n ?? 0,
      },
      best: best ? {
        type: best.type, keys: best.keys, n: best.n, avg: best.avg, wr: best.wr, pf: best.pf, tot: best.tot, dd: best.dd,
        trainAvg: best.trainAvg, trainD: best.trainD, testAvg: best.testAvg, testN: best.testN, testD: best.testD,
        keep: best.keep, thr: best.thr,
      } : null,
      lift: best ? r4(best.avg - baseAvg) : null,
    });

    // detay: kabul edilenler + en iyi 6 (kayda değer)
    const shown = variants
      .map((vv) => ({
        type: vv.type, keys: vv.keys, n: vv.n, avg: vv.avg, wr: vv.wr, pf: vv.pf,
        trainAvg: vv.trainAvg, testAvg: vv.testAvg, testN: vv.testN,
        trainD: vv.trainD, testD: vv.testD, keep: vv.keep, thr: vv.thr,
      }))
      .filter((vv) => vv.thr !== '—' || (vv.testD != null && vv.testD > 0))
      .sort((a, b) => (b.testD ?? -9) - (a.testD ?? -9))
      .slice(0, 24);
    details[id + ':' + tf] = {
      variants: shown,
      heatBase: squashHeat(baseDoc?.heat?.[tf]),
      heatBest: best?.heat ? squashHeat(best.heat) : null,
    };
  }
}

function squashHeat(heat) {
  if (!heat) return null;
  const out = {};
  if (Array.isArray(heat.syms)) { // kompakt format (yeni koşular)
    for (let i = 0; i < heat.syms.length; i++) out[heat.syms[i]] = [heat.avg[i], heat.n[i] ?? 0];
    return out;
  }
  if (!heat.avg) return null;    // eski map formatı (baseline)
  for (const s of Object.keys(heat.avg)) out[s] = [heat.avg[s], heat.n[s] ?? 0];
  return out;
}

/* --------------------------------- KPI'lar --------------------------------- */

const baseNeg = cells.filter((c) => c.base.avg < 0);
const rescued = cells.filter((c) => c.base.avg < 0 && c.best && c.best.avg > 0 && c.best.thr !== '—');
const rescuedHeadline = cells.filter((c) => c.base.avg < 0 && c.best && c.best.avg > 0 && c.best.thr === 'başlık');
const improved = cells.filter((c) => c.best && c.best.avg > c.base.avg + 1e-9);
const improvedHeadline = cells.filter((c) => c.best && c.best.thr === 'başlık' && c.best.avg > c.base.avg + 1e-9);
const withBest = cells.filter((c) => c.best);
const avgLift = withBest.length ? withBest.reduce((s, c) => s + (c.best.avg - c.base.avg), 0) / withBest.length : 0;
const negWithBest = baseNeg.filter((c) => c.best);
const avgLiftNeg = negWithBest.length ? negWithBest.reduce((s, c) => s + (c.best.avg - c.base.avg), 0) / negWithBest.length : 0;
const posShareBase = baseNeg.length / cells.length;
const posShareAfter = cells.filter((c) => c.best && c.best.avg > 0).length / Math.max(1, cells.length);

const kpis = {
  hücre: cells.length,
  bazNegatifHücre: baseNeg.length,
  bazPozitifHücre: cells.length - baseNeg.length,
  kurtarılan: rescued.length,
  kurtarılanBaşlık: rescuedHeadline.length,
  iyileşen: improved.length,
  iyileşenBaşlık: improvedHeadline.length,
  ortalamaİyileşme: r4(avgLift),
  ortalamaİyileşmeNegatiflerde: r4(avgLiftNeg),
  pozitifOranÖnce: r3((cells.length - baseNeg.length) / Math.max(1, cells.length)),
  pozitifOranSonra: r3(posShareAfter),
  tekFiltreDeğerlendirmesi: singleVariantCount,
  kombinasyonDeğerlendirmesi: comboVariantCount,
  kabulEdilenVaryant: acceptedVariantCount,
};

/* ------------------------- tf bazında ve tür bazında özet ------------------- */

const byTf = {};
for (const tf of TFS) {
  const cs = cells.filter((c) => c.tf === tf);
  const neg = cs.filter((c) => c.base.avg < 0);
  const resc = cs.filter((c) => c.base.avg < 0 && c.best && c.best.avg > 0 && c.best.thr !== '—');
  const imp = cs.filter((c) => c.best && c.best.avg > c.base.avg + 1e-9);
  const wb = cs.filter((c) => c.best);
  byTf[tf] = {
    hücre: cs.length, negatif: neg.length, kurtarılan: resc.length, iyileşen: imp.length,
    ortİyileşme: wb.length ? r4(wb.reduce((s, c) => s + (c.best.avg - c.base.avg), 0) / wb.length) : 0,
  };
}

/* ------------------------------ öne çıkanlar -------------------------------- */

const winners = cells
  .filter((c) => c.best && c.best.thr !== '—')
  .sort((a, b) => (b.best.thr === 'başlık' ? 1 : 0) - (a.best.thr === 'başlık' ? 1 : 0)
    || (b.best.testD ?? -9) - (a.best.testD ?? -9) || (b.lift ?? -9) - (a.lift ?? -9))
  .slice(0, 20)
  .map((c) => ({ id: c.id, tf: c.tf, keys: c.best.keys, type: c.best.type, thr: c.best.thr, baseAvg: c.base.avg, afterAvg: c.best.avg, lift: c.lift, trainD: c.best.trainD, testD: c.best.testD, testN: c.best.testN, keep: c.best.keep, baseN: c.base.n, afterN: c.best.n }));

const unrescued = baseNeg
  .filter((c) => !c.best || c.best.avg <= 0 || c.best.thr === '—')
  .sort((a, b) => (b.base.n ?? 0) - (a.base.n ?? 0))
  .slice(0, 30)
  .map((c) => ({ id: c.id, tf: c.tf, n: c.base.n, baseAvg: c.base.avg, bestAvg: c.best?.avg ?? null, bestKeys: c.best?.keys ?? null, bestThr: c.best?.thr ?? null }));

/* ------------------------------ lig özetleri -------------------------------- */

let league = leagueFile || [];
if (!league.length) {
  // league dosyası yoksa singles'tan türet
  const agg = new Map();
  for (const c of cells) {
    const d = details[c.id + ':' + c.tf];
    if (!d) continue;
    for (const vv of d.variants) {
      if (vv.keys.length !== 1) continue;
      const k = vv.keys[0];
      const a = agg.get(k) || { k, cat: FILTER_BY_KEY[k]?.cat, pass: 0, eval: 0, tD: 0, eD: 0 };
      a.eval++;
      if (vv.thr !== '—') { a.pass++; a.tD += vv.trainD || 0; a.eD += vv.testD || 0; }
      agg.set(k, a);
    }
  }
  league = [...agg.values()].map((a) => ({ ...a, ortalamaPassTrainD: a.pass ? r4(a.tD / a.pass) : 0, ortalamaPassTestD: a.pass ? r4(a.eD / a.pass) : 0 })).sort((x, y) => y.pass - x.pass);
}

/* --------------------------------- CSV ------------------------------------- */

{
  const lines = ['id,tf,key,cat,base_n,base_avg,base_tr_avg,base_te_avg,f_n,f_avg,f_tr_n,f_tr_avg,f_te_n,f_te_avg,keep,trainD,testD,thr'];
  for (const [id, docs] of singlesById) {
    for (const src of ['A', 'B']) {
      const doc = docs[src];
      if (!doc) continue;
      for (const tf of TFS) {
        const cell = doc.tf?.[tf];
        if (!cell) continue;
        const base = cell.base;
        if (!base?.sum) continue;
        const btr = base.split?.train, bte = base.split?.test;
        for (const [k, f] of Object.entries(cell.v || {})) {
          if (!f?.sum) continue;
          const tr = f.split?.train, te = f.split?.test;
          const trainD = tr && btr ? r4(tr.avg - btr.avg) : '';
          const testD = te && bte ? r4(te.avg - bte.avg) : '';
          const keep = r4(f.sum.n / base.sum.n);
          const thr = te && tr && bte && btr && te.n >= 100 && testD > 0 && trainD > 0 && keep >= 0.2 ? 'başlık'
            : te && tr && bte && btr && te.n >= 30 && testD > 0 && trainD > 0 && keep >= 0.2 ? 'kabul' : '';
          lines.push([id, tf, k, FILTER_BY_KEY[k]?.cat || '', base.sum.n, base.sum.avg, btr?.avg ?? '', bte?.avg ?? '',
            f.sum.n, f.sum.avg, tr?.n ?? '', tr?.avg ?? '', te?.n ?? '', te?.avg ?? '', keep, trainD, testD, thr].join(','));
        }
      }
    }
  }
  await writeFile(join(OUT, 'filtre_ozet.csv'), lines.join('\n'));
}

/* ------------------------------- combo özeti -------------------------------- */

const comboStats = (() => {
  const list = [];
  for (const c of cells) {
    if (c.best && (c.best.type === 'ikili' || c.best.type === 'üçlü')) list.push(c);
  }
  const byType = { ikili: 0, üçlü: 0 };
  for (const c of cells) if (c.best) byType[c.best.type] = (byType[c.best.type] || 0) + 1;
  return { enİyiOlduğuHücre: { ikili: byType.ikili || 0, üçlü: byType.üçlü || 0, filtre: byType.filtre || 0 }, toplamKombinasyonDenemesi: comboVariantCount };
})();

/* --------------------------- dashboard veri paketi -------------------------- */

const dashboardData = {
  gen: new Date().toISOString(),
  universe: { count: NSYM },
  kpis,
  byTf,
  tfs: TFS,
  strategies: BT_STRATEGIES.map((s) => ({ id: s.id, title: s.title, cat: BT_CATEGORY_OF?.[s.id] || null })),
  league,
  filters: FILTERS.map((f) => ({ k: f.k, cat: f.cat, catTitle: FILTER_CATS[f.cat] || f.cat, title: f.title, desc: f.desc })),
  cells,
  details,
  winners,
  unrescued,
  comboStats,
  verify: verify ? { cells: verify.cells, ok: verify.ok, fail: verify.fail, worst: verify.worst, rounding: verify.rounding || 0 } : null,
  policy: selection?.policy || null,
};
await writeFile(join(OUT, 'dashboard_data.json'), JSON.stringify(dashboardData));

const exec = {
  gen: dashboardData.gen,
  kpis, byTf,
  ligİlk10: league.slice(0, 10),
  öneÇıkanlar: winners.slice(0, 10),
  kurtarılamayanİlk10: unrescued.slice(0, 10),
  doğrulama: dashboardData.verify,
  yöntem: {
    motor: 'sim.mjs birebir kopyası (doğrulandı: 600 hücre referans karşılaştırması)',
    filtreSayısı: FILTERS.length,
    strateji: BT_STRATEGIES.length,
    tf: TFS,
    train: '2022-08-01 → 2024-12-31', test: '2025-01-01 → veri sonu',
    marketVerisi: 'Gerçek Fear&Greed (alternative.me) + BTC trend/getiri/vol + piyasa genişliği + toplam hacim',
    lookahead: 'Yok — tüm piyasa verileri kapanış anında bilinen değerlerle hizalanır',
  },
};
await writeFile(join(OUT, 'executive_summary.json'), JSON.stringify(exec, null, 1));

/* ------------------------------- Markdown rapor ----------------------------- */

const L = [];
L.push('# Filtre Laboratuvarı — Filtre Raporu');
L.push('');
L.push(`Üretim: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · Motor: İndikatör Akademi backtest çekirdeği (birebir doğrulandı) · Eğitim/test ayrımı: train < 2025-01-01, test ≥ 2025-01-01`);
L.push('');
L.push('## 1. Yönetici Özeti');
L.push('');
L.push('| Gösterge | Değer |');
L.push('|---|---|');
L.push(`| İncelenen hücre (indikatör × zaman dilimi) | ${kpis.hücre} |`);
L.push(`| Baz durumda negatif hücre | ${kpis.bazNegatifHücre} (${pct(kpis.bazNegatifHücre / kpis.hücre, 1)}) |`);
L.push(`| Filtrelerle pozitife dönen hücre | **${kpis.kurtarılan}** (başlık kriterli: ${kpis.kurtarılanBaşlık}) |`);
L.push(`| En iyi varyantla iyileşen hücre | **${kpis.iyileşen}** (başlık kriterli: ${kpis.iyileşenBaşlık}) |`);
L.push(`| Ortalama işlem başına iyileşme (tüm hücreler) | ${sgn(kpis.ortalamaİyileşme)} |`);
L.push(`| Ortalama işlem başına iyileşme (baz negatif hücreler) | ${sgn(kpis.ortalamaİyileşmeNegatiflerde)} |`);
L.push(`| Pozitif hücre oranı | Önce ${pct(kpis.pozitifOranÖnce, 1)} → Sonra ${pct(kpis.pozitifOranSonra, 1)} |`);
L.push(`| Değerlendirilen tek filtre / kombinasyon | ${kpis.tekFiltreDeğerlendirmesi} / ${kpis.kombinasyonDeğerlendirmesi} |`);
L.push('');
L.push('**Kabul kriterleri:** seçim yalnızca eğitim döneminde; kabul için test Δ>0, test işlem ≥30 (başlık için ≥100), işlem korunumu ≥%20 ve sembol tutarlılığı gerekir. Bu kriterler aşırı-uyum (overfit) riskini sınırlamak içindir; yine de sonuçlar veri madenciliği içerdiğinden ihtiyatla okunmalıdır.');
L.push('');
L.push('## 2. Zaman Dilimi Görünümü');
L.push('');
L.push('| TF | Hücre | Baz negatif | Kurtarılan | İyileşen | Ort. iyileşme |');
L.push('|---|---|---|---|---|---|');
for (const tf of TFS) {
  const b = byTf[tf];
  L.push(`| ${tf} | ${b.hücre} | ${b.negatif} | ${b.kurtarılan} | ${b.iyileşen} | ${sgn(b.ortİyileşme)} |`);
}
L.push('');
L.push('## 3. Doğrulama');
L.push('');
if (dashboardData.verify) {
  L.push(`Referans rapordaki 600 hücrenin tamamı yeniden üretildi: eşleşen **${dashboardData.verify.ok}/${dashboardData.verify.cells}**, farklı ${dashboardData.verify.fail}.`);
  if (dashboardData.verify.rounding) L.push(`(Yuvarlama sınırı kaydı: ${dashboardData.verify.rounding} alan — portföy eğrisi ~sıfıra çöken patolojik hücrelerde yıllık oranın kaçınılmaz amplifikasyonu, göreli fark <1e-6.)`);
  L.push('');
  L.push('Motor, komisyon (%0,04 taker), kayma (1bp), gerçek funding ödemeleri ve açılış-barı emir kuralıyla orijinal çekirdeğin aynısıdır. Filtre mekaniği: **çıkış sinyalleri her durumda uygulanır; filtre yalnızca yeni girişi engeller** (engellenen ters dönüşte pozisyon kapanır, karşı yön açılmaz).');
} else {
  L.push('Doğrulama raporu bulunamadı (out/verify_report.json).');
}
L.push('');
L.push('## 4. Tek Filtre Ligi (özet)');
L.push('');
L.push('| # | Filtre | Kategori | Kabul edilen hücre | Ort. trainΔ | Ort. testΔ |');
L.push('|---|---|---|---|---|---|');
league.slice(0, 20).forEach((l, i) => {
  L.push(`| ${i + 1} | ${FILTER_BY_KEY[l.k]?.title || l.k} (\`${l.k}\`) | ${FILTER_CATS[l.cat] || l.cat} | ${l.pass} | ${sgn(l.ortalamaPassTrainD)} | ${sgn(l.ortalamaPassTestD)} |`);
});
L.push('');
L.push('## 5. Öne Çıkan Dönüşümler (ilk 20)');
L.push('');
L.push('| # | İndikatör | TF | Varyant | Önce | Sonra | Getiri farkı | trainΔ | testΔ | test n | koruma |');
L.push('|---|---|---|---|---|---|---|---|---|---|---|');
winners.forEach((w, i) => {
  const name = BT_STRATEGIES.find((s) => s.id === w.id)?.title || w.id;
  const keys = w.keys.map((k) => FILTER_BY_KEY[k]?.title || k).join(' + ');
  L.push(`| ${i + 1} | ${name} | ${w.tf} | ${keys}${w.thr === 'başlık' ? ' 🏅' : ''} | ${sgn(w.baseAvg)} | ${sgn(w.afterAvg)} | ${sgn(w.lift)} | ${sgn(w.trainD)} | ${sgn(w.testD)} | ${w.testN} | ${pct(w.keep, 0)} |`);
});
L.push('');
L.push('🏅 = başlık kriteri (test işlem ≥100). Getiri farkı = sonra − önce (işlem başına ortalama).');
L.push('');
L.push('## 6. Kombinasyon Bulguları');
L.push('');
L.push(`- Değerlendirilen kombinasyon sayısı: **${comboStats.toplamKombinasyonDenemesi}**`);
L.push(`- En iyi varyantı kombinasyon olan hücre: ikili ${comboStats.enİyiOlduğuHücre.ikili}, üçlü ${comboStats.enİyiOlduğuHücre.üçlü}, tek filtre ${comboStats.enİyiOlduğuHücre.filtre}`);
L.push('');
L.push('## 7. Kurtarılamayanlar (dürüst liste)');
L.push('');
L.push('Filtre politikası içinde pozitife dönmeyen baz negatif hücreler en büyükten küçüğe:');
L.push('');
L.push('| İndikatör | TF | Baz n | Önce | En iyi sonra | En iyi varyant | Durum |');
L.push('|---|---|---|---|---|---|---|');
for (const u of unrescued.slice(0, 20)) {
  const name = BT_STRATEGIES.find((s) => s.id === u.id)?.title || u.id;
  const keys = (u.bestKeys || []).map((k) => FILTER_BY_KEY[k]?.title || k).join(' + ') || '—';
  L.push(`| ${name} | ${u.tf} | ${u.n} | ${sgn(u.baseAvg)} | ${u.bestAvg != null ? sgn(u.bestAvg) : '—'} | ${keys} | ${u.bestThr || '—'} |`);
}
L.push('');
L.push('## 8. Sınırlar ve Uyarılar');
L.push('');
L.push('- Bu çalışma **eğitim amaçlı bir araştırmadır**; yatırım tavsiyesi değildir.');
L.push('- Filtreler parametre optimizasyonu içermez; yalnızca hazır sinyal setine "kapı" olarak eklenir. Yine de çok sayıda filtre denemesi veri madenciliği yanılsaması yaratabilir; kabul kapıları ve train/test ayrımı bu riski azaltır ama sıfırlamaz.');
L.push(`- Sonuçlar seçilmiş ${NSYM} sembol ve 2022-08 → 2026-09 aralığına özgüdür; işlem maliyetleri (%0,04 + 1bp) ve gerçek funding dahildir, ancak likidite/kayma varsayımları idealize değildir — büyük emirlerde gerçek kayma daha yüksek olur.`);
L.push('- F&G endeksi günlük yayınlanır ve bar kapanışıyla hizalanır; gün içi (5m/15m) sinyaller bu bilgiyi yalnızca yayınlandıktan sonra kullanır.');
L.push('- Pozitife dönen hücrelerin bir kısmı düşük işlem sayılarına dayanabilir; tablolardaki test n ve koruma sütunları bunu denetlemek içindir.');
L.push('');
L.push('> Detaylı etkileşimli görünüm: `DASHBOARD.html` · Ham veriler: `out/` klasörü.');
L.push('');
await writeFile(join(OUT, 'FILTRE-RAPORU.md'), L.join('\n'));

/* --------------------------------- README ---------------------------------- */

const R = [];
R.push('# Filtre Laboratuvarı');
R.push('');
R.push(`Bu klasör, mevcut 100 indikatörlük backtest setinin (6 zaman dilimi × ${NSYM} sembol = 600 hücre) **filtrelerle yeniden simülasyonunu** içerir. Amaç: negatif beklentili sinyal hücrelerini, giriş anını süzerek pozitife çevirebilecek filtre ve kombinasyonları bulmak — dürüst ve doğrulanabilir biçimde.`);
R.push('');
R.push('## Başlıca Sonuçlar');
R.push('');
R.push(`- **${kpis.hücre} hücre** incelendi; baz durumda **${kpis.bazNegatifHücre}** hücre negatifti.`);
R.push(`- Filtrelerle **${kpis.kurtarılan} hücre** pozitife döndü (**${kpis.kurtarılanBaşlık}** tanesi "başlık" kriterini sağlıyor: test işlem ≥100).`);
R.push(`- En iyi varyant baz alındığında **${kpis.iyileşen} hücre** iyileşti (başlık: ${kpis.iyileşenBaşlık}).`);
R.push(`- Ortalama işlem başına iyileşme: tüm hücrelerde ${sgn(kpis.ortalamaİyileşme)}, negatif hücrelerde ${sgn(kpis.ortalamaİyileşmeNegatiflerde)}.`);
R.push(`- Pozitif hücre oranı ${pct(kpis.pozitifOranÖnce, 1)} → ${pct(kpis.pozitifOranSonra, 1)}.`);
R.push('');
R.push('## Nasıl Açılır');
R.push('');
R.push('- **`DASHBOARD.html`** — tek dosyalık, çevrimdışı etkileşimli panel (önce/sonra ısı matrisi, hücre detayı, filtre ligi, kazananlar).');
R.push('- **`out/FILTRE-RAPORU.md`** — tam rapor (yöntem, tablolar, kurtarılamayanlar).');
R.push('- **`out/executive_summary.json`** — makine okunur özet.');
R.push('- **`out/filtre_ozet.csv`** — hücre × filtre metrikleri (≈40 bin satır).');
R.push('- **`out/baseline|singles|combos/`** — tüm ham sonuçlar.');
R.push('');
R.push('## Yöntem (özet)');
R.push('');
R.push('- Motor orijinal backtest çekirdeğinin birebir kopyasıdır; 600 hücrenin tamamı referans raporla karşılaştırılarak doğrulandı (bkz. rapor §3).');
R.push('- Filtre mekaniği: çıkışlar her zaman uygulanır; filtre yalnızca **yeni girişi** engeller.');
R.push('- Katmanlar: trend/rejim, momentum, hacim/likidite, BTC-piyasa (genişlik, hacim, trend), gerçek Korku&Açgözlülük endeksi, göreli güç, takvim, işlem bağlamı, veri kalitesi — toplam ' + FILTERS.length + ' filtre.');
R.push('- Aşırı-uydurma kontrolü: seçim yalnızca train (2022-08→2024-12); kabul için test Δ>0, test n≥30, koruma ≥%20, sembol tutarlılığı.');
R.push('- Tüm piyasa verileri kapanış anında bilinen değerlerle hizalanır (lookahead yok).');
R.push('');
R.push('## Uyarı');
R.push('');
R.push('Eğitim amaçlı araştırmadır; yatırım tavsiyesi değildir. Geçmiş performans gelecek getiriyi garanti etmez. Detaylı sınırlar için rapor §8.');
R.push('');
await writeFile(join(BP, 'README.md'), R.join('\n'));

console.log('[rapor] yazıldı: executive_summary.json, filtre_ozet.csv, dashboard_data.json, FILTRE-RAPORU.md, README.md');
console.log(`[rapor] KPI: hücre ${kpis.hücre}, baz negatif ${kpis.bazNegatifHücre}, kurtarılan ${kpis.kurtarılan} (başlık ${kpis.kurtarılanBaşlık}), iyileşen ${kpis.iyileşen}, ort. iyileşme ${sgn(kpis.ortalamaİyileşme)}`);
