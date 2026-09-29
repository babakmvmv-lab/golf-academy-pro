/* E2E: طراحی زمین — KML → عکس‌های خودکار (ماهواره + توپوگرافی، ۴ برابر محدوده) → ثبت → نمایش دو حالت.
 * Runs against the LOCAL monolith build (no cloud credentials → nothing syncs anywhere). */
(async () => {
const { chromium } = require('playwright-core');
const EXE = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8010';
let pass = 0, fail = 0;
const ok = (n, c, extra) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (extra ? '  [' + extra + ']' : '')); c ? pass++ : fail++; };

const browser = await chromium.launch({ executablePath: EXE });
try {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  /* HERMETIC: cloud sync cut — this test must never read or write the real ga_store */
  await ctx.route('**.supabase.co/**', r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 160)));
  await page.goto(BASE + '/GolfAcademy_PRO.html', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.APP && window.UI_LABELS, null, { timeout: 45000 });
  try { await page.evaluate(() => window.__L3D && window.__L3D.skipIntro()); } catch (e) {}
  await page.waitForTimeout(800);
  if (await page.locator('#l3d-enter').isVisible().catch(() => false)) { await page.click('#l3d-enter', { force: true }); await page.waitForTimeout(900); }
  await page.fill('#login-user', 'admin');
  await page.fill('#login-pass', 'golf1405');
  await page.click('#login-form button[type="submit"]');
  await page.waitForTimeout(2500);
  ok('monolith login', true);

  /* unit sanity inside the page */
  const unit = await page.evaluate(() => {
    const b = { south: 31.900, north: 31.918, west: 49.300, east: 49.330 }; /* ابعاد واقعی یک زمین */
    const e = window.EarthShot.expand(b);
    const area0 = (b.north - b.south) * (b.east - b.west);
    const area1 = (e.north - e.south) * (e.east - e.west);
    return { ratio: +(area1 / area0).toFixed(2), zoom: window.EarthShot.pickZoomFor(b) };
  });
  ok('expand: area ≈ 4× original (got ' + unit.ratio + '×)', unit.ratio >= 3.6 && unit.ratio <= 4.4);
  ok('zoom picked in sane range (got z' + unit.zoom + ')', unit.zoom >= 14 && unit.zoom <= 19);

  /* go to مدیریت → زمین‌ها */
  await page.evaluate(() => { window.APP.go('mgmt'); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const t = document.querySelector('.mgmt-tab[data-tab="courses"]'); if (t) t.click(); });
  await page.waitForSelector('#mc-kml', { timeout: 20000 });
  ok('ground design form open (طراحی زمین)', true);

  /* attach the KML — capture must start automatically */
  await page.setInputFiles('#mc-kml', require('path').join(__dirname, 'fixtures_test_course.kml'));
  ok('KML parsed & report shown', await page.waitForFunction(
    () => document.querySelector('#mc-kml-rep') && document.querySelector('#mc-kml-rep').textContent.includes('خوانده شد'),
    null, { timeout: 20000 }).then(() => true).catch(() => false));

  /* both images captured automatically — wait for topo (last) to reach 100% */
  const shotDone = await page.waitForFunction(
    () => { const t = document.querySelector('#mc-kml-rep'); return !!(t && t.textContent.includes('توپوگرافی: ۱۰۰٪')); },
    null, { timeout: 180000 }).then(() => true).catch(() => false);
  const repText = await page.evaluate(() => document.querySelector('#mc-kml-rep').textContent);
  ok('auto capture ran (sat + topo progress visible)', shotDone, repText.slice(0, 90));

  /* register the ground */
  await page.fill('#mc-name', 'زمین تست ایثار');
  await page.click('#mc-add');
  /* ثبت ممکن است منتظر کامل‌شدن کپچر بماند — تا ۶۰ث صبر می‌کنیم نه وقفهٔ ثابت */
  const storedKey = await page.waitForFunction(() => {
    try {
      const geo = JSON.parse(localStorage.getItem('ga_course_geo') || '{}');
      return Object.keys(geo).find(k => geo[k] && geo[k].name === 'زمین تست ایثار') || false;
    } catch (e) { return false; }
  }, null, { timeout: 60000 }).then(r => r.jsonValue()).catch(() => null);
  const stored = await page.evaluate(key => {
    const geo = JSON.parse(localStorage.getItem('ga_course_geo') || '{}');
    const g = key ? geo[key] : null;
    return { key, sat: g && g.sat, bounds: g && g.bounds };
  }, storedKey);
  ok('ground saved with geo record', !!stored.key);
  if (stored.sat && stored.bounds) {
    const a0 = (stored.bounds.north - stored.bounds.south) * (stored.bounds.east - stored.bounds.west);
    const a1 = (stored.sat.north - stored.sat.south) * (stored.sat.east - stored.sat.west);
    const r = +(a1 / a0).toFixed(2);
    ok('saved sat meta = 4× extent (got ' + r + '×)', r >= 3.6 && r <= 4.6);
  } else ok('saved sat meta present', false);

  /* images stored in IndexedDB under the final geoId */
  const idb = await page.evaluate(async (key) => {
    const db = await new Promise((res, rej) => { const q = indexedDB.open('ga_earth_shots', 1); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    const get = k => new Promise(res => { const tx = db.transaction('shots', 'readonly'); const rq = tx.objectStore('shots').get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); });
    const sat = await get(key + ':sat'), topo = await get(key + ':topo');
    return { sat: sat && { size: sat.blob && sat.blob.size, w: sat.meta && sat.meta.w, h: sat.meta && sat.meta.h, src: sat.meta && sat.meta.src },
             topo: topo && { size: topo.blob && topo.blob.size, w: topo.meta && topo.meta.w, src: topo.meta && topo.meta.src } };
  }, stored.key);
  ok('satellite image stored (IDB)', !!idb.sat && idb.sat.size > 50000, idb.sat ? Math.round(idb.sat.size / 1024) + 'KB ' + idb.sat.w + 'px src=' + idb.sat.src : 'missing');
  ok('topographic image stored (IDB)', !!idb.topo && idb.topo.size > 20000, idb.topo ? Math.round(idb.topo.size / 1024) + 'KB src=' + idb.topo.src : 'missing');

  /* ویرایش زمین → the map must show the satellite image */
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="editc"]')].pop(); if (b) b.click(); });
  await page.waitForSelector('#ec-geo-map .leaflet-image-layer', { timeout: 90000 }).catch(() => console.log('  (overlay wait timed out)'));
  await page.waitForTimeout(1500);
  const bg1 = await page.evaluate(() => {
    const im = document.querySelector('#ec-geo-map .leaflet-image-layer img') || document.querySelector('#ec-geo-map .leaflet-image-layer');
    return im ? { src: (im.src || '').slice(0, 40), w: im.naturalWidth || im.width } : null;
  });
  ok('edit map shows the captured satellite image', !!bg1 && bg1.src.startsWith('blob:'), bg1 ? bg1.src + ' ' + bg1.w + 'px' : 'no overlay');

  /* toggle to topo — the image must switch */
  await page.evaluate(() => { const b = document.querySelector('[data-earth-bg="topo"]'); if (b) b.click(); });
  await page.waitForTimeout(2500);
  const bg2 = await page.evaluate(() => {
    const im = document.querySelector('#ec-geo-map .leaflet-image-layer img') || document.querySelector('#ec-geo-map .leaflet-image-layer');
    return im ? (im.src || '').slice(0, 40) : null;
  });
  ok('topo toggle switches the background image', !!bg2 && bg2.startsWith('blob:') && bg2 !== bg1.src, bg2 || 'no overlay');

  /* ── دکمهٔ «🛰 نقشه» — باید عکس واقعی زمین را نشان بدهد، نه طرح شماتیک ── */
  await page.evaluate(() => { const c = document.querySelector('#ec-cancel'); if (c) c.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="sat"]')].pop(); if (b) b.click(); });
  const mimg = await page.waitForFunction(() => {
    const i = document.querySelector('#modal-sat #sat-img');
    return (i && i.style.display !== 'none' && /^(data:image|blob:)/.test(i.src || '')) ? (i.src || '').slice(0, 40) : false;
  }, null, { timeout: 30000 }).then(r => r.jsonValue()).catch(() => null);
  ok('«🛰 نقشه» shows the real imagery (not the sketch)', !!mimg, mimg || 'sketch shown');
  await page.evaluate(() => { const b = document.querySelector('#modal-sat [data-satmode="topo"]'); if (b) b.click(); });
  const mimg2 = await page.waitForFunction(() => {
    const i = document.querySelector('#modal-sat #sat-img');
    return (i && i.style.display !== 'none' && /^(data:image|blob:)/.test(i.src || '')) ? (i.src || '').slice(0, 40) : false;
  }, null, { timeout: 30000 }).then(r => r.jsonValue()).catch(() => null);
  ok('«🛰 نقشه» topo mode shows real topo image', !!mimg2 && mimg2 !== mimg, mimg2 || 'none');
  await page.evaluate(() => { const x = document.querySelector('#sat-close'); if (x) x.click(); });

  /* ── عکس دائمی داخل رکورد: پس‌زمینه فشرده‌سازی تمام شود ── */
  const recShot = await page.waitForFunction(() => {
    try {
      const geo = JSON.parse(localStorage.getItem('ga_course_geo') || '{}');
      const k = Object.keys(geo).find(k => geo[k] && geo[k].name === 'زمین تست ایثار');
      const s = k && geo[k].sat;
      return !!(s && s.img && s.imgTopo && s.img.length > 40000 && s.imgTopo.length > 40000 &&
                s.img.startsWith('data:image/') && s.imgTopo.startsWith('data:image/')) ? k : false;
    } catch (e) { return false; }
  }, null, { timeout: 30000 }).then(r => r.jsonValue()).catch(() => null);
  ok('record carries permanent compact images (sat+topo)', !!recShot, recShot ? 'geoId=' + recShot : 'missing');
  const recLens = await page.evaluate(k => {
    const geo = JSON.parse(localStorage.getItem('ga_course_geo') || '{}');
    return { img: (geo[k].sat.img || '').length, topo: (geo[k].sat.imgTopo || '').length };
  }, recShot || '').catch(() => ({ img: 0, topo: 0 }));
  ok('compact images within budget', recLens.img > 40000 && recLens.img <= 360000 && recLens.topo > 40000 && recLens.topo <= 360000,
     Math.round(recLens.img / 1024) + 'KB / ' + Math.round(recLens.topo / 1024) + 'KB');

  /* ── شبیه دستگاه دیگر: بدون IDB و بدون دسترسی به تایل‌ها (شبکهٔ بسته) ── */
  const recKey = recShot;
  await page.evaluate(() => new Promise(res => {
    const rq = indexedDB.deleteDatabase('ga_earth_shots');
    rq.onsuccess = rq.onerror = rq.onblocked = () => res();
  }).catch(() => {}));
  await Promise.all(['**/vt/lyrs**', '**server.arcgisonline.com**', '**tile.opentopomap.org**', '**mt*.google.com**']
    .map(pat => page.route(pat, r => r.abort())));
  await page.reload({ waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.APP && window.UI_LABELS, null, { timeout: 45000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.APP.go('mgmt'); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const t = document.querySelector('.mgmt-tab[data-tab="courses"]'); if (t) t.click(); });
  await page.waitForSelector('#mc-kml', { timeout: 20000 });
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="editc"]')].pop(); if (b) b.click(); });
  const bg3 = await page.waitForFunction(() => {
    const im = document.querySelector('#ec-geo-map .leaflet-image-layer img') || document.querySelector('#ec-geo-map .leaflet-image-layer');
    return im ? { src: (im.src || '').slice(0, 60), w: im.naturalWidth || im.width } : null;
  }, null, { timeout: 30000 }).then(r => r.jsonValue()).catch(() => null);
  ok('offline device shows the permanent record image (no tiles, no IDB)',
     !!bg3 && bg3.src.startsWith('data:image/'), bg3 ? bg3.src.slice(0, 30) + ' ' + bg3.w + 'px' : 'no overlay');
  await page.evaluate(() => { const b = document.querySelector('[data-earth-bg="topo"]'); if (b) b.click(); });
  const bg4 = await page.waitForFunction(() => {
    const im = document.querySelector('#ec-geo-map .leaflet-image-layer img') || document.querySelector('#ec-geo-map .leaflet-image-layer');
    return im ? (im.src || '').slice(0, 30) : null;
  }, null, { timeout: 30000 }).then(r => r.jsonValue()).catch(() => null);
  ok('offline topo mode also from record', !!bg4 && bg4.startsWith('data:image/'), bg4 || 'no overlay');

  /* ── دکمهٔ «🛰 نقشه» روی دستگاه بدون شبکه و بدون IDB → عکس دائمی رکورد ── */
  await page.evaluate(() => { const c = document.querySelector('#ec-cancel'); if (c) c.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="sat"]')].pop(); if (b) b.click(); });
  const mimg3 = await page.waitForFunction(() => {
    const i = document.querySelector('#modal-sat #sat-img');
    return (i && i.style.display !== 'none' && (i.src || '').startsWith('data:image/')) ? (i.src || '').slice(0, 30) : false;
  }, null, { timeout: 30000 }).then(r => r.jsonValue()).catch(() => null);
  ok('offline «🛰 نقشه» shows the permanent record image', !!mimg3, mimg3 || 'sketch/none');
  await page.evaluate(() => { const x = document.querySelector('#sat-close'); if (x) x.click(); });

  await page.screenshot({ path: '/home/user/ground_permanent_record.png' });

  /* cleanup local test data (nothing synced — local build, no cloud session) */
  await page.evaluate(() => { try { localStorage.removeItem('ga_courses'); localStorage.removeItem('ga_course_geo'); } catch (e) {} });
  ok('cleanup done', true);
} catch (e) { console.log('TEST ERROR:', e.message); fail++; }
finally { await browser.close(); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})();
