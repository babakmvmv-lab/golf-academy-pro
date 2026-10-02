#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_podium_auto.py — «سکوی قهرمانی فصل» و «تقویم فصل» روی سایت خودکار از دیتای پنل بیایند.

ساختار درست (که قرار بود از اول باشد):
    دادهٔ خام پنل  →  محاسبه در پنل (همان کد فعلی)  →  انتشار خودکار  →  سایت
    هیچ دکمهٔ انتشار دستی‌ای وجود ندارد.

این اسکریپت چه می‌کند:
    ۱) دکمهٔ «🌐 انتشار در سایت» را از کارت سکوی قهرمانی (فرماندهی) حذف می‌کند.
    ۲) دکمهٔ «🌐 انتشار در سایت» را از کارت تقویم فصل هم حذف می‌کند.
    ۳) انتشار خودکار تقویم فصل را اضافه می‌کند (قبلاً فقط دستی بود).
    ۴) یک نگهبان عمومی اضافه می‌کند: هر نوشتن روی کلیدهای مؤثر در فصل
       (نتایج، دوره‌ها، رویدادها، مسابقات، قوانین امتیاز، کارت‌ها، ...) خودش
       انتشار را در پس‌زمینه هم‌گذاری می‌کند — مستقل از این‌که کدام صفحه نوشته باشد.
    ۵) اثرانگشت (hash) تشخیص تغییر را از «فقط نتایج» به «همهٔ ورودی‌های سکو» گسترش می‌دهد
       تا هم‌گام‌سازی هنگام ورود مدیر، هیچ تغییری را از دست ندهد.

اجرا:
    python3 tools/patch_podium_auto.py --root . --build
    (اگر --build ندهید فقط سورس ویرایش می‌شود؛ ساخت standalone را بعداً خودتان بزنید)
