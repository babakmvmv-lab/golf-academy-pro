#!/usr/bin/env python3
"""Integrate cloud persistence into the imported static storefront without changing its design.
Original exported chunks stay intact for cached clients. Adapted chunks get content-hashed
names, and references in HTML/RSC/manifest files are updated together. No Next server,
new project or public API server is created. The dedicated web_store migration and
web-sync deployment are separate, explicit operations; academy storage stays untouched.
"""
from pathlib import Path
import hashlib,json,re,shutil,sys,subprocess
sys.path.insert(0,str(Path(__file__).resolve().parent))
ROOT=Path(__file__).resolve().parent.parent
CHUNKS=ROOT/'_next/static/chunks'
MANIFEST=ROOT/'source/public-cloud-manifest.json'
old_manifest=json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
outputs={}

def load(name):
    # Continue from the already-patched output when a chunk is adapted in several
    # blocks; re-reading the pristine original would silently drop earlier patches.
    return (CHUNKS/outputs[name]).read_text() if name in outputs else (CHUNKS/name).read_text()

def replace(s,a,b,count=1):
    actual=s.count(a)
    if actual!=count:raise RuntimeError(f'Expected {count} unique adapter anchors, got {actual}: {a[:140]}')
    return s.replace(a,b)

def save(name,s):
    # A failed bootstrap must not take down the original public design.
    guards={
      'window.PC_SITE_CLOUD.useTable(t,"settings",r.DEFAULT_SITE_SETTINGS)':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.useTable(t,"settings",r.DEFAULT_SITE_SETTINGS):r.DEFAULT_SITE_SETTINGS)',
      'window.PC_SITE_CLOUD.liveState(l,"courses",Z)':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.liveState(l,"courses",Z):(0,l.useState)(Z))',
      'window.PC_SITE_CLOUD.liveState(l,"testimonials",f)':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.liveState(l,"testimonials",f):(0,l.useState)(f))',
      'window.PC_SITE_CLOUD.useCard(pcReact,e,c)':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.useCard(pcReact,e,c):e)',
      'window.PC_SITE_CLOUD.productHref(e)':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.productHref(e):`/product/${e.slug}`)',
      'window.PC_SITE_CLOUD.useTable(s,"products",e)':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.useTable(s,"products",e):e)',
      'window.PC_SITE_CLOUD.useProduct(s,e)':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.useProduct(s,e):e)',
      'window.PC_SITE_CLOUD.liveState(s,"reviews",f,{byPage:true,productId:e})':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.liveState(s,"reviews",f,{byPage:true,productId:e}):(0,s.useState)(f))',
      'window.PC_SITE_CLOUD.gateSessionValid()':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.gateSessionValid():false)',
      'window.PC_SITE_CLOUD.subscribe(refresh)':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.subscribe(refresh):()=>{})',
      'window.PC_SITE_CLOUD.brandShort(e.brand)':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.brandShort(e.brand):"Putt Club")',
      'window.PC_SITE_CLOUD.brandShort(r)':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.brandShort(r):"Putt Club")',
      'window.PC_SITE_CLOUD.request':'(window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.request:fetch)',
    }
    for before,after in guards.items():s=s.replace(before,after)
    filename='pc-'+hashlib.sha256(s.encode()).hexdigest()[:12]+'-'+name
    (CHUNKS/filename).write_text(s)
    subprocess.run(['node','--check',str(CHUNKS/filename)],check=True) # adapted chunks must stay valid JS
    outputs[name]=filename

# The old public hook returned DEFAULT_SITE_SETTINGS forever; it had no live provider.
name='00.n2u15h-glt.js';s=load(name)
a='35607,e=>{"use strict";e.i(43476);var t=e.i(71645),r=e.i(33199);e.i(1517),e.i(88062);let n=(0,t.createContext)(r.DEFAULT_SITE_SETTINGS);e.s(["useSiteSettings",0,function(){return(0,t.useContext)(n)}])}'
b='35607,e=>{"use strict";var t=e.i(71645),r=e.i(33199),n=e.i(1517);e.s(["useSiteSettings",0,function(){return n.mergeSiteSettings(window.PC_SITE_CLOUD.useTable(t,"settings",r.DEFAULT_SITE_SETTINGS))}])}'
s=replace(s,a,b)
save(name,s)

