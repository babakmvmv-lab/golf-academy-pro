/* صفحهٔ نخست — قالب‌های سه‌بعدی قابل انتخاب و ویرایش عکس */
(function () {
  'use strict';
  var KEY = 'ga_home_skin';
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var TEMPLATES = [
    { id: 'lobby', name: 'لابی رسپشن', ic: '🛎️', slots: [
      { k: 'lobby', label: 'عکس لابی دسکتاپ', def: 'assets/lobby_bg_v3.webp' },
      { k: 'lobbyMobile', label: 'عکس لابی موبایل', def: '' }
    ]},
    { id: 'flyover', name: 'پرواز روی میدان', ic: '🛫', slots: [
      { k: 'tee', label: 'تی', def: 'assets/open_tee.webp' },
      { k: 'fairway', label: 'فروی', def: 'assets/course_pano.webp' },
      { k: 'sky', label: 'آسمان', def: 'assets/open_sky.webp' },
      { k: 'green', label: 'گرین', def: 'assets/open_hole.webp' }
    ]},
    { id: 'layers', name: 'لایه‌های سه‌بعدی', ic: '🌄', slots: [
      { k: 'sky', label: 'آسمان', def: 'assets/open_sky.webp' },
      { k: 'far', label: 'دور / تپه', def: 'assets/course_pano.webp' },
      { k: 'near', label: 'نزدیک / تی', def: 'assets/open_tee.webp' },
      { k: 'flag', label: 'پرچم', def: 'assets/flag_3d.webp' }
    ]},
    { id: 'ball', name: 'توپ سه‌بعدی', ic: '⛳', slots: [
      { k: 'bg', label: 'پس‌زمینه', def: 'assets/open_hole.webp' },
      { k: 'ball', label: 'توپ', def: 'assets/ball_3d.webp' }
    ]},
    { id: 'clubhouse', name: 'کلاب‌هاوس غروب', ic: '🌅', slots: [
      { k: 'sky', label: 'آسمان', def: 'assets/open_sky.webp' },
      { k: 'ground', label: 'چمن', def: 'assets/course_pano.webp' },
      { k: 'house', label: 'ساختمان', def: 'assets/lobby_bg_v3.webp' }
    ]}
  ];

  function defOf() {
    var o = { id: 'lobby', title: '', accent: '#d4af37', slots: {} };
    return o;
  }
  function get() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (!s || typeof s !== 'object') s = {};
      var d = defOf();
      var id = s.id && TEMPLATES.some(function (t) { return t.id === s.id; }) ? s.id : 'lobby';
      return { id: id, title: s.title || '', accent: s.accent || d.accent, slots: s.slots && typeof s.slots === 'object' ? s.slots : {} };
    } catch (e) { return defOf(); }
  }
  function save(patch) {
    var cur = get();
    var next = {
      id: patch.id != null ? patch.id : cur.id,
      title: patch.title != null ? patch.title : cur.title,
      accent: patch.accent != null ? patch.accent : cur.accent,
      slots: Object.assign({}, cur.slots, patch.slots || {})
    };
    if (patch.clearSlot) { delete next.slots[patch.clearSlot]; }
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { return { ok: false, err: e }; }
    try { window.dispatchEvent(new CustomEvent('ga:homeskin-changed')); } catch (e2) {}
    return { ok: true, skin: next };
  }
  function tplOf(id) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === id) return TEMPLATES[i];
    return TEMPLATES[0];
  }
  function src(skin, k, fallback) {
    var v = skin.slots && skin.slots[k];
    if (v) return v;
    var t = tplOf(skin.id);
    for (var i = 0; i < t.slots.length; i++) if (t.slots[i].k === k) return t.slots[i].def || fallback || '';
    return fallback || '';
  }

  var CSS = [
    '#hs-world{position:absolute;inset:0;z-index:2;overflow:hidden;pointer-events:none}',
    '#hs-world.on{pointer-events:auto}',
    '#hs-world .hs-title{position:absolute;top:18%;left:50%;transform:translateX(-50%);z-index:8;text-align:center;pointer-events:none;',
    'font-weight:900;font-size:clamp(22px,4.4vw,42px);color:#f6e27a;text-shadow:0 8px 40px rgba(0,0,0,.55);letter-spacing:.5px}',
    '#l3d[data-skin]:not([data-skin="lobby"]) #l3d-reception{display:none!important}',
    '#l3d[data-skin]:not([data-skin="lobby"]) #l3d-bg{opacity:0}',
    '#l3d[data-skin]:not([data-skin="lobby"]) #l3d-rays{opacity:.2}',
    '.hs-layer{position:absolute;inset:-8%;background-size:cover;background-position:center;will-change:transform}',
    '.hs-fly{position:absolute;inset:0;perspective:1100px}',
    '.hs-fly .hs-shot{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transform:scale(1.12);',
    'transition:opacity .45s ease,transform .45s ease;filter:saturate(1.05)}',
    '.hs-fly .hs-shot.on{opacity:1;transform:scale(1)}',
    '.hs-bar{position:absolute;bottom:92px;left:50%;transform:translateX(-50%);width:min(240px,50vw);height:3px;border-radius:99px;',
    'background:rgba(255,255,255,.18);z-index:7;pointer-events:none}',
    '.hs-bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#f6e27a,#d4af37)}',
    '.hs-lay{position:absolute;inset:0;perspective:1400px;transform-style:preserve-3d}',
    '.hs-lay .ly{position:absolute;left:-12%;top:-12%;width:124%;height:124%;background-size:cover;background-position:center;will-change:transform}',
    '.hs-lay .ly.flag{left:58%;top:28%;width:22%;height:42%;background-size:contain;background-repeat:no-repeat;background-position:center bottom}',
    '.hs-ball-sc{position:absolute;inset:0;background-size:cover;background-position:center}',
    '.hs-ball-sc::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 70%,transparent 30%,rgba(0,0,0,.45) 100%)}',
    '.hs-ball{position:absolute;left:50%;top:46%;width:min(42vw,280px);height:min(42vw,280px);margin:-min(21vw,140px) 0 0 -min(21vw,140px);',
    'border-radius:50%;background-size:cover;background-position:center;box-shadow:inset -18px -22px 40px rgba(0,0,0,.35),0 30px 50px rgba(0,0,0,.4);',
    'will-change:transform;filter:drop-shadow(0 20px 30px rgba(0,0,0,.35))}',
    '.hs-cup{position:absolute;left:50%;bottom:14%;width:70px;height:24px;margin-left:-35px;border-radius:50%;',
    'background:radial-gradient(circle at 50% 40%,#1a1a1a,#0a0a0a 70%);box-shadow:0 0 0 6px #2f6b3a,0 0 22px rgba(212,175,55,.35)}',
    '.hs-club{position:absolute;inset:0;perspective:900px;overflow:hidden}',
    '.hs-club-cam{position:absolute;inset:0;transform-style:preserve-3d;will-change:transform}',
    '.hs-club .sky{position:absolute;inset:0;background-size:cover;background-position:center top}',
    '.hs-club .ground{position:absolute;left:-20%;top:48%;width:140%;height:90%;background-size:cover;background-position:center;',
    'transform:rotateX(72deg) translateZ(-40px);transform-origin:center top;filter:saturate(1.1)}',
    '.hs-club .house{position:absolute;right:6%;bottom:22%;width:38%;height:46%;background-size:cover;background-position:center;',
    'transform:translateZ(80px);border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.45);opacity:.92}',
    '.hs-club .sun{position:absolute;right:18%;top:16%;width:90px;height:90px;border-radius:50%;',
    'background:radial-gradient(circle,#fff6d0 0%,#f0c14b 40%,rgba(212,175,55,0) 70%);filter:blur(1px)}',
    '.hs-club .pole{position:absolute;left:28%;bottom:30%;width:4px;height:26%;background:#f4f0e4;transform:translateZ(60px);border-radius:2px}',
    '.hs-club .flag{position:absolute;left:28%;bottom:48%;width:54px;height:32px;margin-left:4px;background:#c0392b;clip-path:polygon(0 0,100% 40%,0 80%);transform:translateZ(62px)}'
  ].join('\n');

  var world = null, raf = 0, mx = 0, my = 0, p = 0, tp = 0, running = false;
  var touchY = null;

  function ensureCss() {
    if (document.getElementById('hs-css')) return;
    var s = document.createElement('style');
    s.id = 'hs-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function url(u) { return u ? ('url(' + u + ')') : 'none'; }

  function htmlFly(skin) {
    return '<div class="hs-fly">' +
      '<div class="hs-shot" data-i="0" style="background-image:' + url(src(skin, 'tee')) + '"></div>' +
      '<div class="hs-shot" data-i="1" style="background-image:' + url(src(skin, 'fairway')) + '"></div>' +
      '<div class="hs-shot" data-i="2" style="background-image:' + url(src(skin, 'sky')) + '"></div>' +
      '<div class="hs-shot" data-i="3" style="background-image:' + url(src(skin, 'green')) + '"></div>' +
      '<div class="hs-bar"><i></i></div></div>';
  }
  function htmlLayers(skin) {
    return '<div class="hs-lay">' +
      '<div class="ly sky" style="background-image:' + url(src(skin, 'sky')) + '"></div>' +
      '<div class="ly far" style="background-image:' + url(src(skin, 'far')) + '"></div>' +
      '<div class="ly near" style="background-image:' + url(src(skin, 'near')) + '"></div>' +
      '<div class="ly flag" style="background-image:' + url(src(skin, 'flag')) + '"></div></div>';
  }
  function htmlBall(skin) {
    return '<div class="hs-ball-sc" style="background-image:' + url(src(skin, 'bg')) + '"></div>' +
      '<div class="hs-cup"></div>' +
      '<div class="hs-ball" style="background-image:' + url(src(skin, 'ball')) + '"></div>';
  }
  function htmlClub(skin) {
    return '<div class="hs-club"><div class="hs-club-cam">' +
      '<div class="sky" style="background-image:' + url(src(skin, 'sky')) + '"></div>' +
      '<div class="sun"></div>' +
      '<div class="ground" style="background-image:' + url(src(skin, 'ground')) + '"></div>' +
      '<div class="house" style="background-image:' + url(src(skin, 'house')) + '"></div>' +
      '<div class="pole"></div><div class="flag"></div>' +
      '</div></div>';
  }

  function paint(id) {
    if (!world) return;
    var skin = get();
    var title = skin.title ? ('<div class="hs-title">' + esc(skin.title) + '</div>') : '';
    var inner = '';
    if (id === 'flyover') inner = htmlFly(skin);
    else if (id === 'layers') inner = htmlLayers(skin);
    else if (id === 'ball') inner = htmlBall(skin);
    else if (id === 'clubhouse') inner = htmlClub(skin);
    world.innerHTML = title + inner;
    world.classList.toggle('on', id !== 'lobby');
    var bar = world.querySelector('.hs-bar i');
    if (bar) bar.style.background = 'linear-gradient(90deg,' + (skin.accent || '#f6e27a') + ',' + (skin.accent || '#d4af37') + ')';
  }

  function tick() {
    if (!running) return;
    p += (tp - p) * 0.08;
    var id = get().id;
    var nx = mx, ny = my;
    if (id === 'flyover') {
      var shots = world.querySelectorAll('.hs-shot');
      var n = shots.length || 1;
      var idx = Math.min(n - 1, Math.floor(p * n * 0.999));
      for (var i = 0; i < shots.length; i++) shots[i].classList.toggle('on', i === idx);
      var fly = world.querySelector('.hs-fly');
      if (fly) fly.style.transform = 'rotateY(' + (nx * 7) + 'deg) rotateX(' + (-ny * 5) + 'deg)';
      var bar = world.querySelector('.hs-bar i');
      if (bar) bar.style.width = (p * 100) + '%';
    } else if (id === 'layers') {
      var lay = world.querySelector('.hs-lay');
      var z = p * 180;
      if (lay) lay.style.transform = 'rotateY(' + (nx * 10) + 'deg) rotateX(' + (-ny * 6) + 'deg) translateZ(' + z + 'px)';
      var sky = world.querySelector('.ly.sky');
      var far = world.querySelector('.ly.far');
      var near = world.querySelector('.ly.near');
      var fl = world.querySelector('.ly.flag');
      if (sky) sky.style.transform = 'translate3d(' + (nx * 8) + 'px,' + (ny * 6) + 'px,' + (-120 + p * 40) + 'px) scale(1.12)';
      if (far) far.style.transform = 'translate3d(' + (nx * 18) + 'px,' + (ny * 12 + p * 20) + 'px,' + (-40 + p * 60) + 'px)';
      if (near) near.style.transform = 'translate3d(' + (nx * 32) + 'px,' + (ny * 18 + p * 40) + 'px,' + (20 + p * 80) + 'px)';
      if (fl) fl.style.transform = 'translate3d(' + (nx * 40) + 'px,' + (ny * 10 - p * 30) + 'px,' + (80 + p * 120) + 'px) rotate(' + (Math.sin(performance.now() / 400) * 6) + 'deg)';
    } else if (id === 'ball') {
      var b = world.querySelector('.hs-ball');
      var drop = p * 140;
      var sc = 1 - p * 0.45;
      if (b) b.style.transform = 'rotateX(' + (-ny * 35) + 'deg) rotateY(' + (nx * 50) + 'deg) translateY(' + drop + 'px) scale(' + sc + ')';
      var scn = world.querySelector('.hs-ball-sc');
      if (scn) scn.style.transform = 'scale(' + (1.08 + p * 0.08) + ') translate(' + (nx * 12) + 'px,' + (ny * 8) + 'px)';
    } else if (id === 'clubhouse') {
      var cam = world.querySelector('.hs-club-cam');
      if (cam) cam.style.transform = 'rotateY(' + (nx * 12) + 'deg) rotateX(' + (-ny * 6) + 'deg) translateZ(' + (p * 160) + 'px)';
      var flag = world.querySelector('.hs-club .flag');
      if (flag) flag.style.transform = 'translateZ(62px) rotateY(' + (Math.sin(performance.now() / 280) * 14) + 'deg)';
    }
    raf = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(tick);
  }
  function stopLoop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  function onMove(e) {
    var id = get().id;
    if (id === 'lobby') return;
    var x = e.clientX, y = e.clientY;
    if (e.touches && e.touches[0]) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
    mx = (x / (innerWidth || 1)) * 2 - 1;
    my = (y / (innerHeight || 1)) * 2 - 1;
  }
  function onWheel(e) {
    if (get().id === 'lobby') return;
    tp = Math.max(0, Math.min(1, tp + (e.deltaY || 0) / 900));
  }
  function onTouchStart(e) {
    if (e.touches && e.touches[0]) touchY = e.touches[0].clientY;
  }
  function onTouchMove(e) {
    if (get().id === 'lobby') return;
    if (!e.touches || !e.touches[0] || touchY == null) return;
    var y = e.touches[0].clientY;
    tp = Math.max(0, Math.min(1, tp + (touchY - y) / 500));
    touchY = y;
    onMove(e);
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('wheel', onWheel, { passive: true });
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
  }

  function mount(stage) {
    ensureCss();
    bind();
    if (!stage) stage = document.getElementById('l3d-stage');
    if (!stage) return;
    world = document.getElementById('hs-world');
    if (!world) {
      world = document.createElement('div');
      world.id = 'hs-world';
      stage.insertBefore(world, stage.firstChild);
    }
    var skin = get();
    var root = document.getElementById('l3d');
    if (root) root.setAttribute('data-skin', skin.id);
    p = 0; tp = 0; mx = 0; my = 0;
    paint(skin.id);
    if (skin.id === 'lobby') stopLoop();
    else startLoop();
  }

  function readFileToJpeg(file, cb) {
    if (!file) return;
    var img = new Image();
    var u = URL.createObjectURL(file);
    img.onload = function () {
      var max = 1600, w = img.width, h = img.height;
      if (w > max || h > max) { var s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(u);
      try { cb(c.toDataURL('image/jpeg', 0.82)); } catch (e) { cb(''); }
    };
    img.onerror = function () { URL.revokeObjectURL(u); cb(''); };
    img.src = u;
  }

  window.HOMESKIN = {
    KEY: KEY,
    TEMPLATES: TEMPLATES,
    get: get,
    save: save,
    src: src,
    tplOf: tplOf,
    mount: mount,
    readFileToJpeg: readFileToJpeg,
    id: function () { return get().id; }
  };
  window.addEventListener('ga:homeskin-changed', function () { mount(); });
})();
