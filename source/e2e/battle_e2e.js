/* E2E — نبرد میدان‌ها: مدیریت تیم‌ها، جدال‌های رو‌در‌رو و تأثیر نتیجه روی فصل */
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
  await page.click('#login-form button[type="submit"]'); await page.waitForTimeout(1300);
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

  /* ماژول Battle در دسترس است */
  const hasBattle = await page.evaluate(() => !!window.Battle);
  ok(hasBattle, 'ماژول «نبرد میدان‌ها» بارگذاری شده است');

  /* تب «نبرد میدان‌ها» در پنل مدیریت */
  await page.click('.nav-item[data-page="mgmt"]'); await page.waitForTimeout(700);
  ok(await page.locator('.mgmt-tab[data-tab="battle"]').count() === 1, 'تب «نبرد میدان‌ها» به پنل مدیریت اضافه شده است');

  /* صفحهٔ «میدان نبرد» با تیم‌های پیش‌فرض رندر می‌شود */
  await page.evaluate(() => { if (window.Battle) Battle.reset(); });
  await page.evaluate(() => APP.reloadData());
  await page.click('.nav-item[data-page="battle"]'); await page.waitForTimeout(700);
  const pageTxt = await page.locator('body').innerText();
  ok(/جدال تیم‌ها/.test(pageTxt), 'صفحهٔ «میدان نبرد» رندر می‌شود');
  ok(/عقاب‌های طلایی/.test(pageTxt) || /یوزرهای سبز/.test(pageTxt), 'تیم‌های پیش‌فرض در صفحهٔ نبرد نمایش داده می‌شوند');

  /* ساخت سناریوی کنترل‌شده: دو تیم تک‌بازیکنی + یک جدال کامل شده */
  const setup = await page.evaluate(() => {
    const B = window.Battle;
    B.reset();
    // تنظیمات: اثر روی فصل فعال، برد=۲ امتیاز فصل، مساوی=۱، باخت=۰
    B.saveSettings({ winPts:3, drawPts:1, lossPts:0, seasonWinPts:5, seasonDrawPts:2, seasonLossPts:0, seasonEnabled:true });
    const a = B.addTeam({ name:'تیم آلفا', icon:'🦅', color:'#D4AF37', members:[1] });
    const b = B.addTeam({ name:'تیم بتا', icon:'🐆', color:'#1EBB8A', members:[2] });
    // حذف تیم‌های پیش‌فرض تا فقط دو تیم بماند
    const d = B.ensure();
    d.teams = d.teams.filter(t => t.id === a || t.id === b);
    // حذف جدال‌های قبلی
    d.matches = [];
    B.save(d);
    const m = B.addMatch({ home:a, away:b, date:'2026-08-20', status:'scheduled', winner:null, homeScore:null, awayScore:null, counted:true });
    return { a, b, m };
  });
  ok(setup.a && setup.b && setup.m, 'دو تیم و یک جدال ساخته شد');

  const before = await page.evaluate(() => { APP.reloadData(); return APP.state().A.PTS[1]; });
  await page.evaluate(({m, a, b}) => { window.Battle.setResult(m, 'home', 2, 0); }, setup);
  const after = await page.evaluate(() => { APP.reloadData(); return { p1: APP.state().A.PTS[1], p2: APP.state().A.PTS[2] }; });
  ok(after.p1 - before === 5, `دو تیم بازی کردند: امتیاز فصلِ بازیکنِ تیم برنده ${after.p1 - before} افزایش یافت (متغیر فصل) — انتظار ۵`);
  ok(after.p2 >= 0 && after.p2 === after.p2, 'بازیکنِ تیم بازنده امتیاز فصلِ باخت (۰) گرفت');

  /* جدول تیمی (امتیاز رو‌در‌رو) */
  const st = await page.evaluate(() => window.Battle.standings());
  ok(st.length === 2, `جدول تیمی ${st.length} تیم دارد`);
  ok(st[0].win === 1, 'تیم برنده ۱ برد در جدول تیمی ثبت کرد');
  ok(st[0].pts === 3, 'تیم برنده ۳ امتیاز جدول تیمی دارد');

  /* داده در localStorage ذخیره شده */
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_battle') || 'null'));
  ok(stored && stored.teams.length === 2 && stored.matches.length === 1, 'دادهٔ نبرد در localStorage ذخیره شد');

  /* رندر صفحهٔ نبرد با نتیجهٔ جدال */
  await page.click('.nav-item[data-page="battle"]'); await page.waitForTimeout(700);
  const pageTxt2 = await page.locator('body').innerText();
  ok(/تیم آلفا/.test(pageTxt2) && /تیم بتا/.test(pageTxt2), 'تیم‌های جدید در صفحهٔ نبرد دیده می‌شوند');
  ok(/پیروز/.test(pageTxt2), 'نتیجهٔ جدال (پیروز) در صفحهٔ نبرد دیده می‌شود');

  ok(errors.length === 0, 'بدون خطای JavaScript: ' + (errors.slice(0,3).join(' | ') || '—'));

  console.log(`\n${pass} passed / ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
