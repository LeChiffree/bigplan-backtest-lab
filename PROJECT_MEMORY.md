# BigPlan · Filtre Laboratuvarı PRO — Tüm Proje Hafızası ve Geçmişi

Bu belge, `D:\BigPlan` altında yürütülen tüm araştırma, mühendislik kararları, veri mimarisi, homojenlik testleri, 10x/15x ULTRA dayanıklılık senaryosu ve $10 Sabit İşlem Kasası PRO Dashboard yükseltmelerinin eksiksiz hafıza kaydıdır.

---

## 1. Projenin Amacı ve Temel İlkeleri
- **Amaç:** `indikator-akademi` (salt-okunur referans) içindeki 100 indikatör × 6 zaman dilimi (`5m, 15m, 1h, 4h, 1d, 1w`) × 520 Binance USDT-M vadeli işlem sembolü üzerinde çalışan backtest sistemini **giriş filtreleriyle (66 filtre)** yeniden simüle etmek, aşırı-uydurma (overfit) olmadan kalıcı ve homojen stratejileri ayıklamak.
- **Sözleşme (Değişmez Kurallar):**
  1. Parametre optimizasyonu yapılmaz (indikatör periyotları sabittir).
  2. Çıkış sinyalleri ve stoplar **her durumda aynen uygulanır**; filtreler yalnızca **yeni pozisyon girişini** (`gateL` / `gateS`) süzebilir.
  3. Komisyon (`FEE`), kayma (`SLIP`) ve gerçek fonlama maliyeti (`fundingCost`) her işlemin net `r` getirisine dahildir.
  4. Seçim (train) dönemi `2022-08-01 → 2024-12-31`, doğrulama (test) dönemi `2025-01-01 → 2026-09-08` olarak ayrılmıştır.
  5. **Pozitiflik Kuralı:** Hem tüm dönem (`2022–2026`) hem de **2026** işlem başı ortalama getirisi negatif (`≤ 0`) olan strateji/varyantlar aktif aday havuzuna dahil edilmez.

---

## 2. Kronolojik Gelişim ve Aşamalar

### Aşama 1 — 58 Sembolden 520 Sembole Evren Genişletmesi
- İlk sürüm 58 sembol üzerinde çalıştırıldı ve tüm çıktıları `out_eski58/`, `DASHBOARD_eski58.html`, `HOMOJENLIK_eski58.html`, `README_eski58.md` olarak korundu.
- Ardından Binance Vision aylık arşivlerinden 462 yeni USDT-M perpetual sembolü indirildi ve doğrulandı (`58 + 462 = 520` sembol, `2022-08-01 → 2026-09-08`, 1.500 günlük ızgara).
- 593 hücre × (temel + 66 tekil filtre + kombinasyonlar) yeniden simüle edildi:
  - Baz durumda negatif olan 259 hücrenin **69 tanesi** filtrelerle pozitife döndü.
  - Toplam **577 hücrede** iyileşme sağlandı (`out/FILTRE-RAPORU.md`, `DASHBOARD.html`, `DASHBOARD_MASTER.html`).

### Aşama 2 — 6 Ölçütlü Homojenlik Analizi ve 93 Adayın Keşfi (`HOMOJENLIK.html`)
- Portföy eğrileri üzerinde 6 homojenlik ölçütü tanımlandı:
  1. Net kâr > 0
  2. Pozitif ay oranı ≥ %60
  3. En büyük tek ayın toplam kârdaki payı ≤ %33
  4. En iyi %5 günün (1.500 günde ~75 gün) toplam kârdaki payı ≤ %40
  5. Doğrusallık $R^2 \ge 0.80$
  6. Tam yılların (`2023`, `2024`, `2025`) her birinde net getiri > 0
- **Bulgu:** Kripto piyasasının kuyruk yapısı nedeniyle 4. ölçütü (`top5Gün ≤ %40`) orijinal tanımıyla geçen strateji sayısı `0` çıktı; ancak diğer 5 ölçütün tamamını geçen **93 güçlü aday** (`5/6 dayanıklı katman`) tespit edildi.
- 4. ölçüt için alternatif varyantlar birlikte raporlandı (`HOMOJENLIK.html`):
  - **Alt-10 Toplamsal (En iyi 10 gün çıkarıldığında kalan kâr > 0):** 78 / 93 geçti
  - **Alt-10 Bileşik:** 76 / 93 geçti
  - **BTC-Göreli (`top5Gün ≤ BTC top5Gün`):** 80 / 93 geçti

