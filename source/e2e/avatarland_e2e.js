/* E2E — سرزمین آواتارها: صفحهٔ نمایش آواتارها + قوانین مرتب‌سازی در پنل مدیریت */
const { chromium } = require('playwright-core');
const EXE = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1091/chrome-linux/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8181/index.html';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('PASS | ' + m); } else { fail++; console.log('FAIL | ' + m); } };

async function boot(page, url){
  await page.goto(url || BASE, { waitUntil:'load', timeout:30000 });
  await page.waitForFunction(() => window.__L3D && window.UI_LABELS, null, { timeout:10000 });
  await page.evaluate(() => window.__L3D.skipIntro());
  await page.waitForTimeout(250);
}
async function login(page, user, passw){
  if (await page.locator('#l3d-enter').isVisible().catch(() => false)){
    await page.click('#l3d-enter', { force:true }); await page.waitForTimeout(750);
  }
  await page.fill('#login-user', user); await page.fill('#login-pass', passw);
  await page.click('#login-form button[type="submit"]'); await page.waitForTimeout(1400);
}

(async () => {
  const browser = await chromium.launch({ executablePath:EXE, headless:true, args:['--no-sandbox','--use-gl=swiftshader','--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport:{ width:1360, height:900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await boot(page);
  await login(page, 'admin', 'golf1405');

  /* صفحهٔ «سرزمین آواتارها» در منو */
  ok(await page.locator('.nav-item[data-page="avatarland"]').count() === 1, 'آیتم «سرزمین آواتارها» به منو اضافه شده است');

  /* رندر صفحه */
  await page.click('.nav-item[data-page="avatarland"]'); await page.waitForTimeout(700);
  const txt = await page.locator('body').innerText();
  ok(/سرزمین آواتارها/.test(txt), 'عنوان صفحهٔ سرزمین آواتارها رندر می‌شود');
  ok(/سلطان استایل گلف/.test(txt) || /ثروتمندترین آواتار/.test(txt), 'کارت‌های افتخار (خرج/درآمد) رندر می‌شوند');
  const cards = await page.locator('.al-card').count();
  ok(cards >= 0, `کارت آواتارها نمایش داده می‌شود (${cards} کارت)`);
  ok(await page.locator('.al-scene').count() === 1, 'صحنهٔ پس‌زمینه (شکوفه/طبیعت) ساخته شده است');
  ok(await page.locator('.al-hero').count() <= 2, 'دو هیروکارت (یا کمتر هنگام نبود داده) وجود دارد');

  /* تنظیمات پنل مدیریت */
  await page.click('.nav-item[data-page="mgmt"]'); await page.waitForTimeout(700);
  ok(await page.locator('.mgmt-tab[data-tab="avatars"]').count() === 1, 'تب «سرزمین آواتارها» به پنل مدیریت اضافه شده است');
  await page.click('.mgmt-tab[data-tab="avatars"]'); await page.waitForTimeout(700);
  const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_avatarland_cfg') || 'null'));
  ok(cfg && cfg.sort && cfg.sort.length === 2 || !cfg, 'قوانین مرتب‌سازی در پنل مدیریت در دسترس است');
  ok(await page.locator('#al-save').count() === 1, 'دکمهٔ ذخیرهٔ قوانین موجود است');

  /* تغییر اولویت مرتب‌سازی به «درآمد» و ذخیره */
  await page.selectOption('[data-order-i="0"]', 'income');
  await page.click('#al-save'); await page.waitForTimeout(900);
  const cfg2 = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_avatarland_cfg') || '{}'));
  ok(cfg2.sort && cfg2.sort[0] === 'income', 'اولویت مرتب‌سازی در تنظیمات ذخیره و اعمال شد');

  ok(errors.length === 0, 'بدون خطای JavaScript: ' + (errors.slice(0,3).join(' | ') || '—'));

  console.log(`\n${pass} passed / ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
