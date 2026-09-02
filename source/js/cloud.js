/* ═══════════════════════════════════════════════════════════════════
   GolfAcademy PRO — لایهٔ همگام‌سازی ابری (localStorage ↔ Supabase)
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
    '__ga_t': 1
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

  var state = { phase: 'off', msg: '', last: null, err: null, pulled: 0, pushed: 0 };
  var applying = false; // هنگام اعمالِ pull، نگهبانِ setItem غیرفعال است (جلوگیری از پینگ‌پنگ)

  function setPhase(p, m) {
    state.phase = p;
    if (m !== undefined) state.msg = m;
    state.last = new Date().toISOString();
    if (inBrowser) render();
  }

  /* ── دسترسی REST به Supabase (PostgREST) ────────────────────────── */
  function rest(path, init) {
    var c = cfg();
    var h = { 'apikey': c.key, 'Content-Type': 'application/json' }; // apikey تنها و کافی است (کلیدهای جدید publishable)
    init = init || {};
    Object.keys(init.headers || {}).forEach(function (k) { h[k] = init.headers[k]; });
    return fetch(c.url + '/rest/v1/' + path, {
      method: init.method || 'GET',
      headers: h,
      body: init.body || null,
      mode: 'cors',
      keepalive: !!init.keepalive
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) {
          var err = new Error((j && (j.message || j.error || j.hint)) || ('HTTP ' + r.status));
          err.status = r.status;
          err.body = j || t;
          throw err;
        }
        return j;
      });
    });
  }

  /* ── encode/decode: مقادیر localStorage رشته‌اند؛ ستون value از نوع jsonb ── */
  function encode(v) { try { return JSON.parse(v); } catch (e) { return { __raw: v }; } }
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
    if (applying) return;
    if (!k || k.indexOf(PFX) !== 0 || SKIP[k] || !hasCred()) return;
    var d = jread(DIRTY_KEY, {});
    if (!d[k]) {
      d[k] = localStamp();
      jwrite(DIRTY_KEY, d);
      schedule(3000);
    }
  }

  function installGuard() {
    if (!inBrowser) return;
    try {
      var proto = Object.getPrototypeOf(window.localStorage) || Storage.prototype;
      var origSet = proto.setItem, origDel = proto.removeItem;
      Object.defineProperty(proto, 'setItem', {
        configurable: true, writable: true,
        value: function (k, v) { origSet.call(this, k, v); try { markDirty(String(k)); } catch (e) {} }
      });
      Object.defineProperty(proto, 'removeItem', {
        configurable: true, writable: true,
        value: function (k) { origDel.call(this, k); try { markDirty(String(k)); } catch (e) {} }
      });
    } catch (e) { /* اگر قابل بازنویسی نبود، جاروب دوره‌ای جبران می‌کند */ }
  }

  var sweepCache = {};
  function sweep() {
    if (!hasCred() || applying) return;
    var L = ls();
    syncableKeys().forEach(function (k) {
      var v = L.getItem(k);
      if (sweepCache[k] !== undefined && sweepCache[k] !== v) markDirty(k);
      sweepCache[k] = v;
    });
  }
  function primeSweep() {
    var L = ls();
    sweepCache = {};
    syncableKeys().forEach(function (k) { sweepCache[k] = L.getItem(k); });
  }

  /* ── pull: اعمال دادهٔ جدیدترِ سرور روی این دستگاه ──────────────── */
  function pull() {
    if (!hasCred()) { setPhase('off', 'کانفیگ ابری کامل نیست — از پنل ☁️ تنظیم کنید'); return Promise.resolve(false); }
    setPhase('pulling');
    return rest('ga_store?select=k,v,updated_at&order=updated_at.desc&limit=500')
      .then(function (rows) {
        applying = true; // نگهبانِ محلی حین اعمال خاموش است
        try {
          var d = jread(DIRTY_KEY, {}), ts = jread(TS_KEY, {}), L = ls(), applied = 0;
          (rows || []).forEach(function (r) {
            if (!r || !r.k || SKIP[r.k]) return;
            var remoteNewer = !ts[r.k] || r.updated_at > ts[r.k];
            var localDirty = d[r.k];
            if (localDirty && localDirty >= r.updated_at) return; // محلی تازه‌تر است؛ push برنده می‌شود
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
              try { L.setItem(r.k, decode(r.v)); } catch (e) {}
              ts[r.k] = r.updated_at;
              applied++;
              if (localDirty) delete d[r.k];
            }
          });
          jwrite(DIRTY_KEY, d);
          jwrite(TS_KEY, ts);
          state.pulled += applied;
          primeSweep();
          setPhase('idle', applied ? (applied + ' کلید از ابر اعمال شد') : 'داده محلی تازه است');
          if (applied) toast(applied + ' کلید از ابر به‌روز شد', 'ok');
        } finally { applying = false; }
        return true;
      })
      .catch(function (e) {
        setPhase('error', 'خطا در کشیدن: ' + e.message);
        state.err = String(e.body || e.message);
        return false;
      });
  }

  /* ── push: ارسال صف کثیف (upsert با key به‌عنوان PK) ─────────────── */
  function push(reason) {
    if (!hasCred()) return Promise.resolve(false);
    var d = jread(DIRTY_KEY, {}), L = ls();
    var keys = Object.keys(d).filter(function (k) { return !SKIP[k]; });
    if (!keys.length) { if (reason === 'manual') setPhase('idle', 'چیزی برای ارسال نیست'); return Promise.resolve(false); }
    setPhase('pushing', keys.length + ' کلید در صف');
    var now = localStamp();
    var rows = keys.map(function (k) {
      var v = L.getItem(k);
      return { k: k, v: v === null ? { __del: 1 } : encode(v), updated_at: d[k] || now };
    });
    // توجه: ردیف حذف به‌صورت tombstone ({__del:1}) روی سرور می‌ماند تا
    // بقیهٔ دستگاه‌ها در pull بعدی آن را ببینند و کلید محلی را پاک کنند.

    return rest('ga_store', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(rows)
    }).then(function () {
      var d2 = jread(DIRTY_KEY, {});
      keys.forEach(function (k) { delete d2[k]; });
      jwrite(DIRTY_KEY, d2);
      primeSweep();
      state.pushed += keys.length;
      setPhase('idle', keys.length + ' کلید ارسال شد');
      return true;
    }).catch(function (e) {
      setPhase('error', 'خطا در ارسال: ' + e.message);
      state.err = String(e.body || e.message);
      return false;
    });
  }

  /* ── زمان‌بندی debounce + backoff در خطا ────────────────────────── */
  var timer = null, failStreak = 0;
  function schedule(ms) {
    if (!hasCred()) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      push('auto').then(function () {
        if (state.phase === 'error') {
          failStreak++;
          schedule(Math.min(120000, 5000 * Math.pow(2, Math.min(failStreak, 5))));
        } else {
          failStreak = 0;
        }
      });
    }, ms || 3000);
  }

  /* ── تست اتصال (پنل + عیب‌یابی) ─────────────────────────────────── */
  function test() {
    if (!cfg().key) return Promise.resolve({ ok: false, why: 'کلید تنظیم نشده' });
    return rest('ga_store?select=k&limit=1')
      .then(function () { return { ok: true, why: 'اتصال برقرار — ga_store پاسخ می‌دهد' }; })
      .catch(function (e) {
        var why = e.message;
        var body = String(e.body || '');
        if (e.status === 401 || /Invalid API key/i.test(body)) why = 'کلید نامعتبر است (401) — anon/publishable key صحیح را از داشبورد کپی کنید';
        else if (/Could not find the table|PGRST205/i.test(body)) why = 'جدول ga_store یافت نشد — supabase/schema.sql را در SQL Editor اجرا کنید';
        return { ok: false, why: why };
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
      case 'idle': return '#2ecc71';
      case 'pulling': case 'pushing': return '#3da9fc';
      case 'error': return '#e74c3c';
      default: return '#7f8c8d';
    }
  }
  function render() {
    if (!chip) return;
    var n = Object.keys(jread(DIRTY_KEY, {})).length;
    chip.textContent = '☁️ ' + (n ? n + ' ✉' : (state.phase === 'idle' ? 'synced' : state.phase));
    chip.style.background = phaseColor();
    chip.title = (state.msg || state.phase) + (state.last ? ' | ' + state.last : '');
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
    chip = document.createElement('div');
    chip.id = 'ga-cloud-chip';
    chip.setAttribute('dir', 'rtl');
    chip.style.cssText = 'position:fixed;bottom:12px;left:14px;z-index:99997;padding:6px 10px;border-radius:99px;font:11px Tahoma,sans-serif;color:#fff;background:#7f8c8d;cursor:pointer;user-select:none;box-shadow:0 4px 14px rgba(0,0,0,.35)';
    chip.onclick = togglePanel;
    document.body.appendChild(chip);
    render();

    panel = document.createElement('div');
    panel.id = 'ga-cloud-panel';
    panel.setAttribute('dir', 'rtl');
    panel.style.cssText = 'position:fixed;bottom:48px;left:14px;z-index:99999;width:300px;padding:14px;border-radius:14px;background:#0d1b2a;color:#e6edf3;font:12px/1.9 Tahoma,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.55);display:none';
    var c = cfg();
    panel.innerHTML =
      '<div style="font-weight:bold;margin-bottom:8px">☁️ همگام‌سازی ابری</div>' +
      '<label>Supabase URL</label><input id="gc-url" style="width:100%;box-sizing:border-box" value="' + escAttr(c.url) + '">' +
      '<label>کلید anon/publishable</label><input id="gc-key" type="password" style="width:100%;box-sizing:border-box" value="' + escAttr(c.key) + '" placeholder="sb_publishable_… یا eyJ…">' +
      '<label style="display:flex;gap:6px;align-items:center;margin:6px 0"><input id="gc-on" type="checkbox"' + (c.on ? ' checked' : '') + '> همگام‌سازی فعال باشد</label>' +
      '<div id="gc-status" style="min-height:20px;color:#9fb3c8">' + escAttr(state.msg || state.phase) + '</div>' +
      '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
      '<button id="gc-test" style="flex:1">تست اتصال</button>' +
      '<button id="gc-pull" style="flex:1">کشیدن ⇩</button>' +
      '<button id="gc-push" style="flex:1">فرستادن ⇧</button></div>' +
      '<div style="display:flex;gap:6px;margin-top:6px">' +
      '<button id="gc-save" style="flex:2;background:#1f6f43;color:#fff;border:0;padding:7px;border-radius:8px;cursor:pointer">ذخیره و اعمال</button>' +
      '<button id="gc-reset" style="flex:1;background:#444;color:#fff;border:0;padding:7px;border-radius:8px;cursor:pointer">حذف کانفیگ</button></div>';
    document.body.appendChild(panel);
    var $ = function (id) { return document.getElementById(id); };
    $('gc-test').onclick = function () {
      $('gc-status').textContent = 'در حال تست…';
      test().then(function (r) { $('gc-status').textContent = (r.ok ? '✅ ' : '⛔ ') + r.why; });
    };
    $('gc-pull').onclick = function () { pull().then(function () { $('gc-status').textContent = state.msg; }); };
    $('gc-push').onclick = function () { push('manual').then(function () { $('gc-status').textContent = state.msg; }); };
    $('gc-save').onclick = function () {
      jwrite(CFG_KEY, { url: $('gc-url').value.trim(), key: $('gc-key').value.trim(), on: $('gc-on').checked });
      $('gc-status').textContent = 'ذخیره شد — راه‌اندازی مجدد…';
      setTimeout(function () { location.reload(); }, 500);
    };
    $('gc-reset').onclick = function () { ls().removeItem(CFG_KEY); setTimeout(function () { location.reload(); }, 300); };
  }
  function togglePanel() { if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; }

  /* ── راه‌اندازی ──────────────────────────────────────────────────── */
  function init() {
    installGuard();
    if (!inBrowser) return;
    ui();
    if (!hasCred()) { setPhase('off', 'خاموش — کلید/URL تنظیم نشده (پنل ☁️)'); return; }
    primeSweep();
    pull().then(function () {
      if (Object.keys(jread(DIRTY_KEY, {})).length) schedule(800);
    });
    setInterval(sweep, 20000);
    if (window.addEventListener) {
      window.addEventListener('online', function () { push('online'); });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') push('flush'); });
      window.addEventListener('beforeunload', flushOnce);
    }
  }

  /* تلاش نهایی هنگام بستن تب: fetch با keepalive (بدون بلوکه‌کردن بستن صفحه) */
  function flushOnce() {
    try {
      if (!hasCred()) return;
      var d = jread(DIRTY_KEY, {});
      var keys = Object.keys(d).filter(function (k) { return !SKIP[k]; });
      if (!keys.length) return;
      var L = ls(), now = localStamp();
      var rows = keys.map(function (k) {
        var v = L.getItem(k);
        return { k: k, v: v === null ? { __del: 1 } : encode(v), updated_at: d[k] || now };
      });
      var c = cfg();
      fetch(c.url + '/rest/v1/ga_store', {
        method: 'POST',
        headers: {
          'apikey': c.key, 'Content-Type': 'application/json',
          'Prefer': 'return=minimal,resolution=merge-duplicates'
        },
        body: JSON.stringify(rows),
        keepalive: true,
        mode: 'cors'
      }).catch(function () {});
    } catch (e) {}
  }

  if (inBrowser) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  /* API عمومی برای دیباگ و تست‌های e2e */
  window.GA_CLOUD = {
    status: function () { return JSON.parse(JSON.stringify(state)); },
    pull: pull,
    push: push,
    test: test,
    dirty: function () { return Object.keys(jread(DIRTY_KEY, {})); },
    cfg: cfg,
    setCfg: function (url, key, on) { jwrite(CFG_KEY, { url: url, key: key, on: on !== false }); },
    clearCfg: function () { ls().removeItem(CFG_KEY); }
  };
})();
