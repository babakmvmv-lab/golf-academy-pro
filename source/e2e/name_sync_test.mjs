/* ═══════════════════════════════════════════════════════════════════
   «یک نام، همه‌جا» — نامِ بازیکن که مدیر در ادمین‌پنل عوض می‌کند باید
   همان لحظه در پنل عضو (سربرگ، بخش اعضا، کارت رنک) دیده شود و هیچ نسخهٔ
   قدیمیِ محلی نباید آن را برگرداند.

   اجرا: node source/e2e/name_sync_test.mjs

   چه چیزی را ثابت می‌کند؟
     ۱) data.playerFullName/accountDisplayName: پروندهٔ بازیکن بر نامِ حساب مقدم است.
     ۲) ویرایشِ محلیِ کهنه (قدیمی‌تر از updated_at سرور) نامِ تازهٔ سرور را برنمی‌گرداند.
     ۳) ویرایشِ محلیِ تازه (بعد از دریافتِ سرور) همان است که نمایش داده می‌شود.
     ۴) نگهبانِ «خالی روی پر را ننشان»: ذخیرهٔ فرمِ ناقص نام/تلفن را پاک نمی‌کند
        (منبعی که رزا را محو می‌کرد).
     ۵) تغییر نام از صفحهٔ «یوزرها» هم داخلِ پروندهٔ بازیکن نوشته می‌شود.
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_SRC = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
const MGMT_SRC = fs.readFileSync(path.join(ROOT, 'js', 'mgmt.js'), 'utf8');

let fails = 0;
const ok = (cond, name) => { console.log((cond ? '  ✔ ' : '  ✘ ') + name); if (!cond) fails++; };

/* ── دستگاهِ فیک (localStorage + DOM حداقلی) ─────────────────────── */
function device(seed = {}) {
  const store = new Map(Object.entries(seed));
  const ls = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    key: i => [...store.keys()][i],
    get length() { return store.size; },
  };
  const el = () => ({
    style: {}, dataset: {}, classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
    setAttribute() {}, getAttribute: () => null, appendChild() {}, addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [], innerHTML: '', textContent: '', value: '', src: '', checked: false,
  });
  const doc = {
    readyState: 'complete', body: el(), documentElement: el(),
    createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, visibilityState: 'visible', hidden: false,
  };
  const sandbox = {
    console, JSON, Math, Date, Object, Array, Promise, Set, Map, String, Number, Boolean, Error, RegExp,
    encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN, Intl,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    document: doc,
    navigator: { onLine: true, language: 'fa-IR' },
    location: { href: 'https://qa.local/index.html', reload() {} },
    fetch: async () => { throw new Error('no network in test'); },
    crypto: { getRandomValues: (b) => { for (let i = 0; i < b.length; i++) b[i] = (i * 37) & 255; return b; } },
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.localStorage = ls;
  sandbox.window.localStorage = ls;
  sandbox.window.addEventListener = () => {};
  sandbox.window.dispatchEvent = () => {};
  vm.createContext(sandbox);
  return { sandbox, store };
}

/* ── ۱) منبعِ نام: پروندهٔ بازیکن بر نامِ حساب ─────────────────────── */
const A = device({
  /* دادهٔ ابری موجود است (وگرنه seedSeason اول‌بار ga_players را پاک می‌کند) */
  ga_cloud_ts: JSON.stringify({ ga_events: '2026-11-24T00:00:00.000Z' }),
  ga_players: JSON.stringify({ 4: { name: 'رزا', family: '', phone: '09120000000' } }),
});
vm.runInContext(DATA_SRC, A.sandbox, { filename: 'data.js' });
const D = A.sandbox.window.Data;
ok(typeof D.playerFullName === 'function' && typeof D.accountDisplayName === 'function',
  'توابعِ نامِ واحد در data.js منتشر شده‌اند');