# Original course/testimonial state is retained, but now subscribed to shared published data.
name='11h9c3275amaf.js';s=load(name)
s=replace(s,'await fetch((0,F.withBase)("/api/site/courses"))','await window.PC_SITE_CLOUD.request((0,F.withBase)("/api/site/courses"))')
s=replace(s,'await fetch((0,h.withBase)("/api/site/testimonials"))','await window.PC_SITE_CLOUD.request((0,h.withBase)("/api/site/testimonials"))')
s=replace(s,'[d,x]=(0,l.useState)(Z)','[d,x]=window.PC_SITE_CLOUD.liveState(l,"courses",Z)')
s=replace(s,'[y,j]=(0,l.useState)(f)','[y,j]=window.PC_SITE_CLOUD.liveState(l,"testimonials",f)')
s=replace(s,'if(e&&s.length)return void x(s)','if(e)return void x(s)')
s=replace(s,'e&&s.length&&x(s)','e&&x(s)')
s=replace(s,'if(e&&l.testimonials?.length)return void j(l.testimonials)','if(e&&Array.isArray(l.testimonials))return void j(l.testimonials)')
s=replace(s,'e&&s.length&&j(s)','e&&j(s)')
# Old public fallback must never overwrite an authoritative empty published list.
save(name,s)

# Three copies of the shared product-card module exist in this static export.
for name in ['07~usxe5i88cs.js','0bk206q4lcysm.js','10zhlc.ydq6io.js']:
    s=load(name)
    s=replace(s,'d=e.i(88062);e.s(["default",0,function({p:e,index:c=0}){let',
              'd=e.i(88062);var pcReact=e.i(71645);e.s(["default",0,function({p:e,index:c=0}){e=window.PC_SITE_CLOUD.useCard(pcReact,e,c);let')
    s=replace(s,'href:`/product/${e.slug}`','href:window.PC_SITE_CLOUD.productHref(e)')
    s=replace(s,'(e.price,e.oldPrice);return',
              '(e.price,e.oldPrice);if(e._hidden)return null;return')
    if name=='0bk206q4lcysm.js':
        s=replace(s,'function({items:e,initialCat:d}){let c=',
                  'function({items:e,initialCat:d}){e=window.PC_SITE_CLOUD.useTable(s,"products",e);let c=')
        # Keep the untouched price filter at the new max when inventory/prices change.
        s=replace(s,'[S,P]=(0,s.useState)(!1);(0,s.useEffect)',
                  '[S,P]=(0,s.useState)(!1);let pcMax=(0,s.useRef)(c);(0,s.useEffect)(()=>{k(v=>v===pcMax.current?c:Math.min(v,c));pcMax.current=c},[c]);(0,s.useEffect)')
    if name=='10zhlc.ydq6io.js':
        s=replace(s,'function({product:e}){let[n,o]=','function({product:e}){e=window.PC_SITE_CLOUD.useProduct(s,e);let[n,o]=')
        s=replace(s,'M=(t=!0)=>{w({productId:e.id','M=(t=!0)=>{if(e._unavailable||e.stock<=0)return false;w({productId:e.id')
        s=replace(s,'y),t&&z()};return(0,t.jsxs)("div",{className:"mt-8 grid',
                  'y),t&&z()};(0,s.useEffect)(()=>o(0),[e.id,JSON.stringify(e.images)]);return(0,t.jsxs)("div",{className:"mt-8 grid')
        s=replace(s,'onClick:()=>{M(!1),S.push("/checkout")}',
                  'onClick:()=>{if(M(!1)!==false)S.push("/checkout")}')
        s=replace(s,'function({productId:e,rating:p,reviewCount:u,initialReviews:f}){let b=',
                  'function({productId:e,rating:p,reviewCount:u,initialReviews:f}){if(window.PC_SITE_CLOUD?.useProductReviewMeta){let meta=window.PC_SITE_CLOUD.useProductReviewMeta(s,e,p,u);e=meta.id;p=meta.rating;u=meta.count}let b=')
        s=replace(s,'[j,v]=(0,s.useState)(f);','[j,v]=window.PC_SITE_CLOUD.liveState(s,"reviews",f,{byPage:true,productId:e});')
    save(name,s)

# Gate remains enabled by default, works on both viewports, and reloads published policy.
name='0ymry5ef_i~wt.js';s=load(name)
s=replace(s,'await fetch((0,d.withBase)("/api/site/content"))','await window.PC_SITE_CLOUD.request((0,d.withBase)("/api/site/content"))')
s=replace(s,'await fetch((0,d.withBase)("/api/site/shop-gate/unlock"),','await window.PC_SITE_CLOUD.request((0,d.withBase)("/api/site/shop-gate/unlock"),')
a='(0,n.useEffect)(()=>{let e=!0;return function(){try{return"1"===sessionStorage.getItem(u)}catch{return!1}}()&&i(!0),p().then(t=>{e&&s(t)}),()=>{e=!1}},[])'
b='(0,n.useEffect)(()=>{let alive=true;const refresh=()=>p().then(g=>{if(alive){s(g);i(window.PC_SITE_CLOUD.gateSessionValid())}});refresh();const off=window.PC_SITE_CLOUD.subscribe(refresh);return()=>{alive=false;off()}},[])'
s=replace(s,a,b)
s=replace(s,'x=(0,n.useCallback)(async e=>{try{','x=(0,n.useCallback)(async e=>{if(!window.PC_SITE_CLOUD)return;try{')
s=replace(s,'s=(e.brand.faShort,"Putt Club")','s=window.PC_SITE_CLOUD.brandShort(e.brand)')
s=replace(s,'children:s.split(" ")[1]','children:s.split(" ").slice(1).join(" ")')
s=replace(s,'children:["Putt ",(0,t.jsx)("span",{className:"text-gold-400",children:"Club"})]',
          'children:[window.PC_SITE_CLOUD.brandShort(r).split(" ")[0]+" ",(0,t.jsx)("span",{className:"text-gold-400",children:window.PC_SITE_CLOUD.brandShort(r).split(" ").slice(1).join(" ")})]')
