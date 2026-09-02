/* E2E: فصل ۱۴۰۵ — دادهٔ واقعی + باگ تغییر نام بازیکن */
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

  // ورود
  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2200);
  if (await page.locator('#l3d').count()) {
    await page.click('#l3d-enter', { force: true });
    await page.waitForTimeout(1200);
  }
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', 'golf1405');
  await page.click('#login-form button[type="submit"]');
  await page.waitForTimeout(1800);
  ok(!(await page.locator('#login').isVisible()), 'ورود با admin انجام شد');
  const shot = n => page.screenshot({ path: SHOT_DIR + '/' + n });

  // ۱) جدول رقابت: بابک اول، مهشید دوم
  await page.click('.nav-item[data-page="race"]');
  await page.waitForTimeout(1200);
  const raceTxt = await page.locator('#race-tbl tbody').innerText();
  const lbLines = raceTxt.split('\n').filter(l => /بابک|مهشید/.test(l));
  ok(raceTxt.includes('بابک') && raceTxt.includes('مهشید'), 'لیدربورد: بابک و مهشید حاضرند');
  const r1 = raceTxt.indexOf('بابک'), r2 = raceTxt.indexOf('مهشید');
  ok(r1 !== -1 && r2 !== -1 && r1 < r2, 'بابک بالاتر از مهشید (رتبه ۱ و ۲)');
  await shot('s1405_race.png');

  // ۲) بازیکنان: ۸ عضو + آواتار جنسیتی
  await page.click('.nav-item[data-page="mgmt"]');
  await page.waitForTimeout(1000);
  const pTxt = await page.locator('#mgmt-body').innerText();
  ['بابک','مهشید','آنا','روزا','ثنا','ستایش','روشا','مهرسا'].forEach(n => ok(pTxt.includes(n), 'بازیکن ' + n + ' در لیست'));
  const av = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#mgmt-body tr')];
    const rowImg = name => { const r = rows.find(x => x.innerText.includes(name)); return r ? ((r.querySelector('img')||{}).src||'') : ''; };
    const norm = src => (!src || src.startsWith('data:')) ? src : new URL(src, location.href).href;
    return {
      bobak: norm(rowImg('بابک')),
      mahshid: norm(rowImg('مهشید')),
      expBobak: norm(Data.photoOf(1)),
      expMahshid: norm(Data.photoOf(2))
    };
  });
  ok(!!av.bobak && av.bobak === av.expBobak, 'آواتار بابک مطابق قانون (عکس یا آواتار مرد)');
  ok(!!av.mahshid && av.mahshid === av.expMahshid, 'آواتار مهشید مطابق قانون (عکس یا آواتار زن)');
  ok(av.bobak !== av.mahshid, 'آواتار مرد و زن متفاوت');
  await shot('s1405_players.png');

  // ۳) باگ: تغییر نام بابک → همهجا بهروز شود
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="edit"][data-p="1"]')][0]; if (b) b.click(); });
  await page.waitForTimeout(900);
  ok(await page.locator('#ep-save').count() === 1, 'مودال ویرایش بازیکن باز شد');
  await page.fill('#modal-edit #pf-name', 'بابک کاپیتان');
  await page.click('#ep-save');
  await page.waitForTimeout(1200);
  await page.click('.nav-item[data-page="race"]');
  await page.waitForTimeout(1000);
  const race2 = await page.locator('#race-tbl tbody').innerText();
  ok(race2.includes('بابک کاپیتان') && !/^بابک$/m.test(race2.split('\n').filter(l=>l.trim()==='بابک').join('')), 'لیدربورد نام جدید: بابک کاپیتان');
  await page.click('.nav-item[data-page="match"]');
  await page.waitForTimeout(1200);
  const matchTxt = await page.locator('#view').innerText();
  ok(matchTxt.includes('بابک کاپیتان'), 'فرماندهی مسابقه نام جدید را نشان میدهد');
  await page.click('.nav-item[data-page="records"]');
  await page.waitForTimeout(1200);
  const recTxt = await page.locator('#view').innerText();
  ok(recTxt.includes('بابک کاپیتان'), 'رکوردها نام جدید را نشان میدهد');
  await shot('s1405_renamed.png');

  // ۴) قانون گلف در فرماندهی مسابقه + زمین مسجدسلیمان + کمترین ضربه بابک
  await page.click('.nav-item[data-page="match"]');
  await page.waitForTimeout(1200);
  const m2 = await page.locator('#view').innerText();
  ok(/کمترین ضربه/.test(m2) && /پار ۷۲/.test(m2), 'توضیح قانون گلف در فرماندهی مسابقه');
  ok(m2.includes('زمین مسجدسلیمان'), 'زمین مسجدسلیمان در مسابقه');
  const firstRow = await page.locator('#view table tbody tr').first().innerText();
  ok(firstRow.includes('بابک کاپیتان'), 'کمترین ضربه (نفر اول جدول) = بابک کاپیتان');
  await shot('s1405_match.png');

  // ۵) تقویم: تمرین پنجشنبه + مسابقات ماهانه + دورهٔ آذر
  await page.click('.nav-item[data-page="cal"]');
  await page.waitForTimeout(1400);
  const calTxt = await page.locator('#cal-events-list').innerText();
  const thuCount = (calTxt.match(/تمرین هفتگی پنجشنبه/g) || []).length;
  ok(thuCount >= 3, 'تمرینهای هفتگی پنجشنبه در تقویم (' + thuCount + ' مورد)');
  ok(calTxt.includes('جام فروردین') && calTxt.includes('جام اسفند'), 'مسابقات اول و آخر فصل در تقویم');
  ok(calTxt.includes('دورهٔ آماده‌سازی جام بزرگ فصل — آذر'), 'دورهٔ آذر (آینده) در تقویم');
  ok(calTxt.includes('دورهٔ آموزشی ۲روزهٔ گلف — خرداد'), 'دورهٔ خرداد در تقویم');
  const calHdr = await page.locator('#view .glass.gold-border').innerText();
  ok(/رویداد/.test(calHdr), 'شمارندهٔ رویدادهای فصل');
  await shot('s1405_calendar.png');

  // ۶) نتایج مدیریت: ۱۲ مسابقه، برگزارشدهها ثبتشده
  await page.click('.nav-item[data-page="mgmt"]');
  await page.waitForTimeout(900);
  await page.evaluate(() => { const t = [...document.querySelectorAll('.mgmt-tab')].find(x => x.dataset.tab === 'results'); if (t) t.click(); });
  await page.waitForTimeout(1000);
  const resTxt = await page.locator('#mgmt-body').innerText();
  ok((resTxt.match(/جام /g) || []).length >= 10, 'لیست مسابقات در نتایج (' + (resTxt.match(/جام /g)||[]).length + ')');
  ok((resTxt.match(/ثبت شده/g) || []).length >= 4, 'مسابقات برگزارشده «ثبت شده» هستند');
  ok(/قانون گلف/.test(resTxt) && /کمترین ضربه/.test(resTxt), 'توضیح قانون گلف در تب نتایج');
  await shot('s1405_results.png');

  // ۷) مودال نتایج: شرکتکنندگان ۸ نفر از پیش + ذخیره
  await page.evaluate(() => { const b = document.querySelector('[data-mrset="1"]'); if (b) b.click(); });
  await page.waitForTimeout(900);
  ok(await page.locator('#modal-results').count() === 1, 'مودال نتایج باز شد');
  const partTxt = await page.locator('#rp-part').innerText();
  ok((partTxt.match(/—/g) || []).length === 0 && partTxt.length > 10, 'شرکتکنندگان از پیش انتخاب شدهاند');
  const saved = await page.evaluate(() => { const b = document.querySelector('#rp-save'); b.click(); return true; });
  await page.waitForTimeout(900);
  const resStored = await page.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('ga_results') || '{}');
    return r['1'] ? { n: r['1'].participants.length, top: r['1'].top } : null;
  });
  ok(resStored && resStored.n === 8 && resStored.top['1'] === 1 && resStored.top['2'] === 2, 'نتایج مسابقه ۱ ذخیره شد (۸ شرکتکننده، اول بابک)');
  await shot('s1405_results_modal.png');

  // ۸) دورهها: ۳ دوره (۲ خرداد + ۱ آذر)
  await page.evaluate(() => { const t = [...document.querySelectorAll('.mgmt-tab')].find(x => x.dataset.tab === 'programs'); if (t) t.click(); });
  await page.waitForTimeout(1000);
  const progTxt = await page.locator('#mgmt-body').innerText();
  ok(progTxt.includes('دورهٔ آموزشی ۲روزهٔ گلف — خرداد'), 'دورهٔ آموزشی خرداد');
  ok(progTxt.includes('دورهٔ تمرینی ۲روزهٔ اصول پوتینگ — خرداد'), 'دورهٔ تمرینی خرداد');
  ok(progTxt.includes('دورهٔ آماده‌سازی جام بزرگ فصل — آذر'), 'دورهٔ آذر');
  await shot('s1405_programs.png');

  // ۹) زمینها: مسجدسلیمان پار ۷۲
  await page.evaluate(() => { const t = [...document.querySelectorAll('.mgmt-tab')].find(x => x.dataset.tab === 'courses'); if (t) t.click(); });
  await page.waitForTimeout(1000);
  const crsTxt = await page.locator('#mgmt-body').innerText();
  ok(crsTxt.includes('زمین مسجدسلیمان'), 'زمین مسجدسلیمان در مدیریت زمینها');
  const pars = await page.evaluate(() => window.Data.parsOf(1).reduce((a,b)=>a+b,0));
  ok(pars === 72, 'مجموع پار ۱۸ حفره = ۷۲');

  // ۱۰) دکمهٔ بازنشانی وجود دارد
  ok(await page.locator('#mgmt-reseed').count() === 1, 'دکمهٔ «بازنشانی دادهٔ فصل ۱۴۰۵» وجود دارد');

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
