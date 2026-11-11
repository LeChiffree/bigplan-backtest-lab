// pro_dash_html.mjs — İkiye Bölünmüş (Sol: Tüm Yıllar | Sağ: Sadece 2026) PRO Dashboard üreticisi
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BP = 'D:/BigPlan';
const css = await readFile(join(BP, 'work_exp', 'pro_dash.css'), 'utf8');
const app = await readFile(join(BP, 'work_exp', 'pro_dash_app.js'), 'utf8');
const bundle = await readFile(join(BP, 'out', 'pro_bundle.json'), 'utf8');

await writeFile(join(BP, 'out', 'pro_data.js'), 'window.__PRO_DATA__=' + bundle + ';\n');

function splitRow(num, titleAll, title26, descAll, desc26, idAll, id26, boxClass = '') {
  return `
    <div class="split-row">
      <div class="chart-card left-card">
        <div class="chart-head">
          <div>
            <h3>${num ? num + '. ' : ''}${titleAll}</h3>
            <p>${descAll}</p>
          </div>
          <span class="tag-side all">TÜM YILLAR (22–26)</span>
        </div>
        <div id="${idAll}" class="plot-box ${boxClass}"></div>
      </div>
      <div class="chart-card right-card">
        <div class="chart-head">
          <div>
            <h3>${num ? num + '. ' : ''}${title26}</h3>
            <p>${desc26}</p>
          </div>
          <span class="tag-side y26">SADECE 2026</span>
        </div>
        <div id="${id26}" class="plot-box ${boxClass}"></div>
      </div>
    </div>`;
}

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Filtre Laboratuvarı PRO · Sol: Tüm Yıllar | Sağ: 2026 Karşılaştırmalı Analiz</title>
<style>
${css}
</style>
</head>
<body>

  <!-- SOL KONTROL PANELİ (1. Metot Seçici & 2. Zaman Dilimi Seçici) -->
  <aside class="side">
    <div class="brand">
      <div class="eyebrow">Backtest laboratuvarı</div>
      <div class="brand-left">
        <div class="logo">FL</div>
        <div>
          <h1>Filtre Lab PRO</h1>
          <p>Sol: Tüm Yıllar · Sağ: 2026</p>
        </div>
      </div>
      <div class="nav-links">
        <a class="nav-pill" href="/ultra">ULTRA</a>
        <a class="nav-pill" href="/homojenlik">Homojenlik</a>
      </div>
    </div>

    <div class="spec-badges">
      <div><b>✓ 24. 5dk Çıkış Çözümlemesi:</b> Üst TF işlemleri alt mumlarla sıraya konur.</div>
      <div><b>✓ 25. Aynı Mumda SL/TP:</b> İkisi aynı mumda görülürse korumacı şekilde SL önce uygulanır.</div>
      <div><b>✓ 26. Kaldıraçsız (1×):</b> Bütün sonuçlar azami 1× kaldıraçla hesaplanır.</div>
    </div>

    <!-- ADIM 1: ZAMAN DİLİMİ SEÇİCİ (2) & EVREN -->
    <div class="step-box">
      <div class="step-head">
        <div class="step-title"><span class="step-num">1</span> 2. Zaman Dilimi &amp; Evren</div>
      </div>
      <div class="sub-label">Zaman Dilimi Seçici (1h, 4h, 1d, 1w, 15m)</div>
      <div class="chips" id="tfChips"></div>

      <div class="sub-label">Hacim Evreni (5 Yıl Ort. USDT)</div>
      <div class="chips" id="volChips"></div>

      <div class="sub-label">Hesaplama Birimi (Azami 1× Kaldıraçsız)</div>
      <div class="chips" id="unitChips"></div>
    </div>

    <!-- ADIM 2: METOT SEÇİCİ (1) -->
    <div class="step-box">
      <div class="step-head">
        <div class="step-title"><span class="step-num">2</span> 1. Metot Seçici</div>
        <span class="stepper-pos" id="stepPos">1 / 42</span>
      </div>
      <div class="stepper-bar">
        <button class="btn-step" id="prevStrat">◀ Önceki</button>
        <span style="font-size:10.5px;color:var(--muted)">Tek Tek İlerlet</span>
        <button class="btn-step" id="nextStrat">Sonraki ▶</button>
      </div>
      <div class="sub-label" id="scenarioCount" style="margin:0 0 7px"></div>
      <div class="search-row">
        <input class="input" type="search" id="qInput" placeholder="Metot veya filtre ara...">
        <select class="select" id="sortSel">
          <option value="kasaAll">Tüm Yıllar Net ↓</option>
          <option value="kasa26">2026 Net ↓</option>
          <option value="exp26">2026 Ort. R ↓</option>
          <option value="pf">Profit Factor ↓</option>
          <option value="wr">Kazanma Oranı ↓</option>
        </select>
      </div>
      <div class="strat-list" id="stratList"></div>
    </div>

    <!-- ADIM 3: METODUN TIMEFRAME & SENARYO SEÇİCİSİ -->
    <div class="step-box">
      <div class="step-head">
        <div class="step-title"><span class="step-num">3</span> Metodun Timeframe &amp; Filtresi</div>
      </div>
      <div class="sub-label">Metodun Zaman Dilimleri</div>
      <div class="chips" id="stratTfChips" style="margin-bottom:8px"></div>

      <div class="sub-label">Senaryo / Filtre Varyantı</div>
      <div class="var-list" id="varList"></div>
    </div>
  </aside>

  <!-- SAĞ ANA EKRAN: SOLDA TÜM YILLAR | SAĞDA SADECE 2026 -->
  <main class="main">

    <div class="eyebrow">2022–2026 · Binance USD-M Futures · 5m çıkış çözümlemesi</div>
    <h1>Filtre Laboratuvarı PRO</h1>
    <p class="sub">42 metot · 520 USDT perpetual sembol · 224 doğrulanmış senaryo · işlem başı 10 USDT · azami 1× kaldıraç · ücret, kayma ve tarihsel funding dahil</p>

    <div class="tabs" role="tablist">
      <button class="tab-btn on" data-tab="analyze" role="tab" aria-selected="true">Analiz Paneli</button>
      <button class="tab-btn" data-tab="table" role="tab" aria-selected="false">Strateji × Filtre × TF Tablosu <span class="tab-count">563</span></button>
      <button class="tab-btn" data-tab="chosen" role="tab" aria-selected="false">Chosen Ones <span class="tab-count" id="chosenTabCount">0</span></button>
    </div>

    <div id="panelAnalyze" class="tab-panel">

    <!-- ÜST STRATEJİ ÖZETİ + SAĞ SWITCH BOX -->
    <div class="hero-grid">
      <div class="strat-hero">
        <div>
          <h2 id="selTitle">—</h2>
          <div class="sub" id="selSub">—</div>
          <div class="badges" id="selBadges"></div>
        </div>
        <div class="rules-bar" id="selRules"></div>
      </div>

      <div class="switch-box-card">
        <div class="switch-box-head">
          <h3>Uygulanacak Filtre Switch Box</h3>
          <span style="font-size:11px;color:var(--muted)">Aç/Kapat ile anlık karşılaştırma</span>
        </div>
        <div class="switch-list" id="switchList"></div>
        <div class="preset-row" id="presetRow"></div>
        <div class="delta-strip" id="deltaStrip"></div>
      </div>
    </div>

    <!-- İKİYE BÖLÜNMÜŞ YAPIŞKAN SÜTUN BAŞLIKLARI (3. Tüm Yıllar Paneli | 4. 2026 Paneli) -->
    <div class="split-sticky-headers">
      <div class="col-banner left-all">
        <span>3. TÜM YILLAR PANELİ (2022–2026)</span>
        <span class="sub">Sol sütun · 1× kaldıraçsız</span>
      </div>
      <div class="col-banner right-2026">
        <span>4. 2026 PANELİ (Yalnızca 2026)</span>
        <span class="sub">Sağ sütun · 1× kaldıraçsız</span>
      </div>
    </div>

    <!-- ÖĞELER 5..12: 8'Lİ KPI KARTLARI (SOL: TÜM YILLAR | SAĞ: 2026) -->
    <div class="split-row">
      <div class="kpi-grid-8" id="kpisAll"></div>
      <div class="kpi-grid-8" id="kpis2026"></div>
    </div>

    <!-- YENİ GRAFİK 1: KÜMÜLATİF NET ÖZSERMAYE EĞRİSİ -->
    ${splitRow(
      '',
      'Kümülatif Net Özsermaye Eğrisi (Tüm Yıllar)',
      'Kümülatif Net Özsermaye Eğrisi (2026)',
      '2022-08-01 başlangıçlı 1× kaldıraçsız net özsermaye ve zirve çizgisi',
      '01.01.2026 başlangıçlı 1× kaldıraçsız 2026 net özsermaye ve zirve çizgisi',
      'cEq_all',
      'cEq_26'
    )}

    <!-- YENİ GRAFİK 2: DRAWDOWN EĞRİSİ -->
    ${splitRow(
      '',
      'Drawdown (Zirveden Düşüş) Eğrisi (Tüm Yıllar)',
      'Drawdown (Zirveden Düşüş) Eğrisi (2026)',
      'Bütün dönemde özsermayenin önceki zirvesinden geri çekilmesi',
      'Yalnızca 2026 içinde özsermayenin 2026 zirvesinden geri çekilmesi',
      'cDd_all',
      'cDd_26'
    )}

    <!-- YENİ GRAFİK 9: FİLTRELİ–FİLTRESİZ NET GETİRİ KARŞILAŞTIRMASI -->
    ${splitRow(
      '',
      'Filtreli–Filtresiz Net Getiri Karşılaştırması (Tüm Yıllar)',
      'Filtreli–Filtresiz Net Getiri Karşılaştırması (2026)',
      'Filtresiz (Temel, kırmızı noktalı) ile seçili filtre varyantlarının tüm dönem karşılaştırması',
      'Filtresiz (Temel) ile seçili filtre varyantlarının yalnızca 2026 karşılaştırması',
      'cFltCmp_all',
      'cFltCmp_26'
    )}

    <!-- YENİ GRAFİK 8: HAREKETLİ 30, 90 VE 365 GÜNLÜK NET GETİRİ -->
    ${splitRow(
      '',
      'Hareketli 30, 90 ve 365 Günlük Net Getiri (Tüm Yıllar)',
      'Hareketli 30, 90 ve 365 Günlük Net Getiri (2026)',
      '30G (mavi), 90G (yeşil) ve 365G (altın) hareketli net getiri pencereleri',
      '2026 boyunca 30G, 90G ve 365G hareketli net getiri pencereleri',
      'cRoll_all',
      'cRoll_26'
    )}

    <!-- ÖĞE 13: GÜNLÜK KÂR-ZARAR GRAFİĞİ -->
    ${splitRow(
      '13',
      'Günlük Kâr-Zarar Grafiği (Tüm Yıllar)',
      'Günlük Kâr-Zarar Grafiği (2026)',
      'Aynı günün brüt kâr (yukarı yeşil) ve brüt zarar (aşağı kırmızı) barları birlikte',
      '2026 günlerinde aynı günün brüt kâr (yukarı yeşil) ve brüt zarar (aşağı kırmızı) barları birlikte',
      'cDay_all',
      'cDay_26'
    )}

    <!-- ÖĞE 14: HAFTALIK KÂR-ZARAR GRAFİĞİ -->
    ${splitRow(
      '14',
      'Haftalık Kâr-Zarar Grafiği (Tüm Yıllar)',
      'Haftalık Kâr-Zarar Grafiği (2026)',
      'Her haftanın brüt kârı (yeşil), brüt zararı (kırmızı) ve haftalık net sonucu',
      '2026 haftalarının brüt kârı (yeşil), brüt zararı (kırmızı) ve haftalık net sonucu',
      'cWeek_all',
      'cWeek_26'
    )}

    <!-- ÖĞE 15: AYLIK KÂR-ZARAR GRAFİĞİ -->
    ${splitRow(
      '15',
      'Aylık Kâr-Zarar Grafiği (Tüm Yıllar)',
      'Aylık Kâr-Zarar Grafiği (2026)',
      '2022–2026 arası tüm aylarda brüt kâr (yeşil), brüt zarar (kırmızı) ve net sonuç',
      '2026 aylarında (Ocak–Eylül) brüt kâr (yeşil), brüt zarar (kırmızı) ve net sonuç',
      'cMonth_all',
      'cMonth_26'
    )}

    <!-- ÖĞE 16: MEVSİMLİK KÂR-ZARAR GRAFİĞİ -->
    ${splitRow(
      '16',
      'Mevsimlik Kâr-Zarar Grafiği (Tüm Yıllar)',
      'Mevsimlik Kâr-Zarar Grafiği (2026)',
      'Kış, İlkbahar, Yaz ve Sonbahar kırılımında brüt kâr ve zarar (Tüm Yıllar)',
      'Kış, İlkbahar, Yaz ve Sonbahar kırılımında brüt kâr ve zarar (2026)',
      'cSeason_all',
      'cSeason_26'
    )}

    <!-- YENİ GRAFİK 6: HAFTANIN GÜNÜNE GÖRE NET PERFORMANS -->
    ${splitRow(
      '',
      'Haftanın Gününe Göre Net Performans (Tüm Yıllar)',
      'Haftanın Gününe Göre Net Performans (2026)',
      'Pazartesi–Pazar günlerinde brüt kâr, brüt zarar ve net sonuç (Tüm Yıllar)',
      'Pazartesi–Pazar günlerinde brüt kâr, brüt zarar ve net sonuç (2026)',
      'cDow_all',
      'cDow_26'
    )}

    <!-- YENİ GRAFİK 7: AY × YIL NET GETİRİ HEATMAP'İ -->
    ${splitRow(
      '',
      'Ay × Yıl Net Getiri Heatmap’i (2022–2026)',
      '2026 Aylık Kâr / Zarar / Net Heatmap’i',
      'Ocak–Aralık × 2022–2026 matrisinde aylık net sonuç ısı haritası',
      '2026 aylarında Brüt Kâr, Brüt Zarar ve Net Sonuç ısı haritası',
      'cCal_all',
      'cCal_26'
    )}

    <!-- ÖĞE 17: İŞLEM SÜRESİ HİSTOGRAMI (8 ARALIK) -->
    ${splitRow(
      '17',
      'İşlem Süresi Histogramı (Tüm Yıllar)',
      'İşlem Süresi Histogramı (2026)',
      '8 süre aralığına göre işlem sayısı ve kazanma oranı (<1sa, 1–3sa, 3–9sa, 9–24sa, 1–3g, 3–7g, 1–4h, >4h)',
      '2026 işlemlerinin 8 süre aralığına göre işlem sayısı ve kazanma oranı',
      'cDurCnt_all',
      'cDurCnt_26'
    )}

    <!-- ÖĞE 18: İŞLEM SÜRESİNE GÖRE KÂR-ZARAR GRAFİĞİ -->
    ${splitRow(
      '18',
      'İşlem Süresine Göre Kâr-Zarar Grafiği (Tüm Yıllar)',
      'İşlem Süresine Göre Kâr-Zarar Grafiği (2026)',
      'Her süre aralığındaki brüt kâr (yeşil), brüt zarar (kırmızı) ve net sonuç (Tüm Yıllar)',
      'Her süre aralığındaki brüt kâr (yeşil), brüt zarar (kırmızı) ve net sonuç (2026)',
      'cDurPnl_all',
      'cDurPnl_26'
    )}

    <!-- YENİ GRAFİK 3: LONG–SHORT NET PERFORMANS KARŞILAŞTIRMASI -->
    ${splitRow(
      '',
      'Long–Short Net Performans Karşılaştırması (Tüm Yıllar)',
      'Long–Short Net Performans Karşılaştırması (2026)',
      'Long ve Short yönlü işlemlerin brüt kâr, brüt zarar ve net katkısı (Tüm Yıllar)',
      'Long ve Short yönlü işlemlerin brüt kâr, brüt zarar ve net katkısı (2026)',
      'cLs_all',
      'cLs_26'
    )}

    <!-- YENİ GRAFİK 4: ÇIKIŞ NEDENİ DAĞILIMI -->
    ${splitRow(
      '',
      'Çıkış Nedeni Dağılımı — İşlem Sayısı (Tüm Yıllar)',
      'Çıkış Nedeni Dağılımı — İşlem Sayısı (2026)',
      'Stop-Loss (5m korumacı SL), İndikatör Çıkışı / TP, Ters Sinyal (Flip) ve Süre Sınırı dağılımı',
      '2026 işlemlerinin çıkış nedenlerine göre işlem sayısı ve kazanma oranı dağılımı',
      'cExitCnt_all',
      'cExitCnt_26'
    )}

    <!-- YENİ GRAFİK 5: ÇIKIŞ NEDENİNE GÖRE NET KÂR VE ZARAR -->
    ${splitRow(
      '',
      'Çıkış Nedenine Göre Net Kâr ve Zarar (Tüm Yıllar)',
      'Çıkış Nedenine Göre Net Kâr ve Zarar (2026)',
      'Her çıkış nedeninde oluşan brüt kâr (yeşil), brüt zarar (kırmızı) ve net sonuç (Tüm Yıllar)',
      'Her çıkış nedeninde oluşan brüt kâr (yeşil), brüt zarar (kırmızı) ve net sonuç (2026)',
      'cExitPnl_all',
      'cExitPnl_26'
    )}

    <!-- ÖĞE 19: COİN BAZINDA KÂR-ZARAR GRAFİĞİ (EN AKTİF 40 COİN) -->
    ${splitRow(
      '19',
      'Coin Bazında Kâr-Zarar Grafiği — En Aktif 40 Coin (Tüm Yıllar)',
      'Coin Bazında Kâr-Zarar Grafiği — En Aktif 40 Coin (2026)',
      'Seçilen metotta tüm dönemde en aktif 40 coinin brüt kâr (yeşil), brüt zarar (kırmızı) ve net sonucu',
      'Seçilen metotta 2026 yılında en aktif 40 coinin brüt kâr (yeşil), brüt zarar (kırmızı) ve net sonucu',
      'cCoin_all',
      'cCoin_26',
      'tall'
    )}

    <!-- ÖĞE 20..23 & FİLTRELERİN NET TOPLAM GETİRİ HEATMAP'İ -->
    ${splitRow(
      '20–23',
      'Filtrelerin Net Toplam Getiri Heatmap’i · WR% · Ort R · İşlem (Tüm Yıllar)',
      'Filtrelerin Net Toplam Getiri Heatmap’i · WR% · Ort R · İşlem (2026)',
      'Seçilen metotta 56+ filtrenin Toplam Net Getirisi (20), Kazanma Oranı (21), Ortalama R Değeri (22) ve İşlem Sayısı (23)',
      'Seçilen metotta 56+ filtrenin yalnızca 2026 yılı Toplam Net Getirisi, Kazanma Oranı, Ortalama R Değeri ve İşlem Sayısı',
      'cFltHeat_all',
      'cFltHeat_26',
      'xtall'
    )}

    <footer>
      <b>Mimari ve Simülasyon Kuralları (1–26 + 10 Yeni Grafik):</b>
      Ekran tam ortadan ikiye bölünmüştür: <b>Sol sütun (3. Tüm Yıllar Paneli)</b> seçilen metodun 2022–2026 bütün dönem sonuçlarını, <b>Sağ sütun (4. 2026 Paneli)</b> ise yalnızca 2026 sonuçlarını birebir aynı metrik ve grafik hizasıyla gösterir.
      Yüksek zaman dilimindeki çıkışlar bar içi alt mumlarla çözülür (<b>24</b>); aynı mumda SL ve TP görülürse korumacı şekilde SL önce uygulanır (<b>25</b>); bütün sonuçlar azami <b>1× kaldıraçsız</b> hesaplanır (<b>26</b>). Eğitim ve araştırma amaçlıdır, yatırım tavsiyesi değildir.
    </footer>

    </div><!-- /panelAnalyze -->

    <!-- ===================== TABLO SEKMESİ ===================== -->
    <div id="panelTable" class="tab-panel" hidden>
      <div class="table-toolbar">
        <div>
          <h2>Strateji × Filtre × Timeframe Tablosu</h2>
          <p class="note">Her satır tek bir strateji + filtre + zaman dilimi kombinasyonudur. Sütun başlığına tıklayarak büyükten küçüğe / küçükten büyüğe sırala; başlığın altındaki min–max kutularıyla Excel gibi aralık filtrele.</p>
        </div>
        <div class="table-actions">
          <input class="input tbl-search" id="tblSearch" type="search" placeholder="Strateji veya filtre ara…" autocomplete="off">
          <select class="select tbl-tf" id="tblTf">
            <option value="all">Tüm TF</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
            <option value="1w">1w</option>
          </select>
          <select class="select tbl-kind" id="tblKind">
            <option value="all">Tüm satırlar</option>
            <option value="filtered">Sadece filtreli</option>
            <option value="base">Sadece filtresiz</option>
          </select>
          <button class="btn-step" id="tblCsv">CSV indir</button>
          <button class="btn-step" id="tblReset">Filtreleri sıfırla</button>
        </div>
      </div>

      <div class="table-meta" id="tblMeta"></div>

      <div class="table-scroll">
        <table class="data-table" id="tbl">
          <thead id="tblHead"></thead>
          <tbody id="tblBody"></tbody>
        </table>
      </div>

      <div class="table-legend">
        <b>Puan (0–99,9):</b> (2) tüm yıllar işlem başı net getiri min–max ölçeğinde 0–33,3 · (4) kârlı işlemlerin ortalama kalış süresi ters min–max ölçeğinde 0–33,3 · (5) kârlı/zararlı işlem oranı min–max ölçeğinde 0–33,3. Üç kategori toplanır.
        <br>Net/İşlem değerleri 1× kaldıraçsız oransal getiridir; altındaki küçük değer $10 sabit işlem karşılığıdır. Süreler saat cinsindendir. Bu tablo eğitim/araştırma amaçlıdır, yatırım tavsiyesi değildir.
      </div>
    </div>

    <!-- ===================== CHOSEN ONES SEKMESİ ===================== -->
    <div id="panelChosen" class="tab-panel" hidden>
      <div class="table-toolbar">
        <div>
          <h2>Chosen Ones</h2>
          <p class="note">Strateji tablosunda <b>Chosen</b> kutusunu işaretlediğin her strateji + filtre + timeframe satırı burada toplanır. Seçimler tarayıcıda saklanır.</p>
        </div>
        <div class="table-actions">
          <button class="btn-step" id="chosenCsv">CSV indir</button>
          <button class="btn-step" id="chosenClear">Tümünü temizle</button>
        </div>
      </div>

      <div class="table-meta" id="chosenMeta"></div>

      <div class="table-scroll">
        <table class="data-table" id="chosenTbl">
          <thead>
            <tr>
              <th class="idx">#</th>
              <th class="txt">Strateji</th>
              <th class="txt">TF</th>
              <th class="txt">Filtre</th>
              <th>İşlem</th>
              <th>Net / İşlem<br>Tüm Yıllar</th>
              <th>Net / İşlem<br>2026</th>
              <th>Kârlı İşlem<br>Ort. Süre (saat)</th>
              <th>Kârlı / Zararlı</th>
              <th>Puan<br>(0–99,9)</th>
              <th>Kaldır</th>
            </tr>
          </thead>
          <tbody id="chosenBody"></tbody>
        </table>
      </div>

      <div class="table-legend">
        <b>Chosen Ones:</b> Bu sekme yatırım tavsiyesi değildir; seçtiğin kombinasyonları tek listede karşılaştırman için hazırlanmıştır. İşaretlemeyi kaldırmak için satır sonundaki <b>Kaldır</b> düğmesini veya strateji tablosundaki kutuyu kullanabilirsin.
      </div>
    </div>

  </main>

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
