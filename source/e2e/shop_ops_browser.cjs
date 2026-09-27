/* End-to-end golf shop workflow against real PostgreSQL in an isolated disposable schema.
 * UI records, identities and public projections are synthetic; production data is untouched.
 */
const{chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{ShopHarness,BASE}=require('./shop_ops_harness.cjs');
const OUT=process.env.QA_OUTPUT||'/home/user/.cache/golf-shop-qa/screens';fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 for(const[name,type]of[['chromium',chromium],['webkit',webkit]].filter(([n])=>!process.env.ENGINES||process.env.ENGINES.split(',').includes(n))){
  const h=new ShopHarness(),contexts=[],errors=[];let b;
  try{
   await h.setup();b=await type.launch({headless:true,...(name==='webkit'?{env:{...process.env,WEBKIT_DISABLE_COMPOSITING_MODE:'1',WEBKIT_DISABLE_DMABUF_RENDERER:'1'}}:{})});
   const page=async(role)=>{const c=await b.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});contexts.push(c);await h.attach(c,role);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.stack||e.message));await p.goto(BASE+'/admin/',{waitUntil:'domcontentloaded'});await p.waitForSelector('.sh-quick');return p;};
   const owner=await page('owner');owner.on('dialog',d=>d.accept());
   await owner.locator('[data-nav="inventory"]').click();await owner.locator('[data-act="new-product"]').click();
   let form=owner.locator('.sh-modal form').last();await form.locator('[name=name]').fill('درایور گلف آزمایشی');await form.locator('[name=sku]').fill('GOLF-RH-S-105');await form.locator('[name=brand]').fill('Test Golf');await form.locator('[name=model]').fill('Driver');await form.locator('[name=loft]').fill('10.5');await form.locator('[name=flex]').selectOption('Stiff');await form.locator('[name=hand]').selectOption('راست');await form.locator('[name=sale_price]').fill('300');await form.locator('[type=submit]').click();
   await owner.locator('.sh-modal').waitFor({state:'hidden'});await owner.getByText('درایور گلف آزمایشی',{exact:true}).waitFor();
   let products=(await h.call('owner','bootstrap')).products;const product=products[0];assert.equal(product.sale_price,300);assert.equal(product.attributes.flex,'Stiff');assert.equal(product.stock,0);
   await owner.locator('[data-nav=parties]').click();await owner.locator('[data-act=new-party]').click();form=owner.locator('.sh-modal form').last();await form.locator('[name=name]').fill('مشتری آزمایشی');await form.locator('[name=phone]').fill('00000000000');await form.locator('[type=submit]').click();await owner.locator('.sh-modal').waitFor({state:'hidden'});
   await owner.locator('[data-party-tab=supplier]').click();await owner.locator('[data-act=new-party]').click();form=owner.locator('.sh-modal form').last();await form.locator('[name=name]').fill('تأمین‌کننده آزمایشی');await form.locator('[name=type]').selectOption('company');await form.locator('[type=submit]').click();await owner.locator('.sh-modal').waitFor({state:'hidden'});
   const parties=(await h.call('owner','bootstrap')).parties,supplier=parties.find(x=>x.supplier),customer=parties.find(x=>x.customer);
   const buy=await page('buyer');assert.equal(await buy.locator('[data-nav=sales]').count(),0);assert.equal(await buy.locator('[data-nav=team]').count(),0);
   await buy.locator('[data-act=new-purchase]').click();form=buy.locator('.sh-modal form').last();await form.locator('[name=party_id]').selectOption(String(supplier.id));await form.locator('[data-rowfield=product_id]').selectOption(String(product.id));await form.locator('[data-rowfield=qty]').fill('10');await form.locator('[data-rowfield=price]').fill('200');await form.locator('[name=reference]').fill('BUY-TEST-001');await form.locator('details summary').click();await form.locator('[name=freight]').fill('100');
   await form.locator('button[value=post]').click();await buy.locator('[data-act=print-doc]').waitFor();
   let ledger=(await h.call('owner','bootstrap')).products[0];assert.equal(ledger.stock,10);assert.equal(ledger.inventory_value,2100);
   await buy.locator('.sh-close').last().click();
   const seller=await page('seller');assert.equal(await seller.locator('[data-nav=purchases]').count(),0);assert.equal(await seller.locator('[data-nav=team]').count(),0);
   await seller.locator('[data-act=new-sale]').click();form=seller.locator('.sh-modal form').last();await form.locator('[name=party_id]').selectOption(String(customer.id));await form.locator('[data-rowfield=product_id]').selectOption(String(product.id));assert.equal(await form.locator('[data-rowfield=price]').inputValue(),'300');assert.ok(await form.locator('[data-rowfield=price]').getAttribute('readonly')!==null);await form.locator('[data-rowfield=qty]').fill('3');await form.locator('[name=paid]').fill('400');
   await seller.screenshot({path:path.join(OUT,name+'-quick-sale.png')});
   await form.locator('button[value=post]').click();await seller.locator('[data-act=print-doc]').waitFor();
   let sales=await h.call('owner','documents',{section:'sales'});assert.equal(sales.length,1);assert.equal(sales[0].total,900);assert.equal(sales[0].remaining,500);
   const publicRows=await h.sql(`select v from ${h.schema}.catalogue_sink where k='web_product_${product.id}'`);assert.equal(publicRows[0].v.stock,7);assert.equal(publicRows[0].v.price,300);assert.equal(publicRows[0].v.cost,undefined);
   // Read-only/creation-only is enforced server-side, not just by the missing button.
   assert.equal(await seller.locator('[data-act=edit-doc]').count(),0);
   await assert.rejects(h.call('seller','document_save',{...sales[0],date:sales[0].doc_date,kind:'sale',lines:sales[0].lines.map(l=>({product_id:l.product_id,qty:l.qty,price:l.unit_price})),post:true}),/42501/);
   await seller.locator('.sh-close').last().click();await seller.locator('[data-nav=inventory]').click();assert.equal(await seller.getByText('میانگین بها',{exact:true}).count(),0);
   // A failed save leaves the form and client-id intact; retry does not duplicate.
   await seller.locator('[data-nav=sales]').click();await seller.locator('[data-act=new-sale]').click();form=seller.locator('.sh-modal form').last();await form.locator('[name=party_id]').selectOption(String(customer.id));await form.locator('[data-rowfield=product_id]').selectOption(String(product.id));await form.locator('[data-rowfield=qty]').fill('1');h.failed=true;await form.locator('button[value=post]').click();await form.locator('.sh-form-error').filter({hasText:'قطع آزمایشی'}).waitFor();assert.equal(await form.locator('[data-rowfield=qty]').inputValue(),'1');h.failed=false;await form.locator('button[value=post]').click();await seller.locator('[data-act=print-doc]').waitFor();assert.equal((await h.call('owner','documents',{section:'sales'})).length,2);
   await seller.locator('.sh-close').last().click();
   // Manager grants only the requested extra ability through the actual permission matrix.
   await owner.locator('[data-nav=team]').click();await owner.locator('[data-staff="'+h.users.seller+'"]').click();form=owner.locator('.sh-modal form').last();await form.locator('[data-perm="sales.edit"]').check();await form.locator('[type=submit]').click();await owner.locator('.sh-modal').waitFor({state:'hidden'});
   await seller.reload({waitUntil:'domcontentloaded'});await seller.waitForSelector('.sh-quick');await seller.locator('[data-nav=sales]').click();assert.equal(await seller.locator('[data-edit-doc]').count(),0,'Draft-edit permission must not offer posted correction');
   const ctx=await h.call('seller','bootstrap');assert.equal(ctx.user.permissions['sales.edit'],true);assert.notEqual(ctx.user.permissions['posted.correct'],true);
   // Actual financial UI and account detail; inventory reconciles with the general ledger.
   await owner.locator('[data-nav=finance]').click();await owner.locator('[data-fin-tab=reports]').click();await owner.getByRole('heading',{name:'تراز حساب‌ها',exact:true}).waitFor();await owner.locator('[data-ledger="1100"]').click();await owner.locator('.sh-dialog-head h2').filter({hasText:'دفتر حساب'}).waitFor();await owner.locator('.sh-close').last().click();
   const r=await h.call('owner','report',{}),inv=r.accounts.find(x=>x.code==='1100');assert.equal(inv.balance,r.inventory_value);assert.equal(r.accounts.reduce((n,x)=>n+x.debit-x.credit,0),0);
   await owner.screenshot({path:path.join(OUT,name+'-financial-report.png')});
   // Responsive navigation and forms fit even narrow screens.
   for(const[w,hh]of[[1440,1000],[393,852],[320,700]]){
    await owner.setViewportSize({width:w,height:hh});await owner.locator('[data-act=refresh]').count().then(async n=>{if(n)await owner.locator('[data-act=refresh]').click();});
    assert.ok(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Viewport overflow '+w);
    if(w<761){await owner.locator('[data-act=menu]').click();await owner.locator('[data-nav=dashboard]').click();await owner.waitForSelector('.sh-quick');}
    if(w===393)await owner.screenshot({path:path.join(OUT,name+'-mobile-dashboard.png')});
   }
   await owner.setViewportSize({width:1440,height:1050});await owner.locator('[data-nav=dashboard]').click();await owner.waitForSelector('.sh-quick');await owner.screenshot({path:path.join(OUT,name+'-dashboard.png')});
   assert.deepEqual(errors,[],'No new UI exceptions');assert.equal(h.denied.filter(x=>x.endsWith('.supabase.co')).length,0,'Browser never reaches production services');
   console.log('PASS '+name+': supplier/customer/product UI, received purchase, landed cost, fast sale, partial payment, private cost masking, create-only rejection, manager permissions, retained failure/retry, ledger reconciliation and responsive layouts. Isolated SQL only.');
  }finally{for(const c of contexts)await c.close();if(b)await b.close();await h.cleanup();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
