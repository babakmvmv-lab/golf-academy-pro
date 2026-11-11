/* تقویم — «شروع هفته» در پنل و در استوری
 * اجرا: node source/e2e/calendar_week_rtl_test.mjs
 *
 * گزارش کاربر: در پنل هفته از شنبه (سمت راست) شروع می‌شود، اما تقویمِ استوری برعکس است.
 * علت: بوم (canvas) محور x را چپ‌به‌راست دارد؛ ستون شنبه سمت چپ می‌افتاد و جمعه راست —
 * یعنی آینهٔ چیدمانِ RTL پنل.
 *
 * بررسی‌ها:
 *   ۱) calMonthCells: ستون هر روز با نام واقعیِ روز هفته می‌خواند (همهٔ ۱۲ ماه).
 *   ۲) شبکهٔ پنل (DOM): خانه‌های خالیِ آغاز ماه = firstCol و اولین عدد = ۱.
 *   ۳) استوری: با اجرای واقعیِ painter — سرستون‌ها راست‌به‌چپ (ش…ج) و هر روز
 *      دقیقاً زیر ستون روزِ هفتهٔ خودش، ۱ آبان زیر «ج» و ۲ آبان راست‌تر از آن.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const PATH = new URL('../js/', import.meta.url);
const dataSrc = fs.readFileSync(new URL('data.js', PATH), 'utf8');
const appSrc = fs.readFileSync(new URL('app.js', PATH), 'utf8');

/* ── محیط حداقلی ─────────────────────────────────────────────────────── */
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
  if (!els.has(id)) {
    const handlers = {};
    els.set(id, {
      id, innerHTML: '', textContent: '', style: {}, dataset: {}, _handlers: handlers,
      classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
      addEventListener(t, f) { (handlers[t] = handlers[t] || []).push(f); },
      appendChild() {}, removeAttribute() {}, setAttribute() {},
      querySelector: () => null, querySelectorAll: () => [],
      getBoundingClientRect: () => ({ top: 0, height: 0 }),
      scrollHeight: 0, clientHeight: 0, scrollTop: 0,
    });
  }
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
  console, document: doc, navigator: { onLine: true },
  location: { protocol: 'https:', origin: 'https://x', reload() {} },
  localStorage: ls, Date, Math, JSON, Intl, String, Number, Object, Array, isNaN, parseFloat, parseInt,
  setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  fetch: () => Promise.reject(new Error('no net')), confirm: () => false, TextEncoder, URL,
  CustomEvent: class { constructor(t, d) { this.type = t; this.detail = d; } },
};
sandbox.window = sandbox;
sandbox.window.localStorage = ls;
vm.createContext(sandbox);
vm.runInContext(dataSrc, sandbox, { filename: 'data.js' });
const D = sandbox.window.Data;

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('PASS | ' + m); };
const SEASON = D.seasonYear;
const MONTHS = D.MONTHS_FA;
const fa = v => String(v).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);

/* ── ۱) ستون هر روز = روز واقعیِ هفته ──────────────────────────────── */
{
  let checked = 0; const bad = [];
  for (let jm = 1; jm <= 12; jm++) {
    const g = D.calMonthCells(SEASON, jm);
    if (g.days !== D.jalaliDaysInMonth(SEASON, jm)) bad.push(`${MONTHS[jm - 1]}: days ${g.days}`);
    for (const c of g.cells) {
      const iso = D.shamsiToISO(SEASON, jm, c.d);
      const wd = D.jalaliInfo(D.dateFrom(iso)).wd;      /* نام واقعیِ روز */
      if (wd !== D.CAL_WD_LONG[c.col]) bad.push(`${iso} ${wd} ≠ ${D.CAL_WD_LONG[c.col]} (col ${c.col})`);
      if (c.row !== Math.floor((g.firstCol + c.d - 1) / 7)) bad.push(`${iso} row`);
      checked++;
    }
  }
  ok(bad.length === 0, `ستونِ همهٔ ${checked} روزِ سال ۱۴۰۵ با روز واقعیِ هفته می‌خواند`);
  if (bad.length) console.log(bad.slice(0, 6).join('\n'));
  ok(D.calMonthCells(SEASON, 8).firstCol === 6, '۱ آبان ۱۴۰۵ در ستون ۶ (جمعه) — شنبه = ۰');
  ok(D.calMonthCells(SEASON, 1).firstCol === D.calWeekdayIndex(D.dateFrom(D.shamsiToISO(SEASON, 1, 1))),
     'firstCol = روز هفتهٔ اول فروردین');
  ok(D.calWeekX(0, 84, 36) > D.calWeekX(6, 84, 36), 'calWeekX: ستون شنبه راست‌تر از جمعه است');
}