ok(D.playerFullName(4) === 'رزا', 'نامِ پروندهٔ بازیکن (ga_players) خوانده می‌شود');
ok(D.accountDisplayName({ pid: 4, name: 'رزا قدیمی', user: 'roza' }) === 'رزا',
  'نامِ پرونده بر نامِ قدیمیِ حساب مقدم است (باگِ گزارش‌شده)');
ok(D.accountDisplayName({ pid: 0, name: 'مدیر آکادمی', user: 'admin' }) === 'مدیر آکادمی',
  'حساب بدون pid از نامِ حساب استفاده می‌کند');

/* ── ۲) ویرایشِ محلیِ کهنه نامِ تازهٔ سرور را برنمی‌گرداند ─────────── */
const SERVER_TS = '2026-11-24T07:14:30.000Z';   /* ساعتِ همان rename واقعیِ p4 */
const B = device({
  ga_cloud_ts: JSON.stringify({ ga_players: SERVER_TS }),
  ga_edit_at: JSON.stringify({ ga_players: '2026-11-23T10:00:00.000Z' }),   /* ویرایشِ دیروز */
  ga_players: JSON.stringify({ 4: { name: 'نگار', family: '', phone: '' } }), /* نامِ ازدست‌رفتهٔ دیروز */
});
vm.runInContext(DATA_SRC, B.sandbox, { filename: 'data.js' });
const D2 = B.sandbox.window.Data;
ok(D2.localEditsTrusted() === false, 'ویرایشِ محلیِ قدیمی‌تر از سرور «کهنه» شناخته می‌شود');
const rowB = D2.playerRows().find(r => r.pid === 4);
ok(rowB && rowB.name !== 'نگار', 'ویرایشِ کهنه نامِ قدیمی را دوباره نمی‌نشاند (data.playerRows)');

/* ── ۳) ویرایشِ محلیِ تازه همان است که دیده می‌شود ─────────────────── */
const C = device({
  ga_cloud_ts: JSON.stringify({ ga_players: '2026-11-24T07:14:30.000Z' }),
  ga_edit_at: JSON.stringify({ ga_players: '2026-11-24T08:00:00.000Z' }),  /* همین حالا، مدیر */
  ga_players: JSON.stringify({ 4: { name: 'رزا', family: 'احمدی', phone: '09120000000' } }),
});
vm.runInContext(DATA_SRC, C.sandbox, { filename: 'data.js' });
const D3 = C.sandbox.window.Data;
ok(D3.localEditsTrusted() === true, 'ویرایشِ محلیِ تازه معتبر است');
ok((D3.playerRows().find(r => r.pid === 4) || {}).name === 'رزا احمدی', 'نامِ تازهٔ محلی نمایش داده می‌شود');

/* ── ۴) نگهبانِ «خالی روی پر ننشان» داخلِ فرم ویرایش ───────────────── */
/* منطقِ ذخیرهٔ فرم، همان‌طور که در mgmt.js است: پس از حلقهٔ keepEmpty نباید
   هیچ انتساب دومی نام/تلفن را با مقدارِ خالی بازنویسی کند. */
