/* Browser integration for rank prerequisites in the standalone academy.
 * Serve repository root, then:
 * NODE_PATH=<playwright node_modules> node source/e2e/rank_prerequisites_browser.cjs
 * Only synthetic browser-local records. Every non-local network route is blocked.
 */
const { chromium, webkit, firefox } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const SHOTS = process.env.QA_SCREENSHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive:true });
const expectedReq = lv => lv < 5 ? [0,0,0] : lv === 5 ? [0,0,1] : lv === 6 ? [0,1,3] : [0,3,10];

(async () => {
  const engines = [['chromium',chromium], ['webkit',webkit], ['firefox',firefox]];
  for (const [name, engine] of engines.filter(([n]) => !process.env.ENGINES || process.env.ENGINES.split(',').includes(n))) {
    const browser = await engine.launch({ headless:true });
    const context = await browser.newContext({ viewport:{ width:1440,height:1000 }, serviceWorkers:'block' });
    const errors = [], supabase = [];
    try {
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === new URL(BASE).origin) return route.continue();
        if (url.hostname.endsWith('.supabase.co')) supabase.push(route.request().method()+' '+url.pathname);
        return route.abort('blockedbyclient');
      });
      await context.addInitScript(() => {
        localStorage.setItem('ga_cloud_cfg', JSON.stringify({ on:false }));
        if (localStorage.getItem('rank-qa-seeded')) return;
        localStorage.setItem('rank-qa-seeded','1');
        const put = (k,v) => localStorage.setItem(k,JSON.stringify(v));
        localStorage.setItem('ga_seed_v2','1405');
        localStorage.setItem('ga_cleanup_practice_v1','1');
        put('ga_tour_hidden', Array.from({ length:12 },(_,i) => i+1));
        put('ga_users',[
          { id:1,user:'qaadmin',pass:'test-only',name:'مدیر آزمایشی',role:'admin',active:true,main:true },
          { id:2,user:'qarank',pass:'test-only',name:'عضو آزمایشی',role:'member',active:true,pid:'1' },
          { id:3,user:'qaother',pass:'test-only',name:'عضو دوم آزمایشی',role:'member',active:true,pid:2 },
          { id:4,user:'qanoplayer',pass:'test-only',name:'یوزر بدون بازیکن',role:'member',active:true },
        ]);
        localStorage.setItem('ga_session','qaadmin');
        put('ga_subscriptions',[
          { id:'qa-rank-sub',user:'qarank',plan:'professional',status:'active',start_date:'2020-01-01',end_date:'2099-01-01',start_at:'2020-01-01T00:00:00Z',end_at:'2099-01-01T00:00:00Z' },
        ]);
        const players = {}; for (let p=1;p<=8;p++) players[p] = { name:'بازیکن آزمایشی '+p };
        put('ga_players', players);
        const skin = {}; for (let lv=1;lv<=15;lv++) skin[lv] = { pts:(lv-1)*100, bg1:'#123456', badge:'★' };
        put('ga_rank_skin', skin);
        put('ga_honor', { qarank:{ lv:15 } });
        const tours = Array.from({ length:15 },(_,i) => ({ name:'مسابقهٔ آزمایشی '+i,
          lvl:i<10 ? 3 : i<13 ? 2 : 1, course:1, holes:18, date:i%2 ? '2026-04-10' : '2024-04-10' }));
        put('ga_tournaments', tours);
        put('ga_results', {
          1000:{ participants:[1,2], top:{ 1:1,2:2 } },
          1010:{ participants:[1,2], top:{ 1:1,2:2 } },
        });
        put('ga_programs',[{ id:'qa-old-program',name:'امتیاز سابقهٔ آزمایشی',type:'کلاس',start:'2024-01-01',
          participants:[1],top:{ 1:1 },p1:10000,p2:0,p3:0,entry:0 }]);
        put('ga_scorecards',[]);
      });
      const page = await context.newPage();
      page.on('pageerror',e => errors.push(e.stack || e.message));
      async function management() {
        await page.evaluate(() => APP.go('mgmt'));
        await page.locator('.mgmt-tab[data-tab="honor"]').click();
        await page.locator('#hr-prereqs').waitFor();
      }
      async function reqValues() {
        return page.locator('#hr-prereqs [data-hf]').evaluateAll(els => Object.fromEntries(els.map(el => [el.dataset.hf,Number(el.value)])));
      }
      async function showRank(lv) {
        await page.locator(`[data-hlv="${lv}"]`).click();
        await page.waitForFunction(lv => document.querySelector('#hr-prev')?.dataset.lv === String(lv), lv);
      }
      async function currentLevel(user='qarank') {
        return Number(await page.locator(`[data-hmember="${user}"] [data-hlevel]`).getAttribute('data-hlevel'));
      }
      await page.goto(BASE+'/GolfAcademy_PRO.html#mgmt', { waitUntil:'domcontentloaded' });
      await page.waitForSelector('#app.on');
      await management();
      assert.equal(await page.locator('[data-hlv]').count(),15);
      assert.equal(await page.locator('#hr-prereqs input').count(),4);
      assert.match(await page.locator('#hr-prereqs').innerText(),/هر چهار شرط باید هم‌زمان/);
      assert.doesNotMatch(await page.locator('#mgmt-body').innerText(),/حداقل امتیاز فصل|خودکار از امتیاز فصل/);
      for (let lv=1;lv<=15;lv++) {
        await showRank(lv);
        const v = await reqValues();
        assert.equal(v.pts,(lv-1)*100,'Existing points preserved for level '+lv);
        assert.deepEqual([v.wins1,v.wins2,v.wins3],expectedReq(lv));
      }
      assert.equal(await currentLevel(),5,'All-time points plus 1 Tier-3 win only earns level 5');
      assert.equal(await currentLevel('qanoplayer'),1,'Account without linked player gets no borrowed progress');
      assert.equal(await page.locator('[data-hmember="qarank"] [data-hstat="pts"]').innerText(),'۱۰,۰۲۵');
      assert.equal(await page.locator('[data-hmember="qarank"] [data-hstat="wins2"]').innerText(),'۱');
      assert.equal(await page.locator('[data-hmember="qarank"] [data-hstat="wins3"]').innerText(),'۱');
      assert.match(await page.locator('[data-hmember="qarank"]').innerText(),/پیش‌نیاز رنک دستی ناقص/);
      assert.equal(await page.locator('[data-hset="qarank"] option[value="15"]').isDisabled(),true);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ga_honor')).qarank.lv),15,'Old manual choice not deleted');
      await page.locator('[data-hset="qarank"]').selectOption('');
      assert.equal(await currentLevel(),5);
      await showRank(7);
      await page.locator('#hr-wins1').fill('2');
      await page.locator('#hr-wins2').fill('4');
      await page.locator('#hr-wins3').fill('11');
      await page.locator('#hr-save').click();
      assert.deepEqual(await reqValues(),{ pts:600,wins1:2,wins2:4,wins3:11 });
      let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ga_rank_skin')));
      assert.equal(stored[7].pts,600); assert.equal(stored[7].bg1,'#123456'); assert.equal(stored[7].badge,'★');
      for (let lv=1;lv<=15;lv++) assert.equal(stored[lv].pts,(lv-1)*100);
      await showRank(8); assert.deepEqual(await reqValues(),{ pts:700,wins1:0,wins2:3,wins3:10 });
      await page.reload({ waitUntil:'domcontentloaded' });
      await page.waitForSelector('#app.on'); await management(); await showRank(7);
      assert.deepEqual(await reqValues(),{ pts:600,wins1:2,wins2:4,wins3:11 });
      for (const bad of ['-1','2.5','']) {
        await page.locator('#hr-wins3').fill(bad);
        assert.equal(await page.locator('#hr-req-error').isVisible(),true);
        assert.equal(await page.locator('#hr-wins3').getAttribute('aria-invalid'),'true');
        assert.equal(await page.evaluate(() => AV.rankOf(7).wins3),11,'Invalid value never replaces saved setting');
      }
      await page.locator('#hr-wins3').fill('11');
      assert.equal(await page.locator('#hr-req-error').isVisible(),false);
      await page.locator('#hr-wins1').fill('0');
      await page.locator('#hr-wins2').fill('3');
      await page.locator('#hr-wins3').fill('10');
      await page.locator('#hr-save').click();
      if (SHOTS) await page.locator('.honor-editor').screenshot({ path:path.join(SHOTS,name+'-rank-desktop.png') });
      // Fieldset, preview/editor grid and local table scroll must not overflow the document.
      for (const [width,height] of [[1440,1000],[393,852],[320,700],[844,393]]) {
        await page.setViewportSize({ width,height });
        await page.locator('#hr-prereqs').scrollIntoViewIfNeeded();
        const layout = await page.evaluate(() => {
          const el=document.querySelector('#hr-prereqs'), r=el.getBoundingClientRect();
          return { viewport:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,left:r.left,right:r.right };
        });
        assert.ok(layout.doc <= width+1,`${name} ${width}: document overflow ${JSON.stringify(layout)}`);
        assert.ok(layout.body <= width+1,`${name} ${width}: body overflow`);
        assert.ok(layout.left >= -1 && layout.right <= width+1,`${name} ${width}: fieldset fits`);
        for (const key of ['pts','wins1','wins2','wins3']) {
          const box=await page.locator('#hr-'+key).boundingBox();
          assert.ok(box.x>=-1 && box.x+box.width<=width+1,`${name} ${width} ${key}: input fits`);
        }
        if (SHOTS && width===393) await page.screenshot({ path:path.join(SHOTS,name+'-rank-mobile.png') });
      }
      await page.setViewportSize({ width:393,height:852 });
      await page.evaluate(() => localStorage.setItem('ga_session','qarank'));
      await page.reload({ waitUntil:'domcontentloaded' });
      await page.waitForSelector('#mz-card');
      assert.equal(await page.locator('#mz-card').getAttribute('data-lv'),'5');
      assert.equal(await page.locator('[data-hcheck]').count(),4);
      assert.equal(await page.locator('[data-hcheck="wins3"]').getAttribute('data-met'),'false');
      assert.ok(Number(await page.locator('.honor-progress [role="progressbar"]').getAttribute('aria-valuenow'))<100);
      await page.evaluate(() => { APP.state().A.LB.forEach(r => { r.pts=0; }); APP.go('memberzone'); });
      assert.equal(await page.locator('#mz-card').getAttribute('data-lv'),'5','Season table cannot reset lifetime rank');
      await page.locator('[data-mtab="guide"]').click();
      assert.match(await page.locator('#mz-body').innerText(),/امتیاز کل از روز اول/);
      assert.match(await page.locator('#mz-body').innerText(),/سطح ۱: ۰ • سطح ۲: ۳ • سطح ۳: ۱۰/);
      // Other profile locations use the same career-based rule.
      await page.evaluate(() => { APP.reloadData(); APP.go('player'); });
      await page.locator('#pl-sel-smart, #pl-sel').selectOption('1');
      assert.ok(await page.locator('.rank-pill[title$="Level 5"]').count()>=1);
      // Profile charts attach on an existing 80ms deferred callback; let the view paint before leaving.
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        const r=Data.loadResults();
        for(let i=0;i<13;i++) r[1000+i]={ participants:[1,2],top:{ 1:1,2:2 } };
        Data.saveResults(r); APP.reloadData(); APP.go('memberzone');
      });
      await page.locator('[data-mtab="home"]').click();
      assert.equal(await page.locator('#mz-card').getAttribute('data-lv'),'15','All four complete unlocks highest qualifying level');
      await page.evaluate(() => {
        for(let lv=7;lv<=15;lv++) AV.saveRank(lv,{ wins1:2 });
        APP.go('memberzone');
      });
      assert.equal(await page.locator('#mz-card').getAttribute('data-lv'),'6','Missing Tier-1 championship blocks all targets requiring it');
      await page.evaluate(() => {
        const r=Data.loadResults();
        for(let i=13;i<15;i++) r[1000+i]={ participants:[1,2],top:{ 1:1,2:2 } };
        Data.saveResults(r); APP.reloadData(); APP.go('memberzone');
      });
      assert.equal(await page.locator('#mz-card').getAttribute('data-lv'),'15');
      assert.deepEqual(errors,[],'No page errors');
      assert.deepEqual(supabase,[],'No live Supabase requests');
      console.log(`PASS ${name}: all 15 defaults, preserved custom points/skins, saved edits/reload, invalid-input guard, lifetime AND enforcement, manual guard, member progress/guide/profile, four responsive widths; no live Supabase.`);
    } finally { await context.close(); await browser.close(); }
  }
})().catch(e => { console.error(e); process.exitCode=1; });
