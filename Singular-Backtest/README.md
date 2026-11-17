# Singular-Backtest — Tek Açık İşlem Kuralı

Bu klasör, BigPlan Filtre Laboratuvarı'nın **563 durumunu yeniden simüle ederek**
"aynı coinde aynı anda en fazla bir açık işlem" kuralını uygulayan ayrı bir
backtest varyantıdır. Normal dashboard'a, `out/` paketlerine ve mevcut
sonuçlara dokunmaz; tüm çıktılar `Singular-Backtest/results/` altında üretilir.

## Kural

Seçilen kapsamda (varsayılan: **strateji + varyant = `id|kind`**, tüm zaman
dilimleri birlikte) bir coinde açık işlem varsa, aynı coinde yeni giriş sinyali
**bloke edilir**. Bloke edilen sinyal kuyruğa alınmaz; pozisyon kapandıktan
sonra gelen yeni sinyal normal şekilde değerlendirilir.

Ölçüt "pozisyon tutma aralıklarının çakışmaması"dır: yeni işlemin giriş anı,
önceki kabul edilen işlemin çıkış anından **kesin olarak önceyse** bloke edilir.
Bitişik devirler (çıkış ve giriş aynı barın açılışında) serbesttir; motorun
kendi flip davranışı da böyle çalışır.

### Kapsam neden `id|kind`?

BigPlan motoru (`sim2.simulateMulti`) **tek bir durum içinde** zaten aynı coinde
üst üste pozisyon açmaz. Yani "durum başına tek pozisyon" kuralı normal
backtest'e eşittir ve hiçbir şeyi değiştirmez. Anlamlı tekillik, aynı strateji
konfigürasyonunun farklı zaman dilimlerinde aynı anda pozisyonda olmasını
engellemektir.

