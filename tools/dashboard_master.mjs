// dashboard_master.mjs — mevcut DASHBOARD.html'i genişletir:
//   + yönetici KPI kartı (homojenlik)
//   + Homojenlik bölümü (6 ölçüt, dağılım, saçılım, dayanıklılık, 93 aday, aylık ısı)
//   + Veri / kapsam / doğrulama bölümü
// Çıktı: DASHBOARD_MASTER.html (tek dosya, çevrimdışı)
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BP = 'D:/BigPlan';
const SLIM = process.argv.includes('--slim');
const LITE = process.argv.includes('--lite') || SLIM;
const MAXSYM = 25;
let base = await readFile(join(BP, 'DASHBOARD.html'), 'utf8');
if (LITE) {
  // dosya boyutu için sembol ısısını her hücrede en iyi/en kötü 25 sembolle sınırla
  const re = /<script id="DATA" type="application\/json">([\s\S]*?)<\/script>/;
  const m = base.match(re);
  if (m) {
    const data = JSON.parse(m[1]);
    const trim = (h) => {
      if (!h) return h;
      const arr = Object.entries(h);
      if (arr.length <= MAXSYM * 2) return h;
      arr.sort((a, b) => (b[1] && b[1][0] != null ? b[1][0] : -1e9) - (a[1] && a[1][0] != null ? a[1][0] : -1e9));
      return Object.fromEntries(arr.slice(0, MAXSYM).concat(arr.slice(-MAXSYM)));
    };
    if (SLIM) {
      // çevrimiçi sürüm: hücre başına sembol ısısı ve varyant listesi çıkarılır
      data.details = {};
    } else {
      for (const k in data.details || {}) {
        data.details[k].heatBase = trim(data.details[k].heatBase);
        data.details[k].heatBest = trim(data.details[k].heatBest);
      }
    }
    const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
    base = base.replace(m[0], '<script id="DATA" type="application/json">' + json + '</script>');
    console.log('[master] ' + (SLIM ? 'slim: sembol ısısı çıkarıldı' : 'lite: sembol ısısı hücre başına ±' + MAXSYM + ' sembole indirildi'));
  }
}
const H = JSON.parse(await readFile(join(BP, 'out', 'homojenlik.json'), 'utf8'));
const A = JSON.parse(await readFile(join(BP, 'out', 'homogen_alt.json'), 'utf8'));
const E = JSON.parse(await readFile(join(BP, 'out', 'executive_summary.json'), 'utf8'));

const akey = (r) => r.id + '|' + r.tf + '|' + r.kind;
const amap = new Map(A.rows.map((r) => [akey(r), r]));
const rows = H.rows.map((r) => {
  const a = amap.get(akey(r));
  const o = {
    id: r.id, tf: r.tf, kind: r.kind, ad: r.ad, n: r.n,
    net: r.net, pozAy: r.pozAy, top1Ay: r.top1Ay, top5Gun: r.top5Gun, r2: r.r2,
    dd: r.dd, y23: r.y23, y24: r.y24, y25: r.y25,
    hom: r.hom, eksik: r.eksik,
    aylik: (r.eksik.length === 1 && String(r.eksik[0]).indexOf('top5') === 0) ? r.aylik : null,
    rem5: a ? a.rem5 : null, rem10: a ? a.rem10 : null, rem20: a ? a.rem20 : null,
  };
  if (!SLIM) { o.keys = r.keys; o.pozGun = r.pozGun; o.teN = r.teN; o.baseAvg = r.baseAvg; o.kurt = r.kurt; }
  return o;
});

const pos = rows.filter((r) => r.net > 0);
const n = (fn) => rows.filter(fn).length;
const p = (fn) => pos.filter(fn).length;
const yearsOk = (r) => r.y23 != null && r.y24 != null && r.y25 != null && r.y23 > 0 && r.y24 > 0 && r.y25 > 0;
const otherOk = (r) => r.net > 0 && r.pozAy >= 0.6 && r.top1Ay != null && r.top1Ay <= 0.33 && (r.r2 || 0) >= 0.8 && yearsOk(r);
const med = (a) => { const b = a.filter((v) => v != null).slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
const qtl = (a, q) => { const b = a.filter((v) => v != null).slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * (b.length - 1)))] : null; };