### Aşama 3 — Likidite Evreni (Top 50..300) ve Kaldıraç Merdiveni (`extract93_vol.mjs`)
- Her sembolün 5 yıllık ortalama yıllık USDT hacmi (`out/coin_volume.json`) hesaplanarak `Tümü (520)` + `Top 50 / 100 / 150 / 200 / 250 / 300` hacim kümeleri oluşturuldu.
- Kozmetik filtreleme yerine her hacim kümesi işlem bazında sıfırdan yeniden simüle edildi.
- `1x, 2x, 5x, 10x, 15x, 20x` kaldıraç merdiveni eklendi.

### Aşama 4 — ULTRA 10x/15x Dayanıklılık Senaryosu (`ULTRA.html`)
- 93 aday; 5 stres ekseni (kaldıraç `1x..20x`, 7 likidite evreni, 4 yıl, 4 BTC rejimi, uygulanabilirlik) ve 7 sert kapıdan geçirildi:
  - 10x tasfiye yok (72/93)
  - 15x tasfiye yok (53/93)
  - 15x maks DD > -90% (19/93)
  - Örneklem ≥ 200 işlem ve ≥ 50 test işlemi (93/93)
  - 10x'te ≥ 4/6 hacim evreni pozitif (59/93)
  - 15x en kötü gün tamponu > %20 (56/93)
  - 15x log büyüme > 0 (60/93)
- **Hayatta Kalan İlk 5 Farklı Strateji:**
  1. `mfi|1d|varyant2` — **MFI Aşırılık Dönüşü (14)** (`RVOL>1.5 + BTC dolar hacmi ≥ %50`, Skor: 87.3)
  2. `hma|1d|varyant1` — **HMA(20) Fiyat Kesişimi** (`BTC dolar hacmi ≥ %50 + Piyasa hacmi ≥ %50`, Skor: 82.2)
  3. `uo|4h|varyant3` — **Ultimate Oscillator Dönüşü** (`RVOL>1.5 + Kendi momentumu 30g`, Skor: 80.7)
  4. `smi|1d|varyant1` — **SMI Aşırılık Dönüşü (14,3)** (`Piyasa genişliği + ROC tersi`, Skor: 76.3)
  5. `nvi|4h|varyant1` — **NVI + EMA(200) Trendi** (`ATR% ≥ %120 + RSI aşırı bölge yasağı`, Skor: 75.2)
  - *(Ayrıca `mfi|1d|temel` 6. hayatta kalan konfigürasyon olarak aile alternatifi etiketiyle korundu).*

### Aşama 5 — Filtre Laboratuvarı PRO & $10 Sabit İşlem Kasası Dashboard'u (`BACKTEST93.html`)
- **Sorun & İhtiyaç:** Bileşik faiz eğrilerinin uzun vadede aşırı büyümesi nedeniyle gerçek nakit akışını görmek için **her işleme sabit 10 $ ile girilen ve 0 $'dan başlayan kasa modeli** kuruldu.
- **Veri Çıkarımı (`tools/extract_pro.mjs` + `tools/extract_pro_worker.mjs` + `tools/build_pro_bundle.py`):**
  - 42 strateji × 75 `(id, tf)` hücresi × (`temel` + `varyant1..3` + tekil filtre anahtarları `single:k`) = **564 durum**, 520 sembol ve 7 ayrık hacim katmanı (`Tier 0..6`) üzerinden sıfır-tahsisli (`zero-alloc`) mimariyle ~45 saniyede simüle edildi.
  - Python (`numpy`, `pandas`, `scipy`, `plotly 6.8`) ile her durumun `$10 Kasa` istatistikleri, `posBoth` (`totAvg > 0 && y26Avg > 0`) kontrolü ve kompakt `out/pro_bundle.json` + `out/pro_data.js` + `out/plotly.min.js` paketleri üretildi.