s=replace(s,'alt:"لوگوی آکادمی گلف پات کلاب"','alt:"لوگوی "+e.brand.faName',count=2)
s=replace(s,'className:"leading-none",children:',
          'className:"leading-none",style:{maxWidth:"min(44vw,230px)",overflowWrap:"anywhere"},children:')
save(name,s)

# Never expose a cloud gate code in plaintext or silently restore B when the admin
# merely edits a title. Blank password means keep the existing digest.
name='0s294n3n15ion.js';s=load(name)
s=replace(s,'label:"فروش کل"','label:"فروش این دستگاه"')
s=replace(s,'label:"سفارش‌ها",value:','label:"سفارش‌ها (محلی)",value:')
s=replace(s,'label:"کاربران",value:','label:"کاربران (محلی)",value:')
s=replace(s,'let m=async()=>{if(!e)return;if(x(""),','let m=async()=>{if(!e)return;o(!1);if(x(""),')
s=replace(s,'code:"string"==typeof t.code&&t.code.trim()?t.code.trim():s.code',
          'code:"string"==typeof t.code?t.code.trim():s.code')
s=replace(s,'if(!/^[A-Za-z0-9]{1,20}$/.test(e.code.trim()))',
          'if(e.code.trim()&&!/^[A-Za-z0-9]{1,20}$/.test(e.code.trim()))')
s=replace(s,'children:"رمز فعلی"','children:"رمز جدید (خالی = بدون تغییر)"')
s=replace(s,'value:e.code,onChange:s=>a({...e,code:s.target.value}),dir:"ltr",placeholder:"B"',
          'type:"password",autoComplete:"new-password",value:e.code,onChange:s=>a({...e,code:s.target.value}),dir:"ltr",placeholder:"برای تغییر رمز بنویسید"')
# Store operations replace only the private /admin workspace, not the public storefront or site CMS.
start=s.index('e.s(["default",0,function(){let e=(0,l.useRouter)()')
end=s.rindex('}],24285)')+len('}],24285)')
workspace='e.s(["default",0,function(){let[ready,setReady]=(0,t.useState)(false),ref=(0,t.useRef)(null);(0,t.useEffect)(()=>{setReady(true)},[]);(0,t.useEffect)(()=>{if(!ready||!ref.current)return;let alive=true,el=ref.current;el.textContent="در حال باز کردن پنل فروشگاه…";if(window.PC_SITE_CLOUD?.loadShopOps)window.PC_SITE_CLOUD.loadShopOps().then(()=>{if(alive&&el.isConnected)window.SHOP_OPS.mount(el)}).catch(err=>{if(alive)el.textContent=err.message});else el.textContent="پنل فروشگاه بارگذاری نشد؛ صفحه را تازه کنید.";return()=>{alive=false;if(window.SHOP_OPS)window.SHOP_OPS.unmount()}},[ready]);return ready?(0,s.jsx)("div",{ref}):(0,s.jsx)("div",{className:"flex min-h-screen items-center justify-center",children:(0,s.jsx)(g.Loader2,{size:32,className:"animate-spin text-gold-400"})})}],24285)'
s=s[:start]+workspace+s[end:]
save(name,s)

# Clear the previous green success label before a new save attempt starts.
name='116gnhx5f2czu.js';s=load(name)
s=replace(s,'let d=async(e,s)=>{if(i(e),l){','let d=async(e,s)=>{n(null);if(i(e),l){')
# Item-based marquee management inside the existing content tab; no React coupling.
# Sibling of the hero card (not nested inside it) so existing section selectors stay unambiguous.
s=replace(s,'(0,t.jsx)(ee,{onSave:()=>a("hero",e.hero),saving:"hero"===r,saved:"hero"===i})]})',
          '(0,t.jsx)(ee,{onSave:()=>a("hero",e.hero),saving:"hero"===r,saved:"hero"===i})]}),(0,t.jsx)("section",{className:"rounded-3xl border border-gold-500/10 bg-forest-900/70 p-6",ref:function(el){el&&window.PC_SITE_CLOUD&&window.PC_SITE_CLOUD.marqueeEditor(el)}}),(0,t.jsx)("section",{className:"rounded-3xl border border-gold-500/10 bg-forest-900/70 p-6",ref:function(el){el&&window.PC_SITE_CLOUD&&window.PC_SITE_CLOUD.showcaseEditor(el)}}),(0,t.jsx)("section",{className:"rounded-3xl border border-gold-500/10 bg-forest-900/70 p-6",ref:function(el){el&&window.PC_SITE_CLOUD&&window.PC_SITE_CLOUD.signupEditor&&window.PC_SITE_CLOUD.signupEditor(el)}})')
