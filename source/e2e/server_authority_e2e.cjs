/* «سرور مرجع است» — داده به سیستم/مرورگر وابسته نباشد. E2E مرورگری هرمتیک (بدون نوشتن زنده).
 * خواست کاربر (۱۴۰۵/۰۷/۱۵): «کاری کنیم کلاً ربطی به سیستم یا مرورگری که وارد می‌شویم نداشته باشد».
 * اجرا: NODE_PATH=…/node_modules CHROME=…/chrome node source/e2e/server_authority_e2e.cjs
 */
const path = require('path');
const { chromium } = require('playwright-core');
const { createMockCloud } = require('./mock_cloud.cjs');
const HTML = process.env.HTML || path.join(__dirname, '..', 'GolfAcademy_PRO.html');
const EXE = process.env.CHROME || undefined;
const BASE = 'https://qa.local/index.html';

const BATTLE = { v: 1, teams: [{ id: 'q1', name: 'تیم ابر', icon: '🦅', color: '#D4AF37', members: [1] }], matches: [], settings: { winPts: 3, drawPts: 1, lossPts: 0, seasonWinPts: 3, seasonDrawPts: 1, seasonLossPts: 0, seasonEnabled: true } };
const SUB = (over) => Object.assign({ id: 'sqa-p1', plan: 'trial', user: 'p1', user_id: 101, status: 'trial', start_date: '2026-01-01', end_date: '2099-01-01', start_at: '2026-01-01', end_at: '2099-01-01', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', events: [] }, over || {});
const FIXTURE = () => ({
  ga_battle: JSON.parse(JSON.stringify(BATTLE)),
  ga_subscriptions: [SUB()],
  ga_tour_rules: { qa: 1 },
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
  const cloud = createMockCloud({ store: FIXTURE(), accounts: ACCOUNTS });   // یک «سرور» مشترک برای همهٔ دستگاه‌ها
  async function device(opts) {
    opts = opts || {};
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
    await cloud.attach(ctx, HTML);
    await ctx.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const app = document.getElementById('app'); if (!app) return;
        new MutationObserver(() => {
          if (app.classList.contains('on') && !window.__enteredAt) {
            window.__enteredAt = Date.now();
            window.__pullAtEnter = window.GA_CLOUD && GA_CLOUD.lastPullOk ? GA_CLOUD.lastPullOk() : 0;
          }
        }).observe(app, { attributes: true, attributeFilter: ['class'] });
      });
    });
    const page = await ctx.newPage();
    if (opts.clock) await page.clock.install();
    const errors = [];
    page.on('pageerror', e => { if (!IGNORE.test(e.message + (e.stack || ''))) errors.push(e.message); });
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    return { ctx, page, errors };
  }
  async function login(page, u, p) {
    await page.waitForSelector('#login.on', { timeout: 20000 });
    await page.fill('#login-user', u);
    await page.fill('#login-pass', p);
    await page.click('#login-form button[type="submit"]');
    await page.waitForFunction(() => document.getElementById('app').classList.contains('on'), null, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  const inApp = page => page.evaluate(() => document.getElementById('app').classList.contains('on'));
  const lsJson = (page, k) => page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, k);
  async function reload(page) {
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('app').classList.contains('on') || document.getElementById('login').classList.contains('on'), null, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  /* تغییر مستقیم localStorage بدون رفتن به صف ارسال = نسخهٔ قدیمی/خراب روی یک مرورگر */
  const staleLocal = (page, k, v) => page.evaluate(([k, v]) => {
    const d = JSON.parse(localStorage.getItem('ga_cloud_dirty') || '{}');
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v));
    delete d[k]; localStorage.setItem('ga_cloud_dirty', JSON.stringify(d));
  }, [k, v]);

  const A = await device(), B = await device();
  await login(A.page, 'admin', 'Admin-Pass-QA1');
  await login(B.page, 'admin', 'Admin-Pass-QA1');
  ok(await inApp(A.page) && await inApp(B.page), 'مدیر روی دو مرورگر وارد شد');

  /* ── ۱) تغییر روی مرورگر A ← مرورگر B بدون رفرش، با برگشتن به برگه ── */
  await A.page.evaluate(() => { const b = JSON.parse(localStorage.getItem('ga_battle')); b.teams[0].name = 'تغییر از مرورگر A'; localStorage.setItem('ga_battle', JSON.stringify(b)); });
  await A.page.waitForFunction(() => !JSON.parse(localStorage.getItem('ga_cloud_dirty') || '{}').ga_battle, null, { timeout: 20000 }).catch(() => {});
  ok(cloud.store.ga_battle.v.teams[0].name === 'تغییر از مرورگر A', 'تغییر A روی سرور ثبت شد');
  await B.page.waitForTimeout(16000);
  await B.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await B.page.waitForTimeout(3000);
  const bB = await lsJson(B.page, 'ga_battle');
  ok(bB && bB.teams[0].name === 'تغییر از مرورگر A', 'مرورگر B تغییر را بدون رفرش و بدون پاک کردن چیزی گرفت');

  /* ── ۲) نسخهٔ قدیمی روی یک مرورگر (بدون صف) با هر بار باز شدن صفحه با سرور یکی می‌شود ── */
  await staleLocal(B.page, 'ga_tour_rules', { qa: 'قدیمی روی این مرورگر' });
  await reload(B.page);
  ok(JSON.stringify(await lsJson(B.page, 'ga_tour_rules')) === JSON.stringify({ qa: 1 }), 'نسخهٔ قدیمیِ مرورگر با بازکردن صفحه دقیقاً نسخهٔ سرور شد (مهر زمان هم‌سان بود)');
  const ent = await B.page.evaluate(() => ({ at: window.__enteredAt, pull: window.__pullAtEnter }));
  ok(ent.pull > 0 && ent.pull <= ent.at, 'پنل فقط بعد از دریافت دادهٔ سرور باز شد');

  /* ── ۳) رکورد اضافهٔ محلی (اشتراکِ فقط-این-مرورگر) دیگر ادغام و دوباره ارسال نمی‌شود ── */
  const subs = await lsJson(B.page, 'ga_subscriptions');
  await staleLocal(B.page, 'ga_subscriptions', subs.concat([SUB({ id: 'sqa-ghost', user: 'ghost', user_id: 999 })]));
  await reload(B.page);
  const subsB = await lsJson(B.page, 'ga_subscriptions') || [];
  ok(!subsB.some(s => s.id === 'sqa-ghost'), 'رکورد محلیِ قدیمی از این مرورگر برداشته شد');
  ok(!(cloud.store.ga_subscriptions.v || []).some(s => s.id === 'sqa-ghost'), 'رکورد محلیِ قدیمی دوباره روی سرور نرفت');

  /* ── ۴) حذف روی سرور ← از مرورگر هم حذف می‌شود ── */
  delete cloud.store.ga_tour_rules;
  await reload(B.page);
  ok(await B.page.evaluate(() => localStorage.getItem('ga_tour_rules')) === null, 'کلیدی که روی سرور حذف شد از مرورگر هم حذف شد');

  /* ── ۵) قطع سرور ← نوار «آفلاین» و دادهٔ محلی؛ وصل شدن ← نوار برداشته می‌شود ── */
  await B.ctx.route(/supabase\.co\/rest\/v1\/ga_store/, r => r.abort());
  await B.page.evaluate(() => GA_CLOUD.pull());
  const off = await B.page.evaluate(() => (document.getElementById('ga-offline-warn') || {}).textContent || '');
  ok(/اتصال به سرور برقرار نیست/.test(off), 'قطع سرور: نوار «اطلاعات ممکن است قدیمی باشد» نمایش داده شد');
  ok(await inApp(B.page) && (await lsJson(B.page, 'ga_battle')), 'قطع سرور: پنل و آخرین داده باقی ماند');
  await B.ctx.unroute(/supabase\.co\/rest\/v1\/ga_store/);
  await B.page.evaluate(() => GA_CLOUD.pull());
  ok(!(await B.page.evaluate(() => !!document.getElementById('ga-offline-warn'))), 'وصل شدن دوباره: نوار برداشته شد');

  /* ── ۶) خروج ← نسخهٔ محلیِ داده‌ها پاک؛ صفِ ارسال‌نشده حفظ ── */
  await B.ctx.route(/functions\/v1\/ga-sync/, r => r.fulfill({ status: 503, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":false,"err":"down"}' }));
  await B.page.evaluate(() => { const b = JSON.parse(localStorage.getItem('ga_battle')); b.teams[0].name = 'ارسال‌نشده'; localStorage.setItem('ga_battle', JSON.stringify(b)); });
  await B.page.waitForTimeout(1500);
  await B.page.evaluate(() => { const btn = document.querySelector('#logout-btn, [data-act="logout"], .logout'); if (btn) btn.click(); else window.APP && APP.go && null; });
  await B.page.waitForTimeout(500);
  if (await inApp(B.page)) await B.page.evaluate(() => { localStorage.removeItem('ga_session'); }).then(() => B.page.evaluate(() => GA_AUTH.signOut())).then(() => reload(B.page));
  await B.page.waitForSelector('#login.on', { timeout: 20000 }).catch(() => {});
  await B.page.waitForTimeout(2000);
  const after = await B.page.evaluate(() => ({ subs: localStorage.getItem('ga_subscriptions'), rules: localStorage.getItem('ga_tour_rules'), battle: localStorage.getItem('ga_battle'), dirty: JSON.parse(localStorage.getItem('ga_cloud_dirty') || '{}') }));
  ok(after.subs === null, 'پس از خروج، داده‌های سرور روی این مرورگر نماند');
  ok(!!after.dirty.ga_battle && /ارسال‌نشده/.test(after.battle || ''), 'تغییر ارسال‌نشده پاک نشد (در صف ماند)');
  await B.ctx.unroute(/functions\/v1\/ga-sync/);
  ok(A.errors.length === 0 && B.errors.length === 0, 'بدون خطای صفحه ' + A.errors.concat(B.errors).join(' | '));
  await A.ctx.close(); await B.ctx.close();

  /* ── ۷) نسخهٔ جدید سایت وقتی برگه پنهان است ← با برگشتن کاربر خودکار تازه می‌شود ── */
  {
    const C = await device({ clock: true });
    await login(C.page, 'p1', 'Member-Pass-QA1');
    ok(await inApp(C.page), 'p1 وارد شد');
    await C.page.evaluate(() => { window.__mark = 1; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    cloud.site.lastModified = new Date(Date.now() + 3600000).toUTCString();
    await C.page.clock.fastForward(31000);
    await C.page.waitForTimeout(1500);
    await C.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await C.page.waitForTimeout(5000);
    const reloaded = await C.page.evaluate(() => window.__mark !== 1).catch(() => true);
    ok(reloaded, 'نسخهٔ جدید: با برگشتن به برگه خودکار بارگذاری شد');
    cloud.site.lastModified = null;
    await C.ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
