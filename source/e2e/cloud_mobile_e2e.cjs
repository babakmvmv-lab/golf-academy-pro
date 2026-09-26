/* Browser regression for the academy cloud panel.
 * Playwright Chromium/WebKit required; serve the repository root first.
 * BASE_URL=http://127.0.0.1:8000 node source/e2e/cloud_mobile_e2e.cjs
 * ALL Supabase traffic is intercepted: no live read, write, account or order.
 */
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const SHOTS = process.env.QA_SCREENSHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await type.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 393, height: 850 }, isMobile: true, hasTouch: true });
    const rows = new Map(), requests = [], external = [], errors = [];
    let fail = true;
    try {
      await context.route('https://**.supabase.co/**', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.hostname !== 'fake.supabase.co') {
          external.push({ host: url.hostname, method: req.method() });
          return route.abort('blockedbyclient');
        }
        const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'apikey,authorization,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers, body: '{}' });
        if (req.method() === 'GET') {
          let list = [...rows.values()];
          const k = url.searchParams.get('k');
          if (k?.startsWith('in.(')) list = list.filter(r => k.slice(4, -1).split(',').includes(r.k));
          return route.fulfill({ status: 200, headers, body: JSON.stringify(list.slice(0, +(url.searchParams.get('limit') || 500))) });
        }
        assert.equal(url.pathname, '/functions/v1/ga-sync', 'No direct REST writes');
        const body = req.postDataJSON();
        requests.push({ action: body.action, keys: (body.rows || []).map(r => r.k) });
        if (body.action === 'kv') {
          assert.equal(body.rows.length, 1, 'One record per request');
          if (fail && body.rows[0].k === 'ga_queue_probe_3') {
            return route.fulfill({ status: 502, headers, body: JSON.stringify({ ok: false, err: 'temporary write failure (mock)' }) });
          }
          body.rows.forEach(r => rows.set(r.k, r));
          return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, put: body.rows.length, del: 0 }) });
        }
        return route.fulfill({ status: 400, headers, body: JSON.stringify({ ok: false, err: 'test does not use this action' }) });
      });
      await context.addInitScript(() => {
        if (localStorage.getItem('cloud-qa-initialized')) return;
        localStorage.setItem('cloud-qa-initialized', '1');
        localStorage.setItem('ga_cloud_cfg', JSON.stringify({ url: 'https://fake.supabase.co', key: 'test-publishable-0123456789-abcdefghijkl', on: true }));
        localStorage.setItem('ga_users', JSON.stringify([{ id: 1, user: 'qa', pass: 'test-only', name: 'مدیر آزمایشی', role: 'admin', main: true, active: true }]));
        localStorage.setItem('ga_session', JSON.stringify('qa'));
      });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(BASE + '/GolfAcademy_PRO.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.GA_CLOUD && document.querySelector('#ga-cloud-chip'));
      await page.evaluate(() => GA_CLOUD.push('manual'));
      await page.evaluate(() => {
        for (let i = 0; i < 6; i++) localStorage.setItem('ga_queue_probe_' + i, JSON.stringify({ index: i, note: 'دادهٔ آزمایشی' }));
      });
      assert.equal(await page.evaluate(() => GA_CLOUD.push('manual')), false);
      assert.deepEqual(await page.evaluate(() => GA_CLOUD.dirty()), ['ga_queue_probe_3']);
      await page.locator('#ga-cloud-chip').click();
      await page.locator('#gc-test').click();
      await page.waitForFunction(() => document.querySelector('#gc-read-status').textContent.includes('خواندن از دیتابیس برقرار'));
      assert.equal(await page.evaluate(() => GA_CLOUD.status().phase), 'error');
      assert.match(await page.locator('#gc-status').textContent(), /502/);
      assert.match(await page.locator('#gc-errors').textContent(), /ga_queue_probe_3/);
      assert.match(await page.locator('#ga-cloud-chip').textContent(), /1 در صف/);
      for (const [width, height] of [[320, 700], [393, 850], [844, 393]]) {
        await page.setViewportSize({ width, height });
        const box = await page.locator('#ga-cloud-panel').boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `${name}: panel fits horizontally`);
        assert.ok(box.y >= 0 && box.y + box.height <= height + 1, `${name}: panel fits vertically`);
      }
      await page.setViewportSize({ width: 393, height: 850 });
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}-cloud-error.png`) });
      await page.locator('#ga-cloud-panel summary').click();
      assert.equal(await page.locator('#gc-key').getAttribute('type'), 'password');
      assert.equal(await page.locator('#gc-url').getAttribute('dir'), 'ltr');
      assert.ok(await page.locator('#gc-url').evaluate(e => parseFloat(getComputedStyle(e).fontSize) >= 16));
      // Reload keeps the unacknowledged edit in localStorage and only retries that key.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.GA_CLOUD && GA_CLOUD.status().phase === 'error');
      assert.ok((await page.evaluate(() => GA_CLOUD.dirty())).includes('ga_queue_probe_3'));
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ga_queue_probe_3')).index), 3);
      fail = false;
      await page.locator('#ga-cloud-chip').click();
      await page.locator('#gc-push').click();
      await page.waitForFunction(() => GA_CLOUD.status().phase === 'idle' && GA_CLOUD.dirty().length === 0);
      assert.equal(await page.locator('#ga-cloud-chip').textContent(), '☁️ همگام');
      for (let i = 0; i < 6; i++) assert.equal(rows.get('ga_queue_probe_' + i).v.index, i);
      assert.deepEqual(external, [], 'No live Supabase requests were made');
      assert.deepEqual(errors, [], 'No page errors');
      console.log(`PASS ${name}: five records saved, one preserved on failure; read test does not mask error; reload/retry recovers; mobile panel fits.`);
    } finally { await context.close(); await browser.close(); }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
