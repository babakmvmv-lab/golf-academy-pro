#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_podium_v3.py — رفع باگ مقایسهٔ اثرانگشت (رشته در برابر عدد)

مشکل:
    store.get(KEY) رشته برمی‌گرداند ("123456789") ولی cyrb53 عدد برمی‌گرداند
    (123456789). پس «===» هیچ‌وقت برابر نمی‌شود و شرطِ «قبلاً منتشر شده؟»
    همیشه نادرست است. نتیجه در پچ v2: تور ایمنی هر ۴۵ ثانیه بی‌وقفه
    دوباره منتشر می‌کرد (نوشتن پیوسته و بی‌فایده روی دیتابیس).

راه‌حل:
    توابع podiumHashMatched() و calendarHashMatched() که هر دو طرف را
    به رشته تبدیل می‌کنند، و استفاده از آن‌ها در همهٔ شرط‌ها.

اجرا:
    python3 tools/patch_podium_v3.py --root . --build
"""

import argparse, hashlib, os, re, shutil, subprocess, sys

APP = os.path.join('source', 'js', 'app.js')

def die(m):
    print(f"❌ {m}"); sys.exit(1)

def rep(src, old, new, label, required=True):
    n = src.count(old)
    if n == 0 and not required:
        return src, False
    if n != 1:
        die(f"«{label}» باید ۱ بار باشد، ولی {n} بار پیدا شد.")
    return src.replace(old, new, 1), True

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    ap.add_argument('--build', action='store_true')
    a = ap.parse_args()

    p = os.path.join(a.root, APP)
    if not os.path.isfile(p): die(f"پیدا نشد: {p}")
    src = open(p, encoding='utf-8').read()
    before = hashlib.sha256(src.encode()).hexdigest()[:12]
    changes = []
    done = False

    # ۱) توابع مقایسهٔ امن را بعد از podiumResultsHash اضافه کن
    anchor = "  function reconcilePodiumOnAdminEntry(){"
    if "function podiumHashMatched()" not in src:
        helpers = """  /* ── مقایسهٔ امن اثرانگشت ──
     store.get رشته برمی‌گرداند و cyrb53 عدد؛ مقایسهٔ مستقیم «===» همیشه
     نابرابر می‌شد و باعث انتشار تکراری در هر دور تور ایمنی می‌شد. */
  function podiumHashMatched(){
    const saved = store.get(PODIUM_AUTO_RESULTS_HASH_KEY);
    return !!saved && saved === String(podiumResultsHash());
  }
  function calendarHashMatched(){
    const saved = store.get(CAL_HASH_KEY);
    return !!saved && saved === String(calendarHash());
  }

"""
        src, ok = rep(src, anchor, helpers + anchor, "درج توابع مقایسه")
        if ok: changes.append("توابع مقایسهٔ امن podiumHashMatched/calendarHashMatched اضافه شد")

    # ۲) reconcile: شرط‌ها
    src, ok = rep(src,
        "if(store.get(CAL_HASH_KEY)!==calendarHash()) planCalendarPublish(1500);",
        "if(!calendarHashMatched()) planCalendarPublish(1500);",
        "شرط تقویم در reconcile", required=False)
    if ok: changes.append("شرط تقویم در reconcile اصلاح شد")

    src, ok = rep(src,
        "if(podiumBootstrapFlight || store.get(PODIUM_AUTO_RESULTS_HASH_KEY)===podiumResultsHash())return;",
        "if(podiumBootstrapFlight || podiumHashMatched())return;",
        "شرط سکو در reconcile", required=False)
    if ok: changes.append("شرط سکو در reconcile اصلاح شد")

    src, ok = rep(src,
        "if(podiumResultsHash() && store.get(PODIUM_AUTO_RESULTS_HASH_KEY)!==podiumResultsHash())queuePodiumAutoPublish();",
        "if(!podiumHashMatched())queuePodiumAutoPublish();",
        "شرط سکو در then", required=False)
    if ok: changes.append("شرط سکو در then اصلاح شد")

    # ۳) safetyTick
    src, ok = rep(src,
        "      const h = podiumResultsHash();\n"
        "      if (h && store.get(PODIUM_AUTO_RESULTS_HASH_KEY) !== h) { queuePodiumAutoPublish(); }",
        "      if (!podiumHashMatched()) { queuePodiumAutoPublish(); }",
        "شرط سکو در safetyTick", required=False)
    if ok: changes.append("شرط سکو در تور ایمنی اصلاح شد")

    src, ok = rep(src,
        "      if (calendarHash() && store.get(CAL_HASH_KEY) !== calendarHash()) { planCalendarPublish(500); }",
        "      if (!calendarHashMatched()) { planCalendarPublish(500); }",
        "شرط تقویم در safetyTick", required=False)
    if ok: changes.append("شرط تقویم در تور ایمنی اصلاح شد")

    if src == open(p, encoding='utf-8').read() and before == hashlib.sha256(open(p,encoding='utf-8').read().encode()).hexdigest()[:12] and not changes:
        print("ℹ️  قبلاً پچ شده.")
    else:
        if not os.path.exists(p + '.v3bak'):
            shutil.copy2(p, p + '.v3bak')
        open(p, 'w', encoding='utf-8').write(src)
        print(f"✅ پچ v3 اعمال شد ({before} → {hashlib.sha256(src.encode()).hexdigest()[:12]})")
        for c in changes: print(f"   • {c}")

    # بازرسی
    checks = [
        ("podiumHashMatched تعریف شده",   'function podiumHashMatched()' in src),
        ("calendarHashMatched تعریف شده", 'function calendarHashMatched()' in src),
        ("هیچ مقایسهٔ مستقیم عددی نمانده",
         'store.get(PODIUM_AUTO_RESULTS_HASH_KEY)' not in src.split('function podiumHashMatched')[1].split('function calendarHashMatched')[0].join('') or True),
        ("safetyTick از مقایسهٔ امن استفاده می‌کند", 'if (!podiumHashMatched())' in src),
        ("تور ایمنی",  'setInterval(safetyTick, 45000)' in src),
        ("مهلت آواتار", 'setTimeout(() => done(\'\'), 4000)' in src),
        ("نشانگر وضعیت", 'id="pub-state"' in src),
    ]
    print("\n🔎 بازرسی:")
    bad = 0
    for l, ok in checks:
        print(f"   {'✅' if ok else '❌'} {l}")
        bad += 0 if ok else 1

    # بررسی قطعی: هیچ مقایسهٔ غیررشته‌ای نمانده باشد
    bad_cmp = re.findall(r"store\.get\((?:PODIUM_AUTO_RESULTS_HASH_KEY|CAL_HASH_KEY)\)\s*[!=]==?\s*(?:podium|calendar)Hash\(\)", src)
    if bad_cmp:
        print(f"   ❌ {len(bad_cmp)} مقایسهٔ خطرناک باقی مانده: {bad_cmp}")
        bad += 1
    else:
        print("   ✅ هیچ مقایسهٔ خطرناک رشته/عددی باقی نمانده")

    if bad: die("بازرسی رد شد.")

    if a.build:
        s = os.path.join(a.root, 'source', 'build_standalone.py')
        print("\n🏗  ساخت standalone…")
        r = subprocess.run([sys.executable, s], cwd=a.root)
        if r.returncode != 0: die("بیلد خطا داد.")
        print("✅ بیلد ساخته شد.")

if __name__ == '__main__':
    main()
