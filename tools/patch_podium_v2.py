#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_podium_v2.py — تور ایمنی خودترمیم برای انتشار سکوی فصل + نمایش وضعیت

چرا این پچ لازم شد:
    کد انتشار خودکار از نظر منطقی درست بود، سرور هم سالم است (تست شد:
    {"ok":true,"put":1})، ولی هیچ انتشار جدیدی در دیتابیس ثبت نشده بود.
    یعنی درخواست هرگز از مرورگر بیرون نرفت. سه بار تلاش قبلی هم بی‌نتیجه ماند.

راه‌حل: به‌جای تکیه بر رویدادها (که ممکن است به هر دلیلی شلیک نشوند)،
یک «تور ایمنی» دوره‌ای اضافه می‌شود که هر ۴۵ ثانیه وضعیت را چک می‌کند و
اگر سایت عقب باشد، خودش منتشر می‌کند. به‌علاوه:

  ۱) تور ایمنی دوره‌ای (هر ۴۵ ثانیه) — مستقل از همهٔ رویدادها
  ۲) مهلت ۴ ثانیه‌ای برای بارگذاری آواتار (تا iOS هرگز انتشار را معلق نکند)
  ۳) نشانگر وضعیت زنده در کارت سکو (سبز/زرد/قرمز) — دیگر لازم نیست حدس بزنید
  ۴) بررسی فوری هنگام برگشتن به تب
  ۵) تلاش مجدد روی همهٔ خطاها (نه فقط 429/5xx)

اجرا:
    python3 tools/patch_podium_v2.py --root . --build
