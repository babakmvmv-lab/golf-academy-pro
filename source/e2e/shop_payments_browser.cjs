/* Browser e2e for the payments/orders/shipping features: gateway + card management UI,
 * sale-invoice shipping options, quick inline product registration inside purchases and
 * the online-orders screen. Runs against real PostgreSQL in an isolated disposable schema.
 */
const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const{ShopHarness,BASE}=require('./shop_ops_harness.cjs');
const OUT=process.env.QA_OUTPUT||'/home/user/.cache/golf-shop-qa/screens';fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const h=new ShopHarness(),contexts=[],errors=[];let b;
 try{
  await h.setup();b=await chromium.launch({headless:true});
  const page=async role=>{const c=await b.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});contexts.push(c);await h.attach(c,role);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.stack||e.message));await p.goto(BASE+'/admin/',{waitUntil:'domcontentloaded'});await p.waitForSelector('.sh-quick');return p;};
  const owner=await page('owner');owner.on('dialog',d=>d.accept());

  await h.call('owner','party_save',{name:'مشتری آزمایشی',customer:true,phone:'00000000000'});
  await h.call('owner','party_save',{name:'تأمین‌کننده آزمایشی',supplier:true,type:'company'});

  // ---------- 1) Gateway configuration UI ----------
  await owner.locator('[data-nav=settings]').click();
  await owner.locator('[data-gateways]').waitFor();
  assert.ok(await owner.getByText('https://puttclub.ir/checkout/?pay-return=1').count()>=1,'callback URL must be visible for the bank');
  await owner.locator('[data-act=add-gateway]').click();
  let form=owner.locator('.sh-modal form').last();
  await form.locator('[name=title]').fill('پرداخت با زرین‌پال');
  await form.locator('[name=kind]').selectOption('zarinpal');
  await form.locator('[name=bankKey]').selectOption('zarinpal');
  await form.locator('[name=merchant_id]').fill('11111111-2222-3333-4444-555555555555');
  await form.locator('[type=submit]').click();
  await owner.locator('.sh-modal').waitFor({state:'hidden'});
  await owner.getByText('پرداخت با زرین‌پال',{exact:true}).waitFor();
  let gw=await h.sql(`select credentials from ${h.schema}.payment_gateways where kind='zarinpal'`);
  assert.equal(gw[0].credentials.merchant_id,'11111111-2222-3333-4444-555555555555','gateway secret stored privately');
  let pub=await h.sql(`select v from ${h.schema}.catalogue_sink where k='web_setting_payment_gateways'`);
  const methods=pub[0].v.methods;
  assert.equal(methods.length,1);assert.ok(methods[0].slug.startsWith('gw-'),'stable slug assigned');assert.equal(methods[0].logo,'/images/pay/zarinpal.png');
  assert.ok(!JSON.stringify(pub[0].v).includes('merchant_id'),'public projection must never leak credentials');

  // ---------- 2) Editing a gateway keeps stored credentials when boxes stay empty ----------
  await owner.reload();await owner.waitForSelector('.sh-quick');
  await owner.locator('[data-nav=settings]').click();await owner.locator('[data-gateways]').waitFor();
  await owner.locator('[data-gw-edit]').click();
  form=owner.locator('.sh-modal form').last();
  await form.locator('[name=title]').fill('زرین‌پال فروشگاه');
  assert.equal(await form.locator('[name=merchant_id]').inputValue(),'','secret is not prefilled');
  await form.locator('[type=submit]').click();
  await owner.locator('.sh-modal').waitFor({state:'hidden'});
  await owner.getByText('زرین‌پال فروشگاه',{exact:true}).waitFor();
  gw=await h.sql(`select credentials from ${h.schema}.payment_gateways where kind='zarinpal'`);
  assert.equal(gw[0].credentials.merchant_id,'11111111-2222-3333-4444-555555555555','empty re-save must preserve credentials');

  // ---------- 3) Deposit cards management ----------
  await owner.locator('[data-act=add-card]').click();
  form=owner.locator('.sh-modal form').last();
  await form.locator('[name=bankKey]').selectOption('melli');
  await form.locator('[name=title]').fill('کارت فروشگاه');
  await form.locator('[name=holder]').fill('پات کلاب');
  await form.locator('[name=card_number]').fill('6037991122334444');
  await form.locator('[name=iban]').fill('IR012345678901234567890123');
  await form.locator('[type=submit]').click();
  await owner.locator('.sh-modal').waitFor({state:'hidden'});
  await owner.getByText('6037991122334444').waitFor();
  const cards=await h.sql(`select v from ${h.schema}.catalogue_sink where k='web_setting_pay_cards'`);
  const cl=cards[0].v.cards;
  assert.equal(cl.length,1);assert.equal(cl[0].card_number,'6037991122334444');assert.equal(cl[0].bank,'بانک ملی ایران');

  // ---------- 4) Quick inline product registration inside a purchase ----------
  const buyer=await page('buyer');
  assert.equal(await buyer.locator('[data-nav=orders]').count(),0,'purchasing staff must not see online orders');
  await buyer.locator('[data-act=new-purchase]').click();
  await buyer.locator('[data-new-product-inline]').waitFor();
  await buyer.locator('[data-new-product-inline]').click();
  let pform=buyer.locator('.sh-modal form').last();
  await pform.locator('[name=name]').fill('توپ تمرینی ثبت سریع');
  await pform.locator('[name=sale_price]').fill('90');
  await pform.locator('[type=submit]').click();
  await buyer.getByText('کالای جدید ثبت و به ردیف اضافه شد').waitFor();
  const quick=(await h.call('buyer','bootstrap')).products.find(p=>p.name==='توپ تمرینی ثبت سریع');
  assert.ok(quick,'quick product saved');
  form=buyer.locator('.sh-modal form').last();
  await form.locator('[name=party_id]').selectOption({label:'تأمین‌کننده آزمایشی'});
  await form.locator('[data-rowfield=product_id]').selectOption(String(quick.id));
  await form.locator('[data-rowfield=qty]').fill('2');
  await form.locator('[data-rowfield=price]').fill('40');
  await form.locator('button[value=post]').click();
  await buyer.locator('[data-act=print-doc]').waitFor();
  await buyer.locator('.sh-close').last().click();
  assert.equal((await h.call('buyer','bootstrap')).products.find(p=>p.id===quick.id).stock,2,'purchase lands stock');

  // ---------- 5) Sale invoice shipping options ----------
  await owner.locator('[data-nav=sales]').click();
  await owner.locator('[data-act=new-sale]').click();
  form=owner.locator('.sh-modal form').last();
  await form.locator('[name=party_id]').selectOption({label:'مشتری آزمایشی'});
  await form.locator('details summary').click();
  assert.ok(await form.locator('[name=ship_free]').isChecked(),'free shipping is the safe default');
  await form.locator('[name=ship_free]').uncheck();
  await form.locator('[name=ship_method]').selectOption('tipax');
  await form.locator('[name=freight]').fill('50');
  await form.locator('[data-rowfield=product_id]').selectOption(String(quick.id));
  await form.locator('[data-rowfield=qty]').fill('1');
  await owner.screenshot({path:path.join(OUT,'payments-sale-shipping.png')});
  await form.locator('button[value=post]').click();
  await owner.locator('[data-act=print-doc]').waitFor();
  const sale=(await h.call('owner','documents',{section:'sales'}))[0];
  assert.equal(sale.total,140,'subtotal 90 + freight 50');
  assert.ok(sale.note.includes('تیپاکس'),'shipping method recorded in the note');
  await owner.locator('.sh-close').last().click();

  // ---------- 6) Online orders screen ----------
  const clientId=crypto.randomUUID();
  const quote=x=>"'"+String(x).replace(/'/g,"''")+"'";
  await h.sql(`select ${h.schema}.order_create('qa-session-0001',${quote(JSON.stringify({client_id:clientId,payment:{method:'card2card'},customer:{name:'مشتری سایت',phone:'09120000000',city:'تهران'},items:[{product_id:quick.id,qty:1}]}))}::jsonb) as result`);
  await owner.locator('[data-nav=orders]').click();
  await owner.getByText('مشتری سایت').waitFor();
  await owner.locator('[data-order]').first().click();
  await owner.getByText('رسیدی ارسال نشده است.').waitFor();
  await owner.getByRole('dialog').getByText('در انتظار بررسی').waitFor();
  // buyer submits the card-to-card receipt (optional fields, destination required)
  await h.call('owner','order_get',{id:(await h.sql(`select id from ${h.schema}.orders where client_id='${clientId}'`))[0].id});
  await h.sql(`select ${h.schema}.order_report('${clientId}',${quote(JSON.stringify({destination_id:String(cl[0].id),from_card:'6037999988776655',date:'1405/07/05',time:'14:35',trace:'123456',reference:'REF-9',note:'واریز شد'}))}::jsonb) as result`);
  await owner.locator('.sh-close').last().click();
  await owner.locator('[data-order]').first().click();
  await owner.getByText('6037999988776655').waitFor();
  await owner.getByText('REF-9').waitFor();
  await owner.locator('[data-act=order-approve]').click();
  await owner.locator('.sh-modal').waitFor({state:'hidden'});
  let st=null;for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,500));st=(await h.sql(`select status from ${h.schema}.orders where client_id='${clientId}'`))[0].status;if(st==='paid')break;}
  assert.equal(st,'paid');
  assert.equal((await h.sql(`select status from ${h.schema}.orders where client_id='${clientId}'`))[0].status,'paid','approve marks the order paid');
  await owner.locator('[data-order]').first().click();
  await owner.getByRole('dialog').getByText('علامت‌گذاری تحویل‌شده').waitFor();
  await owner.locator('[data-act=order-complete]').click();
  let final=null;for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,500));final=(await h.sql(`select status from ${h.schema}.orders where client_id='${clientId}'`))[0].status;if(final==='completed')break;}
  assert.equal(final,'completed','order reaches completed state');
  const res=await h.sql(`select released from ${h.schema}.reservations where order_id=(select id from ${h.schema}.orders where client_id='${clientId}')`);
  assert.equal(res[0].released,true,'completion releases the stock hold');

  if(errors.length)throw Error('page errors: '+errors.join(' | '));
  console.log('PASS chromium: gateway config UI with private credentials, empty re-save keeps secrets, deposit cards, inline quick product in purchase, sale shipping options (free/method/freight), online orders list with card-to-card receipt review, approve and complete. Isolated SQL only.');
 }catch(e){for(const c of contexts)for(const s of c.pages())try{await s.screenshot({path:path.join(OUT,'payments-fail.png')});}catch(x){}console.error('FAIL',e.message);process.exitCode=1;}
 finally{for(const c of contexts)await c.close();try{await b.close();}catch(e){}await h.cleanup();}
})();
