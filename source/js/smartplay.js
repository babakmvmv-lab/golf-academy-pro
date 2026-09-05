/* ═══════════════════════════════════════════════════════════════════
   GolfAcademy PRO — بازیکن هوشمند: ماژول «ثبت رکورد»
   ─────────────────────────────────────────────────────────────────────
   • جلسهٔ تمرین (Session) تا زدن «بستن جلسه تمرینی» باز می‌ماند —
     حتی با خروج از برنامه یا سوارشدن از دستگاه دیگر (همگام ابری ga_*).
   • هر کلیک روی «ثبت رکورد» وارد همان جلسهٔ باز می‌شود.
   • ورود ضربه موبایل‌محور: بازیکن ← کلاب ← یارد ← نتیجه ← ثبت (auto-advance)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LS_SES = 'ga_sp_sessions', LS_SHOTS = 'ga_sp_shots';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function read(k, d) { try { var s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function sessions() { return read(LS_SES, {}); }
  function allShots() { return read(LS_SHOTS, []); }
  function openSession() {
    var ss = sessions(), ks = Object.keys(ss);
    for (var i = 0; i < ks.length; i++) if (ss[ks[i]] && ss[ks[i]].status === 'open') return ss[ks[i]];
    return null;
  }
  function shotsOf(sid) { return allShots().filter(function (x) { return x.sid === sid; }); }
  function saveSessions(o) { write(LS_SES, o); }
  function saveShots(a) { write(LS_SHOTS, a); }

  var TYPES = ['Range', 'Putting', 'Chipping', 'Approach', 'On-Course'];
  var TYPE_FA = { Range: 'رنج', Putting: 'پاتینگ', Chipping: 'چیپینگ', Approach: 'اپروچ', 'On-Course': 'روی زمین' };
  var CLUBS = {
    'Range':      ['Driver', '3 Wood', '5 Wood', 'Hybrid', 'Iron 3', 'Iron 4', 'Iron 5', 'Iron 6', 'Iron 7', 'Iron 8', 'Iron 9', 'Pitching Wedge', 'Gap Wedge', 'Sand Wedge', 'Lob Wedge'],
    'Putting':    ['Putter'],
    'Chipping':   ['Pitching Wedge', 'Gap Wedge', 'Sand Wedge', 'Lob Wedge', 'Iron 9', 'Iron 8', 'Iron 7'],
    'Approach':   ['Iron 7', 'Iron 8', 'Iron 9', 'Pitching Wedge', 'Gap Wedge', 'Sand Wedge', 'Lob Wedge'],
    'On-Course':  ['Driver', '3 Wood', '5 Wood', 'Hybrid', 'Iron 3', 'Iron 4', 'Iron 5', 'Iron 6', 'Iron 7', 'Iron 8', 'Iron 9', 'Pitching Wedge', 'Gap Wedge', 'Sand Wedge', 'Lob Wedge', 'Putter']
  };
  var RESULTS = [
    ['straight', 'صاف', 'Straight', '#1EBB8A'],
    ['slice',    'سمت راست', 'Slice', '#2E86DE'],
    ['hook',     'سمت چپ', 'Hook', '#E67E22'],
    ['miss',     'ضربه خراب', 'Miss Hit', '#E74C3C']
  ];

  /* ── ابزار ── */
  var ctx = null;
  function fa(n) {
    try { if (ctx && ctx.D && ctx.D.fa) return ctx.D.fa(n); } catch (e) { }
    return String(n).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; });
  }
  function toast(m, kind) { try { if (window.APP && APP.toast) APP.toast(m, kind || 'green'); } catch (e) { } }
  function clockFa(iso) { try { var d = new Date(iso); return fa(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')); } catch (e) { return ''; } }

  /* اطلاعات پروفایل بازیکن — دوباره وارد نمی‌شود؛ از دیتابیس خوانده می‌شود */
  function playerByPid(pid) {
    var list = (ctx && ctx.A && ctx.A.LB) || [];
    for (var i = 0; i < list.length; i++) if (list[i].pid === pid) return list[i];
    return null;
  }
  function playerMeta(pid) {
    var meta = { hcp: '—', gender: '—', age: '—' };
    var pls = (ctx && ctx.S && ctx.S.players) || [];
    var i;
    for (i = 0; i < pls.length; i++) if (pls[i][0] === pid) { meta.hcp = pls[i][3]; meta.gender = pls[i][2] || '—'; break; }
    var edits = read('ga_players', {});
    var e = edits[pid];
    if (!e) { Object.keys(edits).forEach(function (k) { var v = edits[k]; if (v && +v.id === +pid) e = v; }); }
    var b = e && e.birth;
    if (b) {
      var m = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/.exec(String(b));
      if (m) {
        var y = +m[1], nowY;
        if (y > 1900) { nowY = new Date().getFullYear(); meta.age = Math.max(0, nowY - y); }
        else {
          try {
            var todayFa = ctx.D.isoToShamsi(ctx.D.TODAY);
            nowY = +String(todayFa).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).split(/[\/\-]/)[0];
            meta.age = Math.max(0, nowY - y);
          } catch (err) { }
        }
      }
    }
    return meta;
  }

  /* ── وضعیت داخلی ماژول ── */
  var root = null;
  var view = 'home';                       // home | entry | summary
  var selType = 'Range', selDate = null;
  var step = 1, selPid = null, selClub = null, selYds = '', selRes = null;
  var sumSid = null, modal = null;

  function nextNo() {
    var ss = sessions(), mx = 0;
    Object.keys(ss).forEach(function (k) { if (ss[k] && ss[k].no > mx) mx = ss[k].no; });
    return mx + 1;
  }
  function todayFa() {
    try { return ctx.D.isoToShamsi(ctx.D.TODAY); } catch (e) { return ''; }
  }

  /* ══════════ هدر صفحهٔ مجزا: ✕ بستن صفحه + ⏹ بستن جلسه ══════════ */
  function pageHead(sub) {
    var ss = openSession();
    return '<div class="spk-head">'
      + '<button type="button" class="spk-x" id="spk-close" aria-label="بستن صفحه">'
      + '<svg class="si" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      + '</button>'
      + '<div class="spk-title">ثبت رکورد <small>' + esc(sub || '') + '</small></div>'
      + (ss ? '<button type="button" class="spk-end" id="spk-end">بستن جلسه تمرینی</button>' : '')
      + '</div>';
  }

  /* ══════════ خانهٔ ماژول: ساخت/ادامهٔ جلسه + تاریخچه ══════════ */
  function renderHome() {
    var ss = openSession();
    var no = nextNo();
    var tF = todayFa();
    var h = pageHead('مرکز تمرین');

    if (ss) {
      var sh = shotsOf(ss.id);
      var pids = {}; sh.forEach(function (s) { pids[s.pid] = 1; });
      h += '<div class="glass spk-resume">'
        + '<div class="spk-live"><span class="dot-live"></span> جلسهٔ باز است</div>'
        + '<h3>' + esc(TYPE_FA[ss.type] || ss.type) + ' — جلسه شماره ' + fa(ss.no) + '</h3>'
        + '<div class="spk-resume-meta">'
        + '<span>📅 ' + esc(ss.dateFa) + '</span>'
        + '<span>⏱️ شروع ' + clockFa(ss.createdAt) + '</span>'
        + '<span>🏌️ ' + fa(sh.length) + ' ضربه</span>'
        + '<span>👥 ' + fa(Object.keys(pids).length) + ' بازیکن</span>'
        + '</div>'
        + '<div class="spk-resume-btns">'
        + '<button type="button" class="btn spk-big" id="spk-go">ادامهٔ ثبت ضربه ←</button>'
        + '<button type="button" class="btn ghost" id="spk-end2">⏹ بستن جلسه تمرینی</button>'
        + '</div>'
        + '<div class="spk-note">تا زمانی که جلسه بسته نشود، هر بار که وارد «ثبت رکورد» شوید همین جلسه ادامه می‌یابد — حتی از دستگاه دیگر.</div>'
        + '</div>';
    } else {
      h += '<div class="glass spk-newses">'
        + '<div class="spk-sec-t">ایجاد جلسهٔ تمرین جدید</div>'
        + '<div class="spk-row"><span class="spk-lbl">شماره جلسه</span><span class="spk-no">جلسه شماره ' + fa(no) + '</span><span class="spk-auto">خودکار</span></div>'
        + '<div class="spk-lbl" style="margin-top:12px">نوع تمرین</div>'
        + '<div class="spk-types">' + TYPES.map(function (t) {
            return '<button type="button" class="spk-type' + (t === selType ? ' on' : '') + '" data-t="' + t + '">' + esc(TYPE_FA[t]) + '<small>' + esc(t) + '</small></button>';
          }).join('') + '</div>'
        + '<div class="spk-row" style="margin-top:12px"><span class="spk-lbl">تاریخ تمرین</span>'
        + '<input class="input spk-date" id="spk-date" value="' + esc(selDate || tF) + '" inputmode="numeric" aria-label="تاریخ تمرین"></div>'
        + '<button type="button" class="btn spk-big spk-start" id="spk-start">شروع جلسهٔ تمرین ⛳</button>'
        + '</div>';
    }

    /* تاریخچهٔ جلسات بسته */
    var closed = Object.keys(sessions()).map(function (k) { return sessions()[k]; })
      .filter(function (s) { return s.status === 'closed'; })
      .sort(function (a, b) { return (b.closedAt || '').localeCompare(a.closedAt || ''); });
    if (closed.length) {
      h += '<div class="spk-sec-t" style="margin:18px 4px 10px">تاریخچهٔ جلسات</div>'
        + closed.slice(0, 20).map(function (s) {
          var n = s.analysis ? s.analysis.totalShots : shotsOf(s.id).length;
          var pn = s.analysis ? s.analysis.playerCount : null;
          return '<button type="button" class="glass spk-hist" data-sid="' + s.id + '">'
            + '<b>جلسه ' + fa(s.no) + ' — ' + esc(TYPE_FA[s.type] || s.type) + '</b>'
            + '<span>' + esc(s.dateFa) + ' • ' + fa(n) + ' ضربه' + (pn != null ? ' • ' + fa(pn) + ' بازیکن' : '') + '</span>'
            + '<svg class="si" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>'
            + '</button>';
        }).join('');
    }

    root.innerHTML = h;
    bindCommon();
    var go = document.getElementById('spk-go');
    if (go) go.onclick = function () { enterEntry(); };
    var end2 = document.getElementById('spk-end2');
    if (end2) end2.onclick = function () { askEndSession(); };
    var start = document.getElementById('spk-start');
    if (start) start.onclick = startSession;
    Array.prototype.forEach.call(document.querySelectorAll('.spk-type'), function (b) {
      b.onclick = function () { selType = b.dataset.t; renderHome(); };
    });
    Array.prototype.forEach.call(document.querySelectorAll('.spk-hist'), function (b) {
      b.onclick = function () { sumSid = b.dataset.sid; view = 'summary'; route(); };
    });
  }

  function startSession() {
    var dInp = document.getElementById('spk-date');
    var ss = sessions();
    var id = 'ss' + Date.now().toString(36);
    ss[id] = { id: id, no: nextNo(), type: selType, dateFa: (dInp && dInp.value.trim()) || todayFa(), createdAt: new Date().toISOString(), closedAt: null, status: 'open', analysis: null };
    saveSessions(ss);
    toast('جلسه شماره ' + fa(ss[id].no) + ' (' + (TYPE_FA[selType]) + ') شروع شد — تا «بستن جلسه» باز می‌ماند', 'gold');
    enterEntry();
  }
  function enterEntry() {
    step = 1; selPid = null; selClub = null; selYds = ''; selRes = null;
    view = 'entry'; route();
  }

  /* ══════════ صفحهٔ ثبت ضربه (۵ مرحله، auto-advance) ══════════ */
  function entryShell(inner) {
    var ss = openSession();
    var sh = ss ? shotsOf(ss.id) : [];
    return pageHead(TYPE_FA[ss.type] || ss.type)
      + '<div class="spk-steps">' + [1, 2, 3, 4, 5].map(function (n) {
          return '<span class="spk-dot' + (n === step ? ' on' : n < step ? ' done' : '') + '">' + fa(n) + '</span>';
        }).join('') + '</div>'
      + inner
      + '<div class="spk-foot">'
      + '<span class="spk-chip">🏌️ ' + fa(sh.length) + ' ضربه در این جلسه</span>'
      + '<button type="button" class="spk-end" id="spk-end3">⏹ بستن جلسه تمرینی</button>'
      + '</div>';
  }
  function stepBack(target) { step = target; route(); }
  function backBtn(target, lbl) {
    return '<button type="button" class="spk-back" id="spk-back">‹ ' + esc(lbl || 'بازگشت') + '</button>';
  }

  function renderEntry() {
    var ss = openSession();
    if (!ss) { view = 'home'; return route(); }
    var h = '', i;

    if (step === 1) {
      /* مرحله ۱: انتخاب بازیکن — مرتب‌شده بر اساس آخرین استفاده (سرعت مربی) */
      var lastT = {};
      shotsOf(ss.id).forEach(function (s) { lastT[s.pid] = Math.max(lastT[s.pid] || 0, s.t); });
      var list = ((ctx.A && ctx.A.LB) || []).slice().sort(function (a, b) { return (lastT[b.pid] || 0) - (lastT[a.pid] || 0); });
      h = '<div class="spk-st">۱) بازیکن را انتخاب کنید</div>'
        + '<div class="spk-pgrid">' + list.map(function (p) {
            var mine = shotsOf(ss.id).filter(function (x) { return x.pid === p.pid; }).length;
            return '<button type="button" class="spk-pbtn" data-pid="' + p.pid + '">'
              + '<b>' + esc(p.name) + '</b>'
              + '<small>شناسه ' + fa(p.pid) + (mine ? ' • ' + fa(mine) + ' ضربه' : '') + '</small>'
              + '</button>';
          }).join('') + '</div>';
    }

    if (step === 2) {
      var p = playerByPid(selPid);
      var mt = playerMeta(selPid);
      /* بخش اول: پروفایل خودکار از دیتابیس — بدون ورود مجدد */
      h = backBtn(1, 'تغییر بازیکن')
        + '<div class="spk-banner">'
        + '<div><b>' + esc(p ? p.name : '') + '</b><small>شناسهٔ بازیکن: ' + fa(selPid) + '</small></div>'
        + '<div class="spk-meta"><span>سن: <b>' + esc(fa(mt.age)) + '</b></span><span>هندیکپ: <b>' + esc(fa(mt.hcp)) + '</b></span><span>' + esc(fa(mt.gender)) + '</span></div>'
        + '</div>'
        + '<div class="spk-st">۲) کلاب را انتخاب کنید</div>'
        + '<div class="spk-cgrid">' + (CLUBS[ss.type] || CLUBS.Range).map(function (c) {
            return '<button type="button" class="spk-cbtn' + (c === selClub ? ' on' : '') + '" data-c="' + esc(c) + '">' + esc(c) + '</button>';
          }).join('') + '</div>';
    }

    if (step === 3) {
      h = backBtn(2, 'تغییر کلاب')
        + entryMiniBanner()
        + '<div class="spk-st">۳) فاصله ضربه <small>(یارد — Yard)</small></div>'
        + '<div class="spk-ydsp"><b id="spk-num">' + (selYds ? fa(selYds) : '—') + '</b><span>یارد</span></div>'
        + '<div class="spk-pad">'
        + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button type="button" class="spk-key" data-k="' + n + '">' + fa(n) + '</button>'; }).join('')
        + '<button type="button" class="spk-key dim" data-k="C">پاک</button>'
        + '<button type="button" class="spk-key" data-k="0">' + fa(0) + '</button>'
        + '<button type="button" class="spk-key dim" data-k="B">⌫</button>'
        + '</div>'
        + '<button type="button" class="btn spk-big spk-start" id="spk-next" ' + (selYds ? '' : 'disabled') + '>بعدی ←</button>';
    }

    if (step === 4) {
      h = backBtn(3, 'تغییر فاصله')
        + entryMiniBanner()
        + '<div class="spk-st">۴) نتیجهٔ ضربه — فقط یک لمس</div>'
        + '<div class="spk-rgrid">' + RESULTS.map(function (r) {
            return '<button type="button" class="spk-rbtn" data-r="' + r[0] + '" style="--rc:' + r[3] + '">'
              + '<b>' + esc(r[1]) + '</b><small>' + esc(r[2]) + '</small></button>';
          }).join('') + '</div>';
    }

    if (step === 5) {
      var p5 = playerByPid(selPid);
      var rr = RESULTS.filter(function (x) { return x[0] === selRes; })[0];
      h = backBtn(4, 'تغییر نتیجه')
        + '<div class="spk-st">۵) تأیید و ثبت</div>'
        + '<div class="glass spk-sum">'
        + '<div class="spk-sum-row"><span>بازیکن</span><b>' + esc(p5 ? p5.name : '') + '</b></div>'
        + '<div class="spk-sum-row"><span>کلاب</span><b>' + esc(selClub) + '</b></div>'
        + '<div class="spk-sum-row"><span>فاصله</span><b>' + fa(selYds) + ' یارد</b></div>'
        + '<div class="spk-sum-row"><span>نتیجه</span><b style="color:' + rr[3] + '">' + esc(rr[1]) + ' (' + esc(rr[2]) + ')</b></div>'
        + '</div>'
        + '<button type="button" class="btn spk-big spk-save" id="spk-save">✓ ثبت ضربه</button>';
    }

    root.innerHTML = entryShell(h);
    bindCommon();

    if (step === 1) Array.prototype.forEach.call(document.querySelectorAll('.spk-pbtn'), function (b) {
      b.onclick = function () { selPid = +b.dataset.pid; selClub = null; selYds = ''; selRes = null; step = 2; route(); };
    });
    if (step === 2) Array.prototype.forEach.call(document.querySelectorAll('.spk-cbtn'), function (b) {
      b.onclick = function () { selClub = b.dataset.c; step = 3; route(); };
    });
    if (step === 3) {
      Array.prototype.forEach.call(document.querySelectorAll('.spk-key'), function (b) {
        b.onclick = function () {
          var k = b.dataset.k;
          if (k === 'C') selYds = '';
          else if (k === 'B') selYds = selYds.slice(0, -1);
          else if (selYds.length < 3) selYds += k;
          var d = document.getElementById('spk-num'), nx = document.getElementById('spk-next');
          if (d) d.textContent = selYds ? fa(selYds) : '—';
          if (nx) nx.disabled = !selYds;
        };
      });
      var nx2 = document.getElementById('spk-next');
      if (nx2) nx2.onclick = function () { if (selYds) { step = 4; route(); } };
    }
    if (step === 4) Array.prototype.forEach.call(document.querySelectorAll('.spk-rbtn'), function (b) {
      b.onclick = function () { selRes = b.dataset.r; step = 5; route(); };
    });
    if (step === 5) {
      var sv = document.getElementById('spk-save');
      if (sv) sv.onclick = saveShot;
    }
  }

  function entryMiniBanner() {
    var p = playerByPid(selPid), mt = playerMeta(selPid);
    return '<div class="spk-banner sm">'
      + '<div><b>' + esc(p ? p.name : '') + '</b><small>' + esc(selClub || '') + '</small></div>'
      + '<div class="spk-meta"><span>شناسه ' + fa(selPid) + '</span><span>سن ' + esc(fa(mt.age)) + '</span><span>هندیکپ ' + esc(fa(mt.hcp)) + '</span></div>'
      + '</div>';
  }

  function saveShot() {
    var ss = openSession(); if (!ss) return;
    var arr = allShots();
    arr.push({ sid: ss.id, pid: selPid, club: selClub, yds: +selYds, res: selRes, t: Date.now() });
    saveShots(arr);
    var mine = arr.filter(function (x) { return x.sid === ss.id && x.pid === selPid; }).length;
    var nm = (playerByPid(selPid) || {}).name || 'بازیکن';
    /* فرم خالی می‌شود و به منوی انتخاب بازیکن برمی‌گردد */
    selClub = null; selYds = ''; selRes = null; selPid = null; step = 1;
    toast('ضربه ' + fa(mine) + ' «' + nm + '» ثبت شد ✓', 'green');
    route();
  }

  /* ══════════ پایان جلسه + تحلیل ══════════ */
  function askEndSession() {
    var ss = openSession(); if (!ss) return;
    var n = shotsOf(ss.id).length;
    modal = document.createElement('div');
    modal.className = 'spk-modal';
    modal.innerHTML = '<div class="glass spk-modal-in">'
      + '<h3>بستن جلسهٔ تمرینی؟</h3>'
      + '<p>جلسه شماره ' + fa(ss.no) + ' (' + esc(TYPE_FA[ss.type] || ss.type) + ') با ' + fa(n) + ' ضربه بسته می‌شود و تحلیل نهایی انجام می‌گردد. بعد از بستن، رکورد جدید در این جلسه ثبت نمی‌شود.</p>'
      + '<div style="display:flex;gap:10px">'
      + '<button type="button" class="btn ghost" id="spk-cancel" style="flex:1">ادامهٔ تمرین</button>'
      + '<button type="button" class="btn spk-save" id="spk-confirm" style="flex:1.4">پایان و تحلیل ✓</button>'
      + '</div></div>';
    document.body.appendChild(modal);
    var c1 = document.getElementById('spk-cancel');
    if (c1) c1.onclick = closeModal;
    modal.onclick = function (e) { if (e.target === modal) closeModal(); };
    var c2 = document.getElementById('spk-confirm');
    if (c2) c2.onclick = function () {
      closeModal();
      finishSession(ss.id);
    };
  }
  function closeModal() { if (modal) { modal.parentNode.removeChild(modal); modal = null; } }

  function analyze(sid) {
    var sh = shotsOf(sid);
    var byP = {};
    sh.forEach(function (s) {
      var o = byP[s.pid] || (byP[s.pid] = { n: 0, straight: 0, best: null, clubs: {} });
      o.n++;
      if (s.res === 'straight') o.straight++;
      if (!o.best || s.yds > o.best.yds) o.best = s;
      var c = o.clubs[s.club] || (o.clubs[s.club] = { n: 0, sum: 0, max: 0, st: 0 });
      c.n++; c.sum += s.yds; if (s.yds > c.max) c.max = s.yds; if (s.res === 'straight') c.st++;
    });
    var pids = Object.keys(byP);
    return { byPlayer: byP, totalShots: sh.length, playerCount: pids.length,
      resCount: sh.reduce(function (a, s) { a[s.res] = (a[s.res] || 0) + 1; return a; }, {}) };
  }

  function finishSession(sid) {
    var ss = sessions(); var s = ss[sid]; if (!s) return;
    s.status = 'closed';
    s.closedAt = new Date().toISOString();
    s.analysis = analyze(sid);
    saveSessions(ss);
    sumSid = sid; view = 'summary';
    toast('جلسه بسته شد — تحلیل آماده است ✓', 'gold');
    route();
  }

  /* ══════════ صفحهٔ تحلیل / خلاصهٔ جلسه ══════════ */
  function renderSummary() {
    var s = sessions()[sumSid];
    if (!s) { view = 'home'; return route(); }
    var an = s.analysis || analyze(sumSid);
    var durMin = s.closedAt ? Math.max(0, Math.round((new Date(s.closedAt) - new Date(s.createdAt)) / 60000)) : null;
    var rc = an.resCount, tot = Math.max(1, an.totalShots);

    var h = pageHead('تحلیل جلسه');
    h += '<div class="glass spk-sumhero">'
      + '<h3>جلسه شماره ' + fa(s.no) + ' — ' + esc(TYPE_FA[s.type] || s.type) + '</h3>'
      + '<div class="spk-resume-meta">'
      + '<span>📅 ' + esc(s.dateFa) + '</span>'
      + '<span>🏌️ ' + fa(an.totalShots) + ' ضربه</span>'
      + '<span>👥 ' + fa(an.playerCount) + ' بازیکن</span>'
      + (durMin != null ? '<span>⏱️ ' + fa(durMin) + ' دقیقه</span>' : '')
      + '</div>'
      + '<div class="spk-dispbar" title="پراکندگی نتایج">'
      + RESULTS.map(function (r) {
          var w = Math.round(((rc[r[0]] || 0) / tot) * 100);
          return w ? '<span style="width:' + w + '%;background:' + r[3] + '"></span>' : '';
        }).join('')
      + '</div>'
      + '<div class="spk-displeg">' + RESULTS.map(function (r) {
          return '<span><i style="background:' + r[3] + '"></i>' + esc(r[1]) + ' ' + fa(Math.round(((rc[r[0]] || 0) / tot) * 100)) + '٪</span>';
        }).join('') + '</div>'
      + '</div>';

    Object.keys(an.byPlayer).forEach(function (pid) {
      var o = an.byPlayer[pid];
      var p = playerByPid(+pid);
      var stP = Math.round(o.straight / Math.max(1, o.n) * 100);
      var rows = Object.keys(o.clubs).sort(function (a, b) { return o.clubs[b].n - o.clubs[a].n; }).map(function (c) {
        var cc = o.clubs[c];
        return '<tr><td>' + esc(c) + '</td><td>' + fa(cc.n) + '</td><td>' + fa(Math.round(cc.sum / cc.n * 10) / 10) + '</td><td>' + fa(cc.max) + '</td><td>' + fa(Math.round(cc.st / cc.n * 100)) + '٪</td></tr>';
      }).join('');
      h += '<div class="glass spk-pcard">'
        + '<div class="spk-pcard-h"><b>' + esc(p ? p.name : 'بازیکن ' + fa(pid)) + '</b>'
        + '<div class="spk-pcard-kpi"><span>' + fa(o.n) + ' ضربه</span><span class="' + (stP >= 60 ? 'ok' : 'wr') + '">' + fa(stP) + '٪ صاف</span></div></div>'
        + (o.best ? '<div class="spk-best">🏆 بهترین ضربه: <b>' + fa(o.best.yds) + ' یارد</b> با ' + esc(o.best.club) + '</div>' : '')
        + '<table class="spk-tbl"><thead><tr><th>کلاب</th><th>تعداد</th><th>میانگین یارد</th><th>بیشینه</th><th>٪ صاف</th></tr></thead><tbody>' + rows + '</tbody></table>'
        + '</div>';
    });
    if (!an.totalShots) h += '<div class="glass" style="padding:24px;text-align:center;color:var(--muted)">در این جلسه ضربه‌ای ثبت نشده بود.</div>';
    h += '<div style="display:flex;gap:10px;margin-top:14px">'
      + '<button type="button" class="btn spk-save" id="spk-pdf" style="flex:1.5">📄 خروجی PDF گزارش</button>'
      + '<button type="button" class="btn ghost" id="spk-home" style="flex:1">بازگشت به مرکز تمرین</button>'
      + '</div>';

    root.innerHTML = h;
    bindCommon();
    var hm = document.getElementById('spk-home');
    if (hm) hm.onclick = function () { view = 'home'; route(); };
    /* خروجی PDF: حالت چاپِ سبک (سفید/خوانا روی کاغذ A4) روی همین گزارش فعال و سپس دیالوگ چاپ باز می‌شود */
    var pb = document.getElementById('spk-pdf');
    if (pb) pb.onclick = function () {
      var oldTitle = document.title;
      document.title = 'گزارش جلسهٔ تمرینی ' + fa(s.no) + ' — ' + (TYPE_FA[s.type] || s.type) + ' — ' + s.dateFa;
      document.body.classList.add('printing-report');
      var cleaned = false;
      var cleanup = function () {
        if (cleaned) return; cleaned = true;
        document.body.classList.remove('printing-report');
        document.title = oldTitle;
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      window.print();
      setTimeout(cleanup, 2500); /* fallback برای مرورگرهایی که afterprint نمی‌دهند */
    };
  }

  /* ══════════ موتور مسیریابی داخلی ══════════ */
  function bindCommon() {
    var x = document.getElementById('spk-close');
    if (x) x.onclick = function () { exit(); };
    var e1 = document.getElementById('spk-end');
    if (e1) e1.onclick = askEndSession;
    var e3 = document.getElementById('spk-end3');
    if (e3) e3.onclick = askEndSession;
    var b = document.getElementById('spk-back');
    if (b) b.onclick = function () { stepBack(Math.max(1, step - 1)); };
  }
  function exit() { closePage(); }

  /* ══════════ صفحهٔ تمام‌صفحهٔ مجزا (فقط ورود دیتا) ══════════ */
  var page = null;
  function openPage(context) {
    ctx = context || {};
    if (page && page.parentNode) page.parentNode.removeChild(page);
    page = document.createElement('div');
    page.id = 'spk-page';
    page.setAttribute('dir', 'rtl');
    page.setAttribute('role', 'dialog');
    page.setAttribute('aria-modal', 'true');
    page.setAttribute('aria-label', 'ثبت رکورد — ورود دادهٔ تمرین');
    page.innerHTML = '<div class="spk-wrap" id="spk-wrap"></div>';
    document.body.appendChild(page);
    try { document.body.style.overflow = 'hidden'; } catch (e) { }
    root = page.querySelector('#spk-wrap') || page;
    view = 'home';
    route();
  }
  function closePage() {
    if (page && page.parentNode) page.parentNode.removeChild(page);
    page = null; root = null;
    try { document.body.style.overflow = ''; } catch (e) { }
    if (ctx && ctx.onExit) ctx.onExit();
  }

  function route() {
    if (!root) return;
    if (view === 'entry') renderEntry();
    else if (view === 'summary') renderSummary();
    else renderHome();
    try { root.scrollIntoView({ block: 'start' }); } catch (e) { }
  }

  /* API عمومی */
  window.SMARTPLAY = {
    open: openPage,
    close: closePage,
    renderInto: function (el, context) { ctx = context || {}; root = el; view = 'home'; route(); },
    hasOpenSession: function () { return !!openSession(); }
  };
})();
