/* نقشهٔ زمین مسجدسلیمان — لایه‌های KML، زوم میدان، خط‌کش م/یارد، برنامهٔ شات */
(function(){
  const STORE = 'ga_earth_places';
  const PLAN_KEY = 'ga_course_plans';
  const CLUBS = ['Driver','3 Wood','5 Wood','Hybrid','Iron 3','Iron 4','Iron 5','Iron 6','Iron 7','Iron 8','Iron 9','Pitching Wedge','Gap Wedge','Sand Wedge','Lob Wedge','Putter'];
  const CLUB_COLORS = ['#D4AF37','#E67E22','#1EBB8A','#9B59B6','#2E86DE','#E74C3C','#1abc9c','#f39c12','#16a085','#c0392b'];
  const YD = 0.9144;

  let map = null, measurePts = [], measureLine = null, measureMarks = [], mode = 'pan';
  let unit = 'yd', holeSel = 'all', showTee = true, showGreen = true, showFw = true, showDash = true;
  let courseLayers = [], clubDraw = null, clubLine = null, clubMarks = [];
  let optsRef = {};
  let bgLayer = null, bgMode = 'sat';
  let previewLine = null, previewMark = null;
  let wizStep = 'hole', wizDraft = { club:'', color:'#D4AF37', pts:[], note:'' }, wizEdit = -1;
  const STYLE_KEY = 'ga_earth_style';
  let sty = { line:'#7dcc7a', fw:'#3d9e6a', fwAlpha:0.22, tee:'#f0d989', teeFont:'#ffffff', hole:'#1e3d2f', holeFont:'#f0d989' };
  function loadStyle(){
    try { const s = JSON.parse(localStorage.getItem(STYLE_KEY) || '{}'); if (s && typeof s === 'object') Object.assign(sty, s); } catch(e){}
  }
  function saveStyle(){ try { localStorage.setItem(STYLE_KEY, JSON.stringify(sty)); } catch(e){} }
  loadStyle();

  function loadPins(){
    try { const a = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function savePins(a){ try { localStorage.setItem(STORE, JSON.stringify(a)); } catch (e) {} }
  function loadPlans(){
    try { const a = JSON.parse(localStorage.getItem(PLAN_KEY) || '{}'); return a && typeof a === 'object' ? a : {}; }
    catch (e) { return {}; }
  }
  function savePlans(a){ try { localStorage.setItem(PLAN_KEY, JSON.stringify(a)); } catch (e) {} }

  function hav(a, b){
    const R = 6371000;
    const p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
    const dlat = (b.lat - a.lat) * Math.PI / 180;
    const dlng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dlat/2)**2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlng/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function fa(v){
    if (window.Data && Data.fa) return Data.fa(v);
    return String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtDist(m){
    if (!isFinite(m) || m <= 0) return unit === 'yd' ? '0 yd' : '0 m';
    if (unit === 'yd') return Math.round(m / YD) + ' yd';
    if (m < 1000) return Math.round(m) + ' m';
    return (m/1000).toFixed(2) + ' km';
  }
  function bearingDeg(a, b){
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function holesData(){
    const g = window.MIS_GOLF;
    return (g && g.holes) ? g.holes : {};
  }
  function satInfo(){
    const g = window.MIS_GOLF;
    return (g && g.sat) ? g.sat : null;
  }
  function bgUrl(){
    const s = satInfo();
    if (!s) return '';
    return (bgMode === 'topo' && s.topo) ? s.topo : s.url;
  }
  function applyBg(){
    if (!map) return;
    const s = satInfo();
    if (bgLayer) { try { map.removeLayer(bgLayer); } catch(e){} bgLayer = null; }
    document.querySelectorAll('[data-earth-bg]').forEach(function(b){
      b.classList.toggle('on', b.getAttribute('data-earth-bg') === bgMode);
      b.classList.toggle('ghost', b.getAttribute('data-earth-bg') !== bgMode);
    });
    if (!s || !s.url){
      return;
    }
    if (!map.getPane('satpane')){
      map.createPane('satpane');
      map.getPane('satpane').style.zIndex = 350;
    }
    bgLayer = L.imageOverlay(bgUrl(), [[s.south, s.west],[s.north, s.east]], { opacity:1, interactive:false, pane:'satpane' });
    bgLayer.addTo(map);
  }
  function holeNums(){ return Object.keys(holesData()).map(Number).sort((a,b)=>a-b); }
  function activeHoles(){
    const all = holeNums();
    if (holeSel === 'all') return all;
    const n = +holeSel;
    return all.indexOf(n) >= 0 ? [n] : all;
  }
  function courseId(){ return (optsRef.courseId || 'mis'); }
  function playerId(){ return optsRef.pid != null ? +optsRef.pid : 0; }

  function pinIcon(color, label){
    return L.divIcon({
      className: 'earth-divicon',
      html: `<div class="earth-pin" style="--c:${color}"><span>${label || ''}</span></div>`,
      iconSize: [26, 34], iconAnchor: [13, 32], popupAnchor: [0, -28]
    });
  }
  function teeIcon(n, deg){
    deg = (deg == null) ? 0 : deg;
    return L.divIcon({
      className: 'earth-divicon',
      html: `<div class="cm-tee-box"><div class="cm-tee" style="color:${esc(sty.tee)};transform:rotate(${deg}deg)">▲</div><small style="color:${esc(sty.teeFont)}">T${n}</small></div>`,
      iconSize: [32, 36], iconAnchor: [16, 18]
    });
  }
  function holeIcon(n){
    return L.divIcon({
      className: 'earth-divicon',
      html: `<div class="cm-green" style="background:${esc(sty.hole)};border-color:${esc(sty.tee)};color:${esc(sty.holeFont)}">${n}</div>`,
      iconSize: [26, 26], iconAnchor: [13, 13]
    });
  }
  function dotIcon(color){
    return L.divIcon({
      className: 'earth-divicon',
      html: `<div class="earth-dot" style="background:${color||'#f0d989'}"></div>`,
      iconSize: [12, 12], iconAnchor: [6, 6]
    });
  }

  function totalM(pts){
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += hav(pts[i-1], pts[i]);
    return s;
  }
  function redrawMeasure(){
    if (!map) return;
    if (measureLine) { map.removeLayer(measureLine); measureLine = null; }
    measureMarks.forEach(m => map.removeLayer(m));
    measureMarks = [];
    if (measurePts.length){
      measureLine = L.polyline(measurePts.map(p => [p.lat, p.lng]), { color:'#f0d989', weight:3, dashArray:'6 6', interactive:false }).addTo(map);
      measurePts.forEach((p, i) => {
        measureMarks.push(L.marker([p.lat, p.lng], { icon: dotIcon(), interactive:false }).addTo(map));
        if (i > 0){
          const seg = hav(measurePts[i-1], p);
          const mid = { lat:(measurePts[i-1].lat+p.lat)/2, lng:(measurePts[i-1].lng+p.lng)/2 };
          measureMarks.push(L.marker([mid.lat, mid.lng], {
            icon: L.divIcon({ className:'earth-divicon', html:`<div class="earth-seg">${fmtDist(seg)}</div>`, iconSize:[96,20], iconAnchor:[48,10] }),
            interactive:false
          }).addTo(map));
        }
      });
    }
    const el = document.getElementById('earth-dist');
    if (el) el.textContent = measurePts.length < 2 ? (mode==='measure' ? 'click map' : '') : fmtDist(totalM(measurePts));
  }
  function clearMeasure(){ measurePts = []; clearPreview(); redrawMeasure(); }
  function clearPreview(){
    if (previewLine) { try { map.removeLayer(previewLine); } catch(e){} previewLine = null; }
    if (previewMark) { try { map.removeLayer(previewMark); } catch(e){} previewMark = null; }
  }
  function showPreview(from, to, color){
    if (!map || !from || !to) return;
    clearPreview();
    previewLine = L.polyline([[from.lat, from.lng],[to.lat, to.lng]], { color: color || '#f0d989', weight:3, dashArray:'5 6', interactive:false }).addTo(map);
    const mid = { lat:(from.lat+to.lat)/2, lng:(from.lng+to.lng)/2 };
    previewMark = L.marker([mid.lat, mid.lng], {
      icon: L.divIcon({ className:'earth-divicon', html:`<div class="earth-seg">${fmtDist(hav(from,to))}</div>`, iconSize:[90,20], iconAnchor:[45,10] }),
      interactive:false
    }).addTo(map);
  }

  function clearCourseLayers(){
    courseLayers.forEach(l => { try { map.removeLayer(l); } catch(e){} });
    courseLayers = [];
  }
  function addLayer(l){ courseLayers.push(l); return l; }

  function drawCourse(){
    if (!map) return;
    clearCourseLayers();
    const H = holesData();
    const nums = activeHoles();
    const group = [];
    nums.forEach(function(n){
      const h = H[String(n)]; if (!h) return;
      if (showFw && h.fairways){
        h.fairways.forEach(function(fw){
          const poly = L.polygon(fw.latlngs, { color: sty.fw, weight:1.6, fillColor: sty.fw, fillOpacity: +sty.fwAlpha || 0, interactive:false });
          poly.addTo(map); addLayer(poly); group.push(poly);
        });
      }
      if (h.tee && h.green && showDash){
        const ln = L.polyline([[h.tee.lat,h.tee.lng],[h.green.lat,h.green.lng]], { color: sty.line, weight:2, dashArray:'6 5', opacity:0.9, interactive:false });
        const d = hav(h.tee, h.green);
        ln.addTo(map); addLayer(ln); group.push(ln);
        const mid = { lat:(h.tee.lat+h.green.lat)/2, lng:(h.tee.lng+h.green.lng)/2 };
        const lab = L.marker([mid.lat, mid.lng], {
          icon: L.divIcon({ className:'earth-divicon', html:`<div class="earth-seg">${h.yards? (h.yards+' yd') : fmtDist(d)}</div>`, iconSize:[70,18], iconAnchor:[35,9] }),
          interactive:false
        });
        lab.addTo(map); addLayer(lab);
      }
      if (showTee && h.tee){
        const deg = (h.green) ? bearingDeg(h.tee, h.green) : 0;
        const m = L.marker([h.tee.lat, h.tee.lng], { icon: teeIcon(n, deg), interactive:false });
        m.addTo(map); addLayer(m); group.push(m);
      }
      if (showGreen && h.green){
        const m = L.marker([h.green.lat, h.green.lng], { icon: holeIcon(n), interactive:false });
        m.addTo(map); addLayer(m); group.push(m);
      }
    });
    drawSavedPlan();
    if (group.length){
      try { map.fitBounds(L.featureGroup(group).getBounds().pad(holeSel==='all'?0.18:0.35), { maxZoom: holeSel==='all'?17:19 }); } catch(e){}
    }
  }

  function planPath(){
    const all = loadPlans();
    const cid = courseId(), pid = String(playerId());
    if (!all[cid]) all[cid] = {};
    if (!all[cid][pid]) all[cid][pid] = {};
    return { all, cid, pid };
  }
  function holePlan(){
    const { all, cid, pid } = planPath();
    const key = String(holeSel === 'all' ? 0 : holeSel);
    return all[cid][pid][key] || [];
  }
  function setHolePlan(arr){
    const { all, cid, pid } = planPath();
    const key = String(holeSel === 'all' ? 0 : holeSel);
    all[cid][pid][key] = arr;
    savePlans(all);
  }
  function holePlanOf(n){
    const { all, cid, pid } = planPath();
    return all[cid][pid][String(n)] || [];
  }
  function setHolePlanOf(n, arr){
    const { all, cid, pid } = planPath();
    all[cid][pid][String(n)] = arr;
    savePlans(all);
  }
  function doneHoles(){
    return holeNums().filter(n => holePlanOf(n).length);
  }
  function drawSavedPlan(){
    if (holeSel === 'all') return;
    holePlan().forEach(function(sh){
      if (!sh.pts || sh.pts.length < 2) return;
      if (wizEdit>=0 && wizStep!=='ready' && holePlan().indexOf(sh)===wizEdit) return;
      const ln = L.polyline(sh.pts.map(p => [p.lat,p.lng]), { color: sh.color || '#D4AF37', weight:4, interactive:false });
      ln.bindPopup(esc(sh.club||'کلاب')+' • '+fmtDist(totalM(sh.pts)));
      ln.addTo(map); addLayer(ln);
    });
    renderPlanList();
  }
  function renderPlanList(){
    const box = document.getElementById('earth-plan-list');
    if (!box) return;
    if (holeSel === 'all'){ box.innerHTML = '<span class="earth-pins-empty">یک میدان انتخاب کنید تا برنامهٔ شات همان میدان را بکشید.</span>'; return; }
    const arr = holePlan();
    if (!arr.length){ box.innerHTML = '<span class="earth-pins-empty">کلاب را انتخاب کنید، «کشیدن» را بزنید و روی نقشه از تی به سمت حفره خط بکشید.</span>'; return; }
    box.innerHTML = arr.map((sh,i) =>
      `<span class="earth-pin-chip" style="border-color:${esc(sh.color)}"><span style="color:${esc(sh.color)}">●</span> ${esc(sh.club)} — ${fmtDist(totalM(sh.pts||[]))} <span class="earth-pin-x" data-plan-del="${i}">✕</span></span>`
    ).join('');
    box.querySelectorAll('[data-plan-del]').forEach(function(x){
      x.addEventListener('click', function(e){
        e.stopPropagation();
        const arr2 = holePlan();
        arr2.splice(+x.getAttribute('data-plan-del'), 1);
        setHolePlan(arr2);
        drawCourse();
      });
    });
  }

  function redrawClubDraw(){
    if (clubLine) { try { map.removeLayer(clubLine); } catch(e){} clubLine = null; }
    clubMarks.forEach(m => { try { map.removeLayer(m); } catch(e){} });
    clubMarks = [];
    if (!clubDraw || !clubDraw.pts.length) return;
    clubLine = L.polyline(clubDraw.pts.map(p => [p.lat,p.lng]), { color: clubDraw.color, weight:4, interactive:false }).addTo(map);
    clubDraw.pts.forEach(p => clubMarks.push(L.marker([p.lat,p.lng], { icon: dotIcon(clubDraw.color), interactive:false }).addTo(map)));
    if (clubDraw.pts.length >= 2){
      const mid = clubDraw.pts[clubDraw.pts.length-1];
      clubMarks.push(L.marker([mid.lat, mid.lng], {
        icon: L.divIcon({ className:'earth-divicon', html:`<div class="earth-seg">${esc(clubDraw.club)} • ${fmtDist(totalM(clubDraw.pts))}</div>`, iconSize:[140,20], iconAnchor:[70,10] }),
        interactive:false
      }).addTo(map));
    }
  }

  function earthUrl(lat, lng){
    return 'https://earth.google.com/web/@' + lat + ',' + lng + ',450a,1200d,35y,0h,0t,0r';
  }

  function destroy(){
    if (map) { try { map.remove(); } catch (e) {} map = null; }
    measurePts = []; measureLine = null; measureMarks = []; mode = 'pan';
    courseLayers = []; clubDraw = null; clubLine = null; clubMarks = [];
    bgLayer = null; previewLine = null; previewMark = null;
    wizStep = 'hole'; wizEdit = -1; wizDraft = { club:'', color:'#D4AF37', pts:[], note:'' };
  }

  function exportPoster(){
    const sat = satInfo();
    const img = new Image();
    let once = false;
    const go = function(ok){ if (once) return; once = true; drawPoster(ok ? img : null); };
    const url = bgUrl();
    if (sat && url){
      img.onload = function(){ go(true); };
      img.onerror = function(){ go(false); };
      img.src = url;
      if (img.complete && img.width) go(true);
    } else go(false);
  }
  function drawPoster(satImg, asData){
    const H = holesData();
    const nums = activeHoles();
    const sat = satInfo();
    const W = 1600, Ht = 1000;
    const cvs = document.createElement('canvas');
    cvs.width = W; cvs.height = Ht;
    const c = cvs.getContext('2d');
    c.fillStyle = '#f4efe4'; c.fillRect(0,0,W,Ht);
    c.fillStyle = '#1e3d2f'; c.font = '800 36px Tahoma'; c.textAlign = 'left';
    c.fillText('MIS GOLF CLUB', 40, 50);
    c.fillStyle = '#6b5e4a'; c.font = '16px Tahoma';
    c.fillText('مسجدسلیمان  |  Course Map', 40, 76);
    const mapX = 36, mapY = 100, mapW = 1080, mapH = 840;
    c.fillStyle = '#cbbca6'; c.fillRect(mapX, mapY, mapW, mapH);
    let minLat=90, maxLat=-90, minLng=180, maxLng=-180;
    nums.forEach(n => {
      const h = H[String(n)]; if (!h) return;
      [h.tee, h.green].forEach(p => { if (!p) return; minLat=Math.min(minLat,p.lat); maxLat=Math.max(maxLat,p.lat); minLng=Math.min(minLng,p.lng); maxLng=Math.max(maxLng,p.lng); });
      (h.fairways||[]).forEach(fw => fw.latlngs.forEach(ll => { minLat=Math.min(minLat,ll[0]); maxLat=Math.max(maxLat,ll[0]); minLng=Math.min(minLng,ll[1]); maxLng=Math.max(maxLng,ll[1]); }));
    });
    const pad = 0.00035;
    minLat-=pad; maxLat+=pad; minLng-=pad; maxLng+=pad;
    function xy(lat, lng){
      const x = mapX + (lng - minLng) / (maxLng - minLng) * mapW;
      const y = mapY + (maxLat - lat) / (maxLat - minLat) * mapH;
      return [x,y];
    }
    if (satImg && sat){
      try {
        const sx = (minLng - sat.west) / (sat.east - sat.west) * satImg.width;
        const sy = (sat.north - maxLat) / (sat.north - sat.south) * satImg.height;
        const sw = (maxLng - minLng) / (sat.east - sat.west) * satImg.width;
        const sh = (maxLat - minLat) / (sat.north - sat.south) * satImg.height;
        c.drawImage(satImg, sx, sy, sw, sh, mapX, mapY, mapW, mapH);
      } catch (e) {}
    }
    nums.forEach(n => {
      const h = H[String(n)]; if (!h) return;
      if (showFw) (h.fairways||[]).forEach(fw => {
        c.beginPath();
        fw.latlngs.forEach((ll,i) => { const p=xy(ll[0],ll[1]); i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]); });
        c.closePath(); c.fillStyle=sty.fw; c.globalAlpha=+sty.fwAlpha||0; c.fill(); c.globalAlpha=1; c.strokeStyle=sty.fw; c.lineWidth=1.2; c.stroke();
      });
      if (h.tee && h.green){
        const a=xy(h.tee.lat,h.tee.lng), b=xy(h.green.lat,h.green.lng);
        c.setLineDash([6,5]); c.strokeStyle=sty.line; c.lineWidth=2; c.beginPath(); c.moveTo(a[0],a[1]); c.lineTo(b[0],b[1]); c.stroke(); c.setLineDash([]);
        c.fillStyle='#2e7d32'; c.font='12px Tahoma'; c.textAlign='center';
        c.fillText((h.yards||'')+' yd', (a[0]+b[0])/2, (a[1]+b[1])/2 - 6);
      }
      if (showTee && h.tee){
        const p=xy(h.tee.lat,h.tee.lng);
        c.fillStyle=sty.tee; c.beginPath(); c.moveTo(p[0],p[1]-8); c.lineTo(p[0]+7,p[1]+6); c.lineTo(p[0]-7,p[1]+6); c.closePath(); c.fill();
        c.fillStyle=sty.teeFont; c.font='11px Tahoma'; c.fillText('T'+n, p[0], p[1]+20);
      }
      if (showGreen && h.green){
        const p=xy(h.green.lat,h.green.lng);
        c.fillStyle=sty.hole; c.beginPath(); c.arc(p[0],p[1],10,0,Math.PI*2); c.fill();
        c.fillStyle=sty.holeFont; c.font='800 11px Tahoma'; c.textAlign='center'; c.fillText(String(n), p[0], p[1]+4);
      }
    });
    if (holeSel !== 'all'){
      holePlan().forEach(sh => {
        if (!sh.pts || sh.pts.length<2) return;
        c.strokeStyle = sh.color || '#D4AF37'; c.lineWidth=3; c.beginPath();
        sh.pts.forEach((pt,i)=>{ const p=xy(pt.lat,pt.lng); i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]); });
        c.stroke();
      });
    }
    const dirX = 1140;
    c.fillStyle='#c45c26'; c.font='800 18px Tahoma'; c.textAlign='left';
    c.fillText(nums.length===1 ? ('HOLE '+nums[0]) : '18 HOLES  •  PAR 71', dirX, 50);
    c.fillStyle='#1e3d2f'; c.font='800 14px Tahoma'; c.fillText('HOLE DIRECTORY', dirX, 120);
    c.font='13px Tahoma';
    let yy=150;
    nums.forEach(n => {
      const h = H[String(n)]; if (!h) return;
      c.fillStyle='#1e3d2f';
      c.fillText(String(n).padStart(2,'0')+'    '+(h.yards||'—')+' yd    Par '+(h.par||'—'), dirX, yy);
      yy += 28;
    });
    if (asData) return cvs.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = cvs.toDataURL('image/png');
    a.download = nums.length===1 ? ('mis-hole-'+nums[0]+'.png') : 'mis-golf-course.png';
    a.click();
  }

  function bindUi(){
    const hole = document.getElementById('earth-hole');
    if (hole){
      hole.innerHTML = '<option value="all">همهٔ میدان‌ها</option>' + holeNums().map(n => `<option value="${n}">میدان ${n}${holesData()[n]&&holesData()[n].par?(' • پار '+holesData()[n].par):''}${holesData()[n]&&holesData()[n].yards?(' • '+holesData()[n].yards+' yd'):''}</option>`).join('');
      hole.value = holeSel;
      hole.onchange = function(){ holeSel = hole.value; clubDraw=null; mode='pan'; drawCourse(); syncModeBtns(); };
    }
    const club = document.getElementById('earth-club');
    if (club && !club.options.length){
      CLUBS.forEach(nm => { const o=document.createElement('option'); o.value=nm; o.textContent=nm; club.appendChild(o); });
    }
    const layers = [
      ['earth-ly-tee', () => showTee, v => { showTee=v; }],
      ['earth-ly-green', () => showGreen, v => { showGreen=v; }],
      ['earth-ly-fw', () => showFw, v => { showFw=v; }],
      ['earth-ly-line', () => showDash, v => { showDash=v; }]
    ];
    layers.forEach(function(pair){
      const el = document.getElementById(pair[0]);
      if (!el) return;
      el.classList.toggle('on', pair[1]());
      el.onclick = function(){ pair[2](!pair[1]()); el.classList.toggle('on', pair[1]()); drawCourse(); };
    });
    const un = document.getElementById('earth-unit');
    if (un){
      un.textContent = unit;
      un.onclick = function(){ unit = (unit==='yd') ? 'm' : 'yd'; un.textContent = unit; redrawMeasure(); drawCourse(); };
    }
    const zi = document.getElementById('em-zoom-in');
    const zo = document.getElementById('em-zoom-out');
    if (zi) zi.onclick = function(e){ e.preventDefault(); e.stopPropagation(); if (map) map.zoomIn(); };
    if (zo) zo.onclick = function(e){ e.preventDefault(); e.stopPropagation(); if (map) map.zoomOut(); };
    const ab = document.getElementById('earth-alpha-btn');
    const ap = document.getElementById('earth-alpha-pop');
    if (ab && ap){
      ab.onclick = function(e){ e.stopPropagation(); ap.classList.toggle('open'); ab.classList.toggle('on', ap.classList.contains('open')); };
    }
    document.querySelectorAll('[data-earth-bg]').forEach(function(b){
      b.onclick = function(){ bgMode = b.getAttribute('data-earth-bg') || 'sat'; applyBg(); };
    });
    const cmap = [
      ['earth-c-line','line'],['earth-c-fw','fw'],['earth-c-tee','tee'],
      ['earth-c-tee-font','teeFont'],['earth-c-hole','hole'],['earth-c-hole-font','holeFont']
    ];
    cmap.forEach(function(pair){
      const el = document.getElementById(pair[0]);
      if (!el) return;
      el.value = sty[pair[1]] || el.value;
      el.oninput = function(){ sty[pair[1]] = el.value; saveStyle(); drawCourse(); };
    });
    const al = document.getElementById('earth-fw-alpha');
    if (al){
      al.value = String(Math.round((+sty.fwAlpha || 0) * 100));
      al.oninput = function(){ sty.fwAlpha = (+al.value || 0) / 100; saveStyle(); drawCourse(); };
    }
    const bM = document.getElementById('earth-btn-measure');
    const bX = document.getElementById('earth-btn-export');
    const bClub = document.getElementById('earth-btn-club');
    const bDone = document.getElementById('earth-btn-club-done');
    const bNext = document.getElementById('earth-btn-next');
    if (bM) bM.onclick = function(){
      if (wizStep==='draw' || wizStep==='note') return;
      const on = mode!=='measure';
      mode = on ? 'measure' : 'pan';
      if (!on) clearMeasure();
      syncModeBtns();
    };
    const distEl = document.getElementById('earth-dist');
    if (distEl) distEl.onclick = function(){ if (mode==='measure'){ clearMeasure(); } };
    if (bX) bX.onclick = function(){ exportPoster(); };
    if (bClub) bClub.onclick = function(){
      if (holeSel==='all'){ alert('اول یک میدان انتخاب کنید'); return; }
      const nm = (document.getElementById('earth-club')||{}).value || 'Driver';
      const arr = holePlan();
      const color = CLUB_COLORS[arr.length % CLUB_COLORS.length];
      const last = arr.length && arr[arr.length-1].pts && arr[arr.length-1].pts.length ? arr[arr.length-1].pts[arr[arr.length-1].pts.length-1] : null;
      const H = holesData()[String(holeSel)];
      const start = last || (H && H.tee ? { lat:H.tee.lat, lng:H.tee.lng } : null);
      clubDraw = { club: nm, color, pts: start ? [start] : [] };
      mode = 'club';
      redrawClubDraw();
      syncModeBtns();
    };
    if (bDone) bDone.onclick = function(){
      if (clubDraw && clubDraw.pts.length >= 2){
        const arr = holePlan();
        arr.push({ club: clubDraw.club, color: clubDraw.color, pts: clubDraw.pts.slice() });
        setHolePlan(arr);
      }
      clubDraw = null; mode = 'pan';
      drawCourse();
      syncModeBtns();
    };
    if (bNext) bNext.onclick = function(){
      const nums = holeNums();
      let i = nums.indexOf(+holeSel);
      if (i < 0) i = -1;
      const n = nums[Math.min(nums.length-1, i+1)];
      holeSel = String(n);
      const sel = document.getElementById('earth-hole');
      if (sel) sel.value = holeSel;
      clubDraw=null; mode='pan';
      drawCourse();
    };
  }

  function syncModeBtns(){
    const bM = document.getElementById('earth-btn-measure');
    const bClub = document.getElementById('earth-btn-club');
    if (bM) bM.classList.toggle('on', mode==='measure');
    if (bClub) bClub.classList.toggle('on', mode==='club');
    const el = document.getElementById('earth-map');
    if (el) el.style.cursor = (mode==='pan') ? '' : 'crosshair';
    const dist = document.getElementById('earth-dist');
    if (dist && mode!=='measure') dist.textContent = mode==='club' ? 'click to draw' : '';
    if (mode==='measure') redrawMeasure();
  }

  function mount(el, opts){
    destroy();
    if (!el) return;
    optsRef = opts || {};
    holeSel = 'all';
    wizStep = 'hole'; wizEdit = -1;
    const H = holesData();
    const h1 = H['1'] && H['1'].tee;
    const center = optsRef.center || (h1 ? { lat:h1.lat, lng:h1.lng } : { lat:31.90494, lng:49.31398 });

    if (typeof L === 'undefined'){
      el.innerHTML = `<div class="earth-fallback">نقشه بارگذاری نشد.</div>`;
      return;
    }

    map = L.map(el, { zoomControl:false, attributionControl:false, tap:true, minZoom:14, maxZoom:20 }).setView([center.lat, center.lng], 16);
    applyBg();
    if (!satInfo() || !satInfo().url){
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom:20, subdomains:'abcd'
      }).addTo(map);
    }

    bindUi();
    try { renderWiz(); } catch (e) {}
    try { drawCourse(); } catch (e) {}
    try { renderWiz(); } catch (e) {}

    map.on('click', function(ev){
      const ap = document.getElementById('earth-alpha-pop');
      const ab = document.getElementById('earth-alpha-btn');
      if (ap) ap.classList.remove('open');
      if (ab) ab.classList.remove('on');
      const lat = ev.latlng.lat, lng = ev.latlng.lng;
      if (mode === 'measure'){ measurePts.push({ lat, lng }); clearPreview(); redrawMeasure(); return; }
      if (mode === 'club' && clubDraw){ clubDraw.pts.push({ lat, lng }); clearPreview(); redrawClubDraw(); if (wizStep==='draw') renderWiz(); return; }
    });
    map.on('mousemove', function(ev){
      const to = { lat: ev.latlng.lat, lng: ev.latlng.lng };
      const hud = document.getElementById('earth-dist');
      if (mode === 'measure' && measurePts.length){
        showPreview(measurePts[measurePts.length-1], to, '#f0d989');
        if (hud) hud.textContent = fmtDist(totalM(measurePts.concat([to])));
        return;
      }
      if (mode === 'club' && clubDraw && clubDraw.pts.length){
        showPreview(clubDraw.pts[clubDraw.pts.length-1], to, clubDraw.color || '#D4AF37');
        if (hud) hud.textContent = fmtDist(totalM(clubDraw.pts.concat([to])));
      }
    });
    map.on('contextmenu', function(ev){
      try { L.DomEvent.preventDefault(ev); } catch(e){}
      if (mode === 'measure' && measurePts.length){ measurePts.pop(); clearPreview(); redrawMeasure(); return; }
      if (mode === 'club' && clubDraw && clubDraw.pts.length){ clubDraw.pts.pop(); clearPreview(); redrawClubDraw(); if (wizStep==='draw') renderWiz(); }
    });

    setTimeout(function(){ try { map.invalidateSize(); drawCourse(); renderWiz(); } catch(e){} }, 250);
    syncModeBtns();
  }

  const SHOT_COLORS = ['#D4AF37','#E67E22','#1EBB8A','#2E86DE','#9B59B6','#E74C3C','#1abc9c','#f1c40f'];

  function wizBack(step, label){
    return '<button type="button" class="ew-back" data-ew-back="'+step+'">← '+(label||'بازگشت')+'</button>';
  }
  function shotArticle(sh, i, hn){
    const holeAttr = hn != null ? ' data-ew-hn="'+hn+'"' : '';
    return '<article class="ew-shot" style="border-color:'+esc(sh.color||'#D4AF37')+'"><div class="ew-shot-h"><b>ضربه '+(i+1)+'</b><i class="ew-dot" style="background:'+esc(sh.color)+'"></i><span>'+esc(sh.club||'')+' · '+fmtDist(totalM(sh.pts||[]))+'</span><button type="button" class="ew-ico" data-ew-edit="'+i+'"'+holeAttr+' title="ویرایش">✎</button><button type="button" class="ew-ico del" data-ew-del="'+i+'"'+holeAttr+' title="حذف">✕</button></div>'+(sh.note?('<p>'+esc(sh.note)+'</p>'):'')+'</article>';
  }
  function doneAccordion(openN){
    const done = doneHoles();
    if (!done.length) return '';
    return '<div class="ew-done">'+done.map(function(n){
      const arr = holePlanOf(n);
      const tot = arr.reduce(function(s, sh){ return s + totalM(sh.pts||[]); }, 0);
      return '<details class="ew-acc"'+(String(openN)===String(n)?' open':'')+'><summary><b>میدان '+n+'</b><span>'+arr.length+' ضربه · '+fmtDist(tot)+'</span></summary>'
        + '<div class="ew-shots">'+arr.map(function(sh,i){ return shotArticle(sh,i,n); }).join('')+'</div>'
        + '<div class="ew-actions"><button type="button" class="btn sm ghost" data-ew-hole="'+n+'">ویرایش این میدان</button></div></details>';
    }).join('')+'</div>';
  }
  function renderWiz(){
    let box = document.getElementById('earth-wiz');
    if (!box){
      const pane = document.querySelector('.earth-pane') || (document.getElementById('earth-map') && document.getElementById('earth-map').parentElement && document.getElementById('earth-map').parentElement.parentElement);
      if (!pane) return;
      box = document.createElement('div');
      box.id = 'earth-wiz';
      box.className = 'earth-wiz';
      pane.appendChild(box);
    }
    const holes = holeNums();
    const done = doneHoles();
    let h = '';
    if (wizStep === 'hole'){
      h = '<div class="ew-st">میدان را انتخاب کنید</div><div class="ew-grid">'+holes.map(n => '<button type="button" class="ew-hbtn'+(done.indexOf(n)>=0?' done':'')+'" data-ew-hole="'+n+'">'+n+(done.indexOf(n)>=0?' ✓':'')+'</button>').join('')+'</div>'
        + doneAccordion()
        + (done.length ? '<div class="ew-actions"><button type="button" class="btn sm" id="ew-rep-all">گزارش کامل</button></div>' : '');
    } else if (wizStep === 'ready'){
      const arr = holePlan();
      h = wizBack('hole','تغییر میدان')+'<div class="ew-head"><b>میدان '+holeSel+'</b><span>'+arr.length+' ضربه</span></div>'
        + '<button type="button" class="btn" id="ew-add">＋ افزودن ضربه</button>'
        + '<div class="ew-shots">'+(arr.length ? arr.map(function(sh,i){ return shotArticle(sh,i); }).join('') : '<div class="ew-empty">هنوز ضربه‌ای ثبت نشده.</div>')+'</div>'
        + '<button type="button" class="btn" id="ew-lock">ثبت میدان</button>'
        + '<div class="ew-actions"><button type="button" class="btn sm ghost" id="ew-rep-one">گزارش این میدان</button><button type="button" class="btn sm" id="ew-rep-all">گزارش کامل</button></div>';
    } else if (wizStep === 'club'){
      h = wizBack('ready','انصراف')+'<div class="ew-st">کلاب ضربه '+(wizEdit>=0?(wizEdit+1):(holePlan().length+1))+'</div><div class="ew-grid">'+CLUBS.map(function(c){ return '<button type="button" class="ew-cbtn'+(c===wizDraft.club?' on':'')+'" data-ew-club="'+esc(c)+'">'+esc(c)+'</button>'; }).join('')+'</div>';
    } else if (wizStep === 'color'){
      h = wizBack('club','تغییر کلاب')+'<div class="ew-st">رنگ خط «'+esc(wizDraft.club)+'»</div><div class="ew-grid">'+SHOT_COLORS.map(function(c){ return '<button type="button" class="ew-col'+(c===wizDraft.color?' on':'')+'" data-ew-col="'+c+'" style="--c:'+c+'"></button>'; }).join('')+'</div>';
    } else if (wizStep === 'draw'){
      const n = (clubDraw && clubDraw.pts) ? clubDraw.pts.length : 0;
      h = wizBack('color','تغییر رنگ')+'<div class="ew-st">خط را روی نقشه بکشید</div><p class="ew-hint">کلیک اول شروع است. با حرکت موس متراژ زنده دیده می‌شود. کلیک بعدی نقطه را تثبیت می‌کند. حذف آخرین نقطه همیشه در دسترس است.</p><div class="ew-actions"><button type="button" class="btn sm ghost" id="ew-undo-pt">حذف آخرین نقطه</button><button type="button" class="btn sm ghost" id="ew-clear-pt">پاک کردن خط</button><button type="button" class="btn" id="ew-ok-line"'+(n<2?' disabled':'')+'>تأیید خط ('+n+' نقطه)</button></div>';
    } else if (wizStep === 'note'){
      h = wizBack('draw','اصلاح خط')+'<div class="ew-st">توضیح این ضربه <small>(اجباری)</small></div><textarea class="ew-note" id="ew-note" maxlength="400" placeholder="مثلاً: کمی سمت راست، باد مخالف…">'+esc(wizDraft.note||'')+'</textarea><div class="ew-actions"><button type="button" class="btn" id="ew-save-shot">ثبت ضربه</button></div>';
    }
    box.innerHTML = h;
    bindWiz();
  }
  function bindWiz(){
    const box = document.getElementById('earth-wiz');
    if (!box) return;
    box.querySelectorAll('[data-ew-back]').forEach(function(b){
      b.onclick = function(){
        const s = b.getAttribute('data-ew-back');
        if (s==='hole'){ holeSel='all'; clubDraw=null; mode='pan'; drawCourse(); }
        if (s==='ready'){ clubDraw=null; mode='pan'; clearPreview(); }
        if (s==='draw'){
          clubDraw = { club: wizDraft.club, color: wizDraft.color, pts: (wizDraft.pts||[]).slice() };
          mode='club'; redrawClubDraw();
        }
        wizStep = s; syncModeBtns(); renderWiz();
      };
    });
    box.querySelectorAll('[data-ew-hole]').forEach(function(b){
      b.onclick = function(){
        holeSel = b.getAttribute('data-ew-hole');
        wizStep = 'ready'; wizEdit = -1;
        clubDraw=null; mode='pan';
        drawCourse(); renderWiz();
      };
    });
    const add = document.getElementById('ew-add');
    if (add) add.onclick = function(){
      wizDraft={ club:'', color: SHOT_COLORS[holePlan().length % SHOT_COLORS.length], pts:[], note:'' };
      wizEdit=-1; wizStep='club'; renderWiz();
    };
    const lock = document.getElementById('ew-lock');
    if (lock) lock.onclick = function(){
      if (!holePlan().length){
        if (window.APP && APP.toast) APP.toast('اول حداقل یک ضربه ثبت کنید', 'orange');
        return;
      }
      holeSel = 'all'; clubDraw = null; mode = 'pan'; wizEdit = -1; wizStep = 'hole';
      drawCourse(); renderWiz();
    };
    box.querySelectorAll('[data-ew-club]').forEach(function(b){
      b.onclick = function(){ wizDraft.club = b.getAttribute('data-ew-club'); wizStep='color'; renderWiz(); };
    });
    box.querySelectorAll('[data-ew-col]').forEach(function(b){
      b.onclick = function(){
        wizDraft.color = b.getAttribute('data-ew-col');
        clubDraw = { club: wizDraft.club, color: wizDraft.color, pts: (wizDraft.pts&&wizDraft.pts.length)? wizDraft.pts.slice() : [] };
        mode = 'club'; redrawClubDraw(); syncModeBtns();
        wizStep='draw'; renderWiz();
      };
    });
    const un = document.getElementById('ew-undo-pt');
    if (un) un.onclick = function(){ if (clubDraw && clubDraw.pts.length){ clubDraw.pts.pop(); clearPreview(); redrawClubDraw(); renderWiz(); } };
    const cl = document.getElementById('ew-clear-pt');
    if (cl) cl.onclick = function(){ if (clubDraw){ clubDraw.pts=[]; clearPreview(); redrawClubDraw(); renderWiz(); } };
    const ok = document.getElementById('ew-ok-line');
    if (ok) ok.onclick = function(){
      if (!clubDraw || clubDraw.pts.length<2) return;
      wizDraft.pts = clubDraw.pts.slice();
      mode='pan'; clearPreview(); syncModeBtns();
      wizStep='note'; renderWiz();
    };
    const sv = document.getElementById('ew-save-shot');
    if (sv) sv.onclick = function(){
      const ta = document.getElementById('ew-note');
      const note = ta ? ta.value.trim() : '';
      if (!note){ if (ta){ ta.focus(); ta.style.borderColor='#E74C3C'; } return; }
      wizDraft.note = note;
      const arr = holePlan();
      const rec = { club: wizDraft.club, color: wizDraft.color, pts: wizDraft.pts.slice(), note: wizDraft.note };
      if (wizEdit>=0 && wizEdit<arr.length) arr[wizEdit]=rec; else arr.push(rec);
      setHolePlan(arr);
      clubDraw=null; mode='pan'; wizEdit=-1; wizStep='ready';
      drawCourse(); renderWiz();
    };
    box.querySelectorAll('[data-ew-del]').forEach(function(b){
      b.onclick = function(){
        const hn = b.getAttribute('data-ew-hn');
        if (hn){
          const arr = holePlanOf(hn); arr.splice(+b.getAttribute('data-ew-del'),1); setHolePlanOf(hn, arr);
        } else {
          const arr = holePlan(); arr.splice(+b.getAttribute('data-ew-del'),1); setHolePlan(arr);
        }
        drawCourse(); renderWiz();
      };
    });
    box.querySelectorAll('[data-ew-edit]').forEach(function(b){
      b.onclick = function(){
        const hn = b.getAttribute('data-ew-hn');
        if (hn){ holeSel = String(hn); }
        const i = +b.getAttribute('data-ew-edit'); const sh = holePlan()[i]; if (!sh) return;
        wizEdit=i; wizDraft={ club:sh.club||'', color:sh.color||'#D4AF37', pts:(sh.pts||[]).slice(), note:sh.note||'' };
        wizStep='club'; drawCourse(); renderWiz();
      };
    });
    const r1 = document.getElementById('ew-rep-one');
    const rA = document.getElementById('ew-rep-all');
    if (r1) r1.onclick = function(){ exportShotReport([+holeSel], r1); };
    if (rA) rA.onclick = function(){ exportShotReport(holeNums(), rA); };
  }

  function playerName(){
    const pid = playerId();
    try { if (window.Data && Data.nameOf && pid) return Data.nameOf(pid) || ''; } catch(e){}
    return '';
  }
  function drawHoleSnap(satImg, n){
    const H = holesData();
    const h = H[String(n)]; if (!h) return '';
    const sat = satInfo();
    const W = 980, Ht = 560;
    const cvs = document.createElement('canvas');
    cvs.width = W; cvs.height = Ht;
    const c = cvs.getContext('2d');
    c.fillStyle = '#1a140c'; c.fillRect(0,0,W,Ht);
    let minLat=90, maxLat=-90, minLng=180, maxLng=-180;
    [h.tee, h.green].forEach(function(p){ if (!p) return; minLat=Math.min(minLat,p.lat); maxLat=Math.max(maxLat,p.lat); minLng=Math.min(minLng,p.lng); maxLng=Math.max(maxLng,p.lng); });
    (h.fairways||[]).forEach(function(fw){ fw.latlngs.forEach(function(ll){ minLat=Math.min(minLat,ll[0]); maxLat=Math.max(maxLat,ll[0]); minLng=Math.min(minLng,ll[1]); maxLng=Math.max(maxLng,ll[1]); }); });
    const keep = holeSel; holeSel = String(n);
    holePlan().forEach(function(sh){ (sh.pts||[]).forEach(function(p){ minLat=Math.min(minLat,p.lat); maxLat=Math.max(maxLat,p.lat); minLng=Math.min(minLng,p.lng); maxLng=Math.max(maxLng,p.lng); }); });
    holeSel = keep;
    const pad = 0.00028;
    minLat-=pad; maxLat+=pad; minLng-=pad; maxLng+=pad;
    function xy(lat, lng){
      return [ (lng - minLng) / (maxLng - minLng) * W, (maxLat - lat) / (maxLat - minLat) * Ht ];
    }
    if (satImg && sat){
      try {
        const sx = (minLng - sat.west) / (sat.east - sat.west) * satImg.width;
        const sy = (sat.north - maxLat) / (sat.north - sat.south) * satImg.height;
        const sw = (maxLng - minLng) / (sat.east - sat.west) * satImg.width;
        const shh = (maxLat - minLat) / (sat.north - sat.south) * satImg.height;
        c.drawImage(satImg, sx, sy, sw, shh, 0, 0, W, Ht);
      } catch (e) {}
    }
    if (showFw) (h.fairways||[]).forEach(function(fw){
      c.beginPath();
      fw.latlngs.forEach(function(ll,i){ const p=xy(ll[0],ll[1]); i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]); });
      c.closePath(); c.fillStyle=sty.fw; c.globalAlpha=+sty.fwAlpha||0; c.fill(); c.globalAlpha=1; c.strokeStyle=sty.fw; c.lineWidth=1.4; c.stroke();
    });
    if (h.tee && h.green && showDash){
      const a=xy(h.tee.lat,h.tee.lng), b=xy(h.green.lat,h.green.lng);
      c.setLineDash([6,5]); c.strokeStyle=sty.line; c.lineWidth=2; c.beginPath(); c.moveTo(a[0],a[1]); c.lineTo(b[0],b[1]); c.stroke(); c.setLineDash([]);
    }
    if (showTee && h.tee){
      const p=xy(h.tee.lat,h.tee.lng);
      c.fillStyle=sty.tee; c.beginPath(); c.moveTo(p[0],p[1]-8); c.lineTo(p[0]+7,p[1]+6); c.lineTo(p[0]-7,p[1]+6); c.closePath(); c.fill();
    }
    if (showGreen && h.green){
      const p=xy(h.green.lat,h.green.lng);
      c.fillStyle=sty.hole; c.beginPath(); c.arc(p[0],p[1],9,0,Math.PI*2); c.fill();
      c.fillStyle=sty.holeFont; c.font='800 11px Tahoma'; c.textAlign='center'; c.fillText(String(n), p[0], p[1]+4);
    }
    holeSel = String(n);
    holePlan().forEach(function(sh){
      if (!sh.pts || sh.pts.length<2) return;
      c.strokeStyle = sh.color || '#D4AF37'; c.lineWidth=3.5; c.lineCap='round'; c.lineJoin='round'; c.beginPath();
      sh.pts.forEach(function(pt,i){ const p=xy(pt.lat,pt.lng); i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]); });
      c.stroke();
    });
    holeSel = keep;
    return cvs.toDataURL('image/jpeg', 0.88);
  }
  function exportShotReport(nums, btn){
    if (!window.PDFK || !PDFK.a4){
      if (window.APP && APP.toast) APP.toast('موتور PDF در دسترس نیست', 'red');
      return;
    }
    const sat = satInfo();
    const img = new Image();
    let once = false;
    const go = function(ok){
      if (once) return; once = true;
      const keep = holeSel;
      const sections = [];
      let shotN = 0, distM = 0;
      nums.forEach(function(n){
        holeSel = String(n);
        const arr = holePlan();
        if (!arr.length) return;
        shotN += arr.length;
        arr.forEach(function(sh){ distM += totalM(sh.pts||[]); });
        const hh = holesData()[String(n)] || {};
        const data = drawHoleSnap(ok ? img : null, n);
        sections.push({
          h: '⛳ میدان ' + n + (hh.yards ? (' · ' + hh.yards + ' yd') : '') + (hh.par ? (' · پار ' + hh.par) : ''),
          sub: arr.length + ' ضربه',
          html: data ? ('<img src="'+data+'" alt="" style="width:100%;border-radius:10px;border:1px solid rgba(212,175,55,.28);display:block;margin:6px 0 8px">') : '',
          table: {
            head: ['ضربه', 'کلاب', 'متراژ', 'توضیح'],
            rows: arr.map(function(sh,i){
              return [
                fa(i+1),
                '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+esc(sh.color||'#D4AF37')+';margin-left:5px;vertical-align:middle"></span>'+esc(sh.club||''),
                fmtDist(totalM(sh.pts||[])),
                esc(sh.note||'')
              ];
            })
          }
        });
      });
      holeSel = keep;
      if (!sections.length){
        if (window.APP && APP.toast) APP.toast('هنوز ضربه‌ای برای گزارش نیست', 'orange');
        return;
      }
      const pn = playerName();
      PDFK.a4({
        kind: 'گزارش برنامهٔ شات',
        title: 'برنامهٔ شات' + (pn ? (' — «' + esc(pn) + '»') : ''),
        sub: 'مسجدسلیمان · MIS GOLF',
        meta: [
          (nums.length === 1 ? ('میدان ' + nums[0]) : (sections.length + ' میدان')),
          shotN + ' ضربه',
          fmtDist(distM)
        ],
        kpis: [
          { v: fa(sections.length), l: 'میدان' },
          { v: fa(shotN), l: 'ضربه' },
          { v: fmtDist(distM), l: 'مجموع متراژ' }
        ],
        sections: sections,
        fileName: 'گزارش-شات-' + (nums.length===1 ? ('میدان-'+nums[0]) : 'کامل') + '.pdf',
        btn: btn || null
      }).catch(function(){});
    };
    if (sat && sat.url){
      img.onload = function(){ go(true); };
      img.onerror = function(){ go(false); };
      img.src = bgUrl();
      if (img.complete && img.width) go(true);
    } else go(false);
  }

  window.EarthMap = { mount, destroy };
})();
