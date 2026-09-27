/* Owner-only operational reset: password re-confirmation, server-side wipe in a disposable QA schema.
 * Usage: BASE_URL=http://127.0.0.1:8000 NODE_PATH=<playwright_modules> node source/e2e/shop_ops_reset_browser.cjs
 */
const{chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{ShopHarness,BASE}=require('./shop_ops_harness.cjs');
const OUT=process.env.QA_OUTPUT||'/home/user/.cache/golf-shop-qa/screens';fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const h=new ShopHarness(),contexts=[],errors=[];let b;
 try{
  await h.setup();
  // Synthetic operational history that the reset must wipe.
  const product=(await h.call('owner','product_save',{name:'چوب تست صفرسازی',sku:'QA-RESET-1',category:'چوب‌ها',sale_price:100,images:['/images/academy-logo.jpg']}));
  const supplier=(await h.call('owner','party_save',{name:'تأمین‌کنندهٔ صفرسازی',supplier:true,type:'store'}));
  const purchase=await h.call('owner','document_save',{client_id:crypto.randomUUID(),kind:'purchase',date:'2026-09-20',party_id:supplier.id,post:true,lines:[{product_id:product.id,qty:5,price:80}]});
  assert.equal((await h.sql(`select count(*) as n from ${h.schema}.documents`))[0].n,1);
  b=await chromium.launch({headless:true});
  const page=async role=>{const c=await b.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});contexts.push(c);await h.attach(c,role);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.stack||e.message));await p.goto(BASE+'/admin/',{waitUntil:'domcontentloaded'});await p.waitForSelector('.sh-quick');return p;};
  // Non-owner staff cannot even reach the reset tool.
  const seller=await page('seller');
  assert.equal(await seller.locator('[data-nav=settings]').count(),0,'settings is manager-only');
  assert.equal(await seller.locator('[data-act="ops-reset"]').count(),0);
  // Owner sees the go-live section and its single destructive item.
  const owner=await page('owner');
  await owner.locator('[data-nav=settings]').click();
  await owner.getByText('شروع واقعی فروشگاه').waitFor();
  assert.equal(await owner.locator('[data-act="ops-reset"]').count(),1);
  await owner.locator('[data-act="ops-reset"]').click();
  await owner.getByText('صفرسازی عملیاتی — شروع واقعی').waitFor();
  assert.ok(await owner.getByText('همهٔ فاکتورهای خرید، فروش، برگشتی').count()>=1,'scope list is shown before confirmation');
  // Wrong owner password: nothing is wiped and no reset action reaches the server.
  await owner.locator('[name=reset_password]').fill('Wrong-Password-999');
  await owner.locator('.sh-modal [type=submit]').click();
  await owner.getByText('ورود ابری انجام نشد؛ ایمیل و رمز مدیر سایت را بررسی کنید.').waitFor();
  assert.equal(h.requests.filter(x=>x.action==='ops_reset').length,0);
  assert.equal((await h.sql(`select count(*) as n from ${h.schema}.documents`))[0].n,1,'wrong password must not wipe');
  await owner.screenshot({path:path.join(OUT,'chromium-reset-dialog.png')});
  // Correct password: server-confirmed one-shot zeroing with a fresh sign-in.
  await owner.locator('[name=reset_password]').fill('QA-Owner-Password-123!');
  await owner.locator('.sh-modal [type=submit]').click();
  await owner.getByText('صفرسازی تأیید شد').waitFor();
  assert.deepEqual(h.requests.filter(x=>x.action==='ops_reset').map(x=>x.role),['owner']);
  assert.ok(h.authCalls.some(x=>String(x.email).includes('qa-owner@')),'fresh password sign-in was required');
  const counts=async q=>(await h.sql(`select count(*) as n from ${h.schema}.${q}`))[0].n;
  assert.equal(await counts('documents'),0);assert.equal(await counts('lines'),0);assert.equal(await counts('stock_moves'),0);
  assert.equal(await counts('payments'),0);assert.equal(await counts('journals'),0);assert.equal(await counts('journal_lines'),0);
  assert.equal(await counts('parties'),0);assert.equal(await counts('inventory'),0);assert.equal(await counts('counters'),0);
  // Corrected scope (user decision): the reset wipes the whole shop ledger INCLUDING products,
  // customers, suppliers, purchases, sales, orders and reservations; real registration starts after it.
  assert.equal(await counts('products'),0,'products are wiped too');
  assert.equal(await counts('orders'),0);assert.equal(await counts('reservations'),0);
  assert.equal((await h.sql(`select count(*) as n from ${h.schema}.audit where action='reset'`))[0].n,1,'reset is audited');
  assert.equal((await h.sql(`select count(*) as n from ${h.schema}.catalogue_sink where k='web_product_${product.id}'`))[0].n,0,'public product row removed, not just zeroed');
  // Numbering and catalogue restart cleanly for the real go-live.
  const product2=(await h.call('owner','product_save',{name:'چوب واقعی پس از صفرسازی',sku:'REAL-1',category:'چوب‌ها',sale_price:120,images:['/images/academy-logo.jpg']}));
  assert.equal(product2.id,1000000,'product ids restart at 1000000 after reset');
  await h.call('owner','opening_zero',{product_id:product2.id});
  const supplier2=(await h.call('owner','party_save',{name:'تأمین‌کنندهٔ پس از صفرسازی',supplier:true}));
  const again=await h.call('owner','document_save',{client_id:crypto.randomUUID(),kind:'purchase',date:'2026-09-22',party_id:supplier2.id,post:true,lines:[{product_id:product2.id,qty:2,price:50}]});
  assert.equal(again.number,'P-2026-00001','document numbering restarts after reset');
  console.log('PASS ops reset (chromium): owner-only UI, password re-confirmation, full shop wipe including catalog, audit, public rows removed, id and numbering restart');
 }catch(e){console.error('FAIL ops reset:',e.message);fs.writeFileSync(path.join(OUT,'chromium-reset-fail.txt'),e.stack||String(e));process.exitCode=1;}
 finally{for(const c of contexts)await c.close();if(b)await b.close();await h.cleanup().catch(()=>{});}
 if(errors.length){console.error('PAGE ERRORS:',errors);process.exitCode=1;}
})();
