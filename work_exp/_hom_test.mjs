// _hom_test.mjs — yalnızca homojenlik bölümünü içeren test sayfası üretir
import { readFile, writeFile } from 'node:fs/promises';
const h = await readFile('D:/BigPlan/DASHBOARD_MASTER.html', 'utf8');
const style = h.slice(h.indexOf('<style>'), h.indexOf('</style>') + 8);
const s0 = h.indexOf('<h2 id="homojenlik">');
const s1 = h.indexOf('<h2 id="yontem">');
const sections = h.slice(s0, s1);
const d0 = h.indexOf('<script id="HDATA"');
const d1 = h.indexOf('</body>');
const data = h.slice(d0, d1);
const page = '<!doctype html><html lang="tr"><head><meta charset="utf-8">' + style + '</head><body><div class="wrap">' + sections + '</div>' + data + '</body></html>';
await writeFile('D:/BigPlan/work_exp/_hom_test.html', page);
console.log('yazıldı:', (page.length / 1048576).toFixed(2), 'MB');
