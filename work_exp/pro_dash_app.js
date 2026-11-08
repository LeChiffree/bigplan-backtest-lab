(function () {
  'use strict';

  var D = window.__PRO_DATA__;
  var GRID = D.grid;
  var IDX_2025 = D.idx2025 || 884;
  var IDX_2026 = D.idx2026 || 1249;
  var SYMS = D.symbols || [];
  var KEYTITLE = D.keyTitle || {};
  var VOL = D.vol || { sets: [50, 100, 150, 200, 250, 300], rank: [] };
  var STATES = D.states || [];

  var DATE_STRS = new Array(GRID.len);
  var DATE_YEARS = new Int32Array(GRID.len);
  for (var di = 0; di < GRID.len; di++) {
    var dt = new Date(GRID.start + di * GRID.step);
    DATE_YEARS[di] = dt.getUTCFullYear();
    DATE_STRS[di] = dt.toISOString().slice(0, 10);
  }
  var DATES_2526 = DATE_STRS.slice(IDX_2025);

  var byKey = new Map();
  var byCell = new Map(); // "id|tf" -> [states]
  for (var i = 0; i < STATES.length; i++) {
    var st = STATES[i];
    byKey.set(st.key, st);
    var ck = st.id + '|' + st.tf;
    if (!byCell.has(ck)) byCell.set(ck, []);
    byCell.get(ck).push(st);
  }

  var STRAT_META = new Map();
  (D.strategies || []).forEach(function (s) { STRAT_META.set(s.id, s); });

  var ALL_TFS = ['15m', '1h', '4h', '1d', '1w'];
  var LEVS = [1, 2, 5, 10, 15, 20];
  var DUR_LABELS = ['< 1 gün', '1–3 gün', '3–7 gün', '7–14 gün', '14–35 gün', '35–65 gün', '65+ gün'];
  var RET_LABELS = ['<-20%', '-20..-10%', '-10..-5%', '-5..-2%', '-2..-1%', '-1..0%', '0..1%', '1..2%', '2..5%', '5..10%', '10..20%', '>20%'];
  var SEASON_LABELS = ['Kış (Ara-Şub)', 'İlkbahar (Mar-May)', 'Yaz (Haz-Ağu)', 'Sonbahar (Eyl-Kas)'];
  var QTR_LABELS = ['Q1 (Oca-Mar)', 'Q2 (Nis-Haz)', 'Q3 (Tem-Eyl)', 'Q4 (Eki-Ara)'];
  var MONTH_LABELS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var DOW_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  var HOUR_LABELS = ['00-03', '03-06', '06-09', '09-12', '12-15', '15-18', '18-21', '21-24'];

  var S = {
    tfFilter: 'all',     // Sol Adım 1 timeframe filtresi ('all' veya '15m'..'1w')
    vol: null,           // null = 520 sembol, veya 50..300
    lev: 1,              // 1, 2, 5, 10, 15, 20
    unit: 'usd',         // 'usd' ($10 işlem kasası) veya 'pct' (% getiri)
    q: '',
    sort: 'kasaAll',     // 'kasaAll', 'kasa2526', 'exp26', 'pf', 'wr'
    stratId: null,       // Seçili strateji id
    stratTf: null,       // Seçili stratejinin aktif timeframe'i
    stateKey: null,      // Seçili varyant/filtre durumu key'i
    qtrMode: 'timeline', // 'timeline' (2022 Q3..2026 Q3) veya 'agg' (Q1..Q4)
    durMode: 'pnl',      // 'pnl' (Kâr/Zarar $) veya 'count' (İşlem sayısı & WR)
    dowMode: 'dow',      // 'dow' (Haftanın günleri) veya 'hour' (Giriş saatleri)
  };

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nf(v, d) {
    if (v == null || !isFinite(v)) return '—';
    return Number(v).toLocaleString('tr-TR', {
      minimumFractionDigits: d == null ? 0 : d,
      maximumFractionDigits: d == null ? 0 : d,
    });
  }
  function fmtUsd(v, d) {
    if (v == null || !isFinite(v)) return '—';
    var dec = d != null ? d : (Math.abs(v) >= 100 ? 0 : 1);
    var s = (v >= 0 ? '+$' : '-$') + nf(Math.abs(v), dec);
    return s;
  }
  function fmtPct(v, d) {
    if (v == null || !isFinite(v)) return '—';
    var dec = d != null ? d : 1;
    var p = v * 100;
    return (p >= 0 ? '+' : '') + p.toFixed(dec) + '%';
  }
  function fmtUnit(valR) {
    // valR: r toplamı (1.0 = %100 getiri = $10 işlemde $10)
    var scaled = valR * S.lev;
    if (S.unit === 'usd') return fmtUsd(scaled * 10, Math.abs(scaled * 10) >= 100 ? 0 : 1);
    return fmtPct(scaled, Math.abs(scaled * 100) >= 100 ? 0 : 1);
  }
  function unitMult() {
    // r toplamını seçili birime ($ veya %) çeviren çarpan
    return S.lev * (S.unit === 'usd' ? 10 : 100);
  }
  function unitSuffix() {
    return S.unit === 'usd' ? ' $' : ' %';
  }

  // Hacim setine göre bir durumun hem total hem 2026 işlem başı getirisinin pozitif olup olmadığını kontrol et
  function isStatePosBoth(st) {
    if (!st) return false;
    if (S.vol == null || !st.sets) return !!st.posBoth;
    var vi = VOL.sets.indexOf(S.vol);
    if (vi < 0 || !st.sets[vi]) return !!st.posBoth;
    var vs = st.sets[vi];
    if (!vs.n || vs.sumR <= 0) return false;
    var y26 = vs.ySum && vs.ySum[4]; // [n, w, posC, negC, durH]
    if (!y26 || !y26[0] || (y26[2] - y26[3]) <= 0) return false;
    return true;
  }

  // Seçili hacim setine göre durumun aktif verilerini döndür
  function getStateViewData(st) {
    var agg = st.agg;
    var vi = S.vol != null ? VOL.sets.indexOf(S.vol) : -1;
    var vs = (vi >= 0 && st.sets && st.sets[vi]) ? st.sets[vi] : null;

    var n = vs ? vs.n : agg.n;
    var w = vs ? vs.w : agg.w;
    var sumPos = vs ? vs.sumPos : agg.sumPos;
    var sumNeg = vs ? vs.sumNeg : agg.sumNeg;
    var sumR = vs ? vs.sumR : agg.sumR;
    var durSum = vs ? vs.durSum : agg.durSum;

    // Yıllık dizi: [{n, w, pos, neg, net, durSum}]
    var years = [];
    for (var y = 0; y < 5; y++) {
      if (vs && vs.ySum && vs.ySum[y]) {
        var ys = vs.ySum[y];
        var yp = ys[2] / 100, yn = ys[3] / 100;
        years.push({ year: 2022 + y, n: ys[0], w: ys[1], pos: yp, neg: yn, net: yp - yn, durSum: ys[4] });
      } else {
        var Y = agg.years[y];
        years.push({ year: 2022 + y, n: Y.n, w: Y.w, pos: Y.sumPos, neg: Y.sumNeg, net: Y.sumPos - Y.sumNeg, durSum: Y.durSum });
      }
    }

    // Günlük brüt kâr ve brüt zarar (r biriminde; hacim filtresi seçiliyse yıllık orana göre ölçeklenir)
    var dayPos = new Float64Array(GRID.len);
    var dayNeg = new Float64Array(GRID.len);
    var scalePos = [1, 1, 1, 1, 1];
    var scaleNeg = [1, 1, 1, 1, 1];
    if (vs) {
      for (var yi = 0; yi < 5; yi++) {
        var baseP = agg.years[yi].sumPos, baseN = agg.years[yi].sumNeg;
        scalePos[yi] = baseP > 1e-6 ? years[yi].pos / baseP : 0;
        scaleNeg[yi] = baseN > 1e-6 ? years[yi].neg / baseN : 0;
      }
    }
    for (var d = 0; d < GRID.len; d++) {
      var yrIdx = DATE_YEARS[d] - 2022;
      dayPos[d] = (agg.dayPosC[d] / 100) * scalePos[yrIdx];
      dayNeg[d] = (agg.dayNegC[d] / 100) * scaleNeg[yrIdx];
    }

    // Kategori kovalarını topla
    function sumCat4(key, count) {
      var srcArr = vs ? vs[key] : null;
      if (!srcArr) {
        srcArr = new Array(count * 4).fill(0);
        for (var y0 = 0; y0 < 5; y0++) {
          var ya = agg.years[y0][key];
          for (var k = 0; k < ya.length; k++) srcArr[k] += ya[k];
        }
      }
      var rows = [];
      for (var bi = 0; bi < count; bi++) {
        var o = bi * 4;
        var bn = srcArr[o], bw = srcArr[o + 1], bp = srcArr[o + 2] / 100, bng = srcArr[o + 3] / 100;
        rows.push({ n: bn, w: bw, pos: bp, neg: bng, net: bp - bng });
      }
      return rows;
    }

    function sumDur5() {
      var srcArr = vs ? vs.dur : null;
      if (!srcArr) {
        srcArr = new Array(7 * 5).fill(0);
        for (var y0 = 0; y0 < 5; y0++) {
          var ya = agg.years[y0].dur;
          for (var k = 0; k < ya.length; k++) srcArr[k] += ya[k];
        }
      }
      var rows = [];
      for (var bi = 0; bi < 7; bi++) {
        var o = bi * 5;
        var bn = srcArr[o], bw = srcArr[o + 1], bp = srcArr[o + 2] / 100, bng = srcArr[o + 3] / 100, bd = srcArr[o + 4];
        rows.push({ n: bn, w: bw, pos: bp, neg: bng, net: bp - bng, durDays: bd });
      }
      return rows;
    }

    function sumRet3() {
      var srcArr = vs ? vs.ret : null;
      if (!srcArr) {
        srcArr = new Array(12 * 3).fill(0);
        for (var y0 = 0; y0 < 5; y0++) {
          var ya = agg.years[y0].ret;
          for (var k = 0; k < ya.length; k++) srcArr[k] += ya[k];
        }
      }
      var rows = [];
      for (var bi = 0; bi < 12; bi++) {
        var o = bi * 3;
        var bn = srcArr[o], bp = srcArr[o + 1] / 100, bng = srcArr[o + 2] / 100;
        rows.push({ n: bn, pos: bp, neg: bng, net: bp - bng });
      }
      return rows;
    }

    function sumLs4() {
      var srcArr = vs ? vs.ls : null;
      if (!srcArr) {
        srcArr = new Array(2 * 4).fill(0);
        for (var y0 = 0; y0 < 5; y0++) {
          var ya = agg.years[y0].ls;
          for (var k = 0; k < ya.length; k++) srcArr[k] += ya[k];
        }
      }
      var out = [];
      for (var s = 0; s < 2; s++) {
        var o = s * 4;
        out.push({ n: srcArr[o], w: srcArr[o + 1], pos: srcArr[o + 2] / 100, neg: srcArr[o + 3] / 100, net: (srcArr[o + 2] - srcArr[o + 3]) / 100 });
      }
      return out;
    }

    // 17 takvim çeyreği (2022 Q3 .. 2026 Q3)
    var qtrTimeline = [];
    for (var y1 = 0; y1 < 5; y1++) {
      var Yq = agg.years[y1].quarter;
      var sp = scalePos[y1], sn = scaleNeg[y1];
      for (var q = 0; q < 4; q++) {
        if (y1 === 0 && q < 2) continue; // 2022 Q1-Q2 veri öncesi
        if (y1 === 4 && q > 2) continue; // 2026 Q4 henüz yok
        var qo = q * 4;
        var qn = Math.round(Yq[qo] * (sp || 1));
        var qw = Math.round(Yq[qo + 1] * (sp || 1));
        var qp = (Yq[qo + 2] / 100) * sp;
        var qng = (Yq[qo + 3] / 100) * sn;
        qtrTimeline.push({ label: (2022 + y1) + ' Q' + (q + 1), n: qn, w: qw, pos: qp, neg: qng, net: qp - qng });
      }
    }

    // Yıl x Ay matrisi (5 x 12)
    var monthMatrix = [];
    for (var y2 = 0; y2 < 5; y2++) {
      var Ym = agg.years[y2].month;
      var sp2 = scalePos[y2], sn2 = scaleNeg[y2];
      var mRow = [];
      for (var m = 0; m < 12; m++) {
        var mo = m * 4;
        var mn = Math.round(Ym[mo] * (sp2 || 1));
        var mw = Math.round(Ym[mo + 1] * (sp2 || 1));
        var mp = (Ym[mo + 2] / 100) * sp2;
        var mng = (Ym[mo + 3] / 100) * sn2;
        mRow.push({ n: mn, w: mw, pos: mp, neg: mng, net: mp - mng });
      }
      monthMatrix.push(mRow);
    }

    return {
      st: st,
      n: n,
      w: w,
      sumPos: sumPos,
      sumNeg: sumNeg,
      sumR: sumR,
      durSum: durSum,
      years: years,
      dayPos: dayPos,
      dayNeg: dayNeg,
      dur: sumDur5(),
      season: sumCat4('season', 4),
      quarter: sumCat4('quarter', 4),
      qtrTimeline: qtrTimeline,
      month: sumCat4('month', 12),
      monthMatrix: monthMatrix,
      dow: sumCat4('dow', 7),
      hour: sumCat4('hour', 8),
      ret: sumRet3(),
      ls: sumLs4(),
    };
  }

  // Seçili timeframe ve pozitiflik kuralına uyan aday durumları getir
  function getValidCandidates() {
    var q = S.q.trim().toLowerCase();
    return STATES.filter(function (st) {
      if (!st.isCandidate) return false;
      if (!isStatePosBoth(st)) return false;
      if (S.tfFilter !== 'all' && st.tf !== S.tfFilter) return false;
      if (q) {
        var hay = (st.id + ' ' + st.title + ' ' + st.tf + ' ' + st.ad + ' ' + st.keyTitles.join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  // Strateji listesini (benzersiz strateji id'leri olarak) oluştur ve sırala
  function getFilteredStrategies() {
    var cands = getValidCandidates();
    var map = new Map();
    for (var i = 0; i < cands.length; i++) {
      var st = cands[i];
      if (!map.has(st.id)) {
        map.set(st.id, {
          id: st.id,
          title: st.title,
          tfs: new Set(),
          bestState: st,
          states: [],
        });
      }
      var g = map.get(st.id);
      g.tfs.add(st.tf);
      g.states.push(st);
      if (scoreForSort(st) > scoreForSort(g.bestState)) g.bestState = st;
    }
    var arr = Array.from(map.values());
    arr.sort(function (a, b) { return scoreForSort(b.bestState) - scoreForSort(a.bestState); });
    return arr;
  }

  function scoreForSort(st) {
    var vd = getStateViewData(st);
    if (S.sort === 'kasaAll') return vd.sumR * 10;
    if (S.sort === 'kasa2526') return (vd.years[3].net + vd.years[4].net) * 10;
    if (S.sort === 'exp26') return vd.years[4].n ? (vd.years[4].net / vd.years[4].n) * 10 : -999;
    if (S.sort === 'pf') return vd.sumNeg > 1e-6 ? vd.sumPos / vd.sumNeg : 99;
    if (S.sort === 'wr') return vd.n ? vd.w / vd.n : 0;
    return vd.sumR * 10;
  }

  // Seçili strateji ve timeframe'in tüm durumlarını (temel, varyant1..3, single:*) getir
  function getCellStates(id, tf) {
    return byCell.get(id + '|' + tf) || [];
  }

  function ensureSelection() {
    var strats = getFilteredStrategies();
    if (!strats.length) {
      S.tfFilter = 'all';
      S.q = '';
      strats = getFilteredStrategies();
    }
    if (!S.stratId || !strats.some(function (x) { return x.id === S.stratId; })) {
      S.stratId = strats[0] ? strats[0].id : null;
    }
    var curStrat = strats.find(function (x) { return x.id === S.stratId; });
    if (!curStrat) return;

    var availTfs = ALL_TFS.filter(function (tf) { return curStrat.tfs.has(tf); });
    if (!S.stratTf || availTfs.indexOf(S.stratTf) < 0) {
      S.stratTf = curStrat.bestState ? curStrat.bestState.tf : availTfs[0];
    }

    var cellStates = getCellStates(S.stratId, S.stratTf);
    var curState = byKey.get(S.stateKey);
    if (!curState || curState.id !== S.stratId || curState.tf !== S.stratTf) {
      // Bu hücredeki en iyi pozitif varyantı seç
      var validVars = cellStates.filter(function (s) { return !s.isSingle && s.kind !== 'temel' && isStatePosBoth(s); });
      validVars.sort(function (a, b) { return scoreForSort(b) - scoreForSort(a); });
      var pick = validVars[0] || cellStates.find(function (s) { return isStatePosBoth(s); }) || cellStates[0];
      S.stateKey = pick ? pick.key : null;
    }
  }

  /* ------------------------------ SOL PANEL RENDER ------------------------------ */
  function renderSidebar() {
    // 1. Timeframe chipleri
    var tfHost = el('tfChips');
    tfHost.innerHTML = '';
    var allCands = STATES.filter(function (s) { return s.isCandidate && isStatePosBoth(s); });
    var allIds = new Set(allCands.map(function (s) { return s.id; }));
    tfHost.appendChild(makeChip('Tümü', S.tfFilter === 'all', allIds.size, function () {
      S.tfFilter = 'all'; renderAll();
    }));
    ALL_TFS.forEach(function (tf) {
      var cnt = new Set(allCands.filter(function (s) { return s.tf === tf; }).map(function (s) { return s.id; })).size;
      if (!cnt) return;
      tfHost.appendChild(makeChip(tf, S.tfFilter === tf, cnt, function () {
        S.tfFilter = tf; S.stratTf = tf; renderAll();
      }));
    });

    // Hacim chipleri
    var volHost = el('volChips');
    volHost.innerHTML = '';
    volHost.appendChild(makeChip('Tümü (520)', S.vol == null, null, function () { S.vol = null; renderAll(); }));
    (VOL.sets || []).forEach(function (v) {
      volHost.appendChild(makeChip('Top ' + v, S.vol === v, null, function () { S.vol = v; renderAll(); }));
    });

    // Kaldıraç chipleri
    var levHost = el('levChips');
    levHost.innerHTML = '';
    LEVS.forEach(function (L) {
      levHost.appendChild(makeChip(L + 'x', S.lev === L, null, function () { S.lev = L; renderAll(); }));
    });

    // Birim chipleri
    var unitHost = el('unitChips');
    unitHost.innerHTML = '';
    unitHost.appendChild(makeChip('$10 Kasa ($)', S.unit === 'usd', null, function () { S.unit = 'usd'; renderAll(); }));
    unitHost.appendChild(makeChip('Oransal (%)', S.unit === 'pct', null, function () { S.unit = 'pct'; renderAll(); }));

    // 2. Strateji Listesi ve Tek Tek İlerleme
    var strats = getFilteredStrategies();
    var idx = strats.findIndex(function (x) { return x.id === S.stratId; });
    el('stepPos').textContent = (idx + 1) + ' / ' + strats.length;

    var sHost = el('stratList');
    sHost.innerHTML = strats.map(function (g, i) {
      var vd = getStateViewData(g.bestState);
      var y26Exp = vd.years[4].n ? (vd.years[4].net / vd.years[4].n) * 10 * S.lev : 0;
      var tfsHtml = ALL_TFS.filter(function (t) { return g.tfs.has(t); }).map(function (t) {
        return '<span class="tf-mini">' + t + '</span>';
      }).join('');
      return '<div class="strat-item' + (g.id === S.stratId ? ' on' : '') + '" data-id="' + esc(g.id) + '">' +
        '<div class="strat-r1">' +
          '<span class="strat-name">' + (i + 1) + '. ' + esc(g.title) + '</span>' +
          '<span class="strat-kasa">' + fmtUnit(vd.sumR) + '</span>' +
        '</div>' +
        '<div class="strat-r2">' +
          '<span class="tf-mini-list">' + tfsHtml + '</span>' +
          '<span>2026: <b>' + fmtUsd(y26Exp, 2) + '</b>/işlem</span>' +
        '</div>' +
      '</div>';
    }).join('');

    sHost.querySelectorAll('.strat-item').forEach(function (item) {
      item.addEventListener('click', function () {
        S.stratId = item.getAttribute('data-id');
        S.stratTf = null;
        S.stateKey = null;
        renderAll();
      });
    });

    // 3. Seçili Stratejinin Timeframe ve Varyant Seçimi (Sol Adım 3)
    var curStrat = strats.find(function (x) { return x.id === S.stratId; });
    var stfHost = el('stratTfChips');
    stfHost.innerHTML = '';
    if (curStrat) {
      ALL_TFS.filter(function (tf) { return curStrat.tfs.has(tf); }).forEach(function (tf) {
        stfHost.appendChild(makeChip(tf, S.stratTf === tf, null, function () {
          S.stratTf = tf; S.stateKey = null; renderAll();
        }));
      });
    }

    var varHost = el('varList');
    var cellStates = getCellStates(S.stratId, S.stratTf).filter(function (s) {
      if (s.isSingle) return false;
      if (s.kind === 'temel') return true;
      return isStatePosBoth(s);
    });
    varHost.innerHTML = cellStates.map(function (st) {
      var vd = getStateViewData(st);
      var lbl = st.kind === 'temel' ? 'Filtresiz (Temel Baz)' : st.kind.replace('varyant', 'Varyant ') + (st.in93 ? ' ★' : '');
      var wr = vd.n ? (vd.w / vd.n * 100).toFixed(1) + '%' : '—';
      return '<div class="var-item' + (st.key === S.stateKey ? ' on' : '') + '" data-key="' + esc(st.key) + '">' +
        '<div class="var-r1"><span>' + esc(lbl) + '</span><span style="color:var(--pos-bright);font-family:var(--font-mono)">' + fmtUnit(vd.sumR) + '</span></div>' +
        '<div class="var-r2">' + esc(st.ad) + ' · ' + nf(vd.n) + ' işlem · WR ' + wr + '</div>' +
      '</div>';
    }).join('');

    varHost.querySelectorAll('.var-item').forEach(function (item) {
      item.addEventListener('click', function () {
        S.stateKey = item.getAttribute('data-key');
        renderAll();
      });
    });
  }

  function makeChip(label, active, count, onClick) {
    var b = document.createElement('button');
    b.className = 'chip' + (active ? ' on' : '');
    b.innerHTML = esc(label) + (count != null ? '<span class="c">' + count + '</span>' : '');
    b.addEventListener('click', onClick);
    return b;
  }

  /* --------------------- ÜST BAŞLIK & SAĞ FİLTRE SWITCH BOX --------------------- */
  function renderHeaderAndSwitchBox() {
    var st = byKey.get(S.stateKey);
    if (!st) return;
    var vd = getStateViewData(st);
    var cellStates = getCellStates(st.id, st.tf);
    var baseSt = cellStates.find(function (x) { return x.kind === 'temel'; }) || st;
    var baseVd = getStateViewData(baseSt);

    el('selTitle').textContent = st.title + ' (' + st.id.toUpperCase() + ' · ' + st.tf + ')';
    el('selSub').textContent = 'Aktif Filtre: ' + (st.kind === 'temel' ? 'Filtresiz (Temel Strateji)' : st.ad);

    var badges = [
      '<span class="badge pos">✓ Total & 2026 Pozitif</span>',
      '<span class="badge acc">Zaman Dilimi: ' + esc(st.tf) + '</span>',
      '<span class="badge">' + (S.vol ? 'En Hacimli Top ' + S.vol + ' Coin' : '520 Sembol Tam Evren') + '</span>',
      '<span class="badge gold">' + S.lev + 'x · Her İşleme $10</span>',
    ];
    if (st.in93) badges.push('<span class="badge pos">★ 5/6 Homojen Adayı</span>');
    el('selBadges').innerHTML = badges.join('');

    var rulesHtml = (st.rules || []).map(function (r, idx) {
      return '<div class="rule-pill"><b>Kural ' + (idx + 1) + ':</b> ' + esc(r) + '</div>';
    }).join('');
    rulesHtml += '<div class="rule-pill"><b>Yön & Çıkış:</b> ' + (st.dir === 'long' ? 'Sadece Long' : 'Long + Short') + ' · Stop: ' + esc(st.stop) + '</div>';
    el('selRules').innerHTML = rulesHtml;

    // Sağ Switch Box: Bu hücredeki benzersiz tekil filtreleri listele
    var allFilterMap = new Map();
    cellStates.forEach(function (cs) {
      (cs.filters || []).forEach(function (f) {
        if (!allFilterMap.has(f.k)) allFilterMap.set(f.k, f);
      });
    });
    var activeSet = new Set(st.keys || []);
    var swHost = el('switchList');

    if (allFilterMap.size === 0) {
      swHost.innerHTML = '<div class="sw-row"><div class="sw-info"><div class="sw-title">Bu hücrede ek filtre yok</div></div></div>';
    } else {
      swHost.innerHTML = Array.from(allFilterMap.values()).map(function (f) {
        var isOn = activeSet.has(f.k);
        return '<div class="sw-row' + (isOn ? ' on' : '') + '" data-fk="' + esc(f.k) + '">' +
          '<div class="sw-info">' +
            '<div class="sw-title">' + esc(f.title) + ' <span style="color:var(--dim);font-family:var(--font-mono);font-size:11px">[' + esc(f.k) + ']</span></div>' +
            '<div class="sw-desc">' + esc(f.desc) + '</div>' +
          '</div>' +
          '<div class="sw-toggle" role="switch" aria-checked="' + isOn + '"></div>' +
        '</div>';
      }).join('');

      swHost.querySelectorAll('.sw-row').forEach(function (row) {
        row.addEventListener('click', function () {
          var fk = row.getAttribute('data-fk');
          toggleFilterSwitch(fk, cellStates);
        });
      });
    }

    // Hızlı Varyant Preset Butonları
    var presetHost = el('presetRow');
    var presets = cellStates.filter(function (cs) {
      if (cs.isSingle) return false;
      if (cs.kind === 'temel') return true;
      return isStatePosBoth(cs);
    });
    presetHost.innerHTML = presets.map(function (cs) {
      var lbl = cs.kind === 'temel' ? 'Filtresiz (Temel)' : cs.kind.replace('varyant', 'Varyant ') + ': ' + cs.keyTitles.join(' + ');
      return '<button class="preset-btn' + (cs.key === st.key ? ' on' : '') + '" data-key="' + esc(cs.key) + '">' + esc(lbl) + '</button>';
    }).join('');
    presetHost.querySelectorAll('.preset-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        S.stateKey = btn.getAttribute('data-key');
        renderAll();
      });
    });

    // Filtre Etkisi Delta Strip (Filtresiz Temel'e göre fark)
    var diffKasa = (vd.sumR - baseVd.sumR) * 10 * S.lev;
    var curAvg = vd.n ? (vd.sumR / vd.n) * 100 * S.lev : 0;
    var baseAvg = baseVd.n ? (baseVd.sumR / baseVd.n) * 100 * S.lev : 0;
    var diffAvg = curAvg - baseAvg;
    var curWr = vd.n ? (vd.w / vd.n) * 100 : 0;
    var baseWr = baseVd.n ? (baseVd.w / baseVd.n) * 100 : 0;
    var diffWr = curWr - baseWr;
    var keepRatio = baseVd.n ? (vd.n / baseVd.n) * 100 : 100;

    el('deltaStrip').innerHTML =
      '<div class="delta-item"><div class="dl">Kasa Farkı (vs Temel)</div><div class="dv" style="color:' + (diffKasa >= 0 ? 'var(--pos-bright)' : 'var(--neg-bright)') + '">' + fmtUsd(diffKasa, 0) + '</div></div>' +
      '<div class="delta-item"><div class="dl">İşlem Başı Getiri Δ</div><div class="dv" style="color:' + (diffAvg >= 0 ? 'var(--pos-bright)' : 'var(--neg-bright)') + '">' + (diffAvg >= 0 ? '+' : '') + diffAvg.toFixed(2) + '%</div></div>' +
      '<div class="delta-item"><div class="dl">Kazanma Oranı Δ</div><div class="dv" style="color:' + (diffWr >= 0 ? 'var(--pos-bright)' : 'var(--neg-bright)') + '">' + (diffWr >= 0 ? '+' : '') + diffWr.toFixed(1) + ' puan</div></div>' +
      '<div class="delta-item"><div class="dl">Korunan İşlem</div><div class="dv" style="color:var(--acc)">%' + keepRatio.toFixed(1) + ' (' + nf(vd.n) + ')</div></div>';
  }

  function toggleFilterSwitch(fk, cellStates) {
    var cur = byKey.get(S.stateKey);
    var nextKeys = new Set(cur ? cur.keys : []);
    if (nextKeys.has(fk)) nextKeys.delete(fk);
    else nextKeys.add(fk);

    var arr = Array.from(nextKeys).sort();
    var sig = arr.join('+');

    // 1) Tam eşleşen durum var mı? (temel, varyant1..3 veya single:fk)
    var exact = cellStates.find(function (cs) {
      return cs.keys.slice().sort().join('+') === sig;
    });
    if (exact) {
      S.stateKey = exact.key;
      renderAll();
      return;
    }

    // 2) Eşleşen kombo yoksa: tıklanan fk yeni açıldıysa fk içeren en iyi varyantı veya tekil filtreyi seç
    if (nextKeys.has(fk)) {
      var withFk = cellStates.filter(function (cs) { return !cs.isSingle && cs.keys.indexOf(fk) >= 0 && isStatePosBoth(cs); });
      withFk.sort(function (a, b) { return scoreForSort(b) - scoreForSort(a); });
      var singleFk = cellStates.find(function (cs) { return cs.keys.length === 1 && cs.keys[0] === fk; });
      var target = (arr.length === 1 && singleFk) ? singleFk : (withFk[0] || singleFk);
      if (target) {
        S.stateKey = target.key;
        renderAll();
      }
    } else {
      var base = cellStates.find(function (cs) { return cs.kind === 'temel'; });
      if (base) { S.stateKey = base.key; renderAll(); }
    }
  }

  /* ------------------------------ KPI KARTLARI ------------------------------ */
  function renderKpis() {
    var st = byKey.get(S.stateKey);
    if (!st) return;
    var vd = getStateViewData(st);
    var L = S.lev;

    var kasaAll = vd.sumR * 10 * L;
    var posAll = vd.sumPos * 10 * L;
    var negAll = vd.sumNeg * 10 * L;
    var kasa2526 = (vd.years[3].net + vd.years[4].net) * 10 * L;
    var kasa2026 = vd.years[4].net * 10 * L;
    var wr = vd.n ? (vd.w / vd.n) * 100 : 0;
    var avgPct = vd.n ? (vd.sumR / vd.n) * 100 * L : 0;
    var avg26Pct = vd.years[4].n ? (vd.years[4].net / vd.years[4].n) * 100 * L : 0;
    var pf = vd.sumNeg > 1e-6 ? vd.sumPos / vd.sumNeg : 99;
    var avgDurD = vd.n ? (vd.durSum / vd.n) / 24 : 0;

    var cards = [
      { l: '$10 İşlem Kasası (2022–26)', v: fmtUsd(kasaAll, 0), s: 'Brüt Kâr: ' + fmtUsd(posAll, 0) + ' · Zarar: -$' + nf(negAll, 0), c: kasaAll >= 0 ? 'pos' : 'neg' },
      { l: '2025–2026 Özel Kasa ($10)', v: fmtUsd(kasa2526, 0), s: 'Sadece 2026 Net: ' + fmtUsd(kasa2026, 0), c: kasa2526 >= 0 ? 'pos' : 'neg' },
      { l: 'İşlem Başı Ort. Getiri', v: (avgPct >= 0 ? '+' : '') + avgPct.toFixed(2) + '%', s: 'Her $10 işlemde ort. ' + fmtUsd((avgPct / 100) * 10, 2), c: 'pos' },
      { l: '2026 İşlem Başı Getiri', v: (avg26Pct >= 0 ? '+' : '') + avg26Pct.toFixed(2) + '%', s: nf(vd.years[4].n) + ' işlem (2026 YTD)', c: 'pos' },
      { l: 'Kazanma Oranı & İşlem', v: '%' + wr.toFixed(1), s: nf(vd.w) + ' kazanan / ' + nf(vd.n) + ' toplam', c: 'acc' },
      { l: 'Profit Factor (Kâr/Zarar)', v: pf.toFixed(2) + 'x', s: 'Payoff: ' + (st.payoff || 1).toFixed(2) + 'x · R²: ' + ((st.cash && st.cash.r2Cash) || st.r2 || 0).toFixed(2), c: 'gold' },
      { l: 'Ort. Kalma Süresi', v: avgDurD >= 1 ? avgDurD.toFixed(1) + ' gün' : (avgDurD * 24).toFixed(1) + ' saat', s: 'Maks Kasa DD: ' + fmtUsd((st.cash ? st.cash.maxDdAll : 0) * L, 0), c: 'acc' },
    ];

    el('kpis').innerHTML = cards.map(function (c) {
      return '<div class="kpi ' + c.c + '"><div class="l">' + esc(c.l) + '</div><div class="v ' + c.c + '">' + esc(c.v) + '</div><div class="s">' + esc(c.s) + '</div></div>';
    }).join('');
  }

  /* --------------------------- PLOTLY GRAFİK MOTORU --------------------------- */
  var PLOT_CONFIG = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
  };

  function baseLayout(extra) {
    var lay = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(11,17,28,0.65)',
      font: {
        family: "'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif",
        size: 12.5,
        color: '#dbe6f7',
      },
      margin: { l: 58, r: 24, t: 28, b: 44 },
      xaxis: {
        gridcolor: 'rgba(35,50,77,0.55)',
        zerolinecolor: '#364d73',
        tickfont: { size: 11.5, color: '#9fb0cc' },
      },
      yaxis: {
        gridcolor: 'rgba(35,50,77,0.55)',
        zerolinecolor: '#47628f',
        zerolinewidth: 1.5,
        tickfont: { size: 11.5, color: '#9fb0cc' },
      },
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.13,
        font: { size: 12, color: '#dbe6f7' },
        bgcolor: 'rgba(0,0,0,0)',
      },
      hovermode: 'x unified',
      hoverlabel: {
        bgcolor: '#0d1524',
        bordercolor: '#3b82f6',
        font: { family: "'Plus Jakarta Sans', sans-serif", size: 12.5, color: '#f0f4fc' },
      },
    };
    if (extra) {
      for (var k in extra) {
        if (k === 'xaxis' || k === 'yaxis' || k === 'margin' || k === 'legend') {
          lay[k] = Object.assign({}, lay[k], extra[k]);
        } else {
          lay[k] = extra[k];
        }
      }
    }
    return lay;
  }

  // 1A & 1B: Seçili Stratejide Filtrelerin Etkisi Grafikleri
  function drawFilterImpactCharts() {
    var st = byKey.get(S.stateKey);
    if (!st) return;
    var cellStates = getCellStates(st.id, st.tf);
    var mult = unitMult();
    var uLbl = unitSuffix();

    // Grafik 1A: Filtresiz Temel vs Tekil Filtreler vs Varyantlar $10 Kasa Eğrileri
    var tracesCurve = [];
    var palette = ['#94a3b8', '#38bdf8', '#a855f7', '#f59e0b', '#10b981', '#ec4899', '#6366f1'];
    var ordered = cellStates.slice().sort(function (a, b) {
      if (a.kind === 'temel') return -1;
      if (b.kind === 'temel') return 1;
      if (a.isSingle !== b.isSingle) return a.isSingle ? 1 : -1;
      return a.kind.localeCompare(b.kind);
    });

    ordered.forEach(function (cs, idx) {
      var vd = getStateViewData(cs);
      var cum = new Float64Array(GRID.len);
      var s = 0;
      for (var i = 0; i < GRID.len; i++) {
        s += (vd.dayPos[i] - vd.dayNeg[i]) * mult;
        cum[i] = Math.round(s * 10) / 10;
      }
      var isSel = cs.key === st.key;
      var isBase = cs.kind === 'temel';
      var name = isBase ? 'Filtresiz (Temel)' : (cs.isSingle ? 'Tekil: ' + cs.keyTitles[0] : cs.kind.replace('varyant', 'V') + ': ' + cs.keyTitles.join(' + '));
      tracesCurve.push({
        x: DATE_STRS,
        y: Array.from(cum),
        type: 'scatter',
        mode: 'lines',
        name: name + (isSel ? ' [SEÇİLİ]' : ''),
        line: {
          color: isSel ? '#22c55e' : (isBase ? '#f43f5e' : palette[idx % palette.length]),
          width: isSel ? 3.2 : (isBase ? 2.2 : 1.6),
          dash: isBase ? 'dot' : (cs.isSingle ? 'dash' : 'solid'),
        },
        opacity: isSel || isBase ? 1 : 0.78,
      });
    });

    Plotly.react('cFilterCurve', tracesCurve, baseLayout({
      yaxis: { title: 'Kasa Durumu (' + uLbl.trim() + ')' },
    }), PLOT_CONFIG);

    // Grafik 1B: Filtre Varyantlarının Brüt Kâr (Yeşil Yukarı), Brüt Zarar (Kırmızı Aşağı), Net Kasa ve İşlem Başı Getiri Karşılaştırması
    var xNames = [];
    var yPos = [], yNeg = [], yNet = [], customText = [];
    ordered.forEach(function (cs) {
      var vd = getStateViewData(cs);
      var lbl = cs.kind === 'temel' ? 'Temel (Filtresiz)' : (cs.isSingle ? 'Tekil: ' + cs.keyTitles[0] : cs.kind.replace('varyant', 'Varyant '));
      if (cs.key === st.key) lbl = '★ ' + lbl;
      xNames.push(lbl);
      var pVal = Math.round(vd.sumPos * mult * 10) / 10;
      var nVal = -Math.round(vd.sumNeg * mult * 10) / 10;
      var netVal = Math.round(vd.sumR * mult * 10) / 10;
      yPos.push(pVal);
      yNeg.push(nVal);
      yNet.push(netVal);
      var wr = vd.n ? (vd.w / vd.n * 100).toFixed(1) : '0.0';
      var avg = vd.n ? (vd.sumR / vd.n * 100 * S.lev).toFixed(2) : '0.00';
      customText.push(nf(vd.n) + ' işlem · WR %' + wr + ' · Ort: +' + avg + '%/işlem');
    });

    var tracesBars = [
      {
        x: xNames,
        y: yPos,
        type: 'bar',
        name: 'Brüt Kâr (+' + uLbl.trim() + ')',
        marker: { color: '#10b981' },
        text: yPos.map(function (v) { return '+' + nf(v, 0) + uLbl; }),
        textposition: 'outside',
        cliponaxis: false,
      },
      {
        x: xNames,
        y: yNeg,
        type: 'bar',
        name: 'Brüt Zarar (-' + uLbl.trim() + ')',
        marker: { color: '#f43f5e' },
        text: yNeg.map(function (v) { return nf(v, 0) + uLbl; }),
        textposition: 'outside',
        cliponaxis: false,
      },
      {
        x: xNames,
        y: yNet,
        text: customText,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Net Kasa (' + uLbl.trim() + ')',
        line: { color: '#fbbf24', width: 2.5 },
        marker: { size: 9, symbol: 'diamond', color: '#fbbf24' },
      },
    ];

    Plotly.react('cFilterBars', tracesBars, baseLayout({
      barmode: 'relative',
      xaxis: { type: 'category' },
      yaxis: { title: 'Kâr / Zarar (' + uLbl.trim() + ')' },
    }), PLOT_CONFIG);
  }

  // 2A & 2B: $10 Sabit İşlem Kasası Line Grafikleri (Tüm Dönem 2022–2026 & Sadece 2025–2026)
  function drawCashLineCharts(vd) {
    var mult = unitMult();
    var uLbl = unitSuffix();

    // 2A: Tüm Dönem (2022-08-01 -> 2026-09-08) 0$'dan başlayan kasa
    var kasaAll = new Float64Array(GRID.len);
    var peakAll = new Float64Array(GRID.len);
    var sumAll = 0, pk = 0;
    for (var i = 0; i < GRID.len; i++) {
      sumAll += (vd.dayPos[i] - vd.dayNeg[i]) * mult;
      kasaAll[i] = Math.round(sumAll * 100) / 100;
      if (kasaAll[i] > pk) pk = kasaAll[i];
      peakAll[i] = pk;
    }

    Plotly.react('cCashAll', [
      {
        x: DATE_STRS,
        y: Array.from(peakAll),
        type: 'scatter',
        mode: 'lines',
        name: 'Kasa Zirvesi (High Watermark)',
        line: { color: 'rgba(148,163,184,0.45)', width: 1.2, dash: 'dot' },
      },
      {
        x: DATE_STRS,
        y: Array.from(kasaAll),
        type: 'scatter',
        mode: 'lines',
        name: 'Kasa Durumu (0' + uLbl.trim() + ' Başlangıç)',
        fill: 'tozeroy',
        fillcolor: 'rgba(16,185,129,0.14)',
        line: { color: '#10b981', width: 2.6 },
      },
    ], baseLayout({
      yaxis: { title: 'Kasa Bakiyesi (' + uLbl.trim() + ')' },
    }), PLOT_CONFIG);

    // 2B: Sadece 2025–2026 (2025-01-01'de 0$'dan başlayan kasa)
    var len2526 = GRID.len - IDX_2025;
    var kasa2526 = new Float64Array(len2526);
    var peak2526 = new Float64Array(len2526);
    var sum25 = 0, pk25 = 0;
    for (var j = 0; j < len2526; j++) {
      var di = IDX_2025 + j;
      sum25 += (vd.dayPos[di] - vd.dayNeg[di]) * mult;
      kasa2526[j] = Math.round(sum25 * 100) / 100;
      if (kasa2526[j] > pk25) pk25 = kasa2526[j];
      peak2526[j] = pk25;
    }

    Plotly.react('cCash2526', [
      {
        x: DATES_2526,
        y: Array.from(peak2526),
        type: 'scatter',
        mode: 'lines',
        name: '2025–26 Kasa Zirvesi',
        line: { color: 'rgba(148,163,184,0.45)', width: 1.2, dash: 'dot' },
      },
      {
        x: DATES_2526,
        y: Array.from(kasa2526),
        type: 'scatter',
        mode: 'lines',
        name: '2025–2026 Kasa (01.01.2025 = 0' + uLbl.trim() + ')',
        fill: 'tozeroy',
        fillcolor: 'rgba(59,130,246,0.16)',
        line: { color: '#3b82f6', width: 2.6 },
      },
    ], baseLayout({
      yaxis: { title: '2025–26 Kasa (' + uLbl.trim() + ')' },
    }), PLOT_CONFIG);
  }

  // 3A & 3B: Gün Gün Kâr (Yeşil Yukarı) ve Zarar (Kırmızı Aşağı) Histogramları (Tüm Dönem & 2025–2026)
  function drawDailyHistograms(vd) {
    var mult = unitMult();
    var uLbl = unitSuffix();

    var posAll = new Array(GRID.len);
    var negAll = new Array(GRID.len);
    for (var i = 0; i < GRID.len; i++) {
      posAll[i] = Math.round(vd.dayPos[i] * mult * 100) / 100;
      negAll[i] = -Math.round(vd.dayNeg[i] * mult * 100) / 100;
    }

    // 3A: Tüm Dönem Gün Gün Kâr ve Zarar
    Plotly.react('cDailyAll', [
      {
        x: DATE_STRS,
        y: posAll,
        type: 'bar',
        name: 'Günlük Kâr (+' + uLbl.trim() + ')',
        marker: { color: '#10b981' },
      },
      {
        x: DATE_STRS,
        y: negAll,
        type: 'bar',
        name: 'Günlük Zarar (-' + uLbl.trim() + ')',
        marker: { color: '#f43f5e' },
      },
    ], baseLayout({
      barmode: 'relative',
      bargap: 0,
      yaxis: { title: 'Günlük Kâr / Zarar (' + uLbl.trim() + ')' },
    }), PLOT_CONFIG);

    // 3B: Sadece 2025–2026 Gün Gün Kâr ve Zarar
    var pos2526 = posAll.slice(IDX_2025);
    var neg2526 = negAll.slice(IDX_2025);
    Plotly.react('cDaily2526', [
      {
        x: DATES_2526,
        y: pos2526,
        type: 'bar',
        name: '2025–26 Günlük Kâr (+' + uLbl.trim() + ')',
        marker: { color: '#22c55e' },
      },
      {
        x: DATES_2526,
        y: neg2526,
        type: 'bar',
        name: '2025–26 Günlük Zarar (-' + uLbl.trim() + ')',
        marker: { color: '#ef4444' },
      },
    ], baseLayout({
      barmode: 'relative',
      bargap: 0.05,
      yaxis: { title: '2025–26 Günlük (' + uLbl.trim() + ')' },
    }), PLOT_CONFIG);
  }

  // Yardımcı: Yukarı Yeşil Kâr + Aşağı Kırmızı Zarar + Elmas Net Kâr Grafiği
  function renderDivergingBarChart(domId, labels, rows, yTitle) {
    var mult = unitMult();
    var uLbl = unitSuffix();
    var yPos = rows.map(function (r) { return Math.round(r.pos * mult * 10) / 10; });
    var yNeg = rows.map(function (r) { return -Math.round(r.neg * mult * 10) / 10; });
    var yNet = rows.map(function (r) { return Math.round(r.net * mult * 10) / 10; });
    var metaTxt = rows.map(function (r) {
      var wr = r.n ? (r.w / r.n * 100).toFixed(1) : '0.0';
      return nf(r.n) + ' işlem · WR %' + wr;
    });

    Plotly.react(domId, [
      {
        x: labels,
        y: yPos,
        type: 'bar',
        name: 'Brüt Kâr (Yeşil +' + uLbl.trim() + ')',
        marker: { color: '#10b981', line: { color: '#059669', width: 1 } },
        text: yPos.map(function (v) { return '+' + nf(v, 0) + uLbl; }),
        textposition: 'outside',
        cliponaxis: false,
      },
      {
        x: labels,
        y: yNeg,
        type: 'bar',
        name: 'Brüt Zarar (Kırmızı -' + uLbl.trim() + ')',
        marker: { color: '#f43f5e', line: { color: '#e11d48', width: 1 } },
        text: yNeg.map(function (v) { return nf(v, 0) + uLbl; }),
        textposition: 'outside',
        cliponaxis: false,
      },
      {
        x: labels,
        y: yNet,
        text: metaTxt,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Net Kâr (' + uLbl.trim() + ')',
        line: { color: '#fbbf24', width: 2.5 },
        marker: { size: 9, symbol: 'diamond', color: '#fbbf24', line: { color: '#080c14', width: 1.5 } },
      },
    ], baseLayout({
      barmode: 'relative',
      xaxis: { type: 'category' },
      yaxis: { title: yTitle || ('Kâr / Zarar (' + uLbl.trim() + ')') },
    }), PLOT_CONFIG);
  }

  // 4A, 4B, 4C: Yıl Yıl, Çeyrek Çeyrek ve Mevsim Mevsim Kâr / Zarar Grafikleri
  function drawPeriodCharts(vd) {
    // 4A: Yıl Yıl (2022, 2023, 2024, 2025, 2026)
    var yLabels = vd.years.map(function (y) { return y.year === 2026 ? '2026 (YTD)' : String(y.year); });
    renderDivergingBarChart('cYearly', yLabels, vd.years, 'Yıllık Kâr / Zarar');

    // 4B: Çeyrek Çeyrek (2022 Q3..2026 Q3 veya Q1..Q4 Toplam)
    if (S.qtrMode === 'timeline') {
      var qLabs = vd.qtrTimeline.map(function (q) { return q.label; });
      renderDivergingBarChart('cQuarterly', qLabs, vd.qtrTimeline, 'Çeyreklik Kâr / Zarar');
    } else {
      renderDivergingBarChart('cQuarterly', QTR_LABELS, vd.quarter, 'Q1–Q4 Toplam Kâr / Zarar');
    }

    // 4C: Mevsim Mevsim (Kış, İlkbahar, Yaz, Sonbahar)
    renderDivergingBarChart('cSeasonal', SEASON_LABELS, vd.season, 'Mevsimsel Kâr / Zarar');
  }

  // 5A & 5B: İşlemde Kalma Süreleri (1-3g, 3-7g, 7-14g, 14-35g, 35-65g, 65+g) & Getiri Dağılımı
  function drawDurationAndReturnCharts(vd) {
    var mult = unitMult();
    var uLbl = unitSuffix();

    if (S.durMode === 'pnl') {
      renderDivergingBarChart('cDuration', DUR_LABELS, vd.dur, 'Kalma Süresine Göre Kâr / Zarar');
    } else {
      var counts = vd.dur.map(function (r) { return r.n; });
      var wrs = vd.dur.map(function (r) { return r.n ? Math.round((r.w / r.n) * 1000) / 10 : 0; });
      Plotly.react('cDuration', [
        {
          x: DUR_LABELS,
          y: counts,
          type: 'bar',
          name: 'İşlem Sayısı (Adet)',
          marker: { color: '#3b82f6' },
          text: counts.map(function (c) { return nf(c) + ' işlem'; }),
          textposition: 'outside',
          cliponaxis: false,
        },
        {
          x: DUR_LABELS,
          y: wrs,
          yaxis: 'y2',
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Kazanma Oranı (%)',
          line: { color: '#10b981', width: 2.6 },
          marker: { size: 8, color: '#10b981' },
        },
      ], baseLayout({
        yaxis: { title: 'İşlem Sayısı' },
        yaxis2: {
          title: 'Kazanma Oranı (%)',
          overlaying: 'y',
          side: 'right',
          range: [0, 100],
          showgrid: false,
          tickfont: { color: '#10b981' },
        },
      }), PLOT_CONFIG);
    }

    // 5B: İşlem Başına Getiri Dağılımı (Kuyruk & Asimetri Histogramı)
    var rCounts = vd.ret.map(function (r) { return r.n; });
    var rDollar = vd.ret.map(function (r) { return Math.round((r.pos - r.neg) * mult * 10) / 10; });
    var barColors = RET_LABELS.map(function (_, idx) { return idx < 6 ? '#f43f5e' : '#10b981'; });

    Plotly.react('cRetDist', [
      {
        x: RET_LABELS,
        y: rCounts,
        type: 'bar',
        name: 'İşlem Adedi',
        marker: { color: barColors, opacity: 0.78 },
      },
      {
        x: RET_LABELS,
        y: rDollar,
        yaxis: 'y2',
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Net Kasa Katkısı (' + uLbl.trim() + ')',
        line: { color: '#fbbf24', width: 2.5 },
        marker: { size: 7, color: '#fbbf24' },
      },
    ], baseLayout({
      yaxis: { title: 'İşlem Adedi' },
      yaxis2: {
        title: 'Net Katkı (' + uLbl.trim() + ')',
        overlaying: 'y',
        side: 'right',
        showgrid: false,
        tickfont: { color: '#fbbf24' },
      },
    }), PLOT_CONFIG);
  }

  // 6A, 6B, 6C, 6D: Ekstra Profesyonel Analiz Grafikleri (Heatmap, Underwater Drawdown, Gün/Saat, Coin/Yön)
  function drawExtraProCharts(vd) {
    var mult = unitMult();
    var uLbl = unitSuffix();

    // 6A: Yıl × Ay Kâr / Zarar Isı Haritası (Heatmap)
    var yYears = ['2022', '2023', '2024', '2025', '2026'];
    var zVals = [];
    var textVals = [];
    for (var yi = 0; yi < 5; yi++) {
      var zRow = [], tRow = [];
      for (var mi = 0; mi < 12; mi++) {
        if ((yi === 0 && mi < 7) || (yi === 4 && mi > 8)) {
          zRow.push(null);
          tRow.push('');
        } else {
          var cell = vd.monthMatrix[yi][mi];
          var val = Math.round(cell.net * mult * 10) / 10;
          zRow.push(val);
          tRow.push((val >= 0 ? '+' : '') + nf(val, 0));
        }
      }
      zVals.push(zRow);
      textVals.push(tRow);
    }

    Plotly.react('cHeatmapMonth', [
      {
        x: MONTH_LABELS,
        y: yYears,
        z: zVals,
        text: textVals,
        texttemplate: '%{text}',
        textfont: { family: "'JetBrains Mono', monospace", size: 11.5 },
        type: 'heatmap',
        colorscale: [
          [0, '#be123c'],
          [0.35, '#881337'],
          [0.5, '#1e293b'],
          [0.65, '#065f46'],
          [1, '#10b981'],
        ],
        zmid: 0,
        colorbar: { title: uLbl.trim(), thickness: 12 },
      },
    ], baseLayout({
      margin: { l: 58, r: 20, t: 20, b: 40 },
      xaxis: { type: 'category' },
      yaxis: { type: 'category' },
      hovermode: 'closest',
    }), PLOT_CONFIG);

    // 6B: Sualtı Düşüş (Underwater Drawdown $) & 90 Günlük Yuvarlanan Günlük Kâr Beklentisi
    var ddSeries = new Float64Array(GRID.len);
    var roll90 = new Float64Array(GRID.len);
    var cum = 0, peak = 0, winSum = 0;
    var netDay = new Float64Array(GRID.len);
    for (var d = 0; d < GRID.len; d++) {
      var nd = (vd.dayPos[d] - vd.dayNeg[d]) * mult;
      netDay[d] = nd;
      cum += nd;
      if (cum > peak) peak = cum;
      ddSeries[d] = Math.round((cum - peak) * 100) / 100;
      winSum += nd;
      if (d >= 90) winSum -= netDay[d - 90];
      roll90[d] = Math.round((winSum / Math.min(d + 1, 90)) * 30 * 10) / 10; // 30 günlük ort. tempo
    }

    Plotly.react('cUnderwater', [
      {
        x: DATE_STRS,
        y: Array.from(ddSeries),
        type: 'scatter',
        mode: 'lines',
        name: 'Zirveden Düşüş (Drawdown ' + uLbl.trim() + ')',
        fill: 'tozeroy',
        fillcolor: 'rgba(244,63,94,0.22)',
        line: { color: '#f43f5e', width: 2 },
      },
      {
        x: DATE_STRS,
        y: Array.from(roll90),
        yaxis: 'y2',
        type: 'scatter',
        mode: 'lines',
        name: '90G Hareketli Aylık Tempo (' + uLbl.trim() + '/ay)',
        line: { color: '#38bdf8', width: 2 },
      },
    ], baseLayout({
      yaxis: { title: 'Zirveden Düşüş (' + uLbl.trim() + ')' },
      yaxis2: {
        title: 'Aylık Tempo (' + uLbl.trim() + ')',
        overlaying: 'y',
        side: 'right',
        showgrid: false,
        tickfont: { color: '#38bdf8' },
      },
    }), PLOT_CONFIG);

    // 6C: Haftanın Günleri veya Giriş Saatleri
    if (S.dowMode === 'dow') {
      var dowOrder = [1, 2, 3, 4, 5, 6, 0].map(function (idx) { return vd.dow[idx]; });
      renderDivergingBarChart('cDowHour', DOW_LABELS, dowOrder, 'Günlere Göre Kâr / Zarar');
    } else {
      renderDivergingBarChart('cDowHour', HOUR_LABELS, vd.hour, 'Saat Dilimine Göre Kâr / Zarar');
    }

    // 6D: Coin Bazlı Kâr (Sağa Yeşil) / Zarar (Sola Kırmızı) + Long/Short Özeti
    var coinsRaw = (vd.st.agg.coins || []).filter(function (c) {
      if (S.vol == null) return true;
      var rk = VOL.rank && VOL.rank[c[0]];
      return !rk || rk <= S.vol;
    });
    var topCoins = coinsRaw.slice(0, 12).concat(coinsRaw.slice(-8));
    var seenC = new Set();
    topCoins = topCoins.filter(function (c) {
      if (seenC.has(c[0])) return false;
      seenC.add(c[0]);
      return true;
    });
    topCoins.sort(function (a, b) { return (a[3] - a[4]) - (b[3] - b[4]); });

    var cNames = topCoins.map(function (c) { return (SYMS[c[0]] || '').replace(/USDT$/, ''); });
    var cPos = topCoins.map(function (c) { return Math.round((c[3] / 100) * mult * 10) / 10; });
    var cNeg = topCoins.map(function (c) { return -Math.round((c[4] / 100) * mult * 10) / 10; });
    var cNet = topCoins.map(function (c) { return Math.round(((c[3] - c[4]) / 100) * mult * 10) / 10; });

    Plotly.react('cCoin', [
      {
        y: cNames,
        x: cPos,
        orientation: 'h',
        type: 'bar',
        name: 'Coin Brüt Kâr (+' + uLbl.trim() + ')',
        marker: { color: '#10b981' },
      },
      {
        y: cNames,
        x: cNeg,
        orientation: 'h',
        type: 'bar',
        name: 'Coin Brüt Zarar (-' + uLbl.trim() + ')',
        marker: { color: '#f43f5e' },
      },
      {
        y: cNames,
        x: cNet,
        orientation: 'h',
        type: 'scatter',
        mode: 'markers',
        name: 'Net Katkı (' + uLbl.trim() + ')',
        marker: { color: '#fbbf24', size: 8, symbol: 'diamond' },
      },
    ], baseLayout({
      barmode: 'relative',
      hovermode: 'y unified',
      margin: { l: 86, r: 24, t: 28, b: 40 },
      xaxis: { title: 'Kâr / Zarar (' + uLbl.trim() + ')' },
    }), PLOT_CONFIG);
  }

  function renderAll() {
    ensureSelection();
    renderSidebar();
    renderHeaderAndSwitchBox();
    renderKpis();

    var st = byKey.get(S.stateKey);
    if (!st) return;
    var vd = getStateViewData(st);

    drawFilterImpactCharts();
    drawCashLineCharts(vd);
    drawDailyHistograms(vd);
    drawPeriodCharts(vd);
    drawDurationAndReturnCharts(vd);
    drawExtraProCharts(vd);
  }

  /* ------------------------------ EVENT LISTENERS ------------------------------ */
  function initEvents() {
    el('prevStrat').addEventListener('click', function () {
      var strats = getFilteredStrategies();
      if (!strats.length) return;
      var idx = strats.findIndex(function (x) { return x.id === S.stratId; });
      var nextIdx = (idx - 1 + strats.length) % strats.length;
      S.stratId = strats[nextIdx].id;
      S.stratTf = null;
      S.stateKey = null;
      renderAll();
    });

    el('nextStrat').addEventListener('click', function () {
      var strats = getFilteredStrategies();
      if (!strats.length) return;
      var idx = strats.findIndex(function (x) { return x.id === S.stratId; });
      var nextIdx = (idx + 1) % strats.length;
      S.stratId = strats[nextIdx].id;
      S.stratTf = null;
      S.stateKey = null;
      renderAll();
    });

    el('qInput').addEventListener('input', function (e) {
      S.q = e.target.value;
      renderAll();
    });

    el('sortSel').addEventListener('change', function (e) {
      S.sort = e.target.value;
      renderAll();
    });

    el('qtrToggle').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-qtr]');
      if (!b) return;
      S.qtrMode = b.getAttribute('data-qtr');
      el('qtrToggle').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      var st = byKey.get(S.stateKey);
      if (st) drawPeriodCharts(getStateViewData(st));
    });

    el('durToggle').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-dur]');
      if (!b) return;
      S.durMode = b.getAttribute('data-dur');
      el('durToggle').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      var st = byKey.get(S.stateKey);
      if (st) drawDurationAndReturnCharts(getStateViewData(st));
    });

    el('dowToggle').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-dow]');
      if (!b) return;
      S.dowMode = b.getAttribute('data-dow');
      el('dowToggle').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      var st = byKey.get(S.stateKey);
      if (st) drawExtraProCharts(getStateViewData(st));
    });
  }

  initEvents();
  renderAll();
})();
