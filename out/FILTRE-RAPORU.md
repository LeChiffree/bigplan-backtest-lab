# Filtre Laboratuvarı — Filtre Raporu

Üretim: 2026-10-19 08:19 UTC · Motor: İndikatör Akademi backtest çekirdeği (birebir doğrulandı) · Eğitim/test ayrımı: train < 2025-01-01, test ≥ 2025-01-01

## 1. Yönetici Özeti

| Gösterge | Değer |
|---|---|
| İncelenen hücre (indikatör × zaman dilimi) | 593 |
| Baz durumda negatif hücre | 259 (43.7%) |
| Filtrelerle pozitife dönen hücre | **69** (başlık kriterli: 67) |
| En iyi varyantla iyileşen hücre | **577** (başlık kriterli: 534) |
| Ortalama işlem başına iyileşme (tüm hücreler) | +5.1200% |
| Ortalama işlem başına iyileşme (baz negatif hücreler) | +0.5400% |
| Pozitif hücre oranı | Önce 56.3% → Sonra 68.6% |
| Değerlendirilen tek filtre / kombinasyon | 38368 / 10103 |

**Kabul kriterleri:** seçim yalnızca eğitim döneminde; kabul için test Δ>0, test işlem ≥30 (başlık için ≥100), işlem korunumu ≥%20 ve sembol tutarlılığı gerekir. Bu kriterler aşırı-uyum (overfit) riskini sınırlamak içindir; yine de sonuçlar veri madenciliği içerdiğinden ihtiyatla okunmalıdır.

## 2. Zaman Dilimi Görünümü

| TF | Hücre | Baz negatif | Kurtarılan | İyileşen | Ort. iyileşme |
|---|---|---|---|---|---|
| 5m | 100 | 95 | 6 | 91 | +0.1000% |
| 15m | 100 | 89 | 16 | 98 | +0.1100% |
| 1h | 100 | 47 | 32 | 100 | +0.5500% |
| 4h | 99 | 10 | 8 | 99 | +1.9000% |
| 1d | 98 | 8 | 4 | 97 | +5.8400% |
| 1w | 96 | 10 | 3 | 92 | +23.3200% |

## 3. Doğrulama

Referans rapordaki 600 hücrenin tamamı yeniden üretildi: eşleşen **600/600**, farklı 0.

Motor, komisyon (%0,04 taker), kayma (1bp), gerçek funding ödemeleri ve açılış-barı emir kuralıyla orijinal çekirdeğin aynısıdır. Filtre mekaniği: **çıkış sinyalleri her durumda uygulanır; filtre yalnızca yeni girişi engeller** (engellenen ters dönüşte pozisyon kapanır, karşı yön açılmaz).

## 4. Tek Filtre Ligi (özet)

