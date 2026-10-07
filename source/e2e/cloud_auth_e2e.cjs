/* حساب‌های ابری + مجوز نوشتن + حذف نوشتن‌های هنگام ورود — E2E مرورگری (هرمتیک).
 * همهٔ ترافیک Supabase با mock_cloud.cjs پاسخ داده می‌شود و هر میزبان دیگری abort می‌شود.
 * پیش‌نیاز: python3 source/build_standalone.py  (خروجی source/GolfAcademy_PRO.html)
 * اجرا: NODE_PATH=…/node_modules CHROME=…/chrome node source/e2e/cloud_auth_e2e.cjs
 */
const path = require('path');
const { chromium } = require('playwright-core');
const { createMockCloud } = require('./mock_cloud.cjs');
const HTML = process.env.HTML || path.join(__dirname, '..', 'GolfAcademy_PRO.html');
const EXE = process.env.CHROME || undefined;
const BASE = 'https://qa.local/index.html';

const BATTLE = { v: 1, teams: [{ id: 'q1', name: 'تیم واقعی ابر', icon: '🦅', color: '#D4AF37', members: [1] }], matches: [], settings: { winPts: 3, drawPts: 1, lossPts: 0, seasonWinPts: 3, seasonDrawPts: 1, seasonLossPts: 0, seasonEnabled: true } };
const SUBS = [{ id: 'sqa-p1', plan: 'trial', user: 'p1', user_id: 101, status: 'trial', start_date: '2026-01-01', end_date: '2099-01-01', start_at: '2026-01-01', end_at: '2099-01-01', events: [] }];
const FIXTURE = {
  ga_battle: BATTLE,
  ga_subscriptions: SUBS,
  ga_avatars: { p1: { v6: 1, gender: 'm', sel: {}, owned: [], lvl: 8 } },   // قالب v6 و سطحِ هم‌خوان با نتایج داخلی تا به‌روزرسانی واقعی یک‌باره رخ ندهد
  ga_coins: { p1: { total: 40, log: [], v7auto: 1 } },
  ga_email_cfg: { key: 'qa', svc: 'qa', tpl: 'template_qa' },
  ga_sp_sessions: { sqa1: { id: 'sqa1', pid: 1, status: 'closed', openedAt: '2026-09-01T10:00:00.000Z', closedAt: '2026-09-01T11:00:00.000Z' }, sqa2: { id: 'sqa2', pid: 2, status: 'closed', openedAt: '2026-09-02T10:00:00.000Z', closedAt: '2026-09-02T11:00:00.000Z' } },
};
const ACCOUNTS = [
  { id: 1, user: 'admin', pass: 'Admin-Pass-QA1', name: 'مدیر آکادمی', role: 'admin', main: true },
  { id: 101, user: 'p1', pass: 'Member-Pass-QA1', name: 'بازیکن یک', role: 'member', pid: 1 },
  { id: 102, user: 'p2', pass: 'Member-Pass-QA2', name: 'بازیکن دو', role: 'member', pid: 2, active: false },
];

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS' : 'FAIL') + ' | ' + m); };

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  async function device() {
    const cloud = createMockCloud({ store: JSON.parse(JSON.stringify(FIXTURE)), accounts: ACCOUNTS });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await cloud.attach(ctx, HTML);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    return { cloud, ctx, page, errors };
  }
  async function login(page, u, p) {
    await page.waitForSelector('#login.on', { timeout: 20000 });
    await page.fill('#login-user', u);
    await page.fill('#login-pass', p);
    await page.click('#login-form button[type="submit"]');
    await page.waitForFunction(() => document.getElementById('app').classList.contains('on') || (document.getElementById('login-err') || {}).textContent, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  const inApp = page => page.evaluate(() => document.getElementById('app').classList.contains('on'));
  const allStorage = page => page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });

  /* ── ۱) دستگاه تازه: هیچ یوزر پیش‌فرضی ساخته نمی‌شود؛ golf1405 کار نمی‌کند ── */
  {
    const { cloud, ctx, page } = await device();
    await page.waitForSelector('#login.on', { timeout: 20000 });
    await page.waitForTimeout(1500);
    const ls = await allStorage(page);
    ok(ls.ga_users == null && !Object.values(ls).some(v => /golf1405/.test(v)), 'دستگاه تازه: ga_users ساخته نشد و رمز golf1405 هیچ‌جا نیست');
    ok(!cloud.log.some(e => e.kind === 'read' && e.auth), 'قبل از ورود فقط خواندن مهمان (بدون توکن)');
    await login(page, 'admin', 'golf1405');
    ok(!(await inApp(page)), 'ورود با admin/golf1405 رد شد');
    const err = await page.locator('#login-err').innerText();
    ok(/اشتباه/.test(err), 'پیام خطای ورود: ' + err.trim().slice(0, 60));
    await login(page, 'p2', 'Member-Pass-QA2');
    ok(!(await inApp(page)), 'حساب غیرفعال وارد نمی‌شود');
    await ctx.close();
  }

  /* ── ۲) عضو: ورود ابری، نقش از سرور، نوشتن فقط سهم خودش، بدون نوشتنِ هنگام ورود ── */
  {
    const { cloud, ctx, page, errors } = await device();
    await login(page, 'p1', 'Member-Pass-QA1');
    ok(await inApp(page), 'عضو p1 با رمز ابری وارد شد');
    ok(await page.evaluate(() => APP.currentUser() === 'p1' && !APP.isAdmin()), 'نقش عضو از ga_accounts (نه از دستگاه)');
    ok(cloud.log.some(e => e.kind === 'read' && e.uid === 'uid-p1'), 'دریافت داده پس از ورود با توکن عضو');
    await page.waitForTimeout(7000);
    const ls = await allStorage(page);
    ok(!Object.values(ls).some(v => /Member-Pass-QA1/.test(v)), 'رمز عضو در localStorage ذخیره نشد');
    ok(!!ls.pc_auth_v1 && ls.ga_users == null, 'نشست در pc_auth_v1 (بدون همگام‌سازی) و ga_users وجود ندارد');
    ok(JSON.parse(ls.ga_battle || 'null') && JSON.parse(ls.ga_battle).teams[0].name === 'تیم واقعی ابر', 'نبرد میدان‌ها: مقدار ابر اعمال شد، پیش‌فرض جایگزینش نشد');
    const boot = cloud.log.filter(e => e.kind === 'sync' && e.action === 'kv');
    ok(!boot.some(e => (e.same || []).length), 'هیچ نوشتن تکراری (هم‌مقدار با ابر) از دستگاه عضو');
    ok(boot.length === 0, 'هیچ نوشتن kv هنگام ورود عضو (قبلاً ga_battle/ga_sp_* در هر بار ورود): ' + JSON.stringify(boot.map(e => e.keys)));
    ok(!cloud.log.some(e => e.kind === 'sync' && e.action === 'public'), 'عضو هیچ انتشار عمومی (سکو/تقویم) نمی‌فرستد');

    const added = await page.evaluate(() => AV.cartAdd('p1', (AV.shop().find(i => +i.price > 0) || {}).id || 'x'));
    ok(added && added.ok, 'افزودن آیتم پولی به سبد: ' + (added && added.msg));
    await page.evaluate(() => localStorage.setItem('ga_results', JSON.stringify({ hacked: 1 })));
    await page.waitForTimeout(6000);
    const kv = cloud.log.filter(e => e.kind === 'sync' && e.action === 'kv');
    ok(kv.some(e => e.keys.includes('ga_cart') && e.user === 'p1' && e.status === 200), 'تغییر سبد عضو با توکن خودش ارسال شد');
    ok(!kv.some(e => e.keys.includes('ga_results')), 'تغییر کلید مدیریتی روی دستگاه عضو اصلاً ارسال نشد');
    ok(!kv.some(e => e.status === 403 || e.status === 401), 'هیچ درخواست رد‌شده‌ای در صف عضو نماند');

    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('app').classList.contains('on'), null, { timeout: 20000 }).catch(() => {});
    ok(await inApp(page), 'بازگشایی صفحه: نشست ابری بدون رمز بازیابی شد');
    await page.click('#logout-btn');
    await page.waitForSelector('#login.on', { timeout: 20000 });
    const ls2 = await allStorage(page);
    ok(!ls2.pc_auth_v1 && !ls2.ga_session, 'خروج: نشست پاک شد');
    ok(cloud.log.some(e => e.kind === 'auth' && e.action === 'logout'), 'خروج در سرور هم ثبت شد');
    ok(errors.length === 0, 'بدون خطای صفحه' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }

  /* ── ۳) مدیر: دستگاه تازه — نوشتن هنگام ورود فقط اگر واقعاً تغییری باشد ── */
  {
    const { cloud, ctx, page, errors } = await device();
    await login(page, 'admin', 'Admin-Pass-QA1');
    ok(await inApp(page), 'مدیر با رمز ابری وارد شد');
    ok(await page.evaluate(() => APP.isAdmin() && APP.isMain()), 'نقش مدیر اصلی از ga_accounts');
    await page.waitForTimeout(9000);
    const kv = cloud.log.filter(e => e.kind === 'sync' && e.action === 'kv');
    ok(!kv.some(e => (e.same || []).length), 'هیچ نوشتن تکراری (هم‌مقدار با ابر) از دستگاه مدیر: ' + JSON.stringify(kv.map(e => e.same)));
    const bad = kv.filter(e => e.keys.some(k => ['ga_battle', 'ga_sp_sessions', 'ga_sp_shots'].includes(k)));
    ok(bad.length === 0, 'ورود مدیر روی دستگاه تازه: ga_battle/ga_sp_* بازنویسی نشد ' + JSON.stringify(kv.map(e => e.keys)));
    const ls = await allStorage(page);
    ok(JSON.parse(ls.ga_battle).teams[0].name === 'تیم واقعی ابر', 'نبرد میدان‌ها روی دستگاه مدیر هم همان مقدار ابر است');
    ok(kv.every(e => e.uid === 'uid-admin'), 'نوشتن‌های مدیر با توکن مدیر');
    // همان داده با ترتیب دیگری از کلیدها دوباره ذخیره شود (رفتار واقعی ga_sp_sessions روی پنل زنده) → ارسال نشود
    const n0 = cloud.log.filter(e => e.kind === 'sync' && e.action === 'kv').length;
    await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('ga_sp_sessions')); const r = {}; Object.keys(o).reverse().forEach(k => { const x = o[k], y = {}; Object.keys(x).reverse().forEach(f => { y[f] = x[f]; }); r[k] = y; }); localStorage.setItem('ga_sp_sessions', JSON.stringify(r)); });
    await page.waitForTimeout(5000);
    ok(cloud.log.filter(e => e.kind === 'sync' && e.action === 'kv').length === n0, 'ذخیرهٔ دوبارهٔ همان مقدار با ترتیب دیگر (ga_sp_sessions) ارسال نشد');
    // تغییر موقت و برگشت پیش از ارسال (رفتار restoreLegacyPractice/stripSp هنگام ورود) → درخواستی نرود
    await page.evaluate(() => { const raw = localStorage.getItem('ga_sp_sessions'); const o = JSON.parse(raw); o.legacyTmp = { id: 'legacyTmp', pid: 3, status: 'closed' }; localStorage.setItem('ga_sp_sessions', JSON.stringify(o)); setTimeout(() => localStorage.setItem('ga_sp_sessions', raw), 300); });
    await page.waitForTimeout(5000);
    ok(cloud.log.filter(e => e.kind === 'sync' && e.action === 'kv').length === n0, 'تغییر موقتی که پیش از ارسال برگشت، ارسال نشد');
    ok(await page.evaluate(() => !JSON.parse(localStorage.getItem('ga_cloud_dirty') || '{}').ga_sp_sessions), 'و از صف هم خارج شد');
    await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('ga_sp_sessions')); o.sqa1.note = 'تغییر واقعی'; localStorage.setItem('ga_sp_sessions', JSON.stringify(o)); });
    await page.waitForTimeout(5000);
    ok(cloud.log.some(e => e.kind === 'sync' && e.action === 'kv' && e.keys.includes('ga_sp_sessions') && e.status === 200), 'تغییر واقعی ga_sp_sessions ارسال شد');
    console.log('INFO | انتشار عمومی (سرور محتوای تکراری را نمی‌نویسد): ' + cloud.log.filter(e => e.action === 'public').length + ' درخواست');
    ok(errors.length === 0, 'بدون خطای صفحه' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