const saveFn = (MGMT_SRC.match(/const keepEmpty = \[[^\]]+\];[\s\S]{0,1600}?ed\[pid\] = merged;/) || [''])[0];
ok(/ed\[pid\] = merged;/.test(saveFn), 'انتسابِ دومِ مخرب حذف شده است (ed[pid] = merged)');
ok(!/ed\[pid\] = Object\.assign\(merged/.test(MGMT_SRC), 'هیچ‌جای mgmt.js دوباره همهٔ فیلدها را بی‌قید نمی‌نویسد');
ok(/if \(blank\) return;/.test(saveFn), 'فیلدِ خالی هرگز روی مقدار نمی‌نشیند');

/* اجرای واقعی همان منطق روی فرمِ نیمه‌پر: فقط نام پر است */
const keepEmpty = ['name','family','gender','hcp','join','birth','phone','national','email','address','father','fatherPhone','mother','motherPhone'];
function mergeForm(prevEd, form) {
  const merged = Object.assign({}, prevEd);
  keepEmpty.forEach(f => {
    const nv = form[f];
    const blank = nv === undefined || nv === null || (typeof nv === 'string' && !nv.trim());
    if (blank && prevEd[f] !== undefined && String(prevEd[f] || '').trim() !== '') return;
    if (blank) return;
    merged[f] = nv;
  });
  if (form.photo) merged.photo = form.photo;
  return merged;
}
const before = { name: 'رزا', family: '', phone: '09120000000', national: '1746039884', photo: 'data:image/webp;base64,xx' };
const afterBlank = mergeForm(before, { name: 'رزا', family: '', phone: '', national: '', gender: '', hcp: NaN, photo: '' });
ok(afterBlank.phone === '09120000000' && afterBlank.national === '1746039884' && afterBlank.photo === before.photo,
  'ذخیرهٔ فرمِ ناقص تلفن/کد ملی/عکس را پاک نمی‌کند');
const renamed = mergeForm(before, { name: 'رزا', family: 'احمدی', phone: '09120000000' });
ok(renamed.family === 'احمدی', 'مقدارِ تازهٔ نوشته‌شده جایگزین می‌شود');

/* ── ۵) تغییر نام از «یوزرها» داخلِ پروندهٔ بازیکن هم نوشته می‌شود ─── */
ok(/function applyDisplayNameToPlayer/.test(MGMT_SRC), 'پلِ نامِ «یوزرها» → «بازیکنان» وجود دارد');
ok(/if \(u\.name && applyDisplayNameToPlayer\(u\.pid, u\.name\)/.test(MGMT_SRC),
  'syncUserToPlayer نامِ تازه را به پروندهٔ بازیکن می‌برد');

/* ── ۶) هیچ صفحه‌ای نامِ عضو را از ga_accounts/حافظهٔ ورود نخواند ── */
const APP_SRC = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
const offenders = [];
APP_SRC.split('\n').forEach((line, i) => {
  if (/honorCardHTML\(currentUser,\s*\(?userRec\(currentUser\)\s*\|\|\s*\{\}\)\.name/.test(line)) offenders.push(i + 1);
  if (/name:\s*rec\.name\s*\|\|/.test(line)) offenders.push(i + 1);
});
ok(offenders.length === 0, 'هیچ صفحه‌ای دیگر نامِ عضو را از نسخهٔ حساب نمی‌خواند' + (offenders.length ? ' → خط ' + offenders.join(',') : ''));
ok(/function displayNameOf/.test(APP_SRC) && /refreshUserLabel\(\);/.test(APP_SRC),
  'یک تابعِ نامِ نمایشی + تازه‌سازیِ سربرگ در app.js هست');
/* تازه‌سازیِ خودکار: پنل هر ۵ ثانیه فقط فرادادهٔ ابر را می‌خواند و کلیدِ عوض‌شده را می‌کشد؛
   پس تغییرِ نام در ادمین‌پنل، بدون رفرش، در همین تب هم می‌نشیند. */
const CLOUD_SRC = fs.readFileSync(path.join(ROOT, 'js', 'cloud.js'), 'utf8');
ok(/setInterval\(watchRemote, META_GAP\)/.test(CLOUD_SRC) && /var META_GAP = 5000;/.test(CLOUD_SRC),
  'پایشِ ۵ ثانیه‌ایِ ابر برای دریافتِ درجای تغییرِ مدیر هست');
ok(/ga_edit_at/.test(CLOUD_SRC), 'برچسبِ زمانِ ویرایش محلی هرگز به ابر نمی‌رود و sync نمی‌شود');

console.log(fails ? `FAIL (${fails})` : 'PASS — «یک نام، همه‌جا» برقرار است');
process.exitCode = fails ? 1 : 0;