/* ── ۲ و ۳) اجرای pageCal و painter واقعی ───────────────────────────── */
const s0 = appSrc.indexOf('  function seasonCalendarEvents(){');
const s1 = appSrc.indexOf('  function pageTv(){');
const block = appSrc.slice(s0, s1);

function fakeCtx2d() {
  const g = { addColorStop() {} };
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '',
    fillRect() {}, strokeRect() {}, clearRect() {}, beginPath() {}, closePath() {}, moveTo() {},
    lineTo() {}, arc() {}, fill() {}, stroke() {}, save() {}, restore() {}, clip() {}, translate() {},
    rotate() {}, scale() {}, measureText: () => ({ width: 10 }), fillText() {}, drawImage() {},
    createRadialGradient: () => g, createLinearGradient: () => g,
  };
}
class FakeImage {
  set src(v) { this._src = v; if (this.onload) this.onload(); }
  get src() { return this._src; }
}

function runCal(tours, evs, Dv) {
  Dv = Dv || D;
  const calls = [];
  const ctx2d = fakeCtx2d();
  let painter = null;
  const painterHelpers = {
    W: 1080, H: 1920, GOLD: '#d4af37', GL: '#f3d779', FG: '#e9eff6', MUT: '#9aa7b5',
    rrect: () => {}, c: ctx2d,
    txt: (t, x, y, w, px) => calls.push({ t: String(t), x, y, px }),
  };
  const ctx = {
    S: { tournaments: tours },
    MGMT: { customEvents: () => evs },
    D: Dv, Data: Dv, window: { Data: Dv }, document: doc,
    L: x => x, esc: s => String(s == null ? '' : s), $, $$,
    igStory: (btn, fname, paint) => { painter = paint; },
    Image: FakeImage,
    store: { get: () => null, set() {} }, APP: { go() {}, toast() {} },
    console, isMobile: () => false,
  };
  const keys = Object.keys(ctx);
  const pageCal = new Function(...keys, block + '\nreturn pageCal;')(...keys.map(k => ctx[k]));
  pageCal();
  return { view: el('#view').innerHTML, grid: el('#cal-grid').innerHTML, name: el('#cal-month-name').textContent,
           stCal: el('#st-cal'), calls, painterHelpers, get painter() { return painter; } };
}

/* D.TODAY در data.js = 1405/08/20 (2026-11-11) ⇒ رویدادها باید از این تاریخ به بعد باشند */
const tours = [
  [1007, 'پات کلاب ۶', 3, 1, 3, '2026-10-08'],
  [1008, 'پات کلاب ۷', 3, 1, 6, '2026-11-16'],   /* ۲۵ آبان */
];
const evs = [
  { name: 'تمرین ۶', type: 'تمرین', start: '2026-11-16', end: '2026-11-16' },
  { name: 'اردوی آبان', type: 'اردو', start: '2026-11-19', end: '2026-11-20' },
];
const r = runCal(tours, evs);
ok(r.name === 'آبان ۱۴۰۵', 'پنل روی آبان ۱۴۰۵ باز شده: ' + r.name);