save(name,s)

# Never silently return to local-demo saves when the cloud bootstrap fails to load.
for name in ['0h.3tv9nj2ufm.js','0ia~_hsdpy603.js','12lzqn_~_d9qf.js']:
    s=load(name)
    pat=re.compile(r'async function (\w+)\((\w+),(\w+)\)\{let (\w+)=(\w+)\(\);try\{')
    matches=list(pat.finditer(s))
    if len(matches)!=1:raise RuntimeError('Admin transport fallback anchor changed: '+name)
    m=matches[0];urlarg=m.group(2);optarg=m.group(3)
    check='if(!window.PC_SITE_CLOUD&&/^\\/api\\/admin\\/(?:site|products|categories|reviews|stats)/.test('+urlarg+')){let message="لایهٔ ابری بارگذاری نشد؛ صفحه را دوباره بارگذاری کنید. تغییرات به‌عنوان ذخیره‌شده اعلام نمی‌شوند.";if(('+optarg+'?.method||"GET")!=="GET")alert(message);let data='+urlarg+'.endsWith("/stats")?{products:0,orders:0,users:0,reviews:0,revenue:0,lowStock:[],recent:[],byCat:[]}:{settings:{},products:[],categories:[],reviews:[],courses:[],testimonials:[]};return new Response(JSON.stringify({...data,error:message}),{status:503,headers:{"Content-Type":"application/json"}})}'
    delegate='if(window.PC_SITE_CLOUD&&/^\\/api\\/admin\\/(?:site|products|categories|reviews|stats)/.test('+urlarg+'))return window.PC_SITE_CLOUD.request('+urlarg+','+optarg+');'
    prefix=m.group(0);replacement=prefix.replace('let '+m.group(4)+'=',delegate+check+'let '+m.group(4)+'=',1)
    s=s[:m.start()]+replacement+s[m.end():]
    s,n=re.subn(r'("clearAdmin",0,function\(\)\{)(localStorage\.removeItem\([a-z]+\))',r'\1window.PC_SITE_CLOUD?.signOut();\2',s)
    if n!=1:raise RuntimeError('Logout anchor changed: '+name)
    if name=='12lzqn_~_d9qf.js':
        s=replace(s,'let D=async t=>{t.preventDefault(),S(""),v(!0);try{let t=null;',
                  'let D=async t=>{t.preventDefault(),S(""),v(!0);try{if(window.PC_SITE_CLOUD?.signInAdmin){let result=await window.PC_SITE_CLOUD.signInAdmin(f,y);(0,x.setAdmin)(result.user);e.push(result.user.store_only?"/admin":w);return}let t=null;')
        s=replace(s,'}catch{S("ارتباط با سرور برقرار نشد.")}finally{v(!1)}',
                  '}catch(err){S(err?.message||"ارتباط با سرور برقرار نشد.")}finally{v(!1)}')
    save(name,s)

# ── Public form submissions travel through the cloud layer (orders/reviews/testimonials). ──
# Static hosting answers 404/405 for these; the old localStorage fallbacks silently faked success.
name='0tzhqo2g7futr.js';s=load(name)
s=replace(s,'s=await fetch((0,C.withBase)("/api/orders"),','s=await window.PC_SITE_CLOUD.request((0,C.withBase)("/api/orders"),')
save(name,s)

name='10zhlc.ydq6io.js';s=load(name)
s=replace(s,'s=await fetch((0,g.withBase)("/api/reviews"),','s=await window.PC_SITE_CLOUD.request((0,g.withBase)("/api/reviews"),')
save(name,s)

name='11h9c3275amaf.js';s=load(name)
s=replace(s,'e=await fetch((0,h.withBase)("/api/site/testimonials"),{method:"POST"','e=await window.PC_SITE_CLOUD.request((0,h.withBase)("/api/site/testimonials"),{method:"POST"')
# ── Academy section CTA: the «فروشگاه تجهیزات» pill becomes the two season popup buttons. ──
acad_shop='(0,t.jsx)(s.default,{href:"/shop",className:"inline-flex items-center justify-center gap-2 rounded-full border border-gold-500/30 px-7 py-3.5 text-sm font-bold text-gold-300 transition-all hover:border-gold-400 hover:bg-gold-500/10",children:"فروشگاه تجهیزات"})'
acad_season=('(0,t.jsxs)("button",{type:"button","data-season-popup":"podium",className:"inline-flex items-center justify-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/10 px-7 py-3.5 text-sm font-black text-gold-300 transition-all hover:border-gold-400 hover:bg-gold-500/20",children:["🏆","سکوی قهرمانی فصل"]}),'
 '(0,t.jsxs)("button",{type:"button","data-season-popup":"calendar",className:"inline-flex items-center justify-center gap-2 rounded-full border border-cream/25 px-7 py-3.5 text-sm font-bold text-cream transition-all hover:border-gold-400 hover:text-gold-300",children:["📅","تقویم فصل"]})')
