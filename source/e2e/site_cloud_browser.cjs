/* Actual imported storefront UI + two isolated browser devices + mocked shared cloud.
 * QA server MUST remap the generated bootstrap's cloud URL to /__qa_cloud.
 * Non-local traffic is blocked; zero live database writes.
 */
const{chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{MockPublicCloud,BASE}=require('./site_cloud_mock.cjs');
const OUT=process.env.QA_OUTPUT||'/home/user/.cache/site-cloud-qa/artifacts';fs.mkdirSync(OUT,{recursive:true});
async function ready(page){await page.waitForFunction(()=>window.PC_SITE_CLOUD && PC_SITE_CLOUD.status().lastRead>0);}
async function call(page,url,method='GET',body){return page.evaluate(async({url,method,body})=>{const r=await PC_SITE_CLOUD.request(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{ok:r.ok,status:r.status,data:await r.json()}},{url,method,body});}
function inputFor(page,label,tag='input'){return page.getByText(label,{exact:true}).locator('..').locator(tag);}
(async()=>{
 for(const[name,type]of [['chromium',chromium],['webkit',webkit]].filter(([n])=>!process.env.ENGINES||process.env.ENGINES.split(',').includes(n))){
  const browser=await type.launch({headless:true,...(name==='webkit'?{env:{...process.env,WEBKIT_DISABLE_COMPOSITING_MODE:'1',WEBKIT_DISABLE_DMABUF_RENDERER:'1'}}:{})}),cloud=new MockPublicCloud(),contexts=[],errors=[];
  const context=async(admin=false)=>{const c=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});contexts.push(c);await cloud.attach(c);if(admin)await c.addInitScript(()=>{try{localStorage.setItem('puttclub_admin',JSON.stringify({id:900,email:'synthetic-admin@test.invalid',name:'مدیر آزمایشی'}));localStorage.setItem('puttclub_web_auth_v1',JSON.stringify({access_token:'synthetic-jwt',refresh_token:'synthetic-refresh',expires_at:9999999999,user:{app_metadata:{web_admin:true}}}));}catch(e){} });c.on('page',p=>{p.on('pageerror',e=>errors.push({url:p.url(),stack:e.stack||e.message}));p.on('crash',()=>console.error('RENDERER_CRASH',name,p.url()));});return c;};
  try{
   const ac=await context(true),vc=await context(),admin=await ac.newPage(),visitor=await vc.newPage();
   await visitor.goto(BASE+'/',{waitUntil:'domcontentloaded'});await ready(visitor);
   assert.equal(cloud.writes.length,0,'No visitor seed upload');assert.equal(await visitor.locator('#enter-members').count(),1);
   await admin.goto(BASE+'/admin/site/',{waitUntil:'domcontentloaded'});await ready(admin);
   await admin.getByRole('button',{name:'محتوا و تصاویر',exact:true}).click();await admin.waitForSelector('input');
   const heroBox=()=>admin.getByRole('heading',{name:'سربرگ صفحه اصلی (هیرو)',exact:true}).locator('..');
   await inputFor(admin,'خط اول تیتر').fill('عنوان منتشرشدهٔ آزمایشی');
   await heroBox().getByRole('button',{name:/ذخیره/}).click();
   await admin.waitForFunction(()=>PC_SITE_CLOUD.settings().hero.line1==='عنوان منتشرشدهٔ آزمایشی' && !PC_SITE_CLOUD.status().pending.length);
   assert.equal(cloud.rows.get('web_setting_hero').v.line1,'عنوان منتشرشدهٔ آزمایشی');
   await visitor.evaluate(()=>PC_SITE_CLOUD.pull(true));
   await visitor.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('عنوان منتشرشدهٔ آزمایشی'));
   // A fully fresh browser receives the same change without admin or demo localStorage.
   const fresh=await context(),freshPage=await fresh.newPage();await freshPage.goto(BASE+'/',{waitUntil:'domcontentloaded'});await ready(freshPage);
   await freshPage.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('عنوان منتشرشدهٔ آزمایشی'));
   await fresh.close();contexts.splice(contexts.indexOf(fresh),1); // release a heavy static storefront renderer after the fresh-device proof
   // Reject a subsequent save: no green success, no public change, exact draft survives reload.
   cloud.failStatus=500;await inputFor(admin,'خط اول تیتر').fill('تغییر در انتظار شبکه');
   await heroBox().getByRole('button',{name:/ذخیره/}).click();
   await admin.waitForFunction(()=>PC_SITE_CLOUD.status().pending.length===1 && PC_SITE_CLOUD.status().error);
   assert.equal(await heroBox().getByRole('button',{name:/ذخیره شد/}).count(),0,'Old success must be cleared for a failed new save');
   assert.equal(cloud.rows.get('web_setting_hero').v.line1,'عنوان منتشرشدهٔ آزمایشی');
   await admin.reload({waitUntil:'domcontentloaded'});await ready(admin);await admin.getByRole('button',{name:'محتوا و تصاویر',exact:true}).click();await admin.waitForSelector('input');
   assert.equal(await inputFor(admin,'خط اول تیتر').inputValue(),'تغییر در انتظار شبکه');
   await admin.locator('#pc-site-cloud').screenshot({path:path.join(OUT,name+'-retained-error.png')});
   cloud.failStatus=0;await admin.locator('[data-pc="retry"]').click();await admin.waitForFunction(()=>!PC_SITE_CLOUD.status().pending.length);
   await visitor.evaluate(()=>PC_SITE_CLOUD.pull(true));await visitor.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('تغییر در انتظار شبکه'));
   // Other saved sections must change real render paths, not only admin's form state.
   const settings=(await call(admin,'/api/admin/site/settings')).data.settings;
   assert.equal((await call(admin,'/api/admin/site/settings','PUT',{key:'contact',value:{...settings.contact,address:'نشانی مشترک ابری',phoneFa:'۰۲۱۱۲۳۴۵۶۷۸'}})).ok,true);
   assert.equal((await call(admin,'/api/admin/site/settings','PUT',{key:'brand',value:{...settings.brand,enName:'Cloud Golf',faName:'آکادمی آزمایشی ابری',logo:'/images/products/balls.jpg'}})).ok,true);
   assert.equal((await call(admin,'/api/admin/site/settings','PUT',{key:'theme',value:{...settings.theme,gold500:'#c8a84b'}})).ok,true);
   assert.equal((await call(admin,'/api/admin/site/settings','PUT',{key:'menu',value:settings.menu.map((x,i)=>i===0?{...x,label:'خانهٔ ابری'}:x)})).ok,true);
   await visitor.evaluate(()=>PC_SITE_CLOUD.pull(true));
   await visitor.waitForFunction(()=>document.querySelector('footer')?.textContent.includes('نشانی مشترک ابری'));
   assert.match(await visitor.locator('header').innerText(),/Cloud Golf/);
   assert.equal(await visitor.locator('header img').first().getAttribute('src'),'/images/products/balls.jpg');
   assert.equal(await visitor.evaluate(()=>document.documentElement.style.getPropertyValue('--color-gold-500')),'#c8a84b');
   assert.match(await visitor.locator('header').innerText(),/خانهٔ ابری/);
   assert.equal(await visitor.locator('#enter-members').count(),1);
   // Existing product, new product, catalogue and detail read one source.
   await admin.goto(BASE+'/admin/',{waitUntil:'domcontentloaded'});await ready(admin);
   const old=(await call(admin,'/api/admin/products')).data.products[0];
   assert.equal((await call(admin,'/api/admin/products/'+old.id,'PUT',{...old,name:'درایور با نام ابری',price:77700000})).ok,true);
   const created=await call(admin,'/api/admin/products','POST',{...old,name:'محصول ابری جدید',slug:'qa-new-product',price:85000000,stock:4,isFeatured:true});assert.equal(created.ok,true);
   await visitor.evaluate(()=>PC_SITE_CLOUD.pull(true));
   await visitor.goto(BASE+'/shop/',{waitUntil:'domcontentloaded'});await ready(visitor);
   await visitor.getByRole('heading',{name:'فروشگاه به‌زودی باز می‌شود',exact:true}).waitFor({state:'visible'});
   await visitor.keyboard.type('B');
   await visitor.getByRole('heading',{name:'فروشگاه به‌زودی باز می‌شود',exact:true}).waitFor({state:'hidden'});
   await visitor.getByText('محصول ابری جدید',{exact:true}).waitFor();
   await visitor.getByText('محصول ابری جدید',{exact:true}).click();
   await visitor.waitForFunction(()=>document.querySelector('h1')?.textContent==='محصول ابری جدید');
   assert.ok(visitor.url().includes('item=qa-new-product'));
   assert.match(await visitor.locator('main nav').innerText(),/محصول ابری جدید/);
   // No seed course can reappear when every course has been hidden.
   await admin.goto(BASE+'/admin/site/',{waitUntil:'domcontentloaded'});await ready(admin);
   const courses=(await call(admin,'/api/admin/site/courses')).data.courses;
   for(const c of courses)assert.equal((await call(admin,'/api/admin/site/courses/'+c.id,'PUT',{isActive:false})).ok,true);
   await visitor.goto(BASE+'/',{waitUntil:'domcontentloaded'});await ready(visitor);
   await visitor.getByText('آموزش مقدماتی',{exact:true}).waitFor({state:'hidden'});
   assert.equal(await visitor.getByText('آموزش مقدماتی',{exact:true}).count(),0,'Empty live courses must not revive default cards');
   // Gate settings and secret synchronize without publishing the plaintext shortcut.
   await admin.goto(BASE+'/admin/',{waitUntil:'domcontentloaded'});await ready(admin);
   const gate=(await call(admin,'/api/admin/site/settings')).data.settings.shopGate;
   assert.equal((await call(admin,'/api/admin/site/settings','PUT',{key:'shopGate',value:{...gate,enabled:true,title:'قفل ابری آزمایشی',code:'QA7'}})).ok,true);
   assert.ok(!JSON.stringify([...cloud.rows.values()]).includes('"code":"QA7"'));
   await visitor.goto(BASE+'/shop/',{waitUntil:'domcontentloaded'});await ready(visitor);
   await visitor.getByRole('heading',{name:'قفل ابری آزمایشی',exact:true}).waitFor({state:'visible'});
   await visitor.keyboard.type('wrong');assert.equal(await visitor.getByRole('heading',{name:'قفل ابری آزمایشی',exact:true}).isVisible(),true);
   await visitor.keyboard.type('QA7');await visitor.getByRole('heading',{name:'قفل ابری آزمایشی',exact:true}).waitFor({state:'hidden'});
   for(const[w,h]of [[1440,1000],[393,852],[320,700]]){
    await visitor.evaluate(()=>sessionStorage.removeItem('puttclub_shop_unlocked'));
    await visitor.setViewportSize({width:w,height:h});await visitor.goto(BASE+'/shop/',{waitUntil:'domcontentloaded'});await ready(visitor);
    await visitor.getByRole('heading',{name:'قفل ابری آزمایشی',exact:true}).waitFor({state:'visible'});
    assert.ok(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Public viewport must not gain horizontal overflow');
    if(w===393)await visitor.screenshot({path:path.join(OUT,name+'-cloud-gate-mobile.png')});
   }
   await admin.setViewportSize({width:393,height:852});await admin.goto(BASE+'/admin/site/',{waitUntil:'domcontentloaded'});await ready(admin);
   assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Admin status must fit mobile width');
   await admin.screenshot({path:path.join(OUT,name+'-admin-cloud-mobile.png')});
   // The unmodified f4762c9 export reproduces these WebKit cancellations when a
   // hard navigation/resize cancels Next's static RSC prefetch (verified on baseline).
   // Do not hide any bridge/API/runtime error or any different browser exception.
   const baselineWarnings=errors.filter(e=>name==='webkit' && /due to access control checks/.test(e.stack) && e.stack.includes('/_next/static/chunks/0q~i5quwxch_y.js') && !e.stack.includes('/__qa_cloud'));
   assert.deepEqual(errors.filter(e=>!baselineWarnings.includes(e)),[],'No new browser exceptions');
   if(baselineWarnings.length)console.log('NOTE '+name+': '+baselineWarnings.length+' reproduced baseline static-prefetch cancellation warnings.');
   assert.equal(cloud.blocked.filter(h=>h.endsWith('.supabase.co')).length,0,'No live Supabase calls');
   assert.ok(cloud.writes.every(p=>p.rows.every(r=>r.k.startsWith('web_'))),'No academy namespace writes');
   console.log('PASS '+name+': actual Save UI, fresh second device, retained failed save/reload/retry, header/contact/theme/menu, live catalogue and new product route, no course resurrection, synchronized gate on desktop/mobile; zero live data.');
  }finally{for(const c of contexts)await c.close();await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
