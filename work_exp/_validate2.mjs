import { readFile } from 'node:fs/promises';
for (const f of ['DASHBOARD_MASTER.html', 'DASHBOARD_MASTER_LITE.html']) {
  const h = await readFile('D:/BigPlan/' + f, 'utf8');
  const s = h.indexOf('<script id="HDATA" type="application/json">');
  const e = h.indexOf('</script>', s);
  const j = JSON.parse(h.slice(s + '<script id="HDATA" type="application/json">'.length, e));
  console.log(f, '| MB', (h.length / 1048576).toFixed(2), '| satır', j.rows.length, '| aylık', j.rows.filter((r) => r.aylik).length, '| özet', JSON.stringify(j.summary).slice(0, 120));
}
