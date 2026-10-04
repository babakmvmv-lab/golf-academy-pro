#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CMD_STATS_T6_V1 — اصلاح کارت‌های «فرماندهی» در پنل مدیریت

درخواست مالک:
  ۱) «مسابقات برگزار» → کل تعداد مسابقات (نه فقط مسابقاتی که کارت امتیاز دارند)
  ۲) «دوره‌های آموزشی» → تعداد کل دوره‌های آموزشی (دیتای واقعی ga_programs، نه activities خالی)
  ۳) «بازیکنان Gold Elite» → مجموع بازیکنان گلد الیت (روی همهٔ اعضا، فعال و غیرفعال)
  ۴) «قهرمان ماه» → عدد نباید باشد؛ فقط متن «قهرمان ماه — شهریور — مهشید» داخل همان کادر
  ۵) «میانگین هندیکپ» → میانگین کل اعضا (نه فقط بازیکنان فعال)

منابع دادهٔ زنده: ga_programs = ۲ دوره، ga_tournaments = ۷ مسابقه، آستانهٔ گلد الیت = ۱۲۰ امتیاز.
ایدِمپوتنت است. با --build بیلد پنل هم گرفته می‌شود.

نکتهٔ پیاده‌سازی: انکرها فقط قطعه‌های کد بدون نیم‌فاصله‌اند تا با بایت‌های واقعی فایل
دقیقاً یکی باشند (خطوط فارسی فایل در چند جا نیم‌فاصله ندارند).
"""
from pathlib import Path
import hashlib
import shutil
import subprocess
import sys

MARKER = 'CMD_STATS_T6_V1'
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
            ERRORS.append('%s: انکر «%s» %d بار پیدا شد (باید ۱ باشد): %r' % (rel, label, n, anchor[:140]))
            return
        s = s.replace(anchor, repl, 1)
        applied.append('%s ← %s' % (rel, label))
    if applied:
        write(p, s)
        CHANGED.extend(applied)


# ─────────────────────────────── data.js ───────────────────────────────
DATA_OLD = (
    "    const MATCHES_HELD = scorecards.length ? [...new Set(scorecards.map(c=>c.tour))].length : 0;\n"
    "    const GOLD_COUNT = Object.values(PTS).filter(v => v >= GOLD_ELITE).length;\n"
    "    const activePlayers = players.filter(p => p[5]);\n"
    "    const AVG_HCP = activePlayers.length ? Math.round(activePlayers.reduce((a,p)=>a+p[3],0)/activePlayers.length*10)/10 : 0;\n"
)

DATA_NEW = (
    "    const MATCHES_HELD = scorecards.length ? [...new Set(scorecards.map(c=>c.tour))].length : 0;\n"
    "    /* " + MARKER + " — کارت‌های «فرماندهی»:\n"
    "       • «کل تعداد مسابقات» = همهٔ مسابقات ثبت‌شده (نه فقط مسابقاتی که کارت امتیاز دارند)\n"
    "       • «تعداد کل دوره‌های آموزشی» = همهٔ دوره‌های ثبت‌شده (ga_programs)\n"
    "       • «مجموع بازیکنان Gold Elite» = شمارش روی همهٔ اعضا (فعال و غیرفعال)\n"
    "       • «میانگین هندیکپ» = میانگین همهٔ اعضا (نه فقط فعال‌ها) */\n"
    "    const TOTAL_MATCHES = tournaments.length;\n"
    "    const COURSE_COUNT = programs.length;\n"
    "    const GOLD_COUNT = players.filter(p => (PTS[p[0]] || 0) >= GOLD_ELITE).length;\n"
    "    const AVG_HCP = players.length ? Math.round(players.reduce((a,p)=>a+(+p[3]||0),0)/players.length*10)/10 : 0;\n"
)

DATA_EXPORT_OLD = "      PLAYER_COURSE, PAR_TYPE, TOT_PTS, MATCHES_HELD, GOLD_COUNT, AVG_HCP, NEXT_T,\n"
DATA_EXPORT_NEW = DATA_EXPORT_OLD + "      TOTAL_MATCHES, COURSE_COUNT,\n"

# ─────────────────────────────── app.js: کارت‌ها ───────────────────────────────
CARD_MATCH_OLD = "      { ic:'🥇', lbl:'مسابقات برگزار', val: A.MATCHES_HELD, sub:'در ' + D.COURSES.length + ' زمین', col:'var(--blue)', fmt:'fa' },"
CARD_MATCH_NEW = "      { ic:'🥇', lbl:'مسابقات برگزار', val: A.TOTAL_MATCHES, sub:'کل مسابقات ثبت‌شده', col:'var(--blue)', fmt:'fa' },"

CARD_COURSE_OLD = "', val: A.COURSE_DAYS, sub:'کلاس و کارگاه', col:'var(--orange)', fmt:'fa' },"
CARD_COURSE_NEW = "', val: A.COURSE_COUNT, sub:'کل دوره‌های ثبت‌شده', col:'var(--orange)', fmt:'fa' },"

CARD_GOLD_OLD = "      { ic:'💎', lbl:'بازیکنان Gold Elite', val: g, sub:'بالای ' + D.fa(D.GOLD_ELITE) + ' امتیاز', col:'var(--gold)', fmt:'fa' },"
CARD_GOLD_NEW = "      { ic:'💎', lbl:'بازیکنان Gold Elite', val: g, sub:'مجموع اعضا — بالای ' + D.fa(D.GOLD_ELITE) + ' امتیاز', col:'var(--gold)', fmt:'fa' },"

CARD_CHAMP_OLD = "      { ic:'⭐', lbl:'قهرمان ماه', val: 0, sub: A.champM ? `${A.champM} — ${esc(A.champName)}` : '—', col:'var(--teal)', fmt:'fa' },"
CARD_CHAMP_NEW = "      { ic:'⭐', lbl:'قهرمان ماه', text: A.champM ? `${esc(A.champM)} — ${esc(A.champName)}` : '—', col:'var(--teal)' },"

CARD_HCP_OLD = "      { ic:'🎖️', lbl:'میانگین هندیکپ', val: A.AVG_HCP, sub:'کل اعضا', col:'var(--red)', fmt:'num1' },"
CARD_HCP_NEW = "      { ic:'🎖️', lbl:'میانگین هندیکپ', val: A.AVG_HCP, sub:'میانگین کل اعضا', col:'var(--red)', fmt:'num1' },"

RENDER_OLD = (
    '        <div class="val"><span class="countup" data-target="${c.val}" data-fmt="${c.fmt}">0</span></div>\n'
    '        <div class="lbl">${c.lbl} — <span style="color:var(--dim)">${c.sub}</span></div>\n'
)

RENDER_NEW = (
    "        ${c.text\n"
    "          ? `<div class=\"val\" style=\"font-size:16px;font-weight:800;line-height:1.9\">${c.text}</div>`\n"
    "          : `<div class=\"val\"><span class=\"countup\" data-target=\"${c.val}\" data-fmt=\"${c.fmt}\">0</span></div>`}\n"
    "        <div class=\"lbl\">${c.lbl}${c.sub ? ` — <span style=\"color:var(--dim)\">${c.sub}</span>` : ''}</div>\n"
)

KPI_OLD = "A.COURSE_DAYS, 'var(--purple)'],"
KPI_NEW = "A.COURSE_COUNT, 'var(--purple)'],"

SENT_OLD = "${D.fa(A.COURSE_DAYS)} کلاس و اردو"

# ── رقم اعشار شمارنده: میانگین هندیکپ ۹٫۸ باید «۹٫۸» دیده شود، نه ۱۰ ──
DEC_CHARTS_OLD = (
    "    const fmt = opts.fmt || (v => v.toLocaleString('en-US'));\n"
    "    const t0 = performance.now();\n"
    "    (function step(t){\n"
    "      const p = Math.min(1, (t-t0)/dur);\n"
    "      const e = 1 - Math.pow(1-p, 3);\n"
    "      el.textContent = fmt(Math.round(target * e));\n"
)

DEC_CHARTS_NEW = (
    "    const fmt = opts.fmt || (v => v.toLocaleString('en-US'));\n"
    "    const dec = +opts.dec || 0;  /* " + MARKER + ": رقم اعشار اختیاری (میانگین هندیکپ) */\n"
    "    const t0 = performance.now();\n"
    "    (function step(t){\n"
    "      const p = Math.min(1, (t-t0)/dur);\n"
    "      const e = 1 - Math.pow(1-p, 3);\n"
    "      el.textContent = fmt(dec ? (target * e).toFixed(dec) : Math.round(target * e));\n"
)

DEC_CALL_OLD = "      Charts.countUp(el, t, { fmt: v => el.dataset.fmt === 'fa' ? D.faNum(v, 0) : v.toLocaleString('en-US') });"
DEC_CALL_NEW = (
    "      const f = el.dataset.fmt;\n"
    "      Charts.countUp(el, t, { fmt: v => f === 'fa' ? D.faNum(v, 0) : (f === 'num1' ? Number(v).toFixed(1) : v.toLocaleString('en-US')), dec: f === 'num1' ? 1 : 0 });"
)
SENT_NEW = "${D.fa(A.COURSE_COUNT)} دوره"


def apply_all():
    edit('source/js/data.js', [
        ('تعریف‌های کارت‌های فرماندهی', MARKER, DATA_OLD, DATA_NEW),
        ('خروجی aggregate', 'TOTAL_MATCHES, COURSE_COUNT,', DATA_EXPORT_OLD, DATA_EXPORT_NEW),
    ])
    edit('source/js/app.js', [
        ('کارت «مسابقات برگزار»', 'val: A.TOTAL_MATCHES', CARD_MATCH_OLD, CARD_MATCH_NEW),
        ('کارت «دوره‌های آموزشی»', "val: A.COURSE_COUNT, sub:", CARD_COURSE_OLD, CARD_COURSE_NEW),
        ('کارت «Gold Elite»', "'مجموع اعضا", CARD_GOLD_OLD, CARD_GOLD_NEW),
        ('کارت «قهرمان ماه» بدون عدد', 'text: A.champM ?', CARD_CHAMP_OLD, CARD_CHAMP_NEW),
        ('کارت «میانگین هندیکپ»', "'میانگین کل اعضا", CARD_HCP_OLD, CARD_HCP_NEW),
        ('رندر کارت متنی', '${c.text', RENDER_OLD, RENDER_NEW),
        ('KPI آکادمی — دوره‌ها', KPI_NEW, KPI_OLD, KPI_NEW),
        ('جملهٔ آکادمی — دوره‌ها', SENT_NEW, SENT_OLD, SENT_NEW),
        ('شمارندهٔ اعشاری', 'opts.dec', DEC_CALL_OLD, DEC_CALL_NEW),
    ])
    edit('source/js/charts.js', [
        ('رقم اعشار در countUp', 'opts.dec', DEC_CHARTS_OLD, DEC_CHARTS_NEW),
    ])


def verify():
    print('\n── بررسی کد منبع ──')
    bad = 0
    checks = [
        ('source/js/data.js', MARKER, 'نشانهٔ نسخه'),
        ('source/js/data.js', 'const TOTAL_MATCHES = tournaments.length;', 'کل مسابقات = tournaments'),
        ('source/js/data.js', 'const COURSE_COUNT = programs.length;', 'کل دوره‌ها = programs'),
        ('source/js/data.js', 'const GOLD_COUNT = players.filter(p => (PTS[p[0]] || 0) >= GOLD_ELITE).length;', 'گلد الیت روی همهٔ اعضا'),
        ('source/js/data.js', 'const AVG_HCP = players.length ? Math.round(players.reduce((a,p)=>a+(+p[3]||0),0)/players.length*10)/10 : 0;', 'میانگین هندیکپ کل اعضا'),
        ('source/js/data.js', 'TOTAL_MATCHES, COURSE_COUNT,', 'خروجی aggregate'),
        ('source/js/app.js', 'val: A.TOTAL_MATCHES', 'کارت مسابقات'),
        ('source/js/app.js', 'val: A.COURSE_COUNT, sub:', 'کارت دوره‌ها'),
        ('source/js/app.js', "'مجموع اعضا", 'کارت گلد الیت'),
        ('source/js/app.js', "text: A.champM ? `${esc(A.champM)} — ${esc(A.champName)}` : '—'", 'کارت قهرمان ماه بدون عدد'),
        ('source/js/app.js', "'میانگین کل اعضا", 'کارت میانگین هندیکپ'),
        ('source/js/app.js', '${c.text', 'پشتیبانی کارت متنی'),
        ('source/js/app.js', "A.COURSE_COUNT, 'var(--purple)'],", 'KPI آکادمی'),
        ('source/js/app.js', '${D.fa(A.COURSE_COUNT)} دوره', 'جملهٔ آکادمی'),
        ('source/js/app.js', 'dec: f === \'num1\' ? 1 : 0', 'شمارندهٔ اعشاری در فراخوانی'),
        ('source/js/charts.js', 'opts.dec', 'رقم اعشار در countUp'),
    ]
    for rel, needle, label in checks:
        ok = needle in read(ROOT / rel)
        print('  %s %-42s %s' % ('✅' if ok else '❌', label, rel))
        bad += 0 if ok else 1
    # کارت قهرمان ماه نباید هیچ عددی رندر کند
    app = read(ROOT / 'source/js/app.js')
    line = [l for l in app.splitlines() if "lbl:'قهرمان ماه'" in l]
    ok = len(line) == 1 and 'val:' not in line[0] and 'fmt:' not in line[0] and 'countup' not in line[0]
    print('  %s %-42s %s' % ('✅' if ok else '❌', 'کارت قهرمان ماه عدد ندارد', 'source/js/app.js'))
    bad += 0 if ok else 1
    for rel in ['source/js/data.js', 'source/js/app.js', 'source/js/charts.js']:
        r = subprocess.run(['node', '--check', str(ROOT / rel)], capture_output=True, text=True)
        ok = r.returncode == 0
        print('  %s نحو %s' % ('✅' if ok else '❌', rel))
        if not ok:
            print(r.stderr[:400])
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
    for needle, label in [(MARKER, 'نشانهٔ نسخه'),
                          ('const TOTAL_MATCHES = tournaments.length;', 'کل مسابقات'),
                          ('const COURSE_COUNT = programs.length;', 'کل دوره‌ها'),
                          ('const GOLD_COUNT = players.filter(p => (PTS[p[0]] || 0) >= GOLD_ELITE).length;', 'گلد الیت همهٔ اعضا'),
                          ('val: A.TOTAL_MATCHES', 'کارت مسابقات'),
                          (MARKER + ' — کارت', 'کارت دوره‌ها'),
                          ('val: A.COURSE_COUNT', 'کارت دوره‌ها'),
                          ('text: A.champM ?', 'کارت قهرمان ماه متنی'),
                          ("'میانگین کل اعضا", 'کارت میانگین هندیکپ'),
                          ('dec: f === \'num1\' ? 1 : 0', 'شمارندهٔ اعشاری'),
                          ('const dec = +opts.dec || 0;', 'countUp اعشاری')]:
        ok = needle in panel
        print('  %s باندل پنل: %s' % ('✅' if ok else '❌', label))
        bad += 0 if ok else 1
    ok_old = ('Object.values(PTS).filter(v => v >= GOLD_ELITE)' not in panel) and ('activePlayers.reduce' not in panel)
    print('  %s باندل پنل: محاسبهٔ قدیمی گلد الیت/میانگین حذف شده' % ('✅' if ok_old else '❌'))
    bad += 0 if ok_old else 1
    # کارت قهرمان ماه در باندل نباید countup داشته باشد
    ok_champ = panel.count("lbl:'قهرمان ماه'") == 1
    print('  %s باندل پنل: تنها یک کارت «قهرمان ماه»' % ('✅' if ok_champ else '❌'))
    bad += 0 if ok_champ else 1
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
