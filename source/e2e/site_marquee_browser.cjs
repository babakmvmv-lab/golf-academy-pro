/* Marquee CMS editor + public hydration against a mocked private transport. Zero live data. */
const{chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{MockPublicCloud,BASE}=require('./site_cloud_mock.cjs');
const OUT='/home/user/.cache/marquee-qa/screens';fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 for(const[name,type]of[['chromium',chromium],['webkit',webkit]].filter(([n])=>!process.env.ENGINES||process.env.ENGINES.split(',').includes(n))){
  const browser=await type.launch({headless:true,...(name==='webkit'?{env:{...process.env,WEBKIT_DISABLE_COMPOSITING_MODE:'1',WEBKIT_DISABLE_DMABUF_RENDERER:'1'}}:{})}),cloud=new MockPublicCloud(),contexts=[],errors=[];
  try{
   const context=async admin=>{const c=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});contexts.push(c);await cloud.attach(c);
    if(admin)await c.addInitScript(()=>{try{localStorage.setItem('puttclub_admin',JSON.stringify({id:900,email:'synthetic-admin@test.invalid',name:'مدیر آزمایشی'}));localStorage.setItem('puttclub_web_auth_v1',JSON.stringify({access_token:'synthetic-jwt',refresh_token:'synthetic-refresh',expires_at:9999999999,user:{app_metadata:{web_admin:true}}}));}catch(e){}});
    c.on('page',p=>p.on('pageerror',e=>errors.push(e.stack||e.message)));return c;};
   // Admin: item-based management inside the existing content tab.
   const ac=await context(true),admin=await ac.newPage();
   await admin.goto(BASE+'/admin/site/',{waitUntil:'domcontentloaded'});
   // WebKit's actionability hit-test skips native checkboxes inside RTL grid labels,
   // while real clicks work; drive the editor with real mouse events like a user.
   const uiClick=async loc=>{const box=await loc.boundingBox();if(!box)throw Error('عنصر برای کلیک پیدا نشد');await admin.mouse.click(box.x+box.width/2,box.y+box.height/2);};
   const uiToggle=async(loc,want)=>{const box=await loc.boundingBox();if(!box)throw Error('کلید برای تغییر پیدا نشد');await admin.mouse.click(box.x+box.width/2,box.y+box.height/2);for(let i=0;i<10&&await loc.isChecked()!==want;i++)await admin.waitForTimeout(120);if(await loc.isChecked()!==want)throw Error('تغییر وضعیت کلید انجام نشد');};
   await admin.getByRole('button',{name:'محتوا و تصاویر',exact:true}).click();
   await admin.waitForSelector('#site-marquee-editor');
   await admin.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';}); // WebKit smooth-scroll keeps hit-tests moving
   await admin.locator('#site-marquee-editor').scrollIntoViewIfNeeded();
   assert.equal(await admin.locator('[data-marquee-item]').count(),6,'seeded items render');
   assert.equal(await admin.locator('[data-marquee-add]').count(),1);
   await uiToggle(admin.locator('[data-mq="visible"]').nth(1),false); // hide «آموزش از مبتدی تا حرفه‌ای»
   await uiClick(admin.locator('[data-mq="down"]').first()); // reorder changes display order
   await uiClick(admin.locator('[data-mq="del"]').last()); // remove one seed row
   assert.equal(await admin.locator('[data-marquee-item]').count(),5);
   await uiClick(admin.locator('[data-marquee-add]'));
   assert.equal(await admin.locator('[data-marquee-item]').count(),6);
   await admin.locator('[data-mq="text"]').nth(5).fill('پیام ابری تست');
   await admin.screenshot({path:path.join(OUT,name+'-editor.png')});
   await uiClick(admin.locator('[data-marquee-save]'));
   await admin.getByText('✓ انتشار در ابر تأیید شد').waitFor();
   const saved=cloud.rows.get('web_setting_marquee').v;
   assert.equal(saved.items.length,6);assert.equal(saved.items.some(x=>x.text==='پیام ابری تست'),true);
   const hiddenItem=saved.items.find(x=>x.text==='آموزش از مبتدی تا حرفه‌ای');
   assert.equal(hiddenItem.visible,false);
   // Draft discipline: clearing a text keeps the change local until a valid save.
   const beforeText=JSON.stringify(cloud.rows.get('web_setting_marquee').v);
   await admin.locator('[data-mq="text"]').first().fill('   ');
   await uiClick(admin.locator('[data-marquee-save]'));
   await admin.getByText(/بین ۱ تا ۱۸۰ نویسه/).waitFor();
   assert.equal(JSON.stringify(cloud.rows.get('web_setting_marquee').v),beforeText,'invalid draft must not publish');
   await admin.locator('[data-mq="text"]').first().fill('متن اول نوار');
   await uiClick(admin.locator('[data-marquee-save]'));
   await admin.getByText('✓ انتشار در ابر تأیید شد').waitFor();
   // Reload: the editor reads the published record, not in-memory state.
   await admin.reload({waitUntil:'domcontentloaded'});await admin.getByRole('button',{name:'محتوا و تصاویر',exact:true}).click();
   await admin.waitForSelector('#site-marquee-editor');await admin.locator('#site-marquee-editor').scrollIntoViewIfNeeded();
   assert.equal(await admin.locator('[data-marquee-item]').count(),6);
   assert.equal(await admin.locator('[data-mq="text"]').first().inputValue(),'متن اول نوار');
   // Public: initial static bar, then hydrated from the same published record.
   const pc=await context(false),visitor=await pc.newPage();visitor.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_BLOCKED_BY_CLIENT.Inspector'))errors.push('console: '+m.text().slice(0,220))});
   await visitor.goto(BASE+'/',{waitUntil:'domcontentloaded'});
   await visitor.locator('.animate-marquee span').first().waitFor();
   await visitor.locator('[data-site-marquee="on"]').waitFor({timeout:20000});
   const published=cloud.rows.get('web_setting_marquee').v;
   const visible=published.items.filter(x=>x.visible);
   await visitor.waitForFunction(ids=>ids.every(id=>document.querySelectorAll('[data-marquee-id="'+id+'"]').length===4),visible.map(x=>x.id),{timeout:20000});
   for(const item of visible)assert.equal(await visitor.locator('[data-marquee-id="'+item.id+'"]').count(),4,'two track halves × two repeats');
   assert.equal(await visitor.locator('[data-marquee-id="'+hiddenItem.id+'"]').count(),0,'hidden item is not rendered');
   assert.equal(await visitor.getByText('پیام ابری تست').count(),4);
   await visitor.screenshot({path:path.join(OUT,name+'-public.png')});
   // Turning the bar off removes it after the next pull; re-enabling restores it.
   const syncVisitor=async()=>{for(let i=0;i<3;i++){try{await visitor.evaluate(()=>PC_SITE_CLOUD.pull(true));return;}catch(e){await visitor.waitForLoadState('domcontentloaded');await visitor.waitForTimeout(700);}}throw Error('همگام‌سازی صفحهٔ عمومی انجام نشد');};
   await admin.locator('#site-marquee-editor').scrollIntoViewIfNeeded();await uiToggle(admin.locator('[data-mq="enabled"]'),false);await uiClick(admin.locator('[data-marquee-save]'));
   await admin.getByText('✓ انتشار در ابر تأیید شد').waitFor();
   await syncVisitor();
   await visitor.waitForFunction(()=>document.querySelector('[data-site-marquee]')?.getAttribute('data-site-marquee')==='off',{timeout:20000});
   await admin.locator('#site-marquee-editor').scrollIntoViewIfNeeded();await uiToggle(admin.locator('[data-mq="enabled"]'),true);await uiClick(admin.locator('[data-marquee-save]'));
   await admin.getByText('✓ انتشار در ابر تأیید شد').waitFor();
   await syncVisitor();
   await visitor.waitForFunction(()=>document.querySelector('[data-site-marquee]')?.getAttribute('data-site-marquee')==='on'&&document.querySelector('[data-marquee-id]'),{timeout:20000});
   for(const[w,h]of[[1440,1000],[393,852],[320,700]]){
    await visitor.setViewportSize({width:w,height:h});
    assert.ok(await visitor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow '+w);
    if(w===393)await visitor.screenshot({path:path.join(OUT,name+'-mobile.png')});
   }
   const css=await visitor.evaluate(()=>document.getElementById('pc-marquee-style')?.textContent||'');
   assert.match(css,/prefers-reduced-motion/);
   assert.deepEqual(errors,[]);
   assert.equal(cloud.blocked.filter(x=>x.endsWith('.supabase.co')).length,0,'no live requests');
   console.log('PASS '+name+': item add/edit/reorder/hide/delete, failed-save draft safety, reload persistence, public hydration with original cadence, off/on and responsive widths; zero live data.');
  }finally{for(const c of contexts)await c.close();await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
