/* نقشه ماهواره‌ای گوگل‌ارث + خط‌کش متری */
(function(){
  const STORE = 'ga_earth_places';
  let map = null, measurePts = [], measureLine = null, measureMarks = [], mode = 'pan';

  function loadPins(){
    try { const a = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function savePins(a){ try { localStorage.setItem(STORE, JSON.stringify(a)); } catch (e) {} }

  function hav(a, b){
    const R = 6371000;
    const p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
    const dlat = (b.lat - a.lat) * Math.PI / 180;
    const dlng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dlat/2)**2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlng/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function fmtM(m){
    if (!isFinite(m) || m <= 0) return '۰ متر';
    if (m < 1000) return fa(Math.round(m)) + ' متر';
    return fa((m/1000).toFixed(2)) + ' کیلومتر';
  }
  function fa(v){
    if (window.Data && Data.fa) return Data.fa(v);
    return String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function pinIcon(color, label){
    return L.divIcon({
      className: 'earth-divicon',
      html: `<div class="earth-pin" style="--c:${color}"><span>${label || ''}</span></div>`,
      iconSize: [28, 36], iconAnchor: [14, 34], popupAnchor: [0, -30]
    });
  }
  function dotIcon(){
    return L.divIcon({
      className: 'earth-divicon',
      html: '<div class="earth-dot"></div>',
      iconSize: [12, 12], iconAnchor: [6, 6]
    });
  }

  function totalM(){
    let s = 0;
    for (let i = 1; i < measurePts.length; i++) s += hav(measurePts[i-1], measurePts[i]);
    return s;
  }
  function redrawMeasure(){
    if (!map) return;
    if (measureLine) { map.removeLayer(measureLine); measureLine = null; }
    measureMarks.forEach(m => map.removeLayer(m));
    measureMarks = [];
    if (measurePts.length){
      measureLine = L.polyline(measurePts.map(p => [p.lat, p.lng]), {
        color: '#f0d989', weight: 3, dashArray: '6 6'
      }).addTo(map);
      measurePts.forEach((p, i) => {
        const mk = L.marker([p.lat, p.lng], { icon: dotIcon(), interactive: false }).addTo(map);
        measureMarks.push(mk);
        if (i > 0){
          const seg = hav(measurePts[i-1], p);
          const mid = { lat: (measurePts[i-1].lat + p.lat)/2, lng: (measurePts[i-1].lng + p.lng)/2 };
          const lab = L.marker([mid.lat, mid.lng], {
            icon: L.divIcon({ className: 'earth-divicon', html: `<div class="earth-seg">${fmtM(seg)}</div>`, iconSize: [90, 20], iconAnchor: [45, 10] }),
            interactive: false
          }).addTo(map);
          measureMarks.push(lab);
        }
      });
    }
    const el = document.getElementById('earth-dist');
    if (el) el.textContent = measurePts.length < 2 ? 'برای اندازه، روی نقشه کلیک کنید' : ('مجموع: ' + fmtM(totalM()));
  }
  function clearMeasure(){
    measurePts = [];
    redrawMeasure();
  }

  function earthUrl(lat, lng){
    return 'https://earth.google.com/web/@' + lat + ',' + lng + ',450a,1200d,35y,0h,0t,0r';
  }

  function destroy(){
    if (map) { try { map.remove(); } catch (e) {} map = null; }
    measurePts = []; measureLine = null; measureMarks = []; mode = 'pan';
  }

  function mount(el, opts){
    destroy();
    if (!el) return;
    opts = opts || {};
    const center = opts.center || { lat: 31.9364, lng: 49.3039 };
    const places = Array.isArray(opts.places) ? opts.places : [];

    if (typeof L === 'undefined'){
      el.innerHTML = `<div class="earth-fallback">نقشه بارگذاری نشد.
        <a href="${earthUrl(center.lat, center.lng)}" target="_blank" rel="noopener">باز کردن در Google Earth</a></div>`;
      return;
    }

    map = L.map(el, { zoomControl: true, attributionControl: true, tap: true }).setView([center.lat, center.lng], opts.zoom || 16);
    /* کاشی گوگل در ایران اغلب تصویر آبی خالی با وضعیت ۲۰۰ می‌دهد — tileerror نمی‌آید.
       ماهوارهٔ Esri / سنتینل پیش‌فرض است؛ گوگل فقط به‌صورت لایهٔ اختیاری. */
    const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Esri'
    });
    const sentinel = L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg', {
      maxZoom: 16, attribution: 'EOX Sentinel-2'
    });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, subdomains: 'abc', attribution: '© OSM'
    });
    const google = L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20, subdomains: '0123', attribution: 'Google'
    });
    esri.addTo(map);
    let satIndex = 0;
    const satChain = [esri, sentinel, osm];
    satChain[0].on('tileerror', function onErr(){
      satChain[satIndex].off('tileerror', onErr);
      if (map.hasLayer(satChain[satIndex])) map.removeLayer(satChain[satIndex]);
      satIndex++;
      if (satIndex < satChain.length){
        satChain[satIndex].addTo(map);
        satChain[satIndex].on('tileerror', onErr);
      }
    });
    L.control.layers({
      'ماهواره': esri,
      'ماهوارهٔ سنتینل': sentinel,
      'نقشهٔ خیابان': osm,
      'گوگل (اگر فیلتر نباشد)': google
    }, null, { collapsed: false, position: 'topright' }).addTo(map);
    setTimeout(function(){ try { map.invalidateSize(); } catch (e) {} }, 250);
    setTimeout(function(){ try { map.invalidateSize(); } catch (e) {} }, 800);

    function addPlaceMarker(p, color){
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(color || '#D4AF37', '⛳') }).addTo(map);
      m.bindPopup(`<b>${esc(p.name || 'موقعیت')}</b><br><span dir="ltr">${(+p.lat).toFixed(5)}, ${(+p.lng).toFixed(5)}</span>`);
      return m;
    }
    places.forEach(p => { if (p && isFinite(+p.lat) && isFinite(+p.lng)) addPlaceMarker(p, '#D4AF37'); });
    loadPins().forEach(p => addPlaceMarker(p, '#7ee8b8'));
    renderPinList();

    map.on('click', function(ev){
      const lat = ev.latlng.lat, lng = ev.latlng.lng;
      if (mode === 'measure'){
        measurePts.push({ lat, lng });
        redrawMeasure();
        return;
      }
      if (mode === 'pin'){
        const inp = document.getElementById('earth-pin-name');
        const name = (inp && inp.value.trim()) || 'موقعیت';
        const pins = loadPins();
        pins.push({ id: Date.now(), name, lat, lng });
        savePins(pins);
        addPlaceMarker({ name, lat, lng }, '#7ee8b8');
        if (inp) inp.value = '';
        mode = 'pan';
        syncModeBtns();
        renderPinList();
      }
    });

    const dist = document.getElementById('earth-dist');
    if (dist) dist.textContent = 'خط‌کش خاموش است';

    function syncModeBtns(){
      const bM = document.getElementById('earth-btn-measure');
      const bP = document.getElementById('earth-btn-pin');
      if (bM) bM.classList.toggle('on', mode === 'measure');
      if (bP) bP.classList.toggle('on', mode === 'pin');
      el.style.cursor = (mode === 'pan') ? '' : 'crosshair';
      if (dist && mode !== 'measure') dist.textContent = mode === 'pin' ? 'روی نقشه بزنید تا سنجاق شود' : 'خط‌کش خاموش است';
      if (mode === 'measure') redrawMeasure();
    }

    const bM = document.getElementById('earth-btn-measure');
    const bC = document.getElementById('earth-btn-clear');
    const bP = document.getElementById('earth-btn-pin');
    const bE = document.getElementById('earth-btn-earth');
    if (bM) bM.onclick = function(){ mode = (mode === 'measure') ? 'pan' : 'measure'; if (mode !== 'measure') {} syncModeBtns(); };
    if (bC) bC.onclick = function(){ clearMeasure(); };
    if (bP) bP.onclick = function(){ mode = (mode === 'pin') ? 'pan' : 'pin'; syncModeBtns(); };
    if (bE) bE.onclick = function(){
      const c = map.getCenter();
      window.open(earthUrl(c.lat, c.lng), '_blank', 'noopener');
    };
    syncModeBtns();
  }

  function renderPinList(){
    const box = document.getElementById('earth-pins');
    if (!box) return;
    const pins = loadPins();
    if (!pins.length){ box.innerHTML = '<span class="earth-pins-empty">سنجاقی ذخیره نشده — نام بگذارید و «سنجاق» را بزنید.</span>'; return; }
    box.innerHTML = pins.map(p =>
      `<button type="button" class="earth-pin-chip" data-id="${p.id}" data-lat="${p.lat}" data-lng="${p.lng}">
        <span>📍 ${esc(p.name)}</span>
        <span class="earth-pin-x" data-del="${p.id}">✕</span>
      </button>`
    ).join('');
    box.querySelectorAll('.earth-pin-chip').forEach(btn => {
      btn.addEventListener('click', function(e){
        if (e.target.closest('[data-del]')){
          const id = +e.target.closest('[data-del]').getAttribute('data-del');
          e.stopPropagation();
          savePins(loadPins().filter(p => p.id !== id));
          if (window.APP && APP.go) APP.go('course');
          else renderPinList();
          return;
        }
        if (map) map.setView([+btn.dataset.lat, +btn.dataset.lng], 18);
      });
    });
  }

  window.EarthMap = { mount, destroy };
})();
