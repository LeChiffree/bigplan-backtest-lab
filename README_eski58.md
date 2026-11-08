# Filtre Laboratuvarı

Bu klasör, mevcut 100 indikatörlük backtest setinin (6 zaman dilimi × 58 sembol = 600 hücre) **filtrelerle yeniden simülasyonunu** içerir. Amaç: negatif beklentili sinyal hücrelerini, giriş anını süzerek pozitife çevirebilecek filtre ve kombinasyonları bulmak — dürüst ve doğrulanabilir biçimde.

## Başlıca Sonuçlar

- **593 hücre** incelendi; baz durumda **263** hücre negatifti.
- Filtrelerle **61 hücre** pozitife döndü (**59** tanesi "başlık" kriterini sağlıyor: test işlem ≥100).
- En iyi varyant baz alındığında **578 hücre** iyileşti (başlık: 468).
- Ortalama işlem başına iyileşme: tüm hücrelerde +4.6100%, negatif hücrelerde +0.2700%.
- Pozitif hücre oranı 55.6% → 66.4%.

## Nasıl Açılır

- **`DASHBOARD.html`** — tek dosyalık, çevrimdışı etkileşimli panel (önce/sonra ısı matrisi, hücre detayı, filtre ligi, kazananlar).
- **`out/FILTRE-RAPORU.md`** — tam rapor (yöntem, tablolar, kurtarılamayanlar).
- **`out/executive_summary.json`** — makine okunur özet.
- **`out/filtre_ozet.csv`** — hücre × filtre metrikleri (≈40 bin satır).
- **`out/baseline|singles|combos/`** — tüm ham sonuçlar.

## Yöntem (özet)

- Motor orijinal backtest çekirdeğinin birebir kopyasıdır; 600 hücrenin tamamı referans raporla karşılaştırılarak doğrulandı (bkz. rapor §3).
- Filtre mekaniği: çıkışlar her zaman uygulanır; filtre yalnızca **yeni girişi** engeller.
- Katmanlar: trend/rejim, momentum, hacim/likidite, BTC-piyasa (genişlik, hacim, trend), gerçek Korku&Açgözlülük endeksi, göreli güç, takvim, işlem bağlamı, veri kalitesi — toplam 66 filtre.
- Aşırı-uydurma kontrolü: seçim yalnızca train (2022-08→2024-12); kabul için test Δ>0, test n≥30, koruma ≥%20, sembol tutarlılığı.
- Tüm piyasa verileri kapanış anında bilinen değerlerle hizalanır (lookahead yok).

## Uyarı

Eğitim amaçlı araştırmadır; yatırım tavsiyesi değildir. Geçmiş performans gelecek getiriyi garanti etmez. Detaylı sınırlar için rapor §8.
