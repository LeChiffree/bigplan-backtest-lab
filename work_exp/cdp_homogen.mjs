// cdp_homogen.mjs — HOMOJENLIK.html katman filtrelerini ve JS hatalarını doğrular
const PORT = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() { const res = await fetch('http://127.0.0.1:' + PORT + '/json'); return res.json(); }
let target = null;
for (let i = 0; i < 40; i++) {
  try {
    const list = await targets();
    target = list.find((t) => t.type === 'page' && t.url.includes('HOMOJENLIK'));
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
  if (r.result && r.result.exceptionDetails) return 'ERR:' + r.result.exceptionDetails.text;
  return r.result && r.result.result ? r.result.result.value : undefined;
}
await send('Runtime.enable');
await send('Log.enable');
await sleep(1800);

console.log('KPI:', await ev("[...document.querySelectorAll('#kpis .kpi')].map(x=>x.textContent).join(' | ')"));
console.log('VARYANT PANELİ:', await ev("document.getElementById('variants').innerText.replace(/\\s+/g,' ').slice(0,700)"));
console.log('BAŞLANGIÇ SATIR:', await ev("document.querySelectorAll('#tbl tbody tr').length"));
console.log('İLK SATIR:', await ev("document.querySelector('#tbl tbody tr').innerText.replace(/\\s+/g,' ').slice(0,220)"));

async function setKat(v) {
  await ev(`(function(){var s=document.getElementById('katSel'); s.value=${JSON.stringify(v)}; s.dispatchEvent(new Event('input',{bubbles:true})); return s.value;})()`);
  await sleep(350);
  return await ev("document.querySelectorAll('#tbl tbody tr').length + ' satır · ' + document.getElementById('cnt').textContent");
}
console.log('hom      :', await setKat('hom'));
console.log('hom10    :', await setKat('hom10'));
console.log('hom10c   :', await setKat('hom10c'));
console.log('homBtc   :', await setKat('homBtc'));
console.log('near5    :', await setKat('near5'));
console.log('near5a   :', await setKat('near5a'));
console.log('near5btc :', await setKat('near5btc'));

await setKat('hom10');
await ev("document.querySelector('#tbl tbody tr').click()");
await sleep(300);
console.log('DETAY:', await ev("document.getElementById('detail').style.display + ' :: ' + document.getElementById('detail').innerText.replace(/\\s+/g,' ').slice(0,420)"));
await setKat('');
console.log('HATALAR:', errors.length ? errors.join(' || ') : 'yok');
ws.close();