- **PRO Dashboard Özellikleri (`BACKTEST93.html`):**
  - **Sol Panel (Adım Adım Seçim):**
    1. Timeframe (`Tümü, 15m, 1h, 4h, 1d, 1w`), Hacim Evreni (`Tümü, Top 50..300`), Kaldıraç (`1x..20x`), Birim (`$10 Kasa $` / `%`).
    2. Strateji Seçimi (`◀ Önceki` / `Sonraki ▶` ile tek tek ilerleme).
    3. Seçili Stratejinin Timeframe'leri ve Varyantları.
  - **Sağ Üst Switch Box:** Seçili stratejinin tekil filtrelerini açıp kapatarak (`ON/OFF`) gerçek simülasyon etkisini ve `Temel` duruma göre farkını (`Kasa Δ`, `$/İşlem Δ`, `WR Δ`, `Korunan İşlem %`) anlık görme.
  - **14 Etkileşimli Plotly Grafiği:**
    1. `cFilterCurve`: Filtre Etkisi 1 — $10 Kasa Eğrisi Karşılaştırması (Temel vs Tekil Filtreler vs Varyantlar)
    2. `cFilterBars`: Filtre Etkisi 2 — Brüt Kâr (Yeşil Yukarı) / Brüt Zarar (Kırmızı Aşağı) & Net Kasa
    3. `cCashAll`: Tüm Dönem (`2022–2026`) $10 İşlem Kasası Line Grafiği (`0$` Başlangıçlı)
    4. `cCash2526`: Sadece `2025–2026` Özel $10 İşlem Kasası Line Grafiği (`01.01.2025 = 0$` Başlangıçlı)
    5. `cDailyAll`: Gün Gün Kâr (+Yeşil) ve Zarar (-Kırmızı) Histogramı (`2022–2026`)
    6. `cDaily2526`: Gün Gün Kâr (+Yeşil) ve Zarar (-Kırmızı) Histogramı (`2025–2026`)
    7. `cYearly`: Yıl Yıl Kâr (+Yeşil) ve Zarar (-Kırmızı) Histogramı (`2022..2026`, 2026 dahil)
    8. `cSeasonal`: Mevsim Mevsim Kâr (+Yeşil) ve Zarar (-Kırmızı) Histogramı (`Kış, İlkbahar, Yaz, Sonbahar`)
    9. `cQuarterly`: Çeyrek Çeyrek Kâr (+Yeşil) ve Zarar (-Kırmızı) Histogramı (`2022 Q3..2026 Q3` & `Q1..Q4`)
    10. `cDuration`: Bir İşlemde Toplam Kalma Süreleri (`<1g, 1–3g, 3–7g, 7–14g, 14–35g, 35–65g, 65+g`)
    11. `cRetDist`: İşlem Başına Getiri Dağılımı & Kuyruk Asimetrisi Histogramı
    12. `cHeatmapMonth`: Yıl × Ay Net Kasa Isı Haritası (`2022–2026 × Ocak–Aralık` Heatmap)
    13. `cUnderwater`: $10 Kasa Sualtı Düşüş (`Underwater Drawdown $`) & 90G Hareketli Tempo Line Grafiği
    14. `cDowHour` & `cCoin`: Haftanın Günleri / Giriş Saatleri ve Coin Bazlı Diverging Kâr/Zarar Grafikleri

---

## 3. Lokal Mum Verileri ve Yeniden Üretim Rehberi

Bu GitHub deposuna **1m / 5m / 15m / 1h / 4h / 1d ham mum (kline) verileri (`cache/` ve `D:\1mDataBinance`) bilerek dahil edilmemiştir**.
Tüm hazır dashboard'lar (`BACKTEST93.html`, `ULTRA.html`, `HOMOJENLIK.html`, `DASHBOARD.html`, `DASHBOARD_MASTER.html`) ve işlenmiş veri paketleri (`out/pro_bundle.json`, `out/pro_data.js`, `out/ultra_data.json`, `out/backtest93_data.json`, `out/homojenlik.json`) depoda mevcuttur; **mum verisi olmadan da doğrudan çalışır**.

### Dashboard Sunucusunu Başlatma (Mum Verisi Gerekmez)
```powershell
node tools/serve_dash.mjs
# Tarayıcıda:
#   http://localhost:8123/           -> Filtre Laboratuvarı PRO ($10 Kasa & Switch Box)
#   http://localhost:8123/ultra      -> ULTRA 10x/15x Dayanıklılık Senaryosu
#   http://localhost:8123/homojenlik -> Homojenlik Analizi
#   http://localhost:8123/master     -> Master Filtre Matrisi
```

### Lokal Mum Verileriyle Sıfırdan Simülasyon (İsteğe Bağlı)
Lokal makinede `D:\1mDataBinance` ve `D:\BigPlan\cache\series\{5m,15m,1h,4h,1d}\*.bin` hazır olduğunda:
```powershell
# 1. İşlem bazlı PRO veri çıkarımı (520 sembol, 7 worker, ~45 sn)
node tools/extract_pro.mjs

# 2. Python kantitatif paketleme ve negatif aday elemesi
python tools/build_pro_bundle.py

# 3. PRO Dashboard HTML üretimi
node tools/pro_dash_html.mjs

# 4. ULTRA 10x/15x veri ve HTML üretimi
node tools/ultra.mjs
node tools/ultra_html.mjs
```
