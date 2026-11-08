// cdp_list.mjs — seçili durum vs tümü ve hacim altında liste sıralaması
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
await sleep(2000);

const dump = '(function(){var it=document.querySelector("#list .item"); return JSON.stringify({title:document.getElementById("selTitle").textContent, aggBtn:document.getElementById("aggBtn").className, kpi0:document.querySelectorAll("#kpis .kpi")[0].textContent.replace(/\\s+/g," ").slice(0,60), firstId:it.querySelector("b").textContent, firstTf:it.querySelector(".tag.tf").textContent, firstNet:it.querySelector(".net").textContent, volChip:document.querySelector("#volChips .chip.on").textContent});})()';
console.log('yüklenince        :', await ev(dump));
await ev("document.querySelectorAll('#volChips .chip')[1].click()"); await sleep(900);
console.log('vol 50 (seçili)   :', await ev(dump));
await ev("document.getElementById('aggBtn').click()"); await sleep(900);
console.log('vol 50 (tümüne dön):', await ev(dump));
await ev("document.querySelectorAll('#volChips .chip')[0].click()"); await sleep(900);
console.log('tümü (tümüne dön) :', await ev(dump));
ws.close();
process.exit(0);
