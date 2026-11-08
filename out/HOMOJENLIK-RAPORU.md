# Homojenlik Raporu — "Kâr birkaç güne mi bağlı?"

Üretim: 2026-10-20 18:57 UTC · Veri: günlük portföy eğrileri (`out/daily/`, 593 hücre × temel + en iyi 3 filtreli varyant)

## 1. Tanım ve ölçütler

Bir strateji/tf/varyant kombinasyonu **"homojen kârlı"** sayılır — yalnızca aşağıdakilerin TAMAMI sağlandığında:

| # | Ölçüt | Eşik | Neyi engeller |
|---|---|---|---|
| 1 | Net kâr | > 0 | Kaybettiren sonuç |
| 2 | Pozitif ay oranı | ≥ %60 | Kötü ayların baskın olması |
| 3 | En büyük tek ayın payı | ≤ net kârın %33'ü | "Her şey bir ayda" hikâyesi |
| 4 | En iyi %5 günün payı | ≤ net kârın %40'ı | "Birkaç gün taşıyor" hikâyesi |
| 5 | Kümülatif kâr–zaman doğrusal uyum | R² ≥ 0.80 | Sıçramalı/şekilsiz eğri |
| 6 | Tam yıllar (2023, 2024, 2025) | Her biri > 0 | Yıllar arası tutarsızlık |

Ölçüm notları: portföy eğrisi = işlem yapan sembollerin eşit ağırlıklı ortalaması (orijinal boru hattıyla aynı semantik; doğrulama §2). Aylık pay ve gün payı, artımlı (additive) getiri toplamına göre hesaplanır. R², kümülatif kâr ile zaman arasındaki en küçük kareler uyumudur; "lineer kâr" isteğinin doğrudan ölçüsüdür.

## 2. Doğrulama (QA)

- Günlük eğrilerin haftalık alt-kümeleri referans haftalık eğrilerle birebir: 127495 nokta, en büyük fark 0.00005 (referans eğriler r4 yuvarlanmış), uyuşmazlık **0**.
- Varyant işlem sayısı/metrikleri ham depoyla birebir: 1770 varyant, uyuşmazlık **0**.

## 3. Genel Sonuç

| Grup | Durum | Net pozitif | Homojen (tüm kriterler) | Oran |
|---|---|---|---|---|
| Temel (filtresiz) | 593 | 384 | 0 | 0% |
| En iyi filtreli (varyant1) | 590 | 427 | 0 | 0% |
| Kurtarılan hücreler (baz negatif → filtreli pozitif) | 95 | 95 | 0 | 0% |

Not: "kurtarılan" burada günlük portföy eğrisi netine göre tanımlıdır; rapor2'deki işlem-kapılı tanımda (test kapıları) bu sayı 61'di — iki tanım küçük farklarla örtüşür.

**Pozitif sonuçların tipik profili (çarpıcı bulgu):** net pozitif durumlarda en iyi %5 günün kâr payı medyanı **246%**, üst çeyrek eşiği **387%**, en aşırı %5'lik dilim **24411%**. Yani pozitiflerin büyük çoğunluğu az sayıda güne bağımlı.

Net kârı ≥ %50 olan 1148 "ciddi" pozitifte medyan gün payı **200%**; bu grupta gün payı hâlâ ≤ %100 olan: **3** durum (0%).

**Ölçüt bazında geçme oranları (yalnız pozitifler):**

| Ölçüt | Geçen | Oran |
|---|---|---|
| pozAy≥%60 | 277 | 17% |
| top1Ay≤%33 | 661 | 40% |
| top5Gün≤%40 | 0 | 0% |
| R²≥0.80 | 490 | 30% |
| tamYıllar>0 | 484 | 29% |

Beş ölçütü geçip **yalnızca "en iyi %5 gün payı ≤ %40" ölçütüne takılan** durum: **93**. Bu, dayanıklılığın önündeki tek yaygın duvarın **gün bazlı yoğunlaşma** olduğunu gösterir.

## 3b. Ölçüt 4 Varyantları — gün yoğunlaşması nasıl tanımlanmalı?

Orijinal ölçüt ("en iyi %5 günün payı ≤ net kârın %40'ı") günlük kripto serilerinde yapısal olarak ulaşılamaz: net pozitif durumlarda bu payın medyanı **246%**. Bu yüzden dört tanımı **birlikte** raporluyoruz; hiçbiri tek başına "doğru" değildir.

| Varyant | Tanım | 6/6 geçen | 93 aday içinde |
|---|---|---|---|
| Orijinal | en iyi %5 gün payı ≤ %40 | 0 | 0 |
| Alt-10 (artımlı) | en iyi 10 gün çıkarılınca artımlı toplam hâlâ > 0 | 78 | 78 |
| Alt-10 (bileşik) | en iyi 10 gün 0 getiri sayılınca bileşik net hâlâ > 0 | 76 | 76 |
| BTC-göreli | top5 payı ≤ aynı dönemde BTCUSDT top5 payı (281%) | 80 | 80 |
| BTC-beta arındırılmış | BTC beta'sı çıkarıldıktan sonra top5 payı ≤ %40 | 0 | 0 |
| 5/6 katman | yalnız top5 eksik; diğer 5 ölçüt tamam | 93 | 93 |

Not: "6/6 geçen" yalnızca diğer beş ölçütü de geçen durumları sayar; 93 aday zaten diğer beşi geçtiği için iki sütun aynıdır. Orijinal tanımda 6/6 geçen yoktur. BTC-göreli tanım, stratejinin **BTC tutmaktan daha fazla gün-bağımlı olmaması** gerektiğini söyler. BTC-beta arındırılmış tanım ise getiriden BTC beta değerini çıkarıp kalan idiyosinkratik kârın yine az sayıda güne bağlı olup olmadığını ölçer. Artımlı ve bileşik alt-10 tanımı arasındaki fark 2 adaydır (`aroon 4h temel`, `voi 4h varyant2`): bunlar artımlı toplamda pozitif kalırken bileşik nette negatife döner.

