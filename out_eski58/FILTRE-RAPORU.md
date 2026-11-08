# Filtre Laboratuvarı — Filtre Raporu

Üretim: 2026-10-18 14:58 UTC · Motor: İndikatör Akademi backtest çekirdeği (birebir doğrulandı) · Eğitim/test ayrımı: train < 2025-01-01, test ≥ 2025-01-01

## 1. Yönetici Özeti

| Gösterge | Değer |
|---|---|
| İncelenen hücre (indikatör × zaman dilimi) | 593 |
| Baz durumda negatif hücre | 263 (44.4%) |
| Filtrelerle pozitife dönen hücre | **61** (başlık kriterli: 59) |
| En iyi varyantla iyileşen hücre | **578** (başlık kriterli: 468) |
| Ortalama işlem başına iyileşme (tüm hücreler) | +4.6100% |
| Ortalama işlem başına iyileşme (baz negatif hücreler) | +0.2700% |
| Pozitif hücre oranı | Önce 55.6% → Sonra 66.4% |
| Değerlendirilen tek filtre / kombinasyon | 38290 / 9441 |

**Kabul kriterleri:** seçim yalnızca eğitim döneminde; kabul için test Δ>0, test işlem ≥30 (başlık için ≥100), işlem korunumu ≥%20 ve sembol tutarlılığı gerekir. Bu kriterler aşırı-uyum (overfit) riskini sınırlamak içindir; yine de sonuçlar veri madenciliği içerdiğinden ihtiyatla okunmalıdır.

## 2. Zaman Dilimi Görünümü

| TF | Hücre | Baz negatif | Kurtarılan | İyileşen | Ort. iyileşme |
|---|---|---|---|---|---|
| 5m | 100 | 94 | 4 | 91 | +0.1100% |
| 15m | 100 | 90 | 11 | 99 | +0.3300% |
| 1h | 100 | 61 | 36 | 100 | +0.7100% |
| 4h | 99 | 9 | 6 | 98 | +1.2200% |
| 1d | 98 | 4 | 2 | 97 | +6.2300% |
| 1w | 96 | 5 | 2 | 93 | +19.9500% |

## 3. Doğrulama

Referans rapordaki 600 hücrenin tamamı yeniden üretildi: eşleşen **600/600**, farklı 0.

Motor, komisyon (%0,04 taker), kayma (1bp), gerçek funding ödemeleri ve açılış-barı emir kuralıyla orijinal çekirdeğin aynısıdır. Filtre mekaniği: **çıkış sinyalleri her durumda uygulanır; filtre yalnızca yeni girişi engeller** (engellenen ters dönüşte pozisyon kapanır, karşı yön açılmaz).

## 4. Tek Filtre Ligi (özet)