/* شبکهٔ پنل */
{
  const rows = r.grid.split('<div class="cal-grid-big-row">');
  ok(rows.length >= 3, 'شبکهٔ ماه: ردیف سرستون + ردیف‌های روزها');
  const header = rows[1];
  const wds = [...header.matchAll(/<div class="cal-wd([^"]*)">([^<]+)<\/div>/g)].map(m => m[2]);
  ok(wds.join('') === 'شیدسچپج', 'ترتیب سرستون پنل: ' + wds.join(' ') + ' (DOM؛ با direction:rtl ⇒ ش راست‌ترین)');
  ok(/<div class="cal-wd fri">ج<\/div>/.test(header), 'خانهٔ جمعه در پنل کلاس fri دارد (چپ‌ترین)');
  const aban = D.calMonthCells(SEASON, 8);
  const empties = (rows[2].match(/cal-cell empty/g) || []).length;
  ok(empties === aban.firstCol, `خانه‌های خالیِ آغاز آبان = ${empties} (باید ${aban.firstCol})`);
  const nums = [...rows[2].matchAll(/<div class="cal-num">([۰-۹]+)<\/div>/g)].map(m => m[1]);
  ok(nums[0] === '۱', 'اولین عددِ ردیف = ۱ (۱ آبان، جمعه)');
  ok(nums.length === aban.days, `همهٔ ${aban.days} روزِ آبان در شبکه آمده‌اند`);
  ok(nums[aban.days - 1] === fa(aban.days), 'آخرین روز ماه = ' + fa(aban.days));
  /* هر روز جمعه در DOM باید کلاس fri داشته باشد (در RTL چپ‌ترین ستون) */
  const friCells = [...rows[2].matchAll(/<div class="cal-cell([^"]*)" title="[^"]*">\s*<div class="cal-num">([۰-۹]+)<\/div>/g)]
    .filter(m => /\bfri\b/.test(m[1])).map(m => m[2]);
  const expectFri = aban.cells.filter(c => c.col === 6).map(c => fa(c.d));
  ok(friCells.join(',') === expectFri.join(','), 'روزهای جمعه در پنل: ' + friCells.join('، '));
}

/* استوری */
ok(r.stCal && r.stCal._handlers.click && r.stCal._handlers.click.length > 0,
   'دکمهٔ «انتشار استوری» هندلر کلیک دارد');
r.stCal._handlers.click[0]();                       /* همان کاری که کاربر با کلیک می‌کند */
ok(typeof r.painter === 'function', 'کلیک، تابع رسم تقویم را با نام فایل صدا زده است');
const painted = r.painter(r.painterHelpers);
await Promise.resolve(painted).catch(() => {});

const labels = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const labelX = {};
r.calls.filter(c => labels.includes(c.t) && c.px === 17).forEach(c => { labelX[c.t] = c.x; });
ok(labels.every(l => labelX[l] !== undefined), 'سرستون‌های روز هفته روی بوم رسم شد: ' + labels.map(l => l + ':' + Math.round(labelX[l] || -1)).join(' '));
ok(labelX['ش'] > labelX['ی'] && labelX['ی'] > labelX['د'] && labelX['د'] > labelX['س'] &&
   labelX['س'] > labelX['چ'] && labelX['چ'] > labelX['پ'] && labelX['پ'] > labelX['ج'],
   'ترتیب سرستون‌ها راست‌به‌چپ است: ش … ج (شنبه راست‌ترین)');
ok(labelX['ش'] + labelX['ج'] === 1080, 'ستون‌ها حول مرکز بوم قرینه‌اند (ش + ج = عرض بوم)');

const aban = D.calMonthCells(SEASON, 8);
const cellX = {};
r.calls.filter(c => c.px === 22 && /^[۰-۹]+$/.test(c.t)).forEach(c => { cellX[c.t] = c.x; });
const mismatch = [];
for (const c of aban.cells) {
  const wd = D.jalaliInfo(D.dateFrom(D.shamsiToISO(SEASON, 8, c.d))).wd;
  const expect = labelX[D.CAL_WD_SHORT[D.CAL_WD_LONG.indexOf(wd)]];
  const got = cellX[fa(c.d)];
  if (got === undefined || Math.abs(got - expect) > 0.6) mismatch.push(`${fa(c.d)} آبان → x=${got} انتظار ${expect} (${wd})`);
}
ok(mismatch.length === 0, 'هر روزِ آبان دقیقاً زیر ستون روز هفتهٔ خودش افتاده (۳۰ روز)');
if (mismatch.length) console.log(mismatch.slice(0, 8).join('\n'));
ok(Math.abs(cellX['۱'] - labelX['ج']) < 0.6, '۱ آبان (جمعه) زیر ستون «ج» — نه سمت شنبه');
ok(cellX['۲'] > cellX['۱'], '۲ آبان (شنبه) راست‌تر از ۱ آبان است ⇒ هفته از شنبه شروع می‌شود');
ok(Math.abs(cellX['۸'] - labelX['ج']) < 0.6, '۸ آبان (جمعهٔ هفتهٔ دوم) هم زیر «ج»');
ok(cellX['۹'] > cellX['۸'], '۹ آبان (شنبهٔ هفتهٔ دوم) دوباره سمت راست');