const c2 = p((r) => r.pozAy >= 0.6);
const c3 = p((r) => r.top1Ay != null && r.top1Ay <= 0.33);
const c4 = p((r) => r.top5Gun != null && r.top5Gun <= 0.4);
const c5 = p((r) => (r.r2 || 0) >= 0.8);
const c6 = p(yearsOk);
const hom = rows.filter((r) => r.hom).length;
const oneMiss = pos.filter((r) => r.eksik.length === 1);
const r5 = rows.filter((r) => otherOk(r) && r.rem5 > 0).length;
const r10 = rows.filter((r) => otherOk(r) && r.rem10 > 0).length;
const r20 = rows.filter((r) => otherOk(r) && r.rem20 > 0).length;
const t5 = pos.map((r) => r.top5Gun).filter((v) => v != null);

const pct = (v, d = 0) => (v * 100).toFixed(d) + '%';
const rowLine = (i, name, thr, pass, tot) =>
  `<tr><td>${i}</td><td>${name}</td><td><code>${thr}</code></td><td class="num"><b>${pass}</b></td><td class="num">${pct(pass / tot)}</td></tr>`;

const critTable = [
  rowLine(1, 'Net kâr', 'son / ilk − 1 &gt; 0', pos.length, pos.length),
  rowLine(2, 'Pozitif ay oranı', '≥ %60', c2, pos.length),
  rowLine(3, 'En büyük tek ay payı', '≤ netin %33', c3, pos.length),
  rowLine(4, 'En iyi %5 gün payı', '≤ netin %40', c4, pos.length),
  rowLine(5, 'Doğrusallık (R²)', '≥ 0,80', c5, pos.length),
  rowLine(6, 'Tam yıllar (2023–25)', 'her biri &gt; 0', c6, pos.length),
].join('');

const missDist = [1, 2, 3, 4, 5].map((k) => [k, pos.filter((r) => r.eksik.length === k).length]);
const missTotal = missDist.reduce((s, x) => s + x[1], 0);

const payload = JSON.stringify({
  gen: H.gen, rows, kpi: E.kpis, byTf: E.byTf,
  summary: { total: rows.length, pos: pos.length, hom, oneMiss: oneMiss.length, c2, c3, c4, c5, c6, r5, r10, r20, med5: med(t5), q1: qtl(t5, 0.25), q3: qtl(t5, 0.75), min5: qtl(t5, 0), max5: qtl(t5, 1) },
}).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');

const css = `
.nav{position:sticky;top:0;z-index:30;display:flex;gap:4px;flex-wrap:wrap;align-items:center;padding:8px 22px;background:rgba(14,17,23,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.nav b{color:var(--acc);font-size:12px;margin-right:8px;letter-spacing:.5px}
.nav a{color:var(--dim);font-size:12.5px;padding:5px 10px;border-radius:8px}
.nav a:hover{background:#1c2332;color:var(--tx)}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:12px;margin:10px 0}
.bar{display:grid;grid-template-columns:200px 1fr 78px;align-items:center;gap:10px;font-size:12.5px;margin:4px 0}
.bar .tr{height:12px;background:#232e46;border-radius:7px;overflow:hidden}
.bar .fl{height:100%;background:linear-gradient(90deg,#3fbf7f,#6ea8fe);border-radius:7px}
.bar .fl.warn{background:linear-gradient(90deg,#f4b942,#ef5b5b)}
.callout{border-left:3px solid var(--warn);background:#201d13;padding:12px 15px;border-radius:9px;font-size:13px;margin:12px 0;line-height:1.5}
.callout b{color:#ffd479}
table.hm td{padding:3px 2px;text-align:center;font-size:11px;border:1px solid #1d2434;min-width:46px;font-variant-numeric:tabular-nums}
table.hm th{font-size:11px;color:var(--dim);padding:4px;text-align:center}
table.near td,table.near th{white-space:nowrap}
table.near tbody tr{cursor:pointer}
table.near tbody tr:hover td{background:#1d263a}
.tag{display:inline-block;padding:1px 7px;border-radius:6px;font-size:10.5px;background:#232e46;color:#b9c6df}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:0}
`;

const nav = `<nav class="nav"><b>FİLTRE LAB.</b>
<a href="#kpis">Özet</a><a href="#matris">Isı Matrisi</a><a href="#kazananlar">Öne Çıkanlar</a>
<a href="#lig">Filtre Ligi</a><a href="#homojenlik">Homojenlik</a><a href="#veri">Veri &amp; Kapsam</a>
<a href="#kurtarilamayan">Kurtarılamayanlar</a><a href="#yontem">Yöntem</a><a href="#filtreler">Katalog</a></nav>`;

