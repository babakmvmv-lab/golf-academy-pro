#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_site_cloud_ui_v2.py — مدیر می‌بیند، بقیه نه، و دکمه زیر لایه‌ها می‌رود

توضیح درخواست (مالک):
    «فقط کسی که از بیرون باز می‌کند نبیند • کاربری که کاربر سایت است مهم نیست
     ببیند یا نه • کاری نمی‌خواهد بکنی، بره زیر لایه‌ها کسی متوجه نشه • مدیر ببیند»

پچ v1 (PC_CLOUD_UI_HIDDEN_V1) دکمه را روی سایت عمومی از همه — از جمله مدیر —
پنهان می‌کرد. این نسخه اصلاح می‌کند:

    ۱) مدیر (نشست ابری web_admin) همه‌جا می‌بیند، از جمله روی سایت عمومی.
    ۲) بازدیدکنندهٔ بیرونی و کاربر عادی سایت: دکمه ساخته نمی‌شود (در DOM نیست).
    ۳) دکمه «زیر لایه‌ها» می‌رود: z-index از ۹۹۹۹ به ۴۸ کاهش می‌یابد، یعنی
       زیر هدر چسبان سایت (z-50/z-70) و زیر پاپ‌آپ‌های خودمان (۱۲۰/۱۳۰)
       قرار می‌گیرد و کسی متوجهش نمی‌شود.
    ۴) کم‌رنگ است (opacity .42) و فقط روی هاور/فوکوس کامل می‌شود.

اجرا:
    python3 tools/patch_site_cloud_ui_v2.py --root . --build
"""

import argparse, hashlib, os, shutil, subprocess, sys

TARGET = os.path.join('source', 'js', 'site-cloud.js')
MARK = 'PC_CLOUD_UI_V2'

OLD_ADMIN_LINE = "      return cloudUIRequested() || onAdminHost();"
NEW_ADMIN_LINE = ("      /* مدیر همه‌جا می‌بیند — از جمله روی سایت عمومی (خواستهٔ مالک).\n"
                  "         بازکردن صریح با ?cloud=1 هم همچنان کار می‌کند. */\n"
                  "      return true;")

OLD_BTN_CSS = "z-index:9999;width:46px;height:46px;"
NEW_BTN_CSS = "z-index:48;width:40px;height:40px;"

OLD_BTN_TRANS = "padding:0;transition:transform .15s}#pc-cloud-btn:hover{transform:scale(1.07)}"
NEW_BTN_TRANS = ("padding:0;opacity:.42;transition:transform .15s,opacity .2s}"
                 "#pc-cloud-btn:hover,#pc-cloud-btn:focus-visible{transform:scale(1.07);opacity:1}")

OLD_PANEL_CSS = "#pc-site-cloud{position:fixed;bottom:68px;left:14px;z-index:9999;"
NEW_PANEL_CSS = "#pc-site-cloud{position:fixed;bottom:62px;left:14px;z-index:48;"


def die(m):
    print(f"❌ {m}")
    sys.exit(1)


def rep(src, old, new, label, count=1):
    n = src.count(old)
    if n != count:
        die(f"«{label}» باید {count} بار باشد، ولی {n} بار پیدا شد.")
    return src.replace(old, new, 1)


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
        print("ℹ️  قبلاً پچ v2 شده.")
    else:
        changes = []

        # ۱) مدیر همه‌جا ببیند
        src = rep(src, OLD_ADMIN_LINE, NEW_ADMIN_LINE, "خط دید مدیر")
        changes.append("مدیر روی همهٔ میزبان‌ها (از جمله سایت عمومی) می‌بیند")

        # ۲) زیر لایه‌ها: z-index پایین + اندازهٔ کوچک‌تر
        src = rep(src, OLD_BTN_CSS, NEW_BTN_CSS, "CSS اندازه/z-index دکمه")
        changes.append("z-index دکمه ۹۹۹۹ → ۴۸ (زیر هدر و پاپ‌آپ‌های سایت)")

        # ۳) کم‌رنگی
        src = rep(src, OLD_BTN_TRANS, NEW_BTN_TRANS, "CSS شفافیت دکمه")
        changes.append("دکمه کم‌رنگ شد (opacity .42) و روی هاور کامل می‌شود")

        # ۴) پنل وضعیت هم زیر لایه‌ها
        src = rep(src, OLD_PANEL_CSS, NEW_PANEL_CSS, "CSS پنل وضعیت")
        changes.append("پنل وضعیت هم زیر لایه‌ها رفت (z-index 48)")

        # ۵) برچسب نسخه
        src = rep(src, "  function canSeeCloudUI(){",
                  "  /* PC_CLOUD_UI_V2 — مدیر می‌بیند، دیگران نه، زیر لایه‌ها */\n  function canSeeCloudUI(){",
                  "برچسب نسخه")

        if not os.path.exists(p + '.cloudui2bak'):
            shutil.copy2(p, p + '.cloudui2bak')
        open(p, 'w', encoding='utf-8').write(src)
        print(f"✅ پچ v2 اعمال شد ({before} → {hashlib.sha256(src.encode()).hexdigest()[:12]})")
        for c in changes:
            print(f"   • {c}")

    checks = [
        ("مارکر v2", MARK in src),
        ("مدیر همه‌جا می‌بیند", "return true;" in src and OLD_ADMIN_LINE not in src),
        ("دکمه زیر لایه‌ها (z-index 48)", "z-index:48;width:40px;height:40px;" in src),
        ("کم‌رنگی دکمه", "opacity:.42" in src),
        ("هاور کامل می‌کند", "hover,#pc-cloud-btn:focus-visible{transform:scale(1.07);opacity:1}" in src),
        ("پنل وضعیت زیر لایه‌ها", "#pc-site-cloud{position:fixed;bottom:62px;left:14px;z-index:48;" in src),
        ("هنوز به بازدیدکننده ساخته نمی‌شود", "function canSeeCloudUI()" in src and "hideCloudUI()" in src),
        ("استثنای کارمند فروشگاه حفظ شد", "m.web_shop_staff===true && m.web_admin!==true" in src),
        ("بازبینی دوره‌ای", "renderStatus(); }catch(e){} },60000)" in src),
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
