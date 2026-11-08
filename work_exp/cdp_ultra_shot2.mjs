import { writeFileSync } from 'node:fs';
const PORT = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json();
const t = list.find((x) => x.type === 'page' && x.url.includes('ULTRA'));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = new Map(); const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push('EX: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('LOG: ' + m.params.entry.text);
  if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params) => new Promise((res) => { const i = ++id; p.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : r; };
const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(file, Buffer.from(r.result.data, 'base64')); };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await sleep(800);
await ev("document.getElementById('rankTable').scrollIntoView({block:'start'})"); await sleep(500);
await shot('D:/BigPlan/work_exp/ultra_table.png');
console.log('TABLE RECT:', await ev("JSON.stringify((()=>{const r=document.getElementById('rankTable').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};})())"));
console.log('WRAP RECT:', await ev("JSON.stringify((()=>{const r=document.querySelector('.table-wrap').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,sw:document.querySelector('.table-wrap').scrollWidth};})())"));
// open an eliminated row for detail
await ev("document.querySelector('#bucketSeg button[data-bucket=\"elim\"]').click()"); await sleep(300);
await ev("document.querySelector('#rankBody tr').click()"); await sleep(500);
console.log('ELENDİ MODAL:', await ev("document.querySelector('#modalBody h2').textContent + ' :: ' + [...document.querySelectorAll('#modalBody .warnbox')].map(x=>x.innerText.replace(/\\s+/g,' ')).join(' || ').slice(0,500)"));
await ev("document.querySelector('.modal-card').scrollTo(0,0)"); await sleep(300);
await shot('D:/BigPlan/work_exp/ultra_modal_elim.png');
await ev("document.querySelector('[data-close]').click()"); await sleep(200);
console.log('HATALAR:', errors.length ? errors.join(' || ') : 'yok');
ws.close();