"""

import argparse, hashlib, os, re, shutil, subprocess, sys

APPS = os.path.join('source', 'js', 'app.js')

# ─────────────────────────────────────────────────────────────────────────────
#  کمکی‌ها
# ─────────────────────────────────────────────────────────────────────────────

def die(msg):
    print(f"❌ {msg}")
    sys.exit(1)

def find_button(src, btn_id):
    """بازهٔ کل تگ <button ... id="X" ...>...</button> را برمی‌گرداند."""
    m = re.search(r'<button\b[^>]*\bid="%s"' % re.escape(btn_id), src)
    if not m:
        return None
    start = m.start()
    end = src.find('</button>', m.end())
    if end < 0:
        return None
    return (start, end + len('</button>'))

def cut(src, start_marker, end_marker, label):
    """از شروع start_marker تا (شامل) پایان end_marker را می‌برد."""
    i = src.find(start_marker)
    if i < 0:
        die(f"نشانگر شروع «{label}» پیدا نشد: {start_marker!r}")
    j = src.find(end_marker, i)
    if j < 0:
        die(f"نشانگر پایان «{label}» پیدا نشد: {end_marker!r}")
    return i, j + len(end_marker)


def cut_until(src, start_marker, next_marker, label):
    """از start_marker تا پیش از next_marker را می‌برد (next_marker دست‌نخورده می‌ماند).

    چرا: نشانگرهای پایانی مثل «    });» به‌صورت زیررشته در بلوک‌های تودرتوی
    عمیق‌تر (۶ فاصله + }); ) هم پیدا می‌شوند و باعث بریدن اشتباه می‌شدند.
    استفاده از «شروع دستور بعدی» قطعی و بدون ابهام است.
    """
    i = src.find(start_marker)
    if i < 0:
        die(f"نشانگر شروع «{label}» پیدا نشد: {start_marker!r}")
    j = src.find(next_marker, i + len(start_marker))
    if j < 0:
        die(f"دستور بعدی «{label}» پیدا نشد: {next_marker!r}")
    return i, j

def replace_once(src, old, new, label):
    if src.count(old) != 1:
        die(f"«{label}» باید دقیقاً یک‌بار باشد، ولی {src.count(old)} بار پیدا شد.")
    return src.replace(old, new, 1)

# ─────────────────────────────────────────────────────────────────────────────
#  کدهای جدید
# ─────────────────────────────────────────────────────────────────────────────

CAL_EVENTS_FN = '''  /* ── منبع مشترک رویدادهای فصل: هم صفحهٔ تقویم، هم انتشار خودکار در سایت ──
     قبلاً فقط داخل pageCal ساخته می‌شد و انتشار، دستی و جدا بود. */
  function seasonCalendarEvents(){
    const TYPE_ICON = { 'مسابقه':'🏆', 'کلاس':'📚', 'تمرین':'🏌️', 'اردو':'🏕️' };
    const TYPES = ['مسابقه','کلاس','تمرین','اردو'];
    const events = [];
    let eid = 0;
    const ev = o => events.push(Object.assign({ id: ++eid }, o));

    S.tournaments.forEach(t => {
      const d = D.dateFrom(t[5]);
      ev({ d, end: d, name: t[1], type: 'مسابقه', col: t[2]===1?'gold':t[2]===2?'green':'blue',
           kind: 'مسابقه', icon: '🏆', extra: `${esc(D.COURSE_NAME[t[3]]||'—')} • ${D.fa(t[4])} حفره` });
    });
    (window.Data.loadPrograms ? Data.loadPrograms() : []).forEach(p => {
      const d = D.dateFrom(p.start || p.date || '');
      if (!d || isNaN(d)) return;
      const end = p.end ? D.dateFrom(p.end) : d;
      const type = TYPES.includes(p.type) ? p.type : 'کلاس';
      ev({ d, end, name: p.name || 'دوره', type, col: type==='تمرین'?'green':type==='اردو'?'orange':'purple', kind: type,
           icon: TYPE_ICON[type] || '📌', extra: p.info ? esc(String(p.info)) : 'دورهٔ فصل' });
    });
    (MGMT.customEvents()||[]).forEach(e => {
      const type = e.type || '';
      if (!TYPES.includes(type)) return;
      const d = D.dateFrom(e.date || e.start || '');
      if (!d || isNaN(d)) return;
      const end = e.end ? D.dateFrom(e.end) : d;
      ev({ d, end, name: e.name, type, col: 'blue', kind: type, icon: TYPE_ICON[type] || '📌',
           extra: 'رویداد سفارشی', schedule: e.schedule || null });
    });
    events.sort((a,b) => a.d - b.d);
    return events;
  }

'''

AUTO_BLOCK = '''

  /* ══════════════════════════════════════════════════════════════════════════
     ساختار خودکار: سکو و تقویم فصل روی سایت بدون هیچ دکمه‌ای از دیتای پنل می‌آیند.
     هر نوشتن روی دادهٔ مؤثر → هم‌گذاری (debounce) → انتشار → تأیید.
     ══════════════════════════════════════════════════════════════════════════ */

  /* نگهبان عمومی نوشتن: مستقل از این‌که کدام پنل/صفحه داده را عوض کرده باشد */
  (function watchSeasonWrites(){
    const PODIUM_KEYS = ['ga_results','ga_programs','ga_events','ga_tournaments','ga_tour_rules',
                         'ga_tour_override','ga_tour_hidden','ga_custom_players','ga_scorecards',
                         'ga_subscriptions','ga_coins'];
    const CAL_KEYS = ['ga_events','ga_programs','ga_tournaments'];
    const fire = (evName, arr, k) => { if (arr.indexOf(k) >= 0){ try{ window.dispatchEvent(new Event(evName)); }catch(e){} } };
    try{
      const proto = window.Storage && Storage.prototype;
      if (proto && !proto.__gaSeasonWrapped){
        const origSet = proto.setItem, origDel = proto.removeItem;
        proto.setItem = function(k, v){
          const before = this.getItem(k);
          origSet.call(this, k, v);
          if (before !== String(v)){ fire('ga-season-changed', PODIUM_KEYS, k); fire('ga-calendar-changed', CAL_KEYS, k); }
        };
        proto.removeItem = function(k){
          const had = this.getItem(k) !== null;
          origDel.call(this, k);
          if (had){ fire('ga-season-changed', PODIUM_KEYS, k); fire('ga-calendar-changed', CAL_KEYS, k); }
        };
        proto.__gaSeasonWrapped = true;
      }
    }catch(e){}
  })();

  /* ── انتشار خودکار تقویم فصل ── */
  const CAL_HASH_KEY = 'pc_site_calendar_published_hash_v1';
  const CAL_LAST_KEY = 'pc_site_calendar_last_attempt_at_v1';
  let calendarPublishTimer = null, calendarPublishFlight = null;
  let calendarLastAttemptAt = Number(store.get(CAL_LAST_KEY) || 0) || 0;

  function calendarHash(){
    try{ return cyrb53(JSON.stringify(seasonCalendarEvents().map(e => ({ d:+e.d, n:e.name, t:e.type, k:e.kind, x:e.extra })))); }
    catch(e){ return ''; }
  }
  function calendarPublishAllowed(){
    const root = $('#app');
    return !!(root && root.classList.contains('on') && isAdmin(currentUser));
  }
  async function publishSeasonCalendar(quiet){
    if (calendarPublishFlight) return calendarPublishFlight;
    const task = (async () => {
      try{
        const rows = seasonCalendarEvents().filter(e => e.d && !isNaN(e.d)).map(e => {
          const j = D.jalaliInfo(e.d);
          return {
            date: `${j.yy}/${String(j.mm).padStart(2,'0')}/${String(j.dd).padStart(2,'0')}`,
            jd: j.dd, jm: j.mm,
            icon: e.icon || '📌', name: e.name || 'رویداد', kind: e.kind || e.type || '',
            extra: String(e.extra || '').replace(/<[^>]*>/g, '').slice(0, 80),
            past: e.d < D.TODAY
          };
        });
        const value = { seasonYear: D.seasonYear, updatedAt: new Date().toISOString(), events: rows };
        calendarLastAttemptAt = Date.now();
        store.set(CAL_LAST_KEY, String(calendarLastAttemptAt));
        const ok = await publishToSite([{ k:'web_setting_season_calendar', v: value }], { quiet: !!quiet });
        if (ok) store.set(CAL_HASH_KEY, calendarHash());
        return ok;
      }catch(e){
        if (!quiet) APP.toast('انتشار تقویم فصل در سایت انجام نشد: ' + (e && e.message || e), 'red');
        return false;
      }
    })();
    calendarPublishFlight = task;
    try{ return await task; } finally { if (calendarPublishFlight === task) calendarPublishFlight = null; }
  }
  function planCalendarPublish(delay){
    if (!calendarPublishAllowed()) return;
    clearTimeout(calendarPublishTimer);
    const cooldown = Math.max(0, 16000 - (Date.now() - calendarLastAttemptAt));
    calendarPublishTimer = setTimeout(() => publishSeasonCalendar(true), Math.max(0, Number(delay) || 0, cooldown));
  }
  window.addEventListener('ga-calendar-changed', () => planCalendarPublish(1200));

  /* تغییر هر ورودی سکو (نه فقط نتایج) → انتشار خودکار سکو */
  window.addEventListener('ga-season-changed', queuePodiumAutoPublish);
'''

# ─────────────────────────────────────────────────────────────────────────────
#  پچ
# ─────────────────────────────────────────────────────────────────────────────

def patch_app(src):
    changes = []
    already = 'ga-season-changed' in src

    # ۱) حذف دکمهٔ انتشار سکو
    span = find_button(src, 'pub-podium')
    if span:
        src = src[:span[0]] + src[span[1]:]
        changes.append("دکمهٔ «انتشار در سایت» سکوی قهرمانی حذف شد")
    elif not already:
        die('دکمهٔ pub-podium پیدا نشد.')

    # ۲) حذف هندلر دکمهٔ سکو (کد مرده)
    if "const pubP = $('#pub-podium');" in src:
        i, j = cut_until(src, "const pubP = $('#pub-podium');",
                         "const sp = $('#st-podium');", 'هندلر pubP')
        src = src[:i] + "      /* انتشار سکو خودکار است — دکمه‌ای وجود ندارد. */\n" + src[j:]
        changes.append("هندلر دستی سکو برداشته شد")

    # ۳) حذف دکمهٔ انتشار تقویم
    span = find_button(src, 'pub-cal')
    if span:
        src = src[:span[0]] + src[span[1]:]
        changes.append("دکمهٔ «انتشار در سایت» تقویم حذف شد")
    elif not already:
        die('دکمهٔ pub-cal پیدا نشد.')

    # ۴) حذف هندلر دستی تقویم (جایش انتشار خودکار می‌آید)
    if "const pubCal = $('#pub-cal');" in src:
        i, j = cut_until(src, "const pubCal = $('#pub-cal');",
                         "const stCal = $('#st-cal');", 'هندلر pubCal')
        src = src[:i] + "    /* انتشار تقویم خودکار است — دکمه‌ای وجود ندارد. */\n" + src[j:]
        changes.append("هندلر دستی تقویم برداشته شد")

    # ۵) استخراج سازندهٔ رویدادهای فصل + استفاده در pageCal
    if 'function seasonCalendarEvents()' not in src:
        anchor = "  /* ═══════════ صفحه: تقویم ═══════════ */"
        src = replace_once(src, anchor, CAL_EVENTS_FN + anchor, 'درج seasonCalendarEvents')
        builder_start = "    // ── ساخت رویدادها (فقط: مسابقه، کلاس، تمرین، اردو) ──"
        i, j = cut(src, builder_start, "    events.sort((a,b) => a.d - b.d);\n", 'سازندهٔ رویداد تقویم')
        src = src[:i] + "    const events = seasonCalendarEvents();\n" + src[j:]
        changes.append("سازندهٔ رویدادهای فصل مشترک شد")

    # ۶) اثرانگشت تشخیص تغییر: همهٔ ورودی‌های سکو، نه فقط نتایج
    old_hash = ("  function podiumResultsHash(){\n"
                "    try{return cyrb53(JSON.stringify(D.loadResults()||{}));}catch(e){return '';}\n"
                "  }")
    if old_hash in src:
        new_hash = (
            "  /* اثرانگشت همهٔ ورودی‌های سکو (نتایج، دوره‌ها، رویدادها، قوانین، مسابقات،\n"
            "     کارت‌ها، اشتراک و سکه) — تا هم‌گام‌سازی هیچ تغییری را از دست ندهد. */\n"
            "  function podiumResultsHash(){\n"
            "    try{\n"
            "      const ls = k => { try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } };\n"
            "      return cyrb53(JSON.stringify([\n"
            "        D.loadResults()||{},\n"
            "        (D.loadPrograms ? D.loadPrograms() : ls('ga_programs'))||[],\n"
            "        ls('ga_events'), ls('ga_tournaments'), ls('ga_tour_rules'),\n"
            "        ls('ga_tour_override'), ls('ga_tour_hidden'), ls('ga_custom_players'),\n"
            "        ls('ga_scorecards'), ls('ga_subscriptions'), ls('ga_coins')\n"
            "      ]));\n"
            "    }catch(e){ return ''; }\n"
            "  }")
        src = replace_once(src, old_hash, new_hash, 'گسترش podiumResultsHash')
        changes.append("اثرانگشت تغییر گسترش یافت")

    # ۷) هنگام ورود مدیر، تقویم هم هم‌گام شود
    old_rec = ("  function reconcilePodiumOnAdminEntry(){\n"
               "    if(!isAdmin(currentUser))return;")
    if old_rec in src and 'planCalendarPublish(1500)' not in src:
        new_rec = ("  function reconcilePodiumOnAdminEntry(){\n"
                   "    if(!isAdmin(currentUser))return;\n"
                   "    /* تقویم فصل هم مثل سکو خودش را با سایت هم‌گام می‌کند (بدون دکمه) */\n"
                   "    try{ if(store.get(CAL_HASH_KEY)!==calendarHash()) planCalendarPublish(1500); }catch(e){}")
        src = replace_once(src, old_rec, new_rec, 'هم‌گام‌سازی تقویم در ورود مدیر')
        changes.append("هم‌گام‌سازی تقویم هنگام ورود مدیر اضافه شد")

    # ۸) افزودن بلوک خودکار
    if 'ga-season-changed' not in src:
        anchor = ("  document.addEventListener('visibilitychange',"
                  "()=>{if(!document.hidden && podiumAutoPending)planPodiumAutoPublish(250);});\n")
        src = replace_once(src, anchor, anchor + AUTO_BLOCK, 'درج بلوک انتشار خودکار')
        changes.append("بلوک انتشار خودکار اضافه شد")

    return src, changes

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    ap.add_argument('--build', action='store_true', help='اجرای source/build_standalone.py پس از پچ')
    a = ap.parse_args()

    app_path = os.path.join(a.root, APPS)
    if not os.path.isfile(app_path):
        die(f"فایل پیدا نشد: {app_path}  (--root را درست بدهید)")

    src = open(app_path, encoding='utf-8').read()
    before = hashlib.sha256(src.encode()).hexdigest()[:12]

    # پشتیبان
    bak = app_path + '.bak'
    if not os.path.exists(bak):
        shutil.copy2(app_path, bak)
        print(f"🗂  پشتیبان ساخته شد: {bak}")

    new, changes = patch_app(src)
    if new == src:
        print("ℹ️  هیچ تغییری لازم نبود (احتمالاً قبلاً پچ شده).")
    else:
        open(app_path, 'w', encoding='utf-8').write(new)
        after = hashlib.sha256(new.encode()).hexdigest()[:12]
        print(f"✅ سورس پچ شد  ({before} → {after})")
        for c in changes:
            print(f"   • {c}")

    # بازرسی سلامت
    checks = [
        ("دکمهٔ سکوی فصل حذف شده", 'pub-podium' not in new),
        ("دکمهٔ تقویم حذف شده",    'pub-cal' not in new),
        ("سازندهٔ مشترک رویداد",   'function seasonCalendarEvents()' in new),
        ("انتشار خودکار تقویم",    'publishSeasonCalendar' in new),
        ("گوش‌دادن به ga-season-changed", "addEventListener('ga-season-changed'" in new),
        ("اثرانگشت گسترده",        'ga_scorecards' in new),
    ]
    print("\n🔎 بازرسی:")
    bad = 0
    for label, ok in checks:
        print(f"   {'✅' if ok else '❌'} {label}")
        bad += 0 if ok else 1
    if bad:
        die("بازرسی رد شد — فایل .bak را برگردانید.")

    if a.build:
        script = os.path.join(a.root, 'source', 'build_standalone.py')
        if os.path.isfile(script):
            print("\n🏗  ساخت standalone…")
            r = subprocess.run([sys.executable, script], cwd=a.root)
            if r.returncode != 0:
                die("build_standalone.py خطا داد.")
            print("✅ بیلد ساخته شد. حالا GolfAcademy_PRO.html را به ریپوی golf-academy-panel هم کپی کنید.")
        else:
            print(f"\n⚠️  {script} پیدا نشد؛ بیلد را دستی بزنید.")

    print("\n▶️  مرحلهٔ بعد:  ga-sync.patched.ts را در Supabase deploy کنید (سقف حجم + پیام خطای دقیق).")
    print("    و پچ آواتار (podium-avatar-fix.js) را داخل همین فایل اعمال کنید تا روی آیفون هم کار کند.")

if __name__ == '__main__':
    main()