/* ضدِ رگرسیون: اگر کسی دوباره x = gx + col*cell بنویسد */
ok(/colX\(i\) \+ cell \/ 2/.test(block), 'سرستون استوری از colX (آینهٔ RTL) استفاده می‌کند');
ok(/const x = colX\(col\)/.test(block), 'خانه‌های استوری از colX استفاده می‌کنند');
ok(!/gx \+ col \* cell|gx \+ i \* cell/.test(block), 'هیچ جای painter از نگاشتِ چپ‌به‌راستِ قدیمی استفاده نمی‌کند');
ok(/calWeekX/.test(block), 'نگاشت x از data.js (calWeekX) می‌آید');

/* ── ۵) همهٔ ۱۲ ماه: چیدمان استوری = چیدمان پنل ─────────────────────── */
{
  const bad = [];
  let months = 0;
  for (let jm = 1; jm <= 12; jm++) {
    els.clear();                                   /* پنل تازه برای هر ماه */
    const day = Math.min(15, D.jalaliDaysInMonth(SEASON, jm));
    const iso = D.shamsiToISO(SEASON, jm, day);
    /* D.TODAY فقط getter است؛ یک نمای (proxy) از Data می‌سازیم که «امروز» را
       اول همان ماه نشان دهد تا رویدادش «آینده» حساب شود. */
    const Dv = Object.create(D);
    Object.defineProperty(Dv, 'TODAY', { value: D.dateFrom(D.shamsiToISO(SEASON, jm, 1)), writable: true });
    const rr = runCal([], [{ name: 'تست ' + MONTHS[jm - 1], type: 'تمرین', start: iso, end: iso }], Dv);
    if (rr.stCal && rr.stCal._handlers.click) rr.stCal._handlers.click[0]();
    if (typeof rr.painter !== 'function') { bad.push(`${MONTHS[jm - 1]}: painter اجرا نشد`); continue; }
    await Promise.resolve(rr.painter(rr.painterHelpers)).catch(() => {});
    const lx = {}, cx = {};
    rr.calls.filter(c => labels.includes(c.t) && c.px === 17).forEach(c => { lx[c.t] = c.x; });
    rr.calls.filter(c => c.px === 22 && /^[۰-۹]+$/.test(c.t)).forEach(c => { cx[c.t] = c.x; });
    const order = labels.map(l => lx[l]);
    if (order.some((v, i) => i && !(v < order[i - 1]))) bad.push(`${MONTHS[jm - 1]}: سرستون‌ها راست‌به‌چپ نیستند`);
    const gm = D.calMonthCells(SEASON, jm);
    for (const c of gm.cells) {
      const wd = D.jalaliInfo(D.dateFrom(D.shamsiToISO(SEASON, jm, c.d))).wd;
      const col = D.CAL_WD_LONG.indexOf(wd);
      if (Math.abs(cx[fa(c.d)] - lx[D.CAL_WD_SHORT[col]]) > 0.6) { bad.push(`${MONTHS[jm - 1]} ${fa(c.d)}: ${wd}`); break; }
    }
    /* خانهٔ اولِ ماه هم زیر ستون درست است */
    if (Math.abs(cx['۱'] - lx[D.CAL_WD_SHORT[gm.firstCol]]) > 0.6) bad.push(`${MONTHS[jm - 1]}: روز ۱`);
    months++;
  }
  ok(months === 12, 'استوری هر ۱۲ ماهِ فصل ساخته شد');
  ok(bad.length === 0, 'در هر ۱۲ ماه، هر روز زیر ستون روز هفتهٔ خودش است');
  if (bad.length) console.log(bad.slice(0, 10).join('\n'));
}

console.log('\n' + n + ' بررسی موفق');
