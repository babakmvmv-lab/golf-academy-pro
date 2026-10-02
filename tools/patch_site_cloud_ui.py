#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_site_cloud_ui.py — دکمهٔ شناور ابر پشت صحنه می‌رود

مشکل (با آزمون واقعی jsdom روی صفحه و باندل زنده تأیید شد):
    دکمهٔ گوشهٔ پایین سایت برای «مدیر» ساخته می‌شود، ولی
      • روی سایت عمومی هم ساخته می‌شود (کاربرِ وارد‌شده به ابر آن را می‌بیند)
      • با نشست منقضی هم باقی می‌ماند
    و در مسیر خروج، فقط پنل مخفی می‌شد، نه خود دکمه — پس دکمه در DOM جا می‌ماند.

راه‌حل:
    ۱) روی سایت عمومی (puttclub.ir) هرگز ساخته نمی‌شود.
    ۲) روی میزبان مدیریت (admin.puttclub.ir یا مسیر /admin) مثل قبل در دسترس است
       (با همان استثنای قبلی برای کارمند فروشگاه).
    ۳) باز کردن صریح روی سایت عمومی: puttclub.ir/?cloud=1  (و ?cloud=0 برای بستن)
    ۴) هنگام نبودِ دسترسی، دکمه از DOM حذف می‌شود، نه فقط مخفی.
    ۵) هر ۶۰ ثانیه بازبینی می‌شود تا دکمه سرگردان نماند.

اجرا:
    python3 tools/patch_site_cloud_ui.py --root . --build
