/* ═══════════════ GolfAcademy PRO — App ═══════════════ */
(function(){
  const D = window.Data;
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const L = (id, fallback) => window.UI_LABELS ? UI_LABELS.t(id, fallback) : fallback;

  /* ذخیره‌سازی امن — در پیش‌نمایش sandbox شده، localStorage در دسترس نیست */
  const store = (() => {
    try {
      localStorage.setItem('__ga_t', '1'); localStorage.removeItem('__ga_t');
      return { get: k => localStorage.getItem(k), set: (k,v) => localStorage.setItem(k, String(v)), remove: k => localStorage.removeItem(k), persistent: true };
    } catch(e) {
      const m = {};
      return { get: k => (k in m ? m[k] : null), set: (k,v) => { m[k] = String(v); }, remove: k => { delete m[k]; }, persistent: false };
    }
  })();

  /* ── احراز هویت: یوزرهای سیستم (دو سطح: مدیر / عضو) ── */
  function cyrb53(str, seed=0){
    let h1 = 0xdeadbeef^seed, h2 = 0x41c6ce57^seed;
    for (let i=0, ch; i<str.length; i++){
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1^ch, 2654435761);
      h2 = Math.imul(h2^ch, 1597334677);
    }
    h1 = Math.imul(h1^(h1>>>16), 2246822507) ^ Math.imul(h2^(h2>>>13), 3266489909);
    h2 = Math.imul(h2^(h2>>>16), 2246822507) ^ Math.imul(h1^(h1>>>13), 3266489909);
    return (4294967296*(2097151&h2)+(h1>>>0)).toString(36);
  }
  const USERS_KEY = 'ga_users';
  function loadUsers(){
    try { const a = JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); if (Array.isArray(a)) return a; } catch(e){}
    return [];
  }
  function saveUsers(a){ try { localStorage.setItem(USERS_KEY, JSON.stringify(a)); } catch(e){} }
  /* ساخت اولیه: مدیر اصلی + مربی/مدیریت (مدیر) + یک یوزر عضو برای هر بازیکن */
  function seedUsers(){
    const cur = loadUsers();
    if (cur.length) return cur;
    const arr = [
      { id: 1, user: 'admin',  pass: 'golf1405', name: 'مدیر آکادمی', role: 'admin',  active: true, main: true },
      { id: 2, user: 'coach',  pass: 'golf1405', name: 'مربی ارشد',   role: 'admin',  active: true },
      { id: 3, user: 'manager',pass: 'golf1405', name: 'مدیریت',      role: 'admin',  active: true },
    ];
    try {
      D.loadState().players.forEach(p => {
        arr.push({ id: 100 + p[0], user: 'p' + p[0], pass: 'golf1405', name: p[1], role: 'member', active: true, pid: p[0] });
      });
    } catch(e){}
    saveUsers(arr);
    return arr;
  }
  function userRec(u){
    return loadUsers().find(x => String(x.user).toLowerCase() === String(u).toLowerCase()) || null;
  }
  function isMain(u){ const r = userRec(u); return !!(r && r.main && r.active); }
  function isAdmin(u){ const r = userRec(u); return !!(r && r.role === 'admin' && r.active); }
  /* یوزر/پسورد بازیکنان (ساخته‌شده در پلن مدیریت — سازگاری قدیمی) */
  function playerUsers(){
    try { return JSON.parse(localStorage.getItem('ga_player_users') || '{}'); } catch(e){ return {}; }
  }
  function buildUsers(){
    const m = {};
    seedUsers().forEach(u => { if (u.active) m[String(u.user).toLowerCase()] = cyrb53(u.pass); });
    try {
      const pusers = playerUsers();
      Object.values(pusers).forEach(p => {
        if (p && p.user && p.pass && p.active !== false) m[String(p.user).toLowerCase()] = cyrb53(p.pass);
      });
    } catch(e){}
    return m;
  }
  function userLabelFor(u){
    const r = userRec(u);
    if (r){
      if (r.role === 'admin') return (r.main ? 'مدیر اصلی آکادمی' : (r.name || 'مدیر'));
      return 'عضو آکادمی — ' + (r.name || u);
    }
    try {
      const pusers = playerUsers();
      const hit = Object.values(pusers).find(p => p && p.user === u);
      if (hit) return 'بازیکن — ' + ((hit.name + ' ' + (hit.family||'')).trim() || u);
    } catch(e){}
    return 'کاربر';
  }

  /* ── State ── */
  let S = null;      // raw state (courses/tournaments/scorecards/activities)
  let A = null;      // analytics
  let currentUser = 'admin';

  function recompute(){
    A = D.compute(S);
    applyStateToForms();
  }

  /* ── ابزارهای کمکی UI ── */
  const avatar = pid => (window.Data && Data.photoOf) ? Data.photoOf(pid) : (pid % 2 ? 'assets/avatar_m.webp' : 'assets/avatar_f.webp');
  const ringColor = rk => rk === 'Gold Elite' ? 'gold' : rk === 'Red' ? 'red' : rk === 'Blue' ? 'blue' : rk === 'Green' ? 'green' : 'dim';
  function rankPill(rk){ return `<span class="rank-pill" style="background:${D.RANK_DEF.find(r=>r[0]===rk)[3]}22;color:${D.RANK_DEF.find(r=>r[0]===rk)[3]};border:1px solid ${D.RANK_DEF.find(r=>r[0]===rk)[3]}55">${D.RANK_TEXT[rk]}</span>`; }
  /* Honor Rank — چیپ رنک برای کل سایت */
  function honorOfPid(pid){
    let u = null;
    try { u = loadUsers().find(x => x.pid === pid); } catch(e){}
    const pts = (A && A.LB) ? ((A.LB.find(r => r.pid === pid) || {}).pts || 0) : 0;
    return AV.honorOf(u ? u.user : ('pid' + pid), pts);
  }
  function honorChip(pid, mini){
    const hn = honorOfPid(pid); const r = hn.rank;
    return `<span class="rank-pill" style="display:inline-flex;align-items:center;gap:5px;background:${r.bg2}33;color:${r.title};border:1px solid ${r.border}66" title="${esc(r.fa)} — Level ${r.lv}">
      ${AV.badgeSVG(r, mini ? 15 : 18)}<span style="direction:ltr;font-size:${mini ? 10 : 11}px;font-weight:800">${esc(r.en)}</span></span>`;
  }
  function formChips(form){
    return `<div class="form-chips">${(form||[]).map(f => {
      const m = D.FORM_META[f];
      return m ? `<span class="${m.c}" title="${f}">${m.t}</span>` : `<span>—</span>`;
    }).join('')}</div>`;
  }
  function changeBadge(ch){
    if (ch > 0) return `<span class="chip green">▲ ${D.fa(ch)}</span>`;
    if (ch < 0) return `<span class="chip red">▼ ${D.fa(Math.abs(ch))}</span>`;
    return `<span class="chip dim">—</span>`;
  }
  const medal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : '';
  function pbar(pct, cls='', w=0){
    return `<div class="pbar ${cls}"><i data-w="${Math.min(100, Math.round(w || pct))}"></i></div>`;
  }

  /* ═══════════ تیلت سه‌بعدی ═══════════ */
  function initTilt(){
    $$('.tilt').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `perspective(900px) rotateY(${x*9}deg) rotateX(${-y*9}deg) translateZ(0)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  /* ═══════════ ذرات شناور ═══════════ */
  function initParticles(){
    const cv = $('#particles'); if (!cv) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d');
    let W, H, parts = [];
    function resize(){ W = cv.width = innerWidth; H = cv.height = innerHeight; }
    resize(); window.addEventListener('resize', resize);
    const colors = ['212,175,55', '30,187,138', '248,250,252'];
    for (let i = 0; i < 42; i++){
      parts.push({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*2.4+0.6,
        vy: -(Math.random()*0.35+0.08), vx: (Math.random()-0.5)*0.15,
        c: colors[i%3], a: Math.random()*0.5+0.2, tw: Math.random()*0.02+0.005 });
    }
    (function loop(){
      ctx.clearRect(0,0,W,H);
      parts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        p.a += (Math.random()-0.5) * 0.02;
        if (p.a < 0.08) p.a = 0.08; if (p.a > 0.75) p.a = 0.75;
        if (p.y < -10){ p.y = H+10; p.x = Math.random()*W; }
        if (p.x < -10) p.x = W+10; if (p.x > W+10) p.x = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 7);
        ctx.fillStyle = `rgba(${p.c},${p.a})`;
        ctx.shadowColor = `rgba(${p.c},.9)`; ctx.shadowBlur = 10;
        ctx.fill(); ctx.shadowBlur = 0;
      });
      requestAnimationFrame(loop);
    })();
  }

  /* ═══════════ ساعت و تاریخ ═══════════ */
  function tickClock(){
    const now = new Date();
    const j = D.jalaliInfo(now);
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const ss = String(now.getSeconds()).padStart(2,'0');
    const el = $('#hud-clock');
    if (el) el.textContent = `${D.fa(hh)}:${D.fa(mm)}:${D.fa(ss)}`;
    const dt = $('#hud-date');
    if (dt) dt.textContent = `${D.fa(j.dd)} ${j.monthFa} ${D.fa(j.yy)}`;
  }

  /* ═══════════ روتر ═══════════ */
  const PAGE_LABELS = {
    memberzone:['nav.memberzone','بخش اعضا'], cmd:['nav.cmd','فرماندهی'], race:['nav.race','رقابت فصل'],
    player:['nav.player','مرکز بازیکن'], match:['nav.match','فرماندهی مسابقه'], course:['nav.course','هوش زمین'],
    records:['nav.records','رکوردها'], cal:['nav.cal','تقویم فصل'], tv:['nav.tv','نمایش تلویزیونی'],
    battle:['nav.battle','میدان نبرد'], academy:['nav.academy','پنل آکادمی'], acourses:['nav.acourses','طراح زمین'],
    atournaments:['nav.atournaments','طراح مسابقه'], ascorecards:['nav.ascorecards','ثبت نتایج'],
    mgmt:['nav.mgmt','پنل مدیریت'], users:['nav.users','یوزرها'], settings:['nav.settings','تنظیمات نمایش'],
    avatarland:['nav.avatarland','سرزمین آواتارها'],
  };
  const PAGE_ICONS = { memberzone:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',cmd:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',race:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>',player:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',match:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',course:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M9 3 3 5.5v15L9 18l6 2.5 6-2.5v-15L15 5.5 9 3z"/><path d="M9 3v15"/><path d="M15 5.5v15"/></svg>',records:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',cal:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',tv:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',battle:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/></svg>',academy:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>',acourses:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',atournaments:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',ascorecards:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',mgmt:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',users:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',settings:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',avatarland:'<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' };
  const PAGES = {};
  function updatePageLabels(){
    Object.keys(PAGE_LABELS).forEach(pg => { PAGES[pg] = { t:L(PAGE_LABELS[pg][0], PAGE_LABELS[pg][1]), i:PAGE_ICONS[pg] }; });
  }
  updatePageLabels();
  let currentPage = 'cmd';
  let playerSel = 8, matchSel = 1, courseSel = 1, coursePlayerSel = 8;
  let playerTab = 'classic'; /* classic | smart — تب «بازیکن هوشمند» */

  const MEM_PAGE_KEY = { cmd:'memCmd', race:'memRace', player:'memPlayer', match:'memMatch',
    course:'memCourse', records:'memRecords', cal:'memCal', tv:'memTv', avatarland:'memAvatarLand' };
  const MEMBER_PAGE_ORDER = ['cmd','race','player','match','course','records','cal','tv','avatarland'];

  /* دسترسی سریع اعضا در موبایل — صفحات فعال دیگر داخل منوی کشویی پنهان نمی‌مانند. */
  function renderMemberMobileNav(rec, page){
    const nav = $('#member-mobile-nav');
    if (!nav) return;
    if (!rec || rec.role !== 'member'){
      nav.innerHTML = '';
      nav.classList.remove('ready');
      return;
    }
    const settings = MGMT.getSettings();
    const pages = ['memberzone'].concat(MEMBER_PAGE_ORDER.filter(pg => settings[MEM_PAGE_KEY[pg]]));
    nav.innerHTML = pages.map(pg => {
      const p = PAGES[pg];
      const active = pg === page;
      const title = p.t;
      return `<button type="button" class="member-mobile-link ${active?'active':''}" data-member-page="${pg}" aria-current="${active?'page':'false'}"><span>${p.i}</span><b>${esc(title)}</b></button>`;
    }).join('');
    nav.classList.add('ready');
    nav.querySelectorAll('[data-member-page]').forEach(b => b.addEventListener('click', () => {
      go(b.dataset.memberPage);
      closeNav();
    }));
    const active = nav.querySelector('.member-mobile-link.active');
    if (active) setTimeout(() => active.scrollIntoView({ behavior:'smooth', block:'nearest', inline:'center' }), 20);
  }

  function go(page){
    if (!PAGES[page]) page = 'cmd';
    const rec = userRec(currentUser);
    // اعضا: فقط بخش اعضا + آیتم‌هایی که مدیر در تنظیمات نمایش برایشان فعال کرده
    if (rec && rec.role === 'member'){
      const settings = MGMT.getSettings();
      if (page !== 'memberzone'){
        const key = MEM_PAGE_KEY[page];
        if (!key || !settings[key]) page = 'memberzone';
      }
      if (page === 'users' || page === 'mgmt' || page === 'settings') page = 'memberzone';
    }
    if (page === 'users' && !isMain(currentUser)) page = 'cmd';
    if (page === 'memberzone' && rec && rec.role !== 'member') page = 'cmd';
    currentPage = page;
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
    renderMemberMobileNav(rec, page);
    $('#view').innerHTML = '';
    const p = PAGES[page];
    $('#top-title').innerHTML = `${p.i} ${esc(p.t)}`;
    $('#top-crumb').textContent = page.startsWith('a') ? 'ابزار طراح / ' + p.t : L('group.dashboard','داشبورد') + ' / ' + p.t;
    RENDERERS[page]();
    // برای اعضا، دکمه‌های مدیریتی صفحات نمایشی مخفی می‌شوند
    if (rec && rec.role === 'member' && page !== 'memberzone'){
      setTimeout(() => {
        $('#view').querySelectorAll('[onclick]').forEach(b => {
          const o = b.getAttribute('onclick') || '';
          if (o.indexOf('mgmt') > -1 || o.indexOf('settings') > -1) b.style.display = 'none';
        });
      }, 60);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { initTilt(); runCountups(); growBars(); }, 40);
  }

  function runCountups(){
    $$('.countup').forEach(el => {
      const t = parseFloat(el.dataset.target);
      if (isNaN(t)) return;
      Charts.countUp(el, t, { fmt: v => el.dataset.fmt === 'fa' ? D.faNum(v, 0) : v.toLocaleString('en-US') });
    });
  }
  function growBars(){ $$('.pbar > i').forEach(el => { el.style.width = el.dataset.w + '%'; }); }

  /* ═══════════ صفحه: فرماندهی ═══════════ */
  function pageCmd(){
    const v = $('#view');
    const g = A.GOLD_COUNT;
    const top = A.LB.slice(0, 3);
    v.innerHTML = `
    <div class="glass gold-border" style="padding:0;overflow:hidden;margin-bottom:18px">
      <img src="assets/hero_main.webp" class="hero-pano" alt="">
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(11,15,20,.92));display:flex;flex-direction:column;justify-content:flex-end;padding:26px">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div>
            <h1 style="font-size:26px;font-weight:900" class="gold-text">آکادمی گلف ۱۴۰۵ — ${esc(L('nav.cmd','فرماندهی'))}</h1>
            <div style="color:var(--muted);font-size:12.5px;margin-top:4px">فصل قهرمانی ۱۴۰۵ • ${D.fa(A.MATCHES_HELD)} مسابقه برگزار شده • ${D.fa(A.LB.length)} بازیکن فعال</div>
          </div>
          <div style="margin-right:auto;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <button class="btn sm" onclick="APP.go('mgmt')" style="box-shadow:0 0 16px rgba(212,175,55,.25)">⚙️ ${esc(L('nav.mgmt','پنل مدیریت'))}</button>
            <button class="btn sm ghost" onclick="APP.go('settings')">🛠️ ${esc(L('nav.settings','تنظیمات نمایش'))}</button>
            <span class="chip gold">⏳ مسابقه بعدی: ${esc(A.NEXT_T ? A.NEXT_T[1] : '—')} — ${D.fa(A.COUNTDOWN)} روز</span>
            <span class="chip green">🔴 فصل در جریان است</span>
          </div>
        </div>
      </div>
    </div>
    <div class="grid cols-4" id="cmd-stats"></div>
    <div class="grid cols-3" style="margin-top:18px">
      <div class="glass tilt" style="grid-column:span 2">
        <div class="card-head"><span class="ic">🏆</span><h3>سکوی قهرمانی فصل</h3><span class="tag">FedEx Style</span></div>
        <div class="podium">
          ${[1,0,2].map(k => {
            const r = top[k];
            if (!r) return '';
            const hs = [1,0,2].indexOf(k) === 1 ? 100 : [1,0,2].indexOf(k) === 0 ? 62 : 40;
            return `<div class="step">
              <div class="medal">${['🥇','🥈','🥉'][k]}</div>
              <img src="${avatar(r.pid)}" class="avatar" style="border-color:${r.colorHex}" alt="">
              <div class="base ${k===1?'h2':k===2?'h3':''}" style="height:${hs+46}px">
                <div class="pname">${esc(r.name)}</div>
                <div class="ppts">${D.faNum(r.pts,0)} امتیاز</div>
                <div style="margin-top:4px">${rankPill(r.color)}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="glass tilt">
        <div class="card-head"><span class="ic">⚡</span><h3>قهرمانان فازها</h3><span class="tag">Phase</span></div>
        ${['بهار','تابستان'].map(ph => {
          const c = A.PHASE_CHAMP[ph];
          const maxP = Math.max(...Object.values(A.PHASE_PTS[ph]||{}), 1);
          return `<div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
              <b>🌸 فاز ${ph}</b><span style="color:var(--gold-l)">${esc(c.name)} — ${D.faNum(c.pts,0)} امتیاز</span>
            </div>
            ${pbar(c.pts/maxP*100, 'gold')}
          </div>`;
        }).join('')}
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center;font-size:12px;color:var(--muted)">
          <span>🔥 فرم قهرمان:</span>${formChips((A.CARDS[A.LB[0].pid]||[]).slice(-5).map(c=>c.result))}
        </div>
      </div>
    </div>
    <div class="grid cols-2" style="margin-top:18px">
      <div class="glass tilt">
        <div class="card-head"><span class="ic">📈</span><h3>امتیاز ماهانه فصل</h3><span class="tag">Monthly</span>
          <span style="margin-right:auto;display:flex;gap:6px;align-items:center">
            <select class="sel" id="cm-month" style="width:auto;padding:5px 10px;font-size:12px">
              ${['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'].map((m,i)=>`<option value="${i}">${m}</option>`).join('')}
            </select>
            <button class="btn sm ghost" id="cm-apply" style="padding:5px 12px">نمایش</button>
          </span>
        </div>
        <div class="chart-box short" id="cm-chart"><canvas id="ch-cmd-line"></canvas></div>
      </div>
      <div class="glass">
        <div class="card-head"><span class="ic">🏁</span><h3>رقابت زنده — ده نفر برتر</h3><span class="tag">Live</span></div>
        <table class="tbl"><thead><tr><th>#</th><th>بازیکن</th><th>رنک</th><th>امتیاز</th><th>تغییر</th><th>فرم</th></tr></thead><tbody>
        ${A.LB.slice(0,10).map(r => `<tr class="top${r.rank<=3?r.rank:0}">
          <td>${medal(r.rank)} ${D.fa(r.rank)}</td>
          <td><b>${esc(r.name)}</b>${r.streak>=2?' 🔥':''}</td>
          <td>${rankPill(r.color)}</td>
          <td class="num" style="color:var(--gold-l);font-weight:800">${D.faNum(r.pts,0)}</td>
          <td>${changeBadge(r.change)}</td>
          <td>${formChips(r.form)}</td>
        </tr>`).join('')}
        </tbody></table>
      </div>
    </div>`;
    const statsEl = $('#cmd-stats');
    const cards = [
      { ic:'🏌️', lbl:'بازیکنان فعال', val: A.LB.length, sub:'عضو آکادمی', col:'var(--gold-l)', fmt:'fa' },
      { ic:'🏆', lbl:'مجموع امتیاز فصل', val: A.TOT_PTS, sub:'ماهها: ' + A.MONTHLY_TOT.join('، '), col:'var(--green-l)', fmt:'fa' },
      { ic:'🥇', lbl:'مسابقات برگزار', val: A.MATCHES_HELD, sub:'در ' + D.COURSES.length + ' زمین', col:'var(--blue)', fmt:'fa' },
      { ic:'🎯', lbl:'جلسات تمرین', val: A.PRACTICE_DAYS, sub:'روز تمرین گروهی', col:'var(--purple)', fmt:'fa' },
      { ic:'📚', lbl:'دورههای آموزشی', val: A.COURSE_DAYS, sub:'کلاس و کارگاه', col:'var(--orange)', fmt:'fa' },
      { ic:'💎', lbl:'بازیکنان Gold Elite', val: g, sub:'بالای ' + D.fa(D.GOLD_ELITE) + ' امتیاز', col:'var(--gold)', fmt:'fa' },
      { ic:'⭐', lbl:'قهرمان ماه', val: 0, sub: A.champM ? `${A.champM} — ${esc(A.champName)}` : '—', col:'var(--teal)', fmt:'fa' },
      { ic:'🎖️', lbl:'میانگین هندیکپ', val: A.AVG_HCP, sub:'کل اعضا', col:'var(--red)', fmt:'num1' },
    ];
    if (!MGMT.getSettings().chCmd){ statsEl.innerHTML = `<div class="glass" style="grid-column:span 4;padding:14px;text-align:center;color:var(--muted)">نمودارهای ${esc(L('nav.cmd','فرماندهی'))} غیرفعال شده‌اند — از «${esc(L('nav.settings','تنظیمات نمایش'))}» فعال کنید</div>`; }
    else statsEl.innerHTML = cards.map((c,i) => `
      <div class="glass tilt stat">
        <span class="accent-bar" style="background:linear-gradient(90deg,${c.col},transparent)"></span>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="ic">${c.ic}</span>
          ${i===1 ? `<canvas id="sp-${i}" style="width:74px;height:30px"></canvas>` : ''}
        </div>
        <div class="val"><span class="countup" data-target="${c.val}" data-fmt="${c.fmt}">0</span></div>
        <div class="lbl">${c.lbl} — <span style="color:var(--dim)">${c.sub}</span></div>
      </div>`).join('');
    setTimeout(() => {
      if (MGMT.getSettings().chMonthly){
        drawMonthlyChart();
      } else {
        const c = $('#cm-chart');
        if (c) c.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:12.5px">نمودار ماهانه غیرفعال است — از ${esc(L('nav.settings','تنظیمات نمایش'))} فعال کنید</div>`;
      }
      A.MONTHLY_TOT.forEach((v,i) => Charts.spark($(`#sp-1`), A.MONTHLY_TOT.slice(0,i+1), '#1EBB8A'));
      const apply = $('#cm-apply');
      if (apply){
        apply.addEventListener('click', () => drawMonthlyChart());
      }
    }, 60);
  }

  function drawMonthlyChart(){
    const cv = $('#ch-cmd-line');
    if (!cv) return;
    const mi = +($('#cm-month') ? $('#cm-month').value : 0);
    const m = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'][mi];
    const A2 = A;
    // دادهٔ همان ماه از MONTH_PTS
    const mp = A2.MONTH_PTS[m] || {};
    const arr = Object.entries(mp).sort((a,b)=>b[1]-a[1]).slice(0,10);
    const hasData = arr.length > 0;
    if (!hasData){
      cv.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:12.5px">برای ماه ' + m + ' هنوز امتیازی ثبت نشده است.</div>';
      return;
    }
    const labels = arr.map(([pid,v]) => (A2.LB.find(r=>r.pid===+pid)||{}).name || '—');
    const vals = arr.map(([pid,v]) => v);
    Charts.barsV(cv, labels, vals, { color:'#E9C766', fmt:v=>D.faNum(v,0), title:'امتیاز ' + m });
  }

  /* ═══════════ صفحه: رقابت فصل ═══════════ */
  function pageRace(){
    const v = $('#view');
    if (!MGMT.getSettings().chRace){
      v.innerHTML = `<div class="glass" style="padding:30px;text-align:center;color:var(--muted)">🏁 نمودار ${esc(L('nav.race','رقابت فصل'))} غیرفعال است — از «${esc(L('nav.settings','تنظیمات نمایش'))}» فعال کنید</div>`;
      return;
    }
    const gold = A.LB.filter(r => r.rank <= 3).length;
    const play = A.LB.filter(r => r.rank > 3 && r.rank <= 8).length;
    const dev = A.LB.length - gold - play;
    v.innerHTML = `
    <div class="toolbar">
      <span class="lbl">🔍 جستجوی بازیکن:</span>
      <input class="input" id="race-q" placeholder="نام بازیکن…" style="min-width:220px">
      <div style="flex:1"></div>
      <span class="chip gold">🥇 قهرمانی (۱–۳) — ${D.fa(gold)}</span>
      <span class="chip blue">🎯 پلیآف (۴–۸) — ${D.fa(play)}</span>
      <span class="chip dim">🌱 توسعه (۹+) — ${D.fa(dev)}</span>
    </div>
    <div class="grid cols-3">
      <div class="glass tilt" style="grid-column:span 2">
        <div class="card-head"><span class="ic">🏁</span><h3>جدول ${esc(L('nav.race','رقابت فصل'))} ۱۴۰۵</h3><span class="tag">FedEx Cup</span></div>
        <div style="overflow-x:auto"><table class="tbl" id="race-tbl"><thead><tr>
          <th>#</th><th>بازیکن</th><th>رنک</th><th>امتیاز</th><th>پیشرفت طلایی</th><th>تغییر</th><th>برد</th><th>میانگین</th><th>پرنده</th><th>فرم</th>
        </tr></thead><tbody></tbody></table></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="glass">
          <div class="card-head"><span class="ic">💎</span><h3>مناطق واجد شرایط</h3><span class="tag">Lock / Open</span></div>
          ${[
            {n:'منطقه قهرمانی', c:'gold', v:gold, mx:3},
            {n:'منطقه پلیآف', c:'blue', v:play, mx:5},
            {n:'منطقه توسعه', c:'', v:dev, mx:A.LB.length-8},
          ].map(z => `<div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><b>${z.n}</b><b>${D.fa(z.v)}</b></div>
            ${pbar(z.v/z.mx*100, z.c)}
          </div>`).join('')}
          <div style="font-size:11px;color:var(--muted);margin-top:6px">سه نفر اول به جام بزرگ فصل راه دارند؛ رتبه ۴ تا ۸ در رقابت پلیآف.</div>
        </div>
        <div class="glass">
          <div class="card-head"><span class="ic">⚔️</span><h3>نبرد صدر جدول</h3><span class="tag">Top Race</span></div>
          <div style="display:flex;align-items:flex-end;gap:16px;justify-content:center;padding-top:8px">
            ${A.LB.slice(0,3).map(r => `
              <div style="text-align:center;flex:1">
                <img src="${avatar(r.pid)}" class="floaty" style="width:52px;height:52px;border-radius:50%;border:2px solid ${r.colorHex};box-shadow:0 0 18px ${r.colorHex}66;object-fit:cover">
                <div style="font-size:11.5px;font-weight:800;margin-top:6px">${esc(r.name)}</div>
                <div style="font-size:11px;color:var(--gold-l)">${D.faNum(r.pts,0)} امتیاز</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
    const tbody = $('#race-tbl tbody');
    const rows = A.LB.map(r => {
      const maxPts = A.LB[0].pts;
      return `<tr class="top${r.rank<=3?r.rank:0}" data-name="${esc(r.name)}">
        <td>${medal(r.rank)} ${D.fa(r.rank)}</td>
        <td><b>${esc(r.name)}</b>${r.streak>=2?' 🔥':''}<div style="margin-top:3px">${honorChip(r.pid, true)}</div></td>
        <td>${rankPill(r.color)}</td>
        <td class="num" style="color:var(--gold-l);font-weight:800">${D.faNum(r.pts,0)}</td>
        <td style="min-width:120px">${pbar(r.pts/maxPts*100, 'gold')}</td>
        <td>${changeBadge(r.change)}</td>
        <td class="num">${D.fa(r.win)}</td>
        <td class="num">${r.avg.toFixed(1)}</td>
        <td class="num" style="color:var(--green-l)">${D.fa(r.bird)}</td>
        <td>${formChips(r.form)}</td>
      </tr>`;
    }).join('');
    tbody.innerHTML = rows;
    $('#race-q').addEventListener('input', e => {
      const q = e.target.value.trim();
      $$('#race-tbl tbody tr').forEach(tr => {
        tr.style.display = !q || tr.dataset.name.includes(q) ? '' : 'none';
      });
    });
  }

  /* ═══════════ صفحه: مرکز بازیکن ═══════════ */
  function pagePlayer(){

  const v = $('#view');
    if (!MGMT.getSettings().chPlayer){
      v.innerHTML = `<div class="glass" style="padding:30px;text-align:center;color:var(--muted)">🏌️ نمودارهای ${esc(L('nav.player','مرکز بازیکن'))} غیرفعال است — از «${esc(L('nav.settings','تنظیمات نمایش'))}» فعال کنید</div>`;
      return;
    }
    const p = A.LB.find(r => r.pid === playerSel) || A.LB[0];
    const cards = A.CARDS[playerSel] || [];
    const sk = A.SKILLS[playerSel] || {scoring:0,birdie:0,consistency:0,practice:0,experience:0};
    const pt = A.PAR_TYPE[playerSel] || {};
    const dist = { w:0, p:0, b:0, d:0 };
    cards.forEach(c => { dist.w += c.birdies; dist.p += c.pars; dist.b += c.bogeys; dist.d += c.dbog; });
    const tot = Math.max(1, dist.w + dist.p + dist.b + dist.d);
    const goldP = Math.min(100, p.pts / D.GOLD_ELITE * 100);
    /* ── سوییچ «مرکز بازیکن / بازیکن هوشمند» ── */
    const SPARK_SVG = '<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l1.9 5.2L19.2 10l-5.3 1.8L12 17l-1.9-5.2L4.8 10 12 3z"/><path d="M18.5 14.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4z"/><path d="M6 15.5l.6 1.6 1.6.6-1.6.6L6 19.9l-.6-1.6-1.6-.6 1.6-.6.6-1.6z"/></svg>';
    const BARS_SVG = '<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>';
    const TABS = `
    <div class="seg" role="tablist" aria-label="بخش‌های مرکز بازیکن">
      <button type="button" class="seg-btn ${playerTab==='classic'?'on':''}" id="pl-tab-classic" role="tab" aria-selected="${playerTab==='classic'}">${BARS_SVG}<span>مرکز بازیکن</span></button>
      <button type="button" class="seg-btn ${playerTab==='smart'?'on':''}" id="pl-tab-smart" role="tab" aria-selected="${playerTab==='smart'}">${SPARK_SVG}<span>بازیکن هوشمند</span><span class="seg-new">جدید</span></button>
    </div>`;
    if (playerTab === 'smart'){ renderSmartPlayer(v, p, cards, TABS); return; }
    v.innerHTML = TABS + `
    <div class="toolbar">
      <span class="lbl">🏌️ بازیکن:</span>
      <select class="sel" id="pl-sel">${A.LB.map(r => `<option value="${r.pid}" ${r.pid===playerSel?'selected':''}>${esc(r.name)}</option>`).join('')}</select>
      <span class="lbl">⛳ مسابقه:</span>
      <select class="sel" id="pl-tour">${S.tournaments.filter(t => D.dateFrom(t[5]) < D.TODAY).map(t => `<option value="${t[0]}" ${t[0]===matchSel?'selected':''}>${esc(t[1])}</option>`).join('')}</select>
      <div style="flex:1"></div>
      ${honorChip(playerSel)}
      ${rankPill(p.color)}
    </div>
    <div class="grid cols-4" id="pl-stats" style="margin-bottom:18px"></div>
    <div class="grid cols-3">
      <div class="glass tilt">
        <div class="card-head"><span class="ic">🕸️</span><h3>رادار مهارت</h3><span class="tag">۰–۱۰۰</span></div>
        <div class="chart-box"><canvas id="pl-radar"></canvas></div>
      </div>
      <div class="glass">
        <div class="card-head"><span class="ic">🍩</span><h3>توزیع اسکور</h3><span class="tag">Per Hole</span></div>
        <div style="display:flex;align-items:center;gap:16px">
          <div class="chart-box short" style="flex:1"><canvas id="pl-donut"></canvas></div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:7px">
            ${[['پرنده','#1EBB8A',dist.w],['پار','#2E86DE',dist.p],['بوگی','#E67E22',dist.b],['دو بوگی','#E74C3C',dist.d]].map(([n,c,val]) =>
              `<div><span class="chip" style="background:${c}22;color:${c};border:1px solid ${c}55">${n}</span> <b>${D.fa(val)}</b> <small style="color:var(--dim)">${D.fa(Math.round(val/tot*100))}٪</small></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="glass">
        <div class="card-head"><span class="ic">💎</span><h3>پیشرفت Gold Elite</h3><span class="tag">${D.faNum(p.pts,0)} / ${D.fa(D.GOLD_ELITE)}</span></div>
        <div class="chart-box short"><canvas id="pl-gold"></canvas></div>
        <div style="text-align:center;font-size:12px;color:var(--muted)">${D.faNum(p.pts,0)} امتیاز — فاصله تا طلایی: ${D.fa(Math.max(0, D.GOLD_ELITE - p.pts))} امتیاز</div>
      </div>
      <div class="glass" style="grid-column:span 2">
        <div class="card-head"><span class="ic">📊</span><h3>امتیاز ماهانه</h3><span class="tag">Monthly</span></div>
        <div class="chart-box short"><canvas id="pl-month"></canvas></div>
      </div>
      <div class="glass">
        <div class="card-head"><span class="ic">📈</span><h3>تجمعی فصل</h3><span class="tag">Cumulative</span></div>
        <div class="chart-box short"><canvas id="pl-cum"></canvas></div>
      </div>
      <div class="glass" style="grid-column:span 3">
        <div class="card-head"><span class="ic">⛳</span><h3>ضربات حفرهبهحفره — مسابقه انتخابی</h3><span class="tag">Hole by Hole</span></div>
        <div class="chart-box"><canvas id="pl-holes"></canvas></div>
        <div id="pl-holes-tbl" style="margin-top:10px"></div>
      </div>
    </div>`;
    const stats = [
      ['🏆','امتیاز', p.pts, 'col:var(--gold-l)'], ['👑','برد', p.win, 'col:var(--gold)'],
      ['🥈','سکو', p.top3, 'col:var(--silver,var(--muted))'], ['⛳','مسابقات', p.matches, 'col:var(--blue)'],
      ['🎯','تمرین', p.prac, 'col:var(--purple)'], ['📚','آموزش', p.course, 'col:var(--orange)'],
      ['🐦','پرنده', p.bird, 'col:var(--green-l)'], ['📉','میانگین', p.avg, 'col:var(--red)'],
    ];
    $('#pl-stats').innerHTML = stats.map(([ic,lbl,val,col]) => `
      <div class="glass stat" style="min-height:92px">
        <div style="display:flex;align-items:center;gap:8px"><span class="ic" style="font-size:18px">${ic}</span><span class="lbl">${lbl}</span></div>
        <div class="val" style="font-size:22px"><span class="countup" data-target="${val}" data-fmt="fa">0</span></div>
      </div>`).join('');
    setTimeout(() => {
      Charts.radar($('#pl-radar'), ['اسکورینگ','پرندهسازی','ثبات','تمرین','تجربه'],
        [sk.scoring, sk.birdie, sk.consistency, sk.practice, sk.experience], { color:'#D4AF37' });
      Charts.donut($('#pl-donut'), [
        { value: dist.w, color:'#1EBB8A' }, { value: dist.p, color:'#2E86DE' },
        { value: dist.b, color:'#E67E22' }, { value: dist.d, color:'#E74C3C' },
      ], { glow:true });
      Charts.donut($('#pl-gold'), [{ value: goldP, color:'#D4AF37', glow:true }, { value: 100-goldP, color:'#18202D' }], { inner:0.7 });
      const mp = A.MONTHS_SEASON.map(m => (A.MONTH_PTS[m]||{})[p.pid] || 0);
      Charts.barsV($('#pl-month'), A.MONTHS_SEASON, mp, { color:'#1EBB8A', showVal:true, fmt:v=>D.faNum(v,0) });
      let acc = 0; const cum = mp.map(v => acc += v);
      Charts.line($('#pl-cum'), [cum], A.MONTHS_SEASON, { colors:['#E9C766'], fill:true, points:true, fmt:v=>D.faNum(v,0) });
      renderHoles(p);
    }, 80);
    $('#pl-sel').addEventListener('change', e => { playerSel = +e.target.value; go('player'); });
    $('#pl-tour').addEventListener('change', e => { matchSel = +e.target.value; go('player'); });
    bindPlayerTabs();
  }
  /* هندلر مشترک دو تب مرکز بازیکن */
  function bindPlayerTabs(){
    const bc = $('#pl-tab-classic'), bs = $('#pl-tab-smart');
    if (bc) bc.addEventListener('click', () => { if (playerTab !== 'classic'){ playerTab = 'classic'; go('player'); } });
    if (bs) bs.addEventListener('click', () => { if (playerTab !== 'smart'){ playerTab = 'smart'; go('player'); } });
  }
  /* ── بازیکن هوشمند — اسکلت صفحه (قابلیت‌ها به‌زودی تزریق می‌شوند) ── */
  function renderSmartPlayer(v, p, cards, TABS){
    const SPARK = '<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l1.9 5.2L19.2 10l-5.3 1.8L12 17l-1.9-5.2L4.8 10 12 3z"/><path d="M18.5 14.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4z"/><path d="M6 15.5l.6 1.6 1.6.6-1.6.6L6 19.9l-.6-1.6-1.6-.6 1.6-.6.6-1.6z"/></svg>';
    const CHART_SVG = '<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>';
    const SP_TYPE_FA = { Range:'رنج', Putting:'پاتینگ', Chipping:'چیپینگ', Approach:'اپروچ', 'On-Course':'روی زمین' };
    const SP_RES_FA = { straight:'صاف', slice:'سمت راست', hook:'سمت چپ', miss:'ضربه خراب' };
    const FEATS = [
      ['trend', 'تحلیل نقاط قوت و ضعف', 'استخراج خودکار الگوی بازی از روی کارت‌ها'],
      ['flag',  'پیشنهاد تمرین هوشمند', 'برنامه تمرینی شخصی‌سازی‌شده بر پایه آخرین عملکرد'],
      ['shield','مقایسه با رقبا', 'سنجش عملکرد در برابر هم‌رده‌های فصل'],
      ['clip',  'گزارش مربی خودکار', 'خلاصه آماده ارائه برای جلسات مربیگری'],
    ];
    const ICON = {
      trend:'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
      flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
      shield:'<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/>',
      clip:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    };
    const mkIc = k => '<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' + ICON[k] + '</svg>';
    /* نام بازیکن انتخاب‌شده در تولبار در این حالت هم معنادار است */
    const PLUS_SVG = '<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    const selBar = `
    <div class="toolbar">
      <span class="lbl">🏌️ بازیکن:</span>
      <select class="sel" id="pl-sel-smart">${A.LB.map(r => `<option value="${r.pid}" ${r.pid===p.pid?'selected':''}>${esc(r.name)}</option>`).join('')}</select>
      <button type="button" class="btn sm" id="sp-record">${PLUS_SVG} ثبت رکورد</button>
      <div style="flex:1"></div>
      ${honorChip(p.pid)}
    </div>`;
    v.innerHTML = TABS + selBar + `
    <div class="glass sp-hero">
      <div class="sp-icon">${SPARK}</div>
      <h2>بازیکن هوشمند <span class="seg-new">آلفا</span></h2>
      <p>دستیار تحلیل هوشمند <b style="color:var(--gold-l)">${esc(p.name)}</b> — این بخش آماده‌سازی شده و قابلیت‌های آن مرحله‌به‌مرحله فعال می‌شوند. داده‌های فعلی (امتیاز، کارت‌ها و روند فصل) به محض اتصال قابلیت‌ها، اینجا تحلیل می‌شوند.</p>
    </div>
    <div class="glass" id="sp-live">
      <div class="card-head"><span class="ic">${CHART_SVG}</span><h3>آنالیز آخرین ضربه‌ها — ${esc(p.name)}</h3><span class="tag gold">Live</span></div>
      <div id="sp-live-body"></div>
    </div>
    <div class="grid cols-4 sp-grid">
      ${FEATS.map(([ic, t, d]) => `
      <div class="glass sp-feat">
        <span class="ic">${mkIc(ic)}</span>
        <h4>${t}</h4>
        <p>${d}</p>
        <span class="sp-soon">به‌زودی</span>
      </div>`).join('')}
    </div>
    <div class="glass" style="padding:18px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:space-between">
      <div style="color:var(--muted);font-size:12.5px;line-height:1.9">💡 قابلیت موردنظرتان برای «بازیکن هوشمند» را به مدیر آکادمی اعلام کنید تا در اولویت فعال‌سازی قرار گیرد.</div>
      <button type="button" class="btn sm" id="sp-back">مشاهده تحلیل کلاسیک</button>
    </div>`;
    const sel = $('#pl-sel-smart');
    if (sel) sel.addEventListener('change', e => { playerSel = +e.target.value; go('player'); });
    const rec = $('#sp-record');
    if (rec) rec.addEventListener('click', () => {
      /* صفحهٔ تمام‌صفحهٔ مجزا برای ورود دیتا — ✕ فقط صفحه را می‌بندد، جلسهٔ باز پابرجاست */
      if (window.SMARTPLAY) SMARTPLAY.open({ A: A, S: S, D: D });
    });
    const back = $('#sp-back');
    if (back) back.addEventListener('click', () => { playerTab = 'classic'; go('player'); });
    bindPlayerTabs();
    renderSmartChart(p);
  }
  /* ── نمودار «آنالیز ضربه‌های کلاب» — همهٔ ضربه‌های بازیکن انتخابی با آخرین کلاب او؛ هر ستون رنگِ نتیجهٔ خودش ── */
  function renderSmartChart(p){
    const box = $('#sp-live-body'); if (!box) return;
    let shots = []; try { shots = JSON.parse(localStorage.getItem('ga_sp_shots') || '[]'); } catch(e){}
    let ssn = {};  try { ssn = JSON.parse(localStorage.getItem('ga_sp_sessions') || '{}'); } catch(e){}
    const mine = shots.filter(x => x.pid === p.pid).sort((a, b) => a.t - b.t);
    if (!mine.length){
      box.innerHTML = `<div style="padding:28px 16px;text-align:center;color:var(--muted);font-size:12.5px;line-height:2.1">
        هنوز ضربه‌ای برای <b style="color:var(--gold-l)">${esc(p.name)}</b> ثبت نشده است.<br>
        از دکمهٔ «ثبت رکورد» بالای صفحه، جلسه را شروع کنید — این نمودار بلافاصله زنده می‌شود ⛳</div>`;
      return;
    }
    const last = mine[mine.length - 1];
    const ses = ssn[last.sid];
    const typeMap = { Range:'رنج', Putting:'پاتینگ', Chipping:'چیپینگ', Approach:'اپروچ', 'On-Course':'روی زمین' };
    const resMap = { straight:'صاف', slice:'سمت راست', hook:'سمت چپ', miss:'ضربه خراب' };
    const resColor = { straight:'#1EBB8A', slice:'#2E86DE', hook:'#E67E22', miss:'#E74C3C' };
    /* پنجرهٔ نمایش: تا ۲۰ ضربه همه — بیشتر شد فقط ۲۰ ضربهٔ آخر */
    /* تحلیل‌ها (میانگین/میانگین‌صاف‌ها/بیشینه) همیشه روی کل ضربه‌ها */
    const ofClubAll = mine.filter(x => x.club === last.club);
    const MAX_BARS = 20;
    const off = Math.max(0, ofClubAll.length - MAX_BARS);
    const ofClub = ofClubAll.slice(off);
    const vals = ofClub.map(x => x.yds);
    const cols = ofClub.map(x => resColor[x.res] || '#8490A3');
    const allVals = ofClubAll.map(x => x.yds);
    const avg = allVals.reduce((a, b) => a + b, 0) / allVals.length;
    /* میانگین فقط ضربه‌های صاف — خط راهنمای طلایی روی همان نمودار */
    const st = ofClubAll.filter(x => x.res === 'straight');
    const stAvg = st.length ? st.reduce((a, b) => a + b.yds, 0) / st.length : null;
    /* تگ سربرگ = کلاب تحت تحلیل */
    const ttl = $('#sp-live h3'); if (ttl) ttl.textContent = `آنالیز ضربه‌های ${last.club} — ${p.name}`;
    const tg = $('#sp-live .tag'); if (tg){ tg.textContent = off > 0 ? `${D.fa(ofClubAll.length)} ضربه • نمایش ${D.fa(MAX_BARS)} تای آخر` : `${D.fa(ofClubAll.length)} ضربه`; tg.classList.add('gold'); }
    box.innerHTML = `<div class="chart-box short"><canvas id="sp-live-cv"></canvas></div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:9px;font-size:10.5px;color:var(--muted)">
        ${Object.keys(resMap).map(k => `<span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${resColor[k]};margin-left:4px;vertical-align:-1px"></i>${resMap[k]}</span>`).join('')}
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:center;margin-top:10px;font-size:11px;color:var(--muted)">
        <span style="background:rgba(233,199,102,.1);border:1px solid rgba(233,199,102,.3);border-radius:99px;padding:5px 12px">آخرین ضربه: <b style="color:var(--gold-l)">${esc(last.club)}</b> — ${D.faNum(last.yds,0)} یارد (${esc(resMap[last.res] || last.res)})</span>
        <span style="background:rgba(132,144,163,.08);border:1px solid var(--line-soft);border-radius:99px;padding:5px 12px">میانگین ${esc(last.club)}: <b>${D.faNum(avg,1)}</b> یارد</span>
        <span style="background:rgba(30,187,138,.1);border:1px solid rgba(30,187,138,.35);border-radius:99px;padding:5px 12px">میانگین صاف‌ها (${D.fa(st.length)} ضربه): <b style="color:var(--green-l)">${stAvg != null ? D.faNum(stAvg,1) : '—'}</b> یارد</span>
        <span style="background:rgba(132,144,163,.08);border:1px solid var(--line-soft);border-radius:99px;padding:5px 12px">بیشینه: <b>${D.faNum(Math.max(...allVals),0)}</b> یارد</span>
        ${ses ? `<span style="background:rgba(132,144,163,.08);border:1px solid var(--line-soft);border-radius:99px;padding:5px 12px">${esc(typeMap[ses.type] || ses.type)} — جلسه ${D.fa(ses.no)}</span>` : ''}
      </div>`;
    setTimeout(() => {
      const cv = $('#sp-live-cv'); if (!cv || typeof Charts === 'undefined') return;
      Charts.barsV(cv, ofClub.map((x, i) => D.fa(off + i + 1)), vals,
        { color: cols, showVal: true, valFmt: v => D.faNum(v, 0), fmt: v => D.faNum(v, 0),
          gap: Math.max(0.28, 0.62 - ofClub.length * 0.006),
          hline: stAvg != null ? { value: stAvg, color: '#1EBB8A', label: 'میانگین صاف‌ها: ' + D.faNum(stAvg, 0) + ' یارد' } : null });
    }, 70);
  }
  function renderHoles(p){
    const card = (A.CARDS[p.pid]||[]).find(c => c.tour === matchSel);
    const t = S.tournaments.find(t => t[0] === matchSel);
    const cv = $('#pl-holes'); if (!cv) return;
    if (!card || !t){
      cv.parentElement.innerHTML = '<div style="color:var(--muted);padding:20px">برای این بازیکن در این مسابقه کارتی ثبت نشده است.</div>';
      return;
    }
    const pars = D.parsOf(t[3]);
    const strokes = [], parsArr = [];
    for (let h = 1; h <= t[4]; h++){ strokes.push(card.strokes[h]); parsArr.push(pars[h-1]); }
    Charts.line(cv, [strokes, parsArr], parsArr.map((_,i)=>'ح'+D.fa(i+1)), {
      colors:['#E9C766','#2E86DE'], fill:true, points:true, min: Math.min(...parsArr)-2, max: Math.max(...strokes)+2,
    });
    $('#pl-holes-tbl').innerHTML = `
    <table class="tbl"><thead><tr><th>حفره</th>${parsArr.map((_,i)=>`<th>${D.fa(i+1)}</th>`).join('')}</tr></thead>
    <tbody><tr><td><b>پار</b></td>${parsArr.map(p2=>`<td class="num" style="color:var(--gold-l)">${D.fa(p2)}</td>`).join('')}</tr>
    <tr><td><b>ضربات</b></td>${strokes.map((s,i)=>{
      const c = s < parsArr[i] ? 'color:var(--green-l);font-weight:800' : s === parsArr[i] ? 'color:var(--white)' : 'color:#ff8f82;font-weight:800';
      return `<td class="num" style="${c}">${D.fa(s)}</td>`;
    }).join('')}</tr></tbody></table>
    <div style="margin-top:8px;font-size:11.5px;color:var(--muted)">
      مجموع: <b style="color:var(--white)">${D.fa(card.total)}</b> • در برابر پار: <b style="color:${card.vspar<=0?'var(--green-l)':'#ff8f82'}">${card.vspar>0?'+':''}${D.fa(card.vspar)}</b> • رتبه ${D.fa(card.rank)} • ${esc(card.result)}
    </div>`;
  }

  /* ═══════════ صفحه: فرماندهی مسابقه ═══════════ */
  function pageMatch(){

  if (!MGMT.getSettings().chMatch){
      v.innerHTML = `<div class="glass" style="padding:30px;text-align:center;color:var(--muted)">🥇 ${esc(L('nav.match','فرماندهی مسابقه'))} غیرفعال است — از «${esc(L('nav.settings','تنظیمات نمایش'))}» فعال کنید</div>`;
      return;
    }    const v = $('#view');
    const t = S.tournaments.find(x => x[0] === matchSel) || S.tournaments[0];
    const cards = S.scorecards.filter(c => c.tour === matchSel).map(c => {
      const pars = D.parsOf(t[3]);
      let bird = 0;
      for (let h = 1; h <= t[4]; h++) if (c.strokes[h] === pars[h-1]-1) bird++;
      const parTotal = pars.slice(0, t[4]).reduce((a,b)=>a+b,0);
      return { ...c, bird, par: parTotal, vspar: c.total - parTotal };
    }).sort((a,b) => a.total - b.total);
    const info = D.jalaliInfo(D.dateFrom(t[5]));
    const winner = cards[0];
    const totalBird = cards.reduce((a,c)=>a+c.bird,0);
    const avgVspar = cards.length ? Math.round(cards.reduce((a,c)=>a+c.vspar,0)/cards.length*100)/100 : 0;
    let hardest = null;
    const diff = A.HOLE_DIFF[matchSel] || {};
    Object.entries(diff).forEach(([h, d]) => { if (!hardest || d > hardest.d) hardest = { h: +h, d }; });
    v.innerHTML = `
    <div class="toolbar">
      <span class="lbl">🥇 مسابقه:</span>
      <select class="sel" id="mt-sel">${S.tournaments.map(x => `<option value="${x[0]}" ${x[0]===matchSel?'selected':''}>${esc(x[1])}</option>`).join('')}</select>
      <span class="chip gold">⛳ ${esc(D.COURSE_NAME[t[3]])}</span>
      <span class="chip blue">${D.fa(t[4])} حفره</span>
      <span class="chip purple">سطح ${D.fa(t[2])}</span>
      <span class="chip dim">${D.fa(info.dd)} ${info.monthFa} ${D.fa(info.yy)}</span>
      <div style="flex:1"></div>
      <span class="chip ${D.dateFrom(t[5]) >= D.TODAY ? 'blue' : 'green'}">${D.dateFrom(t[5]) >= D.TODAY ? 'آینده' : 'برگزار شده'}</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;border-radius:12px;border:1px solid rgba(212,175,55,.4);background:linear-gradient(90deg,rgba(212,175,55,.1),rgba(30,187,138,.06));font-size:12.5px;color:var(--text,#dfe8f2)">
      ⛳ <b style="color:#f0d989">قانون گلف:</b> برندهٔ مسابقه کسی است که ۱۸ حفره (مجموع پار ۷۲) را با <b style="color:#7ee8b8">کمترین ضربه</b> به پایان برساند — مثلاً ۶۵ ضربه نسبت به ۷۰ ضربه برنده است. پایین‌ترین مجموع = قهرمان.
    </div>
    <div class="grid cols-4" id="mt-stats" style="margin-bottom:18px"></div>
    <div class="grid cols-3">
      <div class="glass tilt" style="grid-column:span 2">
        <div class="card-head"><span class="ic">📋</span><h3>نتایج بازیکنان</h3><span class="tag">${esc(t[1])}</span></div>
        <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>رتبه</th><th>بازیکن</th><th>ضربات</th><th>پار</th><th>در برابر پار</th><th>پرنده</th><th>نتیجه</th><th>امتیاز</th></tr></thead><tbody>
        ${cards.map((c, i) => {
          const pl = A.LB.find(r => r.pid === c.pid) || { name: D.nameOf(c.pid), color:'White' };
          const rank = i+1;
          const pts = D.PTS_RULE[t[2]][Math.min(rank,4)-1];
          return `<tr class="top${rank<=3?rank:0}">
            <td>${medal(rank)} ${D.fa(rank)}</td>
            <td><b>${esc(pl.name)}</b></td>
            <td class="num" style="font-weight:800">${D.fa(c.total)}</td>
            <td class="num" style="color:var(--gold-l)">${D.fa(c.par)}</td>
            <td class="num" style="color:${c.vspar<=0?'var(--green-l)':'#ff8f82'};font-weight:800">${c.vspar>0?'+':''}${D.fa(c.vspar)}</td>
            <td class="num" style="color:var(--green-l)">${D.fa(c.bird)}</td>
            <td>${rank===1?'<span class="chip gold">قهرمان</span>':rank===2?'<span class="chip dim">دوم</span>':rank===3?'<span class="chip dim">سوم</span>':'<span class="chip dim">شرکتکننده</span>'}</td>
            <td class="num" style="color:var(--gold-l)">${D.fa(pts)}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="8" style="color:var(--muted)">هنوز نتیجه ثبت نشده است.</td></tr>'}
        </tbody></table></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="glass">
          <div class="card-head"><span class="ic">🐦</span><h3>پرندههای هر بازیکن</h3><span class="tag">Birdies</span></div>
          <div class="chart-box short"><canvas id="mt-bird"></canvas></div>
        </div>
        <div class="glass">
          <div class="card-head"><span class="ic">🌋</span><h3>سختترین حفرهها</h3><span class="tag">Avg vs Par</span></div>
          <div class="chart-box short"><canvas id="mt-hard"></canvas></div>
          ${hardest ? `<div style="margin-top:8px;font-size:12px;color:var(--muted)">سختترین: <b style="color:#ff8f82">حفره ${D.fa(hardest.h)}</b> — میانگین ${hardest.d>0?'+':''}${D.fa(hardest.d.toFixed(2))} نسبت به پار</div>` : ''}
        </div>
      </div>
    </div>`;
    const st = [
      ['👥','شرکتکنندگان', cards.length, 'var(--purple)'], ['👑','قهرمان', winner ? esc(A.LB.find(r=>r.pid===winner.pid)?.name || D.nameOf(winner.pid)) : '—', 'var(--gold)'],
      ['🏆','اسکور قهرمان', winner ? D.fa(winner.total) + ' ضربه' : '—', 'var(--gold-l)'], ['⛳','پار', D.fa(cards[0] ? cards[0].par : ''), 'var(--teal)'],
      ['🐦','کل پرندهها', totalBird, 'var(--green-l)'], ['🌋','سختترین حفره', hardest ? 'ح' + D.fa(hardest.h) : '—', 'var(--red)'],
      ['📉','میانگین vs پار', (avgVspar>0?'+':'') + D.fa(avgVspar.toFixed(2)), 'var(--blue)'], ['🏌️','میدان', D.fa(t[4]) + ' حفره', 'var(--orange)'],
    ];
    $('#mt-stats').innerHTML = st.map(([ic,lbl,val,col]) => `
      <div class="glass stat" style="min-height:88px">
        <div style="display:flex;align-items:center;gap:8px"><span class="ic" style="font-size:18px">${ic}</span><span class="lbl">${lbl}</span></div>
        <div class="val" style="font-size:21px;color:${col}">${val}</div>
      </div>`).join('');
    setTimeout(() => {
      const top8 = cards.slice(0, 8);
      Charts.barsH($('#mt-bird'), top8.map(c => D.nameOf(c.pid).slice(0,12)), top8.map(c => c.bird), { color:'#1EBB8A', showVal:true });
      const hs = Object.keys(diff).map(Number).sort((a,b)=>a-b);
      Charts.barsV($('#mt-hard'), hs.map(h=>'ح'+D.fa(h)), hs.map(h => diff[h]), {
        color:'#E74C3C', showVal:true, fmt:v=>(v>0?'+':'')+v.toFixed(1),
        max: Math.max(...hs.map(h=>diff[h]), 0.5) * 1.3,
      });
    }, 80);
    $('#mt-sel').addEventListener('change', e => { matchSel = +e.target.value; go('match'); });
  }

  /* ═══════════ صفحه: هوش زمین ═══════════ */
  function pageCourse(){

  if (!MGMT.getSettings().chCourse){
      v.innerHTML = `<div class="glass" style="padding:30px;text-align:center;color:var(--muted)">🗺️ نمودار ${esc(L('nav.course','هوش زمین'))} غیرفعال است — از «${esc(L('nav.settings','تنظیمات نمایش'))}» فعال کنید</div>`;
      return;
    }    const v = $('#view');
    const crs = S.courses.find(c => c[0] === courseSel) || S.courses[0];
    const pars = D.parsOf(crs[0]);
    const holes = crs[3];
    const stats = A.COURSE_STATS[crs[0]] || {};
    const pc = A.PLAYER_COURSE[coursePlayerSel] || {};
    const rounds = S.scorecards.filter(c => (S.tournaments.find(t=>t[0]===c.tour)||{}).course === crs[0]).length;
    const recs = (A.CARDS[coursePlayerSel]||[]).filter(c => c.course === crs[0]);
    const pl = A.LB.find(r => r.pid === coursePlayerSel);
    v.innerHTML = `
    <div class="toolbar">
      <span class="lbl">🗺️ زمین:</span>
      <select class="sel" id="cs-sel">${S.courses.map(c => `<option value="${c[0]}" ${c[0]===courseSel?'selected':''}>${esc(c[1])}</option>`).join('')}</select>
      <span class="lbl">🏌️ بازیکن:</span>
      <select class="sel" id="cs-pl">${A.LB.map(r => `<option value="${r.pid}" ${r.pid===coursePlayerSel?'selected':''}>${esc(r.name)}</option>`).join('')}</select>
      <div style="flex:1"></div>
      <span class="chip gold">${esc(crs[1])} — ${esc(crs[2])}</span>
      <span class="chip blue">${D.fa(holes)} حفره • پار ${D.fa(pars.slice(0,holes).reduce((a,b)=>a+b,0))}</span>
    </div>
    <div class="grid cols-4" id="cs-stats" style="margin-bottom:18px"></div>
    <div class="grid cols-3">
      <div class="glass" style="grid-column:span 2">
        <div class="card-head"><span class="ic">🌋</span><h3>سختی حفرهها در این زمین</h3><span class="tag">${esc(crs[1])}</span></div>
        <div class="chart-box tall"><canvas id="cs-hard"></canvas></div>
        <div style="margin-top:6px;font-size:11.5px;color:var(--muted)">قرمز = میانگین ضربات نسبت به پار در همه مسابقات این زمین • آبی = پار حفره</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="glass">
          <div class="card-head"><span class="ic">🏌️</span><h3>کارنامه ${pl ? esc(pl.name) : ''}</h3><span class="tag">Course Record</span></div>
          ${recs.length ? `<table class="tbl"><thead><tr><th>مسابقه</th><th>ضربات</th><th>vs پار</th><th>رتبه</th><th>نتیجه</th></tr></thead><tbody>
          ${recs.map(r => `<tr>
            <td>${esc(r.name)}</td><td class="num">${D.fa(r.total)}</td>
            <td class="num" style="color:${r.vspar<=0?'var(--green-l)':'#ff8f82'}">${r.vspar>0?'+':''}${D.fa(r.vspar)}</td>
            <td class="num">${D.fa(r.rank)}</td><td>${r.rank===1?'<span class="chip gold">قهرمان</span>':'<span class="chip dim">'+esc(r.result)+'</span>'}</td>
          </tr>`).join('')}</tbody></table>` : '<div style="color:var(--muted);font-size:12.5px">این بازیکن هنوز در این زمین مسابقهای نداشته است.</div>'}
        </div>
        <div class="glass">
          <div class="card-head"><span class="ic">🗺️</span><h3>میانگین بازیکن در زمینها</h3><span class="tag">Course Fit</span></div>
          <div class="chart-box short"><canvas id="cs-fit"></canvas></div>
        </div>
      </div>
    </div>`;
    const avgAll = rounds ? (() => {
      let s = 0, n = 0;
      S.scorecards.forEach(c => {
        const t = S.tournaments.find(x => x[0] === c.tour);
        if (t && t[3] === crs[0]){ s += c.total - pars.slice(0, t[4]).reduce((a,b)=>a+b,0); n++; }
      });
      return n ? Math.round(s/n*100)/100 : null;
    })() : null;
    const st = [
      ['⛳','پار کل', D.fa(pars.slice(0,holes).reduce((a,b)=>a+b,0)), 'var(--gold)'], ['🏌️','میدانها', D.fa(holes), 'var(--blue)'],
      ['👥','دورهای برگزار', D.fa(rounds), 'var(--orange)'], ['📉','میانگین vs پار', avgAll===null?'—':(avgAll>0?'+':'')+D.fa(avgAll.toFixed(2)), 'var(--green-l)'],
    ];
    $('#cs-stats').innerHTML = st.map(([ic,lbl,val,col]) => `
      <div class="glass stat" style="min-height:88px">
        <div style="display:flex;align-items:center;gap:8px"><span class="ic" style="font-size:18px">${ic}</span><span class="lbl">${lbl}</span></div>
        <div class="val" style="font-size:21px;color:${col}">${val}</div>
      </div>`).join('');
    setTimeout(() => {
      const hs = [];
      for (let h = 1; h <= holes; h++) hs.push(h);
      Charts.barsV($('#cs-hard'), hs.map(h=>'ح'+D.fa(h)), hs.map(h => stats[h] ?? 0), {
        color:'#E74C3C', showVal:true, fmt:v=>(v>0?'+':'')+v.toFixed(1), max: Math.max(1.2, ...hs.map(h=>stats[h]??0)) * 1.25,
      });
      const allCrs = S.courses.map(c => c[0]);
      Charts.barsH($('#cs-fit'), allCrs.map(c => esc(D.COURSE_NAME[c])), allCrs.map(c => pc[c] ?? 0), {
        color:'#9B59B6', showVal:true, valFmt:v=>(v>0?'+':'')+v.toFixed(1),
      });
    }, 80);
    $('#cs-sel').addEventListener('change', e => { courseSel = +e.target.value; go('course'); });
    $('#cs-pl').addEventListener('change', e => { coursePlayerSel = +e.target.value; go('course'); });
  }

  /* ═══════════ صفحه: رکوردها ═══════════ */
  function pageRecords(){

  if (!MGMT.getSettings().chRecords){
      v.innerHTML = `<div class="glass" style="padding:30px;text-align:center;color:var(--muted)">🎖️ ${esc(L('nav.records','رکوردها'))} غیرفعال است — از «${esc(L('nav.settings','تنظیمات نمایش'))}» فعال کنید</div>`;
      return;
    }    const v = $('#view');
    const bestPrac = A.LB.reduce((a,b) => b.prac > a.prac ? b : a);
    const bestCourse = A.LB.reduce((a,b) => b.course > a.course ? b : a);
    const mostWin = A.LB.reduce((a,b) => b.win > a.win ? b : a);
    const champs = [
      ['👑','قهرمان فصل', A.LB[0].name, D.faNum(A.LB[0].pts,0) + ' امتیاز', 'var(--gold)'],
      ['⭐','قهرمان ماه', A.champM ? (() => { const e = Object.entries(A.MONTH_PTS[A.champM]||{}).sort((a,b)=>b[1]-a[1])[0]; return e ? D.nameOf(+e[0]) : '—'; })() : '—', A.champM ? A.champM : '—', 'var(--green-l)'],
      ['🌸','فاز بهار', A.PHASE_CHAMP['بهار'].name, D.faNum(A.PHASE_CHAMP['بهار'].pts,0) + ' امتیاز', 'var(--blue)'],
      ['☀️','فاز تابستان', A.PHASE_CHAMP['تابستان'].name, D.faNum(A.PHASE_CHAMP['تابستان'].pts,0) + ' امتیاز', 'var(--orange)'],
      ['🥇','بیشترین برد', mostWin.name, D.fa(mostWin.win) + ' عنوان', 'var(--purple)'],
      ['🎯','بیشترین تمرین', bestPrac.name, D.fa(bestPrac.prac) + ' جلسه', 'var(--teal)'],
      ['📚','بیشترین آموزش', bestCourse.name, D.fa(bestCourse.course) + ' دوره', 'var(--gold-l)'],
      ['🔒','منطقه واجد شرایط', 'رتبههای ۱ تا ۳', 'جام بزرگ فصل', 'var(--red)'],
    ];
    v.innerHTML = `
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:18px">
      <img src="assets/trophy_3d.webp" class="floaty glow-img" style="width:110px;height:110px;border-radius:16px;object-fit:cover" alt="">
      <div>
        <h2 class="gold-text" style="font-size:24px;font-weight:900">تالار افتخارات ۱۴۰۵</h2>
        <div style="color:var(--muted);font-size:12.5px;margin-top:4px">${esc(L('nav.records','رکوردها'))} و قهرمانان فصل — Hall of Fame</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;border-radius:12px;border:1px solid rgba(212,175,55,.4);background:linear-gradient(90deg,rgba(212,175,55,.1),rgba(30,187,138,.06));font-size:12.5px;color:var(--text,#dfe8f2)">
      🏆 <b style="color:#f0d989">رکورد امتیاز گلف:</b> هر مسابقه ۱۸ حفره و پار ۷۲ است؛ <b style="color:#7ee8b8">کمترین مجموع ضربات برنده است</b> — رکورد فصل متعلق به کمترین ضربه در یک دور کامل است.
    </div>
    <div class="grid cols-4" id="rec-champs" style="margin-bottom:18px"></div>
    <div class="grid cols-3">
      <div class="glass tilt" style="grid-column:span 2">
        <div class="card-head"><span class="ic">🏅</span><h3>بهترین دورهای فصل</h3><span class="tag">Best Rounds</span></div>
        <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>#</th><th>بازیکن</th><th>مسابقه</th><th>مجموع</th><th>در برابر پار</th><th>پرنده</th></tr></thead><tbody>
        ${A.BEST_ROUNDS.slice(0,12).map((r,i) => `<tr class="${i===0?'top1':i===1?'top2':i===2?'top3':''}">
          <td>${medal(i+1)} ${D.fa(i+1)}</td><td><b>${esc(r.name)}</b></td><td style="color:var(--muted)">${esc(r.tour)}</td>
          <td class="num" style="font-weight:800">${D.fa(r.total)}</td>
          <td class="num" style="color:${r.vspar<=0?'var(--green-l)':'#ff8f82'};font-weight:800">${r.vspar>0?'+':''}${D.fa(r.vspar)}</td>
          <td class="num" style="color:var(--green-l)">${D.fa(r.bird)}</td>
        </tr>`).join('')}</tbody></table></div>
      </div>
      <div class="glass">
        <div class="card-head"><span class="ic">🏆</span><h3>سکوی فصل</h3><span class="tag">Champions</span></div>
        <div class="podium" style="transform:scale(.85);transform-origin:top center;padding:8px 0 0">
          ${[1,0,2].map(k => {
            const r = A.LB[k];
            const hs = k===0?70:46;
            return `<div class="step">
              <div class="medal">${['🥇','🥈','🥉'][k]}</div>
              <img src="${avatar(r.pid)}" class="avatar" style="border-color:${r.colorHex}">
              <div class="base ${k===1?'h2':k===2?'h3':''}" style="height:${hs}px">
                <div class="pname">${esc(r.name)}</div><div class="ppts">${D.faNum(r.pts,0)}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div style="text-align:center;font-size:11.5px;color:var(--dim);margin-top:6px">🥇🥈🥉 — مدالهای فصل</div>
      </div>
    </div>`;
    $('#rec-champs').innerHTML = champs.map(([ic,lbl,val,sub,col]) => `
      <div class="glass tilt" style="text-align:center;padding:18px">
        <div class="ic" style="font-size:26px;animation:float 5s ease-in-out infinite">${ic}</div>
        <div style="font-size:11px;color:var(--muted);margin:8px 0 4px;font-weight:700">${lbl}</div>
        <div style="font-size:15px;font-weight:900;color:${col}">${esc(val)}</div>
        <div style="font-size:10.5px;color:var(--dim)">${esc(sub)}</div>
      </div>`).join('');
  }

  /* ═══════════ صفحه: تقویم ═══════════ */
  function pageCal(){
    const v = $('#view');
    const MONTHS = D.MONTHS_FA;
    const DAYS_IN = [31,31,31,31,31,31,30,30,30,30,30,29];
    const WD = ['ش','ی','د','س','چ','پ','ج'];
    const TYPE_ICON = { 'مسابقه':'🏆', 'کلاس':'📚', 'تمرین':'🏌️', 'اردو':'🏕️' };
    const TYPES = ['مسابقه','کلاس','تمرین','اردو'];

    // ── ساخت رویدادها (فقط: مسابقه، کلاس، تمرین، اردو) ──
    const events = [];
    let eid = 0;
    const ev = o => events.push(Object.assign({ id: ++eid }, o));

    S.tournaments.forEach(t => {
      const d = D.dateFrom(t[5]);
      ev({ d, end: d, name: t[1], type: 'مسابقه', col: t[2]===1?'gold':t[2]===2?'green':'blue',
           kind: 'مسابقه', icon: '🏆', extra: `${esc(D.COURSE_NAME[t[3]]||'—')} • ${D.fa(t[4])} حفره` });
    });
    // تمرین هفتگی پنجشنبه: از ابتدای امسال تا پایان سال (همهٔ اعضا)
    (window.Data.thursdaysSeason ? Data.thursdaysSeason() : []).forEach(iso => {
      const d = D.dateFrom(iso);
      ev({ d, end: d, name: 'تمرین هفتگی پنجشنبه', type: 'تمرین', col: 'green', kind: 'تمرین', icon: '🏌️', extra: 'تمرین هفتگی — همهٔ اعضای آکادمی' });
    });
    // دوره‌های آموزشی / تمرین / اردو (از پنل مدیریت)
    (window.Data.loadPrograms ? Data.loadPrograms() : []).forEach(p => {
      const d = D.dateFrom(p.start || p.date || '');
      if (!d || isNaN(d)) return;
      const end = p.end ? D.dateFrom(p.end) : d;
      const type = TYPES.includes(p.type) ? p.type : 'کلاس';
      ev({ d, end, name: p.name || 'دوره', type, col: type==='تمرین'?'green':type==='اردو'?'orange':'purple', kind: type,
           icon: TYPE_ICON[type] || '📌', extra: p.info ? esc(String(p.info)).slice(0,50) : 'دورهٔ فصل' });
    });
    // رویدادهای سفارشی (فقط ۴ نوع مجاز — بقیه نمایش داده نمی‌شوند)
    (MGMT.customEvents()||[]).forEach(e => {
      const type = e.type || '';
      if (!TYPES.includes(type)) return;
      const d = D.dateFrom(e.date || e.start || '');
      if (!d || isNaN(d)) return;
      const end = e.end ? D.dateFrom(e.end) : d;
      ev({ d, end, name: e.name, type, col: 'blue', kind: type, icon: TYPE_ICON[type] || '📌',
           extra: 'رویداد سفارشی', schedule: e.schedule || null });
    });
    events.sort((a,b) => a.d - b.d);

    const nextIdx = Math.max(0, events.findIndex(e => e.d >= D.TODAY));
    let selIdx = nextIdx;
    let viewMonth = D.jalaliInfo(events[selIdx].d).mm;
    let filter = 'all';

    function jalMonthStart(mm){
      const base = new Date(Date.UTC(2026, 2, 21));
      const off = mm <= 6 ? (mm-1)*31 : 186 + (mm-7)*30;
      return new Date(base.getTime() + off*86400000);
    }
    function dstr(d){ return d.toISOString().slice(0,10); }
    function daysBetween(a, b){
      return Math.round((b - a) / 86400000) + 1;
    }

    v.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <img src="assets/ball_3d.webp" class="floaty fast glow-img green" style="width:64px;height:64px;border-radius:14px;object-fit:cover" alt="">
      <div>
        <div style="font-size:12px;color:var(--muted)">رویداد بعدی</div>
        <div style="font-size:19px;font-weight:900" class="gold-text">${TYPE_ICON[events[nextIdx].type]||'📌'} ${esc(events[nextIdx].name)}</div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:3px">${events[nextIdx].type} • ${D.fa(D.jalaliInfo(events[nextIdx].d).dd)} ${MONTHS[D.jalaliInfo(events[nextIdx].d).mm-1]}</div>
      </div>
      <div style="margin-right:auto;text-align:center">
        <div class="big-num gold-text">${D.fa(Math.max(0, Math.ceil((events[nextIdx].d - D.TODAY)/86400000)))}</div>
        <div style="font-size:11px;color:var(--muted)">روز تا شروع</div>
      </div>
      <div style="text-align:center;padding:0 16px">
        <div style="font-size:11px;color:var(--muted)">رویدادهای فصل</div>
        <div style="font-size:16px;font-weight:800" class="gold-text">${D.fa(events.length)} رویداد</div>
      </div>
        <button class="btn sm ghost" onclick="APP.go('mgmt')">⚙️ مدیریت ${esc(L('nav.cal','تقویم فصل'))}</button>
    </div>

    <div class="cal-main">
      <!-- لیست رویدادها -->
      <div class="glass cal-list-pane">
        <div class="card-head"><span class="ic">📋</span><h3>رویدادها</h3>
          <span style="margin-right:auto;display:flex;gap:5px;flex-wrap:wrap">
            ${['all', ...TYPES].map(f => `<button class="btn sm ghost cal-f ${f==='all'?'on':''}" data-f="${f}" style="padding:3px 8px;font-size:10.5px">${f==='all'?'همه':(TYPE_ICON[f]||'') + f}</button>`).join('')}
          </span>
        </div>
        <div id="cal-events-list" class="cal-events-list"></div>
      </div>
      <!-- تقویم ماه -->
      <div class="glass cal-grid-pane">
        <div class="card-head"><span class="ic">🇮🇷</span>
          <h3>تقویم <span id="cal-month-name"></span></h3>
          <span class="tag">فصل ۱۴۰۵</span>
          <div style="margin-right:auto;display:flex;gap:6px;align-items:center">
            <button class="btn sm ghost" id="cal-prev">▶</button>
            <button class="btn sm" id="cal-today" style="padding:4px 10px;font-size:11px">امروز</button>
            <button class="btn sm ghost" id="cal-next">◀</button>
          </div>
        </div>
        <div class="cal-legend">
          ${TYPES.map(t => `<span>${TYPE_ICON[t]} ${t}</span>`).join('')}
          <span class="hol-sel" style="border:1.5px dashed #D4AF37;border-radius:6px;padding:0 6px">رویداد انتخابی</span>
        </div>
        <div id="cal-grid" class="cal-grid-big" style="margin-top:10px"></div>
        <div id="cal-month-hols" class="cal-month-hols"></div>
      </div>
    </div>`;

    // ── لیست رویدادها ──
    function renderList(){
      const wrap = $('#cal-events-list'); if (!wrap) return;
      const list = events.filter(e => filter === 'all' || e.kind === filter);
      const future = list.filter(e => e.end >= D.TODAY);
      const past = list.filter(e => e.end < D.TODAY);
      const rows = [];
      const mk = (e, pastFlag) => {
        const j = D.jalaliInfo(e.d);
        const isSel = events[selIdx].id === e.id;
        const days = daysBetween(e.d, e.end);
        const range = days > 1 ? ` (${D.fa(days)} روز)` : '';
        return `<div class="cal-ev-item ${isSel?'sel':''} ${pastFlag?'past':''}" data-id="${e.id}">
          <div class="cal-ev-date">
            <div class="cal-ev-d">${D.fa(j.dd)}</div>
            <div class="cal-ev-m">${MONTHS[j.mm-1]}</div>
          </div>
          <div class="cal-ev-body">
            <b>${e.icon} ${esc(e.name)}</b>
            <div class="cal-ev-sub">${e.type}${range}${e.extra ? ' — ' + e.extra : ''}</div>
            ${e.schedule ? `<div class="cal-ev-sch">${e.schedule.map(s => `<span>${esc(s.label)}</span>`).join('')}</div>` : ''}
          </div>
          <span class="chip ${e.col}">${e.icon} ${e.kind}</span>
        </div>`;
      };
      future.slice(0, 60).forEach(e => rows.push(mk(e, false)));
      if (past.length) rows.push('<div class="cal-ev-group">برگزار شده</div>');
      past.slice(-30).forEach(e => rows.push(mk(e, true)));
      wrap.innerHTML = rows.join('') || '<div style="color:var(--muted);font-size:12px;padding:10px">رویدادی نیست.</div>';
      $$('#cal-events-list .cal-ev-item').forEach(it => it.addEventListener('click', () => {
        selIdx = events.findIndex(e => e.id === +it.dataset.id);
        if (selIdx < 0) selIdx = nextIdx;
        const e = events[selIdx];
        viewMonth = D.jalaliInfo(e.d).mm;
        renderList(); renderGrid(); renderMonthStats();
        const gp = document.querySelector('.cal-grid-pane');
        if (gp && gp.scrollIntoView) gp.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }));
    }

    // ── تقویم ماه ──
    function renderGrid(){
      const mm = viewMonth;
      $('#cal-month-name').textContent = MONTHS[mm-1] + ' ۱۴۰۵';
      const grid = $('#cal-grid'); if (!grid) return;
      const sel = events[selIdx];
      const selDays = new Set();
      if (sel){
        const j0 = D.jalaliInfo(sel.d), j1 = D.jalaliInfo(sel.end);
        if (j0.mm === mm && j0.yy === 1405){
          const n = daysBetween(sel.d, sel.end);
          for (let i=0;i<n;i++) selDays.add(j0.dd + i);
        }
      }
      const first = jalMonthStart(mm);
      const dow = first.getUTCDay();
      const daysInMonth = DAYS_IN[mm-1];
      let html = `<div class="cal-grid-big-row">${WD.map(w=>`<div class="cal-wd">${w}</div>`).join('')}</div>`;
      html += '<div class="cal-grid-big-row">';
      for (let i=0;i<dow;i++) html += '<div class="cal-cell empty"></div>';
      for (let d=1; d<=daysInMonth; d++){
        const isToday = (mm === D.jalaliInfo(D.TODAY).mm && d === D.jalaliInfo(D.TODAY).dd);
        const isSelDay = selDays.has(d);
        const dayEvs = events.filter(e => {
          const j0 = D.jalaliInfo(e.d);
          if (j0.yy !== 1405 || j0.mm !== mm) return false;
          const n = daysBetween(e.d, e.end);
          for (let i=0;i<n;i++){ if (j0.dd + i === d) return true; }
          return false;
        });
        const labels = dayEvs.map(e => `${e.icon} ${esc(e.name)}`);
        html += `<div class="cal-cell ${dayEvs.length?'has-ev':''} ${isSelDay?'sel':''} ${isToday?'today':''}" title="${esc(labels.join(' • '))}">
          <div class="cal-num">${D.fa(d)}</div>
          ${dayEvs.length ? `<div class="cal-ev-mini">${dayEvs.slice(0,3).map(e=>`<span class="cal-mini-ev ${e.kind}">${e.icon} ${esc(e.name)}</span>`).join('')}${dayEvs.length>3?'<span class="cal-mini-more">+'+D.fa(dayEvs.length-3)+'</span>':''}</div>` : ''}
        </div>`;
      }
      html += '</div>';
      grid.innerHTML = html;
    }

    // ── آمار ماه ──
    function renderMonthStats(){
      const mm = viewMonth;
      const cnt = events.filter(e => {
        const j0 = D.jalaliInfo(e.d);
        if (j0.yy !== 1405 || j0.mm !== mm) return false;
        const n = daysBetween(e.d, e.end);
        for (let i=0;i<n;i++){ if (j0.dd + i >= 1 && j0.dd + i <= DAYS_IN[mm-1]) return true; }
        return false;
      }).length;
      const hc = $('#cal-month-hols');
      if (hc) hc.innerHTML = `📅 رویدادهای این ماه: <b>${D.fa(cnt)}</b>`;
    }

    renderList(); renderGrid(); renderMonthStats();

    $('#cal-prev').addEventListener('click', () => {
      viewMonth = viewMonth === 1 ? 12 : viewMonth - 1;
      renderGrid(); renderMonthStats();
    });
    $('#cal-next').addEventListener('click', () => {
      viewMonth = viewMonth === 12 ? 1 : viewMonth + 1;
      renderGrid(); renderMonthStats();
    });
    $('#cal-today').addEventListener('click', () => {
      viewMonth = D.jalaliInfo(D.TODAY).mm;
      selIdx = nextIdx;
      renderList(); renderGrid(); renderMonthStats();
    });
    $$('#cal-events-list').forEach(()=>{});
    v.querySelectorAll('.cal-f').forEach(b => b.addEventListener('click', () => {
      filter = b.dataset.f;
      v.querySelectorAll('.cal-f').forEach(x => x.classList.toggle('on', x === b));
      renderList();
    }));
  }

  function pageTv(){

  if (!MGMT.getSettings().chTv){
      v.innerHTML = `<div class="glass" style="padding:30px;text-align:center;color:var(--muted)">📺 گرافیک ${esc(L('nav.tv','نمایش تلویزیونی'))} غیرفعال است — از «${esc(L('nav.settings','تنظیمات نمایش'))}» فعال کنید</div>`;
      return;
    }    const v = $('#view');
    const next = A.NEXT_T;
    v.innerHTML = `
    <div class="tv-wrap">
      <div class="glass" style="border-color:var(--line)">
        <div class="tv-screen">
          <img src="assets/course_pano.webp" class="bg" alt="">
          <div class="overlay"></div>
          <div class="content">
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
              <span class="live-badge">● LIVE</span>
              <span style="font-size:13px;color:var(--muted)">GolfAcademy 1405 • Season Broadcast</span>
              <div style="margin-right:auto;display:flex;gap:14px;flex-wrap:wrap">
                <span style="color:var(--muted);font-size:12px">🌬️ باد <b style="color:var(--white)">۱۲ km/h</b></span>
                <span style="color:var(--muted);font-size:12px">🌡️ دما <b style="color:var(--white)">۲۸°</b></span>
                <span style="color:var(--muted);font-size:12px">⛳ حفره <b style="color:var(--white)">۱۴</b></span>
              </div>
            </div>
            <div style="text-align:center;margin:26px 0 6px">
              <div style="font-size:34px;font-weight:900" class="gold-text">${next ? esc(next[1]) : 'جام بزرگ فصل'}</div>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">${next ? esc(D.COURSE_NAME[next[3]]) + ' • ' + D.fa(next[4]) + ' حفره' : ''}</div>
            </div>
            <table class="tbl" style="font-size:14px">
              <thead><tr><th>رتبه</th><th>بازیکن</th><th>رنک</th><th>امتیاز</th><th>بهترین دور</th><th>پرنده</th><th>فرم</th></tr></thead>
              <tbody>
              ${A.LB.slice(0,10).map(r => `<tr class="top${r.rank<=3?r.rank:0}" style="font-size:14px">
                <td style="font-size:17px;font-weight:900">${medal(r.rank)} ${D.fa(r.rank)}</td>
                <td><b style="font-size:15px">${esc(r.name)}</b>${r.streak>=2?' 🔥':''}</td>
                <td>${rankPill(r.color)}</td>
                <td class="num" style="color:var(--gold-l);font-weight:900;font-size:16px">${D.faNum(r.pts,0)}</td>
                <td class="num">${r.best_vspar===null?'—':(r.best_vspar>0?'+':'')+D.fa(r.best_vspar)}</td>
                <td class="num" style="color:var(--green-l)">${D.fa(r.bird)}</td>
                <td>${formChips(r.form)}</td>
              </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="ticker" style="margin-top:16px">
        <div class="track">
          ⚡ اخبار آکادمی: &nbsp; ${next ? esc(next[1]) + ' ' + D.fa(A.COUNTDOWN) + ' روز دیگر •' : ''} &nbsp; کلاس پوتینگ چهارشنبه • &nbsp; اردوی آمادهسازی جام بزرگ ۱۶ مهر • &nbsp; پرندهساز هفته: ${esc(A.LB[0].name)} • &nbsp; ${esc(A.LB[1].name)} با روند صعودی به صدر نزدیک میشود • &nbsp; فصل ۱۴۰۵ — رقابت تا جام بزرگ فصل ادامه دارد
        </div>
      </div>
      <div style="text-align:center;margin-top:14px;font-size:11px;color:var(--dim)">📺 این صفحه برای نمایش روی تلویزیون آکادمی طراحی شده است — برای حالت تمامصفحه F11 را بزنید</div>
    </div>`;
  }

  /* ═══════════ صفحه: میدان نبرد ═══════════ */
  function pageBattle(){
    const v = $('#view');
    const BT = window.Battle;
    if (!MGMT.getSettings().chBattle){
      v.innerHTML = `<div class="glass" style="padding:30px;text-align:center;color:var(--muted)">⚔️ ${esc(L('nav.battle','میدان نبرد'))} غیرفعال است — از «${esc(L('nav.settings','تنظیمات نمایش'))}» فعال کنید</div>`;
      return;
    }
    const B = (window.Battle && BT.ensure) ? BT.ensure() : null;
    if (!B || !B.teams.length){
      v.innerHTML = `<div class="glass" style="padding:30px;text-align:center;color:var(--muted)">⚔️ ${esc(L('nav.battle','میدان نبرد'))} — هنوز تیمی ساخته نشده است. از «پنل مدیریت ← نبرد میدانها» تیم و جدال بسازید.</div>`;
      return;
    }
    const teams = BT.standings();
    const PTS = (A && A.PTS) || {};
    teams.forEach(t => { t.seasonPts = t.members.reduce((a,pid)=>a+(PTS[pid]||0),0); });
    const matches = (B.matches || []).slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const maxT = Math.max(...teams.map(t=>t.pts), 1);
    const totalMembers = B.teams.reduce((a,t)=>a+(t.members||[]).length,0);
    v.innerHTML = `
    <div class="glass gold-border" style="display:flex;align-items:center;gap:16px;margin-bottom:18px;flex-wrap:wrap">
      <img src="assets/flag_3d.webp" class="floaty glow-img" style="width:70px;height:70px;border-radius:14px;object-fit:cover" alt="">
      <div>
        <h2 style="font-size:21px;font-weight:900" class="gold-text">${esc(L('nav.battle','میدان نبرد'))} — جدال تیمها</h2>
        <div style="color:var(--muted);font-size:12px;margin-top:3px">سبک لیگ جهانی LIV • ${D.fa(teams.length)} تیم × ${D.fa(totalMembers)} بازیکن</div>
      </div>
      <div style="margin-right:auto" class="chip ${B.settings.seasonEnabled?'green':'orange'}">${B.settings.seasonEnabled?'🔴 فصل در جریان':'نتیجه روی فصل اثر ندارد'}</div>
    </div>
    <div class="grid cols-2" style="margin-bottom:18px">
      ${teams.map(t => `
        <div class="glass tilt" style="border-color:${t.color}44">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <span style="font-size:32px;animation:float 5s ease-in-out infinite">${t.icon}</span>
            <div>
              <div style="font-size:16px;font-weight:900;color:${t.color}">${esc(t.name)}</div>
              <div style="font-size:11px;color:var(--muted)">${D.fa(t.win)} برد • ${D.fa(t.draw)} مساوی • ${D.fa(t.loss)} باخت — امتیاز جدال: <b style="color:var(--white)">${D.faNum(t.pts,0)}</b></div>
            </div>
            <div style="margin-right:auto;font-size:12px;color:var(--muted)">رتبه ${D.fa(t.rank)}</div>
          </div>
          ${pbar(t.pts/maxT*100, 'gold')}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
            ${t.members.map(m => {
              const rec = (A && A.LB && A.LB.find(r=>r.pid===m)) || { name: D.nameOf(m) };
              return `<div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.03);border:1px solid var(--line-soft);border-radius:11px;padding:7px 9px">
                <img src="${avatar(m)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid ${t.color}" alt="">
                <div style="min-width:0">
                  <div style="font-size:11.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(rec.name)}</div>
                  <div style="font-size:10px;color:${t.color}">${D.faNum(PTS[m]||0,0)} امتیاز فصل</div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`).join('')}
    </div>
    <div class="grid cols-2">
      <div class="glass">
        <div class="card-head"><span class="ic">🏆</span><h3>امتیاز تیمها</h3><span class="tag">Team Race</span></div>
        <div class="chart-box"><canvas id="bt-chart"></canvas></div>
      </div>
      <div class="glass">
        <div class="card-head"><span class="ic">🔥</span><h3>جدالهای نبرد</h3><span class="tag">${D.fa(matches.length)} جدال</span></div>
        ${matches.length ? matches.map(m => {
          if (!m.home || !m.away) return '';
          const hName = BT.teamName(m.home), aName = BT.teamName(m.away);
          const hIcon = BT.teamIcon(m.home), aIcon = BT.teamIcon(m.away);
          let mid, badge = '<span class="chip dim">برنامه</span>';
          if (m.status === 'done' && m.winner){
            mid = `<span style="font-size:13px;font-weight:900;direction:ltr">${D.faNum(m.homeScore,0)} - ${D.faNum(m.awayScore,0)}</span>`;
            badge = m.winner === 'home' ? `<span class="chip green">${esc(hName)} پیروز</span>`
                  : m.winner === 'away' ? `<span class="chip green">${esc(aName)} پیروز</span>`
                  : `<span class="chip gold">مساوی</span>`;
          } else {
            mid = '<span class="chip gold" style="flex:0 0 auto">VS</span>';
          }
          const dateTxt = m.date ? (D.isoToShamsi ? D.isoToShamsi(m.date) : m.date) : '—';
          return `<div style="display:flex;align-items:center;gap:8px;padding:11px 13px;border-radius:13px;margin-bottom:9px;background:rgba(255,255,255,.03);border:1px solid ${m.status==='done'?'var(--line-soft)':'rgba(231,76,60,.3)'}">
            <span style="font-size:18px">${esc(hIcon)}</span>
            <b style="flex:1;font-size:12px;color:${BT.teamColor(m.home)}">${esc(hName)}</b>
            ${mid}
            <b style="flex:1;text-align:right;font-size:12px;color:${BT.teamColor(m.away)}">${esc(aName)}</b>
            <span style="font-size:18px">${esc(aIcon)}</span>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
              <span style="font-size:10px;color:var(--dim);direction:ltr">${esc(dateTxt)}</span>
              ${badge}
            </div>
          </div>`;
        }).join('') : '<div style="color:var(--muted);font-size:12px;padding:10px">هنوز جدالی ثبت نشده است.</div>'}
      </div>
    </div>`;
    setTimeout(() => {
      if (typeof Charts !== 'undefined') Charts.barsH($('#bt-chart'), teams.map(t=>t.name), teams.map(t=>t.pts), { color:'#E9C766', showVal:true, valFmt:v=>D.faNum(v,0) });
    }, 80);
  }

  /* ═══════════ صفحه: سرزمین آواتارها ═══════════ */
  function avLandCfg(){
    const def = {
      sort:['spent','income','lv','join'],
      dir:{ spent:-1, income:-1, lv:-1, join:1 },
      club:[[1,5,'par'],[6,10,'birdie'],[11,15,'eagle']],
      onlySpenders:true, count:80,
    };
    try { return Object.assign(def, JSON.parse(localStorage.getItem('ga_avatarland_cfg') || '{}')); }
    catch(e){ return def; }
  }
  function avLandSave(cfg){ try { localStorage.setItem('ga_avatarland_cfg', JSON.stringify(cfg)); } catch(e){} }
  function avLandJoin(pid){
    pid = +pid;
    try { const b = D.loadPlayers().find(p => p[0] === pid); if (b) return b[4] || ''; } catch(e){}
    try { const cs = D.loadCustomPlayers(); const i = cs.findIndex((c,idx) => (9000+idx) === pid); if (i >= 0) return cs[i].join || ''; } catch(e){}
    return '';
  }
  function clubOf(lv, cfg){
    cfg = cfg || avLandCfg();
    const cl = cfg.club || [];
    for (let i=0;i<cl.length;i++){
      const a = cl[i][0], b = cl[i][1], id = cl[i][2];
      if (+lv >= +a && +lv <= +b) return id;
    }
    return 'par';
  }
  function avLandStats(){
    const cfg = avLandCfg();
    const users = (APP.users && APP.users.list ? APP.users.list() : []).filter(u => u.role === 'member' && u.active !== false);
    const out = [];
    users.forEach(u => {
      const pid = +u.pid; if (!pid) return;
      const gender = genderOfUser(u.user);
      const av = AV.avatarOf(u.user, gender);
      const c = AV.coinOf(u.user);
      const hn = AV.honorOf(u.user, ptsOfUser(u.user));
      const log = c.log || [];
      const income = log.filter(l => (+l.amount||0) > 0 && (String(l.source||'').indexOf('req:') === 0 || String(l.source||'') === 'admin')).reduce((a,l)=>a+(+l.amount||0),0);
      const spent = log.filter(l => (+l.amount||0) < 0).reduce((a,l)=>a+Math.abs(+l.amount||0),0);
      const purchased = (av.owned||[]).filter(id => { const it = AV.shopItem(id); return it && (+it.price||0) > 0; }).length;
      out.push({
        user:u.user, pid, name:(u.name || D.nameOf(pid) || u.user), gender,
        av, lv:hn.lv, rank:hn.rank, club:clubOf(hn.lv, cfg), income, spent, purchased, join:avLandJoin(pid),
      });
    });
    return out;
  }
  function avLandSort(list, cfg){
    const sort = cfg.sort || ['spent','income','lv','join'];
    const dir = cfg.dir || {};
    return list.slice().sort((a,b) => {
      for (let i=0;i<sort.length;i++){
        const k = sort[i];
        const d = (+dir[k] || 0) === 1 ? 1 : -1;
        if (k === 'join'){
          const cmp = String(a.join||'').localeCompare(String(b.join||''));
          if (cmp) return cmp * d;
          continue;
        }
        const av = (a[k] ?? 0), bv = (b[k] ?? 0);
        if (av === bv) continue;
        return (av - bv) * d;
      }
      return 0;
    });
  }
  function avLandHeroHtml(p, kind){
    if (!p) return `<div class="al-hero ${kind}"><div style="flex:1;text-align:center;color:var(--muted);padding:20px">هنوز آواتاری با معیار ${kind==='gold'?'خرج':'درآمد'} ثبت نشده است</div></div>`;
    const tag = kind === 'gold' ? '👑 سلطان استایل گلف' : '🏆 ثروتمندترین آواتار';
    const stat1 = kind === 'gold' ? `کل خرج‌کرده: <b style="color:#f6e27a">${D.faNum(p.spent,0)} 🪙</b>` : `درآمد کل: <b style="color:#5FE3B0">${D.faNum(p.income,0)} 🪙</b>`;
    return `<div class="al-hero ${kind}">
      <span class="${kind==='gold'?'al-hero-crown':'al-hero-trophy'}">${kind==='gold'?'👑':'🏆'}</span>
      <div class="al-hero-avatar">${AV.renderAvatarSVG(p.av.sel, { gender:p.gender, w:120, h:132 })}</div>
      <div style="flex:1;min-width:0">
        <div class="al-hero-name">${esc(p.name)}</div>
        <div class="al-hero-meta">${esc(p.rank.en)} • ${esc(p.rank.fa)} • سطح ${D.fa(p.lv)}</div>
        <div class="al-hero-stat"><span>${stat1}</span><span>${D.fa(p.purchased)} آیتم</span></div>
        <div class="al-hero-stat"><span>باشگاه:</span><span class="al-club ${p.club}">${p.club==='eagle'?'🦅 Eagle':p.club==='birdie'?'🐦 Birdie':'⛳ Par'}</span></div>
        <span class="al-hero-tag">${tag}</span>
      </div>
    </div>`;
  }
  function pageAvatarLand(){
    const v = $('#view');
    let cfg = avLandCfg();
    let list = avLandStats();
    if (cfg.onlySpenders) list = list.filter(m => m.spent > 0);
    list = avLandSort(list, cfg);
    const hero1 = list[0] || null;
    const byIncome = avLandSort(list, Object.assign({}, cfg, { sort:['income','spent','lv','join'], dir:Object.assign({}, cfg.dir, { income:-1 }) }));
    const hero2 = byIncome.find(m => m.user !== (hero1 && hero1.user)) || byIncome[0] || null;
    const heroUsers = new Set([ hero1 && hero1.user, hero2 && hero2.user ].filter(Boolean));
    const grid = list.filter(m => !heroUsers.has(m.user));
    const clubNames = { eagle:'🦅 Eagle Club', birdie:'🐦 Birdie Club', par:'⛳ Par Club' };
    const petals = Array.from({length:10}, (_,i) => `<span class="al-petal" style="left:${(i*9+4)%100}%;animation-duration:${(7+(i%5)).toFixed(1)}s;animation-delay:${(i*0.7).toFixed(1)}s"></span>`).join('');
    const clouds = `<span class="al-cloud" style="animation-duration:38s">☁️</span><span class="al-cloud" style="animation-duration:52s;animation-delay:8s;top:20px;font-size:38px;left:30%">☁️</span>`;
    v.innerHTML = `
    <div class="al-wrap">
      <div class="al-scene">
        <div class="al-sun-rays"></div>
        <div class="al-cloud" style="animation-duration:34s">☁️</div>
        <div class="al-cloud" style="animation-duration:50s;animation-delay:6s;top:22px;left:20%;font-size:38px">☁️</div>
        <div class="al-hills"></div>
        <div class="al-tree t1">🌸</div><div class="al-tree t2">🍃</div><div class="al-tree t3">🌳</div><div class="al-tree t4">🌸</div>
        <span class="al-tee" style="left:16%">🏌️</span>
        <div class="al-flag" style="left:62%"></div>
        <span class="al-tee" style="right:22%">⛳</span>
        <div class="al-lake"></div>
        <div class="al-path"></div>
        <div class="al-petals">${petals}</div>
      </div>
      <div class="al-banner">
        <div class="al-title-deco">🌹 ⛳ 🏌️</div>
        <div class="al-title">🌸 ${esc(L('nav.avatarland','سرزمین آواتارها'))} 🌸</div>
        <div class="al-subtitle">«اینجا خانه افتخارات، شخصیت و سبک زندگی گلف هر عضو آکادمی است.»</div>
      </div>
      <div class="al-hero-row">
        ${avLandHeroHtml(hero1, 'gold')}
        ${avLandHeroHtml(hero2, 'silver')}
      </div>
      <div class="al-toolbar">
        <select class="sel" id="al-sort" title="مرتب‌سازی">
          <option value="spent" ${cfg.sort[0]==='spent'?'selected':''}>بیشترین خرج</option>
          <option value="income" ${cfg.sort[0]==='income'?'selected':''}>بیشترین درآمد</option>
          <option value="lv" ${cfg.sort[0]==='lv'?'selected':''}>سطح بالاتر</option>
          <option value="join" ${cfg.sort[0]==='join'?'selected':''}>عضو قدیمی‌تر</option>
        </select>
        <select class="sel" id="al-clubfilter" title="باشگاه">
          <option value="">همه باشگاه‌ها</option>
          <option value="eagle">Eagle Club</option>
          <option value="birdie">Birdie Club</option>
          <option value="par">Par Club</option>
        </select>
        <span class="chip gold">${D.fa(grid.length + (hero1?1:0) + (hero2?1:0))} آواتار</span>
      </div>
      <div class="al-grid" id="al-grid"></div>
      <div class="al-empty" id="al-empty" style="display:none"></div>
    </div>`;
    const rankBase = (hero1?1:0)+(hero2?1:0)+1;
    function paintGrid(){
      const cf = $('#al-clubfilter').value;
      const g = grid.filter(m => !cf || m.club === cf);
      const box = $('#al-grid');
      const empty = $('#al-empty');
      if (!g.length){
        box.innerHTML = '';
        empty.style.display = 'block';
        empty.textContent = 'آواتاری با این فیلتر پیدا نشد. در «پنل مدیریت ← سرزمین آواتارها» می‌توانید قوانین مرتب‌سازی و باشگاه‌ها را تغییر دهید.';
        return;
      }
      empty.style.display = 'none';
      box.innerHTML = g.map((m,i) => `
        <div class="al-card">
          <span class="al-rank ${i<3?'top3':''}">${D.fa(i+rankBase)}</span>
          <div class="al-avatar">${AV.renderAvatarSVG(m.av.sel, { gender:m.gender, w:96, h:104 })}</div>
          <div class="al-card-name">${esc(m.name)}</div>
          <div class="al-card-lvl">سطح ${D.fa(m.lv)} • ${esc(m.rank.en)}</div>
          <div class="al-card-stat"><span>خرج</span><b>${D.faNum(m.spent,0)} 🪙</b></div>
          <div class="al-card-stat"><span>درآمد</span><b>${D.faNum(m.income,0)} 🪙</b></div>
          <div class="al-card-stat"><span>آیتم</span><b>${D.fa(m.purchased)}</b></div>
          <span class="al-club ${m.club}">${clubNames[m.club]||'Par Club'}</span>
        </div>`).join('');
    }
    paintGrid();
    $('#al-sort').addEventListener('change', e => {
      cfg.sort[0] = e.target.value;
      cfg.sort = [e.target.value].concat(cfg.sort.filter(k => k !== e.target.value));
      avLandSave(cfg); APP.go('avatarland');
    });
    $('#al-clubfilter').addEventListener('change', paintGrid);
  }

  /* ═══════════ صفحه: آکادمی ═══════════ */
  function pageAcademy(){
    const v = $('#view');
    const remain = S.tournaments.filter(t => D.dateFrom(t[5]) >= D.TODAY).length + 6;
    const kpis = [
      ['👥','بازیکنان فعال', A.LB.length, 'var(--gold)'], ['🏌️','مسابقات برگزار', A.MATCHES_HELD, 'var(--green-l)'],
      ['🎯','روزهای تمرین', A.PRACTICE_DAYS, 'var(--blue)'], ['📚','دورههای آموزشی', A.COURSE_DAYS, 'var(--purple)'],
      ['🐦','کل پرندهها', A.TOTAL_BIRD, 'var(--green-l)'], ['📅','رویدادهای باقیمانده', remain, 'var(--orange)'],
      ['💎','بازیکنان Gold Elite', A.GOLD_COUNT, 'var(--gold-l)'], ['📈','میانگین هندیکپ', A.AVG_HCP, 'var(--teal)'],
    ];
    const rc = D.RANK_DEF.slice().reverse();
    v.innerHTML = `
    <div class="grid cols-4" id="ac-kpis" style="margin-bottom:18px"></div>
    <div class="grid cols-3">
      <div class="glass">
        <div class="card-head"><span class="ic">🏅</span><h3>ترکیب رنکهای فصل</h3><span class="tag">Distribution</span></div>
        ${rc.map(rk => `
          <div style="margin-bottom:13px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
              <b style="color:${rk[3]}">${rk[1]} ${rk[0]==='Gold Elite'?'💎':''}</b><b>${D.fa(A.RANK_COUNT[rk[0]])} نفر</b>
            </div>
            ${pbar(A.RANK_COUNT[rk[0]]/A.LB.length*100, rk[0]==='Gold Elite'?'gold':rk[0]==='Red'?'red':rk[0]==='Blue'?'blue':'')}
          </div>`).join('')}
      </div>
      <div class="glass" style="grid-column:span 2">
        <div class="card-head"><span class="ic">🚀</span><h3>آکادمی در یک نگاه — پیام سرپرست</h3><span class="tag">Coach Desk</span></div>
        ${[
          `✅ فصل ۱۴۰۵ با ${D.fa(A.MATCHES_HELD)} مسابقه، ${D.fa(A.COURSE_DAYS)} کلاس و اردو در جریان است.`,
          `🏆 سه بازیکن برتر در منطقه قهرمانی هستند و به جام بزرگ فصل راه دارند.`,
          `🐦 میانگین پرنده در هر دور بازیکنان برتر به عدد قابل توجهی رسیده است — روند صعودی.`,
          `📌 پیشنهاد: دو جلسه تمرین شورت گیم برای بازیکنان سطح ۳ اضافه شود.`,
          `🎯 قهرمان ماه: ${esc(A.champM || '—')} — عملکرد برجسته در ${esc(A.champM || '')} ثبت شد.`,
        ].map((n,i) => `<div style="display:flex;gap:10px;padding:11px 14px;border-radius:13px;margin-bottom:9px;background:rgba(255,255,255,.03);border:1px solid var(--line-soft)">
          <div style="flex:1">${n}</div>${i===0?'<span class="chip green">بهروز</span>':''}
        </div>`).join('')}
      </div>
    </div>`;
    $('#ac-kpis').innerHTML = kpis.map(([ic,lbl,val,col]) => `
      <div class="glass tilt stat" style="min-height:100px">
        <span class="accent-bar" style="background:linear-gradient(90deg,${col},transparent)"></span>
        <span class="ic" style="font-size:22px">${ic}</span>
        <div class="val" style="color:${col};font-size:24px"><span class="countup" data-target="${val}" data-fmt="fa">0</span></div>
        <div class="lbl">${lbl}</div>
      </div>`).join('');
  }

  /* ═══════════ سکه، درخواست‌ها و آواتار اعضا (v6) ═══════════ */
  const coinData = () => AV.coinData();
  const coinOf = u => AV.coinOf(u);
  const addCoins = (u, a, s, n) => AV.addCoins(u, a, s, n);
  const spentCoins = (u, a, s, n) => AV.spendCoins(u, a, s, n);

  const COIN_RULES = [
    { id:'story',    ic:'📱', title:'استوری اینستاگرام با تگ کردن پیج آکادمی', amount:10, desc:'استوری خود را با @golfacademy.sa تگ کنید و لینک/توضیح را در درخواست بنویسید', every:1 },
    { id:'post1k',   ic:'🎬', title:'پست / ریلز اینستاگرام — ویدیو با ۱۰۰۰+ بازدید', amount:30, desc:'پست ویدیویی با تگ آکادمی (تک یا مشترک با پیج آکادمی)', every:1 },
    { id:'post2k',   ic:'🎥', title:'پست / ریلز اینستاگرام — ویدیو با ۲۰۰۰+ بازدید', amount:50, desc:'ویدیو بالای ۲۰۰۰ بازدید با تگ آکادمی', every:1 },
    { id:'refer',    ic:'🤝', title:'معرفی عضو جدید به آکادمی', amount:50, desc:'نام عضو معرفی‌شده را در توضیح درخواست بنویسید', every:0 },
    { id:'practice', ic:'🏌️', title:'حضور در تمرین هفتگی پنجشنبه', amount:5, desc:'حضور کامل در جلسهٔ تمرین گروهی آکادمی', every:1 },
    { id:'enter',    ic:'🏆', title:'شرکت در مسابقهٔ ماهانه', amount:5, desc:'شرکت در هر مسابقهٔ رسمی فصل', every:0 },
  ];
  const COIN_AUTO = [
    { lvl:1, rank:1, amount:20, label:'قهرمان مسابقهٔ سطح ۱' },
    { lvl:2, rank:1, amount:15, label:'قهرمان مسابقهٔ سطح ۲' },
    { lvl:3, rank:1, amount:10, label:'قهرمان مسابقهٔ سطح ۳' },
  ];
  /* ══ سکه‌های خودکار مسابقات (v7) ══
     ذخیره نمی‌شوند؛ همیشه از روی «نتایج فعلی» محاسبه می‌شوند.
     → حذف مسابقه یا تغییر قهرمان = کم/زیاد شدن فوری موجودی سکهٔ همان عضو. */
  function autoCoinsOf(user){
    const out = { total: 0, items: [] };
    try {
      const pid = (userRec(user) || {}).pid;
      if (!pid) return out;
      const results = (D && D.loadResults) ? D.loadResults() : {};
      Object.keys(results || {}).forEach(tid => {
        const t = (S.tournaments || []).find(x => +x[0] === +tid);
        if (!t) return;
        const r = results[tid] || {};
        if (r.active === false) return;
        const top = r.top || {};
        COIN_AUTO.forEach(rule => {
          if (+t[2] !== rule.lvl) return;
          if (+top[rule.rank] !== +pid) return;
          out.total += rule.amount;
          out.items.push({ tid: +tid, title: t[1], lvl: +t[2], amount: rule.amount, label: rule.label });
        });
      });
    } catch(e){}
    return out;
  }
  AV.setAutoProvider(autoCoinsOf);
  /* سکه‌های خودکارِ هر بازیکن (برای پنل مدیریت) */
  window.APP_AUTOCOINS = autoCoinsOf;
  /* وضعیت هر فعالیت برای کاربر: can | pending | done | done-today */
  function ruleState(user, ruleId){
    const rule = COIN_RULES.find(r => r.id === ruleId);
    const today = new Date().toISOString().slice(0,10);
    const rs = AV.reqsOf(user).filter(r => r.ruleId === ruleId);
    const pend = rs.find(r => r.status === 'pending');
    if (pend) return { s:'pending', req: pend };
    const oks = rs.filter(r => r.status === 'ok');
    if (rule && rule.every === 1){
      if (oks.some(r => r.date === today)) return { s:'done-today' };
    } else if (oks.length) return { s:'done' };
    const rej = rs.find(r => r.status === 'no');
    return { s:'can', rej: rej || null };
  }
  function canClaim(user, ruleId){ return ruleState(user, ruleId).s === 'can'; }
  /* امتیاز فصل عضو (مبنای Honor Rank) */
  function ptsOfUser(user){
    const rec = userRec(user) || {};
    if (!rec.pid || !A || !A.LB) return 0;
    const row = A.LB.find(r => r.pid === rec.pid);
    return row ? row.pts : 0;
  }
  function genderOfUser(user){
    const rec = userRec(user) || {};
    try {
      const p = rec.pid ? S.players.find(x => x[0] === rec.pid) : null;
      if (p && p[2] === 'زن') return 'f';
    } catch(e){}
    return 'm';
  }
  function honorOfUser(user){ return AV.honorOf(user, ptsOfUser(user)); }
  function updateCoinBadge(){
    const el = $('#mz-coin-n');
    if (el) el.textContent = D.fa(coinOf(currentUser).total);
  }

  /* ═══════════ صفحه: بخش اعضا ═══════════ */
  let memTab = 'home';
  let shopCat = 'shirt';
  function pageMemberZone(){
    const v = $('#view');
    const rec = userRec(currentUser) || {};
    const name = rec.name || currentUser;
    const pid = rec.pid;
    const row = pid && A && A.LB ? A.LB.find(r => r.pid === pid) : null;
    const coin = coinOf(currentUser);
    const c = coin.total;
    const hn = honorOfUser(currentUser);
    const tabs = [
      ['home','🏠',L('member.home','خانهٔ من')], ['earn','🪙',L('member.earn','دریافت سکه')],
      ['guide','📜',L('member.guide','راهنمای سکه')], ['avatar','🎨',L('member.avatar','ساخت آواتار')],
    ];
    v.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px;padding:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="width:74px;height:74px;border-radius:50%;overflow:hidden;border:3px solid ${hn.rank.border};box-shadow:0 0 26px -4px ${hn.rank.glow};display:flex;align-items:flex-end;justify-content:center;background:radial-gradient(120% 80% at 50% 0%, ${hn.rank.bg3}, ${hn.rank.bg1})">
        ${AV.renderAvatarSVG(AV.avatarOf(currentUser, genderOfUser(currentUser)).sel, { gender: AV.avatarOf(currentUser).gender, w:66, h:110 })}
      </div>
      <div style="flex:1;min-width:180px">
        <h2 class="gold-text" style="font-size:21px;font-weight:900">👤 ${esc(L('nav.memberzone','بخش اعضا'))}</h2>
        <div style="color:var(--muted);font-size:12.5px;margin-top:4px">خوش آمدید، <b style="color:var(--white)">${esc(name)}</b> — رنک شما:
          <b style="color:${hn.rank.title}">${esc(hn.rank.en)}</b> <span style="opacity:.8">(${esc(hn.rank.fa)} • Level ${D.fa(hn.lv)})</span></div>
      </div>
      <div class="coin-chip" id="mz-coin" style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:40px;background:linear-gradient(135deg,#f6e27a,#d4af37);color:#0B0F14;font-weight:900;font-size:16px;box-shadow:0 6px 20px rgba(212,175,55,.45)">
        🪙 <span id="mz-coin-n">${D.fa(c)}</span>
      </div>
    </div>
    <div class="mgmt-tabs" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      ${tabs.map(t => `<div class="mgmt-tab ${memTab===t[0]?'on':''}" data-mtab="${t[0]}">${t[1]} ${esc(t[2])}</div>`).join('')}
    </div>
    <div id="mz-body"></div>`;
    v.querySelectorAll('[data-mtab]').forEach(t => t.addEventListener('click', () => { memTab = t.dataset.mtab; pageMemberZone(); }));
    const body = $('#mz-body');
    if (memTab === 'home') memHome(body, { rec, name, pid, row, coin, hn });
    else if (memTab === 'earn') memEarn(body, { coin });
    else if (memTab === 'guide') memGuide(body, { hn });
    else if (memTab === 'avatar') memAvatar(body, { coin, hn, name });
    /* انیمیشن ارتقاء رنک — اگر سطح عضو بالا رفته باشد */
    const oldLv = AV.checkRankUp(currentUser, hn.lv);
    if (oldLv) setTimeout(() => {
      const card = document.getElementById('mz-card');
      if (card){ AV.playRankUp(card, oldLv, hn.lv); toast('🎉 ارتقاء رنک! اکنون ' + hn.rank.en + ' — ' + hn.rank.fa, 'green'); }
    }, 700);
  }

  /* ── کارت رنک عضو ── */
  function honorCardHTML(user, name, size, id){
    const av = AV.avatarOf(user, genderOfUser(user));
    return AV.rankCard({ user, name, sel: av.sel, gender: av.gender, honor: honorOfUser(user), size: size || 'md', id: id || '' });
  }
  function honorProgHTML(hn){
    if (!hn.next) return `<div style="font-size:11.5px;color:var(--muted);margin-top:8px">به بالاترین رنک آکادمی رسیده‌اید 👑</div>`;
    return `
      <div style="margin-top:10px;font-size:11.5px;color:var(--muted);display:flex;justify-content:space-between">
        <span>تا رنک بعدی: <b style="color:${hn.next.title}">${esc(hn.next.en)}</b></span>
        <span>${D.fa(Math.round(hn.pts))} / ${D.fa(hn.next.pts)} امتیاز</span>
      </div>
      <div class="pbar gold" style="margin-top:6px"><i style="width:${Math.round(hn.prog)}%"></i></div>`;
  }

  function memHome(body, o){
    const s = MGMT.getSettings();
    const enabled = [];
    Object.keys(MEM_PAGE_KEY).forEach(pg => { if (s[MEM_PAGE_KEY[pg]]) enabled.push(pg); });
    const names = Object.fromEntries(MEMBER_PAGE_ORDER.map(pg => [pg, PAGES[pg].t]));
    const pend = AV.reqsOf(currentUser).filter(r => r.status === 'pending').length;
    body.innerHTML = `
    <div class="grid cols-3">
      <div class="glass" style="text-align:center">
        <div class="card-head"><span class="ic">🏅</span><h3>کارت رنک من</h3><span class="tag">Honor Rank</span></div>
        <div style="margin-top:10px;display:flex;justify-content:center">${honorCardHTML(currentUser, o.name, 'md', 'mz-card')}</div>
        ${honorProgHTML(o.hn)}
      </div>
      <div class="glass tilt">
        <div class="card-head"><span class="ic">🏌️</span><h3>وضعیت من در فصل</h3><span class="tag">۱۴۰۵</span></div>
        ${o.row ? `
          <div style="display:flex;justify-content:space-between;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px"><span style="color:var(--muted)">رتبه در فصل</span><b class="gold-text">${D.fa(o.row.rank)}</b></div>
          <div style="display:flex;justify-content:space-between;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px"><span style="color:var(--muted)">امتیاز فصل</span><b class="gold-text">${D.faNum(o.row.pts,0)}</b></div>
          <div style="display:flex;justify-content:space-between;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px"><span style="color:var(--muted)">مسابقات</span><b>${D.fa(o.row.matches)}</b></div>
          <div style="display:flex;justify-content:space-between;padding:9px 12px;font-size:13px"><span style="color:var(--muted)">برد</span><b>${D.fa(o.row.win)}</b></div>
        ` : `<div style="color:var(--muted);font-size:12.5px;padding:8px">اطلاعات شما در جدول فصل ثبت نشده است.</div>`}
        <div style="margin-top:12px;padding:11px 13px;border-radius:13px;background:linear-gradient(135deg,rgba(212,175,55,.16),rgba(212,175,55,.05));border:1px solid rgba(212,175,55,.35);font-size:12.5px;text-align:center">
          🪙 موجودی سکهٔ شما: <b class="gold-text" style="font-size:16px">${D.fa(o.coin.total)}</b>
        </div>
        ${pend ? `<div style="margin-top:9px;font-size:11.5px;color:#ffcf6b;text-align:center">⏳ ${D.fa(pend)} درخواست سکهٔ شما در انتظار تأیید مدیریت است</div>` : ''}
      </div>
      <div class="glass">
        <div class="card-head"><span class="ic">🗂️</span><h3>بخش‌های فعال‌شده برای شما</h3><span class="tag">دسترسی‌ها</span></div>
        ${enabled.length ? `
          <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:10px">
            ${enabled.map(pg => `<button class="btn sm ghost" data-mgo="${pg}" style="font-size:12px">${esc(names[pg])}</button>`).join('')}
          </div>
          <div style="font-size:11.5px;color:var(--muted);margin-top:10px;line-height:1.9">این بخش‌ها فقط جنبهٔ نمایشی دارند؛ برای ویرایش به مدیر آکادمی مراجعه کنید.</div>
        ` : `<div style="color:var(--muted);font-size:12.5px;padding:10px;line-height:2">هنوز بخشی برای شما فعال نشده است — <b style="color:var(--gold-l)">مدیر آکادمی</b> در «${esc(L('nav.settings','تنظیمات نمایش'))} ← ${esc(L('nav.memberzone','بخش اعضا'))}» تصمیم می‌گیرد کدام بخش‌ها را ببینید.</div>`}
        <div class="card-head" style="margin-top:14px"><span class="ic">🎯</span><h3>راه‌های سریع</h3></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
          <button class="btn sm" data-mtabgo="earn">🪙 ${esc(L('member.earn','دریافت سکه'))}</button>
          <button class="btn sm ghost" data-mtabgo="avatar">🎨 ${esc(L('member.avatar','ساخت آواتار'))}</button>
          <button class="btn sm ghost" data-mtabgo="guide">📜 ${esc(L('member.guide','راهنمای سکه'))}</button>
        </div>
      </div>
    </div>`;
    body.querySelectorAll('[data-mgo]').forEach(b => b.addEventListener('click', () => { APP.go(b.dataset.mgo); }));
    body.querySelectorAll('[data-mtabgo]').forEach(b => b.addEventListener('click', () => { memTab = b.dataset.mtabgo; pageMemberZone(); }));
  }

  /* ── تب دریافت سکه: ارسال درخواست به مدیریت ── */
  function memEarn(body, o){
    const c = coinOf(currentUser);
    const auto = c.autoItems || [];
    let rows = '';
    COIN_RULES.forEach(r => {
      const st = ruleState(currentUser, r.id);
      const btn = st.s === 'can'
        ? `<button class="btn sm" data-req="${r.id}">ارسال درخواست</button>`
        : st.s === 'pending'
          ? `<button class="btn sm ghost" data-req="${r.id}" disabled>در انتظار تأیید ⏳</button>`
          : `<button class="btn sm ghost" data-req="${r.id}" disabled>${st.s === 'done-today' ? 'امروز ثبت شد ✓' : 'ثبت شد ✓'}</button>`;
      rows += `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);margin-bottom:9px;flex-wrap:wrap">
        <span style="font-size:26px">${r.ic}</span>
        <div style="flex:1;min-width:200px">
          <b style="font-size:13.5px">${esc(r.title)}</b>
          <div style="font-size:11px;color:var(--muted);margin-top:3px">${esc(r.desc)}</div>
          ${st.s === 'can' ? `<input class="input" data-note="${r.id}" placeholder="توضیح یا لینک (اختیاری)" style="width:100%;margin-top:7px;font-size:11.5px">` : ''}
          ${st.rej ? `<div style="font-size:11px;color:#ff8f82;margin-top:5px">درخواست قبلی رد شد${st.rej.adminNote ? ' — ' + esc(st.rej.adminNote) : ''} • می‌توانید دوباره درخواست دهید</div>` : ''}
        </div>
        <span class="chip gold" style="font-size:13px;font-weight:900">+${D.fa(r.amount)} 🪙</span>
        ${btn}
      </div>`;
    });
    const mine = AV.reqsOf(currentUser).slice(0, 12);
    body.innerHTML = `
    ${c.auto ? `<div class="glass" style="margin-bottom:14px;padding:13px 16px;background:linear-gradient(135deg,rgba(30,187,138,.14),rgba(30,187,138,.04));border:1px solid rgba(30,187,138,.4);font-size:13px">🏆 سکه‌های قهرمانی شما (خودکار): <b>+${D.fa(c.auto)} 🪙</b> از ${D.fa(auto.length)} قهرمانی — با تغییر نتایج مسابقات، این عدد هم به‌روز می‌شود.</div>` : ''}
    <div class="glass" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">🪙</span><h3>دریافت سکه — ارسال درخواست به مدیریت</h3><span class="tag">سکهٔ من: ${D.fa(c.total)}</span></div>
      <div class="golfrule" style="margin:8px 0 12px;line-height:2">📝 با زدن «ارسال درخواست»، درخواست شما به <b>${esc(L('nav.mgmt','پنل مدیریت'))}</b> می‌رود. سکه فقط پس از <b>تأیید مدیر</b> به کیف‌پول شما اضافه می‌شود.</div>
      <div style="margin-top:10px">${rows}</div>
    </div>
    <div class="glass" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">📨</span><h3>درخواست‌های من</h3><span class="tag">${D.fa(mine.length)} مورد</span></div>
      ${mine.length ? mine.map(r => `
        <div class="req-row">
          <span style="flex:1;min-width:170px;font-size:12.5px">${esc(r.title)}${r.note ? `<div style="font-size:10.5px;color:var(--muted);margin-top:3px">${esc(r.note)}</div>` : ''}</span>
          <span class="chip gold">+${D.fa(r.amount)} 🪙</span>
          <span style="font-size:11.5px" class="${r.status === 'pending' ? 'st-p' : r.status === 'ok' ? 'st-ok' : 'st-no'}">
            ${r.status === 'pending' ? '⏳ در انتظار تأیید' : r.status === 'ok' ? '✅ تأیید شد' : '⛔ رد شد'}</span>
          <span style="font-size:11px;color:var(--muted)">${esc(D.faDate ? D.faDate(r.date) : r.date)}</span>
        </div>`).join('') : `<div style="color:var(--muted);font-size:12.5px;padding:8px">هنوز درخواستی نداده‌اید.</div>`}
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">🏆</span><h3>سکه‌های خودکار مسابقات</h3><span class="tag" id="mz-auto-tag">${D.fa(c.auto || 0)} 🪙 از ${D.fa(auto.length)} قهرمانی</span></div>
      <div style="font-size:12px;color:var(--muted);margin-top:8px;line-height:2">
        قهرمانی در مسابقات به‌صورت خودکار و بدون نیاز به تأیید، برای شما سکه می‌سازد:<br>
        🥇 قهرمان مسابقهٔ سطح ۱ = <b class="gold-text">۲۰ سکه</b> &nbsp;•&nbsp; سطح ۲ = <b class="gold-text">۱۵ سکه</b> &nbsp;•&nbsp; سطح ۳ = <b class="gold-text">۱۰ سکه</b>
      </div>
      <div id="mz-autolist" style="margin-top:10px">
        ${auto.length ? auto.map(a => `
          <div class="req-row" data-autotid="${a.tid}">
            <span style="flex:1;min-width:170px;font-size:12.5px">🥇 ${esc(a.title)}<div style="font-size:10.5px;color:var(--muted);margin-top:3px">${esc(a.label)}</div></span>
            <span class="chip gold">+${D.fa(a.amount)} 🪙</span>
          </div>`).join('') : `<div style="color:var(--muted);font-size:12.5px;padding:8px">هنوز قهرمانی ثبت‌شده‌ای ندارید.</div>`}
      </div>
    </div>`;
    body.querySelectorAll('[data-req]').forEach(b => b.addEventListener('click', () => {
      const rule = COIN_RULES.find(r => r.id === b.dataset.req);
      if (!rule || ruleState(currentUser, rule.id).s !== 'can') return;
      const noteEl = body.querySelector(`[data-note="${rule.id}"]`);
      const rec = userRec(currentUser) || {};
      AV.addReq({
        user: currentUser, name: rec.name || currentUser, pid: rec.pid || 0,
        ruleId: rule.id, title: rule.title, amount: rule.amount, note: noteEl ? noteEl.value.trim() : '',
      });
      APP.toast('درخواست شما برای مدیریت ارسال شد — پس از تأیید، ' + D.fa(rule.amount) + ' سکه اضافه می‌شود ⏳', 'green');
      pageMemberZone();
    }));
  }

  /* ── تب راهنما ── */
  function memGuide(body, o){
    let rows = '';
    COIN_RULES.concat([{ id:'w1', ic:'🥇', title:'قهرمان مسابقهٔ سطح ۱ (خودکار)', amount:20 },
      { id:'w2', ic:'🥈', title:'قهرمان مسابقهٔ سطح ۲ (خودکار)', amount:15 },
      { id:'w3', ic:'🥉', title:'قهرمان مسابقهٔ سطح ۳ (خودکار)', amount:10 }]).forEach(r => {
      rows += `<div class="row"><span class="pnm"><span style="font-size:20px">${r.ic}</span><span>${esc(r.title)}</span></span><span style="font-weight:900;color:#f6e27a">+${D.fa(r.amount)} 🪙</span></div>`;
    });
    const rs = AV.ranks();
    body.innerHTML = `
    <div class="glass" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">📜</span><h3>اطلاعات دریافت سکه — جدول کامل</h3><span class="tag">GolfCoin 🪙</span></div>
      <div style="margin-top:10px">${rows}</div>
      <div class="golfrule" style="margin-top:14px;line-height:2">🪙 <b>سکه چیست؟</b> سکه‌های آکادمی را از فعالیت‌های ورزشی و اجتماعی به دست می‌آورید و در <b>فروشگاه اوتار</b> خرج می‌کنید. هر خرید برای همیشه در کمد شما می‌ماند. خودت طراحی کن، ایده بگیر و استایل مخصوص خودت را بساز!</div>
      <div class="golfrule" style="margin-top:10px;line-height:2">⏳ همهٔ درخواست‌های سکه، پس از بررسی و <b>تأیید مدیریت</b> اعمال می‌شوند.</div>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">🏅</span><h3>نردبان Honor Rank — ۱۵ سطح، ۵ دیویژن</h3><span class="tag">رنک شما: ${esc(o.hn.rank.en)}</span></div>
      <div class="rank-grid" style="margin-top:12px">
        ${rs.map(r => `<div class="rank-chip ${r.lv === o.hn.lv ? 'on' : ''}" style="border-color:${r.lv === o.hn.lv ? r.border : 'rgba(255,255,255,.12)'}">
          <div style="display:flex;justify-content:center">${AV.badgeSVG(r, 30)}</div>
          <div style="color:${r.title};margin-top:5px">${esc(r.en)}</div>
          <div style="font-size:10px;color:var(--muted)">${esc(r.fa)}</div>
          <div style="font-size:10px;color:var(--gold-l);margin-top:3px">Lv ${D.fa(r.lv)} • ${D.fa(r.pts)}+ امتیاز</div>
        </div>`).join('')}
      </div>
      <div class="golfrule" style="margin-top:12px;line-height:2">🎖️ رنک شما با امتیاز فصل بالا می‌رود؛ با هر ارتقاء، رنگ کارت، هالهٔ نور، نشان روی سینه و عنوان آواتار شما تغییر می‌کند.</div>
    </div>`;
  }

  /* ── تب ساخت آواتار + فروشگاه برندها ── */
  function memAvatar(body, o){
    /* ویترین حرفه‌ای فروشگاه آواتار (v8) */
    if (window.SHOP && SHOP.renderShop){
      SHOP.renderShop(body, currentUser, {
        gender: genderOfUser(currentUser),
        onChange: () => { updateCoinBadge(); memAvatar(body, o); },
      });
      return;
    }
    const av = AV.avatarOf(currentUser, genderOfUser(currentUser));
    const c = coinOf(currentUser);
    const owned = new Set(av.owned);
    const items = AV.shop().filter(i => i.cat === shopCat && (i.g === 'a' || i.g === av.gender));
    const cats = AV.CATS;
    body.innerHTML = `
    <div class="grid cols-3">
      <div class="glass" style="text-align:center">
        <div class="card-head"><span class="ic">🎨</span><h3>آواتار من</h3><span class="tag">Live 3D Card</span></div>
        <div style="margin-top:10px;display:flex;justify-content:center">${honorCardHTML(currentUser, (userRec(currentUser)||{}).name || currentUser, 'md', 'mz-card')}</div>
        ${honorProgHTML(o.hn)}
        <div style="margin-top:12px;font-size:12.5px;color:var(--muted)">موجودی: <b class="gold-text" style="font-size:16px">${D.fa(c.total)} 🪙</b></div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap">
          <button class="btn sm ${av.gender === 'm' ? '' : 'ghost'}" data-gender="m">👨 آقا</button>
          <button class="btn sm ${av.gender === 'f' ? '' : 'ghost'}" data-gender="f">👩 خانم</button>
          <button class="btn sm ${av.gender === 'b' ? '' : 'ghost'}" data-gender="b">👦 پسر بچه</button>
          <button class="btn sm ${av.gender === 'c' ? '' : 'ghost'}" data-gender="c">👧 دختر بچه</button>
          <button class="btn sm ghost" id="av-reset">↺ ساده‌سازی</button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.9">کمد شما: <b class="gold-text">${D.fa(av.owned.length)}</b> آیتم — خریدهای شما همیشه باقی می‌مانند.</div>
      </div>
      <div class="glass" style="grid-column:span 2">
        <div class="card-head"><span class="ic">🛍️</span><h3>فروشگاه استایل گلف — برندهای برتر دنیا</h3><span class="tag">${D.fa(AV.shop().length)} آیتم</span></div>
        <div class="shop-cats" style="margin-top:10px">
          ${cats.map(([id, lbl]) => `<div class="sc ${shopCat === id ? 'on' : ''}" data-acat="${id}">${lbl}</div>`).join('')}
        </div>
        <div class="shop-grid">
          ${items.map(it => {
            const isOwned = owned.has(it.id);
            const isSel = av.sel[it.cat] === it.id;
            const price = +it.price || 0;
            const canBuy = c.total >= price;
            const br = AV.BRANDS[it.b] || { name:'—', tier:'—', c:'#8A93A6' };
            const sw1 = it.c1 || '#8A93A6', sw2 = it.c2 || AV.shade(sw1, -18);
            return `<div class="shop-it ${isSel ? 'on' : ''} ${isOwned && !isSel ? 'owned' : ''}">
              <div class="sw" style="background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(0,0,0,.25));display:flex;align-items:center;justify-content:center;height:58px">${AV.itemPreviewSVG(it, 66)}</div>
              <span class="bnd" style="color:${br.c};background:${br.c}1f;border:1px solid ${br.c}44">${esc(br.name)}</span>
              <div class="nm">${esc(it.n)}</div>
              <div class="pr">${price === 0 ? 'رایگان' : D.fa(price) + ' 🪙'} <span style="font-size:9.5px;color:var(--muted)">• ${esc(br.tier)}</span></div>
              ${isSel ? `<span class="chip gold">پوشیده ✓</span>`
                : isOwned ? `<button class="btn sm" data-sel="${it.id}">پوشیدن</button>`
                : `<button class="btn sm ${canBuy ? '' : 'ghost'}" data-buy="${it.id}" ${canBuy ? '' : 'disabled'}>${canBuy ? 'خرید' : 'سکه کم است'}</button>`}
            </div>`;
          }).join('') || `<div style="color:var(--muted);font-size:12.5px;padding:10px">آیتمی در این دسته موجود نیست.</div>`}
        </div>
      </div>
    </div>`;
    body.querySelectorAll('[data-acat]').forEach(t => t.addEventListener('click', () => { shopCat = t.dataset.acat; memAvatar(body, o); }));
    body.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
      const res = AV.buyItem(currentUser, b.dataset.buy);
      APP.toast(res.msg, res.ok ? 'green' : 'red');
      updateCoinBadge();
      pageMemberZone();
    }));
    body.querySelectorAll('[data-sel]').forEach(b => b.addEventListener('click', () => {
      AV.selectItem(currentUser, b.dataset.sel);
      pageMemberZone();
    }));
    body.querySelectorAll('[data-gender]').forEach(b => b.addEventListener('click', () => {
      const g = b.dataset.gender;
      const rec = AV.avatarOf(currentUser);
      const sel = Object.assign({}, rec.sel);
      /* اگر مو/کلاه فعلی برای جنسیت جدید نیست، به گزینهٔ پیش‌فرض برگرد */
      ['hair','hat','shirt','pants'].forEach(cat => {
        const it = AV.shopItem(sel[cat]);
        if (it && !AV.fitsGender(it.g, g)) sel[cat] = AV.DEFAULT_SEL(g)[cat];
      });
      AV.setAvatar(currentUser, { gender: g, sel });
      pageMemberZone();
    }));
    const rs = body.querySelector('#av-reset');
    if (rs) rs.addEventListener('click', () => {
      const rec = AV.avatarOf(currentUser);
      AV.setAvatar(currentUser, { sel: AV.DEFAULT_SEL(rec.gender) });
      APP.toast('آواتار به حالت ساده برگشت (خریدهای شما محفوظ است)', 'green');
      pageMemberZone();
    });
  }

  /* ═══════════ ابزار طراح ═══════════ */
  function extraCourses(){ try{ return JSON.parse(store.get('ga_courses')||'[]'); }catch(e){ return []; } }
  function extraTours(){ try{ return JSON.parse(store.get('ga_tournaments')||'[]'); }catch(e){ return []; } }
  function extraCards(){ try{ return JSON.parse(store.get('ga_scorecards')||'[]'); }catch(e){ return []; } }
  function saveCourses(a){ try{ store.set('ga_courses', JSON.stringify(a)); }catch(e){} }
  function saveTours(a){ try{ store.set('ga_tournaments', JSON.stringify(a)); }catch(e){} }
  function saveCards(a){ try{ store.set('ga_scorecards', JSON.stringify(a)); }catch(e){} }

  function pageACourses(){
    const v = $('#view');
    v.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:18px">
      <div class="card-head"><span class="ic">🛠️</span><h3>طراح زمین — ثبت زمین جدید</h3><span class="tag">3 / 9 / 18</span></div>
      <div class="grid cols-4">
        <div><label style="font-size:11px;color:var(--muted)">نام زمین</label><input class="input" id="ac-name" style="width:100%;margin-top:5px" placeholder="زمین جدید"></div>
        <div><label style="font-size:11px;color:var(--muted)">محل</label><input class="input" id="ac-loc" style="width:100%;margin-top:5px" value="ریاض"></div>
        <div><label style="font-size:11px;color:var(--muted)">تعداد میدان</label>
          <select class="sel" id="ac-holes" style="width:100%;margin-top:5px"><option>3</option><option>9</option><option selected>18</option></select></div>
        <div style="display:flex;align-items:flex-end"><button class="btn sm" id="ac-add">+ ثبت زمین</button></div>
      </div>
      <div id="ac-pars" style="margin-top:14px;display:flex;gap:7px;flex-wrap:wrap"></div>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">🗺️</span><h3>زمینهای موجود</h3><span class="tag">${D.fa(S.courses.length)} زمین</span></div>
      <div id="ac-list"></div>
    </div>`;
    let parVals = [];
    function drawPars(){
      const n = +$('#ac-holes').value;
      if (parVals.length !== n) parVals = Array.from({length:n}, (_,i) => [3,4,5][i%3] === 4 ? 4 : 4);
      $('#ac-pars').innerHTML = parVals.map((p,i) => `
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--muted)">ح${D.fa(i+1)}</div>
          <input class="input" type="number" min="3" max="6" value="${p}" data-i="${i}" style="width:58px;text-align:center;direction:ltr">
        </div>`).join('');
      $$('#ac-pars input').forEach(inp => inp.addEventListener('change', () => {
        parVals[+inp.dataset.i] = Math.max(3, Math.min(6, +inp.value || 4));
      }));
    }
    drawPars();
    $('#ac-holes').addEventListener('change', drawPars);
    $('#ac-add').addEventListener('click', () => {
      const name = $('#ac-name').value.trim();
      const loc = $('#ac-loc').value.trim();
      if (!name){ toast('نام زمین را وارد کنید', 'red'); return; }
      const holes = +$('#ac-holes').value;
      const pars = parVals.slice(0, holes).map(v => Math.max(3, Math.min(6, v)));
      const lst = extraCourses();
      lst.push({ name, loc, holes, pars });
      saveCourses(lst);
      reloadData(); go('acourses');
      toast('زمین «' + name + '» ثبت شد ✓', 'green');
    });
    renderCourseList();
  }
  function renderCourseList(){
    const wrap = $('#ac-list'); if (!wrap) return;
    const rows = [];
    D.COURSES.forEach((c,i) => rows.push({ type:'پایه', name:c[1], loc:c[2], holes:c[3], pars:D.COURSE_PARS[c[0]], del:null }));
    extraCourses().forEach((c,i) => rows.push({ type:'سفارشی', name:c.name, loc:c.loc, holes:c.holes, pars:c.pars, del:i }));
    wrap.innerHTML = `
    <table class="tbl"><thead><tr><th>#</th><th>نام</th><th>محل</th><th>میدان</th><th>پار هر میدان</th><th>پار کل</th><th></th></tr></thead><tbody>
    ${rows.map((r,i) => `<tr>
      <td class="num">${D.fa(i+1)}</td><td><b>${esc(r.name)}</b> ${r.type==='سفارشی'?'<span class="chip purple">سفارشی</span>':''}</td>
      <td>${esc(r.loc)}</td><td class="num">${D.fa(r.holes)}</td>
      <td class="ltr" style="color:var(--muted);font-size:11px">${r.pars.join('، ')}</td>
      <td class="num" style="color:var(--gold-l)">${D.fa(r.pars.reduce((a,b)=>a+b,0))}</td>
      <td>${r.del !== null ? `<button class="btn ghost sm" data-del="${r.del}">حذف</button>` : ''}</td>
    </tr>`).join('')}</tbody></table>`;
    $$('#ac-list [data-del]').forEach(b => b.addEventListener('click', () => {
      const lst = extraCourses(); lst.splice(+b.dataset.del, 1); saveCourses(lst); reloadData(); go('acourses'); toast('زمین حذف شد', 'orange');
    }));
  }

  function pageATours(){
    const v = $('#view');
    v.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:18px">
      <div class="card-head"><span class="ic">🏆</span><h3>طراح مسابقه — ثبت مسابقه جدید</h3><span class="tag">زمین + حفره + سطح</span></div>
      <div class="grid cols-6">
        <div style="grid-column:span 2"><label style="font-size:11px;color:var(--muted)">نام مسابقه</label><input class="input" id="at-name" style="width:100%;margin-top:5px" placeholder="جام جدید"></div>
        <div><label style="font-size:11px;color:var(--muted)">سطح</label><select class="sel" id="at-lvl" style="width:100%;margin-top:5px"><option value="1">سطح ۱</option><option value="2" selected>سطح ۲</option><option value="3">سطح ۳</option></select></div>
        <div><label style="font-size:11px;color:var(--muted)">زمین</label><select class="sel" id="at-crs" style="width:100%;margin-top:5px">${S.courses.map(c=>`<option value="${c[0]}">${esc(c[1])}</option>`).join('')}</select></div>
        <div><label style="font-size:11px;color:var(--muted)">حفره</label><select class="sel" id="at-holes" style="width:100%;margin-top:5px"><option>9</option><option selected>18</option></select></div>
        <div style="grid-column:span 2"><label style="font-size:11px;color:var(--muted)">تاریخ</label><div class="jdate" id="at-date" data-iso="2026-09-25" style="margin-top:5px"></div></div>
      </div>
      <button class="btn sm" id="at-add" style="margin-top:14px">+ ثبت مسابقه</button>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">📅</span><h3>مسابقات فصل</h3><span class="tag">${D.fa(S.tournaments.length)} رویداد</span></div>
      <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>#</th><th>نام</th><th>سطح</th><th>زمین</th><th>حفره</th><th>تاریخ</th><th>وضعیت</th><th></th></tr></thead><tbody>
      ${S.tournaments.map((t,i) => {
        const past = D.dateFrom(t[5]) < D.TODAY;
        const j = D.jalaliInfo(D.dateFrom(t[5]));
        return `<tr>
          <td class="num">${D.fa(t[0])}</td><td><b>${esc(t[1])}</b></td>
          <td><span class="chip ${t[2]===1?'gold':t[2]===2?'green':'blue'}">سطح ${D.fa(t[2])}</span></td>
          <td style="color:var(--muted)">${esc(D.COURSE_NAME[t[3]]||'—')}</td>
          <td class="num">${D.fa(t[4])}</td>
          <td class="ltr" style="color:var(--muted);font-size:11.5px">${D.fa(j.dd)} ${j.monthFa} ${D.fa(j.yy)}</td>
          <td><span class="chip ${past?'dim':'green'}">${past?'برگزار شده':'آینده'}</span></td>
          <td>${i >= 14 ? `<button class="btn ghost sm" data-del="${i-14}">حذف</button>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table></div>
    </div>`;
    if (window.JDate && $('#at-date')) JDate.render($('#at-date'));
    $('#at-add').addEventListener('click', () => {
      const name = $('#at-name').value.trim();
      const date = $('#at-date')._value();
      if (!name || !date){ toast('نام و تاریخ را وارد کنید', 'red'); return; }
      const lst = extraTours();
      lst.push({ name, lvl: +$('#at-lvl').value, course: +$('#at-crs').value, holes: +$('#at-holes').value, date });
      saveTours(lst); reloadData(); go('atournaments');
      toast('مسابقه «' + name + '» ثبت شد ✓', 'green');
    });
    $$('#at-list [data-del]').forEach(b => b.addEventListener('click', () => {
      const lst = extraTours(); lst.splice(+b.dataset.del,1); saveTours(lst); reloadData(); go('atournaments');
    }));
  }

  function pageAScorecards(){
    const v = $('#view');
    const pastTours = S.tournaments.filter(t => D.dateFrom(t[5]) < D.TODAY);
    v.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:18px">
      <div class="card-head"><span class="ic">⛳</span><h3>ثبت نتایج — ضربات هر میدان</h3><span class="tag">امتیاز و رتبه خودکار</span></div>
      <div class="toolbar" style="margin-bottom:12px">
        <span class="lbl">مسابقه:</span>
        <select class="sel" id="as-tour">${pastTours.map(t=>`<option value="${t[0]}">${esc(t[1])}</option>`).join('')}</select>
        <span class="lbl">بازیکن:</span>
        <select class="sel" id="as-pl">${A.LB.map(r=>`<option value="${r.pid}">${esc(r.name)}</option>`).join('')}</select>
      </div>
      <div id="as-holes" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px"></div>
      <button class="btn sm" id="as-add">+ ثبت کارت امتیاز</button>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">📋</span><h3>کارتهای ثبتشده (سفارشی)</h3><span class="tag">${D.fa(extraCards().length)} کارت</span></div>
      <div id="as-list"></div>
    </div>`;
    let holeVals = [];
    function drawHoles(){
      const t = S.tournaments.find(x => x[0] === +$('#as-tour').value);
      const n = t ? t[4] : 9;
      const pars = t ? D.parsOf(t[3]) : [];
      holeVals = Array.from({length:n}, () => '');
      $('#as-holes').innerHTML = Array.from({length:n}, (_,i) => `
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--muted)">ح${D.fa(i+1)} <small style="color:var(--gold-l)">پ${D.fa(pars[i])}</small></div>
          <input class="input" type="number" min="1" max="12" value="" data-i="${i}" style="width:52px;text-align:center;direction:ltr" placeholder="—">
        </div>`).join('');
      $$('#as-holes input').forEach(inp => inp.addEventListener('input', () => { holeVals[+inp.dataset.i] = +inp.value || null; }));
    }
    drawHoles();
    $('#as-tour').addEventListener('change', drawHoles);
    $('#as-add').addEventListener('click', () => {
      const tour = +$('#as-tour').value, pid = +$('#as-pl').value;
      const t = S.tournaments.find(x => x[0] === tour);
      const strokes = {};
      let ok = 0;
      for (let h = 1; h <= t[4]; h++){
        const val = holeVals[h-1];
        if (val !== null && val > 0){ strokes[h] = val; ok++; }
      }
      if (ok < t[4]){ toast('همه میدانها را پر کنید', 'red'); return; }
      const lst = extraCards();
      lst.push({ tour, pid, strokes });
      saveCards(lst); reloadData(); go('ascorecards');
      toast('کارت امتیاز ثبت شد — رتبه و امتیاز خودکار محاسبه شد ✓', 'green');
    });
    const lst = extraCards();
    $('#as-list').innerHTML = lst.length ? `<table class="tbl"><thead><tr><th>مسابقه</th><th>بازیکن</th><th>ضربات</th><th></th></tr></thead><tbody>
      ${lst.map((c,i) => {
        const t = S.tournaments.find(x=>x[0]===c.tour);
        const total = Object.values(c.strokes).reduce((a,b)=>a+b,0);
        return `<tr><td>${esc(t?t[1]:'—')}</td><td><b>${esc(D.nameOf(c.pid))}</b></td><td class="num" style="color:var(--gold-l)">${D.fa(total)}</td>
        <td><button class="btn ghost sm" data-del="${i}">حذف</button></td></tr>`;
      }).join('')}</tbody></table>` : '<div style="color:var(--muted);font-size:12.5px">هنوز کارتی ثبت نشده است.</div>';
    $$('#as-list [data-del]').forEach(b => b.addEventListener('click', () => {
      const a = extraCards(); a.splice(+b.dataset.del,1); saveCards(a); reloadData(); go('ascorecards'); toast('کارت حذف شد', 'orange');
    }));
  }

  /* ═══════════ Toast ═══════════ */
  let toastBox = null;
  function toast(msg, type='gold'){
    if (!toastBox){
      toastBox = document.createElement('div');
      toastBox.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:400;display:flex;flex-direction:column;gap:8px;align-items:center';
      document.body.appendChild(toastBox);
    }
    const el = document.createElement('div');
    el.style.cssText = 'background:linear-gradient(135deg,#1a2433,#101722);border:1px solid var(--line);border-radius:13px;padding:12px 22px;font-size:13px;font-weight:700;box-shadow:0 12px 34px rgba(0,0,0,.6);animation:toastIn .3s cubic-bezier(.2,.9,.3,1.2)';
    el.textContent = msg;
    if (type === 'green') el.style.borderColor = 'rgba(30,187,138,.5)';
    if (type === 'red') el.style.borderColor = 'rgba(231,76,60,.5)';
    toastBox.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.4s'; setTimeout(()=>el.remove(), 400); }, 2600);
  }
  const stStyle = document.createElement('style');
  stStyle.textContent = '@keyframes toastIn{from{opacity:0;transform:translateY(14px) scale(.95)}to{opacity:1;transform:none}}';
  document.head.appendChild(stStyle);

  /* ═══════════ RENDERERS ═══════════ */
  const RENDERERS = {
    memberzone: pageMemberZone,
    cmd: pageCmd, race: pageRace, player: pagePlayer, match: pageMatch,
    course: pageCourse, records: pageRecords, cal: pageCal, tv: pageTv,
    battle: pageBattle, academy: pageAcademy, avatarland: pageAvatarLand,
    acourses: pageACourses, atournaments: pageATours, ascorecards: pageAScorecards,
    mgmt: () => MGMT.pageMgmt(), users: () => MGMT.pageUsers(), settings: () => MGMT.pageSettings(),
  };

  /* ═══════════ بارگذاری مجدد ═══════════ */
  function reloadData(){
    S = D.loadState();
    recompute();
  }
  function applyStateToForms(){}

  /* ═══════════ ورود ═══════════ */
  function initAuth(){
    const form = $('#login-form');
    const user = $('#login-user'), pass = $('#login-pass'), err = $('#login-err');
    $('#toggle-pass').addEventListener('click', () => {
      pass.type = pass.type === 'password' ? 'text' : 'password';
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const sbtn = form.querySelector('button[type="submit"]');
      if (sbtn && !sbtn.disabled){ sbtn.disabled = true; sbtn.dataset.old = sbtn.textContent; sbtn.textContent = 'در حال بررسی…'; }
      setTimeout(() => {
      const u = user.value.trim().toLowerCase();
      const h = cyrb53(pass.value);
      if (sbtn){ sbtn.disabled = false; sbtn.textContent = sbtn.dataset.old || 'ورود به داشبورد'; }
      if (buildUsers()[u] === h){
        store.set('ga_session', u);
        store.set('ga_user_label', userLabelFor(u));
        enterApp(u);
      } else {
        err.classList.add('show');
        err.textContent = 'نام کاربری یا رمز عبور اشتباه است — دوباره تلاش کنید';
        setTimeout(() => err.classList.remove('show'), 2600);
      }
      }, 350);
    });
  }

  function applyRoleUI(rec){
    const member = !!(rec && rec.role === 'member');
    const settings = MGMT.getSettings();
    $$('#app .nav-item').forEach(n => {
      const p = n.dataset.page;
      let show;
      if (member){
        if (p === 'memberzone') show = true;
        else show = !!settings[MEM_PAGE_KEY[p]];
      }
      else if (p === 'memberzone') show = false;
      else if (p === 'users') show = !!(rec && rec.main);
      else show = true;
      n.style.display = show ? '' : 'none';
    });
    $$('#app .nav-group').forEach(g => { g.style.display = member ? 'none' : ''; });
    const mb = $('#side-mgmt-btn'); if (mb) mb.style.display = member ? 'none' : '';
    $('#user-label').textContent = userLabelFor(currentUser);
    $('#user-name').textContent = currentUser;
  }

  function refreshLabels(){
    updatePageLabels();
    if (window.UI_LABELS) UI_LABELS.apply(document);
    if (window.__L3D && __L3D.refreshLabels) __L3D.refreshLabels();
    const app = $('#app');
    if (app && app.classList.contains('on') && PAGES[currentPage]) go(currentPage);
  }

  function enterApp(u){
    currentUser = u;
    const rec = userRec(u);
    $('#login').classList.remove('on');
    $('#app').classList.add('on');
    applyRoleUI(rec);
    reloadData();
    go(rec && rec.role === 'member' ? 'memberzone' : 'cmd');
    tickClock(); setInterval(tickClock, 1000);
  }

  function logout(){
    store.remove('ga_session');
    location.reload();
  }

  /* ═══════════ راهاندازی ═══════════ */
  function closeNav(){
    document.body.classList.remove('nav-open');
  }
  function initNav(){
    $$('.nav-item').forEach(n => n.addEventListener('click', () => { go(n.dataset.page); closeNav(); }));
    const mb = $('#menu-btn');
    if (mb) mb.addEventListener('click', () => document.body.classList.toggle('nav-open'));
    const ov = $('#nav-overlay');
    if (ov) ov.addEventListener('click', closeNav);
    $('#logout-btn').addEventListener('click', logout);
  }

  window.addEventListener('ga:labels-changed', refreshLabels);
  document.addEventListener('DOMContentLoaded', () => {
    if (window.UI_LABELS) UI_LABELS.apply(document);
    seedUsers();
    initParticles();
    initAuth();
    initNav();
    const sess = store.get('ga_session');
    if (sess && buildUsers()[sess] !== undefined){
      enterApp(sess);
    }
  });

  window.APP = {
    go, reloadData, recompute, refreshLabels, state: () => ({ S, A }), toast,
    currentUser: () => currentUser,
    isMain: () => isMain(currentUser),
    isAdmin: () => isAdmin(currentUser),
    users: { list: loadUsers, save: saveUsers, seed: seedUsers, rec: userRec, isMain, isAdmin, label: userLabelFor },
  };
})();
