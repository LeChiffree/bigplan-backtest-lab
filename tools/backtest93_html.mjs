// backtest93_html.mjs — 93 aday backtest dashboard'unu tek HTML dosyası olarak üretir
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BP = 'D:/BigPlan';
const css = await readFile(join(BP, 'work_exp', 'backtest93.css'), 'utf8');
const app = await readFile(join(BP, 'work_exp', 'backtest93_app.js'), 'utf8');
const data = await readFile(join(BP, 'out', 'backtest93_data.json'), 'utf8');

const safeData = data.replace(/</g, '\\u003c');

const html = '<!doctype html>\n<html lang="tr">\n<head>\n' +
  '<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
  '<title>Backtest 93 · Filtre Laboratuvarı</title>\n' +
  '<style>\n' + css + '\n</style>\n' +
  '</head>\n<body>\n' +
  '<div class="app">\n' +
  '  <aside class="side">\n' +
  '    <div class="brand"><div class="logo"></div><div><h1>Backtest 93</h1><p>Filtre Laboratuvarı</p></div></div>\n' +
  '    <div class="hint">6 homojenlik ölçütünden 5\'ini geçen, yalnızca <b>"en iyi %5 gün ≤ %40"</b> ölçütünde takılan <b>93 aday</b>.<br>520 Binance USDT-M sembolü · 2022-08 → 2026-09 · komisyon+kayma+funding dahil.</div>\n' +
  '    <button class="agg" id="aggBtn"></button>\n' +
  '    <div class="fgroup"><div class="flabel">Zaman dilimi</div><div class="chips" id="tfChips"></div></div>\n' +
  '    <div class="fgroup"><div class="flabel">Hacim (5 yıl ort. yıllık USDT)</div><div class="chips" id="volChips"></div></div>\n' +
  '    <div class="fgroup"><div class="flabel">Varyant</div><div class="chips" id="kindChips"></div></div>\n' +
  '    <div class="fgroup"><div class="flabel">Strateji</div><select id="idSel"></select></div>\n' +
  '    <div class="fgroup"><div class="flabel">Filtre anahtarı</div><select id="keySel"></select></div>\n' +
  '    <div class="fgroup"><div class="flabel">Yıllar</div><div class="chips" id="yearChips"></div></div>\n' +
  '    <div class="fgroup"><div class="flabel">Kaldıraç</div><div class="chips" id="levChips"></div></div>\n' +
  '    <div class="fgroup"><div class="flabel">Eşikler</div><div class="row2">\n' +
  '      <div><label>Min işlem</label><input type="number" id="minN" min="0" placeholder="0"></div>\n' +
  '      <div><label>Min net %</label><input type="number" id="minNet" placeholder="-1000"></div>\n' +
  '    </div></div>\n' +
  '    <div class="fgroup"><div class="flabel">Sıralama</div><select id="sortSel">\n' +
  '      <option value="net">Net kâr ↓</option><option value="r2">R² ↓</option><option value="n">İşlem ↓</option>\n' +
  '      <option value="dd">DD (en az) ↑</option><option value="top5">En iyi %5 gün ↑</option></select></div>\n' +
  '    <div class="fgroup"><div class="flabel">Arama</div><input type="search" id="q" placeholder="strateji, filtre, açıklama..."></div>\n' +
  '    <button class="btn" id="reset">Filtreleri sıfırla</button>\n' +
  '    <div class="listWrap"><div class="flabel" style="margin-top:12px">Adaylar <b id="listCount"></b></div><div class="list" id="list"></div></div>\n' +
  '  </aside>\n' +
  '  <main class="main">\n' +
  '    <div class="top"><div>\n' +
  '      <h2 id="selTitle"></h2><div class="sub" id="selSub"></div><div class="badges" id="selBadges"></div>\n' +
  '    </div></div>\n' +
  '    <div class="kpis" id="kpis"></div>\n' +
  '    <div class="grid">\n' +
  '      <section class="card span2 h300"><h3>Günlük Kâr / Zarar ve Kümülatif<span class="note">sol eksen: günlük % · sağ eksen: kümülatif %</span><span class="note chips" id="dailyToggle"></span></h3><canvas id="cDaily"></canvas></section>\n' +
  '      <section class="card span2"><h3>Kaldıraç Merdiveni · 1x → 20x<span class="note">seçili portföy için net getiri, maks DD ve tasfiye — satıra tıkla</span></h3><div id="ladder"></div></section>\n' +
  '      <section class="card h260"><h3>Kümülatif Kâr Eğrisi<span class="note">maks düşüş gölgeli</span></h3><canvas id="cCum"></canvas></section>\n' +
  '      <section class="card h260"><h3>İşlem Getirisi Histogramı<span class="note">işlem başına getiri dağılımı</span></h3><canvas id="cRet"></canvas></section>\n' +
  '      <section class="card span2 h420"><h3>Coin Coin Kâr / Zarar<span class="note">kâr sağa yeşil · zarar sola kırmızı · r toplamı · bir coine tıklayınca detay açılır</span></h3><canvas id="cCoin"></canvas><div id="coinDetail"></div></section>\n' +
  '      <section class="card h260"><h3>İşlem Süresi ve Kâr<span class="note">sol eksen: işlem sayısı · sağ eksen: ortalama getiri</span></h3><canvas id="cDur"></canvas></section>\n' +
  '      <section class="card h260"><h3>Süre × Getiri Saçılımı<span class="note">her nokta bir işlem (örneklem)</span></h3><canvas id="cScatter"></canvas></section>\n' +
  '      <section class="card h220"><h3>Haftanın Günleri<span class="note">r toplamı</span></h3><canvas id="cDow"></canvas></section>\n' +
  '      <section class="card h220"><h3>Aylar<span class="note">r toplamı</span></h3><canvas id="cMonth"></canvas></section>\n' +
  '      <section class="card h220"><h3>Mevsimler<span class="note">r toplamı</span></h3><canvas id="cSeason"></canvas></section>\n' +
  '      <section class="card h220"><h3>Giriş Saati (3 saatlik dilim)<span class="note chips" id="hourToggle"></span></h3><canvas id="cHour"></canvas></section>\n' +
  '    </div>\n' +
  '    <footer>\n' +
  '      <b>Yöntem:</b> Her aday, tek bir indikatör stratejisinin (trend/momentum/volatilite) seçilmiş filtre anahtarlarıyla sınırlandırılmış hâlidir. İşlemler 1 dakikalık Binance USDT-M verisinden ilgili zaman dilimine çevrilerek, komisyon + kayma + funding maliyetleriyle simüle edilmiştir. Getiriler eşit ağırlıklıdır ("r" = işlem başına net getiri oranı).<br>\n' +
  '      <b>93 aday nedir?</b> Homojenlik testinin 6 ölçütünden 5\'ini geçen, yalnızca "tek bir en iyi %5 günlük dilimin toplam katkısının ≤ %40 olması" ölçütünde takılan durumlardır. Bu ölçüt günlük kripto serilerinde yapısal olarak ulaşılamaz olduğu için ayrı bir "5/6 dayanıklı" katman olarak sunulmaktadır.<br>\n' +
  '      <b>Hacim filtresi:</b> Her sembol için 2022-08 → 2026-09 penceresindeki günlük kline "quote_volume" toplamı alınıp pencere uzunluğuna bölünerek <b>ortalama yıllık USDT hacmi</b> hesaplanır. "En hacimli N" seçildiğinde portföy yalnızca bu N sembolün işlemleriyle yeniden kurulur: günlük eğri, işlem kovaları ve KPI\'lar yalnızca seçili coinlerden üretilir; kâr/zarar grafiği ve saçılım da aynı evrene kısıtlanır. Kısa geçmişli coinler bu ortalamada daha düşük sıralanır (5 yıl ortalaması).<br>\n' +
  '      <b>Kaldıraç modu:</b> Seçilen kaldıraç L×, günlük portföy getirilerinin L katı alınarak bileşiklenir; bir günde kaldıraçlı getiri ≤ −100% olursa hesap tasfiye kabul edilir ve eğri durur. Kâr/zarar histogramı ile coin/gün/ay/mevsim/saat/süre kovalarındaki getiriler L ile ölçeklenir; tasfiye edilen işlemler −100% ile sınırlanır (yaklaşık). Komisyon, kayma ve funding zaten getiriye dahildir ve kaldıraçla birlikte büyür.<br>\n' +
  '      <b>Uyarılar:</b> (1) Evren, bugün hâlâ işlem gören sembollerden oluşur (survivorship bias). (2) Kısa geçmişli yeni coinler eşit ağırlıkta seyreltme yaratır. (3) 2022 Ağustos\'ta başlar, 2026 Eylül\'de biter; uç yıllar kısmi. (4) 1d/1w adaylarında giriş saati 00:00 UTC\'dir, saat dağılımı anlamsızdır. (5) Bileşik getiri yalnızca coin detayında ve kümülatif eğride gösterilir; kovalardaki "r toplamı" ardışık bileşik değil, toplamsal katkıdır. (6) Bu bir araştırma/eğitim aracıdır, yatırım tavsiyesi değildir.\n' +
  '    </footer>\n' +
  '  </main>\n' +
  '</div>\n' +
  '<div id="tip"></div>\n' +
  '<script id="BD" type="application/json">' + safeData + '</script>\n' +
  '<script>\n' + app + '\n</script>\n' +
  '</body>\n</html>\n';

await writeFile(join(BP, 'BACKTEST93.html'), html);
console.log('[backtest93_html] yazıldı: BACKTEST93.html ·', (Buffer.byteLength(html) / 1048576).toFixed(2), 'MB');
