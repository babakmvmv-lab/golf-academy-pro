/* Browser ↔ real SQL contract in an isolated QA schema and QA public sink.
 * Management token stays in Node, never in the browser. No real Auth, academy,
 * production web_store or production web_shop records are used or modified.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),BASE=process.env.BASE_URL||'http://127.0.0.1:8000';
const owner='10000000-0000-4000-8000-000000000001',seller='10000000-0000-4000-8000-000000000002',buyer='10000000-0000-4000-8000-000000000003';
const quote=x=>"'"+String(x).replace(/'/g,"''")+"'";
class ShopHarness{
 constructor(){this.schema='shop_ui_'+crypto.randomBytes(4).toString('hex');this.denied=[];this.requests=[];this.failed=false;this.users={owner,seller,buyer};}
 async sql(query){
  const token=fs.readFileSync('/home/user/.secrets/supabase_access_token','utf8').trim();
  const ref=fs.readFileSync(path.join(ROOT,'source/js/cloud.js'),'utf8').match(/url: 'https:\/\/([^.]+)/)[1];
  const r=await fetch('https://api.supabase.com/v1/projects/'+ref+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query})});
  const d=await r.json();if(!r.ok)throw Error(d.message||'QA SQL request failed');return d;
 }
 async setup(){
  let s=fs.readFileSync(path.join(ROOT,'supabase/web_shop.sql'),'utf8').replaceAll('web_shop',this.schema).replaceAll('public.web_store',this.schema+'.catalogue_sink').replaceAll('auth.users',this.schema+'.identities');
  const extra=`\ncreate table ${this.schema}.catalogue_sink(like public.web_store including all);\ncreate table ${this.schema}.identities(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb);\ninsert into ${this.schema}.identities values('${owner}','qa-owner@example.invalid','{"web_admin":true}','{"name":"مدیر آزمایشی"}'),('${seller}','qa-sales@example.invalid','{"web_shop_staff":true}','{"name":"فروش آزمایشی"}'),('${buyer}','qa-buy@example.invalid','{"web_shop_staff":true}','{"name":"خرید آزمایشی"}');\n`;
  s=s.replace('create schema if not exists '+this.schema+';','create schema if not exists '+this.schema+';'+extra);
  await this.sql(s);
  await this.call('owner','staff_save',{user_id:seller,name:'فروش آزمایشی',department:'sales',active:true,permissions:{'sales.view':true,'sales.create':true,'finance.view':true,'finance.create':true,'catalog.view':true,'inventory.view':true}});
  await this.call('owner','staff_save',{user_id:buyer,name:'خرید آزمایشی',department:'purchasing',active:true,permissions:{'purchases.view':true,'purchases.create':true,'catalog.view':true,'catalog.create':true,'inventory.view':true}});
 }
 async call(role,action,payload={}){const rows=await this.sql(`select public.${this.schema}_api(${quote(this.users[role])}::uuid,${quote(action)},${quote(JSON.stringify(payload))}::jsonb) as result`);return rows[0].result;}
 async attach(c,role='owner'){
  await c.addInitScript(({role,id})=>{try{localStorage.setItem('puttclub_admin',JSON.stringify({id,email:'qa-'+role+'@example.invalid',name:'آزمایشی',cloud:true}));localStorage.setItem('puttclub_web_auth_v1',JSON.stringify({access_token:'qa-'+role,refresh_token:'qa-refresh',expires_at:9999999999,user:{id,email:'qa-'+role+'@example.invalid',app_metadata:role==='owner'?{web_admin:true}:{web_shop_staff:true}}}));}catch(e){}},{role,id:this.users[role]});
  await c.route('**/*',async r=>{
   const u=new URL(r.request().url());if(u.origin!==new URL(BASE).origin){this.denied.push(u.hostname);return r.abort('blockedbyclient');}
   const reply=(status,x)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(x)});
   if(u.pathname.startsWith('/__qa_cloud/rest/v1/web_store')){const rows=await this.sql(`select k,v,updated_at from ${this.schema}.catalogue_sink order by k`);return reply(200,rows);}
   if(u.pathname==='/__qa_cloud/functions/v1/web-erp'){
    const body=r.request().postDataJSON();this.requests.push({role,action:body.action});
    if(this.failed)return reply(503,{ok:false,error:'قطع آزمایشی ارتباط؛ فرم را نگه دارید.'});
    try{
     if(body.action==='staff_create'){
      await this.call(role,'staff');const id=crypto.randomUUID();await this.sql(`insert into ${this.schema}.identities values(${quote(id)},${quote(body.payload.email)},'{"web_shop_staff":true}','{}')`);
      await this.call(role,'staff_save',{...body.payload,user_id:id,active:true});return reply(200,{ok:true,data:{id,email:body.payload.email,password:'QA-Temporary-Only-123!'}});
     }
     return reply(200,{ok:true,data:await this.call(role,body.action,body.payload)});
    }catch(e){const raw=e.message;let message=raw.match(/ERROR:\s+[A-Z0-9]+:\s*([^\n]+)/)?.[1]||raw;return reply(raw.includes('42501')?403:422,{ok:false,error:message});}
   }
   if(u.pathname.startsWith('/__qa_cloud/'))return reply(403,{ok:false,error:'QA disallows any other service action'});
   return r.continue();
  });
 }
 async cleanup(){await this.sql(`drop function if exists public.${this.schema}_api(uuid,text,jsonb);drop function if exists public.${this.schema}_managed_product(bigint);drop schema if exists ${this.schema} cascade;`);}
}
module.exports={ShopHarness,BASE,ROOT};