const kpiCard = `<div class="kpi warn"><div class="v">${hom} / 6</div><div class="l">Homojen durum (tüm ölçütler)</div><div class="s">${oneMiss.length} durum 5/6 — yalnızca gün yoğunlaşması</div></div>`;

const sections = `
  <h2 id="homojenlik">Homojenlik — "Kâr birkaç güne mi bağlı?"</h2>
  <div class="note">${rows.length.toLocaleString('tr-TR')} durum (593 hücre × temel + en iyi 3 filtreli varyant) için günlük portföy eğrisi üzerinden altı ölçüt. <b>Homojen</b> = altısının tamamı. Ölçüm: eşit ağırlıklı portföy, 2022-08-01 → 2026-09-08.</div>
  <div class="grid3" id="homStats"></div>
  <h3>Ölçütler ve geçiş oranları <span class="dim" style="font-size:12px">(yalnız net pozitif ${pos.length.toLocaleString('tr-TR')} durum)</span></h3>
  <div class="mw" style="max-height:none;max-width:980px"><table class="tbl">
  <thead><tr><th>#</th><th>Ölçüt</th><th>Eşik</th><th class="num">Geçen</th><th class="num">Oran</th></tr></thead>
  <tbody>${critTable}</tbody></table></div>

  <div class="callout">
    <b>Neden 6/6 = 0?</b> Dördüncü ölçüt "en iyi %5 gün" = yaklaşık <b>75 gün</b> (1.500 günlük grid). Pozitif durumlarda bu 75 günün kâr payı: en düşük <b>${pct(qtl(t5, 0))}</b>, medyan <b>${pct(med(t5))}</b>, çeyrekler <b>${pct(qtl(t5, 0.25))}–${pct(qtl(t5, 0.75))}</b>, en yüksek <b>${pct(qtl(t5, 1))}</b>.
    Günlük kripto getirilerinde bu yoğunlaşma yapısaldır: %40 eşiği hiçbir trend sisteminin ulaşamayacağı bir "neredeyse deterministik günlük getiri" düzeyi istiyor.
    Bu yüzden 0 sonucu "hiçbir strateji homojen değil" değil, <b>eşiğin kripto için kalibre edilmediğini</b> gösteriyor. Aşağıdaki dayanıklılık testi bu boşluğu doldurur.
  </div>

  <h3>En iyi %5 gün payı dağılımı <span class="dim" style="font-size:12px">(pozitif durumlar)</span></h3>
  <div class="bars" id="distBars"></div>

  <h3>Saçılım — R² × en iyi %5 gün payı</h3>
  <canvas id="scatter" width="1000" height="440" style="width:100%;max-width:1000px;background:#101522;border:1px solid var(--line);border-radius:12px"></canvas>
  <div class="note"><span class="dot" style="background:#3fbf7f"></span>Diğer beş ölçütü geçen ${oneMiss.length} durum &nbsp;·&nbsp; <span class="dot" style="background:#5b6478"></span>diğer pozitifler &nbsp;·&nbsp; <span class="dot" style="background:#ef5b5b"></span>kesikli çizgiler: eşikler (R² 0,80 ve top5 %40). Y ekseni %500'de kırpılmıştır.</div>

  <h3>Dayanıklılık testi — "en iyi N günü çıkar, hâlâ kârlı mı?"</h3>
  <div class="grid3" id="robust"></div>
  <div class="note">Diğer beş ölçüt aynı tutuldu; yalnızca 4. ölçüt yerine "en iyi N gün çıkarıldığında toplam kâr &gt; 0" testi uygulandı. 93 adayın tamamı ilk 5 günü, 78'i ilk 10 günü, 45'i ilk 20 günü çıkarınca da pozitif kalıyor.</div>

  <h3>Eşiğe yakın adaylar — yalnızca 4. ölçüt eksik (${oneMiss.length} durum)</h3>
  <div class="controls"><input type="search" id="nearQ" placeholder="Ara: strateji / tf / varyant…"><span class="dim" style="font-size:12px">Satıra tıklayın → aylık ısı tablosu</span></div>
  <div class="mw" style="max-height:62vh"><table class="tbl near" id="nearTbl"></table></div>
  <div id="heatDetail" class="det"><div class="card dim">Aylık ısı tablosu için bir aday seçin.</div></div>

  <h2 id="veri">Veri, Kapsam ve Doğrulama</h2>
  <div class="card">
    <div class="grid3">
      <div><div class="kv">
        <span class="k">Evren</span><span><b>520</b> USDT-M perpetual</span>
        <span class="k">Eski / yeni</span><span>58 + <b>462</b></span>
        <span class="k">Aday havuzu</span><span>525 aktif − 58 eski − USDC = 466</span>
        <span class="k">Dışlanan</span><span>4 (pencere sonrası listelenen)</span>
        <span class="k">Veri penceresi</span><span>2022-08-01 → 2026-08-31</span>
        <span class="k">Grid</span><span>… → 2026-09-08</span>
      </div></div>
      <div><div class="kv">
        <span class="k">Kaynak</span><span>Binance Vision aylık zip</span>
        <span class="k">TF</span><span>5m · 15m · 1h · 4h · 1d (1w türetilir)</span>
        <span class="k">Kline dosyası</span><span>55.865 / 55.870 (5 × 404)</span>
        <span class="k">Funding</span><span>462 sembol</span>
        <span class="k">Eksik</span><span>TUSDT 1 ay (5 tf)</span>
      </div></div>
      <div><div class="kv">
        <span class="k">Motor doğrulama</span><span><b>600 / 600</b> birebir</span>
        <span class="k">Günlük denetim</span><span>127.495 nokta · 0 uyuşmazlık</span>
        <span class="k">Varyant denetimi</span><span>1.770 varyant · 0 uyuşmazlık</span>
        <span class="k">Bin denetimi</span><span>0 bozuk</span>
        <span class="k">Tek filtre / kombo</span><span>38.368 / 10.103</span>
      </div></div>
    </div>
    <p class="note" style="margin-top:12px"><b>Dışlanan 4 sembol:</b> MARSCOINUSDT (2026-09-01), PONSUSDT ve 哈基米USDT (2026-09-06), CTUSDT (2026-10-01) — veri penceresi bittikten sonra listelendi.
    <b>1w notu:</b> 60 haftadan kısa geçmişli semboller 1w hücresinde atlanır (13 sembol-tf atlaması; hata değil, metodoloji sınırı).</p>
    <p class="note"><b>Dürüstlük sınırları:</b> (1) Evren yalnız bugün işlem gören paritelerden oluşur → hayatta kalma yanlılığı. (2) 462 yeni coinin çoğu kısa geçmişli; eşit ağırlıklı portföy ortalaması seyreltir. (3) Sonuçlar 2022-08 → 2026-09 dönemine özgüdür; parametre optimizasyonu yapılmamıştır. (4) Eğitim amaçlıdır, yatırım tavsiyesi değildir.</p>
    ${LITE ? '<p class="note"><b>Bu çevrimiçi sürümde</b> ' + (SLIM ? 'dosya boyutu için hücre başına sembol ısısı yer almaz; matris, filtre ligi, homojenlik ve tüm özet bölümler tamdır. Tam sürüm yerelde: <code>DASHBOARD_MASTER.html</code>.' : 'her hücrenin sembol ısısı en iyi/en kötü 25 sembolle sınırlandırıldı. Tam sürüm yerelde: <code>DASHBOARD_MASTER.html</code>.') + '</p>' : ''}
  </div>
`;

