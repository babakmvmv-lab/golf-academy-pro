/* تست ادغام اتحادی مسابقات — سمت مرورگر (source/js/cloud.js)
 * تابع‌ها عیناً از فایل تولیدی برداشته و در یک سندباکس اجرا می‌شوند (بدون شبکه).
 * اجرا: node source/e2e/tour_merge_client_test.cjs
 */
const fs = require('fs'), path = require('path'), assert = require('assert');

function grab(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('تابع پیدا نشد: ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error('بدنهٔ بسته نشده: ' + name);
}

const src = fs.readFileSync(path.join(__dirname, '../js/cloud.js'), 'utf8');
const names = ['normText', 'djb2', 'tourKeyOf', 'parseTourList', 'pruneTourDel', 'unionTourDel', 'mergeTourList'];
const block = "var TOUR_DEL_DAYS = 180;\n" + names.map(n => grab(src, n)).join('\n');
const C = new Function(block + '\nreturn { tourKeyOf, parseTourList, pruneTourDel, unionTourDel, mergeTourList };')();

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('PASS | ' + m); };
const J = a => JSON.stringify(a);

const A = { name: 'پات کلاب 7', date: '2026-10-22', lvl: 3, course: 1, holes: 6 };
const B = { uid: 'Tmini1', name: 'مینی گلف پات کلاب ۱', date: '2026-10-14', lvl: 4, course: 0, holes: 3 };
const T6 = { name: 'پات کلاب ۶', date: '2026-10-08', lvl: 3, course: 1, holes: 3 };

/* ۱) سناریوی حادثه: دستگاه نسخهٔ قدیمی دارد؛ pull نباید مسابقهٔ ابری را حذف کند */
let merged = JSON.parse(C.mergeTourList(J([A, T6]), J([A, B, T6]), []));
ok(merged.length === 3 && merged.some(t => t.name === B.name), 'نسخهٔ قدیمیِ دستگاه، مسابقهٔ مینی‌گلف ابری را پاک نمی‌کند');

/* ۲) مسابقهٔ محلی که هنوز ارسال نشده، بعد از pull می‌ماند */
merged = JSON.parse(C.mergeTourList(J([A, T6, B]), J([A, T6]), []));
ok(merged.length === 3 && merged[2].name === B.name, 'مسابقهٔ ارسال‌نشدهٔ این دستگاه بعد از pull حفظ می‌شود');

/* ۳) ویرایش محلی برنده است، بدون تکرار */
merged = JSON.parse(C.mergeTourList(J([Object.assign({}, A, { holes: 9 }), T6]), J([A, T6]), []));
ok(merged.length === 2 && merged.find(t => t.name === A.name).holes === 9, 'ویرایش محلی اعمال می‌شود و رکورد تکراری نمی‌شود');

/* ۴) حذف (تومب‌استون) در هر دو سمت اعمال می‌شود */
const tomb = [{ k: C.tourKeyOf(B), at: new Date().toISOString() }];
merged = JSON.parse(C.mergeTourList(J([A, B, T6]), J([A, B, T6]), tomb));
ok(merged.length === 2 && !merged.some(t => t.name === B.name), 'مسابقهٔ حذف‌شده با pull برنمی‌گردد');

/* ۵) هویت پایدار: uid بر نام/تاریخ اولویت دارد */
ok(C.tourKeyOf(B) === 'UTmini1', 'مسابقهٔ دارای uid با uid شناسایی می‌شود');
const renamed = Object.assign({}, B, { name: 'مینی گلف (اصلاح‌شده)' });
merged = JSON.parse(C.mergeTourList(J([renamed, A]), J([B, A]), []));
ok(merged.length === 2, 'تغییر نام مسابقهٔ دارای uid رکورد تکراری نمی‌سازد');

/* ۶) اجتماع سیاههٔ حذف + هرس کهنه */
let del = C.unionTourDel([{ k: 'U1', at: new Date().toISOString() }], [{ k: 'U1', at: new Date().toISOString() }, { k: 'U2', at: new Date().toISOString() }]);
ok(del.length === 2, 'سیاههٔ حذف: اجتماع بدون تکرار');
ok(C.pruneTourDel([{ k: 'old', at: '2020-01-01T00:00:00.000Z' }]).length === 0, 'سیاههٔ حذفِ کهنه حذف می‌شود');

/* ۷) محتوای خالی دو طرف */
ok(C.mergeTourList(null, null, []) === '[]', 'ورودی خالی → []');
ok(C.mergeTourList(null, J([A]), []) === J([A]), 'دستگاه تازه، فهرست ابری را عیناً می‌گیرد');

console.log('\n' + n + ' تست موفق');
