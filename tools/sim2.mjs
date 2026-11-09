// İndikatör Akademi · Filtre Laboratuvarı — Çok durumlu simülasyon çekirdeği
// sim.mjs matematiği BİREBİR korunur (açılış emirleri, bar içi stop, ters
// dönüş, maxBars, funding, komisyon, ısınma). Tek fark: K adet sanal portföy
// aynı sinyal okumasını paylaşarak paralel koşar; her durumun YENİ GİRİŞLERİ
// kendi kapı dizisiyle (gateL/gateS) süzülür.
//
// SÖZLEŞME: Çıkış sinyalleri HER DURUMDA aynen uygulanır. Filtre yalnızca
// yeni girişi bloke eder; bloke edilen ters dönüşte pozisyon kapanır ama
// karşı yönde yeni pozisyon açılmaz (düz kalınır).
import { fundingCost, FEE, SLIP, SIDE } from './core.mjs';

export { FEE, SLIP, SIDE };

// gateL/gateS: K uzunluğunda Uint8Array dizisi (eleman uzunluğu = bar sayısı).
//   gateL[k][i]===1 → k durumunda bar i kapanış sinyaliyle LONG giriş serbest.
// trackers (opsiyonel): agg2.StateTracker örnekleri; kapanan her işlem
//   trackers[k].onTrade(r, bars, xt) ile bildirilir.
export function simulateMulti(spec, ctx, gateL, gateS, trackers) {
  const S = ctx.S;
  const n = S.t.length;
  const B = spec.load(ctx) || {};
  const K = gateL.length;

  // otomatik ısınma: en geç geçerli olan seri + pay (sim.mjs birebir)
  let start = spec.warmup || 0;
  for (const v of Object.values(B)) {
    if (v instanceof Float64Array) {
      let fi = 0;
      while (fi < v.length && Number.isNaN(v[fi])) fi++;
      if (fi > start) start = fi;
    }
  }
  start = Math.max(start, 40);
  start = Math.min(start + 2, Math.max(0, n - 40));

  const allowShort = spec.dir !== 'long';

  // stop hazırlığı (sim.mjs birebir)
  const stopCfg = spec.stop || null;
  let atrArr = null, natrArr = null, lvlLong = null, lvlShort = null;
  if (stopCfg) {
    if (stopCfg.kind === 'atr') atrArr = ctx.L('atr', { p: stopCfg.p || 14 }, 'ATR');
    else if (stopCfg.kind === 'natr') natrArr = ctx.L('natr', { p: stopCfg.p || 14 }, 'NATR');
    else if (stopCfg.kind === 'level') { lvlLong = B[stopCfg.arr]; lvlShort = B[stopCfg.arrShort] || B[stopCfg.arr]; }
  }

  // durum dizileri
  const pos = new Int8Array(K);
  const entryI = new Int32Array(K);
  const entryP = new Float64Array(K);
  const entryT = new Float64Array(K);
  const stopP = new Float64Array(K).fill(NaN);
  const hhA = new Float64Array(K).fill(-Infinity);
  const llA = new Float64Array(K).fill(Infinity);
  const barsHeld = new Int32Array(K);
  const pendingExit = new Uint8Array(K);
  const pendingEntry = new Int8Array(K);

  let errCount = 0, firstErr = null;

  const closeTrade = (k, exitI, exitP, reason = 2) => {
    const t1 = S.t[exitI];
    let r;
    if (pos[k] === 1) r = (exitP * (1 - SIDE)) / (entryP[k] * (1 + SIDE)) - 1;
    else r = (entryP[k] * (1 - SIDE)) / (exitP * (1 + SIDE)) - 1;
    const fc = fundingCost(ctx.fund, entryT[k], t1);
    r -= pos[k] === 1 ? fc : -fc;
    if (r < -0.999) r = -0.999;
    if (trackers) trackers[k].onTrade(r, exitI - entryI[k], t1, pos[k], reason);
    pos[k] = 0; stopP[k] = NaN; barsHeld[k] = 0;
  };

  const openPos = (k, d, i) => {
    const p = S.o[i];
    if (!(p > 0)) return;
    pos[k] = d; entryI[k] = i; entryP[k] = p; entryT[k] = S.t[i];
    hhA[k] = S.h[i]; llA[k] = S.l[i]; barsHeld[k] = 0; stopP[k] = NaN;
    if (stopCfg) {
      if (atrArr) { const a = atrArr[i]; stopP[k] = d === 1 ? p - stopCfg.mult * a : p + stopCfg.mult * a; }
      else if (natrArr) { const a = natrArr[i]; stopP[k] = d === 1 ? p * (1 - stopCfg.mult * a / 100) : p * (1 + stopCfg.mult * a / 100); }
      else if (lvlLong) { stopP[k] = d === 1 ? lvlLong[i] : lvlShort[i]; }
      else if (stopCfg.kind === 'pct') stopP[k] = d === 1 ? p * (1 - stopCfg.pct / 100) : p * (1 + stopCfg.pct / 100);
      if (Number.isNaN(stopP[k])) stopP[k] = NaN;
    }
  };

  const hasExit = !!spec.exit;
  const atrMult = stopCfg && atrArr ? stopCfg.mult : 0;

  for (let i = start; i < n; i++) {
    const o = S.o[i], h = S.h[i], l = S.l[i];

    // 1) bekleyen emirler bu barın açılışında
    for (let k = 0; k < K; k++) {
      if (pos[k] !== 0 && pendingExit[k]) { closeTrade(k, i, o, pendingExit[k]); pendingExit[k] = 0; }
      if (pos[k] === 0 && pendingEntry[k] !== 0 && i < n - 1) { openPos(k, pendingEntry[k], i); pendingEntry[k] = 0; }
    }

    // 2) bar içi stop (giriş barından sonra)
    for (let k = 0; k < K; k++) {
      if (pos[k] !== 0 && barsHeld[k] >= 1 && !Number.isNaN(stopP[k])) {
        const sp = stopP[k];
        if (pos[k] === 1 && l <= sp) closeTrade(k, i, o < sp ? o : sp, 0);
        else if (pos[k] === -1 && h >= sp) closeTrade(k, i, o > sp ? o : sp, 0);
      }
    }
    // trailing güncellemesi + bar sayacı
    for (let k = 0; k < K; k++) {
      if (pos[k] !== 0) {
        barsHeld[k]++;
        if (atrMult) {
          if (h > hhA[k]) hhA[k] = h;
          if (l < llA[k]) llA[k] = l;
          const a = atrArr[i];
          if (pos[k] === 1) { const v = hhA[k] - atrMult * a; if (v > stopP[k]) stopP[k] = v; }
          else { const v = llA[k] + atrMult * a; if (v < stopP[k]) stopP[k] = v; }
        }
      }
    }

    // 3) kapanışta sinyal
    if (i >= n - 1) break;

    // paylaşılan sinyal okumaları: bar başına en fazla 1 entry + 2 exit çağrısı
    let e1 = false, e2 = false;
    if (hasExit) {
      let need1 = false, need2 = false;
      for (let k = 0; k < K; k++) {
        if (pos[k] === 1) need1 = true;
        else if (pos[k] === -1) need2 = true;
        if (need1 && need2) break;
      }
      if (need1) { try { e1 = !!spec.exit(S, B, i, 1); } catch (e) { if (!errCount) firstErr = e.message; errCount++; } }
      if (need2) { try { e2 = !!spec.exit(S, B, i, -1); } catch (e) { if (!errCount) firstErr = e.message; errCount++; } }
    }
    let d = 0;
    try { d = spec.entry(S, B, i) | 0; } catch (e) { if (!errCount) firstErr = e.message; errCount++; d = 0; }

    for (let k = 0; k < K; k++) {
      if (pos[k] === 0) {
        let dd = d;
        if (dd === -1 && !allowShort) dd = 0;
        if (dd !== 0 && (dd === 1 ? gateL[k][i] : gateS[k][i])) pendingEntry[k] = dd;
      } else {
        let wantExit = pos[k] === 1 ? e1 : e2;
        let flip = 0;
        if (!wantExit && allowShort && d === -pos[k]) flip = d;
        let maxB = false;
        if (spec.maxBars && barsHeld[k] >= spec.maxBars) { wantExit = true; maxB = true; }
        if (wantExit) pendingExit[k] = maxB ? 3 : 1;
        if (flip !== 0) {
          pendingExit[k] = 2;
          if (flip === 1 ? gateL[k][i] : gateS[k][i]) pendingEntry[k] = flip;
        }
      }
    }
  }

  // dönem sonu açık pozisyonlar
  const lastC = S.c[n - 1];
  for (let k = 0; k < K; k++) if (pos[k] !== 0) closeTrade(k, n - 1, lastC, 3);

  return { start, errCount, firstErr, K };
}
