/* Isolated public-cloud protocol tests. Zero live network/database. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..');
const seed={};for(const [k,f]of Object.entries({products:'products',categories:'categories',courses:'site-courses',testimonials:'site-testimonials',reviews:'reviews'}))seed[k]=JSON.parse(fs.readFileSync(path.join(ROOT,'data',f+'.json')));
seed.settings=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT,'data/site-settings.json'))).map(x=>[x.key,x.value]));
const SRC=fs.readFileSync(path.join(ROOT,'source/js/site-cloud.js'),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
function backend(){return {rows:new Map(),writes:[],reads:0,fail:0,readFail:0,ack:null,hold:null,lostAck:false};}
function boot(server=backend(),stored={}){
 const memory=new Map(Object.entries(stored)),timeouts=new Set(),events={};
 if(!memory.has('puttclub_web_auth_v1'))memory.set('puttclub_web_auth_v1',JSON.stringify({access_token:'synthetic-jwt',refresh_token:'synthetic-refresh',expires_at:9999999999,user:{app_metadata:{web_admin:true}}}));
 if(!memory.has('puttclub_admin'))memory.set('puttclub_admin',JSON.stringify({id:900,email:'synthetic@test.invalid'}));
 const ctx=vm.createContext({console,URL,URLSearchParams,Response,Headers,Request,TextEncoder,AbortController,crypto:webcrypto,
  setTimeout:(fn,ms)=>{const id=setTimeout(fn,ms);timeouts.add(id);return id;},clearTimeout:id=>{clearTimeout(id);timeouts.delete(id);},setInterval:()=>0,
  localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)},
  sessionStorage:{getItem:k=>memory.get('session:'+k)??null,setItem:(k,v)=>memory.set('session:'+k,String(v))},
  location:{origin:'https://site.test',href:'https://site.test/admin/site/',pathname:'/admin/site/',search:''},
  addEventListener:(e,f)=>{(events[e]??=[]).push(f)},confirm:()=>true,
  PC_SITE_CLOUD_CONFIG:{url:'https://mock-cloud.test',key:'publishable-test-only',seed:plain(seed),exportedSlugs:seed.products.map(p=>p.slug),defaultGateCode:'B',adminEmail:'admin@puttclub.ir'},
  fetch:async(url,init={})=>{
   if(!String(url).startsWith('https://mock-cloud.test/'))return new Response('{}',{status:404});
   if(String(url).includes('/auth/v1/')){
    const data=JSON.parse(init.body||'{}');
    if(String(url).includes('/token')){
     if(String(url).includes('grant_type=password') && (data.email!=='admin@puttclub.ir'||data.password!=='Synthetic-Password-123'))return new Response(JSON.stringify({error:'invalid_grant'}),{status:400});
     return new Response(JSON.stringify({access_token:'synthetic-jwt',refresh_token:'synthetic-refresh',expires_in:3600,user:{id:'web-admin',email:'admin@puttclub.ir',app_metadata:{web_admin:true},user_metadata:{name:'مدیر آزمایشی'}}}),{status:200});
    }
    return new Response(JSON.stringify({ok:true}),{status:200});
   }
   if(String(url).includes('/rest/v1/')){
    server.reads++;if(server.readFail)return new Response(JSON.stringify({err:'mock read failure'}),{status:server.readFail});
    const u=new URL(url),off=+u.searchParams.get('offset')||0,limit=+u.searchParams.get('limit')||1000;
    assert.match(u.searchParams.get('k'),/^like\.web_/,'Never read academy/member keys');
    return new Response(JSON.stringify([...server.rows.values()].filter(x=>x.k.startsWith('web_')).slice(off,off+limit)),{status:200});
   }
   const payload=JSON.parse(init.body);server.writes.push(payload);
   if(server.hold){const h=server.hold;server.hold=null;await h;}
   if(server.fail)return new Response(JSON.stringify({ok:false,err:'mock rejected'}),{status:server.fail});
   if(server.ack)return new Response(JSON.stringify(server.ack),{status:200});
   if(!init.headers.Authorization)return new Response(JSON.stringify({ok:false,code:'WEB_AUTH_REQUIRED'}),{status:401});
   const saved=[];
   for(const row of payload.rows){
    if((server.rows.get(row.k)?.updated_at||null)!==row.base)return new Response(JSON.stringify({ok:false,code:'CONFLICT'}),{status:409});
    const updated_at=new Date().toISOString();server.rows.set(row.k,{k:row.k,v:plain(row.v),updated_at});saved.push({k:row.k,updated_at});
   }
   if(server.lostAck){server.lostAck=false;throw new TypeError('lost response');}
   return new Response(JSON.stringify({ok:true,put:payload.rows.length,del:0,rows:saved}),{status:200});
  }
 });ctx.window=ctx;
 vm.runInContext(SRC,ctx);
 const api=async(p,method='GET',body)=>{
  const r=await ctx.PC_SITE_CLOUD.request('https://site.test'+p,{method,body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,ok:r.ok,data:await r.json()};
 };
 return {ctx,memory,server,cloud:ctx.PC_SITE_CLOUD,api,close:()=>timeouts.forEach(clearTimeout)};
}
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name)}
(async()=>{
 await test('Fresh public visitor reads cloud only; no seeded data is auto-published',async()=>{
  const b=boot();try{b.ctx.location.pathname='/';b.ctx.location.href='https://site.test/';b.memory.delete('puttclub_admin');await b.api('/api/site/content');assert.equal(b.server.writes.length,0);assert.equal(b.cloud.settings().shopGate.enabled,true);const r=await b.api('/api/admin/site/settings','PUT',{key:'hero',value:{line1:'not allowed'}});assert.equal(r.status,401);assert.equal(b.server.writes.length,0);}finally{b.close();}
 });
 await test('A saved setting is read in a fresh isolated second device, not from its localStorage',async()=>{
  const server=backend(),a=boot(server),b=boot(server);try{await a.api('/api/admin/site/settings');const r=await a.api('/api/admin/site/settings','PUT',{key:'hero',value:{...seed.settings.hero,line1:'عنوان ابری آزمایشی'}});assert.equal(r.ok,true);await b.api('/api/site/content');assert.equal(b.cloud.settings().hero.line1,'عنوان ابری آزمایشی');assert.equal(a.cloud.status().pending.length,0);assert.equal(server.writes.length,1);}finally{a.close();b.close();}
 });
 await test('Local admin marker alone cannot publish; cloud sign-in resumes the retained draft',async()=>{
  const b=boot();try{b.memory.delete('puttclub_web_auth_v1');await b.api('/api/admin/site/settings');const r=await b.api('/api/admin/site/settings','PUT',{key:'hero',value:{line1:'Auth required'}});assert.equal(r.status,401);assert.equal(b.cloud.status().pending.length,1);assert.equal(b.server.writes.length,0);await assert.rejects(b.cloud.signInAdmin('admin','wrong'));await b.cloud.signInAdmin('admin','Synthetic-Password-123');await b.cloud.flush();assert.equal(b.cloud.status().pending.length,0);assert.ok(b.server.writes[0].rows[0].base===null);assert.equal(JSON.stringify(b.server.writes).includes('Synthetic-Password'),false);}finally{b.close();}
 });
 await test('Expired cloud session refreshes without losing the queued public edit',async()=>{
  const b=boot();try{const session=JSON.parse(b.memory.get('puttclub_web_auth_v1'));session.expires_at=1;b.memory.set('puttclub_web_auth_v1',JSON.stringify(session));const r=await b.api('/api/admin/site/settings','PUT',{key:'hero',value:{line1:'Refreshed'}});assert.equal(r.ok,true);assert.ok(JSON.parse(b.memory.get('puttclub_web_auth_v1')).expires_at>Date.now()/1000);}finally{b.close();}
 });
 await test('Every setting section is an independent record; editing hero cannot reset contact or gate',async()=>{
  const b=boot();try{await b.api('/api/admin/site/settings');await b.api('/api/admin/site/settings','PUT',{key:'contact',value:{...seed.settings.contact,address:'نشانی ابری'}});await b.api('/api/admin/site/settings','PUT',{key:'hero',value:{...seed.settings.hero,line2:'آزمایشی'}});assert.equal(b.cloud.settings().contact.address,'نشانی ابری');assert.equal(b.cloud.settings().shopGate.enabled,true);assert.equal(b.server.rows.size,2);}finally{b.close();}
 });
 await test('500/401/403/413 reject success and retain the exact pending edit across reload',async()=>{
  for(const status of [500,401,403,413]){
   const server=backend(),b=boot(server);let fresh;
   try{await b.api('/api/admin/site/settings');server.fail=status;const value={...seed.settings.hero,line1:'حفظ شود '+status};const r=await b.api('/api/admin/site/settings','PUT',{key:'hero',value});assert.equal(r.ok,false);assert.equal(r.status,status);assert.equal(b.cloud.status().pending.length,1);assert.equal(b.cloud.settings().hero.line1,seed.settings.hero.line1,'Unconfirmed draft is not public');
    fresh=boot(server,Object.fromEntries(b.memory));const read=await fresh.api('/api/admin/site/settings');assert.equal(read.data.settings.hero.line1,value.line1);assert.equal(fresh.cloud.status().pending.length,1);
    server.fail=0;await fresh.cloud.flush();assert.equal(fresh.cloud.status().pending.length,0);assert.equal(fresh.cloud.settings().hero.line1,value.line1);
   }finally{b.close();fresh?.close();}
  }
 });
 await test('HTTP 200 requires exact positive write acknowledgment',async()=>{
  for(const ack of [{},{ok:true,put:0,del:0},{ok:false,put:1},{ok:true,put:2}]){
   const b=boot();try{b.server.ack=ack;const r=await b.api('/api/admin/site/settings','PUT',{key:'hero',value:{line1:'نگه دار'}});assert.equal(r.ok,false);assert.equal(b.cloud.status().pending.length,1);}finally{b.close();}
  }
 });
 await test('A successful read or connection check does not hide a rejected write',async()=>{
  const b=boot();try{b.server.fail=500;await b.api('/api/admin/site/settings','PUT',{key:'hero',value:{line1:'در صف'}});await b.cloud.pull(true);assert.equal(b.cloud.status().pending.length,1);assert.ok(b.cloud.status().error);assert.equal(b.cloud.settings(true).hero.line1,'در صف');}finally{b.close();}
 });
 await test('A lost ACK is recovered by exact stored-value readback, not by blind queue clearing',async()=>{
  const b=boot();try{b.server.lostAck=true;const r=await b.api('/api/admin/site/settings','PUT',{key:'hero',value:{line1:'ACK lost'}});assert.equal(r.ok,false);assert.equal(b.cloud.status().pending.length,1);assert.equal(b.server.rows.size,1);await b.cloud.flush();assert.equal(b.cloud.status().pending.length,0);assert.equal(b.server.writes.length,1);}finally{b.close();}
 });
 await test('A newer edit during an old write survives and is the final published version',async()=>{
  const b=boot();let release;try{await b.api('/api/admin/site/settings');b.server.hold=new Promise(r=>release=r);const first=b.api('/api/admin/site/settings','PUT',{key:'hero',value:{line1:'old edit'}});while(!b.server.writes.length)await new Promise(r=>setTimeout(r,1));const second=b.api('/api/admin/site/settings','PUT',{key:'hero',value:{line1:'new edit'}});release();await Promise.all([first,second]);assert.equal(b.cloud.settings().hero.line1,'new edit');assert.equal(b.cloud.status().pending.length,0);}finally{release?.();b.close();}
 });
 await test('Stale same-section edits are stopped as conflicts; other sections remain independently writable',async()=>{
  const server=backend(),a=boot(server),b=boot(server);try{await a.api('/api/admin/site/settings');await b.api('/api/admin/site/settings');await a.api('/api/admin/site/settings','PUT',{key:'hero',value:{line1:'version A'}});const r=await b.api('/api/admin/site/settings','PUT',{key:'hero',value:{line1:'version B'}});assert.equal(r.status,409);assert.equal(b.cloud.status().pending.length,1);assert.equal(server.rows.get('web_setting_hero').v.line1,'version A');const c=await b.api('/api/admin/site/settings','PUT',{key:'contact',value:{address:'Independent'}});assert.equal(c.ok,true);assert.equal(server.rows.get('web_setting_contact').v.address,'Independent');assert.equal(b.cloud.status().pending.length,1);await b.cloud.resolvePending();assert.equal(server.rows.get('web_setting_hero').v.line1,'version B');}finally{a.close();b.close();}
 });
 await test('An oversized value stays intact in the queue and never makes a doomed HTTP request',async()=>{
  const b=boot();try{const value={line1:'x'.repeat(2*1024*1024)};const r=await b.api('/api/admin/site/settings','PUT',{key:'hero',value});assert.equal(r.status,413);assert.equal(b.server.writes.length,0);assert.equal(b.cloud.settings(true).hero.line1.length,value.line1.length);}finally{b.close();}
 });
 await test('Old local-only settings remain available but never silently overwrite a published setting',async()=>{
  const b=boot(backend(),{'puttclub_demo_site-settings':JSON.stringify({hero:{line1:'legacy local'},contact:{address:'legacy address'}})});
  try{const initial=await b.api('/api/admin/site/settings');assert.equal(initial.data.settings.hero.line1,'legacy local');assert.equal(b.server.writes.length,0);assert.equal(b.cloud.settings().hero.line1,seed.settings.hero.line1);b.server.rows.set('web_setting_hero',{k:'web_setting_hero',v:{line1:'already published'},updated_at:'2026-09-26T12:00:00Z'});await b.cloud.importLegacy();assert.equal(b.server.rows.get('web_setting_hero').v.line1,'already published');assert.equal(b.server.rows.get('web_setting_contact').v.address,'legacy address');assert.ok(b.memory.has('puttclub_demo_site-settings'));}finally{b.close();}
 });
 await test('Products and categories update from cloud, including a new product URL on the static host',async()=>{
  const b=boot();try{const p={...seed.products[0],name:'Synthetic product',slug:'synthetic-product',price:12345};const r=await b.api('/api/admin/products','POST',p);assert.equal(r.ok,true);const id=r.data.product.id;assert.ok(id>10);assert.ok(b.cloud.productHref(r.data.product).includes('?item=synthetic-product'));const x=await b.api('/api/admin/products/'+id,'PUT',{name:'Changed',stock:3});assert.equal(x.ok,true);assert.equal(b.cloud.table('products').find(p=>p.id===id).name,'Changed');await b.api('/api/admin/products/'+id,'DELETE');assert.equal(b.cloud.table('products').some(p=>p.id===id),false);assert.equal(b.server.rows.get('web_product_'+id).v._deleted,true);}finally{b.close();}
 });
 await test('Deleting every course remains empty; seeds cannot resurrect deleted records on a new device',async()=>{
  const server=backend(),a=boot(server),b=boot(server);try{await a.api('/api/admin/site/courses');for(const c of seed.courses){const r=await a.api('/api/admin/site/courses/'+c.id,'DELETE');assert.equal(r.ok,true);}await b.api('/api/site/courses');assert.equal(b.cloud.table('courses').length,0);assert.ok([...server.rows.values()].every(r=>r.v._deleted===true));}finally{a.close();b.close();}
 });
 await test('Hiding a course is retained in admin but absent publicly',async()=>{
  const b=boot();try{await b.api('/api/admin/site/courses');const r=await b.api('/api/admin/site/courses/1','PUT',{isActive:false});assert.equal(r.ok,true);assert.equal(b.cloud.table('courses').some(x=>x.id===1),false);assert.equal(b.cloud.table('courses',true).find(x=>x.id===1).isActive,false);}finally{b.close();}
 });
 await test('Feedback publication strips private phone/email and pending content is not uploaded',async()=>{
  const b=boot();try{const r=await b.api('/api/admin/site/testimonials/1','PUT',{status:'approved',text:'Public test feedback',phone:'PRIVATE_PHONE',email:'PRIVATE_EMAIL',password:'PRIVATE_PASSWORD'});assert.equal(r.ok,true);const sent=JSON.stringify(b.server.writes);assert.ok(!sent.includes('PRIVATE_'));const rejected=await b.api('/api/admin/site/testimonials/1','PUT',{status:'rejected'});assert.equal(rejected.ok,true);assert.equal(b.cloud.table('testimonials').some(x=>x.id===1),false);assert.equal(b.cloud.table('testimonials',true).find(x=>x.id===1).status,'rejected');}finally{b.close();}
 });
 await test('Protected academy, credentials, accounts and orders cannot enter the public queue',async()=>{
  const b=boot();try{for(const key of ['ga_users','ga_player_users','ga_academy','puttclub_local_users','web_unknown_1'])await assert.rejects(b.cloud.publish(key,{password:'private'}),/غیرمجاز/);assert.equal(b.server.writes.length,0);assert.equal(b.cloud.status().pending.length,0);}finally{b.close();}
 });
 await test('Gate enabled state is preserved; custom code is hashed, blank saves do not reset it',async()=>{
  const server=backend(),a=boot(server),b=boot(server);try{await a.api('/api/admin/site/settings');const r=await a.api('/api/admin/site/settings','PUT',{key:'shopGate',value:{...seed.settings.shopGate,code:'SyntheticCode9'}});assert.equal(r.ok,true);assert.equal(JSON.stringify(server.writes).includes('SyntheticCode9'),false);assert.equal(a.cloud.settings().shopGate.enabled,true);const admin=await a.api('/api/admin/site/settings');assert.equal(admin.data.settings.shopGate.code,'');await a.api('/api/admin/site/settings','PUT',{key:'shopGate',value:{...admin.data.settings.shopGate,title:'New lock title',code:''}});await b.cloud.pull(true);assert.equal((await b.api('/api/site/shop-gate/unlock','POST',{attempt:'wrong'})).data.ok,false);assert.equal((await b.api('/api/site/shop-gate/unlock','POST',{attempt:'SyntheticCode9'})).data.ok,true);assert.equal(b.cloud.settings().shopGate.code,undefined);}finally{a.close();b.close();}
 });
 await test('Gate cannot be unlocked with the default shortcut during a failed initial cloud read',async()=>{
  const b=boot();try{b.server.readFail=500;const r=await b.api('/api/site/shop-gate/unlock','POST',{attempt:'B'});assert.equal(r.ok,false);assert.equal(b.cloud.settings().shopGate.enabled,true);}finally{b.close();}
 });
 await test('A normal home menu URL is valid and survives a second-device read',async()=>{
  const server=backend(),a=boot(server),b=boot(server);try{await a.api('/api/admin/site/settings');const menu=plain(seed.settings.menu);menu[0].label='خانهٔ ابری';assert.equal((await a.api('/api/admin/site/settings','PUT',{key:'menu',value:menu})).ok,true);await b.cloud.pull(true);assert.equal(b.cloud.settings().menu[0].href,'/');assert.equal(b.cloud.settings().menu[0].label,'خانهٔ ابری');}finally{a.close();b.close();}
 });
 await test('A category rename stages every affected public record before network failure',async()=>{
  const b=boot();try{await b.api('/api/admin/categories');const old=seed.categories[0].name,n=seed.products.filter(p=>p.category===old).length;b.server.fail=500;const r=await b.api('/api/admin/categories/'+encodeURIComponent(old),'PUT',{name:'گروه ابری',description:'آزمایشی'});assert.equal(r.ok,false);assert.equal(b.cloud.status().pending.length,n+1);b.server.fail=0;await b.cloud.flush();assert.equal(b.cloud.table('products').some(p=>p.category===old),false);assert.equal(b.cloud.table('products').filter(p=>p.category==='گروه ابری').length,n);}finally{b.close();}
 });
 await test('Product deletion also tombstones its public reviews',async()=>{
  const b=boot();try{await b.api('/api/admin/products');assert.equal((await b.api('/api/admin/products/1','DELETE')).ok,true);assert.equal(b.cloud.table('reviews').some(r=>r.productId===1),false);}finally{b.close();}
 });
 await test('Deleting a rejected locally held testimonial does not resurrect it on reload',async()=>{
  const b=boot();let fresh;try{await b.api('/api/admin/site/testimonials');await b.api('/api/admin/site/testimonials/1','PUT',{status:'rejected'});assert.equal((await b.api('/api/admin/site/testimonials/1','DELETE')).ok,true);fresh=boot(b.server,Object.fromEntries(b.memory));const r=await fresh.api('/api/admin/site/testimonials');assert.equal(r.data.testimonials.some(t=>t.id===1),false);}finally{b.close();fresh?.close();}
 });
 await test('Unsafe menu URLs and invalid theme values are rejected before writing',async()=>{
  const b=boot();try{assert.equal((await b.api('/api/admin/site/settings','PUT',{key:'menu',value:[{label:'bad',href:'javascript:alert(1)'}]})).status,422);assert.equal((await b.api('/api/admin/site/settings','PUT',{key:'theme',value:{gold500:'url(secret)'}})).status,422);assert.equal(b.server.writes.length,0);}finally{b.close();}
 });
 console.log(`PASS — ${passed} public-cloud scenarios; zero live requests.`);
})().catch(e=>{console.error(e);process.exitCode=1});
