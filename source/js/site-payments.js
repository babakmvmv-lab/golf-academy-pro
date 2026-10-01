/* Storefront commerce runtime: smart stock reservation (5-minute cart holds),
 * gateway choice at checkout, card-to-card receipt step and payment return handling.
 * Public endpoints only; design and markup of the storefront stay untouched. */
(function(){
 'use strict';
 const api=window.PC_SITE_CLOUD;if(!api||window.PC_PAY)return;
 const cfg=window.PC_SITE_CLOUD_CONFIG;
 const SESSION='puttclub_reserve_session',LAST_ORDER='puttclub_last_order';
 const TTL=300;
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fa=n=>Number(n||0).toLocaleString('fa-IR');
 const en=x=>String(x??'').replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c));
 const money=n=>fa(Math.round(n))+' تومان';
 function session(){
  try{const v=sessionStorage.getItem(SESSION);if(v)return v;}catch(e){}
  const v='r'+(crypto.randomUUID?crypto.randomUUID().replace(/-/g,''):'')+Date.now().toString(36);
  try{sessionStorage.setItem(SESSION,v);}catch(e){}
  return v.slice(0,48);
 }
 function toast(text,bad){
  const d=document.createElement('div');d.className='pc-pay-toast'+(bad?' bad':'');d.setAttribute('role','status');d.textContent=text;
  document.body.appendChild(d);setTimeout(()=>d.remove(),6000);
 }
 function style(){
  if(document.getElementById('pc-pay-style'))return;
  const el=document.createElement('style');el.id='pc-pay-style';
  el.textContent='.pc-pay-toast{position:fixed;bottom:18px;right:50%;transform:translateX(50%);z-index:10060;max-width:min(430px,92vw);background:#0a1712f2;border:1px solid #c9a24b77;color:#f2ecdd;border-radius:13px;padding:11px 16px;font:12px/1.9 Vazirmatn,Tahoma,sans-serif;box-shadow:0 10px 40px #0007;animation:pcPayIn .25s}.pc-pay-toast.bad{border-color:#b85458;color:#ffd9d9}@keyframes pcPayIn{from{opacity:0;transform:translateX(50%) translateY(14px)}}.pc-pay-gw{margin:10px 0 4px;display:grid;gap:9px}.pc-pay-gw label{display:flex;align-items:center;gap:11px;border:1px solid #c9a24b33;border-radius:14px;padding:10px 13px;cursor:pointer;background:#050d0980;transition:border-color .2s}.pc-pay-gw label:hover{border-color:#d4af6a}.pc-pay-gw input{accent-color:#c9a24b;width:16px;height:16px}.pc-pay-gw img{width:42px;height:42px;object-fit:contain;background:#f2ecdd;border-radius:9px;padding:4px;flex:none}.pc-pay-gw .t{display:flex;flex-direction:column;gap:3px}.pc-pay-gw .t b{font-size:13px;color:#f2ecdd}.pc-pay-gw .t small{font-size:11px;color:#93aa9c}.pc-pay-hint{margin:9px 0 3px;border:1px dashed #c9a24b44;border-radius:12px;padding:10px 13px;font-size:11.5px;line-height:2;color:#b4c6b8}.pc-pay-report{max-width:760px;margin:14px auto;border:1px solid #c9a24b33;border-radius:18px;background:#0a1712;padding:20px;color:#f2ecdd;font-family:Vazirmatn,Tahoma,sans-serif}.pc-pay-report h3{margin:0 0 6px;font-size:16px}.pc-pay-report p{font-size:12px;line-height:2;color:#93aa9c;margin:0 0 12px}.pc-pay-report .cards{display:grid;gap:9px;margin:10px 0}.pc-pay-report .cards label{display:flex;align-items:center;gap:11px;border:1px solid #c9a24b2e;border-radius:13px;padding:10px 13px;cursor:pointer}.pc-pay-report .cards input{accent-color:#c9a24b}.pc-pay-report .cards img{width:40px;height:40px;object-fit:contain;background:#f2ecdd;border-radius:8px;padding:3px}.pc-pay-report .cards b{font-size:12.5px}.pc-pay-report .cards small{display:block;font-size:10.5px;color:#93aa9c;direction:ltr;text-align:right}.pc-pay-report .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}.pc-pay-report .f{display:flex;flex-direction:column;gap:5px;font-size:11.5px;color:#b4c6b8}.pc-pay-report input,.pc-pay-report textarea{font:inherit;font-size:13px;padding:9px 11px;border:1px solid #c9a24b33;border-radius:9px;background:#050d09;color:#f2ecdd;direction:ltr;text-align:right}.pc-pay-report textarea{direction:rtl;grid-column:1/-1}.pc-pay-report button{font:inherit;font-size:12.5px;font-weight:800;border:0;border-radius:10px;padding:11px 22px;background:#c9a24b;color:#050d09;cursor:pointer}.pc-pay-report .ok{color:#93dbb1;margin-inline-start:9px;font-size:12px}.pc-pay-result{position:fixed;inset:0;z-index:10070;display:grid;place-items:center;background:#020806e0;backdrop-filter:blur(8px);padding:16px}.pc-pay-result>div{width:min(430px,100%);border:1px solid #c9a24b55;border-radius:18px;background:#0a1712;padding:26px;color:#f2ecdd;font-family:Vazirmatn,Tahoma,sans-serif;text-align:center}.pc-pay-result h3{margin:0 0 10px;font-size:18px}.pc-pay-result p{font-size:12.5px;line-height:2.1;color:#b4c6b8;margin:0 0 8px}.pc-pay-result .code{font-size:15px;font-weight:900;color:#e3c98f;letter-spacing:1px;margin:8px 0}.pc-pay-result button{font:inherit;margin-top:12px;border:1px solid #c9a24b66;background:#c9a24b;color:#050d09;font-weight:800;border-radius:10px;padding:10px 22px;cursor:pointer}';
  document.head.appendChild(el);
 }
 async function call(action,payload){
  const ctl=new AbortController();const tm=setTimeout(()=>ctl.abort(),20000);
  try{
   const r=await fetch(cfg.url+'/functions/v1/web-order',{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({action,payload}),signal:ctl.signal});
   const out=await r.json().catch(()=>null);
   if(!r.ok||!out||out.ok!==true)throw Error(out&&out.error||('خطای ارتباط با سرویس پرداخت (HTTP '+r.status+')'));
   return out.data;
  }finally{clearTimeout(tm);}
 }
 // ---------- Smart reservation watcher ----------
 let lastCart=[],avail={},expiry=0,heldByOrder=new Set(),flight=null,timer=null;
 function readCart(){
  try{const v=JSON.parse(localStorage.getItem('puttclub-cart')||'null');const items=v&&v.state&&Array.isArray(v.state.items)?v.state.items:[];return items.map(x=>({id:+x.productId,qty:Math.max(1,Math.min(10,+x.qty||1)),name:x.name}));}catch(e){return [];}
 }
 function scheduleSync(){clearTimeout(timer);timer=setTimeout(syncCart,450);}
 async function syncCart(){
  const items=readCart();
  const prev=new Map(lastCart.map(x=>[x.id,x.qty]));
  const next=new Map(items.map(x=>[x.id,x.qty]));
  const removed=[...prev.keys()].filter(id=>!next.has(id)&&!heldByOrder.has(id));
  lastCart=items;
  if(removed.length)call('release',{session:session(),items:removed.map(id=>({id}))}).catch(()=>{});
  if(!items.length){expiry=0;return;}
  if(flight)return scheduleSync();
  flight=call('reserve',{session:session(),items:items.map(x=>({id:x.id,qty:x.qty}))}).then(d=>{
   expiry=0;
   (d&&d.items||[]).forEach(x=>{
    avail[x.id]=x.available;
    if(x.ok&&x.expires_at)expiry=Math.max(expiry,Date.parse(x.expires_at));
    if(x.ok===false){ /* فقط بازخورد کاربردی هنگام انتخاب کالا؛ خود رزرو بی‌صدا است */
     const it=items.find(i=>i.id===+x.id);
     toast('موجودی «'+((it&&it.name)||'کالا')+'» کافی نیست؛ '+fa(x.available)+' عدد باقی مانده است.',true);
    }
   });
  }).catch(()=>{}).finally(()=>{flight=null;});
 }
 /* رزرو کاملاً بی‌صدا: بدون نشان، بدون شمارش معکوس، بدون پیام انقضا.
    سرور خودش بعد از ۵ دقیقه موجودی را برمی‌گرداند؛ خریدار دوباره شروع کند، دوباره رزرو می‌شود. */
 setInterval(()=>{if(expiry&&expiry-Date.now()<=0)expiry=0;},5000);
 try{window.addEventListener('storage',e=>{if(e.key==='puttclub-cart')scheduleSync();});}catch(e){}
 // Same-tab cart changes do not fire storage; poll the store quickly while the drawer is open.
 setInterval(()=>{const cur=readCart();if(cur.length||lastCart.length){const a=JSON.stringify(cur.map(x=>[x.id,x.qty])),b=JSON.stringify(lastCart.map(x=>[x.id,x.qty]));if(a!==b)scheduleSync();}},1200);

 // ---------- Checkout integration ----------
 const onCheckout=typeof location!=='undefined'&&/^\/checkout\/?$/.test(location.pathname.replace(/index\.html$/,''));
 let selectedMethod='gateway',selectedGateway='';
 function methodRadios(){return [...document.querySelectorAll('input[type=radio]')].filter(r=>['gateway','card','cod'].includes(r.value));}
 function paymentSettings(){
  const s=api.settings();
  return {methods:(s.paymentGateways&&Array.isArray(s.paymentGateways.methods))?s.paymentGateways.methods:[],cards:(s.payCards&&Array.isArray(s.payCards.cards))?s.payCards.cards:[]};
 }
 function renderGatewayChoice(){
  const box=document.getElementById('pc-pay-gateways');if(box)box.remove();
  const radio=methodRadios().find(r=>r.value==='gateway');if(!radio||!radio.checked)return;
  const {methods}=paymentSettings();
  const host=document.createElement('div');host.id='pc-pay-gateways';host.dir='rtl';
  if(!methods.length){host.innerHTML='<div class="pc-pay-hint">در حال حاضر درگاه آنلاینی فعال نیست؛ گزینهٔ دیگری را انتخاب کنید یا با پشتیبانی تماس بگیرید.</div>';}
  else{
   host.innerHTML='<div class="pc-pay-gw">'+methods.map((m,i)=>'<label><input type="radio" name="pc-pay-gw" value="'+esc(m.slug)+'" '+(i===0?'checked':'')+'><img src="'+esc(m.logo||'/images/academy-logo.webp')+'" alt=""><span class="t"><b>'+esc(m.title)+'</b><small>'+esc(m.bank||'')+'</small></span></label>').join('')+'</div>';
   selectedGateway=methods[0]?methods[0].slug:'';
   host.addEventListener('change',e=>{if(e.target.name==='pc-pay-gw')selectedGateway=e.target.value;});
  }
  const field=radio.closest('label')||radio.parentElement;
  field.parentElement.insertBefore(host,field.nextSibling);
 }
 function renderCardHint(){
  const box=document.getElementById('pc-pay-gateways');if(box)box.remove();
  const radio=methodRadios().find(r=>r.value==='card');if(!radio||!radio.checked)return;
  const {cards}=paymentSettings();
  const host=document.createElement('div');host.id='pc-pay-gateways';host.dir='rtl';
  host.innerHTML='<div class="pc-pay-hint">'+(cards.length?'پس از ثبت سفارش، کارت‌های فروشگاه و فرم ارسال رسید کارت به کارت نمایش داده می‌شود.':'در حال حاضر کارتی برای واریز ثبت نشده است.')+'</div>';
  const field=radio.closest('label')||radio.parentElement;
  field.parentElement.insertBefore(host,field.nextSibling);
 }
 function watchPaymentStep(){
  const radios=methodRadios();if(!radios.length)return setTimeout(watchPaymentStep,400);
  radios.forEach(r=>r.addEventListener('change',()=>{selectedMethod=r.value;renderGatewayChoice();renderCardHint();}));
  selectedMethod=(radios.find(r=>r.checked)||radios[0]||{value:'gateway'}).value;
  renderGatewayChoice();renderCardHint();
 }
 async function handleOrder(bodyRaw){
  let body={};try{body=JSON.parse(bodyRaw||'{}');}catch(e){}
  const cart=readCart().filter(x=>!heldByOrder.has(x.id));
  if(!cart.length)return new Response(JSON.stringify({error:'سبد خرید خالی است.'}),{status:422,headers:{'Content-Type':'application/json'}});
  let client_id=null;try{client_id=JSON.parse(sessionStorage.getItem(LAST_ORDER)||'null');}catch(e){}
  if(!client_id){client_id=crypto.randomUUID();try{sessionStorage.setItem(LAST_ORDER,JSON.stringify(client_id));}catch(e){}}
  const method=selectedMethod==='card'?'card2card':selectedMethod;
  let data;
  try{
   data=await call('create',{client_id,session:session(),customer:body.customer||{},items:cart.map(x=>({product_id:x.id,qty:x.qty})),payment:{method,gateway:selectedGateway}});
  }catch(e){return new Response(JSON.stringify({error:e.message}),{status:422,headers:{'Content-Type':'application/json'}});}
  const order=data&&data.order||{};
  (order.items||[]).forEach(x=>heldByOrder.add(+x.product_id));
  lastCart=[];expiry=0;renderBadge();
  if(data.gateway_error)toast(data.gateway_error+' برای پرداخت، سفارش را در پشتیبانی پیگیری کنید یا روش کارت به کارت را انتخاب کنید.',true);
  if(data.pay_url){setTimeout(()=>{try{location.href=data.pay_url;}catch(e){}},700);}
  else if(method==='card2card'){setTimeout(()=>renderReportForm(client_id,order.code),900);}
  return new Response(JSON.stringify({code:order.code||'W'}),{status:200,headers:{'Content-Type':'application/json'}});
 }
 function renderReportForm(client_id,code){
  if(document.getElementById('pc-pay-report'))return;
  const {cards}=paymentSettings();
  const host=document.createElement('div');host.id='pc-pay-report';host.dir='rtl';host.className='pc-pay-report';
  host.innerHTML='<h3>ارسال رسید کارت به کارت — سفارش '+esc(code||'')+'</h3><p>مبلغ را به یکی از کارت‌های زیر واریز کنید و مشخصات واریز را ثبت کنید تا سریع‌تر تأیید شود. تکمیل همهٔ موارد اختیاری است؛ «کارت مقصد» را انتخاب کنید.</p>'+
   '<div class="cards">'+cards.map((c,i)=>'<label><input type="radio" name="pc-pay-card" value="'+esc(c.id)+'" '+(i===0?'checked':'')+'><img src="'+esc(c.logo||'/images/academy-logo.webp')+'" alt=""><span><b>'+esc(c.bank)+(c.title?' — '+esc(c.title):'')+'</b>'+(c.card_number?'<small>کارت: '+esc(c.card_number)+'</small>':'')+(c.iban?'<small>شبا: '+esc(c.iban)+'</small>':'')+(c.account_number?'<small>حساب: '+esc(c.account_number)+'</small>':'')+'</span></label>').join('')+'</div>'+
   '<div class="grid">'+
   '<span class="f">شماره کارتی که با آن واریز کردید<input data-r="from_card" inputmode="numeric" maxlength="19" placeholder="۶۰۳۷۹۹…"></span>'+
   '<span class="f">تاریخ واریز (شمسی)<input data-r="date" placeholder="۱۴۰۵/۰۷/۰۵"></span>'+
   '<span class="f">ساعت واریز<input data-r="time" placeholder="۱۴:۳۵"></span>'+
   '<span class="f">شماره پیگیری / کد رهگیری واریز<input data-r="trace" placeholder="۱۲۳۴۵۶"></span>'+
   '<span class="f">شماره ارجاع (در صورت وجود)<input data-r="reference" placeholder="REF…"></span>'+
   '</div><textarea data-r="note" rows="2" placeholder="توضیحات (اختیاری)"></textarea>'+
   '<div style="margin-top:12px"><button type="button">ثبت اطلاعات واریز</button><span class="ok" hidden>✓ ثبت شد؛ پس از بررسی تأیید می‌شود</span></div>';
  document.body.appendChild(host);
  try{host.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){}
  host.querySelector('button').onclick=async()=>{
   const report={};
   host.querySelectorAll('[data-r]').forEach(el=>{const v=en(el.value).trim();if(v)report[el.dataset.r]=v;});
   const dest=host.querySelector('input[name=pc-pay-card]:checked');
   if(!dest){toast('یکی از کارت‌های مقصد را انتخاب کنید.',true);return;}
   report.destination_id=dest.value;
   try{await call('report',{client_id,report});host.querySelector('.ok').hidden=false;host.querySelector('button').disabled=true;toast('رسید واریز ثبت شد؛ پس از بررسی مدیر تأیید می‌شود.');}
   catch(e){toast(e.message,true);}
  };
 }
 async function handleReturn(){
  const q=new URLSearchParams(location.search);
  if(!q.has('pay-return'))return;
  let client_id=null;try{client_id=JSON.parse(sessionStorage.getItem(LAST_ORDER)||'null');}catch(e){}
  style();
  const box=document.createElement('div');box.className='pc-pay-result';box.dir='rtl';
  box.innerHTML='<div><h3>در حال بررسی نتیجهٔ پرداخت…</h3><p>لطفاً چند لحظه صبر کنید.</p></div>';
  document.body.appendChild(box);
  const params={};q.forEach((v,k)=>params[k]=v);
  try{
   if(!client_id)throw Error('شناسهٔ سفارش در این مرورگر یافت نشد.');
   const d=await call('pay_verify',{client_id,params});
   const order=d.order||{};
   const paid=d.paid===true;
   box.innerHTML='<div><h3>'+(paid?'✓ پرداخت تأیید شد':'پرداخت تأیید نشد')+'</h3>'+(order.code?'<div class="code">'+esc(order.code)+'</div>':'')+'<p>'+(paid?'سفارش شما با موفقیت پرداخت شد؛ همکاران ما برای هماهنگی ارسال با شما تماس می‌گیرند.':d.manual?'وضعیت پرداخت به‌زودی توسط فروشگاه بررسی و تأیید می‌شود.':'پرداخت تکمیل نشد یا لغو شد. در صورت کسر وجه، مبلغ تا ۷۲ ساعت بازمی‌گردد؛ برای پیگیری با پشتیبانی تماس بگیرید.')+'</p><button type="button">بازگشت به فروشگاه</button></div>';
  }catch(e){
   box.innerHTML='<div><h3>بررسی پرداخت کامل نشد</h3><p>'+esc(e.message)+'</p><button type="button">بستن</button></div>';
  }
  box.querySelector('button').onclick=()=>{box.remove();try{location.href='/shop/';}catch(err){}};
 }
 if(typeof document!=='undefined'){
  const boot=()=>{try{
   style();
   if(onCheckout){watchPaymentStep();handleReturn();}
   syncCart();
  }catch(e){}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 }
 window.PC_PAY={handleOrder,session,syncCart,call};
})();