| # | Filtre | Kategori | Kabul edilen hücre | Ort. trainΔ | Ort. testΔ |
|---|---|---|---|---|---|
| 1 | BTC düşüş >%20 → sadece long (`b_btc_dd_x`) | BTC / Piyasa | 200 | +0.2200% | +1.8000% |
| 2 | Kendi momentumu (30g) (`f_own30`) | Göreli Güç | 191 | +0.7100% | +0.9000% |
| 3 | Hacim ortalamanın üstü (`v_above`) | Hacim / Likidite | 184 | +1.2000% | +1.3100% |
| 4 | Hafta sonu yasağı (`g_weekend`) | Takvim / Saat | 146 | +0.2400% | +0.5300% |
| 5 | Hacim osilatörü (`v_volosc`) | Hacim / Likidite | 139 | +0.6600% | +1.0200% |
| 6 | PSAR tarafı (`t_psar`) | Trend / Rejim | 132 | +0.5900% | +1.8700% |
| 7 | RVOL>1.5 (`v_rvol15`) | Hacim / Likidite | 129 | +0.9400% | +1.6800% |
| 8 | EMA200 tarafı (`t_ema200`) | Trend / Rejim | 129 | +0.3600% | +0.6200% |
| 9 | Piyasa hacmi ≥ %50 dilim (`b_mktvol`) | BTC / Piyasa | 123 | +0.9900% | +1.2600% |
| 10 | Dolar hacmi ≥ medyan (`v_dollarvol`) | Hacim / Likidite | 123 | +0.6900% | +1.0300% |
| 11 | BTC 4h trendi (`b_btc_4h`) | BTC / Piyasa | 118 | +0.7200% | +1.0700% |
| 12 | Supertrend tarafı (`t_st`) | Trend / Rejim | 117 | +0.9100% | +2.1700% |
| 13 | Stokastik %K/%D (`m_stoch`) | Momentum | 117 | +0.8200% | +1.1100% |
| 14 | BTC 7g getirisi (`b_btc_ret7d`) | BTC / Piyasa | 114 | +1.2500% | +1.8900% |
| 15 | ROC>0 tarafı (`m_roc`) | Momentum | 112 | +0.6800% | +1.8800% |
| 16 | OBV / EMA21 (`v_obv`) | Hacim / Likidite | 111 | +1.1300% | +2.1600% |
| 17 | Force Index yönü (`v_force`) | Hacim / Likidite | 107 | +0.5700% | +1.2600% |
| 18 | BTC düşüş >%25 → long yasak (`b_btc_dd`) | BTC / Piyasa | 107 | +0.0300% | +0.2500% |
| 19 | EMA şeridi (13/21/34) (`t_ribbon`) | Trend / Rejim | 103 | +0.2800% | +0.7300% |
| 20 | Genişlik momentumu (`b_breadth_mom`) | BTC / Piyasa | 97 | +0.9200% | +1.5500% |

## 5. Öne Çıkan Dönüşümler (ilk 20)

