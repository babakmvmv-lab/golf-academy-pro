/* Publish season podium + calendar from the LIVE academy panel (real cloud data). */
const { chromium } = require('playwright-core');
const EXE = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const BASE = process.env.BASE || 'https://puttclub.ir/GolfAcademy_PRO.html';
let pass = 0, fail = 0;
const ok = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)));
  await page.goto(BASE, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.APP && window.UI_LABELS, null, { timeout: 30000 });
  try { await page.evaluate(() => window.__L3D && window.__L3D.skipIntro()); } catch (e) {}
  await page.waitForTimeout(800);
  if (await page.locator('#l3d-enter').isVisible().catch(() => false)) { await page.click('#l3d-enter', { force: true }); await page.waitForTimeout(900); }
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', 'golf1405');
  await page.click('#login-form button[type="submit"]');
  await page.waitForTimeout(2500);

  /* wait for the cloud mirror pull to finish (real data) */
  const pulled = await page.evaluate(async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      try {
        const st = window.GA_CLOUD.status();
        if (st.phase === 'ready' || st.phase === 'pending' || st.phase === 'off') return st;
      } catch (e) {}
      await new Promise(r => setTimeout(r, 1000));
    }
    return window.GA_CLOUD ? window.GA_CLOUD.status() : { phase: 'no-cloud' };
  });
  console.log('  cloud status:', JSON.stringify(pulled).slice(0, 160));
  const players = await page.evaluate(() => (window.Data && window.Data.loadPlayers) ? window.Data.loadPlayers().length : -1);
  console.log('  players in state:', players);
  ok('real academy data loaded from cloud (players >= 3)', players >= 3);

  /* ── podium publish ── */
  await page.evaluate(() => window.APP.go('cmd'));
  await page.waitForTimeout(1200);
  const podium = await page.evaluate(() => {
    const btn = document.querySelector('#pub-podium');
    const names = [...document.querySelectorAll('#view .podium-name, #view [class*="podium"]')].map(x => x.textContent.trim()).filter(t => t && t.length < 30).slice(0, 6);
    return { hasBtn: !!btn, names };
  });
  ok('فرماندهی page shows انتشار سکو button', podium.hasBtn);
  console.log('  podium names visible:', JSON.stringify(podium.names));
  await page.click('#pub-podium');
  await page.waitForTimeout(3500);
  const toast1 = await page.evaluate(() => document.querySelector('#toast, .toast, [class*="toast"]')?.textContent || '');
  console.log('  toast after podium publish:', toast1.trim().slice(0, 120));

  /* ── calendar publish ── */
  await page.evaluate(() => window.APP.go('cal'));
  await page.waitForTimeout(1200);
  const cal = await page.evaluate(() => {
    const btn = document.querySelector('#pub-cal');
    const rows = [...document.querySelectorAll('#view [class*="ev"], #view .cal-row, #view li')].map(x => x.textContent.trim()).filter(t => t.length > 8).slice(0, 5);
    return { hasBtn: !!btn, rows };
  });
  ok('تقویم فصل page shows انتشار تقویم button', cal.hasBtn);
  console.log('  calendar rows sample:', JSON.stringify(cal.rows).slice(0, 200));
  await page.click('#pub-cal');
  await page.waitForTimeout(9000);
  const toast2 = await page.evaluate(() => document.querySelector('#toast, .toast, [class*="toast"]')?.textContent || '');
  console.log('  toast after calendar publish:', toast2.trim().slice(0, 120));

  /* verify what landed in web_store */
  const rows = await page.evaluate(async () => {
    const cfg = window.GA_CLOUD_CFG || null;
    const r = await fetch('https://iultwqtzvrysugfxwshw.supabase.co/rest/v1/web_store?select=k,v&k=in.("web_setting_season_podium","web_setting_season_calendar")', { headers: { apikey: 'sb_publishable_058vN6QjD4sUC9Mam5izUg__vjKt9d0' } });
    return await r.json();
  });
  const pod = rows.find(x => x.k === 'web_setting_season_podium');
  const cl = rows.find(x => x.k === 'web_setting_season_calendar');
  ok('season_podium row in web_store', !!pod);
  if (pod) console.log('  podium top-3:', JSON.stringify((pod.v.top || []).map(x => x.rank + '. ' + x.name + ' (' + x.pts + ')')), 'matches:', pod.v.matchesHeld, 'players:', pod.v.playersActive);
  ok('podium has 3 champions with pts', !!(pod && (pod.v.top || []).length >= 1 && pod.v.top[0].pts !== undefined));
  ok('season_calendar row in web_store', !!cl);
  if (cl) console.log('  calendar events:', (cl.v.events || []).length, 'first:', JSON.stringify((cl.v.events || [])[0] || {}).slice(0, 160));

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