| # | Filtre | Kategori | Kabul edilen hücre | Ort. trainΔ | Ort. testΔ |
|---|---|---|---|---|---|
| 1 | Piyasa genişliği (`b_breadth`) | BTC / Piyasa | 236 | +0.4300% | +1.8000% |
| 2 | Hacim ortalamanın üstü (`v_above`) | Hacim / Likidite | 173 | +0.6300% | +1.0600% |
| 3 | Kendi momentumu (30g) (`f_own30`) | Göreli Güç | 173 | +0.5600% | +1.3100% |
| 4 | Hafta sonu yasağı (`g_weekend`) | Takvim / Saat | 166 | +0.2500% | +0.4300% |
| 5 | Piyasa hacmi ≥ %50 dilim (`b_mktvol`) | BTC / Piyasa | 139 | +0.9400% | +2.0900% |
| 6 | PSAR tarafı (`t_psar`) | Trend / Rejim | 134 | +0.8400% | +3.2200% |
| 7 | RVOL>1.5 (`v_rvol15`) | Hacim / Likidite | 134 | +0.6300% | +1.4800% |
| 8 | BTC dolar hacmi ≥ %50 dilim (`b_btc_dvol`) | BTC / Piyasa | 128 | +0.3600% | +1.1300% |
| 9 | ROC>0 tarafı (`m_roc`) | Momentum | 124 | +0.6700% | +1.9600% |
| 10 | Stokastik %K/%D (`m_stoch`) | Momentum | 121 | +0.5000% | +1.7600% |
| 11 | Dolar hacmi ≥ medyan (`v_dollarvol`) | Hacim / Likidite | 121 | +0.3200% | +1.0000% |
| 12 | BTC düşüş >%20 → sadece long (`b_btc_dd_x`) | BTC / Piyasa | 115 | +0.1900% | +2.1500% |
| 13 | BTC düşüş >%25 → long yasak (`b_btc_dd`) | BTC / Piyasa | 114 | +0.0300% | +0.3600% |
| 14 | Momentum(10) yönü (`m_mom`) | Momentum | 111 | +0.7600% | +2.1700% |
| 15 | CMF pozitifliği (`v_cmf`) | Hacim / Likidite | 101 | +0.4100% | +1.6400% |
| 16 | Hacim osilatörü (`v_volosc`) | Hacim / Likidite | 97 | +0.6000% | +1.6200% |
| 17 | MFI aşırı bölge yasağı (`v_mfi`) | Hacim / Likidite | 92 | +0.2400% | +1.0900% |
| 18 | Supertrend tarafı (`t_st`) | Trend / Rejim | 91 | +0.7300% | +2.0300% |
| 19 | RSI>50 tarafı (`m_rsi50`) | Momentum | 89 | +0.5700% | +2.4600% |
| 20 | EMA200 tarafı (`t_ema200`) | Trend / Rejim | 87 | +0.3000% | +0.6800% |

## 5. Öne Çıkan Dönüşümler (ilk 20)