const script = `
<script id="HDATA" type="application/json">${payload}</script>
<script>
(function(){
  var D = JSON.parse(document.getElementById('HDATA').textContent);
  var rows = D.rows, S = D.summary;
  var pos = rows.filter(function(r){ return r.net > 0; });
  var $ = function(s){ return document.querySelector(s); };
  var fP = function(v,d){ d = d==null?0:d; return v==null?'—':(v*100).toFixed(d)+'%'; };
  var fS = function(v,d){ d = d==null?0:d; return v==null?'—':(v>=0?'+':'')+(v*100).toFixed(d)+'%'; };
  var fN = function(v){ return v==null?'—':Number(v).toLocaleString('tr-TR'); };
  var yearsOk = function(r){ return r.y23!=null && r.y24!=null && r.y25!=null && r.y23>0 && r.y24>0 && r.y25>0; };
  var otherOk = function(r){ return r.net>0 && r.pozAy>=0.6 && r.top1Ay!=null && r.top1Ay<=0.33 && (r.r2||0)>=0.8 && yearsOk(r); };
  var esc = function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); };

  function card(cls, val, lab, sub){
    var c = document.createElement('div'); c.className = 'kpi ' + cls;
    c.innerHTML = '<div class="v">' + val + '</div><div class="l">' + lab + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '');
    return c;
  }
  (function(){
    var h = $('#homStats');
    h.appendChild(card('acc', fN(S.total), 'İncelenen durum', '593 hücre × temel + 3 varyant'));
    h.appendChild(card('pos', fN(S.pos), 'Net pozitif durum', 'portföy eğrisi neti > 0'));
    h.appendChild(card('warn', S.hom + ' / 6', 'Homojen (tüm ölçütler)', 'altı ölçütü birlikte geçen'));
    h.appendChild(card('acc', fN(S.oneMiss), 'Tek ölçüt eksik', 'tamamı yalnızca top5 gün ölçütünde'));
  })();

  // ---- dağılım çubukları
  (function(){
    var host = $('#distBars');
    var buckets = [['≤ %100', function(v){return v<=1;}],['%100–150', function(v){return v>1&&v<=1.5;}],['%150–200', function(v){return v>1.5&&v<=2;}],['%200–300', function(v){return v>2&&v<=3;}],['%300–500', function(v){return v>3&&v<=5;}],['> %500', function(v){return v>5;}]];
    var vals = pos.map(function(r){return r.top5Gun;}).filter(function(v){return v!=null;});
    var max = 1; buckets.forEach(function(b){ var k = vals.filter(b[1]).length; if(k>max) max=k; });
    buckets.forEach(function(b){
      var k = vals.filter(b[1]).length;
      var d = document.createElement('div'); d.className='bar';
      d.innerHTML = '<span class="dim">' + b[0] + '</span><div class="tr"><div class="fl' + (b[0].indexOf('≤')===0?' warn':'') + '" style="width:' + (100*k/max) + '%"></div></div><span class="num">' + fN(k) + '</span>';
      host.appendChild(d);
    });
  })();

  // ---- saçılım
  (function(){
    var cv = $('#scatter'), ctx = cv.getContext('2d');
    var W = 1000, Hh = 440, ml = 62, mr = 18, mt = 18, mb = 48;
    var DPR = window.devicePixelRatio || 1;
    cv.width = W*DPR; cv.height = Hh*DPR; cv.style.height = Hh + 'px';
    ctx.scale(DPR, DPR);
    ctx.fillStyle = '#101522'; ctx.fillRect(0,0,W,Hh);
    var X = function(v){ return ml + Math.max(0,Math.min(1,v))*(W-ml-mr); };
    var Y = function(v){ return mt + (1-Math.max(0,Math.min(5,v))/5)*(Hh-mt-mb); };
    // grid
    ctx.strokeStyle = '#1e2739'; ctx.lineWidth = 1; ctx.font = '11px system-ui'; ctx.fillStyle = '#93a0b8';
    for (var i=0;i<=5;i++){ var x=X(i/5); ctx.beginPath(); ctx.moveTo(x,mt); ctx.lineTo(x,Hh-mb); ctx.stroke(); ctx.fillText((i/5).toFixed(1), x-10, Hh-mb+16); }
    for (var j=0;j<=5;j++){ var y=Y(j); ctx.beginPath(); ctx.moveTo(ml,y); ctx.lineTo(W-mr,y); ctx.stroke(); ctx.fillText('%'+(j*100), 16, y+4); }
    ctx.fillText('R²', (W+ml)/2-6, Hh-10);
    ctx.save(); ctx.translate(14,(Hh)/2+40); ctx.rotate(-Math.PI/2); ctx.fillText('en iyi %5 günün kâr payı',0,0); ctx.restore();
    // threshold lines
    ctx.setLineDash([6,5]); ctx.strokeStyle = '#ef5b5b'; ctx.lineWidth = 1.4;
    var xT = X(0.8); ctx.beginPath(); ctx.moveTo(xT,mt); ctx.lineTo(xT,Hh-mb); ctx.stroke();
    var yT = Y(0.4); ctx.beginPath(); ctx.moveTo(ml,yT); ctx.lineTo(W-mr,yT); ctx.stroke();
    ctx.setLineDash([]);
    // points
    var pts = [];
    for (var k=0;k<rows.length;k++){ var r=rows[k]; if(r.net<=0 || r.r2==null || r.top5Gun==null) continue; pts.push(r); }
    // gray first
    for (var a=0;a<pts.length;a++){ var r1=pts[a]; if(otherOk(r1)) continue; ctx.fillStyle='rgba(120,132,158,.45)'; ctx.beginPath(); ctx.arc(X(r1.r2), Y(r1.top5Gun), 1.7, 0, 6.283); ctx.fill(); }
    for (var b=0;b<pts.length;b++){ var r2=pts[b]; if(!otherOk(r2)) continue; ctx.fillStyle='rgba(63,191,127,.95)'; ctx.beginPath(); ctx.arc(X(r2.r2), Y(r2.top5Gun), 2.6, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = '#93a0b8'; ctx.font = '11px system-ui';
    ctx.fillText('kesikli: R²=0,80 · top5=%40', W-250, mt+16);
  })();

  // ---- dayanıklılık kartları
  (function(){
    var h = $('#robust');
    var mk = function(val, label, sub){ return card(val>0?'pos':'warn', fN(val) + ' durum', label, sub); };
    h.appendChild(mk(S.r5, 'En iyi 5 gün çıkarılınca kârlı', 'diğer 5 ölçüt aynı'));
    h.appendChild(mk(S.r10, 'En iyi 10 gün çıkarılınca kârlı', 'diğer 5 ölçüt aynı'));
    h.appendChild(mk(S.r20, 'En iyi 20 gün çıkarılınca kârlı', 'diğer 5 ölçüt aynı'));
  })();

  // ---- yakın adaylar tablosu
  var near = pos.filter(function(r){ return r.eksik.length===1 && r.eksik[0].indexOf('top5')===0; });
  var sortK = 'top5Gun', dir = 1, q = '';
  function val(r,k){
    if(k==='name') return (r.ad||'') + ' ' + r.id + ' ' + r.tf;
    return r[k];
  }
  function renderNear(){
    var arr = near.filter(function(r){ if(!q) return true; var s=((r.ad||'')+' '+r.id+' '+r.tf+' '+r.kind).toLowerCase(); return s.indexOf(q)>=0; });
    arr.sort(function(a,b){ var va=val(a,sortK), vb=val(b,sortK); if(va==null) va=1e9; if(vb==null) vb=1e9; if(typeof va==='string') return va.localeCompare(vb)*dir; return (va-vb)*dir; });
    var th = [['name','Strateji'],['tf','TF'],['kind','Varyant'],['n','İşlem'],['net','Net kâr'],['pozAy','Poz ay'],['top1Ay','Top1 ay'],['top5Gun','Top5 gün'],['r2','R²'],['dd','Maks DD'],['rem5','−5g'],['rem10','−10g'],['rem20','−20g']];
    var head = '<thead><tr><th>#</th>' + th.map(function(x){ var mark = (sortK===x[0]) ? (dir>0?' ▲':' ▼') : ''; return '<th data-k="' + x[0] + '" style="cursor:pointer">' + x[1] + mark + '</th>'; }).join('') + '</tr></thead>';
    var body = arr.map(function(r,i){
      return '<tr data-i="' + near.indexOf(r) + '"><td class="dim">' + (i+1) + '</td><td>' + esc(r.ad) + ' <span class="dim">' + r.id + '</span></td><td>' + r.tf + '</td><td>' + r.kind + '</td>' +
        '<td class="num">' + fN(r.n) + '</td><td class="num pos">' + fS(r.net) + '</td><td class="num">' + fP(r.pozAy) + '</td><td class="num">' + fP(r.top1Ay) + '</td>' +
        '<td class="num"><b>' + fP(r.top5Gun) + '</b></td><td class="num">' + (r.r2==null?'—':r.r2.toFixed(2)) + '</td><td class="num neg">' + fP(r.dd) + '</td>' +
        '<td class="num">' + (r.rem5?'✓':'—') + '</td><td class="num">' + (r.rem10?'✓':'—') + '</td><td class="num">' + (r.rem20?'✓':'—') + '</td></tr>';
    }).join('');
    var t = $('#nearTbl'); t.innerHTML = head + '<tbody>' + body + '</tbody>';
    t.querySelectorAll('th[data-k]').forEach(function(h){ h.addEventListener('click', function(){ var k=h.dataset.k; if(sortK===k) dir*=-1; else { sortK=k; dir=1; } renderNear(); }); });
    t.querySelectorAll('tbody tr').forEach(function(tr){ tr.addEventListener('click', function(){ showDetail(near[+tr.dataset.i]); }); });
  }
  $('#nearQ').addEventListener('input', function(e){ q = e.target.value.trim().toLowerCase(); renderNear(); });
  renderNear();

  function heatColor(v){
    if(v==null) return '#161b27';
    var t = Math.max(-1, Math.min(1, v/0.12));
    if(t>=0){ var g=Math.round(40+110*t), rr=Math.round(20+20*t), b=Math.round(45+40*t); return 'rgb('+rr+','+g+','+b+')'; }
    var u=-t; return 'rgb('+Math.round(60+140*u)+','+Math.round(25+15*u)+','+Math.round(30+20*u)+')';
  }
  function showDetail(r){
    var m = {}; (r.aylik||[]).forEach(function(x){ m[x[0]] = x[1]; });
    var years = {}; Object.keys(m).forEach(function(k){ years[k.slice(0,4)] = 1; });
    var ys = Object.keys(years).sort();
    var h = '<div class="card"><h3 style="margin-top:0">' + esc(r.ad) + ' <span class="dim" style="font-size:12px">(' + r.id + ' · ' + r.tf + ' · ' + r.kind + ')</span></h3>';
    h += '<div class="kv" style="max-width:720px">' +
      '<span class="k">Net kâr</span><span class="' + (r.net>=0?'pos':'neg') + '"><b>' + fS(r.net) + '</b></span>' +
      '<span class="k">Pozitif ay</span><span>' + fP(r.pozAy) + '</span>' +
      '<span class="k">En büyük ay payı</span><span>' + fP(r.top1Ay) + '</span>' +
      '<span class="k">En iyi %5 gün payı</span><span><b>' + fP(r.top5Gun) + '</b></span>' +
      '<span class="k">R²</span><span>' + (r.r2==null?'—':r.r2.toFixed(2)) + '</span>' +
      '<span class="k">Maks DD</span><span class="neg">' + fP(r.dd) + '</span>' +
      '<span class="k">Yıllar</span><span>2023 ' + fS(r.y23) + ' · 2024 ' + fS(r.y24) + ' · 2025 ' + fS(r.y25) + '</span>' +
      '</div>';
    h += '<h3>Aylık getiri ısısı</h3><div style="overflow:auto"><table class="tbl hm"><thead><tr><th>Yıl</th>';
    for (var mo=1; mo<=12; mo++) h += '<th>' + mo + '</th>';
    h += '<th>Yıl</th></tr></thead><tbody>';
    ys.forEach(function(y){
      h += '<tr><td class="dim">' + y + '</td>';
      var prod = 1, any = false;
      for (var mo2=1; mo2<=12; mo2++){
        var key = y + '-' + (mo2<10?'0':'') + mo2;
        var v = m[key];
        if (v==null){ h += '<td class="dim">—</td>'; continue; }
        any = true; prod *= (1+v);
        h += '<td style="background:' + heatColor(v) + '" title="' + key + '">' + (v>=0?'+':'') + (v*100).toFixed(1) + '%</td>';
      }
      h += '<td class="' + (prod-1>=0?'pos':'neg') + '">' + (any ? ((prod-1>=0?'+':'') + ((prod-1)*100).toFixed(1) + '%') : '—') + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
    $('#heatDetail').innerHTML = h;
    $('#heatDetail').scrollIntoView({behavior:'smooth', block:'nearest'});
  }
})();
</script>
`;

let out = base
  .replace('</style>', css + '</style>')
  .replace('</header>', '</header>\n' + nav)
  .replace('<div class="kpis" id="kpis"></div>', '<div class="kpis" id="kpis">' + kpiCard + '</div>')
  .replace('  <h2 id="yontem">Yöntem ve Sınırlar</h2>', sections + '\n  <h2 id="yontem">Yöntem ve Sınırlar</h2>')
  .replace('</body>', script + '\n</body>');

const outFile = SLIM ? 'DASHBOARD_ONLINE.html' : LITE ? 'DASHBOARD_MASTER_LITE.html' : 'DASHBOARD_MASTER.html';
await writeFile(join(BP, outFile), out);
console.log('[master] yazıldı: ' + outFile + ' (' + (out.length / 1048576).toFixed(1) + ' MB)');
