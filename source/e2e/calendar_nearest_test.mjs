/* تقویم فصل — «نزدیک‌ترین رویداد به امروز» و «ماهِ جاری»
 * اجرا: node source/e2e/calendar_nearest_test.mjs
 *
 * باگ گزارش‌شده: در پنل اعضا، صفحهٔ «تقویم فصل» به‌جای رویداد نزدیک به امروز،
 * رویداد فروردین را نشان می‌داد و تقویم روی ماه ۱ می‌ایستاد.
 * علت: Math.max(0, events.findIndex(e => e.d >= TODAY)) — وقتی هیچ رویداد آینده‌ای نبود،
 * −۱ به ۰ تبدیل می‌شد ⇒ اولین رویداد فصل.
 *
 * این فایل هم منطق خالص (Data.calNearest) و هم اجرای واقعیِ pageCal را با
 * data.js واقعی می‌سنجد.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const PATH = new URL('../js/', import.meta.url);
const dataSrc = fs.readFileSync(new URL('data.js', PATH), 'utf8');
const appSrc = fs.readFileSync(new URL('app.js', PATH), 'utf8');

/* ── محیط مرورگرِ حداقلی ─────────────────────────────────────────────── */
const store = new Map();
const ls = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  key: i => [...store.keys()][i],
  get length() { return store.size; },
};
const els = new Map();
function el(id) {
  if (!els.has(id)) els.set(id, {
    id, innerHTML: '', textContent: '', style: {}, dataset: {},
    classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
    addEventListener() {}, appendChild() {}, removeAttribute() {}, setAttribute() {},
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: 0, height: 0 }), scrollHeight: 0, clientHeight: 0, scrollTop: 0,
  });
  return els.get(id);
}
const $ = s => el(s);
const $$ = () => [];
const doc = {
  readyState: 'complete', visibilityState: 'visible', body: el('body'),
  documentElement: { classList: { contains: () => false, add() {}, remove() {} } },
  querySelector: () => null, querySelectorAll: () => [], getElementById: id => el(id),
  createElement: () => el('tmp'), addEventListener() {},
};
const sandbox = {
  console, document: doc, navigator: { onLine: true }, location: { protocol: 'https:', origin: 'https://x', reload() {} },
  localStorage: ls, Date, Math, JSON, Intl, String, Number, Object, Array, isNaN, parseFloat, parseInt,
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  fetch: () => Promise.reject(new Error('no net')), confirm: () => false, TextEncoder, URL,
  CustomEvent: class { constructor(t, d) { this.type = t; this.detail = d; } },
};
sandbox.window = sandbox;       /* هم window هم global — مثل مرورگر */
sandbox.window.localStorage = ls;
vm.createContext(sandbox);
vm.runInContext(dataSrc, sandbox, { filename: 'data.js' });

const D = sandbox.window.Data;
assert.ok(D && typeof D.calNearest === 'function', 'Data.calNearest صادر نشده است');

const T = (s, end) => ({ d: D.dateFrom(s), end: D.dateFrom(end || s), name: s, type: 'تمرین', kind: 'تمرین' });

/* ── ۱) منطق خالص ──────────────────────────────────────────────────── */
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('PASS | ' + m); };

const today = D.dateFrom('2026-10-27');
const list = [
  T('2026-04-09'), T('2026-05-14'), T('2026-09-24'), T('2026-10-08'), T('2026-10-15'), T('2026-10-22'),
];
let p = D.calNearest(list, today);
ok(p.idx === 5 && p.upcoming === false, 'همهٔ رویدادها گذشته‌اند ⇒ آخرین رویداد (نه اولین) انتخاب می‌شود');
ok(list[p.idx].d.toISOString().slice(0, 10) === '2026-10-22', 'انتخابِ درست: نزدیک‌ترین رویداد گذشته');

p = D.calNearest([...list, T('2026-11-05')], today);
ok(p.idx === 6 && p.upcoming === true, 'رویداد آینده ⇒ «رویداد بعدی»');

p = D.calNearest([T('2026-10-25', '2026-10-29'), T('2026-11-05')], today);
ok(p.idx === 0 && p.upcoming === true, 'رویداد چندروزهٔ در جریان ⇒ همان انتخاب می‌شود');

p = D.calNearest([], today);
ok(p.idx === -1 && p.upcoming === false, 'فهرست خالی ⇒ idx = −۱ (بدون استثنا)');

p = D.calNearest([T('2026-03-01'), T('2026-03-20')], today);
ok(p.idx === 1, 'همه پیش از امروز و خارج از ترتیب امروز ⇒ آخرین آیتم');

/* ── ۲) اجرای واقعیِ pageCal با data.js واقعی ───────────────────────── */
const s0 = appSrc.indexOf('  function seasonCalendarEvents(){');
const s1 = appSrc.indexOf('  function pageTv(){');
assert.ok(s0 > 0 && s1 > s0, 'بخش تقویم در app.js پیدا نشد');
const block = appSrc.slice(s0, s1);

