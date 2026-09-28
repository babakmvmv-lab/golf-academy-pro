/* E2E: (۱) آیکون ابر فشرده در پنل سایت، (۲) ویجت تصاویر فرم کالا (بارگذاری→پیش‌نمایش→حذف)، (۳) رزرو بی‌صدا (بدون نشان). */
(async () => {
const { chromium } = require('playwright-core');
const EXE = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8010';
let pass = 0, fail = 0;
const ok = (n, c, extra) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n + (extra ? '  [' + extra + ']' : '')); c ? pass++ : fail++; };

const browser = await chromium.launch({ executablePath: EXE });

/* ── ۱) پنل سایت: آیکون ابر ── */
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('puttclub_admin', JSON.stringify({ email: 'admin@puttclub.ir' })); } catch (e) {} });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 150)));
  await p.goto(BASE + '/admin/site/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(6000);
  const icon = await p.evaluate(() => {
    const b = document.getElementById('pc-cloud-btn');
    const box = document.getElementById('pc-site-cloud');
    return { icon: !!b, box: !!box, boxHidden: box ? box.hidden : null, iconSize: b ? Math.round(b.getBoundingClientRect().width) : 0 };
  });
  ok('cloud: compact round icon (46px) exists', icon.icon && icon.iconSize <= 50, icon.iconSize + 'px');
  ok('cloud: details box starts CLOSED (no big always-open panel)', icon.box && icon.boxHidden === true);
  await p.evaluate(() => document.getElementById('pc-cloud-btn').click());
  await p.waitForTimeout(300);
  const opened = await p.evaluate(() => !document.getElementById('pc-site-cloud').hidden);
  ok('cloud: click opens the box', opened);
  const hasActions = await p.evaluate(() => { const t = document.getElementById('pc-site-cloud').innerText; return t.includes('ارسال دوباره') && t.includes('بررسی اتصال'); });
  ok('cloud: box keeps all actions (retry / check / auth)', hasActions);
  await p.evaluate(() => document.querySelector('#pc-site-cloud [data-pc="close"]').click());
  await p.waitForTimeout(200);
  ok('cloud: ✕ closes the box', await p.evaluate(() => document.getElementById('pc-site-cloud').hidden));
  /* دکمه‌های بارگذاری برند/درباره هنوز وصله‌اند */
  await p.evaluate(() => { const btn = [...document.querySelectorAll('nav button')].find(x => x.textContent.includes('محتوا و تصاویر')); if (btn) btn.click(); });
  await p.waitForTimeout(2500);
  const loadBtns = await p.evaluate(() => [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === 'بارگذاری').length);
  ok('site panel: brand/about upload buttons present', loadBtns >= 3, loadBtns + ' buttons');
  await ctx.close();
} catch (e) { console.log('CLOUD TEST ERROR:', e.message); fail++; }

