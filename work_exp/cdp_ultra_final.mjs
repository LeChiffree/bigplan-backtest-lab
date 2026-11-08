import { writeFileSync } from 'node:fs';
const PORT = 9223;
const URL = 'http://192.168.1.124:8123/ultra';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json();
const t = list.find((x) => x.type === 'page');
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
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result && r.result.exceptionDetails) return 'ERR:' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result && r.result.result ? r.result.result.value : r; };
const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); writeFileSync(file, Buffer.from(r.result.data, 'base64')); };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Page.navigate', { url: URL });
await sleep(3000);

console.log('URL:', await ev('location.href'));
console.log('HERO:', await ev("[sTotal.textContent,sSurv.textContent,sDistinct.textContent,sBest.textContent,sLiq.textContent,sUniverse.textContent].join(' | ')"));
console.log('BAŞLIK:', await ev("document.querySelector('h1').innerText"));
console.log('KART:', await ev("document.querySelectorAll('#topCards .top-card').length + ' · ' + [...document.querySelectorAll('#topCards .top-card h3')].map(x=>x.textContent).join(' / ')"));
console.log('TABLO:', await ev("document.querySelectorAll('#rankBody tr').length + ' · ' + document.getElementById('tableCount').innerText"));
console.log('CHART:', await ev("[eqChart.toDataURL().length,scatterChart.toDataURL().length].join(' | ')"));
console.log('OVERFLOW:', await ev("document.documentElement.scrollWidth + ' / ' + innerWidth"));
await ev("document.getElementById('topCards').scrollIntoView({block:'start'})"); await sleep(400);
await shot('D:/BigPlan/work_exp/ultra_final_cards.png');

// hover equity chart
await ev("document.getElementById('eqChart').scrollIntoView({block:'center'})"); await sleep(400);
await ev(`(function(){var c=document.getElementById('eqChart');var r=c.getBoundingClientRect();c.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.left+r.width*0.65,clientY:r.top+r.height*0.5}));})()`);
await sleep(300);
console.log('TOOLTIP:', await ev("document.getElementById('eqTip').className + ' :: ' + document.getElementById('eqTip').innerText.replace(/\\s+/g,' ').slice(0,180)"));
await shot('D:/BigPlan/work_exp/ultra_final_charts.png');

// I+G sort
await ev("document.getElementById('rankTable').scrollIntoView({block:'start'})"); await sleep(300);
await ev("document.getElementById('rankIG').click()"); await sleep(600);
console.log('I+G BUTON:', await ev("document.querySelector('#bucketSeg button.on').textContent + ' · ' + document.querySelectorAll('#rankBody tr').length + ' · ' + document.querySelector('#rankBody tr').innerText.replace(/\\s+/g,' ').slice(0,180)"));
await shot('D:/BigPlan/work_exp/ultra_final_ig.png');
await ev("document.querySelector('#bucketSeg button[data-bucket=\"all\"]').click(); document.querySelector('th[data-col=\"rank\"]').click();"); await sleep(300);

// modal
await ev("document.getElementById('topCards').scrollIntoView({block:'start'})"); await sleep(300);
await ev("document.querySelector('#topCards .top-card .btn').click()"); await sleep(700);
console.log('MODAL:', await ev("document.getElementById('modal').hidden + ' · ' + document.querySelector('#modalBody h2').textContent + ' · ' + document.querySelectorAll('#modalBody .mtable').length"));
console.log('MODAL DD:', await ev("document.getElementById('ddChart').toDataURL().length"));
await shot('D:/BigPlan/work_exp/ultra_final_modal.png');
await ev("document.querySelector('[data-close]').click()"); await sleep(300);

// mobile
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: URL });
await sleep(2600);
console.log('MOBILE OVERFLOW:', await ev("document.documentElement.scrollWidth + ' / ' + innerWidth"));
console.log('MOBILE KART:', await ev("document.querySelectorAll('#topCards .top-card').length + ' · ' + document.querySelector('#topCards .top-card').getBoundingClientRect().width"));
await ev("window.scrollTo(0,0)"); await sleep(300);
await shot('D:/BigPlan/work_exp/ultra_final_mobile_top.png');
await ev("document.getElementById('topCards').scrollIntoView({block:'start'})"); await sleep(400);
await shot('D:/BigPlan/work_exp/ultra_final_mobile_cards.png');
await send('Emulation.clearDeviceMetricsOverride');
await send('Page.navigate', { url: URL });
await sleep(2200);
console.log('HATALAR:', errors.length ? errors.join(' || ') : 'yok');
ws.close();
