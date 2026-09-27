/* Item-based CMS editor + hydrated public marquee. Public web storage only. */
(function(){
 'use strict';
 const api=window.PC_SITE_CLOUD;if(!api)return;
 const MAX_ITEMS=40,MAX_TEXT=180,MIN_SPEED=20,MAX_SPEED=220,DEF_SPEED=70;
 const editors=new WeakMap();
 function defaults(){return window.PC_SITE_CLOUD_CONFIG.seed.settings.marquee;}
 function clean(value){
  if(!value||typeof value!=='object'||typeof value.enabled!=='boolean'||!Array.isArray(value.items)||value.items.length>MAX_ITEMS)throw Error('ساختار نوار معتبر نیست؛ حداکثر ۴۰ آیتم مجاز است.');
  const seen=new Set();
  const sp=value.speed;
  const speed=(typeof sp==='number'&&Number.isFinite(sp))?Math.min(MAX_SPEED,Math.max(MIN_SPEED,Math.round(sp))):DEF_SPEED;
  return {enabled:value.enabled,speed,items:value.items.map(x=>{
   if(!x||typeof x.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(x.id)||seen.has(x.id)||typeof x.text!=='string'||!x.text.trim()||x.text.trim().length>MAX_TEXT||typeof x.visible!=='boolean')throw Error('متن هر آیتم باید بین ۱ تا ۱۸۰ نویسه باشد؛ ردیف خالی را کامل یا حذف کنید.');
   seen.add(x.id);return {id:x.id,text:x.text.trim(),visible:x.visible};
  })};
 }
 function style(){
  if(document.getElementById('pc-marquee-style'))return;
  const el=document.createElement('style');el.id='pc-marquee-style';
  el.textContent='.pc-mq-editor{color:#f2ecdd;min-width:0}.pc-mq-editor h2{font-size:16px;font-weight:850;margin:0;color:#f2ecdd}.pc-mq-editor p{font-size:12px;line-height:2;color:#93aa9c;margin:8px 0 14px}.pc-mq-head,.pc-mq-actions,.pc-mq-row-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.pc-mq-head{justify-content:space-between;margin-bottom:14px}.pc-mq-list{display:grid;gap:10px;margin:14px 0}.pc-mq-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:10px;border:1px solid #c9a24b22;background:#050d0955;border-radius:13px;padding:10px}.pc-mq-num{font-size:11px;color:#c9a24b;text-align:center}.pc-mq-input{font:inherit;width:100%;min-width:0;padding:10px 12px;border:1px solid #c9a24b33;background:#050d09;color:#f2ecdd;border-radius:9px;outline:none}.pc-mq-input:focus{border-color:#d4af6a}.pc-mq-btn{font:inherit;font-size:12px;border:1px solid #c9a24b44;border-radius:9px;padding:7px 11px;background:#c9a24b09;color:#e3c98f;cursor:pointer}.pc-mq-btn:disabled{opacity:.4;cursor:not-allowed}.pc-mq-btn.primary{background:#c9a24b;color:#050d09;font-weight:800;padding:10px 20px}.pc-mq-btn.danger{color:#ffb4a3;border-color:#e5846940}.pc-mq-toggle{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:#93aa9c}.pc-mq-toggle input{accent-color:#c9a24b}.pc-mq-preview{padding:13px 15px;border:1px solid #c9a24b33;border-radius:12px;background:#12271e;color:#dce6d8;font-size:12px;line-height:2;margin-bottom:14px;overflow-wrap:anywhere}.pc-mq-preview b{font-size:10px;color:#c9a24b;display:block;margin-bottom:5px}.pc-mq-preview span+span:before{content:" ◉ ";color:#c9a24b;margin:0 8px}.pc-mq-error{color:#ffc1af;font-size:12px;line-height:1.9;margin:10px 0}.pc-mq-success{color:#93dbb1;font-size:12px}.pc-mq-empty{padding:24px;text-align:center;color:#93aa9c;border:1px dashed #c9a24b33;border-radius:12px}.pc-mq-speedrow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid #c9a24b22;background:#050d0955;border-radius:13px;padding:12px 14px;margin-bottom:14px}.pc-mq-speedlbl{font-size:12px;font-weight:700;color:#dce6d8}.pc-mq-range{flex:1 1 180px;max-width:360px;accent-color:#c9a24b;cursor:pointer}.pc-mq-speedval{font-size:11px;color:#e3c98f;white-space:nowrap}.pc-public-marquee:focus-within .animate-marquee,.pc-public-marquee:hover .animate-marquee{animation-play-state:paused}@media(prefers-reduced-motion:reduce){.pc-public-marquee .animate-marquee{animation:none}}@media(max-width:640px){.pc-mq-row{grid-template-columns:22px minmax(0,1fr);gap:7px}.pc-mq-row-tools{grid-column:2;justify-content:flex-start}.pc-mq-input{font-size:16px}.pc-mq-row-tools .pc-mq-btn{min-width:36px;min-height:36px}.pc-mq-actions{align-items:flex-start}}';
  document.head.appendChild(el);
 }
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function hydratePublic(){
  const bar=document.querySelector('[class*="animate-marquee"]')?.parentElement;
  const track=bar&&bar.querySelector('[class*="animate-marquee"]');
  if(!bar||!track||bar.dataset.marqueeBusy)return;
  let cfg;try{cfg=clean(api.settings().marquee||defaults());}catch(e){cfg=defaults();}
  const items=cfg.items.filter(x=>x.visible&&x.text.trim());
  const on=cfg.enabled&&!!items.length;
  /* امضای وضعیت: اگر هیچ چیز عوض نشده و چرخه زنده است، pull دورهٔ نوار را از اول شروع نکند */
  const sig=on?'1|'+cfg.speed+'|'+items.map(x=>x.id+'='+x.text).join('~'):'0';
  if(bar.dataset.mqSig===sig&&(on?mqAlive():true)){if(!on){bar.style.display='none';}return;}
  bar.dataset.mqSig=sig;
  if(!on){bar.style.display='none';track.textContent='';stopMqLoop();}
  else bar.style.display='';
  const dot='<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-dot text-gold-500" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="12" r="10"></circle></svg>';
  const span=x=>'<span class="flex items-center gap-8 whitespace-nowrap text-sm font-medium text-cream/70" data-marquee-id="'+esc(x.id)+'">'+esc(x.text)+dot+'</span>';
  /* Single LTR sequence: enters from the right, exits left, 2s pause, repeat. */
  track.dir='ltr';
  track.innerHTML=on?items.map(span).join(''):'';
  bar.classList.add('pc-public-marquee');
  bar.setAttribute('role','region');
  bar.setAttribute('aria-label','پیام‌های کوتاه آکادمی و فروشگاه');
  bar.setAttribute('data-site-marquee',on?'on':'off');
  if(on)startMqLoop(bar,track,cfg.speed);
 }
 let publicWatch=false;
 /* ── چرخهٔ نوار: یک دور کامل (ورود از راست ← خروج از چپ)، ۲ ثانیه مکث، تکرار از اول. ──
    مقاوم‌سازی: هر دور ترکِ فعلی دوباره از DOM خوانده می‌شود (اگر React نود را عوض کند خودش را وصل می‌کند)،
    انیمیشن‌های تمام‌شده انبار نمی‌شوند، و یک نگهبان ۲.۵ثانیه‌ای چرخهٔ مرده را در هر مرورگری دوباره راه می‌اندازد. */
 const MQ={bar:null,track:null,speed:DEF_SPEED,on:false,static:false,cycles:0,anim:null,timer:null,lastStart:0,lastEnd:0,pauseMs:2000,lastW:0};
 function stopMqLoop(){
  MQ.on=false;MQ.static=false;
  try{if(MQ.anim)MQ.anim.cancel();}catch(e){}
  MQ.anim=null;
  if(MQ.timer){clearTimeout(MQ.timer);MQ.timer=null;}
  try{if(MQ.track)MQ.track.getAnimations().forEach(a=>{try{a.cancel()}catch(e){}});}catch(e){}
 }
 function mqAlive(){
  return !!(MQ.on&&!MQ.static&&MQ.bar&&MQ.bar.isConnected&&((MQ.timer!==null)||(MQ.anim&&(MQ.anim.playState==='running'||MQ.anim.playState==='paused'))));
 }
 function startMqLoop(bar,track,speed){
  stopMqLoop();
  try{
   if(!bar||!track||!track.isConnected)return;
   MQ.bar=bar;MQ.track=track;MQ.speed=Math.min(MAX_SPEED,Math.max(MIN_SPEED,Math.round(speed||DEF_SPEED)));MQ.on=true;
   MQ.lastW=bar.clientWidth||window.innerWidth||0;
   track.style.animation='none'; /* جای کی‌فریم ۳۴ثانیه‌ای اصلی را می‌گیریم */
   const run=()=>{
    if(!MQ.on)return;
    const cur=(MQ.bar&&MQ.bar.isConnected?MQ.bar.querySelector('[class*="animate-marquee"]'):null)||MQ.track;
    if(!cur||!cur.isConnected)return; /* نگهبان، ترک تازه را وصل می‌کند */
    MQ.track=cur;
    try{cur.getAnimations().forEach(a=>{try{a.cancel()}catch(e){}});}catch(e){} /* بدون انباشته شدن انیمیشن‌های قبلی */
    const W=MQ.bar.clientWidth||window.innerWidth||0,seq=cur.scrollWidth;
    if(!W||!seq)return;
    if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches){
     MQ.static=true;cur.style.transform='translateX(0)';return; /* بدون حرکت برای کاربران کم‌تحرکی */
    }
    const travel=W+seq; /* از کاملاً بیرونِ راست تا کاملاً بیرونِ چپ */
    const duration=Math.max(4000,Math.round(travel/MQ.speed*1000));
    MQ.lastStart=Date.now();MQ.cycles++;
    MQ.anim=cur.animate([{transform:'translateX('+W+'px)'},{transform:'translateX(-'+seq+'px)'}],{duration,easing:'linear',fill:'forwards'});
    MQ.anim.onfinish=()=>{
     if(!MQ.on||!MQ.anim)return;
     MQ.lastEnd=Date.now();MQ.anim=null;MQ.pauseMs=2000;
     MQ.timer=setTimeout(()=>{MQ.timer=null;run();},2000); /* ۲ ثانیه مکث بعد از آخرین متن، بعد از اول */
    };
   };
   run();
   if(!bar.dataset.mqPauseBound){
    bar.dataset.mqPauseBound='1';
    const pause=()=>{try{if(MQ.anim)MQ.anim.pause();}catch(e){}};
    const resume=()=>{try{if(MQ.anim)MQ.anim.play();}catch(e){}};
    bar.addEventListener('mouseenter',pause);
    bar.addEventListener('mouseleave',resume);
    bar.addEventListener('focusin',pause);
    bar.addEventListener('focusout',resume);
   }
  }catch(e){}
 }
 /* نگهبان: اگر چرخه به هر دلیلی مرده باشد (تعویض نود، قطع انیمیشن، باگ مرورگر) دوباره راه می‌افتد */
 if(typeof setInterval==='function'&&!window.__pcMqWatch){
  window.__pcMqWatch=setInterval(()=>{
   try{
    if(!MQ.on||MQ.static)return;
    const cur=MQ.bar&&MQ.bar.isConnected?MQ.bar.querySelector('[class*="animate-marquee"]'):null;
    if(!cur){stopMqLoop();return;}
    if(cur===MQ.track&&mqAlive())return;
    startMqLoop(MQ.bar,cur,MQ.speed);
   }catch(e){}
  },2500);
 }
 /* تغییر اندازهٔ صفحه: اندازه‌گیری دوباره فقط وقتی عرض واقعاً عوض شود */
 if(typeof window!=='undefined'&&!window.__pcMqResize){
  window.__pcMqResize=true;
  let rsT=null;
  window.addEventListener('resize',()=>{
   clearTimeout(rsT);
   rsT=setTimeout(()=>{
    if(!MQ.on||!MQ.bar||MQ.static)return;
    const w=MQ.bar.clientWidth||window.innerWidth||0;
    if(!w||Math.abs(w-MQ.lastW)<40)return;
    const cur=MQ.bar.querySelector('[class*="animate-marquee"]');
    if(cur)startMqLoop(MQ.bar,cur,MQ.speed);
   },400);
  });
 }
 /* وضعیت برای تست و عیب‌یابی */
 if(typeof window!=='undefined'&&!window.PC_MQ_STATE){
  try{Object.defineProperty(window,'PC_MQ_STATE',{value:{
   get on(){return MQ.on},get speed(){return MQ.speed},get cycles(){return MQ.cycles},
   get lastStart(){return MQ.lastStart},get lastEnd(){return MQ.lastEnd},get pauseMs(){return MQ.pauseMs}
  }});}catch(e){}
 }
 function startPublicWatch(){
  if(publicWatch||typeof document==='undefined')return;publicWatch=true;
  const run=()=>{try{style();hydratePublic();}catch(e){}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
  api.subscribe(run);
  const originalPull=api.pull.bind(api);
  api.pull=force=>originalPull(force).then(v=>{run();return v;});
 }
 const speedLabel=v=>{v=Math.round(v);return v.toLocaleString('fa-IR')+' پیکسل بر ثانیه — '+(v<=45?'آرام':v<=110?'عادی':'تند');};
 function marqueeEditor(host){
  if(!host)return;
  // React re-invokes an inline ref on every parent render; an already-mounted editor stays as-is.
  if(editors.has(host))return;
  const state={model:null,busy:false,message:'',saved:false,dirty:false};
  const update=v=>{state.model=v;state.dirty=true;state.saved=false;state.message='';redraw();};
  const redraw=()=>{
   if(!state.model){host.innerHTML='<div class="pc-mq-editor"><h2>نوار متحرک زیر هیرو</h2><p>'+(esc(state.message)||'در حال خواندن تنظیمات…')+'</p></div>';return;}
   const m=state.model,visible=m.items.filter(x=>x.visible&&x.text.trim());
   host.innerHTML=
    '<div class="pc-mq-editor" id="site-marquee-editor">'+
    '<div class="pc-mq-head"><div><h2 id="site-marquee-title">نوار متحرک زیر هیرو</h2><p>همان نوار پیام‌های کوتاه زیر عکس اصلی؛ هر پیام یک آیتم مستقل است. بعد از آخرین پیام ۲ ثانیه مکث می‌کند و از ابتدا تکرار می‌شود.</p></div>'+
    '<label class="pc-mq-toggle"><input type="checkbox" data-mq="enabled" '+(m.enabled?'checked':'')+(state.busy?' disabled':'')+'>نمایش نوار</label></div>'+
    '<div class="pc-mq-speedrow"><span class="pc-mq-speedlbl">سرعت حرکت نوار</span>'+
    '<input type="range" class="pc-mq-range" data-mq="speed" min="'+MIN_SPEED+'" max="'+MAX_SPEED+'" step="5" value="'+m.speed+'" '+(state.busy?'disabled ':'')+'aria-label="سرعت حرکت نوار متحرک">'+
    '<span class="pc-mq-speedval" data-mq-speedval="1">'+speedLabel(m.speed)+'</span></div>'+
    '<div class="pc-mq-list">'+(m.items.length?m.items.map((x,i)=>
     '<div class="pc-mq-row" data-marquee-item="'+esc(x.id)+'">'+
     '<span class="pc-mq-num">'+(i+1).toLocaleString('fa-IR')+'</span>'+
     '<input type="text" class="pc-mq-input" data-mq="text" data-i="'+i+'" value="'+esc(x.text)+'" maxlength="'+MAX_TEXT+'" '+(state.busy?'disabled ':'')+'placeholder="متن آیتم را بنویسید…" aria-label="متن آیتم '+(i+1).toLocaleString('fa-IR')+'">'+
     '<div class="pc-mq-row-tools">'+
     '<label class="pc-mq-toggle"><input type="checkbox" data-mq="visible" data-i="'+i+'" '+(x.visible?'checked':'')+(state.busy?' disabled':'')+' aria-label="نمایش آیتم '+(i+1).toLocaleString('fa-IR')+'">نمایش</label>'+
     '<button type="button" class="pc-mq-btn" data-mq="up" data-i="'+i+'" '+(state.busy||i===0?'disabled':'')+' aria-label="بالا بردن آیتم '+(i+1).toLocaleString('fa-IR')+'" title="بالا">↑</button>'+
     '<button type="button" class="pc-mq-btn" data-mq="down" data-i="'+i+'" '+(state.busy||i===m.items.length-1?'disabled':'')+' aria-label="پایین بردن آیتم '+(i+1).toLocaleString('fa-IR')+'" title="پایین">↓</button>'+
     '<button type="button" class="pc-mq-btn danger" data-mq="del" data-i="'+i+'" '+(state.busy?'disabled':'')+' aria-label="حذف آیتم '+(i+1).toLocaleString('fa-IR')+'">حذف</button>'+
     '</div></div>').join(''):'<div class="pc-mq-empty">آیتمی ندارید؛ یک پیام اضافه کنید.</div>')+'</div>'+
    '<button type="button" class="pc-mq-btn" data-mq="add" '+(state.busy||m.items.length>=MAX_ITEMS?'disabled':'')+' data-marquee-add="true">＋ افزودن آیتم</button>'+
    '<p>ترتیب ردیف‌ها، ترتیب نمایش است. حذف و جابه‌جایی تا زدن «ذخیره و انتشار» فقط پیش‌نویس است.</p>'+
    '<div class="pc-mq-preview" aria-label="پیش‌نمایش پیام‌ها"><b>پیش‌نمایش آیتم‌ها</b>'+(!m.enabled?'نوار خاموش است.':!visible.length?'آیتم قابل‌نمایشی باقی نمانده است.':visible.map(x=>'<span>'+esc(x.text)+'</span>').join(''))+'</div>'+
    (state.message?'<div class="pc-mq-error" role="alert">'+esc(state.message)+'</div>':'')+
    '<div class="pc-mq-actions"><button type="button" class="pc-mq-btn primary" data-mq="save" data-marquee-save="true" '+(state.busy?'disabled':'')+'>'+(state.busy?'در حال انتشار…':'ذخیره و انتشار نوار')+'</button>'+
    (state.saved?'<span class="pc-mq-success" role="status">✓ انتشار در ابر تأیید شد</span>':state.dirty?'<span class="pc-mq-toggle">تغییرات هنوز منتشر نشده‌اند</span>':'')+
    '</div></div>';
  };
  const move=(i,step)=>{const items=[...state.model.items];[items[i],items[i+step]]=[items[i+step],items[i]];update({...state.model,items});};
  host.addEventListener('input',e=>{
   const t=e.target,i=+t.dataset.i;
   if(t.dataset.mq==='enabled')update({...state.model,enabled:t.checked});
   else if(t.dataset.mq==='text'){const items=[...state.model.items];items[i]={...items[i],text:t.value};state.model={...state.model,items};state.dirty=true;state.saved=false;}
   else if(t.dataset.mq==='visible'){const items=[...state.model.items];items[i]={...items[i],visible:t.checked};update({...state.model,items});}
   else if(t.dataset.mq==='speed'){const v=Math.min(MAX_SPEED,Math.max(MIN_SPEED,Math.round(+t.value||DEF_SPEED)));state.model={...state.model,speed:v};state.dirty=true;state.saved=false;const lab=host.querySelector('[data-mq-speedval]');if(lab)lab.textContent=speedLabel(v);
     const acts=host.querySelector('.pc-mq-actions');
     if(acts){const succ=acts.querySelector('.pc-mq-success');if(succ)succ.remove();if(!acts.querySelector('[data-mq-dirty]'))acts.insertAdjacentHTML('beforeend','<span class="pc-mq-toggle" data-mq-dirty="1">تغییرات هنوز منتشر نشده‌اند</span>');}}
  });
  host.addEventListener('change',e=>{if(e.target.dataset&&e.target.dataset.mq==='speed')redraw();}); /* بعد از رهاکردن لغزنه، نشانگر «منتشر نشده» دیده شود */
  host.addEventListener('click',async e=>{
   const b=e.target.closest('button[data-mq]');if(!b||b.disabled)return;
   const i=+b.dataset.i;
   if(b.dataset.mq==='add')update({...state.model,items:[...state.model.items,{id:crypto.randomUUID(),text:'',visible:true}]});
   else if(b.dataset.mq==='up')move(i,-1);
   else if(b.dataset.mq==='down')move(i,1);
   else if(b.dataset.mq==='del')update({...state.model,items:state.model.items.filter((_,j)=>i!==j)});
   else if(b.dataset.mq==='save'){
    state.saved=false;state.message='';let value;try{value=clean(state.model);}catch(err){state.message=err.message;redraw();return;}
    state.busy=true;redraw();
    try{const r=await api.request('/api/admin/site/settings',{method:'PUT',body:JSON.stringify({key:'marquee',value})});const result=await r.json();if(!r.ok)throw Error(result.error||'انتشار هنوز تأیید نشده؛ تغییرات محفوظ است.');state.model=value;state.dirty=false;state.saved=true;}
    catch(err){state.message=err.message;}finally{state.busy=false;redraw();}
   }
  });
  editors.set(host,{redraw});
  style();redraw();
  api.request('/api/admin/site/settings').then(async r=>{const v=await r.json();if(!r.ok)throw Error(v.error||'خواندن تنظیمات انجام نشد.');state.model=clean(v.settings.marquee||defaults());state.dirty=false;redraw();}).catch(e=>{state.message=e.message;redraw();});
 }
 startPublicWatch();
 api.marqueeEditor=marqueeEditor;api.normalizeMarquee=clean;
})();
