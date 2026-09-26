#!/usr/bin/env python3
"""Integrate cloud persistence into the imported static storefront without changing its design.
Original exported chunks stay intact for cached clients. Adapted chunks get content-hashed
names, and references in HTML/RSC/manifest files are updated together. No Next server,
new project or public API server is created. The dedicated web_store migration and
web-sync deployment are separate, explicit operations; academy storage stays untouched.
"""
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parent.parent
CHUNKS=ROOT/'_next/static/chunks'
MANIFEST=ROOT/'source/public-cloud-manifest.json'
old_manifest=json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
outputs={}

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
    outputs[name]=filename

# The old public hook returned DEFAULT_SITE_SETTINGS forever; it had no live provider.
name='00.n2u15h-glt.js';s=(CHUNKS/name).read_text()
a='35607,e=>{"use strict";e.i(43476);var t=e.i(71645),r=e.i(33199);e.i(1517),e.i(88062);let n=(0,t.createContext)(r.DEFAULT_SITE_SETTINGS);e.s(["useSiteSettings",0,function(){return(0,t.useContext)(n)}])}'
b='35607,e=>{"use strict";var t=e.i(71645),r=e.i(33199),n=e.i(1517);e.s(["useSiteSettings",0,function(){return n.mergeSiteSettings(window.PC_SITE_CLOUD.useTable(t,"settings",r.DEFAULT_SITE_SETTINGS))}])}'
s=replace(s,a,b);save(name,s)

# Original course/testimonial state is retained, but now subscribed to shared published data.
name='11h9c3275amaf.js';s=(CHUNKS/name).read_text()
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
    s=(CHUNKS/name).read_text()
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
name='0ymry5ef_i~wt.js';s=(CHUNKS/name).read_text()
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
name='0s294n3n15ion.js';s=(CHUNKS/name).read_text()
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
save(name,s)

# Clear the previous green success label before a new save attempt starts.
name='116gnhx5f2czu.js';s=(CHUNKS/name).read_text()
s=replace(s,'let d=async(e,s)=>{if(i(e),l){','let d=async(e,s)=>{n(null);if(i(e),l){')
save(name,s)

# Never silently return to local-demo saves when the cloud bootstrap fails to load.
for name in ['0h.3tv9nj2ufm.js','0ia~_hsdpy603.js','12lzqn_~_d9qf.js']:
    s=(CHUNKS/name).read_text()
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
                  'let D=async t=>{t.preventDefault(),S(""),v(!0);try{if(window.PC_SITE_CLOUD?.signInAdmin){let result=await window.PC_SITE_CLOUD.signInAdmin(f,y);(0,x.setAdmin)(result.user);e.push(w);return}let t=null;')
        s=replace(s,'}catch{S("ارتباط با سرور برقرار نشد.")}finally{v(!1)}',
                  '}catch(err){S(err?.message||"ارتباط با سرور برقرار نشد.")}finally{v(!1)}')
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
script='/* Generated by source/build_public_cloud.py; edit source/js/site-cloud.js instead. */\nwindow.PC_SITE_CLOUD_CONFIG='+json.dumps(config,ensure_ascii=False,separators=(',',':'))+';\n'+(ROOT/'source/js/site-cloud.js').read_text()
bootstrap='site-cloud.'+hashlib.sha256(script.encode()).hexdigest()[:12]+'.js'
(ROOT/bootstrap).write_text(script)

# Replace references, not the storefront markup, Persian typography or layout.
replacements={**outputs}
for original,previous in old_manifest.get('chunks',{}).items():
    if original in outputs:replacements[previous]=outputs[original]
originals=set(outputs)
new_outputs=set(outputs.values())
updated=[]
for file in ROOT.rglob('*'):
    if not file.is_file() or file.suffix not in {'.html','.txt','.js'}:continue
    rel=file.relative_to(ROOT)
    if rel.parts[0] in {'.git','source','docs','supabase','node_modules','assets'}:continue
    if file.name in {'GolfAcademy_PRO.html','enter-academy.js'} or file.name.startswith('site-cloud.'):continue
    if file.parent==CHUNKS and file.name in originals|new_outputs:continue
    text=file.read_text();before=text
    pattern=re.compile('|'.join(re.escape(k) for k in sorted(replacements,key=len,reverse=True)))
    text=pattern.sub(lambda m:replacements[m.group()],text)
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
MANIFEST.write_text(json.dumps({'bootstrap':bootstrap,'chunks':outputs,'version':1},indent=2)+'\n')
print('Public bootstrap:',bootstrap)
print('Adapted hashed chunks:',len(outputs),'updated reference files:',len(updated))
