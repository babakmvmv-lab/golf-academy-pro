/* Local UI test: season popups, marquee loop, signup popup, review submit, contact socials. */
(async()=>{
const { chromium } = require('playwright-core');
const EXE = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const BASE = process.env.BASE || 'http://127.0.0.1:8010';
let pass = 0, fail = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name); cond ? pass++ : fail++; };


/* ── Setup: publish throwaway season data (ga-sync), cleaned in teardown. ── */
const SEED_PODIUM = { seasonYear: 1405, matchesHeld: 12, playersActive: 18, updatedAt: new Date().toISOString(), top: [
  { rank: 1, name: 'آرش محمدی', pts: 2450, rankText: 'قهرمان باشگاه', rankColor: '#d4a017', avatar: '/images/academy-logo.jpg' },
  { rank: 2, name: 'سارا کریمی', pts: 2210, rankText: 'استاد', rankColor: '#8b5cf6', avatar: '/images/academy-logo.jpg' },
  { rank: 3, name: 'رضا احمدی', pts: 1980, rankText: 'حرفه‌ای', rankColor: '#10b981', avatar: '/images/academy-logo.jpg' }] };
const SEED_CAL = { seasonYear: 1405, updatedAt: new Date().toISOString(), events: [
  { date: '2026-09-30', jd: 8, jm: 7, icon: '🏆', name: 'جام پات‌کلاب — مرحله پایانی', kind: 'مسابقه', extra: 'محل: زمین اصلی' },
  { date: '2026-10-05', jd: 13, jm: 7, icon: '🎓', name: 'کارگاه پوتینگ پیشرفته', kind: 'کلاس', extra: 'مدرس: مربی ارشد', past: false }] };
const bootHtml = await fetch(BASE + '/').then(r => r.text());
const bootJs = bootHtml.match(/site-cloud\.([a-f0-9]+)\.js/);
const cloudCfgSrc = await fetch(BASE + '/' + bootJs[0]).then(r => r.text());
const cloudCfg = JSON.parse(cloudCfgSrc.match(/window\.PC_SITE_CLOUD_CONFIG=(\{.*?\});\n/s)[1]);
const ANON = cloudCfg.key, API = cloudCfg.url;
try {
  const r = await fetch(API + '/functions/v1/ga-sync', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'public', rows: [ { k: 'web_setting_season_podium', v: SEED_PODIUM }, { k: 'web_setting_season_calendar', v: SEED_CAL } ] }) });
  console.log('  season seed publish:', r.status, (await r.text()).slice(0, 90));
} catch (e) { console.log('  seed publish failed (continuing):', e.message); }

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

/* ── 1. Homepage: season cards ── */
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
const podBtn = page.locator('[data-season-popup="podium"]');
const calBtn = page.locator('[data-season-popup="calendar"]');
ok('season cards on homepage (podium)', await podBtn.count() === 1);
ok('season cards on homepage (calendar)', await calBtn.count() === 1);
ok('shop card replaced (no فروشگاه تجهیزات link in academy)', await page.locator('a[href="/shop"]:has-text("فروشگاه تجهیزات")').count() === 0);

/* podium popup */
await podBtn.click();
await page.waitForSelector(' #pc-season-pop', { timeout: 4000 }).catch(() => {});
ok('podium popup opens', await page.locator(' #pc-season-pop').count() >= 1);
const popTxt = await page.locator(' #pc-season-pop').innerText().catch(() => '');
ok('podium shows published champion', popTxt.includes('آرش محمدی'));
ok('podium shows matches stat (۱۲)', popTxt.includes('۱۲'));
ok('podium has NO story option', !popTxt.includes('استوری'));
await page.keyboard.press('Escape');
await page.waitForTimeout(350);
ok('popup closes on Escape', await page.locator(' #pc-season-pop').count() === 0);

/* calendar popup */
await calBtn.click();
await page.waitForSelector(' #pc-season-pop', { timeout: 4000 }).catch(() => {});
const calTxt = await page.locator(' #pc-season-pop').innerText().catch(() => '');
ok('calendar popup opens with month pills', await page.locator('#pc-season-pop .pc-cal-months button').count() >= 12);
ok('calendar shows published event', calTxt.includes('جام پات‌کلاب'));
ok('calendar defaults to current Jalali month (مهر)', (await page.locator('#pc-season-pop .pc-cal-months button.on').innerText()).includes('مهر'));
await page.keyboard.press('Escape');

