/* PDF, personal guide, editable equivalence, and five national finishes.
 * All records are synthetic. Block ALL non-local traffic; never run an unguarded live academy.
 * BASE_URL=http://127.0.0.1:8000 NODE_PATH=<playwright_modules> node source/e2e/rank_guide_browser.cjs
 */
const {chromium,webkit,firefox}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const BASE=process.env.BASE_URL || 'http://127.0.0.1:8000';
const OUTPUT=process.env.QA_OUTPUT || '/home/user/.cache/rank-guide-qa/artifacts';fs.mkdirSync(OUTPUT,{recursive:true});
(async()=>{
 for(const [engine,type]of [['chromium',chromium],['webkit',webkit],['firefox',firefox]].filter(([n])=>!process.env.ENGINES || process.env.ENGINES.split(',').includes(n))){
  const browser=await type.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',acceptDownloads:true});
  const errors=[],remote=[],scripts=[];
  try{
   await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin===new URL(BASE).origin){if(u.pathname.includes('/vendor/'))scripts.push(u.pathname);return route.continue();}
    remote.push(u.hostname);return route.abort('blockedbyclient');
   });
   await context.addInitScript(()=>{
    localStorage.setItem('ga_cloud_cfg',JSON.stringify({on:false}));
    if(localStorage.getItem('guide-qa-seeded'))return;localStorage.setItem('guide-qa-seeded','1');
    const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
    localStorage.setItem('ga_seed_v2','1405');localStorage.setItem('ga_cleanup_practice_v1','1');
    localStorage.setItem('ga_session','qaadmin');
    put('ga_users',[{id:1,user:'qaadmin',name:'مدیر آزمایشی',role:'admin',pass:'test-only',main:true,active:true},{id:2,user:'member',name:'عضو آزمایشی',role:'member',pid:1,pass:'test-only',active:true}]);
    put('ga_subscriptions',[{id:'test-sub',user:'member',plan:'professional',status:'active',start_date:'2020-01-01',end_date:'2099-01-01',start_at:'2020-01-01T00:00:00Z',end_at:'2099-01-01T00:00:00Z'}]);
    put('ga_tour_hidden',Array.from({length:12},(_,i)=>i+1));
    put('ga_tournaments',[{name:'آزمایشی سطح دو',lvl:2,course:1,holes:3,holeIds:[1,2,3],date:'2024-01-01'},{name:'آزمایشی کشوری',lvl:1,course:1,holes:3,holeIds:[1,2,3],date:'2024-02-01'}]);
    put('ga_results',{1000:{participants:[1,2],top:{1:1,2:2}},1001:{participants:[1,2,3,4,5,6],top:{1:2,2:3,3:4}}});
    put('ga_scorecards',[]);put('ga_programs',[{name:'سابقه آزمایشی',start:'2020-01-01',type:'کلاس',participants:[1],top:{1:1},p1:10000}]);
    const skin={};for(let lv=1;lv<=15;lv++)skin[lv]={pts:(lv-1)*100};
    // A real uploaded-style PNG badge, not only emoji/SVG defaults.
    const cv=document.createElement('canvas');cv.width=128;cv.height=128;const cg=cv.getContext('2d');
    cg.fillStyle='#41f0a0';cg.fillRect(0,0,128,128);cg.fillStyle='#fff';cg.beginPath();cg.arc(64,66,32,0,Math.PI*2);cg.fill();cg.fillStyle='#164632';cg.fillRect(58,30,8,68);
    skin[15].badge=cv.toDataURL('image/png');put('ga_rank_skin',skin);
    const players={};for(let id=1;id<=8;id++)players[id]={name:'بازیکن آزمایشی '+id};put('ga_players',players);
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack||e.message));
   await page.goto(BASE+'/GolfAcademy_PRO.html#mgmt',{waitUntil:'domcontentloaded'});await page.waitForSelector('#app.on');
   const mgmt=async()=>{await page.evaluate(()=>APP.go('mgmt'));await page.locator('.mgmt-tab[data-tab="honor"]').click();};
   await mgmt();assert.equal(await page.locator('#hr-prereqs input').count(),8);
   const oldSkin=await page.evaluate(()=>localStorage.getItem('ga_rank_skin'));
   await page.locator('#hr-rules-open').click();
   assert.equal(await page.locator('#rr-n1').inputValue(),'10');assert.equal(await page.locator('#rr-tier2').inputValue(),'3');
   for(let i=2;i<=5;i++)assert.equal(await page.locator('#rr-n'+i).inputValue(),'0');
   await page.locator('#rr-n5').fill('2');await page.locator('#rr-note').fill('توضیح تکمیلی آزمایشی برای گزارش');await page.locator('#rr-save').click();
   assert.equal(await page.evaluate(()=>AV.rankRules().nationalTo2[5]),2);
   assert.equal(await page.evaluate(()=>localStorage.getItem('ga_rank_skin')),oldSkin);
   await page.locator('#rr-tier2').fill('-1');await page.locator('#rr-save').click();
   assert.equal(await page.locator('#rr-error').isVisible(),true);assert.equal(await page.evaluate(()=>AV.rankRules().tier2To3),3);
   await page.locator('#rr-tier2').fill('3');await page.locator('#rr-n5').fill('0');await page.locator('#rr-note').fill('');await page.locator('#rr-save').click();
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#app.on');await mgmt();
   assert.equal(await page.evaluate(()=>AV.rankRules().nationalTo2[1]),10);
   // A national fifth place can be recorded explicitly, without new imaginary prize points.
   await page.locator('.mgmt-tab[data-tab="results"]').click();
   await page.locator('[data-mrnational="1001"]').click();
   await page.locator('#np-4').selectOption('5');await page.locator('#np-5').selectOption('1');
   await page.locator('#np-save').click();
   assert.equal(await page.evaluate(()=>Data.loadResults()[1001].top[5]),1);
   assert.equal(await page.evaluate(()=>APP.state().A.CAREER[1].national5),1);
   // Exercise the real scorecard-finalization path (not just direct JSON fixtures).
   await page.evaluate(()=>{
    const first={2:3,3:4,4:5,5:6,1:7,6:8};
    localStorage.setItem('ga_scorecards',JSON.stringify([1,2,3,4,5,6].map(pid=>({tour:1001,pid,strokes:{1:first[pid],2:4,3:3}}))));
    APP.reloadData();
   });
   await page.locator('[data-mrrep="1001"]').click();await page.locator('#tr-finalize').click();
   assert.equal(await page.evaluate(()=>Data.loadResults()[1001].top[4]),5);
   assert.equal(await page.evaluate(()=>Data.loadResults()[1001].top[5]),1);
   await page.evaluate(()=>{const a=JSON.parse(localStorage.getItem('ga_scorecards'));a.find(x=>x.pid===1).strokes[1]=6;localStorage.setItem('ga_scorecards',JSON.stringify(a));});
   await page.locator('#tr-finalize').click();
   assert.equal(await page.evaluate(()=>Data.loadResults()[1001].top[4]),null);
   assert.equal(await page.evaluate(()=>Data.loadResults()[1001].top[5]),null,'An unresolved tie must not create a fifth place');
   await page.evaluate(()=>{const a=JSON.parse(localStorage.getItem('ga_scorecards'));a.find(x=>x.pid===1).strokes[1]=7;localStorage.setItem('ga_scorecards',JSON.stringify(a));});
   await page.locator('#tr-finalize').click();await page.locator('#tr-x').click();
   assert.equal(await page.evaluate(()=>APP.state().A.CAREER[1].national5),1);
   await mgmt();await page.locator('[data-hlv="7"]').click();
   await page.locator('#hr-national5').fill('1');await page.locator('#hr-save').click();
   assert.equal(await page.evaluate(()=>AV.rankOf(7).national5),1);assert.equal(await page.evaluate(()=>AV.rankOf(7).pts),600);
   // Admin catalogue uses the same table as the PDF and supports a properly bounded dialog.
   await page.locator('#hr-guide').click();await page.locator('#modal-rank-guide').waitFor({state:'visible'});
   assert.equal(await page.locator('#modal-rank-guide [data-guide-lv]').count(),15);
   assert.equal(await page.locator('#modal-rank-guide .rg-next-box').count(),0,'Admin export is not a personal report');
   await page.screenshot({path:path.join(OUTPUT,engine+'-catalogue-desktop.png')});
   await page.keyboard.press('Escape');assert.equal(await page.locator('#modal-rank-guide').isVisible(),false);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'hr-guide');
   // Actual browser-generated file, no mock of jsPDF or html2canvas.
   const download=page.waitForEvent('download',{timeout:90000});await page.locator('#hr-pdf').click();
   const pdf=await download;assert.equal(await pdf.failure(),null);await pdf.saveAs(path.join(OUTPUT,engine+'-rank-guide.pdf'));
   await page.waitForFunction(()=>!document.querySelector('#hr-pdf').disabled);
   assert.equal(await page.locator('.rg-print-host').count(),0,'Offscreen PDF DOM cleaned up');
   assert.ok(scripts.some(x=>x.endsWith('html2canvas-1.4.1.min.js')));assert.ok(scripts.some(x=>x.endsWith('jspdf-2.5.1.umd.min.js')));
   assert.ok(fs.statSync(path.join(OUTPUT,engine+'-rank-guide.pdf')).size>50000);
   // Personal popup: reserve the required tier-2 win before calculating tier-3 credit.
   await page.evaluate(()=>localStorage.setItem('ga_session','member'));await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#mz-card');
   assert.equal(await page.locator('#mz-card').getAttribute('data-lv'),'5');
   await page.locator('#mz-body [data-rank-guide]').click();
   assert.equal(await page.locator('[data-next-level]').getAttribute('data-next-level'),'6');
   assert.equal(await page.locator('[data-guide-check="wins2"]').getAttribute('data-met'),'true');
   assert.equal(await page.locator('[data-guide-check="wins3"]').getAttribute('data-met'),'false');
   const alternatives=await page.locator('[data-upgrade-plan]').evaluateAll(els=>els.map(el=>JSON.parse(el.dataset.upgradePlan)));
   assert.ok(alternatives.some(x=>x.wins2===1 && Object.keys(x).length===1));assert.ok(alternatives.some(x=>x.wins3===3 && Object.keys(x).length===1));
   assert.match(await page.locator('.rg-rules').innerText(),/هیچ تعداد برد سطح ۲ یا ۳، مقام کشوری ایجاد نمی‌کند/);
   for(const [w,h]of [[1440,1000],[844,393],[393,852],[320,700]]){
    await page.setViewportSize({width:w,height:h});
    const rect=await page.locator('.rg-dialog').boundingBox();assert.ok(rect.x>=0 && rect.x+rect.width<=w+1);assert.ok(rect.y>=0 && rect.y+rect.height<=h+1);
    const size=await page.locator('.rg-scroll').evaluate(el=>({w:el.clientWidth,sw:el.scrollWidth}));assert.ok(size.sw<=size.w+1,engine+' '+w+' guide horizontal overflow '+JSON.stringify(size));
    if(w===393)await page.screenshot({path:path.join(OUTPUT,engine+'-personal-mobile.png')});
   }
   // Focus cannot leave the modal; closing restores scrolling and focus.
   await page.locator('.rg-close').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'rg-download');
   await page.keyboard.press('Escape');assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
   await page.locator('[data-mtab="guide"]').click();await page.locator('#mz-body [data-rank-guide]').click();assert.equal(await page.locator('[data-guide-lv]').count(),15);
   // Rules and popup summary are recomputed, not cached from a previous opening.
   await page.evaluate(()=>{const r=Data.loadResults();r[1000].top={1:1};const t=JSON.parse(localStorage.getItem('ga_tournaments'));t.push({name:'Second test tier-2',lvl:2,course:1,holes:3,date:'2024-03-01'});localStorage.setItem('ga_tournaments',JSON.stringify(t));r[1002]={participants:[1],top:{1:1}};Data.saveResults(r);APP.reloadData();RANK_GUIDE.refresh();});
   assert.equal(await page.locator('[data-next-level]').getAttribute('data-next-level'),'7');
   await page.keyboard.press('Escape');
   // At maximum rank, no phantom next level is advertised.
   await page.evaluate(()=>{const s=APP.state().A.CAREER[1];s.pts=100000;s.wins1=5;s.national5=5;s.wins2=100;s.wins3=100;APP.go('memberzone');});
   await page.locator('#mz-body [data-rank-guide]').click();assert.equal(await page.locator('[data-next-level]').getAttribute('data-next-level'),'max');
   assert.equal(await page.locator('[data-upgrade-plan]').count(),0);
   await page.keyboard.press('Escape');
   assert.deepEqual(errors,[],'No page exceptions');assert.equal(remote.filter(h=>h.endsWith('.supabase.co')).length,0,'No production Supabase calls');
   console.log('PASS '+engine+': real PDF download, 15 ranks, national places, saved rules, reserved-credit guidance, alternatives, top-rank state, modal/focus, four widths; no live data.');
  }finally{await context.close();await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
