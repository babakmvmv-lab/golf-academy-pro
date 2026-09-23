/* زمین‌های گوگل‌ارث — قالب مسجدسلیمان: T.n …Y…Par -W/-M ، Hole n ، fairway n */
(function(){
  const KEY = 'ga_course_geo';
  const YD = 1.0936133;

  function clone(o){ try { return JSON.parse(JSON.stringify(o)); } catch(e){ return o; } }
  function loadAll(){
    try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch(e){ return {}; }
  }
  function saveAll(o){ try { localStorage.setItem(KEY, JSON.stringify(o)); } catch(e){} }
  function normName(s){ return String(s || '').replace(/[\u200c\u200f\u200e]/g, ' ').replace(/\s+/g, ' ').trim(); }

  function parseName(raw){
    const n = normName(raw);
    let m = n.match(/^T\.?\s*(\d+)/i);
    if (m){
      const hole = +m[1];
      const yards = +((n.match(/(\d+)\s*Y/i) || [])[1] || 0);
      const par = +((n.match(/par\s*(\d)/i) || [])[1] || 0);
      let gender = 'F';
      if (/-\s*M\s*$/i.test(n)) gender = 'M';
      else if (/-\s*W\s*$/i.test(n)) gender = 'F';
      return { kind:'tee', hole, yards, par, gender, name:n };
    }
    m = n.match(/^Hole\s*(\d+)/i);
    if (m) return { kind:'hole', hole:+m[1], name:n };
    m = n.match(/fairway\s*n?\s*(\d+)/i) || n.match(/fairway(\d+)/i);
    if (m) return { kind:'fairway', hole:+m[1], name:n };
    return { kind:'other', name:n };
  }

  function coordsOf(block){
    const m = String(block).match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
    if (!m) return [];
    return m[1].trim().split(/[\s\n\r]+/).map(function(tok){
      const p = tok.split(',');
      const lng = parseFloat(p[0]), lat = parseFloat(p[1]);
      if (!isFinite(lat) || !isFinite(lng)) return null;
      return [lat, lng];
    }).filter(Boolean);
  }

  function parseKml(text){
    const holes = {};
    const report = { teesF:0, teesM:0, greens:0, fairways:0, other:0, names:[] };
    const blocks = String(text || '').match(/<Placemark[\s\S]*?<\/Placemark>/gi) || [];
    function holeObj(n){
      if (!holes[n]) holes[n] = { n:+n, par:0, yards:0, yardsF:0, yardsM:0, tee:null, teeF:null, teeM:null, green:null, fairways:[] };
      return holes[n];
    }
    blocks.forEach(function(b){
      const nm = ((b.match(/<name[^>]*>([\s\S]*?)<\/name>/i) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '');
      const info = parseName(nm);
      const pts = coordsOf(b);
      if (!pts.length){ report.other++; return; }
      report.names.push(info.name);
      if (info.kind === 'tee'){
        const h = holeObj(info.hole);
        const pt = { lat: pts[0][0], lng: pts[0][1], name: info.name };
        if (info.par) h.par = info.par;
        if (info.gender === 'M'){
          h.teeM = pt; if (info.yards) h.yardsM = info.yards; report.teesM++;
        } else {
          h.teeF = pt; h.tee = pt; if (info.yards){ h.yardsF = info.yards; h.yards = info.yards; } report.teesF++;
        }
      } else if (info.kind === 'hole'){
        const h = holeObj(info.hole);
        h.green = { lat: pts[0][0], lng: pts[0][1], name: info.name };
        report.greens++;
      } else if (info.kind === 'fairway'){
        const h = holeObj(info.hole);
        h.fairways.push({ name: info.name, latlngs: pts });
        report.fairways++;
      } else report.other++;
    });
    Object.keys(holes).forEach(function(k){
      const h = holes[k];
      if (!h.yards && h.yardsF) h.yards = h.yardsF;
      if (!h.tee && h.teeF) h.tee = h.teeF;
    });
    const nums = Object.keys(holes).map(Number).sort(function(a,b){ return a-b; });
    let minLat=90, maxLat=-90, minLng=180, maxLng=-180;
    nums.forEach(function(n){
      const h = holes[n];
      [h.teeF, h.teeM, h.green].forEach(function(p){
        if (!p) return;
        minLat=Math.min(minLat,p.lat); maxLat=Math.max(maxLat,p.lat);
        minLng=Math.min(minLng,p.lng); maxLng=Math.max(maxLng,p.lng);
      });
      (h.fairways||[]).forEach(function(fw){
        (fw.latlngs||[]).forEach(function(ll){
          minLat=Math.min(minLat,ll[0]); maxLat=Math.max(maxLat,ll[0]);
          minLng=Math.min(minLng,ll[1]); maxLng=Math.max(maxLng,ll[1]);
        });
      });
    });
    const pars = nums.map(function(n){ return holes[n].par || 4; });
    return {
      name: '',
      holes, pars, nums,
      bounds: (maxLat > minLat) ? { south:minLat, west:minLng, north:maxLat, east:maxLng } : null,
      center: (maxLat > minLat) ? { lat:(minLat+maxLat)/2, lng:(minLng+maxLng)/2 } : null,
      report
    };
  }

  function keyOf(courseId){
    if (courseId === 'mis' || +courseId === 1) return '1';
    const id = +courseId;
    if (id >= 1000){
      try {
        const extra = JSON.parse(localStorage.getItem('ga_courses') || '[]');
        const c = extra[id - 1000];
        if (c && c.geoId) return String(c.geoId);
      } catch(e){}
      return String(id);
    }
    return String(courseId == null ? 1 : courseId);
  }

  function baseMis(){
    const g = window.MIS_GOLF;
    if (!g || !g.holes) return { name:'زمین مسجدسلیمان', id:'mis', holes:{} };
    const holes = {};
    Object.keys(g.holes).forEach(function(k){
      const h = clone(g.holes[k]);
      if (!h.teeF && h.tee) h.teeF = clone(h.tee);
      if (!h.yardsF && h.yards) h.yardsF = h.yards;
      holes[k] = h;
    });
    return { name: g.name, id:'mis', holes, sat: g.sat };
  }

  function pack(courseId){
    const key = keyOf(courseId);
    const ov = loadAll()[key];
    if (key === '1'){
      const base = baseMis();
      if (!ov || !ov.holes) return base;
      Object.keys(ov.holes).forEach(function(k){
        base.holes[k] = Object.assign(base.holes[k] || { n:+k, fairways:[] }, clone(ov.holes[k]));
        const h = base.holes[k];
        if (!h.tee && h.teeF) h.tee = h.teeF;
      });
      return base;
    }
    if (ov && ov.holes) return ov;
    return { name:'', holes:{} };
  }

  function teeOf(h, gender){
    if (!h) return null;
    const g = String(gender || 'F').toUpperCase();
    if (g === 'M') return h.teeM || null;
    return h.teeF || h.tee || null;
  }
  function yardsOf(h, gender){
    if (!h) return 0;
    const g = String(gender || 'F').toUpperCase();
    if (g === 'M') return h.yardsM || 0;
    return h.yardsF || h.yards || 0;
  }
  function havM(a, b){
    if (!a || !b) return 0;
    const R = 6371000, toR = Math.PI/180;
    const dLat = (b.lat-a.lat)*toR, dLng = (b.lng-a.lng)*toR;
    const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*toR)*Math.cos(b.lat*toR)*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function patchHole(courseId, n, fn){
    const key = keyOf(courseId);
    const all = loadAll();
    if (!all[key]) all[key] = { holes:{} };
    if (!all[key].holes) all[key].holes = {};
    const cur = pack(courseId).holes[String(n)] || { n:+n, fairways:[] };
    const next = clone(cur);
    fn(next);
    all[key].holes[String(n)] = next;
    saveAll(all);
    return next;
  }
  function moveTee(courseId, n, gender, lat, lng){
    return patchHole(courseId, n, function(h){
      const g = String(gender || 'F').toUpperCase();
      const pt = Object.assign({}, g === 'M' ? (h.teeM || {}) : (h.teeF || h.tee || {}), { lat:+lat, lng:+lng });
      if (g === 'M') h.teeM = pt;
      else { h.teeF = pt; h.tee = pt; }
      if (h.green){
        const yd = Math.round(havM(pt, h.green) * YD);
        if (g === 'M') h.yardsM = yd; else { h.yardsF = yd; h.yards = yd; }
      }
    });
  }
  function moveGreen(courseId, n, lat, lng){
    return patchHole(courseId, n, function(h){
      h.green = Object.assign({}, h.green || {}, { lat:+lat, lng:+lng });
      if (h.teeF){ h.yardsF = Math.round(havM(h.teeF, h.green)*YD); h.yards = h.yardsF; }
      if (h.teeM) h.yardsM = Math.round(havM(h.teeM, h.green)*YD);
    });
  }
  function moveFairwayVertex(courseId, n, fi, vi, lat, lng){
    return patchHole(courseId, n, function(h){
      const fw = (h.fairways || [])[fi];
      if (!fw || !fw.latlngs || !fw.latlngs[vi]) return;
      fw.latlngs[vi] = [+lat, +lng];
    });
  }
  function set(geoId, data){
    const all = loadAll();
    all[String(geoId)] = data;
    saveAll(all);
  }
  function summary(p){
    const H = (p && p.holes) || {};
    const nums = Object.keys(H).map(Number).sort(function(a,b){return a-b;});
    let f=0, m=0, g=0, fw=0;
    nums.forEach(function(n){
      const h = H[n];
      if (h.teeF || h.tee) f++;
      if (h.teeM) m++;
      if (h.green) g++;
      fw += (h.fairways || []).length;
    });
    return { holes: nums.length, teesF:f, teesM:m, greens:g, fairways:fw, pars: nums.map(function(n){ return H[n].par || 4; }) };
  }

  function copyTees(courseId, fromG, toG){
    const p = pack(courseId);
    let n = 0;
    Object.keys(p.holes || {}).forEach(function(k){
      const h = p.holes[k];
      const src = teeOf(h, fromG);
      if (!src) return;
      if (teeOf(h, toG)) return;
      moveTee(courseId, k, toG, src.lat, src.lng);
      n++;
    });
    return n;
  }
  function xmlEsc(s){
    return String(s == null ? '' : s).replace(/[&<>\"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
    });
  }
  function toKml(p){
    p = p || { holes:{} };
    const H = p.holes || {};
    const nums = Object.keys(H).map(Number).sort(function(a,b){ return a-b; });
    let body = '';
    function pt(name, lat, lng){
      body += '<Placemark><name>'+xmlEsc(name)+'</name><Point><coordinates>'+lng+','+lat+',0</coordinates></Point></Placemark>\n';
    }
    function poly(name, latlngs){
      const ring = (latlngs || []).map(function(ll){ return ll[1]+','+ll[0]+',0'; }).join(' ');
      body += '<Placemark><name>'+xmlEsc(name)+'</name><Polygon><outerBoundaryIs><LinearRing><coordinates>'+ring+'</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>\n';
    }
    nums.forEach(function(n){
      const h = H[n];
      const par = h.par || 4;
      if (h.teeF || h.tee){
        const t = h.teeF || h.tee;
        const yd = h.yardsF || h.yards || '';
        pt('T.'+n+' -'+(yd||'')+'Y -Par'+par+' -W', t.lat, t.lng);
      }
      if (h.teeM){
        const yd = h.yardsM || '';
        pt('T.'+n+' -'+(yd||'')+'Y -Par'+par+' -M', h.teeM.lat, h.teeM.lng);
      }
      if (h.green) pt('Hole '+n, h.green.lat, h.green.lng);
      (h.fairways || []).forEach(function(fw){ poly(fw.name || ('fairway '+n), fw.latlngs); });
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>'+xmlEsc(p.name||'course')+'</name>\n'+body+'</Document></kml>';
  }
  function downloadKml(courseId){
    const p = pack(courseId);
    const txt = toKml(p);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type:'application/vnd.google-earth.kml+xml' }));
    a.download = (p.name || 'course').replace(/\s+/g,'_') + '.kml';
    a.click();
  }

  window.CourseGeo = {
    parseKml, parseName, pack, keyOf, teeOf, yardsOf,
    moveTee, moveGreen, moveFairwayVertex, set, loadAll, summary,
    copyTees, toKml, downloadKml
  };
})();
