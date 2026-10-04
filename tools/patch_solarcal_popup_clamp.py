#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""CAL_POP_CLAMP_V1 — سقفِ کادر دید برای تقویم سایت و پنل فروشگاه

پنل مدیریت در `JDATE_POP_FIX_V1` هم به body منتقل شد و هم کلمپ شد. کتابخانهٔ
عمومی (`source/js/solar-cal.js`) که در سایت و پنل فروشگاه کار می‌کند از قبل
`fixed` و در body بود، اما:

  ۱) اگر فیلد نزدیک لبهٔ پایین باشد، پاپ‌آپ می‌توانست از کادر دید بیرون بزند
     (فقط بالای فیلد می‌رفت، سقف نمی‌خورد)؛
  ۲) `max-height` نداشت، پس روی نمایشگر کم‌ارتفاع ممکن بود روزهای آخر گم شوند.

این پچ هر دو را می‌بندد. ایدِمپوتنت است. با --build بیلد سایت و پنل فروشگاه
گرفته می‌شود.
"""
from pathlib import Path
import hashlib
import subprocess
import sys

MARKER = 'CAL_POP_CLAMP_V1'
ROOT = Path(__file__).resolve().parent.parent
CHANGED, SKIPPED, ERRORS = [], [], []


def read(p):
    return Path(p).read_text(encoding='utf-8')


def write(p, s):
    Path(p).write_text(s, encoding='utf-8')


def edit(rel, steps):
    p = ROOT / rel
    s = read(p)
    applied = []
    for label, done, anchor, repl in steps:
        if done and done in s:
            SKIPPED.append('%s ← %s' % (rel, label))
            continue
        n = s.count(anchor)
        if n != 1:
            ERRORS.append('%s: انکر «%s» %d بار پیدا شد (باید ۱ باشد): %r' % (rel, label, n, anchor[:120]))
            return
        s = s.replace(anchor, repl, 1)
        applied.append('%s ← %s' % (rel, label))
    if applied:
        write(p, s)
        CHANGED.extend(applied)


edit('source/js/solar-cal.js', [
    # ۱) کلمپِ عمودی داخل کادر دید (هم مثل پنل)
    ('کلمپ عمودی',
     'top = Math.max(8, Math.min(top, Math.max(8, window.innerHeight - H - 8)))',
     "    let top = r.bottom + 6;\n"
     "    if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 6);\n",
     "    let top = r.bottom + 6;                                                       /* اولویت: زیر فیلد */\n"
     "    if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 6);        /* جا نبود: بالای فیلد */\n"
     "    /* CAL_POP_CLAMP_V1 — هرگز از کادر دید بیرون نزند (نمایشگر کم‌ارتفاع یا فیلد لبهٔ پایین) */\n"
     "    top = Math.max(8, Math.min(top, Math.max(8, window.innerHeight - H - 8)));\n"),

    # ۲) استایل: سقف ارتفاع + اسکرول داخلی (هفتهٔ آخر همیشه در دسترس)
    ('سقف ارتفاع و اسکرول',
     'max-height:calc(100vh - 16px);overflow-y:auto',
     "'.sc-pop{position:fixed;z-index:2147483000;direction:rtl;width:290px;max-width:calc(100vw - 20px);'",
     "'.sc-pop{position:fixed;z-index:2147483000;direction:rtl;width:290px;max-width:calc(100vw - 20px);' +\n"
     "        'max-height:calc(100vh - 16px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;'"),
])


def verify():
    js = read(ROOT / 'source/js/solar-cal.js')
    checks = [
        ('solar-cal.js', 'CAL_POP_CLAMP_V1 — هرگز از کادر دید بیرون نزند' in js, 'کلمپ عمودی'),
        ('solar-cal.js', 'top = Math.max(8, Math.min(top, Math.max(8, window.innerHeight - H - 8)));' in js, 'فرمول کلمپ'),
        ('solar-cal.js', 'max-height:calc(100vh - 16px);overflow-y:auto' in js, 'سقف ارتفاع و اسکرول'),
        ('solar-cal.js', 'overscroll-behavior:contain' in js, 'اسکرول داخلی'),
        ('solar-cal.js', "if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 6);" in js, 'معکوس‌شدن به بالا'),
    ]
    bad = 0
    for where, ok, label in checks:
        print('  %s %-40s %s' % ('✅' if ok else '❌', label, where))
        if not ok:
            bad += 1
    r = subprocess.run(['node', '--check', str(ROOT / 'source/js/solar-cal.js')], capture_output=True, text=True)
    print('  %s نحو source/js/solar-cal.js' % ('✅' if r.returncode == 0 else '❌'))
    if r.returncode:
        print(r.stderr[:400])
        bad += 1
    return bad


def build():
    print('\n── بیلد سایت + پنل فروشگاه ──')
    r = subprocess.run([sys.executable, 'source/build_public_cloud.py'], cwd=str(ROOT), capture_output=True, text=True)
    print(r.stdout.strip()[-400:])
    if r.returncode:
        print(r.stderr[-1200:])
        return 1
    bad = 0
    for pattern, label, needles in [
        ('site-cloud.*.js', 'سایت', ['CAL_POP_CLAMP_V1', 'top = Math.max(8, Math.min(top, Math.max(8, window.innerHeight - H - 8)))', 'max-height:calc(100vh - 16px)']),
        ('shop-ops.*.js', 'پنل فروشگاه', ['CAL_POP_CLAMP_V1', 'top = Math.max(8, Math.min(top, Math.max(8, window.innerHeight - H - 8)))']),
    ]:
        files = sorted(ROOT.glob(pattern))
        if not files:
            print('  ❌ باندل %s ساخته نشد' % label)
            bad += 1
            continue
        f = files[-1]
        t = read(f)
        print('  ── %s: %s (%d بایت) md5=%s' % (label, f.name, f.stat().st_size, hashlib.md5(t.encode()).hexdigest()))
        for needle in needles:
            ok = needle in t
            print('     %s %s' % ('✅' if ok else '❌', needle[:60]))
            bad += 0 if ok else 1
    return 1 if bad else 0


if __name__ == '__main__':
    print('═══ %s ═══' % MARKER)
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
