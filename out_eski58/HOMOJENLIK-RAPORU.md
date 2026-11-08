# Homojenlik Raporu — "Kâr birkaç güne mi bağlı?"

Üretim: 2026-10-18 15:20 UTC · Veri: günlük portföy eğrileri (`out/daily/`, 593 hücre × temel + en iyi 3 filtreli varyant)

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
- Varyant işlem sayısı/metrikleri ham depoyla birebir: 1767 varyant, uyuşmazlık **0**.

## 3. Genel Sonuç

| Grup | Durum | Net pozitif | Homojen (tüm kriterler) | Oran |
|---|---|---|---|---|
| Temel (filtresiz) | 593 | 320 | 0 | 0% |
| En iyi filtreli (varyant1) | 589 | 394 | 0 | 0% |
| Kurtarılan hücreler (baz negatif → filtreli pozitif) | 67 | 67 | 0 | 0% |

Not: "kurtarılan" burada günlük portföy eğrisi netine göre tanımlıdır; rapor2'deki işlem-kapılı tanımda (test kapıları) bu sayı 61'di — iki tanım küçük farklarla örtüşür.

**Pozitif sonuçların tipik profili (çarpıcı bulgu):** net pozitif durumlarda en iyi %5 günün kâr payı medyanı **238%**, üst çeyrek eşiği **333%**, en aşırı %5'lik dilim **7621%**. Yani pozitiflerin büyük çoğunluğu az sayıda güne bağımlı.

Net kârı ≥ %50 olan 1071 "ciddi" pozitifte medyan gün payı **222%**; bu grupta gün payı hâlâ ≤ %100 olan: **0** durum (0%).

**Ölçüt bazında geçme oranları (yalnız pozitifler):**

| Ölçüt | Geçen | Oran |
|---|---|---|
| pozAy≥%60 | 269 | 18% |
| top1Ay≤%33 | 669 | 45% |
| top5Gün≤%40 | 0 | 0% |
| R²≥0.80 | 700 | 47% |
| tamYıllar>0 | 519 | 35% |

Beş ölçütü geçip **yalnızca "en iyi %5 gün payı ≤ %40" ölçütüne takılan** durum: **127**. Bu, dayanıklılığın önündeki tek yaygın duvarın **gün bazlı yoğunlaşma** olduğunu gösterir.

## 4. Homojen Adaylar (tüm kriterleri geçenler)

Bu kriter setiyle **hiçbir durum tüm kriterleri geçemedi**. Kritik ayrıntı: eşiğe yakın adayların (aşağı bakınız) **ortak tek eksiği** — "en iyi %5 günün payı ≤ %40" ölçütü. Yani birçok durum ay-ay/yıl-yıl tutarlı ve zaman içinde lineere yakın ilerliyor, ancak kâr toplamı yine de az sayıda günün sırtında. En yakın adaylar §5'te.

## 5. Eşiğe Yakın Adaylar (tek kriter eksik)

