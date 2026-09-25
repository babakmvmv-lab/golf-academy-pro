/* Public storefront regression test (not the standalone academy panel).
 * Serve the repository root, then run with Playwright + Chromium/WebKit installed:
 *   BASE_URL=http://127.0.0.1:8000 node source/e2e/public_viewport_e2e.cjs
 * Optional: QA_SCREENSHOTS=/path/to/screenshots
 * No accounts, orders or server settings are modified. Unlock tests use an isolated session.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const SHOTS = process.env.QA_SCREENSHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

async function settled(page) {
  await page.evaluate(() => document.fonts.ready);
  // Wait for the entrance animation, not for unrelated video/network downloads.
  await page.waitForTimeout(1100);
}

async function viewportFits(page, label) {
  const m = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    x: window.scrollX,
  }));
  assert.ok(m.document <= m.viewport + 1, `${label}: root overflow ${JSON.stringify(m)}`);
  assert.ok(m.body <= m.viewport + 1, `${label}: body overflow ${JSON.stringify(m)}`);
  assert.ok(Math.abs(m.x) <= 1, `${label}: page shifted sideways ${JSON.stringify(m)}`);
  for (const left of [-2000, 2000]) {
    await page.evaluate(left => window.scrollTo({ left, top: scrollY, behavior: 'instant' }), left);
    assert.ok(Math.abs(await page.evaluate(() => scrollX)) <= 1, `${label}: horizontal scroll is possible`);
  }
  return m;
}

async function touchSwipe(page, from, to) {
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from[0], y: from[1] }] });
  for (let n = 1; n <= 8; n++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from[0] + (to[0] - from[0]) * n / 8, y: from[1] + (to[1] - from[1]) * n / 8 }],
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
  await page.waitForTimeout(250);
}

async function homeChecks(browser, engine, width, height, isMobile) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile, hasTouch: isMobile });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await settled(page);
    await viewportFits(page, `${engine} home ${width}`);
    assert.ok(await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      return [...document.querySelectorAll('main > .min-h-svh h1, main > .min-h-svh .mt-16.flex .text-center')]
        .every(e => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= W + 1; });
    }), `${engine} ${width}: hero text is clipped`);
    const badge = await page.locator('#academy [class~="start-1/2"]').evaluate(e => {
      const r = e.getBoundingClientRect(), p = e.parentElement.getBoundingClientRect();
      return Math.abs(r.left + r.width / 2 - p.left - p.width / 2);
    });
    assert.ok(badge < 1, `${engine} ${width}: RTL academy badge is not centered`);

    if (SHOTS && [320, 393, 1440].includes(width)) {
      await page.screenshot({ path: path.join(SHOTS, `${engine}-home-${width}.png`) });
    }
    // Reveal the complete page, including the original off-screen badge/glow.
    for (const id of ['academy', 'programs', 'contact']) {
      await page.locator('main #' + id).scrollIntoViewIfNeeded();
      await viewportFits(page, `${engine} ${width} section ${id}`);
    }
    assert.ok(await page.evaluate(() => scrollY > 100), 'Vertical scrolling must remain available');
    await page.evaluate(() => scrollTo({ left: 0, top: 0, behavior: 'instant' }));
    assert.ok(await page.evaluate(() => !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1\b/.test(document.querySelector('meta[name="viewport"]').content)), 'Pinch zoom must not be disabled');
    assert.ok(await page.evaluate(() => ['html', 'body', '#public-site'].every(q => getComputedStyle(document.querySelector(q)).touchAction !== 'none')), 'Do not block page touch gestures');

    if (width === 393) {
      if (engine === 'chromium') {
        await touchSwipe(page, [100, 420], [310, 420]);
        await touchSwipe(page, [310, 420], [100, 420]);
        await viewportFits(page, 'Real horizontal touch gestures');
        await touchSwipe(page, [195, 650], [195, 220]);
        assert.ok(await page.evaluate(() => scrollY > 50), 'Vertical touch scroll is blocked');
        await page.evaluate(() => scrollTo({ left: 0, top: 0, behavior: 'instant' }));
      }
      // Open/close the mobile menu and animated cart, without widening the document.
      const menu = page.getByRole('button', { name: 'منو', exact: true });
      await menu.click();
      await page.waitForTimeout(450);
      assert.ok(await page.locator('header nav').last().isVisible());
      await viewportFits(page, `${engine} open menu`);
      await menu.click();
      await page.getByRole('button', { name: 'سبد خرید', exact: true }).click();
      await page.waitForTimeout(550);
      await viewportFits(page, `${engine} open cart`);
      await page.getByRole('button', { name: 'بستن', exact: true }).click();
      await page.waitForTimeout(550);
      await viewportFits(page, `${engine} closed cart`);
      assert.ok(await page.evaluate(() => getComputedStyle(document.body).overflowY !== 'hidden'), 'Cart leaves body locked');
      // Resizing the same document must not restore its old horizontal offset.
      await page.setViewportSize({ width: 844, height: 393 });
      await viewportFits(page, `${engine} landscape`);
      await page.setViewportSize({ width: 393, height: 850 });
      await viewportFits(page, `${engine} portrait restored`);
    }
    assert.deepEqual(errors, [], `${engine} ${width}: page errors`);
    console.log(`PASS ${engine}: home ${width}x${height}, vertical scroll, no horizontal offset`);
  } finally { await context.close(); }
}

async function routeChecks(browser, engine) {
  for (const width of [320, 393, 1440]) {
    for (const [route, unlocked] of [
      ['/shop/', false], ['/shop/', true], ['/checkout/', false],
      ['/product/pro-v1-driver/', false], ['/login/', false], ['/admin/login/', false],
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 850 }, isMobile: width < 600, hasTouch: width < 600 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      try {
        if (unlocked) await context.addInitScript(() => sessionStorage.setItem('puttclub_shop_unlocked', '1'));
        if (route === '/checkout/') {
          const product = require('../../data/products.json')[0];
          // Checkout intentionally shows an empty-cart page without a gate until it has items.
          await context.addInitScript(item => localStorage.setItem('puttclub-cart', JSON.stringify({
            state: { items: [item] }, version: 0,
          })), { productId: product.id, slug: product.slug, name: product.name, price: product.price, image: product.images[0], qty: 1 });
        }
        await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
        await settled(page);
        await viewportFits(page, `${engine} ${route} ${width}`);
        if (['/shop/', '/checkout/'].includes(route)) {
          const gate = page.getByRole('dialog', { name: /فروشگاه/ });
          assert.equal(await gate.isVisible(), !unlocked, 'Existing storefront lock behavior changed');
          if (!unlocked) {
            await gate.getByRole('link').click();
            await page.waitForURL(BASE + '/');
            await settled(page);
            await viewportFits(page, `${engine} returning from gate`);
            await page.evaluate(() => scrollTo({ left: 0, top: 250, behavior: 'instant' }));
            assert.ok(await page.evaluate(() => scrollY > 100), 'Returning from gate leaves home frozen');
          }
        }
        assert.deepEqual(errors, [], `${engine} ${route}: page errors`);
        console.log(`PASS ${engine}: ${route} ${width}${unlocked ? ' unlocked session' : ''}`);
      } finally { await context.close(); }
    }
  }
  // Server-rendered page remains contained before any JS can hydrate it.
  const noJS = await browser.newContext({ viewport: { width: 393, height: 850 }, isMobile: true, hasTouch: true, javaScriptEnabled: false });
  try {
    const p = await noJS.newPage();
    await p.goto(BASE + '/', { waitUntil: 'load' });
    await viewportFits(p, `${engine} no JavaScript`);
    console.log(`PASS ${engine}: initial server-rendered layout`);
  } finally { await noJS.close(); }
}

(async () => {
  for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const width of [320, 360, 375, 393, 414, 430, 639, 768, 1024, 1440]) {
        await homeChecks(browser, engine, width, 850, width < 768);
      }
      await routeChecks(browser, engine);
    } finally { await browser.close(); }
  }
  console.log('PASS: public mobile viewport regression suite');
})().catch(e => { console.error(e); process.exitCode = 1; });
