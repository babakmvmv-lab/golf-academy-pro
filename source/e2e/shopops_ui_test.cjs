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
  /* sidebar menu must scroll */
  const navStyle = await p.evaluate(() => {
    const n = document.querySelector('.sh-nav');
    return n ? getComputedStyle(n).overflowY : 'none';
  });
  ok('sidebar menu scrolls (overflow-y auto)', navStyle === 'auto');

  await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('چیدمان فروشگاه')); if (b2) b2.click(); });
  await p.waitForTimeout(900);
  ok('no phone frame — full-width storefront look', await p.locator('.sh-phone').count() === 0);
  const chips0 = await p.evaluate(() => [...document.querySelectorAll('.sh-chip[data-name]')].map(c => c.dataset.name));
  ok('category chips like the storefront', chips0.length === 3 && chips0[0] === 'توپ‌ها');
  const cardsAll = await p.evaluate(() => [...document.querySelectorAll('.sh-card')].map(c => +c.dataset.id));
  ok('default shows ALL products in model order [2,1,3,4]', JSON.stringify(cardsAll) === '[2,1,3,4]');
  const cardLooks = await p.evaluate(() => {
    const c = document.querySelector('.sh-card');
    return { img: !!c.querySelector('img'), price: !!c.querySelector('.pr b'), name: !!c.querySelector('h4'), cat: !!c.querySelector('.cat') };
  });
  ok('cards look like storefront (image + name + price + category)', cardLooks.img && cardLooks.name && cardLooks.price && cardLooks.cat);
  /* click chip → only that category */
  await p.evaluate(() => { [...document.querySelectorAll('.sh-chip[data-name]')].find(c => c.dataset.name === 'توپ‌ها').click(); });
  await p.waitForTimeout(400);
  const cardsF = await p.evaluate(() => [...document.querySelectorAll('.sh-card')].map(c => +c.dataset.id));
  ok('clicking a chip filters to that category [2,1]', JSON.stringify(cardsF) === '[2,1]');
  ok('clear button appears', await p.locator('[data-clear]').count() === 1);
  /* hold + drag card 2 below card 1 */
  const moved = await p.evaluate(() => {
    const cards = [...document.querySelectorAll('.sh-card')];
    const el = cards[0];
    const b = cards[1].getBoundingClientRect();
    const a = cards[0].getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, clientX: a.x + 10, clientY: a.y + 10 }));
    el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: a.x + 10, clientY: a.y + 16 }));
    el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: b.x + b.width * 0.25, clientY: b.y + b.height / 2 }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: b.x + b.width * 0.25, clientY: b.y + b.height / 2 }));
    return [...document.querySelectorAll('.sh-card')].map(c => +c.dataset.id);
  });
  ok('hold + drag reorders a product card (id 1 now first)', JSON.stringify(moved) === '[1,2]');
  /* drag chip توپ‌ها after چوب‌ها (category reorder) */
  const chipMoved = await p.evaluate(() => {
    const chips = [...document.querySelectorAll('.sh-chip[data-name]')];
    const el = chips[0]; /* توپ‌ها */
    const b = chips[1].getBoundingClientRect(); /* چوب‌ها */
    const a = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8, clientX: a.x + 10, clientY: a.y + 6 }));
    el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 8, clientX: a.x + 4, clientY: a.y + 6 }));
    el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 8, clientX: b.x + b.width * 0.25, clientY: b.y + b.height / 2 }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 8, clientX: b.x + b.width * 0.25, clientY: b.y + b.height / 2 }));
    return [...document.querySelectorAll('.sh-chip[data-name]')].map(c => c.dataset.name);
  });
  ok('hold + drag reorders a category chip (چوب‌ها now first)', chipMoved[0] === 'چوب‌ها');
  await p.waitForTimeout(150);
  const selAfter = await p.evaluate(() => [...document.querySelectorAll('.sh-chip[data-name]')].findIndex(c => c.classList.contains('on')));
  ok('post-drag click suppressed (filter unchanged, still توپ‌ها)', selAfter === 1);
  await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => x.getAttribute('data-act') === 'layout-save'); if (b2) b2.click(); });
  await p.waitForTimeout(900);
  const save = await p.evaluate(() => window.__calls.filter(c => c.kind === 'erp' && c.action === 'layout_save').pop());
  ok('layout_save posted', !!save);
  if (save) {
    console.log('  payload products:', JSON.stringify(save.payload.products));
    console.log('  payload categories:', JSON.stringify(save.payload.categories.map(x => x.name)));
    ok('save payload: all 4 products w/ sortOrder', save.payload.products.length === 4 && save.payload.products.every(x => x.sortOrder > 0));
    ok('save payload: توپ‌ها products in dragged order [1,2]', JSON.stringify(save.payload.products.filter(x => [1, 2].includes(x.id)).map(x => x.id)) === '[1,2]');
    ok('save payload: categories in dragged order [چوب‌ها, توپ‌ها, کیف‌ها]', save.payload.categories.length === 3 && save.payload.categories[0].name === 'چوب‌ها' && save.payload.categories[1].name === 'توپ‌ها');
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