| Strateji | TF | Varyant | Eksik | Net kâr | Poz ay | Top1 ay | Top5 gün | R² | Maks DD |
|---|---|---|---|---|---|---|---|---|---|
| MFI Aşırılık Dönüşü (14) | 1d | Yalnız uzama anında + Hafta sonu yasağı | top5Gün≤%40 | +127.7% | 60% | 30% | 127% | 0.88 | -6.0% |
| SMI Aşırılık Dönüşü (14,3) | 1d | Momentum(10) yönü + Hacim osilatörü | top5Gün≤%40 | +149.3% | 66% | 16% | 144% | 0.95 | -8.2% |
| SMI Aşırılık Dönüşü (14,3) | 1d | Hacim osilatörü + Kendi momentumu (30g) | top5Gün≤%40 | +105.5% | 66% | 20% | 158% | 0.89 | -7.5% |
| Kripto Korku Endeksi Rejim Anahtarı (yaklaşım) | 4h | RVOL>1.5 + Hafta sonu yasağı | top5Gün≤%40 | +266.4% | 66% | 11% | 161% | 0.93 | -9.9% |
| Fisher Dönüşü (10) | 1d | Üst TF trend tersi + Hacim osilatörü | top5Gün≤%40 | +159.2% | 66% | 28% | 154% | 0.92 | -20.8% |
| Hacim Osilatörü Sıfır Kesişimi (5,20) | 1d | Piyasa hacmi ≥ %50 dilim + MFI aşırı bölge yasağı | top5Gün≤%40 | +349.6% | 64% | 22% | 151% | 0.93 | -29.3% |
| Williams %R Dönüşü (14) | 1w | temel | top5Gün≤%40 | +308.3% | 64% | 32% | 136% | 0.84 | -37.4% |
| Hacim Osilatörü Sıfır Kesişimi (5,20) | 1d | Piyasa hacmi ≥ %50 dilim | top5Gün≤%40 | +319.1% | 66% | 23% | 156% | 0.93 | -29.2% |
| Kripto Korku Endeksi Rejim Anahtarı (yaklaşım) | 4h | RVOL>1.5 | top5Gün≤%40 | +227.6% | 66% | 12% | 175% | 0.93 | -10.7% |
| Kripto Korku Endeksi Rejim Anahtarı (yaklaşım) | 4h | RVOL>1.5 + Hacim ortalamanın üstü | top5Gün≤%40 | +227.6% | 66% | 12% | 175% | 0.93 | -10.7% |
| Stokastik Kesişimi (14,3,3) | 4h | BTC vol ≥ %50 dilim + Hacim osilatörü + Hafta sonu yasağı | top5Gün≤%40 | +186.3% | 62% | 16% | 163% | 0.87 | -13.9% |
| ADX + DI Kesişimi (14) | 1d | Piyasa hacmi ≥ %50 dilim + Hacim osilatörü | top5Gün≤%40 | +143.4% | 60% | 31% | 169% | 0.89 | -10.2% |
| Zarf Geri Dönüşü (20, %2,5) | 5m | RVOL>1.5 + Aşırı uzamada giriş yok | top5Gün≤%40 | +25.0% | 74% | 24% | 187% | 0.89 | -8.6% |
| Bollinger Ortalamaya Dönüş (20, 2) | 1h | BTC 4h trendi + Kendi momentumu (30g) | top5Gün≤%40 | +91.5% | 60% | 19% | 166% | 0.90 | -18.7% |
| %B Aşırılık Dönüşü | 1h | BTC 4h trendi + Kendi momentumu (30g) | top5Gün≤%40 | +91.5% | 60% | 19% | 166% | 0.90 | -18.7% |

### 5b. En Az Gün-Bağımlı Adaylar (yalnız top5 ölçütüne takılanlar)

| Strateji | TF | Varyant | Top5 gün payı | Poz ay | Top1 ay | R² | Maks DD | Net kâr | İşlem |
|---|---|---|---|---|---|---|---|---|---|
| MFI Aşırılık Dönüşü (14) | 1d | Yalnız uzama anında + Hafta sonu yasağı | 127% | 60% | 30% | 0.88 | -6.0% | +127.7% | 130 |
| Williams %R Dönüşü (14) | 1w | temel | 136% | 64% | 32% | 0.84 | -37.4% | +308.3% | 317 |
| SMI Aşırılık Dönüşü (14,3) | 1d | Momentum(10) yönü + Hacim osilatörü | 144% | 66% | 16% | 0.95 | -8.2% | +149.3% | 528 |
| Hacim Osilatörü Sıfır Kesişimi (5,20) | 1d | Piyasa hacmi ≥ %50 dilim + MFI aşırı bölge yasağı | 151% | 64% | 22% | 0.93 | -29.3% | +349.6% | 2397 |
| Fisher Dönüşü (10) | 1d | Üst TF trend tersi + Hacim osilatörü | 154% | 66% | 28% | 0.92 | -20.8% | +159.2% | 461 |
| Hacim Osilatörü Sıfır Kesişimi (5,20) | 1d | Piyasa hacmi ≥ %50 dilim | 156% | 66% | 23% | 0.93 | -29.2% | +319.1% | 2486 |
| SMI Aşırılık Dönüşü (14,3) | 1d | Hacim osilatörü + Kendi momentumu (30g) | 158% | 66% | 20% | 0.89 | -7.5% | +105.5% | 431 |
| Kripto Korku Endeksi Rejim Anahtarı (yaklaşım) | 4h | RVOL>1.5 + Hafta sonu yasağı | 161% | 66% | 11% | 0.93 | -9.9% | +266.4% | 5174 |
| Stokastik Kesişimi (14,3,3) | 4h | BTC vol ≥ %50 dilim + Hacim osilatörü + Hafta sonu yasağı | 163% | 62% | 16% | 0.87 | -13.9% | +186.3% | 3153 |
| Bollinger Ortalamaya Dönüş (20, 2) | 1h | BTC 4h trendi + Kendi momentumu (30g) | 166% | 60% | 19% | 0.90 | -18.7% | +91.5% | 15832 |
| %B Aşırılık Dönüşü | 1h | BTC 4h trendi + Kendi momentumu (30g) | 166% | 60% | 19% | 0.90 | -18.7% | +91.5% | 15832 |
| ADX + DI Kesişimi (14) | 1d | Piyasa hacmi ≥ %50 dilim + Hacim osilatörü | 169% | 60% | 31% | 0.89 | -10.2% | +143.4% | 436 |
| Kripto Korku Endeksi Rejim Anahtarı (yaklaşım) | 4h | RVOL>1.5 | 175% | 66% | 12% | 0.93 | -10.7% | +227.6% | 5955 |
| Kripto Korku Endeksi Rejim Anahtarı (yaklaşım) | 4h | RVOL>1.5 + Hacim ortalamanın üstü | 175% | 66% | 12% | 0.93 | -10.7% | +227.6% | 5955 |
| CCI Aşırılık Dönüşü (20) | 1d | Üst TF trend tersi + MACD tersi | 185% | 68% | 14% | 0.93 | -19.0% | +188.8% | 1126 |