### 3b.1 Alt-10 varyantını geçen adaylar (artımlı: en iyi 10 gün çıkarılınca kârlı)

| # | Strateji | TF | Varyant | Net kâr | Top5 gün | 10 gün sonrası (art.) | 10 gün sonrası (bileş.) | BTC top5 |
|---|---|---|---|---|---|---|---|---|
| 1 | NVI + EMA(200) Trendi | 4h | temel | +1573.4% | 137% | +132.9% | +241.5% | 281% |
| 2 | Supertrend Dönüşü (10, 3) | 4h | temel | +1064.4% | 209% | +37.2% | +13.3% | 281% |
| 3 | Chaikin Oscillator Sıfır Kesişimi | 4h | temel | +904.2% | 223% | +83.4% | +63.3% | 281% |
| 4 | Aroon Eşik Kesişimi (25) | 4h | temel | +891.0% | 242% | +15.2% | -17.1% | 281% |
| 5 | EMA Şeridi Hizalanması (13-89) | 4h | temel | +700.2% | 172% | +57.2% | +61.4% | 281% |
| 6 | POC Göçü Trendi (yaklaşım) | 4h | temel | +647.0% | 174% | +26.0% | +17.8% | 281% |
| 7 | GMMA Kısa/Uzun Grup Kesişimi | 1h | temel | +609.2% | 268% | +67.2% | +39.6% | 281% |
| 8 | Chaikin Para Akışı Sıfır Kesişimi (20) | 4h | temel | +477.1% | 237% | +56.7% | +40.1% | 281% |
| 9 | PVT + EMA(21) Kesişimi | 4h | Hacim ortalamanın üstü + EMA200 tarafı | +464.9% | 155% | +65.9% | +85.6% | 281% |
| 10 | Twiggs Money Flow Sıfır Kesişimi (21) | 4h | temel | +459.0% | 238% | +24.5% | +5.8% | 281% |
| 11 | MFI Aşırılık Dönüşü (14) | 1d | temel | +455.6% | 95% | +120.6% | +228.0% | 281% |
| 12 | Ultimate Oscillator Dönüşü | 15m | temel | +425.5% | 175% | +90.2% | +113.7% | 281% |
| 13 | Supertrend Dönüşü (10, 3) | 4h | Piyasa hacmi ≥ %50 dilim + EMA200 tarafı | +414.6% | 165% | +68.8% | +90.2% | 281% |
| 14 | PVT + EMA(21) Kesişimi | 4h | Hacim ortalamanın üstü + Kendi momentumu (30g) | +411.2% | 161% | +49.0% | +57.4% | 281% |
| 15 | Williams %R Dönüşü (14) | 1d | temel | +388.8% | 156% | +67.2% | +80.8% | 281% |
| 16 | DPO Sıfır Kesişimi (20) | 1d | Dolar hacmi ≥ medyan | +385.8% | 141% | +77.1% | +105.9% | 281% |
| 17 | Supertrend Dönüşü (10, 3) | 4h | Piyasa hacmi ≥ %50 dilim + Kendi momentumu (30g) | +355.4% | 165% | +56.8% | +70.0% | 281% |
| 18 | Aroon Eşik Kesişimi (25) | 4h | Kendi momentumu (30g) + BTC dolar hacmi ≥ %50 dilim | +330.1% | 184% | +35.8% | +36.7% | 281% |
| 19 | DPO Sıfır Kesişimi (20) | 1d | Dolar hacmi ≥ medyan + Hafta sonu yasağı | +317.5% | 133% | +64.7% | +85.7% | 281% |
| 20 | Awesome Oscillator Sıfır Kesişimi | 4h | EMA200 tarafı + CMF pozitifliği | +301.0% | 219% | +23.7% | +17.5% | 281% |
| 21 | A/D Çizgisi + EMA(21) | 4h | RVOL>1.5 + BTC düşüş >%25 → long yasak | +296.6% | 172% | +59.7% | +72.9% | 281% |
| 22 | Parabolic SAR Dönüşü | 4h | Hafta sonu yasağı + Momentum(10) yönü | +284.0% | 241% | +51.6% | +48.9% | 281% |
| 23 | Twiggs Money Flow Sıfır Kesişimi (21) | 4h | RVOL>1.5 + BTC düşüş >%25 → long yasak | +258.3% | 170% | +43.7% | +48.3% | 281% |
| 24 | Ultimate Oscillator Dönüşü | 15m | ATR% ≥ %120 normal + Hacim ortalamanın üstü | +255.4% | 136% | +79.8% | +113.8% | 281% |
| 25 | Ultimate Oscillator Dönüşü | 15m | ATR% ≥ %120 normal + RVOL>1.5 | +252.2% | 129% | +81.2% | +118.3% | 281% |
| 26 | SMA Kesişimi (10/30) | 4h | Supertrend tarafı + Kendi momentumu (30g) | +225.4% | 211% | +17.9% | +14.9% | 281% |
| 27 | A/D Çizgisi + EMA(21) | 4h | RVOL>1.5 + Hafta sonu yasağı | +221.9% | 164% | +45.7% | +53.2% | 281% |
| 28 | NVI + EMA(200) Trendi | 4h | ATR% ≥ %120 normal + RSI aşırı bölge yasağı | +207.4% | 121% | +47.1% | +58.7% | 281% |
| 29 | Aroon Eşik Kesişimi (25) | 4h | Kendi momentumu (30g) + Stokastik %K/%D | +206.0% | 225% | +19.0% | +15.3% | 281% |
| 30 | Momentum Sıfır Kesişimi (10) | 1d | Piyasa genişliği + Hafta sonu yasağı | +202.1% | 226% | +14.4% | +10.4% | 281% |
| 31 | Aroon Eşik Kesişimi (25) | 4h | Kendi momentumu (30g) + Supertrend tarafı | +201.6% | 232% | +19.8% | +16.1% | 281% |
| 32 | Twiggs Money Flow Sıfır Kesişimi (21) | 4h | RVOL>1.5 + Hafta sonu yasağı | +193.3% | 161% | +50.3% | +61.0% | 281% |
| 33 | DPO Sıfır Kesişimi (20) | 1d | Hacim ortalamanın üstü | +192.7% | 150% | +41.1% | +47.4% | 281% |
| 34 | POC Göçü Trendi (yaklaşım) | 4h | Üst TF trend (×4) + BTC düşüş >%20 → sadece long | +190.2% | 173% | +44.1% | +51.6% | 281% |
| 35 | MACD Sinyal Kesişimi | 4h | Hafta sonu yasağı + Hacim osilatörü | +176.1% | 267% | +17.7% | +10.8% | 281% |
| 36 | RVI Sinyal Kesişimi (10) | 1d | Hafta sonu yasağı + Kendi momentumu (30g) | +175.3% | 232% | +20.1% | +16.2% | 281% |
| 37 | CCI Aşırılık Dönüşü (20) | 1w | temel | +169.3% | 135% | +29.6% | +28.0% | 281% |
| 38 | Chaikin Oscillator Sıfır Kesişimi | 4h | RVOL>1.5 | +166.7% | 191% | +35.3% | +37.7% | 281% |
| 39 | Chaikin Oscillator Sıfır Kesişimi | 4h | RVOL>1.5 + Hacim ortalamanın üstü | +166.7% | 191% | +35.3% | +37.7% | 281% |
| 40 | Williams %R Dönüşü (14) | 1w | temel | +164.2% | 141% | +19.9% | +15.1% | 281% |
| 41 | RVI Sinyal Kesişimi (10) | 1d | Piyasa genişliği + Hafta sonu yasağı | +160.8% | 243% | +24.5% | +20.3% | 281% |
| 42 | Williams %R Dönüşü (14) | 1w | Piyasa hacmi ≥ %50 dilim + ROC tersi | +158.7% | 127% | +26.6% | +28.4% | 281% |
| 43 | EMA(50) Trendi + NATR Yüzde Stopu | 4h | Hacim ortalamanın üstü + Hafta sonu yasağı | +156.4% | 231% | +23.5% | +21.9% | 281% |
| 44 | NVI + EMA(200) Trendi | 4h | ATR% ≥ %120 normal + BTC düşüş >%25 → long yasak | +155.6% | 127% | +46.3% | +57.3% | 281% |
| 45 | Chaikin Oscillator Sıfır Kesişimi | 4h | RVOL>1.5 + Hafta sonu yasağı | +151.8% | 188% | +28.2% | +29.1% | 281% |
| 46 | Chaikin Para Akışı Sıfır Kesişimi (20) | 4h | RVOL>1.5 | +142.5% | 190% | +40.5% | +45.6% | 281% |
| 47 | Chaikin Para Akışı Sıfır Kesişimi (20) | 4h | RVOL>1.5 + Hacim ortalamanın üstü | +142.5% | 190% | +40.5% | +45.6% | 281% |
| 48 | SMI Aşırılık Dönüşü (14,3) | 4h | Piyasa genişliği + Hafta sonu yasağı | +137.9% | 215% | +35.3% | +35.8% | 281% |
| 49 | HMA(20) Fiyat Kesişimi | 1d | BTC dolar hacmi ≥ %50 dilim + Piyasa hacmi ≥ %50 dilim | +136.7% | 149% | +32.2% | +36.9% | 281% |
| 50 | Williams %R Dönüşü (14) | 1w | Piyasa hacmi ≥ %50 dilim | +136.6% | 134% | +21.4% | +21.2% | 281% |
| 51 | Williams %R Dönüşü (14) | 4h | RVOL>1.5 + Piyasa genişliği | +135.9% | 147% | +37.0% | +42.0% | 281% |
| 52 | Williams %R Dönüşü (14) | 4h | RVOL>1.5 + Piyasa genişliği + Hacim ortalamanın üstü | +135.9% | 147% | +37.0% | +42.0% | 281% |
| 53 | Williams %R Dönüşü (14) | 1w | Hacim ortalamanın üstü + ROC tersi | +132.2% | 120% | +25.9% | +28.9% | 281% |
| 54 | Williams %R Dönüşü (14) | 1d | Piyasa genişliği | +128.4% | 160% | +32.7% | +35.9% | 281% |
| 55 | Williams %R Dönüşü (14) | 1d | Piyasa genişliği + MACD tersi | +127.4% | 158% | +32.7% | +36.1% | 281% |
| 56 | SMI Aşırılık Dönüşü (14,3) | 1d | Piyasa genişliği + ROC tersi | +124.7% | 124% | +50.6% | +64.8% | 281% |
| 57 | Chaikin Para Akışı Sıfır Kesişimi (20) | 4h | Hacim ortalamanın üstü + Hafta sonu yasağı | +122.4% | 217% | +28.9% | +28.7% | 281% |
| 58 | Tarihsel Volatilite Düşüş Filtresi | 1h | Piyasa genişliği + Supertrend tarafı | +120.9% | 225% | +18.7% | +17.6% | 281% |
| 59 | Twiggs Money Flow Sıfır Kesişimi (21) | 4h | RVOL>1.5 + Piyasa hacmi ≥ %50 dilim | +120.7% | 185% | +29.0% | +30.6% | 281% |
| 60 | Hacim Osilatörü Sıfır Kesişimi (5,20) | 1d | MACD tersi + ROC tersi | +119.7% | 186% | +36.8% | +40.7% | 281% |
| 61 | MFI Aşırılık Dönüşü (14) | 1d | RVOL>1.5 + BTC dolar hacmi ≥ %50 dilim | +119.3% | 103% | +51.9% | +67.5% | 281% |
| 62 | MFI Aşırılık Dönüşü (14) | 15m | Hacim ortalamanın üstü + ATR% ≥ %120 normal | +116.3% | 141% | +46.6% | +54.0% | 281% |
| 63 | NVI + EMA(200) Trendi | 1h | Dolar hacmi ≥ medyan + RSI 50 tersi | +112.8% | 133% | +47.4% | +58.1% | 281% |
| 64 | WMA Kesişimi (10/30) | 4h | Piyasa genişliği + Dolar hacmi ≥ medyan | +100.8% | 261% | +11.0% | +8.8% | 281% |
| 65 | ADX + DI Kesişimi (14) | 4h | Piyasa genişliği + Supertrend tarafı | +96.6% | 188% | +25.3% | +27.1% | 281% |
| 66 | CCI Aşırılık Dönüşü (20) | 4h | Piyasa genişliği + BTC vol ≥ %50 dilim | +93.2% | 216% | +15.0% | +13.7% | 281% |
| 67 | Klasik Pivot (PP/S1/R1) Sekmesi | 1h | ATR% ≥ %120 normal + ROC tersi | +80.0% | 183% | +25.4% | +26.0% | 281% |
| 68 | Klasik Pivot (PP/S1/R1) Sekmesi | 1h | ATR% ≥ %120 normal | +75.6% | 197% | +22.5% | +21.8% | 281% |
| 69 | Ultimate Oscillator Dönüşü | 4h | RVOL>1.5 + Kendi momentumu (30g) | +70.4% | 150% | +15.1% | +16.0% | 281% |
| 70 | Tarihsel Volatilite Düşüş Filtresi | 1h | LinReg eğimi + MACD tersi | +66.4% | 234% | +10.1% | +9.5% | 281% |
| 71 | Hacim Osilatörü Sıfır Kesişimi (5,20) | 4h | Piyasa genişliği + Stokastik %K/%D | +63.5% | 361% | +0.8% | -4.0% | 281% |
| 72 | Klasik Pivot (PP/S1/R1) Sekmesi | 15m | ATR% ≥ %120 normal + Hacim ortalamanın üstü | +61.2% | 250% | +17.0% | +11.4% | 281% |
| 73 | Klasik Pivot (PP/S1/R1) Sekmesi | 4h | ATR% ≥ %120 normal | +59.9% | 217% | +16.2% | +15.5% | 281% |
| 74 | Klasik Pivot (PP/S1/R1) Sekmesi | 4h | ATR% ≥ %120 normal + ATR% ≥ %80 normal | +59.9% | 217% | +16.2% | +15.5% | 281% |
| 75 | Likidite Süpürme + Geri Alım | 4h | Stokastik %K/%D + Hafta sonu yasağı | +58.5% | 255% | +17.5% | +16.3% | 281% |
| 76 | %B Aşırılık Dönüşü | 1h | BTC 7g getirisi + ABD seansı (13-21 UTC) | +49.7% | 222% | +18.7% | +18.4% | 281% |
| 77 | Bollinger Ortalamaya Dönüş (20, 2) | 1h | BTC 7g getirisi + ABD seansı (13-21 UTC) | +49.7% | 222% | +18.7% | +18.4% | 281% |
| 78 | Pin Bar / Çekiç Dönüşü | 1d | Piyasa genişliği | +25.1% | 159% | +10.0% | +10.2% | 281% |

