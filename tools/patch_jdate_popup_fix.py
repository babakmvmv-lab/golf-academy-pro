#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""JDATE_POP_FIX_V1 — پاپ‌آپ تقویم پنل دیگر زیر لایهٔ بعدی نمی‌رود

مشکل گزارش‌شده (دسکتاپ، پنل مدیریت): تقویمِ کنار «تاریخ شروع/پایان» باز می‌شد ولی
هفتهٔ آخر ماه زیر کارتِ بعدی گم می‌شد.

ریشه: `.jdate-pop` با `position:absolute` داخل کارتِ `.glass` می‌نشیند و
`.glass{overflow:hidden}` آن را می‌بُرد؛ `backdrop-filter` کارت هم زمینهٔ لایهٔ
جدا می‌سازد و کارت های بعدی روی آن کشیده می‌شوند. `z-index` هم این را حل نمی‌کند
چون برشِ overflow با z-index رفع نمی‌شود.

راه‌حل: هنگام باز شدن، پاپ‌آپ به `document.body` منتقل می‌شود (portal) و با
`position:fixed` کنار همان فیلد می‌نشیند؛ اگر پایین جا نبود، بالای فیلد باز می‌شود و
در هر حال داخل کادر دید می‌ماند. `max-height` + `overflow-y:auto` تضمین می‌کند
هفتهٔ آخر ماه همیشه در دسترس باشد.

ایدِمپوتنت است. با --build بیلد هم گرفته می‌شود.
"""
from pathlib import Path
import hashlib
import shutil
import subprocess
import sys

MARKER = 'JDATE_POP_FIX_V1'
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'source'

CHANGED, SKIPPED, ERRORS = [], [], []


def read(p):
    return Path(p).read_text(encoding='utf-8')


def write(p, s):
    Path(p).write_text(s, encoding='utf-8')


def edit(rel, steps):
    p = ROOT / rel
    if not p.exists():
        ERRORS.append('فایل پیدا نشد: %s' % rel)
        return
    s = read(p)
    applied = []
    for label, done, anchor, repl in steps:
        if done and done in s:
            SKIPPED.append('%s ← %s' % (rel, label))
            continue
        n = s.count(anchor)
        if n != 1:
            ERRORS.append('%s: انکر «%s» %d بار پیدا شد (باید ۱ باشد): %r' % (rel, label, n, anchor[:110]))
            return
        s = s.replace(anchor, repl, 1)
        applied.append('%s ← %s' % (rel, label))
    if applied:
        write(p, s)
        CHANGED.extend(applied)


def append_once(rel, marker, block):
    p = ROOT / rel
    if marker in read(p):
        SKIPPED.append('%s ← %s' % (rel, marker))
        return
    s = read(p)
    if not s.endswith('\n'):
        s += '\n'
    write(p, s + block)
    CHANGED.append('%s ← %s' % (rel, marker))


# ═══════════════════════════════════════════════════════════════════════
# ۱) jdate.js — جایگذاری، انتقال به بدنه، و بستن‌های واحد
# ═══════════════════════════════════════════════════════════════════════
HELPERS = r"""    const row = el.querySelector('.jdate-row');

    /* ═══ JDATE_POP_FIX_V1 — پاپ‌آپ از کارتِ والد خارج می‌شود ═══
       کارت‌های پنل (.glass) هم overflow:hidden دارند و هم backdrop-filter (زمینهٔ لایهٔ
       جدا می‌سازند)؛ نتیجه: پاپ‌آپِ absolute برش می‌خورد و کارتِ بعدی رویش می‌افتد.
       پس هنگام باز شدن به body منتقل و با position:fixed جای‌گذاری می‌شود. */
    let portaled = false;
    function placePop(){
      if (pop.hidden || !pop.isConnected) return;
      const r = (row || el).getBoundingClientRect();
      const W = pop.offsetWidth || 288, H = pop.offsetHeight || 440;
      const vw = window.innerWidth || 1280, vh = window.innerHeight || 800;
      let top = r.bottom + 6;                       /* اولویت: زیر فیلد */
      if (top + H > vh - 8) top = r.top - H - 6;    /* جا نبود: بالای فیلد */
      top = Math.max(8, Math.min(top, Math.max(8, vh - H - 8)));
      let right = vw - r.right;                     /* هم‌ترازِ راستِ فیلد (RTL) */
      right = Math.max(8, Math.min(right, Math.max(8, vw - W - 8)));
      pop.style.top = Math.round(top) + 'px';
      pop.style.right = Math.round(right) + 'px';
      pop.style.left = 'auto';
    }
    function openPop(){
      if (!portaled){
        document.body.appendChild(pop);             /* نه برش می‌خورد، نه زیر لایهٔ بعدی می‌رود */
        pop.classList.add('jdate-portal');
        portaled = true;
      }
      pop.hidden = false;
      placePop();
      if (window.requestAnimationFrame) window.requestAnimationFrame(placePop);
      ACTIVE_POP = placePop;
    }
    function closePop(){
      pop.hidden = true;
      if (ACTIVE_POP === placePop) ACTIVE_POP = null;
    }
