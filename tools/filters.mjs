// Filtre Laboratuvarı — filtre kataloğu ve kapı (gate) üreticisi
//
// Kapı sözleşmesi: L[i]=1 → bar i kapanış sinyaliyle LONG giriş serbest,
// S[i]=1 → SHORT giriş serbest. Çıkışlar her durumda uygulanır; filtre
// yalnızca YENİ GİRİŞİ (ters dönüşte karşı yönü dahil) süzebilir.
// NaN karşılaştırmalar 0 (bloke) üretir → ısınma döneminde giriş olmaz.
import { smaOf, emaOf, rollMax, rollMin, rankPct, TF_MS } from './core.mjs';

const DAY = 86400000;

export const FILTER_CATS = {
  trend: 'Trend / Rejim',
  momentum: 'Momentum',
  volume: 'Hacim / Likidite',
  market: 'BTC / Piyasa',
  fear: 'Korku / Volatilite',
  rel: 'Göreli Güç',
  cal: 'Takvim / Saat',
  ctx: 'İşlem Bağlamı',
  data: 'Veri Kalitesi',
  contra: 'Kontra (Ters)',
};

// iki yönlü kapı yardımcıları
function both(n) { return { L: new Uint8Array(n).fill(1), S: new Uint8Array(n).fill(1) }; }

