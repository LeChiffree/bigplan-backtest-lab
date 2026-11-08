// cdp_probe.mjs — hacim filtresinin sayıları değiştirdiğini doğrular
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
async function ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : (r.result && r.result.exceptionDetails ? 'ERR:' + r.result.exceptionDetails.text : undefined); }
await send('Runtime.enable');
await sleep(1500);

function kpi(i) { return `document.querySelectorAll('#kpis .kpi')[${i}].textContent`; }
// coin sayısı KPI'sını bul (İşlem gören coin)
const probe = (label) => `(function(){var k=[...document.querySelectorAll('#kpis .kpi')].map(function(x){return x.textContent;}); return k[0]+' || '+k.filter(function(s){return s.indexOf('İşlem gören coin')>=0;})[0];})()`;

await ev("document.getElementById('reset').click()"); await sleep(600);
console.log('TÜMÜ      :', await ev(probe()));
await ev("document.querySelectorAll('#volChips .chip')[1].click()"); await sleep(700); // 50
console.log('EN HAC. 50:', await ev(probe()));
await ev("document.querySelectorAll('#volChips .chip')[3].click()"); await sleep(700); // 150
console.log('EN HAC.150:', await ev(probe()));
await ev("document.querySelectorAll('#volChips .chip')[6].click()"); await sleep(700); // 300
console.log('EN HAC.300:', await ev(probe()));
// liste ilk durumun neti
console.log('ilk liste öğesi (300):', await ev("document.querySelector('#list .item .net').textContent"));
await ev("document.querySelectorAll('#volChips .chip')[1].click()"); await sleep(700); // 50
console.log('ilk liste öğesi (50) :', await ev("document.querySelector('#list .item .net').textContent"));
await ev("document.querySelectorAll('#volChips .chip')[0].click()"); await sleep(700); // tümü
console.log('ilk liste öğesi (tümü):', await ev("document.querySelector('#list .item .net').textContent"));
ws.close();