"""

steps_js = [
    # سراسری: یک بازچینش‌کننده برای همهٔ ۱۱ فیلد
    ('بازچینش‌کنندهٔ سراسری',
     'function repositionActivePop(){',
     '  const D = window.Data;\n  function fa(s){ return D.fa(s); }',
     '  const D = window.Data;\n'
     '  function fa(s){ return D.fa(s); }\n'
     '  /* JDATE_POP_FIX_V1 — با اسکرول/تغییر اندازه، پاپ‌آپِ باز هم‌جای فیلدش می‌ماند */\n'
     '  let ACTIVE_POP = null;\n'
     '  function repositionActivePop(){ if (ACTIVE_POP) ACTIVE_POP(); }\n'
     '  window.addEventListener(\'scroll\', repositionActivePop, true);\n'
     '  window.addEventListener(\'resize\', repositionActivePop);'),

    # توابع جای‌گذاری و باز/بسته کردن
    ('توابع جای‌گذاری و portal',
     'function placePop(){',
     "    const manual = el.querySelector('.jdate-manual');\n    const pop = el.querySelector('.jdate-pop');",
     "    const manual = el.querySelector('.jdate-manual');\n    const pop = el.querySelector('.jdate-pop');\n" + HELPERS),

    # بازچینش پس از هر رندر شبکه (تغییر ماه، ۵ یا ۶ ردیف شدن)
    ('بازچینش پس از رندر شبکه',
     'placePop();   /* بعد از هر بازچینش',
     '      grid.innerHTML = h;\n    }',
     '      grid.innerHTML = h;\n      placePop();   /* بعد از هر بازچینش، جای پاپ‌آپ اصلاح می‌شود */\n    }'),

    # دکمهٔ تقویم: باز/بسته با openPop/closePop
    ('دکمهٔ تقویم → openPop',
     'if (pop.hidden){\n        setDayOptions(true);',
     "    el.querySelector('.jdate-cal-btn').addEventListener('click', e => {\n"
     "      e.stopPropagation();\n"
     "      pop.hidden = !pop.hidden;\n"
     "      setDayOptions(true);\n"
     "      syncView();          /* تقویم روی ماهِ تاریخ فعلی باز می‌شود */\n"
     "      renderGrid();\n"
     "    });",
     "    el.querySelector('.jdate-cal-btn').addEventListener('click', e => {\n"
     "      e.stopPropagation();\n"
     "      if (pop.hidden){\n"
     "        setDayOptions(true);\n"
     "        syncView();        /* تقویم روی ماهِ تاریخ فعلی باز می‌شود */\n"
     "        renderGrid();\n"
     "        openPop();\n"
     "      } else closePop();\n"
     "    });"),

    # انتخاب روز از شبکه
    ('انتخاب روز → closePop',
     "emit();\n      closePop();",
     "      emit();\n      pop.hidden = true;\n      if (window.APP && APP.toast) APP.toast('تاریخ «' + manual.value + '» ثبت شد ✓', 'green');",
     "      emit();\n      closePop();\n      if (window.APP && APP.toast) APP.toast('تاریخ «' + manual.value + '» ثبت شد ✓', 'green');"),

    # دکمهٔ بستن
    ('دکمهٔ بستن → closePop',
     "'.jd-close').addEventListener('click', () => { closePop(); }",
     "el.querySelector('.jd-close').addEventListener('click', () => { pop.hidden = true; });",
     "el.querySelector('.jd-close').addEventListener('click', () => { closePop(); });"),

    # دکمهٔ ثبت تاریخ
    ('دکمهٔ ثبت تاریخ → closePop',
     "'.jd-ok').addEventListener('click', () => {\n      closePop();",
     "el.querySelector('.jd-ok').addEventListener('click', () => {\n      pop.hidden = true;",
     "el.querySelector('.jd-ok').addEventListener('click', () => {\n      closePop();"),

    # ثبت با Enter در ورود دستی
    ('ثبت Enter → closePop',
     "            closePop();\n            APP.toast(",
     "            pop.hidden = true;\n            APP.toast('تاریخ «' + syncManual() + '» ثبت شد ✓', 'green');",
     "            closePop();\n            APP.toast('تاریخ «' + syncManual() + '» ثبت شد ✓', 'green');"),

    # کلیک بیرون — حالا پاپ‌آپ در body است، پس کلیک داخل خودش هم نباید ببندد
    ('کلیک بیرون (با احتساب پاپ‌آپ منتقل‌شده)',
     '&& !pop.contains(e.target)',
     "      if (!el.contains(e.target)) pop.hidden = true;",
     "      if (!el.contains(e.target) && !pop.contains(e.target)) closePop();   /* پاپ‌آپ در body است */"),
]

edit('source/js/jdate.js', steps_js)

# ═══════════════════════════════════════════════════════════════════════
# ۲) mgmt.css — استایل حالت منتقل‌شده
# ═══════════════════════════════════════════════════════════════════════
append_once('source/css/mgmt.css', '/* JDATE_POP_FIX_V1', """
/* JDATE_POP_FIX_V1 — پاپ‌آپ تقویم به body منتقل می‌شود: نه برش می‌خورد، نه زیر لایهٔ بعدی می‌رود */
.jdate-pop.jdate-portal{
  position:fixed;top:auto;right:auto;bottom:auto;left:auto;
  z-index:2147483000;
  max-height:calc(100vh - 16px);max-width:calc(100vw - 16px);
  overflow-y:auto;overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
}
.jdate-pop.jdate-portal .jcal-grid{overflow:visible}
""")

# ═══════════════════════════════════════════════════════════════════════
# بررسی‌ها
# ═══════════════════════════════════════════════════════════════════════
def verify():
    jd = read(ROOT / 'source/js/jdate.js')
    css = read(ROOT / 'source/css/mgmt.css')
    checks = [
        ('jdate.js', jd.count('pop.hidden = true;') == 1 and 'function closePop(){\n      pop.hidden = true;' in jd,
         'تنها بستنِ باقی‌مانده داخل closePop است (%d)' % jd.count('pop.hidden = true;')),
        ('jdate.js', jd.count('pop.hidden = !pop.hidden;') == 0, 'تاگل قدیمی نماند'),
        ('jdate.js', jd.count('closePop();') >= 5, 'بستن‌های واحد (%d)' % jd.count('closePop();')),
        ('jdate.js', 'document.body.appendChild(pop)' in jd, 'انتقال به body'),
        ('jdate.js', "pop.classList.add('jdate-portal')" in jd, 'کلاس حالت منتقل‌شده'),
        ('jdate.js', 'function placePop(){' in jd, 'تابع جای‌گذاری'),
        ('jdate.js', 'let ACTIVE_POP = null;' in jd, 'بازچینش‌کنندهٔ سراسری'),
        ('jdate.js', "window.addEventListener('scroll', repositionActivePop, true)" in jd, 'بازچینش با اسکرول'),
        ('jdate.js', "window.addEventListener('resize', repositionActivePop)" in jd, 'بازچینش با تغییر اندازه'),
        ('jdate.js', 'if (top + H > vh - 8) top = r.top - H - 6;' in jd, 'معکوس‌شدن به بالای فیلد'),
        ('jdate.js', '&& !pop.contains(e.target)' in jd, 'کلیک داخل پاپ‌آپ نبندد'),
        ('jdate.js', 'placePop();   /* بعد از هر بازچینش' in jd, 'بازچینش پس از رندر شبکه'),
        ('mgmt.css', '.jdate-pop.jdate-portal{' in css, 'استایل حالت منتقل‌شده'),
        ('mgmt.css', 'max-height:calc(100vh - 16px)' in css, 'سقفِ ارتفاع (هفتهٔ آخر همیشه در دسترس)'),
        ('mgmt.css', 'overflow-y:auto;overscroll-behavior:contain' in css, 'اسکرول داخلی پاپ‌آپ'),
        ('mgmt.css', 'z-index:2147483000' in css, 'بالاتر از همهٔ لایه‌های پنل'),
    ]
    bad = 0
    for where, ok, label in checks:
        print('  %s %-52s %s' % ('✅' if ok else '❌', label, where))
        if not ok:
            bad += 1
    for rel in ['source/js/jdate.js']:
        r = subprocess.run(['node', '--check', str(ROOT / rel)], capture_output=True, text=True)
        ok = r.returncode == 0
        print('  %s نحو %s' % ('✅' if ok else '❌', rel))
        if not ok:
            print(r.stderr[:400])
            bad += 1
    return bad


def build():
    print('\n── بیلد پنل (build_standalone) + کپی به ریشه، در یک گام ──')
    r = subprocess.run([sys.executable, 'source/build_standalone.py'], cwd=str(ROOT), capture_output=True, text=True)
    if r.returncode:
        print(r.stderr[-1500:])
        return 1
    src_html = SRC / 'GolfAcademy_PRO.html'
    if not src_html.exists():
        print('❌ خروجی بیلد ساخته نشد')
        return 1
    shutil.copyfile(src_html, ROOT / 'GolfAcademy_PRO.html')
    panel = read(ROOT / 'GolfAcademy_PRO.html')
    print('  ✅ GolfAcademy_PRO.html کپی شد (%d بایت) md5=%s' % (
        (ROOT / 'GolfAcademy_PRO.html').stat().st_size,
        hashlib.md5(panel.encode()).hexdigest()))
    bad = 0
    for needle, label in [('JDATE_POP_FIX_V1', 'نشانهٔ نسخه'),
                          ('.jdate-pop.jdate-portal{', 'استایل حالت منتقل‌شده'),
                          ("pop.classList.add('jdate-portal')", 'انتقال به body'),
                          ('function placePop(){', 'تابع جای‌گذاری'),
                          ('if (top + H > vh - 8) top = r.top - H - 6;', 'معکوس‌شدن'),
                          ("&& !pop.contains(e.target)", 'کلیک داخل نبندد')]:
        ok = needle in panel
        print('  %s باندل پنل: %s' % ('✅' if ok else '❌', label))
        bad += 0 if ok else 1
    ok_only_close = panel.count('pop.hidden = true;') == 1 and 'function closePop(){\n      pop.hidden = true;' in panel
    print('  %s باندل پنل: تنها بستنِ باقی‌مانده داخل closePop است' % ('✅' if ok_only_close else '❌'))
    bad += 0 if ok_only_close else 1
    return 1 if bad else 0


if __name__ == '__main__':
    print('═══ %s ═══' % MARKER)
    print('\nاِعمال تغییرات:')
    for c in CHANGED:
        print('  ＋', c)
    for s in SKIPPED:
        print('  =', s, '(از قبل)')
    if ERRORS:
        print('\n❌ خطاها:')
        for e in ERRORS:
            print('  ', e)
        sys.exit(2)
    print('\nبررسی‌ها:')
    bad = verify()
    if bad:
        print('\n❌ %d بررسی شکست خورد' % bad)
        sys.exit(3)
    print('\n✅ همهٔ بررسی‌ها سالم')
    if '--build' in sys.argv:
        sys.exit(build())
    print('\n(برای بیلد: --build)')
