(function () {
  'use strict';

  var D = window.__PRO_DATA__;
  var GRID = D.grid;
  var IDX_2025 = D.idx2025 || 884;
  var IDX_2026 = D.idx2026 || 1249;
  var SYMS = D.symbols || [];
  var VOL = D.vol || { sets: [50, 100, 150, 200, 250, 300], rank: [] };
  var STATES = D.states || [];
  var FLT_CAT = D.filterCatalog || [];
  var CELL_FLT = D.cellFilterStats || {};

  var DATE_STRS = new Array(GRID.len);
  var DATE_YEARS = new Int32Array(GRID.len);
  var DATE_MONTHS = new Int32Array(GRID.len);
  var DATE_WEEKS = new Array(GRID.len);
  for (var di = 0; di < GRID.len; di++) {
    var dt = new Date(GRID.start + di * GRID.step);
    DATE_YEARS[di] = dt.getUTCFullYear();
    DATE_MONTHS[di] = dt.getUTCMonth();
    DATE_STRS[di] = dt.toISOString().slice(0, 10);
    // Pazartesi başlangıçlı hafta etiketi
    var dow = (dt.getUTCDay() + 6) % 7;
    var monDt = new Date(dt.getTime() - dow * 86400000);
    DATE_WEEKS[di] = monDt.toISOString().slice(0, 10);
  }
  var DATES_2026 = DATE_STRS.slice(IDX_2026);

  var byKey = new Map();
  var byCell = new Map();
  for (var i = 0; i < STATES.length; i++) {
    var st = STATES[i];
    byKey.set(st.key, st);
    var ck = st.id + '|' + st.tf;
    if (!byCell.has(ck)) byCell.set(ck, []);
    byCell.get(ck).push(st);
  }

  var ALL_TFS = ['1h', '4h', '1d', '1w', '15m'];
  var DUR_LABELS = ['< 1 saat', '1–3 saat', '3–9 saat', '9–24 saat', '1–3 gün', '3–7 gün', '1–4 hafta', '> 4 hafta'];
  var EXIT_LABELS = ['Stop-Loss (5m Korumacı SL)', 'İndikatör Çıkışı / TP', 'Ters Sinyal (Flip)', 'Süre Sınırı / Kapanış'];
  var SEASON_LABELS = ['Kış', 'İlkbahar', 'Yaz', 'Sonbahar'];
  var MONTH_LABELS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var DOW_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  var S = {
    tfFilter: 'all',
    vol: null,
    unit: 'usd', // 'usd' ($10 1x kaldıraçsız kasa) veya 'pct' (1x % R)
    q: '',
    sort: 'kasaAll',
    stratId: null,
    stratTf: null,
    stateKey: null,
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
    return (v >= 0 ? '+$' : '-$') + nf(Math.abs(v), dec);
  }
  function fmtPct(v, d) {
    if (v == null || !isFinite(v)) return '—';
    var dec = d != null ? d : 2;
    var p = v * 100;
    return (p >= 0 ? '+' : '') + p.toFixed(dec) + '%';
  }
  function fmtDurHours(h) {
    if (h == null || !isFinite(h) || h <= 0) return '—';
    if (h < 1) return Math.round(h * 60) + ' dk';
    if (h < 48) return h.toFixed(1) + ' saat';
    return (h / 24).toFixed(1) + ' gün (' + Math.round(h) + ' sa)';
  }
  function unitMult() {
    // 26. Kaldıraçsız hesaplama: azami 1x kaldıraç ($10 işlem bazında 10, % bazında 100)
    return S.unit === 'usd' ? 10 : 100;
  }
  function unitSuffix() {
    return S.unit === 'usd' ? ' $' : ' %';
  }
  function fmtUnitVal(valR, dec) {
    var m = unitMult();
    var v = valR * m;
    if (S.unit === 'usd') return fmtUsd(v, dec != null ? dec : (Math.abs(v) >= 100 ? 0 : 1));
    return (v >= 0 ? '+' : '') + v.toFixed(dec != null ? dec : 1) + '%';
  }

  function isStatePosBoth(st) {
    if (!st) return false;
    if (S.vol == null || !st.sets) return !!st.posBoth;
    var vi = VOL.sets.indexOf(S.vol);
    if (vi < 0 || !st.sets[vi]) return !!st.posBoth;
    var vs = st.sets[vi];
    if (!vs.n || vs.sumR <= 0) return false;
    var y26 = vs.ySum && vs.ySum[4];
    if (!y26 || !y26[0] || (y26[2] - y26[3]) <= 0) return false;
    return true;
  }

  function unpackCat4(arr, count) {
    var out = [];
    for (var i = 0; i < count; i++) {
      var o = i * 4;
      var n = arr[o] || 0, w = arr[o + 1] || 0, pos = (arr[o + 2] || 0) / 100, neg = (arr[o + 3] || 0) / 100;
      out.push({ n: n, w: w, loss: Math.max(0, n - w), pos: pos, neg: neg, net: pos - neg });
    }
    return out;
  }

  function unpackDur5(arr, count) {
    var out = [];
    for (var i = 0; i < count; i++) {
      var o = i * 5;
      var n = arr[o] || 0, w = arr[o + 1] || 0, pos = (arr[o + 2] || 0) / 100, neg = (arr[o + 3] || 0) / 100, dh = arr[o + 4] || 0;
      out.push({ n: n, w: w, loss: Math.max(0, n - w), pos: pos, neg: neg, net: pos - neg, durHours: dh });
    }
    return out;
  }

  // Bir durum için hem TÜM YILLAR (all) hem SADECE 2026 (y26) veri paketini üretir
  function getSplitData(st) {
    var agg = st.agg;
    var vi = S.vol != null ? VOL.sets.indexOf(S.vol) : -1;
    var vs = (vi >= 0 && st.sets && st.sets[vi]) ? st.sets[vi] : null;

    var yrs = agg.years;
    var scalePos = [1, 1, 1, 1, 1];
    var scaleNeg = [1, 1, 1, 1, 1];
    var yearSummaries = [];

    for (var y = 0; y < 5; y++) {
      if (vs && vs.ySum && vs.ySum[y]) {
        var ys = vs.ySum[y];
        var yp = ys[2] / 100, yn = ys[3] / 100;
        yearSummaries.push({ year: 2022 + y, n: ys[0], w: ys[1], pos: yp, neg: yn, net: yp - yn, durSum: ys[4] });
        scalePos[y] = yrs[y].sumPos > 1e-6 ? yp / yrs[y].sumPos : 0;
        scaleNeg[y] = yrs[y].sumNeg > 1e-6 ? yn / yrs[y].sumNeg : 0;
      } else {
        var Y = yrs[y];
        yearSummaries.push({ year: 2022 + y, n: Y.n, w: Y.w, pos: Y.sumPos, neg: Y.sumNeg, net: Y.sumPos - Y.sumNeg, durSum: Y.durSum });
      }
    }

    // Günlük seriler (1500 gün)
    var dayPos = new Float64Array(GRID.len);
    var dayNeg = new Float64Array(GRID.len);
    for (var d = 0; d < GRID.len; d++) {
      var yi = DATE_YEARS[d] - 2022;
      dayPos[d] = (agg.dayPosC[d] / 100) * scalePos[yi];
      dayNeg[d] = (agg.dayNegC[d] / 100) * scaleNeg[yi];
    }

    // Tüm yıllar toplam kovaları
    function sumAllYearsArr(key, len) {
      if (vs && vs[key]) return vs[key];
      var a = new Array(len).fill(0);
      for (var y0 = 0; y0 < 5; y0++) {
        var src = yrs[y0][key] || [];
        for (var k = 0; k < len; k++) a[k] += src[k] || 0;
      }
      return a;
    }

    var y26Src = (vs && vs.y26) ? vs.y26 : yrs[4];

    var allSummary = {
      n: vs ? vs.n : agg.n,
      w: vs ? vs.w : agg.w,
      pos: vs ? vs.sumPos : agg.sumPos,
      neg: vs ? vs.sumNeg : agg.sumNeg,
      net: vs ? vs.sumR : agg.sumR,
      durSum: vs ? vs.durSum : agg.durSum,
      dayPos: dayPos,
      dayNeg: dayNeg,
      dates: DATE_STRS,
      weeks: DATE_WEEKS,
      dur: unpackDur5(sumAllYearsArr('dur', 8 * 5), 8),
      season: unpackCat4(sumAllYearsArr('season', 4 * 4), 4),
      dow: unpackCat4(sumAllYearsArr('dow', 7 * 4), 7),
      ls: unpackCat4(sumAllYearsArr('ls', 2 * 4), 2),
      exit: unpackCat4(sumAllYearsArr('exit', 4 * 4), 4),
      coins: agg.coins || [],
    };
    allSummary.loss = Math.max(0, allSummary.n - allSummary.w);

    var y26Summary = {
      n: yearSummaries[4].n,
      w: yearSummaries[4].w,
      pos: yearSummaries[4].pos,
      neg: yearSummaries[4].neg,
      net: yearSummaries[4].net,
      durSum: yearSummaries[4].durSum,
      dayPos: dayPos.slice(IDX_2026),
      dayNeg: dayNeg.slice(IDX_2026),
      dates: DATES_2026,
      weeks: DATE_WEEKS.slice(IDX_2026),
      dur: unpackDur5(y26Src.dur || new Array(40).fill(0), 8),
      season: unpackCat4(y26Src.season || new Array(16).fill(0), 4),
      dow: unpackCat4(y26Src.dow || new Array(28).fill(0), 7),
      ls: unpackCat4(y26Src.ls || new Array(8).fill(0), 2),
      exit: unpackCat4(y26Src.exit || new Array(16).fill(0), 4),
      coins: (agg.coins26 && agg.coins26.length) ? agg.coins26 : (agg.coins || []),
    };
    y26Summary.loss = Math.max(0, y26Summary.n - y26Summary.w);

    // Yıl x Ay matrisi (5 yıl x 12 ay)
    var monthMatrix = [];
    var timelineMonthsAll = [];
    var timelineMonths26 = [];
    for (var y2 = 0; y2 < 5; y2++) {
      var mArr = unpackCat4(yrs[y2].month, 12);
      var sp = scalePos[y2], sn = scaleNeg[y2];
      var mRow = [];
      for (var m = 0; m < 12; m++) {
        var cell = {
          ym: (2022 + y2) + '-' + String(m + 1).padStart(2, '0'),
          label: MONTH_LABELS[m] + ' ' + String(2022 + y2).slice(2),
          n: Math.round(mArr[m].n * (sp || 1)),
          w: Math.round(mArr[m].w * (sp || 1)),
          pos: mArr[m].pos * sp,
          neg: mArr[m].neg * sn,
        };
        cell.net = cell.pos - cell.neg;
        mRow.push(cell);
        if (!((y2 === 0 && m < 7) || (y2 === 4 && m > 8))) {
          timelineMonthsAll.push(cell);
          if (y2 === 4) timelineMonths26.push(cell);
        }
      }
      monthMatrix.push(mRow);
    }

    return {
      st: st,
      all: allSummary,
      y26: y26Summary,
      years: yearSummaries,
      monthMatrix: monthMatrix,
      timelineMonthsAll: timelineMonthsAll,
      timelineMonths26: timelineMonths26,
    };
  }

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

  function scoreForSort(st) {
    var sd = getSplitData(st);
    if (S.sort === 'kasaAll') return sd.all.net;
    if (S.sort === 'kasa26') return sd.y26.net;
    if (S.sort === 'exp26') return sd.y26.n ? sd.y26.net / sd.y26.n : -999;
    if (S.sort === 'pf') return sd.all.neg > 1e-6 ? sd.all.pos / sd.all.neg : 99;
    if (S.sort === 'wr') return sd.all.n ? sd.all.w / sd.all.n : 0;
    return sd.all.net;
  }

  function getFilteredStrategies() {
    var cands = getValidCandidates();
    var map = new Map();
    for (var i = 0; i < cands.length; i++) {
      var st = cands[i];
      if (!map.has(st.id)) {
        map.set(st.id, { id: st.id, title: st.title, tfs: new Set(), bestState: st, states: [] });
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
      var validVars = cellStates.filter(function (s) { return !s.isSingle && s.kind !== 'temel' && isStatePosBoth(s); });
      validVars.sort(function (a, b) { return scoreForSort(b) - scoreForSort(a); });
      var pick = validVars[0] || cellStates.find(function (s) { return isStatePosBoth(s); }) || cellStates[0];
      S.stateKey = pick ? pick.key : null;
    }
  }

  function makeChip(label, active, count, onClick) {
    var b = document.createElement('button');
    b.className = 'chip' + (active ? ' on' : '');
    b.innerHTML = esc(label) + (count != null ? '<span class="c">' + count + '</span>' : '');
    b.addEventListener('click', onClick);
    return b;
  }

  /* ------------------------------ SOL PANEL ------------------------------ */
  function renderSidebar() {
    var allCands = STATES.filter(function (s) { return s.isCandidate && isStatePosBoth(s); });
    var tfHost = el('tfChips');
    tfHost.innerHTML = '';
    tfHost.appendChild(makeChip('Tümü', S.tfFilter === 'all', allCands.length, function () {
      S.tfFilter = 'all'; renderAll();
    }));
    ALL_TFS.forEach(function (tf) {
      var cnt = allCands.filter(function (s) { return s.tf === tf; }).length;
      if (!cnt) return;
      tfHost.appendChild(makeChip(tf, S.tfFilter === tf, cnt, function () {
        S.tfFilter = tf; S.stratTf = tf; renderAll();
      }));
    });

    var volHost = el('volChips');
    volHost.innerHTML = '';
    volHost.appendChild(makeChip('Tümü (520)', S.vol == null, null, function () { S.vol = null; renderAll(); }));
    (VOL.sets || []).forEach(function (v) {
      volHost.appendChild(makeChip('Top ' + v, S.vol === v, null, function () { S.vol = v; renderAll(); }));
    });

    var unitHost = el('unitChips');
    unitHost.innerHTML = '';
    unitHost.appendChild(makeChip('1× Kasa ($10/işlem)', S.unit === 'usd', null, function () { S.unit = 'usd'; renderAll(); }));
    unitHost.appendChild(makeChip('1× Oransal (%)', S.unit === 'pct', null, function () { S.unit = 'pct'; renderAll(); }));

    var strats = getFilteredStrategies();
    var idx = strats.findIndex(function (x) { return x.id === S.stratId; });
    el('stepPos').textContent = (idx + 1) + ' / ' + strats.length;
    el('scenarioCount').textContent = allCands.length + ' doğrulanmış senaryo · sol tüm yıllar, sağ 2026';

    var sHost = el('stratList');
    sHost.innerHTML = strats.map(function (g, i) {
      var sd = getSplitData(g.bestState);
      var tfsHtml = ALL_TFS.filter(function (t) { return g.tfs.has(t); }).map(function (t) {
        return '<span class="tf-mini">' + t + '</span>';
      }).join('');
      return '<div class="strat-item' + (g.id === S.stratId ? ' on' : '') + '" data-id="' + esc(g.id) + '">' +
        '<div class="strat-r1">' +
          '<span class="strat-name">' + (i + 1) + '. ' + esc(g.title) + '</span>' +
          '<span class="strat-kasa">' + fmtUnitVal(sd.all.net, 0) + '</span>' +
        '</div>' +
        '<div class="strat-r2">' +
          '<span>' + tfsHtml + '</span>' +
          '<span>2026: <b>' + fmtUnitVal(sd.y26.net, 0) + '</b></span>' +
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
      var sd = getSplitData(st);
      var lbl = st.kind === 'temel' ? 'Filtresiz (Temel)' : st.kind.replace('varyant', 'Senaryo ') + (st.in93 ? ' ★' : '');
      return '<div class="var-item' + (st.key === S.stateKey ? ' on' : '') + '" data-key="' + esc(st.key) + '">' +
        '<div class="var-r1"><span>' + esc(lbl) + '</span><span style="color:var(--green);font-family:monospace">' + fmtUnitVal(sd.all.net, 0) + '</span></div>' +
        '<div class="var-r2">' + esc(st.ad) + ' · 2026: ' + fmtUnitVal(sd.y26.net, 0) + '</div>' +
      '</div>';
    }).join('');

    varHost.querySelectorAll('.var-item').forEach(function (item) {
      item.addEventListener('click', function () {
        S.stateKey = item.getAttribute('data-key');
        renderAll();
      });
    });
  }

  /* --------------------- ÜST BAŞLIK & SWITCH BOX --------------------- */
  function renderHeaderAndSwitchBox(sd) {
    var st = sd.st;
    var cellStates = getCellStates(st.id, st.tf);
    var baseSt = cellStates.find(function (x) { return x.kind === 'temel'; }) || st;
    var baseSd = getSplitData(baseSt);

    el('selTitle').textContent = st.title + ' (' + st.id.toUpperCase() + ' · ' + st.tf + ')';
    el('selSub').textContent = 'Seçili Filtre: ' + (st.kind === 'temel' ? 'Filtresiz (Temel Strateji)' : st.ad);

    el('selBadges').innerHTML = [
      '<span class="badge pos">✓ 26. Azami 1× Kaldıraçsız Hesaplama</span>',
      '<span class="badge acc">✓ 24. 5dk Çıkış Çözümlemesi</span>',
      '<span class="badge gold">✓ 25. Aynı 5m Mumda Korumacı SL Önce</span>',
      '<span class="badge">Zaman Dilimi: ' + esc(st.tf) + '</span>',
      '<span class="badge">' + (S.vol ? 'En Hacimli Top ' + S.vol + ' Coin' : '520 Sembol Tam Evren') + '</span>',
    ].join('');

    var rulesHtml = (st.rules || []).map(function (r, idx) {
      return '<div class="rule-pill"><b>Kural ' + (idx + 1) + ':</b> ' + esc(r) + '</div>';
    }).join('');
    rulesHtml += '<div class="rule-pill"><b>Yön & Stop:</b> ' + (st.dir === 'long' ? 'Sadece Long' : 'Long + Short') + ' · Stop: ' + esc(st.stop) + '</div>';
    el('selRules').innerHTML = rulesHtml;

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
            '<div class="sw-title">' + esc(f.title) + ' <span style="color:var(--muted);font-family:monospace;font-size:10.5px">[' + esc(f.k) + ']</span></div>' +
            '<div class="sw-desc">' + esc(f.desc) + '</div>' +
          '</div>' +
          '<div class="sw-toggle" role="switch" aria-checked="' + isOn + '"></div>' +
        '</div>';
      }).join('');

      swHost.querySelectorAll('.sw-row').forEach(function (row) {
        row.addEventListener('click', function () {
          toggleFilterSwitch(row.getAttribute('data-fk'), cellStates);
        });
      });
    }

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

    var diffAll = sd.all.net - baseSd.all.net;
    var diff26 = sd.y26.net - baseSd.y26.net;
    var curAvg = sd.all.n ? (sd.all.net / sd.all.n) * 100 : 0;
    var baseAvg = baseSd.all.n ? (baseSd.all.net / baseSd.all.n) * 100 : 0;
    var diffAvg = curAvg - baseAvg;
    var keepRatio = baseSd.all.n ? (sd.all.n / baseSd.all.n) * 100 : 100;

    el('deltaStrip').innerHTML =
      '<div class="delta-item"><div class="dl">Tüm Yıllar Δ</div><div class="dv" style="color:' + (diffAll >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtUnitVal(diffAll, 0) + '</div></div>' +
      '<div class="delta-item"><div class="dl">2026 Δ</div><div class="dv" style="color:' + (diff26 >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtUnitVal(diff26, 0) + '</div></div>' +
      '<div class="delta-item"><div class="dl">Ort. R Δ</div><div class="dv" style="color:' + (diffAvg >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (diffAvg >= 0 ? '+' : '') + diffAvg.toFixed(2) + '%</div></div>' +
      '<div class="delta-item"><div class="dl">Korunan İşlem</div><div class="dv" style="color:var(--blue)">%' + keepRatio.toFixed(1) + ' (' + nf(sd.all.n) + ')</div></div>';
  }

  function toggleFilterSwitch(fk, cellStates) {
    var cur = byKey.get(S.stateKey);
    var nextKeys = new Set(cur ? cur.keys : []);
    if (nextKeys.has(fk)) nextKeys.delete(fk);
    else nextKeys.add(fk);
    var arr = Array.from(nextKeys).sort();
    var sig = arr.join('+');
    var exact = cellStates.find(function (cs) { return cs.keys.slice().sort().join('+') === sig; });
    if (exact) { S.stateKey = exact.key; renderAll(); return; }
    if (nextKeys.has(fk)) {
      var withFk = cellStates.filter(function (cs) { return !cs.isSingle && cs.keys.indexOf(fk) >= 0 && isStatePosBoth(cs); });
      withFk.sort(function (a, b) { return scoreForSort(b) - scoreForSort(a); });
      var singleFk = cellStates.find(function (cs) { return cs.keys.length === 1 && cs.keys[0] === fk; });
      var target = (arr.length === 1 && singleFk) ? singleFk : (withFk[0] || singleFk);
      if (target) { S.stateKey = target.key; renderAll(); }
    } else {
      var base = cellStates.find(function (cs) { return cs.kind === 'temel'; });
      if (base) { S.stateKey = base.key; renderAll(); }
    }
  }

  /* ---------------- 5..12 KPI ÖZETİ (SOL: TÜM YILLAR | SAĞ: 2026) ---------------- */
  function build8KpisHtml(sideObj) {
    var n = sideObj.n;
    var w = sideObj.w;
    var l = sideObj.loss;
    var wr = n ? (w / n) * 100 : 0;
    var lr = n ? (l / n) * 100 : 0;
    var avgR = n ? sideObj.net / n : 0;
    var avgDurH = n ? sideObj.durSum / n : 0;
    var pf = sideObj.neg > 1e-6 ? sideObj.pos / sideObj.neg : 99;

    var items = [
      { l: '5. Toplam İşlem Sayısı', v: nf(n), s: '1× Kaldıraçsız Simülasyon', c: 'acc' },
      { l: '6. Kârlı İşlem Sayısı', v: nf(w), s: 'Kazanma Oranı: %' + wr.toFixed(1), c: 'pos' },
      { l: '7. Zararlı / Başa Baş İşlem', v: nf(l), s: 'Kayıp Oranı: %' + lr.toFixed(1), c: 'neg' },
      { l: '8. İşlem Başına Ort. Net Getiri', v: fmtPct(avgR, 2), s: '$10 işlemde ort. ' + fmtUsd(avgR * 10, 2), c: avgR >= 0 ? 'pos' : 'neg' },
      { l: '9. Ort. İşlemde Kalış Süresi', v: fmtDurHours(avgDurH), s: 'Toplam: ' + nf(Math.round(sideObj.durSum / 24)) + ' gün', c: 'gold' },
      { l: '10. Toplam Brüt Kâr', v: fmtUnitVal(sideObj.pos, 0), s: 'Oransal: +' + nf(sideObj.pos * 100, 1) + '%', c: 'pos' },
      { l: '11. Toplam Brüt Zarar', v: '-' + fmtUnitVal(sideObj.neg, 0).replace(/^[+-]/, ''), s: 'Oransal: -' + nf(sideObj.neg * 100, 1) + '%', c: 'neg' },
      { l: '12. Net Sonuç (Kâr − Zarar)', v: fmtUnitVal(sideObj.net, 0), s: 'Profit Factor: ' + pf.toFixed(2) + 'x', c: sideObj.net >= 0 ? 'pos' : 'neg' },
    ];

    return items.map(function (it) {
      return '<div class="kpi-box ' + it.c + '">' +
        '<div class="kl">' + esc(it.l) + '</div>' +
        '<div class="kv ' + it.c + '">' + esc(it.v) + '</div>' +
        '<div class="ks">' + esc(it.s) + '</div>' +
      '</div>';
    }).join('');
  }

  function renderSplitKpis(sd) {
    el('kpisAll').innerHTML = build8KpisHtml(sd.all);
    el('kpis2026').innerHTML = build8KpisHtml(sd.y26);
  }

  /* ---------------------- PLOTLY GRAFİK FONKSİYONLARI ---------------------- */
  var PLOT_CFG = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
  };

  function layoutBase(extra) {
    var lay = {
      paper_bgcolor: '#101d2b',
      plot_bgcolor: '#101d2b',
      font: {
        family: 'Inter, Segoe UI, Arial, sans-serif',
        size: 11,
        color: '#aac0ce',
      },
      margin: { l: 54, r: 20, t: 24, b: 40 },
      xaxis: {
        gridcolor: '#26384a',
        zerolinecolor: '#3b5267',
        tickfont: { size: 11, color: '#9fb0cc' },
      },
      yaxis: {
        gridcolor: '#26384a',
        zerolinecolor: '#3b5267',
        zerolinewidth: 1.4,
        tickfont: { size: 11, color: '#9fb0cc' },
      },
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.13,
        font: { size: 11, color: '#91a6b6' },
        bgcolor: 'rgba(0,0,0,0)',
      },
      hovermode: 'x unified',
      hoverlabel: {
        bgcolor: '#142334',
        bordercolor: '#376282',
        font: { family: 'Inter, Segoe UI, Arial, sans-serif', size: 11.5, color: '#e8f0f4' },
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

  function plotDivergingBars(domId, labels, rows, yTitle) {
    var m = unitMult();
    var uLbl = unitSuffix();
    var yPos = rows.map(function (r) { return Math.round(r.pos * m * 10) / 10; });
    var yNeg = rows.map(function (r) { return -Math.round(r.neg * m * 10) / 10; });
    var yNet = rows.map(function (r) { return Math.round(r.net * m * 10) / 10; });
    var meta = rows.map(function (r) {
      var wr = r.n ? (r.w / r.n * 100).toFixed(1) : '0.0';
      return nf(r.n) + ' işlem · WR %' + wr;
    });

    Plotly.react(domId, [
      {
        x: labels,
        y: yPos,
        type: 'bar',
        name: 'Brüt Kâr (+' + uLbl.trim() + ')',
        marker: { color: '#46d49a' },
      },
      {
        x: labels,
        y: yNeg,
        type: 'bar',
        name: 'Brüt Zarar (-' + uLbl.trim() + ')',
        marker: { color: '#ff6f7d' },
      },
      {
        x: labels,
        y: yNet,
        text: meta,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Net Sonuç (' + uLbl.trim() + ')',
        line: { color: '#f2c674', width: 2.2 },
        marker: { size: 7, symbol: 'diamond', color: '#f2c674' },
      },
    ], layoutBase({
      barmode: 'relative',
      xaxis: { type: 'category' },
      yaxis: { title: yTitle || ('Kâr / Zarar (' + uLbl.trim() + ')') },
    }), PLOT_CFG);
  }

  // Satır 1 & 2: Kümülatif Net Özsermaye Eğrisi ve Drawdown Eğrisi (Sol: Tüm Yıllar | Sağ: 2026)
  function drawEquityAndDrawdownPair(domEq, domDd, sideObj, colorLine) {
    var m = unitMult();
    var uLbl = unitSuffix();
    var n = sideObj.dayPos.length;
    var eq = new Float64Array(n);
    var pk = new Float64Array(n);
    var dd = new Float64Array(n);
    var cur = 0, peak = 0;
    for (var i = 0; i < n; i++) {
      cur += (sideObj.dayPos[i] - sideObj.dayNeg[i]) * m;
      eq[i] = Math.round(cur * 100) / 100;
      if (eq[i] > peak) peak = eq[i];
      pk[i] = peak;
      dd[i] = Math.round((eq[i] - peak) * 100) / 100;
    }

    Plotly.react(domEq, [
      {
        x: sideObj.dates,
        y: Array.from(pk),
        type: 'scatter',
        mode: 'lines',
        name: 'Zirve (High Watermark)',
        line: { color: 'rgba(148,163,184,0.45)', width: 1.2, dash: 'dot' },
      },
      {
        x: sideObj.dates,
        y: Array.from(eq),
        type: 'scatter',
        mode: 'lines',
        name: 'Kümülatif Net Özsermaye (' + uLbl.trim() + ')',
        fill: 'tozeroy',
        fillcolor: colorLine === '#46d49a' ? 'rgba(70,212,154,0.14)' : 'rgba(242,198,116,0.14)',
        line: { color: colorLine, width: 2.5 },
      },
    ], layoutBase({
      yaxis: { title: 'Net Özsermaye (' + uLbl.trim() + ')' },
    }), PLOT_CFG);

    Plotly.react(domDd, [
      {
        x: sideObj.dates,
        y: Array.from(dd),
        type: 'scatter',
        mode: 'lines',
        name: 'Drawdown (' + uLbl.trim() + ')',
        fill: 'tozeroy',
        fillcolor: 'rgba(255,111,125,0.2)',
        line: { color: '#ff6f7d', width: 2 },
      },
    ], layoutBase({
      yaxis: { title: 'Zirveden Düşüş (' + uLbl.trim() + ')' },
    }), PLOT_CFG);
  }

  // Satır 3: Filtreli–Filtresiz Net Getiri Karşılaştırması (Sol: Tüm Yıllar | Sağ: 2026)
  function drawFilterCompareRow(sd) {
    var st = sd.st;
    var cellStates = getCellStates(st.id, st.tf);
    var m = unitMult();
    var uLbl = unitSuffix();
    var palette = ['#91a6b6', '#6caaff', '#b48df2', '#f59e0b', '#46d49a'];

    var ordered = cellStates.filter(function (cs) {
      return !cs.isSingle && (cs.kind === 'temel' || isStatePosBoth(cs));
    });

    function buildTraces(is2026) {
      var startIdx = is2026 ? IDX_2026 : 0;
      var xDates = is2026 ? DATES_2026 : DATE_STRS;
      return ordered.map(function (cs, idx) {
        var csd = getSplitData(cs);
        var len = GRID.len - startIdx;
        var yArr = new Float64Array(len);
        var s = 0;
        for (var i = 0; i < len; i++) {
          var di = startIdx + i;
          s += (csd.all.dayPos[di] - csd.all.dayNeg[di]) * m;
          yArr[i] = Math.round(s * 10) / 10;
        }
        var isSel = cs.key === st.key;
        var isBase = cs.kind === 'temel';
        var lbl = isBase ? 'Filtresiz (Temel)' : cs.kind.replace('varyant', 'V') + ': ' + cs.keyTitles.join(' + ');
        return {
          x: xDates,
          y: Array.from(yArr),
          type: 'scatter',
          mode: 'lines',
          name: lbl + (isSel ? ' [SEÇİLİ]' : ''),
          line: {
            color: isSel ? '#46d49a' : (isBase ? '#ff6f7d' : palette[idx % palette.length]),
            width: isSel ? 3 : (isBase ? 2.2 : 1.7),
            dash: isBase ? 'dot' : 'solid',
          },
        };
      });
    }

    Plotly.react('cFltCmp_all', buildTraces(false), layoutBase({
      yaxis: { title: 'Tüm Yıllar Net (' + uLbl.trim() + ')' },
    }), PLOT_CFG);

    Plotly.react('cFltCmp_26', buildTraces(true), layoutBase({
      yaxis: { title: '2026 Net (' + uLbl.trim() + ')' },
    }), PLOT_CFG);
  }

  // Satır 4: Hareketli 30, 90 ve 365 Günlük Net Getiri (Sol: Tüm Yıllar | Sağ: 2026)
  function drawRollingRow(sd) {
    var m = unitMult();
    var uLbl = unitSuffix();
    var netDay = new Float64Array(GRID.len);
    for (var i = 0; i < GRID.len; i++) netDay[i] = (sd.all.dayPos[i] - sd.all.dayNeg[i]) * m;

    function rollingSum(win) {
      var out = new Float64Array(GRID.len);
      var s = 0;
      for (var k = 0; k < GRID.len; k++) {
        s += netDay[k];
        if (k >= win) s -= netDay[k - win];
        out[k] = Math.round(s * 10) / 10;
      }
      return out;
    }

    var r30 = rollingSum(30);
    var r90 = rollingSum(90);
    var r365 = rollingSum(365);

    Plotly.react('cRoll_all', [
      { x: DATE_STRS, y: Array.from(r30), type: 'scatter', mode: 'lines', name: '30 Günlük Net', line: { color: '#6caaff', width: 1.5 } },
      { x: DATE_STRS, y: Array.from(r90), type: 'scatter', mode: 'lines', name: '90 Günlük Net', line: { color: '#46d49a', width: 2.1 } },
      { x: DATE_STRS, y: Array.from(r365), type: 'scatter', mode: 'lines', name: '365 Günlük Net', line: { color: '#f2c674', width: 2.5 } },
    ], layoutBase({ yaxis: { title: 'Hareketli Net (' + uLbl.trim() + ')' } }), PLOT_CFG);

    Plotly.react('cRoll_26', [
      { x: DATES_2026, y: Array.from(r30.slice(IDX_2026)), type: 'scatter', mode: 'lines', name: '30 Günlük Net', line: { color: '#6caaff', width: 1.8 } },
      { x: DATES_2026, y: Array.from(r90.slice(IDX_2026)), type: 'scatter', mode: 'lines', name: '90 Günlük Net', line: { color: '#46d49a', width: 2.3 } },
      { x: DATES_2026, y: Array.from(r365.slice(IDX_2026)), type: 'scatter', mode: 'lines', name: '365 Günlük Net', line: { color: '#f2c674', width: 2.6 } },
    ], layoutBase({ yaxis: { title: '2026 Hareketli Net (' + uLbl.trim() + ')' } }), PLOT_CFG);
  }

  // Satır 5 & 6: (13) Günlük Kâr-Zarar ve (14) Haftalık Kâr-Zarar Grafikleri
  function drawDailyAndWeeklyRows(sd) {
    var m = unitMult();
    var uLbl = unitSuffix();

    function plotDaily(domId, sideObj, gap) {
      var n = sideObj.dayPos.length;
      var pArr = new Array(n), nArr = new Array(n);
      for (var i = 0; i < n; i++) {
        pArr[i] = Math.round(sideObj.dayPos[i] * m * 100) / 100;
        nArr[i] = -Math.round(sideObj.dayNeg[i] * m * 100) / 100;
      }
      Plotly.react(domId, [
        { x: sideObj.dates, y: pArr, type: 'bar', name: 'Günlük Kâr (+' + uLbl.trim() + ')', marker: { color: '#46d49a' } },
        { x: sideObj.dates, y: nArr, type: 'bar', name: 'Günlük Zarar (-' + uLbl.trim() + ')', marker: { color: '#ff6f7d' } },
      ], layoutBase({
        barmode: 'relative',
        bargap: gap,
        yaxis: { title: 'Günlük Kâr/Zarar (' + uLbl.trim() + ')' },
      }), PLOT_CFG);
    }

    plotDaily('cDay_all', sd.all, 0);
    plotDaily('cDay_26', sd.y26, 0.08);

    function plotWeekly(domId, sideObj) {
      var wMap = new Map();
      for (var i = 0; i < sideObj.dayPos.length; i++) {
        var wk = sideObj.weeks[i];
        var rec = wMap.get(wk);
        if (!rec) { rec = { p: 0, ng: 0 }; wMap.set(wk, rec); }
        rec.p += sideObj.dayPos[i];
        rec.ng += sideObj.dayNeg[i];
      }
      var wKeys = Array.from(wMap.keys());
      var wPos = wKeys.map(function (k) { return Math.round(wMap.get(k).p * m * 10) / 10; });
      var wNeg = wKeys.map(function (k) { return -Math.round(wMap.get(k).ng * m * 10) / 10; });
      var wNet = wKeys.map(function (k) { var r = wMap.get(k); return Math.round((r.p - r.ng) * m * 10) / 10; });

      Plotly.react(domId, [
        { x: wKeys, y: wPos, type: 'bar', name: 'Haftalık Kâr (+' + uLbl.trim() + ')', marker: { color: '#46d49a' } },
        { x: wKeys, y: wNeg, type: 'bar', name: 'Haftalık Zarar (-' + uLbl.trim() + ')', marker: { color: '#ff6f7d' } },
        { x: wKeys, y: wNet, type: 'scatter', mode: 'lines', name: 'Haftalık Net', line: { color: '#f2c674', width: 1.8 } },
      ], layoutBase({
        barmode: 'relative',
        yaxis: { title: 'Haftalık Kâr/Zarar (' + uLbl.trim() + ')' },
      }), PLOT_CFG);
    }

    plotWeekly('cWeek_all', sd.all);
    plotWeekly('cWeek_26', sd.y26);
  }

  // Satır 7, 8, 9, 10: (15) Aylık, (16) Mevsimlik, Haftanın Günü ve Ay×Yıl Heatmap
  function drawCalendarRows(sd) {
    // 15. Aylık Kâr-Zarar
    var mLabsAll = sd.timelineMonthsAll.map(function (x) { return x.label; });
    plotDivergingBars('cMonth_all', mLabsAll, sd.timelineMonthsAll, 'Aylık Kâr / Zarar');

    var mLabs26 = sd.timelineMonths26.map(function (x) { return x.label; });
    plotDivergingBars('cMonth_26', mLabs26, sd.timelineMonths26, '2026 Aylık Kâr / Zarar');

    // 16. Mevsimlik Kâr-Zarar
    plotDivergingBars('cSeason_all', SEASON_LABELS, sd.all.season, 'Mevsimlik Kâr / Zarar');
    plotDivergingBars('cSeason_26', SEASON_LABELS, sd.y26.season, '2026 Mevsimlik Kâr / Zarar');

    // Haftanın Gününe Göre Net Performans (Pzt..Paz)
    var dowAll = [1, 2, 3, 4, 5, 6, 0].map(function (idx) { return sd.all.dow[idx]; });
    var dow26 = [1, 2, 3, 4, 5, 6, 0].map(function (idx) { return sd.y26.dow[idx]; });
    plotDivergingBars('cDow_all', DOW_LABELS, dowAll, 'Haftanın Günü Kâr/Zarar');
    plotDivergingBars('cDow_26', DOW_LABELS, dow26, '2026 Haftanın Günü Kâr/Zarar');

    // Ay × Yıl Net Getiri Heatmap'i (Sol: 2022–2026 | Sağ: 2026 Aylık Detay Heatmap)
    var m = unitMult();
    var uLbl = unitSuffix();
    var yYears = ['2022', '2023', '2024', '2025', '2026'];
    var zAll = [], tAll = [];
    for (var yi = 0; yi < 5; yi++) {
      var zr = [], tr = [];
      for (var mi = 0; mi < 12; mi++) {
        if ((yi === 0 && mi < 7) || (yi === 4 && mi > 8)) {
          zr.push(null); tr.push('');
        } else {
          var v = Math.round(sd.monthMatrix[yi][mi].net * m * 10) / 10;
          zr.push(v);
          tr.push((v >= 0 ? '+' : '') + nf(v, 0));
        }
      }
      zAll.push(zr); tAll.push(tr);
    }

    var hmColor = [
      [0, '#be123c'],
      [0.38, '#881337'],
      [0.5, '#1e293b'],
      [0.62, '#065f46'],
      [1, '#46d49a'],
    ];

    Plotly.react('cCal_all', [{
      x: MONTH_LABELS,
      y: yYears,
      z: zAll,
      text: tAll,
      texttemplate: '%{text}',
      textfont: { family: "'JetBrains Mono', monospace", size: 11 },
      type: 'heatmap',
      colorscale: hmColor,
      zmid: 0,
    }], layoutBase({
      xaxis: { type: 'category' },
      yaxis: { type: 'category' },
      hovermode: 'closest',
    }), PLOT_CFG);

    // Sağ: 2026 Aylarında Brüt Kâr, Brüt Zarar ve Net Sonuç Matrisi
    var m26Names = MONTH_LABELS.slice(0, 9);
    var z26 = [
      m26Names.map(function (_, mi) { return Math.round(sd.monthMatrix[4][mi].pos * m * 10) / 10; }),
      m26Names.map(function (_, mi) { return -Math.round(sd.monthMatrix[4][mi].neg * m * 10) / 10; }),
      m26Names.map(function (_, mi) { return Math.round(sd.monthMatrix[4][mi].net * m * 10) / 10; }),
    ];
    var t26 = z26.map(function (row) {
      return row.map(function (v) { return (v >= 0 ? '+' : '') + nf(v, 0); });
    });

    Plotly.react('cCal_26', [{
      x: m26Names,
      y: ['2026 Brüt Kâr', '2026 Brüt Zarar', '2026 Net Sonuç'],
      z: z26,
      text: t26,
      texttemplate: '%{text}',
      textfont: { family: "'JetBrains Mono', monospace", size: 11.5 },
      type: 'heatmap',
      colorscale: hmColor,
      zmid: 0,
    }], layoutBase({
      xaxis: { type: 'category' },
      yaxis: { type: 'category' },
      hovermode: 'closest',
    }), PLOT_CFG);
  }

  // Satır 11 & 12: (17) İşlem Süresi Histogramı ve (18) İşlem Süresine Göre Kâr-Zarar
  function drawDurationRows(sd) {
    function plotDurCount(domId, durRows) {
      var counts = durRows.map(function (r) { return r.n; });
      var wrs = durRows.map(function (r) { return r.n ? Math.round((r.w / r.n) * 1000) / 10 : 0; });
      Plotly.react(domId, [
        {
          x: DUR_LABELS,
          y: counts,
          type: 'bar',
          name: 'İşlem Sayısı',
          marker: { color: '#6caaff' },
          text: counts.map(function (c) { return nf(c); }),
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
          line: { color: '#46d49a', width: 2.3 },
          marker: { size: 7, color: '#46d49a' },
        },
      ], layoutBase({
        xaxis: { type: 'category' },
        yaxis: { title: 'İşlem Sayısı (Adet)' },
        yaxis2: {
          title: 'WR (%)',
          overlaying: 'y',
          side: 'right',
          range: [0, 100],
          showgrid: false,
          tickfont: { color: '#46d49a' },
        },
      }), PLOT_CFG);
    }

    plotDurCount('cDurCnt_all', sd.all.dur);
    plotDurCount('cDurCnt_26', sd.y26.dur);

    plotDivergingBars('cDurPnl_all', DUR_LABELS, sd.all.dur, 'Süreye Göre Kâr / Zarar');
    plotDivergingBars('cDurPnl_26', DUR_LABELS, sd.y26.dur, '2026 Süreye Göre Kâr / Zarar');
  }

  // Satır 13, 14, 15: Long–Short Karşılaştırması ve Çıkış Nedenleri (SL / TP / Flip / MaxBars)
  function drawLsAndExitRows(sd) {
    plotDivergingBars('cLs_all', ['Long İşlemler', 'Short İşlemler'], sd.all.ls, 'Long vs Short Kâr / Zarar');
    plotDivergingBars('cLs_26', ['Long İşlemler', 'Short İşlemler'], sd.y26.ls, '2026 Long vs Short Kâr / Zarar');

    function plotExitCounts(domId, exitRows) {
      var counts = exitRows.map(function (r) { return r.n; });
      var wrs = exitRows.map(function (r) { return r.n ? Math.round((r.w / r.n) * 1000) / 10 : 0; });
      Plotly.react(domId, [
        {
          x: EXIT_LABELS,
          y: counts,
          type: 'bar',
          name: 'Çıkış Adedi',
          marker: { color: ['#ff6f7d', '#46d49a', '#6caaff', '#b48df2'] },
          text: counts.map(function (c, idx) { return nf(c) + ' (WR %' + wrs[idx] + ')'; }),
          textposition: 'outside',
          cliponaxis: false,
        },
      ], layoutBase({
        xaxis: { type: 'category' },
        yaxis: { title: 'İşlem Sayısı' },
      }), PLOT_CFG);
    }

    plotExitCounts('cExitCnt_all', sd.all.exit);
    plotExitCounts('cExitCnt_26', sd.y26.exit);

    plotDivergingBars('cExitPnl_all', EXIT_LABELS, sd.all.exit, 'Çıkış Nedenine Göre Kâr/Zarar');
    plotDivergingBars('cExitPnl_26', EXIT_LABELS, sd.y26.exit, '2026 Çıkış Nedenine Göre Kâr/Zarar');
  }

  // Satır 16: (19) Coin Bazında Kâr-Zarar Grafiği (Seçilen Metotta En Aktif 40 Coin)
  function drawCoinRows(sd) {
    var m = unitMult();
    var uLbl = unitSuffix();

    function plotTop40Coins(domId, coinsArr) {
      var filtered = (coinsArr || []).filter(function (c) {
        if (S.vol == null) return true;
        var rk = VOL.rank && VOL.rank[c[0]];
        return !rk || rk <= S.vol;
      }).slice(0, 40);

      // Net sonuca göre aşağıdan yukarıya sırala
      filtered.sort(function (a, b) { return (a[3] - a[4]) - (b[3] - b[4]); });

      var names = filtered.map(function (c) { return (SYMS[c[0]] || '').replace(/USDT$/, '') + ' (' + c[1] + ')'; });
      var cPos = filtered.map(function (c) { return Math.round((c[3] / 100) * m * 10) / 10; });
      var cNeg = filtered.map(function (c) { return -Math.round((c[4] / 100) * m * 10) / 10; });
      var cNet = filtered.map(function (c) { return Math.round(((c[3] - c[4]) / 100) * m * 10) / 10; });

      Plotly.react(domId, [
        { y: names, x: cPos, orientation: 'h', type: 'bar', name: 'Brüt Kâr (+' + uLbl.trim() + ')', marker: { color: '#46d49a' } },
        { y: names, x: cNeg, orientation: 'h', type: 'bar', name: 'Brüt Zarar (-' + uLbl.trim() + ')', marker: { color: '#ff6f7d' } },
        { y: names, x: cNet, orientation: 'h', type: 'scatter', mode: 'markers', name: 'Net Sonuç', marker: { color: '#f2c674', size: 6.5, symbol: 'diamond' } },
      ], layoutBase({
        barmode: 'relative',
        hovermode: 'y unified',
        margin: { l: 105, r: 18, t: 24, b: 36 },
        yaxis: { type: 'category', tickfont: { size: 9.5, color: '#cbd5e1' } },
        xaxis: { title: 'En Aktif 40 Coin Kâr / Zarar (' + uLbl.trim() + ')' },
      }), PLOT_CFG);
    }

    plotTop40Coins('cCoin_all', sd.all.coins);
    plotTop40Coins('cCoin_26', sd.y26.coins);
  }

  // Satır 17: (20, 21, 22, 23) 66 Filtrenin Net Toplam Getiri Heatmap'i + WR% + Ort R + İşlem Sayısı
  function drawFilterHeatmapRows(sd) {
    var ck = sd.st.id + '|' + sd.st.tf;
    var rowsF = CELL_FLT[ck] || [];
    if (!rowsF.length || !FLT_CAT.length) return;

    // [fn, fwr, favg, ftot, n26, wr26, avg26, tot26]
    function moneyCompact(v) {
      var a = Math.abs(v);
      var s = a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'K' : a.toFixed(0);
      return (v >= 0 ? '+$' : '-$') + s;
    }

    function plotFltHeatmap(domId, is2026) {
      var yNames = [];
      var zMatrix = [];
      var textMatrix = [];
      var customMatrix = [];

      // Toplam net getiriye göre en iyi 56 filtreyi sırala
      var indexed = FLT_CAT.map(function (f, idx) {
        var r = rowsF[idx] || [0, 0, 0, 0, 0, 0, 0, 0];
        return {
          title: f.title,
          k: f.k,
          n: is2026 ? r[4] : r[0],
          wr: is2026 ? r[5] : r[1],
          avg: is2026 ? r[6] : r[2],
          tot: is2026 ? r[7] : r[3],
        };
      }).filter(function (x) { return x.n > 0; });

      indexed.sort(function (a, b) { return a.tot - b.tot; });
      if (indexed.length > 56) indexed = indexed.slice(-56);

      // Normalize her sütunu [-1, 1] aralığına renk için, gerçek değerleri metin olarak yaz
      var maxTot = Math.max.apply(null, indexed.map(function (x) { return Math.abs(x.tot); }).concat([1]));
      var maxAvg = Math.max.apply(null, indexed.map(function (x) { return Math.abs(x.avg); }).concat([1]));
      var maxN = Math.max.apply(null, indexed.map(function (x) { return x.n; }).concat([1]));

      indexed.forEach(function (it) {
        yNames.push(it.title);
        zMatrix.push([
          it.tot / maxTot,
          (it.wr - 50) / 50,
          it.avg / maxAvg,
          (it.n / maxN) * 0.6,
        ]);
        textMatrix.push([
          moneyCompact(it.tot),
          '%' + it.wr.toFixed(1),
          (it.avg >= 0 ? '+' : '') + it.avg.toFixed(2) + '%',
          nf(it.n),
        ]);
        customMatrix.push(it);
      });

      var xCols = ['Toplam<br>Net $', 'Kazanma<br>WR %', 'Ort.<br>R %', 'İşlem<br>Sayısı'];

      Plotly.react(domId, [{
        x: xCols,
        y: yNames,
        z: zMatrix,
        text: textMatrix,
        texttemplate: '%{text}',
        textfont: { family: 'monospace', size: 9.5 },
        type: 'heatmap',
        colorscale: [
          [0, '#be123c'],
          [0.42, '#4c0519'],
          [0.5, '#17253b'],
          [0.58, '#064e3b'],
          [1, '#46d49a'],
        ],
        zmin: -1,
        zmax: 1,
        showscale: false,
      }], layoutBase({
        margin: { l: 218, r: 10, t: 54, b: 16 },
        xaxis: { type: 'category', side: 'top', tickfont: { size: 10, color: '#aac0ce' } },
        yaxis: { type: 'category', tickfont: { size: 9.5, color: '#c5d5df' } },
        hovermode: 'closest',
      }), PLOT_CFG);
    }

    plotFltHeatmap('cFltHeat_all', false);
    plotFltHeatmap('cFltHeat_26', true);
  }

  function renderAll() {
    ensureSelection();
    renderSidebar();
    var st = byKey.get(S.stateKey);
    if (!st) return;
    var sd = getSplitData(st);

    renderHeaderAndSwitchBox(sd);
    renderSplitKpis(sd);

    drawEquityAndDrawdownPair('cEq_all', 'cDd_all', sd.all, '#46d49a');
    drawEquityAndDrawdownPair('cEq_26', 'cDd_26', sd.y26, '#f2c674');
    drawFilterCompareRow(sd);
    drawRollingRow(sd);
    drawDailyAndWeeklyRows(sd);
    drawCalendarRows(sd);
    drawDurationRows(sd);
    drawLsAndExitRows(sd);
    drawCoinRows(sd);
    drawFilterHeatmapRows(sd);
  }

  /* ==================== STRATEJİ × FİLTRE × TF TABLOSU ==================== */
  var TS = {
    q: '',
    tf: 'all',
    kind: 'all',
    sortKey: 'score',
    sortDir: -1,
    ranges: {},
  };
  var TABLE_ROWS = null;

  function buildTableRows() {
    var rows = [];
    for (var i = 0; i < STATES.length; i++) {
      var st = STATES[i];
      var n = st.agg ? st.agg.n : 0;
      if (!n) continue;
      var w = st.agg.w || 0;
      var l = Math.max(0, n - w);
      var avgAll = (st.totAvg != null) ? st.totAvg : (st.agg.sumR / n);
      var avg26 = (st.y26Avg != null) ? st.y26Avg : 0;
      var winDur = (st.winDurH != null) ? st.winDurH : null;
      var ratio = (st.winRatio != null) ? st.winRatio : (l > 0 ? w / l : Infinity);
      var filterLabel = (st.kind === 'temel')
        ? 'Filtresiz (Temel)'
        : (st.ad || (st.keyTitles || []).join(' + ') || '—');
      rows.push({
        key: st.key,
        id: st.id,
        title: st.title,
        tf: st.tf,
        kind: st.kind,
        isBase: st.kind === 'temel',
        filterLabel: filterLabel,
        hay: (st.id + ' ' + st.title + ' ' + st.tf + ' ' + filterLabel + ' ' + st.key).toLowerCase(),
        n: n,
        w: w,
        l: l,
        avgAll: avgAll,
        avg26: avg26,
        winDur: winDur,
        ratio: ratio,
        ratioCap: 0,
        score: 0,
        s2: 0,
        s4: 0,
        s5: 0,
      });
    }

    var maxRatio = 0;
    rows.forEach(function (r) {
      if (isFinite(r.ratio)) maxRatio = Math.max(maxRatio, r.ratio);
    });
    rows.forEach(function (r) {
      r.ratioCap = isFinite(r.ratio) ? r.ratio : maxRatio;
    });

    function mm(key) {
      var lo = Infinity, hi = -Infinity;
      rows.forEach(function (r) {
        var v = r[key];
        if (v == null || !isFinite(v)) return;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      });
      return { lo: lo, hi: hi };
    }
    var m2 = mm('avgAll');
    var m4 = mm('winDur');
    var m5 = mm('ratioCap');

    function scale(v, m) {
      if (v == null || !isFinite(v) || !isFinite(m.lo) || m.hi - m.lo < 1e-12) return 0;
      var t = (v - m.lo) / (m.hi - m.lo);
      return Math.max(0, Math.min(1, t));
    }

    rows.forEach(function (r) {
      r.s2 = scale(r.avgAll, m2) * 33.3;
      r.s4 = (1 - scale(r.winDur, m4)) * 33.3; // ters ölçek: kısa süre yüksek puan
      r.s5 = scale(r.ratioCap, m5) * 33.3;
      r.score = r.s2 + r.s4 + r.s5;
    });

    TABLE_ROWS = rows;
  }

  function tblParseNum(s) {
    if (s == null) return null;
    s = String(s).trim().replace(/\s/g, '').replace(',', '.');
    if (!s) return null;
    var v = Number(s);
    return isFinite(v) ? v : null;
  }

  function tblFilterValue(r, key) {
    if (key === 'avgAll' || key === 'avg26') return r[key] * 100;
    if (key === 'ratio') return r.ratioCap;
    return r[key];
  }

  function tblMatches(r) {
    if (TS.tf !== 'all' && r.tf !== TS.tf) return false;
    if (TS.kind === 'base' && !r.isBase) return false;
    if (TS.kind === 'filtered' && r.isBase) return false;
    if (TS.q) {
      var toks = TS.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < toks.length; i++) if (r.hay.indexOf(toks[i]) < 0) return false;
    }
    for (var k in TS.ranges) {
      var rg = TS.ranges[k];
      if (!rg) continue;
      var v = tblFilterValue(r, k);
      if (v == null || !isFinite(v)) v = -Infinity;
      if (rg[0] != null && v < rg[0]) return false;
      if (rg[1] != null && v > rg[1]) return false;
    }
    return true;
  }

  function tblCmp(a, b) {
    var k = TS.sortKey, d = TS.sortDir;
    if (k === 'title' || k === 'tf' || k === 'filter') {
      var sa = k === 'filter' ? a.filterLabel : a[k];
      var sb = k === 'filter' ? b.filterLabel : b[k];
      return d * String(sa).localeCompare(String(sb), 'tr');
    }
    var va = a[k], vb = b[k];
    if (k === 'ratio') { va = a.ratioCap; vb = b.ratioCap; }
    if (va == null || !isFinite(va)) va = -Infinity;
    if (vb == null || !isFinite(vb)) vb = -Infinity;
    return d * ((va > vb) - (va < vb));
  }

  function tblScoreClass(s) {
    if (s >= 66) return 'hi';
    if (s >= 33) return 'mid';
    return 'lo';
  }

  function tblAvgCell(v) {
    var cls = v >= 0 ? 'pos' : 'neg';
    return '<td class="num ' + cls + '">' + fmtPct(v, 2) +
      '<span class="cell-sub">' + fmtUsd(v * 10, 2) + '</span></td>';
  }

  function initTableHeader() {
    var head = el('tblHead');
    if (!head) return;

    var cols = [
      { k: 'rank', label: '#', cls: 'idx' },
      { k: 'title', label: 'Strateji', cls: 'txt' },
      { k: 'tf', label: 'TF', cls: 'txt' },
      { k: 'filter', label: 'Filtre', cls: 'txt' },
      { k: 'n', label: 'İşlem', cls: '' },
      { k: 'avgAll', label: 'Net / İşlem<br>Tüm Yıllar', cls: '' },
      { k: 'avg26', label: 'Net / İşlem<br>2026', cls: '' },
      { k: 'winDur', label: 'Kârlı İşlem<br>Ort. Süre (saat)', cls: '' },
      { k: 'ratio', label: 'Kârlı / Zararlı', cls: '' },
      { k: 'score', label: 'Puan<br>(0–99,9)', cls: '' },
    ];

    var h1 = '<tr>' + cols.map(function (c) {
      return '<th data-k="' + c.k + '" class="' + c.cls + '">' + c.label + '<span class="arrow">↕</span></th>';
    }).join('') + '</tr>';

    function pair(k) {
      return '<div class="fcell">' +
        '<input class="fnum" data-k="' + k + '" data-b="min" placeholder="min" inputmode="decimal">' +
        '<input class="fnum" data-k="' + k + '" data-b="max" placeholder="max" inputmode="decimal">' +
        '</div>';
    }

    var h2 = '<tr class="filters">' +
      '<th></th>' +
      '<th><input class="ftext" id="tblTitleFilter" placeholder="strateji ara…"></th>' +
      '<th></th>' +
      '<th><input class="ftext" id="tblFilterFilter" placeholder="filtre ara…"></th>' +
      '<th>' + pair('n') + '</th>' +
      '<th>' + pair('avgAll') + '</th>' +
      '<th>' + pair('avg26') + '</th>' +
      '<th>' + pair('winDur') + '</th>' +
      '<th>' + pair('ratio') + '</th>' +
      '<th>' + pair('score') + '</th>' +
      '</tr>';

    head.innerHTML = h1 + h2;

    head.querySelectorAll('th[data-k]').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        if (k === 'rank') return;
        if (TS.sortKey === k) TS.sortDir = -TS.sortDir;
        else {
          TS.sortKey = k;
          TS.sortDir = (k === 'title' || k === 'tf' || k === 'filter') ? 1 : -1;
        }
        renderTable();
      });
    });

    head.querySelectorAll('.fnum').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var k = inp.getAttribute('data-k');
        var b = inp.getAttribute('data-b');
        var v = tblParseNum(inp.value);
        if (!TS.ranges[k]) TS.ranges[k] = [null, null];
        TS.ranges[k][b === 'min' ? 0 : 1] = v;
        renderTable();
      });
    });

    var tfEl = el('tblTitleFilter');
    var ffEl = el('tblFilterFilter');
    if (tfEl) tfEl.addEventListener('input', function () { applyTblSearch(); });
    if (ffEl) ffEl.addEventListener('input', function () { applyTblSearch(); });

    function applyTblSearch() {
      var a = (el('tblTitleFilter') || {}).value || '';
      var b = (el('tblFilterFilter') || {}).value || '';
      TS.q = (a + ' ' + b).trim();
      renderTable();
    }

    var hh = head.querySelector('tr').getBoundingClientRect().height;
    head.querySelectorAll('tr.filters th').forEach(function (th) {
      th.style.top = Math.max(30, Math.round(hh - 1)) + 'px';
    });
  }

  function layoutTableHeader() {
    var head = el('tblHead');
    if (!head) return;
    var hh = head.querySelector('tr').getBoundingClientRect().height;
    if (hh > 0) {
      head.querySelectorAll('tr.filters th').forEach(function (th) {
        th.style.top = Math.max(30, Math.round(hh - 1)) + 'px';
      });
    }
  }

  function initTableControls() {
    var s = el('tblSearch');
    if (s) s.addEventListener('input', function () { TS.q = s.value.trim(); renderTable(); });
    var tf = el('tblTf');
    if (tf) tf.addEventListener('change', function () { TS.tf = tf.value; renderTable(); });
    var kind = el('tblKind');
    if (kind) kind.addEventListener('change', function () { TS.kind = kind.value; renderTable(); });

    var reset = el('tblReset');
    if (reset) reset.addEventListener('click', function () {
      TS.q = ''; TS.tf = 'all'; TS.kind = 'all'; TS.ranges = {};
      TS.sortKey = 'score'; TS.sortDir = -1;
      if (s) s.value = '';
      if (tf) tf.value = 'all';
      if (kind) kind.value = 'all';
      document.querySelectorAll('#tblHead .fnum, #tblHead .ftext').forEach(function (i) { i.value = ''; });
      renderTable();
    });

    var csv = el('tblCsv');
    if (csv) csv.addEventListener('click', downloadTableCsv);
  }

  function renderTable() {
    if (!TABLE_ROWS) buildTableRows();
    var body = el('tblBody');
    var meta = el('tblMeta');
    if (!body) return;

    var rows = TABLE_ROWS.filter(tblMatches);
    rows.sort(tblCmp);

    var head = el('tblHead');
    if (head) {
      head.querySelectorAll('th[data-k]').forEach(function (th) {
        var k = th.getAttribute('data-k');
        th.classList.toggle('sorted', k === TS.sortKey);
        var ar = th.querySelector('.arrow');
        if (ar) ar.textContent = (k === TS.sortKey) ? (TS.sortDir > 0 ? '▲' : '▼') : '↕';
      });
    }

    var html = rows.map(function (r, i) {
      var durCell = (r.winDur == null)
        ? '<td class="num">—</td>'
        : '<td class="num">' + nf(r.winDur, 1) + ' sa' +
          '<span class="cell-sub">' + (r.winDur / 24 >= 2 ? nf(r.winDur / 24, 1) + ' gün' : '') + '</span></td>';
      var ratioTxt = isFinite(r.ratio) ? nf(r.ratio, 2) : '∞';
      return '<tr>' +
        '<td class="idx">' + (i + 1) + '</td>' +
        '<td class="txt strat-cell"><b>' + esc(r.title) + '</b><span class="cell-sub">' + esc(r.id.toUpperCase()) + '</span></td>' +
        '<td class="txt"><span class="tf-badge">' + esc(r.tf) + '</span></td>' +
        '<td class="txt">' + (r.isBase
          ? '<span class="filter-pill base">Filtresiz</span>'
          : '<span class="filter-pill">' + esc(r.filterLabel) + '</span>') + '</td>' +
        '<td class="num">' + nf(r.n) + '</td>' +
        tblAvgCell(r.avgAll) +
        tblAvgCell(r.avg26) +
        durCell +
        '<td class="num">' + nf(r.w) + ' / ' + nf(r.l) + ' - ' + ratioTxt + '</td>' +
        '<td class="num"><span class="score-pill ' + tblScoreClass(r.score) + '" title="2. kategori: ' +
          r.s2.toFixed(1) + ' · 4. kategori: ' + r.s4.toFixed(1) + ' · 5. kategori: ' + r.s5.toFixed(1) +
          '">' + nf(r.score, 1) + '</span></td>' +
        '</tr>';
    }).join('');

    body.innerHTML = html || '<tr><td colspan="10" style="text-align:center;padding:28px;color:var(--muted)">Bu filtrelerle satır bulunamadı.</td></tr>';

    if (meta) {
      var sortLbl = { score: 'Puan', n: 'İşlem', avgAll: 'Tüm Yıllar Net/İşlem', avg26: '2026 Net/İşlem', winDur: 'Kârlı Süre', ratio: 'Kârlı/Zararlı', title: 'Strateji', tf: 'TF', filter: 'Filtre' }[TS.sortKey] || TS.sortKey;
      meta.innerHTML = '<span><b>' + nf(rows.length) + ' / ' + nf(TABLE_ROWS.length) + '</b> satır</span>' +
        '<span>Sıralama: <b>' + esc(sortLbl) + ' ' + (TS.sortDir > 0 ? '↑' : '↓') + '</b></span>' +
        '<span>Min–max ölçeği ' + nf(TABLE_ROWS.length) + ' satırın tamamından hesaplandı</span>';
    }
  }

  function downloadTableCsv() {
    if (!TABLE_ROWS) buildTableRows();
    var rows = TABLE_ROWS.filter(tblMatches);
    rows.sort(tblCmp);
    var head = ['Strateji', 'ID', 'TF', 'Filtre', 'Islem', 'Net/Islem Tum Yillar (%)', 'Net/Islem 2026 (%)', 'Karli Ort Sure (saat)', 'Karli', 'Zararli', 'Karli/Zararli', 'Puan'];
    function cs(v, d) { return Number(v).toFixed(d == null ? 2 : d).replace('.', ','); }
    var lines = [head.join(';')];
    rows.forEach(function (r) {
      lines.push([
        '"' + String(r.title).replace(/"/g, '""') + '"',
        r.id,
        r.tf,
        '"' + String(r.filterLabel).replace(/"/g, '""') + '"',
        r.n,
        cs(r.avgAll * 100),
        cs(r.avg26 * 100),
        r.winDur == null ? '' : cs(r.winDur, 1),
        r.w,
        r.l,
        isFinite(r.ratio) ? cs(r.ratio) : 'inf',
        cs(r.score, 1),
      ].join(';'));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pro_strateji_filtre_tf.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function initTabs() {
    var btns = document.querySelectorAll('.tab-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');
        btns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('on', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        var pa = el('panelAnalyze'), pt = el('panelTable');
        if (pa) pa.hidden = tab !== 'analyze';
        if (pt) pt.hidden = tab !== 'table';
        if (tab === 'table') {
          renderTable();
          layoutTableHeader();
        } else {
          requestAnimationFrame(function () {
            window.dispatchEvent(new Event('resize'));
            document.querySelectorAll('.plot-box').forEach(function (d) {
              if (window.Plotly && d.data) Plotly.Plots.resize(d);
            });
          });
        }
      });
    });
  }

  function initTable() {
    if (!el('tblHead')) return;
    buildTableRows();
    initTableHeader();
    initTableControls();
    renderTable();
    initTabs();
  }

  function initEvents() {
    el('prevStrat').addEventListener('click', function () {
      var strats = getFilteredStrategies();
      if (!strats.length) return;
      var idx = strats.findIndex(function (x) { return x.id === S.stratId; });
      S.stratId = strats[(idx - 1 + strats.length) % strats.length].id;
      S.stratTf = null; S.stateKey = null;
      renderAll();
    });

    el('nextStrat').addEventListener('click', function () {
      var strats = getFilteredStrategies();
      if (!strats.length) return;
      var idx = strats.findIndex(function (x) { return x.id === S.stratId; });
      S.stratId = strats[(idx + 1) % strats.length].id;
      S.stratTf = null; S.stateKey = null;
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
  }

  initEvents();
  renderAll();
  initTable();
})();
