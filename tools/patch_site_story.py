#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_site_story.py — دکمهٔ «📱 استوری» روی سایت عمومی

درخواست: در پنجرهٔ پاپ‌آپ «سکوی قهرمانی فصل» سایت، به‌جای متن «FedEx Style»
یک دکمهٔ زیبای استوری باشد که خروجی‌اش همان تمپلیت ۱۰۸۰×۱۹۲۰ پنل آکادمی باشد.

پیاده‌سازی: توابع igStory/showStoryPreview از source/js/app.js (پنل) عیناً
به source/js/site-season.js منتقل شده‌اند؛ فقط منبع داده و برند عوض شده:
  پنل : avatar(r.pid)  →  سایت : r.avatar (data-URI منتشرشده)
  پنل : GA_BRAND       →  سایت : api.settings().brand

اجرا:
    python3 tools/patch_site_story.py --root . --build
"""

import argparse, hashlib, os, shutil, subprocess, sys

TARGET = os.path.join('source', 'js', 'site-season.js')
MARK = 'PC_SITE_STORY_V1'


def die(m):
    print(f"❌ {m}")
    sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    ap.add_argument('--build', action='store_true')
    a = ap.parse_args()

    p = os.path.join(a.root, TARGET)
    if not os.path.isfile(p):
        die(f"پیدا نشد: {p}")
    src = open(p, encoding='utf-8').read()
    before = hashlib.sha256(src.encode()).hexdigest()[:12]

    if MARK in src:
        print("ℹ️  قبلاً پچ شده.")
    else:
        changes = []

        # ── ۱) CSS دکمه، کنار قاعدهٔ .tag ──
        tag_css = "'.pc-pop .hd .tag{margin-inline-start:auto;flex-shrink:0;font-size:10px;font-weight:800;color:#e3c98f;border:1px solid rgba(201,162,75,.38);border-radius:999px;padding:4px 11px;background:rgba(201,162,75,.08)}'+"
        if src.count(tag_css) != 1:
            die(f"لنگر CSS دکمه پیدا نشد ({src.count(tag_css)} بار).")
        story_css = ("'.pc-story{margin-inline-start:auto;flex-shrink:0;display:inline-flex;align-items:center;gap:6px;" +
                     "font:inherit;font-size:11.5px;font-weight:900;color:#fff;cursor:pointer;" +
                     "background:linear-gradient(135deg,#d62976,#fa7e1e);border:none;border-radius:999px;" +
                     "padding:7px 15px;box-shadow:0 6px 18px -6px rgba(214,41,118,.75);" +
                     "transition:transform .15s ease,box-shadow .15s ease}'+" +
                     "'.pc-story:hover{transform:translateY(-1px);box-shadow:0 9px 24px -6px rgba(250,126,30,.8)}'+" +
                     "'.pc-story:disabled{opacity:.65;cursor:progress;transform:none}'+" +
                     "'.pc-story svg{width:13px;height:13px;fill:currentColor}'+")
        src = src.replace(tag_css, tag_css + "\n  " + story_css, 1)
        changes.append("CSS دکمهٔ استوری اضافه شد")

        # ── ۲) موتور استوری (پورت‌شده از پنل) ──
        anchor = " function openPodium(){"
        if src.count(anchor) != 1:
            die("لنگر openPodium پیدا نشد.")
        engine = r"""/* ══════════════ استوری ۱۰۸۰×۱۹۲۰ — همان تمپلیت پنل آکادمی ══════════════
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

"""
        src = src.replace(anchor, engine + anchor, 1)
        changes.append("موتور استوری (پورت‌شده از پنل) اضافه شد")

        # ── ۳) جای برچسب FedEx Style، دکمهٔ استوری ──
        old_tag = '<span class="tag">FedEx Style</span></div>\';'
        if src.count(old_tag) != 1:
            die(f"لنگر برچسب FedEx Style پیدا نشد ({src.count(old_tag)} بار).")
        src = src.replace(old_tag, '\'+storyBtnHTML()+\'</div>\';', 1)
        changes.append("دکمه جای برچسب «FedEx Style» نشست")

        # ── ۴) وصل کردن کلیک پس از ساخت پاپ‌آپ ──
        old_shell = "   body='<div class=\"pc-podium\">'+cols+'</div>';\n  }\n  shell(head+body);\n }\n function openCalendar(){"
        if src.count(old_shell) != 1:
            die("لنگر shell(head+body) پیدا نشد.")
        new_shell = ("   body='<div class=\"pc-podium\">'+cols+'</div>';\n  }\n"
                     "  const root=shell(head+body);\n"
                     "  wireStory(root,d,top);\n }\n function openCalendar(){")
        src = src.replace(old_shell, new_shell, 1)
        changes.append("کلیک دکمه وصل شد")

        if not os.path.exists(p + '.storybak'):
            shutil.copy2(p, p + '.storybak')
        open(p, 'w', encoding='utf-8').write(src)
        print(f"✅ پچ استوری سایت اعمال شد ({before} → {hashlib.sha256(src.encode()).hexdigest()[:12]})")
        for c in changes:
            print(f"   • {c}")

    # ── بازرسی ──
    checks = [
        ("مارکر نسخه", MARK in src),
        ("موتور igStory", 'function igStory(btn,fname,paint)' in src),
        ("پیش‌نمایش استوری", 'function showStoryPreview(blob,fname)' in src),
        ("نقاشی سکو", 'function podiumStory(btn,d,top)' in src),
        ("دکمه در سرصفحه", "storyBtnHTML()" in src),
        ("برچسب FedEx Style حذف شد", '<span class="tag">FedEx Style</span>' not in src),
        ("CSS دکمه", '.pc-story{' in src),
        ("کلیک وصل شده", 'wireStory(root,d,top);' in src),
        ("ابعاد ۱۰۸۰×۱۹۲۰", 'const STORY_W=1080, STORY_H=1920;' in src),
        ("آواتار از دادهٔ منتشرشده", 'im.src=r.avatar' in src),
        ("لوگو از برند سایت", 'push(b.logoHd)' in src),
        ("زنجیرهٔ جایگزین لوگو", 'li<brand.logos.length' in src),
        ("صبر برای فونت", 'document.fonts.ready' in src),
    ]
    print("\n🔎 بازرسی:")
    bad = 0
    for label, ok in checks:
        print(f"   {'✅' if ok else '❌'} {label}")
        bad += 0 if ok else 1
    if bad:
        die("بازرسی رد شد.")

    if a.build:
        print("\n🏗  ساخت باندل عمومی…")
        r = subprocess.run([sys.executable, os.path.join(a.root, 'source', 'build_public_cloud.py')], cwd=a.root)
        if r.returncode != 0:
            die("بیلد عمومی خطا داد.")
        print("✅ باندل عمومی ساخته شد.")


if __name__ == '__main__':
    main()
