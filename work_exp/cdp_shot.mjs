// cdp_shot.mjs — coin grafiğini ve kenar çubuğunu görüntü olarak kaydeder
import { writeFileSync } from 'node:fs';
const PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() { const res = await fetch('http://127.0.0.1:' + PORT + '/json'); return res.json(); }
let target = null;
for (let i = 0; i < 40; i++) {
  try { const list = await targets(); target = list.find((t) => t.type === 'page' && t.url.includes('BACKTEST93')); if (target && target.webSocketDebuggerUrl) break; } catch (e) {}
  await sleep(500);
}
if (!target) { console.log('HEDEF YOK'); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
await new Promise((r) => ws.addEventListener('open', r));
function send(method, params) { return new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params: params || {} })); }); }
async function ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; }
async function shot(file) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(file, Buffer.from(r.result.data, 'base64'));
}
await send('Runtime.enable'); await send('Page.enable');
await sleep(1500);
// hacim 50 seç → coin grafiği kısıtlı
await ev("document.querySelectorAll('#volChips .chip')[1].click()"); await sleep(1200);
await ev("document.getElementById('cCoin').scrollIntoView({block:'center'})"); await sleep(800);
await shot('D:/BigPlan/work_exp/shot_coin.png');
console.log('kaydedildi: shot_coin.png · coin satır tooltip:', await ev("(function(){var c=document.getElementById('cCoin'); for(var y=40;y<300;y+=8){var q=c._hit(500,y); if(q&&q.html) return q.html.replace(/<[^>]+>/g,' ').slice(0,140);} return 'yok';})()"));
await ev("window.scrollTo(0,0)"); await sleep(600);
await shot('D:/BigPlan/work_exp/shot_side.png');
console.log('kaydedildi: shot_side.png');
ws.close();
