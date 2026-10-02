#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_podium_v4.py — نشانگر تشخیصی: هر «نه» یک دلیل دارد

مشکل کشف‌شده:
    safetyTick() با «if (!podiumAutoAllowed()) return;» شروع می‌شد.
    اگر این شرط false باشد (مثلاً کاربرِ واردشده نقش admin نداشته باشد)،
    تور ایمنی کاملاً بی‌صدا کنار می‌رفت و هیچ نشانگری هم رنگی نمی‌گرفت.
    یعنی سه بار «منتشر نشد» را دیدیم بدون اینکه بفهمیم کجا متوقف شده.

راه‌حل:
    - publishDiag(): یک عکس لحظه‌ای کامل از همهٔ دروازه‌ها
    - safetyTick هرگز بی‌صدا برنمی‌گردد؛ دلیل توقف را روی نشانگر می‌نویسد
    - ضربان هر ۱۰ ثانیه: نشانگر هرگز خالی/بی‌رنگ نمی‌ماند
    - window.GA_PUB_DEBUG(): برای گرفتن گزارش از کنسول

اجرا:
    python3 tools/patch_podium_v4.py --root . --build
"""

import argparse, hashlib, os, shutil, subprocess, sys

APP = os.path.join('source', 'js', 'app.js')


def die(m):
    print(f"❌ {m}")
    sys.exit(1)


def rep(src, old, new, label):
    n = src.count(old)
    if n != 1:
        die(f"«{label}» باید ۱ بار باشد، ولی {n} بار پیدا شد.")
    return src.replace(old, new, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    ap.add_argument('--build', action='store_true')
    a = ap.parse_args()

    p = os.path.join(a.root, APP)
    if not os.path.isfile(p):
        die(f"پیدا نشد: {p}")
    src = open(p, encoding='utf-8').read()
    before = hashlib.sha256(src.encode()).hexdigest()[:12]

    if 'window.GA_BUILD' in src and 'podium-diag-v4' in src:
        print("ℹ️  قبلاً پچ شده (v4).")
    else:
        changes = []

        # ── ۱) publishDiag + ضربان نشانگر، پیش از تور ایمنی ──
        anchor = "  let safetyTimer = null;"
        diag = """  /* ══ تشخیص زنده ══
     هر «نه» در مسیر انتشار باید دلیل داشته باشد؛ قبلاً safetyTick بی‌صدا
     برمی‌گشت و نمی‌فهمیدیم کجا متوقف شده. */
  function publishDiag(){
    const out = { build: (window.GA_BUILD || '?') };
    try{
      const root = $('#app');
      out.appOn = !!(root && root.classList.contains('on'));
      out.user = currentUser;
      let rec = null; try{ rec = userRec(currentUser); }catch(e){}
      out.role = rec ? rec.role : null;
      out.active = rec ? !!rec.active : null;
      out.isAdmin = isAdmin(currentUser);
      out.allowed = podiumAutoAllowed();
      out.hasCloud = !!window.GA_CLOUD;
      out.hasSync = !!(window.GA_SYNC && window.GA_SYNC.public);
      try{ out.livePodiumHash = String(podiumResultsHash()); }catch(e){ out.livePodiumHash = 'err:' + e.message; }
      try{ out.savedPodiumHash = String(store.get(PODIUM_AUTO_RESULTS_HASH_KEY)); }catch(e){}
      try{ out.podiumMatched = podiumHashMatched(); }catch(e){ out.podiumMatched = 'err:' + e.message; }
      try{ out.liveCalHash = String(calendarHash()); }catch(e){}
      try{ out.savedCalHash = String(store.get(CAL_HASH_KEY)); }catch(e){}
      try{ out.calMatched = calendarHashMatched(); }catch(e){}
      out.pending = !!podiumAutoPending;
      out.lastAttemptAt = store.get(PODIUM_AUTO_LAST_KEY);
      try{ out.users = loadUsers().map(u => u.user + ':' + u.role + (u.active ? '' : '/غیرفعال')); }catch(e){ out.users = 'err'; }
    }catch(e){ out.fatal = String(e && e.message || e); }
    return out;
  }
  try { window.GA_PUB_DEBUG = publishDiag; } catch(e){}
  try { window.GA_BUILD = 'podium-diag-v4'; } catch(e){}

  let pubStateAt = 0, pubStateLocked = false;
  function indicatorHeartbeat(){
    try{
      if (pubStateLocked) return;                     /* در حال انتشار — دست نزن */
      if (Date.now() - pubStateAt < 90000) return;    /* نتیجهٔ تازه — دست نزن */
      const d = publishDiag();
      if (!d.appOn){ setPublishState('idle', 'در انتظار ورود به پنل'); return; }
      if (!d.isAdmin){ setPublishState('err', 'دسترسی مدیر نیست — نقش: ' + (d.role || 'نامشخص')); return; }
      if (!d.hasSync){ setPublishState('err', 'لایهٔ ابر بار نشده (GA_SYNC)'); return; }
      if (!d.podiumMatched || !d.calMatched){
        setPublishState('busy', (d.podiumMatched ? '' : 'سکو عقب است') + (!d.podiumMatched && !d.calMatched ? ' • ' : '') + (d.calMatched ? '' : 'تقویم عقب است'));
        return;
      }
      setPublishState('ok', 'همگام با سایت — ' + clockNow());
    }catch(e){}
  }
  setInterval(indicatorHeartbeat, 10000);
  setTimeout(indicatorHeartbeat, 1200);

