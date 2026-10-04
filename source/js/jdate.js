/* JDATE_CALENDAR_V1
   ═══════════════════════════════════════════════════════════════════
   JDate — کامپوننت ورود تاریخ شمسی (حرفه‌ای)
   انتخاب سال ← ماه ← روز با دراپ‌داون + ورود دستی + تبدیل خودکار
   مقدار داخلی همیشه ISO میلادی است (سازگار با موتور)، نمایش شمسی است.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  const D = window.Data;
  function fa(s){ return D.fa(s); }

  /* رندر یک ورودی شمسی داخل el.
     opts: { value (ISO miladi), onChange(iso), allowEmpty=true }
  */
  function render(el, opts){
    opts = opts || {};
    el.classList.add('jdate');
    el.innerHTML = `
      <div class="jdate-row">
        <input class="input jdate-manual" type="text" placeholder="۱۴۰۵/۰۶/۱۰" dir="rtl" autocomplete="off">
        <div class="jdate-cal-btn" title="باز کردن تقویم">📅</div>
      </div>
      <div class="jdate-pop" hidden>
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
        <div class="jdate-selects">
          <div class="jdate-field">
            <label>سال</label>
            <select class="sel jd-y"></select>
          </div>
          <div class="jdate-field">
            <label>ماه</label>
            <select class="sel jd-m"></select>
          </div>
          <div class="jdate-field">
            <label>روز</label>
            <select class="sel jd-d"></select>
          </div>
        </div>
        <div class="jdate-actions">
          <span class="jdate-result"></span>
          <button class="btn sm jd-ok">ثبت تاریخ</button>
          <button class="btn sm ghost jd-close">بستن</button>
        </div>
      </div>`;

    const manual = el.querySelector('.jdate-manual');
    const pop = el.querySelector('.jdate-pop');
    const sy = el.querySelector('.jd-y'), sm = el.querySelector('.jd-m'), sd = el.querySelector('.jd-d');
    const result = el.querySelector('.jdate-result');

    const YEARS = [];
    for (let y = 1300; y <= 1412; y++) YEARS.push(y);
    sy.innerHTML = YEARS.map(y => `<option value="${y}">${fa(y)}</option>`).join('');
    const MONTHS = D.MONTHS_FA;
    sm.innerHTML = MONTHS.map((m,i) => `<option value="${i+1}">${m}</option>`).join('');

    function daysIn(jy, jm){ if (jm <= 6) return 31; if (jm <= 11) return 30; const r = ((jy % 33) + 33) % 33; /* کبیسهٔ دقیق چرخهٔ ۳۳ساله جلالی: باقیماندهٔ ۱،۵،۹،۱۳،۱۷،۲۲،۲۶،۳۰ */ return [1,5,9,13,17,22,26,30].includes(r) ? 30 : 29; }

    function setDayOptions(keep){
      const jy = +sy.value, jm = +sm.value;
      const n = daysIn(jy, jm);
      let cur = +sd.value;
      sd.innerHTML = '';
      for (let d = 1; d <= n; d++){
        const o = document.createElement('option');
        o.value = d; o.textContent = fa(d);
        sd.appendChild(o);
      }
      if (keep && cur >= 1 && cur <= n) sd.value = cur;
      else sd.value = n;
    }
    /* ═══ هم‌گام‌سازی تاریخ دوم ═══
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

    function syncManual(){
      const jy = +sy.value, jm = +sm.value, jd = +sd.value;
      manual.value = jy + '/' + String(jm).padStart(2,'0') + '/' + String(jd).padStart(2,'0');
      const iso = D.shamsiToISO(jy, jm, jd);
      result.textContent = '✓ ' + fa(jd) + ' ' + MONTHS[jm-1] + ' ' + fa(jy);
      return iso;
    }
    function emit(){
      const iso = syncManual();
      if (opts.onChange) opts.onChange(iso);
      if (touched) applyMirror(iso);   /* فقط تغییرهای دستیِ کاربر آینه می‌شوند */
    }

    // مقدار خواندنی (ISO) و تنظیم — قبل از emit اولیه تعریف می‌شوند
    el._value = () => {
      if (manual.value && manual.value.trim()){
        const p = D.parseShamsi(manual.value);
        if (p) return D.shamsiToISO(p[0], p[1], p[2]);
      }
      return D.shamsiToISO(+sy.value, +sm.value, +sd.value);
    };
    el._set = iso => {
      const p = D.parseShamsi(D.isoToShamsi(iso));
      if (p){ sy.value = p[0]; sm.value = p[1]; setDayOptions(false); sd.value = String(p[2]); emit(); }
    };

    // مقدار اولیه: امروز کاری سایت (نه تاریخ فریز، نه ساعت دستگاه)
    let jy = 1405, jm = 1, jd = 1;
    const iso0 = opts.value || el.getAttribute('data-iso') || (D.todayISO ? D.todayISO() : null);
    if (iso0){
      const p = D.parseShamsi(D.isoToShamsi(iso0));
      if (p){ jy = p[0]; jm = p[1]; jd = p[2]; }
    } else {
      const t = D.jalaliInfo(D.now ? D.now() : new Date());
      jy = t.yy; jm = t.mm; jd = t.dd;
    }
    sy.value = String(jy); sm.value = String(jm);
    setDayOptions(false);
    if (jy===+sy.value && jm===+sm.value) sd.value = String(jd);
    emit();

    /* ═══ تقویم کلیکی شمسی — JDATE_CALENDAR_V1 ═══ */
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

    sy.addEventListener('change', () => { touched = true; setDayOptions(false); syncView(); renderGrid(); emit(); });
    sm.addEventListener('change', () => { touched = true; setDayOptions(true); syncView(); renderGrid(); emit(); });
    sd.addEventListener('change', () => { touched = true; renderGrid(); emit(); });

    el.querySelector('.jdate-cal-btn').addEventListener('click', e => {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
      setDayOptions(true);
      syncView();          /* تقویم روی ماهِ تاریخ فعلی باز می‌شود */
      renderGrid();
    });
    el.querySelector('.jd-close').addEventListener('click', () => { pop.hidden = true; });
    // دکمهٔ ثبت تاریخ: مقدار انتخابی دراپ‌داون‌ها اعمال و تأیید می‌شود
    el.querySelector('.jd-ok').addEventListener('click', () => {
      pop.hidden = true;
      emit();
      if (opts.onConfirm) opts.onConfirm(syncManual());
      if (window.APP && APP.toast) APP.toast('تاریخ «' + syncManual() + '» ثبت شد ✓', 'green');
    });

    // ورود دستی
    manual.addEventListener('keydown', e => {
      if (e.key === 'Enter'){
        e.preventDefault();
        const p = D.parseShamsi(manual.value);
        if (p){
          if (p[0] >= 1300 && p[0] <= 1412){
            touched = true;
            sy.value = p[0]; sm.value = p[1];
            setDayOptions(false);
            if (p[2] <= +sd.options[sd.options.length-1].value) sd.value = String(p[2]);
            else sd.value = sd.options[sd.options.length-1].value;
            syncView(); renderGrid();
            emit();
            pop.hidden = true;
            APP.toast('تاریخ «' + syncManual() + '» ثبت شد ✓', 'green');
          } else {
            APP.toast('سال باید بین ۱۳۰۰ تا ۱۴۱۲ باشد', 'red');
          }
        } else {
          APP.toast('فرمت تاریخ درست نیست — مثال: 1405/06/10', 'red');
        }
      }
    });

    // بستن با کلیک بیرون
    document.addEventListener('pointerdown', function closeOut(e){
      if (!el.contains(e.target)) pop.hidden = true;
    });

  }

  window.JDate = { render };
})();
