/* E2E v6: Honor Rank (Avatar Rank Appearance) + مدیریت فروشگاه + رد درخواست + پرداخت مستقیم */
const { chromium } = require('playwright-core');
const fs = require('fs');
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/golf-academy-screenshots';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const EXE = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1140/chrome-linux/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8181/index.html';
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=swiftshader', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
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
    const vis = await page.locator('#l3d-enter').isVisible().catch(() => false);
    if (vis){ await page.click('#l3d-enter', { force: true }); await page.waitForTimeout(1000); }
    await page.fill('#login-user', u); await page.fill('#login-pass', p);
    await page.click('#login-form button[type="submit"]'); await page.waitForTimeout(1600);
  }
  async function logout(){
    await page.click('#logout-btn'); await page.waitForTimeout(1500);
    await page.waitForFunction(() => window.__L3D && window.__L3D.state().introDone, null, { timeout: 22000 });
    await page.waitForFunction(() => document.getElementById('l3d-intro').classList.contains('l3d-hide'), null, { timeout: 5000 });
  }
  async function mgmtTab(name){
    await page.click('.nav-item[data-page="mgmt"]'); await page.waitForTimeout(900);
    await page.click(`.mgmt-tab:has-text("${name}")`); await page.waitForTimeout(1000);
  }

  await gotoLanding();

  // 0) عضو p8 یک‌بار وارد شود تا سطح فعلی‌اش ثبت شود + یک درخواست بفرستد
  await login('p8', 'golf1405');
  const lv0 = await page.evaluate(() => (JSON.parse(localStorage.getItem('ga_avatars')||'{}').p8||{}).lvl);
  ok(lv0 >= 1, 'سطح Honor Rank عضو از امتیاز فصل محاسبه و ذخیره شد (Level ' + lv0 + ')');
  await page.click('[data-mtab="earn"]'); await page.waitForTimeout(800);
  await page.click('[data-req="practice"]'); await page.waitForTimeout(800);

  // 1) مدیر: تب رنک و آواتار
  await logout();
  await login('admin', 'golf1405');
  await mgmtTab('رنک و آواتار');
  const chips = await page.locator('[data-hlv]').count();
  ok(chips === 15, 'پنل Avatar Rank Appearance ۱۵ رنک دارد (' + chips + ')');
  const divs = await page.evaluate(() => window.AV.ranks().map(r => r.div).filter((v,i,a) => a.indexOf(v) === i));
  ok(divs.length === 5 && divs.join(',') === 'silver,gold,emerald,royal,immortal', 'پنج دیویژن رنگی تعریف شده‌اند (' + divs.join(',') + ')');
  await page.click('[data-hlv="13"]'); await page.waitForTimeout(900);
  const edTxt = await page.locator('#mgmt-body').innerText();
  ok(/Albatross Knight/.test(edTxt) && /Immortal Division/.test(edTxt), 'ویرایشگر رنک ۱۳ (Albatross Knight / Immortal) باز شد');
  ok(await page.locator('#hr-prev.av-card').count() === 1, 'پیش‌نمایش زندهٔ کارت آواتار نمایش داده می‌شود');

  // 2) تغییر رنگ/نشان/افکت → Data Driven ذخیره می‌شود
  await page.evaluate(() => {
    const set = (k, v) => { const el = document.querySelector(`[data-hf="${k}"]`); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('bg1', '#220033'); set('glow', '#ff00cc'); set('badgeSize', 52); set('badgeX', 62); set('badgeY', 44);
    const p = document.querySelector('[data-hf="particle"]'); p.value = 'gold'; p.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(900);
  const skin13 = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_rank_skin') || '{}')['13']);
  ok(skin13 && skin13.bg1 === '#220033' && skin13.glow === '#ff00cc', 'رنگ پس‌زمینه و Glow رنک در ga_rank_skin ذخیره شد');
  ok(skin13 && +skin13.badgeSize === 52 && +skin13.badgeX === 62 && +skin13.badgeY === 44, 'اندازه و محل نشان روی سینه ذخیره شد');
  ok(skin13 && skin13.particle === 'gold', 'افکت ذرات از پنل مدیریت تغییر کرد (بدون تغییر کد)');
  const prevStyle = await page.evaluate(() => { const c = document.querySelector('#hr-prev'); return { bg: c.style.getPropertyValue('--bg1'), glow: c.style.getPropertyValue('--glow'), chest: c.querySelector('.av-chest').style.width }; });
  ok(prevStyle.bg === '#220033' && prevStyle.glow === '#ff00cc' && prevStyle.chest === '52px', 'پیش‌نمایش فوراً با تنظیمات جدید به‌روز شد');
  await shot('mgmt_honor_edit.png');

  // 3) انیمیشن ارتقاء (تست از پنل)
  await page.click('#hr-testup');
  await page.waitForTimeout(600);
  const upping = await page.evaluate(() => { const c = document.querySelector('#hr-prev'); return { cls: c.classList.contains('av-upping'), oldB: !!c.querySelector('.av-up-old'), newB: !!c.querySelector('.av-up-new'), ttl: !!c.querySelector('.av-up-title') }; });
  ok(upping.cls && upping.oldB && upping.newB && upping.ttl, 'انیمیشن ارتقاء: محو نشان قبلی + ظهور نشان جدید + عنوان جدید');

  // 4) بازگرداندن رنک ۱۳ به پیش‌فرض
  page.once('dialog', d => d.accept());
  await page.click('#hr-clear'); await page.waitForTimeout(900);
  const skin13b = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_rank_skin') || '{}')['13']);
  ok(!skin13b, 'دکمهٔ «پیش‌فرض این رنک» تنظیمات را پاک می‌کند');

  // 5) تعیین رنک دستی برای عضو
  await page.selectOption('[data-hset="p8"]', '15');
  await page.waitForTimeout(1000);
  const hon = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_honor') || '{}'));
  ok(hon.p8 && +hon.p8.lv === 15, 'مدیر رنک عضو را دستی روی Level 15 تنظیم کرد');
  await shot('mgmt_honor_members.png');

  // 6) مدیریت فروشگاه: ویرایش قیمت + افزودن + حذف
  await page.click('.mgmt-tab[data-tab="shop"]'); await page.waitForTimeout(1000);
  const rows = await page.locator('[data-isave]').count();
  ok(rows >= 20, 'کاتالوگ پولوشرت برندهای جهانی در پنل مدیریت فهرست شد (' + rows + ' آیتم)');
  await page.fill('[data-ir="sh_qu"] [data-f="price"]', '5');
  await page.click('[data-isave="sh_qu"]'); await page.waitForTimeout(900);
  const shopEdit = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_shop') || '{}'));
  ok(shopEdit.edit && +shopEdit.edit.sh_qu.price === 5, 'قیمت آیتم از پنل مدیریت تغییر کرد');
  await page.fill('#np-n', 'پولوشرت تست مدیر');
  await page.fill('#np-p', '7');
  await page.click('#np-add'); await page.waitForTimeout(1000);
  const added = await page.evaluate(() => (JSON.parse(localStorage.getItem('ga_shop') || '{}').add || []).length);
  ok(added === 1, 'آیتم تازه از پنل مدیریت به فروشگاه اضافه شد');
  await shot('mgmt_shop.png');

  // 7) رد درخواست سکه + یادداشت مدیر
  await page.click('.mgmt-tab:has-text("درخواست سکه")'); await page.waitForTimeout(1000);
  ok(await page.locator('[data-no]').count() === 1, 'درخواست عضو در انتظار تأیید است');
  const rid = await page.locator('[data-no]').first().getAttribute('data-no');
  await page.fill(`[data-note="${rid}"]`, 'مدرک ناقص بود');
  await page.click(`[data-no="${rid}"]`); await page.waitForTimeout(900);
  const rejected = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_coinreq') || '[]')[0]);
  ok(rejected.status === 'no' && rejected.adminNote === 'مدرک ناقص بود', 'مدیر درخواست را با یادداشت رد کرد');
  const coinsAfterReject = await page.evaluate(() => (JSON.parse(localStorage.getItem('ga_coins') || '{}').p8 || { total: 0 }).total);
  ok(coinsAfterReject === 0, 'با رد درخواست هیچ سکه‌ای واریز نشد');

  // 8) پرداخت مستقیم سکه توسط مدیر
  await page.selectOption('#cg-user', 'p8');
  await page.fill('#cg-amt', '25');
  await page.fill('#cg-note', 'جایزهٔ مربی');
  await page.click('#cg-add'); await page.waitForTimeout(900);
  const paid = await page.evaluate(() => (JSON.parse(localStorage.getItem('ga_coins') || '{}').p8 || { total: 0 }).total);
  ok(paid === 25, 'پرداخت مستقیم مدیر به کیف‌پول عضو انجام شد (۲۵ سکه)');

  // 9) عضو: رنک جدید + انیمیشن ارتقاء + قیمت‌های به‌روز فروشگاه
  await logout();
  await login('p8', 'golf1405');
  await page.waitForTimeout(1200);
  const cardTxt = await page.locator('#mz-card').innerText();
  ok(/Immortal Champion/.test(cardTxt) && /Level 15/.test(cardTxt), 'رنک جدید عضو روی کارت آواتار اعمال شد (' + cardTxt.split('\n')[1] + ')');
  const uppedMember = await page.evaluate(() => !!document.querySelector('#mz-card.av-upping') || !!document.querySelector('#mz-card .av-up-new'));
  ok(uppedMember, 'انیمیشن ارتقاء رنک برای عضو اجرا شد');
  await shot('member_rankup.png');
  await page.click('[data-mtab="avatar"]'); await page.waitForTimeout(1000);
  const shopTxt = await page.locator('#view').innerText();
  ok(/پولوشرت تست مدیر/.test(shopTxt), 'آیتم افزوده‌شدهٔ مدیر در فروشگاه عضو دیده می‌شود');
  ok(await page.locator('[data-buy="sh_qu"]').isEnabled(), 'آیتم با قیمت جدید (۵ سکه) برای عضو قابل خرید است');
  await page.click('[data-buy="sh_qu"]'); await page.waitForTimeout(900);
  const left = await page.evaluate(() => (JSON.parse(localStorage.getItem('ga_coins') || '{}').p8 || {}).total);
  ok(left === 20, 'خرید با قیمت ویرایش‌شده انجام و سکه کسر شد (۲۵ → ۲۰)');
  // تعویض جنسیت آواتار (آواتار خانم/آقا)
  await page.click('[data-agender="f"]'); await page.waitForTimeout(900);
  const g = await page.evaluate(() => (JSON.parse(localStorage.getItem('ga_avatars') || '{}').p8 || {}).gender);
  ok(g === 'f', 'حالت آواتار خانم فعال شد (مو/پوشش مخصوص خانم‌ها)');
  const fItems = await page.evaluate(() => window.AV.shop().filter(i => i.g === 'f').length);
  ok(fItems >= 6, 'آیتم‌های مخصوص خانم‌ها در کاتالوگ هست (' + fItems + ' آیتم)');
  await shot('member_avatar_f.png');

  ok(realErrors().length === 0, 'بدون خطای صفحه/کنسول' + (realErrors().length ? ' → ' + realErrors()[0] : ''));
  if (realErrors().length) console.log(realErrors().join('\n'));
  await browser.close();
})().catch(e => { console.error('FATAL', e && e.message); process.exit(1); });
