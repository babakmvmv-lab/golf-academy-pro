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
  '.pc-story{margin-inline-start:auto;flex-shrink:0;display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:11.5px;font-weight:900;color:#fff;cursor:pointer;background:linear-gradient(135deg,#d62976,#fa7e1e);border:none;border-radius:999px;padding:7px 15px;box-shadow:0 6px 18px -6px rgba(214,41,118,.75);transition:transform .15s ease,box-shadow .15s ease}'+'.pc-story:hover{transform:translateY(-1px);box-shadow:0 9px 24px -6px rgba(250,126,30,.8)}'+'.pc-story:disabled{opacity:.65;cursor:progress;transform:none}'+'.pc-story svg{width:13px;height:13px;fill:currentColor}'+
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
/* ══════════════ استوری ۱۰۸۰×۱۹۲۰ — همان تمپلیت پنل آکادمی ══════════════
   PC_SITE_STORY_V1 • پورت‌شده از source/js/app.js پنل، بدون تغییر در چیدمان.
   تفاوت‌ها: آواتار از دادهٔ منتشرشده (data-URI) به‌جای avatar(pid)،
   و برند از تنظیمات سایت به‌جای GA_BRAND. */
 const STORY_W=1080, STORY_H=1920;
 function brandOf(){
  const b={};
  try{ const s=settings(); Object.assign(b,(s&&s.brand)||{}); }catch(e){}
  /* نامزدهای لوگو به ترتیب اولویت: WebP سبک‌تر است و همان تصویر جی‌پی‌جی را دارد */
  const cand=[];
  const push=v=>{const s=String(v||'');if(s&&cand.indexOf(s)<0)cand.push(s);};
  push(String(b.logoHd||'').replace(/\.jpe?g$/i,'.webp'));
  push(b.logoHd);
  push('/images/academy-logo-hd.webp');
  push(String(b.logo||'').replace(/\.jpe?g$/i,'.webp'));
  push(b.logo);
  push('/images/academy-logo.webp');
  return {
   fa:b.faName||'آکادمی گلف پات کلاب',
   en:b.enName||'Putt Club Golf Academy',
   logo:cand[0]||'/images/academy-logo.webp',
   logos:cand,
   host:(location.hostname||'puttclub.ir').replace(/^www\./,''),
   ig:String(b.instagram||'puttclub').replace(/^@/,'')
  };
 }
 function storyBtnHTML(){
  return '<button type="button" class="pc-story" id="pc-story-btn" title="خروجی عکس ۱۰۸۰×۱۹۲۰ آمادهٔ استوری اینستاگرام">'+
   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h10a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Zm0 2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7Zm5 12.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>'+
   '📱 استوری</button>';
 }
 function showStoryPreview(blob,fname){
  const url=URL.createObjectURL(blob);
  let pr=document.getElementById('pc-story-preview');
  if(!pr){pr=document.createElement('div');pr.id='pc-story-preview';document.body.appendChild(pr);}
  pr.style.cssText='position:fixed;inset:0;z-index:130;direction:rtl;background:rgba(3,7,12,.93);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:14px';
  pr.innerHTML='<div style="text-align:center;max-width:400px;width:100%">'+
   '<img src="'+url+'" alt="استوری" style="width:100%;max-height:70vh;object-fit:contain;border-radius:18px;border:2px solid rgba(212,175,55,.55);box-shadow:0 14px 60px rgba(0,0,0,.6)">'+
   '<div style="color:#cdd7e1;font-size:12.5px;line-height:2;margin:12px 4px">📥 عکس ۱۰۸۰×۱۹۲۰ ساخته شد — اگر خودکار دانلود نشد، روی تصویر <b>لمس طولانی → Add to Photos</b> بزن؛ بعد اینستاگرام ← استوری ← انتخاب عکس</div>'+
   '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'+
   '<a id="pc-spv-dl" href="'+url+'" download="'+fname+'" style="background:linear-gradient(135deg,#d4af37,#b08a28);color:#1a1407;font-weight:900;text-decoration:none;padding:10px 22px;border-radius:12px;display:inline-block;font-size:13px">⬇ دانلود عکس</a>'+
   '<button type="button" id="pc-spv-share" style="background:linear-gradient(135deg,#d62976,#fa7e1e);color:#fff;border:none;font:inherit;font-weight:900;padding:10px 22px;border-radius:12px;font-size:13px;cursor:pointer">📤 اشتراک (مستقیم استوری)</button>'+
   '<button type="button" id="pc-spv-x" style="background:rgba(255,255,255,.08);color:#e9eff6;border:1px solid rgba(255,255,255,.18);font:inherit;padding:10px 22px;border-radius:12px;font-size:13px;cursor:pointer">بستن</button></div></div>';
  const x=document.getElementById('pc-spv-x'); if(x)x.onclick=()=>{pr.style.display='none';};
  const sh=document.getElementById('pc-spv-share');
  if(sh)sh.onclick=()=>{
   try{
    const f=new File([blob],fname,{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[f]})) navigator.share({files:[f],title:fname}).catch(()=>{});
    else if(navigator.share) navigator.share({title:fname}).catch(()=>{});
    else alert('اشتراک مستقیم در این مرورگر پشتیبانی نمی‌شود — از «دانلود عکس» استفاده کنید.');
   }catch(e){}
  };
 }
 /* موتور رندر — همان کد پنل */
 function igStory(btn,fname,paint){
  const old=btn?btn.innerHTML:'';
  const finish=()=>{if(btn){btn.disabled=false;btn.innerHTML=old;}};
  if(btn){btn.disabled=true;btn.innerHTML='⏳ در حال ساخت…';}
  const W=STORY_W,H=STORY_H,cvs=document.createElement('canvas');
  cvs.width=W;cvs.height=H;
  const c=cvs.getContext('2d');
  const GOLD='#d4af37',GL='#f3d779',FG='#e9eff6',MUT='#9aa7b5';
  const F=(w2,px)=>{c.font=w2+' '+px+'px Vazirmatn, Tahoma, sans-serif';};
  const rrect=(x,y,w,h,r)=>{c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();};
  const txt=(t2,x,y,w2,px,col,align,maxW)=>{let s2=px;F(w2,s2);
   if(maxW){while(s2>13&&c.measureText(t2).width>maxW){s2-=2;F(w2,s2);}}
   c.fillStyle=col;c.textAlign=align||'center';c.textBaseline='alphabetic';c.direction='rtl';c.fillText(t2,x,y);};
  const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0a0f16');g.addColorStop(.55,'#0d1420');g.addColorStop(1,'#0a0f16');
  c.fillStyle=g;c.fillRect(0,0,W,H);
  const rg=(x,y,r,a)=>{const rr=c.createRadialGradient(x,y,0,x,y,r);rr.addColorStop(0,'rgba(212,175,55,'+a+')');rr.addColorStop(1,'rgba(212,175,55,0)');c.fillStyle=rr;c.fillRect(x-r,y-r,r*2,r*2);};
  rg(930,120,420,.14);rg(120,1740,460,.12);rg(540,960,700,.05);
  const tg=c.createLinearGradient(0,0,W,0);tg.addColorStop(0,'#7a5f17');tg.addColorStop(.25,GOLD);tg.addColorStop(.5,'#f7e7ac');tg.addColorStop(.75,GOLD);tg.addColorStop(1,'#7a5f17');
  c.fillStyle=tg;c.fillRect(0,0,W,14);
  const helpers={W,H,GOLD,GL,FG,MUT,F,rrect,txt,c};
  const brand=brandOf();
  const done=()=>{
   const fy=H-118;
   c.strokeStyle='rgba(212,175,55,.45)';c.lineWidth=2;c.beginPath();c.moveTo(120,fy-42);c.lineTo(W-120,fy-42);c.stroke();
   txt(brand.host,W/2,fy+8,'800',34,GL);
   txt('📷 اینستاگرام  @'+brand.ig,W/2,fy+58,'500',24,MUT,'center',960);
   cvs.toBlob(b=>{showStoryPreview(b,fname);finish();},'image/png');
  };
  const run=()=>{Promise.resolve(paint(helpers)).then(()=>done()).catch(()=>done());};
  const img=new Image();
  let drew=false;
  const afterLogo=()=>{
   c.save();c.beginPath();c.arc(W/2,172,82,0,7);c.lineWidth=6;c.strokeStyle=GOLD;c.stroke();c.restore();
   txt(brand.fa,W/2,308,'900',46,GL);
   txt(brand.en.toUpperCase().split('').join(' '),W/2,352,'400',21,'rgba(212,175,55,.75)');
   c.strokeStyle='rgba(212,175,55,.45)';c.lineWidth=2;c.beginPath();c.moveTo(240,386);c.lineTo(W-240,386);c.stroke();
   run();
  };
  img.onload=()=>{if(drew)return;drew=true;
   c.save();c.beginPath();c.arc(W/2,172,76,0,7);c.clip();
   try{c.drawImage(img,W/2-76,172-76,152,152);}catch(e){}
   c.restore();afterLogo();};
  /* اگر یک نامزد لوگو بار نشد، بعدی را امتحان کن؛ در نهایت بدون لوگو ادامه بده */
  let li=0;
  img.onerror=()=>{
   if(drew)return;
   li++;
   if(brand.logos&&li<brand.logos.length){img.src=brand.logos[li];return;}
   drew=true;afterLogo();
  };
  /* فونت را قبل از رسم صبر کن تا تایپوگرافی دقیقاً مثل پنل باشد */
  const startDraw=()=>{img.src=brand.logo;};
  const fr=(document.fonts&&document.fonts.ready)?document.fonts.ready.catch(()=>{}):Promise.resolve();
  fr.then(startDraw,startDraw);
 }
 /* نقاشی سکو — دقیقاً چیدمان پنل: چپ ۳، وسط ۱، راست ۲ */
 function podiumStory(btn,d,top){
  igStory(btn,'استوری-سکوی-قهرمانی.png',({W,H,GOLD,GL,FG,MUT,rrect,txt,c})=>{
   txt('🏆 سکوی قهرمانی فصل',W/2,440,'700',30,MUT);
   txt('FedEx Style  •  '+fa(d.seasonYear||1405),W/2,486,'500',22,'rgba(212,175,55,.7)');
   const visual=[top[2],top[0],top[1]];
   const cw=280,gap=36;
   const x0=(W-(cw*3+gap*2))/2;
   const floor=1540;
   const baseH=[300,520,390];
   const medalCol=[['#f0c49a','#c67b3a','#8a4e1c'],['#ffe38a','#d4af37','#8c6e1d'],['#f4f7fb','#b8c2cc','#7d8792']];
   return Promise.all(visual.map((r,i)=>new Promise(res=>{
    if(!r){res(null);return;}
    const im=new Image();
    im.onload=()=>res({r,im,i});
    im.onerror=()=>res({r,im:null,i});
    im.src=r.avatar||'';
   }))).then(rows=>{
    rows.forEach(item=>{
     if(!item||!item.r)return;
     const r=item.r,i=item.i;
     const x=x0+i*(cw+gap);
     const bh=baseH[i];
     const by=floor-bh;
     const cx=x+cw/2;
     const mc=medalCol[i];
     const ring=r.rankColor||mc[1];
     const ar=58,ay=by;
     const g=c.createLinearGradient(x,by,x,floor);
     if(r.rank===1){g.addColorStop(0,'rgba(212,175,55,.42)');g.addColorStop(1,'rgba(11,15,20,.72)');}
     else if(r.rank===2){g.addColorStop(0,'rgba(192,192,192,.36)');g.addColorStop(1,'rgba(11,15,20,.72)');}
     else{g.addColorStop(0,'rgba(205,127,50,.34)');g.addColorStop(1,'rgba(11,15,20,.72)');}
     c.fillStyle=g;
     c.strokeStyle=r.rank===1?'rgba(212,175,55,.75)':r.rank===2?'rgba(192,192,192,.5)':'rgba(205,127,50,.5)';
     c.lineWidth=r.rank===1?3:2;
     rrect(x,by,cw,bh,18);c.fill();c.stroke();
     c.beginPath();c.arc(cx,ay,ar+6,0,7);c.fillStyle='#0b0f14';c.fill();
     if(item.im){c.save();c.beginPath();c.arc(cx,ay,ar,0,7);c.clip();
      try{c.drawImage(item.im,cx-ar,ay-ar,ar*2,ar*2);}catch(e){}
      c.restore();}
     c.beginPath();c.arc(cx,ay,ar+3,0,7);c.strokeStyle=ring;c.lineWidth=5;c.stroke();
     const tTop=ay+ar+18,tBot=floor-22,mid=(tTop+tBot)/2;
     txt(r.name,cx,mid-28,'800',30,FG,'center',cw-28);
     txt(fa(r.pts||0)+' امتیاز',cx,mid+16,'800',26,GL);
     const pill=r.rankText||'';
     const pc=r.rankColor||GOLD;
     const pw=136,ph=40,px=cx-pw/2,py=mid+36;
     c.fillStyle=pc+'22';c.strokeStyle=pc+'88';c.lineWidth=2;
     rrect(px,py,pw,ph,14);c.fill();c.stroke();
     txt(pill,cx,py+28,'800',18,pc);
     const my=ay-ar-48;
     c.save();
     c.shadowColor=mc[1];c.shadowBlur=18;
     c.fillStyle=r.rank===1?'#c9a227':r.rank===2?'#8a949e':'#a45c28';
     c.beginPath();c.moveTo(cx-8,my+8);c.lineTo(cx-28,my-36);c.lineTo(cx-2,my-4);c.closePath();c.fill();
     c.beginPath();c.moveTo(cx+8,my+8);c.lineTo(cx+28,my-36);c.lineTo(cx+2,my-4);c.closePath();c.fill();
     c.fillStyle=r.rank===1?'#e8d48a':r.rank===2?'#dfe6ee':'#e8b07a';
     c.beginPath();c.moveTo(cx-6,my+6);c.lineTo(cx-18,my-28);c.lineTo(cx,my-2);c.closePath();c.fill();
     c.beginPath();c.moveTo(cx+6,my+6);c.lineTo(cx+18,my-28);c.lineTo(cx,my-2);c.closePath();c.fill();
     c.shadowBlur=22;
     const mg=c.createRadialGradient(cx-8,my-10,3,cx,my,34);
     mg.addColorStop(0,'#fff6d8');mg.addColorStop(.22,mc[0]);mg.addColorStop(.62,mc[1]);mg.addColorStop(1,mc[2]);
     c.fillStyle=mg;
     c.beginPath();c.arc(cx,my,32,0,7);c.fill();
     c.shadowBlur=0;
     c.lineWidth=4;c.strokeStyle='rgba(255,255,255,.55)';c.stroke();
     c.beginPath();c.arc(cx,my,24,0,7);c.strokeStyle=mc[2];c.lineWidth=2.2;c.stroke();
     c.beginPath();c.arc(cx,my,24,-0.9,0.35);c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=2;c.stroke();
     c.restore();
     txt(String(r.rank),cx,my+11,'900',28,r.rank===2?'#243040':'#2a1408');
    });
   });
  });
 }
 function wireStory(root,d,top){
  const b=root.querySelector('#pc-story-btn');
  if(b)b.onclick=()=>podiumStory(b,d,top);
 }

 function openPodium(){
  const d=settings().seasonPodium||{};
  const top=Array.isArray(d.top)?d.top.slice(0,3):[];
  const head='<button type="button" class="close" aria-label="بستن">×</button>'+
   '<div class="hd"><span class="ic">🏆</span><div><h3>سکوی قهرمانی فصل</h3><div class="sub">فصل '+fa(d.seasonYear||1405)+' • '+fa(d.matchesHeld||0)+' مسابقه برگزارشده • '+fa(d.playersActive||0)+' بازیکن فعال</div></div>'+storyBtnHTML()+'</div>';
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
     '<img class="avatar" src="'+esc(r.avatar||'/images/academy-logo.webp')+'" alt="">'+
     '<div class="base" style="height:'+(hs[pos]+58)+'px">'+
     '<div class="pname">'+esc(r.name||'—')+'</div>'+
     '<div class="ppts">'+fa(r.pts||0)+' امتیاز</div>'+
     (r.rankText?'<span class="rank-pill"'+pill+'>'+esc(r.rankText)+'</span>':'')+
     '</div></div>';
   }).join('');
   body='<div class="pc-podium">'+cols+'</div>';
  }
  const root=shell(head+body);
  wireStory(root,d,top);
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
