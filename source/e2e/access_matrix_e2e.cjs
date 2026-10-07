/* اشتراک‌ها — ماتریس دسترسی پلن × صفحه/تب/بخش (ACCESS_TREE_V1) — E2E مرورگری هرمتیک (mock_cloud.cjs).
 * مدیر: صفحهٔ اشتراک‌ها، ادغام «تنظیمات نمایش»، روشن/خاموش کردن بخش‌ها برای هر پلن و ذخیره روی ابر.
 * عضو: فقط صفحه‌ها/تب‌ها/نمودارهای روشنِ پلن خودش را می‌بیند؛ مهاجرت سوییچ‌های قدیمی ga_ui.
 * پیش‌نیاز: python3 source/build_standalone.py
 * اجرا: NODE_PATH=…/node_modules CHROME=…/chrome node source/e2e/access_matrix_e2e.cjs
 */
const path = require('path');
const { chromium } = require('playwright-core');
const { createMockCloud } = require('./mock_cloud.cjs');
const HTML = process.env.HTML || path.join(__dirname, '..', 'GolfAcademy_PRO.html');
const BASE = 'https://qa.local/index.html';
const sub = (n, plan) => ({ id: 'sqa-p' + n, plan, user: 'p' + n, user_id: 100 + n, status: 'active', start_date: '2026-01-01', end_date: '2099-01-01', start_at: '2026-01-01', end_at: '2099-01-01', events: [] });
const AV = { v6: 1, gender: 'm', sel: {}, owned: [], lvl: 8 };
const BASE_STORE = {
  ga_subscriptions: [sub(1, 'trial'), sub(3, 'professional')],
  ga_avatars: { p1: AV, p3: AV },
};
const NEW_FEATS = {
  _v: 2,
  trial: { race: false, 'player.smart': false, 'player.classic.radar': false, 'cmd.monthly': false, 'memberzone.earn': false },
  professional: {},
};
const ACCOUNTS = [
  { id: 1, user: 'admin', pass: 'Admin-Pass-QA1', name: 'مدیر', role: 'admin', main: true },
  { id: 101, user: 'p1', pass: 'Member-Pass-QA1', name: 'عضو یک', role: 'member', pid: 1 },
  { id: 103, user: 'p3', pass: 'Member-Pass-QA3', name: 'عضو سه', role: 'member', pid: 3 },
];
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS' : 'FAIL') + ' | ' + m); };
const SHOT = (n) => process.env.SHOT_DIR ? path.join(process.env.SHOT_DIR, n) : '/tmp/' + n;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  async function session(user, pw, store, vp) {
    const cloud = createMockCloud({ store: JSON.parse(JSON.stringify(store)), accounts: ACCOUNTS });
    const ctx = await browser.newContext({ viewport: vp || { width: 1440, height: 950 } });
    await cloud.attach(ctx, HTML);
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => { if (!/livePrep/.test(String(e.stack || ''))) errors.push(e.message); });
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('#login.on', { timeout: 20000 });
    await page.fill('#login-user', user); await page.fill('#login-pass', pw);
    await page.click('#login-form button[type="submit"]');
    await page.waitForFunction(() => document.getElementById('app').classList.contains('on'), null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    return { ctx, page, errors, cloud };
  }
  const go = async (page, pg) => { await page.evaluate(p => APP.go(p), pg); await page.waitForTimeout(900); };
  const cur = (page) => page.evaluate(() => (location.hash || '').slice(1));
  const vis = (page, sel) => page.evaluate(s => { const e = document.querySelector('#view ' + s); return !!(e && e.offsetParent !== null && getComputedStyle(e).display !== 'none'); }, sel);
  const navShown = (page, pg) => page.evaluate(p => { const n = document.querySelector('#app .nav-item[data-page="' + p + '"]'); return !!(n && n.style.display !== 'none'); }, pg);

  /* ── ۱) مدیر: صفحهٔ اشتراک‌ها ── */
  {
    const { ctx, page, errors, cloud } = await session('admin', 'Admin-Pass-QA1', Object.assign({}, BASE_STORE, { ga_plan_features: NEW_FEATS }));
    ok(!(await page.evaluate(() => !!document.querySelector('#app .nav-item[data-page="settings"]'))), 'آیتم «تنظیمات نمایش» از منو حذف شده است');
    await go(page, 'settings');
    ok(await cur(page) === 'subs' && await page.evaluate(() => !!document.getElementById('acx-grid')), 'مسیر قدیمی #settings → صفحهٔ اشتراک‌ها (ماتریس)');
    const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.acx-row.lv0 .acx-t')).map(e => e.textContent.trim()));
    ok(rows.length === 12, '۱۲ صفحهٔ اعضا در ماتریس → ' + rows.join('، '));
    ok(!rows.some(r => /یوزرها|اشتراک‌ها|تنظیمات نمایش|پنل مدیریت|ارسال پیام/.test(r)), 'ردیف‌های مدیریتی (یوزرها/اشتراک‌ها/…) در ماتریس نیستند');
    const heads = await page.evaluate(() => document.querySelectorAll('.acx-head .acx-plan').length);
    ok(heads === 5, '۵ ستون پلن');
    ok(await page.evaluate(() => document.querySelectorAll('.acx-row.lv1, .acx-row.lv2').length === 0), 'پیش‌فرض: همهٔ گروه‌ها بسته‌اند');
    await page.click('[data-acx-open="player"]'); await page.waitForTimeout(250);
    const kids = await page.evaluate(() => Array.from(document.querySelectorAll('.acx-row.lv1, .acx-row.lv2')).map(r => r.dataset.acxRow));
    ok(kids.includes('player.classic') && kids.includes('player.smart') && kids.includes('player.classic.radar') && kids.includes('player.smart.notes'), 'باز کردن «مرکز بازیکن»: تب کلاسیک و هوشمند + نمودارهای هر کدام (' + kids.length + ' ردیف)');
    // وضعیت ذخیره‌شده درست نمایش داده می‌شود
    const st = await page.evaluate(() => {
      const q = (id, pl) => document.querySelector(`[data-acx-id="${id}"][data-acx-plan="${pl}"]`);
      return { radarTrial: q('player.classic.radar', 'trial').checked, radarPro: q('player.classic.radar', 'professional').checked,
        smartTrial: q('player.smart', 'trial').checked, notesTrialDis: q('player.smart.notes', 'trial').disabled };
    });
    ok(!st.radarTrial && st.radarPro, 'رادار مهارت: Trial خاموش، Professional روشن');
    ok(!st.smartTrial && st.notesTrialDis, 'تب «بازیکن هوشمند» خاموش برای Trial → بخش‌هایش غیرفعال (ارث‌بری)');
    // تغییر: خاموش کردن «توزیع اسکور» برای Starter
    await page.evaluate(() => { const i = document.querySelector('[data-acx-id="player.classic.dist"][data-acx-plan="starter"]'); i.click(); });
    await page.waitForTimeout(400);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_plan_features')));
    ok(saved._v === 2 && saved.starter['player.classic.dist'] === false && saved.trial['player.classic.radar'] === false, 'ذخیره: starter.player.classic.dist=false و مقادیر قبلی حفظ شد');
    // روشن کردن یک بخش، والد خاموشش را هم روشن می‌کند
    await page.evaluate(() => document.querySelector('[data-acx-id="player.smart"][data-acx-plan="trial"]').click()); await page.waitForTimeout(300);
    ok(await page.evaluate(() => !document.querySelector('[data-acx-id="player.smart.notes"][data-acx-plan="trial"]').disabled), 'روشن کردن تب، بخش‌های داخلش را فعال می‌کند');
    await page.evaluate(() => document.querySelector('[data-acx-id="player.smart"][data-acx-plan="trial"]').click()); await page.waitForTimeout(300);
    // عملیات ردیف: «✕» برای همهٔ پلن‌ها
    await page.evaluate(() => document.querySelector('[data-row-id="player.classic.holes"][data-row-val="0"]').click()); await page.waitForTimeout(300);
    const holes = await page.evaluate(() => { const f = JSON.parse(localStorage.getItem('ga_plan_features')); return ['trial', 'starter', 'professional', 'business', 'enterprise'].map(c => f[c]['player.classic.holes']); });
    ok(holes.every(x => x === false), 'دکمهٔ ردیف «✕»: ضربات حفره‌به‌حفره برای هر ۵ پلن خاموش');
    await page.evaluate(() => document.querySelector('[data-row-id="player.classic.holes"][data-row-val="1"]').click()); await page.waitForTimeout(300);
    // جستجو
    await page.fill('#acx-q', 'یادداشت'); await page.waitForTimeout(250);
    const found = await page.evaluate(() => Array.from(document.querySelectorAll('.acx-row')).map(r => r.dataset.acxRow).filter(Boolean));
    ok(found.includes('player.smart.notes') && !found.includes('cmd'), 'جستجوی «یادداشت» → فقط مسیر یادداشت‌های مربی (' + found.join(',') + ')');
    await page.fill('#acx-q', ''); await page.waitForTimeout(200);
    await page.click('#acx-expand'); await page.waitForTimeout(300);
    const allRows = await page.evaluate(() => document.querySelectorAll('.acx-row[data-acx-row]').length);
    ok(allRows >= 70, 'باز کردن همه → ' + allRows + ' ردیف قابل‌کنترل');
    await page.screenshot({ path: SHOT('access-matrix-full.png'), fullPage: false });
    await page.click('#acx-collapse'); await page.click('[data-acx-open="player"]'); await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT('access-matrix.png') });
    // ابر: کلید ga_plan_features روی سرور هم ذخیره شد
    await page.evaluate(() => window.GA_CLOUD && GA_CLOUD.flush && GA_CLOUD.flush()).catch(() => {});
    await page.waitForTimeout(2500);
    const srv = cloud.store.ga_plan_features && cloud.store.ga_plan_features.v;
    ok(!!(srv && srv._v === 2 && srv.starter && srv.starter['player.classic.dist'] === false), 'سرور (mock) ماتریس جدید را دریافت کرد');
    // تب‌های دیگر
    await page.click('[data-subs-tab="pricing"]'); await page.waitForTimeout(300);
    ok(await page.evaluate(() => document.querySelectorAll('[data-plan-price]').length === 5 && document.querySelectorAll('[data-cyc]').length >= 4), 'تب «قیمت و تخفیف»: ۵ قیمت + تخفیف مدت');
    await page.click('[data-subs-tab="members"]'); await page.waitForTimeout(300);
    ok(await page.evaluate(() => /اشتراک یوزرها/.test(document.getElementById('subs-pane').innerText)), 'تب «اشتراک یوزرها» فهرست یوزرها را نشان می‌دهد');
    // مدیر همه را می‌بیند (حتی بخش‌های خاموشِ پلن‌ها)
    await go(page, 'player');
    ok(await vis(page, '[data-acc="player.classic.radar"]') && await vis(page, '#pl-tab-smart'), 'مدیر: رادار و تب هوشمند دیده می‌شوند (معاف از پلن)');
    // موبایل
    await page.setViewportSize({ width: 390, height: 844 }); await go(page, 'subs'); await page.click('[data-subs-tab="access"]'); await page.waitForTimeout(400);
    const mob = await page.evaluate(() => { const s = document.querySelector('.acx-scroll'); const l = document.querySelector('.acx-row.lv0 .acx-lbl'); return { scroll: s.scrollWidth > s.clientWidth, sticky: getComputedStyle(l).position }; });
    ok(mob.scroll && mob.sticky === 'sticky', 'موبایل: ماتریس اسکرول افقی و ستون نام چسبان');
    await page.screenshot({ path: SHOT('access-matrix-mobile.png') });
    ok(errors.length === 0, 'مدیر: بدون خطای صفحه ' + (errors.length ? JSON.stringify(errors.slice(0, 3)) : ''));
    await ctx.close();
  }

  /* ── ۲) عضو p1 روی پلن Trial (ماتریس جدید) ── */
  {
    const { ctx, page, errors } = await session('p1', 'Member-Pass-QA1', Object.assign({}, BASE_STORE, { ga_plan_features: NEW_FEATS }));
    ok(!(await navShown(page, 'race')), 'Trial: «رقابت فصل» در منو نیست');
    ok(await navShown(page, 'player') && await navShown(page, 'cmd'), 'Trial: «مرکز بازیکن» و «فرماندهی» در منو هستند');
    ok(await navShown(page, 'battle'), 'Trial: «میدان نبرد» (روشن در ماتریس جدید) در منوی عضو آمد');
    await go(page, 'race');
    ok(await cur(page) === 'memberzone', 'رفتن مستقیم به #race → برگشت به بخش اعضا');
    ok(!(await page.evaluate(() => Array.from(document.querySelectorAll('#view [data-mtab]')).some(t => t.dataset.mtab === 'earn'))), 'بخش اعضا: تب «دریافت سکه» برای Trial نیست');
    ok(await page.evaluate(() => document.querySelectorAll('#view [data-mtab]').length === 3), 'بخش اعضا: ۳ تب دیگر سر جایشان');
    await page.evaluate(() => { const b = document.querySelector('#view [data-mtab="guide"]'); b && b.click(); }); await page.waitForTimeout(500);
    ok(await vis(page, '[data-acc="memberzone.guide.table"]'), 'تب «راهنمای سکه» محتوا دارد');
    await go(page, 'player');
    ok(!(await vis(page, '[data-acc="player.classic.radar"]')), 'مرکز بازیکن: «رادار مهارت» برای Trial پنهان');
    ok(await vis(page, '[data-acc="player.classic.dist"]') && await vis(page, '[data-acc="player.classic.gold"]'), 'مرکز بازیکن: «توزیع اسکور» و «Gold Elite» دیده می‌شوند');
    ok(!(await vis(page, '#pl-tab-smart')), 'تب «بازیکن هوشمند» برای Trial پنهان');
    await page.evaluate(() => { const b = document.getElementById('pl-tab-smart'); if (b) b.click(); }); await page.waitForTimeout(700);
    ok(!(await page.evaluate(() => !!document.getElementById('sp-live'))), 'کلیک اجباری روی تب هوشمند هم محتوای هوشمند را باز نمی‌کند');
    await go(page, 'cmd');
    ok(!(await vis(page, '[data-acc="cmd.monthly"]')) && await vis(page, '[data-acc="cmd.podium"]'), 'فرماندهی: «امتیاز ماهانه» پنهان، «سکوی قهرمانی» دیده می‌شود');
    await page.screenshot({ path: SHOT('access-member-trial.png') });
    ok(errors.length === 0, 'عضو Trial: بدون خطای صفحه ' + (errors.length ? JSON.stringify(errors.slice(0, 3)) : ''));
    await ctx.close();
  }

  /* ── ۳) عضو p3 روی Professional: همه‌چیز روشن ── */
  {
    const { ctx, page, errors } = await session('p3', 'Member-Pass-QA3', Object.assign({}, BASE_STORE, { ga_plan_features: NEW_FEATS }));
    await go(page, 'player');
    ok(await vis(page, '[data-acc="player.classic.radar"]') && await vis(page, '#pl-tab-smart'), 'Professional: رادار و تب هوشمند دیده می‌شوند');
    await page.click('#pl-tab-smart'); await page.waitForTimeout(900);
    ok(await vis(page, '[data-acc="player.smart.live"]') && await vis(page, '[data-acc="player.smart.notes"]'), 'Professional: بازیکن هوشمند کامل');
    ok(await navShown(page, 'race'), 'Professional: «رقابت فصل» در منو');
    ok(errors.length === 0, 'عضو Professional: بدون خطای صفحه ' + (errors.length ? JSON.stringify(errors.slice(0, 3)) : ''));
    await ctx.close();
  }

  /* ── ۴) مهاجرت: دادهٔ قدیمی (بدون _v) + سوییچ‌های ga_ui ── */
  {
    const legacy = Object.assign({}, BASE_STORE, {
      ga_plan_features: { trial: { tv: false }, professional: {} },
      ga_ui: { memPlayer: false, chMonthly: false },
    });
    const { ctx, page, errors } = await session('p3', 'Member-Pass-QA3', legacy);
    ok(!(await navShown(page, 'player')), 'مهاجرت: memPlayer=false → «مرکز بازیکن» برای عضو پنهان می‌ماند');
    ok(!(await navShown(page, 'battle')) && !(await navShown(page, 'academy')), 'مهاجرت: «میدان نبرد» و «پنل آکادمی» مثل قبل برای عضو پنهان');
    ok(await navShown(page, 'tv'), 'مهاجرت: tv برای Professional روشن (فقط Trial خاموش بود)');
    await go(page, 'cmd');
    ok(!(await vis(page, '[data-acc="cmd.monthly"]')), 'مهاجرت: chMonthly=false → «امتیاز ماهانه» پنهان');
    ok(errors.length === 0, 'مهاجرت: بدون خطای صفحه');
    await ctx.close();
  }
  {
    // مدیر دادهٔ قدیمی را می‌بیند و اولین ذخیره، نسخهٔ ۲ را با همان وضعیت می‌نویسد
    const legacy = Object.assign({}, BASE_STORE, { ga_plan_features: { trial: { tv: false } }, ga_ui: { memPlayer: false } });
    const { ctx, page, errors } = await session('admin', 'Admin-Pass-QA1', legacy);
    await go(page, 'subs');
    const pre = await page.evaluate(() => ['trial', 'professional'].map(c => document.querySelector(`[data-acx-id="player"][data-acx-plan="${c}"]`).checked));
    ok(pre.every(x => x === false), 'ماتریس، خاموشی قدیمی «مرکز بازیکن» را برای همهٔ پلن‌ها نشان می‌دهد');
    await page.evaluate(() => document.querySelector('[data-acx-id="player"][data-acx-plan="professional"]').click()); await page.waitForTimeout(300);
    const f = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_plan_features')));
    ok(f._v === 2 && f.professional.player === true && f.trial.player === false && f.trial.tv === false && f.trial.battle === false, 'اولین ذخیره → _v=2 با حفظ همهٔ مقادیر مهاجرت‌شده');
    ok(errors.length === 0, 'مدیر/مهاجرت: بدون خطای صفحه');
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
