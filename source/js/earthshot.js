/* EarthShot — گرفتن خودکارِ تصویر پس‌زمینهٔ نقشهٔ زمین.
   با هر KML، بدون هیچ کاری از طرف کاربر:
   ۱) محدودهٔ زمین ۴ برابر (مساحت) بزرگ می‌شود و نسبت افقی صفحه (عرض ≥ ۲× ارتفاع) می‌گیرد،
   ۲) با بهترین زوم ممکن کاشی‌های ماهواره‌ای و توپوگرافی از سرویس‌های عمومی
      (بدون کلید) گرفته و روی یک بوم دوخته می‌شوند،
   ۳) هر دو حالت از همان اول ذخیره می‌شوند (IndexedDB — عکس بزرگ است، localStorage نه).
   سمت ماهواره: گوگل‌ارث → در صورت خطا Esri World Imagery.
   سمت توپوگرافی: OpenTopoMap → در صورت خطا Esri World Topo. */
(function(){
  'use strict';
  var TILE = 256;          /* اندازهٔ استاندارد کاشی */
  var MAX_TILES = 320;     /* سقف تعداد کاشی هر عکس — با نسبت افقی، زوی بالا حفظ می‌شود */
  var MAX_DIM = 5632;      /* سقف ابعاد بوم (نسبت افقی؛ مساحت زیر سقف امن iOS می‌ماند) */
  var MAX_ZOOM = 19, MIN_ZOOM = 14;
  var MAX_ZOOM_TOPO = 17; /* توپوگرافی: OpenTopoMap بیش از z17 ندارد؛ بالاتر کاشی خالی/تیره می‌دهد */
  var AREA_FACTOR = 4;     /* «۴ برابر این محدوده» — مساحت ×۴ (هر ضلع ×۲) */
  var LANDSCAPE = 2.0;     /* صفحهٔ نقشه افقی است؛ تصویر باید کل صفحه را بپوشاند (عرض ≥ ۲× ارتفاع) تا گوشه‌ها خالی نماند */
  var MIN_HALF_DEG = 0.003; /* زمین خیلی کوچک؟ حداقل عرضِ تصویر ~۶۶۰ متر (زمین‌های کوچک هم بافت اطراف را می‌گیرند) */

  /* اگر کاشی مستقیم نیامد (شبکهٔ بسته مثل ایران)، از پروکسی عمومی ابر می‌آید؛
     فقط خواندن کاشی نقشه است — نه کلید، نه دیتابیس. */
  var PROXY = 'https://iultwqtzvrysugfxwshw.supabase.co/functions/v1/earth-tile?m={m}&z={z}&x={x}&y={y}';

  /* اگر کاشی مستقیم نیامد (شبکهٔ بسته مثل ایران)، از پروکسی عمومی ابر می‌آید؛
     فقط خواندن کاشی نقشه است — نه کلید، نه دیتابیس. */
  var PROXY = 'https://iultwqtzvrysugfxwshw.supabase.co/functions/v1/earth-tile?m={m}&z={z}&x={x}&y={y}';

  var SOURCES = {
    sat: [
      { name: 'google', url: function(x, y, z){ return 'https://mt' + ((x + y) % 4) + '.google.com/vt/lyrs=s&x=' + x + '&y=' + y + '&z=' + z; } },
      { name: 'esri',   url: function(x, y, z){ return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x; } }
    ],
    topo: [
      { name: 'opentopomap', url: function(x, y, z){ return 'https://tile.opentopomap.org/' + z + '/' + x + '/' + y + '.png'; } },
      { name: 'esri_topo',   url: function(x, y, z){ return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/' + z + '/' + y + '/' + x; } }
    ]
  };

  function expand(b, factor){
    if (!b || !isFinite(b.south) || !isFinite(b.north) || !isFinite(b.west) || !isFinite(b.east)) return null;
    var k = Math.sqrt(factor || AREA_FACTOR); /* مساحت ×۴ ⇒ ضلع ×۲ */
    var cLat = (b.north + b.south) / 2, cLng = (b.east + b.west) / 2;
    var dLat = Math.max((b.north - b.south) / 2 * k, MIN_HALF_DEG);
    var cosLat = Math.max(0.2, Math.cos(cLat * Math.PI / 180));
    var dLng = Math.max((b.east - b.west) / 2 * k, MIN_HALF_DEG / cosLat);
    /* نسبت افقی: خروجی مربع نباشد؛ صفحهٔ نقشه افقی است و تصویر باید تمامش را بپوشاند.
       فقط عرض را زیاد می‌کنیم (جزئیات و زوم دست‌نخورده) — هرگز ارتفاع را کم نمی‌کنیم. */
    if (dLng * cosLat < dLat * LANDSCAPE) dLng = dLat * LANDSCAPE / cosLat;
    return { south: cLat - dLat, north: cLat + dLat, west: cLng - dLng, east: cLng + dLng };
  }

  /* ── ریاضیات مرکاتور ── */
  function lng2x(lng, z){ return (lng + 180) / 360 * Math.pow(2, z); }
  function lat2y(lat, z){
    var s = Math.sin(Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, z);
  }

  function tilesOf(b, z){
    var x0 = Math.floor(lng2x(b.west, z)), x1 = Math.floor(lng2x(b.east, z));
    var y0 = Math.floor(lat2y(b.north, z)), y1 = Math.floor(lat2y(b.south, z));
    return { x0: x0, x1: x1, y0: y0, y1: y1, nx: x1 - x0 + 1, ny: y1 - y0 + 1 };
  }
  function pickZoom(b, mode){
    var top = (mode === 'topo') ? MAX_ZOOM_TOPO : MAX_ZOOM;
    for (var z = top; z > MIN_ZOOM; z--){
      var t = tilesOf(b, z);
      if (t.nx * t.ny <= MAX_TILES && Math.max(t.nx, t.ny) * TILE <= MAX_DIM) return z;
    }
    return MIN_ZOOM;
  }

  function loadImg(url){
    return new Promise(function(res, rej){
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function(){ res(im); };
      im.onerror = function(){ rej(Error('tile failed')); };
      im.src = url;
    });
  }

  /* دوختن کاشی‌ها روی یک بوم؛ ۸ دانلود موازی، هر منبع شکست خورد منبع بعدی امتحان می‌شود */
  function stitch(mode, src, b, z, onProgress){
    var t = tilesOf(b, z), total = t.nx * t.ny;
    if (!total || total > MAX_TILES * 2) return Promise.reject(Error('extent too large'));
    var cv = document.createElement('canvas');
    cv.width = t.nx * TILE; cv.height = t.ny * TILE;
    var cx = cv.getContext('2d');
    cx.fillStyle = '#0a1410'; cx.fillRect(0, 0, cv.width, cv.height);
    var state = { done: 0, failed: 0, idx: 0, abort: false };
    function one(){
      if (state.abort || state.idx >= total) return Promise.resolve();
      var i = state.idx++;
      var x = t.x0 + (i % t.nx), y = t.y0 + Math.floor(i / t.nx);
      return loadImg(src.url(x, y, z)).catch(function(){
        return loadImg(PROXY.replace('{m}', mode).replace('{z}', z).replace('{x}', x).replace('{y}', y));
      }).then(function(im){
        cx.drawImage(im, (x - t.x0) * TILE, (y - t.y0) * TILE);
      }).catch(function(){ state.failed++; }).then(function(){
        state.done++;
        if (onProgress) { try { onProgress(Math.round(state.done / total * 100)); } catch (e) {} }
        if (state.failed > Math.max(3, Math.floor(total * 0.04))) state.abort = true;
        return one();
      });
    }
    var workers = Array.from({ length: Math.min(8, total) }, function(){ return one(); });
    return Promise.all(workers).then(function(){
      if (state.failed > Math.max(3, Math.floor(total * 0.04))) throw Error('too many failed tiles (' + state.failed + '/' + total + ')');
      /* محافظ «بوم خالی»: سرویسِ بی‌پوشش کاشی تیره می‌دهد؛ عکس تهی هرگز ذخیره نمی‌شود */
      try {
        var smp = cx.getImageData(0, 0, cv.width, cv.height).data;
        var sum = 0, sum2 = 0, n = 0;
        for (var i = 0; i < smp.length; i += 64){ var v = (smp[i] + smp[i+1] + smp[i+2]) / 3; sum += v; sum2 += v * v; n++; }
        var mean = sum / n;
        if (Math.sqrt(sum2 / n - mean * mean) < 6) throw Error('blank canvas (source has no coverage)');
      } catch (e){ if (String(e && e.message).indexOf('blank') >= 0) throw e; }
      return cv;
    });
  }

  function render(mode, b, onProgress){
    var z = pickZoom(b, mode), lastErr = null, i = 0;
    function tryNext(){
      var list = SOURCES[mode];
      if (i >= list.length) return Promise.reject(lastErr || Error('no source'));
      var src = list[i++];
      return stitch(mode, src, b, z, function(p){ if (onProgress) onProgress(mode, p, src.name); }).then(function(cv){
        return new Promise(function(res){ cv.toBlob(res, mode === 'sat' ? 'image/jpeg' : 'image/png', mode === 'sat' ? 0.92 : undefined); })
          .then(function(blob){ return { cv: cv, blob: blob }; });
      }).then(function(r){
        if (!r.blob || r.blob.size < 4000) throw Error('empty image');
        return {
          blob: r.blob,
          meta: { south: b.south, west: b.west, north: b.north, east: b.east, zoom: z, src: src.name, w: r.cv.width, h: r.cv.height, ts: Date.now() }
        };
      }).catch(function(e){ lastErr = e; return tryNext(); });
    }
    return tryNext();
  }

  /* ── ذخیره در IndexedDB (اگر نبود، فقط حافظهٔ جلسه) ── */
  var DB = 'ga_earth_shots', ST = 'shots', dbp = null;
  function db(){
    if (!dbp) dbp = new Promise(function(res, rej){
      var q = indexedDB.open(DB, 1);
      q.onupgradeneeded = function(){ q.result.createObjectStore(ST); };
      q.onsuccess = function(){ res(q.result); };
      q.onerror = function(){ rej(q.error); };
    });
    return dbp;
  }
  function idb(method, k, v){
    return db().then(function(d){
      return new Promise(function(res, rej){
        var tx = d.transaction(ST, method === 'get' ? 'readonly' : 'readwrite');
        var os = tx.objectStore(ST);
        var rq = method === 'get' ? os.get(k) : (method === 'del' ? os.delete(k) : os.put(v, k));
        rq.onsuccess = function(){ res(rq.result); };
        rq.onerror = function(){ rej(rq.error); };
      });
    });
  }

  var urls = new Map();     /* key → object URL (طول عمر صفحه) */
  var inflight = new Map(); /* key → Promise */

  function keyOf(key, mode){ return String(key) + ':' + mode; }

  function urlFor(key, mode){
    var u = urls.get(keyOf(key, mode));
    return u || null;
  }

  /* اگر عکس نیست، همان‌جا می‌گیرد؛ b باید همین حدِ پهن‌شده باشد (expand شده) */
  function ensure(key, mode, b){
    var k = keyOf(key, mode);
    if (urls.has(k)) return Promise.resolve(urls.get(k));
    if (inflight.has(k)) return inflight.get(k);
    var p = idb('get', k).then(function(rec){
      if (rec && rec.blob){ var u = URL.createObjectURL(rec.blob); urls.set(k, u); return u; }
      if (!b) return null;
      return render(mode, b).then(function(out){
        return idb('put', k, { blob: out.blob, meta: out.meta }).catch(function(){}).then(function(){
          var u2 = URL.createObjectURL(out.blob); urls.set(k, u2); return u2;
        });
      });
    }).catch(function(){ return null; }).then(function(u){
      inflight.delete(k); return u;
    });
    inflight.set(k, p);
    return p;
  }

  /* هر دو حالت را از اول می‌گیرد و ذخیره می‌کند؛ bounds خام (expand اینجا) */
  function captureFor(key, bounds, onProgress){
    var b = expand(bounds);
    if (!b) return Promise.reject(Error('bounds missing'));
    var out = { sat: null, topo: null };
    function reportComplete(mode, image){
      if (typeof onProgress !== 'function') return;
      try { onProgress(mode, image ? 100 : 0, { complete: true, ok: !!image }); } catch (e) {}
    }
    return render('sat', b, onProgress).catch(function(){ return null; }).then(function(sat){
      out.sat = sat;
      reportComplete('sat', sat);
      return sat ? idb('put', keyOf(key, 'sat'), { blob: sat.blob, meta: sat.meta }).catch(function(){}) : null;
    }).then(function(){
      return render('topo', b, onProgress).catch(function(){ return null; });
    }).then(function(topo){
      out.topo = topo;
      reportComplete('topo', topo);
      return topo ? idb('put', keyOf(key, 'topo'), { blob: topo.blob, meta: topo.meta }).catch(function(){}) : null;
    }).then(function(){
      if (out.sat) urls.set(keyOf(key, 'sat'), URL.createObjectURL(out.sat.blob));
      if (out.topo) urls.set(keyOf(key, 'topo'), URL.createObjectURL(out.topo.blob));
      return out;
    });
  }

  /* جابه‌جایی کلید (draft → geoId نهایی) بدون گرفتن دوباره */
  function rekey(from, to){
    if (String(from) === String(to)) return Promise.resolve();
    var modes = ['sat', 'topo'];
    return Promise.all(modes.map(function(m){
      var k = keyOf(from, m);
      return idb('get', k).then(function(rec){
        if (!rec) return;
        return idb('put', keyOf(to, m), rec).then(function(){ return idb('del', k); }).then(function(){
          /* حافظهٔ درون‌جلسه هم باید به کلید جدید برود تا urlFor بی‌درنگ بیابد */
          if (urls.has(k)){ urls.set(keyOf(to, m), urls.get(k)); urls.delete(k); }
        });
      }).catch(function(){});
    }));
  }

  /* data-URL فشرده برای جا شدن در رکورد زمین (ga_course_geo) */
  function toCompact(blob, maxChars){
    return new Promise(function(res){
      try{
        var fr=new FileReader();
        fr.onload=function(){
          var u=fr.result;
          if(!maxChars||u.length<=maxChars)return res(u);
          var im=new Image();
          im.onload=function(){
            var dims=[1536,1280,1024,860,700];
            var i=0;
            (function step(){
              if(i>=dims.length)return res(null);
              var d=dims[i++];
              var sc=Math.min(1,d/Math.max(im.naturalWidth,im.naturalHeight));
              var w=Math.max(1,Math.round(im.naturalWidth*sc)),h=Math.max(1,Math.round(im.naturalHeight*sc));
              var cv=document.createElement('canvas');cv.width=w;cv.height=h;
              var cx=cv.getContext('2d');cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';cx.drawImage(im,0,0,w,h);
              var out=cv.toDataURL('image/webp',0.74);
              if(out.indexOf('data:image/webp')!==0)out=cv.toDataURL('image/jpeg',0.68);
              if(out.length<=maxChars)return res(out);
              step();
            })();
          };
          im.onerror=function(){res(null);};
          im.src=u;
        };
        fr.onerror=function(){res(null);};
        fr.readAsDataURL(blob);
      }catch(e){res(null);}
    });
  }

  window.EarthShot = {
    expand: expand,
    captureFor: captureFor,
    ensure: ensure,
    urlFor: urlFor,
    rekey: rekey,
    meta: function(key, mode){ return idb('get', keyOf(key, mode)).then(function(r){ return r && r.meta; }).catch(function(){ return null; }); },
    pickZoomFor: function(b){ return pickZoom(expand(b) || b); },
    toCompact: toCompact
  };
})();
