#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""CSP_EMAILJS_V1 — رفع مسدودبودن ارسال ایمیل پنل توسط Content-Security-Policy

مشکل گزارش‌شده: «ایمیل راه‌اندازی شده ولی در عمل ارسال نمی‌شود؛ فقط تست ارسال شد».

ریشهٔ یافته‌شده (با مرورگر واقعی روی پنل زنده): خودِ CSP پنل جلوی درخواست را می‌گیرد.
خط CSP در source/index.html این است:

    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com

و کد ارسال (`sendEmailJS` در mgmt.js) به `https://api.emailjs.com` (و نسخهٔ اروپا
`https://api.eu.emailjs.com`) درخواست می‌زند؛ مرورگر آن را با خطای
«Refused to connect because it violates the document's Content Security Policy»
رد می‌کند و در نتیجه هرگز درخواستی به EmailJS نمی‌رسد.

این ابزار فقط دو میزبان EmailJS را به `connect-src` اضافه می‌کند (بدون بازکردن
هیچ منبع دیگری). ایدِمپوتنت است. با --build بیلد پنل هم گرفته می‌شود.
"""
from pathlib import Path
import hashlib
import shutil
import subprocess
import sys

MARKER = 'CSP_EMAILJS_V1'
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'source'

CSP_OLD = "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com;"
CSP_NEW = ("connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com "
           "https://api.emailjs.com https://api.eu.emailjs.com;  /* " + MARKER + " — ارسال ایمیل پنل */")

CHANGED, SKIPPED, ERRORS = [], [], []


def read(p):
    return Path(p).read_text(encoding='utf-8')


def write(p, s):
    Path(p).write_text(s, encoding='utf-8')


def apply_all():
    p = ROOT / 'source/index.html'
    if not p.exists():
        ERRORS.append('source/index.html پیدا نشد')
        return
    s = read(p)
    if MARKER in s:
        SKIPPED.append('source/index.html ← CSP ارسال ایمیل (از قبل)')
        return
    n = s.count(CSP_OLD)
    if n != 1:
        ERRORS.append('انکر CSP %d بار پیدا شد (باید ۱ باشد)' % n)
        return
    write(p, s.replace(CSP_OLD, CSP_NEW, 1))
    CHANGED.append('source/index.html ← افزودن دو میزبان EmailJS به connect-src')


def verify():
    print('\n── بررسی کد منبع ──')
    bad = 0
    s = read(ROOT / 'source/index.html')
    for needle, label in [(MARKER, 'نشانهٔ نسخه'),
                          ("https://api.emailjs.com https://api.eu.emailjs.com;", 'هر دو میزبان EmailJS در CSP'),
                          ("connect-src 'self' https://*.supabase.co", 'بقیهٔ connect-src دست‌نخورده'),
                          ("object-src 'none'", 'سخت‌گیری‌های دیگر CSP حفظ شده')]:
        ok = needle in s
        print('  %s %-46s %s' % ('✅' if ok else '❌', label, 'source/index.html'))
        bad += 0 if ok else 1
    # CSP نباید بازتر از این شده باشد
    ok = s.count('https://api.emailjs.com') == 1 and '*;' not in s.split('connect-src')[1][:220]
    print('  %s %-46s %s' % ('✅' if ok else '❌', 'هیچ وایلدکارد تازه‌ای اضافه نشده', 'source/index.html'))
    bad += 0 if ok else 1
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
    out = ROOT / 'GolfAcademy_PRO.html'
    panel = read(out)
    print('  ✅ GolfAcademy_PRO.html کپی شد (%d بایت) md5=%s' % (out.stat().st_size, hashlib.md5(panel.encode()).hexdigest()))
    bad = 0
    for needle, label in [(MARKER, 'نشانهٔ نسخه در باندل'),
                          ('https://api.emailjs.com https://api.eu.emailjs.com;', 'CSP باندل شامل EmailJS'),
                          ('api/v1.0/email/send', 'کد ارسال EmailJS موجود')]:
        ok = needle in panel
        print('  %s باندل پنل: %s' % ('✅' if ok else '❌', label))
        bad += 0 if ok else 1
    ok = panel.count('Content-Security-Policy') == 1
    print('  %s باندل پنل: تنها یک CSP' % ('✅' if ok else '❌'))
    bad += 0 if ok else 1
    return 1 if bad else 0


if __name__ == '__main__':
    print('═══ %s ═══' % MARKER)
    apply_all()
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
