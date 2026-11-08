// Piyasa verisi katmanı — BTC trend/getiri/volatilite, piyasa genişliği,
// toplam hacim ve gerçek Korku&Açgözlülük serilerini üretir; (sembol,tf)
// barlarına "kapanış anında bilinen veri" kuralıyla hizalar (lookahead yok).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { BP, TFS, TF_MS, smaOf, emaOf, rollMax, rankPct } from './core.mjs';
import { loadSeriesC, listSymbolsAll, clearMemCache } from './dataload.mjs';

const MDIR = join(BP, 'cache', 'market');
const MAGIC = 0x42f20001;
const DAY = 86400000;

/* ------------------------------- inşa (CLI) ------------------------------- */

export async function buildMarket() {
  const series = {};
  const add = (name, t, v, avail) => { series[name] = { t, v, avail }; };
  const t0 = Date.now();

  // 1) F&G (günlük; 00:00 UTC'de yayınlanır → avail 0)
  {
    const txt = await readFile(join(BP, 'data', 'fng_history.csv'), 'utf8');
    const T = [], V = [];
    for (const ln of txt.split('\n')) {
      if (!ln) continue;
      const p = ln.split(',');
      const tt = +p[0], vv = +p[1];
      if (!Number.isFinite(tt) || !Number.isFinite(vv)) continue;
      T.push(tt); V.push(vv);
    }
    add('fng', Float64Array.from(T), Float64Array.from(V), 0);
  }

  const btcD = await loadSeriesC('1d', 'BTCUSDT');

  // 2) BTC 1d EMA50 sapması + 90 günlük düşüş (gün sonunda bilinir → avail 1g)
  {
    const e50 = emaOf(btcD.c, 50);
    const dev = new Float64Array(btcD.t.length).fill(NaN);
    for (let i = 0; i < dev.length; i++) if (!Number.isNaN(e50[i]) && e50[i] > 0) dev[i] = (btcD.c[i] - e50[i]) / e50[i];
    add('btcEma50D1', btcD.t, dev, DAY);
    const rm = rollMax(btcD.c, 90);
    const dd = new Float64Array(btcD.t.length).fill(NaN);
    for (let i = 0; i < dd.length; i++) if (!Number.isNaN(rm[i]) && rm[i] > 0) dd[i] = btcD.c[i] / rm[i] - 1;
    add('btcDD90D1', btcD.t, dd, DAY);
  }

  const symbols = await listSymbolsAll();

  // 3) piyasa genişliği (1d kapanışı EMA50 üstünde olan sembol oranı)
  {
    const dayMap = new Map();
    for (const sym of symbols) {
      let sd; try { sd = await loadSeriesC('1d', sym); } catch { continue; }
      const e50 = emaOf(sd.c, 50);
      for (let i = 0; i < sd.t.length; i++) {
        if (Number.isNaN(e50[i])) continue;
        const day = Math.floor(sd.t[i] / DAY) * DAY;
        let a = dayMap.get(day);
        if (!a) dayMap.set(day, a = [0, 0]);
        a[0]++; if (sd.c[i] > e50[i]) a[1]++;
      }
      clearMemCache();
    }
    const days = [...dayMap.keys()].sort((a, b) => a - b);
    const T = Float64Array.from(days);
    const V = new Float64Array(days.length).fill(NaN);
    for (let i = 0; i < days.length; i++) {
      const a = dayMap.get(days[i]);
      if (a[0] >= 5) V[i] = a[1] / a[0];
    }
    add('breadth', T, V, DAY);
    const M = new Float64Array(days.length).fill(NaN);
    let j = 0;
    for (let i = 0; i < days.length; i++) {
      while (j + 1 < i && T[j + 1] <= T[i] - 5 * DAY) j++;
      if (i > 0 && T[i] - T[j] >= 5 * DAY && !Number.isNaN(V[i]) && !Number.isNaN(V[j])) M[i] = V[i] - V[j];
    }
    add('breadthMom', T, M, DAY);
  }

  // 4) BTC 4h trend yönü (EMA20 vs EMA50)
  {
    const b = await loadSeriesC('4h', 'BTCUSDT');
    const e20 = emaOf(b.c, 20), e50 = emaOf(b.c, 50);
    const v = new Float64Array(b.t.length).fill(NaN);
    for (let i = 0; i < v.length; i++) if (!Number.isNaN(e20[i]) && !Number.isNaN(e50[i])) v[i] = e20[i] > e50[i] ? 1 : e20[i] < e50[i] ? -1 : 0;
    add('btcDir4h', b.t, v, TF_MS['4h']);
  }

  // 5) toplam piyasa hacmi (1h toplamı) yüzdelik dilimi
  {
    const volMap = new Map();
    for (const sym of symbols) {
      let sh; try { sh = await loadSeriesC('1h', sym); } catch { continue; }
      for (let i = 0; i < sh.t.length; i++) {
        const k = sh.t[i];
        volMap.set(k, (volMap.get(k) || 0) + sh.v[i]);
      }
      clearMemCache();
    }
    const ts = [...volMap.keys()].sort((a, b) => a - b);
    const T = Float64Array.from(ts);
    const lv = new Float64Array(ts.length);
    for (let i = 0; i < ts.length; i++) lv[i] = Math.log(Math.max(volMap.get(ts[i]), 1));
    add('mktVolPct', T, rankPct(lv, 200), TF_MS['1h']);
  }

  // 6) tf bazlı BTC serileri: 7g/30g getiri, vol yüzdelik, dolar hacim yüzdelik
  for (const tf of TFS) {
    let sb; try { sb = await loadSeriesC(tf, 'BTCUSDT'); } catch { continue; }
    const n = sb.t.length;
    const ret = new Float64Array(n).fill(NaN);
    for (let i = 1; i < n; i++) ret[i] = Math.log(sb.c[i] / sb.c[i - 1]);
    for (const [name, days] of [['btcRet7d', 7], ['btcRet30d', 30]]) {
      const need = days * DAY;
      const v = new Float64Array(n).fill(NaN);
      let j = -1;
      for (let i = 0; i < n; i++) {
        while (j + 1 < i && sb.t[j + 1] <= sb.t[i] - need) j++;
        if (j >= 0 && j < i && sb.t[i] - sb.t[j] >= need) v[i] = sb.c[i] / sb.c[j] - 1;
      }
      add(name + '_' + tf, sb.t, v, TF_MS[tf]);
    }
    {
      const r2 = new Float64Array(n);
      for (let i = 0; i < n; i++) r2[i] = Number.isNaN(ret[i]) ? NaN : ret[i] * ret[i];
      const m1 = smaOf(ret, 50), m2 = smaOf(r2, 50);
      const sigma = new Float64Array(n).fill(NaN);
      for (let i = 0; i < n; i++) if (!Number.isNaN(m1[i]) && !Number.isNaN(m2[i])) sigma[i] = Math.sqrt(Math.max(0, m2[i] - m1[i] * m1[i]));
      add('btcVolPct_' + tf, sb.t, rankPct(sigma, 200), TF_MS[tf]);
    }
    {
      const dv = new Float64Array(n);
      for (let i = 0; i < n; i++) dv[i] = Math.log(Math.max(sb.c[i] * sb.v[i], 1e-9));
      add('btcDvolPct_' + tf, sb.t, rankPct(dv, 200), TF_MS[tf]);
    }
  }

  // binary yaz
  await mkdir(MDIR, { recursive: true });
  const names = Object.keys(series);
  const chunks = [];
  const hdr = Buffer.alloc(8);
  hdr.writeUInt32LE(MAGIC, 0);
  hdr.writeUInt32LE(names.length, 4);
  chunks.push(hdr);
  for (const nm of names) {
    const { t, v, avail } = series[nm];
    const nb = Buffer.from(nm, 'utf8');
    const meta = Buffer.alloc(4 + nb.length + 8 + 4);
    meta.writeUInt32LE(nb.length, 0);
    nb.copy(meta, 4);
    meta.writeDoubleLE(avail, 4 + nb.length);
    meta.writeUInt32LE(t.length, 4 + nb.length + 8);
    chunks.push(meta);
    const tb = Buffer.alloc(t.length * 8);
    const vb = Buffer.alloc(v.length * 8);
    for (let i = 0; i < t.length; i++) { tb.writeDoubleLE(t[i], i * 8); vb.writeDoubleLE(v[i], i * 8); }
    chunks.push(tb, vb);
  }
  await writeFile(join(MDIR, 'base.bin'), Buffer.concat(chunks));
  console.log(`[market] ${names.length} seri yazıldı (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return names;
}

/* --------------------------------- okuma ---------------------------------- */

let _base = null;

export async function loadMarketBase() {
  if (_base) return _base;
  const buf = await readFile(join(MDIR, 'base.bin'));
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('market base: hatalı sihirli sayı');
  const count = dv.getUint32(4, true);
  const out = {};
  let off = 8;
  for (let s = 0; s < count; s++) {
    const nameLen = dv.getUint32(off, true); off += 4;
    const name = buf.toString('utf8', off, off + nameLen); off += nameLen;
    const avail = dv.getFloat64(off, true); off += 8;
    const n = dv.getUint32(off, true); off += 4;
    // hizalama serbest olabileceği için kopyalayarak oku
    const t = new Float64Array(n);
    const v = new Float64Array(n);
    for (let i = 0; i < n; i++) t[i] = dv.getFloat64(off + i * 8, true);
    off += n * 8;
    for (let i = 0; i < n; i++) v[i] = dv.getFloat64(off + i * 8, true);
    off += n * 8;
    out[name] = { t, v, avail };
  }
  _base = out;
  return out;
}

// Seriyi (sembol,tf) barlarına hizala: bar i kapanışı ct = t[i]+tfMs için,
// "yayın anı + avail <= ct" olan EN SON değer kullanılır.
export function alignSeries(t, v, avail, S, tfMs) {
  const n = S.t.length;
  const out = new Float64Array(n).fill(NaN);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const ct = S.t[i] + tfMs;
    while (k < t.length && t[k] + avail <= ct) k++;
    if (k > 0) out[i] = v[k - 1];
  }
  return out;
}

// (sembol,tf) için hizalanmış piyasa görünümü
export function marketView(base, S, tf) {
  const tfMs = TF_MS[tf];
  const V = (name) => {
    const s = base[name];
    if (!s) return null;
    return alignSeries(s.t, s.v, s.avail, S, tfMs);
  };
  return {
    fng: V('fng'),
    breadth: V('breadth'),
    breadthMom: V('breadthMom'),
    btcEma50D1: V('btcEma50D1'),
    btcDD90D1: V('btcDD90D1'),
    btcDir4h: V('btcDir4h'),
    mktVolPct: V('mktVolPct'),
    btcRet7d: V('btcRet7d_' + tf),
    btcRet30d: V('btcRet30d_' + tf),
    btcVolPct: V('btcVolPct_' + tf),
    btcDvolPct: V('btcDvolPct_' + tf),
  };
}

/* ---------------------------------- CLI ----------------------------------- */
const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/market.mjs');
if (isMain) await buildMarket();
