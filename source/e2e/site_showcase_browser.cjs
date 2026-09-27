/* Storefront homepage layout editor (showcase) + public hydration against a mocked cloud. Zero live data.
 * Usage: BASE_URL=http://127.0.0.1:8000 NODE_PATH=<playwright_modules> node source/e2e/site_showcase_browser.cjs
 */
const{chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{MockPublicCloud,BASE}=require('./site_cloud_mock.cjs');
const OUT=process.env.QA_OUTPUT||'/home/user/.cache/site-cloud-qa/artifacts';fs.mkdirSync(OUT,{recursive:true});
const NAMES={1:'درایور حرفه‌ای Pro V1',2:'ست آیرون Master Series (۶ عدد)',4:'کیف چرخ‌دار Pro Tour',6:'کفش گلف Tour Pro',10:'رنج‌فایندر لیزری LR-8'};
(async()=>{
 for(const[name,type]of[['chromium',chromium],['webkit',webkit]].filter(([n])=>!process.env.ENGINES||process.env.ENGINES.split(',').includes(n))){
  const browser=await type.launch({headless:true,...(name==='webkit'?{env:{...process.env,WEBKIT_DISABLE_COMPOSITING_MODE:'1',WEBKIT_DISABLE_DMABUF_RENDERER:'1'}}:{})}),cloud=new MockPublicCloud(),contexts=[],errors=[];
  try{
   const context=async admin=>{const c=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});contexts.push(c);await cloud.attach(c);
    if(admin)await c.addInitScript(()=>{try{localStorage.setItem('puttclub_admin',JSON.stringify({id:900,email:'synthetic-admin@test.invalid',name:'مدیر آزمایشی'}));localStorage.setItem('puttclub_web_auth_v1',JSON.stringify({access_token:'synthetic-jwt',refresh_token:'synthetic-refresh',expires_at:9999999999,user:{app_metadata:{web_admin:true}}}));}catch(e){}});
    c.on('page',p=>p.on('pageerror',e=>errors.push(e.stack||e.message)));return c;};
      // Admin: the layout editor renders the exact homepage composition in default order (createdAt desc).
   const ac=await context(true),page=await ac.newPage();
   await page.goto(BASE+'/admin/site/',{waitUntil:'domcontentloaded'});
   await page.getByRole('button',{name:'محتوا و تصاویر',exact:true}).click();
   await page.waitForSelector('#site-showcase-editor');
   await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';});
   await page.waitForFunction(()=>document.querySelectorAll('#site-showcase-editor .pc-sc-card').length===5);
   // WebKit-safe placement: row 1 of the grid firmly inside the viewport before any real-mouse interaction.
   await page.evaluate(()=>{const g=document.querySelector('#site-showcase-editor .pc-sc-grid');if(g){const r=g.getBoundingClientRect();window.scrollBy(0,r.top-160);}});
   await page.waitForTimeout(350);
   assert.deepEqual(await page.locator('#site-showcase-editor .pc-sc-card').evaluateAll(xs=>xs.map(x=>x.dataset.sc)),['10','6','4','2','1'],'default order = featured by createdAt desc');
   assert.equal(await page.locator('#site-showcase-editor .pc-sc-card[data-home="1"]').count(),4,'four homepage slots are highlighted');
   assert.equal(await page.locator('#site-showcase-editor details.pc-sc-tray .pc-sc-chip').count(),5,'non-featured products are listed in the tray');
   // Hide product 10 from the homepage with the eye toggle.
   const card10=page.locator('#site-showcase-editor .pc-sc-card[data-sc="10"]');
   const eyeBox=await card10.locator('[data-sc-act="eye"]').boundingBox();
   await page.mouse.click(eyeBox.x+eyeBox.width/2,eyeBox.y+eyeBox.height/2);
   await card10.locator('.pc-sc-hidden-tag').waitFor();
   // Reorder with arrows: raise product 2 (index 3) twice → index 1.
   await page.locator('#site-showcase-editor .pc-sc-card[data-sc="2"] [data-sc-act="up"]').click();
   await page.locator('#site-showcase-editor .pc-sc-card[data-sc="2"] [data-sc-act="up"]').click();
   // Drag product 6 (grip) onto the first slot. Real pointer events need both cards inside the viewport.
   const grip=page.locator('#site-showcase-editor .pc-sc-card[data-sc="6"] [data-sc-grip]');
   const gb=await grip.boundingBox();
   if(gb.y<0||gb.y>900)throw Error('گریپ خارج از دید است: '+JSON.stringify(gb));
   const target=await page.locator('#site-showcase-editor .pc-sc-card').first().boundingBox();
   if(target.y<0||target.y>900)throw Error('کارت هدف خارج از دید است: '+JSON.stringify(target));
   await page.mouse.move(gb.x+gb.width/2,gb.y+gb.height/2);
   await page.mouse.down();
   await page.waitForTimeout(180); // long-press activation on the grip
   await page.mouse.move(target.x+target.width*0.75,target.y+target.height/2,{steps:12});
   await page.waitForTimeout(60);
   await page.mouse.up();
   const order=await page.locator('#site-showcase-editor .pc-sc-card').evaluateAll(xs=>xs.map(x=>x.dataset.sc));
   assert.equal(order.indexOf('6'),0,'drag via grip moves the card to the first slot');
   await page.screenshot({path:path.join(OUT,name+'-showcase-editor.png')});
   await page.locator('[data-sc-save]').click();
   await page.getByText('✓ چیدمان روی سایت انتشار یافت').waitFor();
   const saved=cloud.rows.get('web_setting_showcase').v;
   assert.equal(saved.items.length,5);
   assert.equal(saved.items.find(x=>x.id===10).hidden,true);
   assert.equal(saved.items[0].id,6,'published order starts with the dragged card');
   assert.equal(saved.items.every(x=>typeof x.id==='number'&&typeof x.hidden==='boolean'),true);
   // Draft discipline: an eye toggle stays local until a confirmed save.
   const before=JSON.stringify(cloud.rows.get('web_setting_showcase').v);
   const eye2=await page.locator('#site-showcase-editor .pc-sc-card').first().locator('[data-sc-act="eye"]').boundingBox();
   await page.mouse.click(eye2.x+eye2.width/2,eye2.y+eye2.height/2);
   await page.waitForTimeout(150);
   assert.equal(JSON.stringify(cloud.rows.get('web_setting_showcase').v),before,'unpublished toggle must not reach the cloud');
   // Public: a fresh visitor sees exactly the published composition on the homepage.
   const vc=await context(),visitor=await vc.newPage();
   await visitor.goto(BASE+'/',{waitUntil:'domcontentloaded'});
   await visitor.waitForFunction(()=>window.PC_SITE_CLOUD && PC_SITE_CLOUD.status().lastRead>0);
   await visitor.waitForFunction(()=>{const cards=[...document.querySelectorAll('article.group h3')];return cards.length>=4 && cards.every(c=>c.textContent.trim().length>2);});
   const homeNames=await visitor.locator('article.group h3').evaluateAll(xs=>xs.map(x=>x.textContent.trim()));
   const expect=[...order].filter(id=>id!=='10').slice(0,4).map(id=>NAMES[id]);
   assert.deepEqual(homeNames,expect,'homepage shows the published order and skips hidden items');
   assert.equal(homeNames.includes(NAMES[10]),false,'hidden product is absent from the homepage');
   console.log('PASS showcase editor ('+name+'): render, eye-hide, arrow+drag reorder, publish, public hydration');
  }catch(e){console.error('FAIL showcase ('+name+'):',e.message);fs.writeFileSync(path.join(OUT,name+'-showcase-fail.txt'),e.stack||String(e));process.exitCode=1;}
  finally{for(const c of contexts)await c.close();await browser.close();}
  if(errors.length){console.error('PAGE ERRORS ('+name+'):',errors);process.exitCode=1;}
 }
})();
