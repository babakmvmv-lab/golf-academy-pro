/* تشخیص گوشی در برابر حالت سایت — کلاس phone-mode / site-mode روی html و body */
(function () {
  function isPhone() {
    var w = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 1024;
    var coarse = false, hoverNone = false;
    try {
      coarse = window.matchMedia('(pointer: coarse)').matches;
      hoverNone = window.matchMedia('(hover: none)').matches;
    } catch (e) {}
    var ua = /iPhone|iPod|Android.+Mobile|Windows Phone|webOS|BlackBerry|Opera Mini/i.test(navigator.userAgent || '');
    if (w <= 820) return true;
    if (ua && w <= 920) return true;
    if (coarse && hoverNone && w <= 900) return true;
    return false;
  }
  function apply() {
    var on = isPhone();
    var root = document.documentElement;
    root.classList.toggle('phone-mode', on);
    root.classList.toggle('site-mode', !on);
    if (document.body) {
      document.body.classList.toggle('phone-mode', on);
      document.body.classList.toggle('site-mode', !on);
      if (!on) document.body.classList.remove('nav-open');
    }
    window.GA_DEVICE = { phone: on, site: !on };
  }
  apply();
  var t;
  function later() {
    clearTimeout(t);
    t = setTimeout(apply, 80);
  }
  window.addEventListener('resize', later);
  window.addEventListener('orientationchange', function () { setTimeout(apply, 140); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