**Eşik duyarlılığı:** Bu grupta top5 eşiğini gevşetirsek — ≤%100: **0**, ≤%150: **3**, ≤%200: **30**, ≤%250: **82** durum "homojen" olurdu. Yani %40 eşiğinin katılığı sonucu belirliyor; %100'ü (kârın tamamının en iyi %5 günde olması) geçen TEK durum yok — bu, crypto trend sistemlerinin yapısal kuyruk bağımlılığıdır.

Uyarı: Tüm pozitifler içinde top5 payı **en düşük** ~%100-105 çıkan örnekler (ör. chop 4h, uo 1w) aslında *tek sıçramalı* bozuk eğrilerdir (pozitif ay oranı %6-16, R² < 0.6) — "az gün-bağımlı" görünüp aslında tanımsız/kırılgan sonuçlardır. Bu yüzden tek başına gün payı değil, altı ölçütün tümü aranır.

## 6. Karşı-Örnekler — "Birkaç Güne Bağlı" Sonuçlar

| Strateji | TF | Varyant | Net kâr | Top5 gün payı | R² | En iyi gün |
|---|---|---|---|---|---|---|
| RVI Sinyal Kesişimi (10) | 1h | Trend rejimi (Choppiness<38) | +0.2% | 7621% | 0.13 | +3.1% |
| TRIX Sinyal Kesişimi (15) | 15m | Trend rejimi (Choppiness<38) | +0.5% | 4784% | 0.00 | +2.9% |
| Volatilite Oranı Kırılımı (1,5) | 1h | Yalnız uzama anında | +1.2% | 2678% | 0.05 | +15.1% |
| Mass Index Tümsek Dönüşü (yaklaşım) | 5m | RVOL>1.5 | +1.1% | 2629% | 0.00 | +10.1% |
| VWMA(20) Fiyat Kesişimi | 5m | Yalnız uzama anında | +0.8% | 2351% | 0.06 | +22.9% |
| Zarf Geri Dönüşü (20, %2,5) | 1d | temel | +0.7% | 2328% | 0.13 | +19.1% |
| Order Block Geri Testi (yaklaşım) | 1h | temel | +2.4% | 2179% | 0.16 | +6.6% |
| Regresyon Kanalı Kırılımı (50) | 5m | MACD tersi | +0.3% | 2144% | 0.07 | +2.8% |

## 7. Sınırlar

- Portföy eğrisi sembollerin eşit ağırlıklı ortalamasıdır; tek bir hesap bakiyesi değildir (boru hattı standardı).
- Aylık/günlük getiriler özkaynak eğrisinden türetilir; işlem maliyetleri ve funding dahildir.
- Bu analiz **veri madenciliği riskini ortadan kaldırmaz**; homojenlik kriterleri seçimden bağımsız uygulanmıştır ama aynı geçmiş veri üzerinde hesaplanmıştır.
- Eğitim amaçlıdır; yatırım tavsiyesi değildir.

> Ham veri: `out/homojenlik.csv` (tüm durumlar) · `out/homojenlik.json` · günlük eğriler: `out/daily/`