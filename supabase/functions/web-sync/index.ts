// Independent website/shop publication endpoint; never touches academy tables.
// Authentication: verified Supabase Auth session AND server-owned app_metadata.web_admin.
import { createClient } from "jsr:@supabase/supabase-js@2";
const db=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
const MAX_BYTES=2*1024*1024;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const settings:Record<string,string[]>={
 brand:['faName','faShort','enName','enShort','tagline','logo','logoHd'],
 theme:['gold500','gold400','gold300','gold600','forest950','forest900','forest800','cream','sage'],
 contact:['phone','phoneFa','email','address','instagram','instagramUrl','telegram','whatsapp','siteUrl','domain','hours'],
 hero:['badge','line1','line2','subtitle','stats'],about:['kicker','title','paragraphs','image','imageCaption'],
 courses_section:['kicker','title','titleAccent','desc'],testimonials_section:['kicker','title','titleAccent','desc'],
 footer:['aboutText'],shop_gate:['enabled','showOnShop','showOnCheckout','title','message','backLabel','overlayOpacity','overlayBlur','codeHash','codeLength']
};
const records:Record<string,string[]>={
 product:['id','slug','name','category','price','oldPrice','shortDesc','description','features','images','rating','reviewCount','stock','badge','isNew','isFeatured','createdAt'],
 category:['id','name','description','image','created_at'],
 course:['id','title','subtitle','shortDesc','fullDesc','icon','images','galleryMode','layout','cardSize','titleColor','textColor','accentColor','titleSize','bodySize','bodyAlign','footerItems','socials','sortOrder','isActive','createdAt'],
 testimonial:['id','name','role','text','rating','status','createdAt'],review:['id','productId','author','rating','comment','status','createdAt']
};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const only=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).every(k=>keys.includes(k));
function valid(k:unknown,v:unknown){
 if(typeof k!=='string')return false;
 if(k==='web_setting_menu')return Array.isArray(v)&&v.every(x=>object(x)&&only(x,['label','href','visible'])&&typeof x.label==='string'&&typeof x.href==='string');
 const setting=/^web_setting_([a-z_]+)$/.exec(k);
 if(setting){const f=settings[setting[1]];if(!Object.prototype.hasOwnProperty.call(settings,setting[1])||!f||!object(v)||!only(v,f))return false;
  if(setting[1]==='shop_gate' && (!/^[0-9a-f]{64}$/.test(String(v.codeHash||''))||!Number.isInteger(Number(v.codeLength))||Number(v.codeLength)<1||Number(v.codeLength)>20))return false;
  if(setting[1]==='hero'&&v.stats!==undefined&&(!Array.isArray(v.stats)||!v.stats.every(x=>object(x)&&only(x,['label','value']))))return false;
  return true;
 }
 const rec=/^web_(product|category|course|testimonial|review)_([0-9]+)$/.exec(k);
 if(!rec||!object(v)||!Number.isSafeInteger(+rec[2])||Number(v.id)!==+rec[2])return false;
 if(v._deleted===true)return only(v,['id','_deleted']);
 if(!only(v,records[rec[1]]))return false;
 if(['testimonial','review'].includes(rec[1])&&v.status!==undefined&&v.status!=='approved')return false;
 if(rec[1]==='course'){
  if(v.footerItems!==undefined&&(!Array.isArray(v.footerItems)||!v.footerItems.every(x=>object(x)&&only(x,['label','value']))))return false;
  if(v.socials!==undefined&&(!Array.isArray(v.socials)||!v.socials.every(x=>object(x)&&only(x,['network','url']))))return false;
 }
 return true;
}
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 if(req.method!=='POST')return json({ok:false,err:'POST only'},405);
 try{
  const bearer=req.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+$/i.test(bearer))return json({ok:false,err:'Cloud admin sign-in required',code:'WEB_AUTH_REQUIRED'},401);
  const token=bearer.replace(/^Bearer\s+/i,'');
  const {data:auth,error:authError}=await db.auth.getUser(token);
  if(authError||!auth.user)return json({ok:false,err:'Cloud session is invalid or expired',code:'WEB_AUTH_REQUIRED'},401);
  if(auth.user.app_metadata?.web_admin!==true)return json({ok:false,err:'Website publication permission required',code:'WEB_ADMIN_REQUIRED'},403);
  if(Number(req.headers.get('content-length')||0)>MAX_BYTES)return json({ok:false,err:'payload too large',maxBytes:MAX_BYTES},413);
  const raw=await req.text();if(new TextEncoder().encode(raw).byteLength>MAX_BYTES)return json({ok:false,err:'payload too large',maxBytes:MAX_BYTES},413);
  let body;try{body=JSON.parse(raw);}catch{return json({ok:false,err:'invalid JSON'},400);}
  if(body?.action!=='kv'||!Array.isArray(body.rows)||body.rows.length!==1)return json({ok:false,err:'Exactly one public record per acknowledged request'},400);
  const row=body.rows[0];
  if(!row||!valid(row.k,row.v)||!Object.prototype.hasOwnProperty.call(row,'base')||(row.base!==null&&(typeof row.base!=='string'||!Number.isFinite(Date.parse(row.base)))))return json({ok:false,err:'Invalid public website record or revision',code:'INVALID_WEB_RECORD'},400);
  const serverTime=Math.max(Date.now(),row.base===null?0:Date.parse(row.base)+1);
  const value={k:row.k,v:row.v,updated_at:new Date(serverTime).toISOString()};
  // Compare-and-set on the database, not merely a client-side read-before-write.
  const result=row.base===null
    ? await db.from('web_store').insert(value).select('k,updated_at')
    : await db.from('web_store').update({v:value.v,updated_at:value.updated_at}).eq('k',row.k).eq('updated_at',row.base).select('k,updated_at');
  if(result.error){
   if(result.error.code==='23505')return json({ok:false,err:'This record changed on another device',code:'CONFLICT'},409);
   return json({ok:false,err:'Website storage write failed',code:result.error.code},502);
  }
  if(!result.data||result.data.length!==1)return json({ok:false,err:'This record changed on another device',code:'CONFLICT'},409);
  return json({ok:true,put:1,del:0,rows:result.data});
 }catch{return json({ok:false,err:'Website publication failed; retain the local draft'},500);}
});