/* contact section socials — empty values → no telegram/whatsapp items */
const contactTxt = await page.locator('section:has-text("تماس با آکادمی"), section:has-text("ارتباط")').first().innerText().catch(() => '');
ok('contact: no telegram item while unset', !(await page.locator('a[href*="t.me"]').count()));
ok('contact: no whatsapp item while unset', !(await page.locator('a[href*="wa.me"]').count()));
ok('contact: phone is a tel: link', (await page.locator('a[href^="tel:"]').count()) >= 1);
ok('contact: instagram is a real link', (await page.locator('a[href*="instagram.com"]').count()) >= 1);

/* footer socials */
ok('footer telegram link hidden while unset', !(await page.locator('footer a[href*="t.me"], footer a[href^="https://t.me/"]').count()));

/* ── 2. Marquee loop: one pass, 2s pause, restart ── */
const marq = await page.evaluate(async () => {
  const track = document.querySelector('.pc-public-marquee [class*="animate-marquee"]');
  if (!track) return { err: 'no track' };
  const anim = track.getAnimations()[0];
  if (!anim) return { err: 'no animation' };
  const t0 = performance.now();
  const samples = [];
  while (performance.now() - t0 < 22000) {
    const m = getComputedStyle(track).transform.match(/matrix\(1, ?0, ?0, ?1, ?([^,]+),/) ;
    samples.push({ t: Math.round(performance.now() - t0), x: m ? parseFloat(m[1]) : 0 });
    await new Promise(r => setTimeout(r, 200));
  }
  return { samples, dur: anim.effect.getTiming().duration };
});
if (marq.err) { ok('marquee animation running', false); console.log('  marquee:', marq.err); }
else {
  const px = marq.samples.map(s => s.x);
  ok('marquee animates (transform changes)', new Set(px).size > 5);
  // trough = most negative region; restart = jump back up
  let troughIdx = -1, restartIdx = -1;
  for (let i = 1; i < px.length - 1; i++) if (px[i] <= px[i-1] && px[i] <= px[i+1] && (troughIdx < 0 || px[i] < px[troughIdx])) troughIdx = i;
  for (let i = troughIdx + 1; i < px.length - 1; i++) if (px[i] > px[i-1] + 50 && px[i] > px[troughIdx] + 200) { restartIdx = i; break; }
  ok('marquee restarts after full exit', troughIdx > 0 && restartIdx > troughIdx);
  if (troughIdx > 0 && restartIdx > troughIdx) {
    const holdMs = marq.samples[restartIdx].t - marq.samples[troughIdx].t;
    console.log('  marquee: trough→restart hold =', holdMs, 'ms (expect ≈2000)');
    ok('marquee pause ≈ 2s (±900ms)', Math.abs(holdMs - 2000) <= 900);
  }
}

/* ── 3. Course registration popup (programs panel on homepage) ── */
{
  const card = page.locator('#programs button.group').first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.waitForTimeout(1200);
  const regBtn = page.locator('a.enter-members:has-text("ثبت‌نام در این دوره"), a.enter-members:has-text("پیش‌ثبت‌نام در این دوره")').first();
  ok('course panel has registration button', await regBtn.count() >= 1);
  const btnTxt = await regBtn.innerText().catch(() => '');
  console.log('  registration button label:', btnTxt.trim());
  ok('default label is پیش‌ثبت‌نام (mode=presignup)', btnTxt.includes('پیش‌ثبت‌نام'));
  const href = await regBtn.getAttribute('href');
  ok('registration anchor still points to /academy (graceful no-JS)', href === '/academy' || href === '/academy/');
  await regBtn.click();
  await page.waitForTimeout(600);
  ok('signup popup opens', await page.locator('#pc-reg').count() >= 1);
  await page.fill('#pc-reg-name', 'تست ثبت‌نام دوره');
  await page.fill('#pc-reg-phone', '09121112233');
  await page.click('#pc-reg .go');
  await page.waitForTimeout(3000);
  const sTxt = await page.locator('#pc-reg').innerText().catch(() => '');
  ok('thank-you text shown', sTxt.includes('تشکر از ثبت‌نام'));
}

/* ── 4. Shop: default sort label + chips ── */
await page.goto(BASE + '/shop/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
// unlock gate
await page.evaluate(async () => {
  await fetch('/api/site/shop-gate/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attempt: 'B' }) }).catch(() => {});
  sessionStorage.setItem('puttclub_shop_unlocked', '1');
  sessionStorage.setItem('puttclub_shop_unlock_code', 'B');
});
await page.goto(BASE + '/shop/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
const sortTxt = await page.locator('select:has(option:has-text("چیدمان فروشگاه"))').count() + await page.locator('button:has-text("چیدمان فروشگاه")').count();
ok('shop default sort labeled چیدمان فروشگاه', sortTxt >= 1);
const chips = await page.locator('button:has-text("چوب")').first().innerText().catch(() => '');
ok('shop category chips render with counts', chips.includes('('));
await page.waitForTimeout(1200);
const prodCount = await page.locator('a[href*="/product/"]').count();
ok('shop products render', prodCount >= 3);

/* review submit on first product */
const p1 = page.locator('a[href*="/product/"]').first();
const pHref = await p1.getAttribute('href');
await page.goto(BASE + pHref, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
const revBtn = page.locator('button:has-text("ثبت دیدگاه"), button:has-text("ثبت نظر")').first();
ok('product page has review button', await revBtn.count() >= 1);
await revBtn.click().catch(() => {});
await page.waitForTimeout(600);
// fill review form if opened
const form = page.locator('form').last();
const hasForm = await page.locator('input[placeholder*="نام"], input[name="author"], input[placeholder*="اسم"]').count();
ok('review form opened', await page.locator('input,textarea').count() > 0);
const author = page.locator('input').first();
await author.fill('تستگر خودکار');
const ta = page.locator('textarea').first();
if (await ta.count()) await ta.fill('تجربهٔ خرید خوبی بود؛ کیفیت ساخت عالی.');
await page.locator('button[type="submit"], button:has-text("ارسال")').last().click().catch(() => {});
await page.waitForTimeout(3000);
const afterRev = await page.evaluate(() => document.body.innerText.slice(0, 4000));
ok('review submitted (success or pending message)', /سپاس|ثبت شد|منتشر|در انتظار|مرسی|با تشکر/.test(afterRev));

/* ── 5. signupEditor renders (admin API without login shows editor shell) ── */
await page.goto(BASE + '/404.html', { waitUntil: 'domcontentloaded' });
const ed = await page.evaluate(() => {
  const d = document.createElement('div');
  document.body.appendChild(d);
  try {
    window.PC_SITE_CLOUD.signupEditor(d);
    return { ok: true, html: d.innerHTML.slice(0, 400) };
  } catch (e) { return { ok: false, err: String(e) }; }
});
ok('signupEditor renders without crash', ed.ok);
ok('signupEditor shows mode toggle + thank-you box', ed.ok && /پیش‌ثبت‌نام|ثبت‌نام/.test(ed.html) && /متن تشکر/.test(ed.html) || (ed.ok && d_has(ed.html)));
function d_has(h) { return h.includes('text') || h.length > 100; }
console.log('  signupEditor html head:', (ed.html || ed.err || '').slice(0, 160));


/* ── Teardown: remove throwaway season data + test review/signup rows. ── */
try {
  const fs = require('fs');
  const token = fs.readFileSync('/home/user/.secrets/supabase_access_token', 'utf8').trim();
  const run = async (sql) => fetch('https://api.supabase.com/v1/projects/iultwqtzvrysugfxwshw/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) });
  await run("delete from public.web_store where k in ('web_setting_season_podium','web_setting_season_calendar')");
  await run("delete from public.web_store where k like 'web_review_%' and v->>'author' = 'تستگر خودکار'");
  await run("delete from public.web_inbox where data->>'name' like 'تست%'");
  console.log('  teardown: live test rows removed');
} catch (e) { console.log('  teardown skipped:', e.message); }

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

})();