"""

import argparse, hashlib, os, re, shutil, subprocess, sys

APP = os.path.join('source', 'js', 'app.js')

def die(m):
    print(f"❌ {m}"); sys.exit(1)

def replace_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        die(f"«{label}» باید دقیقاً ۱ بار باشد، ولی {n} بار پیدا شد.")
    return src.replace(old, new, 1)

# ───────────────────────── کدهای جدید ─────────────────────────

SAFETY_BLOCK = '''

  /* ══════════════════════════════════════════════════════════════════════════
     تور ایمنی خودترمیم — بیمهٔ نهایی انتشار سکو و تقویم فصل
     ──────────────────────────────────────────────────────────────────────────
     کد رویدادمحور درست است، ولی اگر رویدادی شلیک نشود (کش مرورگر، خطای
     لحظه‌ای، بسته‌شدن ناگهانی تب) هیچ‌چیز منتشر نمی‌شود. این تور هر ۴۵ ثانیه
     وضعیت را با دیتای فعلی مقایسه می‌کند و در صورت عقب‌بودن، خودش منتشر
     می‌کند — بدون نیاز به هیچ رویداد یا کلیکی.
     ══════════════════════════════════════════════════════════════════════════ */
  const PODIUM_BUILD = 'podium-auto-v2';
  try { window.GA_BUILD = PODIUM_BUILD; } catch(e){}

  /* نشانگر وضعیت — روی کارت سکو در صفحهٔ فرماندهی */
  function setPublishState(state, text){
    try{
      const el = $('#pub-state');
      if (!el) return;
      const map = { ok:['#1EBB8A','🟢'], busy:['#D4AF37','🟡'], err:['#E74C3C','🔴'], idle:['#8A93A6','⚪'] };
      const pick = map[state] || map.idle;
      el.textContent = pick[1] + ' ' + text;
      el.style.color = pick[0];
      el.title = text;
    }catch(e){}
  }
  function clockNow(){
    try{
      const d = new Date();
      return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    }catch(e){ return ''; }
  }
  try { window.GA_PUBLISH_STATE = setPublishState; } catch(e){}

  let safetyTimer = null;
  function safetyTick(){
    try{
      if (!podiumAutoAllowed()) return;
      /* سکو: اگر دادهٔ محلی با آخرین انتشار اعلام‌شده تفاوت دارد → منتشر کن */
      const h = podiumResultsHash();
      if (h && store.get(PODIUM_AUTO_RESULTS_HASH_KEY) !== h) { queuePodiumAutoPublish(); }
      /* تقویم: همین منطق */
      if (calendarHash() && store.get(CAL_HASH_KEY) !== calendarHash()) { planCalendarPublish(500); }
    }catch(e){}
  }
  function startSafetyNet(){
    if (safetyTimer) return;
    safetyTimer = setInterval(safetyTick, 45000);
    setTimeout(safetyTick, 4000);   /* یک بررسی زودهنگام، چند ثانیه پس از ورود */
  }
  startSafetyNet();
  window.addEventListener('ga-season-changed', function(){ setTimeout(safetyTick, 2500); });
  window.addEventListener('ga-calendar-changed', function(){ setTimeout(safetyTick, 2500); });
  document.addEventListener('visibilitychange', function(){
    if (!document.hidden) setTimeout(safetyTick, 1500);
  });
'''

# ───────────────────────── پچ ─────────────────────────

def patch(src):
    changes = []
    if 'podium-auto-v2' in src:
        return src, []

    # ۱) مهلت برای آواتار — iOS هرگز نباید انتشار را معلق کند
    old_av = """      img.onerror = () => res('');
      img.src = a;
    });
  });"""
    new_av = """      img.onerror = () => res('');
      /* مهلت ۴ ثانیه‌ای: اگر به هر دلیلی onload شلیک نشد (رفتار iOS)،
         انتشار معلق نمی‌ماند و آواتار خالی می‌رود. */
      const t = setTimeout(() => res(''), 4000);
      const done = v => { clearTimeout(t); res(v); };
      img.onload = ((orig) => () => { try { orig(); } catch(e){ done(''); } })(img.onload);
      img.src = a;
      if (img.complete && img.naturalWidth) { /* کش‌شده: بلافاصله */ }
    });
  });"""
    # img.onload بازنویسی می‌شود؛ پس باید رویهٔ اصلی را نگه داریم — ساده‌تر: کل بلوک را عوض می‌کنیم
    old_block = """  const siteAvatar = pid => Promise.resolve().then(() => {
    let a = siteAsset(avatar(pid));
    if (!a || !/^data:/.test(a) || a.length < 20000) return a;
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        try {
          const px = 80;"""
    if old_block not in src:
        die("بلوک siteAvatar (نسخهٔ ۸۰px) پیدا نشد — اول پچ قبلی را اعمال کنید.")
    # جایگزینی کامل تابع siteAvatar با نسخهٔ دارای مهلت
    i = src.find("  const siteAvatar = pid => Promise.resolve().then(() => {")
    if i < 0:
        die("محدودهٔ siteAvatar پیدا نشد.")
    # ⚠️ جست‌وجوی "\n  });\n" (با خط جدید ابتدایی) — نه "  });\n"، چون دومی
    # داخل خط «    });» هم مطابقت می‌کند و برش را نیمه‌کاره می‌گذارد.
    s = src.find("img.src = a;", i)
    if s < 0:
        die("انتهای siteAvatar پیدا نشد.")
    j = src.find("\n  });\n", s)
    if j < 0:
        die("انتهای بلوک siteAvatar پیدا نشد.")
    j += len("\n  });\n")
    NEW_AVATAR = """  const siteAvatar = pid => Promise.resolve().then(() => {
    let a = siteAsset(avatar(pid));
    if (!a || !/^data:/.test(a) || a.length < 20000) return a;
    return new Promise(res => {
      let settled = false;
      const done = v => { if (!settled) { settled = true; res(v); } };
      /* مهلت ۴ ثانیه‌ای: اگر onload به هر دلیلی شلیک نشد (رفتار شناخته‌شدهٔ iOS)،
         انتشار هرگز معلق نمی‌ماند — آواتار خالی می‌رود و بقیهٔ سکو منتشر می‌شود. */
      const timer = setTimeout(() => done(''), 4000);
      const img = new Image();
      img.onload = () => {
        try {
          const px = 80;                       /* ۹۶ → ۸۰ (سبک‌تر) */
          const c = document.createElement('canvas'); c.width = px; c.height = px;
          const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
          const m = Math.min(img.width || px, img.height || px);
          ctx.drawImage(img, ((img.width || px) - m) / 2, ((img.height || px) - m) / 2, m, m, 0, 0, px, px);
          let out = c.toDataURL('image/webp', 0.75);
          /* تشخیص واقعی WebP: سفاری نمی‌تواند WebP بسازد و بی‌صدا PNG می‌دهد. */
          if (!out || out.indexOf('data:image/webp') !== 0) out = c.toDataURL('image/jpeg', 0.75);
          clearTimeout(timer);
          done(out && out.length < a.length ? out : '');
        } catch (e) { clearTimeout(timer); done(''); }
      };
      img.onerror = () => { clearTimeout(timer); done(''); };
      img.src = a;
    });
  });
"""
    src = src[:i] + NEW_AVATAR + src[j:]
    changes.append("مهلت ۴ ثانیه‌ای برای آواتار اضافه شد (ضد تعلیق iOS)")

    # ۲) نشانگر وضعیت در publishSeasonPodium
    src = replace_once(src,
        "        podiumLastAttemptAt=Date.now();\n        store.set(PODIUM_AUTO_LAST_KEY,String(podiumLastAttemptAt));",
        "        try{ setPublishState('busy','در حال انتشار در سایت…'); }catch(e){}\n"
        "        podiumLastAttemptAt=Date.now();\n        store.set(PODIUM_AUTO_LAST_KEY,String(podiumLastAttemptAt));",
        "نشانگر busy")
    src = replace_once(src,
        "        if(ok){\n          if(resultsHash)store.set(PODIUM_AUTO_RESULTS_HASH_KEY,resultsHash);",
        "        if(ok){\n          if(resultsHash)store.set(PODIUM_AUTO_RESULTS_HASH_KEY,resultsHash);\n"
        "          try{ setPublishState('ok','سایت به‌روز شد — ' + clockNow()); }catch(e){}",
        "نشانگر ok")
    src = replace_once(src,
        "        return {ok:false,error:failure};\n      }\n    })();",
        "        try{ setPublishState('err','انتشار نشد: ' + String(failure && failure.message || failure || 'خطای نامشخص').slice(0,60)); }catch(e){}\n"
        "        return {ok:false,error:failure};\n      }\n    })();",
        "نشانگر err")
    changes.append("نشانگر وضعیت انتشار (سبز/زرد/قرمز) اضافه شد")

    # ۳) نشانگر را در card-head کارت سکو جا بده
    src = replace_once(src,
        '<h3>سکوی قهرمانی فصل</h3><span class="tag">FedEx Style</span>',
        '<h3>سکوی قهرمانی فصل</h3><span class="tag">FedEx Style</span>'
        '<span id="pub-state" style="font-size:10.5px;font-weight:700;margin-right:8px">⚪ در انتظار</span>',
        "جای نشانگر در کارت سکو")
    changes.append("نشانگر در کارت سکوی قهرمانی جاگذاری شد")

    # ۴) تور ایمنی
    anchor = "  window.addEventListener('ga-calendar-changed', () => planCalendarPublish(1200));\n"
    if anchor not in src:
        # نامتقارن: شاید پچ قبلی با فاصلهٔ دیگر باشد
        m = re.search(r"\n  window\.addEventListener\('ga-calendar-changed'[^\n]*\n", src)
        if not m:
            die("لنگر ga-calendar-changed پیدا نشد.")
        anchor = m.group(0)
    src = replace_once(src, anchor, anchor + SAFETY_BLOCK, "درج تور ایمنی")
    changes.append("تور ایمنی دوره‌ای (هر ۴۵ ثانیه) اضافه شد")

    # ۵) تلاش مجدد روی همهٔ خطاها
    src = replace_once(src,
        "  function retryablePodiumError(e){return !!(e && (e.status===429 || e.status>=500 || e.network===true));}",
        "  /* هر خطایی ارزش یک تلاش دوباره دارد؛ «no valid rows» (۴۰۰) هم قبلاً\n"
        "     بی‌صدا رها می‌شد و سکو تا ابد عقب می‌ماند. */\n"
        "  function retryablePodiumError(e){return !!e;}",
        "گسترش تلاش مجدد")
    changes.append("تلاش مجدد روی همهٔ خطاها (شامل ۴۰۰)")

    return src, changes

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    ap.add_argument('--build', action='store_true')
    a = ap.parse_args()

    p = os.path.join(a.root, APP)
    if not os.path.isfile(p): die(f"پیدا نشد: {p}")
    src = open(p, encoding='utf-8').read()
    before = hashlib.sha256(src.encode()).hexdigest()[:12]
    new, changes = patch(src)

    if new == src:
        print("ℹ️  قبلاً پچ شده.")
    else:
        if not os.path.exists(p + '.v2bak'):
            shutil.copy2(p, p + '.v2bak')
        open(p, 'w', encoding='utf-8').write(new)
        print(f"✅ پچ v2 اعمال شد ({before} → {hashlib.sha256(new.encode()).hexdigest()[:12]})")
        for c in changes: print(f"   • {c}")

    checks = [
        ("تور ایمنی ۴۵ ثانیه‌ای", 'setInterval(safetyTick, 45000)' in new),
        ("مهلت آواتار",           'setTimeout(() => done(\'\'), 4000)' in new),
        ("نشانگر وضعیت",          'setPublishState' in new),
        ("جای نشانگر در کارت",    'id="pub-state"' in new),
        ("تلاش مجدد روی ۴۰۰",     'return !!e;' in new),
        ("بدون دکمهٔ دستی",       'pub-podium' not in new),
        ("سازندهٔ مشترک رویداد",  'function seasonCalendarEvents()' in new),
    ]
    print("\n🔎 بازرسی:")
    bad = 0
    for l, ok in checks:
        print(f"   {'✅' if ok else '❌'} {l}"); bad += 0 if ok else 1
    if bad: die("بازرسی رد شد.")

    if a.build:
        s = os.path.join(a.root, 'source', 'build_standalone.py')
        print("\n🏗  ساخت standalone…")
        r = subprocess.run([sys.executable, s], cwd=a.root)
        if r.returncode != 0: die("بیلد خطا داد.")
        print("✅ بیلد ساخته شد.")

if __name__ == '__main__':
    main()