export const FILTERS = [
  /* =========================== A · TREND / REJİM =========================== */
  {
    k: 't_ema200', cat: 'trend', title: 'EMA200 tarafı',
    desc: 'Long yalnız kapanış EMA200 üzerindeyken, short yalnız altındayken açılır.',
    build(C, S, ctx) {
      const n = S.t.length, c = S.c;
      const e = C('ema200', () => ctx.L('ema', { p: 200 }, 'EMA200'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = e[i]; if (!Number.isNaN(x)) { if (c[i] > x) L[i] = 1; else if (c[i] < x) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 't_ema50200', cat: 'trend', title: 'EMA50/200 hizası',
    desc: 'EMA50, EMA200 üzerindeyse long; altındaysa short girişine izin verir.',
    build(C, S, ctx) {
      const n = S.t.length;
      const e50 = C('ema50', () => ctx.L('ema', { p: 50 }, 'EMA50'));
      const e200 = C('ema200', () => ctx.L('ema', { p: 200 }, 'EMA200'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (Number.isNaN(e50[i]) || Number.isNaN(e200[i])) continue; if (e50[i] > e200[i]) L[i] = 1; else if (e50[i] < e200[i]) Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 't_htf', cat: 'trend', title: 'Üst TF trend (×4)',
    desc: '4 kat üst zaman diliminin EMA20/50 yönüyle aynı yönde girişe izin verir (kapanmış üst bar).',
    build(C, S, ctx) {
      const n = S.t.length;
      const hd = C('htf4', () => ctx.higherDir(4, 20, 50));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (hd[i] === 1) L[i] = 1; else if (hd[i] === -1) Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 't_st', cat: 'trend', title: 'Supertrend tarafı',
    desc: 'Fiyat Supertrend(10,3) üzerindeyse long, altındaysa short girişine izin verir.',
    build(C, S, ctx) {
      const n = S.t.length, c = S.c;
      const st = C('st', () => ctx.L('supertrend', { p: 10, m: 3 }, 'Supertrend'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = st[i]; if (!Number.isNaN(x)) { if (c[i] > x) L[i] = 1; else if (c[i] < x) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 't_adx20', cat: 'trend', title: 'ADX>20 + yön',
    desc: 'ADX 20 üzerindeyken +DI/-DI yönünde girişe izin verir (trend gücü kapısı).',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('adx14', () => ctx.calc('adx', { p: 14 }));
      const A = r.lines.ADX, P = r.lines['+DI'], M = r.lines['-DI'];
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (A[i] > 20 && P[i] > M[i]) L[i] = 1; else if (A[i] > 20 && M[i] > P[i]) Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 't_adx25', cat: 'trend', title: 'ADX>25 + yön',
    desc: 'Daha sıkı ADX (25) trend gücü kapısı.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('adx14', () => ctx.calc('adx', { p: 14 }));
      const A = r.lines.ADX, P = r.lines['+DI'], M = r.lines['-DI'];
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (A[i] > 25 && P[i] > M[i]) L[i] = 1; else if (A[i] > 25 && M[i] > P[i]) Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 't_chopTrend', cat: 'trend', title: 'Trend rejimi (Choppiness<38)',
    desc: 'Piyasa trenddeyse (Choppiness<38) EMA50 tarafına göre girişe izin verir.',
    build(C, S, ctx) {
      const n = S.t.length, c = S.c;
      const ch = C('chop14', () => ctx.L('chop', { p: 14 }, 'Choppiness'));
      const e50 = C('ema50', () => ctx.L('ema', { p: 50 }, 'EMA50'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (ch[i] < 38) { if (c[i] > e50[i]) L[i] = 1; else if (c[i] < e50[i]) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 't_chopRange', cat: 'trend', title: 'Yatay rejim (Choppiness>62)',
    desc: 'Yalnız yatay piyasada (Choppiness>62) girişe izin verir — ortalamaya dönüş stratejileri için.',
    build(C, S, ctx) {
      const n = S.t.length;
      const ch = C('chop14', () => ctx.L('chop', { p: 14 }, 'Choppiness'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (ch[i] > 62) { L[i] = 1; Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 't_linreg', cat: 'trend', title: 'LinReg eğimi',
    desc: 'LinReg(50) orta çizgisi son 10 barda yükseliyorsa long, düşüyorsa short.',
    build(C, S, ctx) {
      const n = S.t.length;
      const mid = C('linreg50', () => ctx.L('linreg', { p: 50 }, 'Orta'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 10; i < n; i++) {
        const a = mid[i], b = mid[i - 10];
        if (Number.isNaN(a) || Number.isNaN(b)) continue;
        if (a > b) L[i] = 1; else if (a < b) Sh[i] = 1;
      }
      return { L, S: Sh };
    },
  },
  {
    k: 't_aroon', cat: 'trend', title: 'Aroon yönü',
    desc: 'Aroon Up 70 üzerindeyse long; Aroon Down 70 üzerindeyse short girişine izin verir.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('aroon25', () => ctx.calc('aroon', { p: 25 }));
      const U = r.lines['Aroon Up'], D = r.lines['Aroon Down'];
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (U[i] > 70) L[i] = 1; else if (D[i] > 70) Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 't_cloud', cat: 'trend', title: 'Ichimoku bulutu',
    desc: 'Fiyat bulutun üstündeyse long, altındaysa short girişine izin verir.',
    build(C, S, ctx) {
      const n = S.t.length, c = S.c;
      const r = C('ichi', () => ctx.calc('ichimoku'));
      const A = r.lines['Senkou A'], B = r.lines['Senkou B'];
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const a = A[i], b = B[i];
        if (Number.isNaN(a) || Number.isNaN(b)) continue;
        const top = Math.max(a, b), bot = Math.min(a, b);
        if (c[i] > top) L[i] = 1; else if (c[i] < bot) Sh[i] = 1;
      }
      return { L, S: Sh };
    },
  },
  {
    k: 't_psar', cat: 'trend', title: 'PSAR tarafı',
    desc: 'Fiyat PSAR üzerindeyse long, altındaysa short girişine izin verir.',
    build(C, S, ctx) {
      const n = S.t.length, c = S.c;
      const p = C('psar', () => ctx.L('psar', {}, 'PSAR'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = p[i]; if (!Number.isNaN(x)) { if (c[i] > x) L[i] = 1; else if (c[i] < x) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 't_ribbon', cat: 'trend', title: 'EMA şeridi (13/21/34)',
    desc: 'EMA13>EMA21>EMA34 ise long; ters dizilimse short girişine izin verir.',
    build(C, S, ctx) {
      const n = S.t.length;
      const e13 = C('ema13', () => ctx.L('ema', { p: 13 }, 'EMA13'));
      const e21 = C('ema21', () => ctx.L('ema', { p: 21 }, 'EMA21'));
      const e34 = C('ema34', () => ctx.L('ema', { p: 34 }, 'EMA34'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        if (e13[i] > e21[i] && e21[i] > e34[i]) L[i] = 1;
        else if (e13[i] < e21[i] && e21[i] < e34[i]) Sh[i] = 1;
      }
      return { L, S: Sh };
    },
  },
  {
    k: 't_break30', cat: 'trend', title: '30 bar kanalı',
    desc: 'Kapanış 30 barlık zirveye çok yakınsa long, dibe yakınsa short (kırılım tarafı).',
    build(C, S) {
      const n = S.t.length, c = S.c;
      const hi = rollMax(S.h, 30), lo = rollMin(S.l, 30);
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        if (Number.isNaN(hi[i])) continue;
        if (c[i] >= hi[i] * 0.995) L[i] = 1; else if (c[i] <= lo[i] * 1.005) Sh[i] = 1;
      }
      return { L, S: Sh };
    },
  },
  {
    k: 't_ema200_x', cat: 'contra', title: 'EMA200 tersi',
    desc: 'EMA200 üstünde SHORT, altında LONG girişine izin verir (kontra-trend).',
    build(C, S, ctx) {
      const n = S.t.length, c = S.c;
      const e = C('ema200', () => ctx.L('ema', { p: 200 }, 'EMA200'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = e[i]; if (!Number.isNaN(x)) { if (c[i] > x) Sh[i] = 1; else if (c[i] < x) L[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 't_htf_x', cat: 'contra', title: 'Üst TF trend tersi',
    desc: 'Üst zaman dilimi yükselişteyken SHORT, düşüşteyken LONG girişine izin verir.',
    build(C, S, ctx) {
      const n = S.t.length;
      const hd = C('htf4', () => ctx.higherDir(4, 20, 50));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (hd[i] === 1) Sh[i] = 1; else if (hd[i] === -1) L[i] = 1; }
      return { L, S: Sh };
    },
  },

  /* ============================== B · MOMENTUM ============================= */
  {
    k: 'm_rsi50', cat: 'momentum', title: 'RSI>50 tarafı',
    desc: 'RSI 50 üzerindeyse long, altındaysa short girişine izin verir.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('rsi14', () => ctx.L('rsi', { p: 14 }, 'RSI'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = r[i]; if (!Number.isNaN(x)) { if (x > 50) L[i] = 1; else if (x < 50) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'm_rsi_zone', cat: 'momentum', title: 'RSI aşırı bölge yasağı',
    desc: 'RSI 70 üzerindeyken long, 30 altındayken short girişini bloke eder (aşırı bölgede kovalamama).',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('rsi14', () => ctx.L('rsi', { p: 14 }, 'RSI'));
      const L = new Uint8Array(n).fill(1), Sh = new Uint8Array(n).fill(1);
      for (let i = 0; i < n; i++) { const x = r[i]; if (Number.isNaN(x)) { L[i] = 0; Sh[i] = 0; } else { if (x >= 70) L[i] = 0; if (x <= 30) Sh[i] = 0; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'm_macd', cat: 'momentum', title: 'MACD histogramı',
    desc: 'MACD-sinyal farkı pozitifse long, negatifse short girişine izin verir.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('macd', () => ctx.calc('macd'));
      const A = r.lines.MACD, B = r.lines.Sinyal;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const h = A[i] - B[i]; if (!Number.isNaN(h)) { if (h > 0) L[i] = 1; else if (h < 0) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'm_roc', cat: 'momentum', title: 'ROC>0 tarafı',
    desc: '9 barlık değişim oranı pozitifse long, negatifse short.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('roc9', () => ctx.L('roc', { p: 9 }, 'ROC'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = r[i]; if (!Number.isNaN(x)) { if (x > 0) L[i] = 1; else if (x < 0) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'm_tsi', cat: 'momentum', title: 'TSI yönü',
    desc: 'TSI pozitifse long, negatifse short girişine izin verir.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('tsi', () => ctx.calc('tsi'));
      const T = r.lines.TSI;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = T[i]; if (!Number.isNaN(x)) { if (x > 0) L[i] = 1; else if (x < 0) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'm_cmo', cat: 'momentum', title: 'CMO yönü',
    desc: 'Chande momentum osilatörü pozitifse long, negatifse short.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('cmo14', () => ctx.L('cmo', { p: 14 }, 'CMO'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = r[i]; if (!Number.isNaN(x)) { if (x > 0) L[i] = 1; else if (x < 0) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'm_ao', cat: 'momentum', title: 'AO yönü',
    desc: 'Awesome Osilatör pozitifse long, negatifse short.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('ao', () => ctx.L('ao', {}, 'AO'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = r[i]; if (!Number.isNaN(x)) { if (x > 0) L[i] = 1; else if (x < 0) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'm_stoch', cat: 'momentum', title: 'Stokastik %K/%D',
    desc: '%K, %D üzerindeyse long; altındaysa short girişine izin verir.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('stoch', () => ctx.calc('stoch'));
      const K = r.lines['%K'], D = r.lines['%D'];
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (K[i] > D[i]) L[i] = 1; else if (K[i] < D[i]) Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'm_mom', cat: 'momentum', title: 'Momentum(10) yönü',
    desc: '10 barlık momentum pozitifse long, negatifse short.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('mom10', () => ctx.L('mom', { p: 10 }, 'Momentum'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = r[i]; if (!Number.isNaN(x)) { if (x > 0) L[i] = 1; else if (x < 0) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'm_vote3', cat: 'momentum', title: '5 göstergeden 3 oy',
    desc: 'RSI, MACD hist., ROC, AO ve CMO\u2019dan en az 3\u2019ü aynı yöndeyse o yöne girişe izin verir.',
    build(C, S, ctx) {
      const n = S.t.length;
      const rsi = C('rsi14', () => ctx.L('rsi', { p: 14 }, 'RSI'));
      const r = C('macd', () => ctx.calc('macd'));
      const hist = C('macdhist', () => { const A = r.lines.MACD, B = r.lines.Sinyal; const h = new Float64Array(n); for (let i = 0; i < n; i++) h[i] = A[i] - B[i]; return h; });
      const roc = C('roc9', () => ctx.L('roc', { p: 9 }, 'ROC'));
      const ao = C('ao', () => ctx.L('ao', {}, 'AO'));
      const cmo = C('cmo14', () => ctx.L('cmo', { p: 14 }, 'CMO'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        let pos = 0, neg = 0;
        for (const arr of [rsi, hist, roc, ao, cmo]) { const x = arr[i]; if (Number.isNaN(x)) continue; if (x > 0) pos++; else if (x < 0) neg++; }
        if (pos >= 3) L[i] = 1; else if (neg >= 3) Sh[i] = 1;
      }
      return { L, S: Sh };
    },
  },
  {
    k: 'm_rsi50_x', cat: 'contra', title: 'RSI 50 tersi',
    desc: 'RSI 50 üstündeyken SHORT, altındayken LONG (kontra-momentum).',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('rsi14', () => ctx.L('rsi', { p: 14 }, 'RSI'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = r[i]; if (!Number.isNaN(x)) { if (x > 50) Sh[i] = 1; else if (x < 50) L[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'm_macd_x', cat: 'contra', title: 'MACD tersi',
    desc: 'MACD histogramı pozitifken SHORT, negatifken LONG (kontra-momentum).',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('macd', () => ctx.calc('macd'));
      const A = r.lines.MACD, B = r.lines.Sinyal;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const h = A[i] - B[i]; if (!Number.isNaN(h)) { if (h > 0) Sh[i] = 1; else if (h < 0) L[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'm_roc_x', cat: 'contra', title: 'ROC tersi',
    desc: 'ROC pozitifken SHORT, negatifken LONG.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('roc9', () => ctx.L('roc', { p: 9 }, 'ROC'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = r[i]; if (!Number.isNaN(x)) { if (x > 0) Sh[i] = 1; else if (x < 0) L[i] = 1; } }
      return { L, S: Sh };
    },
  },

  /* =========================== C · HACİM / LİKİDİTE ======================== */
  {
    k: 'v_above', cat: 'volume', title: 'Hacim ortalamanın üstü',
    desc: 'Bar hacmi 20 bar ortalamasının 1,2 katından fazlaysa girişe izin verir (katılım kapısı).',
    build(C, S) {
      const n = S.t.length, v = S.v;
      const m = C('sma20v', () => smaOf(v, 20));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (!Number.isNaN(m[i]) && v[i] > 1.2 * m[i]) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'v_rvol15', cat: 'volume', title: 'RVOL>1.5',
    desc: 'Göreli hacim 1,5 üzerindeyse girişe izin verir.',
    build(C, S) {
      const n = S.t.length, v = S.v;
      const m = C('sma20v', () => smaOf(v, 20));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (!Number.isNaN(m[i]) && v[i] > 1.5 * m[i]) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'v_volosc', cat: 'volume', title: 'Hacim osilatörü',
    desc: '5 barlık hacim ortalaması 20 barlığın üzerindeyse long, altındaysa short.',
    build(C, S) {
      const n = S.t.length, v = S.v;
      const m5 = C('sma5v', () => smaOf(v, 5));
      const m20 = C('sma20v', () => smaOf(v, 20));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (Number.isNaN(m5[i]) || Number.isNaN(m20[i])) continue; if (m5[i] > m20[i]) L[i] = 1; else if (m5[i] < m20[i]) Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'v_obv', cat: 'volume', title: 'OBV / EMA21',
    desc: 'OBV kendi EMA21\u2019inin üzerindeyse long, altındaysa short.',
    build(C, S, ctx) {
      const n = S.t.length;
      const obv = C('obv', () => ctx.L('obv', {}, 'OBV'));
      const e = C('obvEma21', () => emaOf(obv, 21));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (Number.isNaN(e[i])) continue; if (obv[i] > e[i]) L[i] = 1; else if (obv[i] < e[i]) Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'v_cmf', cat: 'volume', title: 'CMF pozitifliği',
    desc: 'Chaikin para akışı pozitifse long, negatifse short.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('cmf20', () => ctx.L('cmf', { p: 20 }, 'CMF'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = r[i]; if (!Number.isNaN(x)) { if (x > 0) L[i] = 1; else if (x < 0) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'v_mfi', cat: 'volume', title: 'MFI aşırı bölge yasağı',
    desc: 'MFI 80 üzerindeyken long, 20 altındayken short girişini bloke eder.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('mfi14', () => ctx.L('mfi', { p: 14 }, 'MFI'));
      const L = new Uint8Array(n).fill(1), Sh = new Uint8Array(n).fill(1);
      for (let i = 0; i < n; i++) { const x = r[i]; if (Number.isNaN(x)) { L[i] = 0; Sh[i] = 0; } else { if (x >= 80) L[i] = 0; if (x <= 20) Sh[i] = 0; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'v_force', cat: 'volume', title: 'Force Index yönü',
    desc: 'Kuvvet endeksi pozitifse long, negatifse short.',
    build(C, S, ctx) {
      const n = S.t.length;
      const r = C('force13', () => ctx.L('force', { p: 13 }, 'EMA 13'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = r[i]; if (!Number.isNaN(x)) { if (x > 0) L[i] = 1; else if (x < 0) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'v_dollarvol', cat: 'volume', title: 'Dolar hacmi ≥ medyan',
    desc: 'Bar dolar hacmi (fiyat×hacim) son 200 barın medyan bölgesindeyse (yüzdelik ≥%50) girişe izin verir.',
    build(C, S) {
      const n = S.t.length, c = S.c, v = S.v;
      const dv = C('dln', () => { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = Math.log(Math.max(c[i] * v[i], 1e-9)); return a; });
      const pct = C('dvPct', () => rankPct(dv, 200));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (!Number.isNaN(pct[i]) && pct[i] >= 0.5) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'v_shock_cap', cat: 'volume', title: 'Hacim şoku tavanı',
    desc: 'Hacim 20 bar ortalamasının 5 katından yüksekse girişi bloke eder (haber şoku barı).',
    build(C, S) {
      const n = S.t.length, v = S.v;
      const m = C('sma20v', () => smaOf(v, 20));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (!Number.isNaN(m[i]) && v[i] < 5 * m[i]) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },

  /* ============================ D · BTC / PİYASA =========================== */
  {
    k: 'b_btc_d1', cat: 'market', title: 'BTC 1d EMA50 tarafı',
    desc: 'BTC günlükte EMA50 üzerindeyse long, altındaysa short girişine izin verir.',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.btcEma50D1;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = m[i]; if (!Number.isNaN(x)) { if (x > 0) L[i] = 1; else if (x < 0) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'b_btc_4h', cat: 'market', title: 'BTC 4h trendi',
    desc: 'BTC 4 saatlik EMA20/50 yönüyle aynı yönde girişe izin verir.',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.btcDir4h;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (m[i] === 1) L[i] = 1; else if (m[i] === -1) Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'b_btc_ret7d', cat: 'market', title: 'BTC 7g getirisi',
    desc: 'BTC son 7 günde yükselmişse long, düşmüşse short girişine izin verir.',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.btcRet7d;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = m[i]; if (!Number.isNaN(x)) { if (x > 0) L[i] = 1; else if (x < 0) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'b_btc_dd', cat: 'market', title: 'BTC düşüş >%25 → long yasak',
    desc: 'BTC 90 günlük zirveden %25+ düşmüşse long girişini bloke eder (ayı rejimi).',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.btcDD90D1;
      const L = new Uint8Array(n).fill(1), Sh = new Uint8Array(n).fill(1);
      for (let i = 0; i < n; i++) { const x = m[i]; if (!Number.isNaN(x) && x < -0.25) L[i] = 0; }
      return { L, S: Sh };
    },
  },
  {
    k: 'b_btc_dd_x', cat: 'market', title: 'BTC düşüş >%20 → sadece long',
    desc: 'BTC 90 günlük zirveden %20+ düşmüşse yalnız long girişine izin verir (korkuda alım).',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.btcDD90D1;
      const L = new Uint8Array(n).fill(1), Sh = new Uint8Array(n).fill(1);
      for (let i = 0; i < n; i++) { const x = m[i]; if (!Number.isNaN(x) && x < -0.20) Sh[i] = 0; }
      return { L, S: Sh };
    },
  },
  {
    k: 'b_btc_volpct', cat: 'market', title: 'BTC vol ≥ %50 dilim',
    desc: 'BTC volatilitesi son 200 barın üst yarısındaysa girişe izin verir (hareket yakıtı).',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.btcVolPct;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (!Number.isNaN(m[i]) && m[i] >= 0.5) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'b_btc_dvol', cat: 'market', title: 'BTC dolar hacmi ≥ %50 dilim',
    desc: 'BTC dolar hacmi son 200 barın üst yarısındaysa girişe izin verir (likidite rejimi).',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.btcDvolPct;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (!Number.isNaN(m[i]) && m[i] >= 0.5) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'b_breadth', cat: 'market', title: 'Piyasa genişliği',
    desc: 'Sembollerin yarısından fazlası 1d EMA50 üstündeyse long, altındaysa short.',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.breadth;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = m[i]; if (!Number.isNaN(x)) { if (x >= 0.5) L[i] = 1; if (x <= 0.5) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'b_breadth_mom', cat: 'market', title: 'Genişlik momentumu',
    desc: 'Piyasa genişliği 5 gündür artıyorsa long, azalıyorsa short.',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.breadthMom;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = m[i]; if (!Number.isNaN(x)) { if (x > 0) L[i] = 1; else if (x < 0) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'b_mktvol', cat: 'market', title: 'Piyasa hacmi ≥ %50 dilim',
    desc: 'Tüm piyasanın 1 saatlik toplam hacmi 200 barın üst yarısındaysa girişe izin verir.',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.mktVolPct;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (!Number.isNaN(m[i]) && m[i] >= 0.5) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },

  /* ========================= KORKU / VOLATİLİTE =========================== */
  {
    k: 'e_fng_mod', cat: 'fear', title: 'F&G ılımlı bölge',
    desc: 'Korku&Açgözlülük 30 üzerindeyken long, 70 altındayken short girişine izin verir.',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.fng;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = m[i]; if (!Number.isNaN(x)) { if (x >= 30) L[i] = 1; if (x <= 70) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'e_fng_fear', cat: 'fear', title: 'Aşırı korkuda sadece long',
    desc: 'F&G 15 altındayken short girişini bloke eder (panikte satış yok).',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.fng;
      const L = new Uint8Array(n).fill(1), Sh = new Uint8Array(n).fill(1);
      for (let i = 0; i < n; i++) { const x = m[i]; if (!Number.isNaN(x) && x < 15) Sh[i] = 0; }
      return { L, S: Sh };
    },
  },
  {
    k: 'e_fng_greed', cat: 'fear', title: 'Aşırı açgözlülükte sadece short',
    desc: 'F&G 85 üzerindeyken long girişini bloke eder (coşkuda alım yok).',
    build(C, S, ctx, M) {
      const n = S.t.length, m = M.fng;
      const L = new Uint8Array(n).fill(1), Sh = new Uint8Array(n).fill(1);
      for (let i = 0; i < n; i++) { const x = m[i]; if (!Number.isNaN(x) && x > 85) L[i] = 0; }
      return { L, S: Sh };
    },
  },
  {
    k: 'e_atr_min', cat: 'fear', title: 'ATR% ≥ %80 normal',
    desc: 'ATR% son 200 bar ortalamasının en az %80\u2019indeyse girişe izin verir (maliyet/aktivite kapısı).',
    build(C, S, ctx) {
      const n = S.t.length, c = S.c;
      const atr = C('atr14', () => ctx.L('atr', { p: 14 }, 'ATR'));
      const rat = C('atrRatio', () => {
        const p = new Float64Array(n).fill(NaN);
        for (let i = 0; i < n; i++) if (c[i] > 0 && !Number.isNaN(atr[i])) p[i] = atr[i] / c[i];
        const avg = smaOf(p, 200);
        const r = new Float64Array(n).fill(NaN);
        for (let i = 0; i < n; i++) if (!Number.isNaN(p[i]) && !Number.isNaN(avg[i]) && avg[i] > 0) r[i] = p[i] / avg[i];
        return r;
      });
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (!Number.isNaN(rat[i]) && rat[i] >= 0.8) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'e_atr_high', cat: 'fear', title: 'ATR% ≥ %120 normal',
    desc: 'Yalnız yüksek volatilite rejiminde (ATR% ortalamanın 1,2 katı) girişe izin verir.',
    build(C, S, ctx) {
      const n = S.t.length, c = S.c;
      const atr = C('atr14', () => ctx.L('atr', { p: 14 }, 'ATR'));
      const rat = C('atrRatio', () => {
        const p = new Float64Array(n).fill(NaN);
        for (let i = 0; i < n; i++) if (c[i] > 0 && !Number.isNaN(atr[i])) p[i] = atr[i] / c[i];
        const avg = smaOf(p, 200);
        const r = new Float64Array(n).fill(NaN);
        for (let i = 0; i < n; i++) if (!Number.isNaN(p[i]) && !Number.isNaN(avg[i]) && avg[i] > 0) r[i] = p[i] / avg[i];
        return r;
      });
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (!Number.isNaN(rat[i]) && rat[i] >= 1.2) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },

  /* ============================= GÖRELİ GÜÇ =============================== */
  {
    k: 'f_relbtc', cat: 'rel', title: 'BTC\u2019ye göre güç (30g)',
    desc: 'Sembol BTC\u2019den daha iyi performans gösterdiyse long, kötüyse short.',
    build(C, S, ctx, M) {
      const n = S.t.length;
      const r30 = C('ret30', () => symRet(S, 30));
      const b = M.btcRet30d;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const x = r30[i], y = b[i];
        if (Number.isNaN(x) || Number.isNaN(y)) continue;
        const d = x - y;
        if (d > 0) L[i] = 1; else if (d < 0) Sh[i] = 1;
      }
      return { L, S: Sh };
    },
  },
  {
    k: 'f_own30', cat: 'rel', title: 'Kendi momentumu (30g)',
    desc: 'Sembol son 30 günde yükselmişse long, düşmüşse short.',
    build(C, S) {
      const n = S.t.length;
      const r30 = C('ret30', () => symRet(S, 30));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const x = r30[i]; if (!Number.isNaN(x)) { if (x > 0) L[i] = 1; else if (x < 0) Sh[i] = 1; } }
      return { L, S: Sh };
    },
  },
  {
    k: 'f_ema50slope', cat: 'rel', title: 'EMA50 eğimi',
    desc: 'EMA50 son 5 barda yükseliyorsa long, düşüyorsa short.',
    build(C, S, ctx) {
      const n = S.t.length;
      const e50 = C('ema50', () => ctx.L('ema', { p: 50 }, 'EMA50'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 5; i < n; i++) {
        const a = e50[i], b = e50[i - 5];
        if (Number.isNaN(a) || Number.isNaN(b)) continue;
        if (a > b) L[i] = 1; else if (a < b) Sh[i] = 1;
      }
      return { L, S: Sh };
    },
  },

  /* ============================== TAKVİM ================================== */
  {
    k: 'g_weekend', cat: 'cal', title: 'Hafta sonu yasağı',
    desc: 'Cumartesi/Pazar sinyalleriyle girişi bloke eder (UTC).',
    build(C, S) {
      const n = S.t.length;
      const dow = C('dow', () => {
        const a = new Int8Array(n);
        for (let i = 0; i < n; i++) a[i] = (Math.floor(S.t[i] / DAY) + 4) % 7;
        return a;
      });
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (dow[i] !== 0 && dow[i] !== 6) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'g_deadhours', cat: 'cal', title: 'Ölü saatler (00-06 UTC)',
    desc: 'UTC 00:00-05:59 arası sinyallerle girişi bloke eder (düşük likidite).',
    build(C, S) {
      const n = S.t.length;
      const hr = C('hour', () => {
        const a = new Int8Array(n);
        for (let i = 0; i < n; i++) a[i] = Math.floor((S.t[i] % DAY) / 3600000);
        return a;
      });
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (hr[i] >= 6) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'g_ussession', cat: 'cal', title: 'ABD seansı (13-21 UTC)',
    desc: 'Yalnız 13:00-20:59 UTC arası sinyallerle girişe izin verir (en likit saatler).',
    build(C, S) {
      const n = S.t.length;
      const hr = C('hour', () => {
        const a = new Int8Array(n);
        for (let i = 0; i < n; i++) a[i] = Math.floor((S.t[i] % DAY) / 3600000);
        return a;
      });
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (hr[i] >= 13 && hr[i] < 21) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'g_friday_late', cat: 'cal', title: 'Cuma geç saat yasağı',
    desc: 'Cuma 20:00 UTC sonrası sinyallerle girişi bloke eder (hafta sonu riski).',
    build(C, S) {
      const n = S.t.length;
      const dow = C('dow', () => {
        const a = new Int8Array(n);
        for (let i = 0; i < n; i++) a[i] = (Math.floor(S.t[i] / DAY) + 4) % 7;
        return a;
      });
      const hr = C('hour', () => {
        const a = new Int8Array(n);
        for (let i = 0; i < n; i++) a[i] = Math.floor((S.t[i] % DAY) / 3600000);
        return a;
      });
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (!(dow[i] === 5 && hr[i] >= 20)) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },

  /* =========================== İŞLEM BAĞLAMI ============================== */
  {
    k: 'h_candle', cat: 'ctx', title: 'Sinyal barı yönü',
    desc: 'Sinyal barı yeşilse long, kırmızıysa short girişine izin verir (bar uyumu).',
    build(C, S) {
      const n = S.t.length, c = S.c, o = S.o;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) { if (c[i] > o[i]) L[i] = 1; else if (c[i] < o[i]) Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'h_notext', cat: 'ctx', title: 'Aşırı uzamada giriş yok',
    desc: 'Kapanış EMA20\u2019den 2×ATR\u2019den fazla uzaklaşmışsa girişi bloke eder (geç kalma koruması).',
    build(C, S, ctx) {
      const n = S.t.length, c = S.c;
      const e20 = C('ema20', () => ctx.L('ema', { p: 20 }, 'EMA20'));
      const atr = C('atr14', () => ctx.L('atr', { p: 14 }, 'ATR'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const d = Math.abs(c[i] - e20[i]);
        if (!Number.isNaN(d) && !Number.isNaN(atr[i]) && d < 2 * atr[i]) { L[i] = 1; Sh[i] = 1; }
      }
      return { L, S: Sh };
    },
  },
  {
    k: 'h_ext', cat: 'ctx', title: 'Yalnız uzama anında',
    desc: 'Kapanış EMA20\u2019den 2×ATR\u2019den fazla uzaklaşmışsa girişe izin verir (momentum kovalama).',
    build(C, S, ctx) {
      const n = S.t.length, c = S.c;
      const e20 = C('ema20', () => ctx.L('ema', { p: 20 }, 'EMA20'));
      const atr = C('atr14', () => ctx.L('atr', { p: 14 }, 'ATR'));
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const d = Math.abs(c[i] - e20[i]);
        if (!Number.isNaN(d) && !Number.isNaN(atr[i]) && d >= 2 * atr[i]) { L[i] = 1; Sh[i] = 1; }
      }
      return { L, S: Sh };
    },
  },
  {
    k: 'h_funding', cat: 'ctx', title: 'Funding aşırılığı',
    desc: 'Funding +%0,03 üzerindeyken long, -%0,03 altındayken short girişini bloke eder (kalabalık taraf).',
    build(C, S, ctx) {
      const n = S.t.length;
      const L = new Uint8Array(n).fill(1), Sh = new Uint8Array(n).fill(1);
      const fund = ctx.fund;
      if (fund && fund.t.length) {
        const tfMs = TF_MS[ctx.tf];
        let k = 0, last = 0;
        for (let i = 0; i < n; i++) {
          const ct = S.t[i] + tfMs;
          while (k < fund.t.length && fund.t[k] <= ct) { last = fund.cum[k + 1] - fund.cum[k]; k++; }
          if (k > 0) { if (last > 0.0003) L[i] = 0; if (last < -0.0003) Sh[i] = 0; }
        }
      }
      return { L, S: Sh };
    },
  },

  /* =========================== VERİ KALİTESİ =============================== */
  {
    k: 'i_age90', cat: 'data', title: 'Listeleme yaşı ≥90g',
    desc: 'Sembolün ilk 90 gününde girişi bloke eder (yeni listeleme davranışı farklıdır).',
    build(C, S) {
      const n = S.t.length;
      const lim = S.t[0] + 90 * DAY;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) if (S.t[i] >= lim) { L[i] = 1; Sh[i] = 1; }
      return { L, S: Sh };
    },
  },
  {
    k: 'i_nosane', cat: 'data', title: 'Anomali barı yasağı',
    desc: 'Tek barda %50\u2019den büyük fiyat sıçraması varsa girişi bloke eder (veri hatası/şok koruması).',
    build(C, S) {
      const n = S.t.length, c = S.c;
      const L = new Uint8Array(n), Sh = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        if (i === 0) { L[i] = 1; Sh[i] = 1; continue; }
        const r = Math.abs(c[i] / c[i - 1] - 1);
        if (r < 0.5) { L[i] = 1; Sh[i] = 1; }
      }
      return { L, S: Sh };
    },
  },
];

// 30 günlük getiri (sembol) — iki işaretçi, lookahead yok
function symRet(S, days) {
  const n = S.t.length, need = days * DAY;
  const out = new Float64Array(n).fill(NaN);
  let j = -1;
  for (let i = 0; i < n; i++) {
    while (j + 1 < i && S.t[j + 1] <= S.t[i] - need) j++;
    if (j >= 0 && j < i && S.t[i] - S.t[j] >= need) out[i] = S.c[i] / S.c[j] - 1;
  }
  return out;
}

export const FILTER_BY_KEY = Object.fromEntries(FILTERS.map((f) => [f.k, f]));

// İki grup: A = trend+momentum+rel, B = hacim+piyasa+korku+takvim+bağlam+veri
export const FILTER_GROUPS = {
  A: FILTERS.filter((f) => ['trend', 'momentum', 'rel', 'contra'].includes(f.cat)).map((f) => f.k),
  B: FILTERS.filter((f) => !['trend', 'momentum', 'rel', 'contra'].includes(f.cat)).map((f) => f.k),
};

// İstenen anahtarlar için kapıları üret
export function buildGates(ctx, M, only) {
  const S = ctx.S;
  const n = S.t.length;
  const cache = new Map();
  const C = (key, fn) => { let v = cache.get(key); if (v === undefined) { v = fn(); cache.set(key, v); } return v; };
  const onlySet = only ? new Set(only) : null;
  const L = {}, Sh = {};
  for (const f of FILTERS) {
    if (onlySet && !onlySet.has(f.k)) continue;
    const g = f.build(C, S, ctx, M);
    L[f.k] = g.L; Sh[f.k] = g.S;
  }
  return { L, S: Sh, n };
}
