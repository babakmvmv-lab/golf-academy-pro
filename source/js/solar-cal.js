/* ═══════════════════════════════════════════════════════════════════════
   SolarCal — تقویم شمسی خودکفا (بدون هیچ وابستگی)   ·  CAL_EVERYWHERE_V1
   ───────────────────────────────────────────────────────────────────────
   هفته از «شنبه» شروع می‌شود و به «جمعه» ختم می‌شود؛ ستون جمعه به‌عنوان
   پایان هفته با رنگ متمایز نشان داده می‌شود.

   استفاده:
     SolarCal.attach(inputElement, { digits:'fa'|'en', onPick(iso,jalali) })
     SolarCal.attachAll(root, 'input[data-solarcal]', { digits:'fa' })

   این فایل هم در سایت عمومی و هم در پنل فروشگاه استفاده می‌شود؛ موتور
   تبدیل همان الگوریتم jalaali-js است که در data.js پنل آکادمی هم به کار رفته.
   یک پاپ‌آپ یگانه بین همهٔ فیلدها مشترک است (حافظه و DOM تمیز می‌ماند).
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if (window.SolarCal) return;

  /* ── موتور تبدیل تاریخ (jalaali-js) ── */
  function div(a, b){ return ~~(a / b); }
  function jalCal(jy){
    const breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
    const bl = breaks.length, gy = jy + 621;
    let leapJ = -14, jp = breaks[0], jm, jump = 0, leap, leapG, march, n, i;
    for (i = 1; i < bl; i += 1){
      jm = breaks[i]; jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(jump % 33, 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div((n % 33) + 3, 4);
    if (jump % 33 === 4 && jump % 4 === 0) leapJ += 1;
    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = ((((n + 1) % 33) - 1) % 4) === -1;
    if (leap) leap = ((n + 1) % 33) === 4;
    return { leap: leap, gy: gy, march: march };
  }
  function g2d(gy, gm, gd){
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * ((gm + 9) % 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }
  function d2g(jdn){
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div((j % 1461), 4) * 5 + 308;
    const gd = div(i % 153, 5) + 1;
    const gm = div(i, 153) % 12 + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return [gy, gm, gd];
  }
  function d2j(jdn){
    const gy = d2g(jdn)[0];
    let jy = gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f, jm, jd;
    if (k >= 0){
      if (k <= 185){ jm = div(k, 31) + 1; jd = k % 31 + 1; }
      else { k -= 186; jm = 7 + div(k, 30); jd = k % 30 + 1; }
    } else {
      jy -= 1; k += 179;
      if (r.leap) k += 1;
      jm = 7 + div(k, 30); jd = k % 30 + 1;
    }
    return [jy, jm, jd];
  }
  function j2d(jy, jm, jd){
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }
  function toJalaali(gy, gm, gd){ return (function(a){ return { y: a[0], m: a[1], d: a[2] }; })(d2j(g2d(gy, gm, gd))); }
  function toGregorian(jy, jm, jd){ return d2g(j2d(jy, jm, jd)); }
  function monthLen(jy, jm){
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return jalCal(jy).leap ? 30 : 29;
  }
  function todayJ(){ const n = new Date(); return toJalaali(n.getFullYear(), n.getMonth() + 1, n.getDate()); }
  function weekdayIdx(jy, jm, jd){
    const g = toGregorian(jy, jm, jd);
    return (new Date(Date.UTC(g[0], g[1] - 1, g[2])).getUTCDay() + 1) % 7;   /* شنبه = ۰ */
  }

  const WD = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];   /* شنبه … جمعه */
  const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const FA = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' };
  const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const ascii = s => String(s == null ? '' : s).replace(/[۰-۹]/g, c => FA[c]);
  function parseJalali(s){
    const t = ascii(s).trim().replace(/[.\-\s]/g, '/');
    const m = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return null;
    const jy = +m[1], jm = +m[2], jd = +m[3];
    if (jy < 1300 || jy > 1450 || jm < 1 || jm > 12 || jd < 1 || jd > monthLen(jy, jm)) return null;
    return { y: jy, m: jm, d: jd };
  }

  /* ── استایل (یک‌بار) ── */
  let styled = false;
  function style(){
    if (styled || typeof document === 'undefined') return;
    styled = true;
    const el = document.createElement('style');
    el.id = 'solarcal-style';
    el.textContent =
      '.sc-wrap{display:flex;gap:6px;align-items:center;min-width:0;width:100%}' +
      '.sc-wrap>input{flex:1;min-width:0}' +
      '.sc-btn{width:38px;height:38px;flex:0 0 38px;display:flex;align-items:center;justify-content:center;' +
        'cursor:pointer;background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.35);border-radius:10px;' +
        'font-size:16px;line-height:1;transition:.18s;padding:0;color:#e3c98f}' +
      '.sc-btn:hover{background:rgba(212,175,55,.28)}' +
      '.sc-btn[aria-expanded="true"]{background:rgba(212,175,55,.34);border-color:rgba(212,175,55,.7)}' +
      '.sc-pop{position:fixed;z-index:2147483000;direction:rtl;width:290px;max-width:calc(100vw - 20px);' +
        'background:#0d1520;border:1px solid rgba(212,175,55,.38);border-radius:14px;padding:13px;' +
        'box-shadow:0 18px 55px rgba(0,0,0,.7);font:12px/1.7 Vazirmatn,Tahoma,sans-serif;color:#e9eff6}' +
      '.sc-pop[hidden]{display:none}' +
      '.sc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}' +
      '.sc-title{flex:1;text-align:center;font-size:13px;font-weight:800;color:#f3d779}' +
      '.sc-nav{width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;' +
        'background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.3);border-radius:9px;' +
        'color:#f3d779;font-size:15px;line-height:1;user-select:none;transition:.15s}' +
      '.sc-nav:hover{background:rgba(212,175,55,.26)}' +
      '.sc-wd,.sc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}' +
      '.sc-wd{margin-bottom:5px}' +
      '.sc-wd span{font-size:10px;font-weight:800;color:#9aa7b5;text-align:center;padding:2px 0;border-radius:6px}' +
      '.sc-wd span.we{color:#e8b083;background:rgba(232,176,131,.12)}' +
      '.sc-d{height:32px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;' +
        'border-radius:9px;cursor:pointer;border:1px solid transparent;color:#e9eff6;' +
        'background:rgba(255,255,255,.035);transition:.12s}' +
      '.sc-d:hover{background:rgba(212,175,55,.22);border-color:rgba(212,175,55,.45)}' +
      '.sc-d.we{color:#e8b083;background:rgba(232,176,131,.07)}' +
      '.sc-d.today{border-color:rgba(30,187,138,.6);color:#8fe0b0}' +
      '.sc-d.sel{background:linear-gradient(135deg,#d4af37,#b08a28);color:#1a1407;font-weight:900;border-color:transparent}' +
      '.sc-d.empty{background:transparent;cursor:default;pointer-events:none;border-color:transparent}' +
      '.sc-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;' +
        'border-top:1px solid rgba(212,175,55,.16);padding-top:9px}' +
      '.sc-today{font-size:11px;font-weight:700;color:#8fe0b0;cursor:pointer;background:rgba(30,187,138,.1);' +
        'border:1px solid rgba(30,187,138,.35);border-radius:8px;padding:4px 10px}' +
      '.sc-val{font-size:11px;color:#93aa9c}' +
      '.sc-sep{display:flex;align-items:center;gap:8px;margin:9px 0 0;color:#93aa9c;font-size:10px}' +
      '.sc-sep::before,.sc-sep::after{content:"";flex:1;height:1px;background:rgba(212,175,55,.16)}';
    (document.head || document.documentElement).appendChild(el);
  }

  /* ── پاپ‌آپ یگانه (بین همهٔ فیلدها مشترک) ── */
  let POP = null, CTX = null, bound = false;

  function ensurePop(){
    if (POP && POP.isConnected) return POP;
    const pop = document.createElement('div');
    pop.className = 'sc-pop';
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'تقویم شمسی');
    pop.innerHTML =
      '<div class="sc-head">' +
        '<div class="sc-nav" data-nav="-1" title="ماه قبل" role="button" aria-label="ماه قبل">‹</div>' +
        '<div class="sc-title"></div>' +
        '<div class="sc-nav" data-nav="1" title="ماه بعد" role="button" aria-label="ماه بعد">›</div>' +
      '</div>' +
      '<div class="sc-wd">' + WD.map((w, i) => '<span class="' + (i === 6 ? 'we' : '') + '">' + w + '</span>').join('') + '</div>' +
      '<div class="sc-grid"></div>' +
      '<div class="sc-sep">پایان هفته: جمعه</div>' +
      '<div class="sc-foot"><span class="sc-val"></span><button type="button" class="sc-today">امروز</button></div>';
    document.body.appendChild(pop);
    POP = pop;
    pop.querySelector('.sc-grid').addEventListener('click', onDayClick);
    pop.querySelector('.sc-grid').addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('sc-d')) e.target.click();
    });
    pop.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => shift(+b.dataset.nav)));
    pop.querySelector('.sc-today').addEventListener('click', pickToday);
    return pop;
  }

  function fmt(j){
    const dg = (CTX && CTX.opts.digits) || 'fa';
    return dg === 'en'
      ? (j.y + '/' + String(j.m).padStart(2, '0') + '/' + String(j.d).padStart(2, '0'))
      : fa(j.y) + '/' + fa(String(j.m).padStart(2, '0')) + '/' + fa(String(j.d).padStart(2, '0'));
  }

  function render(){
    if (!CTX) return;
    const pop = POP, t = todayJ();
    const n = monthLen(CTX.vy, CTX.vm);
    const off = weekdayIdx(CTX.vy, CTX.vm, 1);
    pop.querySelector('.sc-title').textContent = MONTHS[CTX.vm - 1] + ' ' + fa(CTX.vy);
    let h = '';
    for (let i = 0; i < off; i++) h += '<div class="sc-d empty"></div>';
    for (let d = 1; d <= n; d++){
      const col = (off + d - 1) % 7;                       /* ۶ = جمعه، پایان هفته */
      const cls = ['sc-d'];
      if (col === 6) cls.push('we');
      if (CTX.vy === t.y && CTX.vm === t.m && d === t.d) cls.push('today');
      if (CTX.vy === CTX.sel.y && CTX.vm === CTX.sel.m && d === CTX.sel.d) cls.push('sel');
      h += '<div class="' + cls.join(' ') + '" data-d="' + d + '" role="button" tabindex="0">' + fa(d) + '</div>';
    }
    pop.querySelector('.sc-grid').innerHTML = h;
    pop.querySelector('.sc-val').textContent = fmt(CTX.sel) + '  —  ' + MONTHS[CTX.sel.m - 1];
  }

  function place(){
    if (!CTX || !POP) return;
    const r = CTX.input.getBoundingClientRect();
    const W = 290, H = POP.offsetHeight || 340;
    let top = r.bottom + 6;
    if (top + H > window.innerHeight - 8) top = Math.max(8, r.top - H - 6);
    let left = r.left;
    if (left + W > window.innerWidth - 8) left = Math.max(8, window.innerWidth - W - 8);
    POP.style.top = Math.round(top) + 'px';
    POP.style.left = Math.round(left) + 'px';
    POP.style.width = W + 'px';
  }

  function fire(){
    const input = CTX.input;
    input.value = fmt(CTX.sel);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const g = toGregorian(CTX.sel.y, CTX.sel.m, CTX.sel.d);
    const iso = g[0] + '-' + String(g[1]).padStart(2, '0') + '-' + String(g[2]).padStart(2, '0');
    if (typeof CTX.opts.onPick === 'function'){ try{ CTX.opts.onPick(iso, CTX.sel); }catch(e){} }
  }

  function onDayClick(e){
    const c = e.target.closest && e.target.closest('.sc-d');
    if (!c || c.classList.contains('empty') || !CTX) return;
    CTX.sel = { y: CTX.vy, m: CTX.vm, d: +c.dataset.d };
    fire();
    close();
  }
  function pickToday(){
    if (!CTX) return;
    const t = todayJ();
    CTX.vy = CTX.sel.y = t.y; CTX.vm = CTX.sel.m = t.m; CTX.sel.d = t.d;
    fire();
    close();
  }
  function shift(dir){
    if (!CTX) return;
    CTX.vm += dir;
    if (CTX.vm < 1){ CTX.vm = 12; CTX.vy--; }
    if (CTX.vm > 12){ CTX.vm = 1; CTX.vy++; }
    render();
  }

  function open(ctx){
    ensurePop();
    CTX = ctx;
    const parsed = parseJalali(ctx.input.value);
    ctx.sel = parsed || todayJ();
    ctx.vy = ctx.sel.y; ctx.vm = ctx.sel.m;
    if (ctx.btn) ctx.btn.setAttribute('aria-expanded', 'true');
    POP.hidden = false;
    render();
    place();
  }
  function close(){
    if (POP){ POP.hidden = true; }
    if (CTX && CTX.btn) CTX.btn.setAttribute('aria-expanded', 'false');
    CTX = null;
  }
  function isOpen(){ return !!(POP && !POP.hidden && CTX); }

  function bindGlobal(){
    if (bound) return;
    bound = true;
    /* Escape در فاز capture گرفته می‌شود تا مودالِ میزبان بسته نشود */
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !isOpen()) return;
      e.preventDefault();
      e.stopPropagation();
      close();
    }, true);
    document.addEventListener('pointerdown', e => {
      if (!isOpen()) return;
      if (POP.contains(e.target)) return;
      if (CTX.wrap && CTX.wrap.contains(e.target)) return;
      close();
    }, true);
    window.addEventListener('resize', () => { if (isOpen()) place(); });
    window.addEventListener('scroll', () => { if (isOpen()) place(); }, true);
  }

  /* ── اتصال به یک ورودی ── */
  function attach(input, opts){
    if (!input || input.__solarcal || input.tagName !== 'INPUT') return;
    opts = opts || {};
    style();
    bindGlobal();
    input.__solarcal = true;

    /* دکمه کنار ورودی، بدون آسیب به ساختار فرم (نام‌ها و data-* دست‌نخورده می‌مانند) */
    const wrap = document.createElement('span');
    wrap.className = 'sc-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sc-btn';
    btn.title = 'انتخاب تاریخ از تقویم شمسی';
    btn.setAttribute('aria-label', 'انتخاب تاریخ از تقویم شمسی');
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '📅';
    wrap.appendChild(btn);

    const ctx = { input: input, opts: opts, wrap: wrap, btn: btn, sel: null, vy: 0, vm: 0 };
    btn.addEventListener('mousedown', e => e.preventDefault());
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (isOpen() && CTX && CTX.input === input) close();
      else open(ctx);
    });
    input.__solarcalOpen = () => open(ctx);
    return ctx;
  }

  /* ── اتصال گروهی ── */
  function attachAll(root, selector, opts){
    const r = root || document;
    let n = 0;
    r.querySelectorAll(selector || 'input[data-solarcal]').forEach(el => {
      if (el.tagName === 'INPUT' && !el.__solarcal && !el.disabled && !el.readOnly){
        attach(el, opts || (el.dataset.digits ? { digits: el.dataset.digits } : null));
        n++;
      }
    });
    return n;
  }

  window.SolarCal = {
    attach: attach,
    attachAll: attachAll,
    close: close,
    isOpen: isOpen,
    toJalaali: toJalaali,
    toGregorian: toGregorian,
    monthLen: monthLen,
    parse: parseJalali,
    today: todayJ,
    fa: fa,
    WD: WD
  };
})();
