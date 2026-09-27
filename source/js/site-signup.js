/* Course registration on the public site:
   • The «ثبت‌نام در این دوره» button opens a popup (like the review-submission popup) instead of navigating.
   • Label follows the admin's choice: ثبت‌نام (register) or پیش‌ثبت‌نام (presignup).
   • On success the admin-editable thank-you text is shown.
   • PC_SITE_CLOUD.signupEditor(el) renders the admin box: mode + thank-you text + signups inbox. */
(function(){
 'use strict';
 const api=window.PC_SITE_CLOUD;if(!api)return;
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const en=v=>String(v==null?'':v).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c));
 const fa=n=>String(n==null?'':n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
 const DEFAULT_THANKS='تشکر از ثبت‌نام شما؛ به‌زودی با شما تماس می‌گیریم.';
 const REGISTER_LABEL='ثبت\u200cنام در این دوره',PRESIGNUP_LABEL='پیش\u200cثبت\u200cنام در این دوره';
 let styled=false;
 function style(){
  if(styled)return;styled=true;
  const el=document.createElement('style');
  el.textContent=
  '.pc-reg{position:fixed;inset:0;z-index:110;direction:rtl;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,13,9,.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}'+
  '.pc-reg .box{width:min(430px,94vw);max-height:88vh;overflow:auto;border-radius:24px;border:1px solid rgba(201,162,75,.3);background:linear-gradient(180deg,#0a1712,#050d09);box-shadow:0 30px 80px -20px rgba(0,0,0,.7);padding:24px;color:#f2ecdd}'+
  '.pc-reg h3{margin:0 0 6px;font-size:17px;font-weight:900}'+
  '.pc-reg .sub{font-size:11.5px;color:#93aa9c;margin-bottom:16px;line-height:1.9}'+
  '.pc-reg .crs{display:block;font-size:12.5px;font-weight:800;color:#e3c98f;border:1px solid rgba(201,162,75,.3);background:rgba(201,162,75,.07);border-radius:12px;padding:8px 12px;margin-bottom:14px}'+
  '.pc-reg label{display:block;font-size:11px;font-weight:700;color:#93aa9c;margin:10px 0 5px}'+
  '.pc-reg input,.pc-reg textarea{width:100%;font:inherit;font-size:13px;color:#f2ecdd;background:rgba(5,13,9,.75);border:1px solid rgba(201,162,75,.22);border-radius:13px;padding:11px 13px;outline:none}'+
  '.pc-reg input:focus,.pc-reg textarea:focus{border-color:#d4af6a}'+
  '.pc-reg .err{color:#ffc1af;font-size:11.5px;line-height:1.8;margin-top:9px;min-height:0}'+
  '.pc-reg .go{margin-top:14px;width:100%;border:none;border-radius:999px;background:#c9a24b;color:#050d09;font-size:13px;font-weight:900;padding:12px;cursor:pointer}'+
  '.pc-reg .go:disabled{opacity:.55;cursor:wait}'+
  '.pc-reg .done{text-align:center;padding:18px 4px}'+
  '.pc-reg .done .tick{font-size:40px}'+
  '.pc-reg .done p{font-size:13.5px;font-weight:800;line-height:2.1;color:#f2ecdd;margin:10px 0 0;white-space:pre-line}'+
  /* admin editor */
  '.pc-signup-editor{color:#f2ecdd;min-width:0}'+
  '.pc-signup-editor h2{font-size:16px;font-weight:850;margin:0;color:#f2ecdd}'+
  '.pc-signup-editor p.hint{font-size:12px;line-height:2;color:#93aa9c;margin:8px 0 14px}'+
  '.pc-signup-editor .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0}'+
  '.pc-signup-editor .opt{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:#dce6d8;border:1px solid rgba(201,162,75,.3);border-radius:11px;padding:8px 13px;cursor:pointer}'+
  '.pc-signup-editor .opt.on{background:#c9a24b;color:#050d09;font-weight:800;border-color:#c9a24b}'+
  '.pc-signup-editor textarea{width:100%;font:inherit;font-size:13px;color:#f2ecdd;background:#050d09;border:1px solid rgba(201,162,75,.25);border-radius:11px;padding:10px 12px;min-height:74px;outline:none}'+
  '.pc-signup-editor .btn{font:inherit;font-size:12px;border:1px solid rgba(201,162,75,.3);border-radius:10px;padding:8px 14px;background:rgba(201,162,75,.08);color:#e3c98f;cursor:pointer}'+
  '.pc-signup-editor .btn.primary{background:#c9a24b;color:#050d09;font-weight:800}'+
  '.pc-signup-editor .btn:disabled{opacity:.45;cursor:not-allowed}'+
  '.pc-signup-editor .ok{color:#93dbb1;font-size:12px}'+
  '.pc-signup-editor .err{color:#ffc1af;font-size:12px;line-height:1.9}'+
  '.pc-signup-editor .inbox{margin-top:16px;border-top:1px solid rgba(201,162,75,.16);padding-top:14px}'+
  '.pc-signup-editor .srow{display:flex;align-items:center;gap:10px;border:1px solid rgba(201,162,75,.14);background:rgba(5,13,9,.5);border-radius:12px;padding:9px 12px;margin-bottom:8px;font-size:12px}'+
  '.pc-signup-editor .srow b{font-size:12.5px}'+
  '.pc-signup-editor .srow .muted{color:#93aa9c;font-size:10.5px}'+
  '.pc-signup-editor .srow .del{margin-inline-start:auto;flex-shrink:0}'+
  '.pc-signup-editor .empty{padding:18px;text-align:center;color:#93aa9c;font-size:12px;border:1px dashed rgba(201,162,75,.25);border-radius:12px}';
  document.head.appendChild(el);
 }
 function cfg(){
  try{return api.settings().courseSignup||{};}catch(e){return {};}
 }
 function mode(){return cfg().mode==='register'?'register':'presignup';}
 function thanks(){const t=cfg().thankYou;return (typeof t==='string'&&t.trim())?t.trim():DEFAULT_THANKS;}
 function currentCourse(anchor){
  const panel=anchor.closest('[id],section,div');
  let el=anchor,crumb='';
  /* course title: nearest preceding heading inside the detail panel */
  let scope=anchor.closest('div.rounded-3xl,section,[class*="rounded-3xl"]')||document;
  const h=scope&&scope.querySelector('h1,h2,h3');
  if(h&&h.textContent.trim())crumb=h.textContent.trim();
  if(!crumb&&panel){const p=panel.parentElement&&panel.parentElement.querySelector('h1,h2,h3');if(p)crumb=p.textContent.trim();}
  return crumb.slice(0,120);
 }
 function openRegister(anchor){
  style();
  const old=document.getElementById('pc-reg');if(old)old.remove();
  const course=currentCourse(anchor);
  const m=mode();
  const root=document.createElement('div');
  root.className='pc-reg';root.id='pc-reg';
  root.innerHTML='<div class="box" role="dialog" aria-modal="true" aria-label="'+(m==='register'?'ثبت‌نام دوره':'پیش‌ثبت‌نام دوره')+'">'+
   '<h3>'+(m==='register'?'ثبت\u200cنام دوره':'پیش\u200cثبت\u200cنام دوره')+'</h3>'+
   '<div class="sub">اطلاعات خود را وارد کنید؛ همکاران آکادمی برای هماهنگی با شما تماس می\u200cگیرند.</div>'+
   (course?'<span class="crs">⛳ '+esc(course)+'</span>':'')+
   '<label for="pc-reg-name">نام و نام خانوادگی *</label><input id="pc-reg-name" maxlength="80" autocomplete="name" placeholder="مثلاً علی رضایی">'+
   '<label for="pc-reg-phone">شماره موبایل *</label><input id="pc-reg-phone" maxlength="11" inputmode="tel" autocomplete="tel" dir="ltr" style="text-align:right" placeholder="۰۹۱۲۳۴۵۶۷۸۹">'+
   '<label for="pc-reg-note">توضیح (اختیاری)</label><textarea id="pc-reg-note" rows="2" maxlength="500" placeholder="سطح، ساعات مناسب برای تماس…"></textarea>'+
   '<div class="err" role="alert"></div>'+
   '<button type="button" class="go">'+(m==='register'?'ثبت\u200cنام':'ثبت پیش\u200cثبت\u200cنام')+'</button></div>';
  document.body.appendChild(root);
  document.body.style.overflow='hidden';
  const err=root.querySelector('.err'),go=root.querySelector('.go');
  const close=()=>{root.remove();document.body.style.overflow='';};
  root.addEventListener('click',e=>{if(e.target===root)close();});
  document.addEventListener('keydown',function esc2(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',esc2);}});
  root.querySelector('input').focus();
  go.onclick=async()=>{
   const name=root.querySelector('#pc-reg-name').value.trim();
   const phone=en(root.querySelector('#pc-reg-phone').value).trim();
   const note=root.querySelector('#pc-reg-note').value.trim();
   err.textContent='';
   if(name.length<3)return void(err.textContent='نام و نام خانوادگی را کامل وارد کنید.');
   if(!/^09\d{9}$/.test(phone))return void(err.textContent='شماره موبایل معتبر نیست (مثل ۰۹۱۲۳۴۵۶۷۸۹).');
   go.disabled=true;go.textContent='در حال ثبت…';
   try{
    const out=await api.submitPublic('signup',{name,phone,course,note,mode:m});
    if(out.error)throw Error(out.error);
    root.querySelector('.box').innerHTML='<div class="done"><div class="tick">✅</div><p>'+esc(thanks())+'</p><button type="button" class="go" style="margin-top:18px">بستن</button></div>';
    root.querySelector('.go').onclick=close;
   }catch(e){
    err.textContent=e.message||'ثبت‌نام انجام نشد؛ دوباره تلاش کنید.';
    go.disabled=false;go.textContent=m==='register'?'ثبت\u200cنام':'ثبت پیش\u200cثبت\u200cنام';
   }
  };
 }
 /* Intercept the course-detail registration button before React's Link navigation. */
 document.addEventListener('click',e=>{
  const a=e.target.closest('a,button');
  if(!a)return;
  const txt=(a.textContent||'').replace(/\s+/g,' ');
  if(txt.indexOf(REGISTER_LABEL)===-1&&txt.indexOf('ثبت\u200cنام در این دوره')===-1&&txt.indexOf('پیش\u200cثبت\u200cنام در این دوره')===-1)return;
  if(a.tagName==='A'&&((a.getAttribute('href')||'').replace(/\/+$/,'')==='/academy'||a.classList.contains('enter-members'))){
   e.preventDefault();e.stopPropagation();
   if(e.stopImmediatePropagation)e.stopImmediatePropagation(); /* enter-academy.js also watches these anchors */
   openRegister(a);
  }
 },true);
 /* Keep the button label in sync with the admin's mode choice. */
 function relabel(){
  const m=mode();
  document.querySelectorAll('a.enter-members,button').forEach(el=>{
   if(el.dataset.pcRegLabelApplied&&el.dataset.pcRegMode===m)return;
   const want=m==='register'?('پیش\u200cثبت\u200cنام در این دوره'):('ثبت\u200cنام در این دوره');
   const set=m==='register'?('ثبت\u200cنام در این دوره'):('پیش\u200cثبت\u200cنام در این دوره');
   for(const n of el.childNodes){
    if(n.nodeType===3&&n.data&&n.data.replace(/\s+/g,' ').includes(want)){
     n.data=n.data.replace(want,set);
     el.dataset.pcRegLabelApplied='1';el.dataset.pcRegMode=m;
     break;
    }
   }
  });
 }
 const runPublic=()=>{try{style();relabel();}catch(e){}};
 if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',runPublic);else runPublic();
  /* course detail panels open dynamically — debounced relabel */
  let relabelTimer=null;
  new MutationObserver(()=>{
   if(relabelTimer)return;
   relabelTimer=setTimeout(()=>{relabelTimer=null;try{relabel();}catch(e){}},400);
  }).observe(document.documentElement,{childList:true,subtree:true});
  if(api.subscribe)api.subscribe(runPublic);
 }
 /* ── admin editor: mode + thank-you text + signups inbox ── */
 const editors=new WeakMap();
 function signupEditor(host){
  if(!host)return;
  if(editors.has(host))return;
  const state={busy:false,message:'',saved:false,model:{mode:mode(),thankYou:thanks()},inbox:null,inboxErr:''};
  const redraw=()=>{
   const m=state.model;
   host.innerHTML=
   '<div class="pc-signup-editor" id="course-signup-editor">'+
   '<h2 id="course-signup-title">ثبت\u200cنام دوره\u200cها</h2>'+
   '<p class="hint">نوع دکمهٔ ثبت\u200cنام سایت را انتخاب کنید؛ متن تشکر پس از ثبت\u200cنام از همین کادر ویرایش می\u200cشود. ثبت\u200cنام\u200cهای انجام\u200cشده در پایین همین بخش می\u200cآیند.</p>'+
   '<div class="row">'+
   '<button type="button" class="opt '+(m.mode!=='register'?'on':'')+'" data-pcs-mode="presignup">پیش\u200cثبت\u200cنام</button>'+
   '<button type="button" class="opt '+(m.mode==='register'?'on':'')+'" data-pcs-mode="register">ثبت\u200cنام</button>'+
   '</div>'+
   '<label style="display:block;font-size:12px;color:#93aa9c;margin:12px 0 6px">متن پیام تشکر (پس از ثبت\u200cنام موفق نمایش داده می\u200cشود)</label>'+
   '<textarea data-pcs-thanks maxlength="300" '+(state.busy?'disabled ':'')+'dir="rtl">'+esc(m.thankYou)+'</textarea>'+
   (state.message?'<div class="err" role="alert" style="margin-top:10px">'+esc(state.message)+'</div>':'')+
   '<div class="row" style="margin-top:14px"><button type="button" class="btn primary" data-pcs-save '+(state.busy?'disabled':'')+'>'+(state.busy?'در حال انتشار…':'ذخیره و انتشار')+'</button>'+
   (state.saved?'<span class="ok" role="status">✓ انتشار در ابر تأیید شد</span>':'')+'</div>'+
   '<div class="inbox"><h2 style="font-size:14px">ثبت\u200cنام\u200cهای رسیده</h2>'+
   (state.inboxErr?'<div class="err">'+esc(state.inboxErr)+'</div>':'')+
   (state.inbox===null?'<p class="hint">در حال خواندن…</p>':!state.inbox.length?'<div class="empty">هنوز ثبت\u200cنامی نرسیده است.</div>':
    state.inbox.map(x=>'<div class="srow"><span><b>'+esc(x.data&&x.data.name||'—')+'</b> <span class="muted">· <bdi>'+esc(x.data&&x.data.phone||'')+'</bdi></span>'+(x.data&&x.data.course?' <span class="muted">· '+esc(x.data.course)+'</span>':'')+'</span>'+
     '<span class="muted" style="margin-inline-start:auto">'+(x.data&&x.data.mode==='register'?'ثبت\u200cنام':'پیش\u200cثبت\u200cنام')+' · '+esc(String(x.created_at||'').slice(0,10))+'</span>'+
     '<button type="button" class="btn del" data-pcs-del="'+esc(x.id)+'" '+(state.busy?'disabled':'')+'>حذف</button></div>').join(''))+
   '<div class="row"><button type="button" class="btn" data-pcs-refresh '+(state.busy?'disabled':'')+'>تازه\u200cسازی فهرست</button></div>'+
   '</div></div>';
  };
  const save=async()=>{
   state.saved=false;state.message='';
   const value={mode:state.model.mode==='register'?'register':'presignup',thankYou:state.model.thankYou.trim()||DEFAULT_THANKS};
   state.busy=true;redraw();
   try{
    const r=await api.request('/api/admin/site/settings',{method:'PUT',body:JSON.stringify({key:'courseSignup',value})});
    const out=await r.json();
    if(!r.ok)throw Error(out.error||'انتشار تأیید نشد.');
    state.model=value;state.saved=true;
   }catch(e){state.message=e.message;}
   finally{state.busy=false;redraw();}
  };
  const refreshInbox=async()=>{
   state.inbox=null;state.inboxErr='';redraw();
   try{state.inbox=await api.signupInbox();}
   catch(e){state.inbox=[];state.inboxErr=e.message||'خواندن ثبت\u200cنام‌ها انجام نشد.';}
   redraw();
  };
  host.addEventListener('click',async e=>{
   const b=e.target.closest('button[data-pcs-mode],button[data-pcs-save],button[data-pcs-refresh],button[data-pcs-del]');
   if(!b||b.disabled)return;
   if(b.dataset.pcsMode){state.model={...state.model,mode:b.dataset.pcsMode};redraw();return;}
   if(b.dataset.pcsSave)return save();
   if(b.dataset.pcsRefresh)return refreshInbox();
   if(b.dataset.pcsDel){
    if(!confirm('این ثبت\u200cنام حذف شود؟'))return;
    state.busy=true;redraw();
    try{await api.signupDelete(b.dataset.pcsDel);}
    catch(e){state.message=e.message;}
    finally{state.busy=false;}
    return refreshInbox();
   }
  });
  host.addEventListener('input',e=>{
   if(e.target.dataset.pcsThanks){state.model={...state.model,thankYou:e.target.value};state.saved=false;}
  });
  editors.set(host,{redraw});
  style();redraw();
  refreshInbox();
 }
 if(api.signupEditor)return;
 Object.defineProperty(api,'signupEditor',{value:signupEditor,configurable:true,writable:true});
})();