| `--scope` | Kilit anahtarı | Bloke | Tekil işlem | İşlem ort. |
|---|---|---:|---:|---:|
| **`config`** (varsayılan) | `id + kind` (tüm TF'ler) | **4.251.687 (%10,63)** | 35.734.533 | %0,6525 |
| `id_tf` | `id + tf` (tüm varyantlar) | 29.695.594 (%74,26) | 10.290.626 | %0,5002 |
| `id` | `id` (tüm varyant + TF'ler) | 31.305.937 (%78,29) | 8.680.283 | %0,3398 |
| `state` | `id + tf + kind` | 0 | 39.986.220 | %0,7330 |

`id` ve `id_tf` kapsamları, aynı stratejinin varyantları neredeyse aynı sinyali
ürettiği için sinyallerin %74–78'ini bloke eder ve stratejiyi fiilen yok eder.
Dashboard'da her varyant ayrı bir strateji satırı olarak sunulduğu için
varsayılan kapsam `config`'tir. `id` ve `id_tf` yalnızca karşılaştırma için
`--scope` ile koşulabilir.

## Veri ve yöntem

- **Motor:** `tools/sim2.mjs` (`simulateMulti`) — normal backtest ile birebir
  aynı giriş/çıkış, bar içi stop, flip, maxBars, komisyon, kayma ve funding
  mantığı.
- **Evren:** 520 Binance USDT-M perpetual sembolü, `2022-08-01 → 2026-09-08`.
- **Durumlar:** `out/pro_bundle.json` içindeki 563 durum (42 strateji, 75
  `(id,tf)` hücresi, `temel` + `varyant1..3` + 66 tekil filtre).
- **Veri kaynağı:** `D:\1mDataBinance` (lokal kline CSV'leri) ve
  `D:\BigPlan\cache\series` binary önbelleği.
- **Kasa modeli:** işlem başına sabit **10 USD**; `retAll` = işlem başına
  ortalama getiri (%). `kasaAll` = tüm işlemlerin toplam net USD kârı.
- **Giriş zamanı:** sinyal barının kapanışından sonraki barın açılışı; çıkış
  zamanı kapanan işlemin bar zamanı. İkisi de motordan **birebir** alınır.
- **Eşit giriş anı önceliği:** kısa TF önce (`15m > 1h > 4h > 1d > 1w`), sonra
  long > short, sonra durum sırası. Bu yalnızca aynı anda gelen girişleri
  sıralamak için kullanılır.

## Sonuç (varsayılan `config` kapsamı)

| | Normal | Singular | Fark |
|---|---:|---:|---:|
| İşlem | 39.986.220 | 35.734.533 | −4.251.687 (%10,63 bloke) |
| Kazanma oranı | %40,74 | %40,15 | −0,59 puan |
| İşlem başına ort. getiri | %0,7330 | %0,6525 | −0,0805 puan |
| 2026 işlem ort. | %0,9906 | %0,8505 | −0,1401 puan |
| Win/Loss oranı | 0,688 | 0,671 | −0,017 |
| Ort. kazanç süresi | 85,7 saat | 78,2 saat | −7,5 saat |
| Kârlı / zararlı gün | 901 / 591 | 862 / 630 | −39 / +39 |
| Maks. düşüş ($10 kasa) | −70.944 $ | −60.279 $ | +10.665 $ |
| Toplam kasa ($10/işlem) | +2.930.939 $ | +2.331.705 $ | −599.234 $ |

Zaman dilimi bazında:

| TF | Normal işlem | Bloke | Bloke % | Normal ort. | Singular ort. |
|---|---:|---:|---:|---:|---:|
| 15m | 4.801.661 | 379.176 | 7,90 | %0,281 | %0,273 |
| 1h | 10.730.502 | 1.446.298 | 13,48 | %0,373 | %0,355 |
| 4h | 22.274.900 | 1.787.262 | 8,02 | %0,715 | %0,665 |
| 1d | 2.143.203 | 624.168 | 29,12 | %3,282 | %2,987 |
| 1w | 35.954 | 14.783 | 41,12 | %27,890 | %30,751 |

Yorum:

- Kural, işlemlerin **%10,6'sını** bloke ediyor; ancak bloke edilen sinyaller
  ortalamadan **daha kârlı** (bloke başına ≈ 0,141 $ net kayıp). Bu yüzden
  işlem başına getiri ve toplam kasa düşüyor.
- En sert etki **1d (%29)** ve **1w (%41)** sinyallerinde: bu sinyaller daha
  uzun pozisyonda kaldığı için diğer TF'lerle çakışma olasılıkları yüksek.
- **1w** tarafında tekil işlem ortalaması aslında yükseliyor (%27,89 → %30,75);
  çünkü bloke edilen haftalık sinyaller kalanlardan daha zayıf. 15m, 1h, 4h ve
  1d ortalamaları düşüyor.
- Maksimum düşüş **%15 azalıyor** (−70.944 → −60.279 $), fakat bu kısmen daha
  az işlem yapılmasının doğal sonucu.
- 402 config'in **11'i** işlem başına getiri bazında iyileşiyor, **391'i**
  kötüleşiyor. 563 durumun **107'si** iyileşiyor.
- En çok iyileşen: `histvol|varyant2` (+0,33 puan, %37,9 bloke),
  `supertrend|varyant3` (+0,18), `histvol|varyant1` (+0,13),
  `voi|varyant3` (+0,11), `cmo|varyant1` (+0,09).
- En çok bozulan: `smi|varyant1` (−1,02 puan, %34,2 bloke), `hma|temel`
  (−1,00), `smi|temel` (−0,91), `hma|varyant2` (−0,74), `willr|temel` (−0,73).
- Strateji ailelerinde en çok bloke: `pivot` (%33,0), `ribbon` (%22,4),
  `sma` (%19,0), `willr` (%18,8), `mom`/`vortex` ~%15,9,
  `percentb`/`bb` ~%15,3.
- 42 stratejinin **24'ünde** bloke oluşuyor; kalan 18'i yalnızca tek TF'de
  tanımlı olduğu için kuraldan etkilenmiyor.

**Kısa sonuç:** BigPlan'da tekil işlem kuralı, motor zaten durum içi üst üste
binmeyi engellediği için yalnızca TF'ler arası çakışmaları kesiyor. Bu da
toplam kârı yaklaşık **%20** azaltıyor; işlem kalitesini artırmıyor. Kural
"tek pozisyon" disiplini isteyen canlı kullanım için savunulabilir, ancak bu
veri setinde kârlılık açısından bir iyileştirme değildir.

## Çalıştırma

Lokal veri kökleri hazır olmalı: `D:\1mDataBinance` ve `D:\BigPlan\cache`.

```bash
node Singular-Backtest/run_singular.mjs
node Singular-Backtest/verify_singular.mjs
node Singular-Backtest/summarize_singular.mjs
```

Faydalı bayraklar:

- `--scope=config|id_tf|id|state` (varsayılan `config`)
- `--workers=8` (varsayılan `cpu-1`)
- `--symbols=20` (hızlı test için sembol limiti)
- `--out=<klasör>` (varsayılan `Singular-Backtest/results`)
- `--pro=<pro_bundle.json>` (varsayılan `out/pro_bundle.json`)

Tipik süre: sıcak binary önbelleği ile **~35 saniye** (8 worker, 520 sembol).
Soğuk önbellekte ilk koşu, CSV ayrıştırma ve `.bin` üretimi nedeniyle birkaç
dakika sürebilir.

## Çıktılar (`results/`)

| Dosya | İçerik |
|---|---|
| `singular_results.json` | Dashboard payload'ı: özet + 563 durum + 402 config + 75 hücre + 42 strateji + 21.796 strateji×coin + 520 coin toplamı. |
| `singular_states.csv` | Durum bazında normal/singular metrikleri. |
| `singular_configs.csv` | `id|kind` bazında (TF'ler birleşik). |
| `singular_cells.csv` | `id|tf` bazında. |
| `singular_strategies.csv` | Strateji ailesi bazında. |
| `singular_coins.csv` | Strateji × coin kırılımı. |
| `singular_coin_totals.csv` | Coin bazında toplam (tüm stratejiler). |
| `run_manifest.json` | Kapsam, satır sayıları, bloke oranı ve süre. |

`results/` gitignore'dadır. Dashboard için iki dosya klasörün köküne kopyalanır:

- `Singular-Backtest/singular_results.json`
- `Singular-Backtest/run_manifest.json`

## Doğrulama

`verify_singular.mjs` şunları kontrol eder:

1. **Normal metrikler `pro_bundle.json` ile birebir aynı:** 563 durumun tamamında
   işlem sayısı farkı **0**; `sumR` farkı yalnızca pro_bundle'ın 3 ondalık
   yuvarlamasından kaynaklanan **≤ 0,0005**.
2. Her durumda `singular = normal − bloke`.
3. Tek durumlu (tek TF) config'lerde bloke **0**.
4. Durum, config, hücre ve strateji toplamları birbirini ve genel toplamı tutuyor.
5. `kasaAll = 10 × sumR` (yuvarlama dışında fark yok).
6. Motor hatası **0**.
7. `--scope=state` koşusunda singular = normal (bloke 0).

Blokajın kendisi, kronolojik birleştirmede `giriş < son çıkış` kontrolüyle
uygulanır; kabul edilen akışta çakışma tanım gereği oluşamaz. Eşit giriş
anlarında sıralama deterministiktir.

## Notlar

- Bu klasör dışında yalnızca `tools/sim2.mjs` içindeki `onTrade` geri çağrısına
  **giriş zamanı** parametresi eklendi; eski çağıranlar etkilenmez.
- `retAll` alanı mevcut BigPlan satırlarıyla aynı semantiği taşır: işlem başına
  ortalama getiri (%). `kasaAll` ise işlem başına 10 USD sabit kasa ile toplam
  net kârdır.
- `winHoldH` burada **saat** cinsindendir (pro_bundle'daki `winDurH` de saat
  cinsindendir; eski `all-in-dashboard` satırlarında bu alan `winHoldH` adıyla
  taşınmıştır).
- Bu çalışma yatırım tavsiyesi değildir.
