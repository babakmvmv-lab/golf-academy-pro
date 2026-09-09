/* پوستهٔ آکادمی — هویت باشگاه جدا از منطق گلف. بعداً همین فیلدها tenant می‌شوند. */
(function () {
  var KEY = 'ga_academy';
  var DEF = {
    nameFa: 'آکادمی گلف پات کلاب',
    nameShortFa: 'پات کلاب',
    nameEn: 'Putt Club Golf Academy',
    nameShortEn: 'Putt Club',
    loginTitle: 'آکادمی گلف',
    letters: 'PUTTCLUB',
    domain: 'puttclub.ir',
    email: 'info@puttclub.ir',
    instagram: 'puttclub',
    logo: '',
    favicon: '',
    loginBg: ''
  };

  function get() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (!s || typeof s !== 'object') s = {};
      return Object.assign({}, DEF, s);
    } catch (e) { return Object.assign({}, DEF); }
  }
  function save(o) {
    var cur = get();
    var next = Object.assign({}, cur, o || {});
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {}
    apply();
    try { window.dispatchEvent(new CustomEvent('ga:brand-changed')); } catch (e2) {}
    return next;
  }
  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    apply();
    try { window.dispatchEvent(new CustomEvent('ga:brand-changed')); } catch (e2) {}
    return get();
  }
  function logoUrl() {
    var b = get();
    return b.logo || 'assets/puttclub_logo.png';
  }
  function faviconUrl() {
    var b = get();
    return b.favicon || b.logo || 'assets/puttclub_favicon.png';
  }
  function host() {
    return String(get().domain || '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  }
  function apply() {
    var b = get();
    var logo = logoUrl();
    document.querySelectorAll('#login .login-logo img, .sidebar .brand .logo img').forEach(function (img) {
      img.src = logo;
      img.alt = b.nameFa;
    });
    var h1 = document.querySelector('#login h1');
    if (h1) h1.textContent = b.loginTitle || b.nameShortFa;
    var sh = document.querySelector('.sidebar .brand h2');
    if (sh) sh.textContent = b.nameShortEn || b.nameShortFa;
    var ico = document.querySelector('link[rel="icon"]');
    if (ico) ico.setAttribute('href', faviconUrl());
    var apple = document.querySelector('link[rel="apple-touch-icon"]');
    if (apple && (b.favicon || b.logo)) apple.setAttribute('href', faviconUrl());
    var bg = document.querySelector('#login .bg-img');
    if (bg) bg.src = b.loginBg || 'assets/login_bg.webp';
    var ogt = document.querySelector('meta[property="og:title"]');
    if (ogt) ogt.setAttribute('content', b.nameFa + ' — ' + b.nameEn);
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'داشبورد حرفه‌ای ' + b.nameFa);
    if (!document.getElementById('app') || !document.getElementById('app').classList.contains('on')) {
      document.title = b.nameFa;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();

  window.GA_BRAND = {
    KEY: KEY, DEF: DEF, get: get, save: save, reset: reset,
    logoUrl: logoUrl, faviconUrl: faviconUrl, host: host, apply: apply
  };
})();
