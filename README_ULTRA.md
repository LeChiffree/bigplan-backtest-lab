# ULTRA 10x/15x Dayanıklılık Senaryosu

**Yayın:**
- LAN: http://192.168.1.124:8123/ultra
- Tünel: https://you-speed-sean-charged.trycloudflare.com/ultra
- Yerel: http://127.0.0.1:8123/ultra

Bu çalışma bir parametre optimizasyonu değildir. Strateji parametreleri sabittir; taranan şey **kaldıraç, likidite evreni, zaman ve BTC rejimi** altında dayanıklılıktır. Amaç, 93 aday içinden 10x/15x kaldıraçta tasfiye olmayan, performansı en az bozulan ve homojenliğe en yakın **5 farklı temel stratejiyi** ayırmaktır.

## Veri ve senaryo

- 520 sembol, 2022-08-01 → 2026-09-08, 1d/4h kapanışlar.
- Ücretler ve funding dahil.
- Hacim evrenleri: 5 yıllık ortalama yıllık USDT hacmine göre top 50/100/150/200/250/300; her set ayrı yeniden simüle edildi.
- Kaldıraç: 1x/5x/10x/15x/20x. Günlük bileşik; `1 + L·r ≤ 0` tasfiye.
- BTC rejimi: SMA200 üstü/altı ve 30 günlük gerçekleşen volatilite (yüksek/düşük).
- Sert kapılar: 10x/15x tasfiye yok, 15x maks DD > -90%, ≥200 işlem ve ≥50 test işlemi, 10x'te ≥4/6 hacim evreni pozitif, 15x en kötü gün tamponu > %20, 15x log büyümesi > 0.
- Skor ağırlıkları: kaldıraç 35, homojenlik 25, hacim 20, zaman/rejim 10, uygulanabilirlik 5, güvenilirlik 5.

## Sonuç: 93 → 6 → 5

Yedi sert kapının tamamını geçen **6 konfigürasyon**, **5 farklı temel stratejiye** ait:

| # | Strateji | TF | ULTRA | 10x maks DD | 15x maks DD | 15x verim | 15x Sharpe | İşlem |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | MFI Aşırılık Dönüşü (14) · v2 | 1d | 87.3 | -31.7% | -44.1% | 0.89 | 3.25 | 1.008 |
| 2 | HMA(20) Fiyat Kesişimi · v1 | 1d | 82.2 | -57.7% | -74.0% | 0.70 | 1.65 | 4.014 |
| 3 | Ultimate Oscillator Dönüşü · v3 | 4h | 80.7 | -59.0% | -74.0% | 0.77 | 1.64 | 1.812 |
| 4 | SMI Aşırılık Dönüşü (14,3) · v1 | 1d | 76.3 | -77.0% | -89.0% | 0.82 | 2.35 | 3.515 |
| 5 | NVI + EMA(200) Trendi · v1 | 4h | 75.2 | -66.0% | -83.0% | 0.66 | 1.72 | 13.122 |

**Aile alternatifi:** MFI 1d `temel` de hayatta kalır (skor 73.5; 10x DD -58.5%, 15x DD -75.0%). Aynı temel stratejinin ikinci konfigürasyonu ayrı bir yöntem sayılmadığı için ilk 5'e alınmadı; tam sıralamada “aile alt.” etiketiyle görünür.

## Önemli uyarılar

- İlk 5'in tamamı **ana (tüm coin) evrende** 15x'te tasfiye olmadan hayatta kalır. Ancak **top50 likit evrende** MFI v2, SMI ve NVI 15x'te tasfiye olur; kartlarda ve detaylarda uyarı vardır. HMA ve UO likit alt evrenlerde de 15x tasfiyesizdir.
- 15x maks DD -44% ile -89% arasındadır. “Dayanıklı” burada **93 aday içinde en iyi hayatta kalma/log-büyüme kombinasyonu** anlamına gelir; mutlak güvenli anlamına gelmez.
- Top5 gün payları %103–150 arasındadır; orijinal ≤%40 homojenlik kriterini bu evrendeki hiçbir aday geçmez. İlk 5, alt-10 toplamsal ve BTC-göreli tanımları geçen 6 konfigürasyondan seçildi.
- 10x/15x değerleri günlük kapanış bazlıdır. Intraday likidasyon, pozisyon limiti, likidite kayması ve stop boşluğu modellenmez.
- Getiri serisi hayatta kalan coin evreni üzerinden eşit ağırlıklıdır; kısa geçmişli yeni coinler seyreltme yaratabilir.
- BTC 1d verisi 2026-08-30'da biter; son 9 gün taşınmıştır.
- Bu çalışma eğitim/araştırma amaçlıdır, **yatırım tavsiyesi değildir**.

## Dosyalar

- `ULTRA.html` — tek dosya, bağımlılıksız dashboard.
- `out/ultra_data.json` — 93 konfigürasyon, skorlar, `dret` serileri, hacim setleri.
- `tools/ultra.mjs` — senaryo, metrikler, kapılar, skorlama.
- `tools/ultra_html.mjs` — HTML üretimi.
- `work_exp/ultra_app.js`, `work_exp/ultra.css` — dashboard JS/CSS.
- `tools/serve_dash.mjs` — `/ultra` rotası.

## Yeniden üretim

```powershell
cd D:\BigPlan
node tools\ultra.mjs
node tools\ultra_html.mjs
# sunucu dosyayı cache'lediği için yeniden başlat:
node tools\serve_dash.mjs
```

Sunucu portu: `8123`. LAN IP: `192.168.1.124`.