### 3b.2 BTC-göreli varyantı geçen adaylar (BTC'den daha az gün-bağımlı)

| # | Strateji | TF | Varyant | Net kâr | Top5 gün | BTC top5 | Fark |
|---|---|---|---|---|---|---|---|
| 1 | NVI + EMA(200) Trendi | 4h | temel | +1573.4% | 137% | 281% | -144 puan |
| 2 | Supertrend Dönüşü (10, 3) | 4h | temel | +1064.4% | 209% | 281% | -72 puan |
| 3 | Chaikin Oscillator Sıfır Kesişimi | 4h | temel | +904.2% | 223% | 281% | -58 puan |
| 4 | Aroon Eşik Kesişimi (25) | 4h | temel | +891.0% | 242% | 281% | -38 puan |
| 5 | EMA Şeridi Hizalanması (13-89) | 4h | temel | +700.2% | 172% | 281% | -109 puan |
| 6 | POC Göçü Trendi (yaklaşım) | 4h | temel | +647.0% | 174% | 281% | -106 puan |
| 7 | ADX + DI Kesişimi (14) | 4h | temel | +626.8% | 223% | 281% | -58 puan |
| 8 | GMMA Kısa/Uzun Grup Kesişimi | 1h | temel | +609.2% | 268% | 281% | -12 puan |
| 9 | Chaikin Para Akışı Sıfır Kesişimi (20) | 4h | temel | +477.1% | 237% | 281% | -44 puan |
| 10 | PVT + EMA(21) Kesişimi | 4h | Hacim ortalamanın üstü + EMA200 tarafı | +464.9% | 155% | 281% | -126 puan |
| 11 | Twiggs Money Flow Sıfır Kesişimi (21) | 4h | temel | +459.0% | 238% | 281% | -43 puan |
| 12 | MFI Aşırılık Dönüşü (14) | 1d | temel | +455.6% | 95% | 281% | -186 puan |
| 13 | Ultimate Oscillator Dönüşü | 15m | temel | +425.5% | 175% | 281% | -106 puan |
| 14 | Çoklu Zaman Dilimi Trend + EMA(20) Tetiği | 4h | temel | +420.0% | 270% | 281% | -11 puan |
| 15 | Supertrend Dönüşü (10, 3) | 4h | Piyasa hacmi ≥ %50 dilim + EMA200 tarafı | +414.6% | 165% | 281% | -116 puan |
| 16 | PVT + EMA(21) Kesişimi | 4h | Hacim ortalamanın üstü + Kendi momentumu (30g) | +411.2% | 161% | 281% | -120 puan |
| 17 | Williams %R Dönüşü (14) | 1d | temel | +388.8% | 156% | 281% | -124 puan |
| 18 | DPO Sıfır Kesişimi (20) | 1d | Dolar hacmi ≥ medyan | +385.8% | 141% | 281% | -139 puan |
| 19 | Supertrend Dönüşü (10, 3) | 4h | Piyasa hacmi ≥ %50 dilim + Kendi momentumu (30g) | +355.4% | 165% | 281% | -115 puan |
| 20 | Aroon Eşik Kesişimi (25) | 4h | Kendi momentumu (30g) + BTC dolar hacmi ≥ %50 dilim | +330.1% | 184% | 281% | -97 puan |
| 21 | DPO Sıfır Kesişimi (20) | 1d | Dolar hacmi ≥ medyan + Hafta sonu yasağı | +317.5% | 133% | 281% | -147 puan |
| 22 | Awesome Oscillator Sıfır Kesişimi | 4h | EMA200 tarafı + CMF pozitifliği | +301.0% | 219% | 281% | -62 puan |
| 23 | A/D Çizgisi + EMA(21) | 4h | RVOL>1.5 + BTC düşüş >%25 → long yasak | +296.6% | 172% | 281% | -108 puan |
| 24 | Parabolic SAR Dönüşü | 4h | Hafta sonu yasağı + Momentum(10) yönü | +284.0% | 241% | 281% | -40 puan |
| 25 | Twiggs Money Flow Sıfır Kesişimi (21) | 4h | RVOL>1.5 + BTC düşüş >%25 → long yasak | +258.3% | 170% | 281% | -111 puan |
| 26 | Ultimate Oscillator Dönüşü | 15m | ATR% ≥ %120 normal + Hacim ortalamanın üstü | +255.4% | 136% | 281% | -145 puan |
| 27 | Ultimate Oscillator Dönüşü | 15m | ATR% ≥ %120 normal + RVOL>1.5 | +252.2% | 129% | 281% | -152 puan |
| 28 | SMA Kesişimi (10/30) | 4h | Supertrend tarafı + Kendi momentumu (30g) | +225.4% | 211% | 281% | -70 puan |
| 29 | A/D Çizgisi + EMA(21) | 4h | RVOL>1.5 + Hafta sonu yasağı | +221.9% | 164% | 281% | -117 puan |
| 30 | Çoklu Zaman Dilimi Trend + EMA(20) Tetiği | 4h | Momentum(10) yönü + BTC düşüş >%20 → sadece long | +208.5% | 245% | 281% | -36 puan |
| 31 | NVI + EMA(200) Trendi | 4h | ATR% ≥ %120 normal + RSI aşırı bölge yasağı | +207.4% | 121% | 281% | -160 puan |
| 32 | Aroon Eşik Kesişimi (25) | 4h | Kendi momentumu (30g) + Stokastik %K/%D | +206.0% | 225% | 281% | -56 puan |
| 33 | Momentum Sıfır Kesişimi (10) | 1d | Piyasa genişliği + Hafta sonu yasağı | +202.1% | 226% | 281% | -55 puan |
| 34 | Aroon Eşik Kesişimi (25) | 4h | Kendi momentumu (30g) + Supertrend tarafı | +201.6% | 232% | 281% | -49 puan |
| 35 | Twiggs Money Flow Sıfır Kesişimi (21) | 4h | RVOL>1.5 + Hafta sonu yasağı | +193.3% | 161% | 281% | -119 puan |
| 36 | DPO Sıfır Kesişimi (20) | 1d | Hacim ortalamanın üstü | +192.7% | 150% | 281% | -131 puan |
| 37 | POC Göçü Trendi (yaklaşım) | 4h | Üst TF trend (×4) + BTC düşüş >%20 → sadece long | +190.2% | 173% | 281% | -108 puan |
| 38 | MACD Sinyal Kesişimi | 4h | Hafta sonu yasağı + Hacim osilatörü | +176.1% | 267% | 281% | -13 puan |
| 39 | RVI Sinyal Kesişimi (10) | 1d | Hafta sonu yasağı + Kendi momentumu (30g) | +175.3% | 232% | 281% | -49 puan |
| 40 | CCI Aşırılık Dönüşü (20) | 1w | temel | +169.3% | 135% | 281% | -146 puan |
| 41 | Chaikin Oscillator Sıfır Kesişimi | 4h | RVOL>1.5 | +166.7% | 191% | 281% | -90 puan |
| 42 | Chaikin Oscillator Sıfır Kesişimi | 4h | RVOL>1.5 + Hacim ortalamanın üstü | +166.7% | 191% | 281% | -90 puan |
| 43 | Williams %R Dönüşü (14) | 1w | temel | +164.2% | 141% | 281% | -140 puan |
| 44 | RVI Sinyal Kesişimi (10) | 1d | Piyasa genişliği + Hafta sonu yasağı | +160.8% | 243% | 281% | -38 puan |
| 45 | Williams %R Dönüşü (14) | 1w | Piyasa hacmi ≥ %50 dilim + ROC tersi | +158.7% | 127% | 281% | -154 puan |
| 46 | EMA(50) Trendi + NATR Yüzde Stopu | 4h | Hacim ortalamanın üstü + Hafta sonu yasağı | +156.4% | 231% | 281% | -50 puan |
| 47 | NVI + EMA(200) Trendi | 4h | ATR% ≥ %120 normal + BTC düşüş >%25 → long yasak | +155.6% | 127% | 281% | -154 puan |
| 48 | Chaikin Oscillator Sıfır Kesişimi | 4h | RVOL>1.5 + Hafta sonu yasağı | +151.8% | 188% | 281% | -93 puan |
| 49 | Chaikin Para Akışı Sıfır Kesişimi (20) | 4h | RVOL>1.5 | +142.5% | 190% | 281% | -91 puan |
| 50 | Chaikin Para Akışı Sıfır Kesişimi (20) | 4h | RVOL>1.5 + Hacim ortalamanın üstü | +142.5% | 190% | 281% | -91 puan |
| 51 | SMI Aşırılık Dönüşü (14,3) | 4h | Piyasa genişliği + Hafta sonu yasağı | +137.9% | 215% | 281% | -66 puan |
| 52 | HMA(20) Fiyat Kesişimi | 1d | BTC dolar hacmi ≥ %50 dilim + Piyasa hacmi ≥ %50 dilim | +136.7% | 149% | 281% | -132 puan |
| 53 | Williams %R Dönüşü (14) | 1w | Piyasa hacmi ≥ %50 dilim | +136.6% | 134% | 281% | -146 puan |
| 54 | Williams %R Dönüşü (14) | 4h | RVOL>1.5 + Piyasa genişliği | +135.9% | 147% | 281% | -134 puan |
| 55 | Williams %R Dönüşü (14) | 4h | RVOL>1.5 + Piyasa genişliği + Hacim ortalamanın üstü | +135.9% | 147% | 281% | -134 puan |
| 56 | Williams %R Dönüşü (14) | 1w | Hacim ortalamanın üstü + ROC tersi | +132.2% | 120% | 281% | -161 puan |
| 57 | Williams %R Dönüşü (14) | 1d | Piyasa genişliği | +128.4% | 160% | 281% | -121 puan |
| 58 | Williams %R Dönüşü (14) | 1d | Piyasa genişliği + MACD tersi | +127.4% | 158% | 281% | -123 puan |
| 59 | SMI Aşırılık Dönüşü (14,3) | 1d | Piyasa genişliği + ROC tersi | +124.7% | 124% | 281% | -157 puan |
| 60 | Chaikin Para Akışı Sıfır Kesişimi (20) | 4h | Hacim ortalamanın üstü + Hafta sonu yasağı | +122.4% | 217% | 281% | -64 puan |
| 61 | Tarihsel Volatilite Düşüş Filtresi | 1h | Piyasa genişliği + Supertrend tarafı | +120.9% | 225% | 281% | -56 puan |
| 62 | Twiggs Money Flow Sıfır Kesişimi (21) | 4h | RVOL>1.5 + Piyasa hacmi ≥ %50 dilim | +120.7% | 185% | 281% | -96 puan |
| 63 | Hacim Osilatörü Sıfır Kesişimi (5,20) | 1d | MACD tersi + ROC tersi | +119.7% | 186% | 281% | -94 puan |
| 64 | MFI Aşırılık Dönüşü (14) | 1d | RVOL>1.5 + BTC dolar hacmi ≥ %50 dilim | +119.3% | 103% | 281% | -177 puan |
| 65 | MFI Aşırılık Dönüşü (14) | 15m | Hacim ortalamanın üstü + ATR% ≥ %120 normal | +116.3% | 141% | 281% | -140 puan |
| 66 | NVI + EMA(200) Trendi | 1h | Dolar hacmi ≥ medyan + RSI 50 tersi | +112.8% | 133% | 281% | -148 puan |
| 67 | WMA Kesişimi (10/30) | 4h | Piyasa genişliği + Dolar hacmi ≥ medyan | +100.8% | 261% | 281% | -20 puan |
| 68 | ADX + DI Kesişimi (14) | 4h | Piyasa genişliği + Supertrend tarafı | +96.6% | 188% | 281% | -93 puan |
| 69 | CCI Aşırılık Dönüşü (20) | 4h | Piyasa genişliği + BTC vol ≥ %50 dilim | +93.2% | 216% | 281% | -65 puan |
| 70 | Klasik Pivot (PP/S1/R1) Sekmesi | 1h | ATR% ≥ %120 normal + ROC tersi | +80.0% | 183% | 281% | -98 puan |
| 71 | Klasik Pivot (PP/S1/R1) Sekmesi | 1h | ATR% ≥ %120 normal | +75.6% | 197% | 281% | -84 puan |
| 72 | Ultimate Oscillator Dönüşü | 4h | RVOL>1.5 + Kendi momentumu (30g) | +70.4% | 150% | 281% | -130 puan |
| 73 | Tarihsel Volatilite Düşüş Filtresi | 1h | LinReg eğimi + MACD tersi | +66.4% | 234% | 281% | -47 puan |
| 74 | Klasik Pivot (PP/S1/R1) Sekmesi | 15m | ATR% ≥ %120 normal + Hacim ortalamanın üstü | +61.2% | 250% | 281% | -31 puan |
| 75 | Klasik Pivot (PP/S1/R1) Sekmesi | 4h | ATR% ≥ %120 normal | +59.9% | 217% | 281% | -64 puan |
| 76 | Klasik Pivot (PP/S1/R1) Sekmesi | 4h | ATR% ≥ %120 normal + ATR% ≥ %80 normal | +59.9% | 217% | 281% | -64 puan |
| 77 | Likidite Süpürme + Geri Alım | 4h | Stokastik %K/%D + Hafta sonu yasağı | +58.5% | 255% | 281% | -26 puan |
| 78 | %B Aşırılık Dönüşü | 1h | BTC 7g getirisi + ABD seansı (13-21 UTC) | +49.7% | 222% | 281% | -59 puan |
| 79 | Bollinger Ortalamaya Dönüş (20, 2) | 1h | BTC 7g getirisi + ABD seansı (13-21 UTC) | +49.7% | 222% | 281% | -59 puan |
| 80 | Pin Bar / Çekiç Dönüşü | 1d | Piyasa genişliği | +25.1% | 159% | 281% | -122 puan |