| # | İndikatör | TF | Varyant | Önce | Sonra | Getiri farkı | trainΔ | testΔ | test n | koruma |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | StochRSI Kesişimi (0,2/0,8) | 1d | Hacim osilatörü + BTC 7g getirisi 🏅 | +88.0900% | +186.0900% | +98.0000% | +1.5200% | +125.4400% | 112 | 57% |
| 2 | Choppiness Trend Filtresi (38) | 15m | LinReg eğimi + Yalnız uzama anında 🏅 | +15.0500% | +39.0700% | +24.0200% | +4.0000% | +36.9400% | 131 | 30% |
| 3 | Aroon Eşik Kesişimi (25) | 1w | MFI aşırı bölge yasağı + BTC düşüş >%20 → sadece long 🏅 | +49.7400% | +62.3900% | +12.6500% | +2.5600% | +28.9800% | 113 | 79% |
| 4 | PVI + EMA(200) Trendi | 1d | Hacim ortalamanın üstü + BTC vol ≥ %50 dilim 🏅 | +8.5000% | +23.2000% | +14.7000% | +3.1500% | +26.2300% | 152 | 21% |
| 5 | StochRSI Kesişimi (0,2/0,8) | 4h | ROC>0 tarafı + ADX>25 + yön 🏅 | +14.4900% | +28.5400% | +14.0500% | +0.7000% | +23.3200% | 406 | 41% |
| 6 | NVI + EMA(200) Trendi | 1d | ROC tersi + Yatay rejim (Choppiness>62) 🏅 | +6.6100% | +17.1800% | +10.5700% | +1.2300% | +22.3000% | 107 | 21% |
| 7 | CMO Sıfır Kesişimi (14) | 1w | Supertrend tarafı + Stokastik %K/%D 🏅 | +11.3600% | +26.9200% | +15.5600% | +4.1700% | +21.4700% | 131 | 29% |
| 8 | Ease of Movement Sıfır Kesişimi (14) | 1w | LinReg eğimi + BTC 4h trendi 🏅 | +12.8700% | +31.0900% | +18.2200% | +7.7200% | +20.9100% | 112 | 26% |
| 9 | Vortex Kesişimi (14) | 1w | Supertrend tarafı + BTC 4h trendi 🏅 | +12.9200% | +31.2100% | +18.2900% | +13.0700% | +20.1000% | 122 | 31% |
| 10 | GMMA Kısa/Uzun Grup Kesişimi | 1d | RVOL>1.5 + Aroon yönü 🏅 | +14.1800% | +29.9900% | +15.8100% | +7.3000% | +19.4900% | 165 | 27% |
| 11 | EMA Şeridi Hizalanması (13-89) | 4h | ATR% ≥ %120 normal + Kendi momentumu (30g) 🏅 | +5.8400% | +16.7000% | +10.8600% | +5.6200% | +17.4300% | 280 | 21% |
| 12 | OBV + EMA(21) Kesişimi | 1w | Kendi momentumu (30g) + BTC 7g getirisi + Supertrend tarafı 🏅 | +7.5300% | +18.7000% | +11.1700% | +3.2700% | +17.1900% | 125 | 24% |
| 13 | A/D Çizgisi + EMA(21) | 1w | OBV / EMA21 + Üst TF trend tersi + Anomali barı yasağı 🏅 | +10.4100% | +20.9500% | +10.5400% | +0.4700% | +17.0900% | 125 | 30% |
| 14 | RVI Bölgesi (50) Trendi | 1w | PSAR tarafı + Piyasa hacmi ≥ %50 dilim 🏅 | +10.6600% | +24.3700% | +13.7100% | +5.7900% | +16.3500% | 137 | 25% |
| 15 | TSI Sinyal Kesişimi (25,13) | 1w | MACD tersi + OBV / EMA21 🏅 | +17.3800% | +32.3600% | +14.9800% | +9.1300% | +15.2800% | 113 | 27% |
| 16 | ROC Sıfır Kesişimi (9) | 1w | Piyasa hacmi ≥ %50 dilim + Supertrend tarafı 🏅 | +9.7700% | +23.5800% | +13.8100% | +10.1100% | +14.9800% | 123 | 20% |
| 17 | Chaikin Para Akışı Sıfır Kesişimi (20) | 1w | Genişlik momentumu + Sinyal barı yönü + 5 göstergeden 3 oy 🏅 | +5.2700% | +15.6700% | +10.4000% | +2.7800% | +14.2300% | 126 | 38% |
| 18 | McGinley Dinamik Eğrisi (14) | 1w | TSI yönü + Force Index yönü + MFI aşırı bölge yasağı 🏅 | +4.0800% | +11.7300% | +7.6500% | +0.4000% | +14.0700% | 146 | 36% |
| 19 | Hacim Osilatörü Sıfır Kesişimi (5,20) | 1w | BTC 7g getirisi + BTC’ye göre güç (30g) 🏅 | +8.6600% | +21.0400% | +12.3800% | +10.9000% | +13.8700% | 138 | 30% |
| 20 | Williams %R Dönüşü (14) | 1w | Hacim ortalamanın üstü + RSI 50 tersi 🏅 | +20.7200% | +32.0800% | +11.3600% | +7.7300% | +13.2900% | 110 | 54% |

🏅 = başlık kriteri (test işlem ≥100). Getiri farkı = sonra − önce (işlem başına ortalama).

## 6. Kombinasyon Bulguları

- Değerlendirilen kombinasyon sayısı: **9441**
- En iyi varyantı kombinasyon olan hücre: ikili 288, üçlü 46, tek filtre 255

## 7. Kurtarılamayanlar (dürüst liste)

Filtre politikası içinde pozitife dönmeyen baz negatif hücreler en büyükten küçüğe:

