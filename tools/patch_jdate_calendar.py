#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_jdate_calendar.py — تقویم شمسی کلیکی + هم‌گام‌سازی خودکار تاریخ دوم

خواستهٔ مالک (پنل مدیریت):
    ۱) کنار هر ورودی تاریخ، آیتم تقویم: با کلیک، تقویم شمسی باز شود و
       به‌جای تایپ دستی، روز را کلیک کنیم.
    ۲) روش فعلی (تایپ دستی + دراپ‌داون‌های سال/ماه/روز) هم سر جایش بماند،
       تا هر کدام را خواستیم استفاده کنیم.
    ۳) اگر فیلد تاریخ دومی باشد (شروع/پایان)، خودکار روی همان روز انتخابی
       قرار بگیرد و در صورت نیاز دستی تغییر کند.

تحلیل انجام‌شده:
    هر ۱۱ ورودی تاریخ پنل از همین `source/js/jdate.js` استفاده می‌کنند
    (مسابقه، دوره، رویداد تقویم، بازیکن، بذرپاشی، تور، آنالیز). پس ارتقای
    همین یک کامپوننت همه‌جا را پوشش می‌دهد و هیچ ورودی تاریخِ خامی در پنل
    نمانده است.

اجرا:
    python3 tools/patch_jdate_calendar.py --root . --build
"""

import argparse, hashlib, os, shutil, subprocess, sys

M = 'JDATE_CALENDAR_V1'
JDATE = os.path.join('source', 'js', 'jdate.js')
MGMT = os.path.join('source', 'js', 'mgmt.js')
CSS = os.path.join('source', 'css', 'mgmt.css')


def die(m):
    print(f"❌ {m}")
    sys.exit(1)


def rep(src, old, new, label, count=1):
    n = src.count(old)
    if n != count:
        die(f"«{label}» باید {count} بار باشد، ولی {n} بار پیدا شد.")
    return src.replace(old, new, count)


# ── ۱) CSS تقویم ──
CSS_ANCHOR = ".jdate-result{font-size:12px;color:var(--green-l);font-weight:700}\n"
CSS_NEW = CSS_ANCHOR + """/* ═══ تقویم کلیکی شمسی داخل ورودی تاریخ (JDATE_CALENDAR_V1) ═══ */
.jcal-wrap{margin-bottom:10px}
.jcal-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.jcal-title{font-size:13px;font-weight:800;color:var(--gold-l,var(--gold));text-align:center;flex:1}
.jcal-nav{width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;
  background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.3);border-radius:9px;
  color:var(--gold-l,var(--gold));font-size:15px;line-height:1;transition:.15s;user-select:none}
.jcal-nav:hover{background:rgba(212,175,55,.26)}
.jcal-wd,.jcal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
.jcal-wd{margin-bottom:5px}
.jcal-wd span{font-size:10px;font-weight:700;color:var(--muted);text-align:center;padding:2px 0}
.jcal-d{height:32px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;
  border-radius:9px;cursor:pointer;border:1px solid transparent;color:var(--white);
  background:rgba(255,255,255,.035);transition:.12s}
