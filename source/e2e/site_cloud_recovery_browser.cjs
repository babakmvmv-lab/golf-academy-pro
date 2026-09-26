const{chromium}=require('playwright'),assert=require('node:assert/strict');
const{MockPublicCloud,BASE}=require('./site_cloud_mock.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true}),cloud=new MockPublicCloud(),contexts=[];
 const make=async()=>{const c=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});contexts.push(c);await cloud.attach(c);await c.addInitScript(()=>{try{localStorage.setItem('puttclub_admin',JSON.stringify({id:900,email:'test@test.invalid'}))}catch(e){}});return c;};
 const errors=[];
 try{
  const c=await make();await c.addInitScript(()=>{try{if(!localStorage.getItem('legacy-test')){localStorage.setItem('legacy-test','1');localStorage.setItem('puttclub_demo_site-settings',JSON.stringify({hero:{line1:'تیتر محلی قدیمی'}}));localStorage.setItem('puttclub_web_auth_v1',JSON.stringify({access_token:'synthetic-jwt',refresh_token:'synthetic-refresh',expires_at:9999999999,user:{app_metadata:{web_admin:true}}}));}}catch(e){}});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.stack||e.message));p.on('dialog',d=>d.accept());
  await p.goto(BASE+'/admin/site/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.PC_SITE_CLOUD?.status().lastRead>0);
  assert.equal(cloud.writes.length,0);await p.locator('[data-pc="legacy"]').waitFor({state:'visible'});await p.locator('[data-pc="legacy"]').click();
  await p.waitForFunction(()=>PC_SITE_CLOUD.settings().hero.line1==='تیتر محلی قدیمی'&&!PC_SITE_CLOUD.status().pending.length);
  assert.equal(cloud.rows.get('web_setting_hero').v.line1,'تیتر محلی قدیمی');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('puttclub_demo_site-settings')).hero.line1),'تیتر محلی قدیمی');
  await p.goto(BASE+'/admin/',{waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'پاپ‌آپ فروشگاه',exact:true}).click();
  await p.waitForSelector('input[type="password"]');await p.locator('input[type="password"]').fill('QaSecret8');
  await p.getByRole('button',{name:/ذخیره/,exact:false}).click();
  await p.waitForFunction(()=>PC_SITE_CLOUD.settings().shopGate.codeHash && !PC_SITE_CLOUD.status().pending.length);
  const firstHash=cloud.rows.get('web_setting_shop_gate').v.codeHash;
  assert.ok(!JSON.stringify([...cloud.rows.values()]).includes('QaSecret8'));
  await p.reload({waitUntil:'domcontentloaded'});await p.getByRole('button',{name:'پاپ‌آپ فروشگاه',exact:true}).click();await p.waitForSelector('input[type="password"]');
  assert.equal(await p.locator('input[type="password"]').inputValue(),'');
  const fields=p.locator('input:not([type="password"]):not([type="checkbox"]):not([type="range"]):not([type="number"])');
  await fields.first().fill('قفل با عنوان تازه');await p.getByRole('button',{name:/ذخیره/,exact:false}).click();
  await p.waitForFunction(()=>PC_SITE_CLOUD.settings().shopGate.title==='قفل با عنوان تازه'&&!PC_SITE_CLOUD.status().pending.length);
  assert.equal(cloud.rows.get('web_setting_shop_gate').v.codeHash,firstHash);assert.equal(cloud.rows.get('web_setting_shop_gate').v.enabled,true);
  // Same-origin second tab must not lose its queued section when another tab ACKs.
  cloud.failStatus=500;
  const tab=await c.newPage();tab.on('pageerror',e=>errors.push(e.message));await tab.goto(BASE+'/admin/site/',{waitUntil:'domcontentloaded'});await tab.waitForFunction(()=>window.PC_SITE_CLOUD?.status().lastRead>0);
  await p.evaluate(async()=>PC_SITE_CLOUD.request('/api/admin/site/settings',{method:'PUT',body:JSON.stringify({key:'hero',value:{line1:'صف تب اول'}})}));
  await tab.evaluate(async()=>PC_SITE_CLOUD.request('/api/admin/site/settings',{method:'PUT',body:JSON.stringify({key:'contact',value:{address:'صف تب دوم'}})}));
  assert.equal(await tab.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('puttclub_cloud_outbox_v1'))).length),2);
  cloud.failStatus=0;await tab.evaluate(()=>PC_SITE_CLOUD.flush());await tab.waitForFunction(()=>!PC_SITE_CLOUD.status().pending.length);
  assert.equal(cloud.rows.get('web_setting_hero').v.line1,'صف تب اول');assert.equal(cloud.rows.get('web_setting_contact').v.address,'صف تب دوم');
  await c.close();contexts.splice(contexts.indexOf(c),1);
  // Missing bootstrap: unchanged public page stays usable; Save does not revert to fake local success.
  const offline=await make();await offline.route('**/site-cloud.*.js',r=>r.abort('blockedbyclient'));
  const o=await offline.newPage();o.on('pageerror',e=>errors.push(e.message));await o.goto(BASE+'/',{waitUntil:'domcontentloaded'});await o.locator('h1').waitFor({state:'visible'});
  assert.equal(await o.evaluate(()=>typeof window.PC_SITE_CLOUD),'undefined');assert.match(await o.locator('h1').innerText(),/پات کلاب/);
  await o.goto(BASE+'/admin/site/',{waitUntil:'domcontentloaded'});await o.getByRole('button',{name:'محتوا و تصاویر',exact:true}).click();await o.waitForSelector('input');
  const box=o.getByRole('heading',{name:'سربرگ صفحه اصلی (هیرو)',exact:true}).locator('..');
  let alert='';o.once('dialog',async d=>{alert=d.message();await d.accept();});const before=cloud.writes.length;
  await box.getByRole('button',{name:/ذخیره/}).click();
  assert.match(alert,/لایهٔ ابری بارگذاری نشد/);assert.equal(cloud.writes.length,before);assert.equal(await box.getByRole('button',{name:/ذخیره شد/}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS Chromium recovery: explicit old-draft publication, preserved legacy copy, actual gate form with blank-code preservation, shared-tab outbox, bootstrap-failure fallback; no live data.');
 }finally{for(const c of contexts)await c.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
