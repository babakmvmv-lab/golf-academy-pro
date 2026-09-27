// Public storefront commerce: stock reservations, online orders and payment gateway adapters.
// Anonymous (publishable key) endpoint with strict payload caps; no academy tables, no staff data.
// Gateway secrets live in web_shop.payment_gateways and are used only here, never returned to the browser.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const MAX=8*1024;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const bad=(message:string,status=422)=>json({ok:false,error:message},status);
const enDigits=(x:unknown)=>String(x??'').replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c));
async function rpc(fn:string,args:Record<string,unknown>){
  const r=await db.rpc(fn as never,args as never);
  if(r.error)return {error:r.error.message};
  return {data:r.data};
}
async function gatewayFetch(url:string,init:RequestInit&{timeoutMs?:number}={}){
  const ctl=new AbortController();const tm=setTimeout(()=>ctl.abort(),init.timeoutMs??15000);
  try{return await fetch(url,{...init,signal:ctl.signal});}finally{clearTimeout(tm);}
}
// --- Payment gateway adapters (Iranian processors). Amounts are stored in Toman; PSPs expect Rial. ---
async function payStart(kind:string,cred:Record<string,unknown>,code:string,amountToman:number,callback:string){
  const amount=Math.round(amountToman*10);
  if(kind==='link'||kind==='psp'){
   const link=String(cred.link||'');
   if(!/^https?:\/\//i.test(link))return {error:kind==='psp'?'این درگاه بانکی هنوز از طرف بانک فعال نشده است.':'لینک پرداخت تنظیم نشده است.'};
   const url=new URL(link);
   if(!url.searchParams.has('amount'))url.searchParams.set('amount',String(amount));
   url.searchParams.set('description',code);
   return {url:url.toString()};
  }
  if(kind==='zarinpal'){
   const sandbox=cred.sandbox===true;
   const base=sandbox?'https://sandbox.zarinpal.com':'https://payment.zarinpal.com';
   const r=await gatewayFetch(base+'/pg/v4/payment/request.json',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({merchant_id:String(cred.merchant_id||''),amount,callback_url:callback,description:'سفارش '+code})});
   const out=await r.json().catch(()=>null);
   if(!r.ok||out?.data?.code!==100||!out?.data?.authority)return {error:'درگاه زرین‌پال درخواست را نپذیرفت؛ لحظاتی بعد دوباره تلاش کنید.'};
   return {url:base+'/pg/StartPay/'+out.data.authority,ref:String(out.data.authority)};
  }
  if(kind==='idpay'){
   const r=await gatewayFetch('https://api.idpay.ir/v1.1/payment',{method:'POST',headers:{'Content-Type':'application/json','X-API-KEY':String(cred.api_key||''),...(cred.sandbox===true?{'X-SANDBOX':'1'}:{})},body:JSON.stringify({order_id:code,amount,callback,desc:'سفارش '+code})});
   const out=await r.json().catch(()=>null);
   if(!r.ok||!out?.id||!out?.link)return {error:'درگاه آیدی‌پی درخواست را نپذیرفت؛ اطلاعات اتصال را بررسی کنید.'};
   return {url:String(out.link),ref:String(out.id)};
  }
  if(kind==='zibal'){
   const r=await gatewayFetch('https://gateway.zibal.ir/v1/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({merchant:String(cred.merchant||''),amount,callbackUrl:callback,orderId:code})});
   const out=await r.json().catch(()=>null);
   if(!r.ok||out?.result!==100||!out?.trackId)return {error:'درگاه زیبال درخواست را نپذیرفت؛ اطلاعات اتصال را بررسی کنید.'};
   return {url:'https://gateway.zibal.ir/start/'+out.trackId,ref:String(out.trackId)};
  }
  return {error:'نوع درگاه پشتیبانی نمی‌شود.'};
}
async function payVerify(kind:string,cred:Record<string,unknown>,code:string,amountToman:number,params:Record<string,string>){
  const amount=Math.round(amountToman*10);
  if(kind==='link'||kind==='psp')return {manual:true};
  if(kind==='zarinpal'){
   const authority=params.Authority||params.authority||'';
   if(params.Status!=='OK'&&params.status!=='OK')return {paid:false};
   const sandbox=cred.sandbox===true;const base=sandbox?'https://sandbox.zarinpal.com':'https://payment.zarinpal.com';
   const r=await gatewayFetch(base+'/pg/v4/payment/verify.json',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({merchant_id:String(cred.merchant_id||''),amount,authority})});
   const out=await r.json().catch(()=>null);
   if(out?.data?.code===100||out?.data?.code===101)return {paid:true,detail:{ref_id:out.data.ref_id,code:out.data.code}};
   return {paid:false,detail:out?.data||{}};
  }
  if(kind==='idpay'){
   const id=params.id||'';
   if(!id)return {paid:false};
   const r=await gatewayFetch('https://api.idpay.ir/v1.1/payment/verify',{method:'POST',headers:{'Content-Type':'application/json','X-API-KEY':String(cred.api_key||''),...(cred.sandbox===true?{'X-SANDBOX':'1'}:{})},body:JSON.stringify({id,order_id:code})});
   const out=await r.json().catch(()=>null);
   if(out?.status===100||out?.status===10)return {paid:true,detail:{status:out.status,track_id:out.track_id}};
   return {paid:false,detail:out||{}};
  }
  if(kind==='zibal'){
   const trackId=params.trackId||'';
   if(!trackId||params.success!=='1')return {paid:false};
   const r=await gatewayFetch('https://gateway.zibal.ir/v1/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({merchant:String(cred.merchant||''),trackId})});
   const out=await r.json().catch(()=>null);
   if(out?.result===100&&(out?.amount??amount)===amount)return {paid:true,detail:{result:out.result,refNumber:out.refNumber}};
   return {paid:false,detail:out||{}};
  }
  return {paid:false};
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 if(req.method!=='POST')return json({ok:false,error:'POST only'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>MAX)return bad('درخواست بیش از حد بزرگ است.',413);
  const text=await req.text();if(new TextEncoder().encode(text).byteLength>MAX)return bad('درخواست بیش از حد بزرگ است.',413);
  let body;try{body=JSON.parse(text);}catch{return bad('درخواست معتبر نیست.',400);}
  const action=body?.action,p=body?.payload||{};
  const origin=(req.headers.get('origin')||'https://puttclub.ir').replace(/\/$/,'');
  const callback=origin+'/checkout/?pay-return=1';
  if(action==='reserve'||action==='release'){
   const session=String(p.session||'');
   if(!/^[A-Za-z0-9_-]{8,64}$/.test(session))return bad('نشست سبد خرید معتبر نیست.');
   const items=Array.isArray(p.items)?p.items.slice(0,30).map((x:{id:unknown;qty:unknown})=>({id:enDigits(x?.id),qty:Math.max(1,Math.min(10,Number(enDigits(x?.qty))||1))})):[];
   if(action==='release'){
    const r=await rpc('web_order_api',{p_action:'release',p_payload:{session,ids:items.map(x=>x.id)}});
    if(r.error)return bad(r.error);return json({ok:true,data:r.data});
   }
   const r=await rpc('web_order_api',{p_action:'reserve',p_payload:{session,items}});
   if(r.error)return bad(r.error);return json({ok:true,data:r.data});
  }
  if(action==='create'){
   const client_id=String(p.client_id||'');
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(client_id))return bad('شناسهٔ سفارش معتبر نیست.');
   const items=Array.isArray(p.items)?p.items.slice(0,30).map((x:{product_id:unknown;qty:unknown})=>({product_id:enDigits(x?.product_id),qty:Math.max(1,Math.min(10,Number(enDigits(x?.qty))||1))})):[];
   if(!items.length)return bad('سبد خرید خالی است.');
   const customer={};['name','phone','email','city','address','postalCode','note'].forEach(k=>{const v=String(p?.customer?.[k]??'').trim();if(v)customer[k]=v.slice(0,300);});
   if(!customer.name||!/^09\d{9}$/.test(enDigits(customer.phone)))return bad('نام و شمارهٔ موبایل معتبر لازم است.');
   const payment={method:['gateway','card2card','cod'].includes(p?.payment?.method)?p.payment.method:'card2card',gateway:String(p?.payment?.gateway||'').slice(0,40)};
   const r=await rpc('web_order_api',{p_action:'create',p_payload:{session:String(p.session||'x-session-'+client_id.slice(0,8)),client_id,payment,customer,items}});
   if(r.error)return bad(r.error);
   if(payment.method==='gateway'){
    const s=await rpc('web_order_api',{p_action:'pay_start_info',p_payload:{client_id}});
    if(s.error)return bad(s.error);
    const info=s.data||{};
    const start=await payStart(info.kind,info.credentials||{},info.code,Number(info.total)||0,callback);
    if(start.error)return json({ok:true,data:{order:r.data,gateway_error:start.error}});
    await rpc('web_order_api',{p_action:'pay_mark',p_payload:{code:info.code,ref:start.ref||null,state:'started',detail:{}}});
    return json({ok:true,data:{order:r.data,pay_url:start.url}});
   }
   return json({ok:true,data:{order:r.data}});
  }
  if(action==='review'){
   // Public product review → web_store pending row (moderated in the site admin panel).
   const productId=Math.floor(Number(enDigits(p?.productId)));
   const author=String(p?.author??'').trim().slice(0,80);
   const rating=Math.min(5,Math.max(1,Math.floor(Number(enDigits(p?.rating))||0)));
   const comment=String(p?.comment??'').trim().slice(0,600);
   if(!(productId>0&&productId<1e9))return bad('کالا برای ثبت نظر معتبر نیست.');
   if(author.length<2)return bad('نام شما را کامل بنویسید.');
   if(!(rating>=1&&rating<=5))return bad('امتیاز معتبر نیست.');
   if(comment.length<5)return bad('متن نظر کوتاه است؛ کمی بیشتر بنویسید.');
   const id=Date.now()*1000+Math.floor(Math.random()*1000);
   const v={id,productId,author,rating,comment,createdAt:new Date().toISOString(),status:'pending'};
   const w=await db.from('web_store').upsert({k:'web_review_'+id,v});
   if(w.error)return bad('ثبت نظر انجام نشد؛ لحظاتی بعد دوباره تلاش کنید.');
   return json({ok:true,data:{review:{...v,status:'pending',pending:true}}});
  }
  if(action==='testimonial'){
   // Public testimonial → web_store pending row (public-safe fields only; no contact data).
   const name=String(p?.name??'').trim().slice(0,80);
   const phone=String(enDigits(p?.phone)??'').trim().slice(0,20);
   const text=String(p?.text??'').trim().slice(0,600);
   const rating=Math.min(5,Math.max(1,Math.floor(Number(enDigits(p?.rating))||0)));
   if(name.length<2)return bad('نام و نام خانوادگی را کامل وارد کنید.');
   if(!/^09\d{9}$/.test(phone))return bad('شماره تماس معتبر نیست (مثل ۰۹۱۲۳۴۵۶۷۸۹).');
   if(text.length<10)return bad('متن نظر کوتاه است؛ کمی بیشتر بنویسید.');
   const id=Date.now()*1000+Math.floor(Math.random()*1000);
   const v={id,name,text,rating,createdAt:new Date().toISOString(),status:'pending'};
   const w=await db.from('web_store').upsert({k:'web_testimonial_'+id,v});
   if(w.error)return bad('ثبت نظر ناموفق بود؛ لحظاتی بعد دوباره تلاش کنید.');
   return json({ok:true,data:{ok:true}});
  }
  if(action==='signup'){
   // Public course registration → PRIVATE web_inbox row (phone never becomes public).
   const name=String(p?.name??'').trim().slice(0,80);
   const phone=String(enDigits(p?.phone)??'').trim().slice(0,20);
   const course=String(p?.course??'').trim().slice(0,120);
   const note=String(p?.note??'').trim().slice(0,500);
   const mode=p?.mode==='register'?'register':'presignup';
   if(name.length<2)return bad('نام و نام خانوادگی را کامل وارد کنید.');
   if(!/^09\d{9}$/.test(phone))return bad('شماره موبایل معتبر نیست (مثل ۰۹۱۲۳۴۵۶۷۸۹).');
   const id=Date.now()*1000+Math.floor(Math.random()*1000);
   const w=await db.from('web_inbox').insert({id,kind:'signup',data:{name,phone,course,note,mode}});
   if(w.error)return bad('ثبت‌نام انجام نشد؛ لحظاتی بعد دوباره تلاش کنید.');
   return json({ok:true,data:{ok:true}});
  }
  if(action==='report'){
   const client_id=String(p.client_id||'');
   const report={};['destination_id','from_card','date','time','trace','reference','note'].forEach(k=>{const v=String(p?.report?.[k]??'').trim();if(v)report[k]=enDigits(v).slice(0,300);});
   if(report.from_card&&!/^\d{16}$/.test(report.from_card))return bad('شماره کارت باید ۱۶ رقم باشد.');
   const r=await rpc('web_order_api',{p_action:'report',p_payload:{client_id,report}});
   if(r.error)return bad(r.error);return json({ok:true,data:r.data});
  }
  if(action==='cancel'){
   const r=await rpc('web_order_api',{p_action:'cancel',p_payload:{client_id:String(p.client_id||'')}});
   if(r.error)return bad(r.error);return json({ok:true,data:r.data});
  }
  if(action==='status'){
   const r=await rpc('web_order_api',{p_action:'status',p_payload:{client_id:String(p.client_id||'')}});
   if(r.error)return bad(r.error);return json({ok:true,data:r.data});
  }
  if(action==='pay_start'){
   const client_id=String(p.client_id||'');
   const s=await rpc('web_order_api',{p_action:'pay_start_info',p_payload:{client_id}});
   if(s.error)return bad(s.error);
   const info=s.data||{};
   const start=await payStart(info.kind,info.credentials||{},info.code,Number(info.total)||0,callback);
   if(start.error)return bad(start.error);
   await rpc('web_order_api',{p_action:'pay_mark',p_payload:{code:info.code,ref:start.ref||null,state:'started',detail:{}}});
   return json({ok:true,data:{url:start.url,code:info.code}});
  }
  if(action==='pay_verify'){
   const client_id=String(p.client_id||'');
   const st=await rpc('web_order_api',{p_action:'status',p_payload:{client_id}});
   if(st.error)return bad(st.error);
   const order=st.data||{};
   if(!order.code)return bad('سفارش پیدا نشد.');
   if(order.status==='paid')return json({ok:true,data:{order,paid:true}});
   const s=await rpc('web_order_api',{p_action:'pay_start_info',p_payload:{client_id}});
   if(s.error)return bad(s.error);
   const info=s.data||{};
   const params=p.params&&typeof p.params==='object'?p.params:{};
   const v=await payVerify(info.kind,info.credentials||{},order.code,Number(order.total)||0,params);
   if(v.manual)return json({ok:true,data:{order,manual:true}});
   if(v.paid){
    await rpc('web_order_api',{p_action:'pay_mark',p_payload:{code:order.code,ref:order.gateway_ref||null,state:'paid',detail:v.detail||{}}});
    const done=await rpc('web_order_api',{p_action:'status',p_payload:{client_id}});
    return json({ok:true,data:{order:done.data||order,paid:true}});
   }
   return json({ok:true,data:{order,paid:false}});
  }
  return bad('عملیات مجاز نیست.',400);
 }catch{return json({ok:false,error:'ارتباط درگاه پرداخت کامل نشد؛ تغییرات ذخیره نشد.'},500);}
});