.jcal-d:hover{background:rgba(212,175,55,.22);border-color:rgba(212,175,55,.45)}
.jcal-d.today{border-color:rgba(30,187,138,.55);color:var(--green-l)}
.jcal-d.sel{background:linear-gradient(135deg,var(--gold),#b08a28);color:#1a1407;font-weight:900;border-color:transparent}
.jcal-d.empty{background:transparent;cursor:default;pointer-events:none;border-color:transparent}
.jcal-sep{display:flex;align-items:center;gap:8px;margin:11px 0 9px;color:var(--muted);font-size:10.5px}
.jcal-sep::before,.jcal-sep::after{content:"";flex:1;height:1px;background:rgba(212,175,55,.18)}
"""

# ── ۲) jdate.js: مارک‌آپ تقویم ──
MARKUP_OLD = """      <div class="jdate-pop" hidden>
        <div class="jdate-selects">"""
MARKUP_NEW = """      <div class="jdate-pop" hidden>
        <div class="jcal-wrap">
          <div class="jcal-head">
            <div class="jcal-nav jcal-prev" title="ماه قبل" role="button" aria-label="ماه قبل">‹</div>
            <div class="jcal-title"></div>
            <div class="jcal-nav jcal-next" title="ماه بعد" role="button" aria-label="ماه بعد">›</div>
          </div>
          <div class="jcal-wd"></div>
          <div class="jcal-grid"></div>
        </div>
        <div class="jcal-sep">یا انتخاب با دراپ‌داون / تایپ دستی</div>
        <div class="jdate-selects">"""

# ── ۳) jdate.js: منطق تقویم + آینه ──
JS_ANCHOR = "    sy.addEventListener('change', () => { setDayOptions(false); emit(); });"
JS_NEW = """    /* ═══ تقویم کلیکی شمسی — JDATE_CALENDAR_V1 ═══ */
    const WD = ['ش','ی','د','س','چ','پ','ج'];
    const grid  = el.querySelector('.jcal-grid');
    const gtitle= el.querySelector('.jcal-title');
    el.querySelector('.jcal-wd').innerHTML = WD.map(w => '<span>' + w + '</span>').join('');
    let vy = +sy.value, vm = +sm.value;      /* ماهِ در حال نمایش (مستقل از انتخاب) */

    function firstDow(jy, jm){
      const d = D.dateFrom(D.shamsiToISO(jy, jm, 1));
      return (d.getUTCDay() + 1) % 7;        /* شنبه = ۰ */
    }
    function syncView(){ vy = +sy.value; vm = +sm.value; }

    function renderGrid(){
      if (!grid) return;
      const n = daysIn(vy, vm);
      const sel = { y:+sy.value, m:+sm.value, d:+sd.value };
      let t = null;
      try{ t = D.jalaliInfo(); }catch(e){}
      gtitle.textContent = MONTHS[vm-1] + ' ' + fa(vy);
      let h = '';
      const off = firstDow(vy, vm);
      for (let i = 0; i < off; i++) h += '<div class="jcal-d empty"></div>';
      for (let d = 1; d <= n; d++){
        const isSel = (vy === sel.y && vm === sel.m && d === sel.d);
        const isToday = !!(t && vy === t.yy && vm === t.mm && d === t.dd);
        h += '<div class="jcal-d' + (isSel ? ' sel' : '') + (isToday ? ' today' : '') +
             '" data-d="' + d + '" role="button" tabindex="0">' + fa(d) + '</div>';
      }
      grid.innerHTML = h;
    }

    /* کلیک روی روز → انتخاب فوری و بستن تقویم */
    grid.addEventListener('click', e => {
      const c = e.target.closest('.jcal-d');
      if (!c || c.classList.contains('empty')) return;
      touched = true;                        /* انتخاب دستی کاربر */
      sy.value = String(vy); sm.value = String(vm);
      setDayOptions(false); sd.value = String(c.dataset.d);
      emit();
      pop.hidden = true;
      if (window.APP && APP.toast) APP.toast('تاریخ «' + manual.value + '» ثبت شد ✓', 'green');
    });
    el.querySelector('.jcal-prev').addEventListener('click', () => {
      vm--; if (vm < 1){ vm = 12; vy--; } renderGrid();
    });
    el.querySelector('.jcal-next').addEventListener('click', () => {
      vm++; if (vm > 12){ vm = 1; vy++; } renderGrid();
    });

""" + JS_ANCHOR

# ── ۴) jdate.js: open با نمایش روی ماهِ مقدار فعلی ──
OPEN_OLD = """    el.querySelector('.jdate-cal-btn').addEventListener('click', e => {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
      setDayOptions(true);
    });"""
OPEN_NEW = """    el.querySelector('.jdate-cal-btn').addEventListener('click', e => {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
      setDayOptions(true);
      syncView();          /* تقویم روی ماهِ تاریخ فعلی باز می‌شود */
      renderGrid();
    });"""

# ── ۵) jdate.js: touched + آینه ──
TOUCH_ANCHOR = "    function syncManual(){"
TOUCH_NEW = """    /* ═══ هم‌گام‌سازی تاریخ دوم ═══
       اگر این ورودی «تاریخ شروع» باشد و مقصدش (تاریخ پایان) را کاربر دستی
       عوض نکرده باشد، مقصد خودکار روی همان روز انتخابی می‌رود؛ در صورت
       نیاز کاربر می‌تواند دستی تغییرش دهد و از آن لحظه دیگر خودکار نمی‌شود. */
    let touched = false;
    let inMirror = false;
    el._touched = () => touched;
    function applyMirror(iso){
      if (!opts.mirror || inMirror) return;
      let t = null;
      try{ t = typeof opts.mirror === 'string' ? document.querySelector(opts.mirror) : opts.mirror; }catch(e){}
      if (!t || typeof t._set !== 'function') return;
      if (typeof t._touched === 'function' && t._touched()) return;   /* کاربر عوضش کرده */
      inMirror = true;
      try{ t._set(iso); }finally{ inMirror = false; }
    }

    function syncManual(){"""

EMIT_OLD = """    function emit(){
      const iso = syncManual();
      if (opts.onChange) opts.onChange(iso);
    }"""
EMIT_NEW = """    function emit(){
      const iso = syncManual();
      if (opts.onChange) opts.onChange(iso);
      if (touched) applyMirror(iso);   /* فقط تغییرهای دستیِ کاربر آینه می‌شوند */
    }"""

# انتخاب با دراپ‌داون = تعامل کاربر
SY_OLD = "    sy.addEventListener('change', () => { setDayOptions(false); emit(); });\n    sm.addEventListener('change', () => { setDayOptions(true); emit(); });\n    sd.addEventListener('change', () => emit());"
SY_NEW = ("    sy.addEventListener('change', () => { touched = true; setDayOptions(false); syncView(); renderGrid(); emit(); });\n"
          "    sm.addEventListener('change', () => { touched = true; setDayOptions(true); syncView(); renderGrid(); emit(); });\n"
          "    sd.addEventListener('change', () => { touched = true; renderGrid(); emit(); });")

# ورود دستی = تعامل کاربر
MANUAL_OLD = """        if (p){
          if (p[0] >= 1300 && p[0] <= 1412){
            sy.value = p[0]; sm.value = p[1];
            setDayOptions(false);
            if (p[2] <= +sd.options[sd.options.length-1].value) sd.value = String(p[2]);
            else sd.value = sd.options[sd.options.length-1].value;
            emit();"""
MANUAL_NEW = """        if (p){
          if (p[0] >= 1300 && p[0] <= 1412){
            touched = true;
            sy.value = p[0]; sm.value = p[1];
            setDayOptions(false);
            if (p[2] <= +sd.options[sd.options.length-1].value) sd.value = String(p[2]);
            else sd.value = sd.options[sd.options.length-1].value;
            syncView(); renderGrid();
            emit();"""

# ── ۶) mgmt.js: وصل کردن جفت‌های شروع/پایان ──
PAIRS = [
    ("JDate.render($('#mt-start'), { value: D.todayISO(), onChange(){ renderTourSch(); } });",
     "JDate.render($('#mt-start'), { value: D.todayISO(), mirror:'#mt-end', onChange(){ renderTourSch(); } });",
     "جفت مسابقه"),
    ("JDate.render($('#pr-start'), { value: D.todayISO(), onChange(){} });",
     "JDate.render($('#pr-start'), { value: D.todayISO(), mirror:'#pr-end', onChange(){} });",
     "جفت دوره"),
    ("JDate.render($('#me-start'), { value: D.todayISO(), onChange(){ renderSchedule(); } });",
     "JDate.render($('#me-start'), { value: D.todayISO(), mirror:'#me-end', onChange(){ renderSchedule(); } });",
     "جفت رویداد تقویم"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    ap.add_argument('--build', action='store_true')
    a = ap.parse_args()

    for f in (JDATE, MGMT, CSS):
        if not os.path.isfile(os.path.join(a.root, f)):
            die(f"پیدا نشد: {f}")

    # ── jdate.js ──
    pj = os.path.join(a.root, JDATE)
    src = open(pj, encoding='utf-8').read()
    if M in src:
        print("ℹ️  قبلاً پچ شده.")
    else:
        changes = []
        src = rep(src, MARKUP_OLD, MARKUP_NEW, "مارک‌آپ تقویم")
        changes.append("گرید تقویم + نوار ماه به پنجره اضافه شد")
        src = rep(src, TOUCH_ANCHOR, TOUCH_NEW, "تزریق touched/آینه")
        changes.append("پرچم «دستی تغییر داده شد» + منطق آینه اضافه شد")
        src = rep(src, EMIT_OLD, EMIT_NEW, "emit")
        changes.append("emit فقط تغییرهای دستی را آینه می‌کند")
        src = rep(src, JS_ANCHOR, JS_NEW, "منطق تقویم")
        changes.append("رندر گرید، ناوبری ماه، و انتخاب روز اضافه شد")
        src = rep(src, SY_OLD, SY_NEW, "هندلرهای دراپ‌داون")
        changes.append("دراپ‌داون‌ها مارک دستی و به‌روزرسانی گرید گرفتند")
        src = rep(src, MANUAL_OLD, MANUAL_NEW, "ورود دستی")
        changes.append("تایپ دستی هم مارک دستی و به‌روزرسانی گرید گرفت")
        src = rep(src, OPEN_OLD, OPEN_NEW, "باز کردن تقویم")
        changes.append("تقویم روی ماهِ تاریخ فعلی باز می‌شود")
        src = src.replace("/* ═══════════════════════════════════════════════════════════════════\n   JDate",
                          "/* JDATE_CALENDAR_V1\n   ═══════════════════════════════════════════════════════════════════\n   JDate", 1)

        if not os.path.exists(pj + '.calbak'):
            shutil.copy2(pj, pj + '.calbak')
        open(pj, 'w', encoding='utf-8').write(src)
        print(f"✅ jdate.js پچ شد ({hashlib.sha256(src.encode()).hexdigest()[:10]})")
        for c in changes:
            print(f"   • {c}")

    # ── mgmt.js ──
    pm = os.path.join(a.root, MGMT)
    m = open(pm, encoding='utf-8').read()
    if 'mirror:' in m:
        print("ℹ️  mgmt.js قبلاً پچ شده.")
    else:
        for old, new, label in PAIRS:
            m = rep(m, old, new, label)
            print(f"   • {label}: تاریخ دوم به اول وصل شد")
        if not os.path.exists(pm + '.calbak'):
            shutil.copy2(pm, pm + '.calbak')
        open(pm, 'w', encoding='utf-8').write(m)
        print("✅ mgmt.js پچ شد")

    # ── CSS ──
    pc = os.path.join(a.root, CSS)
    c = open(pc, encoding='utf-8').read()
    if '.jcal-grid' in c:
        print("ℹ️  CSS قبلاً پچ شده.")
    else:
        c = rep(c, CSS_ANCHOR, CSS_NEW, "CSS تقویم")
        if not os.path.exists(pc + '.calbak'):
            shutil.copy2(pc, pc + '.calbak')
        open(pc, 'w', encoding='utf-8').write(c)
        print("✅ mgmt.css پچ شد")

    # ── بازرسی ──
    src = open(pj, encoding='utf-8').read()
    m = open(pm, encoding='utf-8').read()
    c = open(pc, encoding='utf-8').read()
    checks = [
        ("مارکر نسخه", M in src),
        ("گرید تقویم در مارک‌آپ", 'class="jcal-grid"' in src),
        ("ناوبری ماه", 'jcal-prev' in src and 'jcal-next' in src),
        ("کلیک روی روز", "e.target.closest('.jcal-d')" in src),
        ("امروز مشخص است", "isToday ? ' today'" in src or "' today'" in src),
        ("روز انتخابی مشخص است", "' sel'" in src),
        ("دراپ‌داون‌ها حفظ شدند", 'class="jdate-selects"' in src),
        ("تایپ دستی حفظ شد", 'jdate-manual' in src),
        ("دکمهٔ ثبت تاریخ حفظ شد", 'jd-ok' in src),
        ("منطق آینه", 'function applyMirror(iso)' in src),
        ("آینه فقط برای تغییر دستی", 'if (touched) applyMirror(iso);' in src),
        ("پرچم touched", 'el._touched = () => touched;' in src),
        ("جفت مسابقه", "mirror:'#mt-end'" in m),
        ("جفت دوره", "mirror:'#pr-end'" in m),
        ("جفت رویداد تقویم", "mirror:'#me-end'" in m),
        ("CSS گرید", '.jcal-grid{' in c),
        ("CSS روز انتخابی", '.jcal-d.sel{' in c),
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
        import shutil as _sh
        _sh.copy(os.path.join(a.root, 'source', 'GolfAcademy_PRO.html'),
                 os.path.join(a.root, 'GolfAcademy_PRO.html'))
        print("✅ بیلد ساخته و به ریشه کپی شد.")


if __name__ == '__main__':
    main()
