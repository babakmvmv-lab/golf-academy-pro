/* ═══════════════════════════════════════════════════════════════════
   GolfAcademy PRO — موتور آواتار + Honor Rank + اقتصاد سکه (v6)
   • ۱۵ سطح Honor Rank در ۵ دیویژن (Silver / Gold / Emerald / Royal / Immortal)
   • ظاهر آواتار کاملاً Data-Driven (ga_rank_skin) — هیچ رنگ/نشان/افکتی هاردکد نیست
   • فروشگاه برندهای واقعی گلف (قیمت بر اساس رده‌ی برند)
   • سکه: کیف پول + درخواست عضو → تأیید مدیر
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fa = n => (window.Data && Data.fa) ? Data.fa(n) : String(n);
  function LSget(k, def){ try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return (v && typeof v === 'object') ? v : def; } catch(e){ return def; } }
  function LSset(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }
  let UID = 0; const uid = () => 'av' + (++UID);
  /* یکدست‌سازی نام کاربری (کوچک‌نویسی) — چون هنگام ورودِ عضو نام کاربری کوچک می‌شود،
     همهٔ کلیدهای ذخیره (کیف پول، آواتار، سبد خرید، …) نیز باید با همین قاعده کلید بخورند. */
  const norm = u => String(u == null ? '' : u).toLowerCase();

  /* ═════════ ۱) Honor Rank — تعریف پایه ═════════ */
  const DIVISIONS = [
    { id:'silver',   en:'Silver Division',   fa:'دیویژن نقره‌ای',  lv:[1,3]   },
    { id:'gold',     en:'Gold Division',     fa:'دیویژن طلایی',    lv:[4,6]   },
    { id:'emerald',  en:'Emerald Division',  fa:'دیویژن زمردی',    lv:[7,9]   },
    { id:'royal',    en:'Royal Division',    fa:'دیویژن سلطنتی',   lv:[10,12] },
    { id:'immortal', en:'Immortal Division', fa:'دیویژن جاودان',   lv:[13,15] },
  ];
  const PARTICLES = [
    ['none','بدون ذره'], ['silver','ذرات نقره‌ای'], ['gold','ذرات طلایی'],
    ['emerald','هاله و خطوط سبز'], ['royal','کریستال آبی'], ['immortal','ذرات شناور + تاج نور'],
  ];
  const UPFX = [
    ['none','بدون افکت'], ['wave','موج نور'], ['burst','انفجار ذرات'],
    ['crystal','شکست کریستالی'], ['crown','تاج نور طلایی'],
  ];
  /* پیش‌فرض ظاهری هر دیویژن (پایه‌ی داده‌ای — از پنل مدیریت قابل تغییر) */
  const DIV_SKIN = {
    silver:   { bg1:'#141A21', bg2:'#4B5765', bg3:'#D8E3EE', glow:'#E8F1FA', light:'#FFFFFF', border:'#A9B7C6', title:'#EAF2FA', particle:'silver',   up:'wave'    },
    gold:     { bg1:'#1A1405', bg2:'#8A6A15', bg3:'#F6E27A', glow:'#FFD86B', light:'#FFF3C4', border:'#D4AF37', title:'#FFE9A8', particle:'gold',     up:'burst'   },
    emerald:  { bg1:'#06170F', bg2:'#12694A', bg3:'#5FE3B0', glow:'#3BE3A2', light:'#C9FFE9', border:'#1EBB8A', title:'#B8FFE2', particle:'emerald',  up:'wave'    },
    royal:    { bg1:'#050D1F', bg2:'#173C88', bg3:'#6FA8FF', glow:'#4C8DFF', light:'#D6E7FF', border:'#2E86DE', title:'#CFE2FF', particle:'royal',    up:'crystal' },
    immortal: { bg1:'#12061F', bg2:'#5B1D9B', bg3:'#C89BFF', glow:'#A855F7', light:'#F3D9FF', border:'#D4AF37', title:'#EBD5FF', particle:'immortal', up:'crown'   },
  };
  /* ۱۵ رنک رسمی */
  const RANK_BASE = [
    { lv:1,  en:'Rookie Caddie',    fa:'کدی تازه‌کار',       pts:0,   badge:'🏌️' },
    { lv:2,  en:'Fairway Scout',    fa:'پیشاهنگ فروی',        pts:8,   badge:'⛳'  },
    { lv:3,  en:'Bunker Fighter',   fa:'جنگجوی بانکر',        pts:18,  badge:'🛡️' },
    { lv:4,  en:'Iron Striker',     fa:'ضربه‌زن آهنین',        pts:30,  badge:'🏅' },
    { lv:5,  en:'Birdie Hunter',    fa:'شکارچی بردی',         pts:45,  badge:'🐦' },
    { lv:6,  en:'Eagle Rider',      fa:'سوارکار ایگل',        pts:62,  badge:'🦅' },
    { lv:7,  en:'Green Master',     fa:'استاد گرین',          pts:80,  badge:'💚' },
    { lv:8,  en:'Putt Sniper',      fa:'تک‌تیرانداز پات',      pts:100, badge:'🎯' },
    { lv:9,  en:'Course Guardian',  fa:'نگهبان زمین',         pts:125, badge:'🌿' },
    { lv:10, en:'Royal Striker',    fa:'ضربه‌زن سلطنتی',       pts:150, badge:'🔷' },
    { lv:11, en:'Champion Knight',  fa:'شوالیهٔ قهرمان',       pts:180, badge:'⚔️' },
    { lv:12, en:'Master of Links',  fa:'استاد لینکس',         pts:215, badge:'👑' },
    { lv:13, en:'Albatross Knight', fa:'شوالیهٔ آلباتروس',     pts:255, badge:'🕊️' },
    { lv:14, en:'Legend of Fairway',fa:'اسطورهٔ فروی',         pts:300, badge:'🔥' },
    { lv:15, en:'Immortal Champion',fa:'قهرمان جاودان',       pts:350, badge:'💎' },
  ];
  function divOf(lv){ return DIVISIONS.find(d => lv >= d.lv[0] && lv <= d.lv[1]) || DIVISIONS[0]; }
  function baseRank(lv){
    const b = RANK_BASE.find(r => r.lv === lv) || RANK_BASE[0];
    const d = divOf(lv);
    const sk = DIV_SKIN[d.id];
    return Object.assign({ div:d.id, divEn:d.en, divFa:d.fa, badgeSize:32, badgeX:58, badgeY:47 }, sk, b);
  }
  const SKIN_KEY = 'ga_rank_skin';
  function skinStore(){ return LSget(SKIN_KEY, {}); }
  /* لیست کامل ۱۵ رنک با اعمال ویرایش‌های مدیر */
  function ranks(){
    const ov = skinStore();
    return RANK_BASE.map(r => {
      const b = baseRank(r.lv);
      const o = ov[String(r.lv)] || {};
      const m = Object.assign({}, b, o);
      const d = divOf(m.lv); m.divEn = d.en; m.divFa = d.fa;
      return m;
    });
  }
  function rankOf(lv){ lv = Math.max(1, Math.min(15, +lv || 1)); return ranks()[lv-1]; }
  function saveRank(lv, obj){
    const st = skinStore();
    st[String(lv)] = Object.assign({}, st[String(lv)] || {}, obj);
    LSset(SKIN_KEY, st);
  }
  function resetRanks(){ try { localStorage.removeItem(SKIN_KEY); } catch(e){} }
  function levelOfPts(pts){
    const rs = ranks(); let lv = 1;
    rs.forEach(r => { if ((+pts || 0) >= (+r.pts || 0)) lv = r.lv; });
    return lv;
  }
  /* رنک دستی مدیر برای هر کاربر: ga_honor = { user:{ lv:number|null } } */
  const HONOR_KEY = 'ga_honor';
  function honorStore(){ return LSget(HONOR_KEY, {}); }
  function setHonorOverride(user, lv){
    user = norm(user);
    const st = honorStore();
    if (lv === null || lv === '' || lv === undefined) delete st[user]; else st[user] = { lv: Math.max(1, Math.min(15, +lv)) };
    LSset(HONOR_KEY, st);
  }
  /* honorOf(user, pts) → {lv, rank, pts, next, prog, manual} */
  function honorOf(user, pts){
    user = norm(user);
    const st = honorStore();
    const manual = st[user] && st[user].lv ? +st[user].lv : 0;
    const lv = manual || levelOfPts(pts || 0);
    const rs = ranks();
    const rank = rs[lv-1];
    const next = lv < 15 ? rs[lv] : null;
    const cur = +rank.pts || 0;
    const prog = next ? Math.max(0, Math.min(100, ((+pts||0) - cur) / Math.max(1, (+next.pts - cur)) * 100)) : 100;
    return { lv, rank, pts: +pts || 0, next, prog, manual: !!manual };
  }

  /* ═════════ ۲) نشان سه‌بعدی فلزی ═════════ */
  function badgeSVG(rank, size){
    const g = uid(); const s = size || rank.badgeSize || 34;
    const glyph = String(rank.badge || '★');
    const isImg = /^(data:|https?:)/.test(glyph);
    return `<svg class="av-badge-svg" width="${s}" height="${s}" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="${g}r" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${rank.light}"/><stop offset=".45" stop-color="${rank.bg3}"/>
          <stop offset=".72" stop-color="${rank.bg2}"/><stop offset="1" stop-color="${rank.bg1}"/></linearGradient>
        <radialGradient id="${g}m" cx="34%" cy="26%" r="78%">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".95"/>
          <stop offset=".42" stop-color="${rank.bg3}" stop-opacity=".85"/>
          <stop offset="1" stop-color="${rank.bg2}" stop-opacity=".95"/></radialGradient>
        <filter id="${g}s" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2.4" stdDeviation="2.6" flood-color="rgba(0,0,0,.6)"/>
          <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${rank.glow}" flood-opacity=".55"/></filter>
        ${isImg ? `<clipPath id="${g}c"><path d="M50 14 L79 27 L79 57 Q79 76 50 87 Q21 76 21 57 L21 27 Z"/></clipPath>` : ''}
      </defs>
      <g filter="url(#${g}s)">
        <path d="M50 3 L88 20 L88 58 Q88 85 50 97 Q12 85 12 58 L12 20 Z" fill="url(#${g}r)" stroke="${rank.glow}" stroke-width="3.2" stroke-linejoin="round"/>
        <path d="M50 14 L79 27 L79 57 Q79 76 50 87 Q21 76 21 57 L21 27 Z" fill="url(#${g}m)"/>
        ${isImg
          ? `<image href="${esc(glyph)}" x="21" y="14" width="58" height="73" preserveAspectRatio="xMidYMid slice" clip-path="url(#${g}c)"/>`
          : `<text x="50" y="62" text-anchor="middle" font-size="36" style="dominant-baseline:middle">${esc(glyph)}</text>`}
        <path d="M22 27 Q50 44 78 27 L78 36 Q50 53 22 36 Z" fill="#ffffff" opacity=".2"/>
        <path d="M50 3 L88 20 L88 58 Q88 85 50 97 Q12 85 12 58 L12 20 Z" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1"/>
      </g></svg>`;
  }

  /* ═════════ ۳) برندها و فروشگاه ═════════ */
  const BRANDS = {
    academy:  { name:'GolfAcademy',        tier:'پایه',   c:'#d4af37' },
    essential:{ name:'Amazon Essentials',  tier:'اقتصادی', c:'#8A93A6' },
    quince:   { name:'Quince',             tier:'اقتصادی', c:'#8A93A6' },
    skechers: { name:'Skechers Go Golf',   tier:'میان‌رده', c:'#2E86DE' },
    ua:       { name:'Under Armour',       tier:'میان‌رده', c:'#2E86DE' },
    nike:     { name:'Nike Golf',          tier:'میان‌رده', c:'#2E86DE' },
    adidas:   { name:'adidas Golf',        tier:'میان‌رده', c:'#2E86DE' },
    puma:     { name:'PUMA Golf',          tier:'میان‌رده', c:'#2E86DE' },
    footjoy:  { name:'FootJoy',            tier:'میان‌رده', c:'#2E86DE' },
    callaway: { name:'Callaway',           tier:'میان‌رده', c:'#2E86DE' },
    ping:     { name:'PING',               tier:'میان‌رده', c:'#2E86DE' },
    titleist: { name:'Titleist',           tier:'میان‌رده', c:'#2E86DE' },
    truel:    { name:'TRUE Linkswear',     tier:'میان‌رده', c:'#2E86DE' },
    sunday:   { name:'Sunday Golf',        tier:'بالا',    c:'#1EBB8A' },
    travis:   { name:'TravisMathew',       tier:'بالا',    c:'#1EBB8A' },
    rhoback:  { name:'Rhoback',            tier:'بالا',    c:'#1EBB8A' },
    badbirdie:{ name:'Bad Birdie',         tier:'بالا',    c:'#1EBB8A' },
    lulu:     { name:'Lululemon',          tier:'بالا',    c:'#1EBB8A' },
    oakley:   { name:'Oakley',             tier:'بالا',    c:'#1EBB8A' },
    rayban:   { name:'Ray-Ban',            tier:'بالا',    c:'#1EBB8A' },
    jlind:    { name:'J.Lindeberg',        tier:'لاکچری',  c:'#D4AF37' },
    greyson:  { name:'Greyson',            tier:'لاکچری',  c:'#D4AF37' },
    petermil: { name:'Peter Millar',       tier:'لاکچری',  c:'#D4AF37' },
    hb:       { name:'Holderness & Bourne',tier:'لاکچری',  c:'#D4AF37' },
    galvin:   { name:'Galvin Green',       tier:'لاکچری',  c:'#D4AF37' },
    gfore:    { name:'G/FORE',             tier:'لاکچری',  c:'#D4AF37' },
    malbon:   { name:'Malbon Golf',        tier:'لاکچری',  c:'#D4AF37' },
    rlx:      { name:'Ralph Lauren RLX',   tier:'لاکچری',  c:'#D4AF37' },
    eastside: { name:'Eastside Golf',      tier:'لاکچری',  c:'#D4AF37' },
    scotty:   { name:'Scotty Cameron',     tier:'افسانه‌ای',c:'#A855F7' },
    pxg:      { name:'PXG',                tier:'افسانه‌ای',c:'#A855F7' },
    taylor:   { name:'TaylorMade',         tier:'افسانه‌ای',c:'#A855F7' },
    swag:     { name:'Swag Golf',          tier:'افسانه‌ای',c:'#A855F7' },
    ecco:     { name:'ECCO Golf',          tier:'بالا',    c:'#1EBB8A' },
    mizuno:   { name:'Mizuno',             tier:'میان‌رده', c:'#2E86DE' },
    srixon:   { name:'Srixon',             tier:'میان‌رده', c:'#2E86DE' },
    cobra:    { name:'Cobra Golf',         tier:'میان‌رده', c:'#2E86DE' },
    bridge:   { name:'Bridgestone Golf',   tier:'میان‌رده', c:'#2E86DE' },
    sunmt:    { name:'Sun Mountain',       tier:'بالا',    c:'#1EBB8A' },
    garmin:   { name:'Garmin Golf',        tier:'لاکچری',  c:'#D4AF37' },
    bushnell: { name:'Bushnell Golf',      tier:'لاکچری',  c:'#D4AF37' },
    shotscope:{ name:'Shot Scope',         tier:'بالا',    c:'#1EBB8A' },
  };
  const CATS = [
    ['shirt', '👕 پولوشرت و بالاتنه'],
    ['pants', '👖 شلوار و دامن گلف'],
    ['shoes', '👟 کفش گلف'],
    ['hat',   '🧢 کلاه و ویزور'],
    ['glove', '🧤 دستکش'],
    ['glass', '🕶️ عینک'],
    ['club',  '🏌️ چوب گلف'],
    ['bag',   '🎒 کیف و ساک گلف'],
    ['ball',  '⛳ توپ و تجهیزات'],
    ['watch', '⌚ ساعت و اکسسوری'],
    ['hair',  '💇 مدل مو'],
    ['eyes',  '👀 چشم'],
    ['skin',  '🎨 رنگ پوست'],
  ];
  /* g: جنسیت مجاز a=هردو m=آقا f=خانم */
  const SHOP_BASE = [
    /* ── پولوشرت / بالاتنه ── */
    { id:'sh_ac',  cat:'shirt', b:'academy',   n:'پولوشرت رسمی آکادمی',        price:0,   g:'a', c1:'#F4F6F8', c2:'#D4AF37', pat:'solid' },
    { id:'sh_am',  cat:'shirt', b:'essential', n:'پولوشرت پایهٔ سفید',          price:10,  g:'a', c1:'#EDF1F5', c2:'#9AA6B2', pat:'solid' },
    { id:'sh_qu',  cat:'shirt', b:'quince',    n:'پولوشرت مینیمال سرمه‌ای',      price:18,  g:'a', c1:'#25344A', c2:'#8FA3BF', pat:'solid' },
    { id:'sh_ua',  cat:'shirt', b:'ua',        n:'پلی‌آف ۳٫۰ آبی',              price:30,  g:'a', c1:'#1B5FBF', c2:'#0B2C5E', pat:'solid' },
    { id:'sh_ni',  cat:'shirt', b:'nike',      n:'درای‌فیت ویکتوری مشکی',        price:40,  g:'a', c1:'#15181C', c2:'#F4F6F8', pat:'solid' },
    { id:'sh_ad',  cat:'shirt', b:'adidas',    n:'الترمیت۳۶۵ سه‌خط',            price:45,  g:'a', c1:'#0E3B2E', c2:'#F4F6F8', pat:'stripe' },
    { id:'sh_pu',  cat:'shirt', b:'puma',      n:'کلاودسپان رنگی',              price:45,  g:'a', c1:'#E8571F', c2:'#12212F', pat:'block' },
    { id:'sh_fj',  cat:'shirt', b:'footjoy',   n:'پیکه تور سفید',               price:50,  g:'a', c1:'#FFFFFF', c2:'#123A72', pat:'solid' },
    { id:'sh_cw',  cat:'shirt', b:'callaway',  n:'میکرو تکسچر آبی',             price:50,  g:'a', c1:'#2E86DE', c2:'#0B2C5E', pat:'solid' },
    { id:'sh_ti',  cat:'shirt', b:'titleist',  n:'پلیرز سرمه‌ای',               price:55,  g:'a', c1:'#101C33', c2:'#C9D4DE', pat:'solid' },
    { id:'sh_tm',  cat:'shirt', b:'travis',    n:'هیتر خاکستری',                price:70,  g:'a', c1:'#5B6672', c2:'#E4EAF0', pat:'block' },
    { id:'sh_rh',  cat:'shirt', b:'rhoback',   n:'کوارتر-زیپ آتلتیک',           price:75,  g:'a', c1:'#1E4B8F', c2:'#EAF2FA', pat:'zip' },
    { id:'sh_bb',  cat:'shirt', b:'badbirdie', n:'پرینت جسورانه',               price:85,  g:'a', c1:'#B0207A', c2:'#FFD86B', pat:'argyle' },
    { id:'sh_lu',  cat:'shirt', b:'lulu',      n:'تاپ ورزشی سوئیفتلی',          price:90,  g:'f', c1:'#E9B8CE', c2:'#7A3C58', pat:'solid' },
    { id:'sh_jl',  cat:'shirt', b:'jlind',     n:'توئر تک KV',                  price:110, g:'a', c1:'#12212F', c2:'#3BE3A2', pat:'block' },
    { id:'sh_gv',  cat:'shirt', b:'galvin',    n:'ژاکت ضدباد اینترفیس',         price:120, g:'a', c1:'#0E3B2E', c2:'#5FE3B0', pat:'zip' },
    { id:'sh_pm',  cat:'shirt', b:'petermil',  n:'سولید جرسی لوکس',             price:130, g:'a', c1:'#8FB7E8', c2:'#12325C', pat:'solid' },
    { id:'sh_gr',  cat:'shirt', b:'greyson',   n:'سی‌ولف مدرن',                 price:135, g:'a', c1:'#2A2F3A', c2:'#5FE3B0', pat:'block' },
    { id:'sh_gf',  cat:'shirt', b:'gfore',     n:'پولو اسکارلت بولد',           price:150, g:'a', c1:'#D7263D', c2:'#FFFFFF', pat:'block' },
    { id:'sh_mb',  cat:'shirt', b:'malbon',    n:'باکت-استریت مالبن',           price:160, g:'a', c1:'#F2E8CF', c2:'#1E8F6A', pat:'argyle' },
    { id:'sh_hb',  cat:'shirt', b:'hb',        n:'پرمیوم پرفورمنس',             price:170, g:'a', c1:'#F8FAFC', c2:'#1E4B8F', pat:'stripe' },
    { id:'sh_es',  cat:'shirt', b:'eastside',  n:'هریتیج ایست‌ساید',            price:180, g:'a', c1:'#1B1B1B', c2:'#D4AF37', pat:'block' },
    { id:'sh_rl',  cat:'shirt', b:'rlx',       n:'کلاسیک لوکس RLX',             price:190, g:'a', c1:'#0B2C5E', c2:'#D7263D', pat:'stripe' },
    /* ── شلوار و دامن ── */
    { id:'pt_ac',  cat:'pants', b:'academy',   n:'شلوار سادهٔ آکادمی',           price:0,   g:'a', c1:'#3A424E' },
    { id:'pt_sk',  cat:'pants', b:'academy',   n:'دامن تنیس آکادمی',             price:0,   g:'f', c1:'#F4F6F8', skirt:1 },
    { id:'pt_am',  cat:'pants', b:'essential', n:'شلوار خاکی پایه',             price:12,  g:'a', c1:'#B9A88A' },
    { id:'pt_ua',  cat:'pants', b:'ua',        n:'درایو تیپرد',                 price:35,  g:'a', c1:'#2B3440' },
    { id:'pt_ad',  cat:'pants', b:'adidas',    n:'الترمیت۳۶۵ کلاسیک',           price:38,  g:'a', c1:'#1D2733' },
    { id:'pt_ads', cat:'pants', b:'adidas',    n:'اسکورت الترمیت۳۶۵',           price:45,  g:'f', c1:'#243447', skirt:1 },
    { id:'pt_ni',  cat:'pants', b:'nike',      n:'درای‌فیت ویکتوری',            price:40,  g:'a', c1:'#101418' },
    { id:'pt_pu',  cat:'pants', b:'puma',      n:'جک‌پات ۵-جیب',                price:42,  g:'a', c1:'#4A5361' },
    { id:'pt_tm',  cat:'pants', b:'travis',    n:'اوپن تو کلوز',                price:60,  g:'a', c1:'#6B7482' },
    { id:'pt_lu',  cat:'pants', b:'lulu',      n:'اسکورت پیس‌ریوال',            price:85,  g:'f', c1:'#3C4756', skirt:1 },
    { id:'pt_jl',  cat:'pants', b:'jlind',     n:'الف شلوار تیپرد',             price:100, g:'a', c1:'#12212F' },
    { id:'pt_pm',  cat:'pants', b:'petermil',  n:'کراون کرافت لوکس',            price:110, g:'a', c1:'#8A7B5E' },
    { id:'pt_mb',  cat:'pants', b:'malbon',    n:'جاگر استریت مالبن',           price:120, g:'a', c1:'#2A2F3A' },
    { id:'pt_gf',  cat:'pants', b:'gfore',     n:'شلوار استرچ پرمیوم',          price:130, g:'a', c1:'#F0EDE6' },
    /* ── کفش ── */
    { id:'sn_ac',  cat:'shoes', b:'academy',   n:'کتانی تمرین آکادمی',          price:0,   g:'a', c1:'#E7ECF1', c2:'#8A93A6' },
    { id:'sn_sk',  cat:'shoes', b:'skechers',  n:'بلید تور',                    price:45,  g:'a', c1:'#FFFFFF', c2:'#2E86DE' },
    { id:'sn_pu',  cat:'shoes', b:'puma',      n:'ایگنایت پرو',                 price:55,  g:'a', c1:'#12212F', c2:'#E8571F' },
    { id:'sn_tl',  cat:'shoes', b:'truel',     n:'آل‌دی نیت',                   price:60,  g:'a', c1:'#5B6672', c2:'#F4F6F8' },
    { id:'sn_ad',  cat:'shoes', b:'adidas',    n:'آدیزیرو ZG',                  price:70,  g:'a', c1:'#F8FAFC', c2:'#1EBB8A' },
    { id:'sn_ni',  cat:'shoes', b:'nike',      n:'ایرزوم ویکتوری',              price:80,  g:'a', c1:'#101418', c2:'#D4AF37' },
    { id:'sn_fj',  cat:'shoes', b:'footjoy',   n:'پرو SLX تور',                 price:90,  g:'a', c1:'#FFFFFF', c2:'#123A72' },
    { id:'sn_gf',  cat:'shoes', b:'gfore',     n:'گالیوانتر لاکچری',            price:140, g:'a', c1:'#D7263D', c2:'#FFFFFF' },
    /* ── کلاه ── */
    { id:'ht_no',  cat:'hat',   b:'academy',   n:'بدون کلاه',                   price:0,   g:'a', type:'none' },
    { id:'ht_sc',  cat:'hat',   b:'academy',   n:'روسری ورزشی آکادمی',          price:0,   g:'f', type:'scarf', c1:'#F4F6F8', c2:'#D4AF37' },
    { id:'ht_ac',  cat:'hat',   b:'academy',   n:'کپ آکادمی گلف',               price:15,  g:'a', type:'cap',   c1:'#1E8F6A', c2:'#D4AF37' },
    { id:'ht_scg', cat:'hat',   b:'galvin',    n:'روسری تکنیکال گالوین',        price:70,  g:'f', type:'scarf', c1:'#0E3B2E', c2:'#5FE3B0' },
    { id:'ht_cw',  cat:'hat',   b:'callaway',  n:'ویزور تور',                   price:30,  g:'a', type:'visor', c1:'#FFFFFF', c2:'#2E86DE' },
    { id:'ht_ti',  cat:'hat',   b:'titleist',  n:'کپ تور پرفورمنس',             price:35,  g:'a', type:'cap',   c1:'#101C33', c2:'#FFFFFF' },
    { id:'ht_pu',  cat:'hat',   b:'puma',      n:'اسنپ‌بک P',                   price:40,  g:'a', type:'cap',   c1:'#E8571F', c2:'#12212F' },
    { id:'ht_su',  cat:'hat',   b:'sunday',    n:'روپ‌هت لایف‌استایل',           price:50,  g:'a', type:'cap',   c1:'#B9A88A', c2:'#1E8F6A' },
    { id:'ht_pm',  cat:'hat',   b:'petermil',  n:'ویزور کراون لوکس',            price:60,  g:'a', type:'visor', c1:'#12325C', c2:'#F6E27A' },
    { id:'ht_gf',  cat:'hat',   b:'gfore',     n:'کپ G/FORE اسکارلت',           price:80,  g:'a', type:'cap',   c1:'#D7263D', c2:'#FFFFFF' },
    { id:'ht_mb',  cat:'hat',   b:'malbon',    n:'باکت‌هت مالبن',               price:90,  g:'a', type:'bucket',c1:'#F2E8CF', c2:'#1E8F6A' },
    /* ── دستکش ── */
    { id:'gl_no',  cat:'glove', b:'academy',   n:'بدون دستکش',                  price:0,   g:'a', type:'none' },
    { id:'gl_fw',  cat:'glove', b:'footjoy',   n:'ودرسافت',                     price:20,  g:'a', c1:'#FFFFFF' },
    { id:'gl_cw',  cat:'glove', b:'callaway',  n:'تور اتنتیک',                  price:35,  g:'a', c1:'#F0EDE6' },
    { id:'gl_fs',  cat:'glove', b:'footjoy',   n:'استاسافت پرمیوم',             price:40,  g:'a', c1:'#EAF2FA' },
    { id:'gl_gf',  cat:'glove', b:'gfore',     n:'دستکش اسکارلت',               price:70,  g:'a', c1:'#D7263D' },
    /* ── عینک ── */
    { id:'gs_no',  cat:'glass', b:'academy',   n:'بدون عینک',                   price:0,   g:'a', type:'none' },
    { id:'gs_ni',  cat:'glass', b:'nike',      n:'نایک ویژن اسپرت',             price:45,  g:'a', type:'sport', c1:'#15181C' },
    { id:'gs_rb',  cat:'glass', b:'rayban',    n:'کلاسیک ویفرر',                price:55,  g:'a', type:'classic',c1:'#2A2F3A' },
    { id:'gs_ok',  cat:'glass', b:'oakley',    n:'فلک ۲٫۰ XL',                  price:60,  g:'a', type:'sport', c1:'#0E3B2E' },
    /* ── چوب و ساک ── */
    { id:'cl_no',  cat:'club',  b:'academy',   n:'بدون چوب',                    price:0,   g:'a', type:'none' },
    { id:'cl_ir',  cat:'club',  b:'academy',   n:'آهن تمرینی آکادمی',           price:10,  g:'a', type:'iron',   c1:'#C9D4DE' },
    { id:'cl_pg',  cat:'club',  b:'ping',      n:'پاتر آنسر',                   price:65,  g:'a', type:'putter', c1:'#C9D4DE' },
    { id:'cl_ti',  cat:'club',  b:'titleist',  n:'درایور TSR',                  price:70,  g:'a', type:'driver', c1:'#101C33' },
    { id:'cl_tm',  cat:'club',  b:'taylor',    n:'درایور استلث',                price:80,  g:'a', type:'driver', c1:'#D7263D' },
    { id:'cl_sm',  cat:'bag',   b:'sunday',    n:'ساک لوپ سبک',                 price:90,  g:'a', type:'bag',    c1:'#1E8F6A' },
    { id:'cl_sw',  cat:'bag',   b:'swag',      n:'هدکاور کالکتور',              price:100, g:'a', type:'bag',    c1:'#A855F7' },
    { id:'cl_sc',  cat:'club',  b:'scotty',    n:'پاتر نیوپورت اسکاتی',         price:150, g:'a', type:'putter', c1:'#F6E27A' },
    { id:'cl_px',  cat:'bag',   b:'pxg',       n:'ساک کریر PXG',                price:200, g:'a', type:'bag',    c1:'#101418' },
    /* ── کیف و ساک گلف ── */
    { id:'bg_no',  cat:'bag',   b:'academy',   n:'بدون کیف',                    price:0,   g:'a', type:'none' },
    { id:'bg_ac',  cat:'bag',   b:'academy',   n:'ساک تمرینی آکادمی',           price:25,  g:'a', type:'bag',    c1:'#1E8F6A', c2:'#D4AF37' },
    { id:'bg_sm',  cat:'bag',   b:'sunmt',     n:'سان‌مانتین ۲٫۵ پلاس',          price:95,  g:'a', type:'bag',    c1:'#2E86DE', c2:'#F4F6F8' },
    { id:'bg_pg',  cat:'bag',   b:'ping',      n:'پینگ هوفر لایت',              price:115, g:'a', type:'bag',    c1:'#101C33', c2:'#E8571F' },
    { id:'bg_ti',  cat:'bag',   b:'titleist',  n:'پلیرز ۴ استند‌بگ',             price:130, g:'a', type:'bag',    c1:'#0B2C5E', c2:'#FFFFFF' },
    { id:'bg_gf',  cat:'bag',   b:'gfore',     n:'دیلاکس کریر G/FORE',          price:190, g:'a', type:'bag',    c1:'#D7263D', c2:'#FFFFFF' },
    /* ── توپ و تجهیزات ── */
    { id:'bl_no',  cat:'ball',  b:'academy',   n:'بدون توپ',                    price:0,   g:'a', type:'none' },
    { id:'bl_ac',  cat:'ball',  b:'academy',   n:'توپ تمرینی آکادمی',           price:5,   g:'a', type:'ball',   c1:'#FFFFFF', c2:'#1E8F6A' },
    { id:'bl_sr',  cat:'ball',  b:'srixon',    n:'زد-استار دایموند',            price:25,  g:'a', type:'ball',   c1:'#FFFFFF', c2:'#E8571F' },
    { id:'bl_cw',  cat:'ball',  b:'callaway',  n:'کروم سافت X',                 price:35,  g:'a', type:'ball',   c1:'#F8FAFC', c2:'#2E86DE' },
    { id:'bl_br',  cat:'ball',  b:'bridge',    n:'تور B X',                     price:40,  g:'a', type:'ball',   c1:'#FFFFFF', c2:'#D7263D' },
    { id:'bl_tm',  cat:'ball',  b:'taylor',    n:'TP5 پایلوت',                  price:45,  g:'a', type:'ball',   c1:'#FFFFFF', c2:'#101418' },
    { id:'bl_ti',  cat:'ball',  b:'titleist',  n:'پرو V1x',                     price:55,  g:'a', type:'ball',   c1:'#FFFFFF', c2:'#D4AF37' },
    { id:'bl_bu',  cat:'ball',  b:'bushnell',  n:'فاصله‌یاب تور V6',             price:120, g:'a', type:'range',  c1:'#15181C', c2:'#D4AF37' },
    /* ── ساعت و اکسسوری ── */
    { id:'wt_no',  cat:'watch', b:'academy',   n:'بدون ساعت',                   price:0,   g:'a', type:'none' },
    { id:'wt_ac',  cat:'watch', b:'academy',   n:'مچ‌بند ورزشی آکادمی',          price:20,  g:'a', type:'band',   c1:'#1E8F6A', c2:'#F4F6F8' },
    { id:'wt_ss',  cat:'watch', b:'shotscope', n:'شات‌اسکوپ X5',                price:60,  g:'a', type:'watch',  c1:'#2A2F3A', c2:'#5FE3B0' },
    { id:'wt_cb',  cat:'watch', b:'cobra',     n:'مچ‌بند کربنی کبرا',            price:75,  g:'a', type:'band',   c1:'#101418', c2:'#E8571F' },
    { id:'wt_ga',  cat:'watch', b:'garmin',    n:'اپروچ S70 طلایی',             price:140, g:'a', type:'watch',  c1:'#12212F', c2:'#D4AF37' },
    { id:'wt_gz',  cat:'watch', b:'garmin',    n:'اپروچ Z82 پرمیوم',            price:200, g:'a', type:'watch',  c1:'#0B0F14', c2:'#5FE3B0' },
    /* ── کفش‌های جدید ── */
    { id:'sn_ec',  cat:'shoes', b:'ecco',      n:'بایوم H4 چرم',                price:110, g:'a', c1:'#F4F6F8', c2:'#8A6A15' },
    { id:'sn_mz',  cat:'shoes', b:'mizuno',    n:'جنم لایت‌بوست',               price:75,  g:'a', c1:'#101418', c2:'#2E86DE' },
    /* ── مو ── */
    { id:'hr_m1',  cat:'hair',  b:'academy',   n:'کوتاه کلاسیک (آقا)',           price:0,   g:'m', style:'short', c1:'#2A1E16' },
    { id:'hr_f1',  cat:'hair',  b:'academy',   n:'بلند سادهٔ خانم',              price:0,   g:'f', style:'long',  c1:'#2A1E16' },
    { id:'hr_m2',  cat:'hair',  b:'academy',   n:'فید مدرن',                     price:20,  g:'m', style:'fade',  c1:'#171310' },
    { id:'hr_m3',  cat:'hair',  b:'academy',   n:'موجدار شیک',                   price:35,  g:'m', style:'wavy',  c1:'#4A3222' },
    { id:'hr_m4',  cat:'hair',  b:'academy',   n:'فر مجعد',                      price:45,  g:'a', style:'curly', c1:'#231A14' },
    { id:'hr_m5',  cat:'hair',  b:'academy',   n:'من‌بان بسته',                  price:50,  g:'m', style:'bun',   c1:'#2E2118' },
    { id:'hr_f2',  cat:'hair',  b:'academy',   n:'دم‌اسبی ورزشی',                price:40,  g:'f', style:'pony',  c1:'#3A2A1E' },
    { id:'hr_f3',  cat:'hair',  b:'academy',   n:'بافت دوطرفه',                  price:55,  g:'f', style:'braid', c1:'#5A3B22' },
    { id:'hr_f4',  cat:'hair',  b:'academy',   n:'باب بلوند',                    price:60,  g:'f', style:'bob',   c1:'#C8A15A' },
    { id:'hr_m6',  cat:'hair',  b:'academy',   n:'خاکستری نقره‌ای',              price:70,  g:'a', style:'wavy',  c1:'#B9C2CC' },
    /* ── چشم ── */
    { id:'ey_br',  cat:'eyes',  b:'academy',   n:'قهوه‌ای',                      price:0,   g:'a', c1:'#5A3B22' },
    { id:'ey_bk',  cat:'eyes',  b:'academy',   n:'مشکی',                         price:0,   g:'a', c1:'#241C16' },
    { id:'ey_gr',  cat:'eyes',  b:'academy',   n:'سبز',                          price:20,  g:'a', c1:'#1E8F5A' },
    { id:'ey_bl',  cat:'eyes',  b:'academy',   n:'آبی',                          price:25,  g:'a', c1:'#2E86DE' },
    { id:'ey_hz',  cat:'eyes',  b:'academy',   n:'عسلی',                         price:30,  g:'a', c1:'#B98A3C' },
    { id:'ey_sh',  cat:'eyes',  b:'academy',   n:'درخشان (ویژه)',                price:45,  g:'a', c1:'#7B4FD0', shine:1 },
    /* ── پوست ── */
    { id:'sk_1',   cat:'skin',  b:'academy',   n:'روشن',                         price:0,   g:'a', c1:'#F5D0A9' },
    { id:'sk_2',   cat:'skin',  b:'academy',   n:'طبیعی',                        price:0,   g:'a', c1:'#EBBE8F' },
    { id:'sk_3',   cat:'skin',  b:'academy',   n:'برنزه',                        price:0,   g:'a', c1:'#C68863' },
    { id:'sk_4',   cat:'skin',  b:'academy',   n:'تیره',                         price:0,   g:'a', c1:'#8D5524' },
  ];
  /* ── متادیتای فروشگاه: امتیاز، برچسب، موجودی (پایدار بر اساس شناسه) ── */
  function hashId(id){ let h = 0; String(id).split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) >>> 0; }); return h; }
  function itemMeta(it){
    const h = hashId(it.id);
    const price = +it.price || 0;
    const rate = it.rate !== undefined ? +it.rate : Math.round((3.6 + (h % 14) / 10) * 10) / 10;
    const sold = it.sold !== undefined ? +it.sold : 40 + (h % 960);
    const stock = it.stock !== undefined ? +it.stock : 3 + (h % 60);
    const isNew = it.tagNew !== undefined ? !!it.tagNew : (h % 7 === 0);
    const disc = +it.disc || 0;                       // قیمت قبل از تخفیف (اگر مدیر ست کند)
    const toman = it.toman !== undefined ? +it.toman : price * 12000;
    return { rate: Math.min(5, rate), sold, stock, isNew, disc, toman, price };
  }
  /* ویرایش‌های مدیر روی فروشگاه: ga_shop = { edit:{id:{price,n,off}}, add:[item] } */
  const SHOP_KEY = 'ga_shop';
  function shopStore(){ const d = LSget(SHOP_KEY, {}); return { edit: d.edit || {}, add: Array.isArray(d.add) ? d.add : [] }; }
  function saveShopStore(d){ LSset(SHOP_KEY, d); }
  function shop(){
    const st = shopStore();
    const out = SHOP_BASE.concat(st.add).map(it => {
      const e = st.edit[it.id];
      return e ? Object.assign({}, it, e) : it;
    });
    return out.filter(i => !i.off);
  }
  function shopAll(){ /* شامل غیرفعال‌ها — برای پنل مدیریت */
    const st = shopStore();
    return SHOP_BASE.concat(st.add).map(it => { const e = st.edit[it.id]; return e ? Object.assign({}, it, e) : it; });
  }
  function shopItem(id){ return shop().find(i => i.id === id) || shopAll().find(i => i.id === id) || null; }
  function setShopItem(id, patch){ const st = shopStore(); st.edit[id] = Object.assign({}, st.edit[id] || {}, patch); saveShopStore(st); }
  function addShopItem(item){ const st = shopStore(); st.add.push(item); saveShopStore(st); }
  function removeShopItem(id){
    const st = shopStore();
    const i = st.add.findIndex(x => x.id === id);
    if (i > -1) st.add.splice(i, 1); else st.edit[id] = Object.assign({}, st.edit[id] || {}, { off:true });
    saveShopStore(st);
  }
  function resetShop(){ try { localStorage.removeItem(SHOP_KEY); } catch(e){} }
  const FREE_IDS = () => shop().filter(i => +i.price === 0).map(i => i.id);
  /* جنسیت‌ها: m=آقا ، f=خانم ، b=پسر بچه ، c=دختر بچه — b/c «حالت کوچک» همان ساختارند.
     سازگاری آیتم: g:'m' ⇒ آقا+پسر ، g:'f' ⇒ خانم+دختر ، g:'a' ⇒ همه (خریدها همیشه می‌مانند) */
  const fitsGender = (ig, g) => !ig || ig === 'a' || (ig === 'm' ? (g === 'm' || g === 'b') : (g === 'f' || g === 'c'));
  const DEFAULT_SEL = g => ({
    shirt:'sh_ac', pants:'pt_ac', shoes:'sn_ac', hat: g === 'f' ? 'ht_sc' : 'ht_no',
    glove:'gl_no', glass:'gs_no', club:'cl_no', bag:'bg_no', ball:'bl_no', watch:'wt_no',
    hair: (g === 'f' || g === 'c') ? 'hr_f1' : 'hr_m1', eyes:'ey_br', skin:'sk_2',
  });


  /* ═════════ ۳٫۵) دسته‌ها، برندها و بسته‌های ویژه (قابل ویرایش از پنل مدیریت) ═════════ */
  function shopMeta(){
    const d = LSget(SHOP_KEY, {});
    return {
      cats:    Array.isArray(d.cats)    ? d.cats    : [],   // [{id,label,icon,off}]
      brands:  (d.brands && typeof d.brands === 'object') ? d.brands : {},
      bundles: Array.isArray(d.bundles) ? d.bundles : [],   // [{id,n,ids:[],price,off}]
      hidden:  Array.isArray(d.hidden)  ? d.hidden  : [],   // شناسهٔ دسته‌های پنهان‌شده
    };
  }
  function saveMeta(patch){
    const d = LSget(SHOP_KEY, {});
    LSset(SHOP_KEY, Object.assign({}, d, patch));
  }
  /* لیست نهایی دسته‌ها = پایه + سفارشی − پنهان‌شده‌ها */
  function cats(){
    const m = shopMeta();
    const base = CATS.map(([id, label]) => ({ id, label, base:true }));
    const out = base.concat(m.cats.filter(c => c && c.id && !base.some(b => b.id === c.id)));
    return out.filter(c => !m.hidden.includes(c.id) && !c.off);
  }
  function catsAll(){
    const m = shopMeta();
    const base = CATS.map(([id, label]) => ({ id, label, base:true, off: m.hidden.includes(id) }));
    return base.concat(m.cats.filter(c => c && c.id && !base.some(b => b.id === c.id)));
  }
  function addCat(c){ const m = shopMeta(); m.cats.push(c); saveMeta({ cats: m.cats }); }
  function setCat(id, patch){
    const m = shopMeta();
    const i = m.cats.findIndex(c => c.id === id);
    if (i > -1){ m.cats[i] = Object.assign({}, m.cats[i], patch); saveMeta({ cats: m.cats }); return; }
    // دستهٔ پایه: فقط پنهان/آشکار کردن
    const hid = new Set(m.hidden);
    if (patch.off) hid.add(id); else hid.delete(id);
    saveMeta({ hidden: Array.from(hid) });
  }
  function removeCat(id){
    const m = shopMeta();
    const i = m.cats.findIndex(c => c.id === id);
    if (i > -1){ m.cats.splice(i, 1); saveMeta({ cats: m.cats }); }
    else { const hid = new Set(m.hidden); hid.add(id); saveMeta({ hidden: Array.from(hid) }); }
  }
  function brands(){ return Object.assign({}, BRANDS, shopMeta().brands); }
  function setBrand(id, obj){ const m = shopMeta(); m.brands[id] = Object.assign({}, m.brands[id] || BRANDS[id] || {}, obj); saveMeta({ brands: m.brands }); }
  function removeBrand(id){ const m = shopMeta(); delete m.brands[id]; saveMeta({ brands: m.brands }); }
  function bundles(){ return shopMeta().bundles.filter(b => !b.off); }
  function bundlesAll(){ return shopMeta().bundles; }
  function addBundle(b){ const m = shopMeta(); m.bundles.push(b); saveMeta({ bundles: m.bundles }); }
  function setBundle(id, patch){
    const m = shopMeta(); const i = m.bundles.findIndex(b => b.id === id);
    if (i > -1){ m.bundles[i] = Object.assign({}, m.bundles[i], patch); saveMeta({ bundles: m.bundles }); }
  }
  function removeBundle(id){ const m = shopMeta(); saveMeta({ bundles: m.bundles.filter(b => b.id !== id) }); }

  /* ── سبد خرید و علاقه‌مندی هر کاربر ── */
  const CART_KEY = 'ga_cart', FAV_KEY = 'ga_fav';
  function cart(user){ user = norm(user); const d = LSget(CART_KEY, {}); return Array.isArray(d[user]) ? d[user] : []; }
  function saveCart(user, a){ user = norm(user); const d = LSget(CART_KEY, {}); d[user] = a; LSset(CART_KEY, d); }
  function cartAdd(user, id){
    user = norm(user);
    const a = cart(user);
    if (a.includes(id)) return { ok:false, msg:'این آیتم قبلاً در سبد شماست' };
    const rec = avatarOf(user);
    if (rec.owned.includes(id)) return { ok:false, msg:'این آیتم را از قبل دارید' };
    a.push(id); saveCart(user, a);
    return { ok:true, msg:'به سبد خرید اضافه شد 🛒' };
  }
  function cartRemove(user, id){ saveCart(user, cart(user).filter(x => x !== id)); }
  function cartClear(user){ saveCart(user, []); }
  function cartTotal(user){
    return cart(user).reduce((s, id) => { const it = shopItem(id); return s + (it ? (+it.price || 0) : 0); }, 0);
  }
  /* خرید همهٔ آیتم‌های سبد با یک تراکنش */
  function checkout(user){
    const ids = cart(user).filter(id => shopItem(id));
    if (!ids.length) return { ok:false, msg:'سبد خرید شما خالی است' };
    const total = ids.reduce((s, id) => s + (+shopItem(id).price || 0), 0);
    const bal = coinOf(user).total;
    if (bal < total) return { ok:false, msg:'موجودی سکه کافی نیست — نیاز: ' + total + ' 🪙 / موجودی: ' + bal + ' 🪙' };
    let n = 0;
    ids.forEach(id => { const r = buyItem(user, id); if (r.ok) n++; });
    cartClear(user);
    return { ok:true, msg: n + ' آیتم خریداری شد و برای همیشه در کمد شماست ✓', n, total };
  }
  function favs(user){ user = norm(user); const d = LSget(FAV_KEY, {}); return Array.isArray(d[user]) ? d[user] : []; }
  function toggleFav(user, id){
    user = norm(user);
    const d = LSget(FAV_KEY, {}); const a = Array.isArray(d[user]) ? d[user] : [];
    const i = a.indexOf(id);
    if (i > -1) a.splice(i, 1); else a.push(id);
    d[user] = a; LSset(FAV_KEY, d);
    return i === -1;
  }
  /* خرید یک ست کامل (بسته) */
  function buyBundle(user, bid){
    user = norm(user);
    const b = bundles().find(x => x.id === bid);
    if (!b) return { ok:false, msg:'بسته پیدا نشد' };
    const rec = avatarOf(user);
    const need = (b.ids || []).filter(id => !rec.owned.includes(id));
    if (!need.length) return { ok:false, msg:'همهٔ آیتم‌های این ست را دارید' };
    const price = +b.price || need.reduce((s, id) => { const it = shopItem(id); return s + (it ? +it.price || 0 : 0); }, 0);
    const left = spendCoins(user, price, 'bundle:' + bid, 'خرید ست ' + b.n);
    if (left === null) return { ok:false, msg:'موجودی سکه کافی نیست' };
    const d = avatarData(); const r = d[user] || rec;
    need.forEach(id => { r.owned.push(id); const it = shopItem(id); if (it) r.sel[it.cat] = id; });
    d[user] = r; saveAvatars(d);
    return { ok:true, msg:'ست «' + b.n + '» خریداری و پوشیده شد ✓' };
  }

  /* ═════════ ۴) داده‌ی آواتار کاربران ═════════ */
  const AV_KEY = 'ga_avatars';
  function avatarData(){ return LSget(AV_KEY, {}); }
  function saveAvatars(d){ LSset(AV_KEY, d); }
  /* مهاجرت نرم از نسخهٔ ۵ (h1/f1/e1/s1/h0) */
  function avatarOf(user, defGender){
    user = norm(user);
    const d = avatarData();
    const g = ['m','f','b','c'].includes(defGender) ? defGender
      : (defGender === 'زن' || defGender === 'خانم') ? 'f'
      : (defGender === 'پسر' || defGender === 'پسر بچه' || defGender === 'پسربچه') ? 'b'
      : (defGender === 'دختر' || defGender === 'دختر بچه' || defGender === 'دختربچه') ? 'c' : 'm';
    let rec = d[user];
    if (!rec){
      // اگر آواتار زیرِ کلیدی با حروف متفاوت (مثلاً Sina_Golf) ذخیره شده، آن را بکش و کوچک کن
      for (const k in d){ if (norm(k) === user){ rec = d[k]; d[user] = rec; try { delete d[k]; } catch(e){} saveAvatars(d); break; } }
    }
    if (!rec || !rec.v6){
      rec = { v6:1, gender: (rec && rec.gender) || g, owned: FREE_IDS(), sel: DEFAULT_SEL((rec && rec.gender) || g), lvl: 0 };
      d[user] = rec; saveAvatars(d);
    } else {
      rec.gender = rec.gender || g;
      rec.owned = Array.from(new Set((rec.owned || []).concat(FREE_IDS())));
      rec.sel = Object.assign({}, DEFAULT_SEL(rec.gender), rec.sel || {});
    }
    return rec;
  }
  function setAvatar(user, patch){
    user = norm(user);
    const d = avatarData();
    const rec = d[user] || (d[user] = { v6:1, gender:'m', owned: FREE_IDS(), sel: DEFAULT_SEL('m'), lvl:0 });
    Object.assign(rec, patch);
    saveAvatars(d); return rec;
  }
  function selectItem(user, id){
    user = norm(user);
    const it = shopItem(id); if (!it) return false;
    const rec = avatarOf(user);
    if (!rec.owned.includes(id)) return false;
    rec.sel[it.cat] = id;
    const d = avatarData(); d[user] = rec; saveAvatars(d);
    return true;
  }
  /* خرید: کسر سکه + مالکیت دائمی */
  function buyItem(user, id){
    user = norm(user);
    const it = shopItem(id); if (!it) return { ok:false, msg:'آیتم پیدا نشد' };
    const rec = avatarOf(user);
    if (rec.owned.includes(id)) return { ok:false, msg:'این آیتم را قبلاً خریده‌اید (برای همیشه در کمد شماست)' };
    const price = +it.price || 0;
    if (price > 0){
      const left = spendCoins(user, price, 'buy:' + id, 'خرید ' + it.n);
      if (left === null) return { ok:false, msg:'موجودی سکهٔ شما کافی نیست' };
    }
    rec.owned.push(id);
    rec.sel[it.cat] = id;
    const d = avatarData(); d[user] = rec; saveAvatars(d);
    return { ok:true, msg:'«' + it.n + '» خریداری شد و برای همیشه در کمد شماست', item: it };
  }

  /* ═════════ ۵) سکه: کیف پول ═════════ */
  const COIN_KEY = 'ga_coins';
  /* سکه‌های «خودکار» (قهرمانی‌ها) ذخیره نمی‌شوند؛ هر بار از روی نتایج فعلی محاسبه می‌شوند.
     پس اگر مسابقه/قهرمان حذف یا عوض شود، موجودی سکه هم بلافاصله کم/زیاد می‌شود. */
  let AUTO_FN = null;
  function setAutoProvider(fn){ AUTO_FN = (typeof fn === 'function') ? fn : null; }
  function autoOf(user){
    user = norm(user);
    if (!AUTO_FN) return { total: 0, items: [] };
    try {
      const r = AUTO_FN(user) || {};
      return { total: +r.total || 0, items: Array.isArray(r.items) ? r.items : [] };
    } catch(e){ return { total: 0, items: [] }; }
  }
  function coinData(){
    let d = LSget(COIN_KEY, {});
    /* یکپارچه‌سازی کلیدهای نام کاربری با حروف متفاوت ← کوچک‌نویسی (تا کیف پولِ مدیر و عضو یکی شود) */
    let merged = false;
    const nd = {};
    Object.keys(d).forEach(u => {
      const key = norm(u);
      const c = d[u] || {};
      if (key !== u) merged = true;
      if (!nd[key]) nd[key] = { total:0, log:[], v7auto:0 };
      const t = nd[key];
      t.total = (+t.total || 0) + (+c.total || 0);
      t.log = (t.log || []).concat(Array.isArray(c.log) ? c.log : []);
      if (c.v7auto) t.v7auto = 1;
    });
    if (merged) d = nd;
    /* مهاجرت v7: سکه‌های خودکارِ قدیمی که یک‌بار ثبت شده بودند از موجودی ثابت پاک می‌شوند */
    let dirty = merged;
    Object.keys(d).forEach(u => {
      const c = d[u];
      if (!c || c.v7auto) return;
      let delta = 0;
      const keep = [];
      (c.log || []).forEach(l => {
        if (String(l.source || '').indexOf('auto:') === 0) delta += (+l.amount || 0);
        else keep.push(l);
      });
      if (delta) c.total = (+c.total || 0) - delta;
      c.log = keep; c.v7auto = 1; dirty = true;
    });
    if (dirty) LSset(COIN_KEY, d);
    return d;
  }
  function saveCoins(d){ LSset(COIN_KEY, d); }
  /* coinOf → { total (نهایی), base (ثابت), auto (قهرمانی‌ها), autoItems, log } */
  function coinOf(user){
    user = norm(user);
    const d = coinData();
    if (!d[user]) d[user] = { total:0, log:[] };
    const c = d[user];
    const a = autoOf(user);
    const base = +c.total || 0;
    return { total: base + a.total, base, auto: a.total, autoItems: a.items, log: c.log || [] };
  }
  function addCoins(user, amount, source, note){
    user = norm(user);
    amount = +amount || 0;
    if (amount <= 0) return null;
    const d = coinData();
    const c = d[user] || (d[user] = { total:0, log:[] });
    c.total += amount;
    c.log.push({ amount, source, note, date: new Date().toISOString().slice(0,10), ts: Date.now() });
    saveCoins(d); return c.total + autoOf(user).total;
  }
  function spendCoins(user, amount, source, note){
    user = norm(user);
    amount = +amount || 0;
    if (amount <= 0) return null;
    const d = coinData();
    const c = d[user] || (d[user] = { total:0, log:[] });
    const auto = autoOf(user).total;
    if ((+c.total || 0) + auto < amount) return null;
    c.total -= amount;
    c.log.push({ amount: -amount, source, note, date: new Date().toISOString().slice(0,10), ts: Date.now() });
    saveCoins(d); return c.total + auto;
  }

  /* ═════════ ۶) درخواست سکه (عضو → تأیید مدیر) ═════════ */
  const REQ_KEY = 'ga_coinreq';
  function reqs(){ const a = LSget(REQ_KEY, []); return Array.isArray(a) ? a : []; }
  function saveReqs(a){ LSset(REQ_KEY, a); }
  function reqsOf(user){ const u = norm(user); return reqs().filter(r => norm(r.user) === u).sort((a,b) => b.ts - a.ts); }
  function pendingReqs(){ return reqs().filter(r => r.status === 'pending').sort((a,b) => a.ts - b.ts); }
  function addReq(o){
    const a = reqs();
    const r = Object.assign({
      id: 'r' + Date.now() + Math.floor(Math.random()*900+100),
      status: 'pending', ts: Date.now(), date: new Date().toISOString().slice(0,10),
    }, o);
    r.user = norm(r.user);
    a.push(r); saveReqs(a); return r;
  }
  function decideReq(id, ok, by, adminNote, amountOverride){
    const a = reqs();
    const r = a.find(x => x.id === id);
    if (!r || r.status !== 'pending') return null;
    r.status = ok ? 'ok' : 'no';
    r.by = by || 'admin';
    r.adminNote = adminNote || '';
    r.decidedAt = Date.now();
    if (ok){
      if (amountOverride !== undefined && amountOverride !== null && amountOverride !== '') r.amount = +amountOverride || 0;
      addCoins(r.user, r.amount, 'req:' + r.id, r.title);
    }
    saveReqs(a); return r;
  }
  function deleteReq(id){ saveReqs(reqs().filter(r => r.id !== id)); }
  function clearDecided(){ saveReqs(reqs().filter(r => r.status === 'pending')); }

  /* ═════════ ۷) رندر آواتار پیشرفته (SVG) ═════════ */
  function itemOf(sel, cat){ return shopItem(sel[cat]) || null; }
  function renderAvatarSVG(sel, opt){
    opt = opt || {};
    const g = uid();
    const gender = ['m','f','b','c'].includes(opt.gender) ? opt.gender : 'm';
    const isChild = gender === 'b' || gender === 'c';   // پسر/دختر بچه → فرم بچه
    const femAv   = gender === 'f' || gender === 'c';
    const skinIt = itemOf(sel, 'skin') || { c1:'#EBBE8F' };
    const skin = skinIt.c1;
    const hair = itemOf(sel, 'hair') || { style:(femAv?'long':'short'), c1:'#2A1E16' };
    const eyeIt = itemOf(sel, 'eyes') || { c1:'#5A3B22' };
    const shirt = itemOf(sel, 'shirt') || { c1:'#F4F6F8', c2:'#D4AF37', pat:'solid' };
    const pants = itemOf(sel, 'pants') || { c1:'#3A424E' };
    const shoes = itemOf(sel, 'shoes') || { c1:'#E7ECF1', c2:'#8A93A6' };
    const hat   = itemOf(sel, 'hat')   || { type:'none' };
    const glove = itemOf(sel, 'glove') || { type:'none' };
    const glass = itemOf(sel, 'glass') || { type:'none' };
    const club  = itemOf(sel, 'club')  || { type:'none' };
    const bag   = itemOf(sel, 'bag')   || { type:'none' };
    const ball  = itemOf(sel, 'ball')  || { type:'none' };
    const watch = itemOf(sel, 'watch') || { type:'none' };
    const hairC = hair.c1 || '#2A1E16';
    const tieC  = hair.c2 || '#E97FB2';
    const dark = (c, k) => shade(c, -(k || 18));
    const light = (c, k) => shade(c, (k || 16));
    const r1 = n => Math.round(n * 10) / 10;

    /* ═══ بدن ۴ تیپ — تمام لباس‌ها/اکسسوری‌ها از همین جدول ساخته می‌شوند،
       پس هر آیتم خریداری‌شده روی هر ۴ کاراکتر دقیق می‌نشیند ═══ */
    const B = isChild ? {
      hy: 96, hrx: 41, hry: 45,               // سر بزرگ بچه‌گونه
      nk0: 132, nk1: 146, nkw: 11,            // گردن
      sy: 152, sw: 33, wy: 236, ww: 26,       // شانه / کمر
      at: 158, ae: 220, hd: 8,                // بازو / مچ / مشت
      cr: 262, ly: 322, lw: 12, fy: 348       // کشاله / مچ پا / کف پا
    } : {
      hy: 74, hrx: 37, hry: 42,               // بزرگ‌سال
      nk0: 104, nk1: 120, nkw: 12,
      sy: 128, sw: (gender === 'f' ? 35 : 42), wy: 242, ww: (gender === 'f' ? 26 : 30),
      at: 136, ae: 222, hd: 9,
      cr: 270, ly: 326, lw: 14, fy: 348
    };
    const ground = 352, eyeY = B.hy + 6, eDX = 15, crown = B.hy - B.hry;
    const handL = r1(100 - B.sw + 2), handR = r1(100 + B.sw - 2);

    /* ── مو (پشت سر) ── */
    const st = hair.style || 'short';
    let hairBack = '';
    if (st === 'long' || st === 'bob' || st === 'braid' || st === 'pony'){
      const len = st === 'bob' ? B.hy + 32 : B.hy + (isChild ? 60 : 76);
      hairBack = `<path d="M${r1(100-B.hrx)} ${r1(B.hy-12)} Q${r1(100-B.hrx-8)} ${r1(B.hy+28)} ${r1(100-B.hrx+5)} ${r1(len)} L${r1(100+B.hrx-5)} ${r1(len)} Q${r1(100+B.hrx+8)} ${r1(B.hy+28)} ${r1(100+B.hrx)} ${r1(B.hy-12)} Z" fill="${dark(hairC,10)}"/>`;
    }

    /* ── مو (جلو/روی سر) — همهٔ مدل‌ها با رنگ دلخواه ── */
    let hairFront = '';
    const capShort = `<path d="M${r1(100-B.hrx)} ${r1(B.hy-12)} Q${r1(100-B.hrx-2)} ${r1(crown-8)} 100 ${r1(crown-9)} Q${r1(100+B.hrx+2)} ${r1(crown-8)} ${r1(100+B.hrx)} ${r1(B.hy-12)} Q${r1(100+B.hrx-13)} ${r1(B.hy-30)} 100 ${r1(B.hy-32)} Q${r1(100-B.hrx+13)} ${r1(B.hy-30)} ${r1(100-B.hrx)} ${r1(B.hy-12)}Z" fill="${hairC}"/>`;
    if (st === 'short') hairFront = capShort;
    else if (st === 'fade') hairFront = capShort + `<path d="M${r1(100-B.hrx)} ${r1(B.hy-12)} Q${r1(100-B.hrx-1)} ${r1(B.hy+1)} ${r1(100-B.hrx+3)} ${r1(B.hy+6)} L${r1(100+B.hrx-3)} ${r1(B.hy+6)} Q${r1(100+B.hrx+1)} ${r1(B.hy+1)} ${r1(100+B.hrx)} ${r1(B.hy-12)} Q${r1(100+B.hrx-10)} ${r1(B.hy-8)} 100 ${r1(B.hy-9)} Q${r1(100-B.hrx+10)} ${r1(B.hy-8)} ${r1(100-B.hrx)} ${r1(B.hy-12)}Z" fill="${dark(hairC,26)}" opacity=".5"/>`;
    else if (st === 'wavy') hairFront = `<path d="M${r1(100-B.hrx-1)} ${r1(B.hy-12)} Q${r1(100-B.hrx-2)} ${r1(crown-10)} 100 ${r1(crown-11)} Q${r1(100+B.hrx+2)} ${r1(crown-10)} ${r1(100+B.hrx+1)} ${r1(B.hy-12)} Q${r1(100+B.hrx-8)} ${r1(B.hy-26)} ${r1(100+eDX)} ${r1(B.hy-18)} Q${r1(100+eDX-6)} ${r1(B.hy-32)} ${r1(100+eDX*0.3)} ${r1(B.hy-24)} Q${r1(100-eDX*0.3)} ${r1(B.hy-34)} ${r1(100-eDX)} ${r1(B.hy-20)} Q${r1(100-B.hrx+8)} ${r1(B.hy-24)} ${r1(100-B.hrx-1)} ${r1(B.hy-12)}Z" fill="${hairC}"/>`;
    else if (st === 'curly') hairFront = `<g fill="${hairC}"><circle cx="${r1(100-B.hrx*0.62)}" cy="${r1(crown+14)}" r="${r1(B.hrx*0.34)}"/><circle cx="100" cy="${r1(crown+4)}" r="${r1(B.hrx*0.4)}"/><circle cx="${r1(100+B.hrx*0.62)}" cy="${r1(crown+14)}" r="${r1(B.hrx*0.34)}"/><circle cx="${r1(100-B.hrx*0.9)}" cy="${r1(B.hy-8)}" r="${r1(B.hrx*0.27)}"/><circle cx="${r1(100+B.hrx*0.9)}" cy="${r1(B.hy-8)}" r="${r1(B.hrx*0.27)}"/></g>`;
    else if (st === 'bun') hairFront = `<circle cx="100" cy="${r1(crown-2)}" r="${r1(B.hrx*0.3)}" fill="${hairC}"/>` + capShort;
    else if (st === 'pony') hairFront = capShort
      + `<path d="M${r1(100+B.hrx-3)} ${r1(B.hy-16)} Q${r1(100+B.hrx+22)} ${r1(B.hy-2)} ${r1(100+B.hrx+17)} ${r1(B.hy+30)} Q${r1(100+B.hrx+13)} ${r1(B.hy+48)} ${r1(100+B.hrx+2)} ${r1(B.hy+44)} Q${r1(100+B.hrx+11)} ${r1(B.hy+16)} ${r1(100+B.hrx-8)} ${r1(B.hy+4)}Z" fill="${dark(hairC,4)}"/>`
      + `<circle cx="${r1(100+B.hrx)}" cy="${r1(B.hy-13)}" r="4.4" fill="${tieC}"/>`;
    else if (st === 'braid') hairFront = capShort + `<g fill="${dark(hairC,4)}"><circle cx="${r1(100-B.hrx)}" cy="${r1(B.hy+16)}" r="7"/><circle cx="${r1(100-B.hrx-1)}" cy="${r1(B.hy+30)}" r="6.4"/><circle cx="${r1(100-B.hrx-2)}" cy="${r1(B.hy+43)}" r="5.8"/><circle cx="${r1(100+B.hrx)}" cy="${r1(B.hy+16)}" r="7"/><circle cx="${r1(100+B.hrx+1)}" cy="${r1(B.hy+30)}" r="6.4"/><circle cx="${r1(100+B.hrx+2)}" cy="${r1(B.hy+43)}" r="5.8"/></g><circle cx="${r1(100-B.hrx)}" cy="${r1(B.hy+11)}" r="3.4" fill="${tieC}"/><circle cx="${r1(100+B.hrx)}" cy="${r1(B.hy+11)}" r="3.4" fill="${tieC}"/>`;
    else if (st === 'bob') hairFront = capShort + `<path d="M${r1(100-B.hrx)} ${r1(B.hy-12)} Q${r1(100-B.hrx+2)} ${r1(B.hy+16)} ${r1(100-B.hrx+7)} ${r1(B.hy+20)} L${r1(100-B.hrx+12)} ${r1(B.hy-16)}Z" fill="${hairC}"/><path d="M${r1(100+B.hrx)} ${r1(B.hy-12)} Q${r1(100+B.hrx-2)} ${r1(B.hy+16)} ${r1(100+B.hrx-7)} ${r1(B.hy+20)} L${r1(100+B.hrx-12)} ${r1(B.hy-16)}Z" fill="${hairC}"/>`;
    else hairFront = capShort;

    /* ── کلاه / ویزور / باکت / روسری ── */
    let hatSvg = '';
    const brimY = B.hy - B.hry * 0.40;
    if (hat.type === 'cap'){
      hatSvg = `<path d="M${r1(100-B.hrx-1)} ${r1(brimY+3)} Q${r1(100-B.hrx)} ${r1(crown-11)} 100 ${r1(crown-9)} Q${r1(100+B.hrx)} ${r1(crown-11)} ${r1(100+B.hrx+1)} ${r1(brimY+3)} Z" fill="${hat.c1}"/>
        <path d="M${r1(100-B.hrx-3)} ${r1(brimY+1)} L${r1(100+B.hrx+3)} ${r1(brimY+1)} L${r1(100+B.hrx+22)} ${r1(brimY+6)} Q${r1(100+B.hrx+24)} ${r1(brimY+11)} ${r1(100+B.hrx+16)} ${r1(brimY+11)} L${r1(100-B.hrx-3)} ${r1(brimY+9)} Z" fill="${dark(hat.c1,18)}"/>
        <circle cx="100" cy="${r1(crown-7)}" r="4" fill="${hat.c2}"/>
        <rect x="${r1(100-13)}" y="${r1(brimY-14)}" width="26" height="8.5" rx="3" fill="${hat.c2}" opacity=".92"/>`;
    } else if (hat.type === 'visor'){
      hatSvg = `<path d="M${r1(100-B.hrx-1)} ${r1(brimY-4)} Q100 ${r1(brimY-11)} ${r1(100+B.hrx+1)} ${r1(brimY-4)} L${r1(100+B.hrx+1)} ${r1(brimY+4)} Q100 ${r1(brimY-3)} ${r1(100-B.hrx-1)} ${r1(brimY+4)} Z" fill="${hat.c1}"/>
        <path d="M${r1(100-B.hrx-2)} ${r1(brimY+4)} L${r1(100+B.hrx+4)} ${r1(brimY+4)} L${r1(100+B.hrx+20)} ${r1(brimY+9)} Q${r1(100+B.hrx+22)} ${r1(brimY+13)} ${r1(100+B.hrx+14)} ${r1(brimY+13)} L${r1(100-B.hrx-2)} ${r1(brimY+11)} Z" fill="${dark(hat.c1,16)}"/>
        <rect x="${r1(100-11)}" y="${r1(brimY-5)}" width="22" height="7" rx="3" fill="${hat.c2}"/>`;
    } else if (hat.type === 'bucket'){
      hatSvg = `<path d="M${r1(100-B.hrx+1)} ${r1(brimY+2)} Q${r1(100-B.hrx)} ${r1(crown-12)} 100 ${r1(crown-10)} Q${r1(100+B.hrx)} ${r1(crown-12)} ${r1(100+B.hrx-1)} ${r1(brimY+2)} Z" fill="${hat.c1}"/>
        <path d="M${r1(100-B.hrx-12)} ${r1(brimY+2)} Q100 ${r1(brimY-7)} ${r1(100+B.hrx+12)} ${r1(brimY+2)} Q${r1(100+B.hrx+14)} ${r1(brimY+13)} ${r1(100+B.hrx+7)} ${r1(brimY+15)} Q100 ${r1(brimY+7)} ${r1(100-B.hrx-7)} ${r1(brimY+15)} Q${r1(100-B.hrx-14)} ${r1(brimY+13)} ${r1(100-B.hrx-12)} ${r1(brimY+2)}Z" fill="${dark(hat.c1,14)}"/>
        <rect x="${r1(100-15)}" y="${r1(brimY-8)}" width="30" height="7.5" rx="3.5" fill="${hat.c2}"/>`;
    } else if (hat.type === 'scarf'){
      hatSvg = `<path d="M${r1(100-B.hrx-3)} ${r1(B.hy+4)} Q${r1(100-B.hrx-4)} ${r1(crown-7)} 100 ${r1(crown-7)} Q${r1(100+B.hrx+4)} ${r1(crown-7)} ${r1(100+B.hrx+3)} ${r1(B.hy+4)} Q${r1(100+B.hrx+3)} ${r1(B.hy+22)} ${r1(100+B.hrx-7)} ${r1(B.hy+28)} L${r1(100+B.hrx-13)} ${r1(B.hy-4)} Q100 ${r1(B.hy-18)} ${r1(100-B.hrx+13)} ${r1(B.hy-4)} L${r1(100-B.hrx+7)} ${r1(B.hy+28)} Q${r1(100-B.hrx-3)} ${r1(B.hy+22)} ${r1(100-B.hrx-3)} ${r1(B.hy+4)}Z" fill="${hat.c1}"/>
        <path d="M${r1(100-B.hrx+7)} ${r1(B.hy+22)} Q${r1(100-B.hrx+3)} ${r1(B.nk1+20)} ${r1(100-B.nkw-17)} ${r1(B.nk1+32)} L${r1(100+B.nkw+17)} ${r1(B.nk1+32)} Q${r1(100+B.hrx-3)} ${r1(B.nk1+20)} ${r1(100+B.hrx-7)} ${r1(B.hy+22)} Q${r1(100+B.hrx-15)} ${r1(B.hy+4)} 100 ${r1(B.hy+5)} Q${r1(100-B.hrx+15)} ${r1(B.hy+4)} ${r1(100-B.hrx+7)} ${r1(B.hy+22)}Z" fill="${light(hat.c1,6)}"/>
        <path d="M${r1(100-B.hrx+4)} ${r1(B.hy+30)} Q100 ${r1(B.hy+42)} ${r1(100+B.hrx-4)} ${r1(B.hy+30)}" stroke="${hat.c2}" stroke-width="3.6" fill="none" opacity=".85"/>`;
    }

    /* ── پیراهن پولو (یقه + دکمه) + الگوها ── */
    const torsoPath = `M${r1(100-B.sw)} ${r1(B.sy+10)} Q${r1(100-B.sw)} ${r1(B.sy)} 100 ${r1(B.sy-5)} Q${r1(100+B.sw)} ${r1(B.sy)} ${r1(100+B.sw)} ${r1(B.sy+10)} L${r1(100+B.ww+6)} ${r1(B.wy)} Q100 ${r1(B.wy+9)} ${r1(100-B.ww-6)} ${r1(B.wy)} Z`;
    let shirtPat = '';
    if (shirt.pat === 'stripe'){
      shirtPat = `<g clip-path="url(#${g}body)" opacity=".9">
        <rect x="${r1(100-B.ww)}" y="${r1(B.sy)}" width="6" height="${r1(B.wy-B.sy+12)}" fill="${shirt.c2}"/>
        <rect x="${r1(100-3)}"     y="${r1(B.sy)}" width="6" height="${r1(B.wy-B.sy+12)}" fill="${shirt.c2}"/>
        <rect x="${r1(100+B.ww-6)}" y="${r1(B.sy)}" width="6" height="${r1(B.wy-B.sy+12)}" fill="${shirt.c2}"/></g>`;
    } else if (shirt.pat === 'block'){
      const mid = (B.sy + B.wy) / 2;
      shirtPat = `<g clip-path="url(#${g}body)"><path d="M${r1(100-B.sw-4)} ${r1(mid-6)} L${r1(100+B.sw+4)} ${r1(mid-14)} L${r1(100+B.sw+4)} ${r1(mid+12)} L${r1(100-B.sw-4)} ${r1(mid+20)} Z" fill="${shirt.c2}" opacity=".95"/></g>`;
    } else if (shirt.pat === 'argyle'){
      const mid = (B.sy + B.wy) / 2;
      shirtPat = `<g clip-path="url(#${g}body)" opacity=".55" fill="${shirt.c2}">
        <path d="M${r1(100-B.ww)} ${r1(B.sy+18)} L${r1(100-B.ww+13)} ${r1(B.sy+36)} L${r1(100-B.ww)} ${r1(B.sy+54)} L${r1(100-B.ww-13)} ${r1(B.sy+36)} Z"/>
        <path d="M${r1(100+B.ww)} ${r1(B.sy+18)} L${r1(100+B.ww+13)} ${r1(B.sy+36)} L${r1(100+B.ww)} ${r1(B.sy+54)} L${r1(100+B.ww-13)} ${r1(B.sy+36)} Z"/>
        <path d="M100 ${r1(mid-8)} L${r1(100+13)} ${r1(mid+10)} L100 ${r1(mid+28)} L${r1(100-13)} ${r1(mid+10)} Z"/></g>`;
    } else if (shirt.pat === 'zip'){
      shirtPat = `<g clip-path="url(#${g}body)"><rect x="${r1(100-3.5)}" y="${r1(B.sy-4)}" width="7" height="${r1(B.wy-B.sy+10)}" fill="${shirt.c2}" opacity=".9"/>
        <circle cx="100" cy="${r1(B.sy+16)}" r="3.6" fill="${light(shirt.c2,25)}"/></g>`;
    }
    const collar = `<path d="M${r1(100-B.nkw-4)} ${r1(B.sy-3)} L100 ${r1(B.sy+13)} L${r1(100+B.nkw+4)} ${r1(B.sy-3)} L${r1(100+B.nkw+10)} ${r1(B.sy+8)} L100 ${r1(B.sy+17)} L${r1(100-B.nkw-10)} ${r1(B.sy+8)} Z" fill="${light(shirt.c1,8)}" stroke="rgba(0,0,0,.14)" stroke-width="1"/>
      <rect x="98.8" y="${r1(B.sy+12)}" width="2.4" height="17" fill="${shirt.c2}"/>
      <circle cx="100" cy="${r1(B.sy+17)}" r="1.7" fill="${light(shirt.c2,20)}"/><circle cx="100" cy="${r1(B.sy+25)}" r="1.7" fill="${light(shirt.c2,20)}"/>`;

    /* ── آستین + بازو + دست ── */
    const sleeve = `<path d="M${r1(100-B.sw+2)} ${r1(B.sy+6)} Q${r1(100-B.sw-8)} ${r1(B.sy+11)} ${r1(100-B.sw-7)} ${r1(B.at+12)} L${r1(100-B.sw+6)} ${r1(B.at+17)} Q${r1(100-B.sw+5)} ${r1(B.sy+12)} Z" fill="${dark(shirt.c1,8)}"/>
      <path d="M${r1(100+B.sw-2)} ${r1(B.sy+6)} Q${r1(100+B.sw+8)} ${r1(B.sy+11)} ${r1(100+B.sw+7)} ${r1(B.at+12)} L${r1(100+B.sw-6)} ${r1(B.at+17)} Q${r1(100+B.sw-5)} ${r1(B.sy+12)} Z" fill="${dark(shirt.c1,8)}"/>`;
    const armL = `<path d="M${r1(100-B.sw-6)} ${r1(B.at+13)} Q${r1(100-B.sw-6)} ${r1(B.at+26)} ${r1(handL-7)} ${r1(B.ae)} L${r1(handL+7)} ${r1(B.ae)} Q${r1(100-B.sw+6)} ${r1(B.at+28)} ${r1(100-B.sw+6)} ${r1(B.at+17)} Z" fill="${skin}"/>`;
    const armR = `<path d="M${r1(100+B.sw+6)} ${r1(B.at+13)} Q${r1(100+B.sw+6)} ${r1(B.at+26)} ${r1(handR+7)} ${r1(B.ae)} L${r1(handR-7)} ${r1(B.ae)} Q${r1(100+B.sw-6)} ${r1(B.at+28)} ${r1(100+B.sw-6)} ${r1(B.at+17)} Z" fill="${skin}"/>`;
    const hands = `<circle cx="${handL}" cy="${r1(B.ae+3)}" r="${B.hd}" fill="${skin}"/><circle cx="${handR}" cy="${r1(B.ae+3)}" r="${B.hd}" fill="${skin}"/>`;

    /* ── دستکش / ساعت ── */
    const gloveSvg = (glove.type === 'none') ? '' :
      `<circle cx="${handL}" cy="${r1(B.ae+3)}" r="${B.hd+1.4}" fill="${glove.c1 || '#fff'}" stroke="rgba(0,0,0,.2)"/>`;
    let watchSvg = '';
    if (watch.type && watch.type !== 'none'){
      const w1 = watch.c1 || '#2A2F3A', w2 = watch.c2 || '#5FE3B0';
      watchSvg = `<g><rect x="${r1(handL-8)}" y="${r1(B.ae-13)}" width="16" height="11" rx="4" fill="${w1}" stroke="rgba(0,0,0,.25)"/>
        <rect x="${r1(handL-4.5)}" y="${r1(B.ae-10.5)}" width="9" height="6" rx="2.4" fill="${w2}" opacity=".95"/></g>`;
    }

    /* ── شلوار / دامن چین‌دار ── */
    let legs = '';
    if (pants.skirt){
      const hem = B.wy + (isChild ? 50 : 58);
      const p1 = r1(100 - B.ww * 0.5), p2 = 100, p3 = r1(100 + B.ww * 0.5);
      legs = `<path d="M${r1(100-B.ww-7)} ${r1(B.wy-2)} L${r1(100+B.ww+7)} ${r1(B.wy-2)} L${r1(100+B.ww+17)} ${r1(hem)} Q100 ${r1(hem+9)} ${r1(100-B.ww-17)} ${r1(hem)} Z" fill="${pants.c1}"/>
        <g stroke="${dark(pants.c1,18)}" stroke-width="1.7" opacity=".5"><path d="M${p1} ${r1(B.wy+6)} L${r1(p1-5)} ${r1(hem+3)}"/><path d="M${p2} ${r1(B.wy+6)} L${p2} ${r1(hem+5)}"/><path d="M${p3} ${r1(B.wy+6)} L${r1(p3+5)} ${r1(hem+3)}"/></g>
        <path d="M${r1(100-4)} ${r1(hem-2)} L${r1(100-4)} ${r1(B.ly)} L${r1(100-B.lw-2)} ${r1(B.ly)} L${r1(100-B.lw+1)} ${r1(hem-2)} Z" fill="${skin}"/>
        <path d="M${r1(100+4)} ${r1(hem-2)} L${r1(100+4)} ${r1(B.ly)} L${r1(100+B.lw+2)} ${r1(B.ly)} L${r1(100+B.lw-1)} ${r1(hem-2)} Z" fill="${skin}"/>`;
    } else {
      legs = `<path d="M${r1(100-B.ww-6)} ${r1(B.wy-2)} L${r1(100-B.ww-9)} ${r1(B.ly)} L${r1(100-B.lw-2)} ${r1(B.ly)} L${r1(100-3)} ${r1(B.cr)} L${r1(100+3)} ${r1(B.cr)} L${r1(100+B.lw+2)} ${r1(B.ly)} L${r1(100+B.ww+9)} ${r1(B.ly)} L${r1(100+B.ww+6)} ${r1(B.wy-2)} Q100 ${r1(B.wy+6)} ${r1(100-B.ww-6)} ${r1(B.wy-2)} Z" fill="${pants.c1}"/>
        <rect x="${r1(100-B.ww-6)}" y="${r1(B.wy-2)}" width="${r1(B.ww*2+12)}" height="6" fill="${dark(pants.c1,16)}" opacity=".6"/>
        <path d="M100 ${r1(B.cr+2)} L100 ${r1(B.ly)}" stroke="${dark(pants.c1,20)}" stroke-width="2" opacity=".6"/>`;
    }

    /* ── کفش کتانی (بند + سوزن‌دوخت) ── */
    const fw = isChild ? 17 : 21;
    const inL = 100 - 3, inR = 100 + 3;
    const shoesSvg = `<g>
      <path d="M${inL} ${r1(B.ly-2)} L${r1(inL-1)} ${r1(B.fy-5)} L${r1(inL-fw-5)} ${r1(B.fy-5)} Q${r1(inL-fw-11)} ${r1(B.fy-5)} ${r1(inL-fw-9)} ${r1(B.fy-11)} Q${r1(inL-fw-5)} ${r1(B.ly+4)} ${r1(inL-fw+2)} ${r1(B.ly-2)} Z" fill="${shoes.c1}" stroke="rgba(0,0,0,.18)"/>
      <path d="M${inR} ${r1(B.ly-2)} L${r1(inR+1)} ${r1(B.fy-5)} L${r1(inR+fw+5)} ${r1(B.fy-5)} Q${r1(inR+fw+11)} ${r1(B.fy-5)} ${r1(inR+fw+9)} ${r1(B.fy-11)} Q${r1(inR+fw+5)} ${r1(B.ly+4)} ${r1(inR+fw-2)} ${r1(B.ly-2)} Z" fill="${shoes.c1}" stroke="rgba(0,0,0,.18)"/>
      <path d="M${r1(inL-fw-10)} ${r1(B.fy-6)} L${r1(inL+1)} ${r1(B.fy-6)} L${r1(inL+1)} ${r1(B.fy)} L${r1(inL-fw-9)} ${r1(B.fy)} Q${r1(inL-fw-13)} ${r1(B.fy-2)} ${r1(inL-fw-10)} ${r1(B.fy-6)}Z" fill="${shoes.c2}"/>
      <path d="M${r1(inR+fw+10)} ${r1(B.fy-6)} L${r1(inR-1)} ${r1(B.fy-6)} L${r1(inR-1)} ${r1(B.fy)} L${r1(inR+fw+9)} ${r1(B.fy)} Q${r1(inR+fw+13)} ${r1(B.fy-2)} ${r1(inR+fw+10)} ${r1(B.fy-6)}Z" fill="${shoes.c2}"/>
      <g stroke="${dark(shoes.c1,26)}" stroke-width="1.8" stroke-linecap="round">
        <path d="M${r1(inL-fw+4)} ${r1(B.ly+8)} L${r1(inL-fw+13)} ${r1(B.ly+13)}"/><path d="M${r1(inL-fw+3)} ${r1(B.ly+17)} L${r1(inL-fw+11)} ${r1(B.ly+22)}"/>
        <path d="M${r1(inR+fw-4)} ${r1(B.ly+8)} L${r1(inR+fw-13)} ${r1(B.ly+13)}"/><path d="M${r1(inR+fw-3)} ${r1(B.ly+17)} L${r1(inR+fw-11)} ${r1(B.ly+22)}"/></g></g>`;

    /* ── عینک ── */
    let glassSvg = '';
    if (glass.type === 'sport'){
      glassSvg = `<path d="M${r1(100-eDX-13)} ${r1(eyeY-8)} Q100 ${r1(eyeY-14)} ${r1(100+eDX+13)} ${r1(eyeY-8)} Q${r1(100+eDX+15)} ${r1(eyeY+8)} ${r1(100+eDX-4)} ${r1(eyeY+10)} Q100 ${r1(eyeY+13)} ${r1(100-eDX+4)} ${r1(eyeY+10)} Q${r1(100-eDX-15)} ${r1(eyeY+8)} ${r1(100-eDX-13)} ${r1(eyeY-8)}Z" fill="${glass.c1}" opacity=".92"/>
        <path d="M${r1(100-eDX-13)} ${r1(eyeY-8)} Q100 ${r1(eyeY-13)} ${r1(100+eDX+13)} ${r1(eyeY-8)}" stroke="rgba(255,255,255,.45)" stroke-width="2" fill="none"/>`;
    } else if (glass.type === 'classic'){
      glassSvg = `<g fill="none" stroke="${glass.c1}" stroke-width="3.4">
        <rect x="${r1(100-eDX-12)}" y="${r1(eyeY-9)}" width="24" height="18" rx="7" fill="rgba(20,26,33,.6)"/>
        <rect x="${r1(100+eDX-12)}" y="${r1(eyeY-9)}" width="24" height="18" rx="7" fill="rgba(20,26,33,.6)"/>
        <path d="M${r1(100-eDX+12)} ${r1(eyeY-1)} L${r1(100+eDX-12)} ${r1(eyeY-1)}"/></g>`;
    }

    /* ── چوب گلف ── */
    let clubSvg = '';
    if (club.type === 'iron' || club.type === 'putter' || club.type === 'driver'){
      const headW = club.type === 'driver' ? 22 : club.type === 'putter' ? 20 : 14;
      clubSvg = `<g><rect x="163" y="120" width="4" height="196" rx="2" fill="#C9D4DE"/>
        <rect x="161" y="118" width="8" height="34" rx="4" fill="#222A33"/>
        <${club.type === 'driver' ? `ellipse cx="${168+headW/2}" cy="322" rx="${headW}" ry="13"` : `rect x="160" y="312" width="${headW+8}" height="10" rx="3"`} fill="${club.c1}" stroke="rgba(0,0,0,.3)"/></g>`;
    } else if (club.type === 'bag'){
      clubSvg = `<g><rect x="150" y="150" width="34" height="150" rx="15" fill="${club.c1}" stroke="rgba(0,0,0,.25)"/>
        <rect x="150" y="182" width="34" height="16" fill="rgba(255,255,255,.18)"/>
        <g stroke="#C9D4DE" stroke-width="3"><path d="M158 150 L154 112"/><path d="M167 150 L167 108"/><path d="M176 150 L182 112"/></g>
        <circle cx="154" cy="112" r="5" fill="#2A2F3A"/><circle cx="167" cy="108" r="5" fill="#2A2F3A"/><circle cx="182" cy="112" r="5" fill="#2A2F3A"/></g>`;
    }

    /* ── ساک گلف (پشت بدن) ── */
    let bagSvg = '';
    if (bag.type && bag.type !== 'none'){
      const b1 = bag.c1 || '#1E8F6A', b2 = bag.c2 || light(b1, 18);
      bagSvg = `<g><rect x="150" y="146" width="36" height="156" rx="16" fill="${b1}" stroke="rgba(0,0,0,.3)"/>
        <rect x="150" y="180" width="36" height="18" fill="${b2}" opacity=".9"/>
        <rect x="150" y="238" width="36" height="10" fill="rgba(255,255,255,.14)"/>
        <g stroke="#C9D4DE" stroke-width="3"><path d="M158 146 L154 106"/><path d="M168 146 L168 102"/><path d="M178 146 L184 106"/></g>
        <circle cx="154" cy="106" r="5" fill="#2A2F3A"/><circle cx="168" cy="102" r="5" fill="#2A2F3A"/><circle cx="184" cy="106" r="5" fill="#2A2F3A"/></g>`;
    }

    /* ── توپ / فاصله‌یاب ── */
    let ballSvg = '';
    if (ball.type === 'ball'){
      ballSvg = `<g><ellipse cx="34" cy="348" rx="11" ry="4" fill="rgba(0,0,0,.35)"/>
        <circle cx="34" cy="340" r="9" fill="${ball.c1 || '#fff'}" stroke="rgba(0,0,0,.2)"/>
        <circle cx="31" cy="337" r="1.5" fill="${dark(ball.c1 || '#fff', 12)}"/><circle cx="37" cy="339" r="1.5" fill="${dark(ball.c1 || '#fff', 12)}"/>
        <path d="M28 346 Q34 350 40 346" stroke="${ball.c2 || '#1E8F6A'}" stroke-width="2" fill="none"/></g>`;
    } else if (ball.type === 'range'){
      ballSvg = `<g><rect x="22" y="326" width="30" height="18" rx="6" fill="${ball.c1 || '#15181C'}" stroke="rgba(0,0,0,.3)"/>
        <circle cx="31" cy="335" r="5" fill="${ball.c2 || '#D4AF37'}" opacity=".9"/><circle cx="45" cy="335" r="3.4" fill="#0B0F14"/></g>`;
    }

    /* ── صورت: چشم بزرگ، ابرو، بینی، لبخند نرم ── */
    const eyeShine = eyeIt.shine ? `<circle cx="${r1(100-eDX)}" cy="${r1(eyeY)}" r="8" fill="${eyeIt.c1}" opacity=".28"/><circle cx="${r1(100+eDX)}" cy="${r1(eyeY)}" r="8" fill="${eyeIt.c1}" opacity=".28"/>` : '';
    const lashes = femAv ? `<path d="M${r1(100-eDX-7)} ${r1(eyeY-7)} l-3 -2.6 M${r1(100-eDX-9)} ${r1(eyeY-3)} l-3.4 -1.4" stroke="${dark(hairC,10)}" stroke-width="1.6" stroke-linecap="round"/><path d="M${r1(100+eDX+7)} ${r1(eyeY-7)} l3 -2.6 M${r1(100+eDX+9)} ${r1(eyeY-3)} l3.4 -1.4" stroke="${dark(hairC,10)}" stroke-width="1.6" stroke-linecap="round"/>` : '';
    const blush = `<ellipse cx="${r1(100-B.hrx+14)}" cy="${r1(eyeY+17)}" rx="6.4" ry="3.6" fill="#E8907A" opacity=".2"/><ellipse cx="${r1(100+B.hrx-14)}" cy="${r1(eyeY+17)}" rx="6.4" ry="3.6" fill="#E8907A" opacity=".2"/>`;
    const face = `<g>
        ${eyeShine}
        <ellipse cx="${r1(100-eDX)}" cy="${r1(eyeY)}" rx="7" ry="8.6" fill="#fff"/>
        <ellipse cx="${r1(100+eDX)}" cy="${r1(eyeY)}" rx="7" ry="8.6" fill="#fff"/>
        <circle cx="${r1(100-eDX)}" cy="${r1(eyeY+1)}" r="4.4" fill="${eyeIt.c1}"/><circle cx="${r1(100+eDX)}" cy="${r1(eyeY+1)}" r="4.4" fill="${eyeIt.c1}"/>
        <circle cx="${r1(100-eDX)}" cy="${r1(eyeY+1)}" r="2.2" fill="#14100c" opacity=".85"/><circle cx="${r1(100+eDX)}" cy="${r1(eyeY+1)}" r="2.2" fill="#14100c" opacity=".85"/>
        <circle cx="${r1(100-eDX+1.6)}" cy="${r1(eyeY-1.6)}" r="1.7" fill="#fff"/><circle cx="${r1(100+eDX+1.6)}" cy="${r1(eyeY-1.6)}" r="1.7" fill="#fff"/>
        ${lashes}
        <path d="M${r1(100-eDX-7)} ${r1(eyeY-13)} Q${r1(100-eDX)} ${r1(eyeY-17)} ${r1(100-eDX+7)} ${r1(eyeY-13)}" stroke="${dark(hairC,10)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        <path d="M${r1(100+eDX-7)} ${r1(eyeY-13)} Q${r1(100+eDX)} ${r1(eyeY-17)} ${r1(100+eDX+7)} ${r1(eyeY-13)}" stroke="${dark(hairC,10)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        ${blush}
      </g>
      <path d="M${r1(100-3.4)} ${r1(B.hy+12)} Q100 ${r1(B.hy+17)} ${r1(100+3.4)} ${r1(B.hy+13)}" stroke="${dark(skin,22)}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M${r1(100-11)} ${r1(B.hy+23)} Q100 ${r1(B.hy+31)} ${r1(100+11)} ${r1(B.hy+23)}" stroke="${dark(skin,28)}" stroke-width="2.7" fill="none" stroke-linecap="round"/>`
      + (femAv ? `<path d="M${r1(100-9.5)} ${r1(B.hy+22)} Q100 ${r1(B.hy+30.5)} ${r1(100+9.5)} ${r1(B.hy+22)} Q100 ${r1(B.hy+26)} ${r1(100-9.5)} ${r1(B.hy+22)}Z" fill="#C0546A" opacity=".85"/>` : '');

    /* ── اکسسوری‌ها کنار بدن: برای بچه ۸۴٪ کوچک‌تر، لنگر روی زمین ── */
    const accOpen  = isChild ? `<g transform="translate(24.3 59.5) scale(0.84)">` : '';
    const accClose = isChild ? `</g>` : '';

    return `<svg class="av-svg" viewBox="0 0 200 360" width="${opt.w || 190}" height="${opt.h || 342}" style="overflow:visible">
      <defs>
        <clipPath id="${g}body"><path d="${torsoPath}"/></clipPath>
        <linearGradient id="${g}sh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${light(shirt.c1,10)}"/><stop offset="1" stop-color="${dark(shirt.c1,10)}"/></linearGradient>
        <radialGradient id="${g}fc" cx="38%" cy="28%" r="78%">
          <stop offset="0" stop-color="${light(skin,10)}"/><stop offset="1" stop-color="${dark(skin,9)}"/></radialGradient>
      </defs>
      <ellipse cx="100" cy="${ground+1}" rx="${isChild ? 48 : 58}" ry="8.5" fill="rgba(0,0,0,.4)"/>
      ${accOpen}${bagSvg}${accClose}
      ${hairBack}
      ${legs}${shoesSvg}
      <path d="${torsoPath}" fill="url(#${g}sh)" stroke="rgba(0,0,0,.15)"/>
      ${shirtPat}
      ${sleeve}${armL}${armR}${hands}${gloveSvg}${watchSvg}
      ${accOpen}${clubSvg}${ballSvg}${accClose}
      <path d="M${r1(100-B.nkw)} ${r1(B.nk0)} L${r1(100+B.nkw)} ${r1(B.nk0)} L${r1(100+B.nkw)} ${r1(B.nk1+6)} Q100 ${r1(B.nk1+12)} ${r1(100-B.nkw)} ${r1(B.nk1+6)} Z" fill="${dark(skin,11)}"/>
      ${collar}
      <ellipse cx="100" cy="${B.hy}" rx="${B.hrx}" ry="${B.hry}" fill="url(#${g}fc)"/>
      <ellipse cx="${r1(100-B.hrx-1)}" cy="${r1(B.hy+3)}" rx="5" ry="6.5" fill="${dark(skin,4)}"/>
      <ellipse cx="${r1(100+B.hrx+1)}" cy="${r1(B.hy+3)}" rx="5" ry="6.5" fill="${dark(skin,4)}"/>
      ${hairFront}
      ${hatSvg}
      ${face}
      ${glassSvg}
    </svg>`;
  }

  /* روشن/تیره کردن رنگ hex */
  function shade(hex, p){
    const h = String(hex || '#888').replace('#','');
    const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    let r = parseInt(n.slice(0,2),16), gg = parseInt(n.slice(2,4),16), b = parseInt(n.slice(4,6),16);
    if (isNaN(r)) return hex;
    const f = v => Math.max(0, Math.min(255, Math.round(v + (p/100) * 255)));
    return '#' + [f(r), f(gg), f(b)].map(v => v.toString(16).padStart(2,'0')).join('');
  }

  /* ═════════ ۷٫۵) آیکن پیش‌نمایش آیتم فروشگاه ═════════ */
  function itemPreviewSVG(it, w){
    const g = uid();
    const c1 = it.c1 || '#8A93A6', c2 = it.c2 || shade(c1, -22);
    const W = w || 74, H = Math.round(W * 0.68);
    let inner = '';
    if (it.cat === 'shirt'){
      inner = `<path d="M22 12 L34 8 Q40 16 46 8 L58 12 L64 24 L54 28 L54 56 Q40 60 26 56 L26 28 L16 24 Z" fill="${c1}" stroke="rgba(0,0,0,.25)"/>
        <path d="M34 8 Q40 20 46 8 L42 6 Q40 12 38 6 Z" fill="${c2}"/>
        ${it.pat === 'stripe' ? `<g fill="${c2}" opacity=".85"><rect x="30" y="20" width="4" height="38"/><rect x="38" y="20" width="4" height="38"/><rect x="46" y="20" width="4" height="38"/></g>` : ''}
        ${it.pat === 'block' ? `<path d="M26 40 L54 36 L54 46 L26 50 Z" fill="${c2}"/>` : ''}
        ${it.pat === 'argyle' ? `<g fill="${c2}" opacity=".6"><path d="M34 26 L40 34 L34 42 L28 34 Z"/><path d="M48 30 L54 38 L48 46 L42 38 Z"/></g>` : ''}
        ${it.pat === 'zip' ? `<rect x="38" y="10" width="4" height="48" fill="${c2}"/>` : ''}`;
    } else if (it.cat === 'pants'){
      inner = it.skirt
        ? `<path d="M28 8 L52 8 L62 54 Q40 60 18 54 Z" fill="${c1}" stroke="rgba(0,0,0,.25)"/>`
        : `<path d="M26 8 L54 8 L52 58 L42 58 L40 30 L38 58 L28 58 Z" fill="${c1}" stroke="rgba(0,0,0,.25)"/>`;
    } else if (it.cat === 'shoes'){
      inner = `<path d="M14 42 L34 42 Q40 42 46 48 L60 52 Q64 54 64 58 L14 58 Z" fill="${c1}" stroke="rgba(0,0,0,.25)"/>
        <rect x="14" y="54" width="50" height="6" rx="3" fill="${c2}"/>`;
    } else if (it.cat === 'hat'){
      if (it.type === 'none') inner = `<text x="40" y="42" text-anchor="middle" font-size="20" fill="#8A93A6">—</text>`;
      else if (it.type === 'visor') inner = `<path d="M18 34 Q40 24 62 34 L62 40 Q40 32 18 40Z" fill="${c1}"/><path d="M14 40 L70 40 Q74 44 70 48 L14 48Z" fill="${c2}"/>`;
      else if (it.type === 'bucket') inner = `<path d="M22 30 Q26 12 40 12 Q54 12 58 30 L58 36 L22 36Z" fill="${c1}"/><path d="M12 36 Q40 28 68 36 Q70 46 64 50 Q40 42 16 50 Q10 46 12 36Z" fill="${c2}"/>`;
      else if (it.type === 'scarf') inner = `<path d="M18 34 Q18 10 40 10 Q62 10 62 34 Q62 50 54 56 L26 56 Q18 50 18 34Z" fill="${c1}"/><path d="M22 42 Q40 50 58 42" stroke="${c2}" stroke-width="4" fill="none"/>`;
      else inner = `<path d="M20 32 Q24 12 40 12 Q56 12 60 32 L60 38 L20 38Z" fill="${c1}"/><path d="M20 38 L72 38 Q76 42 72 46 L20 46Z" fill="${c2}"/><circle cx="40" cy="20" r="4" fill="${c2}"/>`;
    } else if (it.cat === 'glove'){
      inner = it.type === 'none' ? `<text x="40" y="42" text-anchor="middle" font-size="20" fill="#8A93A6">—</text>`
        : `<path d="M28 18 L28 40 L24 44 Q22 56 34 58 L48 58 Q56 54 56 44 L56 20 Q52 16 50 20 L50 34 L48 20 Q44 16 42 20 L42 34 L40 18 Q36 14 34 18 L34 36 Z" fill="${c1}" stroke="rgba(0,0,0,.25)"/>`;
    } else if (it.cat === 'glass'){
      inner = it.type === 'none' ? `<text x="40" y="42" text-anchor="middle" font-size="20" fill="#8A93A6">—</text>`
        : it.type === 'sport' ? `<path d="M12 30 Q40 20 68 30 Q70 44 54 46 Q40 48 26 46 Q10 44 12 30Z" fill="${c1}"/>`
        : `<g fill="rgba(20,26,33,.7)" stroke="${c1}" stroke-width="4"><rect x="10" y="26" width="24" height="18" rx="6"/><rect x="46" y="26" width="24" height="18" rx="6"/><path d="M34 34 L46 34"/></g>`;
    } else if (it.cat === 'club'){
      if (it.type === 'none') inner = `<text x="40" y="42" text-anchor="middle" font-size="20" fill="#8A93A6">—</text>`;
      else if (it.type === 'bag') inner = `<rect x="28" y="16" width="24" height="42" rx="11" fill="${c1}" stroke="rgba(0,0,0,.3)"/><g stroke="#C9D4DE" stroke-width="3"><path d="M34 16 L30 4"/><path d="M40 16 L40 2"/><path d="M46 16 L50 4"/></g>`;
      else if (it.type === 'driver') inner = `<rect x="38" y="6" width="4" height="42" fill="#C9D4DE"/><ellipse cx="46" cy="52" rx="14" ry="8" fill="${c1}" stroke="rgba(0,0,0,.3)"/>`;
      else inner = `<rect x="38" y="6" width="4" height="44" fill="#C9D4DE"/><rect x="30" y="50" width="24" height="8" rx="3" fill="${c1}" stroke="rgba(0,0,0,.3)"/>`;
    } else if (it.cat === 'bag'){
      inner = it.type === 'none' ? `<text x="40" y="42" text-anchor="middle" font-size="20" fill="#8A93A6">—</text>`
        : `<rect x="26" y="14" width="28" height="46" rx="13" fill="${c1}" stroke="rgba(0,0,0,.3)"/>
           <rect x="26" y="30" width="28" height="9" fill="${c2}" opacity=".85"/>
           <g stroke="#C9D4DE" stroke-width="3"><path d="M33 14 L29 2"/><path d="M40 14 L40 0"/><path d="M47 14 L51 2"/></g>
           <circle cx="29" cy="3" r="4" fill="#2A2F3A"/><circle cx="40" cy="1" r="4" fill="#2A2F3A"/><circle cx="51" cy="3" r="4" fill="#2A2F3A"/>`;
    } else if (it.cat === 'ball'){
      inner = it.type === 'none' ? `<text x="40" y="42" text-anchor="middle" font-size="20" fill="#8A93A6">—</text>`
        : it.type === 'range'
          ? `<rect x="18" y="22" width="44" height="24" rx="7" fill="${c1}" stroke="rgba(0,0,0,.3)"/>
             <circle cx="30" cy="34" r="7" fill="${c2}" opacity=".9"/><circle cx="52" cy="34" r="5" fill="#0B0F14"/>`
          : `<circle cx="40" cy="34" r="19" fill="${c1}" stroke="rgba(0,0,0,.22)"/>
             <g fill="${shade(c1,-14)}" opacity=".7"><circle cx="34" cy="28" r="2.2"/><circle cx="44" cy="27" r="2.2"/><circle cx="40" cy="36" r="2.2"/><circle cx="31" cy="38" r="2.2"/><circle cx="49" cy="36" r="2.2"/></g>
             <path d="M28 46 Q40 52 52 46" stroke="${c2}" stroke-width="3" fill="none" opacity=".8"/>`;
    } else if (it.cat === 'watch'){
      inner = it.type === 'none' ? `<text x="40" y="42" text-anchor="middle" font-size="20" fill="#8A93A6">—</text>`
        : `<rect x="34" y="8" width="12" height="20" rx="4" fill="${shade(c1,-10)}"/>
           <rect x="34" y="40" width="12" height="20" rx="4" fill="${shade(c1,-10)}"/>
           <rect x="26" y="24" width="28" height="22" rx="7" fill="${c1}" stroke="rgba(0,0,0,.3)"/>
           <rect x="30" y="28" width="20" height="14" rx="4" fill="${c2}" opacity=".9"/>`;
    } else if (it.cat === 'hair'){
      const st2 = it.style || 'short';
      inner = `<ellipse cx="40" cy="40" rx="20" ry="22" fill="#EBBE8F"/>` + (
        st2 === 'long' || st2 === 'bob' ? `<path d="M18 40 Q16 12 40 12 Q64 12 62 40 L62 58 L54 58 Q56 30 40 30 Q24 30 26 58 L18 58Z" fill="${c1}"/>`
        : st2 === 'curly' ? `<g fill="${c1}"><circle cx="26" cy="26" r="9"/><circle cx="40" cy="20" r="10"/><circle cx="54" cy="26" r="9"/></g>`
        : st2 === 'pony' ? `<path d="M18 36 Q18 12 40 12 Q62 12 62 36 Q54 22 40 22 Q26 22 18 36Z" fill="${c1}"/><path d="M62 30 Q76 40 70 58 L62 56 Q68 42 58 34Z" fill="${c1}"/>`
        : st2 === 'bun' ? `<circle cx="40" cy="8" r="8" fill="${c1}"/><path d="M18 36 Q18 14 40 14 Q62 14 62 36 Q54 24 40 24 Q26 24 18 36Z" fill="${c1}"/>`
        : st2 === 'braid' ? `<path d="M18 36 Q18 12 40 12 Q62 12 62 36 Q54 22 40 22 Q26 22 18 36Z" fill="${c1}"/><g fill="${c1}"><circle cx="16" cy="46" r="6"/><circle cx="16" cy="56" r="6"/><circle cx="64" cy="46" r="6"/><circle cx="64" cy="56" r="6"/></g>`
        : `<path d="M20 36 Q20 14 40 14 Q60 14 60 36 Q52 24 40 24 Q28 24 20 36Z" fill="${c1}"/>`);
    } else if (it.cat === 'eyes'){
      inner = `<ellipse cx="40" cy="34" rx="22" ry="14" fill="#fff" stroke="rgba(0,0,0,.2)"/><circle cx="40" cy="34" r="9" fill="${c1}"/><circle cx="43" cy="31" r="3" fill="#fff"/>`;
    } else if (it.cat === 'skin'){
      inner = `<circle cx="40" cy="34" r="22" fill="${c1}" stroke="rgba(0,0,0,.18)"/><circle cx="33" cy="30" r="2.6" fill="#3a2a1e"/><circle cx="47" cy="30" r="2.6" fill="#3a2a1e"/><path d="M32 42 Q40 48 48 42" stroke="#3a2a1e" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    } else {
      inner = `<rect x="16" y="14" width="48" height="40" rx="8" fill="${c1}"/>`;
    }
    return `<svg viewBox="0 0 80 64" width="${W}" height="${H}" id="${g}" style="display:block;margin:0 auto">${inner}</svg>`;
  }

  /* ═════════ ۸) کارت آواتار سه‌بعدی با رنک ═════════ */
  function particlesHTML(kind, rank){
    if (!kind || kind === 'none') return '';
    const n = kind === 'immortal' ? 16 : 12;
    let h = '';
    for (let i = 0; i < n; i++){
      const x = (i * 37 % 92) + 3, d = (i * 0.37 % 4).toFixed(2), s = (2.8 + (i % 5) * 0.6).toFixed(1);
      const sz = kind === 'emerald' ? 2 : 3 + (i % 3);
      h += `<i style="left:${x}%;width:${sz}px;height:${kind==='emerald'? 16 : sz}px;animation-delay:${d}s;animation-duration:${s}s;background:${i%3===0?rank.light:rank.glow}"></i>`;
    }
    const crown = kind === 'immortal' ? `<b class="av-crown" style="color:${rank.glow}">👑</b>` : '';
    return `<div class="av-parts av-p-${kind}">${h}${crown}</div>`;
  }
  /* o: {user, name, sel, gender, honor, size:'sm|md|lg', showName, id} */
  function rankCard(o){
    const hn = o.honor;
    const r = hn.rank;
    const size = o.size || 'md';
    const w = size === 'sm' ? 120 : size === 'lg' ? 230 : 175;
    const h = Math.round(w * 1.8);
    const bs = +r.badgeSize || 34;
    const idAttr = o.id ? ` id="${o.id}"` : '';
    return `<div class="av-card av-${size} av-div-${r.div}"${idAttr} data-lv="${r.lv}" style="--bg1:${r.bg1};--bg2:${r.bg2};--bg3:${r.bg3};--glow:${r.glow};--lightc:${r.light};--brd:${r.border};--ttl:${r.title}">
      <div class="av-halo"></div>
      ${particlesHTML(r.particle, r)}
      <div class="av-title-row">
        <span class="av-badge-mini">${badgeSVG(r, 26)}</span>
        <span class="av-title-en">${esc(r.en)}</span>
      </div>
      ${o.showName === false ? '' : `<div class="av-name">${esc(o.name || o.user || '')}</div>`}
      <div class="av-title-fa">${esc(r.fa)}</div>
      <div class="av-fig" style="width:${w}px;height:${h}px">
        ${renderAvatarSVG(o.sel, { gender:o.gender, w:w, h:h })}
        <span class="av-chest" style="left:${r.badgeX}%;top:${r.badgeY}%;width:${bs}px;height:${bs}px">${badgeSVG(r, bs)}</span>
      </div>
      <div class="av-foot">
        <span class="av-lv">Level ${r.lv}</span>
        <span class="av-div">${esc(r.divEn)}</span>
      </div>
      <div class="av-upfx"></div>
    </div>`;
  }
  /* انیمیشن ارتقاء رنک روی یک کارت موجود */
  function playRankUp(cardEl, fromLv, toLv){
    if (!cardEl) return;
    const from = rankOf(fromLv || 1), to = rankOf(toLv || 1);
    const fx = cardEl.querySelector('.av-upfx');
    if (!fx) return;
    fx.innerHTML = `
      <div class="av-up-old">${badgeSVG(from, 58)}</div>
      <div class="av-up-new">${badgeSVG(to, 72)}</div>
      <div class="av-up-ring" style="border-color:${to.glow}"></div>
      <div class="av-up-ring r2" style="border-color:${to.light}"></div>
      <div class="av-up-title" style="color:${to.title}">${esc(to.en)}<small>${esc(to.fa)}</small></div>
      ${to.up === 'crown' ? '<div class="av-up-crown">👑</div>' : ''}
      ${to.up === 'burst' || to.up === 'crystal' ? `<div class="av-up-burst">${Array.from({length:14}).map((_,i)=>`<i style="--a:${i*26}deg;background:${i%2?to.glow:to.light}"></i>`).join('')}</div>` : ''}`;
    cardEl.classList.remove('av-upping'); void cardEl.offsetWidth;
    cardEl.classList.add('av-upping');
    setTimeout(() => { cardEl.classList.remove('av-upping'); fx.innerHTML = ''; }, 4200);
  }
  /* آیا کاربر ارتقاء گرفته؟ (سطح ذخیره‌شده < سطح فعلی) */
  function checkRankUp(user, lv){
    const rec = avatarOf(user);
    const old = +rec.lvl || 0;
    if (old && lv > old){ setAvatar(user, { lvl: lv }); return old; }
    if (!old) setAvatar(user, { lvl: lv });
    else if (lv < old) setAvatar(user, { lvl: lv });
    return 0;
  }

  /* ═════════ API ═════════ */
  window.AV = {
    DIVISIONS, PARTICLES, UPFX, RANK_BASE, DIV_SKIN,
    ranks, rankOf, saveRank, resetRanks, levelOfPts, honorOf, setHonorOverride, honorStore,
    badgeSVG, renderAvatarSVG, itemPreviewSVG, rankCard, playRankUp, checkRankUp, particlesHTML, shade,
    BRANDS, CATS, shop, shopAll, shopItem, setShopItem, addShopItem, removeShopItem, resetShop, shopStore,
    itemMeta, cats, catsAll, addCat, setCat, removeCat, brands, setBrand, removeBrand,
    bundles, bundlesAll, addBundle, setBundle, removeBundle, buyBundle,
    cart, cartAdd, cartRemove, cartClear, cartTotal, checkout, favs, toggleFav,
    avatarData, avatarOf, saveAvatars, setAvatar, selectItem, buyItem, DEFAULT_SEL, FREE_IDS, fitsGender,
    coinData, coinOf, addCoins, spendCoins, setAutoProvider, autoOf,
    reqs, reqsOf, pendingReqs, addReq, decideReq, deleteReq, clearDecided,
  };
})();