"""
        src = rep(src, anchor, diag + anchor, "درج publishDiag")
        changes.append("publishDiag() + ضربان نشانگر اضافه شد")

        # ── ۲) ثبت زمان وضعیت در setPublishState ──
        src = rep(src,
            "      el.title = text;\n    }catch(e){}\n  }",
            "      el.title = text;\n      pubStateAt = Date.now();\n      pubStateLocked = (state === 'busy');\n    }catch(e){}\n  }",
            "ثبت زمان در setPublishState")
        changes.append("setPublishState زمان و حالت را ثبت می‌کند")

        # ── ۳) خودِ safetyTick: هیچ‌وقت بی‌صدا برنگرد ──
        old_tick = """  function safetyTick(){
    try{
      if (!podiumAutoAllowed()) return;
      /* سکو: اگر دادهٔ محلی با آخرین انتشار اعلام‌شده تفاوت دارد → منتشر کن */
      if (!podiumHashMatched()) { queuePodiumAutoPublish(); }
      /* تقویم: همین منطق */
      if (!calendarHashMatched()) { planCalendarPublish(500); }
    }catch(e){}
  }"""
        new_tick = """  function safetyTick(){
    try{
      const d = publishDiag();
      /* هر شرطی که مانع انتشار می‌شود، دلیلش روی نشانگر نوشته می‌شود. */
      if (!d.appOn){ setPublishState('idle', 'در انتظار ورود به پنل'); return; }
      if (!d.isAdmin){ setPublishState('err', 'دسترسی مدیر نیست — نقش: ' + (d.role || 'نامشخص')); return; }
      if (!d.hasSync){ setPublishState('err', 'لایهٔ ابر بار نشده (GA_SYNC)'); return; }
      /* سکو: اگر دادهٔ محلی با آخرین انتشار اعلام‌شده تفاوت دارد → منتشر کن */
      if (!d.podiumMatched) { queuePodiumAutoPublish(); }
      /* تقویم: همین منطق */
      if (!d.calMatched) { planCalendarPublish(500); }
    }catch(e){
      try{ setPublishState('err', 'خطای بررسی: ' + String(e && e.message || e).slice(0, 50)); }catch(_){}
    }
  }"""
        src = rep(src, old_tick, new_tick, "بازنویسی safetyTick")
        changes.append("safetyTick دلیل توقف را گزارش می‌کند")

        if not os.path.exists(p + '.v4bak'):
            shutil.copy2(p, p + '.v4bak')
        open(p, 'w', encoding='utf-8').write(src)
        print(f"✅ پچ v4 اعمال شد ({before} → {hashlib.sha256(src.encode()).hexdigest()[:12]})")
        for c in changes:
            print(f"   • {c}")

    # ── بازرسی ──
    checks = [
        ("publishDiag تعریف شده", 'function publishDiag()' in src),
        ("GA_PUB_DEBUG صادر شده", 'window.GA_PUB_DEBUG = publishDiag' in src),
        ("GA_BUILD = podium-diag-v4", "podium-diag-v4" in src),
        ("ضربان نشانگر", 'setInterval(indicatorHeartbeat, 10000)' in src),
        ("safetyTick دلیل نقش را می‌گوید", 'دسترسی مدیر نیست' in src),
        ("safetyTick دلیل GA_SYNC را می‌گوید", 'لایهٔ ابر بار نشده (GA_SYNC)' in src),
        ("return بی‌صدای قبلی حذف شد", "if (!podiumAutoAllowed()) return;" not in src),
        ("تور ایمنی ۴۵ ثانیه‌ای", 'setInterval(safetyTick, 45000)' in src),
        ("مقایسهٔ امن اثرانگشت", 'function podiumHashMatched()' in src),
        ("مهلت آواتار", "setTimeout(() => done(''), 4000)" in src),
        ("نشانگر در کارت سکو", 'id="pub-state"' in src),
        ("بدون دکمهٔ دستی", 'pub-podium' not in src),
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
