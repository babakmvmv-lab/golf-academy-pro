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

  /* ═══ بکاپ مستقل v3: دو پروفایل، گیرنده‌ها، تاریخچه و دانلود خصوصی ═══ */
  await p.evaluate(() => { const b2 = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('نسخه پشتیبان')); if (b2) b2.click(); });
  await p.waitForTimeout(900);
  const bkTxt = await p.evaluate(() => document.querySelector('#sh-view').innerText);
  ok('v3 backup view opens with private status', bkTxt.includes('وضعیت آخرین نسخهٔ سایت + فروشگاه') && bkTxt.includes('نسخه سالم') && bkTxt.includes('فردا 04:00'));
  ok('v3 page shows independent profile controls', bkTxt.includes('زمان‌بندی مستقل') && bkTxt.includes('محتوا و قالب') && bkTxt.includes('مقصدهای ذخیره‌سازی') && bkTxt.includes('گیرنده‌ها مستقل'));
  ok('history has a direct ZIP download control', await p.locator('[data-run-download]').count() === 1);
  ok('history shows actual email-relay acceptance status', bkTxt.includes('پذیرفته شد (1/1)'));
  const modeVis = await p.evaluate(() => {
    const sel = document.querySelector('[data-bk3-sched] [name=mode]');
    sel.value = 'interval'; sel.dispatchEvent(new Event('change', {bubbles:true}));
    return { time: getComputedStyle(document.querySelector('[data-bk3-time]')).display, int: getComputedStyle(document.querySelector('[data-bk3-int]')).display };
  });
  ok('v3 interval shows hours and hides fixed time', modeVis.time === 'none' && modeVis.int !== 'none');
  ok('one private destination is enabled by default', await p.locator('.sh-bk-dest').count() === 1);
  await p.evaluate(() => { const add = [...document.querySelectorAll('button')].find(x => x.getAttribute('data-act') === 'bk3-add-dest'); if (add) add.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const pick = document.querySelector('[data-pick=github]'); if (pick) pick.click(); });
  await p.waitForTimeout(200);
  ok('optional private GitHub destination can be added independently', await p.locator('.sh-bk-dest').count() === 2);
  const mailAdded = await p.evaluate(() => {
    const inp = document.querySelector('[data-mail-new]'); inp.value = 'b@puttclub.ir';
    document.querySelector('[data-mail-add]').click();
    return document.querySelectorAll('.sh-bk-mails .sh-pill').length;
  });
  ok('recipient can be added to this profile', mailAdded === 1);
  const mailEdited = await p.evaluate(() => {
    const edit = document.querySelector('[data-mail-edit="0"]'); if (!edit) return false;
    edit.click();
    const input = document.querySelector('[data-mail-edit-input]'); if (!input) return false;
    input.value = 'ops@puttclub.ir';
    document.querySelector('[data-mail-save]').click();
    return document.querySelector('.sh-bk-mails').innerText.includes('ops@puttclub.ir');
  });
  ok('recipient can be edited within this profile', mailEdited);
  await p.evaluate(() => { const save = [...document.querySelectorAll('button')].find(x => x.getAttribute('data-act') === 'bk3-save'); if (save) save.click(); });
  await p.waitForTimeout(180);
  if (!await p.evaluate(() => window.__calls.some(c => c.kind === 'erp' && c.action === 'backup_save'))) {
    await p.evaluate(() => { const save = [...document.querySelectorAll('button')].find(x => x.getAttribute('data-act') === 'bk3-save'); if (save) save.click(); });
  }
  await p.waitForTimeout(700);
  const siteSave = await p.evaluate(() => window.__calls.filter(c => c.kind === 'erp' && c.action === 'backup_save').pop());
  ok('backup_save includes selected system', !!siteSave && siteSave.payload.system === 'siteShop');
  if (siteSave) {
    const st = siteSave.payload.settings;
    ok('site+shop settings are scoped to siteShop only', st.mode === 'interval' && st.structures.siteShop && !st.structures.academy && st.destinations.length === 2 && st.emails.list.includes('ops@puttclub.ir'));
  }
  await p.evaluate(() => { const run = [...document.querySelectorAll('button')].find(x => x.getAttribute('data-act') === 'bk3-now'); if (run) run.click(); });
  await p.waitForTimeout(500);
  const siteNow = await p.evaluate(() => window.__calls.filter(c => c.kind === 'erp' && c.action === 'backup_now').pop());
  ok('manual run dispatches only siteShop', !!siteNow && siteNow.payload.system === 'siteShop');
  await p.evaluate(() => { const tab = document.querySelector('[data-system=academy]'); if (tab) tab.click(); });
  await p.waitForTimeout(700);
  const academyText = await p.evaluate(() => document.querySelector('#sh-view').innerText);
  ok('academy has its own profile and history view', academyText.includes('وضعیت آخرین نسخهٔ آکادمی') && academyText.includes('فقط داده‌های آکادمی'));
  await p.evaluate(() => {
    const sel = document.querySelector('[data-bk3-sched] [name=mode]'); sel.value='weekly'; sel.dispatchEvent(new Event('change',{bubbles:true}));
    const save=[...document.querySelectorAll('button')].find(x=>x.getAttribute('data-act')==='bk3-save');if(save)save.click();
  });
  await p.waitForTimeout(700);
  const academySave = await p.evaluate(() => window.__calls.filter(c => c.kind === 'erp' && c.action === 'backup_save').pop());
  ok('academy save is a different RPC profile', !!academySave && academySave.payload.system === 'academy' && academySave.payload.settings.mode === 'weekly' && !academySave.payload.settings.structures.siteShop && academySave.payload.settings.structures.academy);
  const isolated = await p.evaluate(() => ({site:window.__backupProfiles.siteShop.mode,academy:window.__backupProfiles.academy.mode}));
  ok('changing academy schedule does not overwrite site+shop', isolated.site === 'interval' && isolated.academy === 'weekly');
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
