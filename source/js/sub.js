/* ═══════════════════════════════════════════════════════════════════
   پات کلاب — اشتراک یوزر (جدا از بازیکن)
   User ⇄ Subscription ⇄ Plan
   بازیکن می‌تواند در دیتا باشد بدون یوزر/اشتراک.
   ورود به پنل فقط با یوزر فعال + اشتراک معتبر.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PLANS_KEY = 'ga_plans';
  var CYCLES_KEY = 'ga_billing_cycles';
  var FEAT_KEY = 'ga_plan_features';
  var SUBS_KEY = 'ga_subscriptions';

  var PLAN_ORDER = ['trial', 'starter', 'professional', 'business', 'enterprise'];
  var PLAN_DEF = {
    trial:          { code: 'trial',          nameEn: 'Free Trial',    nameFa: 'رایگان' },
    starter:        { code: 'starter',        nameEn: 'Starter',       nameFa: 'استارتر' },
    professional:   { code: 'professional',   nameEn: 'Professional',  nameFa: 'حرفه‌ای' },
    business:       { code: 'business',       nameEn: 'Business',      nameFa: 'بیزینس' },
    enterprise:     { code: 'enterprise',     nameEn: 'Enterprise',    nameFa: 'اینترپرایز' }
  };
  /* مدت‌ها — تخفیف پیش‌فرض همان اعداد قبلی؛ ادمین در تنظیمات عوض می‌کند */
  var CYCLE_DEF = [
    { months: 1,  discount: 0 },
    { months: 3,  discount: 10 },
    { months: 6,  discount: 20 },
    { months: 12, discount: 30 }
  ];
  var PAGE_KEYS = [
    ['memberzone', 'بخش اعضا'],
    ['cmd',        'فرماندهی'],
    ['race',       'رقابت فصل'],
    ['player',     'مرکز بازیکن'],
    ['match',      'فرماندهی مسابقه'],
    ['course',     'هوش زمین'],
    ['records',    'رکوردها'],
    ['cal',        'تقویم فصل'],
    ['tv',         'نمایش تلویزیونی'],
    ['battle',     'میدان نبرد'],
    ['academy',    'پنل آکادمی'],
    ['avatarland', 'سرزمین آواتارها'],
    ['mgmt',       'پنل مدیریت'],
    ['users',      'یوزرها'],
    ['subs',       'اشتراک‌ها'],
    ['settings',   'تنظیمات نمایش'],
    ['messages',   'ارسال پیام']
  ];

  function jread(k, d) {
    try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : (d || null); } catch (e) { return d || null; }
  }
  function jwrite(k, o) { try { localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} }
  function fa(n) { return (window.Data && Data.fa) ? Data.fa(n) : String(n); }
  function faNum(n, d) { return (window.Data && Data.faNum) ? Data.faNum(n, d) : String(n); }

  function loadPlans() {
    var o = jread(PLANS_KEY, {});
    var out = {};
    PLAN_ORDER.forEach(function (c) {
      var d = PLAN_DEF[c];
      var p = (o && o[c]) || {};
      out[c] = {
        code: c,
        nameEn: p.nameEn || d.nameEn,
        nameFa: p.nameFa || d.nameFa,
        monthly: (p.monthly != null && p.monthly !== '') ? +p.monthly : 0
      };
    });
    return out;
  }
  function savePlans(o) { jwrite(PLANS_KEY, o); }

  function loadCycles() {
    var a = jread(CYCLES_KEY, null);
    if (!Array.isArray(a) || !a.length) return CYCLE_DEF.map(function (x) { return { months: x.months, discount: +x.discount }; });
    return a.map(function (x) {
      return { months: +x.months || 1, discount: Math.max(0, Math.min(100, +x.discount || 0)) };
    }).filter(function (x) { return x.months > 0; });
  }
  function saveCycles(a) { jwrite(CYCLES_KEY, a); }

  function emptyFeat() {
    var f = {};
    PAGE_KEYS.forEach(function (p) { f[p[0]] = true; });
    return f;
  }
  function loadFeatures() {
    var o = jread(FEAT_KEY, {});
    var out = {};
    PLAN_ORDER.forEach(function (c) {
      var src = (o && o[c]) || {};
      var f = emptyFeat();
      PAGE_KEYS.forEach(function (p) {
        if (src[p[0]] === false) f[p[0]] = false;
        else f[p[0]] = true;
      });
      out[c] = f;
    });
    return out;
  }
  function saveFeatures(o) { jwrite(FEAT_KEY, o); }
  function featuresOf(plan) {
    var all = loadFeatures();
    return all[plan] || all.professional || emptyFeat();
  }

  function list() {
    var a = jread(SUBS_KEY, []);
    return Array.isArray(a) ? a : [];
  }
  function saveList(a) { jwrite(SUBS_KEY, a); }

  function ukey(u) { return String(u || '').toLowerCase(); }

  function of(user) {
    var k = ukey(user);
    var mine = list().filter(function (s) { return ukey(s.user) === k; })
      .sort(function (a, b) { return String(b.start_date || '').localeCompare(String(a.start_date || '')); });
    return mine[0] || null;
  }

  function addMonthsISO(iso, n) {
    var s = String(iso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      var d0 = new Date();
      s = d0.toISOString().slice(0, 10);
    }
    var d = new Date(s + 'T12:00:00');
    var day = d.getDate();
    d.setMonth(d.getMonth() + (+n || 1));
    if (d.getDate() !== day) d.setDate(0);
    return d.toISOString().slice(0, 10);
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function daysLeft(end) {
    if (!end) return 0;
    var e = new Date(String(end).slice(0, 10) + 'T23:59:59');
    return Math.ceil((e - new Date()) / 86400000);
  }

  function liveStatus(sub) {
    if (!sub) return 'none';
    if (sub.status === 'canceled') return 'canceled';
    var d = daysLeft(sub.end_date);
    if (d < 0) return 'expired';
    if (sub.status === 'trial' || sub.plan === 'trial') return 'trial';
    if (sub.status === 'past_due') return 'past_due';
    return 'active';
  }

  function isAllowed(user) {
    /* مدیر اصلی قفل نمی‌شود تا بتواند اشتراک را تمدید کند */
    try {
      if (window.APP && APP.users && APP.users.isMain && APP.users.isMain(user)) return true;
      var rec = window.APP && APP.users && APP.users.rec ? APP.users.rec(user) : null;
      if (rec && rec.main) return true;
    } catch (e) {}
    var sub = of(user);
    var st = liveStatus(sub);
    return st === 'active' || st === 'trial';
  }

  function canPage(user, page) {
    if (!page) return true;
    try {
      var rec = window.APP && APP.users && APP.users.rec ? APP.users.rec(user) : null;
      if (rec && rec.main) return true;
    } catch (e) {}
    var sub = of(user);
    var plan = (sub && sub.plan) || 'trial';
    var f = featuresOf(plan);
    if (f[page] === false) return false;
    return true;
  }

  function priceOf(plan, months) {
    var p = loadPlans()[plan] || loadPlans().professional;
    var monthly = +p.monthly || 0;
    var cyc = loadCycles().find(function (x) { return +x.months === +months; });
    var disc = cyc ? (+cyc.discount || 0) : 0;
    var n = +months || 1;
    var gross = monthly * n;
    var pay = Math.round(gross * (1 - disc / 100));
    return { monthly: monthly, months: n, discount: disc, gross: gross, pay: pay };
  }

  function endFa(iso) {
    try {
      if (!window.Data) return String(iso || '');
      var d = Data.dateFrom(String(iso).slice(0, 10));
      var j = Data.jalaliInfo(d);
      return fa(j.dd) + ' ' + j.monthFa + ' ' + fa(j.yy);
    } catch (e) { return String(iso || ''); }
  }

  function view(user) {
    var sub = of(user);
    var plans = loadPlans();
    var plan = sub ? (plans[sub.plan] || PLAN_DEF[sub.plan] || PLAN_DEF.professional) : null;
    var st = liveStatus(sub);
    var days = sub ? daysLeft(sub.end_date) : 0;
    var stFa = { none: 'بدون اشتراک', expired: 'منقضی', canceled: 'لغو شده', past_due: 'در انتظار پرداخت', trial: 'آزمایشی', active: 'فعال' }[st] || st;
    var on = st === 'active' || st === 'trial';
    return {
      sub: sub,
      plan: sub ? sub.plan : null,
      nameEn: plan ? plan.nameEn : '—',
      nameFa: plan ? plan.nameFa : '—',
      status: st,
      statusFa: stFa,
      on: on,
      days: days,
      endFa: sub ? endFa(sub.end_date) : '—',
      cycle: sub ? (+sub.billing_cycle || 1) : 1
    };
  }

  function upsert(rec) {
    var a = list();
    var k = ukey(rec.user);
    var i = a.findIndex(function (s) { return ukey(s.user) === k; });
    rec.user = k;
    if (!rec.id) rec.id = 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    if (i >= 0) a[i] = Object.assign({}, a[i], rec);
    else a.push(rec);
    saveList(a);
    return rec;
  }

  function assign(user, opt) {
    opt = opt || {};
    var plan = opt.plan || 'trial';
    var months = +opt.billing_cycle || +opt.months || 1;
    var start = opt.start_date || todayISO();
    var end = opt.end_date || addMonthsISO(start, months);
    var st = opt.status;
    if (!st) st = (plan === 'trial') ? 'trial' : 'active';
    return upsert({
      user: user,
      user_id: opt.user_id || null,
      plan: plan,
      status: st,
      start_date: start,
      end_date: end,
      billing_cycle: months,
      auto_renew: !!opt.auto_renew,
      payment_status: opt.payment_status || 'manual'
    });
  }

  /* یوزرهای فعلی بدون اشتراک → Professional دوازده‌ماهه تا سایت زنده قفل نشود */
  function ensureSeed(users) {
    var a = list();
    var changed = false;
    (users || []).forEach(function (u) {
      if (!u || !u.user) return;
      if (a.some(function (s) { return ukey(s.user) === ukey(u.user); })) return;
      var start = todayISO();
      a.push({
        id: 'sseed-' + ukey(u.user),
        user: ukey(u.user),
        user_id: u.id || null,
        plan: 'professional',
        status: 'active',
        start_date: start,
        end_date: addMonthsISO(start, 12),
        billing_cycle: 12,
        auto_renew: false,
        payment_status: 'manual'
      });
      changed = true;
    });
    if (changed) saveList(a);
    return changed;
  }

  function paintLogin(user) {
    var box = document.getElementById('login-sub');
    if (!box) return;
    if (!user) { box.hidden = true; box.setAttribute('hidden', ''); return; }
    var v = view(user);
    if (!v.sub) { box.hidden = true; box.setAttribute('hidden', ''); return; }
    box.hidden = false; box.removeAttribute('hidden');
    var planEl = document.getElementById('login-sub-plan');
    var stEl = document.getElementById('login-sub-st');
    var daysEl = document.getElementById('login-sub-days');
    var endEl = document.getElementById('login-sub-end');
    if (planEl) planEl.textContent = v.nameEn;
    var on = v.on;
    if (stEl) stEl.innerHTML = '<span class="login-sub-dot ' + (on ? 'on' : 'off') + '"></span> ' + (on ? '🟢 فعال' : 'منقضی');
    if (daysEl) {
      if (v.days < 0) daysEl.textContent = fa(Math.abs(v.days)) + ' روز گذشته';
      else daysEl.textContent = fa(v.days) + ' روز باقی‌مانده';
    }
    if (endEl) endEl.textContent = v.endFa;
    box.classList.toggle('expired', !on);
  }

  function remainText(v) {
    if (!v || !v.sub) return 'بدون اشتراک';
    if (v.days < 0) return fa(Math.abs(v.days)) + ' روز گذشته';
    return fa(v.days) + ' روز باقی‌مانده';
  }

  function paintHud(user) {
    var el = document.getElementById('hud-sub');
    if (!el) return;
    if (!user) { el.hidden = true; return; }
    var v = view(user);
    if (!v.sub) { el.hidden = true; return; }
    el.hidden = false;
    el.classList.toggle('off', !v.on);
    var dot = document.getElementById('hud-sub-dot');
    if (dot) dot.classList.toggle('off', !v.on);
    var planEl = document.getElementById('hud-sub-plan');
    var daysEl = document.getElementById('hud-sub-days');
    if (planEl) planEl.textContent = v.nameEn;
    if (daysEl) daysEl.textContent = v.statusFa + ' · ' + remainText(v);
    el.title = v.nameEn + ' — ' + v.statusFa + ' — تمدید: ' + v.endFa;
    el.onclick = function () {
      try {
        if (window.APP && APP.go && APP.isAdmin && APP.isAdmin()) APP.go('subs');
      } catch (e) {}
    };
  }

  function paintSide(user) {
    paintHud(user);
    var el = document.getElementById('side-sub');
    if (!el) return;
    if (!user) { el.style.display = 'none'; return; }
    var v = view(user);
    if (!v.sub) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML =
      '<div class="side-sub-plan">' + v.nameEn + '</div>' +
      '<div class="side-sub-st"><span class="login-sub-dot ' + (v.on ? 'on' : 'off') + '"></span> ' + v.statusFa + '</div>' +
      '<div class="side-sub-days">' + remainText(v) + '</div>' +
      '<div class="side-sub-end">تاریخ تمدید: ' + v.endFa + '</div>';
  }

  window.GA_SUB = {
    PLAN_ORDER: PLAN_ORDER,
    PLAN_DEF: PLAN_DEF,
    PAGE_KEYS: PAGE_KEYS,
    loadPlans: loadPlans, savePlans: savePlans,
    loadCycles: loadCycles, saveCycles: saveCycles,
    loadFeatures: loadFeatures, saveFeatures: saveFeatures, featuresOf: featuresOf,
    list: list, of: of, view: view, assign: assign, upsert: upsert,
    isAllowed: isAllowed, canPage: canPage,
    priceOf: priceOf, daysLeft: daysLeft, liveStatus: liveStatus,
    addMonthsISO: addMonthsISO, todayISO: todayISO, endFa: endFa, faNum: faNum,
    ensureSeed: ensureSeed,
    paintLogin: paintLogin, paintSide: paintSide, paintHud: paintHud
  };
})();
