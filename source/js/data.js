/* ═══════════════ GolfAcademy PRO — Data engine (seeded, live) ═══════════════ */
(function(){
  /* ── PRNG seeded (همان seed نسخه اکسل) ── */
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function makeRNG(seed){
    const rnd = mulberry32(seed);
    const randInt = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    function gauss(){
      let u = 0, v = 0;
      while (u === 0) u = rnd();
      while (v === 0) v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    function pickN(arr, n){
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--){
        const j = Math.floor(rnd() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a.slice(0, n);
    }
    return { rnd, randInt, gauss, pickN };
  }

  /* ── تبدیل تاریخ شمسی (jalaali-js — الگوریتم استاندارد) ── */
  function div(a,b){return ~~(a/b)}
  function jalCal(jy){
    const breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
    const bl = breaks.length;
    const gy = jy + 621;
    let leapJ = -14, jp = breaks[0], jm, jump = 0, leap, leapG, march, n, i;
    for (i = 1; i < bl; i += 1){
      jm = breaks[i];
      jump = jm - jp;
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
    return { leap, gy, march };
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
    let k = jdn - jdn1f;
    let jm, jd;
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
  function toJalaali(gy, gm, gd){
    return d2j(g2d(gy, gm, gd));
  }
  function j2d(jy, jm, jd){
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }
  function jalaaliToDateObject(jy, jm, jd){
    const jdn = j2d(jy, jm, jd);
    const [gy, gm, gd] = d2g(jdn);
    return { gy, gm, gd };
  }
  /* شمسی → ISO میلادی (برای ذخیره در موتور) */
  function shamsiToISO(jy, jm, jd){
    const d = jalaaliToDateObject(jy, jm, jd);
    return d.gy + '-' + String(d.gm).padStart(2,'0') + '-' + String(d.gd).padStart(2,'0');
  }
  /* ISO میلادی → رشته شمسی (۱۴۰۵/۰۶/۱۰) */
  function isoToShamsi(iso){
    /* پذیرش Date یا رشتهٔ ISO — قبلاً Date می‌گرفت (مثل D.TODAY) و ورودی نامعتبر،
       خروجی خراب «-100722/07/NaN» می‌داد */
    const d = iso instanceof Date ? iso : dateFrom(iso);
    const [jy, jm, jd] = toJalaali(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate());
    return jy + '/' + String(jm).padStart(2,'0') + '/' + String(jd).padStart(2,'0');
  }
  /* پارس رشته شمسی '1405/06/10' یا '۱۴۰۵/۶/۱۰' → [jy,jm,jd] یا null */
  function parseShamsi(s){
    if (!s) return null;
    const faMap = {'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
    let t = String(s).replace(/[۰-۹]/g, ch => faMap[ch]).replace(/[\-\.\s]/g, '/');
    const m = t.match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!m) return null;
    const jy = +m[1], jm = +m[2], jd = +m[3];
    if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
    return [jy, jm, jd];
  }
  const dateFrom = s => new Date(s + 'T00:00:00Z');
  const TODAY = dateFrom('2026-08-31');
  const SEASON_START = dateFrom('2026-03-21');

  const FA_DIG = {0:'۰',1:'۱',2:'۲',3:'۳',4:'۴',5:'۵',6:'۶',7:'۷',8:'۸',9:'۹'};
  const fa = v => String(v).replace(/[0-9]/g, d => FA_DIG[d]);
  const faNum = (v, d=0) => fa(Number(v).toLocaleString('en-US', {maximumFractionDigits:d, minimumFractionDigits:d}));

  const WEEKDAYS = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
  const MONTHS_FA = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  function jalaliInfo(d){
    const [yy, mm, dd] = toJalaali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    const wd = d.getUTCDay();
    return { yy, mm, dd, wd: WEEKDAYS[wd], monthFa: MONTHS_FA[mm-1], season:
      mm <= 3 ? 'بهار' : mm <= 6 ? 'تابستان' : mm <= 9 ? 'پاییز' : 'زمستان' };
  }
  const weekOf = d => Math.floor((d - SEASON_START) / 86400000 / 7) + 1;
  const dayFmt = d => d.toISOString().slice(0,10);

  /* ── داده پایه (فصل ۱۴۰۵ — واقعی) ── */
  const PLAYERS = [
    [1,'بابک','مرد',2,'2025-08-01',1],
    [2,'مهشید','زن',6,'2025-09-01',1],
    [3,'آنا','زن',8,'2025-09-15',1],
    [4,'روزا','زن',10,'2025-10-01',1],
    [5,'ثنا','زن',14,'2026-01-05',1],
    [6,'ستایش','زن',11,'2026-01-05',1],
    [7,'روشا','زن',9,'2026-01-05',1],
    [8,'مهرسا','زن',18,'2026-02-01',1],
  ];
  const PLAYER_NAME = {}; PLAYERS.forEach(p => PLAYER_NAME[p[0]] = p[1]);
  const ACTIVE = PLAYERS.filter(p => p[5]);

  /* زمین مسجدسلیمان: ۱۸ حفره — مجموع پار ۷۲ */
  const COURSES = [
    [1,'زمین مسجدسلیمان','مسجدسلیمان',18],
  ];
  const COURSE_PARS = {
    1:[4,4,3,5,4,4,3,4,5,4,4,3,4,5,4,4,3,5],
  };
  const COURSE_NAME = {}; COURSES.forEach(c => COURSE_NAME[c[0]] = c[1]);
  /* رجیستری پار (شامل زمین‌های سفارشی طراح) */
  const PAR_MAP = {};
  Object.keys(COURSE_PARS).forEach(k => PAR_MAP[k] = COURSE_PARS[k]);
  const parsOf = id => PAR_MAP[id] || COURSE_PARS[id] || [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4];

  /* مسابقات ماهانه: جمعهٔ آخر هر ماه، ۱۸ حفره، زمین مسجدسلیمان */
  const TOURNAMENTS = [
    [1,'جام فروردین',1,1,18,'2026-04-17'],[2,'جام اردیبهشت',1,1,18,'2026-05-15'],
    [3,'جام خرداد',1,1,18,'2026-06-19'],[4,'جام تیر',1,1,18,'2026-07-17'],
    [5,'جام مرداد',1,1,18,'2026-08-21'],[6,'جام شهریور',1,1,18,'2026-09-18'],
    [7,'جام مهر',1,1,18,'2026-10-16'],[8,'جام آبان',1,1,18,'2026-11-20'],
    [9,'جام آذر',1,1,18,'2026-12-18'],[10,'جام دی',1,1,18,'2027-01-15'],
    [11,'جام بهمن',1,1,18,'2027-02-19'],[12,'جام اسفند',1,1,18,'2027-03-19'],
  ];
  const PTS_RULE = {1:[20,15,10,5], 2:[15,10,7,3], 3:[10,7,5,2]};
    const RESULT_LABEL = ['اول','دوم','سوم','شرکت‌کننده'];

  /* ── پنهان‌سازی (حذف نرم) مسابقات پایهٔ فصل — از پنل مدیریت؛ بازیابی‌پذیر ── */
  function loadHiddenTours(){ try { return JSON.parse(localStorage.getItem('ga_tour_hidden') || '[]').map(x => +x).filter(x => !isNaN(x)); } catch(e){ return []; } }
  function saveHiddenTours(a){ try { localStorage.setItem('ga_tour_hidden', JSON.stringify(a)); } catch(e){} }
  function isTourHidden(id){ return loadHiddenTours().indexOf(+id) >= 0; }
  function visibleTours(){ return TOURNAMENTS.filter(t => !isTourHidden(t[0])); }

  /* ── قانون مسابقه: «عادی» = همهٔ ضربه‌ها • «فول» = سقف ضربهٔ هر حفره (پار۳≤۷، پار۴≤۹، پار۵≤۱۱) ── */
  function holeCap(par){ return par === 3 ? 7 : par === 4 ? 9 : par === 5 ? 11 : 0; }
  function tourRuleOf(id){
    id = +id;
    if (id >= 1000){
      try { const ex = loadExtraTours()[id - 1000]; return (ex && ex.rule === 'full') ? 'full' : 'normal'; } catch(e){}
    }
    return 'normal';
  }

  /* ── قوانین امتیازدهی قابل ویرایش + نتایج ثبت‌شده + دوره‌ها ── */
  function loadTourRules(){
    try {
      const r = JSON.parse(localStorage.getItem('ga_tour_rules') || 'null');
      if (r && r[1] && r[2] && r[3]) return r;
    } catch(e){}
    return JSON.parse(JSON.stringify(PTS_RULE));
  }
  function saveTourRules(r){ try { localStorage.setItem('ga_tour_rules', JSON.stringify(r)); } catch(e){} }
  function loadResults(){ try { return JSON.parse(localStorage.getItem('ga_results') || '{}'); } catch(e){ return {}; } }
  function saveResults(r){ try { localStorage.setItem('ga_results', JSON.stringify(r)); } catch(e){} }
  function loadPrograms(){ try { return JSON.parse(localStorage.getItem('ga_programs') || '[]'); } catch(e){ return []; } }
  function savePrograms(a){ try { localStorage.setItem('ga_programs', JSON.stringify(a)); } catch(e){} }
  function loadDelActs(){ try { return JSON.parse(localStorage.getItem('ga_del_acts') || '[]'); } catch(e){ return []; } }
  function saveDelActs(a){ try { localStorage.setItem('ga_del_acts', JSON.stringify(a)); } catch(e){} }
  function loadExtraTours(){ try { return JSON.parse(localStorage.getItem('ga_tournaments') || '[]'); } catch(e){ return []; } }
  /* امتیازهای ۴گانهٔ یک تورنمنت: [اول، دوم، سوم، شرکت] — از override/extra، وگرنه قوانین سطح */
  function prizesOf(t, rules){
    rules = rules || loadTourRules();
    const id = t[0], lvl = t[2] || 2;
    const def = rules[lvl] || rules[2] || [15,10,7,3];
    let p = null;
    if (id >= 1000){
      const ex = loadExtraTours()[id - 1000];
      if (ex) p = [ex.p1, ex.p2, ex.p3, ex.entry];
    } else {
      try {
        const ov = JSON.parse(localStorage.getItem('ga_tour_override') || '{}')[id];
        if (ov && (ov.p1 !== undefined || ov.entry !== undefined)) p = [ov.p1, ov.p2, ov.p3, ov.entry];
      } catch(e){}
    }
    if (p && p.every(x => x !== undefined && x !== null && x !== '')) return p.map(x => +x);
    return def.map(x => +x);
  }

  /* ── تولید کارت امتیاز (قطعی — منطبق با نتایج فصل) ──
     قانون گلف: برنده کمترین ضربه را در ۱۸ حفره (پار ۷۲) می‌زند.
     اول: بابک • دوم: مهشید • سوم: متناوب ستایش/روشا — بقیه بر اساس مهارت (هندیکپ) */
  function genScorecards(players){
    const cards = [];
    const ACT = players ? players.filter(p => p[5]) : ACTIVE;
    TOURNAMENTS.forEach((t, ti) => {
      if (isTourHidden(t[0])) return;  /* مسابقهٔ حذف‌شده (پنهان) — امتیاز/کارت تولید نمی‌کند */
      const [code, name, lvl, cid, holes, dstr] = t;
      const d = dateFrom(dstr);
      if (d >= TODAY) return;
      const pars = parsOf(cid).slice(0, holes);
      const parTotal = pars.reduce((a,b)=>a+b,0);
      const field = ACT.filter(p => dateFrom(p[4]) <= d);
      field.forEach(p => {
        const target = targetTotal(p[0], ti, p[3]);
        const st = buildStrokes(pars, target, makeRNG(10000 + ti * 100 + p[0]));
        const strokes = {};
        st.forEach((v, i) => strokes[i+1] = v);
        cards.push({ tour: code, pid: p[0], strokes, total: st.reduce((a,b)=>a+b,0) });
      });
    });
    return cards;
    function targetTotal(pid, ti, hcp){
      if (pid === 1) return 68 + (ti % 3);                    // بابک — نفر اول
      if (pid === 2) return 71 + ((ti + 1) % 3);              // مهشید — نفر دوم
      if (pid === (ti % 2 === 0 ? 6 : 7)) return 74 + ((ti * 2 + 1) % 3); // سوم: ستایش، روشا، متناوب
      return 77 + Math.round(hcp * 0.7) + (ti % 2);           // بقیه بر اساس هندیکپ
    }
  }
  function buildStrokes(pars, target, rng){
    const st = pars.slice();
    let diff = target - pars.reduce((a,b)=>a+b,0);
    const n = st.length;
    let guard = 0;
    while (diff !== 0 && guard++ < 3000){
      const i = Math.floor(rng.rnd() * n);
      if (diff > 0 && st[i] < 8){ st[i]++; diff--; }
      else if (diff < 0 && st[i] > 2){ st[i]--; diff++; }
    }
    return st;
  }

  /* ── فعالیت‌ها: تمرین هفتگی پنجشنبه برای همهٔ اعضا (قطعی) ── */
  function genActivities(players){
    const ACT = players ? players.filter(p => p[5]) : ACTIVE;
    const acts = [];
    const first = new Date(SEASON_START.getTime());
    while (first.getUTCDay() !== 4) first.setUTCDate(first.getUTCDate() + 1); // اولین پنجشنبهٔ فصل
    const d = new Date(first.getTime());
    while (d <= TODAY){
      const dd = new Date(d.getTime());
      ACT.forEach(p => acts.push({ date: dd, pid: p[0], type: 'تمرین', points: 1 }));
      d.setUTCDate(d.getUTCDate() + 7);
    }
    return acts;
  }

  /* پنجشنبه‌های کل فصل ۱۴۰۵ (برای تقویم — از ابتدای امسال تا پایان سال) */
  function thursdaysSeason(){
    const out = [];
    const first = new Date(SEASON_START.getTime());
    while (first.getUTCDay() !== 4) first.setUTCDate(first.getUTCDate() + 1);
    const end = dateFrom('2027-03-20');
    const d = new Date(first.getTime());
    while (d <= end){
      out.push(dayFmt(d));
      d.setUTCDate(d.getUTCDate() + 7);
    }
    return out;
  }

  /* ── ذخیره تنظیمات مدیر (بازیکن فعال/غیرفعال + نمایش نمودارها) ── */
  function loadPlayers(){
    // بازیکنان پایه + تغییرات مدیر (فعال/غیرفعال، ویرایش مشخصات)
    let edits = {};
    try { edits = JSON.parse(localStorage.getItem('ga_players') || '{}'); } catch(e){}
    return PLAYERS.map(p => {
      const e = edits[p[0]];
      if (!e) return p;
      const np = p.slice();
      if (e.active !== undefined) np[5] = e.active ? 1 : 0;
      if (e.name) np[1] = e.name;
      if (e.hcp !== undefined) np[3] = +e.hcp;
      if (e.gender) np[2] = e.gender;
      return np;
    });
  }
  function loadCustomPlayers(){
    try { return JSON.parse(localStorage.getItem('ga_custom_players') || '[]'); } catch(e){ return []; }
  }
  function loadPlayerUsers(){
    try { return JSON.parse(localStorage.getItem('ga_player_users') || '{}'); } catch(e){ return {}; }
  }
  function savePlayerUsers(u){
    try { localStorage.setItem('ga_player_users', JSON.stringify(u)); } catch(e){}
  }

  /* ── رتبه و رنگ ── */
  const GOLD_ELITE = 120;
  const RANK_DEF = [
    ['White','سفید',0,'#8A93A6'], ['Green','سبز',50,'#1EBB8A'], ['Blue','آبی',75,'#2E86DE'],
    ['Red','قرمز',100,'#E74C3C'], ['Gold Elite','طلایی',GOLD_ELITE,'#D4AF37'],
  ];
  const RANK_TEXT = {}; RANK_DEF.forEach(r => RANK_TEXT[r[0]] = r[1]);
  function rankOf(pts){
    let r = RANK_DEF[0];
    RANK_DEF.forEach(rk => { if (pts >= rk[2]) r = rk; });
    return r;
  }
  const FORM_META = { 'اول': {c:'w', t:'ق'}, 'دوم': {c:'p2', t:'۲'}, 'سوم': {c:'p3', t:'۳'}, 'شرکت‌کننده': {c:'p4', t:'ش'} };

  /* ── محاسبه کامل ── */
  function compute(state){
    const { tournaments, players } = state;
    // بازیکن غیرفعال = انگار اصلاً وجود نداشته: کارتها و فعالیتهایش حذف میشوند
    const activeSet = new Set(players.filter(p => p[5]).map(p => p[0]));
    const scorecards = state.scorecards.filter(c => activeSet.has(c.pid));
    const activities = state.activities.filter(a => activeSet.has(a.pid));
    const rules = loadTourRules();
    const results = loadResults();
    const programs = loadPrograms();
    const PTS = {}; players.forEach(p => PTS[p[0]] = 0);
    const MONTH_PTS = {}; const CARDS = {};
    let TOTAL_BIRDIES = 0;
    const info = {};
    tournaments.forEach(t => info[t[0]] = t);
    const scoredTours = new Set(Object.keys(results).map(Number));

    // نتایج ثبتشدهٔ مسابقات: امتیاز از نفرات اول تا سوم + شرکتکنندگان
    Object.keys(results).forEach(tid => {
      const t = info[+tid];
      if (!t) return;
      const res = results[tid];
      const top = res.top || {};
      const pr = prizesOf(t, rules);
      const j = jalaliInfo(dateFrom(t[5]));
      (res.participants || []).forEach(pid => {
        if (!activeSet.has(pid)) return;
        let place = 4;
        if (top['1'] === pid) place = 1;
        else if (top['2'] === pid) place = 2;
        else if (top['3'] === pid) place = 3;
        const pts = pr[Math.min(place, 4) - 1] || 0;
        PTS[pid] += pts;
        MONTH_PTS[j.monthFa] = MONTH_PTS[j.monthFa] || {};
        MONTH_PTS[j.monthFa][pid] = (MONTH_PTS[j.monthFa][pid] || 0) + pts;
      });
    });

    scorecards.forEach(c => {
      const t = info[c.tour];
      if (!t) return;
      const j = jalaliInfo(dateFrom(t[5]));
      const res = scoredTours.has(c.tour) ? results[c.tour] : null;
      const top = res ? (res.top || {}) : null;
      let rank = null, place = null, pts = 0;
      if (res){
        // امتیاز قبلاً از نتیجه داده شد؛ اینجا فقط رتبهٔ نمایشی برای کارت
        rank = top && top['1'] === c.pid ? 1 : top && top['2'] === c.pid ? 2 : top && top['3'] === c.pid ? 3 : 4;
        place = rank;
      } else {
        const ptsRule = rules[t[2]];
        const group = scorecards.filter(x => x.tour === c.tour).sort((a,b) => a.total - b.total);
        rank = group.indexOf(c) + 1;
        place = Math.min(rank, 4);
        pts = ptsRule[place - 1];
        PTS[c.pid] += pts;
        MONTH_PTS[j.monthFa] = MONTH_PTS[j.monthFa] || {};
        MONTH_PTS[j.monthFa][c.pid] = (MONTH_PTS[j.monthFa][c.pid] || 0) + pts;
      }
      const pars = parsOf(t[3]);
      const holes = t[4];
      let birdies = 0, parsN = 0, bogeys = 0, dbog = 0;
      for (let h = 1; h <= holes; h++){
        const s = c.strokes[h], p = pars[h-1];
        if (s === p - 1) birdies++;
        else if (s === p) parsN++;
        else if (s === p + 1) bogeys++;
        else if (s > p + 1) dbog++;
      }
      TOTAL_BIRDIES += birdies;
      const parTotal = pars.slice(0, holes).reduce((a,b)=>a+b,0);
      const vspar = c.total - parTotal;
      CARDS[c.pid] = CARDS[c.pid] || [];
      CARDS[c.pid].push({
        tour: c.tour, name: t[1], date: t[5], lvl: t[2], course: t[3],
        total: c.total, par: parTotal, vspar, rank, result: RESULT_LABEL[place-1],
        birdies, pars: parsN, bogeys, dbog, strokes: c.strokes,
      });
    });
    const ST = {};
    players.forEach(p => ST[p[0]] = { win:0, second:0, third:0, matches:0, practices:0, courses:0, points:0, attend:0 });
    activities.forEach(a => {
      const s = ST[a.pid];
      if (!s) return;
      s.attend++;
      if (a.type === 'تمرین') s.practices++;
      else if (a.type === 'آموزش') s.courses++;
      const apts = +a.points || 0;
      if (apts){
        PTS[a.pid] += apts;
        const aj = a.date instanceof Date ? jalaliInfo(a.date) : jalaliInfo(dateFrom(a.date));
        MONTH_PTS[aj.monthFa] = MONTH_PTS[aj.monthFa] || {};
        MONTH_PTS[aj.monthFa][a.pid] = (MONTH_PTS[aj.monthFa][a.pid] || 0) + apts;
      }
    });
    // دوره‌های آموزشی / تمرین / اردو: امتیاز شرکت + نفرات برتر
    programs.forEach(pr => {
      const part = (pr.participants || []).filter(pid => activeSet.has(pid));
      if (!part.length) return;
      const j = jalaliInfo(dateFrom(pr.start || pr.date || ''));
      const top = pr.top || {};
      part.forEach(pid => {
        const s = ST[pid];
        if (!s) return;
        s.attend++;
        if (pr.type === 'تمرین') s.practices++;
        else if (pr.type === 'کلاس' || pr.type === 'آموزش') s.courses++;
        let place = 4;
        if (top['1'] === pid) place = 1;
        else if (top['2'] === pid) place = 2;
        else if (top['3'] === pid) place = 3;
        const pts = place === 1 ? (+pr.p1 || 0) : place === 2 ? (+pr.p2 || 0) : place === 3 ? (+pr.p3 || 0) : (+pr.entry || 0);
        PTS[pid] += pts;
        MONTH_PTS[j.monthFa] = MONTH_PTS[j.monthFa] || {};
        MONTH_PTS[j.monthFa][pid] = (MONTH_PTS[j.monthFa][pid] || 0) + pts;
      });
    });
    // نبرد میدانها — امتیاز فصلِ نتایج تیمی (روی رنک/امتیاز فصل اثر میگذارد)
    // اگر هیچ جدالی با نتیجه ثبت نشده باشد، bonus خالی است و چیزی تغییر نمیکند.
    try {
      const bM = window.Battle;
      const btBonus = (bM && bM.computeSeasonBonus) ? bM.computeSeasonBonus() : {};
      Object.keys(btBonus).forEach(pid => {
        if (PTS[pid] !== undefined) PTS[pid] += btBonus[pid];
      });
    } catch(e){}

    Object.entries(CARDS).forEach(([pid, arr]) => {
      const s = ST[pid];
      arr.forEach(c => {
        s.matches++;
        if (c.result === 'اول') s.win++;
        else if (c.result === 'دوم') s.second++;
        else if (c.result === 'سوم') s.third++;
        s.points += PTS[pid];
      });
    });
    const LB = Object.keys(PTS).filter(pid => activeSet.has(+pid)).map(pid => {
      const cards = CARDS[pid] || [];
      const total = cards.reduce((a,c)=>a+c.total,0);
      const avg = cards.length ? Math.round(total / cards.length * 10) / 10 : 0;
      const bird = cards.reduce((a,c)=>a+c.birdies,0);
      const best = cards.length ? cards.reduce((a,c)=>c.vspar < a.vspar ? c : a, cards[0]) : null;
      const form = cards.slice(-5).map(c => c.result);
      let streak = 0;
      for (let i = cards.length-1; i >= 0; i--){
        if (cards[i].rank <= 3) streak++; else break;
      }
      const holesPlayed = cards.reduce((a,c)=>a+Object.keys(c.strokes).length,0);
      const scoringAvg = cards.length ? Math.round(total / holesPlayed * 18 * 10) / 10 : 0;
      const p = players.find(x => x[0] === +pid) || players[0];
      return {
        pid: +pid, name: (p ? p[1] : (PLAYER_NAME[pid] || '—')), hcp: p ? p[3] : 0, gender: p ? p[2] : 'مرد',
        pts: PTS[pid], color: rankOf(PTS[pid])[0], colorHex: rankOf(PTS[pid])[3],
        rank: 0, change: 0, win: ST[pid].win, matches: ST[pid].matches,
        prac: ST[pid].practices, course: ST[pid].courses, attend: ST[pid].attend,
        avg, bird, form, streak, top3: ST[pid].win + ST[pid].second + ST[pid].third,
        rounds: cards.length, best_vspar: best ? best.vspar : null,
        best_tour: best ? best.name : null, best_total: best ? best.total : null,
        scoring_avg: scoringAvg,
      };
    });
    LB.sort((a,b) => b.pts - a.pts || a.hcp - b.hcp);
    LB.forEach((r,i) => {
      r.rank = i + 1;
      r.change = ((r.pid % 3) - 1) * ((r.pid * 7 + 3) % 5 > 1 ? 1 : 0);
    });
    const norm = (vals, rev) => {
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const span = (hi - lo) || 1;
      return vals.map(v => Math.round(rev ? (100 - (v - lo)/span*100) : (v - lo)/span*100));
    };
    const scA = LB.map(r => r.scoring_avg);
    const bdA = LB.map(r => r.bird / Math.max(1, r.rounds));
    const csA = LB.map(r => {
      const arr = (CARDS[r.pid]||[]).map(c => c.total);
      if (!arr.length) return 0;
      const m = arr.reduce((a,b)=>a+b,0)/arr.length;
      return Math.sqrt(arr.reduce((a,b)=>a+(b-m)*(b-m),0)/arr.length);
    });
    const prA = LB.map(r => r.prac);
    const exA = LB.map(r => r.rounds + r.course);
    const SKILLS = {};
    LB.forEach((r, i) => {
      SKILLS[r.pid] = {
        scoring: norm(scA, true)[i],
        birdie: norm(bdA, false)[i],
        consistency: norm(csA, true)[i],
        practice: norm(prA, false)[i],
        experience: norm(exA, false)[i],
      };
    });
    const PHASES = { 'بهار': ['فروردین','اردیبهشت','خرداد'], 'تابستان': ['تیر','مرداد','شهریور'] };
    const PHASE_PTS = {}; const PHASE_CHAMP = {};
    Object.keys(PHASES).forEach(ph => {
      const acc = {};
      PHASES[ph].forEach(m => {
        Object.entries(MONTH_PTS[m] || {}).forEach(([pid, v]) => acc[pid] = (acc[pid]||0) + v);
      });
      PHASE_PTS[ph] = acc;
      const best = Object.entries(acc).sort((a,b) => b[1] - a[1])[0];
      PHASE_CHAMP[ph] = best ? { pid: +best[0], name: (players.find(x => x[0] === +best[0]) || [0,'—'])[1], pts: best[1] } : { pid: null, name: '—', pts: 0 };
    });
    const MONTHS_SEASON = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور'];
    const MONTHLY_TOT = MONTHS_SEASON.map(m => Object.values(MONTH_PTS[m]||{}).reduce((a,b)=>a+b,0));
    let champM = null, champMpts = -1, champName = '—';
    MONTHS_SEASON.forEach(m => {
      const ent = Object.entries(MONTH_PTS[m]||{});
      if (ent.length){
        ent.sort((a,b)=>b[1]-a[1]);
        if (ent[0][1] > champMpts){ champMpts = ent[0][1]; champM = m; champName = (players.find(x => x[0] === +ent[0][0]) || [0,'—'])[1]; }
      }
    });
    const BEST_ROUNDS = [];
    LB.forEach(r => (CARDS[r.pid]||[]).forEach(c => BEST_ROUNDS.push({ name: r.name, tour: c.name, total: c.total, vspar: c.vspar, bird: c.birdies, hcp: r.hcp })));
    BEST_ROUNDS.sort((a,b) => a.vspar - b.vspar);
    const HOLE_DIFF = {};
    scorecards.forEach(c => {
      const t = info[c.tour];
      if (!t) return;
      HOLE_DIFF[c.tour] = HOLE_DIFF[c.tour] || {};
      const pars = parsOf(t[3]);
      for (let h = 1; h <= t[4]; h++){
        HOLE_DIFF[c.tour][h] = HOLE_DIFF[c.tour][h] || [];
        HOLE_DIFF[c.tour][h].push(c.strokes[h] - pars[h-1]);
      }
    });
    Object.keys(HOLE_DIFF).forEach(t => {
      Object.keys(HOLE_DIFF[t]).forEach(h => {
        const arr = HOLE_DIFF[t][h];
        HOLE_DIFF[t][h] = Math.round(arr.reduce((a,b)=>a+b,0)/arr.length * 100) / 100;
      });
    });
    const COURSE_STATS = {};
    COURSES.forEach(c => {
      const acc = {};
      scorecards.forEach(sc => {
        const t = info[sc.tour];
        if (!t || t[3] !== c[0]) return;
        const pars = parsOf(c[0]);
        for (let h = 1; h <= t[4]; h++){
          acc[h] = acc[h] || [];
          acc[h].push(sc.strokes[h] - pars[h-1]);
        }
      });
      COURSE_STATS[c[0]] = {};
      Object.keys(acc).forEach(h => {
        const arr = acc[h];
        COURSE_STATS[c[0]][h] = Math.round(arr.reduce((a,b)=>a+b,0)/arr.length * 100) / 100;
      });
    });
    const PLAYER_COURSE = {};
    LB.forEach(r => {
      const pc = {};
      (CARDS[r.pid]||[]).forEach(c => {
        pc[c.course] = pc[c.course] || [];
        pc[c.course].push(c.vspar);
      });
      PLAYER_COURSE[r.pid] = {};
      Object.keys(pc).forEach(c => PLAYER_COURSE[r.pid][c] = Math.round(pc[c].reduce((a,b)=>a+b,0)/pc[c].length*100)/100);
    });
    const PAR_TYPE = {};
    LB.forEach(r => {
      const acc = {3:[],4:[],5:[]};
      (CARDS[r.pid]||[]).forEach(c => {
        const pars = parsOf(c.course);
        Object.entries(c.strokes).forEach(([h,s]) => acc[pars[h-1]].push(+s));
      });
      PAR_TYPE[r.pid] = {
        p3: acc[3].length ? Math.round(acc[3].reduce((a,b)=>a+b,0)/acc[3].length*100)/100 : null,
        p4: acc[4].length ? Math.round(acc[4].reduce((a,b)=>a+b,0)/acc[4].length*100)/100 : null,
        p5: acc[5].length ? Math.round(acc[5].reduce((a,b)=>a+b,0)/acc[5].length*100)/100 : null,
      };
    });
    const TOT_PTS = Object.values(PTS).reduce((a,b)=>a+b,0);
    const MATCHES_HELD = scorecards.length ? [...new Set(scorecards.map(c=>c.tour))].length : 0;
    const GOLD_COUNT = Object.values(PTS).filter(v => v >= GOLD_ELITE).length;
    const activePlayers = players.filter(p => p[5]);
    const AVG_HCP = activePlayers.length ? Math.round(activePlayers.reduce((a,p)=>a+p[3],0)/activePlayers.length*10)/10 : 0;
    const future = tournaments.filter(t => dateFrom(t[5]) >= TODAY).sort((a,b) => dateFrom(a[5]) - dateFrom(b[5]));
    const NEXT_T = future[0] || null;
    const COUNTDOWN = NEXT_T ? Math.ceil((dateFrom(NEXT_T[5]) - TODAY)/86400000) : 0;
    const RANK_COUNT = {};
    RANK_DEF.forEach(rk => RANK_COUNT[rk[0]] = Object.values(PTS).filter(v => rankOf(v)[0] === rk[0]).length);
    const PRACTICE_DAYS = new Set(activities.filter(a=>a.type==='تمرین').map(a=>dayFmt(a.date))).size;
    const COURSE_DAYS = new Set(activities.filter(a=>a.type==='آموزش').map(a=>dayFmt(a.date))).size;

    return {
      PTS, CARDS, ST, LB, SKILLS, PHASE_PTS, PHASE_CHAMP, MONTH_PTS, MONTHLY_TOT,
      MONTHS_SEASON, champM, champName, BEST_ROUNDS, HOLE_DIFF, COURSE_STATS,
      PLAYER_COURSE, PAR_TYPE, TOT_PTS, MATCHES_HELD, GOLD_COUNT, AVG_HCP, NEXT_T,
      COUNTDOWN, RANK_COUNT, TOTAL_BIRD: TOTAL_BIRDIES, PRACTICE_DAYS, COURSE_DAYS,
    };
  }

  /* ── State با ذخیره localStorage (ابزار طراح) ── */
  function loadState(){
    let extra = { courses: [], tournaments: [], scorecards: [] };
    try {
      extra.courses = JSON.parse(localStorage.getItem('ga_courses') || '[]');
      extra.tournaments = JSON.parse(localStorage.getItem('ga_tournaments') || '[]');
      extra.scorecards = JSON.parse(localStorage.getItem('ga_scorecards') || '[]');
    } catch(e) {}
    extra.courses.forEach((c, i) => {
      const cid = 1000 + i;
      PAR_MAP[cid] = c.pars;
    });
    const players = loadPlayers().concat(loadCustomPlayers().map((p, i) => [9000+i, (p.name + ' ' + (p.family||'')).trim(), p.gender, +p.hcp, p.join || '2026-01-01', p.active === false ? 0 : 1]));
    // اطمینان: پلیرهای سفارشی که کاربر یوزر/پسورد برایشان ساخته، در USERS معتبرند (در app.js خوانده میشود)
    const PLAYER_NAME_EXT = {}; players.forEach(p => PLAYER_NAME_EXT[p[0]] = p[1]);
    const ACTIVE_EXT = players.filter(p => p[5]);
    return {
      players, active: ACTIVE_EXT,
      courses: COURSES.concat(extra.courses.map((c, i) => [1000+i, c.name, c.loc, c.holes])),
      tournaments: visibleTours().concat(extra.tournaments.map((t, i) => [1000+i, t.name, +t.lvl, +t.course, +t.holes, t.date])),
      scorecards: genScorecards(players).concat(extra.scorecards.map(s => {
        const tour = +s.tour, pid = +s.pid;
        const ex = extra.tournaments[tour - 1000];
        const rule = ex && ex.rule === 'full' ? 'full' : 'normal';   /* قانون فول: سقف ضربهٔ هر حفره (پار۳≤۷ • پار۴≤۹ • پار۵≤۱۱) */
        const parsL = ex ? parsOf(+ex.course) : [];
        const raw = Object.fromEntries(Object.entries(s.strokes).map(([h,v]) => [+h, +v]));
        const st = {}; const caps = {};
        let total = 0;
        Object.keys(raw).forEach(hk => {
          const h = +hk; let v = raw[h];
          if (rule === 'full'){ const cap = holeCap(parsL[h-1]); if (cap && v > cap){ caps[h] = v; v = cap; } }
          st[h] = v; total += v;
        });
        const cappedN = Object.keys(caps).length;
        return { tour, pid, strokes: st, total, rule, capped: cappedN, caps,
          rawTotal: cappedN ? Object.values(raw).reduce((a,b)=>a+(+b),0) : undefined };
      })),
      activities: genActivities(players).filter((a, i) => !loadDelActs().includes(i)),
    };
  }


  /* ── کمکی: بازیکنان زنده (نام ویرایش‌شده + عکس) ── */
  function playerRows(){
    const rows = [];
    let edits = {};
    try { edits = JSON.parse(localStorage.getItem('ga_players') || '{}'); } catch(e){}
    PLAYERS.forEach(p => {
      const e = edits[p[0]] || {};
      rows.push({ pid: p[0], name: e.name || p[1], gender: e.gender || p[2], hcp: e.hcp !== undefined ? +e.hcp : p[3], active: e.active !== undefined ? e.active : !!p[5], photo: e.photo || '' });
    });
    try {
      const cs = JSON.parse(localStorage.getItem('ga_custom_players') || '[]');
      cs.forEach((c, i) => rows.push({ pid: 9000 + i, name: (c.name + ' ' + (c.family || '')).trim(), gender: c.gender, hcp: +c.hcp, active: c.active !== false, photo: c.photo || '' }));
    } catch(e){}
    return rows;
  }
  /* نام فعلی بازیکن (با ویرایش‌ها — اصلاح باگ نمایش نام قدیمی در کل سایت) */
  function nameOf(pid){
    pid = +pid;
    const r = playerRows().find(x => x.pid === pid);
    if (r) return r.name;
    return PLAYER_NAME[pid] || '—';
  }
  /* آواتار/عکس: اگر عکس گذاشته شده → عکس؛ وگرنه آواتار جنسیتی (خانم/آقا متفاوت) */
  function photoOf(pid){
    pid = +pid;
    const r = playerRows().find(x => x.pid === pid);
    if (!r) return 'assets/avatar_m.webp';
    if (r.photo) return r.photo;
    return r.gender === 'زن' ? (window.__AV_F || 'assets/avatar_f.webp') : (window.__AV_M || 'assets/avatar_m.webp');
  }

  /* ── بذر دادهٔ فصل ۱۴۰۵ (حذف دادهٔ فیک و بارگذاری دادهٔ واقعی) ── */
  function seedSeason(force){
    try {
      if (!force && localStorage.getItem('ga_seed_v2') === '1405') return;
      const keys = ['ga_tour_rules','ga_results','ga_tour_override','ga_tour_hidden','ga_programs','ga_courses','ga_tournaments','ga_scorecards','ga_del_acts','ga_events','ga_custom_players','ga_player_users','ga_players'];
      keys.forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
      // تولد اعضا (برای نمایش سن/تولد در مدیریت)
      const births = {1:'1987-03-21',2:'2009-03-21',3:'2009-08-01',4:'2008-09-01',5:'2011-04-15',6:'2010-05-10',7:'2010-08-20',8:'2017-03-21'};
      const ed = {};
      Object.keys(births).forEach(pid => { ed[pid] = { birth: births[pid] }; });
      localStorage.setItem('ga_players', JSON.stringify(ed));
      // نتایج مسابقات برگزارشده: اول بابک، دوم مهشید، سوم متناوب ستایش/روشا — همهٔ اعضا شرکت‌کننده
      const ALL = [1,2,3,4,5,6,7,8];
      const res = {};
      TOURNAMENTS.forEach((t, ti) => {
        if (isTourHidden(t[0])) return;
        if (dateFrom(t[5]) >= TODAY) return;
        res[t[0]] = { participants: ALL.slice(), top: { 1: 1, 2: 2, 3: (ti % 2 === 0 ? 6 : 7) } };
      });
      localStorage.setItem('ga_results', JSON.stringify(res));
      // دوره‌ها: دو دورهٔ ۲روزه در خرداد (برگزارشده) + یک دورهٔ آینده در آذر
      const progs = [
        { name: 'دورهٔ آموزشی ۲روزهٔ گلف — خرداد', type: 'کلاس', start: '2026-05-26', end: '2026-05-27', info: 'دورهٔ ۲ روزه — همهٔ اعضای آکادمی', p1: 10, p2: 7, p3: 5, entry: 3, participants: ALL.slice(), top: { 1: 1, 2: 2, 3: 6 } },
        { name: 'دورهٔ تمرینی ۲روزهٔ اصول پوتینگ — خرداد', type: 'تمرین', start: '2026-06-09', end: '2026-06-10', info: 'دورهٔ ۲ روزه — همهٔ اعضای آکادمی', p1: 10, p2: 7, p3: 5, entry: 3, participants: ALL.slice(), top: { 1: 1, 2: 2, 3: 7 } },
        { name: 'دورهٔ آماده‌سازی جام بزرگ فصل — آذر', type: 'کلاس', start: '2026-11-25', end: '2026-11-26', info: 'دورهٔ ۲ روزهٔ آینده در آذر ماه', p1: 12, p2: 8, p3: 6, entry: 4 },
      ];
      localStorage.setItem('ga_programs', JSON.stringify(progs));
      localStorage.setItem('ga_seed_v2', '1405');
    } catch(e){}
  }

  const IR_HOLIDAYS = (typeof IR_HOLIDAYS_1405 !== 'undefined' && IR_HOLIDAYS_1405) ? IR_HOLIDAYS_1405 : ((typeof window.IR_HOLIDAYS_1405 !== 'undefined') ? window.IR_HOLIDAYS_1405 : []);
  function holidaysOf(jy, jm, jd){
    if (jy !== 1405) return [];
    return IR_HOLIDAYS.filter(h => h[0] === jm && h[1] === jd);
  }
  function isHoliday(d){
    const j = jalaliInfo(d);
    return holidaysOf(j.yy, j.mm, j.dd).some(h => h[3] === 'holiday');
  }

  window.Data = {
    fa, faNum, jalaliInfo, weekOf, dayFmt, dateFrom, TODAY, SEASON_START,
    toJalaali, jalaaliToDateObject, j2d, shamsiToISO, isoToShamsi, parseShamsi,
    PLAYERS, PLAYER_NAME, ACTIVE, COURSES, COURSE_PARS, COURSE_NAME, TOURNAMENTS,
    PTS_RULE, RESULT_LABEL, MONTHS_FA, RANK_DEF, RANK_TEXT, rankOf, FORM_META, GOLD_ELITE,
    loadTourRules, saveTourRules, loadResults, saveResults, loadPrograms, savePrograms,
    loadHiddenTours, saveHiddenTours, isTourHidden, visibleTours, holeCap, tourRuleOf,
    loadDelActs, saveDelActs, loadExtraTours, prizesOf,
    parsOf, compute, loadState, loadPlayers, loadCustomPlayers, loadPlayerUsers, savePlayerUsers,
    IR_HOLIDAYS, holidaysOf, isHoliday,
    playerRows, nameOf, photoOf, thursdaysSeason, seedSeason,
  };
  seedSeason();
})();
