(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('BD').textContent);
  var GRID = D.grid, STATES = D.states, SYMS = D.symbols, KEYTITLE = D.keyTitle || {};
  var DATES = new Array(GRID.len);
  for (var i = 0; i < GRID.len; i++) DATES[i] = GRID.start + i * GRID.step;
  var YEARS = new Array(GRID.len);
  for (var i2 = 0; i2 < GRID.len; i2++) YEARS[i2] = new Date(DATES[i2]).getUTCFullYear();
  var byKey = new Map();
  for (var i3 = 0; i3 < STATES.length; i3++) byKey.set(STATES[i3].key, STATES[i3]);
  var ALL_YEARS = [2022, 2023, 2024, 2025, 2026];
  var LEVS = [1, 2, 5, 10, 15, 20];
  var VOL = D.vol || { sets: [], annual: [], rank: [] };
  var RET_EDGES = [-1, -0.2, -0.1, -0.05, -0.02, -0.01, 0, 0.01, 0.02, 0.05, 0.1, 0.2, Infinity];

  // her durum için tüm kaldıraç seviyelerini önceden hesapla (tam dönem, günlük eğri)
  function levRun(dret, L) {
    var eq = 1, peak = 1, dd = 0, liq = false, liqDay = null;
    for (var i = 0; i < dret.length; i++) {
      var g = 1 + L * (dret[i] / 10000);
      if (g <= 0) { eq = 0; liq = true; liqDay = i; break; }
      eq *= g; if (eq > peak) peak = eq; var d = eq / peak - 1; if (d < dd) dd = d;
    }
    return { net: eq - 1, dd: dd, liq: liq, liqDay: liqDay };
  }
  for (var si0 = 0; si0 < STATES.length; si0++) {
    STATES[si0].lv = {};
    for (var li0 = 0; li0 < LEVS.length; li0++) STATES[si0].lv[LEVS[li0]] = levRun(STATES[si0].dret, LEVS[li0]);
    // hacim setleri: 1x net/DD + tüm kaldıraç seviyeleri (top-N)
    if (STATES[si0].dretSets) {
      var sv0 = STATES[si0];
      sv0.netSets = sv0.dretSets.map(function (dr) { return levRun(dr, 1).net; });
      sv0.ddSets = sv0.dretSets.map(function (dr) { return levRun(dr, 1).dd; });
      sv0.lvSets = sv0.dretSets.map(function (dr) {
        return LEVS.map(function (L) { return levRun(dr, L); });
      });
    }
  }

  var C = { bg: '#0b0e14', panel: '#141a25', line: '#253049', line2: '#1d2638', tx: '#e8ecf4', dim: '#93a0b8', dim2: '#697692', acc: '#6ea8fe', pos: '#3fbf7f', neg: '#ef5b5b', warn: '#f4b942', gold: '#ffd479' };

  var S = {
    selected: null, tfs: new Set(), id: 'all', kind: 'all', key: 'all',
    years: new Set(ALL_YEARS), minTrades: 0, minNet: -1000, q: '', sort: 'net',
    hourShift: 0, coin: null, dailyClip: true, lev: 1, vol: null,
  };
  var view = null;

  function el(id) { return document.getElementById(id); }
  function nf(v) { return new Intl.NumberFormat('tr-TR').format(v); }
  function fmtInt(v) { return v == null || !isFinite(v) ? '—' : nf(Math.round(v)); }
  function fmtPct(v, d) { if (v == null || !isFinite(v)) return '—'; d = d == null ? 1 : d; v = v * 100; return (v >= 0 ? '+' : '') + v.toFixed(d) + '%'; }
  // aşırı büyük yüzdeleri kısalt (kaldıraç bileşik patlaması)
  function fmtPctC(v) {
    if (v == null || !isFinite(v)) return '—';
    var p = v * 100, a = Math.abs(p), s = p >= 0 ? '+' : '-';
    if (a < 1e4) return (p >= 0 ? '+' : '') + p.toFixed(a < 100 ? 1 : 0) + '%';
    if (a < 1e6) return s + (a / 1e3).toFixed(1) + 'k%';
    if (a < 1e9) return s + (a / 1e6).toFixed(1) + 'M%';
    if (a < 1e12) return s + (a / 1e9).toFixed(1) + 'G%';
    return s + (a / 1e12).toFixed(1) + 'T%';
  }
  function fmtAxisPct(v) {
    var a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a < 1e4) return v.toFixed(0) + '%';
    if (a < 1e6) return s + (a / 1e3).toFixed(0) + 'k%';
    if (a < 1e9) return s + (a / 1e6).toFixed(0) + 'M%';
    return s + (a / 1e9).toFixed(0) + 'G%';
  }
  function fmtDD(v) { if (v == null || !isFinite(v)) return '—'; var p = v * 100; return (p > -100 && p < -99 ? p.toFixed(2) : p.toFixed(1)) + '%'; }
  function fmtPlainPct(v, d) { if (v == null || !isFinite(v)) return '—'; d = d == null ? 1 : d; return (v * 100).toFixed(d) + '%'; }
  function fmtDur(h) {
    if (h == null || !isFinite(h)) return '—';
    if (h < 1) return Math.round(h * 60) + ' dk';
    if (h < 48) return h.toFixed(1) + ' sa';
    if (h < 24 * 90) return (h / 24).toFixed(1) + ' gün';
    return (h / 24 / 30).toFixed(1) + ' ay';
  }
  function fmtDate(i) { var d = new Date(DATES[i]); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function addArr(dst, src) { for (var i = 0; i < dst.length; i++) dst[i] += src[i]; }
  function B(arr, i) { var o = i * 5; return { n: arr[o], w: arr[o + 1], sumR: arr[o + 2], sumLog: arr[o + 3], durSum: arr[o + 4] }; }
  function symName(ci) { var s = SYMS[ci] || '?'; return s.replace(/USDT$/, ''); }

  /* ------------------------------------------------------------------ view */
  function volIdx() { return VOL.sets ? VOL.sets.indexOf(S.vol) : -1; }
  function inVol(ci) { return S.vol == null || !VOL.rank || !VOL.rank[ci] || VOL.rank[ci] <= S.vol; }
  function stateNet(s) { var i = volIdx(); return (S.vol != null && s.netSets && s.netSets[i] != null) ? s.netSets[i] : s.net; }
  function stateDD(s) { var i = volIdx(); return (S.vol != null && s.ddSets && s.ddSets[i] != null) ? s.ddSets[i] : s.dd; }
  function stateN(s) { var i = volIdx(); return (S.vol != null && s.sets && s.sets[i]) ? s.sets[i].n : s.n; }
  function stateLev(s) {
    var i = volIdx();
    if (S.vol != null && s.lvSets && s.lvSets[i]) {
      var li = LEVS.indexOf(S.lev);
      if (li >= 0) return s.lvSets[i][li] || { net: 0, dd: 0, liq: false, liqDay: null };
    }
    return s.lv[S.lev];
  }
  function stateDret(s) { var i = volIdx(); return (S.vol != null && s.dretSets && s.dretSets[i]) ? s.dretSets[i] : s.dret; }
  function stateAgg(st) {
    if (S.vol == null || !st.sets) return st.agg;
    var i = volIdx();
    if (i < 0) return st.agg;
    var set = st.sets[i], rank = VOL.rank || [];
    function keep(e) { return !rank[e[0]] || rank[e[0]] <= S.vol; }
    var years = set.years.map(function (Y, y) {
      var orig = st.agg.years[y];
      return {
        n: Y.n, w: Y.w, sumR: Y.sumR, sumLog: Y.sumLog, durSum: Y.durSum,
        coin: orig ? orig.coin.filter(keep) : [],
        dow: Y.dow, month: Y.month, season: Y.season, hour: Y.hour, dur: Y.dur, ret: Y.ret,
      };
    });
    return {
      n: set.n, w: set.w, sumR: set.sumR, sumLog: set.sumLog, durSum: set.durSum,
      coins: st.agg.coins.filter(keep), years: years,
      samples: st.agg.samples.filter(function (s) { return keep([s[2]]); }),
    };
  }

  function filteredStates() {
    var q = S.q;
    var arr = STATES.filter(function (s) {
      if (S.tfs.size && !S.tfs.has(s.tf)) return false;
      if (S.id !== 'all' && s.id !== S.id) return false;
      if (S.kind !== 'all' && s.kind !== S.kind) return false;
      if (S.key !== 'all' && s.keys.indexOf(S.key) < 0) return false;
      if (stateN(s) < S.minTrades) return false;
      if (stateNet(s) * 100 < S.minNet) return false;
      if (q) { var str = (s.id + ' ' + s.ad + ' ' + s.tf + ' ' + s.kind + ' ' + s.keyTitles.join(' ')).toLowerCase(); if (str.indexOf(q) < 0) return false; }
      return true;
    });
    var k = S.sort, dir = -1;
    arr.sort(function (a, b) {
      var x, y;
      if (k === 'net') { x = stateNet(a); y = stateNet(b); }
      else if (k === 'r2') { x = a.r2 || 0; y = b.r2 || 0; }
      else if (k === 'n') { x = stateN(a); y = stateN(b); }
      else if (k === 'dd') { x = stateDD(a) || 0; y = stateDD(b) || 0; dir = 1; }
      else if (k === 'top5') { x = a.top5Gun || 0; y = b.top5Gun || 0; dir = 1; }
      return (x - y) * dir;
    });
    return arr;
  }

  function computeView() {
    var list = filteredStates();
    var states = (S.selected && byKey.get(S.selected)) ? [byKey.get(S.selected)] : list;
    var yidx = ALL_YEARS.filter(function (y) { return S.years.has(y); }).map(function (y) { return y - 2022; });
    var tot = { n: 0, w: 0, sumR: 0, sumLog: 0, durSum: 0 };
    var coins = new Map();
    var dow = new Float64Array(35), month = new Float64Array(60), season = new Float64Array(20), hour = new Float64Array(40), dur = new Float64Array(40), ret = new Float64Array(12);
    for (var si = 0; si < states.length; si++) {
      var st = states[si];
      var A = stateAgg(st);
      for (var yi = 0; yi < yidx.length; yi++) {
        var Y = A.years[yidx[yi]];
        if (!Y) continue;
        tot.n += Y.n; tot.w += Y.w; tot.sumR += Y.sumR; tot.sumLog += Y.sumLog; tot.durSum += Y.durSum;
        for (var ci = 0; ci < Y.coin.length; ci++) {
          var e = Y.coin[ci], a = coins.get(e[0]);
          if (!a) { a = [0, 0, 0, 0, 0, 0, 0]; coins.set(e[0], a); }
          a[0] += e[1]; a[1] += e[2]; a[2] += e[3]; a[3] += e[4]; a[4] += e[5];
          a[5] += e[6] || 0; a[6] += e[7] || 0;
        }
        addArr(dow, Y.dow); addArr(month, Y.month); addArr(season, Y.season); addArr(hour, Y.hour); addArr(dur, Y.dur);
        for (var b = 0; b < 12; b++) ret[b] += Y.ret[b];
      }
    }
    var sumBps = new Float64Array(GRID.len);
    for (var si2 = 0; si2 < states.length; si2++) {
      var dr = stateDret(states[si2]);
      for (var d = 0; d < GRID.len; d++) sumBps[d] += dr[d];
    }
    var base = [];
    for (var d2 = 0; d2 < GRID.len; d2++) {
      if (!S.years.has(YEARS[d2])) continue;
      base.push({ i: d2, bps: states.length ? sumBps[d2] / states.length : 0 });
    }
    var L = S.lev, daily = [], eq = 1, eq1 = 1, liq = false, liqDay = null;
    for (var b2 = 0; b2 < base.length; b2++) {
      var r = base[b2].bps / 10000, g = 1 + L * r;
      eq1 *= 1 + r;
      if (g <= 0) { daily.push({ i: base[b2].i, bps: -10000, cum: 0 }); liq = true; liqDay = base[b2].i; break; }
      eq *= g;
      daily.push({ i: base[b2].i, bps: Math.max(-10000, base[b2].bps * L), cum: eq });
    }
    var samples = [];
    for (var si3 = 0; si3 < states.length; si3++) {
      var smp = stateAgg(states[si3]).samples;
      for (var k = 0; k < smp.length; k++) if (S.years.has(2022 + smp[k][3])) samples.push(smp[k]);
    }
    if (samples.length > 600) { var stp = Math.ceil(samples.length / 600); samples = samples.filter(function (_, i) { return i % stp === 0; }).slice(0, 600); }
    view = { list: list, states: states, tot: tot, coins: coins, dow: dow, month: month, season: season, hour: hour, dur: dur, ret: ret, retL: leverHist(ret, L), daily: daily, base: base, samples: samples, liq: liq, liqDay: liqDay, net1: eq1 - 1 };
  }

  // işlem getirisi histogramını kaldıraca göre ölçekle (tasfiye -100%'e toplanır)
  function leverHist(counts, L) {
    var out = [];
    function add(lo, hi, c, lq) {
      if (!c) return;
      lo = Math.max(-1, lo);
      for (var i = 0; i < out.length; i++) if (out[i].lo === lo && out[i].hi === hi && out[i].liq === lq) { out[i].count += c; return; }
      out.push({ lo: lo, hi: hi, count: c, liq: lq });
    }
    for (var i = 0; i < 12; i++) {
      var c = counts[i]; if (!c) continue;
      var lo = RET_EDGES[i], hi = RET_EDGES[i + 1];
      var llo = Math.max(-1, L * lo), lhi = (hi === Infinity) ? Infinity : Math.max(-1, L * hi);
      if (lhi <= -1) { add(-1, -1, c, true); continue; }
      var thr = -1 / L;
      if (lo < thr) {
        var frac = Math.min(1, Math.max(0, (thr - lo) / (hi - lo)));
        add(-1, -1, c * frac, true);
        add(-1, lhi, c * (1 - frac), false);
      } else {
        add(llo, lhi, c, false);
      }
    }
    out.sort(function (a, b) { return a.lo - b.lo; });
    return out;
  }

  function maxDD(daily) { var peak = 1, dd = 0; for (var i = 0; i < daily.length; i++) { if (daily[i].cum > peak) peak = daily[i].cum; var x = daily[i].cum / peak - 1; if (x < dd) dd = x; } return dd; }

  /* ------------------------------------------------------------------ charts */
  var tip = el('tip');
  function showTip(html, x, y) {
    tip.innerHTML = html; tip.style.display = 'block';
    var r = tip.getBoundingClientRect();
    var tx = x + 14, ty = y + 14;
    if (tx + r.width > window.innerWidth - 8) tx = x - r.width - 14;
    if (ty + r.height > window.innerHeight - 8) ty = y - r.height - 14;
    tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
  }
  function hideTip() { tip.style.display = 'none'; }
  function attach(cv) {
    cv.addEventListener('mousemove', function (e) {
      var r = cv.getBoundingClientRect();
      var hit = cv._hit ? cv._hit(e.clientX - r.left, e.clientY - r.top) : null;
      if (hit) { showTip(hit.html, e.clientX, e.clientY); cv.style.cursor = hit.cursor || 'default'; } else { hideTip(); cv.style.cursor = 'default'; }
    });
    cv.addEventListener('mouseleave', function () { hideTip(); });
    cv.addEventListener('click', function (e) {
      if (!cv._click) return;
      var r = cv.getBoundingClientRect();
      cv._click(e.clientX - r.left, e.clientY - r.top);
    });
  }
  function prep(cv) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(220, cv.clientWidth || 600), h = cv.clientHeight || 260;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '10px system-ui, Segoe UI, Arial';
    ctx.textBaseline = 'middle';
    return { ctx: ctx, w: w, h: h };
  }
  function emptyCard(cv, msg) {
    var p = prep(cv);
    p.ctx.fillStyle = C.dim2; p.ctx.textAlign = 'center';
    p.ctx.fillText(msg || 'Gösterilecek veri yok', p.w / 2, p.h / 2);
    cv._hit = null;
  }
  function axisY(ctx, x, y0, y1, min, max, fmt, side) {
    ctx.textAlign = side === 'left' ? 'right' : 'left';
    for (var i = 0; i <= 4; i++) {
      var v = min + (max - min) * i / 4, y = y0 + (1 - i / 4) * (y1 - y0);
      ctx.strokeStyle = C.line2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (side === 'left' ? -4 : 4), y); ctx.stroke();
      ctx.fillStyle = C.dim2;
      ctx.fillText(fmt(v), x + (side === 'left' ? -6 : 6), y);
    }
  }

  function drawDaily() {
    var cv = el('cDaily');
    if (!view.daily.length) return emptyCard(cv, 'Seçili filtre için durum yok');
    var p = prep(cv), ctx = p.ctx, w = p.w, h = p.h;
    var pad = { l: 46, r: 52, t: 14, b: 26 };
    var x0 = pad.l, x1 = w - pad.r, y0 = pad.t, y1 = h - pad.b;
    var daily = view.daily, n = daily.length;
    var absList = [], minC = 0, maxC = 0;
    for (var i = 0; i < n; i++) { absList.push(Math.abs(daily[i].bps / 100)); var c = (daily[i].cum - 1) * 100; if (c < minC) minC = c; if (c > maxC) maxC = c; }
    absList.sort(function (a, b) { return a - b; });
    var fullMax = absList[n - 1] || 1;
    var p99 = absList[Math.min(n - 1, Math.floor(n * 0.99))] || fullMax;
    var maxB = S.dailyClip ? Math.max(p99, fullMax * 0.03) : fullMax;
    if (!(maxB > 0)) maxB = 1;
    var clipCount = 0;
    for (var ic = 0; ic < n; ic++) if (Math.abs(daily[ic].bps / 100) > maxB) clipCount++;
    if (maxC <= 0 && minC >= 0) maxC = 1;
    var spanC = Math.max(1, maxC - minC); minC -= spanC * 0.06; maxC += spanC * 0.06;
    var syB = function (v) { return y0 + (1 - (v + maxB) / (2 * maxB)) * (y1 - y0); };
    var syC = function (v) { return y0 + (1 - (v - minC) / (maxC - minC)) * (y1 - y0); };
    var X = function (k) { return x0 + (k + 0.5) * (x1 - x0) / n; };
    // zero + grid
    ctx.strokeStyle = C.line2; ctx.lineWidth = 1;
    for (var g = 0; g <= 4; g++) { var yy = y0 + g * (y1 - y0) / 4; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
    ctx.strokeStyle = '#3a4a68';
    ctx.beginPath(); ctx.moveTo(x0, syB(0)); ctx.lineTo(x1, syB(0)); ctx.stroke();
    // bars
    var bw = Math.max(1, (x1 - x0) / n * 0.72);
    for (var i2 = 0; i2 < n; i2++) {
      var v = daily[i2].bps / 100;
      var vc = Math.max(-maxB, Math.min(maxB, v));
      ctx.fillStyle = v >= 0 ? 'rgba(63,191,127,.85)' : 'rgba(239,91,91,.85)';
      var yv = syB(vc), yz = syB(0);
      ctx.fillRect(X(i2) - bw / 2, Math.min(yv, yz), bw, Math.max(1, Math.abs(yv - yz)));
    }
    // cumulative line
    ctx.strokeStyle = C.acc; ctx.lineWidth = 1.7; ctx.beginPath();
    for (var i4 = 0; i4 < n; i4++) { var px = X(i4), py = syC((daily[i4].cum - 1) * 100); if (i4 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.stroke();
    // axes labels
    ctx.fillStyle = C.dim2;
    ctx.textAlign = 'left'; ctx.fillText('günlük %', x0 - 42, y0 + 6);
    ctx.textAlign = 'right'; ctx.fillText('kümülatif %', x1 + 48, y0 + 6);
    axisY(ctx, x0, y0, y1, -maxB, maxB, function (v) { return v.toFixed(1); }, 'left');
    axisY(ctx, x1, y0, y1, minC, maxC, fmtAxisPct, 'right');
    // time labels
    ctx.textAlign = 'center'; ctx.fillStyle = C.dim2;
    var prevY = null, drawn = 0;
    for (var i5 = 0; i5 < n; i5++) {
      var y = YEARS[daily[i5].i];
      if (i5 === 0 || y !== prevY) {
        if (drawn % 1 === 0) {
          var xx = X(i5);
          ctx.strokeStyle = C.line2; ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y1); ctx.stroke();
          ctx.fillText(String(y), xx + 10, y1 + 13);
        }
        prevY = y; drawn++;
      }
    }
    ctx.fillStyle = C.dim2; ctx.textAlign = 'center';
    ctx.fillText(fmtDate(daily[0].i), x0 + 26, y1 + 13);
    ctx.fillText(fmtDate(daily[n - 1].i), x1 - 30, y1 + 13);
    if (clipCount) { ctx.fillStyle = C.warn; ctx.textAlign = 'center'; ctx.fillText(clipCount + ' uç gün ±' + maxB.toFixed(1) + '% dışında kırpıldı', (x0 + x1) / 2, y0 + 6); }
    if (view.liq) { ctx.fillStyle = C.neg; ctx.textAlign = 'left'; ctx.fillText('TASFİYE · ' + fmtDate(view.liqDay), x0 + 4, y0 + 6); }
    cv._hit = function (mx, my) {
      if (mx < x0 - 6 || mx > x1 + 6) return null;
      var k = Math.max(0, Math.min(n - 1, Math.round((mx - x0) / (x1 - x0) * n - 0.5)));
      var d = daily[k];
      return { html: '<b>' + fmtDate(d.i) + '</b><br><span class="d">Günlük:</span> ' + (d.bps >= 0 ? '+' : '') + (d.bps / 100).toFixed(2) + '%<br><span class="d">Kümülatif:</span> ' + ((d.cum - 1) * 100 >= 0 ? '+' : '') + ((d.cum - 1) * 100).toFixed(1) + '%' };
    };
  }

  function drawCum() {
    var cv = el('cCum');
    if (!view.daily.length) return emptyCard(cv);
    var p = prep(cv), ctx = p.ctx, w = p.w, h = p.h;
    var pad = { l: 46, r: 14, t: 14, b: 26 };
    var x0 = pad.l, x1 = w - pad.r, y0 = pad.t, y1 = h - pad.b;
    var daily = view.daily, n = daily.length;
    var min = 0, max = 0;
    for (var i = 0; i < n; i++) { var c = (daily[i].cum - 1) * 100; if (c < min) min = c; if (c > max) max = c; }
    var span = Math.max(1, max - min); min -= span * 0.05; max += span * 0.08;
    var X = function (k) { return x0 + k * (x1 - x0) / Math.max(1, n - 1); };
    var Y = function (v) { return y0 + (1 - (v - min) / (max - min)) * (y1 - y0); };
    ctx.strokeStyle = C.line2;
    for (var g = 0; g <= 4; g++) { var yy = y0 + g * (y1 - y0) / 4; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
    var zy = Y(0);
    ctx.strokeStyle = '#3a4a68'; ctx.beginPath(); ctx.moveTo(x0, zy); ctx.lineTo(x1, zy); ctx.stroke();
    // peak + DD shading
    var peak = daily[0].cum, dd = 0, ddAt = 0;
    ctx.beginPath();
    for (var i2 = 0; i2 < n; i2++) { var v2 = daily[i2].cum; if (v2 > peak) peak = v2; var ddv = v2 / peak - 1; if (ddv < dd) { dd = ddv; ddAt = i2; } }
    ctx.moveTo(X(0), Y((daily[0].cum - 1) * 100));
    for (var i3 = 0; i3 < n; i3++) ctx.lineTo(X(i3), Y((daily[i3].cum - 1) * 100));
    ctx.lineTo(X(n - 1), zy); ctx.lineTo(X(0), zy); ctx.closePath();
    ctx.fillStyle = 'rgba(110,168,254,.10)'; ctx.fill();
    // drawdown fill (peak vs cum)
    ctx.beginPath();
    var pk = daily[0].cum;
    for (var i4 = 0; i4 < n; i4++) { if (daily[i4].cum > pk) pk = daily[i4].cum; var xx = X(i4); if (i4 === 0) ctx.moveTo(xx, Y((pk - 1) * 100)); else ctx.lineTo(xx, Y((pk - 1) * 100)); }
    for (var i5 = n - 1; i5 >= 0; i5--) ctx.lineTo(X(i5), Y((daily[i5].cum - 1) * 100));
    ctx.closePath(); ctx.fillStyle = 'rgba(239,91,91,.12)'; ctx.fill();
    // line
    ctx.strokeStyle = C.acc; ctx.lineWidth = 1.8; ctx.beginPath();
    for (var i6 = 0; i6 < n; i6++) { var px = X(i6), py = Y((daily[i6].cum - 1) * 100); if (i6 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.stroke();
    // max DD marker
    if (ddAt) {
      var mx = X(ddAt), my = Y((daily[ddAt].cum - 1) * 100);
      ctx.fillStyle = C.neg; ctx.beginPath(); ctx.arc(mx, my, 3.2, 0, 6.284); ctx.fill();
      ctx.fillStyle = C.neg; ctx.textAlign = 'left';
      ctx.fillText('maks DD ' + (dd * 100).toFixed(1) + '%', mx + 6, my);
    }
    axisY(ctx, x0, y0, y1, min, max, fmtAxisPct, 'left');
    if (view.liq) { var lx = X(n - 1), ly = Y((daily[n - 1].cum - 1) * 100); ctx.fillStyle = C.neg; ctx.textAlign = 'right'; ctx.fillText('TASFİYE · ' + fmtDate(view.liqDay), lx - 4, Math.max(y0 + 8, ly - 10)); }
    ctx.fillStyle = C.dim2; ctx.textAlign = 'center';
    ctx.fillText(fmtDate(daily[0].i), x0 + 26, y1 + 13);
    ctx.fillText(fmtDate(daily[n - 1].i), x1 - 30, y1 + 13);
    cv._hit = function (mx) {
      if (mx < x0 - 6 || mx > x1 + 6) return null;
      var k = Math.max(0, Math.min(n - 1, Math.round((mx - x0) / (x1 - x0) * (n - 1))));
      var d = daily[k];
      return { html: '<b>' + fmtDate(d.i) + '</b><br><span class="d">Kümülatif:</span> ' + ((d.cum - 1) * 100 >= 0 ? '+' : '') + ((d.cum - 1) * 100).toFixed(1) + '%<br><span class="d">Günlük:</span> ' + (d.bps >= 0 ? '+' : '') + (d.bps / 100).toFixed(2) + '%' };
    };
  }

  var RET_LABELS = ['<-20', '-20..-10', '-10..-5', '-5..-2', '-2..-1', '-1..0', '0..1', '1..2', '2..5', '5..10', '10..20', '>20'];
  function retBinLabel(b) {
    if (b.liq) return '-100 tasfiye';
    function p(v) { return Math.round(v * 100); }
    if (b.hi === Infinity) return '>' + p(b.lo);
    if (b.lo === b.hi) return p(b.lo) + '';
    return p(b.lo) + '..' + p(b.hi);
  }
  function drawRet() {
    var cv = el('cRet');
    var bins = view.retL;
    var vals = bins.map(function (b) { return b.count; });
    var total = vals.reduce(function (a, b) { return a + b; }, 0);
    if (!total) return emptyCard(cv);
    var p = prep(cv), ctx = p.ctx, w = p.w, h = p.h;
    var pad = { l: 40, r: 10, t: 12, b: 44 };
    var x0 = pad.l, x1 = w - pad.r, y0 = pad.t, y1 = h - pad.b;
    var max = Math.max.apply(null, vals) || 1;
    ctx.strokeStyle = C.line2;
    for (var g = 0; g <= 4; g++) { var yy = y0 + g * (y1 - y0) / 4; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
    axisY(ctx, x0, y0, y1, 0, max, function (v) { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v); }, 'left');
    var nb = bins.length, slot = (x1 - x0) / nb, bw = Math.min(56, slot * 0.68), regions = [];
    for (var i = 0; i < nb; i++) {
      var cx = x0 + slot * (i + 0.5);
      var b = bins[i];
      var col = b.liq ? 'rgba(210,40,40,.9)' : (b.hi <= 0 ? 'rgba(239,91,91,.8)' : (b.lo >= 0 ? 'rgba(63,191,127,.8)' : 'rgba(150,150,170,.7)'));
      ctx.fillStyle = col;
      var hh = vals[i] / max * (y1 - y0);
      ctx.fillRect(cx - bw / 2, y1 - hh, bw, hh);
      regions.push([cx - bw / 2, cx + bw / 2, i]);
    }
    ctx.fillStyle = C.dim2;
    for (var i2 = 0; i2 < nb; i2++) {
      var cx2 = x0 + slot * (i2 + 0.5);
      ctx.save(); ctx.translate(cx2, y1 + 8); ctx.rotate(-Math.PI / 5); ctx.textAlign = 'right';
      ctx.fillText(retBinLabel(bins[i2]) + '%', 0, 0); ctx.restore();
    }
    cv._hit = function (mx, my) {
      for (var r = 0; r < regions.length; r++) { var q = regions[r]; if (mx >= q[0] && mx <= q[1]) { var c = vals[q[2]]; return { html: '<b>' + retBinLabel(bins[q[2]]) + '%</b><br><span class="d">İşlem:</span> ' + fmtInt(c) + '<br><span class="d">Pay:</span> ' + (c / total * 100).toFixed(1) + '%' + (S.lev > 1 ? '<br><span class="d">Kaldıraç:</span> ' + S.lev + 'x' : '') }; } }
      return null;
    };
  }

  function coinRows() {
    var arr = [];
    view.coins.forEach(function (a, ci) { arr.push({ ci: ci, n: a[0], w: a[1], sumR: a[2], sumLog: a[3], durSum: a[4], sumPos: a[5] || 0, sumNeg: a[6] || 0 }); });
    arr.sort(function (a, b) { return b.sumR - a.sumR; });
    var sel = arr;
    if (arr.length > 30) sel = arr.slice(0, 16).concat(arr.slice(-16));
    var seen = new Set(); sel = sel.filter(function (x) { if (seen.has(x.ci)) return false; seen.add(x.ci); return true; });
    sel.sort(function (a, b) { return b.sumR - a.sumR; });
    return sel;
  }
  function drawCoin() {
    var cv = el('cCoin');
    var rows = coinRows();
    if (!rows.length) return emptyCard(cv);
    var p = prep(cv), ctx = p.ctx, w = p.w, h = p.h;
    var pad = { l: 96, r: 66, t: 16, b: 26 };
    var x0 = pad.l, x1 = w - pad.r, y0 = pad.t, y1 = h - pad.b;
    var L = S.lev;
    var prof = rows.map(function (r) { return r.sumPos * 100 * L; });
    var loss = rows.map(function (r) { return r.sumNeg * 100 * L; });
    var M = Math.max(1e-6, Math.max.apply(null, prof), Math.max.apply(null, loss)) * 1.08;
    var X = function (v) { return x0 + (v + M) / (2 * M) * (x1 - x0); };
    var zx = X(0);
    // ızgara + eksen etiketleri
    ctx.strokeStyle = C.line2; ctx.lineWidth = 1; ctx.font = '10px system-ui,sans-serif';
    for (var g = -2; g <= 2; g++) {
      if (g === 0) continue;
      var gx = X(M * g / 2);
      ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y1); ctx.stroke();
      ctx.fillStyle = C.dim2; ctx.textAlign = 'center';
      ctx.fillText(fmtAxisPct(M * g / 2), gx, y0 - 4);
    }
    ctx.strokeStyle = '#3a4a68'; ctx.beginPath(); ctx.moveTo(zx, y0); ctx.lineTo(zx, y1); ctx.stroke();
    ctx.fillStyle = C.dim2; ctx.textAlign = 'center'; ctx.fillText('0', zx, y0 - 4);
    var rh = (y1 - y0) / rows.length;
    var regions = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], cy = y0 + rh * i + rh / 2;
      var pw = prof[i], lw = loss[i], net = pw - lw;
      if (lw > 0) { ctx.fillStyle = 'rgba(239,91,91,.85)'; var lx = X(-lw); ctx.fillRect(lx, cy - rh * 0.32, Math.max(1, zx - lx), rh * 0.64); }
      if (pw > 0) { ctx.fillStyle = 'rgba(63,191,127,.85)'; ctx.fillRect(zx, cy - rh * 0.32, Math.max(1, X(pw) - zx), rh * 0.64); }
      ctx.fillStyle = C.dim; ctx.textAlign = 'right';
      ctx.fillText(symName(r.ci).slice(0, 13), x0 - 6, cy);
      ctx.fillStyle = net >= 0 ? C.pos : C.neg; ctx.textAlign = 'left';
      ctx.fillText((net >= 0 ? '+' : '') + fmtAxisPct(net), x1 + 6, cy);
      regions.push([y0 + rh * i, y0 + rh * (i + 1), r]);
    }
    ctx.fillStyle = C.dim2; ctx.textAlign = 'left';
    ctx.fillText('brüt kâr (sağa, yeşil) · brüt zarar (sola, kırmızı) · r toplamı' + (L > 1 ? ' · ' + L + 'x' : ''), x0 - 90, y1 + 18);
    cv._hit = function (mx, my) {
      for (var i = 0; i < regions.length; i++) {
        var q = regions[i];
        if (my >= q[0] && my < q[1]) {
          var r = q[2], L2 = S.lev;
          var pv = r.sumPos * 100 * L2, lz = r.sumNeg * 100 * L2, net = pv - lz;
          return { html: '<b>' + SYMS[r.ci] + '</b><br><span class="d">Kâr:</span> +' + pv.toFixed(1) + '%<br><span class="d">Zarar:</span> −' + lz.toFixed(1) + '%<br><span class="d">Net:</span> ' + (net >= 0 ? '+' : '') + net.toFixed(1) + '%<br><span class="d">İşlem:</span> ' + fmtInt(r.n) + ' · <span class="d">Kazanma:</span> ' + (r.n ? (r.w / r.n * 100).toFixed(1) : '—') + '%<br><span class="d">Ort. süre:</span> ' + fmtDur(r.n ? r.durSum / r.n : 0) + (L2 > 1 ? '<br><span class="d">Not:</span> ' + L2 + 'x ölçekli' : ''), cursor: 'pointer' };
        }
      }
      return null;
    };
    cv._click = function (mx, my) { var hit = cv._hit(mx, my); if (hit) { var m = hit.html.match(/<b>(.*?)<\/b>/); var sym = m ? m[1] : null; if (sym) { var ci = SYMS.indexOf(sym); if (ci >= 0) { S.coin = ci; renderCoinDetail(); } } } };
  }

  var DUR_LABELS = ['<1sa', '1-6sa', '6-24sa', '1-3g', '3-7g', '1-4h', '1-3a', '>3a'];
  function drawDur() {
    var cv = el('cDur');
    var rows = [];
    for (var i = 0; i < 8; i++) rows.push(B(view.dur, i));
    var total = rows.reduce(function (a, r) { return a + r.n; }, 0);
    if (!total) return emptyCard(cv);
    var p = prep(cv), ctx = p.ctx, w = p.w, h = p.h;
    var pad = { l: 42, r: 46, t: 14, b: 34 };
    var x0 = pad.l, x1 = w - pad.r, y0 = pad.t, y1 = h - pad.b;
    var max = Math.max.apply(null, rows.map(function (r) { return r.n; })) || 1;
    ctx.strokeStyle = C.line2;
    for (var g = 0; g <= 4; g++) { var yy = y0 + g * (y1 - y0) / 4; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
    axisY(ctx, x0, y0, y1, 0, max, function (v) { return v >= 1000 ? (v / 1000).toFixed(0) + 'k' : Math.round(v); }, 'left');
    var avg = rows.map(function (r) { return r.n ? (r.sumR / r.n) * S.lev : 0; });
    var maxAbs = Math.max.apply(null, avg.map(function (v) { return Math.abs(v); })) || 1e-9;
    var YR = function (v) { return y0 + (1 - (v + maxAbs) / (2 * maxAbs)) * (y1 - y0); };
    var slot = (x1 - x0) / 8, bw = slot * 0.62;
    var regions = [];
    for (var i2 = 0; i2 < 8; i2++) {
      var cx = x0 + slot * (i2 + 0.5);
      ctx.fillStyle = 'rgba(110,168,254,.55)';
      var hh = rows[i2].n / max * (y1 - y0);
      ctx.fillRect(cx - bw / 2, y1 - hh, bw, hh);
      ctx.fillStyle = C.dim2; ctx.textAlign = 'center';
      ctx.fillText(DUR_LABELS[i2], cx, y1 + 13);
      regions.push([cx - bw / 2, cx + bw / 2, 0, y1, i2]);
    }
    ctx.strokeStyle = C.warn; ctx.lineWidth = 1.7; ctx.beginPath();
    for (var i3 = 0; i3 < 8; i3++) {
      var cx2 = x0 + slot * (i3 + 0.5), py = YR(avg[i3]);
      if (i3 === 0) ctx.moveTo(cx2, py); else ctx.lineTo(cx2, py);
    }
    ctx.stroke();
    for (var i4 = 0; i4 < 8; i4++) { var cx3 = x0 + slot * (i4 + 0.5); ctx.fillStyle = C.warn; ctx.beginPath(); ctx.arc(cx3, YR(avg[i4]), 2.6, 0, 6.284); ctx.fill(); }
    ctx.fillStyle = C.warn; ctx.textAlign = 'right';
    ctx.fillText('ort. getiri %', x1 + 44, y0 + 6);
    axisY(ctx, x1, y0, y1, -maxAbs * 100, maxAbs * 100, function (v) { return v.toFixed(1); }, 'right');
    cv._hit = function (mx, my) {
      for (var i = 0; i < regions.length; i++) {
        var q = regions[i];
        if (mx >= q[0] && mx <= q[1]) {
          var r = rows[q[4]];
          return { html: '<b>' + DUR_LABELS[q[4]] + '</b><br><span class="d">İşlem:</span> ' + fmtInt(r.n) + ' (' + (r.n / total * 100).toFixed(1) + '%)<br><span class="d">Ort. getiri:</span> ' + fmtPct(r.n ? (r.sumR / r.n) * S.lev : 0, 2) + '<br><span class="d">r toplamı:</span> ' + (r.sumR * 100 * S.lev >= 0 ? '+' : '') + (r.sumR * 100 * S.lev).toFixed(1) + '%' + (S.lev > 1 ? ' (' + S.lev + 'x)' : '') + '<br><span class="d">Kazanma:</span> ' + (r.n ? (r.w / r.n * 100).toFixed(1) : '—') + '%<br><span class="d">Ort. süre:</span> ' + fmtDur(r.n ? r.durSum / r.n : 0) };
        }
      }
      return null;
    };
  }

  function drawScatter() {
    var cv = el('cScatter');
    var smp = view.samples;
    if (!smp.length) return emptyCard(cv);
    var p = prep(cv), ctx = p.ctx, w = p.w, h = p.h;
    var pad = { l: 42, r: 12, t: 14, b: 30 };
    var x0 = pad.l, x1 = w - pad.r, y0 = pad.t, y1 = h - pad.b;
    var clip = 50;
    var X = function (hours) { var l = Math.log10(Math.max(0.05, hours)); return x0 + (l - Math.log10(0.1)) / (Math.log10(9000) - Math.log10(0.1)) * (x1 - x0); };
    var Y = function (r) { return y0 + (1 - (Math.max(-clip, Math.min(clip, r)) + clip) / (2 * clip)) * (y1 - y0); };
    ctx.strokeStyle = C.line2;
    for (var g = 0; g <= 4; g++) { var yy = y0 + g * (y1 - y0) / 4; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
    ctx.strokeStyle = '#3a4a68'; ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x1, Y(0)); ctx.stroke();
    var ticks = [[1, '1sa'], [6, '6sa'], [24, '1g'], [168, '1h'], [720, '1a']];
    ctx.fillStyle = C.dim2; ctx.textAlign = 'center';
    for (var t = 0; t < ticks.length; t++) { var xx = X(ticks[t][0]); ctx.strokeStyle = C.line2; ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y1); ctx.stroke(); ctx.fillText(ticks[t][1], xx, y1 + 12); }
    ctx.textAlign = 'left'; ctx.fillStyle = C.dim2; ctx.fillText('getiri %', x0 - 38, y0 + 6);
    axisY(ctx, x0, y0, y1, -clip, clip, function (v) { return v.toFixed(0); }, 'left');
    var pts = [];
    for (var i = 0; i < smp.length; i++) {
      var s = smp[i], rp = Math.max(-100, s[1] * S.lev), px = X(s[0]), py = Y(rp);
      pts.push({ x: px, y: py, s: s, rp: rp });
      ctx.fillStyle = rp >= 0 ? 'rgba(63,191,127,.55)' : 'rgba(239,91,91,.55)';
      ctx.beginPath(); ctx.arc(px, py, 1.8, 0, 6.284); ctx.fill();
    }
    var clipped = smp.filter(function (s) { return Math.abs(s[1] * S.lev) > clip; }).length;
    if (clipped) { ctx.fillStyle = C.dim2; ctx.textAlign = 'right'; ctx.fillText(clipped + ' uç işlem ±%50 dışında kırpıldı', x1, y0 + 6); }
    cv._hit = function (mx, my) {
      var best = null, bd = 64;
      for (var i = 0; i < pts.length; i++) { var dx = pts[i].x - mx, dy = pts[i].y - my, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = pts[i]; } }
      if (!best) return null;
      return { html: '<b>' + SYMS[best.s[2]] + '</b><br><span class="d">Süre:</span> ' + fmtDur(best.s[0]) + '<br><span class="d">İşlem getirisi:</span> ' + (best.rp >= 0 ? '+' : '') + best.rp.toFixed(2) + '%' + (S.lev > 1 ? ' (' + S.lev + 'x)' : '') };
    };
  }

  function drawCategory(cvId, labels, rows, note) {
    var cv = el(cvId);
    var total = rows.reduce(function (a, r) { return a + r.n; }, 0);
    if (!total) return emptyCard(cv, note || 'Gösterilecek veri yok');
    var p = prep(cv), ctx = p.ctx, w = p.w, h = p.h;
    var pad = { l: 44, r: 12, t: 12, b: 26 };
    var x0 = pad.l, x1 = w - pad.r, y0 = pad.t, y1 = h - pad.b;
    var vals = rows.map(function (r) { return r.sumR * 100 * S.lev; });
    var maxAbs = Math.max.apply(null, vals.map(function (v) { return Math.abs(v); })) || 1e-9;
    var Y = function (v) { return y0 + (1 - (v + maxAbs) / (2 * maxAbs)) * (y1 - y0); };
    ctx.strokeStyle = C.line2;
    for (var g = 0; g <= 4; g++) { var yy = y0 + g * (y1 - y0) / 4; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
    ctx.strokeStyle = '#3a4a68'; ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x1, Y(0)); ctx.stroke();
    var n = rows.length, slot = (x1 - x0) / n, bw = Math.min(54, slot * 0.6), regions = [];
    for (var i = 0; i < n; i++) {
      var cx = x0 + slot * (i + 0.5), v = vals[i], yv = Y(v), yz = Y(0);
      ctx.fillStyle = v >= 0 ? 'rgba(63,191,127,.85)' : 'rgba(239,91,91,.85)';
      ctx.fillRect(cx - bw / 2, Math.min(yv, yz), bw, Math.max(1, Math.abs(yv - yz)));
      ctx.fillStyle = C.dim2; ctx.textAlign = 'center';
      ctx.fillText(labels[i], cx, y1 + 12);
      regions.push([cx - bw / 2, cx + bw / 2, i]);
    }
    axisY(ctx, x0, y0, y1, -maxAbs, maxAbs, function (v) { return v.toFixed(1); }, 'left');
    ctx.fillStyle = C.dim2; ctx.textAlign = 'left'; ctx.fillText('%', x0 - 40, y0 + 6);
    cv._hit = function (mx, my) {
      for (var i = 0; i < regions.length; i++) {
        var q = regions[i];
        if (mx >= q[0] && mx <= q[1]) {
          var r = rows[q[2]];
          return { html: '<b>' + labels[q[2]] + '</b><br><span class="d">İşlem:</span> ' + fmtInt(r.n) + '<br><span class="d">r toplamı:</span> ' + (r.sumR * 100 * S.lev >= 0 ? '+' : '') + (r.sumR * 100 * S.lev).toFixed(1) + '%' + (S.lev > 1 ? ' (' + S.lev + 'x)' : '') + '<br><span class="d">Ort. getiri:</span> ' + fmtPct(r.n ? (r.sumR / r.n) * S.lev : 0, 2) + '<br><span class="d">Kazanma:</span> ' + (r.n ? (r.w / r.n * 100).toFixed(1) : '—') + '%' };
        }
      }
      return null;
    };
  }

  function drawDow() {
    var src = [1, 2, 3, 4, 5, 6, 0];
    var rows = src.map(function (i) { return B(view.dow, i); });
    drawCategory('cDow', ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'], rows);
  }
  function drawMonth() {
    var rows = [];
    for (var i = 0; i < 12; i++) rows.push(B(view.month, i));
    drawCategory('cMonth', ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'], rows);
  }
  function drawSeason() {
    var rows = [];
    for (var i = 0; i < 4; i++) rows.push(B(view.season, i));
    drawCategory('cSeason', ['Kış', 'İlkbahar', 'Yaz', 'Sonbahar'], rows);
  }
  function drawHour() {
    var rows = [];
    for (var d = 0; d < 8; d++) { var src = ((d - S.hourShift) % 8 + 8) % 8; rows.push(B(view.hour, src)); }
    var lab = ['00-03', '03-06', '06-09', '09-12', '12-15', '15-18', '18-21', '21-24'];
    var allDaily = view.states.length && view.states.every(function (s) { return s.tf === '1d' || s.tf === '1w'; });
    drawCategory('cHour', lab, rows, allDaily ? '1d/1w stratejilerinde girişler 00:00 UTC; saat dağılımı anlamsız' : null);
  }

  function drawAll() {
    drawDaily(); drawCum(); drawRet(); drawCoin(); drawDur(); drawScatter(); drawDow(); drawMonth(); drawSeason(); drawHour();
  }

  /* ------------------------------------------------------------------ UI */
  function chip(label, active, count, onClick) {
    var b = document.createElement('button');
    b.className = 'chip' + (active ? ' on' : '');
    b.innerHTML = esc(label) + (count != null ? '<span class="c">' + count + '</span>' : '');
    b.addEventListener('click', onClick);
    return b;
  }
  function initFilters() {
    renderFilterChips();
    // strategy
    var ids = Array.from(new Set(STATES.map(function (s) { return s.id; }))).sort();
    var sel = el('idSel'); sel.innerHTML = '<option value="all">Tüm stratejiler</option>';
    ids.forEach(function (id) { var o = document.createElement('option'); o.value = id; o.textContent = id + ' (' + STATES.filter(function (s) { return s.id === id; }).length + ')'; sel.appendChild(o); });
    sel.addEventListener('change', function () { S.id = sel.value; renderAll(); });
    // key
    var keys = Array.from(new Set(STATES.flatMap(function (s) { return s.keys; }))).sort(function (a, b) { return (KEYTITLE[a] || a).localeCompare(KEYTITLE[b] || b, 'tr'); });
    var ks = el('keySel'); ks.innerHTML = '<option value="all">Tüm filtre anahtarları</option>';
    keys.forEach(function (k) { var o = document.createElement('option'); o.value = k; o.textContent = (KEYTITLE[k] || k) + ' [' + k + ']'; ks.appendChild(o); });
    ks.addEventListener('change', function () { S.key = ks.value; renderAll(); });
    // sort
    var so = el('sortSel');
    so.addEventListener('change', function () { S.sort = so.value; renderAll(); });
    // inputs
    el('minN').addEventListener('input', function (e) { S.minTrades = +e.target.value || 0; renderAll(); });
    el('minNet').addEventListener('input', function (e) { S.minNet = e.target.value === '' ? -1000 : +e.target.value; renderAll(); });
    el('q').addEventListener('input', function (e) { S.q = e.target.value.trim().toLowerCase(); renderAll(); });
    el('reset').addEventListener('click', function () {
      S.selected = null; S.tfs.clear(); S.id = 'all'; S.kind = 'all'; S.key = 'all'; S.years = new Set(ALL_YEARS);
      S.minTrades = 0; S.minNet = -1000; S.q = ''; S.sort = 'net'; S.coin = null;
      S.hourShift = 0; S.dailyClip = true; S.lev = 1; S.vol = null;
      el('idSel').value = 'all'; el('keySel').value = 'all'; el('sortSel').value = 'net'; el('minN').value = ''; el('minNet').value = ''; el('q').value = '';
      renderAll();
    });
    // hour + daily toggles
    renderHourToggle();
    renderDailyToggle();
  }
  function renderFilterChips() {
    var tfC = el('tfChips'); tfC.innerHTML = '';
    var tfs = ['15m', '1h', '4h', '1d', '1w'];
    tfC.appendChild(chip('Tümü', S.tfs.size === 0, STATES.length, function () { S.tfs.clear(); renderAll(); }));
    tfs.forEach(function (tf) {
      var c = STATES.filter(function (s) { return s.tf === tf; }).length;
      tfC.appendChild(chip(tf, S.tfs.has(tf), c, function () { if (S.tfs.has(tf)) S.tfs.delete(tf); else S.tfs.add(tf); renderAll(); }));
    });
    var kC = el('kindChips'); kC.innerHTML = '';
    var kinds = [['all', 'Tümü'], ['temel', 'Temel'], ['varyant1', 'V1'], ['varyant2', 'V2'], ['varyant3', 'V3']];
    kinds.forEach(function (k) { kC.appendChild(chip(k[1], S.kind === k[0], null, function () { S.kind = k[0]; renderAll(); })); });
    var yC = el('yearChips'); yC.innerHTML = '';
    ALL_YEARS.forEach(function (y) {
      yC.appendChild(chip(String(y), S.years.has(y), null, function () {
        if (S.years.has(y)) { if (S.years.size > 1) S.years.delete(y); } else S.years.add(y);
        renderAll();
      }));
    });
    var vC = el('volChips');
    if (vC) {
      vC.innerHTML = '';
      vC.appendChild(chip('Tümü', S.vol == null, null, function () { if (S.vol != null) { S.vol = null; S.coin = null; renderAll(); } }));
      (VOL.sets || []).forEach(function (n) {
        vC.appendChild(chip(String(n), S.vol === n, null, function () { if (S.vol !== n) { S.vol = n; S.coin = null; renderAll(); } }));
      });
    }
    var lC = el('levChips'); if (!lC) return; lC.innerHTML = '';
    LEVS.forEach(function (L) { lC.appendChild(chip(L + 'x', S.lev === L, null, function () { S.lev = L; renderAll(); })); });
  }
  function renderHourToggle() {
    var ht = el('hourToggle'); if (!ht) return; ht.innerHTML = '';
    ht.appendChild(chip('UTC', S.hourShift === 0, null, function () { S.hourShift = 0; drawHour(); renderHourToggle(); }));
    ht.appendChild(chip('TRT +3', S.hourShift === 1, null, function () { S.hourShift = 1; drawHour(); renderHourToggle(); }));
  }
  function renderDailyToggle() {
    var dt = el('dailyToggle'); if (!dt) return; dt.innerHTML = '';
    dt.appendChild(chip('%99 kırp', S.dailyClip, null, function () { S.dailyClip = true; drawDaily(); renderDailyToggle(); }));
    dt.appendChild(chip('Tam ölçek', !S.dailyClip, null, function () { S.dailyClip = false; drawDaily(); renderDailyToggle(); }));
  }

  function renderList() {
    var list = view.list;
    var agg = el('aggBtn');
    var aggActive = !S.selected;
    agg.className = 'agg' + (aggActive ? ' on' : '');
    agg.innerHTML = '<b>Tümü · ' + list.length + ' durum</b><span>' + (S.selected ? 'Tıkla: seçimi kaldır, tümüne dön' : 'Eşit ağırlıklı strateji portföyü') + '</span>';
    var host = el('list'); host.innerHTML = '';
    var html = list.map(function (s) {
      var on = S.selected === s.key ? ' on' : '';
      var lv = stateLev(s), showNet = lv.net;
      var sn = stateN(s), sdd = stateDD(s);
      var liqTag = (S.lev > 1 && lv.liq) ? '<span class="tag" style="background:#3a1414;color:#ff9d9d">tasfiye</span>' : '';
      return '<div class="item' + on + '" data-key="' + s.key + '">' +
        '<div class="r1"><b>' + esc(s.id) + '</b><span class="tag tf">' + s.tf + '</span><span class="tag kind">' + (s.kind === 'temel' ? 'temel' : s.kind.replace('varyant', 'v')) + '</span>' + liqTag +
        '<span class="net ' + (showNet >= 0 ? 'v pos' : 'v neg') + '">' + fmtPctC(showNet) + '</span></div>' +
        '<div class="r2">' + fmtInt(sn) + ' işlem · R² ' + (s.r2 == null ? '—' : s.r2.toFixed(2)) + ' · DD ' + fmtDD(sdd) + ' · en iyi %5 gün ' + (s.top5Gun * 100).toFixed(0) + '%' + (S.lev > 1 ? ' · DD(' + S.lev + 'x) ' + fmtDD(lv.dd) : '') + '</div>' +
        '<div class="r3">' + esc(s.ad) + '</div></div>';
    }).join('');
    host.innerHTML = html || '<div style="padding:12px;color:#697692;font-size:11px">Filtreye uygun durum yok</div>';
    host.querySelectorAll('.item').forEach(function (it) {
      it.addEventListener('click', function () { S.selected = it.dataset.key; S.coin = null; renderAll(); });
    });
    var lc = el('listCount'); if (lc) lc.textContent = '(' + list.length + '/' + STATES.length + ')';
  }

  function renderHeader() {
    var single = S.selected ? byKey.get(S.selected) : null;
    var title = el('selTitle'), sub = el('selSub'), badges = el('selBadges');
    var levBadge = '<span class="badge' + (S.lev > 1 ? ' tf' : '') + '">' + S.lev + 'x kaldıraç</span>';
    var volBadge = S.vol != null ? '<span class="badge tf">en hacimli ' + S.vol + '</span>' : '<span class="badge">520 sembol</span>';
    var liqBadge = view.liq ? '<span class="badge" style="background:#3a1414;color:#ff9d9d;border-color:#6b2626">TASFİYE · ' + fmtDate(view.liqDay) + '</span>' : '';
    if (single) {
      title.textContent = single.id + ' · ' + single.tf + ' · ' + (single.kind === 'temel' ? 'temel' : single.kind.replace('varyant', 'v'));
      sub.textContent = single.ad + (single.keys.length ? '  (' + single.keyTitles.join(' + ') + ')' : '');
      var b = '<span class="badge ok">5/6 homojen aday</span><span class="badge tf">' + single.tf + '</span>' + volBadge + levBadge + liqBadge;
      if (single.kurt) b += '<span class="badge">kurtarılan hücre</span>';
      badges.innerHTML = b;
    } else {
      title.textContent = 'Tümü · ' + view.states.length + ' durum';
      sub.textContent = 'Eşit ağırlıklı strateji portföyü · seçili yıllar: ' + ALL_YEARS.filter(function (y) { return S.years.has(y); }).join(', ');
      badges.innerHTML = '<span class="badge ok">' + view.states.length + ' aday · 5/6</span>' + volBadge + '<span class="badge">2022-08 → 2026-09</span>' + levBadge + liqBadge;
    }
  }

  function avgMeta(k) {
    if (!view.states.length) return null;
    var s = 0, c = 0;
    for (var i = 0; i < view.states.length; i++) { var x = view.states[i][k]; if (x != null && isFinite(x)) { s += x; c++; } }
    return c ? s / c : null;
  }
  function renderKpis() {
    var t = view.tot;
    var net = view.daily.length ? view.daily[view.daily.length - 1].cum - 1 : 0;
    var dd = maxDD(view.daily);
    var wr = t.n ? t.w / t.n : 0, avg = t.n ? (t.sumR / t.n) * S.lev : 0, adur = t.n ? t.durSum / t.n : 0;
    var r2 = avgMeta('r2'), top5 = avgMeta('top5Gun'), pAy = avgMeta('pozAy');
    var ypos;
    if (view.states.length === 1) {
      var s0 = view.states[0];
      var pc = (s0.y23 > 0 ? 1 : 0) + (s0.y24 > 0 ? 1 : 0) + (s0.y25 > 0 ? 1 : 0);
      ypos = { v: pc + '/3', l: 'Pozitif yıl (23/24/25)', s: fmtPct(s0.y23, 0) + ' · ' + fmtPct(s0.y24, 0) + ' · ' + fmtPct(s0.y25, 0), c: pc === 3 ? 'pos' : 'warn' };
    } else {
      var counts = [2023, 2024, 2025].map(function (y) {
        var k = 'y' + String(y).slice(2);
        return view.states.filter(function (s) { return s[k] > 0; }).length;
      });
      ypos = { v: counts.join(' · ') + ' / ' + view.states.length, l: 'Pozitif yıl (23/24/25)', s: 'her yıl pozitif durum sayısı · ort. pozitif ay ' + (pAy == null ? '—' : (pAy * 100).toFixed(0) + '%'), c: 'acc' };
    }
    var cards = [
      { v: fmtPctC(net), l: 'Net kâr · ' + S.lev + 'x', s: '1x baz: ' + fmtPct(view.net1), c: net >= 0 ? 'pos' : 'neg' },
      { v: S.lev + 'x', l: 'Kaldıraç', s: view.liq ? 'TASFİYE · ' + fmtDate(view.liqDay) : 'tasfiye yok', c: view.liq ? 'neg' : 'acc' },
      { v: fmtInt(t.n), l: 'İşlem sayısı', s: view.states.length + ' durum', c: 'acc' },
      { v: (wr * 100).toFixed(1) + '%', l: 'Kazanma oranı', s: fmtInt(t.w) + ' kazanan işlem', c: 'acc' },
      { v: fmtPct(avg, 2), l: 'İşlem başına ort. getiri', s: S.lev > 1 ? S.lev + 'x ölçekli' : 'r ortalaması', c: avg >= 0 ? 'pos' : 'neg' },
      { v: fmtDD(dd), l: 'Maks düşüş (DD)', s: 'günlük eğri üzerinden', c: 'neg' },
      { v: fmtDur(adur), l: 'Ort. işlem süresi', s: 'toplam ' + fmtDur(t.durSum), c: 'warn' },
      { v: fmtInt(view.coins.size), l: 'İşlem gören coin', s: S.vol != null ? 'ilk ' + S.vol + ' hacim içinde' : '520 evren içinde', c: 'acc' },
      { v: r2 == null ? '—' : r2.toFixed(2), l: 'Ort. R² (doğrusallık)', s: 'en iyi %5 gün ' + (top5 == null ? '—' : (top5 * 100).toFixed(0) + '%') + (S.vol != null ? ' · tüm coin' : ''), c: 'acc' },
      { v: ypos.v, l: ypos.l, s: ypos.s, c: ypos.c },
    ];
    el('kpis').innerHTML = cards.map(function (c) {
      return '<div class="kpi"><div class="v ' + c.c + '">' + c.v + '</div><div class="l">' + c.l + '</div><div class="s">' + c.s + '</div></div>';
    }).join('');
  }

  function renderCoinDetail() {
    var host = el('coinDetail');
    if (S.coin == null || !view.coins.has(S.coin)) { host.innerHTML = ''; return; }
    var a = view.coins.get(S.coin);
    var n = a[0], w = a[1], sumR = a[2], sumLog = a[3], durSum = a[4];
    var comp = Math.expm1(sumLog) * 100;
    var levBit = S.lev > 1
      ? '<span class="kv">r toplamı (' + S.lev + 'x)<b>' + (sumR * 100 * S.lev >= 0 ? '+' : '') + (sumR * 100 * S.lev).toFixed(1) + '%</b></span><span class="kv">Ort. getiri (' + S.lev + 'x)<b>' + fmtPct(n ? (sumR / n) * S.lev : 0, 2) + '</b></span>'
      : '<span class="kv">r toplamı<b>' + (sumR * 100 >= 0 ? '+' : '') + (sumR * 100).toFixed(1) + '%</b></span><span class="kv">Bileşik<b>' + (comp >= 0 ? '+' : '') + comp.toFixed(0) + '%</b></span>';
    host.innerHTML = '<div class="coinCard"><b>' + SYMS[S.coin] + '</b>' +
      '<span class="kv">İşlem<b>' + fmtInt(n) + '</b></span>' +
      '<span class="kv">Kazanma<b>' + (n ? (w / n * 100).toFixed(1) : '—') + '%</b></span>' +
      levBit +
      '<span class="kv">Ort. süre<b>' + fmtDur(n ? durSum / n : 0) + '</b></span>' +
      '<span class="kv" style="margin-left:auto;cursor:pointer" id="coinClose">kapat ✕</span></div>';
    var cl = el('coinClose'); if (cl) cl.addEventListener('click', function () { S.coin = null; host.innerHTML = ''; });
  }

  function renderLadder() {
    var host = el('ladder'); if (!host) return;
    var base = view.base;
    if (!base || !base.length) { host.innerHTML = '<div style="color:#697692;font-size:11px;padding:6px">Veri yok</div>'; return; }
    var rows = LEVS.map(function (L) {
      var eq = 1, peak = 1, dd = 0, liq = false, liqDay = null;
      for (var i = 0; i < base.length; i++) {
        var g = 1 + L * (base[i].bps / 10000);
        if (g <= 0) { eq = 0; liq = true; liqDay = base[i].i; break; }
        eq *= g; if (eq > peak) peak = eq; var d = eq / peak - 1; if (d < dd) dd = d;
      }
      return { L: L, net: eq - 1, dd: dd, liq: liq, liqDay: liqDay };
    });
    var body = rows.map(function (r) {
      return '<tr class="' + (r.L === S.lev ? 'on' : '') + '" data-lev="' + r.L + '">' +
        '<td><b>' + r.L + 'x</b></td>' +
        '<td class="' + (r.net >= 0 ? 'p' : 'n') + '">' + fmtPctC(r.net) + '</td>' +
        '<td class="n">' + fmtDD(r.dd) + '</td>' +
        '<td>' + (r.liq ? '<span class="tagliq">tasfiye · ' + fmtDate(r.liqDay) + '</span>' : '<span class="tagok">ayakta</span>') + '</td>' +
        '<td class="dimc">' + (r.L === S.lev ? 'seçili' : 'seç') + '</td></tr>';
    }).join('');
    host.innerHTML = '<table class="levt"><thead><tr><th>Kaldıraç</th><th>Net getiri</th><th>Maks DD</th><th>Durum</th><th></th></tr></thead><tbody>' + body + '</tbody></table>' +
      '<div class="levnote">Portföy eğrisi günlük getirilerin kaldıraç katı ile bileşiklenir; bir günde kaldıraçlı getiri ≤ −100% olursa hesap tasfiye olur ve simülasyon durur. Fees/kayma/funding zaten getiriye dahildir ve kaldıraçla birlikte ölçeklenir. Yüksek kaldıraçta görülen aşırı büyük değerler idealize bileşik büyümedir: likidite, pozisyon limiti, teminat tamamlama ve kayma-büyümesi modellenmemiştir — gerçek sonuçlar çok daha kötü olur. Kaldıraç yalnızca riski büyütür, yatırım tavsiyesi değildir.</div>';
    host.querySelectorAll('tr[data-lev]').forEach(function (tr) {
      tr.addEventListener('click', function () { S.lev = +tr.dataset.lev; renderAll(); });
    });
  }

  function renderAll() {
    if (S.selected && !byKey.get(S.selected)) S.selected = null;
    var list = filteredStates();
    if (S.selected && list.every(function (s) { return s.key !== S.selected; })) S.selected = null;
    computeView();
    renderHeader(); renderKpis(); renderList(); renderCoinDetail(); renderFilterChips(); renderHourToggle(); renderDailyToggle(); renderLadder(); drawAll();
  }

  /* ------------------------------------------------------------------ boot */
  ['cDaily', 'cCum', 'cRet', 'cCoin', 'cDur', 'cScatter', 'cDow', 'cMonth', 'cSeason', 'cHour'].forEach(function (id) { attach(el(id)); });
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(drawAll, 140); });
  initFilters();
  // URL hash ile ön ayar: #lev=10&state=nvi|4h|temel&tf=4h&year=2024
  var hash = location.hash.replace(/^#/, '');
  var hashState = null;
  hash.split('&').forEach(function (kv) {
    var p = kv.split('=');
    if (p[0] === 'lev' && LEVS.indexOf(+p[1]) >= 0) S.lev = +p[1];
    if (p[0] === 'state') hashState = decodeURIComponent(p[1] || '');
    if (p[0] === 'tf' && ['15m', '1h', '4h', '1d', '1w'].indexOf(p[1]) >= 0) S.tfs.add(p[1]);
    if (p[0] === 'year' && ALL_YEARS.indexOf(+p[1]) >= 0) { S.years = new Set([+p[1]]); }
    if (p[0] === 'vol') { var vn = +p[1]; if (vn === 0 || (VOL.sets || []).indexOf(vn) >= 0) S.vol = vn === 0 ? null : vn; }
  });
  // başlangıç: en yüksek net getirili durum
  var best = STATES.slice().sort(function (a, b) { return b.net - a.net; })[0];
  S.selected = (hashState && byKey.get(hashState)) ? hashState : (best ? best.key : null);
  renderAll();
})();
