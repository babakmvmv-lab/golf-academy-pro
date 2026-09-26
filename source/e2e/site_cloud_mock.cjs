const BASE=process.env.BASE_URL||'http://127.0.0.1:8000';
class MockPublicCloud{
 constructor(){this.rows=new Map();this.writes=[];this.reads=0;this.failStatus=0;this.failRead=0;this.blocked=[];this.authCalls=[];}
 async attach(context){
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin!==new URL(BASE).origin){this.blocked.push(u.hostname);return route.abort('blockedbyclient');}
   const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'Cache-Control':'no-store'}});
   if(u.pathname.startsWith('/__qa_cloud/auth/v1/')){
    this.authCalls.push({path:u.pathname,method:req.method()});
    if(u.pathname.endsWith('/token')){
     const data=req.postDataJSON();
     if(u.searchParams.get('grant_type')==='password' && (data.email!=='admin@puttclub.ir'||data.password!=='Synthetic-Password-123'))return reply(400,{error:'invalid_grant'});
     return reply(200,{access_token:'synthetic-jwt',refresh_token:'synthetic-refresh',expires_in:3600,user:{id:'synthetic-web-admin',email:'admin@puttclub.ir',app_metadata:{web_admin:true},user_metadata:{name:'مدیر آزمایشی'}}});
    }
    if(u.pathname.endsWith('/user'))return reply(200,{id:'synthetic-web-admin',app_metadata:{web_admin:true}});
    return reply(200,{ok:true});
   }
   if(u.pathname.startsWith('/__qa_cloud/rest/v1/web_store')){
    this.reads++;if(this.failRead)return reply(this.failRead,{err:'mock read failure'});
    const offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||1000);
    const list=[...this.rows.values()].filter(r=>r.k.startsWith('web_')).sort((a,b)=>a.k.localeCompare(b.k));
    return reply(200,list.slice(offset,offset+limit));
   }
   if(u.pathname==='/__qa_cloud/functions/v1/web-sync'){
    const payload=req.postDataJSON();this.writes.push(payload);
    if(this.failStatus)return reply(this.failStatus,{ok:false,err:'mock write rejected'});
    if(!req.headers()['authorization'])return reply(401,{ok:false,code:'WEB_AUTH_REQUIRED'});
    const saved=[];
    for(const row of payload.rows||[]){
     if((this.rows.get(row.k)?.updated_at||null)!==row.base)return reply(409,{ok:false,code:'CONFLICT'});
     const updated_at=new Date().toISOString();this.rows.set(row.k,{k:row.k,v:JSON.parse(JSON.stringify(row.v)),updated_at});saved.push({k:row.k,updated_at});
    }
    return reply(200,{ok:true,put:payload.rows.length,del:0,rows:saved});
   }
   return route.continue();
  });
 }
}
module.exports={MockPublicCloud,BASE};
