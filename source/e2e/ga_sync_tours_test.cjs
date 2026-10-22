/* تست ادغام اتحادی مسابقات — سمت لبه (ga-sync/index.ts)
 * اجرا: node source/e2e/ga_sync_tours_test.cjs
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
    .replace(/\)\s*:\s*(any|boolean|string)(\[\])?\s*\{/g, ') {')
    .replace(/(\w)\s*:\s*(any|string|boolean)(\[\])?/g, '$1');
}
const P = new Function(js + '\nreturn { mergeTours, mergeTourDel, mergeByTour, tourKeyOf };')();
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('PASS | ' + m); };

const A = { name: 'پات کلاب 7', date: '2026-10-22', lvl: 3, course: 1, holes: 6 };
const B = { name: 'مینی گلف پات کلاب ۱', date: '2026-10-14', lvl: 4, course: 0, holes: 3 };
const C = { name: 'پات کلاب ۶', date: '2026-10-08', lvl: 3, course: 1, holes: 3 };

// ۱) نسخهٔ قدیمی (بدون مسابقهٔ تازه) نباید مسابقهٔ ابری را پاک کند
let out = P.mergeTours([A, B, C], [A, C], []);
ok(out.length === 3 && out.some(t => t.name === B.name), 'آرایهٔ قدیمی، مسابقهٔ ابری را حذف نمی‌کند');

// ۲) مسابقهٔ تازهٔ دستگاه دیگر اضافه می‌شود
out = P.mergeTours([A, C], [A, C, B], []);
ok(out.length === 3 && out[2].name === B.name, 'مسابقهٔ تازه به انتهای فهرست اضافه می‌شود');

// ۳) ویرایش همان مسابقه، نسخهٔ تازه‌تر را جایگزین می‌کند (بدون تکرار)
const A2 = Object.assign({}, A, { holes: 9 });
out = P.mergeTours([A, C], [A2], []);
ok(out.length === 2 && out.find(t => t.name === A.name).holes === 9, 'ویرایش، تکراری نمی‌سازد و اعمال می‌شود');

// ۴) ترتیب اصلی حفظ می‌شود
out = P.mergeTours([C, A], [A], []);
ok(out.map(t => t.name).join(',') === [C, A].map(t => t.name).join(','), 'ترتیب فهرست ابری حفظ می‌شود');

// ۵) حذف با سیاهه: با ادغام دوباره زنده نمی‌شود
const tomb = [{ k: P.tourKeyOf(B), at: new Date().toISOString() }];
out = P.mergeTours([A, B, C], [A, B, C], tomb);
ok(out.length === 2 && !out.some(t => t.name === B.name), 'مسابقهٔ حذف‌شده با ادغام زنده نمی‌شود');

// ۶) ادغام سیاههٔ حذف: اجتماع دو دستگاه بدون تکرار
let del = P.mergeTourDel([{ k: 'U1', at: '2026-10-20T00:00:00.000Z' }], [{ k: 'U1', at: '2026-10-21T00:00:00.000Z' }, { k: 'U2', at: '2026-10-21T00:00:00.000Z' }]);
ok(del.length === 2, 'سیاههٔ حذف: اجتماع بدون تکرار');

// ۷) سیاههٔ کهنه (بیش از ۱۸۰ روز) پاک می‌شود
del = P.mergeTourDel([{ k: 'old', at: '2020-01-01T00:00:00.000Z' }], []);
ok(del.length === 0, 'سیاههٔ حذفِ کهنه هرس می‌شود');

// ۸) هویت پایدار: uid بر نام/تاریخ اولویت دارد (ویرایش نام، هویت را عوض نمی‌کند)
const withUid = { uid: 'abc', name: 'نام قدیم', date: '2026-10-01', lvl: 2, course: 1, holes: 9 };
const renamed = Object.assign({}, withUid, { name: 'نام جدید' });
out = P.mergeTours([withUid], [renamed], []);
ok(out.length === 1 && out[0].name === 'نام جدید', 'با uid، تغییر نام رکورد تکراری نمی‌سازد');

// ۹) ورودیِ خالیِ دستگاه قدیمی، فهرست ابری را خالی نمی‌کند
out = P.mergeTours([A, B], [], []);
ok(out.length === 2, 'آرایهٔ خالی، فهرست ابری را پاک نمی‌کند');

// ۱۰) نتایج: دو پنل هم‌زمان، نتیجهٔ دو مسابقهٔ مختلف همدیگر را پاک نمی‌کنند
const r1 = { '1000': { ts: '2026-09-07', top: { 1: 2 } } };
const r2 = { '1001': { ts: '2026-09-08', top: { 1: 7 } } };
let res = P.mergeByTour(r1, r2, {});
ok(res['1000'] && res['1001'], 'نتایج: نتیجهٔ مسابقهٔ دیگر حفظ می‌شود');

// ۱۱) نتایج: حذف صریح با سیاهه اعمال می‌شود
res = P.mergeByTour({ '1000': { ts: 'x' }, '1001': { ts: 'y' } }, { '1000': { ts: 'x' } }, { '1001': 1 });
ok(!!res['1000'] && !res['1001'], 'نتایج: حذفِ نشان‌دار اعمال می‌شود');

console.log('\n' + n + ' تست موفق');