function runCal(tournaments, events, programs) {
  const ctx = {
    S: { tournaments },
    MGMT: { customEvents: () => events },
    D, Data: D, window: { Data: D }, document: doc,
    L: x => x,
    esc: s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    $, $$, igStory() {}, store: { get: () => null, set() {} },
    APP: { go() {}, toast() {} },
    console,
  };
  D.loadPrograms = () => programs;      /* برنامه‌های فصل */
  const keys = Object.keys(ctx);
  const fn = new Function(...keys, block + '\nreturn pageCal;')(...keys.map(k => ctx[k]));
  fn();
  return {
    view: el('#view').innerHTML,
    list: el('#cal-events-list').innerHTML,
    month: el('#cal-month-name').textContent,
    hol: el('#cal-month-hols').innerHTML,
  };
}

/* دادهٔ واقعیِ ابر (خلاصه): آخرین رویداد ۳۰ مهر، هیچ رویداد آینده‌ای نیست */
const tours = [
  [1000, 'پات کلاب ۱', 3, 1, 3, '2026-09-08'],
  [1007, 'پات کلاب ۶', 3, 1, 3, '2026-10-08'],
  [1008, 'پات کلاب 7', 3, 1, 6, '2026-10-22'],
];
const evs = [
  { name: 'تمرین هفتگی 20 فروردین', type: 'تمرین', start: '2026-04-09', end: '2026-04-09' },
  { name: 'تمرین ۵', type: 'تمرین', start: '2026-10-08', end: '2026-10-08' },
  { name: 'تمرین 6', type: 'تمرین', start: '2026-10-15', end: '2026-10-15' },
  { name: 'تمرین 7', type: 'تمرین', start: '2026-10-22', end: '2026-10-22' },
];

let r = runCal(tours, evs, []);
/* خواستهٔ کاربر: اگر از امروز به بعد رویدادی نیست، کارت بالا هیچ نوشته‌ای ندارد */
ok(!r.view.includes('data-acc="cal.next"'), 'بدون رویدادِ امروز به بعد، کارت بالای صفحه رندر نمی‌شود');
ok(!r.view.includes('رویداد بعدی'), 'عبارت «رویداد بعدی» نوشته نمی‌شود');
ok(!r.view.includes('آخرین رویداد'), 'عبارت «آخرین رویداد» هم نوشته نمی‌شود');
ok(!r.view.includes('روز از پایان') && !r.view.includes('روز تا شروع'), 'شمارندهٔ روز نمایش داده نمی‌شود');
ok(!r.view.includes('تمرین 7') || !r.view.split('cal-main')[0].includes('تمرین 7'), 'هیچ رویداد گذشته‌ای در ناحیهٔ بالا نوشته نمی‌شود');
ok(r.month === 'آبان ۱۴۰۵', 'تقویم روی ماه جاری (آبان ۱۴۰۵) باز می‌شود: ' + r.month);
ok(/cal-grid-big/.test(el('#cal-grid').innerHTML), 'شبکهٔ ماه رسم شده است');
ok(!r.hol.includes('cal-jump-near'), 'بدون رویداد آینده، لینک میان‌بُر هم نوشته نمی‌شود');
ok(r.list.includes('برگزار شده'), 'گذشته‌ها فقط در فهرست «برگزار شده» می‌مانند');

/* ترتیب فهرست: تازه‌ترین گذشته اول */
const posNew = r.list.indexOf('تمرین 7'), posOld = r.list.indexOf('تمرین ۵');
ok(posNew > 0 && posOld > 0 && posNew < posOld, 'در فهرست، تازه‌ترین رویداد بالاتر از قدیمی‌ترها است');

/* با رویداد آینده: «رویداد بعدی» + شمارش روز */
r = runCal(tours, [...evs, { name: 'اردوی آبان', type: 'اردو', start: '2026-11-05', end: '2026-11-06' }], []);
ok(r.view.includes('data-acc="cal.next"'), 'با رویداد آینده، کارت بالا رندر می‌شود');
ok(r.view.includes('رویداد بعدی') && r.view.includes('اردوی آبان'), 'با رویداد آینده، کارت «رویداد بعدی» درست است');
const left = Math.ceil((D.dateFrom('2026-11-05') - D.TODAY) / 86400000);
ok(r.view.includes(D.fa(Math.max(0, left))), 'شمارش روز تا رویداد درست است (' + left + ')');
ok(r.month === 'آبان ۱۴۰۵', 'ماهِ آغازین همچنان ماه جاری است');

/* رویدادِ امروز (در جریان) هم «بالا» حساب می‌شود */
r = runCal(tours, [...evs, { name: 'تمرین امروز', type: 'تمرین', start: D.todayISO(), end: D.todayISO() }], []);
ok(r.view.includes('رویداد بعدی') && r.view.includes('تمرین امروز'), 'رویداد امروز ⇒ کارت بالا با «همین امروز»');
ok(r.view.includes('همین امروز'), 'برچسب «همین امروز» برای رویداد امروز');

/* تقویم خالی: نباید خطا بدهد */
r = runCal([], [], []);
ok(!r.view.includes('data-acc="cal.next"'), 'تقویم خالی: کارت بالا وجود ندارد');
ok(r.list.includes('رویدادی نیست'), 'فهرست خالی پیام کوتاه دارد و خطا نمی‌دهد');
ok(r.month === 'آبان ۱۴۰۵', 'تقویم خالی هم روی ماه جاری است');

console.log('\n' + n + ' بررسی موفق');
