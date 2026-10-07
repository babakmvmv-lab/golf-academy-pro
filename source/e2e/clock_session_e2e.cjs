/* ساعت اشتباه دستگاه + نشست‌های باطل + نسخهٔ جدید — E2E مرورگری (هرمتیک، بدون نوشتن زنده).
 * مشکل گزارش‌شده (۱۴۰۵/۰۷/۱۵): مدیر p1 را تغییر داد، پاک کردن کش مرورگر اثری نداشت و فقط مرورگر دیگر تغییر را نشان داد.
 * علت: دستگاهی با ساعت ۲۴ ساعت جلو، «زمان نسخه» را در آینده ثبت کرده بود؛ مرورگرهایی که آن زمان را دیده بودند
 * تغییرات بعدی را «قدیمی» می‌دانستند. این آزمون همهٔ مسیرهای اصلاح‌شده را می‌سنجد.
 * اجرا: NODE_PATH=…/node_modules CHROME=…/chrome node source/e2e/clock_session_e2e.cjs
 */
const path = require('path');
const { chromium } = require('playwright-core');
const { createMockCloud } = require('./mock_cloud.cjs');
const HTML = process.env.HTML || path.join(__dirname, '..', 'GolfAcademy_PRO.html');
const EXE = process.env.CHROME || undefined;
const BASE = 'https://qa.local/index.html';
const DAY = 86400000;

