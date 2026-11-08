// _validate_master.mjs — master dashboard yapısal doğrulama
import { readFile, writeFile } from 'node:fs/promises';

const h = await readFile('D:/BigPlan/DASHBOARD_MASTER.html', 'utf8');
const parts = h.split('<script>');
const last = parts[parts.length - 1].split('</script>')[0];
await writeFile('D:/BigPlan/work_exp/_check.js', last);

const start = h.indexOf('<script id="HDATA" type="application/json">');
const end = h.indexOf('</script>', start);
const json = h.slice(start + '<script id="HDATA" type="application/json">'.length, end);
const j = JSON.parse(json);
console.log('HDATA satır:', j.rows.length, '| özet:', JSON.stringify(j.summary));
console.log('aylık dizisi olan satır:', j.rows.filter((r) => Array.isArray(r.aylik) && r.aylik.length).length);
console.log('dosya MB:', (h.length / 1048576).toFixed(2));
