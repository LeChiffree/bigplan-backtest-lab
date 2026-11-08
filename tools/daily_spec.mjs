// daily_spec.mjs — günlük koşu için hücre × varyant seçimi (rapor2 ile aynı skor)
// Her hücre: baz + skora göre en iyi 3 aday (kabul/başlık bayraklarıyla).
// Baz geçerli her hücre listeye girer (aday yoksa boş liste → yalnız baz koşar).
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { BP, TFS } from './core.mjs';

const S = join(BP, 'out', 'singles');
const OUT = join(BP, 'out', 'daily_spec.json');

const r4 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 1e4) / 1e4);

const files = await readdir(S);
const byId = new Map();
for (const f of files) {
  const m = /^(.+)\.([AB])\.json$/.exec(f);
  if (!m) continue;
  if (!byId.has(m[1])) byId.set(m[1], {});
  byId.get(m[1])[m[2]] = JSON.parse(await readFile(join(S, f), 'utf8'));
}

const combosById = new Map();
for (const f of await readdir(join(BP, 'out', 'combos'))) {
  if (!f.endsWith('.json')) continue;
  combosById.set(f.replace(/\.json$/, ''), JSON.parse(await readFile(join(BP, 'out', 'combos', f), 'utf8')));
}

let cells = 0, withCands = 0, states = 0, hdrBest = 0;
const spec = {};
const meta = {};

for (const [id, docs] of byId) {
  const tfA = docs.A?.tf || {};
  const tfB = docs.B?.tf || {};
  for (const tf of TFS) {
    const base = tfA[tf]?.base || tfB[tf]?.base;
    if (!base || !base.sum || !base.sum.n) continue;
    cells++;
    const btr = base.split?.train, bte = base.split?.test;

    const cands = [];
    for (const src of ['A', 'B']) {
      const v = (src === 'A' ? tfA : tfB)[tf]?.v;
      if (!v) continue;
      for (const [k, f] of Object.entries(v)) {
        if (!f || !f.sum || !f.sum.n) continue;
        const tr = f.split?.train, te = f.split?.test;
        if (!tr || !te) continue;
        cands.push({ keys: [k], f, tr, te });
      }
    }
    const cl = combosById.get(id)?.tf?.[tf]?.combos || [];
    for (const c of cl) {
      if (!c || !c.sum) continue;
      const tr = c.split?.train, te = c.split?.test;
      if (!tr || !te) continue;
      cands.push({ keys: c.keys, f: c, tr, te });
    }

    const scored = [];
    for (const c of cands) {
      if (!btr || !bte) continue;
      const keep = c.f.keep ?? (c.f.sum.n / base.sum.n);
      const trainD = c.tr.avg - btr.avg;
      const testD = c.te.avg - bte.avg;
      const hdr = c.te.n >= 100 && testD > 0 && trainD > 0 && keep >= 0.2;
      const acc = c.te.n >= 30 && testD > 0 && trainD > 0 && keep >= 0.2;
      const score = acc ? (trainD + 0.8 * testD) * Math.min(1, Math.sqrt(c.te.n / 100)) + (hdr ? 1e-6 : 0) : -1e9 + Math.max(-1, (c.f.sum.avg - base.sum.avg));
      scored.push({ keys: c.keys, hdr, acc, keep: r4(keep), trainD: r4(trainD), testD: r4(testD), testN: c.te.n, avg: c.f.sum.avg, _score: score });
    }
    scored.sort((a, b) => b._score - a._score);
    const top = scored.slice(0, 3);
    for (const t of top) delete t._score;
    if (top.length) { withCands++; if (top[0].hdr) hdrBest++; }
    meta[id + ':' + tf] = { baseN: base.sum.n, baseAvg: base.sum.avg, baseTr: btr?.n ?? 0, baseTe: bte?.n ?? 0 };
    spec[id + ':' + tf] = top;
    states += 1 + top.length;
  }
}

await mkdir(join(BP, 'out'), { recursive: true });
await writeFile(OUT, JSON.stringify({ gen: new Date().toISOString(), cells: spec, meta }));
console.log(`[daily_spec] hücre: ${cells}, adaylı: ${withCands} (ilk aday başlık: ${hdrBest}), koşulacak durum: ${states}`);
console.log(`[daily_spec] yazıldı: ${OUT}`);
