/* Public storefront persistence. Same Supabase project; independent web_store, web-sync, authentication and outbox.
 * Only public content is published. Never mirror accounts, passwords, customer orders,
 * pending submissions or phone numbers from customer feedback into public web_store.
 * Website publication requires a verified Supabase Auth administrator, checked again by web-sync.
 */
(function(){
  'use strict';
  const C=window.PC_SITE_CLOUD_CONFIG;
  if(!C || window.PC_SITE_CLOUD) return;
  const nativeFetch=window.fetch.bind(window), PFX='web_';
  const CACHE='puttclub_cloud_cache_v1', QUEUE='puttclub_cloud_outbox_v1', ERR='puttclub_cloud_error_v1', AUTH='puttclub_web_auth_v1';
  const MAX_BYTES=2*1024*1024, TIMEOUT=20000;
  const GROUPS={products:'product',categories:'category',courses:'course',testimonials:'testimonial',reviews:'review'};
  const LEGACY={products:'products',categories:'categories',courses:'site-courses',testimonials:'site-testimonials',reviews:'reviews'};
  const SETTING_KEYS=Object.keys(C.seed.settings);
  const settingKey=k=>PFX+'setting_'+k.replace(/[A-Z]/g,x=>'_'+x.toLowerCase());
  const settingNames=Object.fromEntries(SETTING_KEYS.map(k=>[settingKey(k),k]));
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const clone=o=>JSON.parse(JSON.stringify(o));
  const stable=o=>JSON.stringify(o,(_,v)=>v && typeof v==='object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a,k)=>{if(!['__proto__','constructor','prototype'].includes(k))a[k]=v[k];return a;},{}) : v);
  const same=(a,b)=>stable(a)===stable(b);
  const json=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v===null ? f : v;}catch(e){return f;}};
  const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}};
  const error=(message,status=503,code='')=>Object.assign(new Error(message),{status,code});
  const safeObject=v=>v && typeof v==='object' && !Array.isArray(v);
  let rows=json(CACHE,{}), queue=json(QUEUE,{}), lastError=json(ERR,null);
  if(!safeObject(rows)) rows={};if(!safeObject(queue)) queue={};
  let readFlight=null, pushFlight=null, booted=false, lastRead=0, serial=0, retryTimer=null, backoff=5000, revision=0, resumed=false;
  const listeners=new Set(), editBase={};
  let phase='loading', lastAck='', statusNode=null, statusSignature='', writeEpoch=0, authFlight=null;
  function isAdmin(){const a=json('puttclub_admin',null);return !!(a && typeof a.email==='string' && a.email.length>3 && /^\/admin(?:\/|$)/.test(location.pathname));}
  function descriptor(key){
    if(own(settingNames,key))return {kind:'settings',id:settingNames[key]};
    for(const kind of Object.keys(GROUPS)){
      const pre=PFX+GROUPS[kind]+'_';
      if(key.startsWith(pre) && /^\d+$/.test(key.slice(pre.length)) && Number.isSafeInteger(+key.slice(pre.length))) return {kind,id:+key.slice(pre.length)};
    }
    return null;
  }
  const keyFor=(kind,id)=>kind==='settings' ? settingKey(id) : PFX+GROUPS[kind]+'_'+id;
  const stampFor=k=>rows[k] && rows[k].updated_at || null;
  function notify(){revision++;listeners.forEach(fn=>{try{fn();}catch(e){}});renderStatus();}
  function fail(e,key,operation='write'){lastError={message:e.message,status:e.status||0,code:e.code||'',key:key||'',operation,at:new Date().toISOString()};put(ERR,lastError);phase='error';renderStatus();}
  function ackError(key){if(lastError && (!lastError.key || lastError.key===key)){lastError=null;put(ERR,null);}}
  async function request(url,init={}){
    const ctl=new AbortController();let timeout=false;
    const tm=setTimeout(()=>{timeout=true;ctl.abort();},TIMEOUT);
    try{
      const res=await nativeFetch(url,{...init,signal:ctl.signal,cache:'no-store'}),text=await res.text();
      let body;try{body=JSON.parse(text);}catch(e){throw error('پاسخ سرور JSON معتبر نیست؛ ذخیره تأیید نشد.',res.status);}
      if(!res.ok){
        const authMessage=body.code==='WEB_AUTH_REQUIRED'?'نشست ابری معتبر نیست؛ دوباره وارد شوید. تغییرات محفوظ‌اند.':body.code==='WEB_ADMIN_REQUIRED'?'این حساب اجازهٔ انتشار سایت و فروشگاه ندارد.':'';
        const msg=authMessage || res.status===413 ? 'سرور حجم این بخش را نپذیرفت (HTTP 413). تغییرات در صف محفوظ است؛ سقف تابع web-sync باید روی Supabase به‌روز شود.' : 'خطای سرویس ابری (HTTP '+res.status+')؛ '+String(body.err||body.error||body.message||'ذخیره تأیید نشد.');
        throw error(msg,res.status,body.code||'');
      }
      return body;
    }catch(e){if(e.status)throw e;throw error(timeout ? 'مهلت پاسخ ابر تمام شد؛ تغییرات در صف محفوظ است.' : 'ارتباط با ابر برقرار نشد؛ تغییرات در همین دستگاه محفوظ است.',503,timeout?'TIMEOUT':'NETWORK');}
    finally{clearTimeout(tm);}
  }
  const headers=()=>({apikey:C.key,'Content-Type':'application/json'});
  function authSession(){const s=json(AUTH,null);return s && s.access_token && s.refresh_token ? s : null;}
  function saveAuth(data){
    if(!data?.access_token || !data?.refresh_token || data.user?.app_metadata?.web_admin!==true)throw error('این حساب مجوز مدیریت ابری سایت و فروشگاه را ندارد.',403,'WEB_ADMIN_REQUIRED');
    const s={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600),user:{id:data.user.id,email:data.user.email,app_metadata:{web_admin:true},name:data.user.user_metadata?.name||'مدیر سایت و فروشگاه'}};
    if(!put(AUTH,s))throw error('حافظهٔ مرورگر برای نگهداری نشست ورود در دسترس نیست.',507,'LOCAL_STORAGE');
    put('puttclub_admin',{id:s.user.id,email:s.user.email,name:s.user.name,cloud:true});
    if(lastError && ['WEB_AUTH_REQUIRED','WEB_ADMIN_REQUIRED'].includes(lastError.code)){lastError=null;put(ERR,null);}
    renderStatus();return s;
  }
  async function accessToken(){
    const s=authSession();if(!s)return null;
    if(s.expires_at>Date.now()/1000+60)return s.access_token;
    if(!authFlight)authFlight=request(C.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:headers(),body:JSON.stringify({refresh_token:s.refresh_token})}).then(saveAuth).catch(e=>{put(AUTH,null);throw error('نشست ابری منقضی شد؛ دوباره وارد شوید. صف تغییرات محفوظ است.',401,'WEB_AUTH_REQUIRED');}).finally(()=>{authFlight=null;});
    return (await authFlight).access_token;
  }
  async function signInAdmin(login,password){
    const email=String(login||'').trim().toLowerCase()==='admin' ? C.adminEmail : String(login||'').trim().toLowerCase();
    try{
      const data=await request(C.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:headers(),body:JSON.stringify({email,password})});
      const s=saveAuth(data);schedule();return {ok:true,user:{id:s.user.id,email:s.user.email,name:s.user.name,cloud:true}};
    }catch(e){if(e.code==='WEB_ADMIN_REQUIRED')throw e;throw error('ورود ابری انجام نشد؛ ایمیل و رمز مدیر سایت را بررسی کنید.',e.status||401,'WEB_AUTH_REQUIRED');}
  }
  function signOut(){
    const s=authSession();put(AUTH,null);try{localStorage.removeItem('puttclub_admin');}catch(e){}
    clearTimeout(retryTimer);renderStatus();
    if(s)nativeFetch(C.url+'/auth/v1/logout?scope=local',{method:'POST',headers:{...headers(),Authorization:'Bearer '+s.access_token}}).catch(()=>{});
  }
  async function changePassword(password){
    if(typeof password!=='string'||password.length<12)throw error('رمز جدید دست‌کم ۱۲ نویسه باشد.',422);
    const token=await accessToken();if(!token)throw error('ابتدا وارد فضای ابری سایت شوید.',401,'WEB_AUTH_REQUIRED');
    await request(C.url+'/auth/v1/user',{method:'PUT',headers:{...headers(),Authorization:'Bearer '+token},body:JSON.stringify({password})});
    return true;
  }
  function authDialog(mode='login'){
    const previous=document.getElementById('pc-web-auth-dialog');if(previous)previous.remove();
    const box=document.createElement('div');box.id='pc-web-auth-dialog';box.dir='rtl';
    box.style.cssText='position:fixed;inset:0;z-index:10010;display:grid;place-items:center;padding:16px;background:#020806dd;backdrop-filter:blur(8px);font-family:Vazirmatn,Tahoma,sans-serif';
    box.innerHTML='<form style="width:min(420px,100%);border:1px solid #c9a24b66;border-radius:18px;padding:24px;background:#0a1712;color:#f2ecdd" role="dialog" aria-modal="true" aria-labelledby="pc-auth-title"><h3 id="pc-auth-title" style="margin:0 0 12px;font-size:18px">'+(mode==='password'?'تغییر رمز مدیر سایت':'ورود ابری مدیر سایت و فروشگاه')+'</h3><p style="font-size:12px;color:#93aa9c;line-height:1.9">این ورود فقط برای فضای مستقل سایت و فروشگاه است؛ حساب آکادمی تغییر نمی‌کند.</p>'+(mode==='login'?'<label style="display:block;font-size:12px">ایمیل مدیر<input name="email" type="email" autocomplete="username" required style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #c9a24b44;border-radius:9px;background:#050d09;color:#f2ecdd;direction:ltr;margin:6px 0 12px"></label>':'')+'<label style="display:block;font-size:12px">'+(mode==='password'?'رمز جدید':'رمز')+'<input name="password" type="password" autocomplete="'+(mode==='password'?'new-password':'current-password')+'" required minlength="'+(mode==='password'?'12':'6')+'" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #c9a24b44;border-radius:9px;background:#050d09;color:#f2ecdd;direction:ltr;margin:6px 0 12px"></label>'+(mode==='password'?'<label style="display:block;font-size:12px">تکرار رمز جدید<input name="repeat" type="password" autocomplete="new-password" required style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #c9a24b44;border-radius:9px;background:#050d09;color:#f2ecdd;direction:ltr;margin:6px 0 12px"></label>':'')+'<p data-auth-error role="alert" style="font-size:12px;color:#ffd1a4"></p><div style="display:flex;gap:10px"><button type="submit" style="border:0;background:#c9a24b;color:#050d09;font:inherit;font-weight:bold;border-radius:10px;padding:9px 17px">'+(mode==='password'?'ثبت رمز جدید':'ورود و ادامهٔ ارسال')+'</button><button type="button" data-close style="border:1px solid #c9a24b66;background:transparent;color:#f2ecdd;border-radius:10px;font:inherit;padding:9px 15px">بستن</button></div></form>';
    document.body.appendChild(box);const form=box.querySelector('form');if(mode==='login')form.elements.email.value=C.adminEmail;
    box.querySelector('[data-close]').onclick=()=>box.remove();box.addEventListener('click',e=>{if(e.target===box)box.remove();});box.addEventListener('keydown',e=>{if(e.key==='Escape')box.remove();});
    form.onsubmit=async e=>{
      e.preventDefault();const btn=form.querySelector('[type=submit]'),note=box.querySelector('[data-auth-error]');btn.disabled=true;note.textContent='';
      try{
        if(mode==='password'){if(form.elements.password.value!==form.elements.repeat.value)throw error('دو رمز یکسان نیستند.',422);await changePassword(form.elements.password.value);form.reset();note.textContent='رمز جدید ثبت شد؛ فایل رمز موقت قبلی دیگر معتبر نیست.';}
        else{await signInAdmin(form.elements.email.value,form.elements.password.value);form.reset();box.remove();await flush();}
      }catch(ex){note.textContent=ex.message;}finally{btn.disabled=false;}
    };
    form.elements[mode==='login'?'email':'password'].focus();
  }

  async function pull(force=false){
    if(readFlight)return readFlight;
    if(!force && booted && Date.now()-lastRead<15000)return true;
    const epoch=writeEpoch;
    readFlight=(async()=>{
      try{
        const next={};let offset=0;
        while(true){
          const list=await request(C.url+'/rest/v1/web_store?select=k,v,updated_at&k=like.web_*&order=k.asc&limit=1000&offset='+offset,{headers:headers()});
          if(!Array.isArray(list))throw error('پاسخ خواندن تنظیمات معتبر نیست.');
          list.forEach(r=>{if(r && descriptor(r.k) && (safeObject(r.v) || settingNames[r.k] && Array.isArray(r.v)))next[r.k]=r;});
          if(list.length<1000)break;
          offset+=1000;if(offset>50000)throw error('حجم فهرست ابری غیرمنتظره است؛ دریافت کامل نشد.');
        }
        if(epoch!==writeEpoch)return true;
        if(lastError?.operation==='read'){lastError=null;put(ERR,null);}
        const changed=!same(rows,next);rows=next;put(CACHE,rows);booted=true;lastRead=Date.now();
        phase=Object.keys(queue).length?'pending':'ready';
        if(changed)notify();else renderStatus();
        return true;
      }catch(e){booted=true;fail(e,'','read');return false;}
    })().finally(()=>{readFlight=null;});
    return readFlight;
  }
  function rawFor(key,admin){return admin && queue[key] ? queue[key].value : rows[key] ? rows[key].v : undefined;}
  function settings(admin=false){
    const out=clone(C.seed.settings),legacy=admin ? json('puttclub_demo_site-settings',{}) : {};
    SETTING_KEYS.forEach(k=>{
      const key=settingKey(k);let v=rawFor(key,admin);
      if(v===undefined && admin && safeObject(legacy) && own(legacy,k))v=legacy[k];
      if(v!==undefined && !(v && v._deleted))out[k]=safeObject(out[k])&&safeObject(v)?{...out[k],...clone(v)}:clone(v);
    });
    if(out.shopGate){
      delete out.shopGate.code;
      if(admin)out.shopGate.code=rows[settingKey('shopGate')] && rows[settingKey('shopGate')].v.codeHash ? '' : String((legacy.shopGate||{}).code || C.defaultGateCode || 'B');
    }
    return out;
  }
  function table(kind,admin=false){
    let base=clone(C.seed[kind]||[]);
    if(admin){const legacy=json('puttclub_demo_'+LEGACY[kind],null);if(Array.isArray(legacy) && !Object.keys(rows).some(k=>descriptor(k)?.kind===kind))base=legacy;}
    const map=new Map(base.map(x=>[String(x.id),x]));
    const keys=new Set([...Object.keys(rows),...(admin?Object.keys(queue):[])]);
    keys.forEach(k=>{
      const d=descriptor(k);if(!d || d.kind!==kind)return;
      const v=rawFor(k,admin);if(!v)return;
      if(v._deleted || v.__del)map.delete(String(d.id));else map.set(String(d.id),clone(v));
    });
    if(admin && ['reviews','testimonials'].includes(kind)){
      const local=json(kind==='testimonials'?'puttclub_local_site_testimonials':'puttclub_local_reviews',[]);
      (Array.isArray(local)?local:[]).forEach(v=>{if(!map.has(String(v.id)) && !rawFor(keyFor(kind,v.id),true)?._deleted)map.set(String(v.id),{...v,status:v.status||'pending'});});
      const privateState=json('puttclub_private_moderation_v1',{});
      Object.values(privateState).filter(x=>x.kind===kind).forEach(x=>map.set(String(x.value.id),x.value));
    }
    let list=Array.from(map.values());
    if(kind==='courses')list.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
    if(!admin && kind==='courses')list=list.filter(x=>x.isActive!==false);
    if(kind==='testimonials' || kind==='reviews'){
      if(!admin)list=list.filter(x=>!x.status || x.status==='approved');
      if(!admin)list=list.map(x=>{const v={...x};delete v.phone;delete v.email;return v;});
    }
    return list;
  }
  function rememberBases(){
    const keys=new Set([...Object.keys(rows),...SETTING_KEYS.map(settingKey)]);
    Object.keys(GROUPS).forEach(kind=>table(kind,true).forEach(x=>keys.add(keyFor(kind,x.id))));
    keys.forEach(k=>{if(!queue[k])editBase[k]=stampFor(k);});
  }
  function mutateQueue(change){
    // Read-modify-write only the affected tokens: another tab's queue must not be replaced by an old in-memory snapshot.
    let latest=json(QUEUE,{});if(!safeObject(latest))latest={};
    change(latest);
    if(!put(QUEUE,latest))throw error('حافظهٔ مرورگر برای نگهداری تغییر کافی نیست. ذخیره ابری انجام نشد؛ اطلاعات مرورگر را پاک نکنید.',507,'LOCAL_STORAGE');
    queue=latest;
  }
  function stageEntries(entries){
    if(!isAdmin())throw error('ابتدا وارد پنل مدیریت شوید.',401,'ADMIN_REQUIRED');
    mutateQueue(latest=>entries.forEach(([key,value])=>{
      if(!descriptor(key))throw error('کلید غیرمجاز برای انتشار عمومی.',403,'PROTECTED_KEY');
      latest[key]={value:clone(value),base:latest[key]?latest[key].base:own(editBase,key)?editBase[key]:stampFor(key),token:Date.now()+'-'+(++serial)+'-'+Math.random().toString(36).slice(2)};
    }));
  }
  async function sendOne(key,force=false){
    const item=queue[key];if(!item)return true;
    if(!descriptor(key))throw error('این کلید متعلق به محتوای عمومی سایت نیست و ارسال نمی‌شود.',403,'PROTECTED_KEY');
    const access=await accessToken();
    if(!access)throw error('برای انتشار در فضای مستقل سایت، ورود ابری مدیر لازم است. تغییر شما در صف محفوظ است.',401,'WEB_AUTH_REQUIRED');
    if(!await pull(true))return false;
    if(same(rows[key]?.v,item.value)){
      mutateQueue(latest=>{if(latest[key]?.token===item.token)delete latest[key];});
      ackError(key);lastAck=new Date().toISOString();notify();return true;
    }
    if(!force && item.base!==stampFor(key))throw error('این بخش در دستگاه دیگری تغییر کرده است. نسخهٔ شما محفوظ است؛ قبل از انتشار، تعارض را در کادر ابر بررسی کنید.',409,'CONFLICT');
    const body=JSON.stringify({action:'kv',rows:[{k:key,v:item.value,base:item.base}]});
    if(new TextEncoder().encode(body).length>MAX_BYTES)throw error('حجم این بخش از سقف ۲ MiB بیشتر است. تغییرات محفوظ است؛ برای تصویر از نشانی فایل روی سایت استفاده کنید.',413,'LOCAL_SIZE');
    const result=await request(C.url+'/functions/v1/web-sync',{method:'POST',headers:{...headers(),Authorization:'Bearer '+access},body});
    if(!result || result.ok!==true || result.put!==1 || (result.del||0)!==0 || !Array.isArray(result.rows) || result.rows.length!==1 || result.rows[0].k!==key || !Number.isFinite(Date.parse(result.rows[0].updated_at)))throw error('سرور تعداد دقیق ردیف ذخیره‌شده را تأیید نکرد؛ تغییرات در صف ماند.',502,'BAD_ACK');
    const confirmedStamp=result.rows[0].updated_at;
    writeEpoch++;rows[key]={k:key,v:clone(item.value),updated_at:confirmedStamp};put(CACHE,rows);editBase[key]=confirmedStamp;
    mutateQueue(latest=>{
      if(latest[key]?.token===item.token)delete latest[key];
      else if(latest[key])latest[key].base=confirmedStamp; // newer local/tab edit survives the old ACK
    });
    ackError(key);lastAck=new Date().toISOString();notify();return true;
  }
  function schedule(){
    clearTimeout(retryTimer);if(!Object.keys(queue).length || !isAdmin() || !authSession())return;
    if(lastError && ['CONFLICT','LOCAL_SIZE','PROTECTED_KEY'].includes(lastError.code))return;
    retryTimer=setTimeout(()=>flush(),backoff);backoff=Math.min(120000,backoff*2);
  }
  function flush(){
    if(pushFlight)return pushFlight;
    if(!isAdmin())return Promise.resolve(false);
    const work=async()=>{
      rows=json(CACHE,rows);queue=json(QUEUE,queue);
      phase='sending';renderStatus();let ok=true,passes=0;
      do{
        queue=json(QUEUE,queue);const snapshot=Object.keys(queue);if(!snapshot.length)break;
        let advanced=false;
        for(const key of snapshot){
          try{if(await sendOne(key))advanced=true;else{ok=false;break;}}
          catch(e){ok=false;fail(e,key);if(e.code==='NETWORK'||e.code==='TIMEOUT')break;}
        }
        if(!advanced || !ok)break;
      }while(++passes<4 && Object.keys(queue).length);
      phase=Object.keys(queue).length ? (lastError?'error':'pending') : 'ready';
      if(!Object.keys(queue).length)backoff=5000;renderStatus();return ok && !Object.keys(queue).length;
    };
    pushFlight=(typeof navigator!=='undefined' && navigator.locks ? navigator.locks.request('puttclub-public-publisher-v1',work) : work()).finally(()=>{pushFlight=null;schedule();});
    return pushFlight;
  }
  async function publishBatch(entries){
    stageEntries(entries);phase='pending';renderStatus();await flush();
    if(entries.some(([key,value])=>queue[key]||!same(rows[key]?.v,value)))throw error(lastError?.message||'بخشی از تغییرات هنوز در صف است.',lastError?.status||503,lastError?.code||'PENDING');
  }
  async function publish(key,value){
    stageEntries([[key,value]]);phase='pending';renderStatus();await flush();
    if(!queue[key] && rows[key] && !same(rows[key].v,value))throw error('نسخهٔ جدیدتری از همین بخش ذخیره شده است؛ این پاسخ مربوط به تغییر قبلی است.',409,'SUPERSEDED');
    if(queue[key] || !same(rows[key]?.v,value))throw error(lastError?.message || 'نسخهٔ جدید هنوز تأیید نشده و در صف ارسال محفوظ است.',lastError?.status||503,lastError?.code||'PENDING');
    return clone(value);
  }
  const validUrl=v=>typeof v==='string' && (!v || v==='/' || /^(https?:\/\/|\/[^/]|#|mailto:|tel:|data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);)/i.test(v));
  function select(source,allowed){const out={};allowed.forEach(k=>{if(own(source,k))out[k]=clone(source[k]);});return out;}
  async function digest(text){
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function normalizeSetting(name,value){
    if(!SETTING_KEYS.includes(name))throw error('نام تنظیمات معتبر نیست.',422);
    if(name==='menu'){
      if(!Array.isArray(value))throw error('ساختار منو معتبر نیست.',422);
      return value.map(x=>{if(!x || !validUrl(x.href) || typeof x.label!=='string')throw error('عنوان یا نشانی منو معتبر نیست.',422);return{label:x.label,href:x.href,visible:x.visible!==false};});
    }
    if(!safeObject(value))throw error('ساختار تنظیمات معتبر نیست.',422);
    const allowed=Object.keys(C.seed.settings[name]);if(name==='brand')allowed.push('enShort');
    let out=select(value,allowed);
    if(name==='theme' && Object.values(out).some(x=>typeof x!=='string'||!/^#[0-9a-f]{3,8}$/i.test(x)))throw error('رنگ قالب باید کد رنگ معتبر باشد.',422);
    for(const k of ['logo','logoHd','image','siteUrl','instagramUrl','telegram','whatsapp'])if(own(out,k) && !validUrl(out[k]))throw error('نشانی '+k+' معتبر نیست.',422);
    if(name==='shopGate'){
      ['enabled','showOnShop','showOnCheckout'].forEach(k=>{if(own(out,k) && typeof out[k]!=='boolean')throw error('وضعیت قفل باید روشن یا خاموش باشد.',422);});
      const current=rawFor(settingKey(name),true)||{};
      let code=typeof value.code==='string'?value.code.trim():'';
      if(code && !/^[A-Za-z0-9]{1,20}$/.test(code))throw error('رمز قفل فقط حروف انگلیسی و عدد، حداکثر ۲۰ نویسه باشد.',422);
      if(code || !current.codeHash){code=code||C.defaultGateCode||'B';out.codeHash=await digest(code.toLowerCase());out.codeLength=code.length;}
      else{out.codeHash=current.codeHash;out.codeLength=current.codeLength;}
      delete out.code;
    }
    return out;
  }
  function normalizeRecord(kind,value,old){
    if(!safeObject(value))throw error('ساختار رکورد معتبر نیست.',422);
    const fields={
      products:['id','slug','name','category','price','oldPrice','shortDesc','description','features','images','rating','reviewCount','stock','badge','isNew','isFeatured','createdAt'],
      categories:['id','name','description','image','created_at'],
      courses:['id','title','subtitle','shortDesc','fullDesc','icon','images','galleryMode','layout','cardSize','titleColor','textColor','accentColor','titleSize','bodySize','bodyAlign','footerItems','socials','sortOrder','isActive','createdAt'],
      testimonials:['id','name','role','text','rating','status','createdAt'],
      reviews:['id','productId','author','rating','comment','status','createdAt']
    };
    const out=select({...old,...value},fields[kind]);
    if(!Number.isSafeInteger(+out.id) || +out.id<=0)throw error('شناسهٔ رکورد معتبر نیست.',422);out.id=+out.id;
    const title=kind==='courses'?'title':kind==='reviews'?'author':'name';
    if(typeof out[title]!=='string'||out[title].trim().length<2)throw error('عنوان یا نام رکورد را کامل وارد کنید.',422);
    if(kind==='products'){
      if(typeof out.slug!=='string'||!/^[\p{L}\p{N}_-]{2,120}$/u.test(out.slug))throw error('اسلاگ محصول معتبر نیست.',422);
      if(!Number.isFinite(+out.price)||+out.price<=0||!Number.isSafeInteger(+out.stock)||+out.stock<0)throw error('قیمت یا موجودی محصول معتبر نیست.',422);
      out.price=+out.price;out.stock=+out.stock;out.images=out.images?.length?out.images:['/images/academy-logo.jpg'];out.features=Array.isArray(out.features)?out.features:[];
      out.rating=Number.isFinite(+out.rating)?+out.rating:0;out.reviewCount=+out.reviewCount||0;
    }
    if(out.images && (!Array.isArray(out.images)||out.images.some(x=>!validUrl(x))))throw error('نشانی تصویر معتبر نیست.',422);
    if(own(out,'image') && out.image && !validUrl(out.image))throw error('نشانی تصویر معتبر نیست.',422);
    if((kind==='testimonials'||kind==='reviews') && out.status && out.status!=='approved')throw error('فقط دیدگاه تأییدشده قابل انتشار عمومی است؛ اطلاعات خصوصی یا بررسی‌نشده ابری نمی‌شود.',422,'PRIVATE_DATA');
    return out;
  }
  function newId(){return Date.now()*1000+Math.floor(Math.random()*1000);}
  const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
  function adminTable(kind){let list=table(kind,true);if(kind==='categories'){const p=table('products',true);list=list.map(c=>({...c,productCount:p.filter(x=>x.category===c.name).length}));}return list;}
  async function readAPI(path,admin){
    await pull();if(admin){rememberBases();if(!resumed){resumed=true;schedule();}}
    if(path==='/api/site/content' || path==='/api/admin/site/settings')return {settings:settings(admin),cloud:{readAt:lastRead,offline:!!lastError,pending:Object.keys(queue).length}};
    const kind=path.includes('/site/courses')?'courses':path.includes('/site/testimonials')?'testimonials':path.split('/').pop();
    if(GROUPS[kind])return {[kind]:admin?adminTable(kind):table(kind)};
    if(path==='/api/admin/stats'){
      const p=table('products',true),cats=new Map();p.forEach(x=>cats.set(x.category,(cats.get(x.category)||0)+1));
      const savedOrders=json('puttclub_local_orders',[]),savedUsers=json('puttclub_local_users',[]);
      const orders=Array.isArray(savedOrders)?savedOrders:[],users=Array.isArray(savedUsers)?savedUsers:[];
      return {products:p.length,orders:orders.length,users:users.length,reviews:table('reviews',true).length,revenue:orders.reduce((n,o)=>n+(Number.isFinite(+o.total)?+o.total:0),0),lowStock:[...p].sort((a,b)=>a.stock-b.stock).slice(0,5),recent:orders.slice(0,5),byCat:Array.from(cats,([category,n])=>({category,n})),privateDataUnavailable:true};
    }
    return null;
  }
  async function route(url,init={}){
    const path=url.pathname.replace(/\/$/,''),method=(init.method||'GET').toUpperCase(),admin=path.startsWith('/api/admin/');
    const matched=/^\/api\/(?:admin\/(?:site\/(?:settings|courses|testimonials)|products|categories|reviews|stats)(?:\/[^/]+)?|site\/(?:content|courses|shop-gate\/unlock))$/.test(path) || path==='/api/site/testimonials' && method==='GET';
    if(!matched)return null;
    try{
      if(admin && !isAdmin())return response({error:'ورود به مدیریت لازم است.'},401);
      if(method==='GET'){const body=await readAPI(path,admin);return response(body||{error:'مسیر پیدا نشد.'},body?200:404);}
      let body={};try{body=JSON.parse(init.body||'{}');}catch(e){throw error('درخواست JSON معتبر نیست.',400);}
      if(path==='/api/site/shop-gate/unlock'){
        if(!await pull())throw error('برای بررسی رمز قفل، اتصال به ابر لازم است.',503);
        const raw=rawFor(settingKey('shopGate'),false);
        const length=raw?.codeLength||(C.defaultGateCode||'B').length,expected=raw?.codeHash||await digest((C.defaultGateCode||'B').toLowerCase());
        const ok=await digest(String(body.attempt||'').slice(-length).toLowerCase())===expected;
        if(ok)try{sessionStorage.setItem('puttclub_shop_gate_revision',gateRevision());}catch(e){}
        return response({ok});
      }
      if(!admin)throw error('این عملیات مجاز نیست.',403);
      if(path==='/api/admin/site/settings' && method==='PUT'){
        const value=await normalizeSetting(body.key,body.value);await publish(settingKey(body.key),value);
        return response({ok:true,settings:settings(true)});
      }
      let kind=path.includes('/site/courses')?'courses':path.includes('/site/testimonials')?'testimonials':path.split('/')[3];
      if(!GROUPS[kind])throw error('این بخش مسیر ذخیرهٔ عمومی ندارد.',422);
      const collection=adminTable(kind),idPart=decodeURIComponent(path.split('/').length>(path.includes('/site/')?5:4)?path.split('/').pop():'');
      const old=kind==='categories'?collection.find(x=>x.name===idPart):collection.find(x=>String(x.id)===idPart);
      if(method!=='POST'&&!old)throw error('رکورد موردنظر پیدا نشد.',404);
      if(method==='DELETE'){
        if(kind==='categories' && table('products',true).some(p=>p.category===old.name))throw error('این دسته هنوز محصول دارد؛ ابتدا محصولات را جابه‌جا کنید.',409);
        const entries=[[keyFor(kind,old.id),{id:old.id,_deleted:true}]];
        if(kind==='products')table('reviews',true).filter(r=>+r.productId===+old.id).forEach(r=>entries.push([keyFor('reviews',r.id),{id:r.id,_deleted:true}]));
        await publishBatch(entries);
        const privateState=json('puttclub_private_moderation_v1',{});
        if(['testimonials','reviews'].includes(kind))delete privateState[kind+':'+old.id];
        if(kind==='products')Object.keys(privateState).forEach(k=>{if(privateState[k].kind==='reviews' && +privateState[k].value.productId===+old.id)delete privateState[k];});
        put('puttclub_private_moderation_v1',privateState);return response({ok:true});
      }
      if(!['POST','PUT'].includes(method))throw error('روش درخواست مجاز نیست.',405);
      if(['testimonials','reviews'].includes(kind) && ['pending','rejected'].includes(body.status)){
        await publish(keyFor(kind,old.id),{id:old.id,_deleted:true});
        const privateState=json('puttclub_private_moderation_v1',{}),v={...old,status:body.status};
        privateState[kind+':'+old.id]={kind,value:v};put('puttclub_private_moderation_v1',privateState);
        return response({ok:true,[kind==='testimonials'?'testimonial':'review']:v});
      }
      const value=normalizeRecord(kind,{...body,id:old?old.id:newId(),createdAt:old?.createdAt||new Date().toISOString()},old);
      if(kind==='products' && collection.some(x=>x.id!==value.id&&x.slug===value.slug))throw error('این اسلاگ متعلق به محصول دیگری است.',409);
      if(kind==='categories' && collection.some(x=>x.id!==value.id&&x.name===value.name))throw error('این دسته قبلاً وجود دارد.',409);
      if(kind==='categories' && old && old.name!==value.name){
        const entries=[[keyFor(kind,value.id),value],...table('products',true).filter(x=>x.category===old.name).map(p=>[keyFor('products',p.id),{...p,category:value.name}])];
        await publishBatch(entries);
      }else await publish(keyFor(kind,value.id),value);
      if(['testimonials','reviews'].includes(kind)){const st=json('puttclub_private_moderation_v1',{});delete st[kind+':'+value.id];put('puttclub_private_moderation_v1',st);}
      return response({ok:true,[{products:'product',categories:'category',courses:'course',testimonials:'testimonial',reviews:'review'}[kind]]:value});
    }catch(e){if(e.code!=='SUPERSEDED')fail(e);return response({ok:false,error:e.message,pending:Object.keys(queue).length>0,code:e.code||''},e.status||503);}
  }
  function apiFetch(input,init){
    let u;try{u=new URL(typeof input==='string'?input:input.url,location.href);}catch(e){return nativeFetch(input,init);}
    if(u.origin!==location.origin || !u.pathname.startsWith('/api/'))return nativeFetch(input,init);
    // Unhandled account/order APIs retain their original behavior; never mirror their payloads.
    return route(u,init||{}).then(result=>result || nativeFetch(input,init));
  };
  function applyTheme(s){
    if(typeof document==='undefined')return;
    const root=document.documentElement;
    Object.entries(s.theme||{}).forEach(([key,value])=>{if(/^#[0-9a-f]{3,8}$/i.test(value)){const css=key.replace(/(\D)(\d)/,'$1-$2');root.style.setProperty('--color-'+css,value);}});
    if(location.pathname==='/')document.title=s.brand.faName+' | '+s.brand.enName;
  }
  function liveState(React,kind,initial,options={}){
    const pair=React.useState(initial),first=React.useRef(initial);
    React.useEffect(()=>{
      let active=true;
      const refresh=()=>{
        let v=kind==='settings'?settings():table(kind);
        if(options.byPage){const slug=new URLSearchParams(location.search).get('item');const product=slug?table('products').find(x=>x.slug===slug):null;const id=slug?(product?.id||-1):options.productId;v=v.filter(x=>+x.productId===+id);}
        if(options.featured)v=v.filter(x=>x.isFeatured).slice(0,4);
        if(kind==='products')v=v.map(x=>({...x,image:x.images?.[0]||x.image||'/images/academy-logo.jpg'}));
        if(kind==='settings')applyTheme(v);
        if(active)pair[1](v);
      };
      const unsubscribe=subscribe(refresh);pull().then(refresh);
      return()=>{active=false;unsubscribe();};
    },[kind,options.byPage?location.href:'',options.productId||'',!!options.featured]);
    return pair;
  }
  function useTable(React,kind,initial,options){return liveState(React,kind,initial,options)[0];}
  function useProduct(React,initial){
    const list=useTable(React,'products',[initial]);
    const slug=new URLSearchParams(location.search).get('item')||initial.slug;
    const p=list.find(x=>x.slug===slug);
    const out=p||{...initial,name:'این محصول دیگر در فهرست فروش نیست',stock:0,_unavailable:true};
    React.useEffect(()=>{
      document.title=out.name+' | '+settings().brand.faShort;
      const nav=document.querySelector('main nav');
      if(nav){const last=nav.querySelector('span:last-child');if(last)last.textContent=out.name;const cat=nav.querySelector('a[href*="cat="]');if(cat){cat.textContent=out.category;cat.href='/shop/?cat='+encodeURIComponent(out.category);}}
    },[out.name,out.category]);
    return out;
  }
  function useProductReviewMeta(React,id,rating,count){
    const products=useTable(React,'products',[]),slug=new URLSearchParams(location.search).get('item');
    const p=products.find(x=>slug?x.slug===slug:x.id===id);
    return p?{id:p.id,rating:+p.rating||0,count:+p.reviewCount||0}:{id,rating,count};
  }
  function useCard(React,initial,index){
    const pair=React.useState(initial);
    React.useEffect(()=>{
      let active=true;
      const refresh=()=>{
        const list=table('products'),home=/^\/(?:index\.html)?$/.test(location.pathname);
        const p=home ? list.filter(x=>x.isFeatured).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[index] : list.find(x=>x.id===initial.id);
        if(active)pair[1](p?{...p,image:p.images?.[0]||p.image||'/images/academy-logo.jpg'}:{...initial,_hidden:true,stock:0});
      };
      const off=subscribe(refresh);pull().then(refresh);return()=>{active=false;off();};
    },[initial.id,index,location.pathname]);
    return pair[0];
  }
  function brandShort(b){return b.enShort || (b.enName===C.seed.settings.brand.enName ? 'Putt Club' : b.enName) || 'Putt Club';}
  function productHref(p){return C.exportedSlugs.includes(p.slug)?'/product/'+p.slug:'/product/'+C.exportedSlugs[0]+'/?item='+encodeURIComponent(p.slug);}
  function gateRevision(){const g=rawFor(settingKey('shopGate'),false);return g ? stable(g) : 'default-gate-v1';}
  function gateSessionValid(){try{return sessionStorage.getItem('puttclub_shop_unlocked')==='1' && sessionStorage.getItem('puttclub_shop_gate_revision')===gateRevision();}catch(e){return false;}}
  function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
  function legacyDrafts(){
    const result=[];const settingsDraft=json('puttclub_demo_site-settings',{});
    SETTING_KEYS.forEach(k=>{if(safeObject(settingsDraft)&&own(settingsDraft,k) && !same(settingsDraft[k],C.seed.settings[k]))result.push({kind:'settings',id:k,value:settingsDraft[k]});});
    for(const kind of ['products','categories','courses']){
      const old=json('puttclub_demo_'+LEGACY[kind],null);if(!Array.isArray(old))continue;
      const original=C.seed[kind]||[],ids=new Set(old.map(x=>String(x.id)));
      old.forEach(v=>{const base=original.find(x=>x.id===v.id);if(!same(v,base))result.push({kind,id:v.id,value:v});});
      original.forEach(v=>{if(!ids.has(String(v.id)))result.push({kind,id:v.id,value:{id:v.id,_deleted:true}});});
    }
    return result;
  }
  async function importLegacy(){
    if(!isAdmin())return;
    if(!confirm('تنظیمات و محتوای عمومیِ ذخیره‌شدهٔ قدیمیِ این مرورگر برای انتشار ابری آماده شود؟ اگر روی ابر نسخهٔ دیگری باشد تعارض اعلام می‌شود. اطلاعات مشتریان و رمز ورود منتقل نمی‌شوند.'))return;
    if(!await pull(true))return;
    const draft=legacyDrafts().filter(x=>!rows[keyFor(x.kind,x.id)]&&!queue[keyFor(x.kind,x.id)]);
    if(draft.some(x=>x.kind==='settings'&&x.id==='shopGate'&&x.value.enabled===false) && !confirm('در تنظیمات قدیمی این دستگاه، قفل فروشگاه خاموش است. انتشار همین وضعیت را تأیید می‌کنید؟'))return;
    for(const x of draft){
      try{
        const key=keyFor(x.kind,x.id),v=x.kind==='settings'?await normalizeSetting(x.id,x.value):x.value._deleted?x.value:normalizeRecord(x.kind,x.value,C.seed[x.kind].find(y=>y.id===x.id));
        mutateQueue(latest=>{if(!latest[key])latest[key]={value:v,base:null,token:'legacy-'+Date.now()+'-'+(++serial)};});
      }catch(e){fail(e);return;}
    }
    await flush();
  }
  async function resolvePending(){
    if(!isAdmin() || !await pull(true))return;
    const keys=Object.keys(queue);
    if(!keys.length)return;
    if(!confirm('تغییرات در انتظارِ همین دستگاه جایگزین نسخهٔ فعلیِ همین بخش‌ها روی ابر شود؟ قبل از تأیید می‌توانید از صف، فایل پشتیبان بگیرید.'))return;
    const tokens=Object.fromEntries(keys.map(k=>[k,queue[k].token]));
    mutateQueue(latest=>keys.forEach(k=>{if(latest[k]?.token===tokens[k])latest[k].base=stampFor(k);}));lastError=null;put(ERR,null);await flush();
  }
  function backup(){
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({format:'puttclub-public-draft-v1',at:new Date().toISOString(),pending:queue},null,2)],{type:'application/json'}));
    a.href=url;a.download='puttclub-public-pending.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function renderStatus(){
    if(typeof document==='undefined' || !document.body)return;
    if(!isAdmin()){if(statusNode)statusNode.hidden=true;return;}
    if(!statusNode){
      const style=document.createElement('style');style.textContent='#pc-site-cloud{position:fixed;bottom:12px;left:12px;z-index:9999;width:min(430px,calc(100vw - 24px));border:1px solid #c9a24b77;border-radius:15px;background:#0a1712f5;color:#eee5cf;padding:11px 14px;box-shadow:0 8px 34px #0006;direction:rtl;font:12px/1.9 Vazirmatn,Tahoma,sans-serif;backdrop-filter:blur(12px)}#pc-site-cloud[hidden]{display:none}#pc-site-cloud summary{cursor:pointer;font-weight:800}#pc-site-cloud p{margin:6px 0;color:#b4c6b8}#pc-site-cloud button{border:1px solid #c9a24b66;background:#c9a24b12;color:#f2d895;border-radius:8px;padding:4px 9px;cursor:pointer;font:inherit}#pc-site-cloud .pc-actions{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0}#pc-site-cloud .pc-error{color:#ffd1a4}#pc-site-cloud small{display:block;color:#93aa9c;line-height:1.8}';document.head.appendChild(style);
      statusNode=document.createElement('aside');statusNode.id='pc-site-cloud';statusNode.setAttribute('aria-label','وضعیت انتشار ابری سایت');document.body.appendChild(statusNode);
    }
    statusNode.hidden=false;
    const signed=!!authSession(),count=Object.keys(queue).length,legacy=legacyDrafts().filter(x=>!rows[keyFor(x.kind,x.id)]&&!queue[keyFor(x.kind,x.id)]).length;
    const title=!signed?'☁ برای انتشار، وارد فضای ابری سایت شوید':phase==='sending'?'☁ در حال ارسال به ابر…':count?'☁ '+count.toLocaleString('fa-IR')+' تغییر در انتظار انتشار':lastError?'☁ ارتباط ابری نیاز به بررسی دارد':legacy?'☁ '+legacy.toLocaleString('fa-IR')+' ذخیرهٔ قبلی آمادهٔ انتشار':lastRead?(lastAck?'☁ آخرین ارسال سایت تأیید شد':'☁ اتصال ابری سایت برقرار است'):'☁ در حال اتصال…';
    const sig=JSON.stringify({title,count,legacy,lastError,lastAck,signed});if(sig===statusSignature)return;statusSignature=sig;
    const open=statusNode.querySelector('details')?.open;
    const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    statusNode.innerHTML='<details '+(open||count||lastError||legacy||!signed?'open':'')+'><summary role="status">'+title+'</summary>'+(lastError?'<p class="pc-error" role="alert">'+esc(lastError.message)+'</p>':'')+'<p>پیام ذخیره فقط پس از تأیید سرور است. تغییر تأییدنشده در صف همین دستگاه می‌ماند.</p>'+(legacy?'<p>'+legacy.toLocaleString('fa-IR')+' بخش از ذخیره‌های قدیمی این مرورگر قابل بازیابی است.</p>':'')+'<div class="pc-actions"><button type="button" data-pc="auth">'+(signed?'تغییر رمز مدیر':'ورود ابری مدیر')+'</button><button type="button" data-pc="retry">ارسال دوباره</button><button type="button" data-pc="read">بررسی اتصال</button>'+(count?'<button type="button" data-pc="backup">پشتیبان صف</button>':'')+(lastError?.code==='CONFLICT'?'<button type="button" data-pc="resolve">انتشار نسخهٔ من</button>':'')+(legacy?'<button type="button" data-pc="legacy">انتشار ذخیره‌های قبلی</button>':'')+'</div><small>این ابر برای تنظیمات و محتوای عمومی است؛ حساب‌ها، سفارش‌ها و اطلاعات خصوصی مشتریان به این مخزن ارسال نمی‌شوند.</small></details>';
    statusNode.querySelector('[data-pc="auth"]').onclick=()=>authDialog(signed?'password':'login');
    statusNode.querySelector('[data-pc="retry"]').onclick=()=>flush();statusNode.querySelector('[data-pc="read"]').onclick=()=>pull(true);
    const b=statusNode.querySelector('[data-pc="backup"]');if(b)b.onclick=backup;
    const r=statusNode.querySelector('[data-pc="resolve"]');if(r)r.onclick=resolvePending;
    const l=statusNode.querySelector('[data-pc="legacy"]');if(l)l.onclick=importLegacy;
  }
  window.addEventListener('online',()=>{pull(true).then(()=>flush());});
  window.addEventListener('storage',e=>{
    if(e.key===CACHE){writeEpoch++;rows=json(CACHE,rows);notify();}
    if(e.key===QUEUE){queue=json(QUEUE,queue);renderStatus();}
  });
  window.addEventListener('focus',()=>{if(booted)pull(true);});
  setInterval(()=>{if(booted && !pushFlight && (typeof document==='undefined'||document.visibilityState!=='hidden'))pull(true);},45000);
  setInterval(renderStatus,1500);
  window.PC_SITE_CLOUD={signInAdmin,signOut,changePassword,authSession,authDialog,request:apiFetch,pull,flush,subscribe,settings,table,liveState,useTable,useProduct,useProductReviewMeta,useCard,brandShort,productHref,gateRevision,gateSessionValid,importLegacy,
    status:()=>({phase,pending:Object.keys(queue),error:lastError,lastRead,lastAck,revision}),
    publish,normalizeSetting,normalizeRecord,keyFor,resolvePending};
})();
