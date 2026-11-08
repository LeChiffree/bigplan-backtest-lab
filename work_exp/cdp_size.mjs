const PORT = 9223;
const list = await (await fetch('http://127.0.0.1:' + PORT + '/json')).json();
const t = list.find((x) => x.type === 'page' && x.url.includes('ULTRA'));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const p = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } });
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params) => new Promise((res) => { const i = ++id; p.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result && r.result.result ? r.result.result.value : r; };
console.log(await ev(`JSON.stringify({
  vw: innerWidth, sw: document.documentElement.scrollWidth,
  cw: document.getElementById('topCards').getBoundingClientRect().width,
  cards: [...document.querySelectorAll('#topCards .top-card')].map(c => {
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), sw: c.scrollWidth, sh: c.scrollHeight };
  })
})`));
ws.close();