const BATTLE = { v: 1, teams: [{ id: 'q1', name: 'تیم ابر', icon: '🦅', color: '#D4AF37', members: [1] }], matches: [], settings: { winPts: 3, drawPts: 1, lossPts: 0, seasonWinPts: 3, seasonDrawPts: 1, seasonLossPts: 0, seasonEnabled: true } };
const SUB = (over) => Object.assign({ id: 'sqa-p1', plan: 'trial', user: 'p1', user_id: 101, status: 'trial', start_date: '2026-01-01', end_date: '2099-01-01', start_at: '2026-01-01', end_at: '2099-01-01', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', events: [] }, over || {});
const FIXTURE = () => ({
  ga_battle: JSON.parse(JSON.stringify(BATTLE)),
  ga_subscriptions: [SUB()],
  ga_avatars: { p1: { v6: 1, gender: 'm', sel: {}, owned: [], lvl: 8 } },
  ga_coins: { p1: { total: 40, log: [], v7auto: 1 } },
});
const ACCOUNTS = [
  { id: 1, user: 'admin', pass: 'Admin-Pass-QA1', name: 'مدیر آکادمی', role: 'admin', main: true },
  { id: 101, user: 'p1', pass: 'Member-Pass-QA1', name: 'بازیکن یک', role: 'member', pid: 1 },
];

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS' : 'FAIL') + ' | ' + m); };
const IGNORE = /livePrep|Charts\.spark|sp-1/;

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  async function device(opts) {
    opts = opts || {};
    const cloud = createMockCloud({ store: FIXTURE(), accounts: ACCOUNTS });
    if (opts.serverOffset) cloud.clock.offsetMs = opts.serverOffset;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await cloud.attach(ctx, HTML);
    const page = await ctx.newPage();
    if (opts.clock) await page.clock.install();
    const errors = [];
    page.on('pageerror', e => { if (!IGNORE.test(e.message + (e.stack || ''))) errors.push(e.message); });
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    return { cloud, ctx, page, errors };
  }
  async function login(page, u, p) {
    await page.waitForSelector('#login.on', { timeout: 20000 });
    await page.fill('#login-user', u);
    await page.fill('#login-pass', p);
    await page.click('#login-form button[type="submit"]');
    await page.waitForFunction(() => document.getElementById('app').classList.contains('on'), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  const inApp = page => page.evaluate(() => document.getElementById('app').classList.contains('on'));
  const lsJson = (page, k) => page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, k);
  async function reload(page) { await page.reload({ waitUntil: 'load', timeout: 60000 }); await page.waitForTimeout(3500); }

  /* ── ۱) همان مشکل p1: مُهر «آینده» در ga_cloud_ts دیگر تغییرات بعدی را پنهان نمی‌کند ── */
  {
    const { cloud, ctx, page, errors } = await device();
    await login(page, 'admin', 'Admin-Pass-QA1');
    ok(await inApp(page), 'مدیر وارد شد');
    const future = new Date(Date.now() + DAY).toISOString();
    await page.evaluate(f => { const ts = JSON.parse(localStorage.getItem('ga_cloud_ts') || '{}'); ts.ga_battle = f; ts.ga_subscriptions = f; localStorage.setItem('ga_cloud_ts', JSON.stringify(ts)); }, future);
    const nb = JSON.parse(JSON.stringify(BATTLE)); nb.teams[0].name = 'تیم تغییرکرده در دستگاه دیگر';
    cloud.store.ga_battle = { v: nb, updated_at: new Date().toISOString() };
    await reload(page);
    const b = await lsJson(page, 'ga_battle');
    ok(b && b.teams && b.teams[0].name === 'تیم تغییرکرده در دستگاه دیگر', 'با وجود مهر آینده در مرورگر، تغییر جدید ابر اعمال شد (قبلاً تا ۲۴ ساعت دیده نمی‌شد)');

    /* ── ۲) رکورد اشتراکِ محلی با زمان آینده، ویرایش درستِ تازه‌تر را نمی‌پوشاند ── */
    await page.evaluate(f => {
      const all = JSON.parse(localStorage.getItem('ga_subscriptions') || '[]');
      const i = all.findIndex(s => s.id === 'sqa-p1');
      all[i] = Object.assign({}, all[i], { plan: 'trial', status: 'trial', updated_at: f });
      localStorage.setItem('ga_subscriptions', JSON.stringify(all));
    }, future);
    await page.waitForTimeout(2500);
    cloud.store.ga_subscriptions = { v: [SUB({ plan: 'enterprise', status: 'active', updated_at: new Date(Date.now() - 60000).toISOString() })], updated_at: new Date().toISOString() };
    await reload(page);
    const subs = await lsJson(page, 'ga_subscriptions');
    const s1 = (subs || []).find(s => s.id === 'sqa-p1') || {};
    ok(s1.plan === 'enterprise' && s1.status === 'active', 'ادغام اشتراک: نسخهٔ درستِ ابر برنده شد، نه رکورد محلیِ «آینده» (' + s1.plan + ')');
    ok(errors.length === 0, 'بدون خطای صفحه (مدیر) ' + errors.join(' | '));
    await ctx.close();
  }

  /* ── ۳) دستگاه با ساعت ۲۴ ساعت جلو: هشدار ساعت، مهر ارسال = زمان سرور، رکوردها با زمان سرور ── */
  {
    const { cloud, ctx, page, errors } = await device({ serverOffset: -DAY });
    await login(page, 'admin', 'Admin-Pass-QA1');
    ok(await inApp(page), 'مدیر روی دستگاهِ ساعت‌اشتباه وارد شد');
    const off = await page.evaluate(() => window.GA_CLOCK && GA_CLOCK.offset());
    ok(Math.abs(off + DAY) < 10000, 'اختلاف ساعت دستگاه با سرور تشخیص داده شد (' + Math.round(off / 3600000) + ' ساعت)');
    const warn = await page.evaluate(() => { const e = document.getElementById('ga-clock-warn'); return e ? e.textContent : ''; });
    ok(/ساعت\/تاریخ این دستگاه/.test(warn) && /جلوتر/.test(warn), 'هشدار «ساعت دستگاه جلوتر است» نمایش داده شد');
    const r = await page.evaluate(() => { const v = GA_SUB.updateById('sqa-p1', { auto_renew: true }); return v && v.updated_at; });
    const lag = Math.abs(Date.parse(r) - (Date.now() - DAY));
    ok(r && lag < 60000, 'ویرایش اشتراک با زمان سرور ثبت شد، نه ساعت دستگاه (' + r + ')');
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem('ga_cloud_dirty') || '{}').ga_subscriptions, null, { timeout: 20000 }).catch(() => {});
    const ts = await lsJson(page, 'ga_cloud_ts');
    const srv = cloud.store.ga_subscriptions && cloud.store.ga_subscriptions.updated_at;
    ok(ts && srv && Date.parse(ts.ga_subscriptions) === Date.parse(srv), 'مهر ارسال در مرورگر = زمان سرور (' + (ts && ts.ga_subscriptions) + ')');
    ok(Date.parse(ts.ga_subscriptions) < Date.now() - DAY / 2, 'مهر ذخیره‌شده دیگر «آینده» نیست');
    ok(errors.length === 0, 'بدون خطای صفحه (ساعت اشتباه) ' + errors.join(' | '));
    await ctx.close();
  }

  /* ── ۴) کلید مدیریتیِ گیرکرده در صف یک عضو، پارک می‌شود و مقدار ابر را مسدود نمی‌کند ── */
  {
    const { cloud, ctx, page, errors } = await device();
    await login(page, 'p1', 'Member-Pass-QA1');
    ok(await inApp(page), 'عضو p1 وارد شد');
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('ga_cloud_dirty') || '{}');
      localStorage.setItem('ga_battle', JSON.stringify({ v: 1, teams: [{ id: 'old', name: 'نسخهٔ قدیمی مدیر روی همین مرورگر', members: [] }], matches: [], settings: {} }));
      d.ga_battle = new Date().toISOString();
      localStorage.setItem('ga_cloud_dirty', JSON.stringify(d));
    });
    const nb = JSON.parse(JSON.stringify(BATTLE)); nb.teams[0].name = 'نسخهٔ جدید ابر';
    cloud.store.ga_battle = { v: nb, updated_at: new Date().toISOString() };
    await reload(page);
    const b = await lsJson(page, 'ga_battle');
    const d = await lsJson(page, 'ga_cloud_dirty') || {};
    const parked = await lsJson(page, 'ga_cloud_parked') || {};
    ok(b && b.teams && b.teams[0].name === 'نسخهٔ جدید ابر', 'عضو مقدار جدید ابر را می‌بیند (قبلاً صفِ گیرکرده آن را برای همیشه پنهان می‌کرد)');
    ok(!d.ga_battle, 'کلید مدیریتی از صف ارسالِ عضو خارج شد');
    ok(!!parked.ga_battle, 'نسخهٔ محلی حذف نشد؛ در ga_cloud_parked نگه داشته شد');

    /* ── ۵) مدیر رمز p1 را عوض کرد → نشست قبلی باطل → بارگذاری بعدی فرم ورود با پیام ── */
    cloud.revoke('p1');
    await reload(page);
    const onLogin = await page.evaluate(() => document.getElementById('login').classList.contains('on'));
    const msg = await page.evaluate(() => (document.getElementById('login-err') || {}).textContent || '');
    ok(onLogin && !(await inApp(page)), 'نشستِ باطل‌شده دیگر وارد پنل نمی‌شود');
    ok(/تغییر کرده/.test(msg), 'پیام «رمز یا وضعیت حساب شما تغییر کرده است» نمایش داده شد');
    ok(!(await page.evaluate(() => localStorage.getItem('pc_auth_v1'))), 'نشست محلی پاک شد');
    ok(errors.length === 0, 'بدون خطای صفحه (عضو) ' + errors.join(' | '));
    await ctx.close();
  }

  /* ── ۶) بازگشت به برگه: باطل شدن نشست / تغییر پروفایل / نسخهٔ جدید سایت ── */
  {
    const { cloud, ctx, page, errors } = await device({ clock: true });
    await login(page, 'p1', 'Member-Pass-QA1');
    ok(await inApp(page), 'p1 وارد شد (ساعت کنترل‌شده)');
    // تغییر نام توسط مدیر → با بازگشت به برگه صفحه تازه می‌شود
    cloud.accounts.p1.row.name = 'بابک (نام جدید)';
    await page.evaluate(() => { window.__mark = 1; });
    await page.clock.fastForward(61000);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(4000);
    const marked = await page.evaluate(() => window.__mark === 1).catch(() => false);
    const prof = await page.evaluate(() => window.GA_AUTH && GA_AUTH.profile() && GA_AUTH.profile().name).catch(() => '');
    ok(!marked && prof === 'بابک (نام جدید)', 'تغییر پروفایل با بازگشت به برگه اعمال شد (' + prof + ')');
    // نسخهٔ جدید سایت → دکمهٔ تازه‌سازی
    cloud.site.lastModified = new Date(Date.now() + 3600000).toUTCString();
    await page.clock.fastForward(31000);
    await page.waitForTimeout(2500);
    const btn = await page.evaluate(() => { const b = document.getElementById('pc-new-version'); return b ? b.textContent : ''; });
    ok(/نسخهٔ جدید/.test(btn), 'دکمهٔ «نسخهٔ جدید — تازه‌سازی» ظاهر شد');
    // باطل شدن نشست حین کار → با بازگشت به برگه فرم ورود
    cloud.revoke('p1');
    await page.clock.fastForward(61000);
    await page.evaluate(() => window.dispatchEvent(new Event('focus'))).catch(() => {});
    await page.waitForTimeout(4000);
    const onLogin = await page.evaluate(() => document.getElementById('login').classList.contains('on')).catch(() => false);
    const msg = await page.evaluate(() => (document.getElementById('login-err') || {}).textContent || '').catch(() => '');
    ok(onLogin && /تغییر کرده/.test(msg), 'نشست باطل حین کار → بازگشت به فرم ورود با پیام');
    ok(errors.length === 0, 'بدون خطای صفحه (برگه) ' + errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