s=replace(s,acad_shop,acad_season)
# ── Contact section: real Telegram/WhatsApp links when the admin fills them. ──
contact_old='let e=(0,x.useSiteSettings)().contact,s=[{icon:d.Phone,title:"تلفن آکادمی",value:e.phoneFa,href:`tel:${e.phone}`,ltr:!0},{icon:o.Mail,title:"ایمیل",value:e.email,href:`mailto:${e.email}`,ltr:!0},{icon:n.MapPin,title:"آدرس",value:e.address,href:void 0,ltr:!1},{icon:l.Camera,title:"اینستاگرام",value:`@${e.instagram}`,href:e.instagramUrl,ltr:!0}];'
contact_new=('let e=(0,x.useSiteSettings)().contact,'
 'pcT=v2=>String(v2||"").trim(),'
 'pcTg=p2=>(0,t.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",width:p2.size||24,height:p2.size||24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round",strokeLinejoin:"round",className:p2.className,"aria-hidden":!0,children:[(0,t.jsx)("path",{d:"m22 2-7 20-4-9-9-4Z"}),(0,t.jsx)("path",{d:"M22 2 11 13"})]}),'
 'pcWa=p2=>(0,t.jsx)("svg",{xmlns:"http://www.w3.org/2000/svg",width:p2.size||24,height:p2.size||24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round",strokeLinejoin:"round",className:p2.className,"aria-hidden":!0,children:(0,t.jsx)("path",{d:"M7.9 20A9 9 0 1 0 4 16.1L2 22Z"})}),'
 'pcTel=v2=>/^https?:\\/\\//i.test(v2)?v2:"https://t.me/"+v2.replace(/^@/,""),'
 'pcWaU=v2=>/^https?:\\/\\//i.test(v2)?v2:"https://wa.me/"+v2.replace(/^0/,"98").replace(/[^0-9]/g,""),'
 's=[{icon:d.Phone,title:"تلفن آکادمی",value:e.phoneFa,href:`tel:${e.phone}`,ltr:!0},{icon:o.Mail,title:"ایمیل",value:e.email,href:`mailto:${e.email}`,ltr:!0},{icon:n.MapPin,title:"آدرس",value:e.address,href:void 0,ltr:!1},{icon:l.Camera,title:"اینستاگرام",value:`@${e.instagram}`,href:e.instagramUrl,ltr:!0},'
 '...(pcT(e.telegram)?[{icon:pcTg,title:"تلگرام",value:pcT(e.telegram).replace(/^@/,""),href:pcTel(e.telegram),ltr:!0}]:[]),'
 '...(pcT(e.whatsapp)?[{icon:pcWa,title:"واتس‌اپ",value:pcT(e.whatsapp),href:pcWaU(e.whatsapp),ltr:!0}]:[])];')
s=replace(s,contact_old,contact_new)
save(name,s)

# ── Storefront: manual order (sortOrder from the shop panel) is the default sort; chips follow category order. ──
name='0bk206q4lcysm.js';s=load(name)
s=replace(s,'{key:"popular",label:"محبوب'+chr(0x200c)+'ترین"}','{key:"popular",label:"چیدمان فروشگاه"}')
s=replace(s,'default:return[...s].sort((e,t)=>t.reviewCount-e.reviewCount)','default:return[...s].sort((e,t)=>(e.sortOrder??1e9)-(t.sortOrder??1e9)||t.reviewCount-e.reviewCount)')
chips_old='let $=(0,s.useMemo)(()=>{let t=new Map;return e.forEach(e=>t.set(e.category,(t.get(e.category)??0)+1)),[...t.entries()]},[e])'
chips_new=('let $=(0,s.useMemo)(()=>{let t=new Map;e.forEach(e=>t.set(e.category,(t.get(e.category)??0)+1));'
 'let o=[];try{o=window.PC_SITE_CLOUD?window.PC_SITE_CLOUD.shopCategories():[]}catch(x){}'
 'let w=x=>{const c=o.indexOf(x);return c<0?1e3:c};'
 'return[...t.entries()].sort((x,c)=>w(x[0])-w(c[0]))},[e])')
s=replace(s,chips_old,chips_new)
save(name,s)

