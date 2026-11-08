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
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : ('ERR:' + JSON.stringify(r)); };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL });
await sleep(2400);
console.log('TOP:', await ev("[sTotal.textContent,sSurv.textContent,sDistinct.textContent].join('|') + ' cards=' + document.querySelectorAll('#topCards .top-card').length + ' rows=' + document.querySelectorAll('#rankBody tr').length"));
console.log('REST BTN:', await ev("document.querySelector('#bucketSeg button[data-bucket=\\\"rest\\\"]').textContent"));
await ev("document.getElementById('rankIG').click()");
await sleep(700);
console.log('AFTER IG:', await ev("document.querySelector('#bucketSeg button.on').textContent + ' | rows=' + document.querySelectorAll('#rankBody tr').length + ' | count=' + document.getElementById('tableCount').innerText.replace(/\\s+/g,' ') + ' | first=' + document.querySelector('#rankBody tr').innerText.replace(/\\s+/g,' ').slice(0,160)"));
console.log('HAS TOP5:', await ev("[...document.querySelectorAll('#rankBody tr')].filter(tr=>tr.classList.contains('top5row')).length"));
console.log('ERRORS:', errors.length ? errors.join(' || ') : 'yok');
ws.close();
