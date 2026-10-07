/* فرماندهی → «جلسات تمرین» (PRACTICE_DAYS_V2) — E2E مرورگری هرمتیک (mock_cloud.cjs).
 * شمارش روزهای تمرین برگزارشدهٔ فصل از رویدادهای تقویم (ga_events) و دوره‌ها (ga_programs) با نوع «تمرین».
 * پیش‌نیاز: python3 source/build_standalone.py
 */
const path = require('path');
const { chromium } = require('playwright-core');
const { createMockCloud } = require('./mock_cloud.cjs');
const HTML = process.env.HTML || path.join(__dirname, '..', 'GolfAcademy_PRO.html');
const BASE = 'https://qa.local/index.html';
const iso = (d) => d.toISOString().slice(0, 10);
const tomorrow = iso(new Date(Date.now() + 2 * 86400000));
const ev = (start, type, participants, name) => ({ name: name || ('رویداد ' + start), type, start, end: start, pts: 5, col: '#1EBB8A', participants, schedule: [{ label: type, offset: 0 }] });
const FIX = {
  ga_events: [
    ev('2026-04-09', 'تمرین', [1, 2], 'تمرین هفتگی ۲۰ فروردین'),
    ev('2026-04-09', 'تمرین', [], 'تکراری همان روز، بدون شرکت‌کننده'),
    ev('2026-05-07', 'تمرین', [3]),
    ev('2026-05-28', 'تمرین', [], 'بدون شرکت‌کننده'),
    ev('2026-06-11', 'مسابقه', [1]),
    ev('2026-09-29', 'کلاس', [1]),
    ev(tomorrow, 'تمرین', [1], 'آینده'),
    ev('2025-12-01', 'تمرین', [1], 'فصل قبل'),
    ev('2026-07-02', 'تمرین', [99], 'بازیکن ناموجود'),
  ],
  ga_programs: [
    { name: 'اردوی تمرینی', type: 'تمرین', start: '2026-06-18', end: '2026-06-18', participants: [2], top: {}, entry: 5 },
    { name: 'تمرین هم‌روز با رویداد', type: 'تمرین', start: '2026-04-09', end: '2026-04-09', participants: [1], top: {}, entry: 5 },
    { name: 'کلاس', type: 'کلاس', start: '2026-08-01', end: '2026-08-01', participants: [1], top: {}, entry: 5 },
  ],
};
const EXPECT = 3; // 2026-04-09، 2026-05-07، 2026-06-18
const ACCOUNTS = [{ id: 1, user: 'admin', pass: 'Admin-Pass-QA1', name: 'مدیر', role: 'admin', main: true }];
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS' : 'FAIL') + ' | ' + m); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const run = async (store) => {
    const cloud = createMockCloud({ store: JSON.parse(JSON.stringify(store)), accounts: ACCOUNTS });
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    await cloud.attach(ctx, HTML);
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => { if (!/livePrep/.test(String(e.stack || ''))) errors.push(e.message); });
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector('#login.on', { timeout: 20000 });
    await page.fill('#login-user', 'admin'); await page.fill('#login-pass', 'Admin-Pass-QA1');
    await page.click('#login-form button[type="submit"]');
    await page.waitForFunction(() => document.getElementById('app').classList.contains('on'), null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => APP.go('cmd')); await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('#cmd-stats .stat')).find(c => /جلسات تمرین/.test(c.innerText));
      const cu = card && card.querySelector('.countup');
      return { A: APP.state().A.PRACTICE_DAYS, target: cu ? +cu.dataset.target : null, text: card ? card.innerText.replace(/\s+/g, ' ').trim() : '' };
    });
    await page.evaluate(() => APP.go('academy')); await page.waitForTimeout(1500);
    r.academy = await page.evaluate(() => { const c = Array.from(document.querySelectorAll('#ac-kpis > *')).find(x => /روزهای تمرین/.test(x.innerText)); const cu = c && c.querySelector('.countup'); return cu ? +cu.dataset.target : (c ? c.innerText : null); });
    await page.evaluate(() => APP.go('cmd')); await page.waitForTimeout(2200);
    r.shot = await page.screenshot({ path: process.env.SHOT || '/tmp/practice-days.png' });
    r.errors = errors; await ctx.close(); return r;
  };
  const a = await run(FIX);
  console.log('INFO | ' + JSON.stringify({ A: a.A, target: a.target, text: a.text, academy: a.academy }));
  ok(a.A === EXPECT, `A.PRACTICE_DAYS = ${EXPECT} (رویداد + دوره؛ هم‌روز یکی، بدون شرکت‌کننده/آینده/فصل قبل/غیرتمرین حساب نشد) → ${a.A}`);
  ok(a.target === EXPECT && /جلسات تمرین/.test(a.text), 'کارت «جلسات تمرین» فرماندهی همان عدد را نشان می‌دهد → ' + a.target);
  ok(a.academy === EXPECT, 'KPI «روزهای تمرین» صفحهٔ آکادمی هم همان عدد → ' + a.academy);
  ok(a.errors.length === 0, 'بدون خطای صفحه ' + (a.errors.length ? JSON.stringify(a.errors.slice(0, 3)) : ''));
  const b = await run({ ga_events: [], ga_programs: [] });
  ok(b.A === 0 && b.target === 0, 'بدون هیچ تمرینی → ۰ (بدون خطا)');
  await browser.close();
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
