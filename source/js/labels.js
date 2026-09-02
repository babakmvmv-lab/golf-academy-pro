/* ═══════════════════════════════════════════════════════════════════
   GolfAcademy PRO — سامانهٔ مرکزی نام‌ها و عنوان‌های رابط کاربری
   هر نام فقط یک کلید دارد؛ تغییر آن در پنل مدیریت روی دسکتاپ، موبایل
   و نسخهٔ تک‌فایلی اعمال می‌شود. انتقال به دستگاه دیگر با لینک همگام‌سازی.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  const STORAGE_KEY = 'ga_ui_labels_v1';
  const PUBLIC_URL = 'https://mvbabak556-bot.github.io/golf-academy-pro/';

  /* [کلید، گروه، آیکن، نام پیش‌فرض] */
  const RAW = [
    /* منوی اصلی و صفحه‌ها */
    ['group.dashboard','منوی اصلی','🧭','داشبورد'],
    ['group.management','منوی اصلی','⚙️','مدیریت'],
    ['nav.memberzone','منوی اصلی','👤','بخش اعضا'],
    ['nav.cmd','منوی اصلی','🎯','فرماندهی'],
    ['nav.race','منوی اصلی','🏁','رقابت فصل'],
    ['nav.player','منوی اصلی','🏌️','مرکز بازیکن'],
    ['nav.match','منوی اصلی','🥇','فرماندهی مسابقه'],
    ['nav.course','منوی اصلی','🗺️','هوش زمین'],
    ['nav.records','منوی اصلی','🎖️','رکوردها'],
    ['nav.cal','منوی اصلی','📅','تقویم فصل'],
    ['nav.tv','منوی اصلی','📺','نمایش تلویزیونی'],
    ['nav.battle','منوی اصلی','⚔️','میدان نبرد'],
    ['nav.academy','منوی اصلی','🏫','پنل آکادمی'],
    ['nav.avatarland','منوی اصلی','🌸','سرزمین آواتارها'],
    ['nav.acourses','منوی اصلی','🛠️','طراح زمین'],
    ['nav.atournaments','منوی اصلی','🛠️','طراح مسابقه'],
    ['nav.ascorecards','منوی اصلی','🛠️','ثبت نتایج'],
    ['nav.mgmt','منوی اصلی','⚙️','پنل مدیریت'],
    ['nav.users','منوی اصلی','🔐','یوزرها'],
    ['nav.settings','منوی اصلی','🛠️','تنظیمات نمایش'],

    /* بخش اعضا */
    ['member.home','تب‌های اعضا','🏠','خانهٔ من'],
    ['member.earn','تب‌های اعضا','🪙','دریافت سکه'],
    ['member.guide','تب‌های اعضا','📜','راهنمای سکه'],
    ['member.avatar','تب‌های اعضا','🎨','ساخت آواتار'],

    /* تب‌های پنل مدیریت */
    ['admin.players','تب‌های پنل مدیریت','👥','بازیکنان'],
    ['admin.courses','تب‌های پنل مدیریت','🗺️','زمین‌ها'],
    ['admin.tournaments','تب‌های پنل مدیریت','🏆','مسابقات'],
    ['admin.programs','تب‌های پنل مدیریت','🎓','دوره‌ها'],
    ['admin.results','تب‌های پنل مدیریت','⛳','نتایج'],
    ['admin.calendar','تب‌های پنل مدیریت','📅','تقویم'],
    ['admin.contact','تب‌های پنل مدیریت','📞','تماس با ما'],
    ['admin.info','تب‌های پنل مدیریت','ℹ️','اطلاعات'],
    ['admin.users','تب‌های پنل مدیریت','🔐','یوزرها'],
    ['admin.coins','تب‌های پنل مدیریت','🪙','درخواست سکه'],
    ['admin.honor','تب‌های پنل مدیریت','🏅','رنک و آواتار'],
    ['admin.shop','تب‌های پنل مدیریت','🛍️','فروشگاه آواتار'],
    ['admin.labels','تب‌های پنل مدیریت','✏️','ویرایش آیتم‌ها'],
    ['admin.battle','تب‌های پنل مدیریت','⚔️','نبرد میدان‌ها'],
    ['admin.avatars','تب‌های پنل مدیریت','🌸','سرزمین آواتارها'],

    /* صفحهٔ ورودی و رسپشن */
    ['landing.enter','صفحهٔ ورودی و رسپشن','👤','ورود اعضا'],
    ['landing.reception','صفحهٔ ورودی و رسپشن','🛎️','رسپشن'],
    ['landing.contact','صفحهٔ ورودی و رسپشن','📞','تماس با ما'],
    ['landing.info','صفحهٔ ورودی و رسپشن','ℹ️','اطلاعات'],
    ['landing.calendar','صفحهٔ ورودی و رسپشن','📅','تقویم آکادمی'],
    ['landing.records','صفحهٔ ورودی و رسپشن','🏆','رکوردداران'],
    ['landing.intro','صفحهٔ ورودی و رسپشن','🏛️','معرفی'],
    ['landing.signup','صفحهٔ ورودی و رسپشن','📝','ثبت‌نام'],
    ['landing.courses','صفحهٔ ورودی و رسپشن','🎓','دوره‌ها'],
    ['landing.tuition','صفحهٔ ورودی و رسپشن','💰','شهریه'],
    ['landing.rules','صفحهٔ ورودی و رسپشن','📜','قوانین'],

    /* فروشگاه و فیلترهای آن */
    ['shop.title','فروشگاه آواتار','🛍️','فروشگاه آواتار'],
    ['shop.preview','فروشگاه آواتار','👤','پیش‌نمایش آواتار'],
    ['shop.cart','فروشگاه آواتار','🛒','سبد خرید'],
    ['shop.products','فروشگاه آواتار','🛍️','محصولات'],
    ['shop.categories','فروشگاه آواتار','🗂️','دسته‌بندی‌ها'],
    ['shop.brands','فروشگاه آواتار','🏷️','برندها'],
    ['shop.bundles','فروشگاه آواتار','🎁','بسته‌های ویژه'],
    ['shop.sort.new','فروشگاه آواتار','✨','جدیدترین‌ها'],
    ['shop.sort.pop','فروشگاه آواتار','❤️','محبوب‌ترین'],
    ['shop.sort.sale','فروشگاه آواتار','🏷️','تخفیف‌دار'],
    ['shop.sort.sold','فروشگاه آواتار','🔥','پرفروش‌ترین'],
    ['shop.sort.low','فروشگاه آواتار','↘️','ارزان‌ترین'],
    ['shop.sort.high','فروشگاه آواتار','↗️','گران‌ترین'],
    ['shop.cat.all','دسته‌های فروشگاه','▦','همه آیتم‌ها'],
    ['shop.cat.men','دسته‌های فروشگاه','👔','لباس مردانه'],
    ['shop.cat.women','دسته‌های فروشگاه','👗','لباس زنانه'],
    ['shop.cat.hat','دسته‌های فروشگاه','🧢','کلاه و ویزور'],
    ['shop.cat.glove','دسته‌های فروشگاه','🧤','دستکش'],
    ['shop.cat.shoes','دسته‌های فروشگاه','👟','کفش'],
    ['shop.cat.bag','دسته‌های فروشگاه','🎒','کیف گلف'],
    ['shop.cat.club','دسته‌های فروشگاه','🏌️','چوب گلف'],
    ['shop.cat.ball','دسته‌های فروشگاه','⛳','توپ و تجهیزات'],
    ['shop.cat.glass','دسته‌های فروشگاه','🕶️','عینک'],
    ['shop.cat.watch','دسته‌های فروشگاه','⌚','ساعت و اکسسوری'],
    ['shop.cat.look','دسته‌های فروشگاه','💇','چهره و مو'],
    ['shop.cat.bundle','دسته‌های فروشگاه','🎁','بسته‌های ویژه'],
    ['shop.cat.new','دسته‌های فروشگاه','✨','آیتم‌های جدید'],
    ['shop.cat.sale','دسته‌های فروشگاه','🏷️','تخفیف‌دار'],
    ['shop.cat.fav','دسته‌های فروشگاه','❤️','علاقه‌مندی‌ها'],
    ['shop.slot.hat','بخش‌های آواتار','🧢','کلاه'],
    ['shop.slot.shirt','بخش‌های آواتار','👕','بالاتنه'],
    ['shop.slot.pants','بخش‌های آواتار','👖','پایین‌تنه'],
    ['shop.slot.shoes','بخش‌های آواتار','👟','کفش'],
    ['shop.slot.glove','بخش‌های آواتار','🧤','دستکش'],
    ['shop.slot.glass','بخش‌های آواتار','🕶️','عینک'],
    ['shop.slot.bag','بخش‌های آواتار','🎒','کیف'],
    ['shop.slot.club','بخش‌های آواتار','🏌️','چوب'],
    ['shop.slot.watch','بخش‌های آواتار','⌚','ساعت'],
    ['shop.slot.ball','بخش‌های آواتار','⛳','توپ'],

    /* گروه‌های تنظیمات نمایش */
    ['settings.group.analytics','تنظیمات نمایش','📊','صفحات تحلیلی'],
    ['settings.group.calendar','تنظیمات نمایش','📅','تقویم'],
    ['settings.group.members','تنظیمات نمایش','👤','بخش اعضا — نمایش برای اعضا'],
  ];

  const DEFS = RAW.map((x, i) => ({ id:x[0], group:x[1], icon:x[2], def:x[3], order:i }));
  const BY_ID = Object.fromEntries(DEFS.map(d => [d.id, d]));
  let memory = {};

  function read(){
    try {
      const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch(e){ return Object.assign({}, memory); }
  }
  function write(v){
    memory = Object.assign({}, v || {});
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); } catch(e){}
  }
  function cleanValue(v){ return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 80); }
  function t(id, fallback){
    const d = BY_ID[id];
    const v = read()[id];
    if (typeof v === 'string' && v.trim()) return v;
    return d ? d.def : (fallback == null ? id : fallback);
  }
  function defs(){
    const c = read();
    return DEFS.map(d => Object.assign({}, d, { value:t(d.id), custom:Object.prototype.hasOwnProperty.call(c, d.id) }));
  }
  function setMany(values){
    const next = read();
    Object.keys(values || {}).forEach(id => {
      const d = BY_ID[id]; if (!d) return;
      const v = cleanValue(values[id]);
      if (!v || v === d.def) delete next[id]; else next[id] = v;
    });
    write(next); emit();
    return next;
  }
  function reset(id){ const n = read(); delete n[id]; write(n); emit(); }
  function resetAll(){ write({}); emit(); }
  function custom(){ return read(); }
  function emit(){
    try { window.dispatchEvent(new CustomEvent('ga:labels-changed', { detail:custom() })); } catch(e){}
  }

  function apply(root){
    root = root || document;
    const nodes = [];
    if (root.nodeType === 1 && root.matches && root.matches('[data-ui-label]')) nodes.push(root);
    if (root.querySelectorAll) root.querySelectorAll('[data-ui-label]').forEach(n => nodes.push(n));
    nodes.forEach(el => {
      const id = el.getAttribute('data-ui-label');
      const value = t(id, el.textContent || '');
      const attr = el.getAttribute('data-ui-label-attr');
      if (attr) el.setAttribute(attr, value); else el.textContent = value;
    });
  }

  function toToken(){
    const json = JSON.stringify({ v:1, labels:custom() });
    const bytes = new TextEncoder().encode(json);
    let bin = ''; for (let i=0;i<bytes.length;i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function fromToken(token){
    try {
      token = String(token || '').trim().replace(/^.*#ga-labels=/, '').replace(/-/g,'+').replace(/_/g,'/');
      while (token.length % 4) token += '=';
      const bin = atob(token); const bytes = new Uint8Array(bin.length);
      for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
      const obj = JSON.parse(new TextDecoder().decode(bytes));
      const source = obj && (obj.labels || obj.l || obj);
      if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('bad data');
      const next = {};
      Object.keys(source).forEach(id => {
        if (!BY_ID[id]) return;
        const v = cleanValue(source[id]);
        if (v && v !== BY_ID[id].def) next[id] = v;
      });
      write(next); emit(); return true;
    } catch(e){ return false; }
  }
  function shareLink(){ return PUBLIC_URL + '#ga-labels=' + toToken(); }

  let imported = false;
  try {
    const mark = '#ga-labels=';
    const i = location.hash.indexOf(mark);
    if (i >= 0){
      imported = fromToken(location.hash.slice(i + mark.length));
      if (imported && history && history.replaceState) history.replaceState(null, '', location.href.split('#')[0]);
    }
  } catch(e){}

  document.addEventListener('DOMContentLoaded', () => apply(document));
  window.addEventListener('storage', e => {
    if (e.key !== STORAGE_KEY) return;
    memory = read(); apply(document); emit();
  });
  window.UI_LABELS = {
    t, defs, setMany, reset, resetAll, custom, apply,
    exportToken:toToken, importToken:fromToken, shareLink,
    storageKey:STORAGE_KEY, publicUrl:PUBLIC_URL, imported
  };
})();
