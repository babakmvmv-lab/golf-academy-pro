#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_training_types.py — تغییر نام دو نوع تمرین در ماژول «ثبت رکورد»

خواستهٔ مالک:
    «اپروچ بکن ۳/۴ رنج • روی زمین Half range»
    یعنی فقط دو برچسبِ نمایشی عوض شود:
      Approach   → «۳/۴ رنج»   / 3/4 Range
      On-Course  → «هالف رنج»  / Half Range

نکتهٔ مهم (سازگاری داده):
    کلیدهای داخلی 'Approach' و 'On-Course' دست‌نخورده می‌مانند، چون کلیدِ
    ذخیره‌سازی جلسه‌ها و ضربه‌ها در ga_sp_sessions / ga_sp_shots هستند.
    اگر کلید عوض شود، همهٔ جلسه‌های ثبت‌شده از دست می‌روند. فقط برچسب
    فارسی و زیرنویس انگلیسی عوض می‌شود.

اجرا:
    python3 tools/patch_training_types.py --root . --build
"""

import argparse, hashlib, json, os, shutil, subprocess, sys

SMART = os.path.join('source', 'js', 'smartplay.js')
APP = os.path.join('source', 'js', 'app.js')
ANALYTICS = os.path.join('analytics', 'config.json')
MARK = 'GLF_TYPE_RENAMES_V1'

OLD_FA = "{ Range:'رنج', Putting:'پاتینگ', Chipping:'چیپینگ', Approach:'اپروچ', 'On-Course':'روی زمین' }"
NEW_FA = "{ Range:'رنج', Putting:'پاتینگ', Chipping:'چیپینگ', Approach:'۳/۴ رنج', 'On-Course':'هالف رنج' }"

OLD_FA_SP = "{ Range: 'رنج', Putting: 'پاتینگ', Chipping: 'چیپینگ', Approach: 'اپروچ', 'On-Course': 'روی زمین' }"
NEW_FA_SP = "{ Range: 'رنج', Putting: 'پاتینگ', Chipping: 'چیپینگ', Approach: '۳/۴ رنج', 'On-Course': 'هالف رنج' }"

OLD_META = "'🎯 رنج/پاتینگ/چیپینگ/اپروچ/روی زمین — به‌ازای هر کلاب یک دونات'"
NEW_META = "'🎯 رنج/پاتینگ/چیپینگ/۳/۴ رنج/هالف رنج — به‌ازای هر کلاب یک دونات'"

OLD_BTN = ("return '<button type=\"button\" class=\"spk-type' + (t === selType ? ' on' : '') + '\" data-t=\"' + t + '\">'"
           " + esc(TYPE_FA[t]) + '<small>' + esc(t) + '</small></button>';")
NEW_BTN = ("return '<button type=\"button\" class=\"spk-type' + (t === selType ? ' on' : '') + '\" data-t=\"' + t + '\">'"
           " + esc(TYPE_FA[t]) + '<small>' + esc(TYPE_EN[t] || t) + '</small></button>';")


def die(m):
    print(f"❌ {m}")
    sys.exit(1)


def rep(src, old, new, label, count=1):
    n = src.count(old)
    if n != count:
        die(f"«{label}» باید {count} بار باشد، ولی {n} بار پیدا شد.")
    return src.replace(old, new, count)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    ap.add_argument('--build', action='store_true')
    a = ap.parse_args()

    sp = os.path.join(a.root, SMART)
    app = os.path.join(a.root, APP)
    for f in (sp, app):
        if not os.path.isfile(f):
            die(f"پیدا نشد: {f}")

    src_sp = open(sp, encoding='utf-8').read()
    src_app = open(app, encoding='utf-8').read()

    if MARK in src_sp:
        print("ℹ️  قبلاً پچ شده.")
    else:
        changes = []

        # ── smartplay.js ──
        src_sp = rep(src_sp, OLD_FA_SP, NEW_FA_SP, "نقشهٔ فارسی smartplay")
        changes.append("برچسب‌های فارسی در smartplay.js عوض شد")

        # نقشهٔ انگلیسیِ زیرنویس (تازه)
        src_sp = rep(src_sp,
                     "  var TYPES = ['Range', 'Putting', 'Chipping', 'Approach', 'On-Course'];",
                     "  var TYPES = ['Range', 'Putting', 'Chipping', 'Approach', 'On-Course'];\n"
                     "  /* GLF_TYPE_RENAMES_V1 — زیرنویس انگلیسی؛ کلیدهای داخلی برای سازگاری داده دست‌نخورده‌اند */\n"
                     "  var TYPE_EN = { Range: 'Range', Putting: 'Putting', Chipping: 'Chipping', Approach: '3/4 Range', 'On-Course': 'Half Range' };",
                     "فهرست TYPES")
        changes.append("نقشهٔ زیرنویس انگلیسی (TYPE_EN) اضافه شد")

        src_sp = rep(src_sp, OLD_BTN, NEW_BTN, "سازندهٔ دکمهٔ نوع تمرین")
        changes.append("زیرنویس دکمه‌ها از TYPE_EN خوانده می‌شود")

        # ── app.js ──
        n_fa = src_app.count(OLD_FA)
        if n_fa != 2:
            die(f"برچسب فارسی در app.js باید ۲ بار باشد، {n_fa} بار پیدا شد.")
        src_app = src_app.replace(OLD_FA, NEW_FA)
        changes.append("برچسب‌های فارسی در app.js (۲ جا) عوض شد")

        src_app = rep(src_app, OLD_META, NEW_META, "متن راهنمای آنالیز")
        changes.append("متن راهنمای تحلیل تمرین‌ها به‌روز شد")

        for path, data in ((sp, src_sp), (app, src_app)):
            bak = path + '.typesbak'
            if not os.path.exists(bak):
                shutil.copy2(path, bak)
            open(path, 'w', encoding='utf-8').write(data)

        print(f"✅ پچ اعمال شد (smartplay {hashlib.sha256(src_sp.encode()).hexdigest()[:10]} • "
              f"app {hashlib.sha256(src_app.encode()).hexdigest()[:10]})")
        for c in changes:
            print(f"   • {c}")

    # ── analytics/config.json (فقط برچسب نمایشی) ──
    ap_path = os.path.join(a.root, ANALYTICS)
    if os.path.isfile(ap_path):
        cfg = json.load(open(ap_path, encoding='utf-8'))
        tt = cfg.get('training_types', {})
        changed = False
        if tt.get('Approach', {}).get('fa') != '۳/۴ رنج':
            tt.setdefault('Approach', {})['fa'] = '۳/۴ رنج'
            changed = True
        if tt.get('On-Course', {}).get('fa') != 'هالف رنج':
            tt.setdefault('On-Course', {})['fa'] = 'هالف رنج'
            changed = True
        if changed:
            cfg['training_types'] = tt
            json.dump(cfg, open(ap_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
            open(ap_path, 'a', encoding='utf-8').write('\n')
            print("✅ analytics/config.json به‌روز شد")

    # ── بازرسی ──
    src_sp = open(sp, encoding='utf-8').read()
    src_app = open(app, encoding='utf-8').read()
    checks = [
        ("مارکر نسخه", MARK in src_sp),
        ("برچسب فارسی smartplay", "Approach: '۳/۴ رنج'" in src_sp and "'On-Course': 'هالف رنج'" in src_sp),
        ("زیرنویس انگلیسی", "Approach: '3/4 Range', 'On-Course': 'Half Range'" in src_sp),
        ("دکمه از TYPE_EN", 'esc(TYPE_EN[t] || t)' in src_sp),
        ("برچسب فارسی app (۲ جا)", src_app.count("Approach:'۳/۴ رنج'") == 2),
        ("متن راهنما", 'رنج/پاتینگ/چیپینگ/۳/۴ رنج/هالف رنج' in src_app),
        ("کلیدهای داخلی دست‌نخورده", "'Approach':   ['Iron 7'" in src_sp and "'On-Course':  ['Driver'" in src_sp),
        ("هیچ «اپروچ» در برچسب‌ها نمانده", "Approach:'اپروچ'" not in src_app and "Approach: 'اپروچ'" not in src_sp),
        ("هیچ «روی زمین» در برچسب‌ها نمانده", "'On-Course':'روی زمین'" not in src_app and "'On-Course': 'روی زمین'" not in src_sp),
    ]
    print("\n🔎 بازرسی:")
    bad = 0
    for label, ok in checks:
        print(f"   {'✅' if ok else '❌'} {label}")
        bad += 0 if ok else 1
    if bad:
        die("بازرسی رد شد.")

    if a.build:
        print("\n🏗  ساخت standalone…")
        r = subprocess.run([sys.executable, os.path.join(a.root, 'source', 'build_standalone.py')], cwd=a.root)
        if r.returncode != 0:
            die("بیلد خطا داد.")
        print("✅ بیلد ساخته شد.")


if __name__ == '__main__':
    main()
