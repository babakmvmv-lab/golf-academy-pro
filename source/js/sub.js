/* ═══════════════════════════════════════════════════════════════════
   پات کلاب — اشتراک یوزر (جدا از بازیکن)
   User ⇄ Subscription ⇄ Plan
   بازیکن می‌تواند در دیتا باشد بدون یوزر/اشتراک.
   ورود به پنل فقط با یوزر فعال + اشتراک معتبر (مدیران معاف‌اند).
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

  function recOfUser(user) {
    try {
      if (window.APP && APP.users && APP.users.rec) return APP.users.rec(user);
    } catch (e) {}
    return null;
  }
  function isStaff(user) {
    var rec = recOfUser(user);
    return !!(rec && (rec.main || rec.role === 'admin'));
  }
  function actor() {
    try {
      if (window.APP && APP.currentUser) {
        var u = APP.currentUser();
        var lab = (APP.users && APP.users.label) ? APP.users.label(u) : u;
        return { user: ukey(u), name: lab || u || 'سیستم' };
      }
    } catch (e) {}
    return { user: 'system', name: 'سیستم' };
  }
  function stamp(action, extra) {
    var a = actor();
    return Object.assign({
      at: new Date().toISOString(),
      by: a.user,
      byName: a.name,
      action: action
    }, extra || {});
  }
  function newId() {
    return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
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

  function isDeleted(sub) {
    return !!(sub && (sub.deleted_at || sub.status === 'deleted'));
  }

  function liveStatus(sub) {
    if (!sub) return 'none';
    if (isDeleted(sub)) return 'deleted';
    if (sub.status === 'canceled') return 'canceled';
    var d = daysLeft(sub.end_date);
    if (d < 0) return 'expired';
    if (sub.status === 'trial' || sub.plan === 'trial') return 'trial';
    if (sub.status === 'past_due') return 'past_due';
    return 'active';
  }

  function isLiveRec(s) {
    if (!s || isDeleted(s) || s.status === 'canceled') return false;
    var st = liveStatus(s);
    return st === 'active' || st === 'trial';
  }

  function latestLiveEnd(user) {
    var k = ukey(user);
    var end = '';
    list().forEach(function (s) {
      if (ukey(s.user) !== k || !isLiveRec(s) || !s.end_date) return;
      if (s.end_date > end) end = s.end_date;
    });
    return end;
  }
  /* شروع دورهٔ تازه = امروز، یا ته آخرین اشتراک فعال — تا مدت به زمان باقی‌مانده اضافه شود */
  function nextStart(user) {
    var today = todayISO();
    var end = latestLiveEnd(user);
    if (end && end > today) return end;
    return today;
  }

  function of(user) {
    var k = ukey(user);
    var mine = list().filter(function (s) { return ukey(s.user) === k && !isDeleted(s); });
    var live = mine.filter(isLiveRec).sort(function (a, b) {
      return String(b.end_date || '').localeCompare(String(a.end_date || ''));
    });
    if (live[0]) return live[0];
    mine.sort(function (a, b) { return String(b.start_date || '').localeCompare(String(a.start_date || '')); });
    return mine[0] || null;
  }

  function listOf(user) {
    var k = ukey(user);
    return list().filter(function (s) { return ukey(s.user) === k; }).sort(function (a, b) {
      return String(b.created_at || b.start_date || '').localeCompare(String(a.created_at || a.start_date || ''));
    });
  }

  function getById(id) {
    return list().find(function (s) { return s.id === id; }) || null;
  }

  function isAllowed(user) {
    if (isStaff(user)) return true;
    var sub = of(user);
    var st = liveStatus(sub);
    return st === 'active' || st === 'trial';
  }

  function canPage(user, page) {
    if (!page) return true;
    if (isStaff(user)) return true;
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

  function atFa(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      var datePart = endFa(d.toISOString().slice(0, 10));
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      return datePart + ' ' + fa(hh) + ':' + fa(mm);
    } catch (e) { return String(iso); }
  }

  function statusFaOf(st) {
    return { none: 'بدون اشتراک', expired: 'منقضی', canceled: 'لغو شده', past_due: 'در انتظار پرداخت', trial: 'آزمایشی', active: 'فعال', deleted: 'حذف‌شده' }[st] || st;
  }

  function view(user) {
    if (isStaff(user)) {
      return {
        sub: null, plan: null, nameEn: 'فعال', nameFa: 'فعال',
        status: 'active', statusFa: 'فعال', on: true, days: 0, endFa: '—', cycle: 0, staff: true
      };
    }
    var sub = of(user);
    var plans = loadPlans();
    var plan = sub ? (plans[sub.plan] || PLAN_DEF[sub.plan] || PLAN_DEF.professional) : null;
    var st = liveStatus(sub);
    var days = sub ? daysLeft(sub.end_date) : 0;
    var on = st === 'active' || st === 'trial';
    return {
      sub: sub,
      plan: sub ? sub.plan : null,
      nameEn: plan ? plan.nameEn : '—',
      nameFa: plan ? plan.nameFa : '—',
      status: st,
      statusFa: statusFaOf(st),
      on: on,
      days: days,
      endFa: sub ? endFa(sub.end_date) : '—',
      cycle: sub ? (+sub.billing_cycle || 1) : 1,
      staff: false
    };
  }

  function viewRec(sub) {
    if (!sub) return null;
    var plans = loadPlans();
    var plan = plans[sub.plan] || PLAN_DEF[sub.plan] || PLAN_DEF.professional;
    var st = liveStatus(sub);
    return {
      rec: sub,
      nameEn: plan.nameEn,
      nameFa: plan.nameFa,
      status: st,
      statusFa: statusFaOf(st),
      on: st === 'active' || st === 'trial',
      days: daysLeft(sub.end_date),
      startFa: endFa(sub.start_date),
      endFa: endFa(sub.end_date)
    };
  }

  function assign(user, opt) {
    opt = opt || {};
    var a = actor();
    var plan = opt.plan || 'trial';
    var months = +opt.billing_cycle || +opt.months || 1;
    var start = opt.start_date || nextStart(user);
    var end = opt.end_date || addMonthsISO(start, months);
    var st = opt.status;
    if (!st) st = (plan === 'trial') ? 'trial' : 'active';
    var rec = {
      id: newId(),
      user: ukey(user),
      user_id: opt.user_id || null,
      plan: plan,
      status: st,
      start_date: start,
      end_date: end,
      billing_cycle: months,
      auto_renew: !!opt.auto_renew,
      payment_status: opt.payment_status || 'manual',
      created_at: new Date().toISOString(),
      created_by: a.user,
      created_by_name: a.name,
      events: [stamp('create', { plan: plan, months: months, start: start, end: end })]
    };
    var all = list();
    all.push(rec);
    saveList(all);
    return rec;
  }

  function updateById(id, patch) {
    var a = actor();
    var all = list();
    var i = all.findIndex(function (s) { return s.id === id; });
    if (i < 0) return null;
    if (isDeleted(all[i])) return all[i];
    var before = {
      plan: all[i].plan, start_date: all[i].start_date, end_date: all[i].end_date,
      billing_cycle: all[i].billing_cycle, status: all[i].status
    };
    all[i] = Object.assign({}, all[i], patch, {
      updated_at: new Date().toISOString(),
      updated_by: a.user,
      updated_by_name: a.name
    });
    if (!all[i].events) all[i].events = [];
    all[i].events.push(stamp('edit', {
      before: before,
      after: {
        plan: all[i].plan, start_date: all[i].start_date, end_date: all[i].end_date,
        billing_cycle: all[i].billing_cycle, status: all[i].status
      }
    }));
    saveList(all);
    return all[i];
  }

  function softDelete(id, reason) {
    reason = String(reason || '').trim();
    if (!reason) return { ok: false, err: 'دلیل حذف الزامی است.' };
    var a = actor();
    var all = list();
    var i = all.findIndex(function (s) { return s.id === id; });
    if (i < 0) return { ok: false, err: 'اشتراک پیدا نشد.' };
    if (isDeleted(all[i])) return { ok: true, rec: all[i] };
    all[i].status = 'deleted';
    all[i].deleted_at = new Date().toISOString();
    all[i].deleted_by = a.user;
    all[i].deleted_by_name = a.name;
    all[i].delete_reason = reason;
    if (!all[i].events) all[i].events = [];
    all[i].events.push(stamp('delete', { reason: reason }));
    saveList(all);
    return { ok: true, rec: all[i] };
  }

  function ensureSeed(users) {
    var a = list();
    var changed = false;
    (users || []).forEach(function (u) {
      if (!u || !u.user) return;
      if (u.main || u.role === 'admin') return;
      if (a.some(function (s) { return ukey(s.user) === ukey(u.user); })) return;
      var start = todayISO();
      var ac = { user: 'system', name: 'سیستم' };
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
        payment_status: 'manual',
        created_at: new Date().toISOString(),
        created_by: ac.user,
        created_by_name: ac.name,
        events: [{ at: new Date().toISOString(), by: ac.user, byName: ac.name, action: 'create', plan: 'professional', months: 12 }]
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
    if (isStaff(user)) {
      box.hidden = false; box.removeAttribute('hidden');
      box.classList.remove('expired');
      var p0 = document.getElementById('login-sub-plan');
      var s0 = document.getElementById('login-sub-st');
      var d0 = document.getElementById('login-sub-days');
      var e0 = document.getElementById('login-sub-end');
      if (p0) p0.textContent = 'فعال';
      if (s0) s0.innerHTML = '<span class="login-sub-dot on"></span> 🟢 فعال';
      if (d0) d0.textContent = '';
      if (e0) e0.textContent = '';
      return;
    }
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
    var planEl = document.getElementById('hud-sub-plan');
    var daysEl = document.getElementById('hud-sub-days');
    var dot = document.getElementById('hud-sub-dot');
    if (isStaff(user)) {
      el.hidden = false;
      el.classList.remove('off');
      if (dot) dot.classList.remove('off');
      if (planEl) planEl.textContent = 'فعال';
      if (daysEl) { daysEl.textContent = ''; daysEl.style.display = 'none'; }
      el.title = 'مدیران نیاز به اشتراک ندارند';
      el.onclick = function () {
        try { if (window.APP && APP.go && APP.isAdmin && APP.isAdmin()) APP.go('subs'); } catch (e) {}
      };
      return;
    }
    if (daysEl) daysEl.style.display = '';
    var v = view(user);
    if (!v.sub) { el.hidden = true; return; }
    el.hidden = false;
    el.classList.toggle('off', !v.on);
    if (dot) dot.classList.toggle('off', !v.on);
    if (planEl) planEl.textContent = v.nameEn;
    if (daysEl) daysEl.textContent = v.statusFa + ' · ' + remainText(v);
    el.title = v.nameEn + ' — ' + v.statusFa + ' — تمدید: ' + v.endFa;
    el.onclick = function () {
      try { if (window.APP && APP.go && APP.isAdmin && APP.isAdmin()) APP.go('subs'); } catch (e) {}
    };
  }

  function paintSide(user) {
    paintHud(user);
    var el = document.getElementById('side-sub');
    if (!el) return;
    if (!user) { el.style.display = 'none'; return; }
    if (isStaff(user)) {
      el.style.display = '';
      el.innerHTML = '<div class="side-sub-plan">فعال</div>';
      return;
    }
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
    list: list, of: of, listOf: listOf, getById: getById, view: view, viewRec: viewRec,
    assign: assign, updateById: updateById, softDelete: softDelete,
    isAllowed: isAllowed, canPage: canPage, isStaff: isStaff,
    priceOf: priceOf, daysLeft: daysLeft, liveStatus: liveStatus, statusFaOf: statusFaOf,
    addMonthsISO: addMonthsISO, todayISO: todayISO, nextStart: nextStart, latestLiveEnd: latestLiveEnd, endFa: endFa, atFa: atFa, faNum: faNum,
    ensureSeed: ensureSeed,
    paintLogin: paintLogin, paintSide: paintSide, paintHud: paintHud
  };
})();
