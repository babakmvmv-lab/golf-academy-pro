/* ═══════════════════════════════════════════════════════════════════
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

    function daysIn(jy, jm){ return jm <= 6 ? 31 : jm <= 11 ? 30 : (jy % 33 % 4 === 1 ? 30 : 29); }

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

    // مقدار اولیه
    let jy = 1405, jm = 1, jd = 1;
    if (opts.value){
      const p = D.parseShamsi(D.isoToShamsi(opts.value));
      if (p){ jy = p[0]; jm = p[1]; jd = p[2]; }
    } else {
      const t = D.jalaliInfo(new Date());
      jy = t.yy; jm = t.mm; jd = t.dd;
    }
    sy.value = String(jy); sm.value = String(jm);
    setDayOptions(false);
    if (jy===+sy.value && jm===+sm.value) sd.value = String(jd);
    emit();

    sy.addEventListener('change', () => { setDayOptions(false); emit(); });
    sm.addEventListener('change', () => { setDayOptions(true); emit(); });
    sd.addEventListener('change', () => emit());

    el.querySelector('.jdate-cal-btn').addEventListener('click', e => {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
      setDayOptions(true);
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
            sy.value = p[0]; sm.value = p[1];
            setDayOptions(false);
            if (p[2] <= +sd.options[sd.options.length-1].value) sd.value = String(p[2]);
            else sd.value = sd.options[sd.options.length-1].value;
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