# ── Footer (site + shop): genuine telegram/whatsapp links; footer category order follows the layout editor. ──
name='0ymry5ef_i~wt.js';s=load(name)
tg_old='s.telegram&&(0,t.jsx)("a",{href:s.telegram,target:"_blank",rel:"noreferrer","aria-label":"تلگرام آکادمی",className:"grid size-10 place-items-center rounded-full border border-forest-600/70 text-cream/70 transition-all hover:border-gold-400 hover:text-gold-300",children:(0,t.jsx)(E.Send,{size:17,strokeWidth:1.7})}),'
tg_new=('s.telegram&&(0,t.jsx)("a",{href:/^https?:/i.test(s.telegram)?s.telegram:"https://t.me/"+s.telegram.replace(/^@/,""),target:"_blank",rel:"noreferrer","aria-label":"تلگرام آکادمی",className:"grid size-10 place-items-center rounded-full border border-forest-600/70 text-cream/70 transition-all hover:border-gold-400 hover:text-gold-300",children:(0,t.jsx)(E.Send,{size:17,strokeWidth:1.7})}),'
 's.whatsapp&&(0,t.jsx)("a",{href:/^https?:/i.test(s.whatsapp)?s.whatsapp:"https://wa.me/"+s.whatsapp.replace(/^0/,"98").replace(/[^0-9]/g,""),target:"_blank",rel:"noreferrer","aria-label":"واتس‌اپ آکادمی",className:"grid size-10 place-items-center rounded-full border border-forest-600/70 text-cream/70 transition-all hover:border-gold-400 hover:text-gold-300",children:(0,t.jsx)("svg",{xmlns:"http://www.w3.org/2000/svg",width:17,height:17,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.7,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":!0,children:(0,t.jsx)("path",{d:"M7.9 20A9 9 0 1 0 4 16.1L2 22Z"})})}),')
s=replace(s,tg_old,tg_new)
phone_li='(0,t.jsxs)("li",{className:"flex items-center gap-3",dir:"ltr",children:[(0,t.jsx)(C.Phone,{size:16,className:"shrink-0 text-gold-500"}),(0,t.jsx)("a",{href:`tel:${s.phone}`,className:"transition-colors hover:text-gold-300",children:s.phoneFa})]})'
phone_new=(phone_li+
 ',s.telegram&&(0,t.jsxs)("li",{className:"flex items-center gap-3",dir:"ltr",children:[(0,t.jsx)(E.Send,{size:16,className:"shrink-0 text-gold-500"}),(0,t.jsx)("a",{href:/^https?:/i.test(s.telegram)?s.telegram:"https://t.me/"+s.telegram.replace(/^@/,""),target:"_blank",rel:"noreferrer",className:"transition-colors hover:text-gold-300",children:"تلگرام"})]}),'
 's.whatsapp&&(0,t.jsxs)("li",{className:"flex items-center gap-3",dir:"ltr",children:[(0,t.jsx)("svg",{xmlns:"http://www.w3.org/2000/svg",width:16,height:16,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round",strokeLinejoin:"round",className:"shrink-0 text-gold-500","aria-hidden":!0,children:(0,t.jsx)("path",{d:"M7.9 20A9 9 0 1 0 4 16.1L2 22Z"})}),(0,t.jsx)("a",{href:/^https?:/i.test(s.whatsapp)?s.whatsapp:"https://wa.me/"+s.whatsapp.replace(/^0/,"98").replace(/[^0-9]/g,""),target:"_blank",rel:"noreferrer",className:"transition-colors hover:text-gold-300",children:"واتس‌اپ"})]})')
s=replace(s,phone_li,phone_new)
s=replace(s,'T.CATEGORIES.map(e=>(0,t.jsx)("li",{children:(0,t.jsx)(a.default,{href:`/shop?cat=${encodeURIComponent(e)}`,className:"transition-colors hover:text-gold-300",children:e})},e))',
          '((window.PC_SITE_CLOUD&&window.PC_SITE_CLOUD.shopCategories().length)?window.PC_SITE_CLOUD.shopCategories():T.CATEGORIES).map(e=>(0,t.jsx)("li",{children:(0,t.jsx)(a.default,{href:`/shop?cat=${encodeURIComponent(e)}`,className:"transition-colors hover:text-gold-300",children:e})},e))')
save(name,s)

# ── Site admin: the right sidebar menu must scroll when it outgrows the viewport. ──
name='116gnhx5f2czu.js';s=load(name)
s=replace(s,'(0,t.jsx)("nav",{className:"mt-6 flex-1 space-y-1.5",children:ed.map',
          '(0,t.jsx)("nav",{style:{overflowY:"auto",overscrollBehavior:"contain",scrollbarWidth:"thin"},className:"mt-6 flex-1 space-y-1.5",children:ed.map')
save(name,s)

# ── Site admin: course eye-toggle must not fail silently (expired session etc.) ──
name='116gnhx5f2czu.js';s=load(name)
s=replace(s,'if(s&&s.ok){let e=await s.json();l(s=>s?.map(s=>s.id===t.id?e.course:s)??null)}f(null)',
          'if(s&&s.ok){let e=await s.json();l(s=>s?.map(s=>s.id===t.id?e.course:s)??null)}else{window.alert("تغییر نمایش دوره ذخیره نشد؛ از آیکون ☁ پایین، وضعیت ابر و ورود مدیر را بررسی کنید.")}f(null)')
