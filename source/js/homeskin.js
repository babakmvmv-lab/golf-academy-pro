/* صفحهٔ نخست — دنیای WebGL سینمایی (سبک MotionSites، تم گلف) */
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
    { id: 'flyover', name: 'داستان سه‌بعدی میدان', ic: '🎬', slots: [
      { k: 'sky', label: 'آسمان (اختیاری)', def: '' }
    ]},
    { id: 'layers', name: 'اقیانوس چمن', ic: '🌊', slots: [
      { k: 'sky', label: 'آسمان (اختیاری)', def: '' }
    ]},
    { id: 'ball', name: 'توپ سه‌بعدی', ic: '⛳', slots: [
      { k: 'ball', label: 'بافت توپ (اختیاری)', def: '' }
    ]},
    { id: 'clubhouse', name: 'کلاب‌هاوس غروب', ic: '🌅', slots: [
      { k: 'sky', label: 'آسمان (اختیاری)', def: '' }
    ]}
  ];

  function defOf() { return { id: 'lobby', title: '', accent: '#d4af37', slots: {} }; }
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
    if (patch.clearSlot) delete next.slots[patch.clearSlot];
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
  function hex3(h) {
    h = String(h || '#d4af37').replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [
      parseInt(h.slice(0, 2), 16) / 255 || 0.83,
      parseInt(h.slice(2, 4), 16) / 255 || 0.69,
      parseInt(h.slice(4, 6), 16) / 255 || 0.22
    ];
  }

  var CSS = [
    '#hs-world{position:absolute;inset:0;z-index:2;overflow:hidden;pointer-events:none}',
    '#hs-world.on{pointer-events:auto}',
    '#hs-world canvas.hs-gl{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1}',
    '#hs-world .hs-title{position:absolute;top:16%;left:50%;transform:translateX(-50%);z-index:8;text-align:center;pointer-events:none;',
    'font-weight:900;font-size:clamp(22px,4.6vw,48px);color:#f6e27a;text-shadow:0 10px 50px rgba(0,0,0,.6);letter-spacing:.4px;mix-blend-mode:plus-lighter}',
    '#hs-world .hs-bar{position:absolute;bottom:96px;left:50%;transform:translateX(-50%);width:min(220px,46vw);height:2px;border-radius:99px;',
    'background:rgba(255,255,255,.16);z-index:7;pointer-events:none}',
    '#hs-world .hs-bar i{display:block;height:100%;width:0;border-radius:99px;background:#f6e27a}',
    '#hs-world .hs-scroll{position:absolute;bottom:112px;left:50%;transform:translateX(-50%);z-index:7;width:22px;height:34px;border:1.5px solid rgba(246,226,122,.7);',
    'border-radius:12px;pointer-events:none;opacity:.85;transition:opacity .6s}',
    '#hs-world .hs-scroll::after{content:"";position:absolute;left:50%;top:7px;width:3px;height:8px;margin-left:-1.5px;border-radius:2px;background:#f6e27a;animation:hsdot 1.4s ease-in-out infinite}',
    '@keyframes hsdot{0%{opacity:1;transform:translateY(0)}70%{opacity:0;transform:translateY(10px)}100%{opacity:0}}',
    '#hs-world.scrolled .hs-scroll{opacity:0}',
    '#l3d[data-skin]:not([data-skin="lobby"]) #l3d-reception{display:none!important}',
    '#l3d[data-skin]:not([data-skin="lobby"]) #l3d-bg{opacity:0}',
    '#l3d[data-skin]:not([data-skin="lobby"]) #l3d-rays{opacity:.15}'
  ].join('\n');

  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';

  var COM = [
    'precision highp float;',
    'uniform vec2 uR;uniform float uT,uP;uniform vec2 uM;uniform vec3 uA;',
    'uniform sampler2D uTex;uniform float uHas;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
    'return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}',
    'float fbm(vec2 p){float a=0.0,b=0.5;for(int i=0;i<5;i++){a+=b*noise(p);p*=2.02;b*=0.5;}return a;}',
    'vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}',
    'vec3 look(vec3 ro,vec3 ta,vec2 uv,float fv){vec3 w=normalize(ta-ro);vec3 u=normalize(cross(w,vec3(0.0,1.0,0.0)));vec3 v=cross(u,w);return normalize(uv.x*u+uv.y*v+fv*w);}'
  ].join('\n');

  var FS_FLY = COM + [
    'float terrain(vec2 p){',
    '  float h=fbm(p*0.018)*8.5;',
    '  h-=3.6*exp(-p.x*p.x*0.0055);',
    '  h+=1.0*exp(-dot(p-vec2(0.0,-8.0),p-vec2(0.0,-8.0))*0.035);',
    '  float g=length(p-vec2(1.2,92.0));',
    '  h=mix(h,1.05,smoothstep(24.0,6.0,g));',
    '  h+=0.28*fbm(p*0.11);',
    '  return h;',
    '}',
    'vec3 sky(vec3 rd){',
    '  float y=rd.y;',
    '  vec3 c=mix(vec3(0.78,0.86,0.95),vec3(0.20,0.42,0.78),smoothstep(-0.05,0.62,y));',
    '  c=mix(vec3(0.95,0.84,0.62),c,smoothstep(-0.18,0.10,y));',
    '  vec3 sun=normalize(vec3(-0.38,0.30,0.55));',
    '  float s=pow(max(0.0,dot(rd,sun)), 42.0);',
    '  c+=vec3(1.0,0.86,0.55)*s*1.8;',
    '  c+=vec3(1.0,0.72,0.35)*pow(max(0.0,dot(rd,sun)),4.0)*0.35;',
    '  float cl=fbm(rd.xz/(max(rd.y,0.05))*1.4+uT*0.015);',
    '  c=mix(c,vec3(1.0),smoothstep(0.52,0.88,cl)*max(0.0,y)*0.42);',
    '  if(uHas>0.5){vec2 su=vec2(atan(rd.z,rd.x)/6.2831853+0.5, rd.y*0.5+0.5);c=mix(c,texture2D(uTex,su).rgb,0.38);}',
    '  return c;',
    '}',
    'void main(){',
    '  vec2 fc=gl_FragCoord.xy; vec2 uv=(fc-0.5*uR)/uR.y;',
    '  float pr=uP;',
    '  vec3 ro=vec3(uM.x*4.0, mix(3.6,9.5,pr)+0.35*sin(uT*0.35), mix(-14.0,78.0,pr));',
    '  vec3 ta=vec3(0.4, mix(1.4,2.2,pr), mix(22.0,100.0,pr));',
    '  vec3 rd=look(ro,ta,uv,1.32); rd.xy+=uM*0.03;',
    '  float dist=0.0; float hit=0.0;',
    '  for(int i=0;i<80;i++){',
    '    vec3 p=ro+rd*dist; float h=p.y-terrain(p.xz);',
    '    if(h<0.06){hit=1.0;break;}',
    '    dist+=max(0.07,h*0.52); if(dist>170.0) break;',
    '  }',
    '  vec3 col;',
    '  if(hit<0.5){ col=sky(rd); }',
    '  else {',
    '    vec3 p=ro+rd*dist;',
    '    vec2 e=vec2(0.18,0.0);',
    '    vec3 n=normalize(vec3(terrain(p.xz-e.xy)-terrain(p.xz+e.xy), 2.0*e.x, terrain(p.xz-e.yx)-terrain(p.xz+e.yx)));',
    '    vec3 L=normalize(vec3(-0.38,0.72,0.28));',
    '    float dif=max(0.0,dot(n,L)); float spec=pow(max(0.0,dot(reflect(-L,n),-rd)), 18.0)*0.12;',
    '    float slope=1.0-n.y;',
    '    vec3 grass=mix(vec3(0.06,0.20,0.09),vec3(0.20,0.58,0.24),clamp(p.y*0.1+0.45,0.0,1.0));',
    '    grass=mix(grass,vec3(0.42,0.36,0.18),smoothstep(0.32,0.72,slope));',
    '    grass=mix(grass,vec3(0.25,0.66,0.30),exp(-p.x*p.x*0.01)*0.6);',
    '    float gd=length(p.xz-vec2(1.2,92.0));',
    '    grass=mix(grass,vec3(0.10,0.46,0.20),smoothstep(18.0,5.0,gd));',
    '    col=grass*(0.28+0.22*n.y+dif*0.85)+vec3(0.95,0.9,0.7)*spec;',
    '    vec2 df=p.xz-vec2(1.2,92.0); float th=1.05;',
    '    if(length(df)<0.11 && p.y<th+5.6 && p.y>th) col=vec3(0.92,0.9,0.82);',
    '    if(df.x>0.1 && df.x<1.35 && abs(df.y)<0.05 && p.y>th+3.6 && p.y<th+5.3) col=mix(vec3(0.78,0.12,0.12),uA,0.15);',
    '    col=mix(col,sky(rd),1.0-exp(-0.011*dist));',
    '  }',
    '  vec2 q=fc/uR; col*=0.72+0.28*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.35);',
    '  col+= (hash(fc+uT)-0.5)*0.035; col=aces(col);',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  var FS_SEA = COM + [
    'float oct(vec2 uv,float ch){uv+=noise(uv);vec2 wv=1.0-abs(sin(uv));vec2 sw=abs(cos(uv));wv=mix(wv,sw,wv);return pow(1.0-pow(wv.x*wv.y,0.65),ch);}',
    'float sea(vec2 p,float t){',
    '  float f=0.0; float amp=0.42; float ch=3.8; vec2 uv=p*0.22;',
    '  mat2 m=mat2(1.6,1.2,-1.2,1.6);',
    '  for(int i=0;i<5;i++){ f+=oct((uv+t)*float(i+1),ch)*amp; uv=m*uv; t*=1.12; amp*=0.42; ch=mix(ch,1.2,0.2); }',
    '  return f;',
    '}',
    'vec3 sky(vec3 rd){',
    '  float y=rd.y;',
    '  vec3 c=mix(vec3(0.55,0.78,0.92),vec3(0.08,0.22,0.48),smoothstep(0.0,0.7,y));',
    '  c=mix(vec3(0.95,0.78,0.48),c,smoothstep(-0.12,0.18,y));',
    '  vec3 sun=normalize(vec3(0.35,0.18,-0.6));',
    '  c+=vec3(1.0,0.8,0.4)*pow(max(0.0,dot(rd,sun)), 50.0)*2.0;',
    '  c+=vec3(1.0,0.55,0.2)*pow(max(0.0,dot(rd,sun)), 4.0)*0.45;',
    '  if(uHas>0.5){vec2 su=vec2(atan(rd.z,rd.x)/6.2831853+0.5,rd.y*0.5+0.5);c=mix(c,texture2D(uTex,su).rgb,0.32);}',
    '  return c;',
    '}',
    'void main(){',
    '  vec2 fc=gl_FragCoord.xy; vec2 uv=(fc-0.5*uR)/uR.y;',
    '  float t=uT*0.55; float pr=uP;',
    '  float eye=mix(2.15,0.35,pr);',
    '  vec3 ro=vec3(t*1.6 + uM.x*2.0, eye, 0.0);',
    '  vec3 ta=ro+vec3(4.0, mix(-0.15,-0.55,pr)+uM.y*0.4, 0.2);',
    '  vec3 rd=look(ro,ta,uv,1.15);',
    '  float dist=0.0; float hit=0.0;',
    '  for(int i=0;i<64;i++){',
    '    vec3 p=ro+rd*dist; float h=p.y - sea(p.xz,t);',
    '    if(h<0.04){hit=1.0;break;}',
    '    dist+=max(0.06,h*0.5); if(dist>90.0) break;',
    '  }',
    '  vec3 col;',
    '  if(hit<0.5){ col=sky(rd); }',
    '  else {',
    '    vec3 p=ro+rd*dist;',
    '    vec2 e=vec2(0.12,0.0);',
    '    float h0=sea(p.xz,t);',
    '    vec3 n=normalize(vec3(h0-sea(p.xz+e.xy,t), e.x, h0-sea(p.xz+e.yx,t)));',
    '    vec3 L=normalize(vec3(0.35,0.55,-0.5));',
    '    vec3 r=reflect(rd,n);',
    '    vec3 refl=sky(r);',
    '    float fres=pow(1.0-max(0.0,dot(n,-rd)), 4.0);',
    '    vec3 water=mix(vec3(0.03,0.14,0.08),vec3(0.10,0.42,0.24),n.y);',
    '    water=mix(water,uA*0.35,0.12);',
    '    float foam=smoothstep(0.32,0.55,h0);',
    '    col=mix(water,refl,fres*0.85+0.08);',
    '    col+=vec3(0.9,0.95,0.8)*foam*0.35;',
    '    col+=pow(max(0.0,dot(r,L)), 80.0)*vec3(1.0,0.9,0.6);',
    '    col=mix(col,sky(rd),1.0-exp(-0.018*dist));',
    '    vec2 isl=p.xz-vec2(18.0+t*1.6,6.0);',
    '    if(length(isl)<3.4 && p.y<1.2){ col=mix(col,vec3(0.12,0.38,0.16),0.65); }',
    '  }',
    '  if(ro.y<sea(ro.xz,t)+0.2){ col=mix(col,vec3(0.02,0.18,0.10),0.35+pr*0.4); }',
    '  vec2 q=fc/uR; col*=0.74+0.26*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.32);',
    '  col+= (hash(fc+uT)-0.5)*0.03; col=aces(col*1.05);',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  var FS_BALL = COM + [
    'float dimple(vec3 p){vec3 n=normalize(p);return 0.028*sin(22.0*n.x)*sin(22.0*n.y)*sin(22.0*n.z);}',
    'float ball(vec3 p){return length(p)-1.0+dimple(p);}',
    'vec3 env(vec3 r){',
    '  vec3 c=mix(vec3(0.04,0.06,0.08),vec3(0.55,0.62,0.72),smoothstep(-0.2,0.85,r.y));',
    '  c=mix(c,uA,pow(max(0.0,r.y),4.0)*0.25);',
    '  if(uHas>0.5){vec2 su=vec2(atan(r.z,r.x)/6.2831853+0.5,r.y*0.5+0.5);c=mix(c,texture2D(uTex,su).rgb,0.45);}',
    '  return c;',
    '}',
    'void main(){',
    '  vec2 fc=gl_FragCoord.xy; vec2 uv=(fc-0.5*uR)/uR.y;',
    '  float ay=uM.x*1.25 + uT*0.18; float ax=uM.y*0.45;',
    '  float rad=mix(5.4,2.7,uP);',
    '  vec3 ro=vec3(sin(ay)*cos(ax), 0.42+sin(ax)*1.1, cos(ay)*cos(ax))*rad;',
    '  vec3 ta=vec3(0.0,0.05,0.0);',
    '  vec3 rd=look(ro,ta,uv,1.7);',
    '  float dist=0.0; float hit=0.0; float which=0.0;',
    '  for(int i=0;i<72;i++){',
    '    vec3 p=ro+rd*dist; float d1=ball(p); float d2=p.y+1.35;',
    '    float d=min(d1,d2); if(d2<d1) which=1.0; else which=0.0;',
    '    if(d<0.002){hit=1.0;break;} dist+=d; if(dist>30.0) break;',
    '  }',
    '  vec3 bg=env(rd)*0.55; bg*=0.35+0.65*smoothstep(-0.4,0.6,rd.y);',
    '  vec3 col=bg;',
    '  if(hit>0.5){',
    '    vec3 p=ro+rd*dist;',
    '    if(which>0.5){',
    '      float sh=0.0; vec3 lp=p+vec3(0.0,0.002,0.0); float td=0.02;',
    '      for(int k=0;k<24;k++){ float d=ball(lp+vec3(0.2,1.0,0.3)*td); sh+=clamp(d/td,0.0,1.0); td+=0.08; }',
    '      sh/=24.0;',
    '      float g=exp(-length(p.xz)*0.45);',
    '      col=mix(bg, vec3(0.05,0.07,0.08), 0.55*g)*(0.4+0.6*sh);',
    '    } else {',
    '      vec2 e=vec2(0.004,0.0);',
    '      vec3 n=normalize(vec3(ball(p+e.xyy)-ball(p-e.xyy), ball(p+e.yxy)-ball(p-e.yxy), ball(p+e.yyx)-ball(p-e.yyx)));',
    '      vec3 L1=normalize(vec3(-0.6,0.7,0.4)); vec3 L2=normalize(vec3(0.8,0.2,-0.3));',
    '      float dif=max(0.0,dot(n,L1)); float rim=pow(1.0-max(0.0,dot(n,-rd)),3.0);',
    '      vec3 r=reflect(rd,n);',
    '      vec3 albedo=vec3(0.92,0.93,0.90);',
    '      if(uHas>0.5){ vec3 nn=normalize(p); vec2 bu=vec2(atan(nn.z,nn.x)/6.2831853+0.5, nn.y*0.5+0.5); albedo=mix(albedo,texture2D(uTex,bu).rgb,0.7); }',
    '      col=albedo*(0.12+dif*0.8)+env(r)*0.35;',
    '      col+=vec3(1.0)*pow(max(0.0,dot(r,L1)), 90.0)*1.4;',
    '      col+=uA*rim*0.55; col+=vec3(0.4,0.55,0.8)*max(0.0,dot(n,L2))*0.15;',
    '    }',
    '  }',
    '  vec2 q=fc/uR; col*=0.7+0.3*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.4);',
    '  col+= (hash(fc)-0.5)*0.03; col=aces(col);',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  var FS_CLUB = COM + [
    'float sdBox(vec3 p,vec3 b){vec3 q=abs(p)-b;return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);}',
    'float house(vec3 p){',
    '  float a=sdBox(p-vec3(0.0,1.55,0.0),vec3(3.3,1.55,2.15));',
    '  vec3 q=p-vec3(0.0,3.35,0.0);',
    '  float roof=max(abs(q.z)-2.35, abs(q.x)*0.62 + q.y - 1.15);',
    '  roof=max(roof,-q.y-0.02); a=min(a,roof);',
    '  vec3 c=p; c.x=abs(c.x)-1.7; c.z-=2.25;',
    '  float col=length(c.xz)-0.16; col=max(col,abs(p.y-1.15)-1.15); a=min(a,col);',
    '  a=min(a, sdBox(p-vec3(0.0,1.1,2.35), vec3(2.2,0.08,0.45)));',
    '  return a;',
    '}',
    'float tree(vec3 p,vec3 o){ p-=o; float st=length(p.xz)-0.12; st=max(st,abs(p.y-1.0)-1.0); float hd=length(p-vec3(0.0,2.4,0.0))-0.95; return min(st,hd);}',
    'float map(vec3 p){',
    '  float g=p.y - 0.02*sin(p.x*1.3+uT)*sin(p.z*1.1);',
    '  float h=house(p);',
    '  float t1=tree(p,vec3(-6.2,0.0,1.5)); float t2=tree(p,vec3(6.5,0.0,0.8)); float t3=tree(p,vec3(-7.5,0.0,-3.0));',
    '  return min(g,min(h,min(t1,min(t2,t3))));',
    '}',
    'vec3 sky(vec3 rd){',
    '  float y=rd.y;',
    '  vec3 c=mix(vec3(0.95,0.42,0.18), vec3(0.12,0.06,0.22), smoothstep(-0.05,0.72,y));',
    '  c=mix(vec3(0.98,0.62,0.28),c,smoothstep(-0.2,0.12,y));',
    '  vec3 sun=normalize(vec3(-0.55,0.10,0.55));',
    '  c+=vec3(1.0,0.7,0.3)*pow(max(0.0,dot(rd,sun)), 28.0)*2.2;',
    '  c+=vec3(1.0,0.45,0.12)*pow(max(0.0,dot(rd,sun)), 3.0)*0.55;',
    '  if(uHas>0.5){vec2 su=vec2(atan(rd.z,rd.x)/6.2831853+0.5,rd.y*0.5+0.5);c=mix(c,texture2D(uTex,su).rgb,0.3);}',
    '  return c;',
    '}',
    'void main(){',
    '  vec2 fc=gl_FragCoord.xy; vec2 uv=(fc-0.5*uR)/uR.y;',
    '  float pr=uP;',
    '  vec3 ro=vec3(-7.5+uM.x*2.5, mix(1.6,3.2,pr)+uM.y*0.6, mix(12.5,5.2,pr));',
    '  vec3 ta=vec3(0.0,1.8,0.2);',
    '  vec3 rd=look(ro,ta,uv,1.25);',
    '  float dist=0.0; float hit=0.0;',
    '  for(int i=0;i<88;i++){ float d=map(ro+rd*dist); if(d<0.025){hit=1.0;break;} dist+=d; if(dist>60.0) break; }',
    '  vec3 col=sky(rd);',
    '  if(hit>0.5){',
    '    vec3 p=ro+rd*dist;',
    '    vec2 e=vec2(0.01,0.0);',
    '    vec3 n=normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx)));',
    '    vec3 L=normalize(vec3(-0.55,0.35,0.4));',
    '    float dif=max(0.0,dot(n,L)); float amb=0.28+0.25*n.y;',
    '    vec3 mat=vec3(0.10,0.28,0.12);',
    '    if(p.y>0.12 && house(p)<0.08){ mat=mix(vec3(0.42,0.28,0.16),uA*0.55,0.2); if(p.y>3.1) mat=vec3(0.35,0.14,0.10); }',
    '    if(length(p.xz-vec2(-6.2,1.5))<1.3 && p.y>1.5) mat=vec3(0.08,0.22,0.08);',
    '    col=mat*(amb+dif*0.9);',
    '    if(p.y<0.08){ vec3 r=reflect(rd,vec3(0,1,0)); col=mix(col,sky(r),0.45); col+=pow(max(0.0,dot(r,L)),40.0)*0.4; }',
    '    col=mix(col,sky(rd),1.0-exp(-0.025*dist));',
    '  }',
    '  vec3 sun=normalize(vec3(-0.55,0.10,0.55));',
    '  col+=vec3(1.0,0.55,0.2)*pow(max(0.0,dot(rd,sun)), 6.0)*0.12;',
    '  vec2 q=fc/uR; col*=0.72+0.28*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y),0.32);',
    '  col+= (hash(fc+uT)-0.5)*0.03; col=aces(col);',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  var SHADERS = { flyover: FS_FLY, layers: FS_SEA, ball: FS_BALL, clubhouse: FS_CLUB };

  var world = null, raf = 0, mx = 0, my = 0, smx = 0, smy = 0, p = 0, tp = 0, running = false, touchY = null;
  var gls = null;

  function ensureCss() {
    if (document.getElementById('hs-css')) return;
    var s = document.createElement('style'); s.id = 'hs-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function compile(gl, vsSrc, fsSrc) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        try { console.warn('homeskin shader', gl.getShaderInfoLog(s)); } catch (e) {}
        gl.deleteShader(s); return null;
      }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, vsSrc), fs = sh(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var pr = gl.createProgram();
    gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      try { console.warn('homeskin link', gl.getProgramInfoLog(pr)); } catch (e2) {}
      return null;
    }
    return pr;
  }

  function killGL() {
    if (!gls) return;
    gls.dead = true;
    try {
      var lose = gls.gl && gls.gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } catch (e) {}
    gls = null;
  }

  function loadTex(gl, url, cb) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 20, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (!url) { cb(tex, 0); return; }
    var img = new Image();
    img.onload = function () {
      try {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        cb(tex, 1);
      } catch (e) { cb(tex, 0); }
    };
    img.onerror = function () { cb(tex, 0); };
    img.src = url;
  }

  function bootGL(canvas, id, skin) {
    killGL();
    var gl = canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' })
      || canvas.getContext('experimental-webgl');
    if (!gl) return null;
    var prog = compile(gl, VS, SHADERS[id]);
    if (!prog) return null;
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(prog);
    var st = {
      gl: gl, prog: prog, canvas: canvas, dead: false,
      uR: gl.getUniformLocation(prog, 'uR'),
      uT: gl.getUniformLocation(prog, 'uT'),
      uP: gl.getUniformLocation(prog, 'uP'),
      uM: gl.getUniformLocation(prog, 'uM'),
      uA: gl.getUniformLocation(prog, 'uA'),
      uHas: gl.getUniformLocation(prog, 'uHas'),
      has: 0
    };
    var url = '';
    if (id === 'flyover' || id === 'layers' || id === 'clubhouse') url = (skin.slots && skin.slots.sky) || '';
    if (id === 'ball') url = (skin.slots && (skin.slots.ball || skin.slots.bg)) || '';
    loadTex(gl, url, function (tex, has) {
      if (st.dead) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      var uTex = gl.getUniformLocation(prog, 'uTex');
      if (uTex) gl.uniform1i(uTex, 0);
      st.has = has;
    });
    gls = st;
    return st;
  }

  function resize() {
    if (!gls || !gls.canvas) return;
    var r = gls.canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, (document.documentElement.classList.contains('phone-mode') || innerWidth < 820) ? 1.15 : 1.6);
    var w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (gls.canvas.width !== w || gls.canvas.height !== h) {
      gls.canvas.width = w; gls.canvas.height = h;
      gls.gl.viewport(0, 0, w, h);
    }
  }

  function tick(now) {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    p += (tp - p) * 0.07;
    smx += (mx - smx) * 0.08;
    smy += (my - smy) * 0.08;
    if (world) {
      var bar = world.querySelector('.hs-bar i');
      if (bar) bar.style.width = (p * 100) + '%';
      world.classList.toggle('scrolled', p > 0.06);
    }
    if (!gls || gls.dead) return;
    resize();
    var gl = gls.gl, ac = hex3(get().accent);
    gl.uniform2f(gls.uR, gls.canvas.width, gls.canvas.height);
    gl.uniform1f(gls.uT, now * 0.001);
    gl.uniform1f(gls.uP, p);
    gl.uniform2f(gls.uM, smx, smy);
    gl.uniform3f(gls.uA, ac[0], ac[1], ac[2]);
    gl.uniform1f(gls.uHas, gls.has);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function startLoop() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(tick);
  }
  function stopLoop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    killGL();
  }

  function onMove(e) {
    if (get().id === 'lobby') return;
    var x = e.clientX, y = e.clientY;
    if (e.touches && e.touches[0]) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
    mx = (x / (innerWidth || 1)) * 2 - 1;
    my = (y / (innerHeight || 1)) * 2 - 1;
  }
  function onWheel(e) {
    if (get().id === 'lobby') return;
    tp = Math.max(0, Math.min(1, tp + (e.deltaY || 0) / 900));
  }
  function onTouchStart(e) { if (e.touches && e.touches[0]) touchY = e.touches[0].clientY; }
  function onTouchMove(e) {
    if (get().id === 'lobby') return;
    if (!e.touches || !e.touches[0] || touchY == null) return;
    var y = e.touches[0].clientY;
    tp = Math.max(0, Math.min(1, tp + (touchY - y) / 480));
    touchY = y; onMove(e);
  }
  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('wheel', onWheel, { passive: true });
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('resize', function () { if (running) resize(); });
  }

  function paint(id) {
    if (!world) return;
    killGL();
    var skin = get();
    var title = skin.title ? ('<div class="hs-title">' + esc(skin.title) + '</div>') : '';
    if (id === 'lobby') {
      world.innerHTML = title;
      world.classList.remove('on', 'scrolled');
      return;
    }
    world.innerHTML = title + '<canvas class="hs-gl"></canvas><div class="hs-bar"><i></i></div><div class="hs-scroll"></div>';
    world.classList.add('on');
    var canvas = world.querySelector('canvas.hs-gl');
    var st = bootGL(canvas, id, skin);
    if (!st) {
      world.querySelector('.hs-gl').style.background = 'radial-gradient(ellipse at 50% 30%, #1a3a28, #07090c)';
    }
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
    p = 0; tp = 0; mx = 0; my = 0; smx = 0; smy = 0;
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
    KEY: KEY, TEMPLATES: TEMPLATES, get: get, save: save, src: src, tplOf: tplOf, mount: mount, readFileToJpeg: readFileToJpeg,
    id: function () { return get().id; }
  };
  window.addEventListener('ga:homeskin-changed', function () { mount(); });
})();
