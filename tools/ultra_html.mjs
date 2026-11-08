// ultra_html.mjs — ULTRA.html üretir (tek dosya, bağımlılıksız)
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BP } from './core.mjs';

const data = await readFile(join(BP, 'out', 'ultra_data.json'), 'utf8');
const css = await readFile(join(BP, 'work_exp', 'ultra.css'), 'utf8');
const app = await readFile(join(BP, 'work_exp', 'ultra_app.js'), 'utf8');
const json = data.replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>ULTRA · 10x/15x Dayanıklılık Senaryosu</title>
<style>${css}</style>
</head>
<body>
<div class="wrap">

  <header class="hero">
    <div class="kicker"><span class="dot"></span> ULTRA DAYANIKLILIK · 10x / 15x</div>
    <h1>93 aday → 6 hayatta → <span>5 strateji</span></h1>
    <p class="lead">Bu ekran bir <b>parametre optimizasyonu değil</b>; 93 adayın <b>10x/15x kaldıraç</b>, <b>7 likidite evreni</b>, <b>4 yıl</b> ve <b>4 BTC rejimi</b> altında çok değişkenli dayanıklılık taramasıdır. Amaç: kaldıraçta çökmeyen, tasfiye olmayan ve homojenliğe en yakın <b>5 farklı temel stratejiyi</b> ayırmak.</p>
    <div class="meta">
      <span class="pill green"><b>93</b> aday · 5/6 homojenlik ön filtresi</span>
      <span class="pill"><b>520</b> coin · 2022-08 → 2026-09</span>
      <span class="pill"><b>fees + funding</b> dahil</span>
      <span class="pill gold"><b>10x / 15x</b> günlük bileşik</span>
      <span class="pill red">parametre optimizasyonu yok</span>
    </div>
  </header>

  <div class="statgrid">
    <div class="stat"><div class="l">Aday konfigürasyon</div><div class="v" id="sTotal">—</div><div class="s">5/6 homojenlik ön filtresinden geçen</div></div>
    <div class="stat"><div class="l">Hayatta kalan</div><div class="v g" id="sSurv">—</div><div class="s">5 kart + 1 MFI aile alternatifi</div></div>
    <div class="stat gold"><div class="l">Farklı strateji</div><div class="v" id="sDistinct">—</div><div class="s">aynı ailenin en iyi konfigürasyonu</div></div>
    <div class="stat"><div class="l">En yüksek ULTRA</div><div class="v c" id="sBest">—</div><div class="s">100 üzerinden bileşik skor</div></div>
    <div class="stat red"><div class="l">10x tasfiye</div><div class="v r" id="sLiq">—</div><div class="s">93 aday içinde</div></div>
    <div class="stat"><div class="l">Coin evreni</div><div class="v" id="sUniverse">—</div><div class="s">4.09 yıllık likidite penceresi</div></div>
  </div>

  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>Senaryo: beş stres ekseni, yedi sert kapı</h2>
        <p>Kaldıraç, likidite, zaman, BTC rejimi ve uygulanabilirlik aynı anda taranır. Kapılar önceden sabitlendi; sonuçlara göre eşik değiştirilmedi.</p>
      </div>
      <span class="pill gold">93 → 6 → 5</span>
    </div>
    <div class="grid2">
      <div>
        <ul class="axes" id="axesList"></ul>
        <div class="weights" id="weightList"></div>
        <p class="note">Skor ağırlıkları: kaldıraç dayanıklılığı 35, homojenlik 25, hacim evreni 20, zaman/rejim 10, uygulanabilirlik 5, güvenilirlik 5. Sürekli metrikler 93 aday içinde yüzdelik sıraya çevrilir; böylece uç değerler tek başına skoru ele geçirmez.</p>
      </div>
      <div>
        <h2 style="font-size:15px;margin:0 0 4px">Hayatta kalma kapıları</h2>
        <p class="tiny dim" style="margin:0 0 10px">Her çubuk, o kapıyı tek başına geçen aday sayısını gösterir. Kapılar kesişir; hepsini geçen 6 konfigürasyon, 5 farklı temel stratejiye ait.</p>
        <div class="gates" id="gateList"></div>
      </div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>Seçilen 5 strateji · karar dinamiği ve 10x/15x performansı</h2>
        <p>Her kartta giriş/çıkış kuralları, filtre kapıları, kaldıraç metrikleri ve hacim evreni dayanıklılığı var. “Tüm dinamiği aç” ile yıl, rejim, hacim seti ve drawdown kırılımını gör.</p>
      </div>
      <span class="pill green">ana evrende 15x tasfiye yok</span>
    </div>
    <div class="topcards" id="topCards"></div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>Kaldıraç ve homojenlik haritası</h2>
        <p>Solda ilk 5'in kümülatif eğrisi (log ölçek), sağda 93 adayın top5 gün payı – 15x maks DD düzlemi. Orijinal %40 çizgisinin sağındaki tüm adaylar, 6. kriteri orijinal tanımda geçmiyor.</p>
      </div>
      <span class="pill">log ölçek · günlük kapanış</span>
    </div>
    <div class="grid2">
      <div class="chart-wrap">
        <div class="chart-head">
          <div><h3>Kümülatif eğri</h3><p>ilk 5 · tüm coin evreni · 1x başlangıç</p></div>
          <div class="seg" id="levSeg"><button data-lev="10" class="on">10x</button><button data-lev="15">15x</button></div>
        </div>
        <canvas id="eqChart" class="chart-canvas"></canvas>
        <div class="legend" id="eqLegend"></div>
        <div class="tip" id="eqTip"></div>
      </div>
      <div class="chart-wrap">
        <div class="chart-head">
          <div><h3>Homojenlik–risk haritası</h3><p>93 aday · top5 gün payı vs 15x maks DD</p></div>
        </div>
        <canvas id="scatterChart" class="chart-canvas scatter"></canvas>
        <div class="legend">
          <span class="li"><span class="sw" style="background:#ffd166"></span>İlk 5</span>
          <span class="li"><span class="sw" style="background:#3ddc97"></span>Hayatta</span>
          <span class="li"><span class="sw" style="background:#90a5b7"></span>Elendi</span>
        </div>
        <div class="tip" id="scatterTip"></div>
      </div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>Tam sıralama · 93 konfigürasyon</h2>
        <p>Varsayılan sıra: hayatta kalanlar önce, kendi içinde ULTRA skoru. “I+G” sütununa tıklayınca kalan yöntemler uygulanabilirlik + güvenilirlik puanına göre sıralanır. Satıra tıkla: tam detay.</p>
      </div>
      <span class="pill" id="tableCount">—</span>
    </div>
    <div class="toolbar">
      <div class="left">
        <div class="seg" id="bucketSeg">
          <button data-bucket="all" class="on">Tümü (93)</button>
          <button data-bucket="surv">Hayatta (6)</button>
          <button data-bucket="elim">Elendi (87)</button>
          <button data-bucket="top5">İlk 5</button>
          <button data-bucket="rest">Kalan (88)</button>
        </div>
        <input id="search" class="search" type="search" placeholder="Strateji, filtre, elenme nedeni ara…" autocomplete="off">
        <button class="btn" id="rankIG">Kalan 88'i I+G'ye göre sırala</button>
      </div>
      <div class="tiny dim">Sütun başlığı: sırala · satır: detay · I+G = impl + güvenilirlik (0–10)</div>
    </div>
    <div class="table-wrap">
      <table id="rankTable">
        <thead><tr>
          <th data-col="rank">Sıra</th>
          <th data-col="title">Strateji</th>
          <th data-col="tf">TF</th>
          <th data-col="net10">10x</th>
          <th data-col="dd10">10x DD</th>
          <th data-col="net15">15x</th>
          <th data-col="dd15">15x DD</th>
          <th data-col="eff15">15x verim</th>
          <th data-col="top5">Top5 gün</th>
          <th data-col="pozAy">Poz. ay</th>
          <th data-col="r2">R²</th>
          <th data-col="volPos">Hacim</th>
          <th data-col="impl">Impl.</th>
          <th data-col="rel">Güv.</th>
          <th data-col="implRel">I+G</th>
          <th data-col="total">ULTRA</th>
          <th data-col="status">Durum</th>
        </tr></thead>
        <tbody id="rankBody"></tbody>
      </table>
    </div>
    <div class="table-note">"Hayatta" = yedi sert kapının tamamı. “Elendi” satırları yine de sıralanır; kırmızı alt metin hangi kapıda elendiğini söyler. Top5 gün payı %100 üzerindeyse en iyi 5 günün katkısı toplam netten büyüktür; diğer günler net negatiftir. Orijinal ≤%40 kriterini bu evrendeki hiçbir aday geçmiyor; ilk 5, alt-10/BTC tanımlarını geçen 6 konfigürasyondan seçildi. “Kalan 88'i I+G'ye göre sırala” ilk 5 dışındaki tüm konfigürasyonları uygulanabilirlik + güvenilirlik puanına göre dizer; MFI aile alternatifi de bu 88'in içindedir.</div>
  </section>

  <div class="foot">
    <b>Yöntem ve veri notları.</b> 520 sembol, 2022-08-01 → 2026-09-08, günlük/4 saatlik kapanışlar; ücretler ve funding dahil. Hacim evreni: 5 yıllık ortalama yıllık USDT hacmine göre en likit 50/100/150/200/250/300; her set ayrı yeniden simüle edildi. Kaldıraç: günlük bileşik, <span class="mono">1 + L·r ≤ 0</span> tasfiye. 15x değerleri günlük kapanış bazlıdır; intraday likidasyon, pozisyon limiti, likidite kayması ve stop boşluğu modellenmez. Getiri serisi hayatta kalan coin evreni üzerinden eşit ağırlıklıdır; kısa geçmişli yeni coinler seyreltme yaratabilir. Rejim katkısı ortalama günlük getiri × 365'tir, bileşik eğri değildir. BTC 1d verisi 2026-08-30'da biter; son 9 gün taşınmıştır. Bu ekran eğitim/araştırma amaçlıdır, yatırım tavsiyesi değildir.
    <ul>
      <li><b>Neden 5 farklı strateji?</b> Aynı temel stratejinin ikinci konfigürasyonu ayrı bir yöntem sayılmadı; en iyi konfigürasyon seçildi, alternatifler tam sıralamada “aile alt.” etiketiyle duruyor.</li>
      <li><b>Neden hâlâ yüksek DD?</b> 15x kaldıraçta %44–89 maks DD bile ciddi bir risktir. Buradaki “dayanıklı”, 93 aday içinde en iyi hayatta kalma ve log-büyüme kombinasyonu anlamına gelir; mutlak güvenli anlamına gelmez.</li>
      <li><b>Neden parametre optimizasyonu değil?</b> Strateji parametreleri (MFI 14, HMA 20, UO 30/70, SMI 14/3, NVI EMA200) sabittir; taranan şey kaldıraç, likidite evreni, zaman ve rejim dayanıklılığıdır.</li>
    </ul>
  </div>
</div>

<div id="modal" class="modal" hidden>
  <div class="modal-bg" data-close></div>
  <div class="modal-card" role="dialog" aria-modal="true" aria-label="Yöntem detayı">
    <button class="modal-x" data-close aria-label="Kapat">×</button>
    <div class="modal-body" id="modalBody"></div>
  </div>
</div>

<script id="UD" type="application/json">${json}</script>
<script>${app}</script>
</body>
</html>`;

await writeFile(join(BP, 'ULTRA.html'), html);
console.log('[ultra_html] yazıldı: ULTRA.html · ' + (html.length / 1024 / 1024).toFixed(2) + ' MB');
