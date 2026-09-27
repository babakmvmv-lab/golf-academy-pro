// Private golf-shop operations. Authentication + SQL permission checks + atomic database posting.
// This endpoint never queries academy tables or accepts an actor id from the caller.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const MAX=2*1024*1024;
const actions=new Set(['bootstrap','dashboard','party_save','party_statement','product_save','category_rename','catalog_import','opening_zero','document_save','document_get','documents','document_post','document_void','inventory','payment_post','payment_void','payments','report','journal_get','ledger','staff','staff_save','settings_save','audit','ops_reset','payments_save','cards_save','orders','order_get','order_status']);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const failure=(e:{code?:string,message?:string})=>json({ok:false,error:e.code==='23505'?'کد کالا، بارکد یا شمارهٔ درخواست تکراری است؛ اطلاعات را بررسی کنید.':e.code==='23514'?'مقدار سند با قواعد حسابداری/موجودی سازگار نیست؛ هیچ بخش آن ثبت نشد.':e.message||'عملیات انجام نشد؛ تغییری قطعی اعلام نشده است.',code:e.code||''},e.code==='42501'?403:e.code==='40001'||e.code==='23505'?409:422);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 if(req.method!=='POST')return json({ok:false,error:'POST only'},405);
 try{
  const auth=req.headers.get('authorization')||'';if(!/^Bearer\s+\S+$/i.test(auth))return json({ok:false,error:'ابتدا وارد پنل فروشگاه شوید.'},401);
  const {data,error}=await db.auth.getUser(auth.replace(/^Bearer\s+/i,''));
  if(error||!data.user)return json({ok:false,error:'نشست ورود معتبر نیست؛ دوباره وارد شوید.'},401);
  const user=data.user;
  if(user.app_metadata?.web_admin!==true && user.app_metadata?.web_shop_staff!==true)return json({ok:false,error:'این حساب دسترسی فروشگاه ندارد.'},403);
  if(Number(req.headers.get('content-length')||0)>MAX)return json({ok:false,error:'درخواست بیش از حد بزرگ است.'},413);
  const text=await req.text();if(new TextEncoder().encode(text).byteLength>MAX)return json({ok:false,error:'درخواست بیش از حد بزرگ است.'},413);
  let body;try{body=JSON.parse(text);}catch{return json({ok:false,error:'درخواست معتبر نیست.'},400);}
  const action=body?.action,payload=body?.payload||{};
  if(action==='staff_create' || action==='staff_reset_password'){
   // The SQL check includes disabled users and manager-only access.
   const check=await db.rpc('web_shop_api',{p_actor:user.id,p_action:'staff',p_payload:{}});
   if(check.error)return failure(check.error);
   const password=crypto.randomUUID().replace(/-/g,'')+'aA9!';
   if(action==='staff_reset_password'){
    const target=(check.data||[]).find((x:{user_id:string})=>x.user_id===payload.user_id);
    if(!target || target.user_id===user.id)return json({ok:false,error:'کارمند مجاز برای بازنشانی انتخاب نشده است.'},422);
    const changed=await db.auth.admin.updateUserById(target.user_id,{password});
    if(changed.error)return json({ok:false,error:'بازنشانی رمز انجام نشد.'},422);
    return json({ok:true,data:{email:target.email,password}});
   }
   const email=String(payload.email||'').trim().toLowerCase(),name=String(payload.name||'').trim();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||name.length<2||!['manager','sales','purchasing'].includes(payload.department))return json({ok:false,error:'نام، ایمیل یا واحد کارمند معتبر نیست.'},422);
   const created=await db.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{web_shop_staff:true},user_metadata:{name}});
   if(created.error||!created.data.user)return json({ok:false,error:'ساخت حساب انجام نشد؛ ایمیل تکراری یا نامعتبر را بررسی کنید.'},422);
   const profile=await db.rpc('web_shop_api',{p_actor:user.id,p_action:'staff_save',p_payload:{user_id:created.data.user.id,name,department:payload.department,active:true,permissions:payload.permissions||{}}});
   if(profile.error){await db.auth.admin.deleteUser(created.data.user.id);return failure(profile.error);}
   return json({ok:true,data:{id:created.data.user.id,email,password}});
  }
  if(!actions.has(action))return json({ok:false,error:'عملیات مجاز نیست.'},400);
  if(action==='ops_reset'){
   // Destructive go-live zeroing: web owner only, and only right after a fresh password sign-in.
   if(user.app_metadata?.web_admin!==true)return json({ok:false,error:'صفرسازی عملیاتی فقط با حساب مدیر اصلی (مالک سایت) انجام می‌شود.'},403);
   const last=Date.parse(user.last_sign_in_at||'');
   if(!Number.isFinite(last)||Date.now()-last>10*60*1000)return json({ok:false,error:'برای صفرسازی، ورود تازه با رمز مدیر اصلی لازم است؛ رمز را در همان پنجره وارد کنید.'},401);
  }
  const result=await db.rpc('web_shop_api',{p_actor:user.id,p_action:action,p_payload:payload});
  if(result.error)return failure(result.error);
  return json({ok:true,data:result.data});
 }catch{return json({ok:false,error:'ارتباط عملیات فروشگاه کامل نشد. قبل از تلاش مجدد وضعیت سند را بررسی کنید.'},500);}
});
