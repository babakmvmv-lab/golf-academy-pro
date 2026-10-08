/* ga-sync v2 — تست منطق مجوز/ادغام نوشتن عضو (بدون شبکه، بدون داده زنده).
 * بخش POLICY-START…POLICY-END از supabase/functions/ga-sync/index.ts برداشته و ترنسپایل می‌شود.
 * اجرا: node source/e2e/ga_sync_policy_test.cjs   (typescript اختیاری: NODE_PATH=…/node_modules)
 */
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '../../supabase/functions/ga-sync/index.ts'), 'utf8');
const block = src.split('/* POLICY-START')[1].split('/* POLICY-END */')[0].replace(/^[^\n]*\n/, '');
let js;
try {
  const ts = require('typescript');
  if (typeof ts.transpileModule !== 'function') throw new Error('ts api');
  js = ts.transpileModule(block, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
} catch (e) {
  js = block.replace(/\)\s*:\s*\{[^}]*\}\s*\{/g, ') {').replace(/:\s*Record<[^>]+>/g, '')
    .replace(/\)\s*:\s*(any|boolean|string)\s*\{/g, ') {').replace(/(\w)\s*:\s*(any|string|boolean)\b/g, '$1');
}
const P = new Function(js + '\nreturn { MEMBER_KEYS, mergeMember, sameJson, mergePlayers };')();
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('PASS | ' + m); };

// کلیدهای مجاز عضو
ok(!P.MEMBER_KEYS.ga_users && !P.MEMBER_KEYS.ga_subscriptions && !P.MEMBER_KEYS.ga_honor && !P.MEMBER_KEYS.ga_battle, 'کلیدهای مدیریتی برای عضو مجاز نیستند');
ok(P.mergeMember('ga_results', {}, {}, 'p1').ok === false, 'کلید غیرمجاز رد می‌شود');

// own: فقط سهم خودش
let r = P.mergeMember('ga_avatars', { p1: { a: 1 }, p2: { a: 2 } }, { p1: { a: 9 }, p2: { a: 666 }, p3: { x: 1 } }, 'P1');
ok(r.ok && r.v.p1.a === 9 && r.v.p2.a === 2 && !r.v.p3, 'آواتار: فقط سهم خودِ عضو عوض می‌شود');
r = P.mergeMember('ga_cart', { P1: [1] }, { p1: [1, 2] }, 'p1');
ok(r.ok && JSON.stringify(r.v) === '{"p1":[1,2]}', 'سبد: کلید با حروف متفاوت یکی می‌شود');
r = P.mergeMember('ga_fav', { p2: [5] }, {}, 'p1');
ok(r.ok && JSON.stringify(r.v) === '{"p2":[5]}', 'بدون سهم عضو، ابر دست‌نخورده');

// coins: فقط خرج
r = P.mergeMember('ga_coins', { p1: { total: 50, log: [] } }, { p1: { total: 30, log: [{ amount: -20 }] } }, 'p1');
ok(r.ok && r.v.p1.total === 30, 'سکه: خرج‌کردن مجاز');
r = P.mergeMember('ga_coins', { p1: { total: 50, log: [] } }, { p1: { total: 5000, log: [] } }, 'p1');
ok(!r.ok, 'سکه: افزایش موجودی توسط عضو رد می‌شود');
r = P.mergeMember('ga_coins', { p2: { total: 10 } }, { p1: { total: 0, log: [] }, p2: { total: 999 } }, 'p1');
ok(r.ok && r.v.p2.total === 10 && r.v.p1.total === 0, 'سکه: کیف دیگران دست‌نخورده');

// reads: فقط خوانده‌شدن خودش، بدون بازنویسی
r = P.mergeMember('ga_msg_reads', { m1: { p2: 't0' } }, { m1: { p1: 't1', p2: 'HACK' }, m2: { p1: 't2' } }, 'p1');
ok(r.ok && r.v.m1.p2 === 't0' && r.v.m1.p1 === 't1' && r.v.m2.p1 === 't2', 'خواندن پیام: فقط رکورد خودِ عضو');

// coinreq: فقط درخواست تازهٔ در انتظار برای خودش
const cur = [{ id: 'r1', user: 'p1', status: 'pending', amount: 5 }, { id: 'r2', user: 'p2', status: 'pending' }];
r = P.mergeMember('ga_coinreq', cur, [
  { id: 'r1', user: 'p1', status: 'ok', amount: 5 },              // تأیید خودسرانه
  { id: 'r2', user: 'p2', status: 'no' },                          // دستکاری دیگری
  { id: 'r3', user: 'p1', status: 'ok', by: 'me', amount: 7 },     // تازه ولی با وضعیت جعلی
  { id: 'r4', user: 'p2', status: 'pending' }                      // به نام دیگری
], 'p1');
ok(r.ok && r.v.length === 3 && r.v[0].status === 'pending' && r.v[1].status === 'pending', 'درخواست سکه: وضعیت درخواست‌های موجود عوض نمی‌شود');
ok(r.v[2].id === 'r3' && r.v[2].status === 'pending' && !('by' in r.v[2]), 'درخواست سکه: درخواست تازه همیشه «در انتظار»');

ok(P.sameJson({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 }), 'مقایسهٔ محتوا مستقل از ترتیب کلیدها (نوشتنِ بی‌اثر انجام نمی‌شود)');

// ga_players (حادثهٔ ۱۷ مهر ۱۴۰۵): نسخهٔ بذرِ ناقص دستگاه نباید مشخصات/عکس سرور را پاک کند
{
  const cur = { 1: { name: 'بابک', family: 'moradvand', photo: 'data:a', phone: '09' }, 2: { name: 'مهشید', photo: 'data:b' } };
  let m = P.mergePlayers(cur, { 1: { birth: '1987-03-21', family: 'مرادوند', photo: '' }, 2: { birth: '2009-03-21' } });
  ok(m[1].photo === 'data:a' && m[2].photo === 'data:b', 'بازیکنان: عکسِ خالی عکس سرور را پاک نمی‌کند');
  ok(m[1].family === 'مرادوند' && m[1].phone === '09' && m[2].name === 'مهشید', 'بازیکنان: ویرایش اعمال می‌شود و فیلدهای غایب می‌مانند');
  m = P.mergePlayers(cur, { 3: { name: 'تازه' } });
  ok(m[1].name === 'بابک' && m[2].name === 'مهشید' && m[3].name === 'تازه', 'بازیکنان: بازیکنِ غایب حذف نمی‌شود');
  ok(P.sameJson(P.mergePlayers(cur, { __del: 1 }), cur), 'بازیکنان: حذف کل کلید پذیرفته نیست');
  ok(P.mergePlayers(cur, { 1: { photo: 'data:new' } })[1].photo === 'data:new', 'بازیکنان: تعویض عکس کار می‌کند');
}

// سه تابع لبه از نظر نحوی سالم‌اند
try {
  const ts = require('typescript');
  if (typeof ts.transpileModule !== 'function') { const e = new Error('ts api'); e.code = 'MODULE_NOT_FOUND'; throw e; }
  ['ga-sync', 'ga-accounts', 'ga-mail'].forEach(f => {
    const code = fs.readFileSync(path.join(__dirname, '../../supabase/functions', f, 'index.ts'), 'utf8');
    const out = ts.transpileModule(code, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
    ok(!(out.diagnostics || []).length, 'نحو تابع ' + f + ' سالم است');
  });
} catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; console.log('SKIP | typescript نصب نیست؛ بررسی نحو توابع رد شد'); }
console.log('\n' + n + ' PASS');
