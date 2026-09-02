/* E2E v6: تنظیمات نمایش اعضا + درخواست سکه (تأیید مدیر) + فروشگاه و آواتار */
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
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  const ok = (c, msg) => console.log((c ? 'PASS' : 'FAIL') + ' | ' + msg);
  const shot = n => page.screenshot({ path: SHOT_DIR + '/' + n });
  const realErrors = () => errors.filter(e => !/arcTo/.test(e));
  const num = t => parseInt(String(t).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)), 10);

  async function gotoLanding(){
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__L3D && window.__L3D.state().introDone, null, { timeout: 22000 });
    await page.waitForFunction(() => document.getElementById('l3d-intro').classList.contains('l3d-hide'), null, { timeout: 5000 });
  }
  async function login(u, p){
    const vis = await page.locator('#l3d-enter').isVisible().catch(() => false);
    if (vis){ await page.click('#l3d-enter', { force: true }); await page.waitForTimeout(1000); }
    await page.fill('#login-user', u);
    await page.fill('#login-pass', p);
    await page.click('#login-form button[type="submit"]');
    await page.waitForTimeout(1600);
  }
  async function logout(){
    await page.click('#logout-btn');
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => window.__L3D && window.__L3D.state().introDone, null, { timeout: 22000 });
    await page.waitForFunction(() => document.getElementById('l3d-intro').classList.contains('l3d-hide'), null, { timeout: 5000 });
  }
  const visibleNavCount = () => page.evaluate(() => [...document.querySelectorAll('#app .nav-item')].filter(n => getComputedStyle(n).display !== 'none').length);
  const coin = () => page.locator('#mz-coin-n').innerText().then(num);

  await gotoLanding();

  // 1) مدیر: تنظیمات نمایش — گروه «بخش اعضا»
  await login('admin', 'golf1405');
  await page.click('.nav-item[data-page="settings"]');
  await page.waitForTimeout(900);
  const stTxt = await page.locator('#view').innerText();
  ok(/بخش اعضا — نمایش برای اعضا/.test(stTxt), 'گروه «بخش اعضا» در تنظیمات نمایش هست');
  ok(/فرماندهی/.test(stTxt) && /رقابت فصل/.test(stTxt) && /مرکز بازیکن/.test(stTxt), 'آیتم‌های فرماندهی/رقابت/مرکز بازیکن در تنظیمات هستند');
  await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('input[data-set]')];
    const memberKeys = ['memCmd','memRace','memPlayer','memMatch','memCourse','memRecords','memCal','memTv'];
    const find = k => boxes.find(x => x.dataset.set === k);
    memberKeys.forEach(k => { const b = find(k); if (b && b.checked) b.click(); });
    ['memCmd','memRace'].forEach(k => { const b = find(k); if (b && !b.checked) b.click(); });
  });
  await page.waitForTimeout(700);
  await shot('member_settings.png');

  // 2) عضو p1 → فقط بخش اعضا + فرماندهی + رقابت فصل
  await logout();
  await login('p1', 'golf1405');
  const navs = await page.evaluate(() => [...document.querySelectorAll('#app .nav-item')].filter(n => getComputedStyle(n).display !== 'none').map(n => n.dataset.page));
  ok(navs.includes('memberzone') && navs.includes('cmd') && navs.includes('race'), 'عضو: بخش اعضا + فرماندهی + رقابت فصل دیده می‌شود (' + navs.join(',') + ')');
  ok(!navs.includes('player') && !navs.includes('cal') && !navs.includes('mgmt'), 'عضو: مرکز بازیکن/تقویم/مدیریت دیده نمی‌شود');
  ok((await visibleNavCount()) === 3, 'عضو دقیقاً ۳ آیتم منو دارد');

  // 3) صفحهٔ فعال بدون دکمهٔ مدیریت
  await page.click('.nav-item[data-page="cmd"]');
  await page.waitForTimeout(1200);
  ok(await page.locator('#view .grid').count() > 0, 'صفحهٔ فرماندهی برای عضو نمایش داده شد');
  const mgmtBtns = await page.evaluate(() => [...document.querySelectorAll('#view [onclick]')].filter(b => (b.getAttribute('onclick')||'').includes('mgmt') && getComputedStyle(b).display !== 'none').length);
  ok(mgmtBtns === 0, 'دکمه‌های مدیریت در صفحهٔ عضو مخفی هستند');
  await shot('member_cmd_view.png');

  // 4) صفحهٔ غیرفعال → بازگشت به بخش اعضا
  await page.evaluate(() => { try { window.APP.go('cal'); } catch(e){} });
  await page.waitForTimeout(900);
  ok(/بخش اعضا/.test(await page.locator('#view').innerText()), 'دسترسی به صفحهٔ غیرفعال به بخش اعضا برمی‌گردد');

  // 5) کارت رنک عضو (Honor Rank) در خانهٔ من
  await page.waitForTimeout(500);
  ok(await page.locator('#mz-card.av-card').count() === 1, 'کارت آواتار سه‌بعدی با رنک در خانهٔ من نمایش داده می‌شود');
  ok(await page.locator('#mz-card .av-chest svg').count() >= 1, 'نشان رنک روی سینهٔ آواتار قرار دارد');
  const cardTxt = await page.locator('#mz-card').innerText();
  ok(/Level \d+/.test(cardTxt) && /Division/.test(cardTxt), 'عنوان رنک و دیویژن روی کارت درج شده (' + cardTxt.replace(/\n/g, ' / ') + ')');

  // 6) عضو p8: ارسال درخواست سکه (بدون واریز فوری)
  await logout();
  await login('p8', 'golf1405');
  await page.click('[data-mtab="earn"]');
  await page.waitForTimeout(900);
  ok((await coin()) === 0, 'عضو بدون قهرمانی از ۰ سکه شروع می‌کند');
  await page.fill('[data-note="story"]', 'لینک استوری تست');
  await page.click('[data-req="story"]');
  await page.waitForTimeout(900);
  ok((await coin()) === 0, 'با ارسال درخواست، سکه فوراً واریز نمی‌شود (نیاز به تأیید مدیر)');
  const reqSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_coinreq') || '[]'));
  ok(reqSaved.length === 1 && reqSaved[0].status === 'pending' && reqSaved[0].user === 'p8' && reqSaved[0].amount === 10,
    'درخواست با وضعیت «در انتظار تأیید» برای مدیریت ثبت شد');
  await page.click('[data-mtab="earn"]');
  await page.waitForTimeout(700);
  ok(await page.locator('[data-req="story"]').isDisabled(), 'دکمهٔ درخواست تکراری غیرفعال است (در انتظار تأیید)');
  ok(/در انتظار تأیید/.test(await page.locator('#view').innerText()), 'وضعیت درخواست در «درخواست‌های من» دیده می‌شود');
  await shot('member_coinreq.png');

  // 7) مدیر: تأیید درخواست در پنل مدیریت
  await logout();
  await login('admin', 'golf1405');
  await page.click('.nav-item[data-page="mgmt"]');
  await page.waitForTimeout(1100);
  await page.click('.mgmt-tab:has-text("درخواست سکه")');
  await page.waitForTimeout(900);
  ok(await page.locator('[data-ok]').count() === 1, 'درخواست عضو در تب «درخواست سکه» پنل مدیریت دیده می‌شود');
  ok(/مهرسا/.test(await page.locator('#mgmt-body').innerText()), 'نام عضو درخواست‌دهنده نمایش داده می‌شود');
  await page.click('[data-ok]');
  await page.waitForTimeout(1000);
  const afterApprove = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_coins') || '{}'));
  ok(afterApprove.p8 && afterApprove.p8.total === 10, 'بعد از تأیید مدیر، ۱۰ سکه به کیف‌پول عضو واریز شد');
  ok(await page.locator('[data-ok]').count() === 0, 'درخواست تأییدشده از فهرست انتظار خارج شد');
  await shot('mgmt_coinreq.png');

  // 8) عضو p8: خرید از فروشگاه با سکهٔ کافی و ناکافی
  await logout();
  await login('p8', 'golf1405');
  await page.click('[data-mtab="avatar"]');
  await page.waitForTimeout(900);
  ok((await coin()) === 10, 'موجودی عضو بعد از تأیید = ۱۰ سکه');
  ok(await page.locator('[data-buy="sh_gf"]').isDisabled(), 'خرید پولوشرت G/FORE (۱۵۰ سکه) با موجودی کم غیرفعال است');
  await page.click('[data-buy="sh_am"]');
  await page.waitForTimeout(1000);
  const av8 = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_avatars') || '{}').p8 || {});
  ok((av8.owned || []).includes('sh_am'), 'آیتم ۱۰ سکه‌ای خریداری شد و به کمد اضافه شد');
  ok(av8.sel && av8.sel.shirt === 'sh_am', 'آیتم خریداری‌شده روی آواتار پوشیده شد');
  ok((await coin()) === 0, 'قیمت آیتم از موجودی کسر شد (۱۰ → ۰)');
  const nowDisabled = await page.locator('[data-buy="sh_qu"]').isDisabled();
  ok(nowDisabled, 'با موجودی صفر، خرید آیتم ۱۸ سکه‌ای ممکن نیست');
  await shot('member_shop.png');

  // 9) ماندگاری خرید بعد از خروج و ورود مجدد
  await logout();
  await login('p8', 'golf1405');
  await page.click('[data-mtab="avatar"]');
  await page.waitForTimeout(900);
  const ownedTxt = await page.locator('#view').innerText();
  ok(/پوشیده ✓/.test(ownedTxt), 'خرید قبلی بعد از ورود مجدد همچنان در کمد و پوشیده است');
  ok(await page.locator('[data-buy="sh_am"]').count() === 0, 'آیتم خریداری‌شده دیگر دکمهٔ خرید ندارد (همیشگی است)');

  // 10) راهنمای سکه + نردبان رنک
  await page.click('[data-mtab="guide"]');
  await page.waitForTimeout(800);
  const guideTxt = await page.locator('#view').innerText();
  ok(/اطلاعات دریافت سکه/.test(guideTxt) && /معرفی عضو جدید/.test(guideTxt), 'راهنمای سکه کامل نمایش داده می‌شود');
  ok(/Honor Rank/.test(guideTxt) && /Albatross Knight/.test(guideTxt), 'نردبان ۱۵ سطحی Honor Rank در راهنما هست');
  await shot('member_guide.png');

  ok(realErrors().length === 0, 'بدون خطای صفحه/کنسول' + (realErrors().length ? ' → ' + realErrors()[0] : ''));
  if (realErrors().length) console.log(realErrors().join('\n'));
  await browser.close();
})().catch(e => { console.error('FATAL', e && e.message); process.exit(1); });