> Bu iki liste `HOMOJENLIK.html` üzerinde "Katman" filtresiyle ayrıca görüntülenebilir; `out/homojenlik.csv` içinde `top10_pass`, `btc_rel_pass`, `katman` kolonları vardır.

## 4. Homojen Adaylar (tüm kriterleri geçenler)

Bu kriter setiyle **hiçbir durum tüm kriterleri geçemedi**. Kritik ayrıntı: eşiğe yakın adayların (aşağı bakınız) **ortak tek eksiği** — "en iyi %5 günün payı ≤ %40" ölçütü. Yani birçok durum ay-ay/yıl-yıl tutarlı ve zaman içinde lineere yakın ilerliyor, ancak kâr toplamı yine de az sayıda günün sırtında. En yakın adaylar §5'te.

> Not: Buradaki “hiçbiri” **orijinal** ölçüt 4 (%40) içindir. Ölçüt 4’ü alternatif tanımlarla değiştirince 6/6 geçen aday sayısı **78** (alt-10 artımlı) veya **80** (BTC-göreli) olur; ayrıntı ve tam listeler §3b’de.

## 5. Eşiğe Yakın Adaylar (tek kriter eksik)

| Strateji | TF | Varyant | Eksik | Net kâr | Poz ay | Top1 ay | Top5 gün | R² | Maks DD |
|---|---|---|---|---|---|---|---|---|---|
| MFI Aşırılık Dönüşü (14) | 1d | RVOL>1.5 + BTC dolar hacmi ≥ %50 dilim | top5Gün≤%40 | +119.3% | 66% | 15% | 103% | 0.92 | -3.6% |
| MFI Aşırılık Dönüşü (14) | 1d | temel | top5Gün≤%40 | +455.6% | 66% | 20% | 95% | 0.88 | -7.8% |
| Williams %R Dönüşü (14) | 1w | Hacim ortalamanın üstü + ROC tersi | top5Gün≤%40 | +132.2% | 62% | 21% | 120% | 0.86 | -6.4% |
| NVI + EMA(200) Trendi | 4h | ATR% ≥ %120 normal + RSI aşırı bölge yasağı | top5Gün≤%40 | +207.4% | 62% | 24% | 121% | 0.81 | -9.3% |
| Williams %R Dönüşü (14) | 1w | Piyasa hacmi ≥ %50 dilim + ROC tersi | top5Gün≤%40 | +158.7% | 64% | 21% | 127% | 0.85 | -13.9% |
| NVI + EMA(200) Trendi | 4h | ATR% ≥ %120 normal + BTC düşüş >%25 → long yasak | top5Gün≤%40 | +155.6% | 64% | 22% | 127% | 0.84 | -14.5% |
| SMI Aşırılık Dönüşü (14,3) | 1d | Piyasa genişliği + ROC tersi | top5Gün≤%40 | +124.7% | 60% | 25% | 124% | 0.84 | -13.3% |
| NVI + EMA(200) Trendi | 1h | Dolar hacmi ≥ medyan + RSI 50 tersi | top5Gün≤%40 | +112.8% | 62% | 23% | 133% | 0.93 | -16.8% |
| NVI + EMA(200) Trendi | 4h | temel | top5Gün≤%40 | +1573.4% | 74% | 15% | 137% | 0.96 | -28.2% |
| DPO Sıfır Kesişimi (20) | 1d | Dolar hacmi ≥ medyan + Hafta sonu yasağı | top5Gün≤%40 | +317.5% | 62% | 32% | 133% | 0.86 | -13.4% |
| MFI Aşırılık Dönüşü (14) | 15m | Hacim ortalamanın üstü + ATR% ≥ %120 normal | top5Gün≤%40 | +116.3% | 70% | 15% | 141% | 0.86 | -16.0% |
| Williams %R Dönüşü (14) | 1w | Piyasa hacmi ≥ %50 dilim | top5Gün≤%40 | +136.6% | 64% | 22% | 134% | 0.85 | -17.3% |
| HMA(20) Fiyat Kesişimi | 1d | BTC dolar hacmi ≥ %50 dilim + Piyasa hacmi ≥ %50 dilim | top5Gün≤%40 | +136.7% | 62% | 21% | 149% | 0.90 | -8.3% |
| Ultimate Oscillator Dönüşü | 15m | ATR% ≥ %120 normal + RVOL>1.5 | top5Gün≤%40 | +252.2% | 66% | 12% | 129% | 0.84 | -25.7% |
| DPO Sıfır Kesişimi (20) | 1d | Hacim ortalamanın üstü | top5Gün≤%40 | +192.7% | 66% | 21% | 150% | 0.87 | -12.2% |

