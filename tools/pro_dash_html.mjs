// pro_dash_html.mjs — Profesyonel Backtest & Filtre Laboratuvarı HTML üreticisi
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BP = 'D:/BigPlan';
const css = await readFile(join(BP, 'work_exp', 'pro_dash.css'), 'utf8');
const app = await readFile(join(BP, 'work_exp', 'pro_dash_app.js'), 'utf8');
const bundle = await readFile(join(BP, 'out', 'pro_bundle.json'), 'utf8');

// window.__PRO_DATA__ betiğini üret (tarayıcıda hızlı parse ve önbellekleme için)
await writeFile(join(BP, 'out', 'pro_data.js'), 'window.__PRO_DATA__=' + bundle + ';\n');

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Filtre Laboratuvarı PRO · Adım Adım Strateji & Kasa Analizi</title>
<style>
${css}
</style>
</head>
<body>
<div class="app">

  <!-- SOL PANEL: ADIM ADIM SEÇİM SİHİRBAZI -->
  <aside class="side">
    <div class="brand">
      <div class="brand-left">
        <div class="logo">FL</div>
        <div>
          <h1>Filtre Lab PRO</h1>
          <p>Adım Adım Strateji &amp; $10 Kasa Analizi</p>
        </div>
      </div>
      <div class="nav-links">
        <a class="nav-pill" href="/ultra">ULTRA 10x/15x</a>
        <a class="nav-pill" href="/homojenlik">Homojenlik</a>
      </div>
    </div>

    <div class="rule-banner">
      <b>✓ Pozitiflik Kuralı Aktif:</b> Hem toplam (2022–2026) hem de <b>2026 işlem başı ortalama getirisi negatif (≤ 0)</b> olan strateji/varyantlar elenmiştir.
    </div>

    <!-- ADIM 1: EVREN & TIMEFRAME FİLTRESİ -->
    <div class="step-box">
      <div class="step-head">
        <div class="step-title"><span class="step-num">1</span> Zaman Dilimi &amp; Evren</div>
      </div>
      <div class="sub-label">Timeframe (Zaman Dilimi) Filtresi</div>
      <div class="chips" id="tfChips"></div>

      <div class="sub-label">Hacim Evreni (5 Yıl Ort. USDT Hacmi)</div>
      <div class="chips" id="volChips"></div>

      <div style="display:grid;grid-template-columns:1.25fr 0.75fr;gap:8px;margin-top:6px">
        <div>
          <div class="sub-label">Kaldıraç Çarpanı</div>
          <div class="chips" id="levChips"></div>
        </div>
        <div>
          <div class="sub-label">Birim Gösterimi</div>
          <div class="chips" id="unitChips"></div>
        </div>
      </div>
    </div>

    <!-- ADIM 2: ÖNCE STRATEJİ SEÇ (TEK TEK İLERLE) -->
    <div class="step-box">
      <div class="step-head">
        <div class="step-title"><span class="step-num">2</span> Önce Strateji Seçin</div>
        <span class="stepper-pos" id="stepPos">1 / 42</span>
      </div>
      <div class="stepper-bar">
        <button class="btn-step" id="prevStrat">◀ Önceki Strateji</button>
        <span style="font-size:11px;color:var(--dim)">Tek Tek İncele</span>
        <button class="btn-step" id="nextStrat">Sonraki Strateji ▶</button>
      </div>
      <div class="search-row">
        <input class="input" type="search" id="qInput" placeholder="Strateji veya filtre ara...">
        <select class="select" id="sortSel">
          <option value="kasaAll">$10 Kasa (22–26) ↓</option>
          <option value="kasa2526">$10 Kasa (25–26) ↓</option>
          <option value="exp26">2026 $/İşlem ↓</option>
          <option value="pf">Profit Factor ↓</option>
          <option value="wr">Kazanma Oranı ↓</option>
        </select>
      </div>
      <div class="strat-list" id="stratList"></div>
    </div>

    <!-- ADIM 3: SEÇİLİ STRATEJİNİN TIMEFRAME & FİLTRESİ -->
    <div class="step-box">
      <div class="step-head">
        <div class="step-title"><span class="step-num">3</span> Strateji Timeframe &amp; Filtresi</div>
      </div>
      <div class="sub-label">Bu Stratejinin Uygun Timeframe'leri</div>
      <div class="chips" id="stratTfChips" style="margin-bottom:10px"></div>

      <div class="sub-label">Uygulanacak Filtre Varyantı</div>
      <div class="var-list" id="varList"></div>
    </div>
  </aside>

  <!-- SAĞ ANA EKRAN -->
  <main class="main">

    <!-- BÖLÜM NAVİGASYONU -->
    <nav class="sec-nav">
      <div class="sec-links">
        <a class="sec-link" href="#sec-filter">1. Filtre Etkisi &amp; Switch</a>
        <a class="sec-link" href="#sec-cash">2. $10 Kasa Line (22–26 &amp; 25–26)</a>
        <a class="sec-link" href="#sec-daily">3. Gün Gün Kâr/Zarar</a>
        <a class="sec-link" href="#sec-period">4. Yıl · Çeyrek · Mevsim</a>
        <a class="sec-link" href="#sec-dur">5. Kalma Süresi (1-3g..65g)</a>
        <a class="sec-link" href="#sec-extra">6. Heatmap &amp; İleri Analiz</a>
      </div>
      <span style="font-size:12px;color:var(--dim)">Python Plotly 6.8 + NumPy/SciPy Motoru</span>
    </nav>

    <!-- ÜST STRATEJİ ÖZETİ + SAĞDAKİ SWITCH BOX -->
    <div class="hero-grid">
      <div class="strat-hero">
        <div>
          <div class="strat-hero-top">
            <div>
              <h2 id="selTitle">—</h2>
              <div class="sub" id="selSub">—</div>
            </div>
          </div>
          <div class="badges" id="selBadges"></div>
        </div>
        <div class="rules-bar" id="selRules"></div>
      </div>

      <!-- SAĞDAKİ UYGULANACAK FİLTRE SWITCH BOX -->
      <div class="switch-box-card">
        <div class="switch-box-head">
          <h3>🎛️ Uygulanacak Filtre Switch Box</h3>
          <span style="font-size:11.5px;color:var(--tx-sec)">Aç/Kapat ile Anlık Simülasyon</span>
        </div>
        <div class="switch-list" id="switchList"></div>
        <div class="preset-row" id="presetRow"></div>
        <div class="delta-strip" id="deltaStrip"></div>
      </div>
    </div>

    <!-- KPI KARTLARI -->
    <div class="kpis" id="kpis"></div>

    <!-- BÖLÜM 1: FİLTRELERİN ETKİSİ (2 GRAFİK) -->
    <section class="section-block" id="sec-filter">
      <div class="section-header">
        <div>
          <h2>1. Seçili Stratejiye Uygulanacak Filtrelerin Etkisi</h2>
          <p>Filtresiz (Temel) strateji ile tekil filtrelerin ve birleşik varyantların $10 kasa eğrisi ve brüt kâr/zarar üzerindeki doğrudan etkisi.</p>
        </div>
      </div>
      <div class="chart-grid-2">
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>Filtre Etkisi 1 · $10 Kasa Eğrisi Karşılaştırması</h3>
              <p>Filtresiz (Temel, kırmızı noktalı) vs Tekil Filtreler vs Varyantlar (0$'dan başlayarak)</p>
            </div>
          </div>
          <div id="cFilterCurve" class="plot-box"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>Filtre Etkisi 2 · Brüt Kâr (Yeşil) / Zarar (Kırmızı) &amp; Net Kasa</h3>
              <p>Her bir filtrenin brüt kârı nasıl koruyup brüt zararı nasıl kestiğini gösterir</p>
            </div>
          </div>
          <div id="cFilterBars" class="plot-box"></div>
        </div>
      </div>
    </section>

    <!-- BÖLÜM 2: İKİ FARKLI $10 KASA LINE GRAFİĞİ (TÜM DÖNEM & SADECE 2025-2026) -->
    <section class="section-block" id="sec-cash">
      <div class="section-header">
        <div>
          <h2>2. $10 Sabit İşlem Kasası Line Grafikleri (0$'dan Başlayan Kasa Durumu)</h2>
          <p>Her işleme sabit 10 $ ile girildiği varsayılıp kasayı 0 dolardan başlatarak kasanın zaman içindeki gerçek birikimli durumunu gösterir.</p>
        </div>
      </div>
      <div class="chart-grid-2">
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>Line 1 · Tüm Dönem $10 İşlem Kasası (2022–2026)</h3>
              <p>İlk günden (2022-08-01 = 0$) son güne (2026-09-08) kasanın durumu ve zirve çizgisi</p>
            </div>
          </div>
          <div id="cCashAll" class="plot-box"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>Line 2 · Sadece 2025–2026 Özel $10 İşlem Kasası</h3>
              <p>01.01.2025 tarihinde kasayı 0$'dan başlatıp sadece 2025 ve 2026 yıllarındaki kasa gelişimi</p>
            </div>
          </div>
          <div id="cCash2526" class="plot-box"></div>
        </div>
      </div>
    </section>

    <!-- BÖLÜM 3: GÜN GÜN KÂR VE ZARAR HİSTOGRAMLARI (TÜM DÖNEM & 2025-2026) -->
    <section class="section-block" id="sec-daily">
      <div class="section-header">
        <div>
          <h2>3. Gün Gün Kâr (Yeşil Yukarı) ve Zarar (Kırmızı Aşağı) Histogramları</h2>
          <p>Her gün için o gün kapanan işlemlerin toplam kârı yukarı yeşil bar, toplam zararı aşağı kırmızı bar olarak aynı anda gösterilir.</p>
        </div>
      </div>
      <div class="chart-grid-2">
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>Gün Gün Kâr / Zarar Histogramı · Tüm Dönem (2022–2026)</h3>
              <p>1.500 gün boyunca her günün eşzamanlı brüt kârı (+yeşil) ve brüt zararı (-kırmızı)</p>
            </div>
          </div>
          <div id="cDailyAll" class="plot-box"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>Gün Gün Kâr / Zarar Histogramı · Sadece 2025–2026</h3>
              <p>2025 ve 2026 yıllarına yakınlaştırılmış günlük yeşil kâr ve kırmızı zarar barları</p>
            </div>
          </div>
          <div id="cDaily2526" class="plot-box"></div>
        </div>
      </div>
    </section>

    <!-- BÖLÜM 4: YIL YIL, ÇEYREK ÇEYREK VE MEVSİM MEVSİM KÂR / ZARAR HİSTOGRAMLARI -->
    <section class="section-block" id="sec-period">
      <div class="section-header">
        <div>
          <h2>4. Yıl Yıl, Çeyrek Çeyrek ve Mevsim Mevsim Kâr / Zarar Histogramları</h2>
          <p>Her dönemde (2026 dahil) brüt kâr yukarı yeşil bar, brüt zarar aşağı kırmızı bar ve net kâr sarı elmas çizgi olarak aynı anda gösterilir.</p>
        </div>
      </div>
      <div class="chart-grid-2">
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>Yıl Yıl Kâr ve Zarar Histogramı (2022 – 2026)</h3>
              <p>2022, 2023, 2024, 2025 ve 2026 yıllarının yeşil kâr / kırmızı zarar ve net kâr barları</p>
            </div>
          </div>
          <div id="cYearly" class="plot-box"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>Mevsim Mevsim Kâr ve Zarar Histogramı</h3>
              <p>Kış, İlkbahar, Yaz ve Sonbahar dönemlerinde yukarı yeşil kâr ve aşağı kırmızı zarar</p>
            </div>
          </div>
          <div id="cSeasonal" class="plot-box"></div>
        </div>
      </div>
      <div class="chart-grid-1">
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>Çeyrek Çeyrek (Quarter) Kâr ve Zarar Histogramı</h3>
              <p>Her çeyrekte yukarı yeşil kâr, aşağı kırmızı zarar ve sarı elmas net kâr</p>
            </div>
            <div class="chips" id="qtrToggle">
              <button class="chip on" data-qtr="timeline">Takvim Çeyrekleri (2022 Q3 → 2026 Q3)</button>
              <button class="chip" data-qtr="agg">Toplam Çeyrekler (Q1 · Q2 · Q3 · Q4)</button>
            </div>
          </div>
          <div id="cQuarterly" class="plot-box"></div>
        </div>
      </div>
    </section>

    <!-- BÖLÜM 5: BİR İŞLEMDE TOPLAM KALMA SÜRELERİ (1-3G, 3-7G, 7-14G, 14-35G, 35-65G, 65+G) -->
    <section class="section-block" id="sec-dur">
      <div class="section-header">
        <div>
          <h2>5. Bir İşlemde Toplam Kalma Süreleri &amp; Getiri Dağılımı</h2>
          <p>&lt;1 gün, 1–3 gün, 3–7 gün, 7–14 gün, 14–35 gün, 35–65 gün ve 65+ gün dilimlerinde kâr/zarar ve işlem adetleri.</p>
        </div>
      </div>
      <div class="chart-grid-2">
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>İşlemde Toplam Kalma Süreleri (1–3g · 3–7g · 7–14g · 14–35g · 35–65g)</h3>
              <p>Kalma süresi dilimlerine göre yeşil kâr / kırmızı zarar veya işlem sayısı &amp; kazanma oranı</p>
            </div>
            <div class="chips" id="durToggle">
              <button class="chip on" data-dur="pnl">Yeşil Kâr / Kırmızı Zarar</button>
              <button class="chip" data-dur="count">İşlem Sayısı &amp; Kazanma Oranı %</button>
            </div>
          </div>
          <div id="cDuration" class="plot-box"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>İşlem Başına Getiri Dağılımı &amp; Kuyruk Asimetrisi</h3>
              <p>Getiri dilimlerine (&lt;-20% .. &gt;+20%) göre işlem sayısı ve net kasa katkısı</p>
            </div>
          </div>
          <div id="cRetDist" class="plot-box"></div>
        </div>
      </div>
    </section>

    <!-- BÖLÜM 6: YENİ HİSTOGRAM, HEATMAP VE LINE GRAFİK FİKİRLERİMİZ (UYGULAMALI) -->
    <section class="section-block" id="sec-extra">
      <div class="section-header">
        <div>
          <h2>6. İleri Kantitatif Analiz: Heatmap, Sualtı Düşüş &amp; Coin Diverging Grafikleri</h2>
          <p>Stratejinin istikrarını, risk derinliğini ve zaman/coin yoğunlaşmasını ölçmek için eklediğimiz 4 yeni profesyonel grafik.</p>
        </div>
      </div>

      <div class="ideas-grid">
        <div class="idea-card">
          <h4>💡 Fikir 1: Yıl × Ay Kâr/Zarar Isı Haritası (Heatmap)</h4>
          <p>2022–2026 yıllarının 12 ayını tek bir matriste gösterir. Stratejinin kârının tek bir aya mı sıkıştığını yoksa her aya düzenli mi yayıldığını bir bakışta ortaya çıkarır.</p>
        </div>
        <div class="idea-card">
          <h4>💡 Fikir 2: $10 Kasa Sualtı Düşüş (Underwater Drawdown) &amp; 90G Tempo</h4>
          <p>Kasanın gördüğü en yüksek zirveden dolar bazında ne kadar geri çekildiğini (-$) ve son 90 günlük aylık kazanç temposunun 2025–2026'da güçlenip güçlenmediğini gösterir.</p>
        </div>
        <div class="idea-card">
          <h4>💡 Fikir 3: Haftanın Günleri &amp; Giriş Saatleri Kâr/Zarar Barları</h4>
          <p>Hangi günlerde (Pzt–Paz) ve hangi 3 saatlik dilimlerde açılan işlemlerin yeşil kâr veya kırmızı zarar ürettiğini aynı barda karşılaştırır.</p>
        </div>
        <div class="idea-card">
          <h4>💡 Fikir 4: Coin Bazlı Diverging Kâr/Zarar Aynası</h4>
          <p>En çok katkı veren ve en çok zarar yazan coinlerde sağa doğru yeşil brüt kâr, sola doğru kırmızı brüt zararı ve sarı elmas net katkıyı aynı satırda gösterir.</p>
        </div>
      </div>

      <div class="chart-grid-2">
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>Yıl × Ay Net Kasa Isı Haritası (Monthly Heatmap)</h3>
              <p>Her hücrede o ayın net katkısı; yeşil aylar kârlı, kırmızı aylar zararlı dönemleri gösterir</p>
            </div>
          </div>
          <div id="cHeatmapMonth" class="plot-box"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>$10 Kasa Sualtı Düşüş (Drawdown) &amp; 90 Günlük Tempo Line Grafiği</h3>
              <p>Kırmızı alan: kasa zirvesinden dolar çekilme · Mavi çizgi: 90 günlük hareketli aylık tempo</p>
            </div>
          </div>
          <div id="cUnderwater" class="plot-box"></div>
        </div>
      </div>

      <div class="chart-grid-2">
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>Haftanın Günleri &amp; Giriş Saatleri Kâr / Zarar Histogramı</h3>
              <p>Gün veya 3 saatlik giriş dilimine göre yukarı yeşil kâr ve aşağı kırmızı zarar</p>
            </div>
            <div class="chips" id="dowToggle">
              <button class="chip on" data-dow="dow">Haftanın Günleri (Pzt–Paz)</button>
              <button class="chip" data-dow="hour">Giriş Saatleri (00–24 UTC)</button>
            </div>
          </div>
          <div id="cDowHour" class="plot-box"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>Coin Bazlı Kâr (Sağa Yeşil) / Zarar (Sola Kırmızı) Grafiği</h3>
              <p>En yüksek ve en düşük katkılı coinlerde brüt kâr, brüt zarar ve net kasa etkisi</p>
            </div>
          </div>
          <div id="cCoin" class="plot-box"></div>
        </div>
      </div>
    </section>

    <footer>
      <b>Metodoloji ve Dürüstlük Notları:</b><br>
      1. <b>$10 Sabit İşlem Kasası:</b> Bileşik faiz patlaması yanılsamasını önlemek için her işleme sabit <b>10 $</b> (seçili kaldıraç L× ile ölçekli) girildiği varsayılır. Kasa 0 $'dan başlar; kapanan her kazanan işlem <code>+$10·r·L</code> ekler, her kaybeden işlem <code>-$10·|r|·L</code> düşer. Komisyon, kayma ve funding maliyetleri her işlemin net <code>r</code> getirisine dahildir.<br>
      2. <b>Pozitiflik Kuralı:</b> Hem tüm dönem (2022–2026) işlem başı ortalama getirisi hem de 2026 işlem başı ortalama getirisi pozitif olmayan adaylar elenmiştir.<br>
      3. <b>Uyarı:</b> Evren bugün işlem gören 520 Binance USDT-M sembolünden oluşur (hayatta kalma yanlılığı). Bu ekran eğitim ve kantitatif araştırma amaçlıdır; <b>yatırım tavsiyesi değildir</b>.
    </footer>

  </main>
</div>

<script src="/plotly.min.js"></script>
<script src="/pro_data.js"></script>
<script>
${app}
</script>
</body>
</html>
`;

await writeFile(join(BP, 'BACKTEST93.html'), html);
console.log('[pro_dash_html] yazıldı: BACKTEST93.html ·', (Buffer.byteLength(html) / 1024).toFixed(1), 'KB');