save(name,s)

# ── Site admin: image upload buttons (URL option stays). ──
name='116gnhx5f2czu.js';s=load(name)
s=replace(s,'className:"grid size-11 shrink-0 place-items-center rounded-xl bg-gold-500 text-forest-950","aria-label":"افزودن عکس",children:(0,t.jsx)(_,{size:17})})',
          'className:"grid size-11 shrink-0 place-items-center rounded-xl bg-gold-500 text-forest-950","aria-label":"افزودن عکس",children:(0,t.jsx)(_,{size:17})}),(0,t.jsx)("button",{type:"button",onClick:()=>window.PC_IMG&&window.PC_IMG.pick(1400,u=>{g("images",[...d.images,u]);m("")}),className:"grid size-11 shrink-0 place-items-center rounded-xl border border-gold-500/40 text-gold-300","aria-label":"بارگذاری عکس از فایل",title:"بارگذاری عکس از فایل (تبدیل خودکار به WebP)",children:"⬆"})')
for label,field_name,max_dim,setter in [('آدرس فایل لوگو','logo',512,'o("brand",{...e.brand,logo:u})'),('آدرس لوگوی باکیفیت','logoHd',1024,'o("brand",{...e.brand,logoHd:u})'),('آدرس تصویر بخش','image',1600,'o("about",{...e.about,image:u})')]:
    inp_old='(0,t.jsx)(et,{label:"'+label+'",children:(0,t.jsx)("input",{value:e.'+( 'brand.' if field_name in('logo','logoHd') else 'about.')+field_name+',onChange:t=>o("'+('brand' if field_name in('logo','logoHd') else 'about')+'",{...e.'+('brand' if field_name in('logo','logoHd') else 'about')+','+field_name+':t.target.value}),dir:"ltr",className:`${Y} text-left font-mono text-xs`})})'
    inp_new='(0,t.jsx)(et,{label:"'+label+'",children:(0,t.jsxs)("div",{className:"flex gap-2",children:[(0,t.jsx)("input",{value:e.'+('brand.' if field_name in('logo','logoHd') else 'about.')+field_name+',onChange:t=>o("'+('brand' if field_name in('logo','logoHd') else 'about')+'",{...e.'+('brand' if field_name in('logo','logoHd') else 'about')+','+field_name+':t.target.value}),dir:"ltr",className:`${Y} text-left font-mono text-xs`}),(0,t.jsx)("button",{type:"button",onClick:()=>window.PC_IMG&&window.PC_IMG.pick('+str(max_dim)+',u=>'+setter+'),className:"shrink-0 self-center rounded-xl border border-gold-500/40 px-3 py-2 text-xs font-bold text-gold-300",children:"بارگذاری"})]})})'
    s=replace(s,inp_old,inp_new)
save(name,s)

# Build one blocking bootstrap before the original async Next chunks.
cloud=(ROOT/'source/js/cloud.js').read_text()
url=re.search(r"url: '([^']+)'",cloud).group(1)
key=re.search(r"key: '([^']+)'",cloud).group(1)
if not key.startswith('sb_publishable_'):raise RuntimeError('Only the existing public publishable key may be bundled.')
seed={}
for kind,filename in [('products','products'),('categories','categories'),('courses','site-courses'),('testimonials','site-testimonials'),('reviews','reviews')]:
    seed[kind]=json.loads((ROOT/'data'/f'{filename}.json').read_text())
seed['settings']={x['key']:x['value'] for x in json.loads((ROOT/'data/site-settings.json').read_text())}
config={'url':url,'key':key,'seed':seed,'exportedSlugs':[x['slug'] for x in seed['products']],'defaultGateCode':'B','adminEmail':'admin@puttclub.ir'}
font_css=(ROOT/'_next/static/chunks/00ku6mp-zjb~6.css').read_text()
fonts=''.join(x for x in re.findall(r'@font-face\{[^}]+\}',font_css) if 'font-family:Vazirmatn;' in x).replace('../media/','/_next/static/media/')
ops='/* Generated by source/build_public_cloud.py; private shop workspace code, no business data. */\n'+(ROOT/'source/assets/vendor/jalaali-browser.js').read_text()+'\nwindow.SHOP_PRINT_FONTS='+json.dumps(fonts)+';\nwindow.SHOP_OPS_CSS='+json.dumps((ROOT/'source/css/shop-ops.css').read_text(),ensure_ascii=False)+';\n'+(ROOT/'source/js/shop-ops.js').read_text()
shop_asset='shop-ops.'+hashlib.sha256(ops.encode()).hexdigest()[:12]+'.js'
(ROOT/shop_asset).write_text(ops);config['shopOpsAsset']=shop_asset
script='/* Generated by source/build_public_cloud.py; edit source/js/site-cloud.js instead. */\nwindow.PC_SITE_CLOUD_CONFIG='+json.dumps(config,ensure_ascii=False,separators=(',',':'))+';\n'+(ROOT/'source/js/site-cloud.js').read_text()
script+='\n'+(ROOT/'source/js/site-marquee.js').read_text()+'\n'+(ROOT/'source/js/site-showcase.js').read_text()+'\n'+(ROOT/'source/js/site-payments.js').read_text()
script+='\n'+(ROOT/'source/js/site-img.js').read_text()+'\n'+(ROOT/'source/js/site-season.js').read_text()+'\n'+(ROOT/'source/js/site-signup.js').read_text()
bootstrap='site-cloud.'+hashlib.sha256(script.encode()).hexdigest()[:12]+'.js'
(ROOT/bootstrap).write_text(script)

