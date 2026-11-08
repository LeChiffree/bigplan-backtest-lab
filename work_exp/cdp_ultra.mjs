// cdp_ultra.mjs — ULTRA.html doğrulama + ekran görüntüleri
import { writeFileSync } from 'node:fs';
const PORT = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() { const res = await fetch('http://127.0.0.1:' + PORT + '/json'); return res.json(); }
let target = null;
for (let i = 0; i < 50; i++) {
  try {
    const list = await targets();
    target = list.find((t) => t.type === 'page' && t.url.includes('ULTRA'));
    if (target && target.webSocketDebuggerUrl) break;
  } catch (e) {}
  await sleep(500);
}
if (!target) { console.log('HEDEF YOK'); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') errors.push('EX: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('LOG: ' + m.params.entry.text);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
await new Promise((r) => ws.addEventListener('open', r));
function send(method, params) { return new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params: params || {} })); }); }
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) return 'ERR:' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result && r.result.result ? r.result.result.value : undefined;
}
async function shot(file) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(file, Buffer.from(r.result.data, 'base64'));
}
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await sleep(2200);

console.log('HERO:', await ev("[document.getElementById('sTotal').textContent,document.getElementById('sSurv').textContent,document.getElementById('sDistinct').textContent,document.getElementById('sBest').textContent,document.getElementById('sLiq').textContent,document.getElementById('sUniverse').textContent].join(' | ')"));
console.log('KART SAYISI:', await ev("document.querySelectorAll('#topCards .top-card').length"));
console.log('KARTLAR:', await ev("[...document.querySelectorAll('#topCards .top-card h3')].map(x=>x.textContent).join(' || ')"));
console.log('İLK KART HOOK:', await ev("document.querySelector('#topCards .top-card .hook').textContent"));
console.log('İLK KART METRİK:', await ev("[...document.querySelectorAll('#topCards .top-card .metric')].slice(0,12).map(x=>x.innerText.replace(/\\s+/g,' ')).join(' | ')"));
console.log('TABLO SATIR:', await ev("document.querySelectorAll('#rankBody tr').length"), '·', await ev("document.getElementById('tableCount').innerText"));
console.log('TABLO İLK:', await ev("document.querySelector('#rankBody tr').innerText.replace(/\\s+/g,' ').slice(0,320)"));
console.log('CHART DATA:', await ev("[document.getElementById('eqChart').toDataURL().length,document.getElementById('scatterChart').toDataURL().length].join(' | ')"));

await shot('D:/BigPlan/work_exp/ultra_top.png');
await ev("document.getElementById('topCards').scrollIntoView({block:'start'})"); await sleep(600);
await shot('D:/BigPlan/work_exp/ultra_cards.png');

console.log('15x TIK:', await ev("(function(){document.querySelector('#levSeg button[data-lev=\"15\"]').click(); return document.querySelector('#levSeg button.on').textContent + ' · ' + document.getElementById('eqChart').toDataURL().length;})()"));
await ev("document.querySelector('#topCards .top-card .btn').click()"); await sleep(700);
console.log('MODAL:', await ev("document.getElementById('modal').hidden + ' · ' + document.querySelector('#modalBody h2').textContent + ' · ' + document.querySelectorAll('#modalBody .mtable').length + ' tablo'"));
console.log('MODAL DD:', await ev("document.querySelector('#ddChart').toDataURL().length"));
await ev("document.querySelector('[data-ddlev=\"15\"]').click()"); await sleep(300);
console.log('MODAL DD 15x:', await ev("document.querySelector('#ddChart').toDataURL().length"));
await ev("document.querySelector('.modal-card').scrollTo(0,0)"); await sleep(300);
await shot('D:/BigPlan/work_exp/ultra_modal.png');

await ev("document.querySelector('[data-close]').click()"); await sleep(300);
console.log('MODAL KAPANDI:', await ev("document.getElementById('modal').hidden"));

await ev("document.querySelector('th[data-col=\"implRel\"]').click()"); await sleep(300);
console.log('I+G SIRALAMA İLK:', await ev("document.querySelector('#rankBody tr').innerText.replace(/\\s+/g,' ').slice(0,220)"));
await ev("document.querySelector('#bucketSeg button[data-bucket=\"elim\"]').click()"); await sleep(300);
console.log('ELENDİ SATIR:', await ev("document.querySelectorAll('#rankBody tr').length"), '·', await ev("document.getElementById('tableCount').innerText"));
await ev("document.getElementById('search').value='MFI'; document.getElementById('search').dispatchEvent(new Event('input',{bubbles:true}))"); await sleep(300);
console.log('ARAMA MFI:', await ev("document.querySelectorAll('#rankBody tr').length"), '·', await ev("[...document.querySelectorAll('#rankBody tr td:nth-child(2) .ttl')].map(x=>x.innerText.replace(/\\s+/g,' ')).join(' | ')"));
await ev("document.querySelector('#bucketSeg button[data-bucket=\"all\"]').click(); document.getElementById('search').value=''; document.getElementById('search').dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('th[data-col=\"rank\"]').click();"); await sleep(300);
console.log('SON SATIR:', await ev("document.querySelectorAll('#rankBody tr').length"));
console.log('HATALAR:', errors.length ? errors.join(' || ') : 'yok');
ws.close();
