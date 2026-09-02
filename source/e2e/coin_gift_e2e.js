/* E2E — باگِ کیف پول: سکه‌ای که مدیر می‌دهد باید در اکانت عضو دیده شود (حتی با نام کاربری حروف مختلف) */
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

  /* مستقیم تست کنید که با نام کاربری با حروف مختلف، کیف پول یکی است (بدون نیاز به UI) */
  const res = await page.evaluate(() => {
    const d = window.AV;
    // صفر کردن همه تا سناریو تمیز باشد
    try { localStorage.setItem('ga_coins', JSON.stringify({})); } catch(e){}
    const rawUser = 'MiXeD_GoLf' + Date.now();
    d.addCoins(rawUser, 123, 'admin', 'تست');
    const raw = d.coinOf(rawUser).total;
    const lower = d.coinOf(rawUser.toLowerCase()).total;
    return { raw, lower, same: raw > 0 && raw === lower };
  });
  ok(res.same, `سکهٔ اهدایی مدیر (${res.raw}) با ورودِ عضوِ کوچک‌شده (${res.lower}) برابر است — باگ رفع شد`);

  /* تست مهاجرت: کلید با حروف بزرگ موجود، بعد از خواندنِ عضوِ کوچک‌شده از بین نمی‌رود */
  const mig = await page.evaluate(() => {
    const D = window.AV;
    const u = 'LEGACY_User';
    try { localStorage.setItem('ga_coins', JSON.stringify({ [u]: { total: 77, log: [{amount:77, source:'admin', note:'قدیمی'}] } })); } catch(e){}
    return { total: D.coinOf(u.toLowerCase()).total, ok: D.coinOf(u.toLowerCase()).total === 77 };
  });
  ok(mig.ok, `کیف پول قدیمی با حروف بزرگ (${mig.total}) به عضوِ کوچک‌شده منتقل شد — بدون از دست رفتن داده`);

  ok(errors.length === 0, 'بدون خطای JavaScript: ' + (errors.slice(0,3).join(' | ') || '—'));

  console.log(`\n${pass} passed / ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
