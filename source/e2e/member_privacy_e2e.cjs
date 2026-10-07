/* حریم دادهٔ اعضا در «مرکز بازیکن» و «هوش زمین» (2026-10-07) — E2E مرورگری هرمتیک (mock_cloud.cjs).
 * عضو فقط بازیکنِ متصل به حساب خودش (ga_accounts.pid) را می‌بیند؛ مدیر همهٔ بازیکنان را.
 * پیش‌نیاز: python3 source/build_standalone.py
 * اجرا: NODE_PATH=…/node_modules CHROME=…/chrome node source/e2e/member_privacy_e2e.cjs
 */
const path = require('path');
const { chromium } = require('playwright-core');
const { createMockCloud } = require('./mock_cloud.cjs');
const HTML = process.env.HTML || path.join(__dirname, '..', 'GolfAcademy_PRO.html');
const BASE = 'https://qa.local/index.html';
const now = Date.now();
const FIXTURE = {
  ga_subscriptions: [1, 3].map(n => ({ id: 'sqa-p' + n, plan: 'trial', user: 'p' + n, user_id: 100 + n, status: 'trial', start_date: '2026-01-01', end_date: '2099-01-01', start_at: '2026-01-01', end_at: '2099-01-01', events: [] })),
  ga_avatars: { p1: { v6: 1, gender: 'm', sel: {}, owned: [], lvl: 8 } },
  // جلسهٔ باز که آخرین ضربه‌اش مال بازیکن ۲ است + یک جلسهٔ بسته با ضربه‌های بازیکن ۱ و ۲
  ga_sp_sessions: {
    sqo: { id: 'sqo', no: 9, type: 'Range', status: 'open', openedAt: new Date(now - 600000).toISOString() },
    sqc: { id: 'sqc', no: 8, type: 'Range', status: 'closed', openedAt: '2026-09-01T10:00:00.000Z', closedAt: '2026-09-01T11:00:00.000Z' },
  },
  ga_sp_shots: [
    { sid: 'sqc', pid: 1, club: 'Driver', yds: 180, res: 'straight', t: now - 9e7 },
    { sid: 'sqc', pid: 2, club: 'Iron 7', yds: 120, res: 'slice', t: now - 9e7 + 1 },
    { sid: 'sqo', pid: 1, club: 'Driver', yds: 175, res: 'hook', t: now - 300000 },
    { sid: 'sqo', pid: 2, club: 'Iron 7', yds: 130, res: 'straight', t: now - 1000 },
  ],
};
const ACCOUNTS = [
  { id: 1, user: 'admin', pass: 'Admin-Pass-QA1', name: 'مدیر', role: 'admin', main: true },
  { id: 101, user: 'p1', pass: 'Member-Pass-QA1', name: 'عضو یک', role: 'member', pid: 1 },
  { id: 103, user: 'p3', pass: 'Member-Pass-QA3', name: 'عضو سه', role: 'member', pid: null },
];
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS' : 'FAIL') + ' | ' + m); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  async function session(user, pw) {
    const cloud = createMockCloud({ store: JSON.parse(JSON.stringify(FIXTURE)), accounts: ACCOUNTS });
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    await cloud.attach(ctx, HTML);
    const page = await ctx.newPage(); const errors = [];
    // خطای قدیمیِ شناخته‌شده و بی‌اثر: cmd ← setTimeout ← Charts.spark($('#sp-1')) وقتی صفحه زود عوض شود (گزارش شده، دست نخورده)
    page.on('pageerror', e => { if (!/livePrep/.test(String(e.stack || ''))) errors.push(e.message); });
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('#login.on', { timeout: 20000 });
    await page.fill('#login-user', user); await page.fill('#login-pass', pw);
    await page.click('#login-form button[type="submit"]');
    await page.waitForFunction(() => document.getElementById('app').classList.contains('on'), null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    return { ctx, page, errors, cloud };
  }
  const opts = (page, id) => page.evaluate(i => { const s = document.getElementById(i); return s ? Array.from(s.options).map(o => +o.value) : null; }, id);
  const show = async (page, pg, tab) => { await page.evaluate(([p, t]) => { if (t) { const b = document.getElementById(t); } APP.go(p); }, [pg, tab]); await page.waitForTimeout(900); };
  const nameOf = (page, pid) => page.evaluate(n => (APP.state().A.LB.find(r => +r.pid === n) || {}).name, pid);

  /* ── عضو p1 (بازیکن ۱) ── */
  {
    const { ctx, page, errors } = await session('p1', 'Member-Pass-QA1');
    const lbN = await page.evaluate(() => APP.state().A.LB.length);
    ok(lbN > 1, 'دادهٔ آزمون چند بازیکن دارد (' + lbN + ')');
    await show(page, 'player');
    ok(await page.evaluate(() => !!document.getElementById('pl-sel')), 'عضو به «مرکز بازیکن» دسترسی دارد');
    for (const id of ['pl-sel', 'pp-player', 'pa-player']) ok(JSON.stringify(await opts(page, id)) === '[1]', `مرکز بازیکن ${id}: فقط بازیکن خودش → ` + JSON.stringify(await opts(page, id)));
    const p1n = await nameOf(page, 1), p2n = await nameOf(page, 2);
    // تلاش برای دیدن بازیکن دیگر با دستکاری انتخاب → باز هم خودش
    await page.evaluate(() => { const s = document.getElementById('pl-sel'); const o = document.createElement('option'); o.value = '2'; s.appendChild(o); s.value = '2'; s.dispatchEvent(new Event('change')); });
    await page.waitForTimeout(800);
    ok(JSON.stringify(await opts(page, 'pl-sel')) === '[1]' && await page.evaluate(() => document.getElementById('pl-sel').value) === '1', 'دستکاری انتخاب بازیکن هم به بازیکن خودش برمی‌گردد');
    // بازیکن هوشمند: جلسهٔ باز که آخرین ضربه‌اش مال بازیکن ۲ است
    await page.click('#pl-tab-smart'); await page.waitForTimeout(1200);
    for (const id of ['pl-sel-smart', 'sph-player']) ok(JSON.stringify(await opts(page, id)) === '[1]', `بازیکن هوشمند ${id}: فقط خودش`);
    const live = await page.evaluate(() => (document.querySelector('#sp-live h3') || {}).textContent || '');
    ok(live.includes(p1n) && !live.includes(p2n), 'تحلیل لحظه‌ای جلسهٔ باز: فقط ضربه‌های خودش (نه آخرین ضربه‌زنِ دیگر) → ' + live.trim());
    ok(!(await page.evaluate(() => !!document.getElementById('sp-record'))), 'دکمهٔ «ثبت رکورد» برای عضو نیست');
    await page.screenshot({ path: process.env.SHOT_DIR ? path.join(process.env.SHOT_DIR, 'member-player.png') : '/tmp/member-player.png' });
    await page.click('#pl-tab-classic').catch(() => {}); await page.waitForTimeout(500);
    // هوش زمین
    await show(page, 'course');
    ok(JSON.stringify(await opts(page, 'cs-pl')) === '[1]', 'هوش زمین cs-pl: فقط خودش');
    const st = await page.evaluate(() => document.getElementById('cs-stats').innerText);
    ok(/دورهای من/.test(st) && /میانگین من/.test(st), 'آمار زمین برای عضو از کارت‌های خودش («دورهای من»، «میانگین من vs پار»)');
    const me = await page.evaluate(() => {
      const { S } = APP.state(); const crs = +document.getElementById('cs-sel').value;
      return S.scorecards.filter(c => +c.pid === 1 && (S.tournaments.find(t => t[0] === c.tour) || [])[3] === crs).length;
    });
    ok(st.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).includes(String(me)), 'تعداد دورها = دورهای خود بازیکن ۱ در این زمین (' + me + ')');
    const pa = await page.evaluate(() => (document.querySelector('.earth-pa h3') || {}).textContent || '');
    ok(pa.includes(p1n), 'آنالیز تمرین زمین برای خودش: ' + pa.trim());
    await page.screenshot({ path: process.env.SHOT_DIR ? path.join(process.env.SHOT_DIR, 'member-course.png') : '/tmp/member-course.png' });
    ok(errors.length === 0, 'بدون خطای صفحه ' + (errors[0] || ''));
    await ctx.close();
  }
  /* ── عضو بدون بازیکنِ متصل ── */
  {
    const { ctx, page } = await session('p3', 'Member-Pass-QA3');
    await show(page, 'player');
    const t = await page.evaluate(() => document.getElementById('view').innerText);
    ok(/متصل نشده/.test(t) && !(await page.evaluate(() => !!document.getElementById('pl-sel'))), 'عضو بدون بازیکن: پیام، بدون دادهٔ هیچ بازیکنی');
    await show(page, 'course');
    ok(!(await page.evaluate(() => !!document.getElementById('cs-pl'))), 'هوش زمین هم برای عضو بدون بازیکن داده‌ای نشان نمی‌دهد');
    await ctx.close();
  }
  /* ── مدیر: همه مثل قبل ── */
  {
    const { ctx, page, errors } = await session('admin', 'Admin-Pass-QA1');
    const lbN = await page.evaluate(() => APP.state().A.LB.length);
    await show(page, 'player');
    ok((await opts(page, 'pl-sel')).length === lbN && (await opts(page, 'pp-player')).length === lbN, 'مدیر: مرکز بازیکن همهٔ ' + lbN + ' بازیکن');
    await page.click('#pl-tab-smart'); await page.waitForTimeout(1200);
    const live = await page.evaluate(() => (document.querySelector('#sp-live h3') || {}).textContent || '');
    ok(live.includes(await nameOf(page, 2)), 'مدیر: تحلیل لحظه‌ای مثل قبل روی آخرین ضربه‌زن جلسهٔ باز');
    await page.click('#pl-tab-classic').catch(() => {});
    await show(page, 'course');
    ok((await opts(page, 'cs-pl')).length === lbN, 'مدیر: هوش زمین همهٔ بازیکنان');
    const st = await page.evaluate(() => document.getElementById('cs-stats').innerText);
    ok(/دورهای برگزار/.test(st), 'مدیر: آمار کل زمین مثل قبل');
    ok(errors.length === 0, 'بدون خطای صفحه ' + (errors[0] || ''));
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
