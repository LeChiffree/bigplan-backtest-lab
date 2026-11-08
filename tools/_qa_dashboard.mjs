// _qa_dashboard.mjs — DASHBOARD.html bağımsız denetimi:
// 1) Gömülü JSON parse edilebiliyor mu ve sayaçlar raporla uyumlu mu?
// 2) Dış kaynak (script src / link href / @import / http çağrısı) var mı?
// 3) Beklenen bölümler (KPI, matris, detay, lig, kazananlar) sayfada var mı?
import { readFile } from 'node:fs/promises';

const html = await readFile('D:/BigPlan/DASHBOARD.html', 'utf8');
console.log('boyut:', (html.length / 1024 / 1024).toFixed(2), 'MB');

// 1) gömülü veri
const m = /<script id="DATA" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
if (!m) { console.log('HATA: DATA script bulunamadı'); process.exit(1); }
const json = m[1].replace(/\\u003c/g, '<');
let D;
try { D = JSON.parse(json); } catch (e) { console.log('HATA: JSON parse başarısız:', e.message); process.exit(1); }
console.log('JSON parse: OK');
console.log('kpi:', JSON.stringify(D.kpi));
console.log('cells:', D.cells?.length, '| details anahtarı:', Object.keys(D.details || {}).length, '| lig satırı:', (D.league || D.lig || []).length, '| kazanan:', (D.winners || []).length);

// 2) dış kaynak kontrolü
const bad = [];
if (/<script[^>]+src=/i.test(html)) bad.push('script src bulundu');
if (/<link[^>]+href=/i.test(html)) bad.push('link href bulundu');
if (/@import/i.test(html)) bad.push('@import bulundu');
if (/url\(https?:/i.test(html)) bad.push('css url(http) bulundu');
if (/fetch\(|XMLHttpRequest|navigator\.sendBeacon/i.test(html)) bad.push('ağ çağrısı kodu var');
console.log('dış kaynak/ağ kontrolü:', bad.length ? 'SORUN: ' + bad.join('; ') : 'temiz ✔');

// 3) bölüm kontrolü
const need = ['kpi', 'matris', 'detail', 'league', 'winner'];
for (const n of need) {
  const has = new RegExp(n, 'i').test(html);
  console.log(`bölüm '${n}':`, has ? 'var' : 'YOK?');
}