### 5b. En Az Gün-Bağımlı Adaylar (yalnız top5 ölçütüne takılanlar)

| Strateji | TF | Varyant | Top5 gün payı | Poz ay | Top1 ay | R² | Maks DD | Net kâr | İşlem |
|---|---|---|---|---|---|---|---|---|---|
| MFI Aşırılık Dönüşü (14) | 1d | temel | 95% | 66% | 20% | 0.88 | -7.8% | +455.6% | 4379 |
| MFI Aşırılık Dönüşü (14) | 1d | RVOL>1.5 + BTC dolar hacmi ≥ %50 dilim | 103% | 66% | 15% | 0.92 | -3.6% | +119.3% | 1008 |
| Williams %R Dönüşü (14) | 1w | Hacim ortalamanın üstü + ROC tersi | 120% | 62% | 21% | 0.86 | -6.4% | +132.2% | 780 |
| NVI + EMA(200) Trendi | 4h | ATR% ≥ %120 normal + RSI aşırı bölge yasağı | 121% | 62% | 24% | 0.81 | -9.3% | +207.4% | 13122 |
| SMI Aşırılık Dönüşü (14,3) | 1d | Piyasa genişliği + ROC tersi | 124% | 60% | 25% | 0.84 | -13.3% | +124.7% | 3515 |
| NVI + EMA(200) Trendi | 4h | ATR% ≥ %120 normal + BTC düşüş >%25 → long yasak | 127% | 64% | 22% | 0.84 | -14.5% | +155.6% | 13734 |
| Williams %R Dönüşü (14) | 1w | Piyasa hacmi ≥ %50 dilim + ROC tersi | 127% | 64% | 21% | 0.85 | -13.9% | +158.7% | 916 |
| Ultimate Oscillator Dönüşü | 15m | ATR% ≥ %120 normal + RVOL>1.5 | 129% | 66% | 12% | 0.84 | -25.7% | +252.2% | 45242 |
| NVI + EMA(200) Trendi | 1h | Dolar hacmi ≥ medyan + RSI 50 tersi | 133% | 62% | 23% | 0.93 | -16.8% | +112.8% | 58544 |
| DPO Sıfır Kesişimi (20) | 1d | Dolar hacmi ≥ medyan + Hafta sonu yasağı | 133% | 62% | 32% | 0.86 | -13.4% | +317.5% | 17819 |
| Williams %R Dönüşü (14) | 1w | Piyasa hacmi ≥ %50 dilim | 134% | 64% | 22% | 0.85 | -17.3% | +136.6% | 1035 |
| CCI Aşırılık Dönüşü (20) | 1w | temel | 135% | 64% | 25% | 0.86 | -26.4% | +169.3% | 1386 |
| Ultimate Oscillator Dönüşü | 15m | ATR% ≥ %120 normal + Hacim ortalamanın üstü | 136% | 64% | 14% | 0.85 | -26.2% | +255.4% | 52103 |
| NVI + EMA(200) Trendi | 4h | temel | 137% | 74% | 15% | 0.96 | -28.2% | +1573.4% | 56038 |
| Williams %R Dönüşü (14) | 1w | temel | 141% | 60% | 19% | 0.87 | -28.8% | +164.2% | 1513 |

