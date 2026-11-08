// Filtre Laboratuvarı — DASHBOARD.html üreticisi
//   node tools/dashboard.mjs
// Girdi: out/dashboard_data.json → çıktı: D:\BigPlan\DASHBOARD.html
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BP } from './core.mjs';

const D = JSON.parse(await readFile(join(BP, 'out', 'dashboard_data.json'), 'utf8'));
const NSYM = D.universe?.count ?? 58;
const dataStr = JSON.stringify(D).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Filtre Laboratuvarı — İndikatör Akademi</title>
<style>
  :root{
    --bg:#0e1117; --panel:#161b27; --panel2:#1c2332; --line:#26304a;
    --tx:#e8ecf4; --dim:#93a0b8; --acc:#6ea8fe; --pos:#3fbf7f; --neg:#ef5b5b; --warn:#f4b942;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.45 system-ui,Segoe UI,Roboto,Arial,sans-serif}
  a{color:var(--acc);text-decoration:none}
  header{padding:26px 28px 10px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#131a2a,#0e1117)}
  h1{margin:0 0 4px;font-size:24px;letter-spacing:.2px}
  .sub{color:var(--dim);font-size:13px}
  .wrap{max-width:1460px;margin:0 auto;padding:18px 22px 80px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:12px;margin:16px 0 8px}
  .kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
  .kpi .v{font-size:26px;font-weight:700}
  .kpi .l{color:var(--dim);font-size:12.5px;margin-top:2px}
  .kpi .s{color:var(--dim);font-size:11.5px;margin-top:4px}
  .kpi.pos .v{color:var(--pos)} .kpi.acc .v{color:var(--acc)} .kpi.warn .v{color:var(--warn)}
  h2{font-size:18px;margin:30px 0 10px;border-left:3px solid var(--acc);padding-left:10px}
  h3{font-size:15px;margin:18px 0 8px;color:#cdd7ea}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
  .row{display:flex;gap:14px;flex-wrap:wrap}
  .controls{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:10px 0 12px}
  .seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}
  .seg button{background:var(--panel);color:var(--dim);border:0;padding:7px 14px;cursor:pointer;font-size:13px}
  .seg button.on{background:#25324a;color:var(--tx);font-weight:600}
  input[type=search]{background:var(--panel);border:1px solid var(--line);color:var(--tx);border-radius:9px;padding:7px 11px;font-size:13px;width:220px}
  .legend{display:flex;align-items:center;gap:8px;color:var(--dim);font-size:12px}
  .lgbar{width:150px;height:10px;border-radius:6px;background:linear-gradient(90deg,#ef5b5b,#5b6478,#3fbf7f)}
  .mw{overflow:auto;max-height:78vh;border:1px solid var(--line);border-radius:12px}
  table.matrix{border-collapse:separate;border-spacing:0;width:100%}
  table.matrix th{position:sticky;top:0;background:#1a2233;z-index:3;font-size:12px;color:var(--dim);padding:7px 8px;border-bottom:1px solid var(--line);text-align:center}
  table.matrix td.st{position:sticky;left:0;background:#151a26;z-index:2;font-size:12px;padding:4px 10px;border-right:1px solid var(--line);white-space:nowrap;min-width:190px}
  td.st .cid{color:var(--dim);font-size:10.5px}
  td.cell{padding:0;border:0}
  td.cell button{display:block;width:100%;min-width:74px;height:26px;border:0;border-radius:4px;cursor:pointer;color:#f2f5fa;font-size:10.5px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.45)}
  td.cell button.sel{outline:2px solid #fff;outline-offset:-2px}
  td.cell button .b{font-size:9px}
  td.cell button.dim{opacity:.45}
  .badge{display:inline-block;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:600;margin-left:6px;vertical-align:1px}
  .badge.h{background:#1f4d38;color:#7fe0ae}
  .badge.a{background:#4d3f1f;color:#ffd479}
  .badge.n{background:#2a3247;color:#a9b6d0}
  table.tbl{border-collapse:collapse;width:100%;font-size:12.5px}
  table.tbl th,table.tbl td{border-bottom:1px solid var(--line);padding:6px 9px;text-align:left;white-space:nowrap}
  table.tbl th{color:var(--dim);font-size:11.5px;position:sticky;top:0;background:#1a2233;cursor:pointer}
  table.tbl tr:hover td{background:#1b2233}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .pos{color:var(--pos)} .neg{color:var(--neg)} .dim{color:var(--dim)}
  .det{margin-top:14px}
  .det .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media (max-width:900px){.det .grid2{grid-template-columns:1fr}}
  .kv{display:grid;grid-template-columns:auto 1fr;gap:3px 14px;font-size:13px}
  .kv .k{color:var(--dim)}
  .keys{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
  .key{background:#232e46;border:1px solid #33415f;border-radius:8px;padding:2px 9px;font-size:12px}
  .note{color:var(--dim);font-size:12px;margin-top:8px}
  footer{color:var(--dim);font-size:12px;padding:26px 0 10px;border-top:1px solid var(--line);margin-top:40px}
  details{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin:8px 0}
  summary{cursor:pointer;color:#cdd7ea}
  .pill{background:#232e46;border-radius:8px;padding:2px 8px;font-size:11px;color:#b9c6df;margin-right:6px;display:inline-block}
</style>
</head>
<body>
<header>
  <h1>Filtre Laboratuvarı <span style="font-size:13px;color:var(--dim)">· İndikatör Akademi</span></h1>
  <div class="sub">${D.kpis.hücre} hücre (${D.strategies.length} indikatör × ${D.tfs.length} zaman dilimi × ${NSYM} sembol) filtresiz ve filtreli yeniden simülasyon · üretim: <span id="gen"></span> · çıkışlar her durumda uygulanır; filtre yalnızca yeni girişi engeller</div>
</header>
<div class="wrap">
  <div class="kpis" id="kpis"></div>

  <h2 id="matris">Isı Matrisi — Önce / Sonra / Fark</h2>
  <div class="controls">
    <div class="seg" id="modeSeg">
      <button data-m="base" class="on">Önce</button>
      <button data-m="after">Sonra (en iyi varyant)</button>
      <button data-m="diff">Fark</button>
    </div>
    <input type="search" id="q" placeholder="İndikatör ara… (örn. rsi)">
    <div class="legend"><span>-0.2%</span><div class="lgbar"></div><span>+0.2%</span><span style="margin-left:6px">işlem başına ortalama getiri</span></div>
    <div class="legend"><span class="badge h" style="margin:0">🏅</span><span>test işlem ≥100 &amp; test Δ&gt;0</span><span class="badge a" style="margin-left:10px">✓</span><span>kabul kriterleri sağlandı</span></div>
  </div>
  <div class="mw"><table class="matrix"><thead id="mhead"></thead><tbody id="mbody"></tbody></table></div>
  <div class="det" id="det"><div class="card dim">Detay için matristen bir hücre seçin.</div></div>

  <h2 id="kazananlar">Öne Çıkan Dönüşümler (ilk 20)</h2>
  <div class="mw" style="max-height:none"><table class="tbl" id="wtbl"></table></div>

  <h2 id="lig">Filtre Ligi</h2>
  <div class="note">Filtre bir hücrede "kabul" aldıysa: train Δ&gt;0, test Δ&gt;0, test n≥30, koruma ≥%20, sembol tutarlılığı. Başlık kriteri: test n≥100 ekseni. Sıralamak için başlıklara tıklayın.</div>
  <div class="mw" style="max-height:none"><table class="tbl" id="ltbl"></table></div>

  <h2 id="kurtarilamayan">Kurtarılamayan Hücreler (dürüst liste)</h2>
  <div class="note">Filtre politikası içinde pozitife dönmeyen baz negatif hücreler. Bunlar "çözülemedi" diye işaretlenmiştir; maskeleme yapılmamıştır.</div>
  <div class="mw" style="max-height:none"><table class="tbl" id="utbl"></table></div>

  <h2 id="yontem">Yöntem ve Sınırlar</h2>
  <div class="card" id="method"></div>

  <h2 id="filtreler">Filtre Kataloğu</h2>
  <div id="cat"></div>

  <footer id="foot"></footer>
</div>
<script id="DATA" type="application/json">${dataStr}</script>
<script>
(function(){
  const D = JSON.parse(document.getElementById('DATA').textContent);
  const $ = (s) => document.querySelector(s);
  const el = (t, cls, html) => { const e = document.createElement(t); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const fP = (v, d = 3) => v == null ? '—' : (v * 100).toFixed(d) + '%';
  const fS = (v, d = 4) => v == null ? '—' : ((v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%');
  const fN = (v) => v == null ? '—' : Number(v).toLocaleString('tr-TR');
  const fCat = {}; const fTitle = {}; const fDesc = {};
  for (const f of D.filters) { fCat[f.k] = f; fTitle[f.k] = f.title; fDesc[f.k] = f.desc; }
  const stTitle = {};
  for (const s of (D.strategies || [])) stTitle[s.id] = s.title || s.id;
  const keyTitle = (keys) => keys.map((k) => (fTitle[k] || k)).join(' + ');

  $('#gen').textContent = (D.gen || '').slice(0, 16).replace('T', ' ') + ' UTC';

  // ---- KPI kartları
  (function(){
    const k = D.kpis; const host = $('#kpis'); const v = D.verify;
    const cards = [
      ['acc', k.hücre, 'İncelenen hücre', '100 indikatör × 6 TF'],
      ['warn', k.bazNegatifHücre, 'Baz durumda negatif hücre', 'filtresiz, işlem başına ortalama < 0'],
      ['pos', k.kurtarılan, 'Pozitife dönen hücre', 'kabul kriterli · başlık: ' + k.kurtarılanBaşlık],
      ['pos', k.iyileşen, 'İyileşen hücre', 'en iyi varyant bazı · başlık: ' + k.iyileşenBaşlık],
      ['pos', fS(k.ortalamaİyileşme), 'Ort. işlem başına iyileşme', 'tüm hücreler'],
      ['pos', fS(k.ortalamaİyileşmeNegatiflerde), 'Ort. iyileşme (baz negatifler)', 'negatiften başlayan hücreler'],
      ['acc', (D.kpis.pozitifOranÖnce * 100).toFixed(1) + '% → ' + (D.kpis.pozitifOranSonra * 100).toFixed(1) + '%', 'Pozitif hücre oranı', 'önce → sonra'],
      ['acc', fN(k.tekFiltreDeğerlendirmesi) + ' / ' + fN(k.kombinasyonDeğerlendirmesi), 'Tek filtre / kombinasyon', 'değerlendirilen varyant sayısı'],
    ];
    if (v) cards.push(['acc', v.ok + '/' + v.cells, 'Motor doğrulaması', 'referans raporla birebir eşleşen hücre' + (v.rounding ? ' (' + v.rounding + ' patolojik oran kaydı)' : '')]);
    for (const [cls, val, lab, sub] of cards) {
      const c = el('div', 'kpi ' + cls);
      c.appendChild(el('div', 'v', String(val)));
      c.appendChild(el('div', 'l', lab));
      if (sub) c.appendChild(el('div', 's', sub));
      host.appendChild(c);
    }
  })();

  // ---- hücre indeksleri
  const byKey = {};
  for (const c of D.cells) byKey[c.id + ':' + c.tf] = c;
  let mode = 'base', sel = null;

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function color(v) {
    if (v == null) return '#2a3040';
    const t = clamp(v / 0.002, -1, 1);
    const mix = (a, b, t2) => a.map((x, i) => Math.round(x + (b[i] - x) * t2));
    const gray = [90, 100, 120];
    const rgb = t < 0 ? mix(gray, [190, 62, 62], -t) : mix(gray, [48, 168, 106], t);
    return 'rgb(' + rgb.join(',') + ')';
  }

  const TFS = D.tfs || ['5m', '15m', '1h', '4h', '1d', '1w'];
  const thead = $('#mhead');
  {
    const tr = el('tr');
    tr.appendChild(el('th', null, 'İndikatör'));
    for (const tf of TFS) tr.appendChild(el('th', null, tf));
    thead.appendChild(tr);
  }
  const tbody = $('#mbody');
  const cellEls = {};
  for (const s of D.strategies) {
    const tr = el('tr');
    const td = el('td', 'st', '<b>' + (s.title || s.id) + '</b> <span class="cid">' + s.id + '</span>');
    td.dataset.txt = ((s.title || '') + ' ' + s.id).toLowerCase();
    tr.appendChild(td);
    for (const tf of TFS) {
      const td2 = el('td', 'cell');
      const c = byKey[s.id + ':' + tf];
      const b = el('button');
      b.dataset.key = s.id + ':' + tf;
      if (c) {
        const set = () => {
          let v, tt, dim = false, badge = '';
          if (mode === 'base') { v = c.base.avg; tt = 'Önce'; }
          else if (mode === 'after') {
            v = c.best ? c.best.avg : c.base.avg;
            dim = !c.best; tt = c.best ? 'Sonra' : 'Varyant yok (önce gösteriliyor)';
            if (c.best && c.best.thr === 'başlık') badge = ' <span class="b">🏅</span>';
            else if (c.best && c.best.thr === 'kabul') badge = ' <span class="b">✓</span>';
          } else { v = c.best ? c.lift : null; tt = 'Fark'; dim = !c.best; }
          b.style.background = color(v);
          b.classList.toggle('dim', dim);
          const txt = mode === 'diff' ? fS(v, 2) : fP(v, 2);
          b.innerHTML = txt + badge;
          b.title = (s.title || s.id) + ' · ' + tf + '\\nÖnce: ' + fP(c.base.avg) + ' (n=' + fN(c.base.n) + ')\\n' +
            (c.best ? 'Sonra: ' + fP(c.best.avg) + ' (n=' + fN(c.best.n) + ') · ' + keyTitle(c.best.keys) + '\\nFark: ' + fS(c.lift) + ' · testΔ: ' + fS(c.best.testD) + ' · test n: ' + fN(c.best.testN) : 'Uygun varyant yok');
        };
        set();
        cellEls[s.id + ':' + tf] = { btn: b, set };
        b.addEventListener('click', () => selectCell(s.id + ':' + tf));
      } else {
        b.disabled = true; b.style.background = '#20242f'; b.textContent = '—';
      }
      td2.appendChild(b);
      tr.appendChild(td2);
    }
    tr.dataset.txt = td.dataset.txt;
    tbody.appendChild(tr);
  }

  document.querySelectorAll('#modeSeg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.m;
      document.querySelectorAll('#modeSeg button').forEach((x) => x.classList.toggle('on', x === btn));
      for (const k in cellEls) cellEls[k].set();
    });
  });
  $('#q').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    for (const tr of tbody.children) tr.style.display = !q || tr.dataset.txt.includes(q) ? '' : 'none';
  });

  // ---- detay paneli
  function selectCell(key) {
    sel = key;
    for (const k in cellEls) cellEls[k].btn.classList.toggle('sel', k === key);
    const c = byKey[key];
    const det = $('#det');
    if (!c) { det.innerHTML = '<div class="card">Veri yok.</div>'; return; }
    const d = D.details[key] || {};
    const h = [];
    h.push('<div class="card"><h3 style="margin-top:0">' + (stTitle[c.id] || c.id) + ' <span class="dim" style="font-size:12px">(' + c.id + ' · ' + c.tf + ')</span></h3>');
    h.push('<div class="grid2">');
    h.push('<div><h3>Baz durum (filtresiz)</h3><div class="kv">' +
      kv('İşlem', fN(c.base.n) + ' <span class="dim">(train ' + fN(c.base.trainN) + ' / test ' + fN(c.base.testN) + ')</span>') +
      kv('İşlem başına ort.', '<b class="' + (c.base.avg < 0 ? 'neg' : 'pos') + '">' + fP(c.base.avg) + '</b> <span class="dim">(train ' + fP(c.base.trainAvg) + ' / test ' + fP(c.base.testAvg) + ')</span>') +
      kv('Kazanma oranı', fP(c.base.wr, 1)) +
      kv('Profit faktör', c.base.pf == null ? '—' : c.base.pf) +
      kv('Portföy getirisi', fS(c.base.tot, 1)) +
      kv('Maks. düşüş', fP(c.base.dd, 1)) +
      '</div></div>');
    if (c.best) {
      const bt = c.best;
      h.push('<div><h3>En iyi varyant ' + (bt.thr === 'başlık' ? '<span class="badge h">🏅 başlık</span>' : bt.thr === 'kabul' ? '<span class="badge a">✓ kabul</span>' : '<span class="badge n">kabul dışı</span>') + '</h3>');
      h.push('<div class="keys">' + bt.keys.map((k) => '<span class="key" title="' + (fDesc[k] || '').replace(/"/g, '&quot;') + '">' + (fTitle[k] || k) + '</span>').join('') + '</div>');
      h.push('<div class="kv">' +
        kv('Tür', bt.type) +
        kv('İşlem', fN(bt.n) + ' <span class="dim">(koruma ' + (bt.keep == null ? '—' : (bt.keep * 100).toFixed(0) + '%') + ')</span>') +
        kv('İşlem başına ort.', '<b class="' + (bt.avg < 0 ? 'neg' : 'pos') + '">' + fP(bt.avg) + '</b> <span class="dim">(' + fS(bt.avg - c.base.avg) + ')</span>') +
        kv('train Δ / test Δ', fS(bt.trainD) + ' / ' + fS(bt.testD) + ' <span class="dim">(test n=' + fN(bt.testN) + ')</span>') +
        kv('Kazanma oranı', fP(bt.wr, 1)) +
        kv('Profit faktör', bt.pf == null ? '—' : bt.pf) +
        '</div></div>');
    } else {
      h.push('<div><h3>En iyi varyant</h3><div class="dim">Kabul kriterlerini sağlayan varyant bulunamadı.</div></div>');
    }
    h.push('</div>');

    if (d.variants && d.variants.length) {
      h.push('<h3>Denenen Varyantlar <span class="dim" style="font-size:12px">(kabul edilenler + öne çıkanlar)</span></h3>');
      h.push('<table class="tbl"><thead><tr><th>Tür</th><th>Filtre(ler)</th><th class="num">n</th><th class="num">ort.</th><th class="num">trainΔ</th><th class="num">testΔ</th><th class="num">test n</th><th class="num">koruma</th><th>Durum</th></tr></thead><tbody>');
      for (const v of d.variants) {
        h.push('<tr><td>' + v.type + '</td><td>' + keyTitle(v.keys) + '</td><td class="num">' + fN(v.n) + '</td><td class="num ' + (v.avg < 0 ? 'neg' : 'pos') + '">' + fP(v.avg) + '</td><td class="num">' + fS(v.trainD) + '</td><td class="num">' + fS(v.testD) + '</td><td class="num">' + fN(v.testN) + '</td><td class="num">' + (v.keep == null ? '—' : (v.keep * 100).toFixed(0) + '%') + '</td><td>' + (v.thr === 'başlık' ? '🏅 başlık' : v.thr === 'kabul' ? '✓ kabul' : '—') + '</td></tr>');
      }
      h.push('</tbody></table>');
    }
    if (d.heatBase) {
      const syms = Object.keys(d.heatBase).sort((a, b) => d.heatBase[b][0] - d.heatBase[a][0]);
      h.push('<h3>Sembol Isısı <span class="dim" style="font-size:12px">(baz → en iyi varyant, işlem başına ortalama)</span></h3>');
      h.push('<table class="tbl"><thead><tr><th>Sembol</th><th class="num">baz ort.</th><th class="num">baz n</th><th class="num">sonra ort.</th><th class="num">sonra n</th></tr></thead><tbody>');
      for (const s of syms) {
        const b0 = d.heatBase[s]; const b1 = d.heatBest ? d.heatBest[s] : null;
        h.push('<tr><td>' + s + '</td><td class="num ' + (b0[0] < 0 ? 'neg' : 'pos') + '">' + fP(b0[0]) + '</td><td class="num">' + fN(b0[1]) + '</td><td class="num ' + (b1 ? (b1[0] < 0 ? 'neg' : 'pos') : 'dim') + '">' + (b1 ? fP(b1[0]) : '—') + '</td><td class="num">' + (b1 ? fN(b1[1]) : '—') + '</td></tr>');
      }
      h.push('</tbody></table>');
    }
    h.push('</div>');
    det.innerHTML = h.join('');
    det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function kv(k, v) { return '<span class="k">' + k + '</span><span>' + v + '</span>'; }

  // ---- kazananlar
  (function(){
    const t = $('#wtbl');
    t.innerHTML = '<thead><tr><th>#</th><th>İndikatör</th><th>TF</th><th>En iyi varyant</th><th class="num">Önce</th><th class="num">Sonra</th><th class="num">Fark</th><th class="num">trainΔ</th><th class="num">testΔ</th><th class="num">test n</th><th class="num">koruma</th><th>Durum</th></tr></thead><tbody>' +
      D.winners.map((w, i) => '<tr><td>' + (i + 1) + '</td><td>' + (stTitle[w.id] || w.id) + ' <span class="dim">' + w.id + '</span></td><td>' + w.tf + '</td><td>' + keyTitle(w.keys) + '</td>' +
        '<td class="num ' + (w.baseAvg < 0 ? 'neg' : 'pos') + '">' + fP(w.baseAvg) + '</td><td class="num ' + (w.afterAvg < 0 ? 'neg' : 'pos') + '">' + fP(w.afterAvg) + '</td><td class="num ' + (w.lift < 0 ? 'neg' : 'pos') + '">' + fS(w.lift) + '</td><td class="num">' + fS(w.trainD) + '</td><td class="num">' + fS(w.testD) + '</td><td class="num">' + fN(w.testN) + '</td><td class="num">' + (w.keep == null ? '—' : (w.keep * 100).toFixed(0) + '%') + '</td><td>' + (w.thr === 'başlık' ? '🏅 başlık' : '✓ kabul') + '</td></tr>').join('') + '</tbody>';
  })();

  // ---- lig
  let lig = D.league || [];
  let ligSort = { k: 'pass', dir: -1 };
  function renderLig() {
    const t = $('#ltbl');
    const rows = [...lig].sort((a, b) => {
      const va = ligSort.k === 'pass' ? a.pass : ligSort.k === 'tD' ? (a.ortalamaPassTrainD || 0) : (a.ortalamaPassTestD || 0);
      const vb = ligSort.k === 'pass' ? b.pass : ligSort.k === 'tD' ? (b.ortalamaPassTrainD || 0) : (b.ortalamaPassTestD || 0);
      return (va - vb) * ligSort.dir;
    });
    t.innerHTML = '<thead><tr><th>#</th><th>Filtre</th><th>Kod</th><th>Kategori</th><th class="num" data-s="pass">Kabul hücresi</th><th class="num" data-s="tD">Ort. trainΔ</th><th class="num" data-s="eD">Ort. testΔ</th></tr></thead><tbody>' +
      rows.slice(0, 40).map((l, i) => '<tr><td>' + (i + 1) + '</td><td title="' + ((fDesc[l.k] || '').replace(/"/g, '&quot;')) + '">' + (fTitle[l.k] || l.k) + '</td><td class="dim">' + l.k + '</td><td>' + (fCat[l.k] ? fCat[l.k].catTitle : (l.cat || '')) + '</td><td class="num"><b>' + l.pass + '</b></td><td class="num">' + fS(l.ortalamaPassTrainD) + '</td><td class="num">' + fS(l.ortalamaPassTestD) + '</td></tr>').join('') + '</tbody>';
    t.querySelectorAll('th[data-s]').forEach((th) => th.addEventListener('click', () => {
      const s = th.dataset.s;
      if (ligSort.k === s) ligSort.dir *= -1; else { ligSort.k = s; ligSort.dir = -1; }
      renderLig();
    }));
  }
  renderLig();

  // ---- kurtarılamayanlar
  (function(){
    const t = $('#utbl');
    t.innerHTML = '<thead><tr><th>İndikatör</th><th>TF</th><th class="num">Baz n</th><th class="num">Önce</th><th class="num">En iyi sonra</th><th>En iyi varyant</th><th>Durum</th></tr></thead><tbody>' +
      D.unrescued.map((u) => '<tr><td>' + (stTitle[u.id] || u.id) + ' <span class="dim">' + u.id + '</span></td><td>' + u.tf + '</td><td class="num">' + fN(u.n) + '</td><td class="num neg">' + fP(u.baseAvg) + '</td><td class="num ' + (u.bestAvg == null ? 'dim' : u.bestAvg < 0 ? 'neg' : 'pos') + '">' + (u.bestAvg == null ? '—' : fP(u.bestAvg)) + '</td><td>' + (u.bestKeys && u.bestKeys.length ? keyTitle(u.bestKeys) : '—') + '</td><td>' + (u.bestThr === 'başlık' ? '🏅 başlık' : u.bestThr === 'kabul' ? '✓ kabul' : 'kabul dışı') + '</td></tr>').join('') + '</tbody>';
  })();

  // ---- yöntem
  (function(){
    const v = D.verify;
    let h = '<p><b>Motor doğrulaması:</b> Orijinal backtest çekirdeği (komisyon %0,04 + 1bp kayma + gerçek funding, kapanış sinyali → sonraki açılışta emir) birebir yeniden üretildi ve referans rapordaki 600 hücrenin tamamıyla karşılaştırıldı' + (v ? ': <b>' + v.ok + '/' + v.cells + ' birebir</b>' + (v.fail ? ', ' + v.fail + ' farklı' : '') : '') + '.</p>' +
      '<p><b>Filtre mekaniği:</b> Çıkış sinyalleri (stop, ters dönüş, maxBars) her durumda aynen uygulanır. Filtreler yalnızca <i>yeni girişi</i> engeller: bloke edilen ters dönüşte pozisyon kapanır, karşı yönde yeni pozisyon açılmaz (düz kalınır).</p>' +
      '<p><b>Aşırı-uyum kontrolü:</b> Filtre seçimi yalnızca eğitim döneminde (2022-08 → 2024-12-31) yapıldı. Kabul için: test dönemi (2025-01-01 →) Δ&gt;0, test işlem ≥30, işlem korunumu ≥%20, sembol tutarlılığı. Başlık kriteri: test işlem ≥100.</p>' +
      '<p><b>Piyasa katmanı:</b> Gerçek Korku&amp;Açgözlülük endeksi (alternative.me, günlük), BTC 1d/4h trend, BTC 7g/30g getiri, BTC volatilite yüzdeliği, 90g düşüş, piyasa genişliği (' + NSYM + ' sembolün EMA50 üstü oranı), 5g genişlik momentumu, toplam piyasa hacmi yüzdeliği. Tüm seriler bar kapanış anında bilinen değerlerle hizalanır — <b>lookahead yoktur</b>.</p>' +
      '<p><b>Sınırlar:</b> Çalışma eğitim amaçlı bir araştırmadır; yatırım tavsiyesi değildir. Çok sayıda filtre denemesi veri madenciliği etkisi yaratabilir; kabul kapıları riski azaltır ama sıfırlamaz. Sonuçlar seçilmiş ' + NSYM + ' sembol ve 2022-08 → 2026-09 verisine özgüdür. F&amp;G günlüktür; gün içi sinyaller yayın anını bekler. Likidite varsayımları idealdir; büyük emirlerde kayma artar.</p>';
    $('#method').innerHTML = h;
    const foot = $('#foot');
    foot.innerHTML = 'Filtre Laboratuvarı · ' + (D.filters ? D.filters.length : 0) + ' filtre · ' + D.kpis.hücre + ' hücre · üretim ' + (D.gen || '').slice(0, 10) + ' · Bu panel çevrimdışı tek dosyadır.';
  })();

  // ---- filtre kataloğu
  (function(){
    const cats = {};
    for (const f of D.filters) (cats[f.catTitle] = cats[f.catTitle] || []).push(f);
    let h = '';
    for (const [cat, list] of Object.entries(cats)) {
      h += '<details><summary><b>' + cat + '</b> <span class="dim">(' + list.length + ')</span></summary>';
      for (const f of list) h += '<div style="margin:6px 0"><span class="key">' + f.title + '</span> <span class="dim">' + f.k + '</span><div class="note" style="margin-top:2px">' + f.desc + '</div></div>';
      h += '</details>';
    }
    $('#cat').innerHTML = h;
  })();
})();
</script>
</body>
</html>
`;

await writeFile(join(BP, 'DASHBOARD.html'), html);
console.log(`[dashboard] yazıldı: DASHBOARD.html (${(html.length / 1048576).toFixed(1)} MB)`);