| İndikatör | TF | Baz n | Önce | En iyi sonra | En iyi varyant | Durum |
|---|---|---|---|---|---|---|
| Hacim ROC Sıfır Kesişimi (25) | 5m | 6007411 | -0.1000% | -0.0900% | RSI 50 tersi | başlık |
| RVI Sinyal Kesişimi (10) | 5m | 5552982 | -0.1000% | -0.0900% | Trend rejimi (Choppiness<38) | — |
| DPO Sıfır Kesişimi (20) | 5m | 4226928 | -0.0900% | -0.0800% | Yalnız uzama anında | — |
| FVG (Adaletsiz Fiyat Boşluğu) Dolumu | 5m | 3479372 | -0.1000% | -0.1000% | EMA200 tarafı | — |
| RVI Bölgesi (50) Trendi | 5m | 3002871 | -0.1000% | -0.0200% | Trend rejimi (Choppiness<38) | — |
| ROC Sıfır Kesişimi (9) | 5m | 2719640 | -0.1000% | -0.0700% | Trend rejimi (Choppiness<38) | — |
| Ease of Movement Sıfır Kesişimi (14) | 5m | 2635150 | -0.1000% | -0.0500% | Trend rejimi (Choppiness<38) | — |
| Momentum Sıfır Kesişimi (10) | 5m | 2594673 | -0.1000% | -0.0600% | Yalnız uzama anında | — |
| McGinley Dinamik Eğrisi (14) | 5m | 2513918 | -0.1000% | +0.3700% | Yalnız uzama anında | — |
| Yutan Mum + 3 Asker/Karga | 5m | 2459376 | -0.1000% | -0.1000% | EMA50/200 hizası | — |
| VWMA(20) Fiyat Kesişimi | 5m | 2423484 | -0.1000% | +0.0000% | Yalnız uzama anında | — |
| OBV + EMA(21) Kesişimi | 5m | 2292874 | -0.1000% | -0.1000% | ABD seansı (13-21 UTC) | başlık |
| Hacim Osilatörü Sıfır Kesişimi (5,20) | 5m | 2290237 | -0.0900% | -0.0700% | ATR% ≥ %120 normal | — |
| Alligator Hizalanması | 5m | 2258691 | -0.4500% | -0.3700% | 30 bar kanalı | başlık |
| A/D Çizgisi + EMA(21) | 5m | 2250489 | -0.1000% | -0.1000% | EMA200 tarafı | — |
| CMO Sıfır Kesişimi (14) | 5m | 2207076 | -0.1000% | -0.0300% | Trend rejimi (Choppiness<38) | — |
| LinReg Kanal Orta Çizgisi (50) | 5m | 2193631 | -0.1000% | -0.0500% | Trend rejimi (Choppiness<38) | — |
| Force Index EMA(13) Sıfır Kesişimi | 5m | 2068081 | -0.1100% | -0.0700% | Yalnız uzama anında | — |
| KVO Sinyal Kesişimi | 5m | 2001655 | -0.1000% | -0.1000% | EMA200 tarafı | — |
| Chaikin Oscillator Sıfır Kesişimi | 5m | 1955147 | -0.1100% | -0.1000% | Üst TF trend (×4) | — |

## 8. Sınırlar ve Uyarılar

- Bu çalışma **eğitim amaçlı bir araştırmadır**; yatırım tavsiyesi değildir.
- Filtreler parametre optimizasyonu içermez; yalnızca hazır sinyal setine "kapı" olarak eklenir. Yine de çok sayıda filtre denemesi veri madenciliği yanılsaması yaratabilir; kabul kapıları ve train/test ayrımı bu riski azaltır ama sıfırlamaz.
- Sonuçlar seçilmiş 58 sembol ve 2022-08 → 2026-09 aralığına özgüdür; işlem maliyetleri (%0,04 + 1bp) ve gerçek funding dahildir, ancak likidite/kayma varsayımları idealize değildir — büyük emirlerde gerçek kayma daha yüksek olur.
- F&G endeksi günlük yayınlanır ve bar kapanışıyla hizalanır; gün içi (5m/15m) sinyaller bu bilgiyi yalnızca yayınlandıktan sonra kullanır.
- Pozitife dönen hücrelerin bir kısmı düşük işlem sayılarına dayanabilir; tablolardaki test n ve koruma sütunları bunu denetlemek içindir.

> Detaylı etkileşimli görünüm: `DASHBOARD.html` · Ham veriler: `out/` klasörü.