| # | İndikatör | TF | Varyant | Önce | Sonra | Getiri farkı | trainΔ | testΔ | test n | koruma |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | StochRSI Kesişimi (0,2/0,8) | 1w | Yalnız uzama anında 🏅 | +209.1700% | +584.8000% | +375.6300% | +51.5800% | +392.9300% | 120 | 21% |
| 2 | Ultimate Oscillator Dönüşü | 1w | Üst TF trend (×4) 🏅 | +101.0300% | +303.0700% | +202.0400% | +50.3200% | +203.4100% | 111 | 28% |
| 3 | PVI + EMA(200) Trendi | 1w | EMA şeridi (13/21/34) + Üst TF trend (×4) + BTC düşüş >%20 → sadece long 🏅 | +32.8300% | +129.9900% | +97.1600% | +2.1900% | +202.6100% | 144 | 23% |
| 4 | Ultimate Oscillator Dönüşü | 1d | Piyasa hacmi ≥ %50 dilim + BTC vol ≥ %50 dilim 🏅 | +111.3500% | +225.0800% | +113.7300% | +39.5300% | +130.6200% | 324 | 34% |
| 5 | GMMA Kısa/Uzun Grup Kesişimi | 1w | BTC düşüş >%20 → sadece long + Aşırı uzamada giriş yok + Kendi momentumu (30g) 🏅 | +118.0400% | +172.9400% | +54.9000% | +0.9000% | +96.3500% | 305 | 60% |
| 6 | ADX + DI Kesişimi (14) | 1w | PSAR tarafı + MFI aşırı bölge yasağı + BTC düşüş >%20 → sadece long 🏅 | +91.0700% | +146.4300% | +55.3600% | +2.9700% | +87.7300% | 264 | 55% |
| 7 | StochRSI Kesişimi (0,2/0,8) | 1d | PSAR tarafı + Yatay rejim (Choppiness>62) 🏅 | +139.4100% | +221.8600% | +82.4500% | +14.4900% | +87.5400% | 977 | 59% |
| 8 | Ulcer Index Sakinlik Filtresi | 1w | Üst TF trend (×4) + Anomali barı yasağı + PSAR tarafı 🏅 | +93.8800% | +145.5900% | +51.7100% | +0.3800% | +81.3700% | 136 | 24% |
| 9 | EMA Kesişimi (12/26) | 1w | EMA şeridi (13/21/34) 🏅 | +81.6000% | +172.4500% | +90.8500% | +6.5300% | +76.8600% | 149 | 21% |
| 10 | Awesome Oscillator Sıfır Kesişimi | 1w | LinReg eğimi + PSAR tarafı 🏅 | +64.1900% | +146.0600% | +81.8700% | +4.4400% | +74.4500% | 223 | 22% |
| 11 | EMA(50) Trendi + ATR Takip Stopu | 1w | PSAR tarafı + Piyasa genişliği + BTC düşüş >%20 → sadece long 🏅 | +41.5700% | +57.0300% | +15.4600% | +2.0500% | +58.1300% | 318 | 50% |
| 12 | Tarihsel Volatilite Düşüş Filtresi | 1w | PSAR tarafı + Piyasa genişliği + BTC düşüş >%20 → sadece long 🏅 | +94.4800% | +117.8800% | +23.4000% | +2.7900% | +51.2600% | 174 | 49% |
| 13 | SMA Kesişimi (10/30) | 1w | LinReg eğimi 🏅 | +48.9900% | +107.6100% | +58.6200% | +11.6100% | +50.3300% | 302 | 28% |
| 14 | EMA(50) Trendi + NATR Yüzde Stopu | 1w | PSAR tarafı + Anomali barı yasağı + BTC’ye göre güç (30g) 🏅 | +50.6100% | +76.5500% | +25.9400% | +3.0500% | +50.2800% | 357 | 43% |
| 15 | HMA(20) Fiyat Kesişimi | 1w | MACD tersi 🏅 | +26.2400% | +75.1500% | +48.9100% | +1.1000% | +49.9800% | 336 | 31% |
| 16 | Donchian Kırılımı (20/10 — Turtle) | 1w | Piyasa hacmi ≥ %50 dilim 🏅 | +52.0300% | +85.3300% | +33.3000% | +0.1200% | +48.2700% | 472 | 67% |
| 17 | CCI Aşırılık Dönüşü (20) | 1w | PSAR tarafı + MACD tersi 🏅 | +27.6500% | +62.2200% | +34.5700% | +5.9400% | +45.2400% | 229 | 23% |
| 18 | 30-Bar Kırılım Sistemi | 1w | BTC düşüş >%20 → sadece long + MACD histogramı + Funding aşırılığı 🏅 | +44.9300% | +46.3100% | +1.3800% | +1.2800% | +42.1600% | 194 | 52% |
| 19 | WMA Kesişimi (10/30) | 1w | LinReg eğimi 🏅 | +57.4800% | +103.4800% | +46.0000% | +2.3300% | +41.5800% | 295 | 25% |
| 20 | Chaikin Para Akışı Sıfır Kesişimi (20) | 1w | Piyasa hacmi ≥ %50 dilim + Genişlik momentumu + MFI aşırı bölge yasağı 🏅 | +16.5900% | +46.7900% | +30.2000% | +2.6300% | +38.6700% | 489 | 24% |

🏅 = başlık kriteri (test işlem ≥100). Getiri farkı = sonra − önce (işlem başına ortalama).

## 6. Kombinasyon Bulguları

- Değerlendirilen kombinasyon sayısı: **10103**
- En iyi varyantı kombinasyon olan hücre: ikili 323, üçlü 45, tek filtre 222

## 7. Kurtarılamayanlar (dürüst liste)

Filtre politikası içinde pozitife dönmeyen baz negatif hücreler en büyükten küçüğe:

