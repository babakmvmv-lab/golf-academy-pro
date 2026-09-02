/* E2E: لندینگ سینمایی جدید — اینتروی ۱۰ ثانیه‌ای MARVEL + لابی بازطراحی‌شده + منوی ۴ آیکن */
const { chromium } = require('playwright-core');
const fs = require('fs');
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/golf-academy-screenshots';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const EXE = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1140/chrome-linux/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8181/index.html';
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=swiftshader', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const shot = n => page.screenshot({ path: SHOT_DIR + '/' + n });
  const ok = (c, msg) => console.log((c ? 'PASS' : 'FAIL') + ' | ' + msg);
  const visible = async sel => (await page.locator(sel).count()) > 0 && await page.locator(sel).isVisible();
  const loginShown = () => page.evaluate(() => {
    const el = document.getElementById('login');
    const cs = getComputedStyle(el);
    return el.classList.contains('on') || cs.display !== 'none';
  });

  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });

  // 0) قرارداد: ورود هرگز در بارگذاری ظاهر نمی‌شود
  ok(!(await loginShown()), 'صفحهٔ ورود در بارگذاری نمایش داده نمی‌شود');
  ok((await page.locator('#l3d').count()) === 1, 'لندینگ #l3d روی صفحه');
  ok((await page.locator('#l3d canvas').count()) === 1, 'canvas سه‌بعدی موجود');
  ok(await page.locator('#l3d-enter').isVisible(), 'دکمهٔ شناور «ورود اعضا» همیشه بالای صفحه');
  ok((await page.locator('#l3d .hint').count()) === 0, 'متن راهنمای «روی آیکن‌ها کلیک کنید...» حذف شده');
  ok((await page.locator('#world').count()) === 0 && (await page.locator('.nav-item[data-page="world"]').count()) === 0, 'دنیای سه‌بعدی از همه‌جا حذف شده');

  // 1) اینتروی لایو-اکشن ۱۰ ثانیه‌ای → لابی
  await page.waitForFunction(() => window.__L3D && window.__L3D.state().introDone, null, { timeout: 22000 });
  await page.waitForFunction(() => document.getElementById('l3d-intro').classList.contains('l3d-hide'), null, { timeout: 5000 });
  const dur = Date.now() - t0;
  ok(dur >= 9500, 'اینتروی سینمایی حداقل ~۱۰ ثانیه اجرا شد (' + Math.round(dur / 100) / 10 + 's)');
  ok(await page.locator('#l3d').isVisible(), 'لابی بعد از اینترو نمایان است');
  ok(!(await loginShown()), 'پس از اینترو نیز صفحهٔ ورود ظاهر نشد');
  await shot('landing_lobby.png');

  // 2) لابی بازطراحی‌شده: خانم رسپشن داخل تصویر + بدون امتیاز
  ok((await page.locator('#l3d-reception').count()) === 1, 'هات‌اسپات خانم رسپشن موجود است');
  ok(await visible('#l3d-reception .ring'), 'حلقهٔ طلایی رسپشن دیده می‌شود');
  ok((await page.locator('#l3d-dock .score, #l3d-dock .pts, .l3d-score, #l3d-scores, .l3d-pts').count()) === 0, 'هیچ امتیاز/نفر برتری در لابی نیست');

  // 3) منوی پایین فقط ۴ آیکن
  const dockText = await page.locator('#l3d-dock').innerText();
  const diCount = await page.locator('#l3d-dock .di').count();
  ok(diCount === 4, 'منوی پایین دقیقاً ۴ آیکن دارد (' + diCount + ')');
  ok(/تماس با ما/.test(dockText) && /اطلاعات/.test(dockText) && /تقویم آکادمی/.test(dockText) && /رکوردداران/.test(dockText), 'آیکن‌ها: تماس با ما، اطلاعات، تقویم آکادمی، رکوردداران');
  ok(!/رسپشن/.test(dockText) && !/مسابقات پیش رو/.test(dockText) && !/اعضا/.test(dockText), 'در منو فقط همین ۴ آیکن است');
  await shot('landing_dock.png');

  // 4) کلیک واقعی روی خانم رسپشن (وسط هات‌اسپات) → پنل رسپشن ۶ تب
  await page.mouse.click(1280 * 0.34, 800 * 0.52);
  await page.waitForTimeout(900);
  ok(await page.locator('#l3d-panel.on').count() === 1, 'کلیک روی خانم رسپشن → پنل رسپشن باز شد');
  const navs = await page.locator('#l3d-panel .l3d-nav button').allTextContents();
  ok(navs.length === 6, '۶ تب رسپشن: ' + navs.join('، '));
  await shot('landing_reception.png');
  await page.click('#l3d-pclose', { force: true });
  await page.waitForTimeout(600);

  // 5) آیکن اطلاعات
  await page.evaluate(() => window.__L3D.goto('info'));
  await page.waitForTimeout(800);
  ok(/اطلاعات آکادمی/.test(await page.locator('#l3d-panel').innerText()), 'پنل اطلاعات آکادمی باز شد');
  ok((await page.locator('#l3d-panel .l3d-nav button').count()) >= 4, 'تب‌های اطلاعات: معرفی، دوره‌ها، شهریه، قوانین');
  await shot('landing_info.png');
  await page.click('#l3d-pclose', { force: true });
  await page.waitForTimeout(600);

  // 6) آیکن تقویم آکادمی
  await page.evaluate(() => window.__L3D.goto('cal'));
  await page.waitForTimeout(800);
  ok(/تقویم آکادمی/.test(await page.locator('#l3d-panel').innerText()), 'پنل تقویم آکادمی باز شد');
  ok((await page.locator('#l3d-panel .l3d-months button').count()) >= 12, '۱۲ ماه شمسی در تقویم');
  await page.evaluate(() => window.__L3D.month(0));
  await page.waitForTimeout(400);
  ok(/فروردین/.test(await page.locator('#l3d-panel').innerText()), 'رویدادهای فروردین نمایش داده شد');
  await shot('landing_cal.png');
  await page.click('#l3d-pclose', { force: true });
  await page.waitForTimeout(600);

  // 7) آیکن رکوردداران
  await page.evaluate(() => window.__L3D.goto('rec'));
  await page.waitForTimeout(800);
  const recText = await page.locator('#l3d-panel').innerText();
  ok(/رکوردداران/.test(recText), 'پنل رکوردداران باز شد');
  ok(/بابک/.test(recText), 'رکوردداران واقعی نمایش داده شدند');
  ok(/سکو/.test(recText) || /جام قهرمانی/.test(recText), 'سکؤ برتر و رکوردها داخل پنل');
  await page.evaluate(() => window.__L3D.trophy(0));
  await page.waitForTimeout(400);
  ok(/جام قهرمانی/.test(await page.locator('#l3d-panel').innerText()), 'انتخاب جام قهرمانی کار می‌کند');
  await shot('landing_rec.png');
  await page.click('#l3d-pclose', { force: true });
  await page.waitForTimeout(600);

  // 8) آیکن تماس با ما → QR
  await page.evaluate(() => window.__L3D.goto('contact'));
  await page.waitForTimeout(800);
  const ctText = await page.locator('#l3d-panel').innerText();
  ok(/تلفن/.test(ctText) && /ایمیل/.test(ctText), 'پنل تماس با ما باز شد');
  ok((await page.locator('#l3d-panel #l3d-qr img').count()) === 1, 'QR Code تولید شد');
  await shot('landing_contact.png');
  await page.click('#l3d-pclose', { force: true });
  await page.waitForTimeout(600);

  // 9) دکمهٔ «ورود اعضا» → تنها مسیر نمایش فرم ورود
  await page.click('#l3d-enter', { force: true });
  await page.waitForTimeout(900);
  ok(await loginShown(), 'با کلیک «ورود اعضا» فرم ورود ظاهر می‌شود');
  await shot('landing_login.png');

  // 10) ریسپانسیو: موبایل ۳۹۰×۸۴۴
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__L3D && window.__L3D.state().introDone, null, { timeout: 22000 });
  await page.waitForFunction(() => document.getElementById('l3d-intro').classList.contains('l3d-hide'), null, { timeout: 5000 });
  const dockBox = await page.locator('#l3d-dock').boundingBox();
  ok(dockBox && dockBox.width <= 390 && dockBox.x >= 0, 'داک موبایل در عرض صفحه جای می‌گیرد');
  const lbVis = await page.locator('#l3d-reception .lb').isVisible();
  ok(lbVis, 'برچسب رسپشن در موبایل دیده می‌شود');
  await page.mouse.click(390 * 0.34, 844 * 0.52);
  await page.waitForTimeout(800);
  ok(await page.locator('#l3d-panel.on').count() === 1, 'هات‌اسپات رسپشن در موبایل هم کار می‌کند');
  const pBox = await page.locator('#l3d-panel').boundingBox();
  ok(pBox && pBox.width <= 390 * 1.01 && pBox.x >= 0 && (pBox.y + pBox.height) <= 844 + 2, 'پنل موبایل در صفحه جای می‌گیرد (' + Math.round(pBox.width) + '×' + Math.round(pBox.height) + ')');
  await shot('landing_mobile.png');

  // 11) بدون خطای صفحه
  ok(errors.length === 0, 'بدون خطای صفحه/کنسول' + (errors.length ? ' → ' + errors[0] : ''));
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
})().catch(e => { console.error('FATAL', e && e.message); process.exit(1); });
