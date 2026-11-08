// cdp_test.mjs — Edge remote-debug ile dashboard etkileşim/JS hata testi
const PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  const res = await fetch('http://127.0.0.1:' + PORT + '/json');
  return res.json();
}

let target = null;
for (let i = 0; i < 40; i++) {
  try {
    const list = await targets();
    target = list.find((t) => t.type === 'page' && t.url.includes('BACKTEST93'));
    if (target && target.webSocketDebuggerUrl) break;
  } catch (e) { /* not up yet */ }
  await sleep(500);
}
if (!target) { console.log('HEDEF YOK'); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') events.push({ t: 'exception', d: m.params.exceptionDetails && (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text) });
  if (m.method === 'Log.entryAdded') { const e = m.params.entry; if (e.level === 'error') events.push({ t: 'log', d: e.text }); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') events.push({ t: 'console', d: (m.params.args || []).map((a) => a.value || a.description).join(' ') });
});
await new Promise((r) => ws.addEventListener('open', r));
function send(method, params) {
  return new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) return { err: r.result.exceptionDetails.text };
  return r.result && r.result.result ? r.result.result.value : undefined;
}

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await sleep(4500);

const checks = [];
checks.push(['liste öğesi (93 bekleniyor)', await evaluate("document.querySelectorAll('#list .item').length")]);
checks.push(['KPI kartı (10 bekleniyor)', await evaluate("document.querySelectorAll('#kpis .kpi').length")]);
checks.push(['canvas (10 bekleniyor)', await evaluate("document.querySelectorAll('canvas').length")]);
checks.push(['seçili başlık', await evaluate("document.getElementById('selTitle').textContent")]);

// bir durum seç
await evaluate("document.querySelectorAll('#list .item')[5].click()");
await sleep(400);
checks.push(['tıklama sonrası başlık', await evaluate("document.getElementById('selTitle').textContent")]);
checks.push(['tümü butonu pasif mi', await evaluate("!document.getElementById('aggBtn').classList.contains('on')")]);

// coin tıklama
await evaluate("var c=document.getElementById('cCoin'); if(c._click){c._click(500,80);} 'ok'");
await sleep(300);
checks.push(['coin detay doldu mu', await evaluate("document.getElementById('coinDetail').innerHTML.length>20")]);

// TRT geçişi
await evaluate("document.querySelectorAll('#hourToggle .chip')[1].click()");
await sleep(200);
checks.push(['TRT aktif', await evaluate("document.querySelectorAll('#hourToggle .chip')[1].classList.contains('on')")]);

// günlük ölçek geçişi
await evaluate("document.querySelectorAll('#dailyToggle .chip')[1].click()");
await sleep(200);
checks.push(['tam ölçek aktif', await evaluate("document.querySelectorAll('#dailyToggle .chip')[1].classList.contains('on')")]);

// yıl filtresi: 2022 kapat
await evaluate("document.querySelectorAll('#yearChips .chip')[0].click()");
await sleep(300);
checks.push(['2022 kapalı', await evaluate("!document.querySelectorAll('#yearChips .chip')[0].classList.contains('on')")]);
checks.push(['liste öğesi (yıl filtresi sonrası)', await evaluate("document.querySelectorAll('#list .item').length")]);

// TF filtresi: 4h
await evaluate("document.querySelectorAll('#tfChips .chip')[3].click()");
await sleep(300);
checks.push(['4h filtresi sonrası liste', await evaluate("document.querySelectorAll('#list .item').length")]);

// sıfırla
await evaluate("document.getElementById('reset').click()");
await sleep(400);
checks.push(['sıfırlama sonrası liste', await evaluate("document.querySelectorAll('#list .item').length")]);

// kaldıraç: 20x seç
await evaluate("document.querySelectorAll('#levChips .chip')[5].click()");
await sleep(500);
checks.push(['20x aktif', await evaluate("document.querySelectorAll('#levChips .chip')[5].classList.contains('on')")]);
checks.push(['kaldıraç merdiveni satır (6)', await evaluate("document.querySelectorAll('#ladder tbody tr').length")]);
checks.push(['başlık rozetinde 20x', await evaluate("document.getElementById('selBadges').textContent.indexOf('20x')>=0")]);
checks.push(['durum listesinde tasfiye etiketi', await evaluate("document.body.textContent.indexOf('tasfiye')>=0")]);
await evaluate("document.querySelectorAll('#levChips .chip')[3].click()"); // 10x
await sleep(400);
checks.push(['10x aktif', await evaluate("document.querySelectorAll('#levChips .chip')[3].classList.contains('on')")]);
checks.push(['harita hâlâ çiziliyor (KPI=10)', await evaluate("document.querySelectorAll('#kpis .kpi').length")]);

// hacim filtresi
checks.push(['hacim çipi (7: Tümü+6)', await evaluate("document.querySelectorAll('#volChips .chip').length")]);
await evaluate("document.querySelectorAll('#volChips .chip')[1].click()"); // en hacimli 50
await sleep(600);
checks.push(['hacim 50 aktif', await evaluate("document.querySelectorAll('#volChips .chip')[1].classList.contains('on')")]);
checks.push(['hacim rozeti', await evaluate("String(document.getElementById('selBadges').textContent).indexOf('en hacimli 50')>=0")]);
checks.push(['hacim sonrası liste', await evaluate("document.querySelectorAll('#list .item').length")]);
checks.push(['hacim sonrası KPI (10)', await evaluate("document.querySelectorAll('#kpis .kpi').length")]);
checks.push(['hacim sonrası canvas (10)', await evaluate("document.querySelectorAll('canvas').length")]);
checks.push(['hacim KPI coin sayısı', await evaluate("document.querySelectorAll('#kpis .kpi')[2].textContent")]);
// coin grafiği tooltip (hacim filtresi altında)
checks.push(['coin grafiği hit', await evaluate("(function(){var c=document.getElementById('cCoin'); if(!c||!c._hit) return 'yok'; for(var y=30;y<300;y+=10){var q=c._hit(500,y); if(q&&q.html) return 'var';} return 'hit yok';})()")]);
await evaluate("document.querySelectorAll('#volChips .chip')[6].click()"); // en hacimli 300
await sleep(400);
checks.push(['hacim 300 aktif', await evaluate("document.querySelectorAll('#volChips .chip')[6].classList.contains('on')")]);
await evaluate("document.querySelectorAll('#volChips .chip')[0].click()"); // Tümü
await sleep(500);
checks.push(['tümü aktif', await evaluate("document.querySelectorAll('#volChips .chip')[0].classList.contains('on')")]);
checks.push(['tümü sonrası liste', await evaluate("document.querySelectorAll('#list .item').length")]);

for (const [k, v] of checks) console.log((v === true || (typeof v === 'number' && v > 0) ? 'OK  ' : 'BAK ') + k + ': ' + v);
console.log('--- JS olayları (hata bekleniyor: 0) ---', events.length);
for (const e of events.slice(0, 10)) console.log(e.t + ':', String(e.d).slice(0, 300));
ws.close();
