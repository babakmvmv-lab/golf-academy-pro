/* ═══════════════════════════════════════════════════════════════════
   GolfAcademy PRO — پلن مدیریت جامع + تنظیمات نمایش
   CRUD کامل: بازیکن (فرم جامع + عکس + یوزر/پسورد + اکتیو/دیاکتیو)،
   زمین (لوکیشن + نقشهٔ ماهواره‌ای)، مسابقات، نتایج، رویداد تقویم
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  const W = window;
  let D = window.Data;
  const MONTHS_FA = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const L = (id, fallback) => window.UI_LABELS ? UI_LABELS.t(id, fallback) : fallback;
  function gstate(){
    if (!D) D = window.Data;
    return (window.APP && window.APP.state) ? window.APP.state() : { S:null, A:null };
  }

  /* ── تنظیمات نمایش نمودارها (localStorage) ── */
  const DEFAULTS = {
    chCmd: true, chMonthly: true, chRace: true, chRaceBars: true,
    chPlayer: true, chPlayerRadar: true, chMatch: true, chCourse: true,
    chRecords: true, chCal: true, chTv: true, chBattle: true,
    /* نمایش آیتم‌ها برای اعضا — پیش‌فرض جهانی روی همهٔ دستگاه‌ها فعال است.
       مدیر همچنان می‌تواند هر بخش را در «تنظیمات نمایش» غیرفعال کند. */
    memCmd: true, memRace: true, memPlayer: true, memMatch: true,
    memCourse: true, memRecords: true, memCal: true, memTv: true, memAvatarLand: true,
  };
  function getSettings(){
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('ga_ui') || '{}')); }
    catch(e){ return Object.assign({}, DEFAULTS); }
  }
  function saveSettings(s){
    try { localStorage.setItem('ga_ui', JSON.stringify(s)); } catch(e){}
  }

  /* ── رویدادهای سفارشی تقویم ── */
  function customEvents(){ try { return JSON.parse(localStorage.getItem('ga_events') || '[]'); } catch(e){ return []; } }
  function saveEvents(a){ try { localStorage.setItem('ga_events', JSON.stringify(a)); } catch(e){} }

  /* ── بازیکنان سفارشی (فرم جامع) ── */
  function customPlayers(){ try { return JSON.parse(localStorage.getItem('ga_custom_players') || '[]'); } catch(e){ return []; } }
  function saveCustomPlayers(a){ try { localStorage.setItem('ga_custom_players', JSON.stringify(a)); } catch(e){} }

  /* ── ویرایش بازیکنان پایه ── */
  function playerEdits(){ try { return JSON.parse(localStorage.getItem('ga_players') || '{}'); } catch(e){ return {}; } }
  function savePlayerEdits(e){ try { localStorage.setItem('ga_players', JSON.stringify(e)); } catch(e){} }

  /* ── یوزر/پسورد سایت بازیکنان ── */
  function playerUsers(){ return D ? D.loadPlayerUsers() : {}; }
  function savePlayerUsers(u){ try { localStorage.setItem('ga_player_users', JSON.stringify(u)); } catch(e){} }

  /* ══ همگام‌سازی دوطرفهٔ یوزر/رمز: «بازیکنان» ⇄ «یوزرها» ══
     هر تغییری در فرم بازیکن به لیست یوزرها می‌رود و هر تغییری در لیست یوزرها
     به مشخصات همان بازیکن برمی‌گردد (یوزر، رمز، نام، فعال/غیرفعال). */
  function usersAPI(){ return (window.APP && window.APP.users) ? window.APP.users : null; }
  function syncPlayerToUser(pid, o){
    const U = usersAPI(); if (!U || !pid) return null;
    o = o || {};
    const a = U.list();
    let rec = a.find(x => +x.pid === +pid);
    if (!rec && o.user) rec = a.find(x => String(x.user||'').toLowerCase() === String(o.user).toLowerCase() && !x.main);
    if (!rec){
      if (!o.user) return null;
      const id = Math.max(0, ...a.map(x => +x.id || 0)) + 1;
      rec = { id, user: o.user, pass: o.pass || 'golf1405', name: o.name || ('بازیکن ' + pid),
              role: 'member', active: o.active !== false, pid: +pid };
      a.push(rec);
    } else {
      if (rec.main) return rec;                       // مدیر اصلی دست‌نخورده می‌ماند
      if (o.user) rec.user = o.user;
      if (o.pass) rec.pass = o.pass;
      if (o.name) rec.name = o.name;
      if (o.active !== undefined) rec.active = o.active !== false;
      rec.pid = +pid;
    }
    U.save(a);
    return rec;
  }
  function syncUserToPlayer(u){
    if (!u || !u.pid) return;
    const pu = playerUsers();
    const prev = pu[u.pid] || {};
    pu[u.pid] = Object.assign({}, prev, {
      user: u.user || prev.user,
      pass: u.pass || prev.pass,
      name: u.name || prev.name,
      active: u.active !== false
    });
    savePlayerUsers(pu);
  }
  function removeUserOfPlayer(pid){
    const U = usersAPI(); if (!U || !pid) return;
    const a = U.list();
    const keep = a.filter(x => !(+x.pid === +pid && !x.main));
    if (keep.length !== a.length) U.save(keep);
  }
  /* اعتبارِ ورود بازیکن: اول ga_player_users، اگر نبود از لیست یوزرها خوانده می‌شود */
  function credsOf(pid){
    const u = playerUsers()[pid];
    if (u && (u.user || u.pass)) return u;
    const U = usersAPI();
    if (U){
      const rec = U.list().find(x => +x.pid === +pid);
      if (rec) return { user: rec.user, pass: rec.pass, name: rec.name, active: rec.active !== false };
    }
    return {};
  }

  /* ── اطلاعات سایت (تماس با ما + معرفی آکادمی) — قابل ویرایش از مدیریت، خوانده‌شده در صفحهٔ اصلی ── */
  const SITE_DEFAULTS = {
    contact: {
      phone: '۰۶۱-۳۲۴۴۵۶۷۸',
      email: 'info@golfacademy.sa',
      address: 'زمین گلف مسجدسلیمان، خیابان ورزش',
      website: 'GolfAcademy.sa',
      social: 'اینستاگرام · تلگرام · واتساپ',
      hours: 'شنبه تا پنجشنبه ۸ تا ۲۰',
      qr: 'https://golfacademy.sa',
    },
    info: {
      intro: 'آکادمی گلف ۱۴۰۵ — مرکز تخصصی گلف مسجدسلیمان.\nزمین رسمی ۱۸ حفره‌ای (پار ۷۲) با چمن استاندارد · باشگاه با امکانات کامل · مربیان رسمی فدراسیون گلف.\nتمرین گروهی اعضا هر پنجشنبه · مسابقهٔ ماهانه آخرین جمعهٔ هر ماه · دوره‌های ۲ روزه در خرداد و آذر.',
      address: 'زمین گلف مسجدسلیمان، خیابان ورزش',
      hours: 'شنبه تا پنجشنبه، ۸ تا ۲۰',
    },
  };
  function getSiteInfo(){
    const d = JSON.parse(JSON.stringify(SITE_DEFAULTS));
    try {
      const s = JSON.parse(localStorage.getItem('ga_siteinfo') || '{}');
      return {
        contact: Object.assign({}, d.contact, (s.contact || {})),
        info: Object.assign({}, d.info, (s.info || {})),
      };
    } catch(e){ return d; }
  }
  function saveSiteInfo(o){
    try { localStorage.setItem('ga_siteinfo', JSON.stringify(o)); } catch(e){}
  }

  /* ── کمکی: مشخصات کامل یک بازیکن ── */
  function playerFull(pid){
    const { S } = gstate();
    const p = S.players.find(x => x[0] === pid);
    if (!p) return null;
    const isCustom = pid >= 9000;
    const cu = isCustom ? customPlayers().find(c => c.id === pid - 9000) : null;
    const ed = !isCustom ? playerEdits()[pid] : null;
    const u = credsOf(pid) || {};
    return {
      pid, isCustom,
      name: isCustom ? (cu ? cu.name : p[1]) : (ed && ed.name ? ed.name : p[1]),
      family: isCustom ? (cu ? cu.family || '' : '') : (ed && ed.family ? ed.family : ''),
      gender: isCustom ? (cu ? cu.gender : p[2]) : (ed && ed.gender ? ed.gender : p[2]),
      hcp: isCustom ? (cu ? cu.hcp : p[3]) : (ed && ed.hcp !== undefined ? ed.hcp : p[3]),
      active: isCustom ? (cu ? cu.active !== false : true) : (ed && ed.active !== undefined ? ed.active : !!p[5]),
      join: isCustom ? (cu ? cu.join || '' : '') : (ed && ed.join ? ed.join : ''),
      birth: isCustom ? (cu ? cu.birth || '' : '') : (ed && ed.birth ? ed.birth : ''),
      phone: isCustom ? (cu ? cu.phone || '' : '') : (ed && ed.phone ? ed.phone : ''),
      national: isCustom ? (cu ? cu.national || '' : '') : (ed && ed.national ? ed.national : ''),
      email: isCustom ? (cu ? cu.email || '' : '') : (ed && ed.email ? ed.email : ''),
      address: isCustom ? (cu ? cu.address || '' : '') : (ed && ed.address ? ed.address : ''),
      father: isCustom ? (cu ? cu.father || '' : '') : (ed && ed.father ? ed.father : ''),
      fatherPhone: isCustom ? (cu ? cu.fatherPhone || '' : '') : (ed && ed.fatherPhone ? ed.fatherPhone : ''),
      mother: isCustom ? (cu ? cu.mother || '' : '') : (ed && ed.mother ? ed.mother : ''),
      motherPhone: isCustom ? (cu ? cu.motherPhone || '' : '') : (ed && ed.motherPhone ? ed.motherPhone : ''),
      photo: isCustom ? (cu ? cu.photo || '' : '') : (ed && ed.photo ? ed.photo : ''),
      user: u.user || '',
      pass: u.pass || '',
      hasUser: !!u.user,
    };
  }

  /* ═══════════════ صفحه: تنظیمات نمایش ═══════════════ */
  function pageSettings(){
    const v = $('#view');
    const s = getSettings();
    const groups = [
      { t:L('group.dashboard','داشبورد') + ' و ' + L('nav.cmd','فرماندهی'), items:[
        ['chCmd','🏠 کارت‌های آمار ' + L('nav.cmd','فرماندهی'),'نمایش ۸ کارت کلیدی در صفحهٔ ' + L('nav.cmd','فرماندهی')],
        ['chMonthly','📈 نمودار امتیاز ماهانه','نمودار خطی امتیاز ماه‌ها + انتخاب ماه'],
      ]},
      { t:L('settings.group.analytics','صفحات تحلیلی'), items:[
        ['chRace','🏁 نمودار ' + L('nav.race','رقابت فصل'),'بارها و خطوط رقابت در صفحهٔ ' + L('nav.race','رقابت فصل')],
        ['chPlayer','🏌️ نمودارهای ' + L('nav.player','مرکز بازیکن'),'رادار مهارت + دونات فرم'],
        ['chMatch','🥇 نمودار ' + L('nav.match','فرماندهی مسابقه'),'تحلیل مسابقه و امتیازات'],
        ['chCourse','🗺️ نمودار ' + L('nav.course','هوش زمین'),'سختی حفره‌ها و کارنامه بازیکن'],
        ['chRecords','🎖️ نمودار ' + L('nav.records','رکوردها'),'آمار رکوردها و بهترین‌ها'],
        ['chTv','📺 گرافیک ' + L('nav.tv','نمایش تلویزیونی'),'گرافیک پخش و نمایشگرها'],
        ['chBattle','⚔️ نمودار ' + L('nav.battle','میدان نبرد'),'مقایسه دو تیم'],
      ]},
      { t:L('settings.group.calendar','تقویم'), items:[
        ['chCal','📅 ' + L('nav.cal','تقویم فصل') + ' و تعطیلات','نمایش تقویم + تعطیلات رسمی ایران ۱۴۰۵'],
      ]},
      { t:L('settings.group.members','بخش اعضا — نمایش برای اعضا') + ' (فقط مدیر)', items:[
        ['memCmd','🎯 ' + L('nav.cmd','فرماندهی'),'وقتی فعال باشد، اعضا صفحهٔ ' + L('nav.cmd','فرماندهی') + ' را می‌بینند'],
        ['memRace','🏁 ' + L('nav.race','رقابت فصل'),'نمایش جدول ' + L('nav.race','رقابت فصل') + ' برای اعضا'],
        ['memPlayer','🏌️ ' + L('nav.player','مرکز بازیکن'),'نمایش پروفایل/تحلیل بازیکن برای اعضا'],
        ['memMatch','🥇 ' + L('nav.match','فرماندهی مسابقه'),'نمایش نتایج مسابقات برای اعضا'],
        ['memCourse','🗺️ ' + L('nav.course','هوش زمین'),'نمایش اطلاعات زمین‌ها برای اعضا'],
        ['memRecords','🎖️ ' + L('nav.records','رکوردها'),'نمایش رکوردها و تالار افتخارات برای اعضا'],
        ['memCal','📅 ' + L('nav.cal','تقویم فصل'),'نمایش تقویم و رویدادها برای اعضا'],
        ['memTv','📺 ' + L('nav.tv','نمایش تلویزیونی'),'نمایش گرافیک تلویزیونی برای اعضا'],
      ]},
    ];
    v.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:18px">
      <div class="card-head"><span class="ic">🛠️</span><h3>${esc(L('nav.settings','تنظیمات نمایش'))} — هر چیزی را فعال/غیرفعال کنید</h3><span class="tag">UI Controls</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
        <button class="btn sm" id="st-all-on">همه فعال</button>
        <button class="btn sm ghost" id="st-all-off">همه غیرفعال</button>
        <span style="color:var(--muted);font-size:11.5px;align-self:center">تغییرات فوراً در همهٔ صفحات اعمال می‌شود</span>
      </div>
    </div>
    ${groups.map(g => `
      <div class="glass" style="margin-bottom:16px">
        <div class="card-head"><span class="ic">⚙️</span><h3>${g.t}</h3><span class="tag">${g.items.filter(i=>s[i[0]]).length}/${g.items.length} فعال</span></div>
        <div style="margin-top:10px">
        ${g.items.map(([k, name, desc]) => `
          <div class="set-row ${s[k] ? '' : 'off'}" data-k="${k}">
            <span style="font-size:20px">${esc(name.split(' ')[0])}</span>
            <div class="info"><b>${esc(name.replace(/^[^ ]+ /,''))}</b><small>${esc(desc)}</small></div>
            <label class="switch"><input type="checkbox" data-set="${k}" ${s[k]?'checked':''}><span class="trk"></span></label>
          </div>`).join('')}
        </div>
      </div>`).join('')}`;
    $$('[data-set]').forEach(inp => inp.addEventListener('change', () => {
      const k = inp.dataset.set;
      s[k] = inp.checked;
      saveSettings(s);
      APP.toast('تنظیم نمایش ذخیره شد ✓', 'green');
    }));
    $('#st-all-on').addEventListener('click', () => { Object.keys(DEFAULTS).forEach(k => s[k]=true); saveSettings(s); APP.go('settings'); APP.toast('همهٔ نمودارها فعال شدند ✓', 'green'); });
    $('#st-all-off').addEventListener('click', () => { Object.keys(DEFAULTS).forEach(k => s[k]=false); saveSettings(s); APP.go('settings'); APP.toast('همهٔ نمودارها غیرفعال شدند', 'orange'); });
  }

  /* ═══════════════ صفحه: پلن مدیریت (تب‌ها) ═══════════════ */
  let mgmtTab = 'players';
  function pageMgmt(){
    const v = $('#view');
    const tabs = [
      ['players','👥',L('admin.players','بازیکنان')], ['courses','🗺️',L('admin.courses','زمین‌ها')], ['tournaments','🏆',L('admin.tournaments','مسابقات')],
      ['programs','🎓',L('admin.programs','دوره‌ها')], ['results','⛳',L('admin.results','نتایج')], ['calendar','📅',L('admin.calendar','تقویم')],
      ['contact','📞',L('admin.contact','تماس با ما')], ['info','ℹ️',L('admin.info','اطلاعات')], ['users','🔐',L('admin.users','یوزرها')],
      ['coins','🪙',L('admin.coins','درخواست سکه')], ['honor','🏅',L('admin.honor','رنک و آواتار')], ['shop','🛍️',L('admin.shop','فروشگاه آواتار')],
      ['battle','⚔️',L('admin.battle','نبرد میدان‌ها')], ['avatars','🌸',L('admin.avatars','سرزمین آواتارها')], ['labels','✏️',L('admin.labels','ویرایش آیتم‌ها')],
    ];
    v.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:18px">
      <div class="card-head"><span class="ic">⚙️</span><h3>${esc(L('nav.mgmt','پنل مدیریت'))} — ساخت، ویرایش، حذف</h3><span class="tag">Admin PRO</span>
        <button class="btn sm ghost" id="mgmt-reseed" title="حذف همهٔ داده و بارگذاری دوبارهٔ دادهٔ استاندارد فصل ۱۴۰۵ (بازیکنان، مسابقات، تمرین‌ها، دوره‌ها)">♻️ بازنشانی دادهٔ فصل ۱۴۰۵</button>
      </div>
      <div class="mgmt-tabs">
        ${tabs.map(([id,ic,n]) => { const pn = (id === 'coins' && window.AV) ? AV.pendingReqs().length : 0;
          return `<div class="mgmt-tab ${mgmtTab===id?'on':''}" data-tab="${id}">${ic} ${esc(n)}${pn ? ` <b style="color:#ffcf6b">(${D.fa(pn)})</b>` : ''}</div>`; }).join('')}
      </div>
    </div>
    <div id="mgmt-body"></div>`;
    $$('.mgmt-tab').forEach(t => t.addEventListener('click', () => { mgmtTab = t.dataset.tab; APP.go('mgmt'); }));
    const reseed = v.querySelector('#mgmt-reseed');
    if (reseed) reseed.addEventListener('click', () => {
      if (!confirm('همهٔ دادهٔ فعلی (نتایج، دوره‌ها، زمین‌ها، بازیکنان سفارشی و…) حذف و دادهٔ استاندارد فصل ۱۴۰۵ دوباره بارگذاری می‌شود. ادامه می‌دهید؟')) return;
      try { D.seedSeason(true); APP.reloadData(); APP.go('mgmt'); mgmtTab = 'players'; APP.toast('دادهٔ فصل ۱۴۰۵ بازنشانی شد ✓', 'green'); }
      catch(e){ APP.toast('خطا در بازنشانی: ' + e.message, 'red'); }
    });
    renderMgmtTab();
  }

  function renderMgmtTab(){
    const body = $('#mgmt-body'); if (!body) return;
    if (mgmtTab === 'players') mgmtPlayers(body);
    else if (mgmtTab === 'courses') mgmtCourses(body);
    else if (mgmtTab === 'tournaments') mgmtTournaments(body);
    else if (mgmtTab === 'programs') mgmtPrograms(body);
    else if (mgmtTab === 'results') mgmtResults(body);
    else if (mgmtTab === 'calendar') mgmtCalendar(body);
    else if (mgmtTab === 'coins') mgmtCoins(body);
    else if (mgmtTab === 'honor') mgmtHonor(body);
    else if (mgmtTab === 'shop') { if (window.SHOP && SHOP.renderAdmin) SHOP.renderAdmin(body); else mgmtShop(body); }
    else if (mgmtTab === 'contact') mgmtContact(body);
    else if (mgmtTab === 'info') mgmtInfo(body);
    else if (mgmtTab === 'users') mgmtUsers(body);
    else if (mgmtTab === 'battle') mgmtBattle(body);
    else if (mgmtTab === 'avatars') mgmtAvatarLand(body);
    else if (mgmtTab === 'labels') mgmtLabels(body);
  }

  /* ═══════════════ نبرد میدان‌ها: مدیریت تیم‌ها و جدال‌های تیمی ═══════════════ */
  function mgmtBattle(body){
    const B = window.Battle;
    if (!B){ body.innerHTML = '<div class="glass" style="color:#ff8f82">ماژول نبرد بارگذاری نشده است.</div>'; return; }
    let data = B.ensure();
    const settings = data.settings;
    const teams = data.teams;

    function activePlayers(){
      try { return D.playerRows().filter(p => p.active); } catch(e){ return []; }
    }
    function teamSel(sel){
      return teams.map(t => `<option value="${t.id}" ${sel===t.id?'selected':''}>${esc((t.icon||'')+' '+(t.name||''))}</option>`).join('');
    }

    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">⚔️</span><h3>${esc(L('admin.battle','نبرد میدان‌ها'))} — مدیریت تیم‌ها و جدال‌های تیمی</h3><span class="tag">Team Battle</span></div>
      <div class="form-section" style="margin-top:10px">🎛 تنظیمات امتیازدهی</div>
      <div class="field-grid">
        <div><label>امتیاز برد (جدول تیمی)</label><input class="input" id="bt-win" type="number" min="0" value="${+settings.winPts||0}"></div>
        <div><label>امتیاز مساوی</label><input class="input" id="bt-draw" type="number" min="0" value="${+settings.drawPts||0}"></div>
        <div><label>امتیاز باخت</label><input class="input" id="bt-loss" type="number" min="0" value="${+settings.lossPts||0}"></div>
        <div><label>امتیاز فصلِ هر بازیکن — برد</label><input class="input" id="bt-swin" type="number" min="0" value="${+settings.seasonWinPts||0}"></div>
        <div><label>امتیاز فصل — مساوی</label><input class="input" id="bt-sdraw" type="number" min="0" value="${+settings.seasonDrawPts||0}"></div>
        <div><label>امتیاز فصل — باخت</label><input class="input" id="bt-sloss" type="number" min="0" value="${+settings.seasonLossPts||0}"></div>
        <div class="span2"><label class="lbl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="bt-season" ${settings.seasonEnabled?'checked':''}> نتایج نبرد روی امتیاز/رنک فصلِ بازیکنان اثر بگذارد</label></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
        <button class="btn sm" id="bt-settings-save">💾 ذخیره تنظیمات</button>
        <button class="btn sm ghost" id="bt-reset">♻️ بازنشانی نمونه‌ی تیم‌ها</button>
      </div>
    </div>

    <div class="glass" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">🛡️</span><h3>تیم‌ها</h3><span class="tag">${D.fa(teams.length)} تیم</span>
        <button class="btn sm" id="bt-add-team" style="margin-right:auto">➕ تیم جدید</button>
      </div>
      <div id="bt-team-list" style="margin-top:10px"></div>
    </div>

    <div class="glass">
      <div class="card-head"><span class="ic">⚔️</span><h3>جدال‌های رودررو</h3><span class="tag">${D.fa(data.matches.length)} جدال</span></div>
      <div class="form-section" style="margin-top:10px">➕ ثبت جدال جدید</div>
      <div class="field-grid">
        <div><label>تیم میزبان</label><select class="sel" id="bt-m-home" style="width:100%">${teamSel('')}</select></div>
        <div><label>تیم مهمان</label><select class="sel" id="bt-m-away" style="width:100%">${teamSel('')}</select></div>
        <div><label>تاریخ (شمسی)</label><div id="bt-m-date"></div></div>
        <div><label>ساعت</label><input class="input" id="bt-m-time" type="time" style="width:100%"></div>
        <div class="span2"><label class="lbl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="bt-m-counted" checked> این جدال در رنک/امتیاز فصل شمرده شود</label></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn sm" id="bt-add-match">⚔️ ثبت جدال</button>
      </div>
      <div id="bt-match-list" style="margin-top:14px"></div>
    </div>`;

    if (window.JDate && $('#bt-m-date')) JDate.render($('#bt-m-date'), { value: D.shamsiToISO(1405,7,15), onChange(){} });

    function renderTeamList(){
      const box = $('#bt-team-list'); if (!box) return;
      const dt = B.ensure();
      box.innerHTML = dt.teams.length ? dt.teams.map(t => {
        const act = (t.members||[]).map(B.nameOf).join('، ') || '— بدون بازیکن';
        return `<div class="bt-item" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line-soft);border-radius:13px;margin-bottom:9px;background:rgba(255,255,255,.03)">
          <span style="font-size:26px">${esc(t.icon||'')}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:14.5px;font-weight:900;color:${esc(t.color||'#fff')}">${esc(t.name||'')}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${D.fa((t.members||[]).length)} بازیکن • ${esc(act)}</div>
          </div>
          <button class="btn sm ghost" data-btteam="${t.id}" title="ویرایش">✏️</button>
          <button class="btn sm ghost" data-btdel="${t.id}" title="حذف">🗑</button>
        </div>`;
      }).join('') : '<div style="color:var(--muted);font-size:12px;padding:8px">تیمی ساخته نشده است.</div>';
      box.querySelectorAll('[data-btteam]').forEach(b => b.addEventListener('click', () => battleTeamModal(b.dataset.btteam)));
      box.querySelectorAll('[data-btdel]').forEach(b => b.addEventListener('click', () => {
        if (!confirm('تیم حذف شود؟ جدال‌های وابسته هم حذف می‌شوند.')) return;
        B.deleteTeam(b.dataset.btdel); B.refresh(); refreshBattle();
      }));
    }
    function renderMatchList(){
      const box = $('#bt-match-list'); if (!box) return;
      const dt = B.ensure();
      const matches = dt.matches.slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
      box.innerHTML = matches.length ? matches.map(m => {
        if (!m.home || !m.away) return '';
        const res = m.status==='done' && m.winner ? `${D.faNum(m.homeScore,0)} - ${D.faNum(m.awayScore,0)} (${m.winner==='home'?'میزبان':m.winner==='away'?'مهمان':'مساوی'})` : 'برنامه‌ریزی‌شده';
        return `<div class="bt-item" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line-soft);border-radius:13px;margin-bottom:9px;background:rgba(255,255,255,.03)">
          <div style="flex:1;min-width:0;font-size:12.5px">${esc(B.teamIcon(m.home))} <b style="color:${esc(B.teamColor(m.home))}">${esc(B.teamName(m.home))}</b>
            <span class="chip gold">VS</span> ${esc(B.teamIcon(m.away))} <b style="color:${esc(B.teamColor(m.away))}">${esc(B.teamName(m.away))}</b></div>
          <div style="font-size:11px;color:var(--muted);direction:ltr">${esc(m.counted===false?'بدون اثر فصل':'اثر فصل')}</div>
          <span class="chip ${m.status==='done'?'green':'orange'}">${res}</span>
          <button class="btn sm ghost" data-btmatch="${m.id}" title="نتیجه/ویرایش">🎯</button>
          <button class="btn sm ghost" data-bmdel="${m.id}" title="حذف">🗑</button>
        </div>`;
      }).join('') : '<div style="color:var(--muted);font-size:12px;padding:8px">جدالی ثبت نشده است.</div>';
      box.querySelectorAll('[data-btmatch]').forEach(b => b.addEventListener('click', () => battleMatchModal(b.dataset.btmatch)));
      box.querySelectorAll('[data-bmdel]').forEach(b => b.addEventListener('click', () => {
        B.deleteMatch(b.dataset.bmdel); B.refresh(); refreshBattle();
      }));
    }
    function refreshBattle(){
      APP.reloadData(); APP.go('mgmt'); mgmtTab = 'battle';
    }

    /* ── مودال تیم ── */
    function battleTeamModal(id){
      const d = B.ensure();
      const t = id ? d.teams.find(x => x.id === id) : null;
      let m = $('#modal-battle');
      if (!m){
        m = document.createElement('div'); m.id = 'modal-battle';
        m.style.cssText = 'position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;background:rgba(4,8,14,.72);backdrop-filter:blur(6px)';
        document.body.appendChild(m);
        m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
      }
      const act = activePlayers();
      const members = t ? (t.members||[]).slice() : [];
      m.innerHTML = `
      <div class="glass gold-border" style="width:min(620px,94vw);padding:22px">
        <div class="card-head"><span class="ic">🛡️</span><h3>${t?'ویرایش تیم':'تیم جدید'}</h3><span class="tag">${t?esc(t.name):'Team'}</span></div>
        <div class="field-grid" style="margin-top:12px">
          <div><label>نام تیم</label><input class="input" id="tm-name" style="width:100%" value="${t?esc(t.name):''}"></div>
          <div><label>آیکن</label><input class="input" id="tm-icon" style="width:100%" value="${t?esc(t.icon):'⚔️'}"></div>
          <div><label>رنگ</label><input class="input" id="tm-color" type="color" style="width:100%;height:38px" value="${t?esc(t.color):'#D4AF37'}"></div>
        </div>
        <div class="form-section" style="margin-top:10px">👥 بازیکنان تیم (دابل‌کلیک برای افزودن/حذف) — ${D.fa(members.length)} نفر</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:5px">بازیکنان موجود</div>
            <input class="input" id="tm-search" placeholder="جست‌وجو…" style="width:100%;margin-bottom:6px">
            <div id="tm-all" class="rp-list" style="max-height:200px;overflow:auto"></div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:5px">اعضای تیم</div>
            <div id="tm-part" class="rp-list" style="max-height:200px;overflow:auto"></div>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end">
          <button class="btn sm ghost" id="tm-cancel">انصراف</button>
          <button class="btn sm" id="tm-save">💾 ذخیره</button>
        </div>
      </div>`;
      m.style.display = 'flex';
      const allBox = m.querySelector('#tm-all'), partBox = m.querySelector('#tm-part'), qbox = m.querySelector('#tm-search');
      const nameOf = pid => { const x = act.find(p => p.pid === +pid); return x ? x.name : B.nameOf(pid); };
      function paint(){
        const q = (qbox.value || '').trim();
        const partSet = new Set(members);
        allBox.innerHTML = act.filter(p => !partSet.has(p.pid) && (!q || p.name.includes(q))).map(p => `<div class="rp-item" data-pid="${p.pid}">${esc(p.name)}</div>`).join('') || '<div style="color:var(--muted);font-size:12px;padding:8px">—</div>';
        partBox.innerHTML = members.map(pid => `<div class="rp-item sel" data-pid="${pid}">${esc(nameOf(pid))}</div>`).join('') || '<div style="color:var(--muted);font-size:12px;padding:8px">—</div>';
      }
      allBox.addEventListener('dblclick', e => { const it = e.target.closest('.rp-item'); if (!it) return; members.push(+it.dataset.pid); paint(); });
      partBox.addEventListener('dblclick', e => { const it = e.target.closest('.rp-item'); if (!it) return; members.splice(members.indexOf(+it.dataset.pid),1); paint(); });
      qbox.addEventListener('input', paint);
      paint();
      m.querySelector('#tm-cancel').addEventListener('click', () => m.style.display = 'none');
      m.querySelector('#tm-save').addEventListener('click', () => {
        const name = (m.querySelector('#tm-name').value || '').trim();
        if (!name){ APP.toast('نام تیم را وارد کنید', 'red'); return; }
        const patch = { name, icon: m.querySelector('#tm-icon').value || '⚔️', color: m.querySelector('#tm-color').value || '#D4AF37', members };
        if (t) B.updateTeam(t.id, patch); else B.addTeam(patch);
        B.refresh(); m.style.display = 'none'; refreshBattle();
        APP.toast(t?'تیم ویرایش شد ✓':'تیم جدید ثبت شد ✓', 'green');
      });
    }

    /* ── مودال جدال: تعریف + ثبت نتیجه ── */
    function battleMatchModal(id){
      const d = B.ensure();
      const mm = d.matches.find(x => x.id === id);
      if (!mm || !mm.home || !mm.away){ APP.toast('جدال معتبر نیست', 'red'); return; }
      let m = $('#modal-battle2');
      if (!m){
        m = document.createElement('div'); m.id = 'modal-battle2';
        m.style.cssText = 'position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;background:rgba(4,8,14,.72);backdrop-filter:blur(6px)';
        document.body.appendChild(m);
        m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
      }
      m.innerHTML = `
      <div class="glass gold-border" style="width:min(560px,94vw);padding:22px">
        <div class="card-head"><span class="ic">🎯</span><h3>نتیجهٔ جدال — ${esc(B.teamName(mm.home))} در برابر ${esc(B.teamName(mm.away))}</h3><span class="tag">${mm.status==='done'?'ثبت‌شده':'برنامه'}</span></div>
        <div class="field-grid" style="margin-top:12px">
          <div><label>برنده</label><select class="sel" id="bm-winner" style="width:100%">
            <option value="" ${!mm.winner?'selected':''}>— انتخاب —</option>
            <option value="home" ${mm.winner==='home'?'selected':''}>${esc(B.teamName(mm.home))} (میزبان)</option>
            <option value="away" ${mm.winner==='away'?'selected':''}>${esc(B.teamName(mm.away))} (مهمان)</option>
            <option value="draw" ${mm.winner==='draw'?'selected':''}>مساوی</option>
          </select></div>
          <div><label>امتیاز میزبان</label><input class="input" id="bm-hs" type="number" min="0" value="${mm.homeScore!=null?mm.homeScore:''}"></div>
          <div><label>امتیاز مهمان</label><input class="input" id="bm-as" type="number" min="0" value="${mm.awayScore!=null?mm.awayScore:''}"></div>
          <div class="span2"><label class="lbl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="bm-counted" ${mm.counted!==false?'checked':''}> این جدال در رنک/امتیاز فصل شمرده شود</label></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end">
          <button class="btn sm ghost" id="bm-cancel">انصراف</button>
          <button class="btn sm" id="bm-save">💾 ثبت نتیجه</button>
        </div>
      </div>`;
      m.style.display = 'flex';
      m.querySelector('#bm-cancel').addEventListener('click', () => m.style.display = 'none');
      m.querySelector('#bm-save').addEventListener('click', () => {
        const winner = m.querySelector('#bm-winner').value;
        if (!winner){ APP.toast('برنده را انتخاب کنید', 'red'); return; }
        const hs = +(m.querySelector('#bm-hs').value||0), as = +(m.querySelector('#bm-as').value||0);
        B.updateMatch(id, { winner, status:'done', homeScore:hs, awayScore:as, counted: m.querySelector('#bm-counted').checked });
        B.refresh(); m.style.display = 'none'; refreshBattle();
        APP.toast('نتیجهٔ جدال ثبت شد — امتیاز فصل به‌روز شد ✓', 'green');
      });
    }

    /* ── رویدادهای اصلی ── */
    $('#bt-settings-save').addEventListener('click', () => {
      B.saveSettings({
        winPts:+($('#bt-win').value||0), drawPts:+($('#bt-draw').value||0), lossPts:+($('#bt-loss').value||0),
        seasonWinPts:+($('#bt-swin').value||0), seasonDrawPts:+($('#bt-sdraw').value||0), seasonLossPts:+($('#bt-sloss').value||0),
        seasonEnabled: $('#bt-season').checked,
      });
      B.refresh(); refreshBattle(); APP.toast('تنظیمات نبرد ذخیره شد ✓', 'green');
    });
    $('#bt-reset').addEventListener('click', () => {
      if (!confirm('تیم‌ها و جدال‌ها به نمونهٔ پیش‌فرض بازنشانی شود؟')) return;
      B.reset(); B.refresh(); refreshBattle(); APP.toast('نمونهٔ تیم‌ها بازنشانی شد ✓', 'green');
    });
    $('#bt-add-team').addEventListener('click', () => battleTeamModal(null));
    $('#bt-add-match').addEventListener('click', () => {
      const home = $('#bt-m-home').value, away = $('#bt-m-away').value;
      if (!home || !away || home === away){ APP.toast('دو تیم متفاوت را انتخاب کنید', 'red'); return; }
      const dEl = $('#bt-m-date'); const iso = (dEl && dEl._value) ? dEl._value() : null;
      if (!iso){ APP.toast('تاریخ را وارد کنید', 'red'); return; }
      B.addMatch({ home, away, date: iso, time: $('#bt-m-time').value || '', counted: $('#bt-m-counted').checked, status:'scheduled', winner:null, homeScore:null, awayScore:null });
      B.refresh(); refreshBattle(); APP.toast('جدال ثبت شد ✓', 'green');
    });

    renderTeamList();
    renderMatchList();
  }

  /* ═══════════════ سرزمین آواتارها: قوانین مرتب‌سازی و باشگاه‌ها ═══════════════ */
  function mgmtAvatarLand(body){
    const KEY = 'ga_avatarland_cfg';
    function load(){
      const def = { sort:['spent','income','lv','join'], dir:{ spent:-1, income:-1, lv:-1, join:1 }, club:[[1,5,'par'],[6,10,'birdie'],[11,15,'eagle']], onlySpenders:true };
      try { return Object.assign(def, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch(e){ return def; }
    }
    function save(c){ try { localStorage.setItem(KEY, JSON.stringify(c)); } catch(e){} }
    function saveAndReload(c){ save(c); APP.reloadData(); APP.go('mgmt'); mgmtTab = 'avatars'; APP.toast('قوانین سرزمین آواتارها ذخیره شد ✓', 'green'); }
    let cfg = load();
    const DIMS = { spent:'بیشترین خرج', income:'بیشترین درآمد', lv:'سطح بالاتر', join:'عضو قدیمی‌تر' };
    const DIM_KEYS = Object.keys(DIMS);
    const orderSel = cur => DIM_KEYS.map(k => `<option value="${k}" ${cur===k?'selected':''}>${DIMS[k]}</option>`).join('');
    const clubRows = cfg.club.slice();
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">🌸</span><h3>${esc(L('admin.avatars','سرزمین آواتارها'))} — قوانین نمایش و مرتب‌سازی</h3><span class="tag">Avatar Land ⚙️</span></div>
      <div style="font-size:11.5px;color:var(--muted);line-height:2;margin-top:6px">ترتیب نمایش کارت‌ها و کارت‌های افتخار طبق این اولویت‌ها محاسبه می‌شود (اولویت اول تا چهارم). تغییرات پس از ذخیره فوراً روی صفحهٔ اعمال می‌شود.</div>
      <div class="form-section" style="margin-top:12px">🔀 ترتیب مرتب‌سازی (اولویت ۱ تا ۴)</div>
      <div class="field-grid">
        ${[0,1,2,3].map(i => `
          <div><label>اولویت ${['اول','دوم','سوم','چهارم'][i]}</label>
            <div style="display:flex;gap:6px;align-items:center">
              <select class="sel" data-order-i="${i}" style="flex:1">${orderSel(cfg.sort[i])}</select>
              <select class="sel" data-dir="${cfg.sort[i]||'spent'}" data-dir-i="${i}" style="width:82px">
                <option value="-1" ${(cfg.dir[cfg.sort[i]]||-1)===-1?'selected':''}>نزولی</option>
                <option value="1" ${(cfg.dir[cfg.sort[i]]||-1)===1?'selected':''}>صعودی</option>
              </select>
            </div>
          </div>`).join('')}
      </div>
      <div class="form-section" style="margin-top:12px">🏳️ باشگاه‌ها (محدودهٔ سطح)</div>
      <div class="field-grid">
        ${['par','birdie','eagle'].map((id,ci) => {
          const row = clubRows.find(r => r[2] === id) || (id==='par'?[1,5,'par']:id==='birdie'?[6,10,'birdie']:[11,15,'eagle']);
          return `<div style="display:flex;gap:6px;align-items:center">
            <span style="flex:0 0 auto;width:92px;font-size:12px;font-weight:800" class="${id==='eagle'?'al-club eagle':id==='birdie'?'al-club birdie':'al-club par'}">${id==='eagle'?'🦅 Eagle':id==='birdie'?'🐦 Birdie':'⛳ Par'}</span>
            <input class="input" type="number" data-club-lo="${id}" value="${row[0]}" style="width:70px" min="1" max="15">
            <span style="color:var(--muted)">تا</span>
            <input class="input" type="number" data-club-hi="${id}" value="${row[1]}" style="width:70px" min="1" max="15">
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap">
        <label class="lbl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="al-only" ${cfg.onlySpenders?'checked':''}> فقط اعضایی که حداقل ۱ سکه خرج کرده‌اند</label>
        <button class="btn sm" id="al-save" style="margin-right:auto">💾 ذخیره قوانین</button>
      </div>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">👑</span><h3>پیش‌نمایش برترین‌ها</h3><span class="tag">${D.fa(avLandPreview().length)} آواتار</span></div>
      <div id="al-prev" style="margin-top:10px"></div>
    </div>`;
    function avLandPreview(){
      // reuse the same aggregation used by the member page (mirrored here to keep admin independent)
      let out = [];
      try {
        const st = gstate().S || {};
        const plist = st.players || [];
        const users = (window.APP && APP.users && APP.users.list) ? APP.users.list().filter(u => u.role==='member' && u.active!==false) : [];
        users.forEach(u => {
          const pid = +u.pid; if (!pid || !window.AV) return;
          const prow = plist.find(x => x[0]===pid);
          const c = AV.coinOf(u.user);
          const log = c.log || [];
          const income = log.filter(l => (+l.amount||0) > 0 && (String(l.source||'').indexOf('req:')===0 || String(l.source||'')==='admin')).reduce((a,l)=>a+(+l.amount||0),0);
          const spent = log.filter(l => (+l.amount||0) < 0).reduce((a,l)=>a+Math.abs(+l.amount||0),0);
          out.push({ user:u.user, name:u.name, spent, income });
        });
      } catch(e){}
      return out;
    }
    function clubColor(c){ return c==='eagle'?'#f6e27a':c==='birdie'?'#5FE3B0':'#CBD4E1'; }
    function paintPreview(){
      const box = $('#al-prev'); if (!box) return;
      let lst = avLandPreview();
      if ($('#al-only').checked) lst = lst.filter(m => m.spent > 0);
      const dir = cfg.dir || { spent:-1, income:-1, lv:-1, join:1 };
      const sort = cfg.sort || ['spent','income','lv','join'];
      lst.sort((a,b) => {
        for (let i=0;i<sort.length;i++){
          const k = sort[i]; const d = (+dir[k]||0)===1?1:-1;
          const av = (a[k]??0), bv = (b[k]??0);
          if (av === bv) continue; return (av-bv)*d;
        }
        return 0;
      });
      box.innerHTML = lst.length ? lst.slice(0,10).map((m,i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:12px;border:1px solid var(--line-soft);background:rgba(255,255,255,.03);margin-bottom:7px">
          <span style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;background:linear-gradient(135deg,#f6e27a,#d4af37);color:#0B0F14">${D.fa(i+1)}</span>
          <b style="flex:1;font-size:13px">${esc(m.name)}</b>
          <span style="font-size:11px;color:var(--muted)">💸 ${D.faNum(m.spent,0)}</span>
          <span style="font-size:11px;color:var(--muted)">💵 ${D.faNum(m.income,0)}</span>
        </div>`).join('') : '<div style="color:var(--muted);padding:10px;font-size:12px">آواتاری با این قوانین پیدا نشد.</div>';
    }
    paintPreview();
    $('#al-only').addEventListener('change', paintPreview);
    $$('[data-order-i]').forEach(sel => sel.addEventListener('change', e => {
      const i = +e.target.dataset.orderI || +e.target.dataset.order_i;
      cfg.sort[i] = e.target.value;
      save(cfg); APP.go('mgmt'); mgmtTab = 'avatars';
    }));
    $$('[data-dir-i]').forEach(sel => sel.addEventListener('change', e => {
      const i = +e.target.dataset.dirI || +e.target.dataset.dir_i;
      const k = cfg.sort[i]; cfg.dir[k] = +e.target.value;
      save(cfg); APP.go('mgmt'); mgmtTab = 'avatars';
    }));
    $('#al-save').addEventListener('click', () => {
      const club = ['par','birdie','eagle'].map(id => {
        const lo = +($('[data-club-lo="'+id+'"]').value||1);
        const hi = +($('[data-club-hi="'+id+'"]').value||1);
        return [Math.min(lo,hi), Math.max(lo,hi), id];
      });
      cfg.club = club;
      cfg.onlySpenders = $('#al-only').checked;
      saveAndReload(cfg);
    });
  }

  /* ═══════════════ ویرایش مرکزی نام همهٔ آیتم‌ها و تب‌ها ═══════════════ */
  function mgmtLabels(body){
    const api = window.UI_LABELS;
    if (!api){
      body.innerHTML = '<div class="glass" style="color:#ff8f82">سامانهٔ نام‌ها بارگذاری نشده است.</div>';
      return;
    }
    const defs = api.defs();
    const customCount = defs.filter(d => d.custom).length;
    const groups = [];
    defs.forEach(d => {
      let g = groups.find(x => x.name === d.group);
      if (!g){ g = { name:d.group, rows:[] }; groups.push(g); }
      g.rows.push(d);
    });
    const link = api.shareLink();
    body.innerHTML = `
      <div class="glass gold-border label-hero">
        <div class="card-head"><span class="ic">✏️</span><h3>${esc(L('admin.labels','ویرایش آیتم‌ها'))}</h3><span class="tag">${D.fa(defs.length)} نام قابل ویرایش</span></div>
        <div class="label-help">
          نام هر تب یا آیتم را یک‌بار تغییر دهید تا در منوی اصلی، عنوان صفحه، پنل اعضا، موبایل، تنظیمات و فروشگاه همان نام نمایش داده شود.
          نمونه: «${esc(L('nav.cmd','فرماندهی'))}» را به «داشبورد» تغییر دهید.
        </div>
        <div class="label-toolbar">
          <input class="input" id="lbl-search" placeholder="🔎 جست‌وجوی نام یا گروه…" autocomplete="off">
          <button class="btn sm" id="lbl-save">💾 ذخیره و اعمال همه‌جا</button>
          <button class="btn sm ghost" id="lbl-reset-all">♻️ بازنشانی همه نام‌ها</button>
          <span class="label-count">${D.fa(customCount)} نام تغییرکرده</span>
        </div>
      </div>

      <div id="label-groups">
        ${groups.map(g => `
          <section class="glass label-group" data-label-group="${esc(g.name)}">
            <div class="card-head"><span class="ic">🗂️</span><h3>${esc(g.name)}</h3><span class="tag">${D.fa(g.rows.length)} آیتم</span></div>
            <div class="label-list">
              ${g.rows.map(d => `
                <div class="label-row ${d.custom?'changed':''}" data-label-row data-search="${esc((d.group+' '+d.def+' '+d.value).toLowerCase())}">
                  <div class="label-meta"><span class="label-icon">${d.icon}</span><span><b>${esc(d.def)}</b><small>${esc(d.id)}</small></span></div>
                  <input class="input label-input" data-label-input="${esc(d.id)}" data-default="${esc(d.def)}" value="${esc(d.value)}" maxlength="80" aria-label="نام جدید ${esc(d.def)}">
                  <button class="btn sm ghost label-reset" data-label-reset="${esc(d.id)}" title="بازگشت به نام پیش‌فرض">↺ پیش‌فرض</button>
                </div>`).join('')}
            </div>
          </section>`).join('')}
      </div>

      <div class="glass gold-border label-sync">
        <div class="card-head"><span class="ic">📱</span><h3>اعمال همین نام‌ها روی گوشی و دستگاه دیگر</h3><span class="tag">همگام‌سازی</span></div>
        <div class="label-help">بعد از ذخیره، این لینک را روی گوشی باز کنید یا کد را اسکن کنید؛ نام‌ها در مرورگر گوشی ذخیره و بلافاصله روی نسخهٔ موبایل اعمال می‌شوند.</div>
        <div class="label-sync-grid">
          <div>
            <label>لینک همگام‌سازی موبایل</label>
            <div class="label-link-row"><input class="input" id="lbl-link" value="${esc(link)}" readonly><button class="btn sm" id="lbl-copy">📋 کپی لینک</button></div>
            <label style="margin-top:12px;display:block">ورود لینک یا کد دریافت‌شده</label>
            <div class="label-link-row"><textarea class="input" id="lbl-import" rows="2" placeholder="لینک یا کد همگام‌سازی را اینجا قرار دهید"></textarea><button class="btn sm ghost" id="lbl-import-btn">📥 اعمال کد</button></div>
          </div>
          <div class="label-qr" id="lbl-qr"><span>در حال ساخت QR…</span></div>
        </div>
      </div>`;

    const inputs = $$('[data-label-input]', body);
    inputs.forEach(inp => inp.addEventListener('input', () => {
      const row = inp.closest('[data-label-row]');
      if (row) row.classList.toggle('changed', inp.value.trim() !== inp.dataset.default);
    }));
    $$('[data-label-reset]', body).forEach(btn => btn.addEventListener('click', () => {
      const inp = body.querySelector(`[data-label-input="${btn.dataset.labelReset}"]`);
      if (inp){ inp.value = inp.dataset.default; inp.dispatchEvent(new Event('input')); }
    }));
    $('#lbl-search', body).addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      $$('[data-label-row]', body).forEach(r => { r.style.display = !q || (r.dataset.search || '').includes(q) ? '' : 'none'; });
      $$('[data-label-group]', body).forEach(g => {
        g.style.display = $$('[data-label-row]', g).some(r => r.style.display !== 'none') ? '' : 'none';
      });
    });
    $('#lbl-save', body).addEventListener('click', () => {
      const values = {};
      inputs.forEach(inp => { values[inp.dataset.labelInput] = inp.value; });
      api.setMany(values);
      APP.toast('نام‌ها ذخیره شد و در همهٔ بخش‌های سایت اعمال شد ✓', 'green');
    });
    $('#lbl-reset-all', body).addEventListener('click', () => {
      if (!confirm('همهٔ نام‌های سفارشی به حالت پیش‌فرض برگردند؟')) return;
      api.resetAll();
      APP.toast('همهٔ نام‌ها به حالت پیش‌فرض برگشت', 'orange');
    });
    function copyText(text){
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch(e){} t.remove(); return Promise.resolve();
    }
    $('#lbl-copy', body).addEventListener('click', () => {
      copyText($('#lbl-link', body).value).then(() => APP.toast('لینک همگام‌سازی کپی شد ✓', 'green')).catch(() => APP.toast('لینک را دستی کپی کنید', 'orange'));
    });
    $('#lbl-import-btn', body).addEventListener('click', () => {
      const code = $('#lbl-import', body).value.trim();
      if (!code){ APP.toast('ابتدا لینک یا کد را وارد کنید', 'red'); return; }
      if (api.importToken(code)) APP.toast('نام‌ها از کد دریافت و روی این دستگاه اعمال شد ✓', 'green');
      else APP.toast('کد همگام‌سازی معتبر نیست', 'red');
    });
    setTimeout(() => {
      const host = $('#lbl-qr', body); if (!host) return;
      try {
        if (typeof qrcode === 'undefined') throw new Error('qr');
        const qr = qrcode(0, 'M'); qr.addData(link); qr.make();
        const img = document.createElement('img'); img.src = qr.createDataURL(4, 8); img.alt = 'QR همگام‌سازی نام‌ها';
        host.innerHTML = ''; host.appendChild(img); host.insertAdjacentHTML('beforeend','<small>برای اعمال روی موبایل اسکن کنید</small>');
      } catch(e){ host.innerHTML = '<span>لینک را با دکمهٔ «کپی لینک» به گوشی بفرستید.</span>'; }
    }, 30);
  }

  /* ───────── فرم جامع بازیکن (مشترک ساخت/ویرایش) ───────── */
  function playerFormHTML(p){
    p = p || { name:'', family:'', gender:'مرد', hcp:'10', join:'', birth:'', phone:'', national:'', email:'', address:'', father:'', fatherPhone:'', mother:'', motherPhone:'', photo:'', user:'', pass:'' };
    const iso = (p.birth || '').length === 10 ? p.birth : '';
    const today = new Date().toISOString().slice(0,10);
    return `
    <div class="form-section">🪪 مشخصات اصلی</div>
    <div class="field-grid">
      <div class="photo-upload span2">
        <img id="pf-photo" class="ph-prev ${p.photo?'':'empty'}" src="${p.photo || ''}" alt="" ${p.photo?'':'data-empty="1"'}>
        <div style="flex:1">
          <label>عکس بازیکن (آپلود یا لمس برای انتخاب)</label>
          <input class="input" type="file" id="pf-file" accept="image/*" style="width:100%;margin-top:5px;font-size:11.5px">
          <div style="font-size:10.5px;color:var(--muted);margin-top:4px">فرمت‌های PNG / JPG — حداکثر ~۲ مگابایت</div>
        </div>
      </div>
      <div><label>نام</label><input class="input" id="pf-name" value="${esc(p.name)}" style="width:100%" placeholder="مثلاً علی"></div>
      <div><label>نام خانوادگی</label><input class="input" id="pf-family" value="${esc(p.family)}" style="width:100%" placeholder="مثلاً محمدی"></div>
      <div><label>جنسیت</label><select class="sel" id="pf-gender" style="width:100%"><option ${p.gender==='مرد'?'selected':''}>مرد</option><option ${p.gender==='زن'?'selected':''}>زن</option></select></div>
      <div><label>تاریخ تولد <small style="color:var(--dim)">(شمسی)</small></label><div id="pf-birth" data-iso="${iso}"></div></div>
      <div><label>تاریخ عضویت <small style="color:var(--dim)">(شمسی)</small></label><div id="pf-join"></div></div>
      <div><label>هندیکپ</label><input class="input" type="number" id="pf-hcp" min="0" max="36" value="${p.hcp}" style="width:100%"></div>
    </div>
    <div class="form-section">📞 اطلاعات تماس</div>
    <div class="field-grid">
      <div><label>شماره موبایل</label><input class="input" id="pf-phone" value="${esc(p.phone)}" style="width:100%" placeholder="۰۹۱۲..."></div>
      <div><label>کد ملی</label><input class="input" id="pf-national" value="${esc(p.national)}" style="width:100%"></div>
      <div><label>ایمیل</label><input class="input" id="pf-email" value="${esc(p.email)}" style="width:100%" placeholder="example@mail.com"></div>
      <div class="span2"><label>آدرس</label><input class="input" id="pf-address" value="${esc(p.address)}" style="width:100%" placeholder="آدرس محل سکونت"></div>
    </div>
    <div class="form-section">👨‍👩‍👧 والدین / سرپرست</div>
    <div class="field-grid">
      <div><label>نام پدر</label><input class="input" id="pf-father" value="${esc(p.father)}" style="width:100%"></div>
      <div><label>شماره پدر</label><input class="input" id="pf-fatherPhone" value="${esc(p.fatherPhone)}" style="width:100%" placeholder="۰۹۱۲..."></div>
      <div><label>نام مادر</label><input class="input" id="pf-mother" value="${esc(p.mother)}" style="width:100%"></div>
      <div><label>شماره مادر</label><input class="input" id="pf-motherPhone" value="${esc(p.motherPhone)}" style="width:100%" placeholder="۰۹۱۲..."></div>
    </div>
    <div class="form-section">🔐 یوزر و پسورد ورود به سایت</div>
    <div class="field-grid">
      <div><label>نام کاربری (login)</label><input class="input" id="pf-user" value="${esc(p.user)}" style="width:100%;direction:ltr" placeholder="player123"></div>
      <div><label>رمز عبور</label>
        <input class="input" id="pf-pass" value="${esc(p.pass)}" style="width:100%;direction:ltr">
        <span class="gen-pass" id="pf-gen">⚡ تولید خودکار رمز</span>
      </div>
    </div>`;
  }
  function readPlayerForm(root){
    root = root || document;
    const q = sel => root.querySelector(sel);
    const gv = (el, fallback) => el ? el.value.trim() : (fallback || '');
    return {
      name: gv(q('#pf-name')),
      family: gv(q('#pf-family')),
      gender: q('#pf-gender') ? q('#pf-gender').value : 'مرد',
      birth: (q('#pf-birth') && q('#pf-birth')._value) ? q('#pf-birth')._value() : gv(q('#pf-birth')),
      join: (q('#pf-join') && q('#pf-join')._value) ? q('#pf-join')._value() : gv(q('#pf-join')),
      hcp: Math.max(0, Math.min(36, +(q('#pf-hcp') ? q('#pf-hcp').value : 10) || 10)),
      phone: gv(q('#pf-phone')),
      national: gv(q('#pf-national')),
      email: gv(q('#pf-email')),
      address: gv(q('#pf-address')),
      father: gv(q('#pf-father')),
      fatherPhone: gv(q('#pf-fatherPhone')),
      mother: gv(q('#pf-mother')),
      motherPhone: gv(q('#pf-motherPhone')),
      user: gv(q('#pf-user')),
      pass: q('#pf-pass') ? q('#pf-pass').value : '',
    };
  }
  function wirePlayerForm(root){
    root = root || document;
    const q = sel => root.querySelector(sel);
    // عکس
    const file = q('#pf-file');
    if (file) file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 2.5*1024*1024){ APP.toast('حجم عکس زیاد است (حداکثر ۲.۵MB)', 'red'); return; }
      const rd = new FileReader();
      rd.onload = () => {
        const img = q('#pf-photo');
        img.src = rd.result; img.classList.remove('empty');
      };
      rd.readAsDataURL(f);
    });
    // تاریخ‌های شمسی (تولد + عضویت) — iso از data-iso خود عنصر یا data-birth/data-join والد
    const birthEl = q('#pf-birth');
    if (birthEl && !birthEl.classList.contains('jdate')){
      const wrap = root.querySelector('[data-birth]');
      const iso = birthEl.dataset.iso || (wrap ? wrap.getAttribute('data-birth') : '');
      JDate.render(birthEl, { value: iso || D.shamsiToISO(1390,1,1), onChange(){} });
      if (iso){ const p = D.parseShamsi(D.isoToShamsi(iso)); if (p) birthEl._set(iso); }
    }
    const joinEl = q('#pf-join');
    if (joinEl && !joinEl.classList.contains('jdate')){
      const wrap = root.querySelector('[data-join]');
      const jiso = birthEl ? '' : ''; // placeholder no-op
      const jv = (wrap ? wrap.getAttribute('data-join') : '') || '';
      JDate.render(joinEl, { value: jv || new Date().toISOString().slice(0,10), onChange(){} });
      if (jv && joinEl._set) joinEl._set(jv);
    }
    // تولید رمز
    const gen = q('#pf-gen');
    if (gen) gen.addEventListener('click', () => {
      const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
      let pw = '';
      for (let i=0;i<8;i++) pw += chars[Math.floor(Math.random()*chars.length)];
      const passEl = q('#pf-pass');
      if (passEl) passEl.value = pw;
      APP.toast('رمز تصادفی ساخته شد — حتماً ذخیره کنید', 'gold');
    });
  }

  /* ── تب بازیکنان ── */
  function mgmtPlayers(body){
    const S = gstate().S, A = gstate().A;
    const players = S.players;
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">➕</span><h3>ثبت بازیکن جدید</h3><span class="tag">فرم جامع</span></div>
      <div id="np-form" style="margin-top:8px">${playerFormHTML()}</div>
      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
        <button class="btn sm" id="np-add">+ ثبت بازیکن در آکادمی</button>
        <span style="color:var(--muted);font-size:11.5px;align-self:center">با ثبت، یوزر/پسورد برای ورود به سایت فعال می‌شود</span>
      </div>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">👥</span><h3>بازیکنان آکادمی</h3><span class="tag">${D.fa(players.length)} نفر</span></div>
      <div class="toolbar" style="margin:10px 0">
        <input class="input" id="pl-search" placeholder="🔍 جستجو در نام / موبایل / کد ملی..." style="width:260px">
        <select class="sel" id="pl-filter"><option value="">همه</option><option value="active">فعال</option><option value="inactive">غیرفعال</option></select>
      </div>
      <div style="overflow-x:auto"><table class="tbl"><thead><tr>
        <th>عکس</th><th>بازیکن</th><th>تولد</th><th>موبایل</th><th>یوزر سایت</th><th>وضعیت</th><th>رنک</th><th>عملیات</th>
      </tr></thead><tbody id="pl-rows"></tbody></table></div>
    </div>`;
    wirePlayerForm();

    function renderRows(){
      const q = ($('#pl-search').value || '').trim().toLowerCase();
      const f = $('#pl-filter').value;
      const rows = players.filter(p => {
        if (f === 'active' && !p[5]) return false;
        if (f === 'inactive' && p[5]) return false;
        if (q){
          const full = playerFull(p[0]);
          const hay = (p[1] + ' ' + (full ? full.phone + ' ' + full.national + ' ' + full.user : '')).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      $('#pl-rows').innerHTML = rows.map(p => {
        const full = playerFull(p[0]);
        const rankRow = A.LB.find(r => r.pid === p[0]);
        const rank = rankRow ? rankRow.color : 'White';
        const col = D.RANK_DEF.find(r=>r[0]===rank)[3];
        const isCustom = p[0] >= 9000;
        const photo = full.photo || (p[2] === 'زن' ? (W.__AV_F || 'assets/avatar_f.webp') : (W.__AV_M || 'assets/avatar_m.webp'));
        const birthFa = full.birth ? (() => { try { const j = D.jalaliInfo(D.dateFrom(full.birth)); return `${D.fa(j.dd)} ${j.monthFa} ${D.fa(j.yy)}`; } catch(e){ return ''; } })() : '—';
        return `<tr data-pid="${p[0]}" class="${p[5]?'':'off-row'}">
          <td><img src="${photo}" style="width:38px;height:38px;border-radius:10px;object-fit:cover;border:1px solid ${col}66" alt=""></td>
          <td><b>${esc(p[1])}</b><br><small style="color:var(--muted)">${isCustom?'جدید':'پایه'} • HCP ${D.fa(full.hcp)}</small></td>
          <td style="font-size:11.5px;color:var(--muted)">${birthFa}</td>
          <td style="font-size:11.5px;direction:ltr" class="num">${esc(full.phone || '—')}</td>
          <td style="font-size:11.5px">${full.user ? `<span class="chip green">${esc(full.user)}</span>` : '<span class="chip dim">—</span>'}</td>
          <td><span class="chip ${p[5]?'green':'red'}">${p[5]?'فعال':'غیرفعال'}</span></td>
          <td><span class="rank-pill" style="background:${col}22;color:${col};border:1px solid ${col}55">${D.RANK_TEXT[rank]}</span></td>
          <td><div class="row-actions">
            <button class="btn sm ghost" data-act="edit" data-p="${p[0]}">✏️ ویرایش</button>
            ${p[5] ? `<button class="btn sm danger" data-act="deact" data-p="${p[0]}">⛔ غیرفعال</button>` : `<button class="btn sm green-ghost" data-act="act" data-p="${p[0]}">✔ فعال</button>`}
            ${isCustom ? `<button class="btn sm danger" data-act="del" data-p="${p[0]}">🗑 حذف</button>` : ''}
          </div></td>
        </tr>`;
      }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:18px">بازیکنی یافت نشد</td></tr>';
    }
    renderRows();
    $('#pl-search').addEventListener('input', renderRows);
    $('#pl-filter').addEventListener('change', renderRows);

    $('#np-add').addEventListener('click', () => {
      const d = readPlayerForm();
      const anyFilled = d.name || d.phone || d.national || d.email || d.user || d.father || d.mother;
      if (!anyFilled){ APP.toast('حداقل یک مورد را پر کنید (مثلاً نام یا موبایل)', 'red'); return; }
      const fullName = ((d.name || 'بازیکن') + ' ' + d.family).trim();
      // یوزر پیشنهادی اگر خالی بود
      let user = d.user;
      if (!user) user = 'player' + (9000 + customPlayers().length);
      let pass = d.pass;
      if (!pass) pass = 'golf' + String(Math.floor(1000 + Math.random()*9000));
      const lst = customPlayers();
      const pid = 9000 + (lst.length ? Math.max(...lst.map(p=>p.id)) - 9000 + 1 : 0);
      lst.push({ id: pid - 9000, name: d.name, family: d.family, gender: d.gender, hcp: d.hcp,
        join: d.join, birth: d.birth, phone: d.phone, national: d.national, email: d.email,
        address: d.address, father: d.father, fatherPhone: d.fatherPhone, mother: d.mother,
        motherPhone: d.motherPhone, photo: ($('#pf-photo').src && !$('#pf-photo').hasAttribute('data-empty')) ? $('#pf-photo').src : '',
        active: true });
      saveCustomPlayers(lst);
      const pu = playerUsers();
      pu[pid] = { user, pass, name: d.name, family: d.family, active: true };
      savePlayerUsers(pu);
      syncPlayerToUser(pid, { user, pass, name: fullName, active: true });
      APP.reloadData(); APP.go('mgmt');
      APP.toast('بازیکن «' + fullName + '» ثبت شد — یوزر: ' + user + ' / رمز: ' + pass, 'green');
    });

    body.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const pid = +b.dataset.p, act = b.dataset.act;
      const p = S.players.find(x => x[0] === pid);
      if (!p) return;
      const isCustom = pid >= 9000;
      if (act === 'deact' || act === 'act'){
        const activeNow = act === 'act';
        if (isCustom){
          const lst = customPlayers();
          const c = lst.find(x => x.id === pid - 9000);
          if (c) c.active = activeNow;
          saveCustomPlayers(lst);
        } else {
          const ed = playerEdits();
          ed[pid] = Object.assign({}, ed[pid], { active: activeNow });
          savePlayerEdits(ed);
        }
        const pu = playerUsers();
        if (pu[pid]){ pu[pid].active = activeNow; savePlayerUsers(pu); }
        syncPlayerToUser(pid, { active: activeNow });
        APP.reloadData(); APP.go('mgmt');
        APP.toast(activeNow ? 'بازیکن فعال شد ✓ — همهٔ امتیازها برگشت' : 'بازیکن غیرفعال شد ⛔ — امتیازها و کارت‌ها حذف شدند', activeNow ? 'green' : 'orange');
      }
      if (act === 'del'){
        if (isCustom){
          const lst = customPlayers().filter(x => x.id !== pid - 9000);
          saveCustomPlayers(lst);
          const pu = playerUsers(); delete pu[pid]; savePlayerUsers(pu);
          removeUserOfPlayer(pid);
          APP.reloadData(); APP.go('mgmt');
          APP.toast('بازیکن حذف شد 🗑', 'orange');
        } else {
          APP.toast('بازیکنان پایه حذف نمی‌شوند — می‌توانید غیرفعال کنید', 'gold');
        }
      }
      if (act === 'edit') editPlayerModal(pid);
    }));
  }

  function editPlayerModal(pid){
    const full = playerFull(pid);
    if (!full) return;
    let m = $('#modal-edit');
    if (!m){
      m = document.createElement('div');
      m.id = 'modal-edit';
      m.style.cssText = 'position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;background:rgba(4,8,14,.72);backdrop-filter:blur(6px)';
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
    }
    m.innerHTML = `
    <div class="glass gold-border" style="width:min(760px,94vw);padding:22px;max-height:92vh;overflow:auto">
      <div class="card-head"><span class="ic">✏️</span><h3>ویرایش بازیکن</h3><span class="tag">${full.isCustom?'جدید':'پایه'}</span></div>
      <div style="margin-top:6px" data-birth="${full.birth||''}" data-join="${full.join||''}">${playerFormHTML(full)}</div>
      <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn sm danger" id="ep-cancel">بستن</button>
        <button class="btn sm" id="ep-save">💾 ذخیره تغییرات</button>
      </div>
    </div>`;
    m.style.display = 'flex';
    const sc = m.querySelector('[data-birth]') || m;
    wirePlayerForm(sc);
    $('#ep-cancel').addEventListener('click', () => m.style.display = 'none');
    $('#ep-save').addEventListener('click', () => {
      const d = readPlayerForm(sc);
      const anyFilled = d.name || d.phone || d.national || d.email || d.user || d.father || d.mother;
      if (!anyFilled){ APP.toast('حداقل یک مورد را پر کنید', 'red'); return; }
      const fullName = ((d.name || 'بازیکن') + ' ' + d.family).trim();
      const phEl = sc.querySelector('#pf-photo');
      const photo = phEl && phEl.src && !phEl.hasAttribute('data-empty') ? phEl.src : full.photo;
      if (full.isCustom){
        const lst = customPlayers();
        const c = lst.find(x => x.id === pid - 9000);
        if (c) Object.assign(c, { name:d.name, family:d.family, gender:d.gender, hcp:d.hcp, join:d.join,
          birth:d.birth, phone:d.phone, national:d.national, email:d.email, address:d.address,
          father:d.father, fatherPhone:d.fatherPhone, mother:d.mother, motherPhone:d.motherPhone, photo });
        saveCustomPlayers(lst);
      } else {
        const ed = playerEdits();
        ed[pid] = Object.assign({}, ed[pid], { name: d.name, family: d.family, gender: d.gender, hcp: d.hcp, join: d.join,
          birth: d.birth, phone: d.phone, national: d.national, email: d.email, address: d.address,
          father: d.father, fatherPhone: d.fatherPhone, mother: d.mother, motherPhone: d.motherPhone, photo });
        savePlayerEdits(ed);
      }
      // یوزر/پسورد
      const pu = playerUsers();
      const prev = credsOf(pid) || { active: true };
      if (d.user || d.pass){
        pu[pid] = { user: d.user || prev.user || 'player' + pid, pass: d.pass || prev.pass, name: d.name, family: d.family, active: prev.active !== false };
        savePlayerUsers(pu);
      }
      // ⇄ همگام‌سازی با لیست یوزرها (یوزر/رمز/نام)
      syncPlayerToUser(pid, {
        user: d.user || prev.user || '',
        pass: d.pass || prev.pass || '',
        name: fullName,
        active: prev.active !== false
      });
      APP.reloadData(); APP.go('mgmt');
      m.style.display = 'none';
      APP.toast('مشخصات «' + fullName + '» ذخیره شد ✓', 'green');
    });
  }

  /* ───────── نقشهٔ ماهواره‌ای (نمای شماتیک گوگل‌ارث) ───────── */
  function drawSatellite(cv, course, holes){
    const ctx = cv.getContext('2d');
    const W = cv.width = 680, H = cv.height = 380;
    const rnd = mulberry(course.id * 97 + (holes||18));
    // پس‌زمینهٔ زمین
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#223e22'); g.addColorStop(0.5,'#2d552d'); g.addColorStop(1,'#3a6b34');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    // خطوط چمن (mowing stripes)
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i=0;i<14;i++){ ctx.fillRect((i%2?0:18)+i*46, 0, 22, H); }
    // فیروی (مسیر منحنی)
    ctx.save();
    ctx.strokeStyle = 'rgba(180,220,120,.9)'; ctx.lineWidth = 58; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(60, H-40);
    ctx.bezierCurveTo(W*0.25, H*0.5, W*0.5, H*0.8, W*0.62, H*0.42);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(205,240,150,.85)'; ctx.lineWidth = 36; ctx.stroke();
    ctx.strokeStyle = 'rgba(225,250,180,.5)'; ctx.lineWidth = 16; ctx.stroke();
    ctx.restore();
    // بونکرها
    for (let i=0;i<5;i++){
      const bx = 120 + rnd()*(W-240), by = 60 + rnd()*(H-160);
      ctx.fillStyle = 'rgba(226,205,150,.9)';
      ctx.beginPath(); ctx.ellipse(bx, by, 22+rnd()*16, 14+rnd()*10, rnd()*3, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,244,200,.55)';
      ctx.beginPath(); ctx.ellipse(bx-4, by-4, 12, 7, 0, 0, 7); ctx.fill();
    }
    // دریاچه
    ctx.fillStyle = 'rgba(58,123,213,.85)';
    ctx.beginPath(); ctx.ellipse(W*0.86, H*0.2, 52, 30, -0.4, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(120,180,240,.4)';
    ctx.beginPath(); ctx.ellipse(W*0.86-10, H*0.2-8, 30, 14, -0.4, 0, 7); ctx.fill();
    // سبزه‌ها و پرچم‌ها
    const n = Math.min(holes||18, 18);
    for (let i=0;i<n;i++){
      const t = 0.08 + 0.84*(i/(n-1 || 1));
      const x = 70 + t*(W*0.55) + Math.sin(i*2.7)*16;
      const y = (H-44) + (0.5 - t)*(H*0.6) + Math.cos(i*1.9)*12;
      ctx.fillStyle = 'rgba(120,200,90,.95)';
      ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.stroke();
      // پرچم
      ctx.fillStyle = '#F8FAFC'; ctx.fillRect(x-1, y-30, 2, 30);
      ctx.fillStyle = '#E74C3C';
      ctx.beginPath(); ctx.moveTo(x+1, y-30); ctx.lineTo(x+13, y-26); ctx.lineTo(x+1, y-22); ctx.fill();
    }
    // سایهٔ دور (vignette)
    const vg = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);
    // مختصات گوشه
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '12px Consolas, monospace';
    ctx.textAlign = 'left'; ctx.fillText('LAT ' + course.lat.toFixed(5), 14, 24);
    ctx.fillText('LNG ' + course.lng.toFixed(5), 14, 40);
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillText('© Satellite view — GolfAcademy 1405', W-14, H-12);
  }
  function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

  /* ── انتخاب لوکیشن روی نقشه (map picker) ── */
  function openMapPicker(cb, initial){
    initial = initial || { lat: 24.7136, lng: 46.6753 };
    let m = $('#modal-map');
    if (!m){
      m = document.createElement('div');
      m.id = 'modal-map';
      m.style.cssText = 'position:fixed;inset:0;z-index:210;display:none;align-items:center;justify-content:center;background:rgba(4,8,14,.75);backdrop-filter:blur(6px)';
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
    }
    m.innerHTML = `
    <div class="glass gold-border" style="width:min(640px,94vw);padding:20px">
      <div class="card-head"><span class="ic">📍</span><h3>انتخاب موقعیت زمین روی نقشه</h3><span class="tag">کلیک = انتخاب</span></div>
      <div class="map-picker" id="mp-canvas-wrap" style="margin-top:12px">
        <canvas id="mp-canvas" width="600" height="340"></canvas>
        <div class="mk" id="mp-mk"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;align-items:center;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--muted)">مختصات:</span>
        <input class="input" id="mp-lat" value="${initial.lat}" style="width:110px;direction:ltr">
        <input class="input" id="mp-lng" value="${initial.lng}" style="width:110px;direction:ltr">
        <span class="chip blue" id="mp-name"></span>
        <div style="flex:1"></div>
        <button class="btn sm ghost" id="mp-cancel">انصراف</button>
        <button class="btn sm" id="mp-ok">✓ انتخاب</button>
      </div>
    </div>`;
    m.style.display = 'flex';
    const cv = $('#mp-canvas'), wrap = $('#mp-canvas-wrap'), mk = $('#mp-mk');
    const LATS = [29.2, 24.7, 26.4, 21.5, 25.9, 27.5];  // شهرهای عربستان (ریاض، جده...)
    const LNGS = [47.9, 46.7, 45.2, 39.2, 43.8, 41.7];
    const NAMES = ['ریاض','ریاض','قصیم','جده','حائل','مدینه'];
    function redraw(lat, lng){
      const ctx = cv.getContext('2d');
      ctx.clearRect(0,0,600,340);
      // پس‌زمینهٔ نقشه
      const g = ctx.createLinearGradient(0,0,600,340);
      g.addColorStop(0,'#16242e'); g.addColorStop(1,'#1d3138');
      ctx.fillStyle = g; ctx.fillRect(0,0,600,340);
      // شبکه
      ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
      for (let i=0;i<13;i++){ ctx.beginPath(); ctx.moveTo(i*50,0); ctx.lineTo(i*50,340); ctx.stroke(); }
      for (let i=0;i<8;i++){ ctx.beginPath(); ctx.moveTo(0,i*48); ctx.lineTo(600,i*48); ctx.stroke(); }
      // بلوک‌های شهری
      ctx.fillStyle = 'rgba(212,175,55,.12)';
      [[60,40],[420,90],[180,220],[480,240],[90,270],[330,120],[540,40]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x,y,70+ (x%3)*20, 50+(y%2)*16, 8) : ctx.rect(x,y,70,50); ctx.fill();
      });
      // جاده‌ها
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0,200); ctx.lineTo(600,140); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(300,0); ctx.lineTo(240,340); ctx.stroke();
      // شهرها
      ctx.fillStyle = 'rgba(248,250,252,.85)'; ctx.font = '11px Tahoma';
      ctx.textAlign = 'center';
      LATS.forEach((la,i) => {
        const x = 30 + (LNGS[i]-39)*45, y = 320 - (la-21)*34;
        ctx.fillStyle = 'rgba(248,250,252,.6)';
        ctx.beginPath(); ctx.arc(x,y,4,0,7); ctx.fill();
        ctx.fillText(NAMES[i], x, y-8);
      });
      // مارکر انتخاب
      const x = 30 + (lng-39)*45, y = 320 - (lat-21)*34;
      mk.style.left = (x-9) + 'px'; mk.style.top = (y-18) + 'px';
      ctx.fillStyle = 'rgba(231,76,60,.9)';
      ctx.beginPath(); ctx.arc(x,y,7,0,7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x,y,12,0,7); ctx.stroke();
    }
    redraw(+$('#mp-lat').value, +$('#mp-lng').value);
    wrap.addEventListener('click', e => {
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) * (600 / r.width);
      const y = (e.clientY - r.top) * (340 / r.height);
      const lat = +(21 + (320-y)/34).toFixed(4);
      const lng = +(39 + (x-30)/45).toFixed(4);
      $('#mp-lat').value = lat; $('#mp-lng').value = lng;
      redraw(lat, lng);
    });
    $('#mp-lat').addEventListener('input', () => redraw(+$('#mp-lat').value||0, +$('#mp-lng').value||0));
    $('#mp-lng').addEventListener('input', () => redraw(+$('#mp-lat').value||0, +$('#mp-lng').value||0));
    $('#mp-cancel').addEventListener('click', () => m.style.display = 'none');
    $('#mp-ok').addEventListener('click', () => {
      cb({ lat: +$('#mp-lat').value || initial.lat, lng: +$('#mp-lng').value || initial.lng });
      m.style.display = 'none';
    });
  }

  /* ── تب زمین‌ها ── */
  function mgmtCourses(body){
    const S = gstate().S;
    const extra = extraCourses();
    const rows = D.COURSES.map((c,i) => ({ id:c[0], name:c[1], loc:c[2], holes:c[3], pars:D.COURSE_PARS[c[0]], base:true, lat:24.7136, lng:46.6753 }))
      .concat(extra.map((c,i) => ({ id:1000+i, name:c.name, loc:c.loc||'ریاض', holes:c.holes, pars:c.pars, base:false, idx:i, lat:c.lat, lng:c.lng })));
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">➕</span><h3>طراح زمین — ثبت زمین جدید</h3><span class="tag">3 / 9 / 18</span></div>
      <div class="field-grid" style="margin-top:10px">
        <div><label>نام زمین</label><input class="input" id="mc-name" style="width:100%" placeholder="زمین جدید"></div>
        <div><label>محل / شهر</label><input class="input" id="mc-loc" style="width:100%" value="ریاض"></div>
        <div><label>تعداد میدان</label><select class="sel" id="mc-holes" style="width:100%"><option>3</option><option>9</option><option selected>18</option></select></div>
        <div><label>مختصات (lat, lng)</label>
          <div style="display:flex;gap:6px"><input class="input" id="mc-lat" value="24.7136" style="width:50%;direction:ltr"><input class="input" id="mc-lng" value="46.6753" style="width:50%;direction:ltr"></div>
        </div>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn sm ghost" id="mc-pick">📍 انتخاب روی نقشه</button>
        <button class="btn sm ghost" id="mc-map">🛰 پیش‌نمایش ماهواره‌ای</button>
      </div>
      <div id="mc-pars" style="margin-top:14px;display:flex;gap:7px;flex-wrap:wrap"></div>
      <button class="btn sm" id="mc-add" style="margin-top:14px">+ ثبت زمین</button>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">🗺️</span><h3>زمین‌های آکادمی</h3><span class="tag">${D.fa(S.courses.length)} زمین</span></div>
      <div style="overflow-x:auto"><table class="tbl"><thead><tr>
        <th>#</th><th>نام</th><th>محل</th><th>میدان</th><th>پار کل</th><th>موقعیت</th><th>عملیات</th>
      </tr></thead><tbody id="mc-rows"></tbody></table></div>
    </div>`;
    let parVals = [];
    function drawPars(){
      const n = +$('#mc-holes').value;
      if (parVals.length !== n) parVals = Array.from({length:n}, () => 4);
      $('#mc-pars').innerHTML = parVals.map((p,i) => `
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--muted)">ح${D.fa(i+1)}</div>
          <input class="input" type="number" min="3" max="6" value="${p}" data-i="${i}" style="width:58px;text-align:center;direction:ltr">
        </div>`).join('');
      $$('#mc-pars input').forEach(inp => inp.addEventListener('change', () => { parVals[+inp.dataset.i] = Math.max(3, Math.min(6, +inp.value || 4)); }));
    }
    drawPars();
    $('#mc-holes').addEventListener('change', drawPars);
    $('#mc-pick').addEventListener('click', () => openMapPicker(c => {
      $('#mc-lat').value = c.lat; $('#mc-lng').value = c.lng;
      APP.toast('موقعیت انتخاب شد: ' + c.lat + ' , ' + c.lng, 'green');
    }, { lat:+$('#mc-lat').value, lng:+$('#mc-lng').value }));
    $('#mc-map').addEventListener('click', () => showSatelliteModal({ id:999, name:$('#mc-name').value||'زمین جدید', lat:+$('#mc-lat').value, lng:+$('#mc-lng').value }, +$('#mc-holes').value));
    $('#mc-add').addEventListener('click', () => {
      const name = $('#mc-name').value.trim();
      if (!name){ APP.toast('نام زمین را وارد کنید', 'red'); return; }
      const holes = +$('#mc-holes').value;
      const pars = parVals.slice(0, holes);
      extra.push({ name, loc: $('#mc-loc').value.trim() || 'ریاض', holes, pars, lat:+$('#mc-lat').value, lng:+$('#mc-lng').value });
      saveCourses(extra); APP.reloadData(); APP.go('mgmt'); mgmtTab='courses';
      APP.toast('زمین «' + name + '» ثبت شد ✓', 'green');
    });
    $('#mc-rows').innerHTML = rows.map(r => `<tr class="${r.base?'':'custom-row'}">
      <td class="num">${D.fa(r.id)}</td><td><b>${esc(r.name)}</b> ${r.base?'<span class="chip dim">پایه</span>':'<span class="chip purple">سفارشی</span>'}</td>
      <td>${esc(r.loc)}</td><td class="num">${D.fa(r.holes)}</td>
      <td class="num" style="color:var(--gold-l)">${D.fa(r.pars.reduce((a,b)=>a+b,0))}</td>
      <td><button class="btn sm ghost" data-act="sat" data-idx="${rows.indexOf(r)}">🛰 نقشه</button></td>
      <td><div class="row-actions">
        <button class="btn sm ghost" data-act="editc" data-idx="${rows.indexOf(r)}">✏️ ویرایش</button>
        ${r.base ? '' : `<button class="btn sm danger" data-act="delc" data-idx="${r.idx}">🗑 حذف</button>`}
      </div></td></tr>`).join('');
    body.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const act = b.dataset.act, idx = +b.dataset.idx;
      const r = rows[idx];
      if (act === 'sat') showSatelliteModal(r, r.holes);
      if (act === 'delc'){
        const lst = extraCourses(); lst.splice(r.idx,1); saveCourses(lst); APP.reloadData(); APP.go('mgmt'); mgmtTab='courses'; APP.toast('زمین حذف شد 🗑','orange');
      }
      if (act === 'editc') editCourseModal(r);
    }));
  }

  function showSatelliteModal(course, holes){
    let m = $('#modal-sat');
    if (!m){
      m = document.createElement('div');
      m.id = 'modal-sat';
      m.style.cssText = 'position:fixed;inset:0;z-index:210;display:none;align-items:center;justify-content:center;background:rgba(4,8,14,.75);backdrop-filter:blur(6px)';
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
    }
    m.innerHTML = `
    <div class="glass gold-border" style="width:min(720px,94vw);padding:18px">
      <div class="card-head"><span class="ic">🛰</span><h3>نمای ماهواره‌ای — ${esc(course.name)}</h3><span class="tag">${D.fa(holes)} حفره</span></div>
      <div class="sat-wrap" style="margin-top:12px">
        <canvas id="sat-canvas"></canvas>
        <div class="sat-overlay">${esc(course.name)} • ${esc(course.loc||'')}</div>
        <div class="sat-coords">${(course.lat||24.7136).toFixed(5)}, ${(course.lng||46.6753).toFixed(5)}</div>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn sm ghost" id="sat-gmaps">🗺 باز کردن در Google Maps</button>
        <button class="btn sm" id="sat-close">بستن</button>
      </div>
    </div>`;
    m.style.display = 'flex';
    drawSatellite($('#sat-canvas'), { id: course.id||1, lat: course.lat||24.7136, lng: course.lng||46.6753 }, holes);
    $('#sat-close').addEventListener('click', () => m.style.display = 'none');
    $('#sat-gmaps').addEventListener('click', () => {
      window.open('https://www.google.com/maps?q=' + (course.lat||24.7136) + ',' + (course.lng||46.6753), '_blank');
    });
  }

  function editCourseModal(r){
    let m = $('#modal-edit');
    if (!m){
      m = document.createElement('div');
      m.id = 'modal-edit';
      m.style.cssText = 'position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;background:rgba(4,8,14,.72);backdrop-filter:blur(6px)';
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
    }
    m.innerHTML = `
    <div class="glass gold-border" style="width:min(640px,94vw);padding:22px;max-height:92vh;overflow:auto">
      <div class="card-head"><span class="ic">✏️</span><h3>ویرایش زمین — ${esc(r.name)}</h3><span class="tag">${r.base?'پایه':'سفارشی'}</span></div>
      <div class="field-grid" style="margin-top:12px">
        <div><label>نام</label><input class="input" id="ec-name" style="width:100%" value="${esc(r.name)}"></div>
        <div><label>محل</label><input class="input" id="ec-loc" style="width:100%" value="${esc(r.loc)}"></div>
        <div><label>مختصات lat</label><input class="input" id="ec-lat" style="width:100%;direction:ltr" value="${r.lat||24.7136}"></div>
        <div><label>مختصات lng</label><input class="input" id="ec-lng" style="width:100%;direction:ltr" value="${r.lng||46.6753}"></div>
      </div>
      <div style="margin-top:10px"><button class="btn sm ghost" id="ec-pick">📍 انتخاب روی نقشه</button></div>
      <div style="margin-top:12px;display:flex;gap:7px;flex-wrap:wrap" id="ec-pars">
        ${r.pars.map((p,i) => `<div style="text-align:center">
          <div style="font-size:10px;color:var(--muted)">ح${D.fa(i+1)}</div>
          <input class="input" type="number" min="3" max="6" value="${p}" data-i="${i}" style="width:58px;text-align:center;direction:ltr">
        </div>`).join('')}
      </div>
      <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end">
        <button class="btn sm ghost" id="ec-cancel">انصراف</button>
        <button class="btn sm" id="ec-save">💾 ذخیره</button>
      </div>
    </div>`;
    m.style.display = 'flex';
    $('#ec-pick').addEventListener('click', () => openMapPicker(c => { $('#ec-lat').value = c.lat; $('#ec-lng').value = c.lng; }, { lat:+$('#ec-lat').value, lng:+$('#ec-lng').value }));
    $('#ec-cancel').addEventListener('click', () => m.style.display = 'none');
    $('#ec-save').addEventListener('click', () => {
      const name = $('#ec-name').value.trim();
      if (!name){ APP.toast('نام زمین را وارد کنید','red'); return; }
      const pars = $$('#ec-pars input').map(inp => Math.max(3, Math.min(6, +inp.value || 4)));
      const lat = +$('#ec-lat').value || 24.7136, lng = +$('#ec-lng').value || 46.6753;
      if (r.base){
        let ov = {};
        try { ov = JSON.parse(localStorage.getItem('ga_course_override') || '{}'); } catch(e){}
        ov[r.id] = { name, loc: $('#ec-loc').value.trim(), pars, lat, lng };
        localStorage.setItem('ga_course_override', JSON.stringify(ov));
        if (D.PAR_MAP) D.PAR_MAP[r.id] = pars;
      } else {
        const lst = extraCourses();
        const c = lst[r.idx];
        if (c){ c.name = name; c.loc = $('#ec-loc').value.trim(); c.pars = pars; c.lat = lat; c.lng = lng; }
        saveCourses(lst);
      }
      APP.reloadData(); APP.go('mgmt'); mgmtTab='courses';
      m.style.display = 'none';
      APP.toast('زمین ذخیره شد ✓', 'green');
    });
  }

  /* ── تب مسابقات ── */
  function mgmtTournaments(body){
    const S = gstate().S;
    const rules = D.loadTourRules ? D.loadTourRules() : D.PTS_RULE;
    const base = D.TOURNAMENTS.filter(t => !D.isTourHidden(t[0])).map(t => ({ t, base:true }));
    const extra = extraTours().map((t,i) => ({ t: [1000+i, t.name, +t.lvl, +t.course, +t.holes, t.date], base:false, idx:i, rule: t.rule || 'normal' }));
    const rows = base.concat(extra);
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">➕</span><h3>طراح مسابقه — ثبت مسابقه جدید</h3><span class="tag">تاریخ شمسی • چندروزه</span></div>
      <div class="rules-box" style="background:rgba(212,175,55,.06);border:1px solid rgba(212,175,55,.25);border-radius:12px;padding:10px 12px;margin-top:10px">
        <div style="font-size:11.5px;color:var(--gold-l);margin-bottom:8px">⚙️ قوانین امتیازدهی فصل (قابل ویرایش — نفر اول / دوم / سوم / شرکت)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px">
          ${[1,2,3].map(lv => `
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="font-size:11px;color:var(--muted)">سطح ${D.fa(lv)}:</span>
              ${['p1','p2','p3','entry'].map((k,i) => `<input class="input" id="r${lv}${k}" type="number" min="0" value="${rules[lv][i]}" style="width:52px;padding:5px 6px;text-align:center" title="${['اول','دوم','سوم','شرکت'][i]}">`).join('')}
            </div>`).join('')}
          <button class="btn sm ghost" id="rules-save" style="align-self:center">💾 ذخیره قوانین</button>
        </div>
      </div>
      <div class="field-grid" style="margin-top:10px">
        <div class="span2"><label>نام مسابقه</label><input class="input" id="mt-name" style="width:100%" placeholder="جام جدید"></div>
        <div><label>سطح</label><select class="sel" id="mt-lvl" style="width:100%"><option value="1">سطح ۱ (حرفه‌ای)</option><option value="2" selected>سطح ۲ (نیمه‌حرفه‌ای)</option><option value="3">سطح ۳ (آماتور)</option></select></div>
        <div class="span2"><label>⚖️ قانون مسابقه</label><select class="sel" id="mt-rule" style="width:100%">
          <option value="normal" selected>قانون عادی — همهٔ ضربه‌ها محاسبه می‌شود</option>
          <option value="full">قانون فول — سقف ضربهٔ هر حفره: پار۳ حداکثر ۷ • پار۴ حداکثر ۹ • پار۵ حداکثر ۱۱</option>
        </select></div>
        <div><label>زمین</label><select class="sel" id="mt-crs" style="width:100%">${S.courses.map(c=>`<option value="${c[0]}">${esc(c[1])}</option>`).join('')}</select></div>
        <div><label>حفره</label><select class="sel" id="mt-holes" style="width:100%"><option>9</option><option selected>18</option></select></div>
        <div><label>🏆 امتیاز نفر اول</label><input class="input" id="mt-p1" type="number" min="0" value="20" style="width:100%"></div>
        <div><label>🥈 امتیاز نفر دوم</label><input class="input" id="mt-p2" type="number" min="0" value="15" style="width:100%"></div>
        <div><label>🥉 امتیاز نفر سوم</label><input class="input" id="mt-p3" type="number" min="0" value="10" style="width:100%"></div>
        <div><label>🎟 امتیاز شرکت</label><input class="input" id="mt-entry" type="number" min="0" value="5" style="width:100%"></div>
      </div>
      <div class="field-grid" style="margin-top:10px">
        <div><label>تاریخ شروع <small>(شمسی)</small></label><div id="mt-start"></div></div>
        <div><label>تاریخ پایان <small>(شمسی)</small></label><div id="mt-end"></div></div>
        <div><label>ساعت شروع</label><input class="input" id="mt-time" type="time" value="08:00" style="width:100%;direction:ltr"></div>
      </div>
      <div id="mt-schedule" style="margin-top:12px"></div>
      <button class="btn sm" id="mt-add" style="margin-top:14px">+ ثبت مسابقه</button>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">📅</span><h3>مسابقات فصل</h3><span class="tag">${D.fa(S.tournaments.length)} رویداد</span></div>
      <div style="overflow-x:auto"><table class="tbl"><thead><tr>
        <th>#</th><th>نام</th><th>سطح</th><th>زمین</th><th>حفره</th><th>تاریخ</th><th>وضعیت</th><th>عملیات</th>
      </tr></thead><tbody id="mt-rows"></tbody></table></div>
      <div id="mt-hidden"></div>
    </div>`;
    $('#mt-rows').innerHTML = rows.map(({t, base, idx, rule}, ri) => {
      const pr = D.prizesOf(t);
      const past = D.dateFrom(t[5]) < D.TODAY;
      const j = D.jalaliInfo(D.dateFrom(t[5]));
      return `<tr>
        <td class="num">${D.fa(t[0])}</td><td><b>${esc(t[1])}</b> ${base?'<span class="chip dim">پایه</span>':'<span class="chip purple">سفارشی</span>'}${!base && rule==='full'?' <span class="chip gold" title="سقف ضربهٔ هر حفره: پار۳≤۷، پار۴≤۹، پار۵≤۱۱">⚖️ فول</span>':''}
          <div style="font-size:10px;color:var(--muted);margin-top:3px">🏆${D.fa(pr[0])} 🥈${D.fa(pr[1])} 🥉${D.fa(pr[2])} 🎟${D.fa(pr[3])}</div></td>
        <td><span class="chip ${t[2]===1?'gold':t[2]===2?'green':'blue'}">سطح ${D.fa(t[2])}</span></td>
        <td style="color:var(--muted)">${esc(D.COURSE_NAME[t[3]]||'—')}</td>
        <td class="num">${D.fa(t[4])}</td>
        <td class="ltr" style="color:var(--muted);font-size:11.5px">${D.fa(j.dd)} ${j.monthFa}</td>
        <td><span class="chip ${past?'dim':'green'}">${past?'برگزار شده':'آینده'}</span></td>
        <td><div class="row-actions">
          <button class="btn sm ghost" data-act="editt" data-idx="${ri}" title="ویرایش مسابقه">✏️</button>
          <button class="btn sm danger" data-act="delt" data-idx="${ri}" title="حذف مسابقه${base ? ' (بازیابی‌پذیر — از فصل پنهان می‌شود)' : ''}">🗑</button>
        </div></td></tr>`;
    }).join('');
    /* ردیف بازیابی مسابقات پایهٔ حذف‌شده (حذف نرم) — زیر جدول */
    const hidTours = D.loadHiddenTours().map(id => D.TOURNAMENTS.find(t => t[0] === id)).filter(Boolean);
    const hb = $('#mt-hidden');
    if (hb) hb.innerHTML = hidTours.length ? `<div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;font-size:11px;color:var(--muted);margin-top:10px;border-top:1px dashed var(--line-soft);padding-top:10px"><span>🗑 حذف‌شده از فصل:</span>${hidTours.map(t => `<span class="chip dim" style="display:inline-flex;align-items:center;gap:6px">${esc(t[1])}<button class="btn sm ghost" data-act="unhide" data-id="${t[0]}" style="padding:2px 8px;font-size:10px">↩ بازیابی</button></span>`).join('')}</div>` : '';
    JDate.render($('#mt-start'), { value: D.shamsiToISO(1405,7,4), onChange(){ renderTourSch(); } });
    JDate.render($('#mt-end'),   { value: D.shamsiToISO(1405,7,4), onChange(){ renderTourSch(); } });
    function tourDays(){
      try {
        if (!$('#mt-end')._value || !$('#mt-start')._value) return 1;
        return Math.max(1, Math.min(14, Math.round((D.dateFrom($('#mt-end')._value()) - D.dateFrom($('#mt-start')._value()))/86400000) + 1));
      } catch(e){ return 1; }
    }
    function renderTourSch(){
      const box = $('#mt-schedule'); if (!box) return;
      if (!$('#mt-start')._value || !$('#mt-end')._value) return;
      const n = tourDays();
      const a = $('#mt-start')._value();
      const opts = ['ورود','مسابقه','تمرین','اهدای جام','جلسه','آزاد'];
      let html = `<div class="form-section">🗓 برنامه روزانه مسابقه (${D.fa(n)} روز)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">`;
      for (let i=0;i<n;i++){
        const j = D.jalaliInfo(new Date(D.dateFrom(a).getTime() + i*86400000));
        html += `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:8px 10px">
          <div style="font-size:10.5px;color:var(--gold-l);margin-bottom:5px">${D.fa(j.dd)} ${j.monthFa} ${j.wd}</div>
          <select class="sel mt-day-sel" data-i="${i}" style="width:100%;font-size:11.5px">
            ${opts.map(o => `<option>${o}</option>`).join('')}
          </select></div>`;
      }
      html += '</div>';
      box.innerHTML = html;
    }
    renderTourSch();
    $('#rules-save').addEventListener('click', () => {
      const r = {};
      [1,2,3].forEach(lv => r[lv] = ['p1','p2','p3','entry'].map(k => +($('#r'+lv+k).value||0)));
      D.saveTourRules(r);
      APP.toast('قوانین امتیازدهی فصل ذخیره شد ✓', 'green');
    });
    $('#mt-lvl').addEventListener('change', () => {
      const r = D.loadTourRules ? D.loadTourRules() : D.PTS_RULE;
      const pr = r[+$('#mt-lvl').value] || [15,10,7,3];
      $('#mt-p1').value = pr[0]; $('#mt-p2').value = pr[1]; $('#mt-p3').value = pr[2]; $('#mt-entry').value = pr[3];
    });
    $('#mt-add').addEventListener('click', () => {
      const name = $('#mt-name').value.trim();
      const start = $('#mt-start')._value();
      const end = $('#mt-end')._value();
      if (!name && !start){ APP.toast('حداقل نام یا تاریخ را وارد کنید', 'red'); return; }
      const schedule = [];
      $$('.mt-day-sel').forEach(s => schedule.push({ offset: +s.dataset.i, label: s.value }));
      extra.push({ name: name || 'مسابقه ' + D.fa(extra.length+1), lvl: +$('#mt-lvl').value, course: +$('#mt-crs').value, holes: +$('#mt-holes').value, date: start, end, time: $('#mt-time').value,
        rule: ($('#mt-rule') ? $('#mt-rule').value : 'normal'),
        p1: +($('#mt-p1').value||0), p2: +($('#mt-p2').value||0), p3: +($('#mt-p3').value||0), entry: +($('#mt-entry').value||0), schedule });
      saveTours(extra); APP.reloadData(); APP.go('mgmt'); mgmtTab='tournaments';
      APP.toast('مسابقه «' + (name||'بدون نام') + '» ثبت شد ✓', 'green');
    });
    body.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'unhide'){
        const id = +b.dataset.id;
        D.saveHiddenTours(D.loadHiddenTours().filter(x => x !== id));
        APP.reloadData(); APP.go('mgmt'); mgmtTab='tournaments';
        APP.toast('مسابقه بازیابی شد ✓', 'green');
        return;
      }
      const row = rows[+b.dataset.idx];
      if (!row) return;
      if (act === 'delt'){
        if (row.base){
          /* حذف نرم مسابقهٔ پایه: فقط از فصل پنهان می‌شود و قابل‌بازیابی است */
          const hid = D.loadHiddenTours();
          if (hid.indexOf(row.t[0]) < 0){ hid.push(row.t[0]); D.saveHiddenTours(hid); }
          APP.reloadData(); APP.go('mgmt'); mgmtTab='tournaments';
          APP.toast('«' + row.t[1] + '» از فصل حذف شد 🗑 — برای بازیابی، زیر همین جدول', 'orange');
        } else {
          const lst = extraTours(); lst.splice(row.idx,1); saveTours(lst);
          APP.reloadData(); APP.go('mgmt'); mgmtTab='tournaments';
          APP.toast('مسابقه حذف شد 🗑','orange');
        }
      }
      if (act === 'editt') editTourModal(row.t, row.base, row.idx);
    }));
  }

  function editTourModal(t, base, idx){
    const S = gstate().S;
    let m = $('#modal-edit');
    if (!m){
      m = document.createElement('div');
      m.id = 'modal-edit';
      m.style.cssText = 'position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;background:rgba(4,8,14,.72);backdrop-filter:blur(6px)';
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
    }
    m.innerHTML = `
    <div class="glass gold-border" style="width:min(560px,94vw);padding:22px">
      <div class="card-head"><span class="ic">✏️</span><h3>ویرایش مسابقه — ${esc(t[1])}</h3><span class="tag">${base?'پایه':'سفارشی'}</span></div>
      <div class="field-grid" style="margin-top:12px">
        <div class="span2"><label>نام</label><input class="input" id="et-name" style="width:100%" value="${esc(t[1])}"></div>
        <div class="span2"><label>تاریخ</label><div class="jdate" id="et-date" data-iso="${t[5]}"></div></div>
        <div><label>سطح</label><select class="sel" id="et-lvl" style="width:100%"><option value="1" ${t[2]===1?'selected':''}>سطح ۱</option><option value="2" ${t[2]===2?'selected':''}>سطح ۲</option><option value="3" ${t[2]===3?'selected':''}>سطح ۳</option></select></div>
        <div><label>زمین</label><select class="sel" id="et-crs" style="width:100%">${S.courses.map(c=>`<option value="${c[0]}" ${c[0]===t[3]?'selected':''}>${esc(c[1])}</option>`).join('')}</select></div>
        <div><label>حفره</label><select class="sel" id="et-holes" style="width:100%"><option ${t[4]===9?'selected':''}>9</option><option ${t[4]===18?'selected':''}>18</option></select></div>
        <div class="span2"><label>⚖️ قانون مسابقه</label><select class="sel" id="et-rule" style="width:100%" ${base?'disabled title="فقط برای مسابقات سفارشی"':''}>
          ${(() => { const cr = base ? 'normal' : ((extraTours()[idx] && extraTours()[idx].rule) || 'normal');
            return `<option value="normal" ${cr==='normal'?'selected':''}>قانون عادی — همهٔ ضربه‌ها محاسبه</option><option value="full" ${cr==='full'?'selected':''}>قانون فول — سقف ضربهٔ حفره (پار۳≤۷ • پار۴≤۹ • پار۵≤۱۱)</option>`; })()}
        </select></div>
      </div>
      <div class="form-section" style="margin-top:10px">🏆 امتیازهای مسابقه</div>
      <div class="field-grid">
        <div><label>نفر اول</label><input class="input" id="et-p1" type="number" min="0" value="${D.prizesOf(t)[0]}" style="width:100%"></div>
        <div><label>نفر دوم</label><input class="input" id="et-p2" type="number" min="0" value="${D.prizesOf(t)[1]}" style="width:100%"></div>
        <div><label>نفر سوم</label><input class="input" id="et-p3" type="number" min="0" value="${D.prizesOf(t)[2]}" style="width:100%"></div>
        <div><label>شرکت</label><input class="input" id="et-entry" type="number" min="0" value="${D.prizesOf(t)[3]}" style="width:100%"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end">
        <button class="btn sm ghost" id="et-cancel">انصراف</button>
        <button class="btn sm" id="et-save">💾 ذخیره</button>
      </div>
    </div>`;
    if (window.JDate && $('#et-date')) JDate.render($('#et-date'));
    m.style.display = 'flex';
    $('#et-cancel').addEventListener('click', () => m.style.display = 'none');
    $('#et-save').addEventListener('click', () => {
      const name = $('#et-name').value.trim();
      if (!name){ APP.toast('نام مسابقه را وارد کنید','red'); return; }
      const data = { name, date: $('#et-date')._value(), lvl: +$('#et-lvl').value, course: +$('#et-crs').value, holes: +$('#et-holes').value,
        p1: +($('#et-p1').value||0), p2: +($('#et-p2').value||0), p3: +($('#et-p3').value||0), entry: +($('#et-entry').value||0) };
      if (base){
        let ov = {};
        try { ov = JSON.parse(localStorage.getItem('ga_tour_override') || '{}'); } catch(e){}
        ov[t[0]] = data;
        localStorage.setItem('ga_tour_override', JSON.stringify(ov));
      } else {
        const lst = extraTours();
        if (lst[idx]){ Object.assign(lst[idx], data); lst[idx].rule = ($('#et-rule') ? $('#et-rule').value : lst[idx].rule) || 'normal'; }
        saveTours(lst);
      }
      APP.reloadData(); APP.go('mgmt'); mgmtTab='tournaments';
      m.style.display = 'none';
      APP.toast('مسابقه ذخیره شد ✓', 'green');
    });
  }

  /* ── مودال مشترک: انتخاب شرکت‌کنندگان (دبل‌کلیک) + نفرات اول تا سوم + امتیاز خودکار ── */
  function openResultsModal(opts){
    const all = opts.players; // [{pid, name}]
    let part = (opts.participants || []).slice();
    let top = Object.assign({}, opts.top || {});
    let m = $('#modal-results');
    if (!m){
      m = document.createElement('div');
      m.id = 'modal-results';
      m.style.cssText = 'position:fixed;inset:0;z-index:210;display:flex;align-items:center;justify-content:center;background:rgba(4,8,14,.78);backdrop-filter:blur(6px)';
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
    }
    const prizeRow = opts.prizes ? `
      <div style="font-size:11.5px;color:var(--muted);margin:8px 0;text-align:center">
        🏆 اول <b class="gold-text">${D.fa(opts.prizes[0])}</b> &nbsp;🥈 دوم <b class="gold-text">${D.fa(opts.prizes[1])}</b> &nbsp;🥉 سوم <b class="gold-text">${D.fa(opts.prizes[2])}</b> &nbsp;🎟 شرکت <b class="gold-text">${D.fa(opts.prizes[3])}</b> امتیاز
      </div>` : '';
    m.innerHTML = `
    <div class="glass gold-border" style="width:min(860px,95vw);padding:20px;max-height:92vh;overflow:auto">
      <div class="card-head"><span class="ic">🎯</span><h3>${opts.title}</h3><span class="tag">دبل‌کلیک برای جابه‌جایی</span></div>
      ${prizeRow}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px">
        <div>
          <div class="lbl">👥 همهٔ بازیکنان</div>
          <input class="input" id="rp-search" placeholder="🔍 جستجو..." style="width:100%;margin:6px 0;padding:7px 10px">
          <div id="rp-all" class="rp-list" style="max-height:240px;overflow:auto"></div>
        </div>
        <div>
          <div class="lbl">✅ شرکت‌کنندگان (${D.fa(part.length)} نفر)</div>
          <div id="rp-part" class="rp-list" style="max-height:240px;overflow:auto"></div>
        </div>
      </div>
      <div class="form-section" style="margin-top:12px">🏆 نفرات برتر (انتخاب از شرکت‌کنندگان — بقیه امتیاز شرکت می‌گیرند)</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <label class="lbl">نفر اول:</label><select class="sel" id="rp-1" style="min-width:150px"></select>
        <label class="lbl">نفر دوم:</label><select class="sel" id="rp-2" style="min-width:150px"></select>
        <label class="lbl">نفر سوم:</label><select class="sel" id="rp-3" style="min-width:150px"></select>
      </div>
      <div id="rp-extra"></div>
      <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn sm ghost" id="rp-cancel">بستن</button>
        <button class="btn sm" id="rp-save">🎯 ثبت نتایج و امتیازدهی خودکار</button>
      </div>
    </div>`;
    m.style.display = 'flex';
    const allBox = m.querySelector('#rp-all'), partBox = m.querySelector('#rp-part');
    function nameOf(pid){ const x = all.find(p => p.pid === +pid); return x ? x.name : '—'; }
    function render(){
      const q = (m.querySelector('#rp-search').value || '').trim();
      const partSet = new Set(part);
      allBox.innerHTML = all.filter(p => !partSet.has(p.pid) && (!q || p.name.includes(q))).map(p =>
        `<div class="rp-item" data-pid="${p.pid}">${esc(p.name)}</div>`).join('') || '<div style="color:var(--muted);font-size:12px;padding:8px">—</div>';
      partBox.innerHTML = part.map(pid =>
        `<div class="rp-item sel" data-pid="${pid}">${esc(nameOf(pid))}</div>`).join('') || '<div style="color:var(--muted);font-size:12px;padding:8px">دبل‌کلیک روی بازیکنان تا اینجا بیایند</div>';
      ['1','2','3'].forEach(k => {
        const sel = m.querySelector('#rp-' + k);
        const cur = top[k];
        sel.innerHTML = '<option value="">— انتخاب —</option>' + part.map(pid => `<option value="${pid}" ${+cur === +pid ? 'selected' : ''}>${esc(nameOf(pid))}</option>`).join('');
      });
      m.querySelector('.lbl + div') && false;
      const lbl = m.querySelector('#rp-part');
      const header = lbl.previousElementSibling;
      if (header) header.textContent = '✅ شرکت‌کنندگان (' + D.fa(part.length) + ' نفر)';
    }
    allBox.addEventListener('dblclick', e => {
      const it = e.target.closest('.rp-item'); if (!it) return;
      part.push(+it.dataset.pid); render();
    });
    partBox.addEventListener('dblclick', e => {
      const it = e.target.closest('.rp-item'); if (!it) return;
      part = part.filter(p => p !== +it.dataset.pid);
      ['1','2','3'].forEach(k => { if (+top[k] === +it.dataset.pid) delete top[k]; });
      render();
    });
    m.querySelector('#rp-search').addEventListener('input', render);
    ['1','2','3'].forEach(k => m.querySelector('#rp-' + k).addEventListener('change', e => {
      if (e.target.value) top[k] = +e.target.value; else delete top[k];
    }));
    m.querySelector('#rp-cancel').addEventListener('click', () => m.style.display = 'none');
    m.querySelector('#rp-save').addEventListener('click', () => {
      if (!part.length){ APP.toast('حداقل یک شرکت‌کننده انتخاب کنید', 'red'); return; }
      const topVals = [top['1'], top['2'], top['3']].filter(v => v);
      if (new Set(topVals).size !== topVals.length){ APP.toast('یک بازیکن نمی‌تواند همزمان دو رتبه بگیرد — رتبه‌ها را اصلاح کنید', 'red'); return; }
      opts.onSave(part, top);
      m.style.display = 'none';
    });
    render();
    if (opts.afterRender) opts.afterRender(m);
    return m;
  }

  /* ── تب دوره‌ها: کلاس / تمرین / اردو (CRUD کامل + تاریخ + اطلاعات + امتیاز + نتایج) ── */
  function mgmtPrograms(body){
    const PROG_TYPES = [['کلاس','📚'],['تمرین','🏌️'],['اردو','🏕️']];
    let editingIdx = -1;
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">➕</span><h3 id="prg-title">ثبت دورهٔ جدید</h3><span class="tag">کلاس • تمرین • اردو</span></div>
      <div class="field-grid" style="margin-top:10px">
        <div class="span2"><label>نام دوره</label><input class="input" id="pr-name" style="width:100%" placeholder="مثلاً: کلاس پوتینگ مقدماتی"></div>
        <div><label>نوع</label><select class="sel" id="pr-type" style="width:100%">${PROG_TYPES.map(([t,ic]) => `<option value="${t}">${ic} ${t}</option>`).join('')}</select></div>
        <div><label>تاریخ شروع <small>(شمسی)</small></label><div id="pr-start"></div></div>
        <div><label>تاریخ پایان <small>(شمسی)</small></label><div id="pr-end"></div></div>
      </div>
      <div style="margin-top:10px"><label>اطلاعات دوره / توضیحات</label>
        <textarea class="input" id="pr-info" rows="2" style="width:100%;margin-top:5px;resize:vertical" placeholder="مثلاً: تمرین ضربات کوتاه با مربی — شنبه‌ها"></textarea>
      </div>
      <div class="form-section" style="margin-top:10px">🏆 امتیازهای دوره</div>
      <div class="field-grid">
        <div><label>🥇 نفر اول</label><input class="input" id="pr-p1" type="number" min="0" value="10" style="width:100%"></div>
        <div><label>🥈 نفر دوم</label><input class="input" id="pr-p2" type="number" min="0" value="7" style="width:100%"></div>
        <div><label>🥉 نفر سوم</label><input class="input" id="pr-p3" type="number" min="0" value="5" style="width:100%"></div>
        <div><label>🎟 امتیاز شرکت</label><input class="input" id="pr-entry" type="number" min="0" value="2" style="width:100%"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
        <button class="btn sm" id="pr-add">📅 ثبت دوره</button>
        <span style="color:var(--muted);font-size:11.5px;align-self:center">دوره ثبت می‌شود و در تقویم فصل نمایش داده می‌شود؛ برای هر دوره می‌توانید نتایج (شرکت‌کنندگان + نفرات برتر) ثبت کنید</span>
      </div>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">🎓</span><h3>دوره‌های آموزشی / تمرین / اردو</h3><span class="tag">${D.fa(D.loadPrograms().length)} دوره</span></div>
      <div id="pr-list" style="margin-top:8px"></div>
    </div>`;
    JDate.render($('#pr-start'), { value: D.shamsiToISO(1405,6,10), onChange(){} });
    JDate.render($('#pr-end'),   { value: D.shamsiToISO(1405,6,10), onChange(){} });
    function renderList(){
      const lst = D.loadPrograms();
      $('#pr-list').innerHTML = lst.length ? lst.map((p, i) => {
        const j = D.jalaliInfo(D.dateFrom(p.start || p.date || ''));
        const n = p.participants ? p.participants.length : 0;
        return `<div class="h-item" style="align-items:flex-start">
          <span class="h-day" style="min-width:80px">${D.fa(j.dd)} ${j.monthFa}</span>
          <span style="flex:1">
            <b>${PROG_TYPES.find(x=>x[0]===p.type)?PROG_TYPES.find(x=>x[0]===p.type)[1]:'📌'} ${esc(p.name)}</b>
            <div style="font-size:10.5px;color:var(--muted);margin-top:3px">
              ${esc(p.type||'')} • 🥇${D.fa(+p.p1||0)} 🥈${D.fa(+p.p2||0)} 🥉${D.fa(+p.p3||0)} 🎟${D.fa(+p.entry||0)} ${p.info ? '• ' + esc(String(p.info).slice(0,60)) : ''}
              ${n ? `• <span class="chip green">${D.fa(n)} شرکت‌کننده</span>` : ''}
            </div>
          </span>
          <button class="btn sm ghost" data-prres="${i}" title="نتایج">🎯</button>
          <button class="btn sm ghost" data-predit="${i}" title="ویرایش">✏️</button>
          <button class="btn sm danger" data-prdel="${i}">🗑</button></div>`;
      }).join('') : '<div style="color:var(--muted);font-size:12.5px;padding:8px">هنوز دوره‌ای ثبت نشده است.</div>';
      $$('#pr-list [data-prdel]').forEach(b => b.addEventListener('click', () => {
        const a = D.loadPrograms(); a.splice(+b.dataset.prdel,1); D.savePrograms(a); APP.reloadData(); APP.go('mgmt'); mgmtTab='programs'; APP.toast('دوره حذف شد 🗑','orange');
      }));
      $$('#pr-list [data-predit]').forEach(b => b.addEventListener('click', () => {
        const a = D.loadPrograms(); const p = a[+b.dataset.predit]; if (!p) return;
        editingIdx = +b.dataset.predit;
        $('#prg-title').textContent = '✏️ ویرایش دوره';
        $('#pr-name').value = p.name || '';
        $('#pr-type').value = p.type || 'کلاس';
        if (p.start) $('#pr-start')._set(p.start);
        if (p.end) $('#pr-end')._set(p.end);
        $('#pr-info').value = p.info || '';
        $('#pr-p1').value = p.p1 || 0; $('#pr-p2').value = p.p2 || 0; $('#pr-p3').value = p.p3 || 0; $('#pr-entry').value = p.entry || 0;
        $('#pr-add').textContent = '💾 ذخیرهٔ ویرایش';
        if ($('#pr-name').scrollIntoView) $('#pr-name').scrollIntoView({ behavior:'smooth', block:'center' });
      }));
      $$('#pr-list [data-prres]').forEach(b => b.addEventListener('click', () => {
        const a = D.loadPrograms(); const p = a[+b.dataset.prres]; if (!p) return;
        openResultsModal({
          title: 'نتایج «' + p.name + '»',
          prizes: [p.p1, p.p2, p.p3, p.entry],
          players: activePlayersList(),
          participants: p.participants || [],
          top: p.top || {},
          onSave: (participants, top) => {
            p.participants = participants; p.top = top;
            D.savePrograms(a); APP.reloadData(); APP.go('mgmt'); mgmtTab='programs';
            APP.toast('نتایج دوره ثبت شد — امتیازها به شرکت‌کنندگان داده شد ✓', 'green');
          }
        });
      }));
    }
    renderList();
    // ── فعالیت‌های خودکار فصل (تمرین/آموزش فیک) — قابل حذف ──
    const actBox = document.createElement('div');
    actBox.className = 'glass';
    actBox.style.marginTop = '16px';
    actBox.innerHTML = '<div class="card-head"><span class="ic">⚡</span><h3>فعالیت‌های خودکار فصل (تمرین / آموزش)</h3><span class="tag">قابل حذف</span></div><div id="act-list" style="margin-top:8px;max-height:260px;overflow:auto"></div>';
    body.appendChild(actBox);
    function renderActs(){
      const st = gstate();
      const acts = (st.S && st.S.activities ? st.S.activities : []).slice();
      acts.sort((a,b) => +new Date(b.date) - +new Date(a.date));
      $('#act-list').innerHTML = acts.length ? acts.slice(0, 40).map((a, i) => {
        const j = D.jalaliInfo(new Date(a.date));
        return `<div class="h-item"><span class="h-day">${D.fa(j.dd)} ${j.monthFa}</span>
          <span style="flex:1">${esc(D.nameOf(a.pid)||'—')} — <span class="chip ${a.type==='تمرین'?'green':'purple'}">${esc(a.type)}</span></span>
          <span class="chip gold">${D.fa(a.points)} امتیاز</span>
          <button class="btn sm danger" data-actdel="${i}">🗑</button></div>`;
      }).join('') : '<div style="color:var(--muted);font-size:12.5px;padding:8px">فعالیتی نیست.</div>';
      $$('#act-list [data-actdel]').forEach(b => b.addEventListener('click', () => {
        const acts2 = (gstate().S ? gstate().S.activities : []);
        // حذف بر اساس تطبیق تاریخ+بازیکن+نوع (ایندکس در آرایهٔ مرتب‌شده)
        const sorted = acts2.slice().sort((a,b) => +new Date(b.date) - +new Date(a.date));
        const target = sorted[+b.dataset.actdel];
        const idx = acts2.indexOf(target);
        if (idx >= 0){
          const del = D.loadDelActs();
          del.push(idx);
          D.saveDelActs(del);
          APP.reloadData(); APP.go('mgmt'); mgmtTab='programs';
          APP.toast('فعالیت حذف شد — امتیازش از سیستم برداشته شد', 'orange');
        }
      }));
    }
    renderActs();

    $('#pr-add').addEventListener('click', () => {
      const name = $('#pr-name').value.trim();
      const start = $('#pr-start')._value();
      const end = $('#pr-end')._value();
      if (!name && !start){ APP.toast('حداقل نام یا تاریخ را وارد کنید', 'red'); return; }
      const obj = {
        name: name || 'دورهٔ ' + D.fa(editingIdx >= 0 ? editingIdx + 1 : D.loadPrograms().length + 1),
        type: $('#pr-type').value, start, end, info: $('#pr-info').value.trim(),
        p1: +($('#pr-p1').value||0), p2: +($('#pr-p2').value||0), p3: +($('#pr-p3').value||0), entry: +($('#pr-entry').value||0),
      };
      const a = D.loadPrograms();
      if (editingIdx >= 0 && a[editingIdx]){
        Object.assign(a[editingIdx], obj);
        APP.toast('دوره ویرایش و ذخیره شد ✓', 'green');
      } else {
        a.push(obj);
        APP.toast('دوره «' + obj.name + '» ثبت شد ✓', 'green');
      }
      D.savePrograms(a); APP.reloadData(); APP.go('mgmt'); mgmtTab='programs';
    });
  }

  /* لیست بازیکنان فعال برای پیکر شرکت‌کنندگان */
  function activePlayersList(){
    const S = gstate().S;
    return S.players.filter(p => p[5]).map(p => ({ pid: p[0], name: p[1] }));
  }

  function mgmtCalendar(body){
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">➕</span><h3>افزودن رویداد به تقویم</h3><span class="tag">تاریخ شمسی • چندروزه</span></div>
      <div class="field-grid" style="margin-top:10px">
        <div class="span2"><label>نام رویداد</label><input class="input" id="me-name" style="width:100%" placeholder="مثلاً: اردوی هفتگی"></div>
        <div><label>نوع</label><select class="sel" id="me-type" style="width:100%">
          <option value="مسابقه">🏆 مسابقه</option><option value="تمرین">🏌️ تمرین</option><option value="کلاس">📚 کلاس</option><option value="اردو">⛺ اردو</option>
        </select></div>
        <div><label>رنگ</label><select class="sel" id="me-col" style="width:100%">
          <option value="green">سبز</option><option value="gold">طلایی</option><option value="blue">آبی</option><option value="purple">بنفش</option><option value="orange">نارنجی</option><option value="red">قرمز</option>
        </select></div>
      </div>
      <div class="field-grid" style="margin-top:10px">
        <div><label>تاریخ شروع <small>(شمسی)</small></label><div id="me-start"></div></div>
        <div><label>تاریخ پایان <small>(شمسی)</small></label><div id="me-end"></div></div>
      </div>
      <div id="me-schedule" style="margin-top:12px"></div>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
        <button class="btn sm" id="me-add" style="min-width:150px">📅 ثبت رویداد در تقویم</button>
        <span style="color:var(--muted);font-size:11.5px;align-self:center">شروع و پایان را با تقویم شمسی انتخاب کنید — برای چند روز، برای هر روز برنامه تعیین کنید</span>
      </div>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">🗓️</span><h3>رویدادهای سفارشی تقویم</h3><span class="tag">${D.fa(customEvents().length)} رویداد</span></div>
      <div id="me-list" style="margin-top:8px"></div>
    </div>
    `;

    const SCHED_OPTS = ['ورود','مسابقه','تمرین','کلاس','اهدای جام','تور','جلسه','مراسم','آزاد'];
    JDate.render($('#me-start'), { value: D.isoToShamsi(new Date().toISOString().slice(0,10)) && D.shamsiToISO(1405,6,10), onChange(){ renderSchedule(); } });
    JDate.render($('#me-end'),   { value: D.shamsiToISO(1405,6,10), onChange(){ renderSchedule(); } });

    function daysBetween(aIso, bIso){
      return Math.round((D.dateFrom(bIso) - D.dateFrom(aIso))/86400000) + 1;
    }
    function renderSchedule(){
      const box = $('#me-schedule'); if (!box) return;
      if (!$('#me-start')._value || !$('#me-end')._value) return;
      const a = $('#me-start')._value(), b = $('#me-end')._value();
      let n = 1;
      try { n = Math.max(1, Math.min(14, daysBetween(a, b))); } catch(e){ n = 1; }
      let html = `<div class="form-section">🗓 برنامه روزانه (${D.fa(n)} روز)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">`;
      for (let i=0;i<n;i++){
        const d = new Date(D.dateFrom(a).getTime() + i*86400000);
        const j = D.jalaliInfo(d);
        html += `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:8px 10px">
          <div style="font-size:10.5px;color:var(--gold-l);margin-bottom:5px">${D.fa(j.dd)} ${j.monthFa} ${j.wd}</div>
          <select class="sel me-day-sel" data-i="${i}" style="width:100%;font-size:11.5px">
            ${SCHED_OPTS.map(o => `<option>${o}</option>`).join('')}
          </select>
        </div>`;
      }
      html += '</div>';
      box.innerHTML = html;
    }
    renderSchedule();

    let editingIdx = -1;
    const btn = $('#me-add');
    function setBtn(){
      btn.textContent = editingIdx >= 0 ? '💾 ذخیرهٔ ویرایش رویداد' : '📅 ثبت رویداد در تقویم';
    }
    $('#me-add').addEventListener('click', () => {
      const name = $('#me-name').value.trim();
      const start = $('#me-start')._value();
      const end = $('#me-end')._value();
      if (!name && !start){ APP.toast('حداقل نام یا تاریخ را وارد کنید', 'red'); return; }
      let n = 1;
      try { n = Math.max(1, Math.min(14, daysBetween(start, end))); } catch(e){}
      const schedule = [];
      $$('.me-day-sel').forEach(s => schedule.push({ offset: +s.dataset.i, label: s.value }));
      const lst = customEvents();
      const obj = { name: name || 'رویداد ' + D.fa(lst.length+1), type: $('#me-type').value, col: $('#me-col').value,
        start, end, schedule };
      if (editingIdx >= 0 && lst[editingIdx]){
        Object.assign(lst[editingIdx], obj);
        APP.toast('رویداد «' + name + '» ویرایش و ذخیره شد ✓', 'green');
      } else {
        lst.push(obj);
        APP.toast('رویداد «' + (name || 'بدون نام') + '» ثبت شد ✓', 'green');
      }
      saveEvents(lst);
      editingIdx = -1; setBtn();
      $('#me-name').value = '';
      $('#me-type').value = 'مسابقه'; $('#me-col').value = 'green';
      renderMeList();
    });

    function renderMeList(){
    const lst = customEvents();
    $('#me-list').innerHTML = lst.length ? `<div class="holi-list">
      ${lst.map((e,i) => {
        const j = D.jalaliInfo(D.dateFrom(e.start || e.date));
        const n = e.end && e.start ? daysBetween(e.start, e.end) : 1;
        const sch = (e.schedule||[]).map(s => esc(s.label)).join('، ');
        return `<div class="h-item" style="align-items:flex-start">
          <span class="h-day" style="min-width:86px">${D.fa(j.dd)} ${j.monthFa}</span>
          <span style="flex:1"><b>${esc(e.name)}</b>
            <div style="font-size:10.5px;color:var(--muted)">${esc(e.type||'')}${n>1?' • '+D.fa(n)+' روز':''}${sch?' • '+sch:''}</div>
          </span>
          <button class="btn sm ghost" data-edme="${i}" title="ویرایش">✏️</button>
          <button class="btn sm danger" data-delme="${i}">🗑</button></div>`;
      }).join('')}</div>` : '<div style="color:var(--muted);font-size:12.5px;padding:8px">رویداد سفارشی ثبت نشده است.</div>';
    $$('#me-list [data-delme]').forEach(b => b.addEventListener('click', () => {
      const a = customEvents(); a.splice(+b.dataset.delme,1); saveEvents(a); APP.go('mgmt'); mgmtTab='calendar'; APP.toast('رویداد حذف شد 🗑','orange');
    }));
    $$('#me-list [data-edme]').forEach(b => b.addEventListener('click', () => {
      const lst = customEvents();
      const i = +b.dataset.edme, e = lst[i];
      if (!e) return;
      editingIdx = i; setBtn();
      $('#me-name').value = e.name || '';
      $('#me-type').value = e.type || 'مسابقه';
      $('#me-col').value = e.col || 'green';
      if (e.start) $('#me-start')._set(e.start);
      if (e.end) $('#me-end')._set(e.end);
      renderSchedule();
      if ($('#me-name').scrollIntoView) $('#me-name').scrollIntoView({ behavior:'smooth', block:'center' });
      APP.toast('در حال ویرایش «' + (e.name||'') + '» — پس از تغییر، ذخیرهٔ ویرایش را بزنید', 'gold');
    }));
    }
    renderMeList();
  }


  /* ── تب نتایج ── */
  /* ═══ ویزارد ثبت اسکورکارت (مرحله‌ای — سبک «ثبت رکورد») ═══
     پیش‌نویس اشتراکی همهٔ ادمین‌ها در ga_score_draft (ابری): تا «ثبت نهایی» نخورده، هر زمان ادامه‌پذیر.
     ساختار: { tourId: { pid: { holes: { hole: { s, pen, note } }, final, by, ts } } } */
  function scDraftLoad(){ try { return JSON.parse(localStorage.getItem('ga_score_draft') || '{}'); } catch(e){ return {} } }
  function scDraftSave(d){ try { localStorage.setItem('ga_score_draft', JSON.stringify(d)); } catch(e){} }
  function scDraftTour(tid){ const d = scDraftLoad(); return d[tid] || {}; }
  /* ثبت نهایی یک کارت پیش‌نویس: رفتن به ga_scorecards (ضربه+جریمه) */
  function scFinalize(t, pid){
    const dr = (scDraftTour(t[0]) || {})[pid];
    if (!dr || !Object.keys(dr.holes || {}).length) return false;
    const strokes = {};
    Object.entries(dr.holes).forEach(([h, e]) => { strokes[h] = e.s + (e.pen || 0); });
    const lst = extraCards();
    const i = lst.findIndex(c => c.tour === t[0] && c.pid === pid);
    const card = { tour: t[0], pid, strokes };
    if (i >= 0) lst[i] = card; else lst.push(card);
    saveCards(lst);
    const d = scDraftLoad(); if (d[t[0]] && d[t[0]][pid]){ d[t[0]][pid].final = true; }
    scDraftSave(d);
    return true;
  }
  /* ── موتور PDF (الگوی smartplay: CDN تنبل + html2canvas + jsPDF، دانلود مستقیم) ── */
  let _pdfLibsP2 = null;
  function mgPdfLibs(){
    if (window.html2canvas && window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
    if (!_pdfLibsP2){
      const once = src => new Promise((res, rej) => {
        if ([...document.scripts].some(s => s.src === src)) return res();
        const sc = document.createElement('script'); sc.src = src; sc.async = true;
        sc.onload = () => res(); sc.onerror = () => rej(new Error('cdn'));
        document.head.appendChild(sc);
      });
      _pdfLibsP2 = once('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')
        .then(() => once('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'));
      _pdfLibsP2.catch(() => { _pdfLibsP2 = null; });
    }
    return _pdfLibsP2;
  }
  function mgPdfFromEl(el, fileName, btn){
    const old = btn ? btn.textContent : '';
    const restore = () => { if (btn){ btn.disabled = false; btn.textContent = old; } };
    if (btn){ btn.disabled = true; btn.textContent = '⏳ در حال ساخت PDF…'; }
    mgPdfLibs().then(() => window.html2canvas(el, { backgroundColor: '#0b0f14', scale: 2, useCORS: true, logging: false }))
      .then(cv => {
        const PDF = window.jspdf.jsPDF;
        const pdf = new PDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
        const MG = 10, pageW = 200, pageH = 277;
        const pxPerMm = cv.width / pageW, pagePx = Math.floor(pageH * pxPerMm);
        const pages = Math.max(1, Math.ceil(cv.height / pagePx));
        for (let i = 0; i < pages; i++){
          const slice = document.createElement('canvas');
          slice.width = cv.width; slice.height = Math.min(pagePx, cv.height - i * pagePx);
          slice.getContext('2d').drawImage(cv, 0, i * pagePx, cv.width, slice.height, 0, 0, cv.width, slice.height);
          if (i) pdf.addPage();
          pdf.addImage(slice.toDataURL('image/jpeg', .93), 'JPEG', MG, MG, pageW, slice.height / pxPerMm);
        }
        pdf.save(fileName);
        APP.toast('📄 PDF گزارش دانلود شد ✓', 'green');
      })
      .catch(() => APP.toast('سرویس PDF در دسترس نیست — اتصال اینترنت را بررسی و دوباره تلاش کنید', 'red'))
      .then(restore);
  }

  /* ── گزارش پایانی مسابقه: سکو + رتبه‌بندی بر اساس کمترین ضربه (نسبت به مجموع پار) ── */
  function tourReport(t, onChange){
    const pars = (D.parsOf(t[3]) || []).slice(0, t[4] || 18);
    const tourPar = pars.reduce((a, b) => a + b, 0);
    const nameOf = pid => { const pl = gstate().S.players.find(p => p[0] === pid); return pl ? pl[1] : ('بازیکن ' + D.fa(pid)); };
    const rows = () => extraCards().filter(c => c.tour === t[0]).map(c => {
      const holes = Object.keys(c.strokes || {});
      const total = holes.reduce((a, h) => a + (c.strokes[h] | 0), 0);
      const par = holes.reduce((a, h) => a + (pars[+h - 1] || 0), 0);
      return { pid: c.pid, name: nameOf(c.pid), total, par, diff: total - par, nH: holes.length };
    }).sort((a, b) => a.diff - b.diff || a.total - b.total);
    const pending = () => Object.entries(scDraftTour(t[0]))
      .filter(([, d]) => !d.final && Object.keys(d.holes || {}).length >= (t[4] || 18))
      .map(([pid]) => +pid);
    const diffChip = d => d === 0
      ? '<span class="chip dim" style="font-weight:800">E</span>'
      : `<span class="chip ${d < 0 ? 'green' : ''}" style="font-weight:800;${d > 0 ? 'background:rgba(229,57,53,.14);border:1px solid rgba(229,57,53,.4);color:#ffb0b0' : ''}">${d > 0 ? '+' : '−'}${D.fa(Math.abs(d))}</span>`;

    let rp = $('#tour-report');
    if (!rp){ rp = document.createElement('div'); rp.id = 'tour-report'; document.body.appendChild(rp); }
    rp.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(10,15,22,.97);display:flex;flex-direction:column;overflow:auto';

    function render(){
      const list = rows(), pend = pending();
      const medals = ['🥇','🥈','🥉'];
      if (!list.length && !pend.length){
        rp.innerHTML = `<div style="margin:auto;text-align:center;padding:30px"><div style="font-size:40px">🏁</div><div class="glass gold-border" style="padding:20px;margin-top:12px;font-size:13px">هنوز هیچ کارتی ثبت نهایی نشده —<br>کارت بازیکنان را در ویزارد کامل کنید.</div><button class="btn ghost" id="tr-x" style="margin-top:14px">بستن</button></div>`;
        $('#tr-x').onclick = () => { rp.style.display = 'none'; if (onChange) onChange(); };
        return;
      }
      rp.innerHTML = `<div style="max-width:760px;width:100%;margin:0 auto;padding:18px 14px 24px" id="tr-capture">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <div style="flex:1">
            <div style="font-weight:900;font-size:17px">🏁 گزارش پایانی — ${esc(t[1])}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px">${esc(D.COURSE_NAME[t[3]] || '—')} • ${D.fa(t[4] || 18)} میدان • <b style="color:var(--gold-l)">مجموع پار: ${D.fa(tourPar)}</b> • تاریخ ${D.isoToShamsi ? D.fa(D.isoToShamsi(String((t[5] || '')).slice(0, 10))) : ''}</div>
          </div>
          <button class="btn sm ghost" id="tr-x" title="بستن گزارش" data-no-pdf>✕</button>
        </div>
        ${pend.length ? `<div class="glass" style="border:1px dashed rgba(212,175,55,.5);padding:10px 13px;display:flex;align-items:center;gap:10px;margin:10px 0" data-no-pdf>
          <span style="flex:1;font-size:11.5px">⏳ ${D.fa(pend.length)} کارت کامل در انتظار «ثبت نهایی» است — ثبت نشوند، در گزارش نمی‌آیند.</span>
          <button class="btn sm" id="tr-finall" style="background:linear-gradient(135deg,#1ebb8a,#15996f);color:#fff;font-weight:800">✅ ثبت نهایی ${D.fa(pend.length)} کارت</button>
        </div>` : ''}
        ${list.length ? `<div style="display:flex;gap:9px;justify-content:center;align-items:flex-end;margin:16px 0 6px">
          ${[list[1], list[0], list[2]].filter(Boolean).map(r => {
            const idx = list.indexOf(r);
            return `<div class="glass ${idx === 0 ? 'gold-border' : ''}" style="text-align:center;padding:${idx === 0 ? '20px 16px' : '14px 12px'};min-width:112px;border-radius:14px;transform:translateY(${idx === 0 ? '-8px' : '0'})">
              <div style="font-size:${idx === 0 ? '30px' : '22px'}">${medals[idx]}</div>
              <div style="font-weight:800;font-size:13px;margin-top:5px">${esc(r.name)}</div>
              <div style="font-size:19px;font-weight:900;margin-top:4px;direction:ltr">${D.fa(r.total)}</div>
              <div style="margin-top:4px">${diffChip(r.diff)}</div>
            </div>`;
          }).join('')}
        </div>` : ''}
        <table class="tbl" style="width:100%;margin-top:14px">
          <thead><tr><th style="width:54px">رتبه</th><th>بازیکن</th><th>میدان</th><th>مجموع ضربه</th><th>مجموع پار</th><th>نسبت به پار</th></tr></thead>
          <tbody>
          ${list.map((r, i) => `<tr${i === 0 ? ' style="background:rgba(212,175,55,.06)"' : ''}>
            <td style="text-align:center;font-weight:800">${medals[i] || D.fa(i + 1)}</td>
            <td style="font-weight:${i < 3 ? 800 : 500}">${esc(r.name)}</td>
            <td class="num" style="text-align:center">${D.fa(r.nH)}</td>
            <td class="num" style="text-align:center;font-weight:900">${D.fa(r.total)}</td>
            <td class="num" style="text-align:center;color:var(--muted)">${D.fa(r.par)}</td>
            <td style="text-align:center">${diffChip(r.diff)}</td>
          </tr>`).join('')}
          </tbody>
        </table>
        <div style="font-size:10px;color:var(--muted);margin-top:8px">کمترین مجموع ضربه = نفر اول • − = زیر پار • + = بالای پار • نمرهٔ هر بازیکن = ضربه + جریمهٔ حفره‌ها</div>
      </div>
      <div style="position:sticky;bottom:0;display:flex;gap:9px;justify-content:center;padding:12px 0 18px" data-no-pdf>
        <button class="btn" id="tr-pdf" style="background:linear-gradient(135deg,var(--gold),#b08a28);font-weight:900;min-width:200px">⬇ دانلود PDF گزارش</button>
      </div>`;
      $('#tr-x').addEventListener('click', () => { rp.style.display = 'none'; if (onChange) onChange(); });
      const fz = $('#tr-finall');
      if (fz) fz.addEventListener('click', () => {
        pend.forEach(pid => scFinalize(t, pid));
        APP.toast(`📥 ${D.fa(pend.length)} کارت ثبت نهایی شد`, 'green');
        if (onChange) onChange();
        render();
      });
      const pb = $('#tr-pdf');
      if (pb) pb.addEventListener('click', () => {
        $$('#tour-report [data-no-pdf]').forEach(e => { e.style.visibility = 'hidden'; });
        mgPdfFromEl($('#tr-capture'), `گزارش-مسابقه-${String(t[1]).replace(/\s+/g, '-')}.pdf`, pb);
        setTimeout(() => $$('#tour-report [data-no-pdf]').forEach(e => { e.style.visibility = ''; }), 1200);
      });
    }
    render();
  }


  function openScoreWizard(t){
    let w = $('#score-wizard');
    if (!w){
      w = document.createElement('div');
      w.id = 'score-wizard';
      w.style.cssText = 'position:fixed;inset:0;z-index:9000;display:none;flex-direction:column;background:linear-gradient(160deg,#0a0f16,#0d1420);overflow:hidden';
      document.body.appendChild(w);
    }
    const pars = (D.parsOf(t[3]) || []).slice(0, t[4] || 18);
    const nHoles = t[4] || 18;
    const res = (D.loadResults() || {})[t[0]];
    let state = { step: 1, pid: null, hole: null };
    const curU = APP.currentUser();

    const playersOf = () => {
      if (res && Array.isArray(res.participants) && res.participants.length){
        return S2players().filter(p => res.participants.includes(p.pid));
      }
      return S2players();
    };
    function S2players(){ return activePlayersList(); }

    function draftFor(pid){
      const all = scDraftTour(t[0]);
      if (!all[pid]) all[pid] = { holes: {}, final: false };
      return all[pid];
    }
    function savePid(pid, obj){
      const d = scDraftLoad();
      if (!d[t[0]]) d[t[0]] = {};
      d[t[0]][pid] = Object.assign(obj, { by: (APP.users && APP.users.label ? APP.users.label(curU) : curU), ts: new Date().toISOString() });
      scDraftSave(d);
    }
    const holesDone = p => Object.keys(draftFor(p).holes).length;
    const isComplete = p => holesDone(p) >= nHoles;

    function headerHtml(){
      const done = playersOf().filter(p => draftFor(p.pid).final).length;
      return `<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line-soft);background:rgba(255,255,255,.02)">
        <button class="btn sm ghost" id="sw-close" title="بستن (پیش‌نویس نگه داشته می‌شود)">✕</button>
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:14.5px">📋 ویزارد اسکورکارت — ${esc(t[1])}</div>
          <div style="font-size:10.5px;color:var(--muted);margin-top:2px">${esc(D.COURSE_NAME[t[3]] || '—')} • ${D.fa(nHoles)} حفره • پیش‌نویس ابری — هر ادمین می‌تواند ادامه دهد</div>
        </div>
        <span class="chip ${done ? 'green' : 'gold'}">${D.fa(done)} کارت نهایی</span>
        <button class="btn sm ghost" id="sw-peek" title="جدول اسکورکارت (نمایش)">👁 جدول</button>
        <button class="btn sm" id="sw-report" style="background:linear-gradient(135deg,var(--gold),#b08a28);color:#1a1407;font-weight:800" title="ثبت نهایی و گزارش پایانی مسابقه">🏁 گزارش مسابقه</button>
      </div>
      <div style="display:flex;gap:6px;padding:9px 16px;font-size:10.5px;color:var(--muted);border-bottom:1px solid var(--line-soft)">
        ${['۱. انتخاب بازیکن','۲. انتخاب میدان','۳. ثبت ضربه'].map((s,i) => `<span style="padding:3px 10px;border-radius:99px;${state.step === i+1 ? 'background:rgba(212,175,55,.15);color:var(--gold-l);border:1px solid rgba(212,175,55,.4);font-weight:700' : 'background:rgba(255,255,255,.03)'}">${s}</span>`).join('')}
      </div>`;
    }

    function stepPlayers(){
      const list = playersOf();
      return `<div style="padding:16px;overflow:auto;flex:1">
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px">بازیکن شرکت‌کننده در این مسابقه را انتخاب کنید${res ? '' : ' <span class="chip dim" style="font-size:9.5px">نتایج ثبت نشده — همهٔ اعضای فعال</span>'}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:9px">
        ${list.map(p => {
          const dr = draftFor(p.pid);
          const n = holesDone(p.pid);
          const full = isComplete(p.pid);
          return `<button type="button" class="sw-player" data-pid="${p.pid}" style="text-align:right;cursor:pointer;border-radius:13px;padding:12px;border:1px solid ${dr.final ? 'rgba(30,187,138,.5)' : 'var(--line-soft)'};background:${dr.final ? 'rgba(30,187,138,.07)' : 'rgba(255,255,255,.025)'};color:inherit">
            <div style="font-weight:800;font-size:13px">${esc(p.name)} ${dr.final ? '✔' : ''}</div>
            <div style="font-size:10px;color:${n ? 'var(--gold-l)' : 'var(--muted)'};margin-top:5px">
              ${dr.final ? 'ثبت نهایی شد ✔ — برای ویرایش انتخاب کنید' : n ? `پیش‌نویس: ${D.fa(n)} از ${D.fa(nHoles)} میدان` : 'شروع نشده'}
            </div>
            <div class="pbar" style="margin-top:6px;height:4px"><i style="background:${dr.final ? '#1ebb8a' : 'var(--gold)'};width:${Math.round(n / nHoles * 100)}%"></i></div>
          </button>`;
        }).join('')}
        </div></div>`;
    }

    function stepHoles(){
      const p = playersOf().find(x => x.pid === state.pid);
      const dr = draftFor(state.pid);
      return `<div style="padding:16px;overflow:auto;flex:1">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <button class="btn sm ghost" data-swback="1">→ بازیکنان</button>
          <b style="font-size:13.5px">${esc(p ? p.name : '')}</b>
          <span class="chip dim">${D.fa(holesDone(state.pid))}/${D.fa(nHoles)} میدان</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px">
        ${Array.from({length:nHoles}, (_,i) => {
          const h = i + 1, e = dr.holes[h];
          return `<button type="button" class="sw-hole" data-hole="${h}" style="cursor:pointer;border-radius:12px;padding:10px 8px;text-align:center;border:1px solid ${e ? 'rgba(30,187,138,.45)' : 'var(--line-soft)'};background:${e ? 'rgba(30,187,138,.07)' : 'rgba(255,255,255,.025)'};color:inherit">
            <div style="font-size:10px;color:var(--muted)">حفره ${D.fa(h)} • پار <b style="color:var(--gold-l)">${D.fa(pars[i] || '—')}</b></div>
            <div style="font-size:17px;font-weight:800;margin-top:4px;direction:ltr">${e ? D.fa(e.s + (e.pen || 0)) : '—'}</div>
            ${e && e.pen ? `<div style="font-size:9px;color:#ffb3b3">جریمه +${D.fa(e.pen)}</div>` : (e && e.note ? '<div style="font-size:9px;color:var(--muted)">📝 یادداشت</div>' : '')}
          </button>`;
        }).join('')}
        </div>
        ${isComplete(state.pid) && !dr.final ? `<div style="margin-top:14px;text-align:left">
          <button class="btn" id="sw-finalize" style="background:linear-gradient(135deg,#1ebb8a,#15996f);font-weight:800">✅ ثبت نهایی کارت «${esc(p ? p.name : '')}» — مجموع ${D.fa(sumOf(state.pid))}</button>
          <div style="font-size:10px;color:var(--muted);margin-top:6px">با ثبت نهایی، کارت به اسکورکارت مسابقه می‌رود و برای همه (از جمله اعضا) نمایش داده می‌شود.</div>
        </div>` : ''}
        ${dr.final ? `<div style="margin-top:14px" class="chip green">این کارت ثبت نهایی شده — برای اصلاح، هر حفره را باز و دوباره ثبت کن (به‌روزرسانی می‌شود)</div>` : ''}
      </div>`;
    }

    function sumOf(pid){
      const dr = draftFor(pid);
      return Object.values(dr.holes).reduce((a, e) => a + e.s + (e.pen || 0), 0);
    }

    function stepHole(){
      const p = playersOf().find(x => x.pid === state.pid);
      const h = state.hole, par = pars[h - 1];
      const dr = draftFor(state.pid);
      const e = dr.holes[h] || {};
      return `<div style="padding:16px;overflow:auto;flex:1;display:flex;justify-content:center">
        <div class="glass gold-border" style="width:min(430px,100%);padding:18px;height:fit-content;margin-top:6px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <button class="btn sm ghost" data-swback="2">→ میدان‌ها</button>
            <div style="flex:1;text-align:center">
              <div style="font-weight:800;font-size:15px">حفرهٔ ${D.fa(h)}</div>
              <div style="font-size:10.5px;color:var(--muted);margin-top:3px">${esc(p ? p.name : '')} • پار این میدان: <b style="color:var(--gold-l)">${D.fa(par || '—')}</b>${D.tourRuleOf && D.tourRuleOf(t[0]) === 'full' ? ` • سقف قانون فول: ${D.fa(D.holeCap(par))}` : ''}</div>
            </div>
          </div>
          <label style="font-size:11px;color:var(--muted)">⛳ تعداد ضربه بازیکن در این میدان</label>
          <input class="input" id="sw-s" type="text" inputmode="numeric" autocomplete="off" value="${e.s != null ? D.fa(e.s) : ''}" style="width:100%;height:56px;font-size:25px;font-weight:800;text-align:center;direction:ltr;margin:7px 0 12px" placeholder="—">
          <label style="font-size:11px;color:var(--muted)">⚠️ ضربه جریمه (در صورت نداشتن، خالی بماند)</label>
          <input class="input" id="sw-pen" type="text" inputmode="numeric" autocomplete="off" value="${e.pen ? D.fa(e.pen) : ''}" style="width:100%;height:46px;font-size:19px;font-weight:800;text-align:center;direction:ltr;margin:7px 0 12px" placeholder="۰">
          <label style="font-size:11px;color:var(--muted)">📝 توضیحات (اختیاری)</label>
          <textarea class="input" id="sw-note" maxlength="300" style="width:100%;resize:vertical;min-height:64px;font-size:12px;line-height:1.8;margin:7px 0 14px" placeholder="مثلاً: توپ رفت توی آب — +۱ جریمه">${e.note ? esc(e.note) : ''}</textarea>
          <button class="btn" id="sw-save" style="width:100%;padding:13px;font-weight:900;font-size:14.5px">✓ ثبت و بازگشت به لیست بازیکن</button>
        </div></div>`;
    }

    function render(){
      w.innerHTML = headerHtml() + `<div id="sw-body" style="flex:1;display:flex;flex-direction:column;min-height:0">${
        state.step === 1 ? stepPlayers() : state.step === 2 ? stepHoles() : stepHole()
      }</div>`;
      w.style.display = 'flex';
      $('#sw-close').addEventListener('click', () => { w.style.display = 'none'; mgmtTab = 'results'; APP.go('mgmt'); });
      $('#sw-peek').addEventListener('click', () => openScorecardModal(t));
      $('#sw-report').addEventListener('click', () => tourReport(t, () => render()));
      $$('#sw-body [data-swback]').forEach(b => b.addEventListener('click', () => { state.step = +b.dataset.swback; render(); }));
      if (state.step === 1){
        $$('#sw-body .sw-player').forEach(b => b.addEventListener('click', () => { state.pid = +b.dataset.pid; state.step = 2; render(); }));
      } else if (state.step === 2){
        $$('#sw-body .sw-hole').forEach(b => b.addEventListener('click', () => { state.hole = +b.dataset.hole; state.step = 3; render(); }));
        const fz = $('#sw-finalize');
        if (fz) fz.addEventListener('click', () => {
          scFinalize(t, state.pid);
          APP.toast(`کارت «${esc((playersOf().find(x => x.pid === state.pid) || {}).name || '')}» ثبت نهایی شد ✅`, 'green');
          if (confirm('ثبت نهایی شد ✔ گزارش مسابقه را ببینید؟')) tourReport(t, () => render());
          else render();
        });
      } else {
        const toEN = s => String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d]/g, '');
        const si = $('#sw-s'); if (si) si.focus();
        $('#sw-save').addEventListener('click', () => {
          const s = +toEN($('#sw-s').value), pen = +toEN($('#sw-pen').value) || 0;
          const note = ($('#sw-note').value || '').trim();
          if (!s || s < 1 || s > 30){ APP.toast('تعداد ضربه را درست وارد کنید (۱ تا ۳۰)', 'red'); return; }
          if (pen < 0 || pen > 10){ APP.toast('ضربه جریمه معتبر نیست', 'red'); return; }
          const dr = draftFor(state.pid);
          dr.holes[state.hole] = { s, pen, note };
          savePid(state.pid, dr);
          /* اگر قبلاً نهایی شده بود، کارت نهایی هم به‌روزرسانی شود */
          if (dr.final){
            const lst = extraCards();
            const i = lst.findIndex(c => c.tour === t[0] && c.pid === state.pid);
            if (i >= 0){
              const strokes = {};
              Object.entries(dr.holes).forEach(([h, e2]) => { strokes[h] = e2.s + (e2.pen || 0); });
              lst[i].strokes = strokes; saveCards(lst);
            }
          }
          APP.toast(`حفرهٔ ${D.fa(state.hole)} ثبت شد ✓`, 'green');
          state = { step: 1, pid: null, hole: null }; /* طبق خواسته: برگشت به لیست بازیکن */
          render();
        });
      }
    }
    render();
  }

  /* ── مودال اسکورکارت مسابقه: جدول بازیکن × حفره + جمع + نسبت به پار ── */
  function openScorecardModal(t){
    const S = gstate().S;
    const pars = (D.parsOf(t[3]) || []).slice(0, t[4] || 18);
    const parTotal = pars.reduce((a,b)=>a+b,0);
    const j = D.jalaliInfo(D.dateFrom(t[5]));
    let m = $('#modal-scorecard');
    if (!m){
      m = document.createElement('div');
      m.id = 'modal-scorecard';
      m.style.cssText = 'position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;background:rgba(4,8,14,.78);backdrop-filter:blur(6px);padding:10px';
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
    }
    const cards = S.scorecards.filter(sc => +sc.tour === t[0])
      .map(sc => ({ sc, name: D.nameOf(+sc.pid) }))
      .sort((a,b) => a.sc.total - b.sc.total);
    const rule = D.tourRuleOf ? D.tourRuleOf(t[0]) : 'normal';
    const holeCell = (sc, hi) => {
      const v = sc.strokes[hi+1];
      if (v == null) return '<td class="num" style="opacity:.35">—</td>';
      const p = pars[hi];
      const wasCapped = sc.caps && sc.caps[hi+1] !== undefined;
      const style = wasCapped ? 'color:#ffcf6b;font-weight:700'
        : (v < p ? 'color:#7ee8b8;font-weight:700' : (v > p ? 'color:#ff9d9d' : ''));
      const title = wasCapped ? ` title="ضربهٔ واقعی: ${D.fa(sc.caps[hi+1])} — سقف قانون فول اعمال شد"` : '';
      return `<td class="num" style="${style}"${title}>${D.fa(v)}${wasCapped ? '<span style="color:#ffcf6b">*</span>' : ''}</td>`;
    };
    const capN = cards.reduce((a,c) => a + (c.sc.capped || 0), 0);
    m.innerHTML = `
    <div class="glass gold-border" style="width:min(920px,96vw);max-height:92vh;overflow:auto;padding:20px 22px">
      <div class="card-head"><span class="ic">📋</span><h3>اسکورکارت «${esc(t[1])}»</h3>
        <span class="tag">${D.fa(j.dd)} ${j.monthFa} • ${esc(D.COURSE_NAME[t[3]] || '—')} • ${D.fa(t[4] || pars.length)} حفره • پار ${D.fa(parTotal)}${rule === 'full' ? ' • ⚖️ قانون فول' : ''}</span></div>
      ${rule === 'full' ? `<div style="margin-top:8px;font-size:11px;color:#ffcf6b;background:rgba(255,207,107,.06);border:1px dashed rgba(255,207,107,.35);border-radius:9px;padding:7px 10px">⚖️ قانون فول فعال: سقف ضربهٔ هر حفره — پار۳ حداکثر ۷ • پار۴ حداکثر ۹ • پار۵ حداکثر ۱۱${capN ? ` • ${D.fa(capN)} ضربه اصلاح شد (*دار)` : ''}</div>` : ''}
      ${cards.length ? `
      <div style="overflow-x:auto;margin-top:12px"><table class="tbl" style="min-width:560px">
        <thead><tr><th>#</th><th>بازیکن</th>${pars.map((p,i) => `<th class="num" title="پار حفره ${D.fa(i+1)}: ${D.fa(p)}">${D.fa(i+1)}</th>`).join('')}<th class="num">جمع</th><th class="num">±</th></tr>
        <tr style="color:var(--muted);font-size:10.5px"><td></td><td style="color:var(--muted)">پار</td>${pars.map(p => `<td class="num">${D.fa(p)}</td>`).join('')}<td class="num">${D.fa(parTotal)}</td><td></td></tr></thead>
        <tbody>${cards.map((c,i) => {
          const delta = c.sc.total - parTotal;
          const dTxt = delta === 0 ? 'E' : (delta > 0 ? '+' : '−') + D.fa(Math.abs(delta));
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
          return `<tr${i === 0 ? ' style="background:rgba(212,175,55,.08)"' : ''}>
            <td class="num">${D.fa(i+1)}</td>
            <td><b>${esc(c.name)}</b> ${medal}</td>
            ${pars.map((p,hi) => holeCell(c.sc, hi)).join('')}
            <td class="num"><b>${D.fa(c.sc.total)}</b></td>
            <td class="num" style="color:${delta < 0 ? '#7ee8b8' : (delta > 0 ? '#ff9d9d' : 'var(--muted)')}">${dTxt}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div style="font-size:11px;color:var(--muted);margin-top:9px">⛳ قانون گلف: برنده = کمترین ضربه • ${D.fa(cards.length)} کارت ثبت‌شده • <span style="color:#7ee8b8">سبز: زیر پار</span> • <span style="color:#ff9d9d">قرمز: بالای پار</span></div>`
      : `<div style="padding:30px 14px;text-align:center;color:var(--muted)">📋 هنوز اسکورکارتی برای این مسابقه ثبت نشده است.<div style="font-size:11.5px;margin-top:8px">از بخش «کارت ضربات هر میدان» در همین صفحه ثبت کنید.</div></div>`}
      <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn sm ghost" id="sc-close">بستن</button></div>
    </div>`;
    m.style.display = 'flex';
    $('#sc-close').addEventListener('click', () => m.style.display = 'none');
  }

  /* ── صفحهٔ مستقل «ارسال پیام» — آیتم منوی گروه «مدیریت» (کنار پنل مدیریت/یوزرها/تنظیمات نمایش) ── */
  function pageMessages(){
    const v = $('#view');
    v.innerHTML = `<div class="card-head" style="margin-bottom:14px"><span class="ic">📨</span>
      <h2 style="font-size:16px">${esc(L('nav.messages','ارسال پیام'))}</h2>
      <span class="tag">پیام به اعضا • نمایش اجباری با تأیید «خواندم»</span></div>
      <div id="pm-root"></div>`;
    mgmtMessages($('#pm-root'));
  }

  /* ── تب ارسال پیام: فرم + انتخاب مخاطب + تاریخچه با وضعیت خواندن هر عضو ── */
  function mgmtMessages(body){
    const users = APP.users.list().filter(u => u && u.active && u.role === 'member');
    let picked = [];
    const escU = s => esc(String(s || ''));
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">📨</span><h3>ارسال پیام به اعضا</h3><span class="tag">نمایش اجباری روی پنل عضو تا تأیید «خواندم»</span></div>
      <div class="field-grid" style="margin-top:12px">
        <div class="span2"><label>عنوان پیام</label><input class="input" id="pm-subject" maxlength="90" style="width:100%" placeholder="مثلاً: تغییر ساعت کلاس پنجشنبه"></div>
        <div class="span2"><label>متن پیام</label><textarea class="input" id="pm-body" rows="4" maxlength="1200" style="width:100%;resize:vertical;line-height:1.9" placeholder="متن پیام برای اعضا…"></textarea></div>
      </div>
      <div class="form-section" style="margin-top:14px">👥 انتخاب مخاطبین</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn sm ghost" id="pm-all">☑ انتخاب همه (${D.fa(users.length)} عضو)</button>
        <button class="btn sm ghost" id="pm-none">☐ هیچ‌کدام</button>
        <input class="input" id="pm-search" placeholder="🔍 جست‌وجوی عضو (نام یا یوزرنیم)…" style="flex:1;min-width:170px">
      </div>
      <div id="pm-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:7px;margin:10px 0"></div>
      <div id="pm-picked" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-height:34px;padding:8px 10px;border:1px dashed var(--line-soft);border-radius:10px;font-size:11.5px"></div>
      <div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end;align-items:center">
        <span id="pm-count" style="font-size:11.5px;color:var(--muted)"></span>
        <button class="btn" id="pm-send" style="min-width:180px;font-weight:800">📤 ارسال پیام</button>
      </div>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">🗂</span><h3>تاریخچه پیام‌های ارسال‌شده</h3><span class="tag" id="pm-hcount">${D.fa(GA_MSG.load().length)} پیام</span></div>
      <div id="pm-history" style="margin-top:8px;display:grid;gap:8px"></div>
    </div>`;

    function drawList(){
      const q = ($('#pm-search').value || '').trim().toLowerCase();
      $('#pm-list').innerHTML = users.filter(u => !q || (u.name + ' @' + u.user).toLowerCase().includes(q)).map(u => {
        const on = picked.some(x => x.user === u.user);
        return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;cursor:pointer;border:1px solid ${on ? 'rgba(212,175,55,.55)' : 'var(--line-soft)'};background:${on ? 'rgba(212,175,55,.08)' : 'rgba(255,255,255,.02)'};font-size:12px;transition:.15s" data-pmu="${escU(u.user)}">
          <input type="checkbox" ${on ? 'checked' : ''} style="accent-color:var(--gold);pointer-events:none">
          <span style="flex:1">${escU(u.name)}<small style="color:var(--muted)"> @${escU(u.user)}</small></span>
        </label>`;
      }).join('') || '<div style="color:var(--muted);font-size:11.5px;padding:8px">عضویی با این جست‌وجو پیدا نشد</div>';
      $$('#pm-list [data-pmu]').forEach(el => el.addEventListener('click', ev => {
        ev.preventDefault();
        const u = users.find(x => String(x.user).toLowerCase() === el.dataset.pmu.toLowerCase());
        if (!u) return;
        if (picked.some(x => x.user === u.user)) picked = picked.filter(x => x.user !== u.user);
        else picked.push(u);
        drawList(); drawPicked();
      }));
    }
    function drawPicked(){
      const box = $('#pm-picked');
      box.innerHTML = picked.length
        ? `<span style="color:var(--muted)">مخاطبین انتخاب‌شده (${D.fa(picked.length)}):</span>` + picked.map(u =>
            `<span class="chip gold" style="display:inline-flex;align-items:center;gap:6px">${escU(u.name)}<b data-pmx="${escU(u.user)}" style="cursor:pointer" title="حذف از مخاطبین">✕</b></span>`).join('')
        : '<span style="color:var(--muted)">هنوز مخاطبی انتخاب نشده — بالا انتخاب کنید (همه / تکی / جست‌وجو)</span>';
      box.querySelectorAll('[data-pmx]').forEach(x => x.addEventListener('click', () => {
        picked = picked.filter(u => u.user !== x.dataset.pmx); drawList(); drawPicked();
      }));
      const c = $('#pm-count'); if (c) c.textContent = picked.length ? `مجموعاً ${D.fa(picked.length)} مخاطب` : '';
    }
    drawList(); drawPicked();
    $('#pm-search').addEventListener('input', drawList);
    $('#pm-all').addEventListener('click', () => { picked = users.slice(); drawList(); drawPicked(); });
    $('#pm-none').addEventListener('click', () => { picked = []; drawList(); drawPicked(); });

    const fmtAt = iso => `${D.fa(D.isoToShamsi(String(iso).slice(0, 10)))} ${D.fa(new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }))}`;
    function drawHistory(){
      const reads = GA_MSG.reads();
      const arr = GA_MSG.load().slice().sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const hc = $('#pm-hcount'); if (hc) hc.textContent = D.fa(arr.length) + ' پیام';
      $('#pm-history').innerHTML = arr.length ? arr.map(m => {
        const n = (m.targets || []).length;
        const rd = reads[m.id] || {};
        const okN = (m.targets || []).filter(k => rd[k]).length;
        return `<div class="glass" style="padding:11px 14px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer" data-pmopen="${escU(m.id)}" title="کلیک: لیست کامل مخاطبین و وضعیت خواندن">
            <span style="color:var(--gold-l)">${m.priority === 'urgent' ? '🚨' : '📨'}</span><b style="font-size:13px">${escU(m.subject)}</b>
            <span class="chip dim">${fmtAt(m.createdAt)}</span>
            <span class="chip dim">از: ${escU(m.sender || 'مدیریت')}</span>
            <span style="flex:1"></span>
            <span class="chip blue" title="تعداد مخاطبین">👥 ${D.fa(n)}</span>
            <span class="chip green" title="خوانده‌شده">✓ ${D.fa(okN)}</span>
            <span class="chip ${n - okN ? 'gold' : 'dim'}" title="خوانده‌نشده">● ${D.fa(n - okN)}</span>
          </div>
          <div data-pmd="${escU(m.id)}" style="display:none;margin-top:10px;border-top:1px dashed var(--line-soft);padding-top:10px"></div>
        </div>`;
      }).join('') : '<div style="padding:18px;text-align:center;color:var(--muted);font-size:12.5px">هنوز پیامی ارسال نشده است.</div>';
      $$('#pm-history [data-pmopen]').forEach(el => el.addEventListener('click', () => {
        const m = GA_MSG.load().find(x => x.id === el.dataset.pmopen);
        const d = body.querySelector(`[data-pmd="${CSS.escape(el.dataset.pmopen)}"]`);
        if (!m || !d) return;
        if (d.style.display === 'block'){ d.style.display = 'none'; return; }
        d.style.display = 'block';
        const rd = (GA_MSG.reads() || {})[m.id] || {};
        d.innerHTML = `<div style="font-size:11.5px;color:var(--muted);margin-bottom:8px;line-height:2;white-space:pre-wrap;background:rgba(255,255,255,.02);border-radius:9px;padding:8px 10px">${escU(m.body)}</div>` +
          (m.targets || []).map(k => {
            const u = users.find(x => String(x.user).toLowerCase() === String(k).toLowerCase());
            const at = rd[k];
            return `<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;font-size:12px;border-bottom:1px solid rgba(255,255,255,.04);flex-wrap:wrap">
              <span style="flex:1;min-width:130px">${escU(u ? u.name : k)} <small style="color:var(--muted)">@${escU(k)}</small></span>
              <span class="chip dim">📤 ارسال‌شده</span>
              ${at ? `<span class="chip green">✓ خوانده شد</span><span class="chip dim" style="font-size:10px">${fmtAt(at)}</span>`
                   : `<span class="chip gold">● خوانده نشده</span>`}
            </div>`;
          }).join('') || '<div style="color:var(--muted);font-size:11px">مخاطبی ثبت نشده</div>';
      }));
    }
    drawHistory();

    $('#pm-send').addEventListener('click', () => {
      const subject = ($('#pm-subject').value || '').trim();
      const text = ($('#pm-body').value || '').trim();
      if (!subject){ APP.toast('عنوان پیام را وارد کنید', 'red'); return; }
      if (!text){ APP.toast('متن پیام را وارد کنید', 'red'); return; }
      if (!picked.length){ APP.toast('حداقل یک مخاطب انتخاب کنید', 'red'); return; }
      const cur = APP.currentUser();
      const msg = {
        id: 'm' + Date.now().toString(36),
        subject, body: text,
        sender: APP.users.label(cur),
        senderUser: cur,
        createdAt: new Date().toISOString(),
        targets: picked.map(u => String(u.user).toLowerCase()),
        /* ساختار آماده برای توسعهٔ آینده — بدون بازنویسی */
        channel: 'popup', priority: 'normal', scheduleAt: null, groupKey: null,
      };
      const list = GA_MSG.load(); list.push(msg); GA_MSG.save(list);
      APP.toast(`پیام «${subject}» برای ${D.fa(picked.length)} عضو ارسال شد 📨`, 'green');
      APP.reloadData(); APP.go('messages'); /* صفحهٔ مستقل در منوی گروه مدیریت */
    });
  }

  function mgmtResults(body){
    const S = gstate().S;
    const results = D.loadResults();
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">⛳</span><h3>نتایج مسابقات</h3><span class="tag">ثبت شرکت‌کنندگان + نفرات برتر + امتیاز خودکار</span></div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;padding:9px 12px;border-radius:10px;border:1px solid rgba(212,175,55,.4);background:rgba(212,175,55,.07);font-size:12px">⛳ <b style="color:#f0d989">قانون گلف:</b> هر مسابقه ۱۸ حفره و پار ۷۲ است؛ برنده <b style="color:#7ee8b8">کمترین ضربه</b> را دارد — مثلاً ۶۵ نسبت به ۷۰ ضربه برنده است.</div>
      <div style="font-size:11.5px;color:var(--muted);margin-top:6px">از لیست پایین مسابقه را انتخاب کنید و دکمهٔ «🎯 ثبت نتایج» را بزنید — با دبل‌کلیک بازیکنان را به شرکت‌کنندگان اضافه/حذف کنید، نفرات اول تا سوم را انتخاب کنید و امتیازها خودکار داده می‌شود.</div>
      <div id="mr-tours" style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px"></div>
    </div>
    <div class="glass" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">🏌️</span><h3>کارت ضربات هر میدان</h3><span class="tag">ورود با کیبورد — Enter میدان بعدی</span></div>
      <div class="toolbar" style="margin-top:10px">
        <span class="lbl">مسابقه:</span><select class="sel" id="mr-tour" style="min-width:180px">${S.tournaments.map(t=>`<option value="${t[0]}">${esc(t[1])}</option>`).join('')}</select>
        <span class="lbl">بازیکن:</span><select class="sel" id="mr-pl" style="min-width:160px">${S.players.filter(p=>p[5]).map(p=>`<option value="${p[0]}">${esc(p[1])}</option>`).join('')}</select>
      </div>
      <div id="mr-holes" style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"></div>
      <button class="btn sm" id="mr-add">💾 ثبت کارت ضربات</button>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">📋</span><h3>نتایج ثبت‌شده</h3><span class="tag">${D.fa(Object.keys(results).length)} مسابقه</span></div>
      <div id="mr-list" style="margin-top:8px"></div>
    </div>`;

    // ── ۱) لیست همهٔ مسابقات با دکمهٔ نتایج ──
    const toursBox = $('#mr-tours');
    toursBox.innerHTML = S.tournaments.map(t => {
      const pr = D.prizesOf(t);
      const j = D.jalaliInfo(D.dateFrom(t[5]));
      const has = results[t[0]];
      return `<div class="mr-tour-card ${has?'done':''}" data-tour="${t[0]}">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <b>${esc(t[1])}</b>
          <span class="chip ${has?'green':'gold'}">${has?'ثبت شده ✓':'بدون نتیجه'}</span>
        </div>
        <div style="font-size:10.5px;color:var(--muted);margin-top:4px">${D.fa(j.dd)} ${j.monthFa} • سطح ${D.fa(t[2])} • ${esc(D.COURSE_NAME[t[3]]||'—')}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:3px">🏆${D.fa(pr[0])} 🥈${D.fa(pr[1])} 🥉${D.fa(pr[2])} 🎟${D.fa(pr[3])}</div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button class="btn sm" data-mrset="${t[0]}">🎯 ${has?'ویرایش نتایج':'ثبت نتایج'}</button>
          <button class="btn sm ghost" data-mrcard="${t[0]}" title="نمایش اسکورکارت مسابقه">📋 اسکورکارت</button>
          ${has ? `<button class="btn sm danger" data-mrdel="${t[0]}">🗑</button>` : ''}
        </div>
      </div>`;
    }).join('');
    $$('#mr-tours [data-mrset]').forEach(b => b.addEventListener('click', () => {
      const tour = +b.dataset.mrset;
      const t = S.tournaments.find(x => x[0] === tour);
      if (!t) return;
      openResultsModal({
        title: 'نتایج «' + t[1] + '»',
        prizes: D.prizesOf(t),
        players: activePlayersList(),
        participants: results[tour] ? results[tour].participants : [],
        top: results[tour] ? results[tour].top : {},
        onSave: (participants, top) => {
          const r = D.loadResults();
          r[tour] = { participants, top };
          D.saveResults(r); APP.reloadData(); APP.go('mgmt'); mgmtTab='results';
          APP.toast('نتایج «' + t[1] + '» ثبت شد — امتیازها خودکار محاسبه شد ✓', 'green');
        }
      });
    }));
    $$('#mr-tours [data-mrcard]').forEach(b => b.addEventListener('click', () => {
      const t = S.tournaments.find(x => x[0] === +b.dataset.mrcard);
      if (t) openScoreWizard(t);
    }));
    $$('#mr-tours [data-mrdel]').forEach(b => b.addEventListener('click', () => {
      const r = D.loadResults(); delete r[+b.dataset.mrdel]; D.saveResults(r); APP.reloadData(); APP.go('mgmt'); mgmtTab='results'; APP.toast('نتیجه حذف شد 🗑','orange');
    }));

    // ── ۲) کارت ضربات هر میدان: بزرگ + کیبورد (Enter → بعدی، ارقام فارسی) ──
    function toEN(str){ return String(str||'').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); }
    function drawHoles(){
      const t = S.tournaments.find(x => x[0] === +$('#mr-tour').value);
      if (!t) return;
      const n = t[4], pars = D.parsOf(t[3]);
      $('#mr-holes').innerHTML = Array.from({length:n}, (_,i) => `
        <div class="hole-box">
          <div class="hole-lbl">ح${D.fa(i+1)} <small style="color:var(--gold-l)">پ${D.fa(pars[i])}</small></div>
          <input class="input hole-inp" type="text" inputmode="numeric" autocomplete="off" data-i="${i}" style="width:64px;height:48px;font-size:20px;font-weight:800;text-align:center;direction:ltr" placeholder="—">
        </div>`).join('');
      const ins = $$('#mr-holes .hole-inp');
      ins.forEach(inp => {
        inp.addEventListener('input', () => {
          inp.value = toEN(inp.value).replace(/[^0-9]/g, '').slice(0,2);
        });
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter'){
            e.preventDefault();
            const next = ins[+inp.dataset.i + 1];
            if (next) next.focus(); else ins[0].focus();
          }
        });
      });
      if (ins[0]) ins[0].focus();
    }
    drawHoles();
    $('#mr-tour').addEventListener('change', drawHoles);
    $('#mr-add').addEventListener('click', () => {
      const tour = +$('#mr-tour').value, pid = +$('#mr-pl').value;
      const strokes = {};
      $$('#mr-holes .hole-inp').forEach(inp => {
        const v = +inp.value;
        if (v > 0 && v <= 30) strokes[+inp.dataset.i + 1] = v;
      });
      if (!Object.keys(strokes).length){ APP.toast('حداقل ضربات یک میدان را وارد کنید', 'red'); return; }
      const lst = extraCards();
      const i = lst.findIndex(c => c.tour === tour && c.pid === pid);
      const card = { tour, pid, strokes };
      if (i >= 0) lst[i] = card; else lst.push(card);
      saveCards(lst); APP.reloadData(); APP.go('mgmt'); mgmtTab='results';
      APP.toast('کارت ضربات ثبت شد ✓', 'green');
    });

    // ── ۳) نمایش نتایج ثبت‌شده ──
    renderSavedResults();
    function renderSavedResults(){
      const r = D.loadResults();
      const keys = Object.keys(r);
      $('#mr-list').innerHTML = keys.length ? keys.map(tid => {
        const t = S.tournaments.find(x => x[0] === +tid);
        if (!t) return '';
        const pr = D.prizesOf(t);
        const res = r[tid]; const top = res.top || {};
        const rows = (res.participants||[]).map(pid => {
          let place = 'شرکت‌کننده', pts = pr[3];
          if (top['1'] === pid){ place = '🥇 اول'; pts = pr[0]; }
          else if (top['2'] === pid){ place = '🥈 دوم'; pts = pr[1]; }
          else if (top['3'] === pid){ place = '🥉 سوم'; pts = pr[2]; }
          return `<div class="h-item"><span style="flex:1">${esc(D.nameOf(pid)||'—')}</span><span class="chip gold">${place}</span><span class="chip green">${D.fa(pts)} امتیاز</span></div>`;
        }).join('');
        return `<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>${esc(t[1])}</b><span class="chip green">ثبت شده</span><span style="font-size:10.5px;color:var(--muted)">${D.fa(res.participants.length)} شرکت‌کننده</span></div>
          <div style="margin-top:8px">${rows}</div>
        </div>`;
      }).join('') : '<div style="color:var(--muted);font-size:12.5px;padding:8px">هنوز نتیجه‌ای ثبت نشده است — از کادر بالا شروع کنید.</div>';
    }
  }

  /* ── تب تماس با ما (ویرایش اطلاعات تماس صفحهٔ اصلی) ── */
  function mgmtContact(body){
    const si = getSiteInfo();
    const c = si.contact;
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">📞</span><h3>اطلاعات ${esc(L('admin.contact','تماس با ما'))}</h3><span class="tag">نمایش در صفحهٔ اصلی</span></div>
      <div class="sub-note" style="font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.9">
        این اطلاعات در صفحهٔ اصلی (پنل «📞 ${esc(L('landing.contact','تماس با ما'))}») و ${esc(L('landing.reception','رسپشن'))} نمایش داده می‌شود — هر جا ویرایش کنید، همان‌جا به‌روز می‌شود.
      </div>
      <div class="field-grid" style="margin-top:12px">
        <div><label>📞 تلفن</label><input class="input" id="ct-phone" value="${esc(c.phone)}" style="width:100%;direction:ltr"></div>
        <div><label>✉️ ایمیل</label><input class="input" id="ct-email" value="${esc(c.email)}" style="width:100%;direction:ltr"></div>
        <div class="span2"><label>📍 آدرس</label><input class="input" id="ct-address" value="${esc(c.address)}" style="width:100%"></div>
        <div><label>🌐 وب‌سایت</label><input class="input" id="ct-website" value="${esc(c.website)}" style="width:100%;direction:ltr"></div>
        <div><label>📱 شبکه‌های اجتماعی</label><input class="input" id="ct-social" value="${esc(c.social)}" style="width:100%"></div>
        <div><label>⏰ ساعت پاسخ‌گویی</label><input class="input" id="ct-hours" value="${esc(c.hours)}" style="width:100%"></div>
        <div><label>🔗 لینک QR (آدرس صفحهٔ تماس)</label><input class="input" id="ct-qr" value="${esc(c.qr)}" style="width:100%;direction:ltr"></div>
      </div>
      <button class="btn sm" id="ct-save" style="margin-top:16px">💾 ذخیرهٔ اطلاعات تماس</button>
    </div>`;
    $('#ct-save').addEventListener('click', () => {
      const si = getSiteInfo();
      si.contact = {
        phone: $('#ct-phone').value.trim(), email: $('#ct-email').value.trim(),
        address: $('#ct-address').value.trim(), website: $('#ct-website').value.trim(),
        social: $('#ct-social').value.trim(), hours: $('#ct-hours').value.trim(), qr: $('#ct-qr').value.trim() || SITE_DEFAULTS.contact.qr,
      };
      saveSiteInfo(si);
      APP.toast('اطلاعات تماس ذخیره شد — از این به بعد در صفحهٔ اصلی خوانده می‌شود ✓', 'green');
    });
  }

  /* ── تب اطلاعات (معرفی آکادمی صفحهٔ اصلی) ── */
  function mgmtInfo(body){
    const si = getSiteInfo();
    const i = si.info;
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">ℹ️</span><h3>${esc(L('admin.info','اطلاعات'))} و معرفی آکادمی</h3><span class="tag">نمایش در صفحهٔ اصلی</span></div>
      <div class="sub-note" style="font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.9">
        متن معرفی و مشخصات در پنل «ℹ️ ${esc(L('landing.info','اطلاعات'))}» صفحهٔ اصلی نمایش داده می‌شود — بعد از ذخیره، همان لحظه به‌روز می‌شود.
      </div>
      <div style="margin-top:12px">
        <label>📝 متن معرفی آکادمی</label>
        <textarea class="input" id="in-intro" rows="6" style="width:100%;margin-top:6px;resize:vertical;line-height:1.9">${esc(i.intro)}</textarea>
      </div>
      <div class="field-grid" style="margin-top:12px">
        <div><label>📍 آدرس</label><input class="input" id="in-address" value="${esc(i.address)}" style="width:100%"></div>
        <div><label>⏰ ساعات کاری</label><input class="input" id="in-hours" value="${esc(i.hours)}" style="width:100%"></div>
      </div>
      <button class="btn sm" id="in-save" style="margin-top:16px">💾 ذخیرهٔ اطلاعات</button>
    </div>`;
    $('#in-save').addEventListener('click', () => {
      const si = getSiteInfo();
      si.info = {
        intro: $('#in-intro').value.trim(), address: $('#in-address').value.trim(), hours: $('#in-hours').value.trim(),
      };
      saveSiteInfo(si);
      APP.toast('اطلاعات آکادمی ذخیره شد — صفحهٔ اصلی به‌روز شد ✓', 'green');
    });
  }

  /* ── صفحهٔ مستقل یوزها (فقط مدیر اصلی) ── */
  function pageUsers(){
    const v = $('#view');
    v.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:18px">
      <div class="card-head"><span class="ic">🔐</span><h3>${esc(L('nav.users','یوزرها'))} — مدیریت دسترسی‌ها</h3><span class="tag">Admin PRO</span>
        <button class="btn sm ghost" id="us-back" style="margin-right:auto">← ${esc(L('nav.mgmt','پنل مدیریت'))}</button>
      </div>
    </div>
    <div id="mgmt-body"></div>`;
    const back = v.querySelector('#us-back');
    if (back) back.addEventListener('click', () => { window.APP.go('mgmt'); mgmtTab = 'players'; });
    mgmtUsers($('#mgmt-body'));
  }

  /* ── تب یوزها (فقط مدیر اصلی) ── */
  function mgmtUsers(body){
    const U = (window.APP && window.APP.users) ? window.APP.users : null;
    if (!U || !U.isMain(window.APP.currentUser())){
      body.innerHTML = `
      <div class="glass" style="padding:34px;text-align:center;color:var(--muted)">
        🔐 مدیریت ${esc(L('nav.users','یوزرها'))} فقط در اختیار <b style="color:var(--gold-l)">مدیر اصلی آکادمی</b> است.<br>
        <span style="font-size:11.5px">برای دسترسی، با یوزر اصلی (admin) وارد شوید.</span>
      </div>`;
      return;
    }
    let users = U.list();
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">🔐</span><h3>${esc(L('admin.users','یوزرها'))} — دسترسی‌ها</h3><span class="tag">فقط مدیر اصلی</span></div>
      <div class="sub-note" style="font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.9">
        دو سطح دسترسی: <b style="color:var(--gold-l)">مدیر</b> (دسترسی کامل به پلن مدیریت و همهٔ بخش‌ها) و
        <b style="color:var(--green-l)">عضو</b> (فقط بخش ویژهٔ اعضا — بدون هیچ ابزار ویرایشی).<br>
        فعال/غیرفعال کردن، تغییر نقش و رمز هر یوزر همین‌جاست — غیرفعال‌ها نمی‌توانند وارد شوند.
      </div>
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
        <button class="btn sm" id="us-add">➕ یوزر جدید</button>
        <button class="btn sm ghost" id="us-sync">👥 ساخت یوزر برای همهٔ اعضا (همگام‌سازی)</button>
        <span style="color:var(--muted);font-size:11.5px;align-self:center">${D.fa(users.length)} یوزر ثبت شده</span>
      </div>
    </div>
    <div class="glass">
      <div class="card-head"><span class="ic">👤</span><h3>لیست ${esc(L('nav.users','یوزرها'))}</h3><span class="tag">مدیر / عضو</span></div>
      <div style="overflow-x:auto"><table class="tbl"><thead><tr>
        <th>#</th><th>نام</th><th>یوزر</th><th>رمز</th><th>نقش / دسترسی</th><th>وضعیت</th><th>عملیات</th>
      </tr></thead><tbody id="us-rows"></tbody></table></div>
    </div>
    <div id="us-modal"></div>`;
    function render(){
      const rows = U.list();
      $('#us-rows').innerHTML = rows.map(u => `
        <tr class="${u.active ? '' : 'off-row'}">
          <td class="num">${D.fa(u.id)}</td>
          <td><b>${esc(u.name || u.user)}</b> ${u.main ? '<span class="chip gold">مدیر اصلی</span>' : ''}</td>
          <td style="direction:ltr" class="num">${esc(u.user)}</td>
          <td><code style="direction:ltr;background:rgba(255,255,255,.06);padding:3px 8px;border-radius:8px;font-size:12px">${esc(u.pass)}</code></td>
          <td>
            ${u.main ? '<span class="chip gold">مدیر (ثابت)</span>' : `
            <select class="sel us-role" data-id="${u.id}" style="padding:4px 8px;font-size:11.5px">
              <option value="admin" ${u.role==='admin'?'selected':''}>👑 مدیر</option>
              <option value="member" ${u.role==='member'?'selected':''}>👤 عضو</option>
            </select>`}
          </td>
          <td>${u.main ? '<span class="chip green">فعال</span>' : `
            <label class="switch"><input type="checkbox" class="us-act" data-id="${u.id}" ${u.active?'checked':''}><span class="trk"></span></label>`}</td>
          <td><div class="row-actions">
            <button class="btn sm ghost" data-pw="${u.id}" ${u.main?'disabled':''}>🔑 یوزر و رمز</button>
            ${u.main ? '' : `<button class="btn sm danger" data-del="${u.id}">🗑</button>`}
          </div></td>
        </tr>`).join('');
      // رویدادها
      $$('#us-rows .us-role').forEach(sel => sel.addEventListener('change', () => {
        const id = +sel.dataset.id, role = sel.value;
        const a = U.list(); const u = a.find(x => x.id === id);
        if (!u || u.main) return;
        if (u.user === window.APP.currentUser()){ APP.toast('نمی‌توانید دسترسی یوزرِ واردشده را تغییر دهید', 'red'); return; }
        u.role = role;
        U.save(a);
        APP.toast('دسترسی «' + u.name + '» به «' + (role === 'admin' ? 'مدیر' : 'عضو') + '» تغییر کرد ✓', 'green');
      }));
      $$('#us-rows .us-act').forEach(ch => ch.addEventListener('change', () => {
        const id = +ch.dataset.id;
        const a = U.list(); const u = a.find(x => x.id === id);
        if (!u || u.main) return;
        if (u.user === window.APP.currentUser()){ APP.toast('نمی‌توانید یوزر واردشده را غیرفعال کنید', 'red'); ch.checked = true; return; }
        u.active = ch.checked;
        U.save(a);
        syncUserToPlayer(u);
        APP.toast((u.active ? 'یوزر «' + u.name + '» فعال شد ✓' : 'یوزر «' + u.name + '» غیرفعال شد ⛔ — دیگر نمی‌تواند وارد شود'), u.active ? 'green' : 'orange');
      }));
      $$('#us-rows [data-pw]').forEach(b => b.addEventListener('click', () => pwModal(+b.dataset.pw)));
      $$('#us-rows [data-del]').forEach(b => b.addEventListener('click', () => {
        const id = +b.dataset.del;
        const a = U.list(); const u = a.find(x => x.id === id);
        if (!u || u.main) return;
        if (!confirm('یوزر «' + u.name + '» حذف شود؟')) return;
        U.save(a.filter(x => x.id !== id));
        if (u.pid){ const pu = playerUsers(); delete pu[u.pid]; savePlayerUsers(pu); }
        render();
        APP.toast('یوزر «' + u.name + '» حذف شد 🗑', 'orange');
      }));
    }
    function pwModal(id){
      const a = U.list(); const u = a.find(x => x.id === id);
      if (!u || u.main) return;
      let m = $('#modal-edit');
      if (!m){
        m = document.createElement('div');
        m.id = 'modal-edit';
        m.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(4,8,14,.72);backdrop-filter:blur(6px)';
        document.body.appendChild(m);
      }
      m.innerHTML = `
      <div class="glass gold-border" style="width:min(440px,94vw);padding:22px">
        <div class="card-head"><span class="ic">🔑</span><h3>یوزر و رمز — ${esc(u.name)}</h3><span class="tag">${u.pid ? 'عضو بازیکن' : 'یوزر'}</span></div>
        <div class="field-grid" style="margin-top:12px">
          <div class="span2"><label>نام نمایشی</label><input class="input" id="pw-name" value="${esc(u.name || '')}" style="width:100%"></div>
          <div><label>نام کاربری (login)</label><input class="input" id="pw-user" value="${esc(u.user)}" style="width:100%;direction:ltr"></div>
          <div><label>رمز عبور</label>
            <div style="display:flex;gap:8px;margin-top:5px">
              <input class="input" id="pw-val" value="${esc(u.pass)}" style="flex:1;direction:ltr">
              <button class="btn sm ghost" id="pw-gen">⚡</button>
            </div>
          </div>
        </div>
        <div style="font-size:10.5px;color:var(--muted);margin-top:8px">
          ${u.pid ? '🔁 این یوزر به بازیکن شمارهٔ ' + D.fa(u.pid) + ' وصل است — تغییر یوزر/رمز همین‌جا، در فرم «بازیکنان» هم اعمال می‌شود و برعکس.' : 'این یوزر به بازیکنی وصل نیست.'}
        </div>
        <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end">
          <button class="btn sm ghost" id="pw-cancel">بستن</button>
          <button class="btn sm" id="pw-save">💾 ذخیره</button>
        </div>
      </div>`;
      m.style.display = 'flex';
      $('#pw-cancel').addEventListener('click', () => m.style.display = 'none');
      $('#pw-gen').addEventListener('click', () => {
        const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
        let pw = '';
        for (let i=0;i<8;i++) pw += chars[Math.floor(Math.random()*chars.length)];
        $('#pw-val').value = pw;
      });
      $('#pw-save').addEventListener('click', () => {
        const pw = $('#pw-val').value.trim();
        const un = $('#pw-user').value.trim().toLowerCase();
        const nm = $('#pw-name').value.trim();
        if (!pw || !un){ APP.toast('یوزر و رمز نمی‌تواند خالی باشد', 'red'); return; }
        const a2 = U.list();
        if (a2.some(x => x.id !== id && String(x.user).toLowerCase() === un)){ APP.toast('این نام کاربری قبلاً ثبت شده است', 'red'); return; }
        const t = a2.find(x => x.id === id);
        if (t){
          t.pass = pw; t.user = un; if (nm) t.name = nm;
          U.save(a2);
          syncUserToPlayer(t);              // ⇄ برگشت به فرم بازیکن
        }
        m.style.display = 'none';
        render();
        APP.toast('یوزر و رمز «' + (t ? t.name : '') + '» ذخیره شد ✓ — در بخش بازیکنان هم به‌روز شد', 'green');
      });
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
    }
    $('#us-add').addEventListener('click', () => {
      let m = $('#modal-edit');
      if (!m){
        m = document.createElement('div');
        m.id = 'modal-edit';
        m.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(4,8,14,.72);backdrop-filter:blur(6px)';
        document.body.appendChild(m);
      }
      m.innerHTML = `
      <div class="glass gold-border" style="width:min(440px,94vw);padding:22px">
        <div class="card-head"><span class="ic">➕</span><h3>یوزر جدید</h3><span class="tag">دسترسی جدید</span></div>
        <div class="field-grid" style="margin-top:12px">
          <div class="span2"><label>نام</label><input class="input" id="nu-name" style="width:100%" placeholder="مثلاً: علی محمدی"></div>
          <div><label>نام کاربری</label><input class="input" id="nu-user" style="width:100%;direction:ltr" placeholder="username"></div>
          <div><label>رمز عبور</label>
            <div style="display:flex;gap:8px;margin-top:5px"><input class="input" id="nu-pass" value="golf1405" style="flex:1;direction:ltr"><button class="btn sm ghost" id="nu-gen">⚡</button></div>
          </div>
          <div class="span2"><label>نقش / سطح دسترسی</label>
            <select class="sel" id="nu-role" style="width:100%">
              <option value="member" selected>👤 عضو — فقط بخش ویژهٔ اعضا (بدون مدیریت)</option>
              <option value="admin">👑 مدیر — دسترسی کامل مدیریت</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end">
          <button class="btn sm ghost" id="nu-cancel">بستن</button>
          <button class="btn sm" id="nu-save">💾 ساخت یوزر</button>
        </div>
      </div>`;
      m.style.display = 'flex';
      $('#nu-cancel').addEventListener('click', () => m.style.display = 'none');
      $('#nu-gen').addEventListener('click', () => {
        const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
        let pw = '';
        for (let i=0;i<8;i++) pw += chars[Math.floor(Math.random()*chars.length)];
        $('#nu-pass').value = pw;
      });
      $('#nu-save').addEventListener('click', () => {
        const name = $('#nu-name').value.trim();
        const user = $('#nu-user').value.trim().toLowerCase();
        const pass = $('#nu-pass').value.trim();
        if (!name || !user || !pass){ APP.toast('نام، یوزر و رمز را کامل کنید', 'red'); return; }
        const a = U.list();
        if (a.some(x => String(x.user).toLowerCase() === user)){ APP.toast('این نام کاربری قبلاً ثبت شده است', 'red'); return; }
        const id = Math.max(0, ...a.map(x => x.id)) + 1;
        a.push({ id, user, pass, name, role: $('#nu-role').value, active: true });
        U.save(a);
        m.style.display = 'none';
        render();
        APP.toast('یوزر «' + name + '» ساخته شد — یوزر: ' + user + ' / رمز: ' + pass, 'green');
      });
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
    });
    $('#us-sync').addEventListener('click', () => {
      const a = U.list();
      let added = 0;
      try {
        const S = gstate().S;
        const pu = playerUsers();
        S.players.forEach(p => {
          const exists = a.some(x => +x.pid === +p[0]);
          if (!exists){
            const id = Math.max(0, ...a.map(x => x.id)) + 1;
            const cr = pu[p[0]] || {};
            a.push({ id, user: cr.user || ('p' + p[0]), pass: cr.pass || 'golf1405', name: p[1],
                     role: 'member', active: cr.active !== false, pid: p[0] });
            added++;
          }
        });
      } catch(e){}
      U.save(a);
      render();
      APP.toast(added ? added + ' یوزر عضو ساخته شد — رمز پیش‌فرض: golf1405' : 'همهٔ اعضا قبلاً یوزر داشتند ✓', added ? 'green' : 'gold');
    });
    render();
  }

  /* ═══════════════ تب: درخواست‌های سکه (تأیید مدیر) ═══════════════ */
  function memberUsers(){
    const U = (window.APP && window.APP.users) ? window.APP.users : null;
    if (!U) return [];
    return U.list().filter(u => u.role === 'member');
  }
  function faDateStr(d){ return String(d || ''); }
  function mgmtCoins(body){
    const pend = AV.pendingReqs();
    const hist = AV.reqs().filter(r => r.status !== 'pending').sort((a,b) => b.ts - a.ts).slice(0, 40);
    const mem = memberUsers();
    const wallets = mem.map(u => ({ u, c: AV.coinOf(u.user) })).sort((a,b) => b.c.total - a.c.total);
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">⏳</span><h3>درخواست‌های در انتظار تأیید</h3><span class="tag">${D.fa(pend.length)} درخواست</span></div>
      <div class="sub-note" style="font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.9">
        هر عضو در «${esc(L('nav.memberzone','بخش اعضا'))} ← ${esc(L('member.earn','دریافت سکه'))}» درخواست می‌فرستد؛ سکه فقط بعد از تأیید شما به کیف‌پول او اضافه می‌شود. مقدار سکه را هم می‌توانید قبل از تأیید تغییر دهید.
      </div>
      <div style="margin-top:12px">
        ${pend.length ? pend.map(r => `
          <div class="req-row" data-rid="${r.id}">
            <span style="flex:1;min-width:180px;font-size:12.5px">
              <b class="gold-text">${esc(r.name || r.user)}</b> — ${esc(r.title)}
              ${r.note ? `<div style="font-size:11px;color:var(--muted);margin-top:3px">📝 ${esc(r.note)}</div>` : ''}
              <div style="font-size:10.5px;color:var(--muted);margin-top:2px">یوزر: ${esc(r.user)} • ${esc(faDateStr(r.date))}</div>
            </span>
            <input class="input" type="number" data-amt="${r.id}" value="${+r.amount || 0}" style="width:82px;text-align:center;direction:ltr" title="مقدار سکه">
            <input class="input" data-note="${r.id}" placeholder="یادداشت مدیر (اختیاری)" style="width:190px;font-size:11.5px">
            <button class="btn sm" data-ok="${r.id}">✅ تأیید و پرداخت</button>
            <button class="btn sm ghost" data-no="${r.id}">⛔ رد</button>
          </div>`).join('') : `<div style="color:var(--muted);font-size:12.5px;padding:10px">درخواست بازی در انتظار نیست ✓</div>`}
      </div>
    </div>

    <div class="glass" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">🎁</span><h3>پرداخت مستقیم سکه به عضو</h3><span class="tag">بدون درخواست</span></div>
      <div class="field-grid" style="margin-top:10px">
        <div><label>عضو</label>
          <select class="sel" id="cg-user" style="width:100%">${mem.map(u => `<option value="${esc(u.user)}">${esc(u.name || u.user)} (${esc(u.user)})</option>`).join('')}</select></div>
        <div><label>مقدار سکه</label><input class="input" id="cg-amt" type="number" value="10" style="width:100%;direction:ltr"></div>
        <div class="span2"><label>بابت</label><input class="input" id="cg-note" placeholder="مثلاً: جایزهٔ ویژهٔ مربی" style="width:100%"></div>
      </div>
      <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:12px">
        <button class="btn sm" id="cg-add">＋ افزودن سکه</button>
        <button class="btn sm ghost" id="cg-sub">− کسر سکه</button>
      </div>
    </div>

    <div class="glass" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">👛</span><h3>کیف‌پول اعضا</h3><span class="tag">${D.fa(wallets.length)} عضو</span></div>
      <div style="overflow-x:auto"><table class="tbl"><thead><tr>
        <th>عضو</th><th>یوزر</th><th>موجودی کل</th><th>🏆 قهرمانی (خودکار)</th><th>ثبت‌شده</th><th>تراکنش‌ها</th><th>عملیات</th>
      </tr></thead><tbody>
        ${wallets.map(w => `<tr data-wu="${esc(w.u.user)}">
          <td>${esc(w.u.name || w.u.user)}</td><td style="direction:ltr">${esc(w.u.user)}</td>
          <td><b class="gold-text">${D.fa(w.c.total)} 🪙</b></td>
          <td class="w-auto">${w.c.auto ? '<span class="chip green">+' + D.fa(w.c.auto) + ' 🪙</span>' : '<span style="color:var(--muted)">—</span>'}</td>
          <td>${D.fa(w.c.base || 0)}</td>
          <td>${D.fa((w.c.log || []).length)}</td>
          <td><button class="btn sm ghost" data-zero="${esc(w.u.user)}" style="font-size:11px">صفر کردن</button></td>
        </tr>`).join('')}
      </tbody></table></div>
      <div class="golfrule" style="margin-top:10px;line-height:2;font-size:11.5px">
        🏆 ستون «قهرمانی (خودکار)» از روی <b>نتایج فعلی مسابقات</b> محاسبه می‌شود و ذخیره نمی‌شود؛
        اگر مسابقه‌ای حذف شود یا قهرمانش عوض شود، همین‌جا و در کیف‌پول عضو هم <b>کم/زیاد</b> می‌شود.
        (قهرمان سطح ۱ = ۲۰ سکه • سطح ۲ = ۱۵ • سطح ۳ = ۱۰) — دکمهٔ «صفر کردن» فقط سکه‌های ثبت‌شده را صفر می‌کند.
      </div>
    </div>

    <div class="glass">
      <div class="card-head"><span class="ic">📚</span><h3>تاریخچهٔ درخواست‌ها</h3><span class="tag">${D.fa(hist.length)} مورد</span>
        <button class="btn sm ghost" id="cr-clear" style="margin-right:auto">🧹 پاک‌کردن تاریخچه</button>
      </div>
      <div style="margin-top:10px">
        ${hist.length ? hist.map(r => `
          <div class="req-row">
            <span style="flex:1;min-width:170px;font-size:12.5px">${esc(r.name || r.user)} — ${esc(r.title)}</span>
            <span class="chip gold">${D.fa(r.amount)} 🪙</span>
            <span class="${r.status === 'ok' ? 'st-ok' : 'st-no'}" style="font-size:11.5px">${r.status === 'ok' ? '✅ تأیید' : '⛔ رد'}</span>
            ${r.adminNote ? `<span style="font-size:11px;color:var(--muted)">${esc(r.adminNote)}</span>` : ''}
            <button class="btn sm ghost" data-del="${r.id}" style="font-size:11px">حذف</button>
          </div>`).join('') : `<div style="color:var(--muted);font-size:12.5px;padding:8px">تاریخچه‌ای نیست.</div>`}
      </div>
    </div>`;

    $$('[data-ok]', body).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.ok;
      const amt = body.querySelector(`[data-amt="${id}"]`);
      const nt = body.querySelector(`[data-note="${id}"]`);
      AV.decideReq(id, true, window.APP.currentUser(), nt ? nt.value.trim() : '', amt ? amt.value : null);
      APP.toast('درخواست تأیید و سکه پرداخت شد ✓', 'green');
      renderMgmtTab();
    }));
    $$('[data-no]', body).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.no;
      const nt = body.querySelector(`[data-note="${id}"]`);
      AV.decideReq(id, false, window.APP.currentUser(), nt ? nt.value.trim() : '');
      APP.toast('درخواست رد شد — عضو می‌تواند دوباره درخواست دهد', 'orange');
      renderMgmtTab();
    }));
    $$('[data-del]', body).forEach(b => b.addEventListener('click', () => { AV.deleteReq(b.dataset.del); renderMgmtTab(); }));
    $$('[data-zero]', body).forEach(b => b.addEventListener('click', () => {
      const u = b.dataset.zero;
      if (!confirm('موجودی سکهٔ «' + u + '» صفر شود؟')) return;
      const d = AV.coinData();
      d[u] = { total: 0, log: [] };
      try { localStorage.setItem('ga_coins', JSON.stringify(d)); } catch(e){}
      APP.toast('کیف‌پول صفر شد', 'orange');
      renderMgmtTab();
    }));
    const cl = $('#cr-clear', body);
    if (cl) cl.addEventListener('click', () => { AV.clearDecided(); renderMgmtTab(); });
    const add = $('#cg-add', body), sub = $('#cg-sub', body);
    function grant(sign){
      const u = $('#cg-user', body) ? $('#cg-user', body).value : '';
      const amt = Math.abs(+($('#cg-amt', body).value || 0));
      const note = $('#cg-note', body).value.trim() || 'پرداخت مدیریت';
      if (!u || !amt){ APP.toast('عضو و مقدار سکه را مشخص کنید', 'red'); return; }
      if (sign > 0){ AV.addCoins(u, amt, 'admin', note); APP.toast('+' + D.fa(amt) + ' سکه به ' + u + ' اضافه شد ✓', 'green'); }
      else {
        const res = AV.spendCoins(u, amt, 'admin', note);
        if (res === null){ APP.toast('موجودی این عضو کافی نیست', 'red'); return; }
        APP.toast('−' + D.fa(amt) + ' سکه از ' + u + ' کسر شد', 'orange');
      }
      renderMgmtTab();
    }
    if (add) add.addEventListener('click', () => grant(1));
    if (sub) sub.addEventListener('click', () => grant(-1));
  }

  /* ═══════════════ تب: Avatar Rank Appearance (Honor Rank) ═══════════════ */
  let honorLv = 1;
  function mgmtHonor(body){
    const rs = AV.ranks();
    const r = rs[honorLv - 1];
    const mem = memberUsers();
    const ov = AV.honorStore();
    const prevHonor = { lv: r.lv, rank: r, pts: r.pts, next: rs[r.lv] || null, prog: 60 };
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">🏅</span><h3>Avatar Rank Appearance — ظاهر آواتار بر اساس رنک</h3><span class="tag">Data Driven</span>
        <button class="btn sm ghost" id="hr-reset" style="margin-right:auto">↺ بازگشت به پیش‌فرض</button>
      </div>
      <div class="sub-note" style="font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.9">
        هیچ رنگ، نشان یا افکتی در کد ثابت نیست — همه‌چیز از همین‌جا ذخیره و روی آواتار همهٔ اعضا اعمال می‌شود.
        (Level 1-3 نقره‌ای • 4-6 طلایی • 7-9 زمردی • 10-12 سلطنتی • 13-15 جاودان)
      </div>
      <div class="rank-grid" style="margin-top:12px">
        ${rs.map(x => `<div class="rank-chip ${x.lv === honorLv ? 'on' : ''}" data-hlv="${x.lv}">
          <div style="display:flex;justify-content:center">${AV.badgeSVG(x, 26)}</div>
          <div style="color:${x.title};margin-top:4px">Lv ${D.fa(x.lv)}</div>
          <div style="font-size:9.5px;color:var(--muted)">${esc(x.en)}</div>
        </div>`).join('')}
      </div>
    </div>

    <div class="grid cols-3" style="margin-bottom:16px">
      <div class="glass" style="text-align:center">
        <div class="card-head"><span class="ic">👁️</span><h3>پیش‌نمایش زنده</h3><span class="tag">Level ${D.fa(r.lv)}</span></div>
        <div id="hr-prevwrap" style="margin-top:12px;display:flex;justify-content:center">
          ${AV.rankCard({ user:'preview', name:'Babak', sel: AV.DEFAULT_SEL('m'), gender:'m', honor: prevHonor, size:'md', id:'hr-prev' })}
        </div>
        <button class="btn sm" id="hr-testup" style="margin-top:12px">🎬 تست انیمیشن ارتقاء</button>
      </div>
      <div class="glass" style="grid-column:span 2">
        <div class="card-head"><span class="ic">✏️</span><h3>ویرایش رنک: ${esc(r.en)}</h3><span class="tag">${esc(r.divEn)}</span></div>
        <div class="field-grid" style="margin-top:10px">
          <div><label>عنوان انگلیسی</label><input class="input" data-hf="en" value="${esc(r.en)}" style="width:100%;direction:ltr"></div>
          <div><label>عنوان فارسی</label><input class="input" data-hf="fa" value="${esc(r.fa)}" style="width:100%"></div>
          <div><label>حداقل امتیاز فصل</label><input class="input" type="number" data-hf="pts" value="${+r.pts}" style="width:100%;direction:ltr"></div>
          <div><label>نشان (ایموجی/حرف)</label><input class="input" data-hf="badge" value="${/^(data:|https?:)/.test(r.badge) ? '' : esc(r.badge)}" placeholder="مثلاً 👑" style="width:100%"></div>
        </div>
        <div class="form-section" style="margin-top:14px">🎨 رنگ پس‌زمینه، گرادینت و نور</div>
        <div class="field-grid" style="margin-top:8px">
          <div><label>گرادینت ۱ (تیره)</label><input class="input" type="color" data-hf="bg1" value="${esc(r.bg1)}" style="width:100%;height:38px;padding:3px"></div>
          <div><label>گرادینت ۲ (میانی)</label><input class="input" type="color" data-hf="bg2" value="${esc(r.bg2)}" style="width:100%;height:38px;padding:3px"></div>
          <div><label>گرادینت ۳ (روشن)</label><input class="input" type="color" data-hf="bg3" value="${esc(r.bg3)}" style="width:100%;height:38px;padding:3px"></div>
          <div><label>Glow / هاله</label><input class="input" type="color" data-hf="glow" value="${esc(r.glow)}" style="width:100%;height:38px;padding:3px"></div>
          <div><label>رنگ نور</label><input class="input" type="color" data-hf="light" value="${esc(r.light)}" style="width:100%;height:38px;padding:3px"></div>
          <div><label>حاشیهٔ کارت</label><input class="input" type="color" data-hf="border" value="${esc(r.border)}" style="width:100%;height:38px;padding:3px"></div>
          <div><label>رنگ متن عنوان</label><input class="input" type="color" data-hf="title" value="${esc(r.title)}" style="width:100%;height:38px;padding:3px"></div>
        </div>
        <div class="form-section" style="margin-top:14px">🎖️ نشان روی سینه</div>
        <div class="field-grid" style="margin-top:8px">
          <div><label>اندازهٔ نشان: <b id="hr-bs-v">${D.fa(r.badgeSize)}</b> px</label>
            <input type="range" min="16" max="70" value="${+r.badgeSize}" data-hf="badgeSize" style="width:100%"></div>
          <div><label>موقعیت افقی (٪): <b id="hr-bx-v">${D.fa(r.badgeX)}</b></label>
            <input type="range" min="5" max="95" value="${+r.badgeX}" data-hf="badgeX" style="width:100%"></div>
          <div><label>موقعیت عمودی (٪): <b id="hr-by-v">${D.fa(r.badgeY)}</b></label>
            <input type="range" min="5" max="95" value="${+r.badgeY}" data-hf="badgeY" style="width:100%"></div>
          <div><label>تصویر نشان (اختیاری)</label><input class="input" type="file" id="hr-img" accept="image/*" style="width:100%;font-size:11px"></div>
        </div>
        <div class="form-section" style="margin-top:14px">✨ افکت‌ها</div>
        <div class="field-grid" style="margin-top:8px">
          <div><label>افکت ذرات</label><select class="sel" data-hf="particle" style="width:100%">
            ${AV.PARTICLES.map(([id, n]) => `<option value="${id}" ${r.particle === id ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          <div><label>افکت ارتقاء</label><select class="sel" data-hf="up" style="width:100%">
            ${AV.UPFX.map(([id, n]) => `<option value="${id}" ${r.up === id ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        </div>
        <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:14px">
          <button class="btn sm" id="hr-save">💾 ذخیرهٔ این رنک</button>
          <button class="btn sm ghost" id="hr-clear">↺ پیش‌فرض این رنک</button>
        </div>
      </div>
    </div>

    <div class="glass">
      <div class="card-head"><span class="ic">👥</span><h3>رنک اعضا</h3><span class="tag">خودکار از امتیاز فصل یا دستی</span></div>
      <div style="overflow-x:auto"><table class="tbl"><thead><tr>
        <th>عضو</th><th>امتیاز فصل</th><th>رنک فعلی</th><th>حالت</th><th>تعیین دستی</th>
      </tr></thead><tbody>
        ${mem.map(u => {
          const pts = ptsOfPid(u.pid);
          const hn = AV.honorOf(u.user, pts);
          return `<tr>
            <td>${esc(u.name || u.user)} <span style="color:var(--muted);font-size:11px;direction:ltr">(${esc(u.user)})</span></td>
            <td>${D.fa(Math.round(pts))}</td>
            <td><span style="color:${hn.rank.title};font-weight:800">${esc(hn.rank.en)}</span> <span style="font-size:11px;color:var(--muted)">${esc(hn.rank.fa)}</span></td>
            <td>${hn.manual ? '<span class="chip gold">دستی</span>' : '<span class="chip dim">خودکار</span>'}</td>
            <td><select class="sel" data-hset="${esc(u.user)}" style="min-width:130px">
              <option value="">خودکار (امتیاز)</option>
              ${AV.ranks().map(x => `<option value="${x.lv}" ${(ov[String(u.user||'').toLowerCase()] && +ov[String(u.user||'').toLowerCase()].lv === x.lv) ? 'selected' : ''}>Lv ${x.lv} — ${x.en}</option>`).join('')}
            </select></td>
          </tr>`;
        }).join('')}
      </tbody></table></div>
    </div>`;

    $$('[data-hlv]', body).forEach(el => el.addEventListener('click', () => { honorLv = +el.dataset.hlv; renderMgmtTab(); }));
    function collect(){
      const o = {};
      $$('[data-hf]', body).forEach(el => {
        const k = el.dataset.hf;
        o[k] = (el.type === 'number' || el.type === 'range') ? +el.value : el.value;
      });
      if (!o.badge){ const cur = AV.rankOf(honorLv); o.badge = /^(data:|https?:)/.test(cur.badge) ? cur.badge : (AV.RANK_BASE[honorLv-1].badge); }
      return o;
    }
    function refreshPreview(){
      const o = collect();
      AV.saveRank(honorLv, o);
      const rr = AV.rankOf(honorLv);
      const wrap = $('#hr-prevwrap', body);
      if (wrap) wrap.innerHTML = AV.rankCard({ user:'preview', name:'Babak', sel: AV.DEFAULT_SEL('m'), gender:'m',
        honor: { lv: rr.lv, rank: rr, pts: rr.pts, next: AV.ranks()[rr.lv] || null, prog: 60 }, size:'md', id:'hr-prev' });
      const bs = $('#hr-bs-v', body), bx = $('#hr-bx-v', body), by = $('#hr-by-v', body);
      if (bs) bs.textContent = D.fa(rr.badgeSize);
      if (bx) bx.textContent = D.fa(rr.badgeX);
      if (by) by.textContent = D.fa(rr.badgeY);
    }
    $$('[data-hf]', body).forEach(el => {
      el.addEventListener('input', refreshPreview);
      el.addEventListener('change', refreshPreview);
    });
    const img = $('#hr-img', body);
    if (img) img.addEventListener('change', () => {
      const f = img.files && img.files[0];
      if (!f) return;
      if (f.size > 900*1024){ APP.toast('حجم تصویر نشان زیاد است (حداکثر ۹۰۰KB)', 'red'); return; }
      const rd = new FileReader();
      rd.onload = () => { AV.saveRank(honorLv, { badge: rd.result }); APP.toast('تصویر نشان ذخیره شد ✓', 'green'); renderMgmtTab(); };
      rd.readAsDataURL(f);
    });
    const sv = $('#hr-save', body);
    if (sv) sv.addEventListener('click', () => { refreshPreview(); APP.toast('ظاهر رنک «' + AV.rankOf(honorLv).en + '» ذخیره شد ✓', 'green'); renderMgmtTab(); });
    const cle = $('#hr-clear', body);
    if (cle) cle.addEventListener('click', () => {
      const st = JSON.parse(localStorage.getItem('ga_rank_skin') || '{}');
      delete st[String(honorLv)];
      localStorage.setItem('ga_rank_skin', JSON.stringify(st));
      APP.toast('این رنک به حالت پیش‌فرض برگشت', 'orange');
      renderMgmtTab();
    });
    const rst = $('#hr-reset', body);
    if (rst) rst.addEventListener('click', () => {
      if (!confirm('ظاهر همهٔ ۱۵ رنک به پیش‌فرض برگردد؟')) return;
      AV.resetRanks(); APP.toast('همهٔ رنک‌ها بازنشانی شدند', 'orange'); renderMgmtTab();
    });
    const tu = $('#hr-testup', body);
    if (tu) tu.addEventListener('click', () => AV.playRankUp($('#hr-prev', body), Math.max(1, honorLv - 1), honorLv));
    $$('[data-hset]', body).forEach(sel => sel.addEventListener('change', () => {
      AV.setHonorOverride(sel.dataset.hset, sel.value === '' ? null : +sel.value);
      APP.toast('رنک عضو به‌روز شد ✓', 'green');
      renderMgmtTab();
    }));
  }
  function ptsOfPid(pid){
    const { A } = gstate();
    if (!pid || !A || !A.LB) return 0;
    const row = A.LB.find(r => r.pid === pid);
    return row ? row.pts : 0;
  }

  /* ═══════════════ تب: فروشگاه آواتار (افزودن/ویرایش/حذف آیتم) ═══════════════ */
  let shopEditCat = 'shirt';
  function mgmtShop(body){
    const items = AV.shopAll().filter(i => i.cat === shopEditCat);
    const brands = Object.keys(AV.BRANDS);
    body.innerHTML = `
    <div class="glass gold-border" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">🛍️</span><h3>${esc(L('shop.title','فروشگاه آواتار'))} — قیمت‌ها و آیتم‌ها</h3><span class="tag">${D.fa(AV.shopAll().length)} آیتم</span>
        <button class="btn sm ghost" id="sp-reset" style="margin-right:auto">↺ بازگشت به کاتالوگ پیش‌فرض</button>
      </div>
      <div class="sub-note" style="font-size:11.5px;color:var(--muted);margin-top:6px;line-height:1.9">
        قیمت‌ها بر اساس ردهٔ برند تنظیم شده‌اند (اقتصادی → میان‌رده → بالا → لاکچری → افسانه‌ای). می‌توانید هر آیتم را ویرایش، غیرفعال یا حذف کنید و آیتم تازه بسازید.
      </div>
      <div class="shop-cats" style="margin-top:12px">
        ${AV.CATS.map(([id, lbl]) => `<div class="sc ${shopEditCat === id ? 'on' : ''}" data-scat="${id}">${lbl}</div>`).join('')}
      </div>
    </div>

    <div class="glass" style="margin-bottom:16px">
      <div class="card-head"><span class="ic">📋</span><h3>آیتم‌های این دسته</h3><span class="tag">${D.fa(items.length)} آیتم</span></div>
      <div style="overflow-x:auto"><table class="tbl"><thead><tr>
        <th>پیش‌نمایش</th><th>نام</th><th>برند</th><th>جنسیت</th><th>قیمت (سکه)</th><th>وضعیت</th><th>عملیات</th>
      </tr></thead><tbody>
        ${items.map(it => {
          const br = AV.BRANDS[it.b] || { name:'—', tier:'—', c:'#8A93A6' };
          return `<tr>
            <td style="width:70px">${AV.itemPreviewSVG(it, 56)}</td>
            <td><input class="input" data-in="${it.id}" value="${esc(it.n)}" style="min-width:150px;font-size:12px"></td>
            <td><span class="bnd" style="color:${br.c};background:${br.c}1f;border:1px solid ${br.c}44;padding:2px 7px;border-radius:20px;font-size:10px">${esc(br.name)}</span>
              <div style="font-size:10px;color:var(--muted)">${esc(br.tier)}</div></td>
            <td>${it.g === 'a' ? 'همه' : it.g === 'f' ? 'خانم/دختر' : 'آقا/پسر'}</td>
            <td><input class="input" type="number" data-ip="${it.id}" value="${+it.price || 0}" style="width:82px;text-align:center;direction:ltr"></td>
            <td>${it.off ? '<span class="chip red">غیرفعال</span>' : '<span class="chip green">فعال</span>'}</td>
            <td style="white-space:nowrap">
              <button class="btn sm" data-isave="${it.id}" style="font-size:11px">💾</button>
              <button class="btn sm ghost" data-itog="${it.id}" style="font-size:11px">${it.off ? 'فعال' : 'غیرفعال'}</button>
              <button class="btn sm ghost" data-idel="${it.id}" style="font-size:11px">🗑</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody></table></div>
    </div>

    <div class="glass">
      <div class="card-head"><span class="ic">➕</span><h3>افزودن آیتم جدید به فروشگاه</h3><span class="tag">${esc((AV.CATS.find(c => c[0] === shopEditCat) || ['',''])[1])}</span></div>
      <div class="field-grid" style="margin-top:10px">
        <div><label>نام آیتم</label><input class="input" id="sp-n" placeholder="مثلاً پولوشرت تابستانی" style="width:100%"></div>
        <div><label>برند</label><select class="sel" id="sp-b" style="width:100%">${brands.map(b => `<option value="${b}">${esc(AV.BRANDS[b].name)} — ${esc(AV.BRANDS[b].tier)}</option>`).join('')}</select></div>
        <div><label>قیمت (سکه)</label><input class="input" id="sp-p" type="number" value="30" style="width:100%;direction:ltr"></div>
        <div><label>جنسیت</label><select class="sel" id="sp-g" style="width:100%"><option value="a">همه (بزرگ و کوچک)</option><option value="m">آقا/پسر</option><option value="f">خانم/دختر</option></select></div>
        <div><label>رنگ اصلی</label><input class="input" type="color" id="sp-c1" value="#2E86DE" style="width:100%;height:38px;padding:3px"></div>
        <div><label>رنگ دوم</label><input class="input" type="color" id="sp-c2" value="#D4AF37" style="width:100%;height:38px;padding:3px"></div>
      </div>
      <button class="btn sm" id="sp-add" style="margin-top:14px">＋ افزودن به فروشگاه</button>
    </div>`;

    $$('[data-scat]', body).forEach(t => t.addEventListener('click', () => { shopEditCat = t.dataset.scat; renderMgmtTab(); }));
    $$('[data-isave]', body).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.isave;
      const n = body.querySelector(`[data-in="${id}"]`).value.trim();
      const p = +body.querySelector(`[data-ip="${id}"]`).value || 0;
      AV.setShopItem(id, { n, price: p });
      APP.toast('آیتم ذخیره شد ✓', 'green');
      renderMgmtTab();
    }));
    $$('[data-itog]', body).forEach(b => b.addEventListener('click', () => {
      const it = AV.shopAll().find(x => x.id === b.dataset.itog);
      AV.setShopItem(b.dataset.itog, { off: !it.off });
      renderMgmtTab();
    }));
    $$('[data-idel]', body).forEach(b => b.addEventListener('click', () => {
      if (!confirm('این آیتم حذف شود؟')) return;
      AV.removeShopItem(b.dataset.idel);
      APP.toast('آیتم حذف شد', 'orange');
      renderMgmtTab();
    }));
    const rs = $('#sp-reset', body);
    if (rs) rs.addEventListener('click', () => {
      if (!confirm('همهٔ ویرایش‌ها و آیتم‌های سفارشی فروشگاه پاک شود؟')) return;
      AV.resetShop(); APP.toast('فروشگاه بازنشانی شد', 'orange'); renderMgmtTab();
    });
    const add = $('#sp-add', body);
    if (add) add.addEventListener('click', () => {
      const n = $('#sp-n', body).value.trim();
      if (!n){ APP.toast('نام آیتم را وارد کنید', 'red'); return; }
      const item = {
        id: 'cu_' + Date.now().toString(36), cat: shopEditCat, b: $('#sp-b', body).value,
        n, price: +$('#sp-p', body).value || 0, g: $('#sp-g', body).value,
        c1: $('#sp-c1', body).value, c2: $('#sp-c2', body).value,
      };
      if (shopEditCat === 'hat') item.type = 'cap';
      if (shopEditCat === 'glove') item.type = 'glove';
      if (shopEditCat === 'glass') item.type = 'sport';
      if (shopEditCat === 'club') item.type = 'driver';
      if (shopEditCat === 'hair') item.style = 'short';
      if (shopEditCat === 'shirt') item.pat = 'solid';
      AV.addShopItem(item);
      APP.toast('آیتم «' + n + '» به فروشگاه اضافه شد ✓', 'green');
      renderMgmtTab();
    });
  }

  /* ── ابزارهای مشترک ── */
  function extraCourses(){ try{ return JSON.parse(localStorage.getItem('ga_courses')||'[]'); }catch(e){ return []; } }
  function extraTours(){ try{ return JSON.parse(localStorage.getItem('ga_tournaments')||'[]'); }catch(e){ return []; } }
  function extraCards(){ try{ return JSON.parse(localStorage.getItem('ga_scorecards')||'[]'); }catch(e){ return []; } }
  function saveCourses(a){ try{ localStorage.setItem('ga_courses', JSON.stringify(a)); }catch(e){} }
  function saveTours(a){ try{ localStorage.setItem('ga_tournaments', JSON.stringify(a)); }catch(e){} }
  function saveCards(a){ try{ localStorage.setItem('ga_scorecards', JSON.stringify(a)); }catch(e){} }

  /* ═══════════════ API ═══════════════ */
  window.MGMT = {
    pageSettings, pageMgmt, pageUsers, pageMessages, renderMgmtTab, customEvents, saveEvents,
    customPlayers, saveCustomPlayers, playerEdits, savePlayerEdits,
    playerUsers, savePlayerUsers, playerFull,
    getSettings, saveSettings, DEFAULTS,
    getSiteInfo, saveSiteInfo, SITE_DEFAULTS,
    drawSatellite, openMapPicker, mgmtCoins, mgmtHonor, mgmtShop,
  };
})();
