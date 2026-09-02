/* E2E v7:
   ۱) موبایل: دکمهٔ «ورود اعضا» کوچک و بالای صفحه + جابه‌جایی تصویر لابی (خانم رسپشن وسط)
   ۲) همگام‌سازی دوطرفهٔ یوزر/رمز بین «بازیکنان» و «یوزرها»
   ۳) سکه‌های قهرمانی خودکار و واکنشی (حذف/تغییر نتیجه = کم/زیاد شدن سکه)
   ۴) صدا: پنل بی‌صدا — صدای سوئیت‌اسپات روی فریم ضربه و تشویق روی ورود توپ به حفره */
const { chromium } = require('playwright-core');
const fs = require('fs');
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/golf-academy-screenshots';
fs.mkdirSync(SHOT_DIR, { recursive: true });
const EXE = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1140/chrome-linux/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8181/index.html';

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 850 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  const ok = (c, msg) => console.log((c ? 'PASS' : 'FAIL') + ' | ' + msg);
  const shot = n => page.screenshot({ path: SHOT_DIR + '/' + n });
  const realErrors = () => errors.filter(e => !/arcTo/.test(e));

  /* ابزار صدا: هر ساخت نُد صوتی با زمانش ثبت می‌شود */
  await page.addInitScript(() => {
    window.__SFX = { marks: [] };
    const O = window.AudioContext || window.webkitAudioContext;
    if (!O) return;
    function Patched(){
      const c = new O();
      const co = c.createOscillator.bind(c), cb = c.createBufferSource.bind(c);
      c.createOscillator = function(){ window.__SFX.marks.push(performance.now()); return co(); };
      c.createBufferSource = function(){ window.__SFX.marks.push(performance.now()); return cb(); };
      return c;
    }
    window.AudioContext = Patched; window.webkitAudioContext = Patched;
  });

  async function gotoLanding(){
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__L3D && window.__L3D.state().introDone, null, { timeout: 25000 });
    await page.waitForFunction(() => document.getElementById('l3d-intro').classList.contains('l3d-hide'), null, { timeout: 6000 });
  }
  async function login(u, p){
    const vis = await page.locator('#l3d-enter').isVisible().catch(() => false);
    if (vis){ await page.click('#l3d-enter', { force: true }); await page.waitForTimeout(900); }
    await page.fill('#login-user', u);
    await page.fill('#login-pass', p);
    await page.click('#login-form button[type="submit"]');
    await page.waitForTimeout(1600);
  }
  async function logout(){
    await page.click('#logout-btn');
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => window.__L3D && window.__L3D.state().introDone, null, { timeout: 25000 });
  }
  async function mtab(id){
    await page.evaluate(t => { [...document.querySelectorAll('.mgmt-tab')].find(x => x.dataset.tab === t).click(); }, id);
    await page.waitForTimeout(800);
  }

  /* ═══════════ ۴) صدا ═══════════ */
  await gotoLanding();
  const sfx = await page.evaluate(() => window.__SFX.marks.slice());
  ok(sfx.length > 0, 'اینترو صدا تولید می‌کند (' + sfx.length + ' نُد صوتی)');
  // بزرگ‌ترین انفجار صدا در بازهٔ ۸۰۰ms → تشویق جمعیت (ده‌ها کف‌زدن)
  let burst = 0;
  for (let i = 0; i < sfx.length; i++){
    const n = sfx.filter(t => t >= sfx[i] && t < sfx[i] + 800).length;
    if (n > burst) burst = n;
  }
  ok(burst >= 40, 'صدای تشویق جمعیت (انفجار ' + burst + ' کف‌زدن در کمتر از یک ثانیه) پخش شد');
  const before = await page.evaluate(() => window.__SFX.marks.length);
  // پنل باید کاملاً بی‌صدا باشد
  await page.click('#l3d-dock [data-sec="info"]').catch(async () => { await page.click('#l3d-dock .di:nth-child(2)'); });
  await page.waitForTimeout(700);
  await page.mouse.move(680, 300); await page.mouse.move(700, 320);
  await page.click('#l3d-panel .cl').catch(() => {});
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => window.__SFX.marks.length);
  ok(after === before, 'پنل و لابی هیچ صدایی ندارند (نُد صوتی جدید: ' + (after - before) + ')');
  // منابع: صداهای پنل حذف و صداهای اینترو اضافه شده‌اند
  const src = await page.evaluate(async () => {
    const inline = [...document.querySelectorAll('script')].map(s => s.textContent).join('\n');
    let ext = '';
    for (const s of [...document.querySelectorAll('script[src]')]){
      try { ext += await (await fetch(s.src)).text(); } catch(e){}
    }
    return inline + ext;
  });
  ok(/sfx\('sweet'\)/.test(src), 'صدای «سوئیت‌اسپات» روی فریم ضربه تعریف شده است');
  ok(/sfx\('applause'\)/.test(src), 'صدای تشویق جمعیت روی فریم ورود توپ به حفره تعریف شده است');
  ok(!/sfx\('hover'\)/.test(src) && !/sfx\('open'\)/.test(src) && !/sfx\('close'\)/.test(src), 'صداهای پنل (hover/open/close) کاملاً حذف شدند');
  ok(!/setInterval\(function\(\)\{\s*if \(!AC/.test(src), 'صدای پس‌زمینهٔ دائمی لابی حذف شد');

  /* ═══════════ ۲) همگام‌سازی یوزر/رمز ═══════════ */
  await login('admin', 'golf1405');
  await page.click('.nav-item[data-page="mgmt"]');
  await page.waitForTimeout(900);
  await mtab('players');
  await page.click('[data-act="edit"][data-p="1"]');
  await page.waitForTimeout(700);
  await page.fill('#modal-edit #pf-user', 'babak7');
  await page.fill('#modal-edit #pf-pass', 'pass7v');
  await page.click('#ep-save');
  await page.waitForTimeout(1200);
  await mtab('users');
  const uTxt = await page.locator('#mgmt-body').innerText();
  ok(/babak7/.test(uTxt) && /pass7v/.test(uTxt), 'v7: یوزر/رمز ویرایش‌شده در فرم بازیکن، در لیست یوزرها هم به‌روز شد');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_users') || '[]').find(u => +u.pid === 1));
  ok(stored && stored.user === 'babak7' && stored.pass === 'pass7v', 'v7: رکورد یوزر بازیکن ۱ در ga_users همگام است');
  await shot('v7_sync_users.png');

  // برعکس: تغییر از لیست یوزرها → فرم بازیکن
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('#us-rows tr')].find(r => r.innerText.includes('babak7'));
    row.querySelector('[data-pw]').click();
  });
  await page.waitForTimeout(600);
  await page.fill('#modal-edit #pw-user', 'babak9');
  await page.fill('#modal-edit #pw-val', 'pass9v');
  await page.click('#pw-save');
  await page.waitForTimeout(900);
  const pu = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_player_users') || '{}')['1']);
  ok(pu && pu.user === 'babak9' && pu.pass === 'pass9v', 'v7: تغییر یوزر/رمز در لیست یوزرها، به مشخصات بازیکن برگشت');
  await mtab('players');
  await page.click('[data-act="edit"][data-p="1"]');
  await page.waitForTimeout(700);
  const formUser = await page.inputValue('#modal-edit #pf-user');
  const formPass = await page.inputValue('#modal-edit #pf-pass');
  ok(formUser === 'babak9' && formPass === 'pass9v', 'v7: فرم بازیکن مقدار جدید یوزر/رمز را نشان می‌دهد');
  await page.click('#ep-cancel');
  await page.waitForTimeout(400);

  // ورود واقعی با اعتبار جدید
  await logout();
  await login('babak9', 'pass9v');
  ok(!(await page.locator('#login').isVisible()), 'v7: ورود با یوزر/رمز جدیدِ همگام‌شده انجام شد');
  await logout();
  await login('admin', 'golf1405');

  /* ═══════════ ۳) سکه‌های قهرمانی خودکار و واکنشی ═══════════ */
  await page.click('.nav-item[data-page="mgmt"]');
  await page.waitForTimeout(800);
  await mtab('coins');
  const walletOf = async (user) => page.evaluate(u => {
    const c = window.AV.coinOf(u);
    return { total: c.total, base: c.base, auto: c.auto, items: (c.autoItems || []).length };
  }, user);
  const w1 = await walletOf('babak9');
  ok(w1.auto > 0 && w1.items > 0, 'v7: سکهٔ قهرمانی به‌صورت خودکار محاسبه شد (' + w1.auto + ' سکه از ' + w1.items + ' قهرمانی)');
  ok(w1.total === w1.base + w1.auto, 'v7: موجودی کل = سکهٔ ثبت‌شده + سکهٔ خودکار قهرمانی');
  const tbl = await page.locator('#mgmt-body').innerText();
  ok(/قهرمانی \(خودکار\)/.test(tbl), 'v7: ستون «قهرمانی (خودکار)» در کیف‌پول اعضا نمایش داده می‌شود');

  const resultsBackup = await page.evaluate(() => localStorage.getItem('ga_results'));
  // حذف یک قهرمانی → کم شدن سکه
  const del = await page.evaluate(() => {
    const res = JSON.parse(localStorage.getItem('ga_results') || '{}');
    const tid = Object.keys(res).find(k => res[k] && res[k].top && +res[k].top[1] === 1);
    const t = tid;
    delete res[tid];
    localStorage.setItem('ga_results', JSON.stringify(res));
    return t;
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const w2 = await walletOf('babak9');
  ok(w2.auto < w1.auto, 'v7: با حذف یک مسابقه، سکهٔ خودکار عضو کم شد (' + w1.auto + ' → ' + w2.auto + ')');
  ok(w2.items === w1.items - 1, 'v7: تعداد قهرمانی‌های محاسبه‌شده یکی کم شد');

  // انتقال قهرمانی به عضو دیگر → جابه‌جایی سکه
  const otherUser = await page.evaluate(() => {
    const u = JSON.parse(localStorage.getItem('ga_users') || '[]').find(x => +x.pid === 3);
    return u ? u.user : null;
  });
  const w3before = otherUser ? await walletOf(otherUser) : null;
  const other = await page.evaluate(() => {
    const res = JSON.parse(localStorage.getItem('ga_results') || '{}');
    const tid = Object.keys(res).find(k => res[k] && res[k].top && +res[k].top[1] === 1);
    if (!tid) return null;
    res[tid].top[1] = 3;
    localStorage.setItem('ga_results', JSON.stringify(res));
    const u = JSON.parse(localStorage.getItem('ga_users') || '[]').find(x => +x.pid === 3);
    return u ? u.user : null;
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const w3 = await walletOf('babak9');
  const wo = other ? await walletOf(other) : null;
  ok(w3.auto < w2.auto, 'v7: با تغییر قهرمان، سکهٔ عضو قبلی کم شد (' + w2.auto + ' → ' + w3.auto + ')');
  ok(!!wo && wo.auto > (w3before ? w3before.auto : 0), 'v7: سکهٔ قهرمان جدید زیاد شد (' + (wo ? wo.auto : '-') + ')');

  // بازگرداندن نتایج اصلی فصل
  await page.evaluate(b => { localStorage.setItem('ga_results', b); }, resultsBackup);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const w4 = await walletOf('babak9');
  ok(w4.auto >= w1.auto, 'v7: با بازگردانی نتایج، سکه‌های قهرمانی دوباره برگشتند (' + w4.auto + ')');
  await shot('v7_coins_auto.png');

  /* ═══════════ ۱) موبایل ═══════════ */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await mctx.newPage();
  await mp.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  await mp.waitForSelector('#l3d-enter', { timeout: 15000 });
  await mp.waitForFunction(() => window.__L3D && window.__L3D.state().introDone, null, { timeout: 25000 });
  await mp.waitForTimeout(800);
  const box = await mp.evaluate(() => {
    const el = document.querySelector('#l3d-enter'), r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { top: r.top, bottom: r.bottom, w: r.width, h: r.height, cx: r.left + r.width / 2, fs: parseFloat(cs.fontSize) };
  });
  ok(box.top < 60, 'v7 موبایل: دکمهٔ «ورود اعضا» بالای صفحه است (top=' + Math.round(box.top) + ')');
  ok(box.w < 390 * 0.8 && box.h < 46 && box.fs <= 13, 'v7 موبایل: دکمه کوچک شد (' + Math.round(box.w) + '×' + Math.round(box.h) + ')');
  ok(box.bottom < 844 - 60, 'v7 موبایل: دکمه پایین صفحه بریده نمی‌شود');
  const bgPos = await mp.evaluate(() => getComputedStyle(document.querySelector('#l3d-bg')).backgroundPosition);
  ok(/^(1|2)\d/.test(bgPos.trim()), 'v7 موبایل: تصویر لابی به سمت چپ جابه‌جا شد (' + bgPos + ')');
  const rcx = await mp.evaluate(() => { const r = document.querySelector('#l3d-reception').getBoundingClientRect(); return r.left + r.width / 2; });
  ok(Math.abs(rcx - 195) < 30, 'v7 موبایل: خانم رسپشن وسط قاب است (cx=' + Math.round(rcx) + ')');
  await mp.screenshot({ path: SHOT_DIR + '/v7_mobile_landing.png' });
  await mctx.close();

  ok(realErrors().length === 0, 'بدون خطای جاوااسکریپت' + (realErrors().length ? ' → ' + realErrors().slice(0, 3).join(' | ') : ''));
  await browser.close();
})().catch(e => { console.log('FATAL | ' + e.message); process.exit(1); });
