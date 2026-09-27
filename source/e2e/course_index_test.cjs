/* Course-index persistence fix test (monolith panel): edit ایندکس → save → reopen. */
const { chromium } = require('playwright-core');
const EXE = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8010/GolfAcademy_PRO.html';
let pass = 0, fail = 0;
const ok = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.APP && window.UI_LABELS, null, { timeout: 20000 });
  try { await page.evaluate(() => window.__L3D && window.__L3D.skipIntro()); } catch (e) {}
  await page.waitForTimeout(600);
  if (await page.locator('#l3d-enter').isVisible().catch(() => false)) { await page.click('#l3d-enter', { force: true }); await page.waitForTimeout(800); }
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', 'golf1405');
  await page.click('#login-form button[type="submit"]');
  await page.waitForTimeout(1800);

  const openCourses = async () => {
    await page.evaluate(() => { window.APP.go('mgmt'); });
    await page.waitForTimeout(700);
    await page.evaluate(() => { const b = [...document.querySelectorAll('.mgmt-tab')].find(x => x.dataset.tab === 'courses'); if (b) b.click(); });
    await page.waitForTimeout(700);
  };
  await openCourses();

  const editCourse = async (name) => {
    // click the ✏️ ویرایش button on the row containing the course name
    return await page.evaluate((nm) => {
      const rows = [...document.querySelectorAll('#mc-rows tr')];
      const row = rows.find(r => r.textContent.includes(nm));
      if (!row) return { err: 'row not found: ' + nm };
      const btn = row.querySelector('[data-act="editc"]');
      if (!btn) return { err: 'edit button not found' };
      btn.click();
      return { ok: true };
    }, name);
  };
  const readIdx = () => page.evaluate(() => [...document.querySelectorAll('#ec-pars .pe-idx')].map(i => +i.value));
  const setIdx = (i, v) => page.evaluate(({ i, v }) => { const inp = document.querySelectorAll('#ec-pars .pe-idx')[i]; inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); }, { i, v });

  /* custom course اهواز (id 1000+) */
  let r = await editCourse('اهواز');
  if (r.err) { ok('open اهواز editor', false); console.log('  ', r.err); }
  else {
    await page.waitForTimeout(500);
    const before = await readIdx();
    ok('اهواز editor open with index inputs', before.length >= 9);
    const newVal = before[0] === 2 ? 3 : 2;
    await setIdx(0, newVal);
    await page.click('#ec-save');
    await page.waitForTimeout(900);
    await openCourses();
    await editCourse('اهواز');
    await page.waitForTimeout(500);
    const after = await readIdx();
    ok('اهواز: edited ایندکس persists after save+reopen', after[0] === newVal);
    console.log('  اهواز idx before/after:', JSON.stringify(before.slice(0, 6)), '→', JSON.stringify(after.slice(0, 6)));
    // and it takes effect in the data layer
    const eff = await page.evaluate(() => {
      const id = [...document.querySelectorAll('#mc-rows tr')].find(r => r.textContent.includes('اهواز'));
      return id ? id.querySelector('.num').textContent.trim() : '?';
    });
    await page.click('#ec-cancel').catch(() => {});
    await page.waitForTimeout(200);
  }

  /* base course مسجدسلیمان (id 1) */
  r = await editCourse('مسجدسلیمان');
  if (r.err) { ok('open مسجدسلیمان editor', false); console.log('  ', r.err); }
  else {
    await page.waitForTimeout(500);
    const before = await readIdx();
    ok('مسجدسلیمان editor open with index inputs', before.length >= 9);
    const newVal = before[0] === 2 ? 3 : 2;
    await setIdx(0, newVal);
    await page.click('#ec-save');
    await page.waitForTimeout(900);
    await openCourses();
    await editCourse('مسجدسلیمان');
    await page.waitForTimeout(500);
    const after = await readIdx();
    ok('مسجدسلیمان: edited ایندکس persists after save+reopen', after[0] === newVal);
    console.log('  مسجدسلیمان idx before/after:', JSON.stringify(before.slice(0, 6)), '→', JSON.stringify(after.slice(0, 6)));
    // verify the override map carries it
    const ov = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('ga_course_override') || '{}'); } catch (e) { return {}; } });
    const ovKeys = Object.keys(ov);
    const hasIdx = ovKeys.some(k => Array.isArray(ov[k].index) && ov[k].index.length);
    ok('override map stores index array', hasIdx);
  }

  ok('no page errors', errors.length === 0);
  if (errors.length) console.log('  errors:', errors.slice(0, 3));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
