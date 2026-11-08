// serve_dash.mjs — dashboard'ları HTTP üzerinden sunar (önbellekli gzip ile anlık yanıt)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const PORT = 8123;
const ROUTES = {
  '/': { file: 'D:/BigPlan/BACKTEST93.html', mime: 'text/html; charset=utf-8' },
  '/backtest93': { file: 'D:/BigPlan/BACKTEST93.html', mime: 'text/html; charset=utf-8' },
  '/pro': { file: 'D:/BigPlan/BACKTEST93.html', mime: 'text/html; charset=utf-8' },
  '/ultra': { file: 'D:/BigPlan/ULTRA.html', mime: 'text/html; charset=utf-8' },
  '/homojenlik': { file: 'D:/BigPlan/HOMOJENLIK.html', mime: 'text/html; charset=utf-8' },
  '/eski': { file: 'D:/BigPlan/DASHBOARD_ONLINE.html', mime: 'text/html; charset=utf-8' },
  '/master': { file: 'D:/BigPlan/DASHBOARD_MASTER_LITE.html', mime: 'text/html; charset=utf-8' },
  '/plotly.min.js': { file: 'D:/BigPlan/out/plotly.min.js', mime: 'application/javascript; charset=utf-8' },
  '/pro_data.js': { file: 'D:/BigPlan/out/pro_data.js', mime: 'application/javascript; charset=utf-8' },
};

const cache = new Map();
async function load(route) {
  if (!cache.has(route.file)) {
    const raw = await readFile(route.file);
    const gz = gzipSync(raw, { level: 6 });
    cache.set(route.file, { raw, gz, mime: route.mime });
  }
  return cache.get(route.file);
}

createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const route = ROUTES[url];
  if (!route) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bulunamadı: ' + url + '\nMevcut: ' + Object.keys(ROUTES).join(', '));
    return;
  }
  try {
    const entry = await load(route);
    const ae = req.headers['accept-encoding'] || '';
    if (ae.includes('gzip')) {
      res.writeHead(200, {
        'Content-Type': entry.mime,
        'Content-Encoding': 'gzip',
        'Content-Length': entry.gz.length,
        'Cache-Control': 'no-cache',
      });
      res.end(entry.gz);
    } else {
      res.writeHead(200, {
        'Content-Type': entry.mime,
        'Content-Length': entry.raw.length,
        'Cache-Control': 'no-cache',
      });
      res.end(entry.raw);
    }
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Hata: ' + e.message);
  }
}).listen(PORT, () => console.log('[serve] http://localhost:' + PORT + ' hazır · rotalar: ' + Object.keys(ROUTES).join(', ')));
