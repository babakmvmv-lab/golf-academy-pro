/* نقشهٔ زمین مسجدسلیمان — لایه‌های KML، زوم میدان، خط‌کش م/یارد، برنامهٔ شات */
(function(){
  const STORE = 'ga_earth_places';
  const PLAN_KEY = 'ga_course_plans';
  const CLUBS = ['Driver','3 Wood','5 Wood','Hybrid','Iron 3','Iron 4','Iron 5','Iron 6','Iron 7','Iron 8','Iron 9','Pitching Wedge','Gap Wedge','Sand Wedge','Lob Wedge','Putter'];
  const CLUB_COLORS = ['#D4AF37','#E67E22','#1EBB8A','#9B59B6','#2E86DE','#E74C3C','#1abc9c','#f39c12','#16a085','#c0392b'];
  const YD = 0.9144;

  let map = null, measurePts = [], measureLine = null, measureMarks = [], mode = 'pan';
  let unit = 'yd', holeSel = 'all', showTee = true, showGreen = true, showFw = true;
  let courseLayers = [], clubDraw = null, clubLine = null, clubMarks = [];
  let optsRef = {};

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
    if (!isFinite(m) || m <= 0) return unit === 'yd' ? '۰ یارد' : '۰ متر';
    if (unit === 'yd') return fa(Math.round(m / YD)) + ' یارد';
    if (m < 1000) return fa(Math.round(m)) + ' متر';
    return fa((m/1000).toFixed(2)) + ' کیلومتر';
  }
  function holesData(){
    const g = window.MIS_GOLF;
    return (g && g.holes) ? g.holes : {};
  }
  function satInfo(){
    const g = window.MIS_GOLF;
    return (g && g.sat) ? g.sat : null;
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
  function teeIcon(n){
    return L.divIcon({
      className: 'earth-divicon',
      html: `<div class="cm-tee">▲<small>T${n}</small></div>`,
      iconSize: [28, 28], iconAnchor: [14, 18]
    });
  }
  function holeIcon(n){
    return L.divIcon({
      className: 'earth-divicon',
      html: `<div class="cm-green">${n}</div>`,
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
      measureLine = L.polyline(measurePts.map(p => [p.lat, p.lng]), { color:'#f0d989', weight:3, dashArray:'6 6' }).addTo(map);
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
    if (el) el.textContent = measurePts.length < 2 ? (mode==='measure' ? 'روی نقشه کلیک کنید' : 'خط‌کش خاموش') : ('مجموع: ' + fmtDist(totalM(measurePts)));
  }
  function clearMeasure(){ measurePts = []; redrawMeasure(); }

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
          const poly = L.polygon(fw.latlngs, { color:'#8fe3c4', weight:1.6, fillColor:'#3d9e6a', fillOpacity:0.22 });
          poly.bindPopup('<b>'+esc(fw.name)+'</b>');
          poly.addTo(map); addLayer(poly); group.push(poly);
        });
      }
      if (h.tee && h.green){
        const ln = L.polyline([[h.tee.lat,h.tee.lng],[h.green.lat,h.green.lng]], { color:'#7dcc7a', weight:2, dashArray:'6 5', opacity:0.9 });
        const d = hav(h.tee, h.green);
        ln.bindPopup('میدان '+fa(n)+' • '+fmtDist(d)+(h.yards?(' • کارت '+fa(h.yards)+' یارد'):'')+(h.par?(' • پار '+fa(h.par)):''));
        ln.addTo(map); addLayer(ln); group.push(ln);
        const mid = { lat:(h.tee.lat+h.green.lat)/2, lng:(h.tee.lng+h.green.lng)/2 };
        const lab = L.marker([mid.lat, mid.lng], {
          icon: L.divIcon({ className:'earth-divicon', html:`<div class="earth-seg">${h.yards?fa(h.yards)+' yd':fmtDist(d)}</div>`, iconSize:[70,18], iconAnchor:[35,9] }),
          interactive:false
        });
        lab.addTo(map); addLayer(lab);
      }
      if (showTee && h.tee){
        const m = L.marker([h.tee.lat, h.tee.lng], { icon: teeIcon(n) });
        m.bindPopup('<b>تی‌باکس '+fa(n)+'</b><br>'+esc(h.tee.name||'')+'<br>'+(h.yards?fa(h.yards)+' یارد':'')+(h.par?(' • پار '+fa(h.par)):''));
        m.addTo(map); addLayer(m); group.push(m);
      }
      if (showGreen && h.green){
        const m = L.marker([h.green.lat, h.green.lng], { icon: holeIcon(n) });
        m.bindPopup('<b>حفره '+fa(n)+'</b><br>'+esc(h.green.name||''));
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
  function drawSavedPlan(){
    if (holeSel === 'all') return;
    holePlan().forEach(function(sh){
      if (!sh.pts || sh.pts.length < 2) return;
      const ln = L.polyline(sh.pts.map(p => [p.lat,p.lng]), { color: sh.color || '#D4AF37', weight:4 });
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
    clubLine = L.polyline(clubDraw.pts.map(p => [p.lat,p.lng]), { color: clubDraw.color, weight:4 }).addTo(map);
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
  }

  function exportPoster(){
    const sat = satInfo();
    const img = new Image();
    let once = false;
    const go = function(ok){ if (once) return; once = true; drawPoster(ok ? img : null); };
    if (sat && sat.url){
      img.onload = function(){ go(true); };
      img.onerror = function(){ go(false); };
      img.src = sat.url;
      if (img.complete && img.width) go(true);
    } else go(false);
  }
  function drawPoster(satImg){
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
        c.closePath(); c.fillStyle='rgba(61,158,106,.22)'; c.fill(); c.strokeStyle='#2e7d32'; c.lineWidth=1.2; c.stroke();
      });
      if (h.tee && h.green){
        const a=xy(h.tee.lat,h.tee.lng), b=xy(h.green.lat,h.green.lng);
        c.setLineDash([6,5]); c.strokeStyle='#66bb6a'; c.lineWidth=2; c.beginPath(); c.moveTo(a[0],a[1]); c.lineTo(b[0],b[1]); c.stroke(); c.setLineDash([]);
        c.fillStyle='#2e7d32'; c.font='12px Tahoma'; c.textAlign='center';
        c.fillText((h.yards||'')+' yd', (a[0]+b[0])/2, (a[1]+b[1])/2 - 6);
      }
      if (showTee && h.tee){
        const p=xy(h.tee.lat,h.tee.lng);
        c.fillStyle='#f0d989'; c.beginPath(); c.moveTo(p[0],p[1]-8); c.lineTo(p[0]+7,p[1]+6); c.lineTo(p[0]-7,p[1]+6); c.closePath(); c.fill();
        c.fillStyle='#1e3d2f'; c.font='11px Tahoma'; c.fillText('T'+n, p[0], p[1]+20);
      }
      if (showGreen && h.green){
        const p=xy(h.green.lat,h.green.lng);
        c.fillStyle='#1e3d2f'; c.beginPath(); c.arc(p[0],p[1],10,0,Math.PI*2); c.fill();
        c.fillStyle='#f0d989'; c.font='800 11px Tahoma'; c.textAlign='center'; c.fillText(String(n), p[0], p[1]+4);
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
    [['earth-ly-tee', v => { showTee=v; }], ['earth-ly-green', v => { showGreen=v; }], ['earth-ly-fw', v => { showFw=v; }]].forEach(function(pair){
      const el = document.getElementById(pair[0]);
      if (!el) return;
      el.checked = pair[0]==='earth-ly-tee'?showTee:pair[0]==='earth-ly-green'?showGreen:showFw;
      el.onchange = function(){ pair[1](!!el.checked); drawCourse(); };
    });
    const un = document.getElementById('earth-unit');
    if (un){
      un.value = unit;
      un.onchange = function(){ unit = un.value; redrawMeasure(); drawCourse(); };
    }
    const bM = document.getElementById('earth-btn-measure');
    const bC = document.getElementById('earth-btn-clear');
    const bE = document.getElementById('earth-btn-earth');
    const bX = document.getElementById('earth-btn-export');
    const bClub = document.getElementById('earth-btn-club');
    const bDone = document.getElementById('earth-btn-club-done');
    const bNext = document.getElementById('earth-btn-next');
    if (bM) bM.onclick = function(){ mode = (mode==='measure')?'pan':'measure'; clubDraw=null; syncModeBtns(); };
    if (bC) bC.onclick = function(){ clearMeasure(); };
    if (bE) bE.onclick = function(){ const c = map.getCenter(); window.open(earthUrl(c.lat,c.lng),'_blank','noopener'); };
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
    if (dist && mode!=='measure') dist.textContent = mode==='club' ? 'روی نقشه کلیک کنید تا مسیر کلاب کشیده شود' : 'خط‌کش خاموش';
    if (mode==='measure') redrawMeasure();
  }

  function mount(el, opts){
    destroy();
    if (!el) return;
    optsRef = opts || {};
    holeSel = 'all';
    const H = holesData();
    const h1 = H['1'] && H['1'].tee;
    const center = optsRef.center || (h1 ? { lat:h1.lat, lng:h1.lng } : { lat:31.90494, lng:49.31398 });

    if (typeof L === 'undefined'){
      el.innerHTML = `<div class="earth-fallback">نقشه بارگذاری نشد.</div>`;
      return;
    }

    const sat = satInfo();
    map = L.map(el, { zoomControl:true, attributionControl:false, tap:true, minZoom:15, maxZoom:20 }).setView([center.lat, center.lng], 16);
    if (sat && sat.url){
      map.createPane('satpane');
      map.getPane('satpane').style.zIndex = 350;
      L.imageOverlay(sat.url, [[sat.south, sat.west],[sat.north, sat.east]], { opacity:1, interactive:false, pane:'satpane' }).addTo(map);
    } else {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom:20, subdomains:'abcd'
      }).addTo(map);
    }

    bindUi();
    drawCourse();

    map.on('click', function(ev){
      const lat = ev.latlng.lat, lng = ev.latlng.lng;
      if (mode === 'measure'){ measurePts.push({ lat, lng }); redrawMeasure(); return; }
      if (mode === 'club' && clubDraw){ clubDraw.pts.push({ lat, lng }); redrawClubDraw(); return; }
    });

    setTimeout(function(){ try { map.invalidateSize(); drawCourse(); } catch(e){} }, 250);
    syncModeBtns();
  }

  window.EarthMap = { mount, destroy };
})();