**Eşik duyarlılığı:** Bu grupta top5 eşiğini gevşetirsek — ≤%100: **1**, ≤%150: **20**, ≤%200: **49**, ≤%250: **75** durum "homojen" olurdu. Yani %40 eşiğinin katılığı sonucu belirliyor; %100'ü (kârın tamamının en iyi %5 günde olması) geçen TEK durum yok — bu, crypto trend sistemlerinin yapısal kuyruk bağımlılığıdır.

Uyarı: Tüm pozitifler içinde top5 payı **en düşük** ~%100-105 çıkan örnekler (ör. chop 4h, uo 1w) aslında *tek sıçramalı* bozuk eğrilerdir (pozitif ay oranı %6-16, R² < 0.6) — "az gün-bağımlı" görünüp aslında tanımsız/kırılgan sonuçlardır. Bu yüzden tek başına gün payı değil, altı ölçütün tümü aranır.

## 6. Karşı-Örnekler — "Birkaç Güne Bağlı" Sonuçlar

| Strateji | TF | Varyant | Net kâr | Top5 gün payı | R² | En iyi gün |
|---|---|---|---|---|---|---|
| Wyckoff Yay/Spring Dönüşü | 15m | PSAR tarafı | +0.0% | 24411% | 0.13 | +0.4% |
| Kripto Korku Endeksi Rejim Anahtarı (yaklaşım) | 15m | Trend rejimi (Choppiness<38) | +0.0% | 11382% | 0.00 | +1.0% |
| Chandelier Çıkış Çizgisi (22, 3) | 15m | Yalnız uzama anında | +0.2% | 7259% | 0.01 | +3.2% |
| VWMA(20) Fiyat Kesişimi | 5m | Trend rejimi (Choppiness<38) | +0.4% | 3523% | 0.15 | +1.7% |
| RVI Bölgesi (50) Trendi | 15m | Trend rejimi (Choppiness<38) | +0.7% | 2711% | 0.00 | +2.2% |
| Dalga 3 Devam Kırılımı (yaklaşım) | 5m | ABD seansı (13-21 UTC) | +1.4% | 2606% | 0.54 | +2.6% |
| Force Index EMA(13) Sıfır Kesişimi | 5m | Trend rejimi (Choppiness<38) | +0.7% | 2468% | 0.00 | +1.4% |
| RVI Sinyal Kesişimi (10) | 15m | Trend rejimi (Choppiness<38) | +0.4% | 2339% | 0.04 | +15.4% |

## 7. Sınırlar

- Portföy eğrisi sembollerin eşit ağırlıklı ortalamasıdır; tek bir hesap bakiyesi değildir (boru hattı standardı).
- Aylık/günlük getiriler özkaynak eğrisinden türetilir; işlem maliyetleri ve funding dahildir.
- Bu analiz **veri madenciliği riskini ortadan kaldırmaz**; homojenlik kriterleri seçimden bağımsız uygulanmıştır ama aynı geçmiş veri üzerinde hesaplanmıştır.
- Eğitim amaçlıdır; yatırım tavsiyesi değildir.

> Ham veri: `out/homojenlik.csv` (tüm durumlar) · `out/homojenlik.json` · günlük eğriler: `out/daily/`