/* ═══════════════════════════════════════════════════════════════════
   پات کلاب • Putt Club Golf Academy — لایهٔ همگام‌سازی ابری (localStorage ↔ Supabase)
   ─────────────────────────────────────────────────────────────────────
   فاز ۱: آینهٔ کلید/مقدار روی جدول ga_store با پروتکل LWW
   (Last-Write-Wins). هر کلید ga_* که در localStorage نوشته یا حذف شود،
   در «صف کثیف» ثبت و به‌صورت debounced به دیتابیس ارسال می‌شود؛
   در شروع جلسه، دادهٔ جدیدترِ سمت سرور کشیده می‌شود.
   بدون هیچ وابستگی خارجی؛ در نبودِ کانفیگ، خاموش و بی‌ضرر است.

   پیکربندی:
   • مقادیر پیش‌فرض (DEF) داخل باندل build امبد می‌شوند.
   • بدون redeploy قابل بازنویسی است: کلید ga_cloud_cfg در localStorage
     یا پنل کوچک «☁️» گوشهٔ صفحه.
   • دیباگ/اتوماسیون: window.GA_CLOUD.status() | pull() | push() | test()
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── کانفیگ پیش‌فرض (embed شده) ────────────────────────────────────
     توجه: این کلید، کلید عمومی (anon/publishable) است و برای مصرف
     سمت کلاینت طراحی شده؛ هرگز کلید service_role را اینجا نگذارید. */
  var DEF = {
    url: 'https://iultwqtzvrysugfxwshw.supabase.co',
    key: 'sb_publishable_058vN6QjD4sUC9Mam5izUg__vjKt9d0',
    on: true
  };

  var CFG_KEY = 'ga_cloud_cfg';      // بازنویسی کاربر: {url, key, on}
  var DIRTY_KEY = 'ga_cloud_dirty';  // صف کثیف: { "<key>": isoStampِ تغییر محلی }
  var TS_KEY = 'ga_cloud_ts';        // آخرین updated_atِ همگام‌شده به‌ازای هر کلید
  var PFX = 'ga_';                   // پیشوند کلیدهای کاندید همگام‌سازی

  /* کلیدهایی که هرگز sync نمی‌شوند (جلسه/سید/دستگاه‌محور/درون‌سازمانی) */
  var SKIP = {
    'ga_session': 1,
    'ga_seed_v2': 1,
    'ga_cloud_cfg': 1,
    'ga_cloud_dirty': 1,
    'ga_cloud_ts': 1,
    '__ga_t': 1,
    /* امنیت: یوزر/رمز هرگز روی ابر نرود — فقط محلی نگه داشته می‌شود */
    'ga_users': 1,
    'ga_player_users': 1
  };

  var inBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  var mem = {}; // ذخیرهٔ جایگزین برای تست هدلس (node)

  function ls() {
    try { if (inBrowser && window.localStorage) return window.localStorage; } catch (e) {}
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      key: function (i) { return Object.keys(mem)[i]; },
      get length() { return Object.keys(mem).length; }
    };
  }

  function jread(k, dflt) {
    try { var s = ls().getItem(k); return s ? JSON.parse(s) : (dflt || {}); } catch (e) { return dflt || {}; }
  }
  function jwrite(k, o) { try { ls().setItem(k, JSON.stringify(o)); } catch (e) {} }

  function cfg() {
    try {
      var o = JSON.parse(ls().getItem(CFG_KEY) || 'null');
      if (o && typeof o === 'object') return { url: o.url || DEF.url, key: o.key || DEF.key, on: o.on !== false };
    } catch (e) {}
    return { url: DEF.url, key: DEF.key, on: DEF.on !== false };
  }
  function hasCred() {
    var c = cfg();
    return !!(c.on && /^https:\/\/.+/.test(c.url) && c.key && c.key.length > 20);
  }

  var state = { phase: 'off', msg: '', last: null, err: null, errors: [], pulled: 0, pushed: 0, read: null };
  var pushFlight = null, pullFlight = null;
  var MAX_EDGE_BYTES = 2 * 1024 * 1024; // همسان با سقف UTF-8 تابع ga-sync؛ نیازمند انتشار نسخهٔ جدید تابع
  var KEEPALIVE_BYTES = 48 * 1024; // مرورگر برای کل درخواست‌های keepalive سقف حدود 64KB دارد
  var REQUEST_TIMEOUT = 25000;

  function pendingKeys() {
    return Object.keys(jread(DIRTY_KEY, {})).filter(function (k) {
      return k.indexOf(PFX) === 0 && k !== PFX && !SKIP[k];
    });
  }
  function byteLength(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    return encodeURIComponent(text).replace(/%[A-F\d]{2}/gi, 'x').length;
  }
  function queueInfo() {
    var L = ls();
    return pendingKeys().map(function (k) { return { key: k, bytes: byteLength(L.getItem(k) || 'null') }; });
  }
  function errorText(e) {
    var detail = String(e && e.message || 'خطای نامشخص');
    var key = cfg().key;
    if (key) detail = detail.split(key).join('[کلید]');
    if (e && e.code === 'TIMEOUT') return 'مهلت پاسخ سرور تمام شد؛ داده در صف محفوظ است.';
    if (e && e.network) return 'ارتباط با سرویس ارسال قطع شد؛ داده در صف محفوظ است. ' + detail;
    if (e && e.status === 413) {
      if (e.localLimit) return 'حجم درخواست از سقف ' + Math.floor(e.maxBytes / 1024) + ' KB پنل بیشتر است؛ داده در صف محفوظ است. ' + detail;
      if (e.maxBytes) return 'سرور درخواست را با سقف ' + Math.floor(e.maxBytes / 1024) + ' KB رد کرد (HTTP 413)؛ داده در صف محفوظ است. ' + detail;
      return 'سرور ga-sync درخواست را به‌دلیل محدودیت حجم رد کرد (HTTP 413)؛ سقف تابع روی Supabase باید به‌روز شود. داده در صف محفوظ است.';
    }
    return (e && e.status ? 'HTTP ' + e.status + ' — ' : '') + detail;
  }
  var applying = false; // هنگام اعمالِ pull، نگهبانِ setItem غیرفعال است (جلوگیری از پینگ‌پنگ)

  function setPhase(p, m) {
    state.phase = p;
    if (m !== undefined) state.msg = m;
    state.last = new Date().toISOString();
    if (inBrowser) render();
  }

  /* پاسخ HTTP ناموفق یا بدون تأیید صریح هرگز به‌معنی ذخیره‌شدن نیست. */
  function requestJSON(url, init) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeout = null, timedOut = false;
    if (controller) {
      init.signal = controller.signal;
      timeout = setTimeout(function () { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT);
    }
    var run = Promise.resolve().then(function () { return fetch(url, init); }).then(function (r) {
      return r.text().then(function (text) {
        var json = null;
        try { json = text ? JSON.parse(text) : null; } catch (_) {}
        if (!r.ok) {
          var e = new Error((json && (json.err || json.message || json.error || json.hint)) || ('HTTP ' + r.status));
          e.status = r.status;
          e.code = json && json.code;
          if (json && typeof json.maxBytes === 'number') e.maxBytes = json.maxBytes;
          throw e;
        }
        if (json === null && text) throw new Error('پاسخ سرور JSON معتبر نیست؛ ارسال تأیید نشد.');
        return json;
      });
    });
    return run.then(function (data) {
      clearTimeout(timeout);
      return data;
    }, function (e) {
      clearTimeout(timeout);
      if (timedOut) { e = new Error('Request timeout'); e.code = 'TIMEOUT'; }
      if (!e.status && (e.name === 'TypeError' || e.name === 'AbortError' || timedOut)) e.network = true;
      throw e;
    });
  }

  function rest(path, init) {
    var c = cfg(), h = { apikey: c.key, 'Content-Type': 'application/json' };
    init = init || {};
    Object.keys(init.headers || {}).forEach(function (k) { h[k] = init.headers[k]; });
    return requestJSON(c.url.replace(/\/+$/, '') + '/rest/v1/' + path, {
      method: init.method || 'GET', headers: h, body: init.body || null, mode: 'cors'
    });
  }

  /* ── encode/decode: مقادیر localStorage رشته‌اند؛ ستون value از نوع jsonb ── */
  function encode(v) {
    try {
      var value = JSON.parse(v);
      // JSON null در PostgREST به SQL NULL تبدیل می‌شود؛ ستون v تهی‌پذیر نیست.
      return value === null ? { __raw: String(v) } : value;
    } catch (e) { return { __raw: v }; }
  }
  function decode(v) {
    if (v && typeof v === 'object' && typeof v.__raw === 'string' && Object.keys(v).length === 1) return v.__raw;
    return JSON.stringify(v);
  }

  function localStamp() { return new Date().toISOString(); }

  function syncableKeys() {
    var out = [], L = ls();
    for (var i = 0; i < L.length; i++) {
      var k = L.key(i);
      if (k && k.indexOf(PFX) === 0 && k !== PFX && !SKIP[k]) out.push(k);
    }
    return out;
  }

  /* ── علامت‌گذاری تغییرات (نگهبان setItem/removeItem + جاروب دوره‌ای) ── */
  function markDirty(k) {
    if (applying || !k || k.indexOf(PFX) !== 0 || SKIP[k] || !hasCred()) return;
    var d = jread(DIRTY_KEY, {}), stamp = localStamp();
    // حتی دو ویرایش در یک میلی‌ثانیه باید نسخهٔ جدا داشته باشند.
    var previous = Date.parse(d[k]);
    if (Number.isFinite(previous) && Date.parse(stamp) <= previous) stamp = new Date(previous + 1).toISOString();
    d[k] = stamp;
    jwrite(DIRTY_KEY, d);
    if (!pushFlight) setPhase('pending', pendingKeys().length + ' بخش در صف ارسال');
    else render();
    schedule(3000);
  }

  function installGuard() {
    if (!inBrowser) return;
    try {
      var proto = Object.getPrototypeOf(window.localStorage) || Storage.prototype;
      var origSet = proto.setItem, origDel = proto.removeItem;
      Object.defineProperty(proto, 'setItem', {
        configurable: true, writable: true,
        value: function (k, v) {
          var before = this.getItem(k);
          origSet.call(this, k, v);
          try { if (this === window.localStorage && before !== String(v)) markDirty(String(k)); } catch (e) {}
        }
      });
      Object.defineProperty(proto, 'removeItem', {
        configurable: true, writable: true,
        value: function (k) {
          var before = this.getItem(k);
          origDel.call(this, k);
          try { if (this === window.localStorage && before !== null) markDirty(String(k)); } catch (e) {}
        }
      });
    } catch (e) { /* اگر قابل بازنویسی نبود، جاروب دوره‌ای جبران می‌کند */ }
  }

  var sweepCache = {};
  function sweep() {
    if (!hasCred() || applying) return;
    var L = ls();
    var keys = syncableKeys();
    Object.keys(sweepCache).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    keys.forEach(function (k) {
      var v = L.getItem(k);
      if (sweepCache[k] !== v) markDirty(k);
      sweepCache[k] = v;
    });
  }
  function primeSweep() {
    var L = ls();
    sweepCache = {};
    syncableKeys().forEach(function (k) { sweepCache[k] = L.getItem(k); });
  }

  /* سنگ‌قبر حذف تمرین: مرجِ union ابر آیتم پاک‌شده را برنمی‌گرداند */
  function spShotKey(x) {
    return [x && x.sid, x && x.t, x && x.pid, x && x.club, x && x.res].join('|');
  }
  function readSpTomb(L) {
    L = L || ls();
    try {
      var t = JSON.parse((L.getItem && L.getItem('ga_sp_tomb')) || '{"ses":{},"shot":{}}');
      if (!t || typeof t !== 'object') t = {};
      if (!t.ses || typeof t.ses !== 'object') t.ses = {};
      if (!t.shot || typeof t.shot !== 'object') t.shot = {};
      return t;
    } catch (e) { return { ses: {}, shot: {} }; }
  }
  function writeSpTomb(t, L) {
    L = L || ls();
    try { L.setItem('ga_sp_tomb', JSON.stringify({ ses: t.ses || {}, shot: t.shot || {} })); } catch (e) {}
  }
  function mixTombMaps(a, b) {
    var o = {};
    a = a || {}; b = b || {};
    Object.keys(a).forEach(function (k) { o[k] = a[k]; });
    Object.keys(b).forEach(function (k) {
      if (o[k] == null || b[k] > o[k]) o[k] = b[k];
    });
    return o;
  }
  function mixTombObj(a, b) {
    a = a && typeof a === 'object' ? a : {};
    b = b && typeof b === 'object' ? b : {};
    return { ses: mixTombMaps(a.ses, b.ses), shot: mixTombMaps(a.shot, b.shot) };
  }
  function isTombedShot(x, t) {
    if (!x) return true;
    t = t || readSpTomb();
    if (t.ses[String(x.sid)]) return true;
    if (t.shot[spShotKey(x)]) return true;
    return false;
  }
  function applyTombSessions(obj, t) {
    obj = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
    t = t || readSpTomb();
    Object.keys(t.ses || {}).forEach(function (id) { delete obj[id]; });
    return obj;
  }
  function applyTombShots(arr, t) {
    t = t || readSpTomb();
    return (Array.isArray(arr) ? arr : []).filter(function (x) { return !isTombedShot(x, t); });
  }
  function stripSpStorage(L) {
    L = L || ls();
    var t = readSpTomb(L);
    try {
      var ses = JSON.parse(L.getItem('ga_sp_sessions') || '{}') || {};
      L.setItem('ga_sp_sessions', JSON.stringify(applyTombSessions(ses, t)));
    } catch (e) {}
    try {
      var arr = JSON.parse(L.getItem('ga_sp_shots') || '[]') || [];
      L.setItem('ga_sp_shots', JSON.stringify(applyTombShots(arr, t)));
    } catch (e) {}
  }
  function tombShots(arr) {
    var t = readSpTomb();
    var now = Date.now();
    (arr || []).forEach(function (x) { if (x) t.shot[spShotKey(x)] = now; });
    writeSpTomb(t);
  }
  function tombSession(sid, shots) {
    var t = readSpTomb();
    var now = Date.now();
    t.ses[String(sid)] = now;
    (shots || []).forEach(function (x) { if (x) t.shot[spShotKey(x)] = now; });
    writeSpTomb(t);
  }

  /* کلیدهای ساختاری (جلسات/ضربه‌های تمرین): مرج union + سنگ‌قبر حذف */
  function mergeSpKey(k, localRaw, remoteRaw, tomb) {
    tomb = tomb || readSpTomb();
    try {
      if (k === 'ga_sp_tomb') {
        var rt = remoteRaw ? JSON.parse(typeof remoteRaw === 'string' ? remoteRaw : JSON.stringify(remoteRaw)) : {};
        var lt = localRaw ? JSON.parse(typeof localRaw === 'string' ? localRaw : JSON.stringify(localRaw)) : {};
        return JSON.stringify(mixTombObj(rt, lt));
      }
      if (!localRaw) {
        if (k === 'ga_sp_sessions') return JSON.stringify(applyTombSessions(JSON.parse(remoteRaw || '{}'), tomb));
        if (k === 'ga_sp_shots') return JSON.stringify(applyTombShots(JSON.parse(remoteRaw || '[]'), tomb));
        return remoteRaw;
      }
      if (k === 'ga_sp_sessions') {
        var a = JSON.parse(remoteRaw) || {}, b = JSON.parse(localRaw) || {};
        Object.keys(b).forEach(function (id) { a[id] = b[id]; });
        return JSON.stringify(applyTombSessions(a, tomb));
      }
      var arr = JSON.parse(remoteRaw) || [], loc = JSON.parse(localRaw) || [];
      var seen = {}, keyFn = spShotKey;
      arr.forEach(function (x) { seen[keyFn(x)] = 1; });
      (Array.isArray(loc) ? loc : []).forEach(function (x) { if (x && !seen[keyFn(x)]) arr.push(x); });
      arr.sort(function (x, y) { return (x.t || 0) - (y.t || 0); });
      return JSON.stringify(applyTombShots(arr, tomb));
    } catch (e) { return remoteRaw; }
  }
  /* ── pull: اعمال دادهٔ جدیدترِ سرور روی این دستگاه ──────────────── */
  function pull() {
    if (pullFlight) return pullFlight;
    if (pushFlight) return pushFlight.then(function () { return pull(); });
    if (!hasCred()) { setPhase('off', 'کانفیگ ابری کامل نیست — از پنل ☁️ تنظیم کنید'); return Promise.resolve(false); }
    setPhase('pulling');
    pullFlight = rest('ga_store?select=k,v,updated_at&order=updated_at.desc&limit=500')
      .then(function (rows) {
        if (!Array.isArray(rows)) throw new Error('پاسخ دریافت داده معتبر نیست.');
        applying = true; // نگهبانِ محلی حین اعمال خاموش است
        try {
          var d = jread(DIRTY_KEY, {}), ts = jread(TS_KEY, {}), L = ls(), applied = 0;
          (rows || []).forEach(function (r) {
            if (!r || !r.k || SKIP[r.k]) return;
            var remoteNewer = !ts[r.k] || r.updated_at > ts[r.k];
            var localDirty = d[r.k];
            if (localDirty) return; // خواندن، تأیید ارسال نیست؛ تغییرِ تأییدنشدهٔ گوشی را جایگزین نکن
            // ردیفِ نشان‌دارِ حذف (tombstone): کلید محلی هم پاک می‌شود
            if (r.v && typeof r.v === 'object' && r.v.__del) {
              if (remoteNewer) {
                try { L.removeItem(r.k); } catch (e) {}
                ts[r.k] = r.updated_at;
                if (localDirty) delete d[r.k];
              }
              return;
            }
            if (!remoteNewer && localDirty === undefined && L.getItem(r.k) !== null) return;
            if (remoteNewer) {
              var newVal = decode(r.v);
              if (r.k === 'ga_sp_sessions' || r.k === 'ga_sp_shots' || r.k === 'ga_sp_tomb') newVal = mergeSpKey(r.k, L.getItem(r.k), newVal);
              try { L.setItem(r.k, newVal); } catch (e) {}
              ts[r.k] = r.updated_at;
              applied++;
              if (localDirty) delete d[r.k];
            }
          });
          stripSpStorage(L);
          jwrite(DIRTY_KEY, d);
          jwrite(TS_KEY, ts);
          state.pulled += applied;
          primeSweep();
          state.read = { ok: true, at: localStamp(), message: 'خواندن از دیتابیس برقرار است.' };
          var pending = pendingKeys().length;
          setPhase(pending ? (state.errors.length ? 'error' : 'pending') : 'idle', pending
            ? ('دریافت انجام شد؛ ' + pending + ' بخش هنوز در صف ارسال است.')
            : (applied ? (applied + ' کلید از ابر اعمال شد') : 'داده محلی تازه است'));
          if (applied){
            toast(applied + ' کلید از ابر به‌روز شد', 'ok');
            /* رویداد برای صفحه‌ها: دیتا عوض شد — نمودارها/آرشیو خودشان را تازه کنند */
            try { window.dispatchEvent(new CustomEvent('ga-cloud-applied', { detail: { count: applied } })); } catch (e) {}
          }
        } finally { applying = false; }
        return true;
      })
      .catch(function (e) {
        state.err = errorText(e);
        state.read = { ok: false, at: localStamp(), message: state.err };
        setPhase('error', 'خطا در دریافت: ' + state.err);
        return false;
      }).then(function (ok) { pullFlight = null; render(); return ok; });
    return pullFlight;
  }

  /* هر درخواست فقط یک کلید؛ تأیید و حذف صف هم به‌ازای همان نسخهٔ کلید است.
     خطای یک کلید مانع ثبت کلیدهای سالم نیست. مسیر REST نوشتن fallback نیست:
     خطای اصلی ga-sync نباید با خطای مجوز جدول پوشانده یا موفق تلقی شود. */
  var SP_MERGE = { ga_sp_sessions: 1, ga_sp_shots: 1, ga_sp_tomb: 1 };
  function push(reason, options) {
    if (pushFlight) return pushFlight;
    if (pullFlight) return pullFlight.then(function () { return push(reason, options); });
    if (!hasCred()) return Promise.resolve(false);
    options = options || {};
    var keepalive = !!options.keepalive, keys = pendingKeys(), L = ls();
    if (keepalive) {
      // ادغام تمرین‌ها نیازمند GET است؛ هنگام خروج، بدون ادغام آن‌ها را بازنویسی نکن.
      keys = keys.filter(function (k) {
        return !SP_MERGE[k] && byteLength(L.getItem(k) || 'null') < KEEPALIVE_BYTES - 1024;
      }).slice(0, 1);
    }
    if (!keys.length) {
      if (reason === 'manual' && !pendingKeys().length) setPhase('idle', 'چیزی در صف ارسال نیست.');
      return Promise.resolve(false);
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPhase('error', 'اینترنت قطع است؛ ' + pendingKeys().length + ' بخش در صف محفوظ است.');
      return Promise.resolve(false);
    }
    clearTimeout(timer);
    keys.sort(function (a, b) { return a === 'ga_sp_tomb' ? -1 : b === 'ga_sp_tomb' ? 1 : 0; });
    var sent = 0, errors = state.errors.filter(function (e) { return keys.indexOf(e.key) < 0 && pendingKeys().indexOf(e.key) >= 0; }), stopped = false, remoteFlight = null;
    state.err = null;
    state.errors = errors.slice();
    setPhase('pushing', keys.length + ' بخش در صف؛ در حال ارسال…');

    function remotePractice() {
      if (!remoteFlight) {
        var wanted = keys.filter(function (k) { return SP_MERGE[k]; });
        if (wanted.indexOf('ga_sp_tomb') < 0) wanted.unshift('ga_sp_tomb');
        remoteFlight = rest('ga_store?select=k,v&k=in.(' + wanted.join(',') + ')').then(function (rows) {
          if (!Array.isArray(rows)) throw new Error('پاسخ ادغام تمرین‌ها معتبر نیست؛ ارسال متوقف شد.');
          var out = {};
          rows.forEach(function (row) { if (row && SP_MERGE[row.k]) out[row.k] = row.v; });
          return out;
        });
      }
      return remoteFlight;
    }

    function sendKey(k) {
      if (stopped) return Promise.resolve();
      var stamp, raw, row, bytes = 0;
      return (SP_MERGE[k] ? remotePractice() : Promise.resolve(null)).then(function (remote) {
        var dirty = jread(DIRTY_KEY, {});
        if (!dirty[k]) return;
        stamp = dirty[k];
        if (!Number.isFinite(Date.parse(stamp))) {
          stamp = localStamp(); dirty[k] = stamp; jwrite(DIRTY_KEY, dirty);
        }
        raw = L.getItem(k);
        row = { k: k, v: raw === null ? { __del: 1 } : encode(raw), updated_at: stamp };
        if (remote && raw !== null) {
          var tomb = mixTombObj(remote.ga_sp_tomb, readSpTomb());
          if (k === 'ga_sp_tomb') row.v = tomb;
          else row.v = encode(mergeSpKey(k, raw, decode(remote[k] || (k === 'ga_sp_shots' ? [] : {})), tomb));
        }
        var payload = JSON.stringify({ action: 'kv', rows: [row] });
        bytes = byteLength(payload);
        if (bytes > (keepalive ? KEEPALIVE_BYTES : MAX_EDGE_BYTES)) {
          var tooBig = new Error(k + ' (' + Math.ceil(bytes / 1024) + ' KB)');
          tooBig.status = 413;
          tooBig.localLimit = true;
          tooBig.maxBytes = keepalive ? KEEPALIVE_BYTES : MAX_EDGE_BYTES;
          throw tooBig;
        }
        return edgeSync([row], { keepalive: keepalive }).then(function () {
          var d2 = jread(DIRTY_KEY, {}), ts = jread(TS_KEY, {});
          ts[k] = stamp;
          jwrite(TS_KEY, ts);
          // ویرایشِ حین درخواست هرگز با پاسخ نسخهٔ قدیمی از صف حذف نمی‌شود.
          if (d2[k] === stamp && L.getItem(k) === raw) {
            if (SP_MERGE[k] && raw !== null) {
              applying = true;
              try { L.setItem(k, decode(row.v)); } finally { applying = false; }
            }
            delete d2[k];
            jwrite(DIRTY_KEY, d2);
            sweepCache[k] = L.getItem(k);
          }
          sent++;
          state.pushed++;
          setPhase('pushing', sent + ' بخش تأیید شد؛ ' + pendingKeys().length + ' بخش در صف');
        });
      }).catch(function (e) {
        var detail = { key: k, status: e.status || 0, code: e.code || '', bytes: bytes, message: errorText(e) };
        errors.push(detail);
        state.errors = errors.slice();
        state.err = detail.message;
        // در قطع شبکه/محدودیت سراسری، درخواست‌های تکراری روی LTE نفرست.
        if (e.network || e.status === 401 || e.status === 403 || e.status === 429 || e.status === 503 || e.status === 504) stopped = true;
        render();
      });
    }

    var work = Promise.resolve();
    keys.forEach(function (k) { work = work.then(function () { return sendKey(k); }); });
    pushFlight = work.then(function () {
      var n = pendingKeys().length;
      state.errors = errors;
      if (errors.length) {
        setPhase('error', (sent ? sent + ' بخش ارسال شد؛ ' : '') + n + ' بخش در صف محفوظ است. ' + errors[0].key + ': ' + errors[0].message);
      } else {
        state.err = null;
        setPhase(n ? 'pending' : 'idle', n
          ? (sent + ' بخش تأیید شد؛ ' + n + ' تغییر تازه در صف است.')
          : (sent + ' بخش ارسال و ذخیره‌شدن آن تأیید شد.'));
      }
      return !errors.length;
    }).catch(function (e) {
      state.err = errorText(e);
      setPhase('error', state.err + ' صف ارسال حذف نشده است.');
      return false;
    }).then(function (ok) {
      pushFlight = null;
      render();
      if (pendingKeys().length) {
        failStreak = ok ? 0 : failStreak + 1;
        schedule(ok ? 1200 : Math.min(120000, 5000 * Math.pow(2, Math.min(failStreak, 5))));
      } else failStreak = 0;
      return ok;
    });
    render();
    return pushFlight;
  }

  /* یک چرخهٔ ارسال در هر تب؛ تلاش مجدد با backoff و حفظ صف در خطا. */
  var timer = null, failStreak = 0;
  function schedule(ms) {
    if (!hasCred()) return;
    clearTimeout(timer);
    timer = setTimeout(function () { timer = null; push('auto'); }, typeof ms === 'number' ? ms : 3000);
  }

  /* ── تست اتصال (پنل + عیب‌یابی) ─────────────────────────────────── */
  function test() {
    if (!cfg().key) return Promise.resolve({ ok: false, why: 'کلید تنظیم نشده' });
    return rest('ga_store?select=k&limit=1').then(function (rows) {
      if (!Array.isArray(rows)) throw new Error('پاسخ خواندن از دیتابیس معتبر نیست.');
      var why = 'خواندن از دیتابیس برقرار است؛ این تست تأیید ارسال تغییرات نیست.';
      state.read = { ok: true, at: localStamp(), message: why };
      render();
      return { ok: true, why: why, pending: pendingKeys().length };
    }).catch(function (e) {
      var why = errorText(e);
      if (e.status === 401) why = 'کلید نامعتبر است (401) — کلید عمومی اتصال را بررسی کنید.';
      else if (e.code === 'PGRST205') why = 'جدول ga_store پیدا نشد؛ تنظیم پروژه باید بررسی شود.';
      state.read = { ok: false, at: localStamp(), message: why };
      render();
      return { ok: false, why: why, pending: pendingKeys().length };
    });
  }

  /* ── UI: چیپ گوشه + پنل کانفیگ ─────────────────────────────────── */
  var chip, panel, tip, tipTimer;
  function toast(msg, kind) {
    if (!inBrowser || !document.body) return;
    if (!tip) {
      tip = document.createElement('div');
      tip.setAttribute('dir', 'rtl');
      tip.style.cssText = 'position:fixed;bottom:64px;left:14px;z-index:99998;padding:8px 12px;border-radius:10px;font:12px/1.6 Tahoma,sans-serif;color:#fff;background:#123;box-shadow:0 6px 24px rgba(0,0,0,.4);max-width:70vw;pointer-events:none;display:none';
      document.body.appendChild(tip);
    }
    tip.textContent = '☁️ ' + msg;
    tip.style.background = kind === 'err' ? '#7c1f1f' : '#134e2c';
    tip.style.display = 'block';
    clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { tip.style.display = 'none'; }, 3800);
  }
  function phaseColor() {
    switch (state.phase) {
      case 'idle': return pendingKeys().length ? '#d4a737' : '#2ecc71';
      case 'pending': return '#d4a737';
      case 'pulling': case 'pushing': return '#3da9fc';
      case 'error': return '#e74c3c';
      default: return '#7f8c8d';
    }
  }
  function render() {
    var n = pendingKeys().length;
    if (chip) {
      chip.textContent = '☁️ ' + (n ? n + ' در صف' : (state.phase === 'idle' ? 'همگام' : state.phase === 'error' ? 'خطا' : 'ابر'));
      chip.style.background = phaseColor();
      chip.title = (state.msg || state.phase) + (state.last ? ' | ' + state.last : '');
      chip.setAttribute('aria-label', 'همگام‌سازی ابری؛ ' + (state.msg || state.phase));
    }
    if (!panel || !inBrowser) return;
    var status = document.getElementById('gc-status'), read = document.getElementById('gc-read-status');
    var details = document.getElementById('gc-errors'), summary = document.getElementById('gc-queue');
    if (status) { status.textContent = state.msg || state.phase; status.style.color = phaseColor(); }
    if (read) {
      read.textContent = state.read ? ((state.read.ok ? '✓ ' : '⛔ ') + state.read.message) : 'تست اتصال فقط خواندن از دیتابیس را بررسی می‌کند.';
      read.style.color = state.read && !state.read.ok ? '#ffafa5' : '#afc4ba';
    }
    if (details) {
      details.textContent = state.errors.map(function (e) { return e.key + ': ' + e.message; }).join('\n');
      details.style.display = state.errors.length ? '' : 'none';
    }
    if (summary && panel.style.display !== 'none') {
      var info = queueInfo(), bytes = info.reduce(function (sum, item) { return sum + item.bytes; }, 0);
      summary.textContent = n ? n + ' بخش در انتظار ارسال · حدود ' + Math.ceil(bytes / 1024) + ' KB' : 'صف ارسال خالی است.';
    }
    ['gc-push', 'gc-pull', 'gc-save', 'gc-reset'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.disabled = !!(pushFlight || pullFlight);
    });
  }
  function escAttr(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function authed() { try { return !!ls().getItem('ga_session'); } catch (e) { return false; } }
  var uiBuilt = false;
  function ui() {
    if (!inBrowser || !document.body) return;
    if (!uiBuilt) { if (authed()) { uiBuilt = true; uiBuild(); } }
    if (chip) {
      var show = authed();
      chip.style.display = show ? '' : 'none';
      if (!show && panel) panel.style.display = 'none';
    }
    setTimeout(ui, 3000); // ورود/خروج که از مسیر معمول app.js انجام می‌شود را دنبال می‌کند
  }
  function uiBuild() {
    chip = document.createElement('button');
    chip.id = 'ga-cloud-chip';
    chip.type = 'button';
    chip.setAttribute('dir', 'rtl');
    chip.setAttribute('aria-expanded', 'false');
    chip.setAttribute('aria-controls', 'ga-cloud-panel');
    chip.style.cssText = 'position:fixed;bottom:12px;left:14px;z-index:99997;padding:6px 10px;border:0;border-radius:99px;font-family:inherit;font-size:12px;line-height:1.6;color:#fff;background:#7f8c8d;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35)';
    chip.onclick = togglePanel;
    document.body.appendChild(chip);

    panel = document.createElement('div');
    panel.id = 'ga-cloud-panel';
    panel.setAttribute('dir', 'rtl');
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'همگام‌سازی ابری');
    panel.style.cssText = 'position:fixed;bottom:54px;left:14px;z-index:99999;width:360px;max-width:calc(100vw - 28px);max-height:calc(100vh - 110px);max-height:calc(100dvh - 110px);box-sizing:border-box;overflow:auto;overscroll-behavior:contain;padding:16px;border:1px solid #b5994a55;border-radius:16px;background:#0d1b2a;color:#e6edf3;font-family:inherit;font-size:12px;line-height:1.9;box-shadow:0 10px 40px rgba(0,0,0,.55);display:none';
    var c = cfg();
    var field = 'width:100%;box-sizing:border-box;font-size:16px;direction:ltr;text-align:left';
    var button = 'flex:1;min-height:42px;border:1px solid #b5994a55;border-radius:10px;padding:7px;cursor:pointer';
    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;font-weight:bold;margin-bottom:8px"><span>☁️ همگام‌سازی ابری</span><button id="gc-close" aria-label="بستن همگام‌سازی" style="background:none;border:0;color:inherit;min-width:36px;min-height:36px">✕</button></div>' +
      '<div id="gc-queue" style="color:#dfc374;margin-bottom:8px"></div>' +
      '<div id="gc-status" role="status" aria-live="polite" style="overflow-wrap:anywhere;min-height:24px"></div>' +
      '<div id="gc-errors" style="display:none;white-space:pre-wrap;overflow-wrap:anywhere;background:#762c2c33;border-radius:8px;padding:8px;margin-top:8px;color:#ffbcb4"></div>' +
      '<div id="gc-read-status" style="margin-top:10px;font-size:11px"></div>' +
      '<div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">' +
      '<button id="gc-test" style="' + button + '">تست اتصال</button>' +
      '<button id="gc-pull" style="' + button + '">دریافت ⇩</button>' +
      '<button id="gc-push" style="' + button + 'background:#1f6f43;color:#fff">ارسال مجدد ⇧</button></div>' +
      '<p style="font-size:11px;color:#afc4ba;margin:10px 0">تا تأیید ذخیره‌شدن، تغییرات در همین مرورگر محفوظ می‌مانند. هنگام خطا، داده‌های مرورگر را پاک نکنید.</p>' +
      '<details style="border-top:1px solid #ffffff22;padding-top:8px"><summary style="cursor:pointer">تنظیمات اتصال</summary>' +
      '<label for="gc-url">Supabase URL</label><input id="gc-url" dir="ltr" style="' + field + '" value="' + escAttr(c.url) + '">' +
      '<label for="gc-key">کلید عمومی anon/publishable</label><input id="gc-key" dir="ltr" type="password" autocomplete="off" style="' + field + '" value="' + escAttr(c.key) + '">' +
      '<label style="display:flex;gap:6px;align-items:center;margin:8px 0"><input id="gc-on" type="checkbox"' + (c.on ? ' checked' : '') + '> همگام‌سازی فعال باشد</label>' +
      '<div style="display:flex;gap:6px;margin-top:8px"><button id="gc-save" style="' + button + '">ذخیره و اعمال</button><button id="gc-reset" style="' + button + '">حذف کانفیگ</button></div></details>';
    document.body.appendChild(panel);
    var $ = function (id) { return document.getElementById(id); };
    $('gc-close').onclick = togglePanel;
    $('gc-test').onclick = function () {
      $('gc-test').disabled = true;
      $('gc-read-status').textContent = 'در حال بررسی خواندن از دیتابیس…';
      test().then(function () { $('gc-test').disabled = false; });
    };
    $('gc-pull').onclick = function () { pull(); };
    $('gc-push').onclick = function () { push('manual'); };
    $('gc-save').onclick = function () {
      jwrite(CFG_KEY, { url: $('gc-url').value.trim().replace(/\/+$/, ''), key: $('gc-key').value.trim(), on: $('gc-on').checked });
      $('gc-status').textContent = 'ذخیره شد — راه‌اندازی مجدد…';
      setTimeout(function () { location.reload(); }, 500);
    };
    $('gc-reset').onclick = function () {
      if (typeof window.confirm === 'function' && !window.confirm('فقط تنظیمات اتصال به پیش‌فرض برگردد؟ داده‌ها و صف ارسال پاک نمی‌شوند.')) return;
      ls().removeItem(CFG_KEY);
      setTimeout(function () { location.reload(); }, 300);
    };
    render();
  }
  function togglePanel() {
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    chip.setAttribute('aria-expanded', panel.style.display !== 'none' ? 'true' : 'false');
    render();
  }

  /* ── راه‌اندازی ──────────────────────────────────────────────────── */
  function init() {
    installGuard();
    if (!inBrowser) return;
    ui();
    if (!hasCred()) { setPhase('off', 'خاموش — کلید/URL تنظیم نشده (پنل ☁️)'); return; }
    primeSweep();
    pull().then(function () {
      if (pendingKeys().length) schedule(800);
    });
    setInterval(sweep, 20000);
    if (window.addEventListener) {
      window.addEventListener('online', function () { failStreak = 0; schedule(100); });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flushOnce();
        else if (pendingKeys().length) schedule(100);
      });
      window.addEventListener('pageshow', function () { if (pendingKeys().length) schedule(100); });
      window.addEventListener('pagehide', flushOnce);
      window.addEventListener('beforeunload', flushOnce);
    }
  }

  /* خروج موبایل: فقط یک درخواست کوچک و قابل تأیید. بستهٔ بزرگ keepalive
     در مرورگر رد می‌شود؛ صف باقی می‌ماند تا برگشتن صفحه و ارسال عادی. */
  function flushOnce() {
    if (!hasCred() || pushFlight || pullFlight) return;
    push('flush', { keepalive: true });
  }

  if (inBrowser) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  /* نوشتن فقط از ga-sync؛ HTTP 2xx + ok:true + تعداد دقیق ردیف‌ها لازم است. */
  function edgeRequest(payload, options) {
    var c = cfg();
    return requestJSON(c.url.replace(/\/+$/, '') + '/functions/v1/ga-sync', {
      method: 'POST',
      headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), mode: 'cors', keepalive: !!(options && options.keepalive)
    }).then(function (r) {
      if (!r || r.ok !== true) throw new Error('ga-sync: ' + (r && (r.err || r.message) || 'تأیید ذخیره دریافت نشد'));
      return r;
    });
  }
  function edgeSync(rows, options) {
    return edgeRequest({ action: 'kv', rows: rows }, options).then(function (r) {
      if (typeof r.put !== 'number' || typeof r.del !== 'number' || r.put + r.del !== rows.length) {
        var error = new Error('تعداد رکوردهای تأییدشده با درخواست یکسان نیست؛ صف حفظ شد.');
        error.code = 'BAD_ACK';
        throw error;
      }
      return r;
    });
  }

  /* dual-write: جلسهٔ بسته‌شده + ضربه‌هایش → جدول‌های واقعی sp_sessions/sp_shots (فاز ۱) */
  window.GA_SYNC = {
    shots: function (sn, arr) {
      try {
        if (!hasCred() || !sn || !sn.id) return;
        return edgeRequest({ action: 'shots', session: sn, shots: arr || [] }).then(function () { return true; }, function () { return false; });
      } catch (e) {}
    }
  };

  /* API عمومی برای دیباگ و تست‌های e2e */
  window.GA_CLOUD = {
    status: function () { var out = JSON.parse(JSON.stringify(state)); out.pending = pendingKeys().length; return out; },
    pull: pull,
    push: push,
    test: test,
    tombShots: tombShots,
    tombSession: tombSession,
    stripSp: stripSpStorage,
    dirty: pendingKeys,
    queueInfo: queueInfo,
    cfg: cfg,
    setCfg: function (url, key, on) { jwrite(CFG_KEY, { url: url, key: key, on: on !== false }); },
    clearCfg: function () { ls().removeItem(CFG_KEY); }
  };
})();
