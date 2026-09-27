/* Marquee loop + speed slider test: seed a fast marquee (200px/s), verify the public
 * bar loops forever with the 2s pause, then verify the editor slider saves speed.
 * Never destroys the real published marquee (snapshot/restore via Management API). */
(async () => {
const { chromium } = require('playwright-core');
const EXE = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8010';
let pass = 0, fail = 0;
const ok = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n); c ? pass++ : fail++; };

/* ── snapshot the real marquee row so the teardown can restore it ── */
const token = require('fs').readFileSync('/home/user/.secrets/supabase_access_token', 'utf8').trim();
const mgmt = async (sql) => fetch('https://api.supabase.com/v1/projects/iultwqtzvrysugfxwshw/database/query', {
  method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }) });
let BACKUP = null;
{
  const r = await mgmt("select k,v,updated_at from public.web_store where k='web_setting_marquee'");
  const rows = await r.json();
  if (Array.isArray(rows) && rows.length && rows[0].v) BACKUP = rows[0];
}
const SEED = { enabled: true, speed: 200, items: [
  { id: 'mq-t1', text: 'پیام تست یک', visible: true },
  { id: 'mq-t2', text: 'پیام تست دو', visible: true }] };
{
  const v2 = JSON.stringify(SEED).replace(/'/g, "''");
  const r = await mgmt("delete from public.web_store where k='web_setting_marquee'; insert into public.web_store(k,v,updated_at) values('web_setting_marquee','" + v2 + "'::jsonb, now());");
  if (!r.ok) { console.log('  SEED FAILED', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  console.log('  seed marquee published (speed 200, snapshot ' + (BACKUP ? 'kept' : 'none existed') + ')');
}

const browser = await chromium.launch({ executablePath: EXE });
try {
  /* ── public homepage: loop + speed + pause ── */
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 160)));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('[data-site-marquee]', { timeout: 45000 });
  await page.waitForFunction(() => window.PC_MQ_STATE && window.PC_MQ_STATE.on && window.PC_MQ_STATE.cycles >= 1, null, { timeout: 45000 });
  ok('marquee loop started', true);
  await page.waitForFunction(() => window.PC_MQ_STATE && window.PC_MQ_STATE.speed === 200, null, { timeout: 30000 });
  ok('published speed applied (200 px/s)', await page.evaluate(() => window.PC_MQ_STATE.speed) === 200);

  /* watch transitions: at least 2 cycles + one pause in the 1.9–3.5s band */
  const watch = await page.evaluate(() => new Promise(resolve => {
    const t0 = Date.now(); const seen = []; let prev = null;
    const iv = setInterval(() => {
      const st = window.PC_MQ_STATE; const now = Date.now();
      if (st && prev && st.lastStart > prev.lastStart && prev.lastEnd) seen.push({ gap: st.lastStart - prev.lastEnd, at: Math.round((now - t0) / 1000) });
      if (st) prev = { lastStart: st.lastStart, lastEnd: st.lastEnd };
      if (seen.length >= 2 || Date.now() - t0 > 70000) { clearInterval(iv); resolve({ cycles: st ? st.cycles : 0, seen }); }
    }, 250);
  }));
  console.log('  cycles observed:', watch.cycles, 'pauses(ms):', JSON.stringify(watch.seen));
  ok('loop repeats — 2+ completed cycles', watch.cycles >= 2);
  ok('≈2s pause after the last text before restart', watch.seen.some(g => g.gap >= 1800 && g.gap <= 3600));

  /* pause on hover still respected */
  const hover = await page.evaluate(async () => {
    const bar = document.querySelector('.pc-public-marquee');
    const a1 = bar.querySelector('[class*="animate-marquee"]').getAnimations()[0];
    if (!a1) return 'no-anim';
    bar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await new Promise(r => setTimeout(r, 350));
    const st = a1.playState;
    bar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    return st;
  });
  ok('hover pauses the movement', hover === 'paused');
  await page.close();

  /* ── editor: slider exists, updates label, saves speed ── */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('puttclub_admin', JSON.stringify({ email: 'admin@puttclub.ir' })); } catch (e) {} });
  const admin = await ctx.newPage();
  admin.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 160)));
  await admin.goto(BASE + '/admin/site/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await admin.waitForTimeout(6000);
  await admin.evaluate(() => { const b = [...document.querySelectorAll('nav button')].find(x => x.textContent.includes('محتوا و تصاویر')); if (b) b.click(); });
  await admin.waitForSelector('#site-marquee-editor', { timeout: 30000 });
  await admin.waitForSelector('.pc-mq-range', { timeout: 15000 });
  ok('speed slider rendered in the marquee editor', true);
  const slider = await admin.evaluate(() => {
    const r = document.querySelector('.pc-mq-range');
    return { value: +r.value, min: +r.min, max: +r.max, label: document.querySelector('[data-mq-speedval]').textContent.trim() };
  });
  ok('slider loaded with published speed (200)', slider.value === 200);
  ok('slider range 20–220', slider.min === 20 && slider.max === 220);
  ok('label shows value + tempo', /۲۰۰/.test(slider.label) && /تند/.test(slider.label));

  await admin.evaluate(() => {
    const r = document.querySelector('.pc-mq-range');
    r.value = '60'; r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await admin.waitForTimeout(300);
  const after = await admin.evaluate(() => ({ label: document.querySelector('[data-mq-speedval]').textContent.trim(), dirty: document.body.innerText.includes('تغییرات هنوز منتشر نشده‌اند') }));
  ok('dragging slider updates label live (۶۰ / عادی)', /۶۰/.test(after.label) && /عادی/.test(after.label));
  ok('slider marks editor dirty', after.dirty);

  await admin.evaluate(() => {
    const real = window.PC_SITE_CLOUD.request.bind(window.PC_SITE_CLOUD);
    window.__mqPuts = [];
    window.PC_SITE_CLOUD.request = (path, init) => {
      if (path === '/api/admin/site/settings' && init && init.method === 'PUT') {
        window.__mqPuts.push(JSON.parse(init.body));
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      return real(path, init);
    };
    document.querySelector('[data-marquee-save]').click();
  });
  await admin.waitForTimeout(1200);
  const puts = await admin.evaluate(() => window.__mqPuts);
  ok('save PUT sent', puts.length === 1);
  if (puts.length) {
    ok('payload key=marquee with speed 60', puts[0].key === 'marquee' && puts[0].value.speed === 60);
    ok('payload keeps items + enabled', puts[0].value.enabled === true && Array.isArray(puts[0].value.items) && puts[0].value.items.length === 2);
  }
  ok('save confirmed ✓', await admin.evaluate(() => document.body.innerText.includes('انتشار در ابر تأیید شد')));
  await ctx.close();
} catch (e) { console.log('TEST ERROR:', e.message); fail++; }
finally { await browser.close(); }

/* ── teardown: restore the real marquee ── */
try {
  if (BACKUP) {
    const v2 = JSON.stringify(BACKUP.v).replace(/'/g, "''");
    await mgmt("delete from public.web_store where k='web_setting_marquee'; insert into public.web_store(k,v,updated_at) values('web_setting_marquee','" + v2 + "'::jsonb,'" + BACKUP.updated_at + "'::timestamptz);");
    console.log('  teardown: real marquee restored');
  } else { await mgmt("delete from public.web_store where k='web_setting_marquee'"); console.log('  teardown: seed removed (no prior marquee)'); }
} catch (e) { console.log('  teardown failed:', e.message); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})();
