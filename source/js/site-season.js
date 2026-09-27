/* «سکوی قهرمانی فصل» + «تقویم فصل» popups on the public site.
   Data is published from the academy panel (GA_SYNC.public → web_setting_season_podium / season_calendar).
   Podium mirrors the panel's فرماندهی look — WITHOUT the story option.
   Calendar mirrors the old homepage season calendar (رسپشن panel) look. */
(function(){
 'use strict';
 const api=window.PC_SITE_CLOUD;if(!api)return;
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fa=n=>String(n==null?'':n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
 const MONTHS=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
 let styled=false;
 function style(){
  if(styled)return;styled=true;
  const el=document.createElement('style');
  el.textContent=
  '.pc-pop{position:fixed;inset:0;z-index:120;direction:rtl;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,13,9,.72);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}'+
  '.pc-pop .panel{width:min(640px,94vw);max-height:86vh;overflow:auto;border-radius:24px;border:1px solid rgba(201,162,75,.32);background:linear-gradient(180deg,#0a1712,#050d09);box-shadow:0 30px 90px -20px rgba(0,0,0,.75);padding:22px 22px 18px;color:#f2ecdd}'+
  '.pc-pop .panel.wide{width:min(760px,94vw)}'+
  '.pc-pop .hd{display:flex;align-items:flex-start;gap:12px;border-bottom:1px solid rgba(201,162,75,.16);padding-bottom:14px;margin-bottom:16px}'+
  '.pc-pop .hd .ic{font-size:26px;line-height:1.2}'+
  '.pc-pop .hd h3{margin:0;font-size:17px;font-weight:900;color:#f2ecdd}'+
  '.pc-pop .hd .sub{margin-top:5px;font-size:11.5px;color:#93aa9c}'+
  '.pc-pop .hd .tag{margin-inline-start:auto;flex-shrink:0;font-size:10px;font-weight:800;color:#e3c98f;border:1px solid rgba(201,162,75,.38);border-radius:999px;padding:4px 11px;background:rgba(201,162,75,.08)}'+
  '.pc-pop .close{position:sticky;top:0;float:left;margin:0 0 0 4px;width:34px;height:34px;border-radius:12px;border:1px solid rgba(201,162,75,.3);background:rgba(5,13,9,.7);color:#e3c98f;font-size:17px;cursor:pointer;line-height:1}'+
  /* podium — same composition as the panel: 2nd | 1st | 3rd with medal, avatar, name, points, rank pill */
  '.pc-podium{display:flex;align-items:flex-end;justify-content:center;gap:14px;padding:26px 6px 8px}'+
  '.pc-podium .step{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0;flex:1;max-width:170px}'+
  '.pc-podium .medal{font-size:26px}'+
  '.pc-podium .avatar{width:58px;height:58px;border-radius:50%;object-fit:cover;border:3px solid #c9a24b55;background:#12271e}'+
  '.pc-podium .step.first .avatar{width:74px;height:74px;border-color:#d4af37}'+
  '.pc-podium .base{width:100%;border-radius:14px 14px 0 0;background:linear-gradient(180deg,rgba(201,162,75,.22),rgba(201,162,75,.05));border:1px solid rgba(201,162,75,.28);border-bottom:none;text-align:center;padding:10px 6px 12px}'+
  '.pc-podium .step.first .base{background:linear-gradient(180deg,rgba(212,175,55,.34),rgba(201,162,75,.08))}'+
  '.pc-podium .pname{font-size:12.5px;font-weight:900;color:#f2ecdd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'+
  '.pc-podium .ppts{font-size:11px;font-weight:800;color:#e3c98f;margin-top:2px}'+
  '.pc-podium .rank-pill{display:inline-block;margin-top:5px;font-size:9.5px;font-weight:800;border-radius:999px;padding:2px 9px;border:1px solid}'+
  '.pc-pop .meta{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 14px}'+
  '.pc-pop .meta span{font-size:11px;color:#93aa9c;border:1px solid rgba(201,162,75,.18);border-radius:999px;padding:4px 11px}'+
  /* calendar — رسپشن look */
  '.pc-cal-months{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}'+
  '.pc-cal-months button{font:inherit;font-size:10.5px;font-weight:700;color:#cfe3dd;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.13);border-radius:9px;padding:5px 10px;cursor:pointer}'+
  '.pc-cal-months button.on{background:rgba(201,162,75,.9);color:#050d09;border-color:#c9a24b}'+
  '.pc-calrow{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.028);border-radius:13px;padding:10px 12px;margin-bottom:8px}'+
  '.pc-calrow.past{opacity:.58}'+
  '.pc-calrow .pnm{display:flex;gap:9px;align-items:flex-start;min-width:0;font-size:12.5px;font-weight:800;color:#f8fafc}'+
  '.pc-calrow .pnm .tx{min-width:0}'+
  '.pc-calrow .ckind{display:inline-block;margin-inline-start:6px;font-size:9.5px;font-weight:700;color:#cfe3dd;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);padding:1px 7px;border-radius:7px;vertical-align:middle}'+
  '.pc-calrow .cex{display:block;font-size:10px;color:rgba(248,250,252,.55);font-weight:500;margin-top:2px}'+
  '.pc-calrow .cd{display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-size:11.5px;font-weight:800;white-space:nowrap}'+
  '.pc-calrow .cst{font-size:9px;font-weight:800;padding:1px 8px;border-radius:7px}'+
  '.pc-calrow .cst.done{background:rgba(110,231,183,.15);color:#6ee7b7;border:1px solid rgba(110,231,183,.35)}'+
  '.pc-calrow .cst.soon{background:rgba(125,211,252,.15);color:#7dd3fc;border:1px solid rgba(125,211,252,.35)}'+
  '.pc-pop .note{font-size:10.5px;line-height:1.9;color:rgba(248,250,252,.55);border-top:1px solid rgba(201,162,75,.14);margin-top:12px;padding-top:10px}'+
  '.pc-pop .empty{padding:26px 10px;text-align:center;color:#93aa9c;font-size:12.5px;line-height:2.1}'+
  '@media(max-width:560px){.pc-pop .panel{padding:16px 14px 14px}.pc-podium{gap:8px}.pc-podium .base{padding:8px 4px 10px}}';
  document.head.appendChild(el);
 }
 function shell(inner,wide){
  style();
  const old=document.getElementById('pc-season-pop');if(old)old.remove();
  const root=document.createElement('div');
  root.className='pc-pop';root.id='pc-season-pop';
  root.innerHTML='<div class="panel'+(wide?' wide':'')+'" role="dialog" aria-modal="true">'+inner+'</div>';
  root.addEventListener('click',e=>{if(e.target===root)close();});
  document.body.appendChild(root);
  document.body.style.overflow='hidden';
  const c=root.querySelector('.close');
  if(c)c.onclick=close;
  return root;
 }
 function close(){
  const root=document.getElementById('pc-season-pop');
  if(root)root.remove();
  document.body.style.overflow='';
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 function settings(){try{return api.settings()||{};}catch(e){return {};}}
 function openPodium(){
  const d=settings().seasonPodium||{};
  const top=Array.isArray(d.top)?d.top.slice(0,3):[];
  const head='<button type="button" class="close" aria-label="بستن">×</button>'+
   '<div class="hd"><span class="ic">🏆</span><div><h3>سکوی قهرمانی فصل</h3><div class="sub">فصل '+fa(d.seasonYear||1405)+' • '+fa(d.matchesHeld||0)+' مسابقه برگزارشده • '+fa(d.playersActive||0)+' بازیکن فعال</div></div><span class="tag">FedEx Style</span></div>';
  let body;
  if(!top.length){
   body='<div class="empty">هنوز نتیجه‌ای برای فصل '+fa(d.seasonYear||1405)+' منتشر نشده است.<br>نتایج از پنل آکادمی منتشر می‌شود.</div>';
  }else{
   const order=[1,0,2]; /* چیدمان مثل پنل: چپ ۳، وسط ۱، راست ۲ */
   const hs=[62,100,40];
   const cols=order.map((idx,pos)=>{
    const r=top[idx];if(!r)return'';
    const first=idx===0;
    const pill=r.rankColor?' style="background:' + esc(r.rankColor) + '22;color:' + esc(r.rankColor) + ';border-color:' + esc(r.rankColor) + '55"':'';
    return '<div class="step'+(first?' first':'')+'">'+
     '<div class="medal">'+['🥇','🥈','🥉'][idx]+'</div>'+
     '<img class="avatar" src="'+esc(r.avatar||'/images/academy-logo.jpg')+'" alt="">'+
     '<div class="base" style="height:'+(hs[pos]+58)+'px">'+
     '<div class="pname">'+esc(r.name||'—')+'</div>'+
     '<div class="ppts">'+fa(r.pts||0)+' امتیاز</div>'+
     (r.rankText?'<span class="rank-pill"'+pill+'>'+esc(r.rankText)+'</span>':'')+
     '</div></div>';
   }).join('');
   body='<div class="pc-podium">'+cols+'</div>';
  }
  shell(head+body);
 }
 function openCalendar(){
  const d=settings().seasonCalendar||{};
  const events=Array.isArray(d.events)?d.events:[];
  /* current Jalali month (compact Gregorian→Jalali) */
  let month=0;
  try{
   const now=new Date();
   const g_d_m=[0,31,59,90,120,151,181,212,243,273,304,334];
   let gy=now.getFullYear(),gm=now.getMonth()+1,gd=now.getDate();
   let jy=(gy<=1600)?0:979;gy-=(gy<=1600)?621:1600;
   const gy2=(gm>2)?(gy+1):gy;
   let days=(365*gy)+Math.floor((gy2+3)/4)-Math.floor((gy2+99)/100)+Math.floor((gy2+399)/400)-80+gd+g_d_m[gm-1];
   jy+=33*Math.floor(days/12053);days%=12053;
   jy+=4*Math.floor(days/1461);days%=1461;
   if(days>365){jy+=Math.floor((days-1)/365);days=(days-1)%365;}
   month=((days<186)?1+Math.floor(days/31):7+Math.floor((days-186)/30))-1;
  }catch(e){}
  const head='<button type="button" class="close" aria-label="بستن">×</button>'+
   '<div class="hd"><span class="ic">📅</span><div><h3>تقویم آکادمی — فصل '+fa(d.seasonYear||1405)+'</h3><div class="sub">مسابقات · دوره‌ها · اردوها · تمرین‌ها</div></div></div>';
  const months='<div class="pc-cal-months">'+MONTHS.map((m,i)=>'<button type="button" data-pc-m="'+i+'" class="'+(i===month?'on':'')+'">'+m+'</button>').join('')+'</div>';
  const rowsFor=mm=>{
   const rows=events.filter(x=>+x.jm===mm+1);
   if(!rows.length)return'<div class="empty">رویدادی در ماه «'+MONTHS[mm]+'» ثبت نشده است.</div>';
   return rows.map(x=>'<div class="pc-calrow'+(x.past?' past':'')+'">'+
    '<span class="pnm"><span>'+esc(x.icon||'📌')+'</span><span class="tx">'+esc(x.name||'رویداد')+' <span class="ckind">'+esc(x.kind||'')+'</span>'+(x.extra?'<span class="cex">'+esc(x.extra)+'</span>':'')+'</span></span>'+
    '<span class="cd">'+fa(x.jd||'')+' '+MONTHS[mm]+'<span class="cst '+(x.past?'done':'soon')+'">'+(x.past?'✓ برگزار شد':'آینده')+'</span></span></div>').join('');
  };
  const root=shell(head+months+'<div data-pc-rows>'+rowsFor(month)+'</div><div class="note">رویدادهای برگزارشده و آینده، هر دو نمایش داده می‌شوند. تقویم از پنل آکادمی منتشر می‌شود.</div>',true);
  root.querySelectorAll('[data-pc-m]').forEach(b=>{
   b.onclick=()=>{
    root.querySelectorAll('[data-pc-m]').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    root.querySelector('[data-pc-rows]').innerHTML=rowsFor(+b.dataset.pcM);
   };
  });
 }
 /* Cards are React-rendered; intercept the click before React's router runs. */
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-season-popup]');
  if(!b)return;
  e.preventDefault();e.stopPropagation();
  if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  if(b.dataset.seasonPopup==='calendar')openCalendar();else openPodium();
 },true);
 /* Fresh publish while a popup is open → rebuild it on next open (just close). */
 if(api.subscribe)api.subscribe(()=>{close();});
})();