# Replace references, not the storefront markup, Persian typography or layout.
# Map every generated form of each original chunk (any hash prefix from any
# previous or interrupted build) to its current name; bare originals only match
# when not already wrapped, so re-running after a crash can never double names.
replacements={**outputs}
originals=set(outputs)
new_outputs=set(outputs.values())
updated=[]
for file in ROOT.rglob('*'):
    if not file.is_file() or file.suffix not in {'.html','.txt','.js'}:continue
    rel=file.relative_to(ROOT)
    if rel.parts[0] in {'.git','source','docs','supabase','node_modules','assets'}:continue
    if file.name in {'GolfAcademy_PRO.html','enter-academy.js'} or (file.name.startswith('site-cloud.') or file.name.startswith('shop-ops.')):continue
    if file.parent==CHUNKS and file.name in originals|new_outputs:continue
    text=file.read_text();before=text
    alts=[]
    for original in sorted(replacements,key=len,reverse=True):
        alts.append('pc-[a-f0-9]{12}-'+re.escape(original))
        alts.append('(?<!-)'+re.escape(original))
    pattern=re.compile('|'.join(alts))
    def current_name(match):
        hit=match.group()
        for original in replacements:
            if hit.endswith(original):return replacements[original]
        raise RuntimeError('Unmapped chunk reference '+hit)
    text=pattern.sub(current_name,text)
    if re.search(r'pc-[a-f0-9]{12}-pc-[a-f0-9]{12}-',text):raise RuntimeError('Corrupted generated chunk reference in '+str(rel))
    if file.suffix=='.html':
        text=re.sub(r'<script src="/site-cloud\.[a-f0-9]+\.js"></script>','',text)
        marker=re.search(r'<meta charSet="utf-8"\s*/?>|<meta charset="utf-8"\s*/?>',text,re.I)
        if marker:text=text[:marker.end()]+'<script src="/'+bootstrap+'"></script>'+text[marker.end():]
        else:text=text.replace('<head>','<head><script src="/'+bootstrap+'"></script>',1)
    if text!=before:file.write_text(text);updated.append(str(rel))
# Remove only obsolete generated outputs, never original imported chunks.
for old in set(old_manifest.get('chunks',{}).values()) | {p.name for p in CHUNKS.glob('pc-*.js')}:
    if old not in new_outputs:(CHUNKS/old).unlink(missing_ok=True)
for p in ROOT.glob('site-cloud.*.js'):
    if p.name!=bootstrap and p.read_text().startswith('/* Generated by source/build_public_cloud.py;'):p.unlink()
for p in ROOT.glob('shop-ops.*.js'):
    if p.name!=shop_asset and p.read_text().startswith('/* Generated by source/build_public_cloud.py;'):p.unlink()
for file in ROOT.rglob('*'):
    if not file.is_file() or file.suffix not in {'.html','.txt'}:continue
    rel=file.relative_to(ROOT)
    if rel.parts[0] in {'.git','source','docs','supabase'}:continue
    for name in set(re.findall(r'/_next/static/chunks/([^"\'/]+\.js)',file.read_text())):
        if name.startswith('pc-') and not (CHUNKS/name).exists():raise RuntimeError('Dangling adapted chunk reference '+name+' in '+str(rel))
MANIFEST.write_text(json.dumps({'bootstrap':bootstrap,'shopOpsAsset':shop_asset,'chunks':outputs,'version':2},indent=2)+'\n')
# The operations panel is published by its own host (golf-academy-admin → admin.puttclub.ir).
# Nothing under /admin belongs on the public site, so the exported copy is dropped here instead of
# leaving a second working path for the same UI. Assets stay: the admin host mirrors shop-ops/site-cloud
# from this repo, and its own workflow keeps its shell self-sufficient if this repo ever changes layout.
if (ROOT/'admin').exists():
    shutil.rmtree(ROOT/'admin')
    print('Removed /admin from the public export (ops panel lives on admin.puttclub.ir)')
print('Public bootstrap:',bootstrap)
print('Adapted hashed chunks:',len(outputs),'updated reference files:',len(updated))
