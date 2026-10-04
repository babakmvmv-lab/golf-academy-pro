#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""CMD_MONTH_PHASE_V1 — کارت‌های «امتیاز ماهانه فصل» و «قهرمانان فازها» در صفحهٔ فرماندهی

درخواست مالک:
  ۱) «امتیاز ماهانه فصل»: مجموع امتیاز هر بازیکن در ماه انتخاب‌شده دیده شود.
  ۲) پیش‌فرضِ ماه همیشه ماه جاری باشد (الان مهر ۱۴۰۵).
  ۳) انتخاب ماه حرفه‌ای‌تر شود: پاپ‌آپ با تک‌کلیک (به‌جای دراپ‌داون + دکمهٔ «نمایش»).
  ۴) «قهرمانان فازها»: مجموع امتیاز هر فاز فصل دیده شود و قهرمان هر فاز زیر همان فاز بیاید.
  ۵) پاییز/زمستان هم اضافه شوند — قبلاً فقط بهار و تابستان رندر می‌شد و «الان در فصل پاییز
     هستیم» هیچ‌جا دیده نمی‌شد.

ایدِمپوتنت است. با --build بیلد پنل هم گرفته می‌شود.
"""
from pathlib import Path
import hashlib
import shutil
import subprocess
import sys

MARKER = 'CMD_MONTH_PHASE_V1'
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'source'
Z = '\u200c'          # نیم‌فاصله — صریح نوشته می‌شود تا بایت‌های خروجی قطعی باشد

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
        if done == '@absent@' and anchor not in s:
            SKIPPED.append('%s ← %s (قبلاً حذف شده)' % (rel, label))
            continue
        n = s.count(anchor)
        if n != 1:
            ERRORS.append('%s: انکر «%s» %d بار پیدا شد (باید ۱ باشد): %r' % (rel, label, n, anchor[:150]))
            return
        s = s.replace(anchor, repl, 1)
        applied.append('%s ← %s' % (rel, label))
    if applied:
        write(p, s)
        CHANGED.extend(applied)


# ───────────────────────────── style.css ─────────────────────────────
CSS_BLOCK = """
/* ═══ """ + MARKER + """ — پاپ‌آپ انتخاب ماه کارت «امتیاز ماهانه فصل» (صفحهٔ فرماندهی) ═══ */
.cm-pop{position:absolute;inset:0;z-index:6;display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:1fr;
  gap:8px;padding:12px;box-sizing:border-box;border-radius:16px;background:rgba(9,12,17,.9);
  -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(212,175,55,.22);
  box-shadow:0 18px 44px rgba(0,0,0,.45)}
.cm-pop[hidden]{display:none}
.cm-m{appearance:none;font-family:var(--font);font-weight:700;font-size:12.5px;color:#cfd6e2;
  background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:11px;
  cursor:pointer;transition:.16s;padding:8px 0;position:relative}
