/* ═══════════════════════════════════════════════════════════════════
   پات کلاب • هویت ابری پنل آکادمی (GA_AUTH) — 2026-10-07
   ─────────────────────────────────────────────────────────────────
   • ورود با Supabase Auth: نام کاربری ← ایمیل مصنوعی <user>@members.puttclub.ir
     (یا خودِ ایمیل اگر @ داشته باشد). رمز هرگز در مرورگر ذخیره نمی‌شود.
   • نقش/نام/بازیکن از جدول ga_accounts (RLS: هر کس فقط ردیف خودش) خوانده می‌شود.
   • داخل adminpanel.puttclub.ir: هویت و توکن از پوستهٔ واردشدهٔ مدیر (window.parent.__PUTT_ADMIN).
   • نشست در localStorage «pc_auth_v1» (بدون پیشوند ga_ → هرگز با ابر همگام نمی‌شود).
   • مدیریت حساب‌ها (فقط adminpanel): تابع ga-accounts با JWT مدیر.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DEF = { url: 'https://iultwqtzvrysugfxwshw.supabase.co', key: 'sb_publishable_058vN6QjD4sUC9Mam5izUg__vjKt9d0' };
  var DOMAIN = 'members.puttclub.ir';
  var KEY = 'pc_auth_v1';
  var inBrowser = typeof window !== 'undefined';

  function cfg() {
    try {
      var o = JSON.parse(localStorage.getItem('ga_cloud_cfg') || 'null');
      if (o && typeof o === 'object') return { url: String(o.url || DEF.url).replace(/\/+$/, ''), key: o.key || DEF.key };
    } catch (e) {}
    return DEF;
  }
  function shell() {
    try {
      if (window.__PUTT_IN_ADMIN && window.parent !== window && window.parent.__PUTT_ADMIN) return window.parent.__PUTT_ADMIN;
    } catch (e) {}
    return null;
  }
  function readSaved() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function writeSaved(o) { try { if (o) localStorage.setItem(KEY, JSON.stringify(o)); else localStorage.removeItem(KEY); } catch (e) {} }

  var st = { session: null, profile: null, ready: false };
  var listeners = [];
  function emit() {
    listeners.forEach(function (f) { try { f(api.profile()); } catch (e) {} });
    try { window.dispatchEvent(new CustomEvent('ga-auth-changed', { detail: { user: st.profile ? st.profile.user : null } })); } catch (e) {}
  }

  function req(path, init) {
    var c = cfg();
    init = init || {};
    var h = { apikey: c.key, 'Content-Type': 'application/json' };
    if (init.token) h.Authorization = 'Bearer ' + init.token;
    return fetch(c.url + path, { method: init.method || 'GET', headers: h, body: init.body ? JSON.stringify(init.body) : undefined, cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
          if (!r.ok) {
            var err = new Error((j && (j.err || j.msg || j.error_description || j.message)) || ('HTTP ' + r.status));
            err.status = r.status; err.code = j && (j.code || j.error_code); throw err;
          }
          return j;
        });
      });
  }
  function normSession(raw) {
    var exp = raw.expires_at ? Number(raw.expires_at) * 1000 : Date.now() + Math.max(0, Number(raw.expires_in || 3600)) * 1000;
    return { access_token: raw.access_token, refresh_token: raw.refresh_token, expires_at: exp, user: { id: raw.user && raw.user.id, email: raw.user && raw.user.email } };
  }
  function emailOf(identifier) {
    var u = String(identifier || '').trim().toLowerCase();
    return u.indexOf('@') >= 0 ? u : (u + '@' + DOMAIN);
  }
  function profileFromRow(r) {
    return { id: r.legacy_id, user: r.username, name: r.name || r.username, role: r.role, main: !!r.main, active: r.active !== false, pid: r.pid == null ? null : r.pid, cloud: true };
  }
  function fetchProfile(session) {
    return req('/rest/v1/ga_accounts?select=legacy_id,username,name,role,main,active,pid&user_id=eq.' + encodeURIComponent(session.user.id), { token: session.access_token })
      .then(function (rows) { return Array.isArray(rows) && rows[0] ? profileFromRow(rows[0]) : null; });
  }

  var refreshing = null, timer = null;
  function schedule() {
    clearTimeout(timer);
    if (!st.session || !st.session.expires_at) return;
    var wait = Math.max(15000, st.session.expires_at - Date.now() - 120000);
    timer = setTimeout(function () { refresh().catch(function () {}); }, wait);
  }
  function refresh() {
    if (refreshing) return refreshing;
    var s = st.session;
    if (!s || !s.refresh_token) return Promise.reject(new Error('no session'));
    refreshing = req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } })
      .then(function (raw) {
        st.session = normSession(raw);
        writeSaved({ session: st.session, profile: st.profile });
        schedule();
        return st.session.access_token;
      }, function (e) {
        if (e && (e.status === 400 || e.status === 401 || e.status === 403)) { /* نشست باطل/حساب غیرفعال */
          st.session = null; st.profile = null; writeSaved(null); emit();
        }
        throw e;
      })
      .then(function (t) { refreshing = null; return t; }, function (e) { refreshing = null; throw e; });
    return refreshing;
  }

  /* ── راه‌اندازی: نشست ذخیره‌شده را تازه کن و نقش را دوباره از سرور بخوان ── */
  var readyResolve;
  var readyP = new Promise(function (res) { readyResolve = res; });
  function boot() {
    var sh = shell();
    if (sh) {
      st.profile = { id: 0, user: String(sh.email || 'admin').toLowerCase(), name: 'مدیر سیستم', role: 'admin', main: true, active: true, pid: null, console: true };
      st.ready = true; readyResolve(true); return;
    }
    var saved = readSaved();
    if (!saved || !saved.session || !saved.session.refresh_token) { st.ready = true; readyResolve(false); return; }
    st.session = saved.session; st.profile = saved.profile || null;
    var p = (st.session.expires_at - Date.now() < 120000) ? refresh() : Promise.resolve(st.session.access_token);
    p.then(function () { return fetchProfile(st.session); })
      .then(function (prof) {
        if (!prof || !prof.active) { var t = st.session && st.session.access_token; st.session = null; st.profile = null; writeSaved(null); if (t) req('/auth/v1/logout', { method: 'POST', token: t }).catch(function () {}); return false; }
        st.profile = prof; writeSaved({ session: st.session, profile: prof }); schedule(); return true;
      })
      .catch(function (e) {
        /* شبکه قطع است ولی نشست باطل نشده → با پروفایل ذخیره‌شده ادامه (خواندن محلی)؛ ارسال‌ها بعداً با توکن تازه */
        if (st.session && st.profile) { schedule(); return true; }
        return false;
      })
      .then(function (ok) { st.ready = true; readyResolve(!!ok); });
  }

  var api = {
    DOMAIN: DOMAIN,
    mode: function () { return shell() ? 'adminpanel' : 'panel'; },
    ready: function () { return readyP; },
    isReady: function () { return st.ready; },
    profile: function () { return st.profile ? Object.assign({}, st.profile) : null; },
    user: function () { return st.profile ? st.profile.user : null; },
    /* توکن فعلی (همگام) — برای هدر درخواست‌ها */
    token: function () {
      var sh = shell();
      if (sh) { try { return typeof sh.getToken === 'function' ? (sh.getToken() || null) : null; } catch (e) { return null; } }
      return st.session ? st.session.access_token : null;
    },
    /* توکنِ معتبر (در صورت نزدیک‌بودن انقضا تازه می‌شود) */
    fresh: function () {
      var sh = shell();
      if (sh) return Promise.resolve(api.token());
      return readyP.then(function () {
        if (!st.session) return null;
        if (st.session.expires_at - Date.now() < 60000) return refresh().catch(function () { return st.session ? st.session.access_token : null; });
        return st.session.access_token;
      });
    },
    signIn: function (identifier, password) {
      if (shell()) return Promise.resolve(api.profile());
      var email = emailOf(identifier);
      return req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: String(password || '') } })
        .catch(function (e) {
          var m = String(e && e.message || '');
          if (/banned/i.test(m)) throw new Error('این حساب غیرفعال است.');
          if (e && (e.status === 400 || e.status === 401)) throw new Error('نام کاربری یا رمز عبور اشتباه است — دوباره تلاش کنید');
          throw new Error('اتصال به سرور ورود برقرار نشد؛ اینترنت را بررسی کنید.');
        })
        .then(function (raw) {
          var session = normSession(raw);
          return fetchProfile(session).then(function (prof) {
            if (!prof) {
              req('/auth/v1/logout', { method: 'POST', token: session.access_token }).catch(function () {});
              throw new Error('این حساب در پنل آکادمی تعریف نشده است؛ با مدیر آکادمی تماس بگیرید.');
            }
            if (!prof.active) throw new Error('این حساب غیرفعال است.');
            st.session = session; st.profile = prof;
            writeSaved({ session: session, profile: prof });
            schedule(); emit();
            return api.profile();
          });
        });
    },
    signOut: function () {
      var t = st.session && st.session.access_token;
      st.session = null; st.profile = null; writeSaved(null); clearTimeout(timer); emit();
      if (t) return req('/auth/v1/logout', { method: 'POST', token: t }).catch(function () {});
      return Promise.resolve();
    },
    onChange: function (f) { if (typeof f === 'function') listeners.push(f); }
  };

  /* ═══ مدیریت حساب‌ها (فقط داخل adminpanel؛ سرور هم دوباره بررسی می‌کند) ═══ */
  var acc = { list: [], loaded: false, queue: Promise.resolve(), busy: 0, err: '' };
  function strip(r) { var o = Object.assign({}, r); delete o.pass; return o; }
  function call(action, body) {
    return api.fresh().then(function (t) {
      if (!t) throw new Error('نشست مدیر پیدا نشد؛ دوباره وارد پنل مدیریت شوید.');
      return req('/functions/v1/ga-accounts', { method: 'POST', token: t, body: Object.assign({ action: action }, body || {}) });
    });
  }
  function accChanged() { try { window.dispatchEvent(new CustomEvent('ga-accounts-changed', { detail: { count: acc.list.length, err: acc.err } })); } catch (e) {} }
  function load() {
    return call('list').then(function (r) {
      acc.list = (r && r.accounts || []).map(strip); acc.loaded = true; acc.err = '';
      accChanged(); return acc.list.slice();
    });
  }
  function toast(m, c) { try { if (window.APP && APP.toast) APP.toast(m, c); } catch (e) {} }
  function randomPass() {
    var chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%', b = new Uint8Array(16);
    try { crypto.getRandomValues(b); } catch (e) { for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
    return Array.prototype.map.call(b, function (x) { return chars[x % chars.length]; }).join('');
  }
  /* save(arr): همان رابط قدیمی APP.users.save — تفاوت با فهرست فعلی به عملیات سرور تبدیل می‌شود.
     فهرست محلی بلافاصله به‌روز می‌شود (بدون رمز) و پس از پایان صف، از سرور تازه خوانده می‌شود. */
  function save(arr) {
    if (!Array.isArray(arr)) return;
    var prev = {}, next = {}, ops = [];
    acc.list.forEach(function (r) { prev[r.id] = r; });
    arr.forEach(function (r) { if (r && r.id != null) next[r.id] = r; });
    arr.forEach(function (r) {
      if (!r || r.id == null) return;
      var p = prev[r.id];
      if (!p) {
        ops.push(['create', { id: +r.id, user: String(r.user || '').trim().toLowerCase(), name: r.name || '', role: r.role, pid: r.pid == null ? null : +r.pid, pass: r.pass || randomPass(), active: r.active !== false, main: !!r.main }, r.name || r.user]);
        return;
      }
      var patch = {}, n = 0;
      ['user', 'name', 'role', 'active', 'pid'].forEach(function (f) {
        var a = p[f], b = r[f];
        if (f === 'user') { a = String(a || '').toLowerCase(); b = String(b || '').trim().toLowerCase(); }
        if (f === 'active') { a = a !== false; b = b !== false; }
        if (f === 'pid') { a = a == null ? null : +a; b = b == null || b === '' ? null : +b; }
        if (a !== b) { patch[f] = b; n++; }
      });
      if (n) ops.push(['update', Object.assign({ id: +r.id }, patch), r.name || r.user]);
      if (r.pass) ops.push(['password', { id: +r.id, pass: r.pass }, r.name || r.user]);
    });
    Object.keys(prev).forEach(function (id) { if (!next[id]) ops.push(['delete', { id: +id }, prev[id].name || prev[id].user]); });
    acc.list = arr.map(strip);
    arr.forEach(function (r) { if (r && r.pass) delete r.pass; });
    if (!ops.length) return;
    acc.busy++;
    acc.queue = acc.queue.then(function () {
      var failed = 0;
      return ops.reduce(function (p, op) {
        return p.then(function () {
          return call(op[0], op[1]).catch(function (e) {
            failed++;
            toast('ذخیرهٔ حساب «' + op[2] + '» در سرور انجام نشد: ' + (e && e.message || e), 'red');
          });
        });
      }, Promise.resolve()).then(function () {
        return load().catch(function (e) { acc.err = String(e && e.message || e); accChanged(); });
      }).then(function () { if (!failed) toast('حساب‌ها در سرور ذخیره شدند ✓', 'green'); });
    }).then(function () { acc.busy--; }, function () { acc.busy--; });
  }
  api.accounts = {
    list: function () { return acc.list.map(function (r) { return Object.assign({}, r); }); },
    loaded: function () { return acc.loaded; },
    load: load,
    save: save,
    call: call,
    pending: function () { return acc.busy; },
    idle: function () { return acc.queue; },
    error: function () { return acc.err; },
    randomPass: randomPass
  };

  if (inBrowser) {
    window.GA_AUTH = api;
    boot();
  }
})();