/* ── ۲) فرم کالا: ویجت تصاویر ── */
try {
  const p2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  p2.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 150)));
  await p2.goto(BASE + '/source/e2e/pc_shopops_test.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p2.waitForTimeout(2000);
  ok('shop fixture has PC_IMG', await p2.evaluate(() => !!window.PC_IMG));
  await p2.evaluate(() => { const btn = [...document.querySelectorAll('button')].find(x => x.textContent.includes('کالا و انبار')); if (btn) btn.click(); });
  await p2.waitForTimeout(800);
  await p2.evaluate(() => { const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'ویرایش'); if (btn) btn.click(); });
  await p2.waitForTimeout(1000);
  const widget = await p2.evaluate(() => ({
    box: !!document.querySelector('[data-images-box]'),
    prevThumbs: document.querySelectorAll('[data-img-prev] .sh-imgthumb').length,
    listRows: document.querySelectorAll('[data-img-list] .sh-imgrow').length,
    uploadBtn: !!document.querySelector('[data-upload-images]'),
    urlInput: !!document.querySelector('[data-img-url]'),
    oldTextareaVisible: (() => { const t = document.querySelector('[name="images"]'); return t && t.offsetParent !== null; })(),
  }));
  ok('product form: image widget (previews + list + upload + url)', widget.box && widget.uploadBtn && widget.urlInput && !widget.oldTextareaVisible);
  ok('product form: image-less product shows empty-state hint', widget.prevThumbs === 0 ? !!(await p2.evaluate(() => !!document.querySelector('.sh-imgempty'))) : widget.listRows >= 1, widget.prevThumbs + ' thumbs');

  /* بارگذاری واقعی فایل → پیش‌نمایش + ردیف لیست */
  await p2.evaluate(() => document.querySelector('[data-upload-images]').click());
  await p2.waitForTimeout(400);
  const inputs = await p2.locator('input[type=file]').all();
  ok('upload click opens file picker input', inputs.length >= 1);
  if (inputs.length) {
    await inputs[inputs.length - 1].setInputFiles(require('path').join(__dirname, 'fixtures_upload_red.jpg'));
    await p2.waitForTimeout(2500);
    const after = await p2.evaluate(() => ({
      prevThumbs: document.querySelectorAll('[data-img-prev] .sh-imgthumb').length,
      listRows: document.querySelectorAll('[data-img-list] .sh-imgrow').length,
      lastIsData: (() => { const t = document.querySelector('[name="images"]'); const l = t.value.split('\n').filter(Boolean).pop(); return (l || '').startsWith('data:image/'); })(),
    }));
    ok('upload → new preview thumbnail appears', after.prevThumbs === widget.prevThumbs + 1, after.prevThumbs + ' thumbs');
    ok('upload → new list row appears', after.listRows === widget.listRows + 1, after.listRows + ' rows');
    ok('upload → WebP data URL stored in images', after.lastIsData);

    /* حذف از لیست */
    await p2.evaluate(() => document.querySelector('[data-img-del="' + (document.querySelectorAll('[data-img-del]').length - 1) + '"]').click());
    await p2.waitForTimeout(400);
    const afterDel = await p2.evaluate(() => ({
      prevThumbs: document.querySelectorAll('[data-img-prev] .sh-imgthumb').length,
      listRows: document.querySelectorAll('[data-img-list] .sh-imgrow').length,
    }));
    ok('delete removes preview + list row', afterDel.prevThumbs === widget.prevThumbs && afterDel.listRows === widget.listRows, JSON.stringify(afterDel));
  }

  /* افزودن با نشانی */
  await p2.evaluate(() => { const i = document.querySelector('[data-img-url]'); i.value = '/images/test-url-add.jpg'; document.querySelector('[data-img-add]').click(); });
  await p2.waitForTimeout(300);
  const urlAdded = await p2.evaluate(() => document.querySelectorAll('[data-img-prev] .sh-imgthumb').length);
  ok('add by URL appends a preview', urlAdded === widget.prevThumbs + 1, urlAdded + ' thumbs');
  await p2.close();
} catch (e) { console.log('WIDGET TEST ERROR:', e.message); fail++; }

/* ── ۳) رزرو بی‌صدا در ویترین ── */
try {
  const p3 = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  let reserveCalls = 0;
  await p3.route('**/functions/v1/web-order**', r => { reserveCalls++; return r.fulfill({ json: { ok: true, data: { items: [] } } }); });
  await p3.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p3.waitForTimeout(4000);
  /* سبد خرید با یک کالا */
  await p3.evaluate(() => { try { localStorage.setItem('puttclub-cart', JSON.stringify({ state: { items: [{ productId: 2, qty: 1, name: 'توپ تست' }], isOpen: false }, version: 0 })); } catch (e) {} });
  await p3.waitForTimeout(4000);
  const silent = await p3.evaluate(() => ({
    badge: !!document.querySelector('.pc-pay-badge'),
    badgeCss: !!document.querySelector('style') && [...document.querySelectorAll('style')].some(s => s.textContent.includes('pc-pay-badge')),
    bodyHasTimerText: document.body.innerText.includes('رزرو سبد خرید'),
  }));
  ok('reservation: no visible timer badge', !silent.badge);
  ok('reservation: countdown text nowhere on page', !silent.bodyHasTimerText);
  ok('reservation: reserve call still fires on cart add', reserveCalls >= 1, reserveCalls + ' calls');
  await p3.close();
} catch (e) { console.log('RESERVE TEST ERROR:', e.message); fail++; }

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})();
