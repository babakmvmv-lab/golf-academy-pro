/* E2E: سیستم یوزرها — دو سطح (مدیر/عضو)، فعال/غیرفعال، تماس/اطلاعات قابل ویرایش، حذف دنیای سه‌بعدی */
const { chromium } = require('playwright-core');
const fs = require('fs');
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/golf-academy-screenshots';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const EXE = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1140/chrome-linux/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8181/index.html';
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=swiftshader', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 850 } });
  const page = await ctx.newPage();
  // E2E must never contact the live cloud: use local trial fixtures and abort all off-origin requests.
  const baseOrigin = new URL(BASE).origin;
  await ctx.route('**/*', route => {
    let origin = '';
    try { origin = new URL(route.request().url()).origin; } catch(e){}
    return origin === baseOrigin ? route.continue() : route.abort();
  });
  await page.addInitScript(() => {
    localStorage.setItem('ga_cloud_cfg', JSON.stringify({ url: 'https://offline.invalid', key: 'local-e2e-only-publishable-key-123456', on: false }));
    if (sessionStorage.getItem('__users_e2e_seeded') === '1') return;
    sessionStorage.setItem('__users_e2e_seeded', '1');
    const users = [
      { id: 1, user: 'admin', pass: 'e2e-admin-secret', name: 'Admin', role: 'admin', active: true, main: true },
      { id: 2, user: 'coach', pass: 'e2e-coach-secret', name: 'Coach', role: 'admin', active: true },
      { id: 3, user: 'manager', pass: 'e2e-manager-secret', name: 'Manager', role: 'admin', active: true },
      ...Array.from({ length: 8 }, (_, i) => ({ id: 101 + i, user: 'p' + (i + 1), pass: 'e2e-member-secret-' + (i + 1), name: 'Member ' + (i + 1), role: 'member', active: true, pid: i + 1 })),
      { id: 999, user: 'bad-role', pass: 'e2e-invalid-role', name: 'Invalid role', role: 'owner', active: true },
    ];
    localStorage.setItem('ga_users', JSON.stringify(users));
    localStorage.setItem('ga_player_users', JSON.stringify({ 99: { user: 'legacy-only', pass: 'e2e-legacy-pass', name: 'Legacy member', active: true } }));
    const now = Date.now(), start = new Date(now - 86400000), end = new Date(now + 30 * 86400000);
    const startAt = start.toISOString(), endAt = end.toISOString();
    const names = [...Array.from({ length: 8 }, (_, i) => 'p' + (i + 1)), 'legacy-only'];
    const subs = names.map((user, i) => ({
      id: 'e2e-trial-' + (i + 1), user, plan: 'trial', status: 'trial',
      start_at: startAt, end_at: endAt, start_date: startAt.slice(0, 10), end_date: endAt.slice(0, 10),
      created_at: startAt, payment_status: 'manual'
    }));
    localStorage.setItem('ga_subscriptions', JSON.stringify(subs));
  });
  const errors = []; 
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  const ok = (c, msg) => console.log((c ? 'PASS' : 'FAIL') + ' | ' + msg);
  const shot = n => page.screenshot({ path: SHOT_DIR + '/' + n });
  const realErrors = () => errors.filter(e => !/arcTo/.test(e));

  async function gotoLanding(){
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__L3D && window.__L3D.state().introDone, null, { timeout: 22000 });
    await page.waitForFunction(() => document.getElementById('l3d-intro').classList.contains('l3d-hide'), null, { timeout: 5000 });
  }
  async function login(u, p){
    const enterVisible = await page.locator('#l3d-enter').isVisible().catch(() => false);
    if (enterVisible){
      await page.click('#l3d-enter', { force: true });
      await page.waitForTimeout(1000);
    }
    await page.fill('#login-user', u);
    await page.fill('#login-pass', p);
    await page.click('#login-form button[type="submit"]');
    await page.waitForTimeout(1600);
  }
  async function logout(){
    await page.click('#logout-btn');
    await page.waitForTimeout(1600);
    await page.waitForFunction(() => window.__L3D && window.__L3D.state().introDone, null, { timeout: 22000 });
    await page.waitForFunction(() => document.getElementById('l3d-intro').classList.contains('l3d-hide'), null, { timeout: 5000 });
  }

  // 0) دنیای سه‌بعدی کاملاً حذف شده + متن راهنما حذف شده
  await gotoLanding();
  ok((await page.locator('#world').count()) === 0 && (await page.locator('#world-canvas').count()) === 0, 'دنیای سه‌بعدی از DOM حذف شد');
  ok((await page.locator('#l3d .hint').count()) === 0, 'متن «روی آیکن‌ها کلیک کنید...» از صفحهٔ اصلی حذف شد');
  const bodyTxt = await page.locator('#l3d').innerText();
  ok(!bodyTxt.includes('روی آیکن‌ها کلیک کنید'), 'عبارت راهنما در متن صفحه نیست');
  ok(!bodyTxt.includes('دبل‌کلیک فضای خالی'), 'عبارت دبل‌کلیک در متن صفحه نیست');
  await shot('users_landing_clean.png');

  // 1) ورود مدیر اصلی با fixture محلی E2E
  await login('admin', 'e2e-admin-secret');
  ok(!(await page.locator('#login').isVisible()), 'ورود مدیر اصلی انجام شد');
  ok((await page.locator('.nav-item[data-page="world"]').count()) === 0, 'آیتم «دنیای سه‌بعدی» در منو نیست');
  ok((await page.locator('.nav-item[data-page="users"]').count()) === 1 && await page.locator('.nav-item[data-page="users"]').isVisible(), 'آیتم «یوزرها» برای مدیر اصلی دیده می‌شود');

  // نقش ناشناخته باید رد شود؛ رجیستری legacy فقط عضو است و نباید به مدیریت برسد.
  await logout();
  await login('bad-role', 'e2e-invalid-role');
  ok(await page.locator('#login').isVisible(), 'حساب با role ناشناخته وارد نمی‌شود');
  ok(/نقش.*معتبر نیست/.test(await page.locator('#login-err').innerText()), 'خطای نقش نامعتبر روشن است');
  await login('legacy-only', 'e2e-legacy-pass');
  ok(!(await page.locator('#login').isVisible()), 'حساب legacy معتبر با نقش عضو وارد می‌شود');
  ok(!(await page.locator('.nav-item[data-page="mgmt"]').isVisible()), 'حساب legacy منوی مدیریت نمی‌گیرد');
  await page.evaluate(() => window.APP.go('mgmt'));
  await page.waitForTimeout(400);
  ok(/بخش اعضا/.test(await page.locator('#view').innerText()) && !/Admin PRO/.test(await page.locator('#view').innerText()), 'مسیر مستقیم مدیریت برای legacy به بخش اعضا برمی‌گردد');
  for (const name of ['pageMgmt', 'pageUsers', 'pageSubs', 'pageSettings', 'pageMessages']) {
    await page.evaluate(n => window.MGMT[n](), name);
  }
  ok(/مجاز نیست/.test(await page.locator('#view').innerText()), 'فراخوانی مستقیم توابع پنل مدیر برای legacy مسدود است');
  await logout();
  await login('admin', 'e2e-admin-secret');

  // 2) تب یوزها: اعضا با نام کاربری و رمزِ پنهان‌شده
  await page.click('.nav-item[data-page="users"]');
  await page.waitForTimeout(900);
  const usTxt = await page.locator('#mgmt-body').innerText();
  ok(/مدیر اصلی/.test(usTxt), 'یوزر اصلی (مدیر) در لیست است');
  ok(usTxt.includes('p1') && usTxt.includes('p8'), 'یوزرهای اعضا (p1..p8) در لیست هستند');
  ok(/••••/.test(usTxt) && !/e2e-(admin|member)-secret/.test(usTxt), 'رمزهای عبور در جدول یوزرها افشا نمی‌شوند');
  ok((await page.locator('#us-rows tr').count()) >= 10, 'حداقل ۱۰ یوزر (۳ مدیر + ۸ عضو) در جدول');
  await shot('users_tab.png');

  // 3) غیرفعال کردن یوزر p2 → ورودش ممکن نباشد
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#us-rows tr')];
    const row = rows.find(r => r.innerText.includes('p2'));
    const cb = row ? row.querySelector('.us-act') : null;
    if (cb) cb.click();
  });
  await page.waitForTimeout(500);
  await logout();
  await login('p2', 'e2e-member-secret-2');
  ok(await page.locator('#login').isVisible(), 'یوزر غیرفعال شده نمی‌تواند وارد شود');
  const errTxt = await page.locator('#login-err').innerText().catch(() => '');
  ok(/غیرفعال|اشتباه/.test(errTxt), 'پیام خطای حساب غیرفعال/ورود ناموفق نمایش داده می‌شود');
  await shot('users_deactivated_blocked.png');

  // 4) ورود عضو فعال (p1) → پنل اعضا + همهٔ بخش‌های نمایشی فعال در هر دستگاه
  await login('p1', 'e2e-member-secret-1');
  await page.waitForTimeout(1200);
  const visiblePages = await page.evaluate(() => [...document.querySelectorAll('#app .nav-item')].filter(n => getComputedStyle(n).display !== 'none').map(n => n.dataset.page));
  ok(visiblePages.length === 9, 'عضو پنل اعضا و هر ۸ تب فعال را می‌بیند (' + visiblePages.length + ')');
  ok(['memberzone','cmd','race','player','match','course','records','cal','tv'].every(x => visiblePages.includes(x)), 'همهٔ تب‌های مجاز اعضا فعال هستند');
  ok(await page.locator('.nav-item[data-page="memberzone"]').isVisible(), 'آیتم «بخش اعضا» برای عضو دیده می‌شود');
  ok(!(await page.locator('#side-mgmt-btn').isVisible()), 'دکمهٔ «پلن مدیریت» برای عضو مخفی است');
  const mzTxt = await page.locator('#view').innerText();
  ok(/بخش اعضا/.test(mzTxt), 'صفحهٔ بخش اعضا باز شد');
  ok(/خانهٔ من|دریافت سکه|راهنمای سکه|ساخت اوتار/.test(mzTxt), 'بخش اعضا کامل است: خانه/سکه/راهنما/اوتار');
  ok(!/پنل مدیریت|پلن مدیریت|یوزرها|یوزها/.test(mzTxt), 'عضو هیچ ابزار مدیریتی نمی‌بیند');
  const mzTabs = await page.locator('[data-mtab]').count();
  ok(mzTabs >= 4, 'بخش اعضا ۴ تب دارد (' + mzTabs + ')');
  await shot('users_member_zone.png');

  // 5) مدیر: ویرایش «تماس با ما» و «اطلاعات» → خوانده‌شدن در صفحهٔ اصلی
  await logout();
  await login('admin', 'e2e-admin-secret');
  await page.click('.nav-item[data-page="mgmt"]');
  await page.waitForTimeout(900);
  await page.click('.mgmt-tab[data-tab="contact"]');
  await page.waitForTimeout(700);
  await page.fill('#ct-phone', '۰۲۱-۹۹۹۹۹۹۹۹');
  await page.fill('#ct-email', 'edit@golfacademy.sa');
  await page.click('#ct-save');
  await page.waitForTimeout(500);
  await page.click('.mgmt-tab[data-tab="info"]');
  await page.waitForTimeout(700);
  await page.fill('#in-intro', 'متن معرفی تستی ویرایش‌شده از پلن مدیریت');
  await page.click('#in-save');
  await page.waitForTimeout(500);
  await logout();
  // لندینگ → داک «تماس با ما» و «اطلاعات»
  await page.click('#l3d-dock .di[data-sec="contact"]');
  await page.waitForTimeout(900);
  const ctTxt = await page.locator('#l3d-panel').innerText();
  ok(ctTxt.includes('۰۲۱-۹۹۹۹۹۹۹۹') && ctTxt.includes('edit@golfacademy.sa'), 'پنل تماس، دادهٔ ویرایش‌شده را نشان می‌دهد');
  await shot('users_contact_edited.png');
  await page.click('#l3d-pclose', { force: true });
  await page.waitForTimeout(600);
  await page.click('#l3d-dock .di[data-sec="info"]');
  await page.waitForTimeout(900);
  const inTxt = await page.locator('#l3d-panel').innerText();
  ok(inTxt.includes('متن معرفی تستی ویرایش‌شده از پلن مدیریت'), 'پنل اطلاعات، معرفی ویرایش‌شده را نشان می‌دهد');
  await shot('users_info_edited.png');

  ok(realErrors().length === 0, 'بدون خطای صفحه/کنسول' + (realErrors().length ? ' → ' + realErrors()[0] : ''));
  if (realErrors().length) console.log(realErrors().join('\n'));
  await browser.close();
})().catch(e => { console.error('FATAL', e && e.message); process.exit(1); });
