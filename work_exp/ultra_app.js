(function () {
  'use strict';

  var D = JSON.parse(document.getElementById('UD').textContent);
  var S = D.states || [];
  var BY = new Map(S.map(function (r) { return [r.key, r]; }));
  var TOP = (D.top5 || []).map(function (k) { return BY.get(k); }).filter(Boolean);
  var DATES = [];
  for (var gi = 0; gi < D.grid.len; gi++) DATES.push(D.grid.start + gi * D.grid.step);
  var YEAR_TICKS = [];
  for (var yy = 2022; yy <= 2026; yy++) {
    for (var yi = 0; yi < DATES.length; yi++) {
      if (new Date(DATES[yi]).getUTCFullYear() === yy) { YEAR_TICKS.push({ y: yy, i: yi }); break; }
    }
  }
  var COLORS = ['#4cc9f0', '#3ddc97', '#ffb703', '#b388ff', '#ff5d73'];
  var SHORT = { mfi: 'MFI', hma: 'HMA', uo: 'UO', smi: 'SMI', nvi: 'NVI', pvt: 'PVT', twiggs: 'TWIGGS', adx: 'ADX', ad: 'AD' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function fmtPct(v, d, plus) {
    if (v == null || !isFinite(v)) return '—';
    var s = (v * 100).toFixed(d == null ? 1 : d) + '%';
    return plus && v > 0 ? '+' + s : s;
  }
  function fmtDD(v) { return v == null || !isFinite(v) ? '—' : fmtPct(v, 1); }
  function fmtMult(net) {
    if (net == null || !isFinite(net)) return '—';
    var m = 1 + net;
    if (m <= 0) return '0×';
    if (m >= 1e9) return (m / 1e9).toFixed(1) + 'B×';
    if (m >= 1e6) return (m / 1e6).toFixed(1) + 'M×';
    if (m >= 1e3) return (m / 1e3).toFixed(1) + 'k×';
    if (m >= 100) return m.toFixed(0) + '×';
    if (m >= 10) return m.toFixed(1) + '×';
    return m.toFixed(2) + '×';
  }
  function fmtNet(net) {
    if (net == null || !isFinite(net)) return '—';
    if (net >= 0) return fmtMult(net);
    return fmtPct(net, 1);
  }
  function fmtNum(v, d) { return v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('tr-TR', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d }); }
  function dirLabel(r) { return r.dir === 'long' ? 'Long only' : 'Long + Short'; }
  function shortName(r) { return SHORT[r.id] || String(r.id || '').toUpperCase(); }
  function filterText(r) { return r.filters && r.filters.length ? r.filters.map(function (f) { return f.title; }).join(' + ') : 'filtre yok'; }
  function top5Share(r) { return r.hom && r.hom.top5 != null ? r.hom.top5 : null; }
  function ddClass(v) { return v <= -0.85 ? 'r' : v <= -0.70 ? 'a' : ''; }
  function netClass(v) { return v >= 0 ? 'g' : 'r'; }
  function scoreClass(v) { return v >= 80 ? 'g' : v >= 70 ? 'c' : v >= 60 ? 'a' : 'r'; }

  function warningsFor(r) {
    var out = [];
    if (r.liquidLiq15 > 0) {
      var labs = r.sets.filter(function (s) { return s.liq15; }).map(function (s) { return 'top' + s.label; }).join(', ');
      out.push({ cls: 'red', text: 'Likit alt evrende 15x tasfiye: ' + labs + '. 10x pozitif; 15x dayanmıyor.' });
    }
    if (r.dd15 <= -0.85) out.push({ cls: '', text: '15x maks DD ' + fmtDD(r.dd15) + '; -90% kapısına çok yakın.' });
    if (top5Share(r) > 1.5) out.push({ cls: '', text: 'Top5 gün payı ' + fmtPct(top5Share(r), 0) + '; getiri az sayıda güne bağlı.' });
    if (r.stopScore < 0.6) out.push({ cls: '', text: 'Sert stop yok; çıkış ters sinyalde. Boşluk riski açık.' });
    if (r.n < 500) out.push({ cls: '', text: 'Örneklem ' + fmtNum(r.n) + ' işlem; istatistiksel güven sınırlı.' });
    return out;
  }

  /* ------------------------------- hero / scenario ------------------------------- */
  function renderHero() {
    document.getElementById('sTotal').textContent = fmtNum(S.length);
    document.getElementById('sSurv').textContent = fmtNum(D.funnel.survivors);
    document.getElementById('sDistinct').textContent = fmtNum(D.funnel.distinct);
    document.getElementById('sBest').textContent = TOP.length ? TOP[0].scores.total.toFixed(1) : '—';
    document.getElementById('sLiq').textContent = fmtNum(D.funnel.liq10);
    document.getElementById('sUniverse').textContent = fmtNum(D.universe);
  }

  function renderScenario() {
    var axes = D.scenario.axes || [];
    document.getElementById('axesList').innerHTML = axes.map(function (a, i) {
      return '<li><span class="n">' + (i + 1) + '</span><span>' + esc(a) + '</span></li>';
    }).join('');
    var w = D.scenario.weights || {};
    var wl = [['Kaldıraç', w.lev], ['Homojenlik', w.hom], ['Hacim', w.vol], ['Rejim', w.regime], ['Uygulanabilirlik', w.impl], ['Güvenilirlik', w.rel]];
    document.getElementById('weightList').innerHTML = wl.map(function (x) {
      return '<span class="wchip">' + x[0] + ' <b>' + x[1] + '</b></span>';
    }).join('');

    var total = D.funnel.total || S.length;
    var gates = [
      ['10x tasfiye yok', D.gatePass.liq10],
      ['15x tasfiye yok', D.gatePass.liq15],
      ['15x maks DD > -90%', D.gatePass.dd15],
      ['örneklem ≥ 200 işlem / 50 test', D.gatePass.sample],
      ['10x ≥ 4/6 hacim evreni pozitif', D.gatePass.vol],
      ['15x en kötü gün tamponu > %20', D.gatePass.buffer],
      ['15x log büyümesi > 0', D.gatePass.positive],
    ];
    var html = gates.map(function (g) {
      var p = Math.round(g[1] / total * 100);
      return '<div class="gate"><div class="gl">' + esc(g[0]) + '</div><div class="gv">' + g[1] + '/' + total + '</div>' +
        '<div class="gtrack"><div class="gfill' + (p < 50 ? ' red' : '') + '" style="width:' + p + '%"></div></div></div>';
    }).join('');
    var ps = Math.round(D.funnel.survivors / total * 100);
    html += '<div class="gate all"><div class="gl">HEPSİNİ GEÇEN</div><div class="gv">' + D.funnel.survivors + '/' + total + '</div>' +
      '<div class="gtrack"><div class="gfill" style="width:' + ps + '%"></div></div></div>';
    document.getElementById('gateList').innerHTML = html;
  }

  /* --------------------------------- top cards ---------------------------------- */
  function volMini(r) {
    var vals = r.sets.map(function (s) { return Math.log1p(Math.max(0, s.net10)); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var span = hi - lo;
    var cols = r.sets.map(function (s, i) {
      var h = span > 0.0001 ? 18 + (vals[i] - lo) / span * 82 : 50;
      var cls = s.liq10 || s.net10 < 0 ? ' red' : h < 35 ? ' amber' : '';
      return '<div class="volcol" title="top' + s.label + ': 10x ' + fmtNet(s.net10) + ' · DD ' + fmtDD(s.dd10) + (s.liq10 ? ' · TASFİYE' : '') + '">' +
        '<div class="volbar-wrap"><div class="volbar' + cls + '" style="height:' + h.toFixed(0) + '%"></div></div>' +
        '<div class="lb">' + s.label + '</div></div>';
    }).join('');
    return '<div class="tiny dim" style="margin-bottom:-3px">10x net · hacim evreni (top N)</div><div class="volmini">' + cols + '</div>';
  }

  function cardHTML(r) {
    var ws = warningsFor(r).slice(0, 3).map(function (w) {
      return '<span class="warn ' + w.cls + '">⚠ ' + esc(w.text) + '</span>';
    }).join('');
    var why = [
      '15x tasfiye yok; maks DD ' + fmtDD(r.dd15) + ' (kapı -90%).',
      '15x log büyüme ' + fmtPct(r.g15, 0) + '/yıl; leverage verimliliği ' + (r.eff15 != null ? r.eff15.toFixed(2) : '—') + '.',
      '10x: ' + r.volPos + '/6 hacim evreni pozitif; ' + r.liquidPos + '/3 likit evren pozitif.',
      'Homojenlik: top5 gün ' + fmtPct(r.hom.top5, 0) + ', pozitif ay ' + fmtPct(r.hom.pozAy, 0) + ', R² ' + r.hom.r2.toFixed(2) + '.',
      'Örneklem: ' + fmtNum(r.n) + ' işlem, ' + fmtNum(r.teN) + ' test işlemi.',
    ].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');

    var filters = r.filters.length ? r.filters.map(function (f) {
      return '<li><b>' + esc(f.title) + '</b><span>' + esc(f.desc) + '</span></li>';
    }).join('') : '<li><b>Filtre yok</b><span>Temel strateji tüm coinlerde çalışır.</span></li>';

    var alt = S.filter(function (x) {
      return x.altOf === r.key && (x.survives || (x.dd15 > -0.90 && x.scores.total >= 65));
    }).sort(function (a, b) { return b.scores.total - a.scores.total; })[0];
    var altLine = alt ? '<div class="tiny dim" style="margin-top:-4px">Aile alternatifi: <b>' + esc(alt.ad || 'temel') + '</b> · skor ' + alt.scores.total.toFixed(1) + ' · 15x DD ' + fmtDD(alt.dd15) + ' · tam sıralamada “aile alt.” etiketiyle.</div>' : '';

    return '<article class="top-card' + (r.strategyRank === 1 ? ' rank1' : '') + '" data-key="' + esc(r.key) + '">' +
      '<div class="card-top">' +
        '<div class="rankbadge">' + (r.strategyRank || '') + '</div>' +
        '<div class="card-title"><h3>' + esc(r.title) + '</h3>' +
          '<div class="sub">' + esc(r.tf) + ' · ' + dirLabel(r) + ' · ' + esc(r.filters.length + ' filtre') + ' · strateji sırası #' + r.strategyRank + '</div></div>' +
        '<div class="scorebig">' + r.scores.total.toFixed(1) + '<small>ULTRA / 100</small></div>' +
      '</div>' +
      '<p class="hook">' + esc(r.hook) + '</p>' +
      '<div class="dyn">' +
        '<div class="dyn-col"><h4>Giriş / çıkış dinamiği</h4><ul>' + r.rules.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
          '<div class="stop">Stop: <b>' + esc(r.stop) + '</b></div></div>' +
        '<div class="dyn-col"><h4>Filtre kapıları</h4><ul>' + filters + '</ul></div>' +
      '</div>' +
      '<div class="metrics">' +
        '<div class="metric" title="Tüm coin evreni, günlük bileşik, 10x kaldıraç"><div class="l">10x getiri</div><div class="v g">' + fmtNet(r.net10) + '</div></div>' +
        '<div class="metric" title="10x kaldıraçta zirveden maksimum düşüş"><div class="l">10x maks DD</div><div class="v ' + ddClass(r.dd10) + '">' + fmtDD(r.dd10) + '</div></div>' +
        '<div class="metric" title="Tüm coin evreni, günlük bileşik, 15x kaldıraç"><div class="l">15x getiri</div><div class="v g">' + fmtNet(r.net15) + '</div></div>' +
        '<div class="metric" title="15x kaldıraçta zirveden maksimum düşüş"><div class="l">15x maks DD</div><div class="v ' + ddClass(r.dd15) + '">' + fmtDD(r.dd15) + '</div></div>' +
        '<div class="metric" title="15x log büyümesinin, 1x log büyümesinin 15 katına oranı. 1.00 = kayıpsız kaldıraç."><div class="l">15x verimlilik</div><div class="v c">' + (r.eff15 != null ? r.eff15.toFixed(2) : '—') + '</div></div>' +
        '<div class="metric" title="Günlük log getirilerden yıllıklandırılmış Sharpe"><div class="l">15x Sharpe</div><div class="v c">' + (r.sh15 != null ? r.sh15.toFixed(2) : '—') + '</div></div>' +
        '<div class="metric" title="En iyi 5 günün net katkısı / toplam net. %100 üzeri = diğer günler net negatif."><div class="l">Top5 gün payı</div><div class="v a">' + fmtPct(r.hom.top5, 0) + '</div></div>' +
        '<div class="metric" title="Net pozitif ayların oranı"><div class="l">Pozitif ay</div><div class="v g">' + fmtPct(r.hom.pozAy, 0) + '</div></div>' +
        '<div class="metric" title="Günlük kümülatif eğrinin doğrusal R² değeri"><div class="l">R²</div><div class="v">' + r.hom.r2.toFixed(2) + '</div></div>' +
        '<div class="metric" title="10x kaldıraçta net pozitif kalan hacim evreni sayısı (6 set)"><div class="l">Hacim 10x</div><div class="v ' + (r.volPos >= 4 ? 'g' : 'a') + '">' + r.volPos + '/6</div></div>' +
        '<div class="metric" title="İlk 3 likit evren (top50/100/150) 10x pozitif"><div class="l">Likit 10x</div><div class="v ' + (r.liquidPos >= 2 ? 'g' : 'a') + '">' + r.liquidPos + '/3</div></div>' +
        '<div class="metric" title="15x en kötü gün sonrası kalan özkaynak oranı (min 1+15r)"><div class="l">15x tampon</div><div class="v c">' + fmtPct(r.minG15, 0) + '</div></div>' +
      '</div>' +
      '<ul class="why">' + why + '</ul>' +
      altLine +
      volMini(r) +
      '<div class="card-foot"><button class="btn primary" data-detail="' + esc(r.key) + '">Tüm dinamiği aç</button>' +
        '<div class="card-warn">' + ws + '</div></div>' +
    '</article>';
  }

  function renderTopCards() {
    var el = document.getElementById('topCards');
    el.innerHTML = TOP.map(cardHTML).join('');
    el.querySelectorAll('[data-detail]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); openDetail(b.getAttribute('data-detail')); });
    });
    el.querySelectorAll('.top-card').forEach(function (c) {
      c.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        openDetail(c.getAttribute('data-key'));
      });
    });
  }

  /* ---------------------------------- table ------------------------------------ */
  var sortCol = 'rank', sortDir = 1, bucket = 'all', query = '';
  var ASC_FIRST = { rank: 1, title: 1, tf: 1, top5: 1 };

  function rowVal(r, col) {
    switch (col) {
      case 'rank': return r.rank;
      case 'title': return (r.title + ' ' + r.ad).toLowerCase();
      case 'tf': return r.tf;
      case 'net10': return r.net10;
      case 'dd10': return r.dd10;
      case 'net15': return r.net15;
      case 'dd15': return r.dd15;
      case 'eff15': return r.eff15 == null ? -9 : r.eff15;
      case 'sh15': return r.sh15 == null ? -9 : r.sh15;
      case 'top5': return r.hom.top5;
      case 'pozAy': return r.hom.pozAy;
      case 'r2': return r.hom.r2;
      case 'volPos': return r.volPos;
      case 'impl': return r.scores.impl;
      case 'rel': return r.scores.rel;
      case 'implRel': return r.scores.impl + r.scores.rel;
      case 'total': return r.scores.total;
      case 'status': return r.survives ? 1 : 0;
      default: return r.rank;
    }
  }

  function defaultDir(col) { return ASC_FIRST[col] ? 1 : -1; }

  function tableRows() {
    var q = query.trim().toLowerCase();
    return S.filter(function (r) {
      if (bucket === 'surv' && !r.survives) return false;
      if (bucket === 'elim' && r.survives) return false;
      if (bucket === 'top5' && !r.top5) return false;
      if (bucket === 'rest' && r.top5) return false;
      if (!q) return true;
      var hay = [r.title, r.id, r.tf, r.ad, r.hook, filterText(r), r.fail.join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    }).sort(function (a, b) {
      var va = rowVal(a, sortCol), vb = rowVal(b, sortCol);
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return a.rank - b.rank;
    });
  }

  function rowHTML(r) {
    var topBadge = r.top5 ? '<span class="badge gold">#' + r.top5 + '</span>' : '';
    var altBadge = r.sameStratAlt ? '<span class="badge gray">aile alt.</span>' : '';
    var status = r.survives ? '<span class="badge ok">Hayatta</span>' : '<span class="badge bad">Elendi</span>';
    var fail = r.fail.length ? '<div class="fail">' + esc(r.fail.join(' · ')) + '</div>' : '';
    var volWarn = r.liquidLiq15 ? ' <span class="a" title="Likit alt evrende 15x tasfiye">⚠</span>' : '';
    return '<tr class="' + (r.top5 ? 'top5row ' : '') + (r.survives ? '' : 'elim') + '" data-key="' + esc(r.key) + '" title="Detay için tıkla">' +
      '<td class="num">' + r.rank + '</td>' +
      '<td><div class="ttl">' + esc(r.title) + ' ' + topBadge + ' ' + altBadge + '</div><div class="sub">' + esc(r.ad || 'temel') + '</div></td>' +
      '<td><span class="badge gray">' + esc(r.tf) + '</span></td>' +
      '<td class="num ' + netClass(r.net10) + '">' + fmtNet(r.net10) + '</td>' +
      '<td class="num ' + ddClass(r.dd10) + '">' + fmtDD(r.dd10) + '</td>' +
      '<td class="num ' + netClass(r.net15) + '">' + fmtNet(r.net15) + '</td>' +
      '<td class="num ' + ddClass(r.dd15) + '">' + fmtDD(r.dd15) + '</td>' +
      '<td class="num c">' + (r.eff15 != null ? r.eff15.toFixed(2) : '—') + '</td>' +
      '<td class="num a">' + fmtPct(r.hom.top5, 0) + '</td>' +
      '<td class="num">' + fmtPct(r.hom.pozAy, 0) + '</td>' +
      '<td class="num">' + r.hom.r2.toFixed(2) + '</td>' +
      '<td class="num">' + r.volPos + '/6' + volWarn + '</td>' +
      '<td class="num c">' + r.scores.impl.toFixed(1) + '</td>' +
      '<td class="num c">' + r.scores.rel.toFixed(1) + '</td>' +
      '<td class="num g"><b>' + (r.scores.impl + r.scores.rel).toFixed(1) + '</b></td>' +
      '<td class="num ' + scoreClass(r.scores.total) + '"><b>' + r.scores.total.toFixed(1) + '</b></td>' +
      '<td>' + status + fail + '</td>' +
    '</tr>';
  }

  function renderTable() {
    var rows = tableRows();
    document.getElementById('rankBody').innerHTML = rows.map(rowHTML).join('');
    document.getElementById('tableCount').innerHTML = '<b>' + rows.length + '</b> / ' + S.length + ' konfigürasyon';
    var ths = document.querySelectorAll('#rankTable th');
    ths.forEach(function (th) {
      var old = th.querySelector('.ar'); if (old) old.remove();
      if (th.getAttribute('data-col') === sortCol) {
        var sp = document.createElement('span'); sp.className = 'ar'; sp.textContent = sortDir > 0 ? '▲' : '▼';
        th.appendChild(sp);
      }
    });
  }

  function initTable() {
    document.querySelectorAll('#rankTable th').forEach(function (th) {
      th.addEventListener('click', function () {
        var col = th.getAttribute('data-col'); if (!col) return;
        if (sortCol === col) sortDir *= -1; else { sortCol = col; sortDir = defaultDir(col); }
        renderTable();
      });
    });
    document.getElementById('rankBody').addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-key]'); if (tr) openDetail(tr.getAttribute('data-key'));
    });
    document.querySelectorAll('#bucketSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        bucket = b.getAttribute('data-bucket');
        document.querySelectorAll('#bucketSeg button').forEach(function (x) { x.classList.toggle('on', x === b); });
        renderTable();
      });
    });
    var search = document.getElementById('search');
    search.addEventListener('input', function () { query = search.value; renderTable(); });
    document.getElementById('rankIG').addEventListener('click', function () {
      bucket = 'rest'; query = ''; search.value = '';
      document.querySelectorAll('#bucketSeg button').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-bucket') === 'rest'); });
      sortCol = 'implRel'; sortDir = -1; renderTable();
      document.getElementById('rankTable').scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  /* -------------------------------- modal -------------------------------------- */
  var modalDD = { r: null, lev: 10 };

  function scoreBars(r) {
    var parts = [
      ['Kaldıraç dayanıklılığı', r.scores.lev, 35],
      ['Homojenlik', r.scores.hom, 25],
      ['Hacim evreni', r.scores.vol, 20],
      ['Zaman / rejim', r.scores.regime, 10],
      ['Uygulanabilirlik', r.scores.impl, 5],
      ['Güvenilirlik', r.scores.rel, 5],
    ];
    return '<div class="scorebars">' + parts.map(function (p) {
      var w = clamp(p[1] / p[2] * 100, 0, 100);
      return '<div class="sb"><div>' + p[0] + '</div><div class="tr"><div class="fl" style="width:' + w + '%"></div></div><div class="vv">' + p[1].toFixed(1) + '/' + p[2] + '</div></div>';
    }).join('') + '</div>';
  }

  function detailHTML(r) {
    var ws = warningsFor(r);
    var warnHtml = ws.map(function (w) { return '<div class="warnbox ' + w.cls + '">⚠ ' + esc(w.text) + '</div>'; }).join('');
    if (r.fail.length) warnHtml = '<div class="warnbox red"><b>Elendi:</b> ' + esc(r.fail.join(' · ')) + '</div>' + warnHtml;
    warnHtml += '<div class="note">Model notu: 10x/15x değerleri günlük kapanış getirileriyle bileşiklenir; intraday likidasyon, pozisyon limiti, likidite kayması ve stop boşluğu modellenmez. Ücretler ve funding dahildir.</div>';

    var levRows = [1, 5, 10, 15, 20].map(function (L) {
      var net = r['net' + L], dd = r['dd' + L];
      var liq = L === 1 ? false : !!r['liq' + L];
      var g = r['g' + L];
      var eff = L === 10 ? r.eff10 : L === 15 ? r.eff15 : null;
      var hl = L === 10 || L === 15 ? ' class="hl"' : '';
      return '<tr' + hl + '><td>' + L + 'x</td><td class="num ' + netClass(net) + '">' + fmtNet(net) + '</td><td class="num ' + ddClass(dd) + '">' + fmtDD(dd) + '</td>' +
        '<td>' + (liq ? '<span class="badge bad">Tasfiye</span>' : '<span class="badge ok">Yok</span>') + '</td>' +
        '<td class="num">' + (g == null ? '—' : fmtPct(g, 0)) + '</td><td class="num c">' + (eff == null ? '—' : eff.toFixed(2)) + '</td></tr>';
    }).join('');

    var yearRows = [2023, 2024, 2025, 2026].map(function (y) {
      var hy = r.hom['y' + String(y).slice(2)];
      var y10 = r.y10 && r.y10[y];
      return '<tr><td>' + y + (y === 2026 ? ' <span class="dim">YTD</span>' : '') + '</td><td class="num ' + netClass(hy) + '">' + (hy == null ? '—' : fmtPct(hy, 1)) + '</td><td class="num ' + netClass(y10) + '">' + fmtNet(y10) + '</td></tr>';
    }).join('');

    var regRows = [
      ['BTC boğa', r.bull], ['BTC ayı', r.bear], ['Yüksek vol', r.hi], ['Düşük vol', r.lo],
    ].map(function (x) {
      return '<tr><td>' + x[0] + '</td><td class="num ' + netClass(x[1]) + '">' + (x[1] == null ? '—' : fmtPct(x[1], 0)) + '</td></tr>';
    }).join('');

    var setRows = r.sets.map(function (s) {
      var hl = s.liq15 ? ' class="hl"' : '';
      return '<tr' + hl + '><td>top' + s.label + '</td><td class="num ' + netClass(s.net10) + '">' + fmtNet(s.net10) + '</td><td class="num ' + ddClass(s.dd10) + '">' + fmtDD(s.dd10) + '</td>' +
        '<td class="num ' + netClass(s.net15) + '">' + fmtNet(s.net15) + '</td><td class="num ' + ddClass(s.dd15) + '">' + fmtDD(s.dd15) + '</td>' +
        '<td>' + (s.liq10 ? '<span class="badge bad">10x</span>' : s.liq15 ? '<span class="badge bad">15x</span>' : '<span class="badge ok">Yok</span>') + '</td></tr>';
    }).join('');

    var filters = r.filters.length ? '<ul class="mlist">' + r.filters.map(function (f) {
      return '<li><b>' + esc(f.title) + '</b> — ' + esc(f.desc) + ' <span class="dim">(' + esc(f.catTitle) + ')</span></li>';
    }).join('') + '</ul>' : '<p class="muted">Filtre yok; temel strateji tüm evrende çalışıyor.</p>';

    var badges = '<span class="badge ' + (r.survives ? 'ok' : 'bad') + '">' + (r.survives ? 'Hayatta' : 'Elendi') + '</span>' +
      (r.strategyRank ? '<span class="badge gold">Strateji #' + r.strategyRank + '</span>' : '') +
      '<span class="badge gray">' + esc(r.tf) + '</span>' +
      '<span class="badge gray">' + dirLabel(r) + '</span>' +
      '<span class="badge gray">ULTRA ' + r.scores.total.toFixed(1) + '/100</span>' +
      (r.top5 ? '<span class="badge gold">İlk 5</span>' : '') +
      (r.sameStratAlt ? '<span class="badge gray">aynı ailenin alternatifi</span>' : '');

    return '<h2>' + esc(r.title) + '</h2>' +
      '<div class="mhead">' + badges + '</div>' +
      '<p>' + esc(r.hook) + '</p>' +
      '<div class="mgrid">' +
        '<div class="mbox"><div class="l">10x getiri</div><div class="v g">' + fmtNet(r.net10) + '</div><div class="tiny dim">' + fmtPct(r.net10, 0, true) + '</div></div>' +
        '<div class="mbox"><div class="l">10x maks DD</div><div class="v ' + ddClass(r.dd10) + '">' + fmtDD(r.dd10) + '</div></div>' +
        '<div class="mbox"><div class="l">15x getiri</div><div class="v g">' + fmtNet(r.net15) + '</div><div class="tiny dim">' + fmtPct(r.net15, 0, true) + '</div></div>' +
        '<div class="mbox"><div class="l">15x maks DD</div><div class="v ' + ddClass(r.dd15) + '">' + fmtDD(r.dd15) + '</div></div>' +
        '<div class="mbox"><div class="l">15x verimlilik</div><div class="v c">' + (r.eff15 != null ? r.eff15.toFixed(2) : '—') + '</div></div>' +
        '<div class="mbox"><div class="l">15x Sharpe</div><div class="v c">' + (r.sh15 != null ? r.sh15.toFixed(2) : '—') + '</div></div>' +
        '<div class="mbox"><div class="l">İşlem</div><div class="v">' + fmtNum(r.n) + '</div></div>' +
        '<div class="mbox"><div class="l">Test işlemi</div><div class="v">' + fmtNum(r.teN) + '</div></div>' +
      '</div>' +
      warnHtml +
      '<h3>Karar dinamiği</h3>' +
      '<div class="twocol"><div><p class="muted"><b>Giriş / çıkış kuralları</b></p><ul class="mlist">' +
        r.rules.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
        '</ul><p class="note">Yön: <b>' + dirLabel(r) + '</b> · Stop: <b>' + esc(r.stop) + '</b></p></div>' +
        '<div><p class="muted"><b>Filtre kapıları</b></p>' + filters + '</div></div>' +
      '<h3>Skor kırılımı</h3>' + scoreBars(r) +
      '<h3>Kaldıraç merdiveni</h3>' +
      '<table class="mtable"><thead><tr><th>Kaldıraç</th><th>Net</th><th>Maks DD</th><th>Tasfiye</th><th>Log büyüme/yıl</th><th>Verimlilik</th></tr></thead><tbody>' + levRows + '</tbody></table>' +
      '<p class="note">Verimlilik = o kaldıraçtaki günlük log büyümenin, 1x log büyümesinin kaldıraç katına oranı. 1.00 = kaldıraç kayıpsız; <1 = volatilite sürtünmesi.</p>' +
      '<div class="twocol" style="margin-top:14px">' +
        '<div><h3>Yıl getirisi</h3><table class="mtable"><thead><tr><th>Yıl</th><th>1x (rapor)</th><th>10x bileşik</th></tr></thead><tbody>' + yearRows + '</tbody></table></div>' +
        '<div><h3>BTC rejimi</h3><table class="mtable"><thead><tr><th>Rejim</th><th>10x yıllık ort. katkı</th></tr></thead><tbody>' + regRows + '</tbody></table>' +
        '<p class="note">Rejim katkısı = o rejim günlerindeki ortalama günlük getiri × 365; bileşik eğri değil, karşılaştırma göstergesi.</p></div>' +
      '</div>' +
      '<h3>Hacim evrenleri</h3>' +
      '<table class="mtable"><thead><tr><th>Evren</th><th>10x net</th><th>10x DD</th><th>15x net</th><th>15x DD</th><th>Tasfiye</th></tr></thead><tbody>' + setRows + '</tbody></table>' +
      '<p class="note">Her satır aynı stratejinin yalnız o likidite evrenindeki coinlerle yeniden simülasyonudur; kozmetik filtre değildir.</p>' +
      '<h3>Homojenlik</h3>' +
      '<div class="mgrid">' +
        '<div class="mbox"><div class="l">Top5 gün payı</div><div class="v a">' + fmtPct(r.hom.top5, 1) + '</div></div>' +
        '<div class="mbox"><div class="l">Top1 ay payı</div><div class="v a">' + fmtPct(r.hom.top1, 1) + '</div></div>' +
        '<div class="mbox"><div class="l">Pozitif ay</div><div class="v g">' + fmtPct(r.hom.pozAy, 0) + '</div></div>' +
        '<div class="mbox"><div class="l">R²</div><div class="v">' + r.hom.r2.toFixed(3) + '</div></div>' +
        '<div class="mbox"><div class="l">2023 / 2024</div><div class="v" style="font-size:12px">' + fmtPct(r.hom.y23, 1) + ' / ' + fmtPct(r.hom.y24, 1) + '</div></div>' +
        '<div class="mbox"><div class="l">2025</div><div class="v" style="font-size:12px">' + fmtPct(r.hom.y25, 1) + '</div></div>' +
        '<div class="mbox"><div class="l">Alt-10</div><div class="v" style="font-size:12px">' + (r.hom.alt10c ? 'geçti' : r.hom.alt10 ? 'add.' : '—') + '</div></div>' +
        '<div class="mbox"><div class="l">BTC-göreli</div><div class="v" style="font-size:12px">' + (r.hom.btc ? 'geçti' : '—') + '</div></div>' +
      '</div>' +
      '<p class="note">Top5 gün payı %100 üzerindeyse, en iyi 5 günün katkısı toplam netten büyüktür; diğer günler net negatiftir. Orijinal ≤%40 kriterini bu evrendeki hiçbir aday geçmiyor; bu 5, alt-10/BTC tanımlarını geçen 6 konfigürasyon içinden seçildi.</p>' +
      '<h3>Drawdown</h3>' +
      '<div class="chart-wrap"><div class="chart-head"><div><h3 style="font-size:12px">Seçili yöntem</h3><p>günlük kapanış · maks DD</p></div>' +
        '<div class="seg" id="ddSeg"><button data-ddlev="10" class="on">10x</button><button data-ddlev="15">15x</button></div></div>' +
        '<canvas id="ddChart" class="chart-canvas dd"></canvas></div>' +
      '<p class="note">' + (ws.length ? 'Uyarılar yukarıda. ' : '') + 'Tüm değerler geçmiş simülasyondur; yatırım tavsiyesi değildir.</p>';
  }

  function openDetail(key) {
    var r = BY.get(key); if (!r) return;
    modalDD = { r: r, lev: 10 };
    document.getElementById('modalBody').innerHTML = detailHTML(r);
    document.getElementById('modal').hidden = false;
    document.body.classList.add('modal-open');
    var body = document.getElementById('modalBody');
    body.querySelectorAll('[data-ddlev]').forEach(function (b) {
      b.addEventListener('click', function () {
        modalDD.lev = +b.getAttribute('data-ddlev');
        body.querySelectorAll('[data-ddlev]').forEach(function (x) { x.classList.toggle('on', x === b); });
        drawDD(body.querySelector('#ddChart'), r, modalDD.lev);
      });
    });
    requestAnimationFrame(function () { drawDD(body.querySelector('#ddChart'), r, 10); });
  }

  function closeModal() {
    document.getElementById('modal').hidden = true;
    document.body.classList.remove('modal-open');
    modalDD.r = null;
  }

  function initModal() {
    document.getElementById('modal').addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  }

  /* --------------------------------- charts ------------------------------------ */
  function fitCanvas(cv) {
    var dpr = window.devicePixelRatio || 1;
    var rect = cv.getBoundingClientRect();
    var w = Math.max(320, rect.width), h = Math.max(160, rect.height);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }
  function fmtLogTick(v) {
    var m = Math.pow(10, v);
    if (m >= 1e9) return (m / 1e9).toFixed(0) + 'B×';
    if (m >= 1e6) return (m / 1e6).toFixed(0) + 'M×';
    if (m >= 1e3) return (m / 1e3).toFixed(0) + 'k×';
    if (m >= 1) return m.toFixed(0) + '×';
    return m.toFixed(2) + '×';
  }
  function equitySeries(r, L) {
    var d = r.dret, eq = new Float64Array(d.length), e = 1, liq = false, liqIdx = -1;
    eq[0] = 1;
    for (var i = 1; i < d.length; i++) {
      var g = 1 + L * (d[i] / 10000);
      if (g <= 0) { liq = true; liqIdx = i; e = 0; for (var j = i; j < d.length; j++) eq[j] = 0; break; }
      e *= g; eq[i] = e;
    }
    return { eq: eq, liq: liq, liqIdx: liqIdx };
  }

  var eqLev = 10, eqVisible = new Set(TOP.map(function (r) { return r.key; })), eqGeom = null;

  function drawEq() {
    var cv = document.getElementById('eqChart'); if (!cv) return;
    var f = fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
    var m = { l: 62, r: 16, t: 14, b: 30 };
    var x0 = m.l, x1 = w - m.r, y0 = m.t, y1 = h - m.b;
    var series = TOP.filter(function (r) { return eqVisible.has(r.key); }).map(function (r, idx) {
      var col = COLORS[TOP.indexOf(r) % COLORS.length];
      var s = equitySeries(r, eqLev);
      return { r: r, col: col, eq: s.eq, liq: s.liq, liqIdx: s.liqIdx };
    });
    ctx.clearRect(0, 0, w, h);
    if (!series.length) {
      ctx.fillStyle = '#62788b'; ctx.font = '12px Segoe UI'; ctx.textAlign = 'center';
      ctx.fillText('Eğri seçilmedi', w / 2, h / 2); eqGeom = null; return;
    }
    var minL = 0, maxL = 0;
    series.forEach(function (s) {
      for (var i = 0; i < s.eq.length; i++) {
        if (s.eq[i] > 0) { var l = Math.log10(s.eq[i]); if (l < minL) minL = l; if (l > maxL) maxL = l; }
      }
    });
    minL = Math.floor(minL) - 0.2; maxL = Math.ceil(maxL) + 0.2;
    if (maxL - minL < 1) { maxL = minL + 1; }
    var n = series[0].eq.length;
    var X = function (i) { return x0 + (i / (n - 1)) * (x1 - x0); };
    var Y = function (l) { return y0 + (maxL - l) / (maxL - minL) * (y1 - y0); };

    // grid
    ctx.font = '10px Cascadia Code, Consolas, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    var step = Math.max(1, Math.ceil((maxL - minL) / 6));
    for (var l = Math.floor(minL); l <= maxL; l += step) {
      var y = Y(l);
      ctx.strokeStyle = 'rgba(144,165,183,.13)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillStyle = '#62788b'; ctx.fillText(fmtLogTick(l), x0 - 8, y);
    }
    // x year ticks
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    YEAR_TICKS.forEach(function (t) {
      var x = X(t.i);
      ctx.strokeStyle = 'rgba(144,165,183,.10)';
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      ctx.fillStyle = '#62788b'; ctx.fillText(String(t.y), x, y1 + 8);
    });
    // lines
    series.forEach(function (s) {
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
      ctx.beginPath();
      var started = false;
      for (var i = 0; i < n; i++) {
        if (s.eq[i] <= 0) break;
        var px = X(i), py = Y(Math.log10(s.eq[i]));
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = s.col; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
      if (s.liq && s.liqIdx >= 0) {
        var lx = X(s.liqIdx), ly = Y(minL);
        ctx.fillStyle = s.col; ctx.font = 'bold 12px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('×', lx, Math.max(y0 + 8, ly));
      }
    });
    eqGeom = { x0: x0, x1: x1, y0: y0, y1: y1, minL: minL, maxL: maxL, n: n, series: series };
  }

  function initEq() {
    var cv = document.getElementById('eqChart');
    var tip = document.getElementById('eqTip');
    document.getElementById('levSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-lev]'); if (!b) return;
      eqLev = +b.getAttribute('data-lev');
      document.querySelectorAll('#levSeg button').forEach(function (x) { x.classList.toggle('on', x === b); });
      drawEq();
    });
    var leg = document.getElementById('eqLegend');
    leg.innerHTML = TOP.map(function (r, i) {
      return '<span class="li" data-key="' + esc(r.key) + '"><span class="sw" style="background:' + COLORS[i % COLORS.length] + '"></span>' + esc(shortName(r)) + '</span>';
    }).join('');
    leg.addEventListener('click', function (e) {
      var li = e.target.closest('.li'); if (!li) return;
      var k = li.getAttribute('data-key');
      if (eqVisible.has(k)) eqVisible.delete(k); else eqVisible.add(k);
      li.classList.toggle('off', !eqVisible.has(k));
      drawEq();
    });
    cv.addEventListener('mousemove', function (e) {
      if (!eqGeom) return;
      var rect = cv.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      if (mx < eqGeom.x0 || mx > eqGeom.x1) { tip.classList.remove('on'); return; }
      var t = (mx - eqGeom.x0) / (eqGeom.x1 - eqGeom.x0);
      var i = clamp(Math.round(t * (eqGeom.n - 1)), 0, eqGeom.n - 1);
      drawEq();
      var ctx = cv.getContext('2d');
      var x = eqGeom.x0 + (i / (eqGeom.n - 1)) * (eqGeom.x1 - eqGeom.x0);
      ctx.strokeStyle = 'rgba(232,240,247,.35)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, eqGeom.y0); ctx.lineTo(x, eqGeom.y1); ctx.stroke(); ctx.setLineDash([]);
      eqGeom.series.forEach(function (s) {
        if (s.eq[i] <= 0) return;
        var y = eqGeom.y0 + (eqGeom.maxL - Math.log10(s.eq[i])) / (eqGeom.maxL - eqGeom.minL) * (eqGeom.y1 - eqGeom.y0);
        ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      });
      var date = new Date(DATES[i]).toISOString().slice(0, 10);
      var html = '<div class="td">' + date + ' · ' + eqLev + 'x</div>';
      eqGeom.series.forEach(function (s) {
        html += '<div class="tr"><span><span class="sq" style="background:' + s.col + '"></span>' + esc(shortName(s.r)) + '</span><b>' + (s.eq[i] > 0 ? fmtMult(s.eq[i] - 1) : 'tasfiye') + '</b></div>';
      });
      tip.innerHTML = html; tip.classList.add('on');
      var wrap = cv.parentElement.getBoundingClientRect();
      var left = e.clientX - wrap.left + 14;
      if (left + 210 > wrap.width) left = e.clientX - wrap.left - 210;
      tip.style.left = Math.max(4, left) + 'px';
      tip.style.top = Math.max(4, e.clientY - wrap.top + 10) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.classList.remove('on'); drawEq(); });
  }

  var scatterGeom = null;
  function drawScatter() {
    var cv = document.getElementById('scatterChart'); if (!cv) return;
    var f = fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
    var m = { l: 56, r: 18, t: 18, b: 38 };
    var x0 = m.l, x1 = w - m.r, y0 = m.t, y1 = h - m.b;
    var maxX = Math.max.apply(null, S.map(function (r) { return r.hom.top5; }).concat([1.6])) * 1.06;
    var X = function (v) { return x0 + (v / maxX) * (x1 - x0); };
    var Y = function (v) { return y0 + ((-v) / 1) * (y1 - y0); };
    ctx.clearRect(0, 0, w, h);
    ctx.font = '10px Cascadia Code, Consolas, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var gx = 0; gx <= maxX; gx += 0.5) {
      var x = X(gx);
      ctx.strokeStyle = 'rgba(144,165,183,.10)';
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      if (gx % 1 === 0) { ctx.fillStyle = '#62788b'; ctx.fillText((gx * 100).toFixed(0) + '%', x, y1 + 12); }
    }
    for (var gy = 0; gy >= -1; gy -= 0.2) {
      var y = Y(gy);
      ctx.strokeStyle = 'rgba(144,165,183,.10)';
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillStyle = '#62788b'; ctx.textAlign = 'right'; ctx.fillText(fmtPct(gy, 0), x0 - 7, y);
    }
    // thresholds
    var tx = X(0.40);
    ctx.strokeStyle = 'rgba(255,93,115,.65)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(tx, y0); ctx.lineTo(tx, y1); ctx.stroke();
    ctx.fillStyle = '#ff9fae'; ctx.textAlign = 'left'; ctx.font = '10px Segoe UI'; ctx.fillText('orijinal ≤ %40', tx + 5, y0 + 10);
    var ty = Y(-0.90);
    ctx.strokeStyle = 'rgba(255,183,3,.65)';
    ctx.beginPath(); ctx.moveTo(x0, ty); ctx.lineTo(x1, ty); ctx.stroke();
    ctx.fillStyle = '#ffd27a'; ctx.textAlign = 'right'; ctx.fillText('-90% kapı', x1 - 4, ty - 5);
    ctx.setLineDash([]);
    // points: eliminated first
    scatterGeom = { pts: [], x0: x0, x1: x1, y0: y0, y1: y1 };
    var pts = [];
    S.forEach(function (r) {
      var px = X(r.hom.top5), py = Y(r.dd15);
      var isTop = r.top5 > 0, surv = r.survives;
      if (!isTop) {
        ctx.fillStyle = surv ? 'rgba(61,220,151,.55)' : 'rgba(144,165,183,.32)';
        ctx.beginPath(); ctx.arc(px, py, surv ? 3.4 : 2.6, 0, Math.PI * 2); ctx.fill();
      }
      pts.push({ x: px, y: py, r: r });
    });
    TOP.forEach(function (r) {
      var px = X(r.hom.top5), py = Y(r.dd15);
      ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#0a131a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffe4a3'; ctx.font = 'bold 10px Segoe UI'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(shortName(r), px + 8, py - 1);
    });
    ctx.fillStyle = '#62788b'; ctx.font = '10px Segoe UI'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('top5 gün payı (düşük iyi)', (x0 + x1) / 2, h - 14);
    ctx.save(); ctx.translate(14, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('15x maks DD', 0, 0); ctx.restore();
    scatterGeom.pts = pts;
  }

  function initScatter() {
    var cv = document.getElementById('scatterChart');
    var tip = document.getElementById('scatterTip');
    cv.addEventListener('mousemove', function (e) {
      if (!scatterGeom) return;
      var rect = cv.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var best = null, bd = 1e9;
      scatterGeom.pts.forEach(function (p) {
        var d = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
        if (d < bd) { bd = d; best = p; }
      });
      if (!best || bd > 140) { tip.classList.remove('on'); return; }
      var r = best.r;
      tip.innerHTML = '<div class="td">' + esc(r.title) + ' · ' + esc(r.tf) + '</div>' +
        '<div class="tr"><span>Top5 gün payı</span><b>' + fmtPct(r.hom.top5, 0) + '</b></div>' +
        '<div class="tr"><span>15x maks DD</span><b>' + fmtDD(r.dd15) + '</b></div>' +
        '<div class="tr"><span>ULTRA skor</span><b>' + r.scores.total.toFixed(1) + '</b></div>' +
        '<div class="tr"><span>Durum</span><b>' + (r.survives ? 'Hayatta' : 'Elendi') + '</b></div>';
      tip.classList.add('on');
      var wrap = cv.parentElement.getBoundingClientRect();
      var left = e.clientX - wrap.left + 14;
      if (left + 220 > wrap.width) left = e.clientX - wrap.left - 220;
      tip.style.left = Math.max(4, left) + 'px';
      tip.style.top = Math.max(4, e.clientY - wrap.top + 10) + 'px';
    });
    cv.addEventListener('mouseleave', function () { tip.classList.remove('on'); });
  }

  function drawDD(cv, r, L) {
    if (!cv || !r) return;
    var f = fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
    var m = { l: 48, r: 12, t: 12, b: 26 };
    var x0 = m.l, x1 = w - m.r, y0 = m.t, y1 = h - m.b;
    var s = equitySeries(r, L);
    var peak = 1, dd = new Float64Array(s.eq.length), mdd = 0;
    for (var i = 0; i < s.eq.length; i++) {
      var e = s.eq[i];
      if (e > peak) peak = e;
      var d = e > 0 ? e / peak - 1 : -1;
      dd[i] = d; if (d < mdd) mdd = d;
    }
    var yMin = Math.min(-0.10, mdd * 1.10);
    var X = function (i) { return x0 + (i / (dd.length - 1)) * (x1 - x0); };
    var Y = function (v) { return y0 + (v / yMin) * (y1 - y0); };
    ctx.clearRect(0, 0, w, h);
    ctx.font = '10px Cascadia Code, Consolas, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var gy = 0; gy >= yMin; gy += yMin / 4) {
      var y = Y(gy);
      ctx.strokeStyle = 'rgba(144,165,183,.10)';
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillStyle = '#62788b'; ctx.fillText(fmtPct(gy, 0), x0 - 7, y);
    }
    YEAR_TICKS.forEach(function (t) {
      var x = X(t.i);
      ctx.strokeStyle = 'rgba(144,165,183,.08)';
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      ctx.fillStyle = '#62788b'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(String(t.y), x, y1 + 7);
    });
    ctx.beginPath(); ctx.moveTo(X(0), Y(0));
    for (var j = 0; j < dd.length; j++) ctx.lineTo(X(j), Y(dd[j]));
    ctx.lineTo(X(dd.length - 1), Y(0)); ctx.closePath();
    var grad = ctx.createLinearGradient(0, y0, 0, y1);
    grad.addColorStop(0, 'rgba(255,93,115,.05)'); grad.addColorStop(1, 'rgba(255,93,115,.42)');
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    for (var k = 0; k < dd.length; k++) { if (k === 0) ctx.moveTo(X(k), Y(dd[k])); else ctx.lineTo(X(k), Y(dd[k])); }
    ctx.strokeStyle = '#ff5d73'; ctx.lineWidth = 1.8; ctx.stroke();
    var my = Y(mdd);
    ctx.strokeStyle = 'rgba(255,209,102,.8)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, my); ctx.lineTo(x1, my); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ffd166'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.font = 'bold 10px Segoe UI';
    ctx.fillText('maks DD ' + fmtDD(mdd), x0 + 4, my - 3);
    ctx.fillStyle = '#90a5b7'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.font = '10px Segoe UI';
    ctx.fillText(L + 'x · son ' + fmtMult(s.eq[s.eq.length - 1] - 1), x1, y0 + 1);
  }

  function initResize() {
    var t = null;
    window.addEventListener('resize', function () {
      clearTimeout(t); t = setTimeout(function () {
        drawEq(); drawScatter();
        if (!document.getElementById('modal').hidden && modalDD.r) {
          var cv = document.querySelector('#ddChart');
          if (cv) drawDD(cv, modalDD.r, modalDD.lev);
        }
      }, 140);
    });
  }

  /* ---------------------------------- boot ------------------------------------- */
  renderHero();
  renderScenario();
  renderTopCards();
  initTable();
  renderTable();
  initEq();
  initScatter();
  initModal();
  initResize();
  requestAnimationFrame(function () { drawEq(); drawScatter(); });
})();
