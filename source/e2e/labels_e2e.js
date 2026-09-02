/* E2E — ویرایش مرکزی نام تب‌ها/آیتم‌ها + اعمال دسکتاپ، موبایل و لینک همگام‌سازی */
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
  await page.click('#login-form button[type="submit"]'); await page.waitForTimeout(1200);
}

(async () => {
  const browser = await chromium.launch({ executablePath:EXE, headless:true, args:['--no-sandbox','--use-gl=swiftshader','--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport:{ width:1360, height:900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await boot(page);
  const api = await page.evaluate(() => ({ count:UI_LABELS.defs().length, users:UI_LABELS.t('nav.users'), custom:Object.keys(UI_LABELS.custom()).length }));
  ok(api.count >= 85, `سامانهٔ مرکزی ${api.count} نام قابل ویرایش دارد`);
  ok(api.users === 'یوزرها', 'غلط تایپی «یوزها» به «یوزرها» اصلاح شده است');
  ok(api.custom === 0, 'در شروع، نام‌های پیش‌فرض سالم هستند');

  await login(page, 'admin', 'golf1405');
  await page.click('.nav-item[data-page="mgmt"]'); await page.waitForTimeout(700);
  ok(await page.locator('.mgmt-tab[data-tab="labels"]').count() === 1, 'تب «ویرایش آیتم‌ها» به پنل مدیریت اضافه شده است');
  await page.click('.mgmt-tab[data-tab="labels"]'); await page.waitForTimeout(700);
  const editor = await page.evaluate(() => ({
    inputs:document.querySelectorAll('[data-label-input]').length,
    groups:document.querySelectorAll('[data-label-group]').length,
    search:!!document.querySelector('#lbl-search'), save:!!document.querySelector('#lbl-save'), sync:!!document.querySelector('#lbl-link')
  }));
  ok(editor.inputs >= 85, `${editor.inputs} نام در ویرایشگر فهرست شده است`);
  ok(editor.groups >= 7, `${editor.groups} گروه منظم برای نام‌ها وجود دارد`);
  ok(editor.search && editor.save && editor.sync, 'جست‌وجو، ذخیره و همگام‌سازی موبایل موجود است');
  await page.fill('#lbl-search', 'فرماندهی');
  const found = await page.evaluate(() => [...document.querySelectorAll('[data-label-row]')].filter(x => getComputedStyle(x).display !== 'none').length);
  ok(found >= 2, 'جست‌وجوی نام‌ها کار می‌کند');
  await page.fill('#lbl-search', '');

  await page.fill('[data-label-input="nav.cmd"]', 'داشبورد مدیریتی');
  await page.fill('[data-label-input="member.home"]', 'پروفایل من');
  await page.click('#lbl-save'); await page.waitForTimeout(900);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_ui_labels_v1') || '{}'));
  ok(saved['nav.cmd'] === 'داشبورد مدیریتی' && saved['member.home'] === 'پروفایل من', 'نام‌های جدید در حافظه ذخیره شدند');
  ok(/داشبورد مدیریتی/.test(await page.locator('.nav-item[data-page="cmd"]').innerText()), 'نام جدید در منوی اصلی فوراً اعمال شد');

  await page.evaluate(() => APP.go('cmd')); await page.waitForTimeout(650);
  ok(/داشبورد مدیریتی/.test(await page.locator('#top-title').innerText()), 'نام جدید در عنوان صفحه اعمال شد');
  ok(/داشبورد مدیریتی/.test(await page.locator('#view').innerText()), 'نام جدید در محتوای صفحه نیز اعمال شد');
  await page.evaluate(() => APP.go('settings')); await page.waitForTimeout(650);
  ok(/داشبورد مدیریتی/.test(await page.locator('#view').innerText()), 'نام جدید در تنظیمات نمایش هم تغییر کرد');

  const syncData = await page.evaluate(() => ({ link:UI_LABELS.shareLink(), token:UI_LABELS.exportToken() }));
  const syncLink = syncData.link;
  const phoneLink = BASE.split('#')[0] + '#ga-labels=' + syncData.token;
  ok(syncLink.includes('#ga-labels='), 'لینک همگام‌سازی موبایل ساخته شد');
  await page.evaluate(() => APP.go('mgmt')); await page.waitForTimeout(500);
  await page.click('.mgmt-tab[data-tab="labels"]'); await page.waitForTimeout(500);
  ok(await page.locator('#lbl-qr img').count() === 1, 'کد QR همگام‌سازی ساخته شد');

  /* همان مرورگر در اندازهٔ موبایل و با حساب عضو */
  await page.evaluate(() => localStorage.setItem('ga_session','p1'));
  await page.reload({ waitUntil:'load' });
  await page.waitForFunction(() => window.__L3D && window.APP, null, { timeout:10000 });
  await page.evaluate(() => window.__L3D.skipIntro()); await page.waitForTimeout(500);
  await page.setViewportSize({ width:390, height:844 }); await page.waitForTimeout(350);
  const mobileCmd = await page.locator('#member-mobile-nav [data-member-page="cmd"]').innerText();
  ok(/داشبورد مدیریتی/.test(mobileCmd), 'نام جدید در نوار مستقیم موبایل نمایش داده شد');
  ok(/پروفایل من/.test(await page.locator('[data-mtab="home"]').innerText()), 'نام تب اعضا نیز در موبایل تغییر کرد');
  await page.click('#member-mobile-nav [data-member-page="cmd"]'); await page.waitForTimeout(650);
  ok(/داشبورد مدیریتی/.test(await page.locator('#top-title').innerText()), 'تب تغییرنام‌یافته از موبایل باز می‌شود');

  /* مرورگر دوم = گوشی جداگانه، بدون localStorage مشترک */
  const phoneCtx = await browser.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  const phone = await phoneCtx.newPage();
  const phoneErrors = [];
  phone.on('pageerror', e => phoneErrors.push(e.message));
  await boot(phone, phoneLink);
  await login(phone, 'p1', 'golf1405');
  const phoneState = await phone.evaluate(() => ({
    cmd:UI_LABELS.t('nav.cmd'), home:UI_LABELS.t('member.home'), stored:JSON.parse(localStorage.getItem('ga_ui_labels_v1') || '{}')
  }));
  ok(phoneState.cmd === 'داشبورد مدیریتی' && phoneState.home === 'پروفایل من', 'لینک، نام‌ها را به گوشی جداگانه منتقل کرد');
  ok(phoneState.stored['nav.cmd'] === 'داشبورد مدیریتی', 'نام‌ها در مرورگر گوشی ماندگار شدند');
  ok(/داشبورد مدیریتی/.test(await phone.locator('#member-mobile-nav [data-member-page="cmd"]').innerText()), 'گوشی جداگانه نام جدید را در منو نشان می‌دهد');
  await phone.click('#member-mobile-nav [data-member-page="cmd"]'); await phone.waitForTimeout(600);
  ok(/داشبورد مدیریتی/.test(await phone.locator('#top-title').innerText()), 'گوشی جداگانه صفحه را با نام جدید باز می‌کند');

  await page.evaluate(() => UI_LABELS.resetAll()); await page.waitForTimeout(650);
  ok(await page.evaluate(() => UI_LABELS.t('nav.cmd')) === 'فرماندهی', 'بازنشانی همهٔ نام‌ها به پیش‌فرض کار می‌کند');
  ok(errors.filter(x => !/arcTo/.test(x)).length === 0 && phoneErrors.filter(x => !/arcTo/.test(x)).length === 0, 'بدون خطای جاوااسکریپت');

  await phoneCtx.close(); await browser.close();
  console.log(`نتیجه: ${pass} موفق / ${fail} ناموفق`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e && e.message); process.exit(1); });
