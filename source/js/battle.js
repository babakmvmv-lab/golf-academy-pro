/* ═══════════════════════════════════════════════════════════════════
   GolfAcademy PRO — نبرد میدانها (Battle of Arenas)
   موتور داده و منطق تیمها + جدالهای رودررو + تأثیر نتایج روی فصل.
   کاملاً آفلاین/لوکال (localStorage «ga_battle») — بدون backend.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  const KEY = 'ga_battle';

  /* ذخیرهسازی امن با fallback (sandbox preview که localStorage در دسترس نیست) */
  const mem = {};
  const store = {
    get(){ try { return localStorage.getItem(KEY); } catch(e){ return (KEY in mem) ? mem[KEY] : null; } },
    set(v){ try { localStorage.setItem(KEY, v); } catch(e){ mem[KEY] = v; } },
  };

  /* ── پیشفرض: ۴ تیم با اعضای واقعی فصل (سبک لیگ جهانی LIV) ── */
  function defaults(){
    return {
      v: 1,
      teams: [
        { id:'t1', name:'عقابهای طلایی', icon:'🦅', color:'#D4AF37', members:[1,2] },
        { id:'t2', name:'یوزرهای سبز',     icon:'🐆', color:'#1EBB8A', members:[3,4] },
        { id:'t3', name:'کوسههای آبی',    icon:'🦈', color:'#2E86DE', members:[5,6] },
        { id:'t4', name:'گرگهای شب',      icon:'🐺', color:'#9B59B6', members:[7,8] },
      ],
      matches: [],
      settings: {
        /* امتیاز جدول تیمی (رودررو) */
        winPts: 3, drawPts: 1, lossPts: 0,
        /* امتیاز فصل یک بازیکنِ تیم در برد/مساوی/باخت */
        seasonWinPts: 3, seasonDrawPts: 1, seasonLossPts: 0,
        /* آیا نتایج نبرد روی رنک/امتیاز فصل اثر بگذارد */
        seasonEnabled: true,
      },
    };
  }

  function load(){
    try {
      const raw = store.get();
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.teams) || !Array.isArray(d.matches) || !d.settings) return null;
      return d;
    } catch(e){ return null; }
  }
  function save(d){
    store.set(JSON.stringify(d));
  }
  /* اگر هیچ تیمی ساخته نشده → seed پیشفرض (خالی نماند) */
  function ensure(){
    let d = load();
    if (!d){ d = defaults(); save(d); }
    if (!Array.isArray(d.matches)) d.matches = [];
    if (!d.settings) d.settings = defaults().settings;
    if (!d.teams.length){ d.teams = defaults().teams; save(d); }
    return d;
  }
  function reset(){
    const d = defaults();
    save(d);
    return d;
  }

  /* ── کمکیها ── */
  function teamById(id){ const d = load(); return (d && d.teams.find(t => t.id === id)) || null; }
  function teamName(id){ const t = teamById(id); return t ? t.name : '—'; }
  function teamIcon(id){ const t = teamById(id); return t ? t.icon : '🏳️'; }
  function teamColor(id){ const t = teamById(id); return t ? t.color : '#8A93A6'; }
  function nameOf(pid){ const D = window.Data; return D && D.nameOf ? D.nameOf(pid) : 'بازیکن ' + pid; }

  /* ── جدول تیمی (امتیاز رودررو) ──
     فقط جدالهای «انجامشده» با نتیجهٔ قطعی شمرده میشوند. */
  function standings(){
    const d = ensure();
    const s = d.settings;
    const rows = d.teams.map(t => ({
      id: t.id, name: t.name, icon: t.icon, color: t.color, members: t.members,
      played:0, win:0, draw:0, loss:0, gs:0, ga:0, pts:0,
    }));
    const byId = {}; rows.forEach(r => byId[r.id] = r);
    d.matches.forEach(m => {
      if (m.status !== 'done' || !m.winner) return;
      const h = byId[m.home], a = byId[m.away];
      if (!h || !a) return;
      h.played++; a.played++;
      const hs = +m.homeScore || 0, as = +m.awayScore || 0;
      h.gs += hs; h.ga += as; a.gs += as; a.ga += hs;
      if (m.winner === 'home'){ h.win++; a.loss++; h.pts += s.winPts; a.pts += s.lossPts; }
      else if (m.winner === 'away'){ a.win++; h.loss++; a.pts += s.winPts; h.pts += s.lossPts; }
      else { h.draw++; a.draw++; h.pts += s.drawPts; a.pts += s.drawPts; }
    });
    rows.sort((a,b) => b.pts - a.pts || (b.gs - b.ga) - (a.gs - a.ga) || b.name.localeCompare(a.name, 'fa'));
    rows.forEach((r,i) => r.rank = i + 1);
    return rows;
  }

  /* ── امتیاز فصلِ بازیکنان از نتایج تیمی (برای موتور data.js) ──
     اگر seasonEnabled: هر بازیکنِ تیم در برد/مساوی/باختِ تیم خودش امتیاز میگیرد.
     فقط جدالهای «انجامشده» و «counted !== false». */
  function computeSeasonBonus(){
    const d = ensure();
    const s = d.settings;
    if (!s.seasonEnabled) return {};
    const bonus = {};
    const add = (pid, pts) => { if (pid){ bonus[pid] = (bonus[pid]||0) + (+pts || 0); } };
    d.matches.forEach(m => {
      if (m.status !== 'done' || !m.winner || m.counted === false) return;
      const h = teamById(m.home), a = teamById(m.away);
      if (m.winner === 'home'){
        (h.members||[]).forEach(p => add(p, s.seasonWinPts));
        (a.members||[]).forEach(p => add(p, s.seasonLossPts));
      } else if (m.winner === 'away'){
        (a.members||[]).forEach(p => add(p, s.seasonWinPts));
        (h.members||[]).forEach(p => add(p, s.seasonLossPts));
      } else {
        (h.members||[]).forEach(p => add(p, s.seasonDrawPts));
        (a.members||[]).forEach(p => add(p, s.seasonDrawPts));
      }
    });
    return bonus;
  }

  /* ── CRUD تیم ── */
  function addTeam(t){
    const d = ensure();
    const id = 't' + Date.now().toString(36) + Math.floor(Math.random()*1e3).toString(36);
    d.teams.push(Object.assign({ id, name:'تیم جدید', icon:'⚔️', color:'#D4AF37', members:[] }, t, { id }));
    save(d);
    return id;
  }
  function updateTeam(id, patch){
    const d = ensure();
    const t = d.teams.find(x => x.id === id);
    if (!t) return false;
    Object.assign(t, patch);
    save(d);
    return true;
  }
  function deleteTeam(id){
    const d = ensure();
    d.teams = d.teams.filter(t => t.id !== id);
    // جدالهای وابسته را حذف کن تا ref خراب نماند
    d.matches = d.matches.filter(m => m.home !== id && m.away !== id);
    save(d);
    return true;
  }

  /* ── CRUD جدال ── */
  function addMatch(mo){
    const d = ensure();
    const id = 'm' + Date.now().toString(36) + Math.floor(Math.random()*1e3).toString(36);
    d.matches.push(Object.assign({ id, home:null, away:null, date:null, time:'', winner:null, homeScore:null, awayScore:null, counted:true, status:'scheduled' }, mo, { id }));
    save(d);
    return id;
  }
  function updateMatch(id, patch){
    const d = ensure();
    const m = d.matches.find(x => x.id === id);
    if (!m) return false;
    Object.assign(m, patch);
    save(d);
    return true;
  }
  function deleteMatch(id){
    const d = ensure();
    d.matches = d.matches.filter(m => m.id !== id);
    save(d);
    return true;
  }
  function setResult(id, winner, homeScore, awayScore){
    return updateMatch(id, {
      winner, status:'done',
      homeScore:+homeScore||0, awayScore:+awayScore||0,
    });
  }

  /* ── تنظیمات ── */
  function settings(){ return ensure().settings; }
  function saveSettings(patch){
    const d = ensure();
    Object.assign(d.settings, patch);
    save(d);
    return d.settings;
  }

  /* برای بازکشی صفحهٔ نبرد: بعد از هر تغییر، موتور فصل را هم بهروز کن */
  function refresh(){
    if (window.APP && APP.reloadData) APP.reloadData();
  }

  window.Battle = {
    KEY, defaults, load, save, ensure, reset,
    teamById, teamName, teamIcon, teamColor, nameOf,
    standings, computeSeasonBonus,
    addTeam, updateTeam, deleteTeam,
    addMatch, updateMatch, deleteMatch, setResult,
    settings, saveSettings, refresh,
  };
})();