.cm-m:hover{background:rgba(212,175,55,.14);border-color:rgba(212,175,55,.5);color:#fff}
.cm-m.now{border-color:rgba(212,175,55,.45)}
.cm-m.now::after{content:'';position:absolute;top:6px;left:7px;width:5px;height:5px;border-radius:50%;
  background:#E9C766;box-shadow:0 0 8px rgba(233,199,102,.9)}
.cm-m.on{background:linear-gradient(135deg,#E9C766,#D4AF37);color:#12161c;border-color:transparent;
  box-shadow:0 8px 20px rgba(212,175,55,.32)}
.cm-m.on::after{background:#12161c;box-shadow:none}
.cm-legend{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:7px;
  font-size:10.5px;color:var(--muted)}
.cm-legend i{width:6px;height:6px;border-radius:50%;background:#E9C766;display:inline-block}
.cm-void{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  color:var(--muted);font-size:12.5px;text-align:center;padding:0 18px;line-height:1.9}
.cm-void[hidden]{display:none}
.cm-foot{margin-top:10px;font-size:11.5px;color:var(--muted);line-height:1.9}
"""


# ───────────────────────────── data.js ─────────────────────────────
DATA_OLD = (
    "    const PHASES = { '\u0628\u0647\u0627\u0631': ['\u0641\u0631\u0648\u0631\u062f\u06cc\u0646','\u0627\u0631\u062f\u06cc\u0628\u0647\u0634\u062a','\u062e\u0631\u062f\u0627\u062f'], '\u062a\u0627\u0628\u0633\u062a\u0627\u0646': ['\u062a\u06cc\u0631','\u0645\u0631\u062f\u0627\u062f','\u0634\u0647\u0631\u06cc\u0648\u0631'] };\n"
    "    const PHASE_PTS = {}; const PHASE_CHAMP = {};\n"
    "    Object.keys(PHASES).forEach(ph => {\n"
    "      const acc = {};\n"
    "      PHASES[ph].forEach(m => {\n"
    "        Object.entries(MONTH_PTS[m] || {}).forEach(([pid, v]) => acc[pid] = (acc[pid]||0) + v);\n"
    "      });\n"
    "      PHASE_PTS[ph] = acc;\n"
    "      const best = Object.entries(acc).sort((a,b) => b[1] - a[1])[0];\n"
    "      PHASE_CHAMP[ph] = best ? { pid: +best[0], name: (players.find(x => x[0] === +best[0]) || [0,'\u2014'])[1], pts: best[1] } : { pid: null, name: '\u2014', pts: 0 };\n"
    "    });\n"
)

DATA_NEW = (
    "    /* " + MARKER + " \u2014 \u0686\u0647\u0627\u0631 \u0641\u0627\u0632 \u0641\u0635\u0644 (\u0642\u0628\u0644\u0627\u064b \u0641\u0642\u0637 \u0628\u0647\u0627\u0631 \u0648 \u062a\u0627\u0628\u0633\u062a\u0627\u0646 \u0628\u0648\u062f \u0648 \u067e\u0627\u06cc\u06cc\u0632/\u0632\u0645\u0633\u062a\u0627\u0646 \u0646\u0645\u0627\u06cc\u0634 \u062f\u0627\u062f\u0647 \u0646\u0645\u06cc\u200c\u0634\u062f) */\n"
    "    const PHASES = { '\u0628\u0647\u0627\u0631': ['\u0641\u0631\u0648\u0631\u062f\u06cc\u0646','\u0627\u0631\u062f\u06cc\u0628\u0647\u0634\u062a','\u062e\u0631\u062f\u0627\u062f'],\n"
    "                     '\u062a\u0627\u0628\u0633\u062a\u0627\u0646': ['\u062a\u06cc\u0631','\u0645\u0631\u062f\u0627\u062f','\u0634\u0647\u0631\u06cc\u0648\u0631'],\n"
    "                     '\u067e\u0627\u06cc\u06cc\u0632': ['\u0645\u0647\u0631','\u0622\u0628\u0627\u0646','\u0622\u0630\u0631'],\n"
    "                     '\u0632\u0645\u0633\u062a\u0627\u0646': ['\u062f\u06cc','\u0628\u0647\u0645\u0646','\u0627\u0633\u0641\u0646\u062f'] };\n"
    "    const PHASE_PTS = {}; const PHASE_CHAMP = {}; const PHASE_TOT = {};\n"
    "    Object.keys(PHASES).forEach(ph => {\n"
    "      const acc = {};\n"
    "      PHASES[ph].forEach(m => {\n"
    "        Object.entries(MONTH_PTS[m] || {}).forEach(([pid, v]) => acc[pid] = (acc[pid]||0) + v);\n"
    "      });\n"
    "      PHASE_PTS[ph] = acc;\n"
    "      /* مجموع امتیاز کل بازیکنان در این فاز \u2014 همان عددی که کارت «قهرمانان فازها» نشان می\u200cدهد */\n"
    "      PHASE_TOT[ph] = Object.values(acc).reduce((a,b) => a + b, 0);\n"
    "      const best = Object.entries(acc).sort((a,b) => b[1] - a[1])[0];\n"
    "      PHASE_CHAMP[ph] = best ? { pid: +best[0], name: (players.find(x => x[0] === +best[0]) || [0,'\u2014'])[1], pts: best[1] } : { pid: null, name: '\u2014', pts: 0 };\n"
    "    });\n"
    "    const PHASE_ORDER = Object.keys(PHASES);\n"
)

DATA_EXPORT_OLD = "      CAREER, PTS, CARDS, ST, LB, SKILLS, PHASE_PTS, PHASE_CHAMP, MONTH_PTS, MONTHLY_TOT,\n"
DATA_EXPORT_NEW = DATA_EXPORT_OLD + "      PHASE_TOT, PHASE_ORDER,\n"


# ───────────────────────────── app.js: صفحهٔ فرماندهی ─────────────────────────────
CMD_HEAD_OLD = """  function pageCmd(){
    const v = $('#view');
    const g = A.GOLD_COUNT;
"""
CMD_HEAD_NEW = """  function pageCmd(){
    const v = $('#view');
    cmMonth = D.jalaliInfo(D.now()).monthFa;   /* """ + MARKER + """ \u2014 پیش\u200cفرض همیشه ماه جاری */
    const g = A.GOLD_COUNT;
"""

PHASE_OLD = """        <div class="card-head"><span class="ic">\u26a1</span><h3>\u0642\u0647\u0631\u0645\u0627\u0646\u0627\u0646 \u0641\u0627\u0632\u0647\u0627</h3><span class="tag">Phase</span></div>
        ${['\u0628\u0647\u0627\u0631','\u062a\u0627\u0628\u0633\u062a\u0627\u0646'].map(ph => {
          const c = A.PHASE_CHAMP[ph];
          const maxP = Math.max(...Object.values(A.PHASE_PTS[ph]||{}), 1);
          return `<div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
              <b>\U0001f338 \u0641\u0627\u0632 ${ph}</b><span style="color:var(--gold-l)">${esc(c.name)} \u2014 ${D.faNum(c.pts,0)} \u0627\u0645\u062a\u06cc\u0627\u0632</span>
            </div>
            ${pbar(c.pts/maxP*100, 'gold')}
          </div>`;
        }).join('')}
"""

PHASE_NEW = """        <div class="card-head"><span class="ic">\u26a1</span><h3>\u0642\u0647\u0631\u0645\u0627\u0646\u0627\u0646 \u0641\u0627\u0632\u0647\u0627</h3><span class="tag">Phase</span></div>
        ${(() => {
          const curPh = D.jalaliInfo(D.now()).season;   /* \u0641\u0627\u0632 \u062c\u0627\u0631\u06cc \u0641\u0635\u0644 */
          const maxT = Math.max(...A.PHASE_ORDER.map(p => A.PHASE_TOT[p] || 0), 1);
          const PIC = { '\u0628\u0647\u0627\u0631':'\U0001f338', '\u062a\u0627\u0628\u0633\u062a\u0627\u0646':'\u2600\ufe0f', '\u067e\u0627\u06cc\u06cc\u0632':'\U0001f342', '\u0632\u0645\u0633\u062a\u0627\u0646':'\u2744\ufe0f' };
          return A.PHASE_ORDER.map(ph => {
            const tot = A.PHASE_TOT[ph] || 0;
            const c = A.PHASE_CHAMP[ph] || { pid:null, name:'\u2014', pts:0 };
            const isCur = ph === curPh;
            return `<div style="margin-bottom:15px">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;margin-bottom:6px">
                <b>${PIC[ph] || '\u26a1'} \u0641\u0627\u0632 ${ph}${isCur ? ' <span class="chip gold" style="font-size:9.5px;padding:2px 8px">\u0641\u0627\u0632 \u062c\u0627\u0631\u06cc</span>' : ''}</b>
                <span style="color:var(--gold-l);font-weight:800">\u0645\u062c\u0645\u0648\u0639: ${D.faNum(tot,0)} \u0627\u0645\u062a\u06cc\u0627\u0632</span>
              </div>
              ${pbar(tot/maxT*100, isCur ? 'gold' : '')}
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--muted);margin-top:6px">
                <span>\U0001f451 \u0642\u0647\u0631\u0645\u0627\u0646 \u0641\u0627\u0632</span>
                <span style="color:var(--white);font-weight:700">${c.pid ? esc(c.name) + ' \u2014 ' + D.faNum(c.pts,0) + ' \u0627\u0645\u062a\u06cc\u0627\u0632' : '\u2014'}</span>
              </div>
            </div>`;
          }).join('');
        })()}
"""

MONTH_OLD = """            <select class="sel" id="cm-month" style="width:auto;padding:5px 10px;font-size:12px">
              ${['\u0641\u0631\u0648\u0631\u062f\u06cc\u0646','\u0627\u0631\u062f\u06cc\u0628\u0647\u0634\u062a','\u062e\u0631\u062f\u0627\u062f','\u062a\u06cc\u0631','\u0645\u0631\u062f\u0627\u062f','\u0634\u0647\u0631\u06cc\u0648\u0631','\u0645\u0647\u0631','\u0622\u0628\u0627\u0646','\u0622\u0630\u0631','\u062f\u06cc','\u0628\u0647\u0645\u0646','\u0627\u0633\u0641\u0646\u062f'].map((m,i)=>`<option value="${i}">${m}</option>`).join('')}
            </select>
            <button class="btn sm ghost" id="cm-apply" style="padding:5px 12px">\u0646\u0645\u0627\u06cc\u0634</button>
"""

MONTH_NEW = """            <button class="btn sm ghost" id="cm-pick" style="padding:5px 12px" aria-haspopup="dialog" aria-expanded="false">\U0001f4c5 <b id="cm-pick-lbl">${cmMonth}</b> <span style="opacity:.6">\u25be</span></button>
"""

CHART_OLD = """        <div class="chart-box short" id="cm-chart"><canvas id="ch-cmd-line"></canvas></div>
"""

CHART_NEW = """        <div class="chart-box short" id="cm-chart">
          <canvas id="ch-cmd-line"></canvas>
          <div class="cm-pop" id="cm-pop" hidden>
            ${D.MONTHS_FA.map((m,i) => `<button class="cm-m" type="button" data-cm="${i}">${m}</button>`).join('')}
            <div class="cm-legend"><i></i> \u0645\u0627\u0647 \u062c\u0627\u0631\u06cc \u2014 \u0628\u0627 \u06cc\u06a9 \u06a9\u0644\u06cc\u06a9 \u0627\u0646\u062a\u062e\u0627\u0628 \u0645\u06cc\u200c\u0634\u0648\u062f</div>
          </div>
          <div class="cm-void" id="cm-void" hidden></div>
        </div>
        <div class="cm-foot" id="cm-foot"></div>
"""

RENDER_OLD = """  function drawMonthlyChart(){
    const cv = $('#ch-cmd-line');
    if (!cv) return;
    const mi = +($('#cm-month') ? $('#cm-month').value : 0);
    const m = ['\u0641\u0631\u0648\u0631\u062f\u06cc\u0646','\u0627\u0631\u062f\u06cc\u0628\u0647\u0634\u062a','\u062e\u0631\u062f\u0627\u062f','\u062a\u06cc\u0631','\u0645\u0631\u062f\u0627\u062f','\u0634\u0647\u0631\u06cc\u0648\u0631','\u0645\u0647\u0631','\u0622\u0628\u0627\u0646','\u0622\u0630\u0631','\u062f\u06cc','\u0628\u0647\u0645\u0646','\u0627\u0633\u0641\u0646\u062f'][mi];
    const A2 = A;
    // \u062f\u0627\u062f\u0647\u0654 \u0647\u0645\u0627\u0646 \u0645\u0627\u0647 \u0627\u0632 MONTH_PTS
    const mp = A2.MONTH_PTS[m] || {};
    const arr = Object.entries(mp).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const hasData = arr.length > 0;
    if (!hasData){
      cv.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:12.5px">\u0628\u0631\u0627\u06cc \u0645\u0627\u0647 ' + m + ' \u0647\u0646\u0648\u0632 \u0627\u0645\u062a\u06cc\u0627\u0632\u06cc \u062b\u0628\u062a \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.</div>';
      return;
    }
    const labels = arr.map(([pid,v]) => (A2.LB.find(r=>r.pid===+pid)||{}).name || '\u2014');
    const vals = arr.map(([pid,v]) => v);
    Charts.barsV(cv, labels, vals, { color:'#E9C766', fmt:v=>D.faNum(v,0), title:'\u0627\u0645\u062a\u06cc\u0627\u0632 ' + m });
  }
"""

RENDER_NEW = """  /* \u2550\u2550\u2550 """ + MARKER + """ \u2014 \u0627\u0646\u062a\u062e\u0627\u0628 \u0645\u0627\u0647 \u0628\u0627 \u067e\u0627\u067e\u200c\u0622\u067e \u062a\u06a9\u200c\u06a9\u0644\u06cc\u06a9\u06cc + \u0645\u062c\u0645\u0648\u0639 \u0627\u0645\u062a\u06cc\u0627\u0632 \u0647\u0631 \u0628\u0627\u0632\u06cc\u06a9\u0646 \u062f\u0631 \u0622\u0646 \u0645\u0627\u0647 \u2550\u2550\u2550 */
  let cmMonth = '';
  let cmOutside = null, cmKeysBound = false;
  function cmNowMonth(){ return D.jalaliInfo(D.now()).monthFa; }
  function cmClosePop(){
    const p = $('#cm-pop'); if (p) p.hidden = true;
    const b = $('#cm-pick'); if (b) b.setAttribute('aria-expanded', 'false');
    if (cmOutside){ document.removeEventListener('pointerdown', cmOutside, true); cmOutside = null; }
  }
  function cmSyncPop(){
    const pop = $('#cm-pop'); if (!pop) return;
    const cur = cmNowMonth();
    $$('.cm-m', pop).forEach((b, i) => {
      const m = D.MONTHS_FA[i];
      b.classList.toggle('on', m === cmMonth);
      b.classList.toggle('now', m === cur);
      b.title = (m === cur ? '\u0645\u0627\u0647 \u062c\u0627\u0631\u06cc' : ('\u0627\u0646\u062a\u062e\u0627\u0628 ' + m)) + ' \u2014 \u0628\u0627 \u06cc\u06a9 \u06a9\u0644\u06cc\u06a9';
    });
  }
  function cmOpenPop(){
    const pop = $('#cm-pop'); if (!pop) return;
    cmSyncPop(); pop.hidden = false;
    const b = $('#cm-pick'); if (b) b.setAttribute('aria-expanded', 'true');
    if (!cmOutside){
      cmOutside = e => {
        const t = e.target;
        if (t && t.closest && (t.closest('#cm-pop') || t.closest('#cm-pick'))) return;
        cmClosePop();
      };
      document.addEventListener('pointerdown', cmOutside, true);
    }
    if (!cmKeysBound){
      cmKeysBound = true;
      document.addEventListener('keydown', e => { if (e.key === 'Escape') cmClosePop(); });
    }
  }
  /* \u06a9\u0627\u0631\u062a \u00ab\u0627\u0645\u062a\u06cc\u0627\u0632 \u0645\u0627\u0647\u0627\u0646\u0647 \u0641\u0635\u0644\u00bb: \u0645\u062c\u0645\u0648\u0639 \u0627\u0645\u062a\u06cc\u0627\u0632 \u0647\u0631 \u0628\u0627\u0632\u06cc\u06a9\u0646 \u062f\u0631 \u0645\u0627\u0647 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 */
  function renderCmdMonth(){
    const box = $('#cm-chart'); if (!box) return;
    if (!cmMonth) cmMonth = cmNowMonth();
    const lbl = $('#cm-pick-lbl'); if (lbl) lbl.textContent = cmMonth;
    cmSyncPop();
    const mp = A.MONTH_PTS[cmMonth] || {};
    const arr = Object.entries(mp).filter(([, v]) => +v > 0).sort((a, b) => b[1] - a[1]);
    const nameOf = pid => (A.LB.find(r => r.pid === +pid) || {}).name || '\u2014';
    const foot = $('#cm-foot'), vd = $('#cm-void'), old = $('#ch-cmd-line');
    if (arr.length){
      /* \u06a9\u0627\u0646\u0648\u0627\u0633 \u062a\u0627\u0632\u0647 \u0633\u0627\u062e\u062a\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f \u062a\u0627 \u0627\u0646\u06cc\u0645\u06cc\u0634\u0646 \u0645\u0627\u0647 \u0642\u0628\u0644 \u0631\u0648\u06cc \u0647\u0645\u06cc\u0646 \u0628\u0648\u0645 \u0627\u062f\u0627\u0645\u0647 \u067e\u06cc\u062f\u0627 \u0646\u06a9\u0646\u062f */
      const cv = document.createElement('canvas'); cv.id = 'ch-cmd-line';
      if (old) old.replaceWith(cv); else box.insertBefore(cv, box.firstChild);
      if (vd) vd.hidden = true;
      const names = arr.map(([pid]) => nameOf(pid));
      Charts.barsV(cv, names, arr.map(([, v]) => v), { color:'#E9C766', showVal:true, fmt:v=>D.faNum(Math.round(v),0), valFmt:v=>D.faNum(Math.round(v),0) });
      const tot = arr.reduce((a, [, v]) => a + v, 0);
      const none = A.LB.map(r => r.name).filter(n => names.indexOf(n) < 0);
      if (foot) foot.innerHTML = `<b style="color:var(--gold-l)">\u0645\u062c\u0645\u0648\u0639 ${esc(cmMonth)}: ${D.faNum(tot,0)} \u0627\u0645\u062a\u06cc\u0627\u0632</b> \u2014 ${D.fa(names.length)} \u0628\u0627\u0632\u06cc\u06a9\u0646 \u0627\u0645\u062a\u06cc\u0627\u0632 \u06af\u0631\u0641\u062a\u0646\u062f` +
        (none.length ? ` \u2022 \u0628\u062f\u0648\u0646 \u0627\u0645\u062a\u06cc\u0627\u0632 \u062f\u0631 \u0627\u06cc\u0646 \u0645\u0627\u0647: <span style="color:var(--dim)">${none.map(esc).join('\u060c ')}</span>` : '');
    } else {
      if (old) old.remove();
      if (vd){ vd.hidden = false; vd.innerHTML = `\u0628\u0631\u0627\u06cc \u0645\u0627\u0647 <b style="color:var(--white)">${esc(cmMonth)}</b> \u0647\u0646\u0648\u0632 \u0627\u0645\u062a\u06cc\u0627\u0632\u06cc \u062b\u0628\u062a \u0646\u0634\u062f\u0647 \u0627\u0633\u062a \u2014 \u0627\u0632 \u067e\u0627\u067e\u200c\u0622\u067e \u0628\u0627\u0644\u0627 \u0645\u0627\u0647 \u062f\u06cc\u06af\u0631\u06cc \u0631\u0627 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u06cc\u062f`; }
      if (foot) foot.innerHTML = '';
    }
  }
  function cmdMonthInit(){
    const btn = $('#cm-pick');
    if (btn && !btn.dataset.bound){
      btn.dataset.bound = '1';
      btn.addEventListener('click', e => { e.preventDefault(); const p = $('#cm-pop'); if (!p) return; if (p.hidden) cmOpenPop(); else cmClosePop(); });
    }
    const pop = $('#cm-pop');
    if (pop && !pop.dataset.bound){
      pop.dataset.bound = '1';
      pop.addEventListener('click', e => {
        const b = e.target && e.target.closest ? e.target.closest('[data-cm]') : null;
        if (!b) return;
        const m = D.MONTHS_FA[+b.dataset.cm];
        if (m){ cmMonth = m; cmClosePop(); renderCmdMonth(); }
      });
    }
    renderCmdMonth();
  }
"""

WIRE_OLD = """      if (MGMT.getSettings().chMonthly){
        drawMonthlyChart();
      } else {
        const c = $('#cm-chart');
        if (c) c.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:12.5px">\u0646\u0645\u0648\u062f\u0627\u0631 \u0645\u0627\u0647\u0627\u0646\u0647 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062a \u2014 \u0627\u0632 ${esc(L('nav.settings','\u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u0646\u0645\u0627\u06cc\u0634'))} \u0641\u0639\u0627\u0644 \u06a9\u0646\u06cc\u062f</div>`;
      }
"""

WIRE_NEW = """      if (MGMT.getSettings().chMonthly){
        cmdMonthInit();
      } else {
        const c = $('#cm-chart');
        const pick = $('#cm-pick');
        if (pick) pick.style.display = 'none';
        if (c) c.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:12.5px">\u0646\u0645\u0648\u062f\u0627\u0631 \u0645\u0627\u0647\u0627\u0646\u0647 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062a \u2014 \u0627\u0632 ${esc(L('nav.settings','\u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u0646\u0645\u0627\u06cc\u0634'))} \u0641\u0639\u0627\u0644 \u06a9\u0646\u06cc\u062f</div>`;
      }
"""

APPLY_OLD = """      const apply = $('#cm-apply');
      if (apply){
        apply.addEventListener('click', () => drawMonthlyChart());
      }
"""


def apply_all():
    # CSS
    cssp = ROOT / 'source/css/style.css'
    css = read(cssp)
    if MARKER in css:
        SKIPPED.append('source/css/style.css ← بلوک استایل پاپ‌آپ ماه (از قبل)')
    else:
        write(cssp, css.rstrip('\n') + '\n' + CSS_BLOCK)
        CHANGED.append('source/css/style.css ← بلوک استایل پاپ‌آپ ماه')

    edit('source/js/data.js', [
        ('چهار فاز فصل + مجموع هر فاز', 'PHASE_TOT', DATA_OLD, DATA_NEW),
        ('خروجی aggregate فازها', 'PHASE_TOT, PHASE_ORDER,', DATA_EXPORT_OLD, DATA_EXPORT_NEW),
    ])
    edit('source/js/app.js', [
        ('پیش‌فرض ماه جاری', MARKER + ' — پیش', CMD_HEAD_OLD, CMD_HEAD_NEW),
        ('کارت قهرمانان فازها', 'PHASE_ORDER', PHASE_OLD, PHASE_NEW),
        ('دکمهٔ پاپ‌آپ انتخاب ماه', 'cm-pick', MONTH_OLD, MONTH_NEW),
        ('بدنهٔ کارت ماهانه + پاپ‌آپ ماه‌ها', 'cm-pop', CHART_OLD, CHART_NEW),
        ('موتور کارت ماهانه', 'renderCmdMonth', RENDER_OLD, RENDER_NEW),
        ('سیم‌کشی کارت ماهانه', 'cmdMonthInit();', WIRE_OLD, WIRE_NEW),
        ('حذف دکمهٔ «نمایش»', '@absent@', APPLY_OLD, ''),
    ])


def verify():
    print('\n── بررسی کد منبع ──')
    bad = 0
    app = read(ROOT / 'source/js/app.js')
    dat = read(ROOT / 'source/js/data.js')
    css = read(ROOT / 'source/css/style.css')
    checks = [
        (ROOT / 'source/css/style.css', css, '.cm-pop{position:absolute', 'استایل پاپ‌آپ ماه'),
        (ROOT / 'source/css/style.css', css, '.cm-m.on{', 'حالت ماه انتخاب‌شده'),
        (ROOT / 'source/css/style.css', css, '.cm-void{', 'حالت ماه بدون داده'),
        (ROOT / 'source/js/data.js', dat, "'\u067e\u0627\u06cc\u06cc\u0632': ['\u0645\u0647\u0631','\u0622\u0628\u0627\u0646','\u0622\u0630\u0631']", 'فاز پاییز اضافه شد'),
        (ROOT / 'source/js/data.js', dat, "'\u0632\u0645\u0633\u062a\u0627\u0646': ['\u062f\u06cc','\u0628\u0647\u0645\u0646','\u0627\u0633\u0641\u0646\u062f']", 'فاز زمستان اضافه شد'),
        (ROOT / 'source/js/data.js', dat, 'PHASE_TOT[ph] = Object.values(acc).reduce((a,b) => a + b, 0);', 'مجموع امتیاز هر فاز'),
        (ROOT / 'source/js/data.js', dat, 'PHASE_TOT, PHASE_ORDER,', 'خروجی aggregate فازها'),
        (ROOT / 'source/js/app.js', app, 'cmMonth = D.jalaliInfo(D.now()).monthFa;', 'پیش‌فرض ماه جاری'),
        (ROOT / 'source/js/app.js', app, '\u0645\u062c\u0645\u0648\u0639: ${D.faNum(tot,0)} \u0627\u0645\u062a\u06cc\u0627\u0632', 'نمایش مجموع هر فاز'),
        (ROOT / 'source/js/app.js', app, 'id="cm-pick"', 'دکمهٔ باز کردن پاپ‌آپ ماه'),
        (ROOT / 'source/js/app.js', app, 'data-cm="${i}"', 'دوازده دکمهٔ ماه'),
        (ROOT / 'source/js/app.js', app, 'function renderCmdMonth(){', 'موتور کارت ماهانه'),
        (ROOT / 'source/js/app.js', app, 'function cmdMonthInit(){', 'سیم‌کشی پاپ‌آپ'),
        (ROOT / 'source/js/app.js', app, 'cmdMonthInit();', 'فراخوانی در رندر صفحه'),
    ]
    for _, txt, needle, label in checks:
        ok = needle in txt
        print('  %s %-40s %s' % ('\u2705' if ok else '\u274c', label, str(_).replace(str(ROOT), '').lstrip('/')))
        bad += 0 if ok else 1
    gone = ['drawMonthlyChart', 'cm-apply', 'id="cm-month"']
    for g in gone:
        ok = g not in app
        print('  %s %-40s %s' % ('\u2705' if ok else '\u274c', 'حذف مورد قدیمی: ' + g, 'source/js/app.js'))
        bad += 0 if ok else 1
    ok = '\u200c\u200c' not in app and '\u200c\u200c' not in dat
    print('  %s %-40s %s' % ('\u2705' if ok else '\u274c', 'نیم‌فاصلهٔ تکراری وجود ندارد', 'source/js'))
    bad += 0 if ok else 1
    for rel in ['source/js/data.js', 'source/js/app.js']:
        r = subprocess.run(['node', '--check', str(ROOT / rel)], capture_output=True, text=True)
        ok = r.returncode == 0
        print('  %s نحو %s' % ('\u2705' if ok else '\u274c', rel))
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
        print('\u274c خروجی بیلد ساخته نشد')
        return 1
    shutil.copyfile(src_html, ROOT / 'GolfAcademy_PRO.html')
    out = ROOT / 'GolfAcademy_PRO.html'
    panel = read(out)
    print('  \u2705 GolfAcademy_PRO.html کپی شد (%d بایت) md5=%s' % (out.stat().st_size, hashlib.md5(panel.encode()).hexdigest()))
    bad = 0
    for needle, label in [(MARKER, 'نشانهٔ نسخه'),
                          ('.cm-pop{position:absolute', 'استایل پاپ‌آپ ماه'),
                          ("'\u067e\u0627\u06cc\u06cc\u0632': ['\u0645\u0647\u0631'", 'فاز پاییز'),
                          ('PHASE_TOT[ph] =', 'مجموع هر فاز'),
                          ('id="cm-pick"', 'دکمهٔ پاپ‌آپ ماه'),
                          ('function renderCmdMonth(){', 'موتور کارت ماهانه'),
                          ('function cmdMonthInit(){', 'سیم‌کشی پاپ‌آپ')]:
        ok = needle in panel
        print('  %s باندل پنل: %s' % ('\u2705' if ok else '\u274c', label))
        bad += 0 if ok else 1
    ok_old = ('id="cm-month"' not in panel) and ('cm-apply' not in panel) and ('function drawMonthlyChart' not in panel)
    print('  %s باندل پنل: انتخابگر قدیمی ماه حذف شده' % ('\u2705' if ok_old else '\u274c'))
    bad += 0 if ok_old else 1
    return 1 if bad else 0


if __name__ == '__main__':
    print('\u2550\u2550\u2550 %s \u2550\u2550\u2550' % MARKER)
    apply_all()
    print('\nاِعمال تغییرات:')
    for c in CHANGED:
        print('  \uff0b', c)
    for s in SKIPPED:
        print('  =', s, '(از قبل)')
    if ERRORS:
        print('\n\u274c خطاها:')
        for e in ERRORS:
            print('  ', e)
        sys.exit(2)
    print('\nبررسی‌ها:')
    bad = verify()
    if bad:
        print('\n\u274c %d بررسی شکست خورد' % bad)
        sys.exit(3)
    print('\n\u2705 همهٔ بررسی‌ها سالم')
    if '--build' in sys.argv:
        sys.exit(build())
    print('\n(برای بیلد: --build)')
