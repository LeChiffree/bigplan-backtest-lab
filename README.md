# BigPlan · Filtre Laboratuvarı PRO & Backtest Dashboard

100 indikatör × 6 zaman dilimi (`5m, 15m, 1h, 4h, 1d, 1w`) × **520 Binance USDT-M vadeli işlem sembolü** (`2022-08-01 → 2026-09-08`) üzerinde giriş filtreleri, homojenlik testleri, **ULTRA 10x/15x dayanıklılık senaryosu** ve **$10 Sabit İşlem Kasası PRO Analiz Dashboard'u**.

> **Tüm proje hafızası, metodoloji ve kronolojik karar geçmişi için:** [`PROJECT_MEMORY.md`](./PROJECT_MEMORY.md)

---

## Hızlı Başlangıç (Lokal Sunucu)

Depodaki tüm dashboard'lar ve işlenmiş simülasyon paketleri (`out/pro_bundle.json`, `out/pro_data.js`, `out/ultra_data.json`, `out/homojenlik.json`) hazırdır; ham mum verisi olmadan doğrudan çalışır:

```powershell
node tools/serve_dash.mjs
```

Tarayıcıda açılan rotalar (`port 8123`):
- **`http://localhost:8123/`** (`/pro`, `/backtest93`) — **Filtre Laboratuvarı PRO** (Adım adım strateji & timeframe seçimi, sağ üstte interaktif **Filtre Switch Box**, $10 sabit işlem kasası 2022–2026 & 2025–2026 line grafikleri, gün/yıl/çeyrek/mevsim yeşil kâr & kırmızı zarar histogramları, işlemde kalma süreleri `1-3g..65+g`, Yıl×Ay ısı haritası).
- **`http://localhost:8123/ultra`** — **ULTRA 10x/15x Dayanıklılık Senaryosu** (93 aday → 6 hayatta kalan → 5 farklı strateji: `MFI`, `HMA`, `UO`, `SMI`, `NVI`).
- **`http://localhost:8123/homojenlik`** — **Homojenlik Analizi** (6 ölçüt ve Ölçüt-4 alternatif varyantları).
- **`http://localhost:8123/master`** — **Filtre Laboratuvarı Master Matrisi** (593 hücre önce/sonra ısı matrisi ve filtre ligi).

---

## Singular-Backtest (tek açık işlem)

[`Singular-Backtest/`](./Singular-Backtest/README.md) aynı motoru ve 520 sembolü
kullanarak "aynı coinde aynı anda en fazla bir açık işlem" kuralını uygular.
Varsayılan kapsam **strateji + varyant (`id|kind`), tüm zaman dilimleri
birlikte**; `--scope=id_tf|id|state` ile alternatifler koşulabilir.

```powershell
node Singular-Backtest/run_singular.mjs
node Singular-Backtest/verify_singular.mjs
node Singular-Backtest/summarize_singular.mjs
```

Sonuç: 39.986.220 işlemin **4.251.687'si (%10,63)** bloke edilir; işlem başına
ortalama getiri %0,7330 → %0,6525, toplam kasa 2,93M $ → 2,33M $, maksimum
düşüş −70.944 $ → −60.279 $. Motor durum içi üst üste binmeyi zaten
engellediği için kural yalnızca TF'ler arası çakışmaları keser; bu veri setinde
kârlılığı artırmaz. Ayrıntılı tablo ve doğrulama: [`Singular-Backtest/README.md`](./Singular-Backtest/README.md).

> Not: `tools/sim2.mjs` içindeki `onTrade` geri çağrısına giriş zamanı
> parametresi eklendi (geriye dönük uyumlu).

---

## Lokal Mum Verisi Notu

`1m / 5m / 15m / 1h / 4h / 1d` ham mum/kline serileri (`cache/` klasörü ve `D:\1mDataBinance`) boyut nedeniyle `.gitignore` ile hariç tutulmuştur; simülasyonları sıfırdan koşturmak istediğinizde lokal diskteki mum verileri kullanılır (`bkz. PROJECT_MEMORY.md`).

## Uyarı

Bu proje yalnızca eğitim ve kantitatif araştırma amaçlıdır; **yatırım tavsiyesi değildir**.
