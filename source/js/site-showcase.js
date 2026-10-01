/* Storefront homepage layout editor: the exact public product grid, but draggable.
 * Public web storage only (web_setting_showcase). Order + per-item visibility. */
(function(){
 'use strict';
 const api=window.PC_SITE_CLOUD;if(!api)return;
 const MAX_ITEMS=60,HOME_SLOTS=4;
 const editors=new WeakMap();
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fa=n=>Number(n||0).toLocaleString('fa-IR',{maximumFractionDigits:0});
 const money=n=>fa(n);
 const off=p=>p && Number(p.oldPrice)>Number(p.price) ? Math.round((1-Number(p.price)/Number(p.oldPrice))*100) : 0;
 function clean(value){
  if(!value||typeof value!=='object'||!Array.isArray(value.items)||value.items.length>MAX_ITEMS)throw Error('ساختار چیدمان معتبر نیست؛ حداکثر '+fa(MAX_ITEMS)+' کالا مجاز است.');
  const seen=new Set();
  return {items:value.items.map(x=>{
   if(!x||typeof x.id!=='number'||!Number.isSafeInteger(x.id)||x.id<=0||seen.has(x.id)||typeof x.hidden!=='boolean')throw Error('هر ردیف چیدمان باید یک کالای مشخص با وضعیت نمایش معتبر باشد.');
   seen.add(x.id);return {id:x.id,hidden:x.hidden};
  })};
 }
 function style(){
  if(document.getElementById('pc-showcase-style'))return;
  const el=document.createElement('style');el.id='pc-showcase-style';
  el.textContent='.pc-sc-editor{color:#f2ecdd;min-width:0;--g300:var(--color-gold-300,#e3c98f);--g400:var(--color-gold-400,#d4af6a);--g500:var(--color-gold-500,#c9a24b);--f800:var(--color-forest-800,#12271e);--f900:var(--color-forest-900,#0a1712);--f950:var(--color-forest-950,#050d09);--cream:var(--color-cream,#f2ecdd);--sage:var(--color-sage,#93aa9c)}.pc-sc-editor h2{font-size:16px;font-weight:850;margin:0;color:var(--cream)}.pc-sc-editor p{font-size:12px;line-height:2;color:var(--sage);margin:8px 0 14px}.pc-sc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:14px}.pc-sc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin:14px 0;direction:rtl}.pc-sc-card{position:relative;user-select:none;-webkit-user-select:none}.pc-sc-card .pc-sc-frame{display:block;overflow:hidden;border-radius:24px;border:1px solid color-mix(in srgb,var(--g500) 10%,transparent);background:var(--f900);transition:transform .35s,box-shadow .35s,border-color .35s,opacity .2s;text-decoration:none;color:inherit}.pc-sc-editor:not(.pc-sc-dragging) .pc-sc-card:not(.is-drag-source):hover .pc-sc-frame{transform:translateY(-6px);border-color:color-mix(in srgb,var(--g500) 30%,transparent);box-shadow:0 24px 60px -20px rgba(201,162,75,.25)}.pc-sc-img{position:relative;aspect-ratio:4/5;overflow:hidden;background:var(--f800)}.pc-sc-img img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}.pc-sc-img::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(5,13,9,.7),transparent 55%);opacity:.6}.pc-sc-grip{position:absolute;top:10px;inset-inline-start:10px;z-index:3;display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:12px;background:rgba(5,13,9,.82);color:var(--g300);cursor:grab;touch-action:none;backdrop-filter:blur(4px)}.pc-sc-grip:active{cursor:grabbing}.pc-sc-grip svg{width:17px;height:17px}.pc-sc-pos{position:absolute;top:10px;inset-inline-end:10px;z-index:3;min-width:26px;height:26px;display:grid;place-items:center;padding:0 8px;border-radius:999px;background:var(--g500);color:var(--f950);font-size:11px;font-weight:900;box-shadow:0 6px 18px rgba(0,0,0,.35)}.pc-sc-card[data-home="0"] .pc-sc-pos{background:rgba(5,13,9,.82);color:var(--sage)}.pc-sc-badge{position:absolute;bottom:10px;inset-inline-start:12px;z-index:3;border-radius:999px;background:var(--g500);padding:4px 12px;font-size:11px;font-weight:900;color:var(--f950);box-shadow:0 4px 14px rgba(0,0,0,.35)}.pc-sc-off{position:absolute;top:46px;inset-inline-end:10px;z-index:3;border-radius:999px;background:rgba(5,13,9,.8);padding:4px 10px;font-size:11px;font-weight:900;color:var(--g300);backdrop-filter:blur(3px)}.pc-sc-body{padding:18px}.pc-sc-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--sage)}.pc-sc-meta b{color:#e8d48a;font-weight:400;letter-spacing:0}.pc-sc-name{margin:8px 0 10px;font-size:15px;font-weight:900;line-height:1.7;color:var(--cream);overflow-wrap:anywhere}.pc-sc-price{display:flex;align-items:baseline;gap:9px}.pc-sc-price b{font-size:16px;font-weight:900;color:var(--g300)}.pc-sc-price s{font-size:12px;color:var(--sage);opacity:.8}.pc-sc-price small{font-size:10px;color:var(--sage)}.pc-sc-tools{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:11px}.pc-sc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:34px;min-height:34px;padding:0 10px;border:1px solid color-mix(in srgb,var(--g500) 27%,transparent);border-radius:10px;background:rgba(201,162,75,.04);color:var(--g300);font:inherit;font-size:11px;cursor:pointer}.pc-sc-btn:disabled{opacity:.35;cursor:not-allowed}.pc-sc-btn.on{background:var(--g500);color:var(--f950);font-weight:800;border-color:var(--g500)}.pc-sc-btn.danger{color:#ffb4a3}.pc-sc-btn svg{width:14px;height:14px}.pc-sc-card.is-hidden .pc-sc-frame{opacity:.38;filter:saturate(.5)}.pc-sc-hidden-tag{position:absolute;z-index:4;top:44px;inset-inline-start:12px;border-radius:999px;background:#7b333c;color:#ffd9d9;padding:4px 11px;font-size:10px;font-weight:800}.pc-sc-card.is-drag-source .pc-sc-frame{opacity:.22;border-style:dashed}.pc-sc-ghost{position:fixed;z-index:10050;pointer-events:none;opacity:.95;transform:scale(1.04);box-shadow:0 30px 70px -18px rgba(0,0,0,.6);border-radius:24px;overflow:hidden}.pc-sc-ghost .pc-sc-frame{border-color:var(--g500)}.pc-sc-empty{padding:26px;text-align:center;color:var(--sage);border:1px dashed color-mix(in srgb,var(--g500) 25%,transparent);border-radius:14px}.pc-sc-error{color:#ffc1af;font-size:12px;line-height:1.9;margin:10px 0}.pc-sc-success{color:#93dbb1;font-size:12px}.pc-sc-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px}.pc-sc-save{font:inherit;font-size:12px;border:1px solid color-mix(in srgb,var(--g500) 30%,transparent);border-radius:10px;padding:10px 20px;background:var(--g500);color:var(--f950);font-weight:800;cursor:pointer}.pc-sc-save:disabled{opacity:.45;cursor:not-allowed}.pc-sc-link{font-size:11px;color:var(--sage)}.pc-sc-tray{margin-top:16px;border:1px solid color-mix(in srgb,var(--g500) 14%,transparent);border-radius:14px;padding:13px 15px}.pc-sc-tray summary{cursor:pointer;font-size:12px;font-weight:800;color:var(--cream)}.pc-sc-tray p{margin:9px 0 0;font-size:11px}.pc-sc-tray .pc-sc-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.pc-sc-tray .pc-sc-chip{border:1px solid color-mix(in srgb,var(--g500) 18%,transparent);border-radius:999px;padding:4px 11px;font-size:11px;color:var(--sage)}@media(max-width:1080px){.pc-sc-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:820px){.pc-sc-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}}@media(max-width:520px){.pc-sc-grid{grid-template-columns:1fr}.pc-sc-body{padding:14px}.pc-sc-name{font-size:14px}}';
  document.head.appendChild(el);
 }
 const eye=on=>on?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.5 10.5 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.9 9.9 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/></svg>';
 const grip='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>';
 function cardHTML(p,i,total){
  const d=off(p);
  return '<div class="pc-sc-card'+(p.hidden?' is-hidden':'')+'" data-sc="'+esc(p.id)+'" data-idx="'+i+'" data-home="'+(i<HOME_SLOTS?1:0)+'">'+
   (p.hidden?'<span class="pc-sc-hidden-tag">مخفی در صفحهٔ اول</span>':'')+
   '<button type="button" class="pc-sc-grip" data-sc-grip="1" aria-label="جابه‌جایی '+esc(p.name)+'" title="بگیر و بکش">'+grip+'</button>'+
   '<span class="pc-sc-pos" aria-label="جایگاه">'+fa(i+1)+'</span>'+
   '<span class="pc-sc-frame"><span class="pc-sc-img"><img src="'+esc(p.image||'/images/academy-logo.webp')+'" alt="" loading="lazy">'+
   (p.badge?'<span class="pc-sc-badge">'+esc(p.badge)+'</span>':'')+
   (d?'<span class="pc-sc-off">٪'+fa(d)+' تخفیف</span>':'')+
   '</span><span class="pc-sc-body"><span class="pc-sc-meta"><span>'+esc(p.category||'')+'</span><b>★ '+fa(p.rating||0)+' <small>('+fa(p.reviewCount||0)+')</small></b></span>'+
   '<span class="pc-sc-name">'+esc(p.name)+'</span>'+
   '<span class="pc-sc-price"><b>'+money(p.price)+'</b> <small>تومان</small>'+(Number(p.oldPrice)>Number(p.price)?'<s>'+money(p.oldPrice)+'</s>':'')+'</span>'+
   '</span></span>'+
   '<div class="pc-sc-tools"><div style="display:flex;gap:7px">'+
   '<button type="button" class="pc-sc-btn'+(p.hidden?'':' on')+'" data-sc-act="eye" aria-label="'+(p.hidden?'نمایش در صفحهٔ اول':'مخفی‌کردن از صفحهٔ اول')+' '+esc(p.name)+'" title="'+(p.hidden?'نمایش بده':'از صفحهٔ اول بردار')+'">'+eye(!p.hidden)+'</button>'+
   '<button type="button" class="pc-sc-btn" data-sc-act="up" '+(i===0?'disabled':'')+' aria-label="بالا بردن '+esc(p.name)+'">↑</button>'+
   '<button type="button" class="pc-sc-btn" data-sc-act="down" '+(i===total-1?'disabled':'')+' aria-label="پایین بردن '+esc(p.name)+'">↓</button>'+
   '</div><span class="pc-sc-link">'+(i<HOME_SLOTS?'در صفحهٔ اول':'ذخیرهٔ جایگاه')+'</span></div>'+
   '</div>';
 }
 function showcaseEditor(host){
  if(!host)return;
  if(editors.has(host))return; // React inline ref remount guard
  const state={model:[],others:[],busy:false,message:'',saved:false,dirty:false};
  const update=model=>{state.model=model;state.dirty=true;state.saved=false;state.message='';redraw();};
  const redraw=()=>{
   if(!state.model.length&&!state.message){host.innerHTML='<div class="pc-sc-editor"><h2>چیدمان ویترین صفحهٔ اول</h2><p>در حال خواندن کالاهای منتخب…</p></div>';return;}
   const visible=state.model.filter(x=>!x.hidden).length;
   host.innerHTML='<div class="pc-sc-editor" id="site-showcase-editor">'+
    '<div class="pc-sc-head"><div><h2 id="site-showcase-title">چیدمان ویترین صفحهٔ اول</h2><p>همان کارت‌هایی که مشتری در صفحهٔ اول می‌بیند. جای بگیرید و بکشید (یا با دستگیرهٔ هر کارت)، با چشم‌آیکون از صفحهٔ اول بردارید و با «ذخیره و انتشار» منتشر کنید.</p></div>'+
    '<a class="pc-sc-link" href="/" target="_blank" rel="noopener">مشاهدهٔ صفحهٔ اول سایت ↗</a></div>'+
    (state.model.length?'<div class="pc-sc-grid" data-sc-grid="1">'+state.model.map((p,i)=>cardHTML(p,i,state.model.length)).join('')+'</div>':'<div class="pc-sc-empty">هیچ کالایی «منتخب» نیست. در ویرایش کالا (پنل سایت یا پنل فروشگاه) گزینهٔ «نمایش در منتخب‌ها» را فعال کنید.</div>')+
    (state.model.length?'<p>صفحهٔ اول '+fa(HOME_SLOTS)+' جایگاه دارد؛ کالاهای بعدی با جابه‌جایی یا مخفی‌شدن بالاترها جای می‌گیرند. '+fa(visible)+' کالا اکنون نمایش داده می‌شود.</p>':'')+
    (state.others.length?'<details class="pc-sc-tray"><summary>کالاهای خارج از صفحهٔ اول ('+fa(state.others.length)+')</summary><p>این کالاها «منتخب» نیستند و در صفحهٔ اول دیده نمی‌شوند؛ برای افزودن، در ویرایش همان کالا گزینهٔ نمایش در منتخب‌ها را فعال کنید.</p><div class="pc-sc-chips">'+state.others.map(p=>'<span class="pc-sc-chip">'+esc(p.name)+'</span>').join('')+'</div></details>':'')+
    (state.message?'<div class="pc-sc-error" role="alert">'+esc(state.message)+'</div>':'')+
    '<div class="pc-sc-actions"><button type="button" class="pc-sc-save" data-sc-save="1" '+(state.busy?'disabled':'')+'>'+(state.busy?'در حال انتشار…':'ذخیره و انتشار چیدمان')+'</button>'+
    (state.saved?'<span class="pc-sc-success" role="status">✓ چیدمان روی سایت انتشار یافت</span>':state.dirty?'<span class="pc-sc-link">تغییرات هنوز منتشر نشده‌اند</span>':'')+'</div></div>';
  };
  const move=(i,step)=>{const m=[...state.model];if(i+step<0||i+step>=m.length)return;[m[i],m[i+step]]=[m[i+step],m[i]];update(m);};
  host.addEventListener('click',async e=>{
   const b=e.target.closest('button[data-sc-act],button[data-sc-save]');if(!b||b.disabled)return;
   if(b.dataset.scSave){
    state.saved=false;state.message='';let value;try{value=clean({items:state.model.map(x=>({id:x.id,hidden:!!x.hidden}))});}catch(err){state.message=err.message;redraw();return;}
    state.busy=true;redraw();
    try{const r=await api.request('/api/admin/site/settings',{method:'PUT',body:JSON.stringify({key:'showcase',value})});const result=await r.json();if(!r.ok)throw Error(result.error||'انتشار هنوز تأیید نشده؛ تغییرات محفوظ است.');state.dirty=false;state.saved=true;}
    catch(err){state.message=err.message;}finally{state.busy=false;redraw();}
    return;
   }
   const card=b.closest('.pc-sc-card');const i=+card.dataset.idx;const act=b.dataset.scAct;
   if(act==='eye'){const m=[...state.model];m[i]={...m[i],hidden:!m[i].hidden};update(m);}
   else if(act==='up')move(i,-1);else if(act==='down')move(i,1);
  });
  // Pointer drag: grip handle (touch+mouse) or press-and-hold anywhere on the card (mouse).
  let drag=null;
  host.addEventListener('pointerdown',e=>{
   if(drag||state.busy||!state.model.length)return;
   const card=e.target.closest('.pc-sc-card');if(!card||card.dataset.idx===undefined)return;
   if(e.target.closest('button')&&!e.target.closest('[data-sc-grip]'))return;
   const gripStart=!!e.target.closest('[data-sc-grip]');
   if(e.pointerType==='mouse'&&!gripStart&&e.button!==0)return;
   const holdMs=gripStart?60:(e.pointerType==='touch'?300:150);
   const start={x:e.clientX,y:e.clientY};
   let active=false,launcher=null,pid=e.pointerId;
   const begin=()=>{
    if(active||drag)return;active=true;
    try{card.setPointerCapture(pid);}catch(err){}
    const rect=card.getBoundingClientRect();
    const ghost=card.cloneNode(true);ghost.classList.add('pc-sc-ghost');ghost.classList.remove('is-drag-source');ghost.style.width=rect.width+'px';
    ghost.querySelectorAll('button').forEach(x=>x.setAttribute('tabindex','-1'));
    document.body.appendChild(ghost);
    card.classList.add('is-drag-source');
    host.querySelector('.pc-sc-editor')?.classList.add('pc-sc-dragging');
    drag={card,ghost,dx:start.x-rect.left,dy:start.y-rect.top,pid};
    place(e.clientX,e.clientY);
   };
   const place=(x,y)=>{drag.ghost.style.left=(x-drag.dx)+'px';drag.ghost.style.top=(y-drag.dy)+'px';};
   const target=ev=>{
    const hits=document.elementsFromPoint(ev.clientX,ev.clientY).filter(n=>n!==drag.ghost&&!drag.ghost.contains(n));
    const hit=hits.find(n=>n.classList&&n.classList.contains('pc-sc-card')&&n!==drag.card);
    if(!hit)return;
    const r=hit.getBoundingClientRect(),cards=[...host.querySelectorAll('.pc-sc-card')];
    const first=cards[0].getBoundingClientRect(),second=cards[1]&&cards[1].getBoundingClientRect();
    const oneColumn=second&&Math.abs(first.left-second.left)<10&&Math.abs(first.top-second.top)>10;
    const before=oneColumn ? ev.clientY<r.top+r.height/2 : ev.clientX>r.left+r.width/2; // RTL: نیمهٔ راست = قبل
    hit.parentNode.insertBefore(drag.card,before?hit:hit.nextSibling);
   };
   const finish=()=>{
    clearTimeout(launcher);
    window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);window.removeEventListener('pointercancel',onCancel);
    if(!active)return;
    const order=[...host.querySelectorAll('.pc-sc-card')].map(n=>+n.dataset.sc);
    drag.ghost.remove();card.classList.remove('is-drag-source');
    host.querySelector('.pc-sc-editor')?.classList.remove('pc-sc-dragging');
    const next=order.map(id=>state.model.find(x=>x.id===id)).filter(Boolean);
    drag=null;
    if(next.some((x,i)=>x!==state.model[i]))update(next);
   };
   const onMove=ev=>{
    if(ev.pointerId!==pid)return;
    if(!active){if(Math.hypot(ev.clientX-start.x,ev.clientY-start.y)>8){clearTimeout(launcher);cleanup();}return;}
    ev.preventDefault();place(ev.clientX,ev.clientY);target(ev);
   };
   const onUp=ev=>{if(ev.pointerId===pid)finish();};
   const onCancel=ev=>{if(ev.pointerId===pid)finish();};
   const cleanup=()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);window.removeEventListener('pointercancel',onCancel);};
   window.addEventListener('pointermove',onMove,{passive:false});window.addEventListener('pointerup',onUp);window.addEventListener('pointercancel',onCancel);
   launcher=setTimeout(begin,holdMs);
  });
  editors.set(host,{redraw});
  style();redraw();
  Promise.all([api.request('/api/admin/site/settings'),api.request('/api/admin/products')]).then(async([s,p])=>{
   const sv=await s.json(),pv=await p.json();
   if(!s.ok)throw Error(sv.error||'خواندن تنظیمات انجام نشد.');
   if(!p.ok)throw Error(pv.error||'خواندن کالاها انجام نشد.');
   const products=Array.isArray(pv.products)?pv.products:[];
   const featured=products.filter(x=>x&&x.isFeatured===true).map(x=>({...x,image:(x.images&&x.images[0])||x.image||'/images/academy-logo.webp'}));
   featured.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
   let cfg;try{cfg=clean(sv.settings&&sv.settings.showcase?sv.settings.showcase:{items:[]});}catch(err){cfg={items:[]};}
   const order=new Map(),hidden=new Set();
   cfg.items.forEach(x=>{order.set(String(x.id),order.size);if(x.hidden)hidden.add(String(x.id));});
   const listed=featured.filter(x=>order.has(String(x.id))).sort((a,b)=>order.get(String(a.id))-order.get(String(b.id)));
   const rest=featured.filter(x=>!order.has(String(x.id)));
   state.model=[...listed,...rest].map(x=>({...x,hidden:hidden.has(String(x.id))}));
   state.others=products.filter(x=>x&&x.isFeatured!==true).map(x=>x.name);
   state.dirty=false;redraw();
  }).catch(e=>{state.message=e.message;redraw();});
 }
 window.PC_SITE_CLOUD.showcaseEditor=showcaseEditor;window.PC_SITE_CLOUD.normalizeShowcase=clean;
})();
