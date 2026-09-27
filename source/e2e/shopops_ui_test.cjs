/* shop-ops layout drag + reviews moderation test (stubbed cloud). */
const { chromium } = require('playwright-core');
const EXE = process.env.CHROME || '/home/user/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8010';
let pass = 0, fail = 0;
const ok = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + ' — ' + n); c ? pass++ : fail++; };
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0, 200)));
  await p.goto(BASE + '/source/e2e/pc_shopops_test.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2200);
  ok('shop-ops mounted', await p.locator('#shop-ops').count() === 1);
  await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('چیدمان فروشگاه')); if (b2) b2.click(); });
  await p.waitForTimeout(900);
  ok('layout view shows phone frame', await p.locator('.sh-phone').count() === 1);
  const cats = await p.evaluate(() => [...document.querySelectorAll('.sh-lay-cat')].map(c => c.dataset.name));
  ok('categories ordered per shopCategories (توپ‌ها first)', cats[0] === 'توپ‌ها');
  ok('all categories present (3)', cats.length === 3 && cats.includes('کیف‌ها'));
  const prods = await p.evaluate(() => [...document.querySelectorAll('.sh-lay-prods:not([hidden]) .sh-lay-prod')].map(r => +r.dataset.id));
  ok('products sorted by sortOrder (2 before 1)', prods.length === 2 && prods[0] === 2 && prods[1] === 1);
  const moved = await p.evaluate(() => {
    const rows = [...document.querySelectorAll('.sh-lay-prods:not([hidden]) .sh-lay-prod')];
    const grip = rows[0].querySelector('.sh-grip');
    const target = rows[1].getBoundingClientRect();
    grip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, clientX: target.x + 5, clientY: rows[0].getBoundingClientRect().y + 5 }));
    grip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: target.x + 5, clientY: target.y + target.height - 2 }));
    grip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: target.x + 5, clientY: target.y + target.height - 2 }));
    return [...document.querySelectorAll('.sh-lay-prods:not([hidden]) .sh-lay-prod')].map(r => +r.dataset.id);
  });
  ok('product drag reorders (id 1 now first)', moved[0] === 1 && moved[1] === 2);
  const catMoved = await p.evaluate(() => {
    const blocks = [...document.querySelectorAll('.sh-lay-cat')];
    const grip = blocks[0].querySelector('.sh-grip');
    const t = blocks[1].getBoundingClientRect();
    grip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8, clientX: t.x + 5, clientY: t.y + 5 }));
    grip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 8, clientX: t.x + 5, clientY: t.y + t.height - 2 }));
    grip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 8, clientX: t.x + 5, clientY: t.y + t.height - 2 }));
    return [...document.querySelectorAll('.sh-lay-cat')].map(c => c.dataset.name);
  });
  console.log('  cat order after drag:', catMoved.join(' | '));
  ok('category drag reorders (چوب‌ها now first)', catMoved[0] === 'چوب‌ها');
  await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => x.getAttribute('data-act') === 'layout-save'); if (b2) b2.click(); });
  await p.waitForTimeout(900);
  const save = await p.evaluate(() => window.__calls.filter(c => c.kind === 'erp' && c.action === 'layout_save').pop());
  ok('layout_save posted', !!save);
  if (save) {
    console.log('  payload products:', JSON.stringify(save.payload.products));
    console.log('  payload categories:', JSON.stringify(save.payload.categories.map(x => x.name)));
    ok('save payload: all 4 products w/ sortOrder', save.payload.products.length === 4 && save.payload.products.every(x => x.sortOrder > 0));
    ok('save payload: توپ‌ها products in dragged order [1,2]', JSON.stringify(save.payload.products.filter(x => [1, 2].includes(x.id)).map(x => x.id)) === '[1,2]');
    ok('save payload: categories in dragged order', save.payload.categories.length === 3 && save.payload.categories[0].name === 'چوب‌ها');
  }
  await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('دیدگاه‌های سایت')); if (b2) b2.click(); });
  await p.waitForTimeout(900);
  const revTxt = await p.evaluate(() => document.querySelector('#sh-view').innerText);
  ok('reviews view lists pending', revTxt.includes('در انتظار تأیید') && revTxt.includes('عالی بود'));
  ok('reviews view lists approved', revTxt.includes('تأییدشده'));
  await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => x.getAttribute('data-review-approve')); if (b2) b2.click(); });
  await p.waitForTimeout(700);
  const appr = await p.evaluate(() => window.__calls.filter(c => c.kind === 'request' && c.url.includes('/api/admin/reviews/11')).pop());
  ok('approve PUT sent with status approved', !!appr && appr.method === 'PUT' && JSON.parse(appr.body).status === 'approved');
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
