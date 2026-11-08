
(function(){
  var D = JSON.parse(document.getElementById('HDATA').textContent);
  var rows = D.rows, S = D.summary;
  var pos = rows.filter(function(r){ return r.net > 0; });
  var $ = function(s){ return document.querySelector(s); };
  var fP = function(v,d){ d = d==null?0:d; return v==null?'—':(v*100).toFixed(d)+'%'; };
  var fS = function(v,d){ d = d==null?0:d; return v==null?'—':(v>=0?'+':'')+(v*100).toFixed(d)+'%'; };
  var fN = function(v){ return v==null?'—':Number(v).toLocaleString('tr-TR'); };
  var yearsOk = function(r){ return r.y23!=null && r.y24!=null && r.y25!=null && r.y23>0 && r.y24>0 && r.y25>0; };
  var otherOk = function(r){ return r.net>0 && r.pozAy>=0.6 && r.top1Ay!=null && r.top1Ay<=0.33 && (r.r2||0)>=0.8 && yearsOk(r); };
  var esc = function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); };

  function card(cls, val, lab, sub){
    var c = document.createElement('div'); c.className = 'kpi ' + cls;
    c.innerHTML = '<div class="v">' + val + '</div><div class="l">' + lab + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '');
    return c;
  }
  (function(){
    var h = $('#homStats');
    h.appendChild(card('acc', fN(S.total), 'İncelenen durum', '593 hücre × temel + 3 varyant'));
    h.appendChild(card('pos', fN(S.pos), 'Net pozitif durum', 'portföy eğrisi neti > 0'));
    h.appendChild(card('warn', S.hom + ' / 6', 'Homojen (tüm ölçütler)', 'altı ölçütü birlikte geçen'));
    h.appendChild(card('acc', fN(S.oneMiss), 'Tek ölçüt eksik', 'tamamı yalnızca top5 gün ölçütünde'));
  })();

  // ---- dağılım çubukları
  (function(){
    var host = $('#distBars');
    var buckets = [['≤ %100', function(v){return v<=1;}],['%100–150', function(v){return v>1&&v<=1.5;}],['%150–200', function(v){return v>1.5&&v<=2;}],['%200–300', function(v){return v>2&&v<=3;}],['%300–500', function(v){return v>3&&v<=5;}],['> %500', function(v){return v>5;}]];
    var vals = pos.map(function(r){return r.top5Gun;}).filter(function(v){return v!=null;});
    var max = 1; buckets.forEach(function(b){ var k = vals.filter(b[1]).length; if(k>max) max=k; });
    buckets.forEach(function(b){
      var k = vals.filter(b[1]).length;
      var d = document.createElement('div'); d.className='bar';
      d.innerHTML = '<span class="dim">' + b[0] + '</span><div class="tr"><div class="fl' + (b[0].indexOf('≤')===0?' warn':'') + '" style="width:' + (100*k/max) + '%"></div></div><span class="num">' + fN(k) + '</span>';
      host.appendChild(d);
    });
  })();

  // ---- saçılım
  (function(){
    var cv = $('#scatter'), ctx = cv.getContext('2d');
    var W = 1000, Hh = 440, ml = 62, mr = 18, mt = 18, mb = 48;
    var DPR = window.devicePixelRatio || 1;
    cv.width = W*DPR; cv.height = Hh*DPR; cv.style.height = Hh + 'px';
    ctx.scale(DPR, DPR);
    ctx.fillStyle = '#101522'; ctx.fillRect(0,0,W,Hh);
    var X = function(v){ return ml + Math.max(0,Math.min(1,v))*(W-ml-mr); };
    var Y = function(v){ return mt + (1-Math.max(0,Math.min(5,v))/5)*(Hh-mt-mb); };
    // grid
    ctx.strokeStyle = '#1e2739'; ctx.lineWidth = 1; ctx.font = '11px system-ui'; ctx.fillStyle = '#93a0b8';
    for (var i=0;i<=5;i++){ var x=X(i/5); ctx.beginPath(); ctx.moveTo(x,mt); ctx.lineTo(x,Hh-mb); ctx.stroke(); ctx.fillText((i/5).toFixed(1), x-10, Hh-mb+16); }
    for (var j=0;j<=5;j++){ var y=Y(j); ctx.beginPath(); ctx.moveTo(ml,y); ctx.lineTo(W-mr,y); ctx.stroke(); ctx.fillText('%'+(j*100), 16, y+4); }
    ctx.fillText('R²', (W+ml)/2-6, Hh-10);
    ctx.save(); ctx.translate(14,(Hh)/2+40); ctx.rotate(-Math.PI/2); ctx.fillText('en iyi %5 günün kâr payı',0,0); ctx.restore();
    // threshold lines
    ctx.setLineDash([6,5]); ctx.strokeStyle = '#ef5b5b'; ctx.lineWidth = 1.4;
    var xT = X(0.8); ctx.beginPath(); ctx.moveTo(xT,mt); ctx.lineTo(xT,Hh-mb); ctx.stroke();
    var yT = Y(0.4); ctx.beginPath(); ctx.moveTo(ml,yT); ctx.lineTo(W-mr,yT); ctx.stroke();
    ctx.setLineDash([]);
    // points
    var pts = [];
    for (var k=0;k<rows.length;k++){ var r=rows[k]; if(r.net<=0 || r.r2==null || r.top5Gun==null) continue; pts.push(r); }
    // gray first
    for (var a=0;a<pts.length;a++){ var r1=pts[a]; if(otherOk(r1)) continue; ctx.fillStyle='rgba(120,132,158,.45)'; ctx.beginPath(); ctx.arc(X(r1.r2), Y(r1.top5Gun), 1.7, 0, 6.283); ctx.fill(); }
    for (var b=0;b<pts.length;b++){ var r2=pts[b]; if(!otherOk(r2)) continue; ctx.fillStyle='rgba(63,191,127,.95)'; ctx.beginPath(); ctx.arc(X(r2.r2), Y(r2.top5Gun), 2.6, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = '#93a0b8'; ctx.font = '11px system-ui';
    ctx.fillText('kesikli: R²=0,80 · top5=%40', W-250, mt+16);
  })();

  // ---- dayanıklılık kartları
  (function(){
    var h = $('#robust');
    var mk = function(val, label, sub){ return card(val>0?'pos':'warn', fN(val) + ' durum', label, sub); };
    h.appendChild(mk(S.r5, 'En iyi 5 gün çıkarılınca kârlı', 'diğer 5 ölçüt aynı'));
    h.appendChild(mk(S.r10, 'En iyi 10 gün çıkarılınca kârlı', 'diğer 5 ölçüt aynı'));
    h.appendChild(mk(S.r20, 'En iyi 20 gün çıkarılınca kârlı', 'diğer 5 ölçüt aynı'));
  })();

  // ---- yakın adaylar tablosu
  var near = pos.filter(function(r){ return r.eksik.length===1 && r.eksik[0].indexOf('top5')===0; });
  var sortK = 'top5Gun', dir = 1, q = '';
  function val(r,k){
    if(k==='name') return (r.ad||'') + ' ' + r.id + ' ' + r.tf;
    return r[k];
  }
  function renderNear(){
    var arr = near.filter(function(r){ if(!q) return true; var s=((r.ad||'')+' '+r.id+' '+r.tf+' '+r.kind).toLowerCase(); return s.indexOf(q)>=0; });
    arr.sort(function(a,b){ var va=val(a,sortK), vb=val(b,sortK); if(va==null) va=1e9; if(vb==null) vb=1e9; if(typeof va==='string') return va.localeCompare(vb)*dir; return (va-vb)*dir; });
    var th = [['name','Strateji'],['tf','TF'],['kind','Varyant'],['n','İşlem'],['net','Net kâr'],['pozAy','Poz ay'],['top1Ay','Top1 ay'],['top5Gun','Top5 gün'],['r2','R²'],['dd','Maks DD'],['rem5','−5g'],['rem10','−10g'],['rem20','−20g']];
    var head = '<thead><tr><th>#</th>' + th.map(function(x){ var mark = (sortK===x[0]) ? (dir>0?' ▲':' ▼') : ''; return '<th data-k="' + x[0] + '" style="cursor:pointer">' + x[1] + mark + '</th>'; }).join('') + '</tr></thead>';
    var body = arr.map(function(r,i){
      return '<tr data-i="' + near.indexOf(r) + '"><td class="dim">' + (i+1) + '</td><td>' + esc(r.ad) + ' <span class="dim">' + r.id + '</span></td><td>' + r.tf + '</td><td>' + r.kind + '</td>' +
        '<td class="num">' + fN(r.n) + '</td><td class="num pos">' + fS(r.net) + '</td><td class="num">' + fP(r.pozAy) + '</td><td class="num">' + fP(r.top1Ay) + '</td>' +
        '<td class="num"><b>' + fP(r.top5Gun) + '</b></td><td class="num">' + (r.r2==null?'—':r.r2.toFixed(2)) + '</td><td class="num neg">' + fP(r.dd) + '</td>' +
        '<td class="num">' + (r.rem5?'✓':'—') + '</td><td class="num">' + (r.rem10?'✓':'—') + '</td><td class="num">' + (r.rem20?'✓':'—') + '</td></tr>';
    }).join('');
    var t = $('#nearTbl'); t.innerHTML = head + '<tbody>' + body + '</tbody>';
    t.querySelectorAll('th[data-k]').forEach(function(h){ h.addEventListener('click', function(){ var k=h.dataset.k; if(sortK===k) dir*=-1; else { sortK=k; dir=1; } renderNear(); }); });
    t.querySelectorAll('tbody tr').forEach(function(tr){ tr.addEventListener('click', function(){ showDetail(near[+tr.dataset.i]); }); });
  }
  $('#nearQ').addEventListener('input', function(e){ q = e.target.value.trim().toLowerCase(); renderNear(); });
  renderNear();

  function heatColor(v){
    if(v==null) return '#161b27';
    var t = Math.max(-1, Math.min(1, v/0.12));
    if(t>=0){ var g=Math.round(40+110*t), rr=Math.round(20+20*t), b=Math.round(45+40*t); return 'rgb('+rr+','+g+','+b+')'; }
    var u=-t; return 'rgb('+Math.round(60+140*u)+','+Math.round(25+15*u)+','+Math.round(30+20*u)+')';
  }
  function showDetail(r){
    var m = {}; (r.aylik||[]).forEach(function(x){ m[x[0]] = x[1]; });
    var years = {}; Object.keys(m).forEach(function(k){ years[k.slice(0,4)] = 1; });
    var ys = Object.keys(years).sort();
    var h = '<div class="card"><h3 style="margin-top:0">' + esc(r.ad) + ' <span class="dim" style="font-size:12px">(' + r.id + ' · ' + r.tf + ' · ' + r.kind + ')</span></h3>';
    h += '<div class="kv" style="max-width:720px">' +
      '<span class="k">Net kâr</span><span class="' + (r.net>=0?'pos':'neg') + '"><b>' + fS(r.net) + '</b></span>' +
      '<span class="k">Pozitif ay</span><span>' + fP(r.pozAy) + '</span>' +
      '<span class="k">En büyük ay payı</span><span>' + fP(r.top1Ay) + '</span>' +
      '<span class="k">En iyi %5 gün payı</span><span><b>' + fP(r.top5Gun) + '</b></span>' +
      '<span class="k">R²</span><span>' + (r.r2==null?'—':r.r2.toFixed(2)) + '</span>' +
      '<span class="k">Maks DD</span><span class="neg">' + fP(r.dd) + '</span>' +
      '<span class="k">Yıllar</span><span>2023 ' + fS(r.y23) + ' · 2024 ' + fS(r.y24) + ' · 2025 ' + fS(r.y25) + '</span>' +
      '</div>';
    h += '<h3>Aylık getiri ısısı</h3><div style="overflow:auto"><table class="tbl hm"><thead><tr><th>Yıl</th>';
    for (var mo=1; mo<=12; mo++) h += '<th>' + mo + '</th>';
    h += '<th>Yıl</th></tr></thead><tbody>';
    ys.forEach(function(y){
      h += '<tr><td class="dim">' + y + '</td>';
      var prod = 1, any = false;
      for (var mo2=1; mo2<=12; mo2++){
        var key = y + '-' + (mo2<10?'0':'') + mo2;
        var v = m[key];
        if (v==null){ h += '<td class="dim">—</td>'; continue; }
        any = true; prod *= (1+v);
        h += '<td style="background:' + heatColor(v) + '" title="' + key + '">' + (v>=0?'+':'') + (v*100).toFixed(1) + '%</td>';
      }
      h += '<td class="' + (prod-1>=0?'pos':'neg') + '">' + (any ? ((prod-1>=0?'+':'') + ((prod-1)*100).toFixed(1) + '%') : '—') + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
    $('#heatDetail').innerHTML = h;
    $('#heatDetail').scrollIntoView({behavior:'smooth', block:'nearest'});
  }
})();
