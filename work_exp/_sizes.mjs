import { readFile } from 'node:fs/promises';
const h = await readFile('D:/BigPlan/DASHBOARD_ONLINE.html', 'utf8');
function grab(id) {
  const s = h.indexOf('<script id="' + id + '" type="application/json">');
  const e = h.indexOf('</script>', s);
  return h.slice(s + ('<script id="' + id + '" type="application/json">').length, e);
}
const d = grab('DATA');
const p = grab('HDATA');
console.log('DATA MB:', (d.length / 1048576).toFixed(2), '| HDATA MB:', (p.length / 1048576).toFixed(2));
const D = JSON.parse(d);
console.log('details MB:', (JSON.stringify(D.details).length / 1048576).toFixed(2), '| cells MB:', (JSON.stringify(D.cells).length / 1048576).toFixed(2));
let v = 0, n = 0;
for (const k in D.details) { v += (D.details[k].variants || []).length; n++; }
console.log('detay hücre:', n, '| toplam varyant:', v);
const J = JSON.parse(p);
console.log('HDATA satır:', J.rows.length, '| aylik satır:', J.rows.filter((r) => r.aylik).length);
console.log('ilk satır örneği:', JSON.stringify(J.rows[0]).slice(0, 200));
