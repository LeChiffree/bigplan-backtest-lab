// Smoke 1: dataload.mjs (bin cache) davranışı io.mjs ile BİREBİR mi?
import { io, TF_MS } from './core.mjs';
import { loadSeriesC, makeCtx } from './dataload.mjs';

const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const tfs = ['5m', '15m', '1h', '4h', '1d', '1w'];
let bad = 0, checks = 0;

function eqArr(a, b, label) {
  checks++;
  if (a.length !== b.length) { console.log('  UZUNLUK FARKI', label, a.length, b.length); bad++; return; }
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (Number.isNaN(x) && Number.isNaN(y)) continue;
    if (x !== y) { console.log('  FARK', label, 'i=' + i, x, y); bad++; return; }
  }
}

for (const s of symbols) {
  for (const tf of tfs) {
    const A = await io.loadSeries(tf, s);          // orijinal (CSV'den, cache'siz)
    const B = await loadSeriesC(tf, s, { noBin: true, noMem: true }); // benim okuma (CSV'den, binsiz)
    for (const nm of ['t', 'o', 'h', 'l', 'c', 'v']) eqArr(A[nm], B[nm], `${s} ${tf} ${nm}`);
    console.log(`${s} ${tf}: ${A.t.length} bar`);
  }
}

// ctx karşılaştırması: birkaç gösterge serisi birebir mi?
for (const s of ['BTCUSDT']) {
  for (const tf of ['4h', '1d']) {
    const ctxA = await io.makeCtx(tf, s);
    const ctxB = await makeCtx(tf, s);
    for (const [name, params, line] of [
      ['rsi', { p: 14 }, 'RSI'], ['ema', { p: 50 }, 'EMA50'], ['atr', { p: 14 }, 'ATR'],
      ['supertrend', { p: 10, m: 3 }, 'Supertrend'], ['chop', { p: 14 }, 'Choppiness'],
      ['adx', { p: 14 }, 'ADX'], ['mfi', { p: 14 }, 'MFI'], ['cmf', { p: 20 }, 'CMF'],
    ]) {
      const a = ctxA.L(name, params, line);
      const b = ctxB.L(name, params, line);
      eqArr(a, b, `${s} ${tf} ${name}.${line}`);
    }
    console.log(`${s} ${tf} ctx karşılaştırması yapıldı`);
  }
}

console.log(bad === 0 ? `SMOKE1 OK (${checks} kontrol)` : `SMOKE1 HATA: ${bad}/${checks}`);
process.exit(bad === 0 ? 0 : 1);