"""

import argparse, hashlib, os, shutil, subprocess, sys

TARGET = os.path.join('source', 'js', 'site-cloud.js')
MARK = 'PC_CLOUD_UI_HIDDEN_V1'

OLD_GUARD = ("    if(!isAdmin() || authSession()?.user?.app_metadata?.web_shop_staff===true && "
             "authSession()?.user?.app_metadata?.web_admin!==true){if(statusNode)statusNode.hidden=true;return;}")

HELPERS = """/* ══ دیدِ دکمهٔ شناور ابر — ابزار پشت‌صحنه، نه بخشی از سایت ══
     PC_CLOUD_UI_HIDDEN_V1
     روی سایت عمومی (puttclub.ir) هیچ‌وقت ساخته نمی‌شود؛ نه بازدیدکننده، نه
     مدیرِ وارد‌شده آن را روی سایت نمی‌بیند. روی میزبان مدیریت
     (admin.puttclub.ir یا مسیر /admin) مثل قبل در دسترس است.
     برای باز کردن صریح روی سایت عمومی: puttclub.ir/?cloud=1 و بستن: ?cloud=0 */
  const CLOUD_UI_KEY='puttclub_cloud_ui_v1';
  function onAdminHost(){
    try{
      const h=String((location&&location.hostname)||'').toLowerCase();
      if(!h||h==='localhost'||h==='127.0.0.1'||h.endsWith('.localhost'))return true;  /* توسعهٔ محلی */
      if(h==='admin.puttclub.ir'||h.indexOf('admin.')===0)return true;                /* میزبان مدیریت */
      if(String((location&&location.pathname)||'').indexOf('/admin')===0)return true; /* مسیر مدیریت */
      return false;
    }catch(e){ return false; }
  }
  function cloudUIRequested(){
    try{
      const q=new URLSearchParams(String((location&&location.search)||''));
      if(q.get('cloud')==='1'){ try{localStorage.setItem(CLOUD_UI_KEY,'1');}catch(e){} return true; }
      if(q.get('cloud')==='0'){ try{localStorage.removeItem(CLOUD_UI_KEY);}catch(e){} return false; }
    }catch(e){}
    try{ return localStorage.getItem(CLOUD_UI_KEY)==='1'; }catch(e){ return false; }
  }
  function canSeeCloudUI(){
    const s=authSession();
    if(s){
      const m=(s.user&&s.user.app_metadata)||{};
      /* کارمند فروشگاه بدون دسترسی مدیریت کل: مثل قبل دکمه را نمی‌بیند */
      if(m.web_shop_staff===true && m.web_admin!==true)return false;
      /* مدیر: روی میزبان مدیریت، یا روی سایت عمومی فقط با احضار صریح ?cloud=1 */
      return cloudUIRequested() || onAdminHost();
    }
    /* بدون نشست: فقط ادمین محلی قدیمی در مسیر /admin */
    if(!onAdminHost())return false;
    const a=json('puttclub_admin',null);
    return !!(a && typeof a.email==='string' && a.email.length>3 && /^\\/admin(?:\\/|$)/.test(location.pathname));
  }
  function hideCloudUI(){
    if(statusNode)statusNode.hidden=true;
    if(cloudBtn){try{cloudBtn.remove();}catch(e){} cloudBtn=null;}
    try{
      const p=document.getElementById('pc-site-cloud');if(p)p.remove();
      const b=document.getElementById('pc-cloud-btn');if(b)b.remove();
    }catch(e){}
  }
  """

NEW_GUARD = ("    /* دکمهٔ ابر پشت‌صحنه است: روی سایت عمومی هرگز ساخته نمی‌شود؛\n"
             "       روی میزبان مدیریت در دسترس می‌ماند و با ?cloud=1 قابل احضار است. */\n"
             "    if(!canSeeCloudUI()){hideCloudUI();return;}")

EXPORT_ANCHOR = "window.PC_SITE_CLOUD={loadShopOps,"
WATCHDOG = ("  /* هر دقیقه بازبینی: اگر دسترسی از بین رفت، دکمه نباید سرگردان بماند. */\n"
            "  try{ setInterval(()=>{ try{ renderStatus(); }catch(e){} },60000); }catch(e){}\n")


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

        if src.count("  function renderStatus(){") != 1:
            die("لنگر renderStatus پیدا نشد.")
        src = src.replace("  function renderStatus(){", HELPERS + "  function renderStatus(){", 1)
        changes.append("توابع دید دکمه (canSeeCloudUI/hideCloudUI) اضافه شد")

        if src.count(OLD_GUARD) != 1:
            die(f"خط نگهبان قدیمی {src.count(OLD_GUARD)} بار پیدا شد (باید ۱ باشد).")
        src = src.replace(OLD_GUARD, NEW_GUARD, 1)
        changes.append("نگهبان renderStatus جایگزین شد")

        if src.count(EXPORT_ANCHOR) != 1:
            die("لنگر خروجی ماژول پیدا نشد.")
        src = src.replace(EXPORT_ANCHOR, WATCHDOG + EXPORT_ANCHOR, 1)
        changes.append("بازبینی هر ۶۰ ثانیه اضافه شد")

        if not os.path.exists(p + '.clouduibak'):
            shutil.copy2(p, p + '.clouduibak')
        open(p, 'w', encoding='utf-8').write(src)
        print(f"✅ پچ دکمهٔ ابر اعمال شد ({before} → {hashlib.sha256(src.encode()).hexdigest()[:12]})")
        for c in changes:
            print(f"   • {c}")

    checks = [
        ("مارکر نسخه", MARK in src),
        ("توابع دید", 'function canSeeCloudUI()' in src),
        ("حذف واقعی از DOM", 'cloudBtn.remove()' in src),
        ("نگهبان قدیمی حذف شد", OLD_GUARD not in src),
        ("نگهبان جدید", 'if(!canSeeCloudUI()){hideCloudUI();return;}' in src),
        ("میزبان مدیریت", "h==='admin.puttclub.ir'" in src),
        ("احضار صریح", "q.get('cloud')==='1'" in src),
        ("احضار مشروط به نشست مدیر", 'return cloudUIRequested() || onAdminHost();' in src),
        ("بازبینی دوره‌ای", 'setInterval(()=>{ try{ renderStatus(); }catch(e){} },60000)' in src),
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
