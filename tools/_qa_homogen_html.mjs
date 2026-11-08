// _qa_homogen_html.mjs — HOMOJENLIK.html bağımsız denetim
import { readFile } from 'node:fs/promises';
const h = await readFile('D:/BigPlan/HOMOJENLIK.html', 'utf8');
const m = /<script id="DATA" type="application\/json">([\s\S]*?)<\/script>/.exec(h);
if (!m) { console.log('HATA: DATA yok'); process.exit(1); }
const D = JSON.parse(m[1].replace(/\\u003c/g, '<'));
console.log('boyut:', (h.length / 1024 / 1024).toFixed(2), 'MB | JSON parse OK');
console.log('satır:', D.rows.length, '| kriter:', D.criteria.length, '| homojen satır:', D.rows.filter(r => r.hom).length);
const bad = [];
if (/<script[^>]+src=/i.test(h)) bad.push('script src');
if (/<link[^>]+href=/i.test(h)) bad.push('link href');
if (/@import/i.test(h)) bad.push('@import');
if (/fetch\(|XMLHttpRequest/.test(h)) bad.push('ağ çağrısı');
console.log('dış kaynak:', bad.length ? bad.join(', ') : 'temiz ✔');