| İndikatör | TF | Baz n | Önce | En iyi sonra | En iyi varyant | Durum |
|---|---|---|---|---|---|---|
| Hacim ROC Sıfır Kesişimi (25) | 5m | 41311176 | -0.1000% | -0.0900% | RSI 50 tersi | başlık |
| RVI Sinyal Kesişimi (10) | 5m | 36005553 | -0.1000% | -0.0600% | Trend rejimi (Choppiness<38) | — |
| DPO Sıfır Kesişimi (20) | 5m | 27352587 | -0.0900% | -0.0800% | Yalnız uzama anında | — |
| FVG (Adaletsiz Fiyat Boşluğu) Dolumu | 5m | 22395780 | -0.1000% | -0.1000% | EMA200 tarafı | — |
| RVI Bölgesi (50) Trendi | 5m | 18871557 | -0.1000% | +0.0400% | Trend rejimi (Choppiness<38) | — |
| ROC Sıfır Kesişimi (9) | 5m | 17367689 | -0.1000% | -0.0500% | Trend rejimi (Choppiness<38) | — |
| Momentum Sıfır Kesişimi (10) | 5m | 16554972 | -0.1000% | -0.0400% | Trend rejimi (Choppiness<38) | — |
| Ease of Movement Sıfır Kesişimi (14) | 5m | 16427357 | -0.1000% | -0.0300% | Trend rejimi (Choppiness<38) | — |
| VWMA(20) Fiyat Kesişimi | 5m | 15651325 | -0.1000% | +0.0300% | Yalnız uzama anında | — |
| McGinley Dinamik Eğrisi (14) | 5m | 15637289 | -0.1000% | +0.4600% | Yalnız uzama anında | — |
| Hacim Osilatörü Sıfır Kesişimi (5,20) | 5m | 15424433 | -0.0900% | -0.0700% | ATR% ≥ %120 normal | — |
| Yutan Mum + 3 Asker/Karga | 5m | 15004983 | -0.1000% | -0.1000% | EMA200 tarafı | — |
| Alligator Hizalanması | 5m | 14572503 | -0.5000% | -0.4100% | 30 bar kanalı | başlık |
| LinReg Kanal Orta Çizgisi (50) | 5m | 14250712 | -0.1000% | -0.0100% | Trend rejimi (Choppiness<38) | — |
| OBV + EMA(21) Kesişimi | 5m | 14196509 | -0.1000% | -0.0600% | Trend rejimi (Choppiness<38) | — |
| CMO Sıfır Kesişimi (14) | 5m | 14061464 | -0.1000% | -0.0900% | ABD seansı (13-21 UTC) | başlık |
| A/D Çizgisi + EMA(21) | 5m | 14020699 | -0.1000% | -0.1000% | ATR% ≥ %120 normal | başlık |
| Force Index EMA(13) Sıfır Kesişimi | 5m | 12992572 | -0.1100% | -0.0100% | Trend rejimi (Choppiness<38) | — |
| Hacim ROC Sıfır Kesişimi (25) | 15m | 12834036 | -0.0900% | -0.0900% | EMA200 tarafı | — |
| KVO Sinyal Kesişimi | 5m | 12831230 | -0.1000% | -0.0900% | ATR% ≥ %120 normal | — |

## 8. Sınırlar ve Uyarılar

- Bu çalışma **eğitim amaçlı bir araştırmadır**; yatırım tavsiyesi değildir.
- Filtreler parametre optimizasyonu içermez; yalnızca hazır sinyal setine "kapı" olarak eklenir. Yine de çok sayıda filtre denemesi veri madenciliği yanılsaması yaratabilir; kabul kapıları ve train/test ayrımı bu riski azaltır ama sıfırlamaz.
- Sonuçlar seçilmiş 520 sembol ve 2022-08 → 2026-09 aralığına özgüdür; işlem maliyetleri (%0,04 + 1bp) ve gerçek funding dahildir, ancak likidite/kayma varsayımları idealize değildir — büyük emirlerde gerçek kayma daha yüksek olur.
- F&G endeksi günlük yayınlanır ve bar kapanışıyla hizalanır; gün içi (5m/15m) sinyaller bu bilgiyi yalnızca yayınlandıktan sonra kullanır.
- Pozitife dönen hücrelerin bir kısmı düşük işlem sayılarına dayanabilir; tablolardaki test n ve koruma sütunları bunu denetlemek içindir.

> Detaylı etkileşimli görünüm: `DASHBOARD.html` · Ham veriler: `out/` klasörü.
