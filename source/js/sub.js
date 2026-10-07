/* ═══════════════════════════════════════════════════════════════════
   پات کلاب — اشتراک یوزر (جدا از بازیکن)
   User ⇄ Subscription ⇄ Plan
   بازیکن می‌تواند در دیتا باشد بدون یوزر/اشتراک.
   ورود به پنل فقط با یوزر فعال + اشتراک معتبر (مدیران معاف‌اند).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  /* زمان سرور (از cloud.js) — ساعت اشتباهِ دستگاه، تاریخ اشتراک و نسخهٔ رکورد را خراب نکند */
  function clockIso() { return window.GA_CLOCK ? GA_CLOCK.iso() : new Date().toISOString(); }
  function clockDate() { return window.GA_CLOCK ? GA_CLOCK.date() : new Date(); }

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


  /* ── درخت دسترسی (ACCESS_TREE_V1) ───────────────────────────────────
     هر صفحهٔ قابل‌مشاهده برای اعضا → (تب) → بخش. شناسهٔ هر گره = «صفحه.تب.بخش»
     و در همان کلید ga_plan_features (برای هر پلن) ذخیره می‌شود؛ مقدار غایب = روشن.
     خاموش بودن هر والد، همهٔ فرزندانش را هم خاموش می‌کند. مدیران همیشه همه را می‌بینند.
     sel (اختیاری) = انتخابگر CSS برای بخش‌هایی که خارج از قالب app.js ساخته می‌شوند. */
  var ACCESS_TREE = [
    { id: 'memberzone', t: 'بخش اعضا', ic: '🏠', kids: [
      { id: 'memberzone.header', t: 'سربرگ خوش‌آمد و سکهٔ من' },
      { id: 'memberzone.home', t: 'خانهٔ من', tab: true, kids: [
        { id: 'memberzone.home.rank', t: 'کارت رنک من' },
        { id: 'memberzone.home.season', t: 'وضعیت من در فصل' },
        { id: 'memberzone.home.sections', t: 'بخش‌های فعال و راه‌های سریع' } ] },
      { id: 'memberzone.earn', t: 'دریافت سکه', tab: true, kids: [
        { id: 'memberzone.earn.request', t: 'ارسال درخواست سکه به مدیریت' },
        { id: 'memberzone.earn.mine', t: 'درخواست‌های من' },
        { id: 'memberzone.earn.auto', t: 'سکه‌های خودکار مسابقات' } ] },
      { id: 'memberzone.guide', t: 'راهنمای سکه', tab: true, kids: [
        { id: 'memberzone.guide.table', t: 'جدول کامل دریافت سکه' },
        { id: 'memberzone.guide.ranks', t: 'توضیحات رنک‌ها و مسیر ارتقاء' } ] },
      { id: 'memberzone.avatar', t: 'ساخت آواتار و فروشگاه', tab: true, kids: [
        { id: 'memberzone.avatar.hero', t: 'بنر ویترین فروشگاه', sel: '.as-hero' },
        { id: 'memberzone.avatar.outfit', t: 'استایل کامل (ست‌های آماده)', sel: '.as-outfit-wrap' },
        { id: 'memberzone.avatar.feats', t: 'نوار مزایای فروشگاه', sel: '.as-feats' } ] } ] },
    { id: 'cmd', t: 'فرماندهی', ic: '🎯', kids: [
      { id: 'cmd.hero', t: 'تصویر سربرگ' },
      { id: 'cmd.stats', t: 'کارت‌های آمار کلیدی' },
      { id: 'cmd.podium', t: 'سکوی قهرمانی فصل' },
      { id: 'cmd.phases', t: 'قهرمانان فازها' },
      { id: 'cmd.monthly', t: 'امتیاز ماهانهٔ فصل' },
      { id: 'cmd.live', t: 'رقابت زنده — ده نفر برتر' } ] },
    { id: 'race', t: 'رقابت فصل', ic: '🏁', kids: [
      { id: 'race.table', t: 'جدول رقابت فصل' },
      { id: 'race.zones', t: 'مناطق واجد شرایط' },
      { id: 'race.top', t: 'نبرد صدر جدول' } ] },
    { id: 'player', t: 'مرکز بازیکن', ic: '🏌️', kids: [
      { id: 'player.classic', t: 'تحلیل کلاسیک', tab: true, kids: [
        { id: 'player.classic.stats', t: 'کارت‌های آمار بازیکن' },
        { id: 'player.classic.radar', t: 'رادار مهارت' },
        { id: 'player.classic.dist', t: 'توزیع اسکور' },
        { id: 'player.classic.gold', t: 'پیشرفت Gold Elite' },
        { id: 'player.classic.pie', t: 'تحلیل دایره‌ای نتیجهٔ تمرین' },
        { id: 'player.classic.clubs', t: 'آنالیز بزرگ تمرین هر کلاب' },
        { id: 'player.classic.monthly', t: 'امتیاز ماهانه' },
        { id: 'player.classic.cumul', t: 'تجمعی فصل' },
        { id: 'player.classic.holes', t: 'ضربات حفره‌به‌حفره' } ] },
      { id: 'player.smart', t: 'بازیکن هوشمند', tab: true, kids: [
        { id: 'player.smart.live', t: 'آنالیز آخرین ضربه‌ها (زنده)' },
        { id: 'player.smart.archive', t: 'آرشیو نمودار جلسات' },
        { id: 'player.smart.notes', t: 'یادداشت‌های مربی' } ] } ] },
    { id: 'match', t: 'فرماندهی مسابقه', ic: '🥇', kids: [
      { id: 'match.stats', t: 'کارت‌های آمار مسابقه' },
      { id: 'match.results', t: 'نتایج بازیکنان' },
      { id: 'match.birdies', t: 'پرنده‌های هر بازیکن' },
      { id: 'match.hardest', t: 'سخت‌ترین حفره‌ها' } ] },
    { id: 'course', t: 'هوش زمین', ic: '🗺️', kids: [
      { id: 'course.map', t: 'نقشهٔ ماهواره‌ای زمین' },
      { id: 'course.practice', t: 'آنالیز تمرین روی زمین' },
      { id: 'course.stats', t: 'کارت‌های آمار زمین' },
      { id: 'course.holes', t: 'سختی حفره‌ها' },
      { id: 'course.card', t: 'کارنامهٔ بازیکن' },
      { id: 'course.fit', t: 'میانگین بازیکن در زمین‌ها' } ] },
    { id: 'records', t: 'رکوردها', ic: '🎖️', kids: [
      { id: 'records.champs', t: 'کارت‌های قهرمانان' },
      { id: 'records.best', t: 'بهترین دورهای فصل' },
      { id: 'records.podium', t: 'سکوی فصل' } ] },
    { id: 'cal', t: 'تقویم فصل', ic: '📅', kids: [
      { id: 'cal.next', t: 'سربرگ رویداد بعدی' },
      { id: 'cal.events', t: 'فهرست رویدادها' },
      { id: 'cal.month', t: 'تقویم ماه' } ] },
    { id: 'tv', t: 'نمایش تلویزیونی', ic: '📺', kids: [] },
    { id: 'battle', t: 'میدان نبرد', ic: '⚔️', kids: [
      { id: 'battle.header', t: 'سربرگ نبرد' },
      { id: 'battle.teams', t: 'کارت تیم‌ها' },
      { id: 'battle.score', t: 'امتیاز تیم‌ها' },
      { id: 'battle.duels', t: 'جدال‌های نبرد' } ] },
    { id: 'academy', t: 'پنل آکادمی', ic: '🏛️', kids: [
      { id: 'academy.kpis', t: 'کارت‌های آمار آکادمی' },
      { id: 'academy.ranks', t: 'ترکیب رنک‌های فصل' },
      { id: 'academy.glance', t: 'آکادمی در یک نگاه — پیام سرپرست' } ] },
    { id: 'avatarland', t: 'سرزمین آواتارها', ic: '💚', kids: [] }
  ];
  var MEMBER_PAGES = ACCESS_TREE.map(function (n) { return n.id; });
  function walkTree(fn) {
    (function w(list, depth, parent) {
      list.forEach(function (n) { fn(n, depth, parent); if (n.kids && n.kids.length) w(n.kids, depth + 1, n); });
    })(ACCESS_TREE, 0, null);
  }
  function nodeById(id) { var hit = null; walkTree(function (n) { if (n.id === id) hit = n; }); return hit; }
  /* سوییچ‌های «تنظیمات نمایش» قدیمی (ga_ui) → شناسه‌های درخت. فقط تا اولین ذخیرهٔ ماتریس جدید (_v<2) خوانده می‌شوند. */
  var LEGACY_UI = {
    memCmd: 'cmd', memRace: 'race', memPlayer: 'player', memMatch: 'match', memCourse: 'course',
    memRecords: 'records', memCal: 'cal', memTv: 'tv', memAvatarLand: 'avatarland',
    chCmd: 'cmd.stats', chMonthly: 'cmd.monthly', chRace: 'race', chRaceBars: 'race.table',
    chPlayer: 'player', chPlayerRadar: 'player.classic.radar', chMatch: 'match', chCourse: 'course',
    chRecords: 'records', chCal: 'cal', chTv: 'tv', chBattle: 'battle'
  };
  function legacyOff() {
    var ui = jread('ga_ui', {}) || {};
    /* پیش از درخت دسترسی، اعضا هرگز «میدان نبرد» و «پنل آکادمی» را نمی‌دیدند — همان رفتار حفظ می‌شود */
    var off = ['battle', 'academy'];
    Object.keys(LEGACY_UI).forEach(function (k) { if (ui[k] === false && off.indexOf(LEGACY_UI[k]) < 0) off.push(LEGACY_UI[k]); });
    return off;
  }

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
    var o = jread(FEAT_KEY, {}) || {};
    var legacy = (+o._v >= 2) ? null : legacyOff();
    var out = {};
    PLAN_ORDER.forEach(function (c) {
      var src = (o && o[c]) || {};
      var f = emptyFeat();
      /* همهٔ کلیدهای بولی (صفحه و بخش‌ها) حفظ می‌شوند؛ غایب = روشن */
      Object.keys(src).forEach(function (k) { if (src[k] === false) f[k] = false; else if (src[k] === true) f[k] = true; });
      if (legacy) legacy.forEach(function (k) { f[k] = false; });
      out[c] = f;
    });
    return out;
  }
  function saveFeatures(o) {
    var out = { _v: 2 };
    PLAN_ORDER.forEach(function (c) {
      var f = (o && o[c]) || {}, keep = {};
      Object.keys(f).forEach(function (k) { if (typeof f[k] === 'boolean') keep[k] = f[k]; });
      out[c] = keep;
    });
    jwrite(FEAT_KEY, out);
  }
  /* روشن بودن یک گره برای یک پلن: خودش و همهٔ والدهایش نباید خاموش باشند */
  function featOn(f, id) {
    var parts = String(id || '').split('.');
    for (var i = 1; i <= parts.length; i++) { if (f[parts.slice(0, i).join('.')] === false) return false; }
    return true;
  }
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
      at: clockIso(),
      by: a.user,
      byName: a.name,
      action: action
    }, extra || {});
  }
  function newId() {
    return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function localDateISO(d) {
    d = d || clockDate();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function localDateTimeISO(d) {
    d = d || clockDate();
    return localDateISO(d) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function splitStamp(iso) {
    var raw = String(iso || '');
    var datePart = raw.slice(0, 10);
    var timePart = '';
    var t = raw.indexOf('T');
    if (t >= 0) timePart = raw.slice(t + 1, t + 9);
    if (timePart && timePart.length === 5) timePart += ':00';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) datePart = localDateISO();
    return { date: datePart, time: /^\d{2}:\d{2}:\d{2}$/.test(timePart) ? timePart : '' };
  }
  /* طول ماه شمسی: ۱–۶ = ۳۱روز، ۷–۱۱ = ۳۰روز، اسفند = ۲۹ یا ۳۰ (کبیسه) */
  function jalaliMonthLength(jy, jm) {
    jm = +jm;
    if (jm >= 1 && jm <= 6) return 31;
    if (jm >= 7 && jm <= 11) return 30;
    try {
      if (window.Data && Data.j2d) return Data.j2d(+jy + 1, 1, 1) - Data.j2d(+jy, 12, 1);
    } catch (e) {}
    return 29;
  }
  /* یک ماه کامل شمسی: همان روز (و ساعت) تا همان روز ماه بعد — اگر آن روز در ماه بعد نبود، آخرین روز ماه */
  function addMonthsISO(iso, n) {
    n = +n || 1;
    var st = splitStamp(iso);
    var gy = +st.date.slice(0, 4), gm = +st.date.slice(5, 7), gd = +st.date.slice(8, 10);
    var jy, jm, jd;
    if (window.Data && Data.toJalaali) {
      var j = Data.toJalaali(gy, gm, gd);
      jy = j[0]; jm = j[1]; jd = j[2];
    } else {
      var dg = new Date(st.date + 'T12:00:00');
      dg.setMonth(dg.getMonth() + n);
      var outG = dg.getFullYear() + '-' + pad2(dg.getMonth() + 1) + '-' + pad2(dg.getDate());
      return st.time ? (outG + 'T' + st.time) : outG;
    }
    jm += n;
    while (jm > 12) { jy += 1; jm -= 12; }
    while (jm < 1) { jy -= 1; jm += 12; }
    var len = jalaliMonthLength(jy, jm);
    if (jd > len) jd = len;
    var outDate = Data.shamsiToISO(jy, jm, jd);
    return st.time ? (outDate + 'T' + st.time) : outDate;
  }
  function todayISO() { return localDateISO(); }
  function nowStamp() { return localDateTimeISO(); }

  function boundMoment(value, isEnd) {
    if (!value) return null;
    var raw = String(value).trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) raw += isEnd ? 'T23:59:59.999' : 'T00:00:00.000';
    var ms = Date.parse(raw);
    return Number.isFinite(ms) ? new Date(ms) : null;
  }
  function startMoment(sub) {
    if (!sub || typeof sub !== 'object') return null;
    return boundMoment(sub.start_at || sub.start_date, false);
  }
  function endMoment(end) {
    if (!end) return null;
    var raw = typeof end === 'object' ? (end.end_at || end.end_date) : end;
    return boundMoment(raw, true);
  }
  function daysLeft(end) {
    var e = endMoment(end);
    if (!e) return 0;
    return Math.ceil((e.getTime() - Date.now()) / 86400000);
  }

  function isDeleted(sub) {
    return !!(sub && (sub.deleted_at || sub.status === 'deleted'));
  }

  function liveStatus(sub) {
    if (!sub) return 'none';
    if (isDeleted(sub)) return 'deleted';
    if (sub.status === 'canceled') return 'canceled';
    if (PLAN_ORDER.indexOf(sub.plan) < 0) return 'invalid';
    if (['active','trial','past_due'].indexOf(sub.status) < 0) return 'invalid';
    var start = startMoment(sub), end = endMoment(sub);
    if (!start || !end) return 'invalid';
    var now = Date.now();
    if (end.getTime() <= now) return 'expired';
    if (start.getTime() > now) return 'scheduled';
    if (sub.status === 'past_due') return 'past_due';
    if (sub.status === 'trial' || sub.plan === 'trial') return 'trial';
    return 'active';
  }

  function isLiveRec(s) {
    var st = liveStatus(s);
    return st === 'active' || st === 'trial';
  }

  function latestLiveEnd(user) {
    var k = ukey(user), end = '', endMs = 0;
    list().forEach(function (s) {
      if (ukey(s.user) !== k) return;
      var st = liveStatus(s);
      if (st !== 'active' && st !== 'trial' && st !== 'scheduled') return;
      var moment = endMoment(s), stamp = s.end_at || s.end_date;
      if (moment && moment.getTime() > endMs) { end = stamp; endMs = moment.getTime(); }
    });
    return end;
  }
  /* شروع دورهٔ تازه = الان، یا پایان آخرین دورهٔ جاری/صف‌شده. */
  function nextStart(user) {
    var now = nowStamp(), end = latestLiveEnd(user), endDate = endMoment(end);
    if (endDate && endDate.getTime() > Date.now()) return end;
    return now;
  }

  function of(user) {
    var k = ukey(user);
    var mine = list().filter(function (s) { return ukey(s.user) === k && !isDeleted(s); });
    var live = mine.filter(isLiveRec).sort(function (a, b) {
      return endMoment(b).getTime() - endMoment(a).getTime();
    });
    if (live[0]) return live[0];
    var scheduled = mine.filter(function (s) { return liveStatus(s) === 'scheduled'; }).sort(function (a, b) {
      return startMoment(a).getTime() - startMoment(b).getTime();
    });
    if (scheduled[0]) return scheduled[0];
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
    if (isStaff(user)) return true;
    if (!isAllowed(user)) return false;
    if (!page) return true;
    var sub = of(user);
    var f = featuresOf(sub && sub.plan);
    return f[page] !== false;
  }

  /* canSee: آیا این کاربر گره‌ای از درخت دسترسی (صفحه/تب/بخش) را می‌بیند؟ */
  function canSee(user, id) {
    if (isStaff(user)) return true;
    if (!isAllowed(user)) return false;
    if (!id) return true;
    var sub = of(user);
    return featOn(featuresOf(sub && sub.plan), id);
  }
  /* اعمال پس از رندر: بخش‌های خاموشِ صفحهٔ جاری برای عضو پنهان می‌شوند (DOM حذف نمی‌شود تا کد نمودارها نشکند) */
  function applyAccess(root, user, page) {
    if (!root) return 0;
    var node = nodeById(page);
    if (!node) return 0;
    var staff = isStaff(user), hidden = 0;
    (function w(list) {
      list.forEach(function (n) {
        var els = root.querySelectorAll('[data-acc="' + n.id + '"]' + (n.sel ? ',' + n.sel : ''));
        var on = staff || canSee(user, n.id);
        for (var i = 0; i < els.length; i++) {
          if (on) { if (els[i].classList.contains('feat-off')) { els[i].classList.remove('feat-off'); els[i].removeAttribute('aria-hidden'); } }
          else if (!els[i].classList.contains('feat-off')) { els[i].classList.add('feat-off'); els[i].setAttribute('aria-hidden', 'true'); hidden++; }
        }
        if (n.kids && n.kids.length) w(n.kids);
      });
    })(node.kids || []);
    return hidden;
  }
  /* اولین تب مجاز (برای صفحات دارای تب مثل مرکز بازیکن و بخش اعضا) */
  function pickTab(user, page, tabs, cur) {
    var ok = tabs.filter(function (t) { return canSee(user, page + '.' + t); });
    if (ok.indexOf(cur) > -1) return cur;
    return ok.length ? ok[0] : null;
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
    return { none: 'بدون اشتراک', expired: 'منقضی', canceled: 'لغو شده', past_due: 'در انتظار پرداخت', trial: 'آزمایشی', active: 'فعال', scheduled: 'شروع آینده', invalid: 'نامعتبر', deleted: 'حذف‌شده' }[st] || st;
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
    var days = sub ? daysLeft(sub) : 0;
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
      days: daysLeft(sub),
      startFa: endFa(sub.start_date),
      endFa: endFa(sub.end_date)
    };
  }

  function assign(user, opt) {
    opt = opt || {};
    var a = actor();
    var plan = opt.plan || 'trial';
    var months = +opt.billing_cycle || +opt.months || 1;
    var startRaw = opt.start_at || opt.start_date || nextStart(user);
    var endRaw = opt.end_at || opt.end_date || addMonthsISO(startRaw, months);
    var start = String(startRaw).slice(0, 10);
    var end = String(endRaw).slice(0, 10);
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
      start_at: String(startRaw),
      end_at: String(endRaw),
      billing_cycle: months,
      auto_renew: !!opt.auto_renew,
      payment_status: opt.payment_status || 'manual',
      created_at: clockIso(),
      created_by: a.user,
      created_by_name: a.name,
      events: [stamp('create', { plan: plan, months: months, start: startRaw, end: endRaw })]
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
      updated_at: clockIso(),
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
    all[i].deleted_at = clockIso();
    all[i].updated_at = all[i].deleted_at;
    all[i].deleted_by = a.user;
    all[i].deleted_by_name = a.name;
    all[i].delete_reason = reason;
    if (!all[i].events) all[i].events = [];
    all[i].events.push(stamp('delete', { reason: reason }));
    saveList(all);
    return { ok: true, rec: all[i] };
  }

  function hasForeignSubscription(user, userId) {
    var target = ukey(user), owner = userId == null ? '' : String(userId);
    return list().some(function (s) {
      if (ukey(s.user) !== target || isDeleted(s)) return false;
      return !owner || s.user_id == null || String(s.user_id) !== owner;
    });
  }

  function relinkUser(oldUser, newUser, userId) {
    var from = ukey(oldUser), to = ukey(newUser);
    if (!from || !to) return 0;
    var sameName = from === to;
    var all = list(), now = clockIso(), a = actor(), changed = 0;
    all.forEach(function (s) {
      if (ukey(s.user) !== from) return;
      if (userId != null && s.user_id != null && String(s.user_id) !== String(userId)) return;
      if (sameName) {
        /* مهاجرت رجیستری legacy: همان username می‌ماند، اما تاریخچهٔ بی‌شناسه
           به رکورد کاربر تازه متصل می‌شود؛ شناسهٔ متعلق به حساب دیگری دست‌نخورده است. */
        if (userId == null || (s.user_id != null && String(s.user_id) !== String(userId))) return;
        if (String(s.user_id) === String(userId)) return;
        s.user_id = userId;
      } else {
        s.user = to;
        if (userId != null) s.user_id = userId;
      }
      s.updated_at = now; s.updated_by = a.user; s.updated_by_name = a.name;
      if (!Array.isArray(s.events)) s.events = [];
      s.events.push(stamp('relink', { from: from, to: to }));
      changed++;
    });
    if (changed) saveList(all);
    return changed;
  }

  function revokeUser(user, reason, userId) {
    var target = ukey(user);
    reason = String(reason || 'حذف حساب یوزر').trim();
    if (!target) return 0;
    var all = list(), now = clockIso(), a = actor(), changed = 0;
    all.forEach(function (s) {
      if (ukey(s.user) !== target || isDeleted(s)) return;
      if (userId != null && s.user_id != null && String(s.user_id) !== String(userId)) return;
      s.status = 'deleted'; s.deleted_at = now; s.updated_at = now;
      s.deleted_by = a.user; s.deleted_by_name = a.name; s.delete_reason = reason;
      if (!Array.isArray(s.events)) s.events = [];
      s.events.push(stamp('delete', { reason: reason }));
      changed++;
    });
    if (changed) saveList(all);
    return changed;
  }

  /* سازگاری API قدیمی: startup نباید برای حسابِ بی‌اشتراک entitlement بسازد.
     اشتراک تازه فقط با اقدام صریح مدیر از صفحهٔ مدیریت ایجاد می‌شود. */
  function ensureSeed() { return false; }

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
    relinkUser: relinkUser, revokeUser: revokeUser, hasForeignSubscription: hasForeignSubscription,
    isAllowed: isAllowed, canPage: canPage, isStaff: isStaff,
    ACCESS_TREE: ACCESS_TREE, MEMBER_PAGES: MEMBER_PAGES, walkTree: walkTree, nodeById: nodeById,
    canSee: canSee, featOn: featOn, applyAccess: applyAccess, pickTab: pickTab,
    priceOf: priceOf, daysLeft: daysLeft, liveStatus: liveStatus, statusFaOf: statusFaOf,
    addMonthsISO: addMonthsISO, todayISO: todayISO, nextStart: nextStart, latestLiveEnd: latestLiveEnd, endFa: endFa, atFa: atFa, faNum: faNum,
    ensureSeed: ensureSeed,
    paintLogin: paintLogin, paintSide: paintSide, paintHud: paintHud
  };
})();
