/* Item-based CMS editor + hydrated public marquee. Public web storage only. */
(function(){
 'use strict';
 const api=window.PC_SITE_CLOUD;if(!api)return;
 const MAX_ITEMS=40,MAX_TEXT=180;
 const editors=new WeakMap();
 function defaults(){return window.PC_SITE_CLOUD_CONFIG.seed.settings.marquee;}
 function clean(value){
  if(!value||typeof value!=='object'||typeof value.enabled!=='boolean'||!Array.isArray(value.items)||value.items.length>MAX_ITEMS)throw Error('ساختار نوار معتبر نیست؛ حداکثر ۴۰ آیتم مجاز است.');
  const seen=new Set();
  return {enabled:value.enabled,items:value.items.map(x=>{
   if(!x||typeof x.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(x.id)||seen.has(x.id)||typeof x.text!=='string'||!x.text.trim()||x.text.trim().length>MAX_TEXT||typeof x.visible!=='boolean')throw Error('متن هر آیتم باید بین ۱ تا ۱۸۰ نویسه باشد؛ ردیف خالی را کامل یا حذف کنید.');
   seen.add(x.id);return {id:x.id,text:x.text.trim(),visible:x.visible};
  })};
 }
 function style(){
  if(document.getElementById('pc-marquee-style'))return;
  const el=document.createElement('style');el.id='pc-marquee-style';
  el.textContent='.pc-mq-editor{color:#f2ecdd;min-width:0}.pc-mq-editor h2{font-size:16px;font-weight:850;margin:0;color:#f2ecdd}.pc-mq-editor p{font-size:12px;line-height:2;color:#93aa9c;margin:8px 0 14px}.pc-mq-head,.pc-mq-actions,.pc-mq-row-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.pc-mq-head{justify-content:space-between;margin-bottom:14px}.pc-mq-list{display:grid;gap:10px;margin:14px 0}.pc-mq-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:10px;border:1px solid #c9a24b22;background:#050d0955;border-radius:13px;padding:10px}.pc-mq-num{font-size:11px;color:#c9a24b;text-align:center}.pc-mq-input{font:inherit;width:100%;min-width:0;padding:10px 12px;border:1px solid #c9a24b33;background:#050d09;color:#f2ecdd;border-radius:9px;outline:none}.pc-mq-input:focus{border-color:#d4af6a}.pc-mq-btn{font:inherit;font-size:12px;border:1px solid #c9a24b44;border-radius:9px;padding:7px 11px;background:#c9a24b09;color:#e3c98f;cursor:pointer}.pc-mq-btn:disabled{opacity:.4;cursor:not-allowed}.pc-mq-btn.primary{background:#c9a24b;color:#050d09;font-weight:800;padding:10px 20px}.pc-mq-btn.danger{color:#ffb4a3;border-color:#e5846940}.pc-mq-toggle{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:#93aa9c}.pc-mq-toggle input{accent-color:#c9a24b}.pc-mq-preview{padding:13px 15px;border:1px solid #c9a24b33;border-radius:12px;background:#12271e;color:#dce6d8;font-size:12px;line-height:2;margin-bottom:14px;overflow-wrap:anywhere}.pc-mq-preview b{font-size:10px;color:#c9a24b;display:block;margin-bottom:5px}.pc-mq-preview span+span:before{content:" ◉ ";color:#c9a24b;margin:0 8px}.pc-mq-error{color:#ffc1af;font-size:12px;line-height:1.9;margin:10px 0}.pc-mq-success{color:#93dbb1;font-size:12px}.pc-mq-empty{padding:24px;text-align:center;color:#93aa9c;border:1px dashed #c9a24b33;border-radius:12px}.pc-public-marquee:focus-within .animate-marquee,.pc-public-marquee:hover .animate-marquee{animation-play-state:paused}@media(prefers-reduced-motion:reduce){.pc-public-marquee .animate-marquee{animation:none}}@media(max-width:640px){.pc-mq-row{grid-template-columns:22px minmax(0,1fr);gap:7px}.pc-mq-row-tools{grid-column:2;justify-content:flex-start}.pc-mq-input{font-size:16px}.pc-mq-row-tools .pc-mq-btn{min-width:36px;min-height:36px}.pc-mq-actions{align-items:flex-start}}';
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
  if(on)startMqLoop(bar,track);
 }
 let publicWatch=false;
 /* JS-driven marquee cycle: one full pass (enter right → exit left), then a 2s pause before the first item starts again. */
 let mqAnim=null,mqTimer=null;
 function stopMqLoop(){
  try{if(mqAnim)mqAnim.cancel();}catch(e){}
  mqAnim=null;
  if(mqTimer){clearTimeout(mqTimer);mqTimer=null;}
 }
 function startMqLoop(bar,track){
  stopMqLoop();
  try{
   if(!track||!track.isConnected)return;
   track.style.animation='none'; /* take over from the original 34s CSS keyframes */
   const W=bar.clientWidth||window.innerWidth||0,seq=track.scrollWidth;
   if(!W||!seq)return;
   if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches){
    track.style.transform='translateX(0)'; /* static: show whatever fits */
    return;
   }
   const travel=W+seq; /* from fully off-screen right to fully off-screen left */
   const duration=Math.max(6000,Math.round(travel/70*1000)); /* ~70px/s, same reading speed as before */
   const run=()=>{
    if(!track.isConnected)return;
    mqAnim=track.animate([{transform:'translateX('+W+'px)'},{transform:'translateX(-'+seq+'px)'}],{duration,easing:'linear',fill:'forwards'});
    mqAnim.onfinish=()=>{if(!track.isConnected)return;mqTimer=setTimeout(run,2000);}; /* ۲ ثانیه مکث بین دو دور */
   };
   track.style.transform='translateX('+W+'px)';
   run();
   if(!bar.dataset.mqPauseBound){
    bar.dataset.mqPauseBound='1';
    const pause=()=>{try{if(mqAnim)mqAnim.pause();}catch(e){}};
    const resume=()=>{try{if(mqAnim)mqAnim.play();}catch(e){}};
    bar.addEventListener('mouseenter',pause);
    bar.addEventListener('mouseleave',resume);
    bar.addEventListener('focusin',pause);
    bar.addEventListener('focusout',resume);
   }
  }catch(e){}
 }
 function startPublicWatch(){
  if(publicWatch||typeof document==='undefined')return;publicWatch=true;
  const run=()=>{try{style();hydratePublic();}catch(e){}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
  api.subscribe(run);
  const originalPull=api.pull.bind(api);
  api.pull=force=>originalPull(force).then(v=>{run();return v;});
 }
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
    '<div class="pc-mq-head"><div><h2 id="site-marquee-title">نوار متحرک زیر هیرو</h2><p>همان نوار پیام‌های کوتاه زیر عکس اصلی؛ هر پیام یک آیتم مستقل است.</p></div>'+
    '<label class="pc-mq-toggle"><input type="checkbox" data-mq="enabled" '+(m.enabled?'checked':'')+(state.busy?' disabled':'')+'>نمایش نوار</label></div>'+
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
  });
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
