// homogen_html.mjs — HOMOJENLIK.html üretimi (tek dosya, çevrimdışı)
// Girdi: out/homojenlik.json → DASHBOARD.html ile aynı üslupta bağımsız sayfa.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BP } from './core.mjs';

const D = JSON.parse(await readFile(join(BP, 'out', 'homojenlik.json'), 'utf8'));
const dataStr = JSON.stringify(D).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');

const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Homojenlik Analizi — Filtre Laboratuvarı</title>
<style>
  :root { --bg:#0f1420; --panel:#161d2e; --panel2:#1c2740; --line:#26314d; --txt:#e8edf7; --mut:#9aa7c4; --pos:#2ecc8f; --neg:#ff5d6c; --warn:#f7b731; --acc:#4f8cff; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--txt); font:14px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif; }
  .wrap { max-width:1280px; margin:0 auto; padding:20px 18px 60px; }
  h1 { font-size:22px; margin:8px 0 4px; }
  h2 { font-size:17px; margin:26px 0 10px; color:#cfd9f2; }
  .sub { color:var(--mut); font-size:13px; margin-bottom:14px; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }
  .kpi { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 14px; }
  .kpi .n { font-size:22px; font-weight:700; }
  .kpi .t { color:var(--mut); font-size:12px; margin-top:4px; }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px; margin-top:14px; }
  table { border-collapse:collapse; width:100%; font-size:13px; }
  th, td { padding:6px 8px; border-bottom:1px solid var(--line); text-align:right; white-space:nowrap; }
  #tbl th:first-child, #tbl td:first-child { max-width:360px; white-space:normal; }
  th { position:sticky; top:0; background:var(--panel2); text-align:right; cursor:pointer; user-select:none; font-weight:600; }
  th.l, td.l { text-align:left; }
  tr:hover td { background:#1b2540; }
  .pos { color:var(--pos); } .neg { color:var(--neg); } .warn { color:var(--warn); }
  .pill { display:inline-block; padding:1px 8px; border-radius:999px; font-size:11px; border:1px solid var(--line); color:var(--mut); }
  .pill.hom { background:#103a2b; border-color:#1f6b4e; color:#7ff0c0; }
  .pill.kurt { background:#3a2f10; border-color:#7a6420; color:#ffd97a; }
  .pill.hdrx { background:#122c4d; border-color:#2b5c99; color:#9cc4ff; }
  .rowbtns { display:flex; gap:10px; flex-wrap:wrap; margin:10px 0; align-items:center; }
  input[type=text], select { background:var(--panel2); color:var(--txt); border:1px solid var(--line); border-radius:8px; padding:7px 10px; font-size:13px; }
  .mtable { width:auto; font-size:11.5px; margin-top:10px; }
  .mtable th, .mtable td { padding:3px 6px; text-align:center; }
  .mtable td.z { color:var(--mut); }
  .cell { border-radius:3px; }
  .heatwrap { overflow:auto; max-height:70vh; border:1px solid var(--line); border-radius:10px; }
  .detail { margin-top:12px; padding:12px; background:var(--panel2); border:1px solid var(--line); border-radius:10px; display:none; }
  .foot { color:var(--mut); font-size:12px; margin-top:26px; border-top:1px solid var(--line); padding-top:12px; }
  .note { color:var(--warn); font-size:12.5px; }
  code { background:#0b1020; padding:1px 5px; border-radius:5px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Homojenlik Analizi — “Kâr birkaç güne mi bağlı?”</h1>
  <div class="sub">593 hücre × temel + en iyi filtreli varyantlar · günlük portföy eğrileri (out/daily) · üretim: <span id="gen"></span></div>

  <div class="kpis" id="kpis"></div>

  <h2>Ölçütler</h2>
  <div class="panel" id="crit"></div>

  <h2>Ölçüt 4 Varyantları — gün yoğunlaşması nasıl tanımlanmalı?</h2>
  <div class="panel" id="variants"></div>

  <h2>Durumlar <span class="sub" style="display:inline">(tıkla → aylık tablo; başlığa tıkla → sırala)</span></h2>
  <div class="rowbtns">
    <input type="text" id="q" placeholder="Ara: strateji / filtre anahtarı / tf…">
    <select id="tfSel"><option value="">TF: tümü</option></select>
    <select id="kindSel">
      <option value="">Durum: tümü</option>
      <option value="temel">Sadece temel</option>
      <option value="filtreli">Sadece filtreli</option>
    </select>
    <select id="katSel">
      <option value="">Katman: tümü</option>
      <option value="hom">6/6 orijinal (0)</option>
      <option value="hom10">6/6 · alt-10 artımlı (78)</option>
      <option value="hom10c">6/6 · alt-10 bileşik (76)</option>
      <option value="homBtc">6/6 · BTC-göreli (80)</option>
      <option value="near5">5/6 dayanıklı (93)</option>
      <option value="near5a">5/6 + alt-10 (78)</option>
      <option value="near5btc">5/6 + BTC-göreli (80)</option>
    </select>
    <label><input type="checkbox" id="onlyHom"> yalnız homojen</label>
    <label><input type="checkbox" id="onlyKurt"> yalnız kurtarılan</label>
    <span class="sub" id="cnt"></span>
  </div>
  <div class="heatwrap">
    <table id="tbl">
      <thead><tr>
        <th class="l" data-k="ad">Strateji</th><th data-k="tf">TF</th><th class="l" data-k="kind">Durum</th><th class="l" data-k="katman">Katman</th>
        <th data-k="n">İşlem</th><th data-k="net">Net kâr</th><th data-k="pozAy">Poz ay</th>
        <th data-k="top1Ay">Top1 ay</th><th data-k="top5Gun">Top5 gün</th><th data-k="top10Add">10g art.</th><th data-k="btcTop5">BTC top5</th><th data-k="r2">R²</th>
        <th data-k="pozGun">Poz gün</th><th data-k="dd">Maks DD</th><th data-k="y23">2023</th><th data-k="y24">2024</th><th data-k="y25">2025</th>
        <th data-k="score">Skor</th>
      </tr></thead>
      <tbody></tbody>
    </table>
  </div>
  <div class="detail" id="detail"></div>

  <div class="foot">
    Eğitim amaçlı araştırmadır; yatırım tavsiyesi değildir. Homojenlik kriterleri seçimden bağımsız uygulanmıştır ancak veri madenciliği riskini sıfırlamaz.
    Ölçüt 4 varyantları: alt-10 (artımlı/bileşik), BTC-göreli yoğunlaşma, BTC-beta arındırılmış yoğunlaşma ve 5/6 katmanı. CSV'de <code>top10_pass</code>, <code>top10_comp_pass</code>, <code>btc_rel_pass</code>, <code>btc_ex_pass</code>, <code>katman</code> kolonları.
    Ayrıntı: <code>out/HOMOJENLIK-RAPORU.md</code> · <code>out/homojenlik.csv</code> · Bu sayfa tamamen çevrimdışıdır.
  </div>
</div>

<script id="DATA" type="application/json">${dataStr}</script>
<script>
const D = JSON.parse(document.getElementById('DATA').textContent);
document.getElementById('gen').textContent = D.gen.replace('T',' ').slice(0,16) + ' UTC';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = (v,d=1) => v==null? '—' : (v*100).toFixed(d)+'%';
const sgn = (v,d=1) => v==null? '—' : (v>=0?'+':'')+(v*100).toFixed(d)+'%';
const cls = (v) => v==null? '' : v>0? 'pos' : v<0? 'neg' : '';

// KPI
const R = D.rows;
const pos = R.filter(r=>r.net>0), hom = R.filter(r=>r.hom);
const homBase = hom.filter(r=>r.kind==='temel'), homVar = hom.filter(r=>r.kind!=='temel');
const kurt = R.filter(r=>r.kurt===1), kurtHom = kurt.filter(r=>r.hom);
const near5 = R.filter(r=>r.near5===1);
const h10 = R.filter(r=>r.hom10===1);
const h10c = R.filter(r=>r.hom10c===1);
const hbtc = R.filter(r=>r.homBtc===1);
const t5 = pos.map(r=>r.top5Gun).filter(v=>v!=null).sort((a,b)=>a-b);
const med = t5.length? t5[t5.length>>1] : null;
const kpi = (n,t,c) => '<div class="kpi"><div class="n '+(c||'')+'">'+n+'</div><div class="t">'+t+'</div></div>';
document.getElementById('kpis').innerHTML = [
  kpi(R.length, 'toplam durum (hücre × temel/varyant)'),
  kpi(pos.length, 'net pozitif durum', 'pos'),
  kpi(hom.length, 'HOMOJEN (orijinal 6/6)', hom.length? 'pos':'warn'),
  kpi(h10.length, '6/6 · alt-10 (artımlı)', 'pos'),
  kpi(hbtc.length, '6/6 · BTC-göreli', 'pos'),
  kpi(near5.length, '5/6 dayanıklı katman', 'warn'),
  kpi(homBase.length + ' / ' + homVar.length, 'homojen: temel / filtreli'),
  kpi(kurtHom.length + ' / ' + kurt.length, 'kurtarılanda homojen'),
  kpi(med!=null? pct(med,0):'—', 'pozitiflerde medyan: en iyi %5 günün kâr payı', 'warn'),
].join('');

// ölçüt listesi
const crit = D.criteria || [];
document.getElementById('crit').innerHTML = '<b>Homojen sayılmak için hepsi:</b> ' +
  crit.map(c=>'<span class="pill">'+esc(c)+'</span>').join(' ') +
  '<div class="sub" style="margin-top:8px">Net kâr &gt; 0 · pozitif ay ≥ %60 · en büyük ay payı ≤ %33 · en iyi %5 gün payı ≤ %40 · kümülatif kâr–zaman R² ≥ 0.80 · 2023/2024/2025 tamamı pozitif.</div>';

// ölçüt 4 varyantları
const V = D.variants || {};
const vrow = (lbl, def, pass, of93) => '<tr><td class="l"><b>'+lbl+'</b></td><td class="l">'+def+'</td><td>'+pass+'</td><td>'+of93+'</td></tr>';
document.getElementById('variants').innerHTML =
  '<div class="sub" style="margin-top:0">Orijinal ölçüt günlük kripto serilerinde yapısal olarak ulaşılamaz (pozitiflerde medyan top5 payı '+(med!=null?pct(med,0):'—')+'). Dört tanımı birlikte raporluyoruz; hiçbiri tek başına “doğru” değildir. BTC bazı: <b>'+(V.btcTop5!=null?pct(V.btcTop5,0):'—')+'</b> ('+(V.btcDays||'—')+' gün, aynı dönem).</div>'
  + '<table style="width:auto"><thead><tr><th class="l">Varyant</th><th class="l">Tanım</th><th>6/6 geçen</th><th>93 aday içinde</th></tr></thead><tbody>'
  + vrow('Orijinal', 'en iyi %5 gün payı ≤ %40', V.original?V.original.pass:'—', V.original?V.original.of93:'—')
  + vrow('Alt-10 (artımlı)', 'en iyi 10 gün çıkarılınca artımlı toplam &gt; 0', V.alt10?V.alt10.pass:'—', V.alt10?V.alt10.of93:'—')
  + vrow('Alt-10 (bileşik)', 'en iyi 10 gün 0 getiri sayılınca bileşik net &gt; 0', V.alt10comp?V.alt10comp.pass:'—', V.alt10comp?V.alt10comp.of93:'—')
  + vrow('BTC-göreli', 'top5 payı ≤ aynı dönemde BTC top5 payı', V.btcRel?V.btcRel.pass:'—', V.btcRel?V.btcRel.of93:'—')
  + vrow('BTC-beta arındırılmış', 'BTC betası çıkarıldıktan sonra top5 ≤ %40', V.btcExcess?V.btcExcess.pass:'—', V.btcExcess?V.btcExcess.of93:'—')
  + vrow('5/6 katman', 'yalnız top5 eksik; diğer 5 ölçüt tamam', V.near5?V.near5.pass:'—', V.near5?V.near5.of93:'—')
  + '</tbody></table>'
  + '<div class="sub" style="margin-top:8px">“6/6 geçen” yalnızca diğer beş ölçütü de geçen durumları sayar. 93 aday zaten diğer beşi geçtiği için iki sütun aynıdır. Bileşik alt-10, artımlıdan 2 aday daha katıdır (<code>aroon 4h temel</code>, <code>voi 4h varyant2</code>).</div>';

// tf select
const tfs = [...new Set(R.map(r=>r.tf))];
document.getElementById('tfSel').insertAdjacentHTML('beforeend', tfs.map(t=>'<option>'+t+'</option>').join(''));

let sortK='score', sortD=-1, sel=null;
function rowsView(){
  const q=document.getElementById('q').value.trim().toLowerCase();
  const tf=document.getElementById('tfSel').value;
  const kd=document.getElementById('kindSel').value;
  const kat=document.getElementById('katSel').value;
  const onlyHom=document.getElementById('onlyHom').checked;
  const onlyKurt=document.getElementById('onlyKurt').checked;
  let v=R.filter(r=>{
    if(tf&&r.tf!==tf) return false;
    if(kd==='temel'&&r.kind!=='temel') return false;
    if(kd==='filtreli'&&r.kind==='temel') return false;
    if(kat==='hom'&&!r.hom) return false;
    if(kat==='hom10'&&r.hom10!==1) return false;
    if(kat==='hom10c'&&r.hom10c!==1) return false;
    if(kat==='homBtc'&&r.homBtc!==1) return false;
    if(kat==='near5'&&r.near5!==1) return false;
    if(kat==='near5a'&&!(r.near5===1&&r.c4alt10===1)) return false;
    if(kat==='near5btc'&&!(r.near5===1&&r.c4btc===1)) return false;
    if(onlyHom&&!r.hom) return false;
    if(onlyKurt&&r.kurt!==1) return false;
    if(q){ const hay=(r.id+' '+r.ad+' '+(r.keys||[]).join(' ')+' '+r.tf).toLowerCase(); if(!hay.includes(q)) return false; }
    return true;
  });
  v.sort((a,b)=>{ const x=a[sortK], y=b[sortK];
    const c = (typeof x==='string') ? x.localeCompare(y) : ((x??-9e9)-(y??-9e9));
    return c*sortD; });
  return v;
}
function katCell(r){
  const o=[];
  if(r.hom) o.push('<span class="pill hom">6/6</span>');
  if(r.hom10) o.push('<span class="pill hom">6/6·10g</span>');
  if(r.hom10c && !r.hom10) o.push('<span class="pill">6/6·10g bileşik</span>');
  if(r.homBtc) o.push('<span class="pill hdrx">6/6·BTC</span>');
  if(r.near5===1 && !r.hom10 && !r.homBtc) o.push('<span class="pill">5/6</span>');
  return o.length? o.join(' ') : '<span class="sub">—</span>';
}
function render(){
  const v=rowsView();
  document.getElementById('cnt').textContent = v.length + ' satır';
  const tb=document.querySelector('#tbl tbody');
  tb.innerHTML = v.map((r,i)=>{
    const eks = (r.eksik || []).map(x => x === 'top5Gün≤%40' ? 'top5' : x);
    const pill = (r.hom?'<span class="pill hom">homojen</span>':(eks.length?'<span class="pill">'+esc(eks.join(','))+'</span>':''))
      + (r.kurt?' <span class="pill kurt">kurtarılan</span>':'')
      + (r.hdr?' <span class="pill hdrx">başlık</span>':'');
    return '<tr data-i="'+R.indexOf(r)+'">'
      +'<td class="l">'+esc(r.ad)+' <span class="sub">'+esc(r.id)+'</span></td>'
      +'<td>'+esc(r.tf)+'</td>'
      +'<td class="l">'+esc(r.kind)+(r.hom||r.kurt||r.hdr?' '+pill:'')+'</td>'
      +'<td class="l">'+katCell(r)+'</td>'
      +'<td>'+r.n.toLocaleString('tr-TR')+'</td>'
      +'<td class="'+cls(r.net)+'">'+sgn(r.net)+'</td>'
      +'<td>'+pct(r.pozAy,0)+'</td>'
      +'<td>'+pct(r.top1Ay,0)+'</td>'
      +'<td>'+pct(r.top5Gun,0)+'</td>'
      +'<td class="'+cls(r.top10Add)+'">'+sgn(r.top10Add,0)+'</td>'
      +'<td>'+pct(r.btcTop5,0)+'</td>'
      +'<td>'+(r.r2==null?'—':r.r2.toFixed(2))+'</td>'
      +'<td>'+pct(r.pozGun,0)+'</td>'
      +'<td>'+pct(r.dd)+'</td>'
      +'<td class="'+cls(r.y23)+'">'+sgn(r.y23,0)+'</td>'
      +'<td class="'+cls(r.y24)+'">'+sgn(r.y24,0)+'</td>'
      +'<td class="'+cls(r.y25)+'">'+sgn(r.y25,0)+'</td>'
      +'<td>'+r.score.toFixed(2)+'</td>'
      +'</tr>';
  }).join('');
}
function showDetail(r){
  const el=document.getElementById('detail');
  const map=new Map(r.aylik);
  const years=[...new Set(r.aylik.map(x=>x[0].slice(0,4)))].sort();
  let h='<b>'+esc(r.ad)+'</b> · '+esc(r.tf)+' · '+esc(r.kind)+' · işlem '+r.n.toLocaleString('tr-TR')+' · net '+sgn(r.net)+' · R² '+(r.r2==null?'—':r.r2.toFixed(3))+' · maks DD '+pct(r.dd)+' · formül: '+(r.keys&&r.keys.length?r.keys.join(' & '):'filtresiz');
  h+='<div class="sub" style="margin-top:6px">Ölçüt 4: top5 '+pct(r.top5Gun,0)+' (≤%40: '+(r.top5Gun!=null&&r.top5Gun<=0.4?'geçti':'kaldı')+') · alt-10 artımlı '+sgn(r.top10Add,0)+' ('+(r.c4alt10===1?'geçti':'kaldı')+') · alt-10 bileşik '+sgn(r.top10Net,0)+' ('+(r.c4alt10c===1?'geçti':'kaldı')+') · BTC top5 '+pct(r.btcTop5,0)+' (göreli: '+(r.c4btc===1?'geçti':'kaldı')+') · BTC β '+(r.btcBeta==null?'—':r.btcBeta.toFixed(2))+' · BTC-beta arındırılmış top5 '+pct(r.exTop5,0)+'</div>';
  h+='<div style="overflow:auto"><table class="mtable"><tr><th>Yıl</th>'+Array.from({length:12},(_,i)=>'<th>'+(i+1)+'</th>').join('')+'</tr>';
  for(const y of years){
    h+='<tr><td>'+y+'</td>';
    for(let m=1;m<=12;m++){
      const k=y+'-'+String(m).padStart(2,'0'); const v=map.get(k);
      if(v==null){ h+='<td class="z">·</td>'; continue; }
      const a=Math.min(1,Math.abs(v)/0.1);
      const bg=v>0? 'rgba(46,204,143,'+(0.15+0.65*a)+')' : 'rgba(255,93,108,'+(0.15+0.65*a)+')';
      h+='<td style="background:'+bg+';border-radius:3px" class="'+(v>=0?'pos':'neg')+'">'+sgn(v,1)+'</td>';
    }
    h+='</tr>';
  }
  h+='</table></div><div class="sub" style="margin-top:8px">İlk ay (2022-08) ve son ay (2026-09) kısmi dönemdir.</div>';
  el.innerHTML=h; el.style.display='block';
}
document.querySelector('#tbl thead').addEventListener('click',(e)=>{ const k=e.target.getAttribute('data-k'); if(!k) return; if(sortK===k) sortD*=-1; else { sortK=k; sortD=(k==='ad'||k==='kind'||k==='tf')?1:-1; } render(); });
document.querySelector('#tbl tbody').addEventListener('click',(e)=>{ const tr=e.target.closest('tr'); if(!tr) return; showDetail(R[+tr.getAttribute('data-i')]); });
['q','tfSel','kindSel','katSel','onlyHom','onlyKurt'].forEach(id=>document.getElementById(id).addEventListener('input',render));
document.getElementById('onlyHom').addEventListener('change',render);
document.getElementById('onlyKurt').addEventListener('change',render);
render();
</script>
</body>
</html>`;

await writeFile(join(BP, 'HOMOJENLIK.html'), html);
console.log(`[homogen-html] yazıldı: HOMOJENLIK.html (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
