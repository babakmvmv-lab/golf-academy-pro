/* ═══════════════════════════════════════════════════════════════════
   GolfAcademy.sa — Landing سینمایی (بازطراحی کامل)
   ───────────────────────────────────────────────────────────────────
   • افتتاحیهٔ لایو-اکشن ۱۰ ثانیه‌ای به سبک MARVEL (لوگو-اسلم + مونتاژ سینمایی)
   • عکس‌های سینمایی جدید: Tee → Swing → Sky → Hole (لایو-اکشن واقعی)
   • صفحهٔ اصلی بازطراحی‌شده: لابی فوتورئالیستی که خانم رسپشن داخل خود
     تصویر تولید شده است (هات‌اسپات نامرئی + حلقهٔ طلایی ضربان‌دار).
   • منوی پایین فقط ۴ آیکن: تماس با ما · اطلاعات · تقویم آکادمی · رکوردداران
   • ورود اعضا فقط با دکمهٔ بالای صفحه؛ فرم ورود هرگز در بارگذاری ظاهر نمی‌شود.
   • پارالاکس ۵-۱۰ درجه · صدای محیطی WebAudio · کاملاً ریسپانسیو.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var esc = function(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
var L = function(id, fallback){ return window.UI_LABELS ? UI_LABELS.t(id, fallback) : fallback; };
var D = window.Data || {};

/* ─────────── CSS ─────────── */
var CSS = `
#l3d{position:fixed;inset:0;z-index:150;overflow:hidden;background:#05070b;direction:rtl;font-family:'Vazirmatn',Tahoma,sans-serif;-webkit-user-select:none;user-select:none}
#l3d *{box-sizing:border-box}
#l3d .l3d-hide{display:none!important}
/* ═══ سکانس افتتاحیه (لایو-اکشن MARVEL) ═══ */
#l3d-intro{position:absolute;inset:0;z-index:55;background:#000;overflow:hidden}
#l3d-intro.shake{animation:l3dshake .5s cubic-bezier(.36,.07,.19,.97) both}
@keyframes l3dshake{10%,90%{transform:translate(-2px,1px)}20%,80%{transform:translate(4px,-2px)}30%,50%,70%{transform:translate(-7px,3px)}40%,60%{transform:translate(7px,-3px)}}
#l3d-intro .fr{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity .75s ease}
#l3d-intro .fr.on{opacity:1}
#l3d-intro .fr.kz{animation:l3dz 1.5s ease forwards}
@keyframes l3dz{0%{transform:scale(1.03)}100%{transform:scale(1.18)}}
#l3d-intro .fr.kz2{animation:l3dz2 1.6s ease forwards}
@keyframes l3dz2{0%{transform:scale(1.2)}100%{transform:scale(1)}}
#l3d-intro .vin{position:absolute;inset:0;z-index:4;pointer-events:none;background:radial-gradient(ellipse at center,transparent 46%,rgba(0,0,0,.78) 100%)}
/* لوگوی سینمایی */
#l3d-logo{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:6;text-align:center;direction:ltr}
#l3d-logo .lg-letters{display:inline-flex;gap:1px;perspective:700px}
#l3d-logo .lg-ch{display:inline-block;font-size:clamp(34px,8vw,86px);font-weight:900;letter-spacing:3px;color:#f6e27a;
  background:linear-gradient(180deg,#fff6d8 0%,#f6e27a 32%,#d4af37 62%,#8a6a12 100%);
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  opacity:0;text-shadow:0 0 40px rgba(212,175,55,.55)}
#l3d-logo .lg-ch.on{animation:l3dch .5s cubic-bezier(.16,1,.3,1) forwards}
@keyframes l3dch{0%{opacity:0;transform:translateY(140px) scale(2.6) rotateY(70deg)}100%{opacity:1;transform:translateY(0) scale(1) rotateY(0deg)}}
#l3d-logo.hit .lg-ch{animation:l3dslam .42s cubic-bezier(.16,1,.3,1) both}
@keyframes l3dslam{0%{transform:scale(1)}45%{transform:scale(1.28)}100%{transform:scale(1)}}
#l3d-logo .lg-sub{margin-top:14px;font-size:clamp(13px,2.4vw,20px);color:#F8FAFC;letter-spacing:6px;opacity:0;transition:opacity .6s ease .15s;font-weight:700}
#l3d-logo .lg-sub.on{opacity:1}
#l3d-logo .lg-line{width:0;height:2px;margin:10px auto 0;background:linear-gradient(90deg,transparent,#d4af37,transparent);transition:width .8s ease .2s}
#l3d-logo .lg-line.on{width:100%}
#l3d-flash{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,1),rgba(255,244,200,.85) 40%,transparent 75%);opacity:0;pointer-events:none;z-index:7}
#l3d-flash.on{animation:l3df .55s ease-out forwards}
@keyframes l3df{0%{opacity:1}100%{opacity:0}}
#l3d-wave{position:absolute;left:50%;top:50%;width:0;height:0;border-radius:50%;z-index:7;
  background:radial-gradient(circle,rgba(255,255,255,.98) 0%,rgba(212,175,55,.6) 38%,rgba(255,255,255,0) 72%);
  transform:translate(-50%,-50%);opacity:0;pointer-events:none}
#l3d-wave.on{animation:l3dw .95s ease-out forwards}
@keyframes l3dw{0%{width:0;height:0;opacity:1}75%{opacity:.9}100%{width:270vmax;height:270vmax;opacity:0}}
#l3d-intro .l3d-brand{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);color:rgba(248,250,252,.55);font-size:12px;letter-spacing:2px;z-index:5}
/* ═══ لابی (بازطراحی) ═══ */
#l3d-stage{position:absolute;inset:0;perspective:1300px;transition:transform 1.1s cubic-bezier(.2,.9,.25,1),transform-origin 1.1s cubic-bezier(.2,.9,.25,1)}
#l3d-bg{position:absolute;left:50%;top:50%;width:116%;height:116%;transform:translate(-50%,-50%);
  background-image:url(assets/lobby_bg_v3.webp);background-size:cover;background-position:center;
  will-change:transform;box-shadow:0 0 120px rgba(0,0,0,.5) inset}
#l3d-rays{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;opacity:.45;mix-blend-mode:screen;
  background:
   radial-gradient(ellipse 40% 28% at 78% 30%,rgba(212,175,55,.26),transparent 65%),
   radial-gradient(ellipse 50% 36% at 20% 62%,rgba(212,175,55,.13),transparent 70%)}
#l3d-dust{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:3}
/* هات‌اسپات خانم رسپشن (داخل خود تصویر است) */
#l3d-reception{position:absolute;left:34%;top:52%;width:42%;height:52%;transform:translate(-50%,-50%);z-index:6;cursor:pointer}
#l3d-reception .ring{position:absolute;left:50%;top:50%;width:120px;height:120px;transform:translate(-50%,-50%);pointer-events:none;
  border:1.5px solid rgba(212,175,55,.8);border-radius:50%;box-shadow:0 0 26px rgba(212,175,55,.5),inset 0 0 18px rgba(212,175,55,.28);
  animation:l3dring 2.8s ease-in-out infinite}
#l3d-reception .ring::after{content:'';position:absolute;inset:-9px;border:1px solid rgba(212,175,55,.32);border-radius:50%;animation:l3dring2 2.8s ease-in-out infinite}
@keyframes l3dring{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.9}50%{transform:translate(-50%,-50%) scale(1.14);opacity:.45}}
@keyframes l3dring2{0%{transform:scale(1);opacity:.65}50%{transform:scale(1.2);opacity:.18}100%{transform:scale(1);opacity:.65}}
#l3d-reception .lb{position:absolute;left:50%;top:calc(50% + 92px);transform:translateX(-50%);padding:5px 15px;border-radius:20px;
  font-size:12px;font-weight:800;color:#0B0F14;white-space:nowrap;pointer-events:none;
  background:linear-gradient(135deg,#f6e27a,#d4af37 60%,#b58c1c);box-shadow:0 4px 14px rgba(0,0,0,.45),0 0 14px rgba(212,175,55,.5);
  opacity:0;transition:opacity .25s}
#l3d-reception:hover .lb{opacity:1}
#l3d-reception:hover .ring{border-color:#f6e27a}
/* منوی پایین — فقط ۴ آیکن */
#l3d-dock{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:9;display:flex;justify-content:center;gap:10px;
  padding:12px 18px;border-radius:24px;background:rgba(11,15,20,.45);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border:1px solid rgba(212,175,55,.4);box-shadow:0 12px 38px rgba(0,0,0,.55)}
#l3d-dock .di{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:76px;padding:9px 15px;border-radius:16px;cursor:pointer;
  color:#F8FAFC;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);transition:all .22s}
#l3d-dock .di .ic{font-size:22px;filter:drop-shadow(0 0 9px rgba(212,175,55,.55))}
#l3d-dock .di .tx{font-size:11.5px;font-weight:800}
#l3d-dock .di:hover{background:rgba(212,175,55,.18);border-color:rgba(212,175,55,.55);color:#f6e27a;transform:translateY(-3px)}
/* پنل شیشه‌ای طلایی */
#l3d-panel{position:absolute;left:50%;top:50%;z-index:50;width:min(560px,92vw);max-height:82vh;overflow:auto;padding:26px;
  border-radius:24px;background:rgba(11,15,20,.6);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
  border:1px solid rgba(212,175,55,.6);box-shadow:0 24px 70px rgba(0,0,0,.65),0 0 60px rgba(212,175,55,.12);
  transform:translate(-50%,-50%) scale(.86);opacity:0;pointer-events:none;transition:transform .45s cubic-bezier(.2,.9,.25,1.2),opacity .4s ease;direction:rtl;text-align:right;color:#F8FAFC}
#l3d-panel.on{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1)}
#l3d-panel .hd{display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:13px;border-bottom:1px solid rgba(212,175,55,.35)}
#l3d-panel .hd .ic{font-size:26px}
#l3d-panel .hd h3{margin:0;font-size:18px;color:#f6e27a}
#l3d-panel .hd .tg{margin-left:auto;font-size:11px;color:rgba(248,250,252,.65);background:rgba(212,175,55,.14);padding:4px 10px;border-radius:20px;border:1px solid rgba(212,175,55,.35)}
#l3d-pclose{position:absolute;top:12px;left:12px;width:34px;height:34px;border-radius:50%;border:1px solid rgba(212,175,55,.55);background:rgba(11,15,20,.7);color:#f6e27a;font-size:15px;cursor:pointer;z-index:3;transition:all .2s}
#l3d-pclose:hover{background:rgba(212,175,55,.25);transform:rotate(90deg)}
#l3d-panel .sub{color:rgba(248,250,252,.85);font-size:13.5px;line-height:2}
#l3d-panel .sub b{color:#f6e27a}
#l3d-panel .row{display:flex;justify-content:space-between;gap:8px;padding:9px 12px;border-radius:12px;background:rgba(255,255,255,.04);margin-bottom:7px;font-size:13px}
#l3d-panel .row.hl{background:rgba(212,175,55,.14);border:1px solid rgba(212,175,55,.4)}
#l3d-panel .row .pnm{display:flex;align-items:center;gap:9px}
#l3d-panel .row img{width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid rgba(212,175,55,.5)}
#l3d-panel .nm{font-weight:700;color:#F8FAFC}
#l3d-panel .pv{color:#f6e27a;font-weight:800}
#l3d-panel .md{font-size:16px}
#l3d-panel .l3d-nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
#l3d-panel .l3d-nav button{padding:8px 15px;border-radius:14px;border:1px solid rgba(212,175,55,.4);background:rgba(212,175,55,.1);color:#F8FAFC;font-size:12.5px;cursor:pointer;transition:all .2s}
#l3d-panel .l3d-nav button.on{background:linear-gradient(135deg,#f6e27a,#d4af37);color:#0B0F14;font-weight:700}
#l3d-panel .l3d-nav button:hover{background:rgba(212,175,55,.28)}
#l3d-panel .l3d-months{display:flex;flex-wrap:wrap;gap:7px;margin:14px 0}
#l3d-panel .l3d-months button{padding:7px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#F8FAFC;font-size:12px;cursor:pointer}
#l3d-panel .l3d-months button.on{background:rgba(212,175,55,.28);border-color:rgba(212,175,55,.6);color:#f6e27a}
#l3d-panel .l3d-tro{display:flex;flex-wrap:wrap;gap:14px;margin-top:14px}
#l3d-panel .l3d-tro .cup{flex:1;min-width:110px;padding:14px;text-align:center;border-radius:16px;background:rgba(212,175,55,.1);border:1px solid rgba(212,175,55,.4);cursor:pointer;transition:all .25s}
#l3d-panel .l3d-tro .cup:hover{transform:translateY(-5px);background:rgba(212,175,55,.2)}
#l3d-panel .l3d-tro .cup .em{font-size:34px;filter:drop-shadow(0 0 12px rgba(212,175,55,.8))}
#l3d-panel .l3d-tro .cup .cn{margin-top:6px;font-size:12px;color:#f6e27a;font-weight:700}
#l3d-panel .qrwrap{display:flex;align-items:center;gap:16px;margin-top:14px;padding:14px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
#l3d-panel .qrwrap canvas{background:#fff;border-radius:10px;padding:6px}
#l3d-panel .note{font-size:11.5px;color:rgba(248,250,252,.55);margin-top:10px}
#l3d-panel .golfrule{margin-top:12px;padding:10px 13px;border-radius:12px;border:1px solid rgba(212,175,55,.4);background:rgba(212,175,55,.08);font-size:12.5px;line-height:1.9}
#l3d-panel .podium{display:flex;justify-content:center;align-items:flex-end;gap:10px;margin:14px 0}
#l3d-panel .podium .st{text-align:center;padding:12px 10px 10px;border-radius:14px;min-width:86px;background:rgba(255,255,255,.05);border:1px solid rgba(212,175,55,.3)}
#l3d-panel .podium .st .rk{font-size:22px}
#l3d-panel .podium .st .nm2{font-size:12px;font-weight:800;margin-top:4px}
#l3d-panel .podium .st .pv2{font-size:11px;color:#f6e27a;font-weight:700;margin-top:2px}
/* دکمه ورود اعضا — همیشه بالا */
#l3d-enter{position:absolute;top:20px;right:22px;z-index:70;padding:12px 24px;border-radius:40px;cursor:pointer;
  font-family:inherit;font-size:14px;font-weight:800;color:#0B0F14;
  background:linear-gradient(135deg,#f6e27a,#d4af37 55%,#b58c1c);border:1px solid rgba(255,255,255,.55);
  box-shadow:0 10px 30px rgba(0,0,0,.45),0 0 24px rgba(212,175,55,.55);animation:l3dfbt 3.4s ease-in-out infinite;transition:transform .25s,box-shadow .25s}
#l3d-enter:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 16px 42px rgba(0,0,0,.5),0 0 44px rgba(212,175,55,.85)}
@keyframes l3dfbt{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
#l3d-sndhint{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);z-index:80;padding:7px 15px;border-radius:20px;
  font-size:11.5px;font-weight:800;color:#0B0F14;background:linear-gradient(135deg,#f6e27a,#d4af37 60%,#b58c1c);
  box-shadow:0 6px 18px rgba(0,0,0,.5),0 0 18px rgba(212,175,55,.5);opacity:0;transition:opacity .4s;pointer-events:none;white-space:nowrap}
#l3d-sndhint.on{opacity:.95;animation:l3dfbt 2.4s ease-in-out infinite}
#l3d.fadeout{animation:l3dfade .7s ease forwards}
@keyframes l3dfade{to{opacity:0}}
/* ═══ ریسپانسیو (موبایل مود) ═══ */
@media (max-width:820px){
  /* دکمهٔ ورود اعضا: کوچک و بالای صفحه (موبایل) */
  #l3d-enter{top:10px;bottom:auto;left:50%;right:auto;transform:translateX(-50%);width:auto;max-width:72vw;white-space:nowrap;
    text-align:center;padding:8px 16px;font-size:12px;border-radius:30px;animation:none}
  #l3d-enter:hover{transform:translateX(-50%) translateY(-2px) scale(1.03)}
  /* لابی: نمایش سمت چپ تصویر تا خانم رسپشن وسط قاب بیفتد */
  #l3d-bg{background-position:22% center;width:124%;height:124%}
  #l3d-reception{left:50%;width:56%;height:44%;top:53%}
  #l3d-dock{bottom:10px;gap:7px;padding:10px 12px;border-radius:18px}
  #l3d-dock .di{min-width:60px;padding:7px 10px;gap:3px}
  #l3d-dock .di .ic{font-size:18px}
  #l3d-dock .di .tx{font-size:10px}
  #l3d-panel{width:94vw;max-height:82vh;padding:18px;border-radius:18px}
  #l3d-panel .hd h3{font-size:15.5px}
  #l3d-reception .ring{width:86px;height:86px}
  #l3d-reception .lb{top:calc(50% + 68px);opacity:.9;font-size:10px;padding:4px 11px}
  #l3d-logo .lg-ch{font-size:34px;letter-spacing:2px}
  #l3d-logo .lg-sub{font-size:12px;letter-spacing:3px}
  /* اینترو: فریم‌های سینمایی برای صفحهٔ عمودی (مرکز سوژه) */
  #l3d-intro .fr{background-position:center 32%}
}
@media (max-width:480px){
  #l3d-dock{bottom:8px;gap:5px;padding:8px 6px;width:calc(100% - 14px);border-radius:16px}
  #l3d-dock .di{min-width:0;flex:1;padding:7px 3px}
  #l3d-dock .di .ic{font-size:17px}
  #l3d-dock .di .tx{font-size:9px}
  #l3d-enter{top:8px;bottom:auto;width:auto;max-width:74vw;padding:7px 14px;font-size:11.5px}
  #l3d-bg{background-position:19% center}
  #l3d-reception .ring{width:62px;height:62px}
  #l3d-reception .lb{top:calc(50% + 52px);font-size:9px;padding:3px 9px}
  #l3d-logo .lg-ch{font-size:26px;letter-spacing:1px}
  #l3d-logo .lg-sub{font-size:10.5px;letter-spacing:2px;margin-top:10px}
  #l3d-logo .lg-line{margin-top:7px}
  #l3d-panel{width:96vw;padding:16px 14px;max-height:84vh}
  #l3d-panel .l3d-nav button{padding:7px 10px;font-size:11px}
  #l3d-panel .row{font-size:11.5px;padding:8px 9px}
  #l3d-panel .qrwrap{flex-direction:column;text-align:center;padding:12px}
  #l3d-panel .l3d-months button{padding:6px 8px;font-size:10.5px}
  #l3d-panel .podium .st{min-width:70px;padding:9px 6px}
  #l3d-intro .l3d-brand{bottom:14px;font-size:10px}
}
@media (max-height:560px) and (orientation:landscape){
  #l3d-logo .lg-ch{font-size:30px}
  #l3d-logo .lg-sub{font-size:11px}
  #l3d-dock{bottom:6px;padding:6px 8px}
}
`;

var cssEl = document.createElement('style');
cssEl.textContent = CSS;
document.head.appendChild(cssEl);

/* ─────────── ساخت DOM ─────────── */
var root = document.createElement('div');
root.id = 'l3d';
root.innerHTML =
  '<div id="l3d-intro">' +
    '<div class="fr" style="background-image:url(assets/open_tee.webp)"></div>' +
    '<div class="fr" style="background-image:url(assets/open_swing.webp)"></div>' +
    '<div class="fr" style="background-image:url(assets/open_sky.webp)"></div>' +
    '<div class="fr" style="background-image:url(assets/open_hole.webp)"></div>' +
    '<div class="vin"></div>' +
    '<div id="l3d-logo"><div class="lg-letters" id="l3d-lg"></div><div class="lg-sub" id="l3d-lgsub">آکادمی گلف ۱۴۰۵ — GolfAcademy.sa</div><div class="lg-line" id="l3d-lgline"></div></div>' +
    '<div id="l3d-flash"></div><div id="l3d-wave"></div><div id="l3d-sndhint">🔊 برای شنیدن صدای افتتاحیه، صفحه را لمس کنید</div>' +
    '<div class="l3d-brand">GOLFACADEMY</div>' +
  '</div>' +
  '<div id="l3d-stage">' +
    '<div id="l3d-bg"></div>' +
    '<div id="l3d-rays"></div>' +
    '<canvas id="l3d-dust"></canvas>' +
    '<div id="l3d-reception"><span class="ring"></span><span class="lb">🛎️ ' + esc(L('landing.reception','رسپشن')) + '</span></div>' +
    '<div id="l3d-dock"></div>' +
  '</div>' +
  '<div id="l3d-panel"><button id="l3d-pclose" title="بستن">✕</button><div id="l3d-pbody"></div></div>' +
  '<button id="l3d-enter">👤 ' + esc(L('landing.enter','ورود اعضا')) + '</button>';
document.body.appendChild(root);

var $ = function(s){ return root.querySelector(s); };
var intro = $('#l3d-intro'), stage = $('#l3d-stage'), bg = $('#l3d-bg');
var panel = $('#l3d-panel'), pbody = $('#l3d-pbody');
var dock = $('#l3d-dock'), dust = $('#l3d-dust');
var frames = intro.querySelectorAll('.fr');
var STATE = { mode: 'lobby', panel: null, introDone: false };

/* ─────────── صدا: فقط اینتروی ابتدای ورود (پنل کاملاً بی‌صداست) ─────────── */
var AC = null, muted = false;
function initAudio(){
  if (AC){ if (AC.state === 'suspended'){ try { AC.resume(); } catch(e){} } return AC; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ AC = null; }
  return AC;
}
function audioOn(){ return !!(AC && AC.state === 'running' && !muted); }
function noiseBuf(){
  if (!AC) return null;
  if (!noiseBuf._b || noiseBuf._sr !== AC.sampleRate){
    var len = Math.floor(AC.sampleRate * 2), b = AC.createBuffer(1, len, AC.sampleRate), d = b.getChannelData(0);
    for (var i=0;i<len;i++) d[i] = Math.random()*2-1;
    noiseBuf._b = b; noiseBuf._sr = AC.sampleRate;
  }
  return noiseBuf._b;
}
/* صدای اینترو — همه به‌صورت محاسباتی (بدون فایل صوتی، کاملاً آفلاین) */
function sfx(type){
  if (!audioOn()) return;
  var t0 = AC.currentTime;
  try {
    if (type === 'boom'){
      var b = AC.createOscillator(), bg = AC.createGain();
      b.type = 'sine'; b.frequency.setValueAtTime(110, t0);
      b.frequency.exponentialRampToValueAtTime(38, t0 + .9);
      bg.gain.setValueAtTime(.5, t0); bg.gain.exponentialRampToValueAtTime(.001, t0 + 1.1);
      b.connect(bg); bg.connect(AC.destination); b.start(t0); b.stop(t0 + 1.15);
      var n = AC.createBufferSource(); n.buffer = noiseBuf();
      var nf = AC.createBiquadFilter(); nf.type='lowpass'; nf.frequency.setValueAtTime(900, t0); nf.frequency.exponentialRampToValueAtTime(120, t0 + .8);
      var ng = AC.createGain(); ng.gain.setValueAtTime(.34, t0); ng.gain.exponentialRampToValueAtTime(.001, t0 + .9);
      n.connect(nf); nf.connect(ng); ng.connect(AC.destination); n.start(t0); n.stop(t0 + .95);
    } else if (type === 'whoosh'){
      var w = AC.createBufferSource(); w.buffer = noiseBuf();
      var wf = AC.createBiquadFilter(); wf.type='bandpass';
      wf.frequency.setValueAtTime(220, t0); wf.frequency.exponentialRampToValueAtTime(2400, t0 + .5); wf.Q.value = 1.1;
      var wg2 = AC.createGain(); wg2.gain.setValueAtTime(.0001, t0); wg2.gain.exponentialRampToValueAtTime(.18, t0 + .16);
      wg2.gain.exponentialRampToValueAtTime(.001, t0 + .55);
      w.connect(wf); wf.connect(wg2); wg2.connect(AC.destination); w.start(t0); w.stop(t0 + .6);
    } else if (type === 'sweet'){
      /* ★ ضربهٔ «سوئیت‌اسپات» — دقیقاً روی فریم ضربه زدن به توپ */
      var sw = AC.createBufferSource(); sw.buffer = noiseBuf();       // سوت چوب گلف قبل از برخورد
      var swf = AC.createBiquadFilter(); swf.type='bandpass'; swf.Q.value = 1.6;
      swf.frequency.setValueAtTime(900, t0); swf.frequency.exponentialRampToValueAtTime(3200, t0 + .12);
      var swg = AC.createGain(); swg.gain.setValueAtTime(.0001, t0); swg.gain.exponentialRampToValueAtTime(.14, t0 + .07);
      swg.gain.exponentialRampToValueAtTime(.0008, t0 + .16);
      sw.connect(swf); swf.connect(swg); swg.connect(AC.destination); sw.start(t0); sw.stop(t0 + .18);
      var ti = t0 + .06;                                              // خودِ برخورد: کلیکِ فلزی کوتاه
      var ck = AC.createBufferSource(); ck.buffer = noiseBuf();
      var cf = AC.createBiquadFilter(); cf.type='highpass'; cf.frequency.value = 2600;
      var cg = AC.createGain(); cg.gain.setValueAtTime(.55, ti); cg.gain.exponentialRampToValueAtTime(.0008, ti + .055);
      ck.connect(cf); cf.connect(cg); cg.connect(AC.destination); ck.start(ti); ck.stop(ti + .07);
      var tn = AC.createOscillator(), tg = AC.createGain();           // رزونانس سرِ چوب
      tn.type = 'triangle'; tn.frequency.setValueAtTime(1750, ti); tn.frequency.exponentialRampToValueAtTime(760, ti + .1);
      tg.gain.setValueAtTime(.34, ti); tg.gain.exponentialRampToValueAtTime(.0008, ti + .16);
      tn.connect(tg); tg.connect(AC.destination); tn.start(ti); tn.stop(ti + .18);
      var th = AC.createOscillator(), thg = AC.createGain();          // تهِ ضربه (بم)
      th.type = 'sine'; th.frequency.setValueAtTime(210, ti); th.frequency.exponentialRampToValueAtTime(70, ti + .18);
      thg.gain.setValueAtTime(.3, ti); thg.gain.exponentialRampToValueAtTime(.0008, ti + .24);
      th.connect(thg); thg.connect(AC.destination); th.start(ti); th.stop(ti + .26);
    } else if (type === 'drop'){
      /* افتادن توپ داخل هول: برخورد به فنجان + غلت */
      for (var k=0;k<3;k++){
        var tk = t0 + k*.075;
        var o = AC.createOscillator(), og = AC.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(520 - k*90, tk); o.frequency.exponentialRampToValueAtTime(180, tk + .09);
        og.gain.setValueAtTime(.24 - k*.05, tk); og.gain.exponentialRampToValueAtTime(.0008, tk + .12);
        o.connect(og); og.connect(AC.destination); o.start(tk); o.stop(tk + .14);
      }
      var r = AC.createBufferSource(); r.buffer = noiseBuf();
      var rf = AC.createBiquadFilter(); rf.type='bandpass'; rf.frequency.value = 380; rf.Q.value = 2.4;
      var rg = AC.createGain(); rg.gain.setValueAtTime(.16, t0); rg.gain.exponentialRampToValueAtTime(.0008, t0 + .4);
      r.connect(rf); rf.connect(rg); rg.connect(AC.destination); r.start(t0); r.stop(t0 + .45);
    } else if (type === 'applause'){
      /* 👏 تشویق جمعیت — موج نویز + کف‌زدن‌های تصادفی + هلهله */
      var dur = 3.4, st = t0 + .12;
      var bed = AC.createBufferSource(); bed.buffer = noiseBuf(); bed.loop = true;
      var bf = AC.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value = 1500; bf.Q.value = .7;
      var bg2 = AC.createGain();
      bg2.gain.setValueAtTime(.0001, st);
      bg2.gain.linearRampToValueAtTime(.30, st + .45);
      bg2.gain.linearRampToValueAtTime(.24, st + 1.7);
      bg2.gain.exponentialRampToValueAtTime(.0008, st + dur);
      bed.connect(bf); bf.connect(bg2); bg2.connect(AC.destination); bed.start(st); bed.stop(st + dur + .1);
      var claps = 54;
      for (var c=0;c<claps;c++){
        var ct = st + Math.random()*Math.random()*dur*.92 + .02;
        var cs = AC.createBufferSource(); cs.buffer = noiseBuf();
        var cfl = AC.createBiquadFilter(); cfl.type='bandpass';
        cfl.frequency.value = 1100 + Math.random()*2600; cfl.Q.value = 1.1 + Math.random();
        var cgn = AC.createGain();
        var amp = .10 + Math.random()*.16;
        cgn.gain.setValueAtTime(amp, ct); cgn.gain.exponentialRampToValueAtTime(.0006, ct + .045 + Math.random()*.05);
        cs.connect(cfl); cfl.connect(cgn); cgn.connect(AC.destination); cs.start(ct); cs.stop(ct + .12);
      }
      var ch = AC.createBufferSource(); ch.buffer = noiseBuf(); ch.loop = true;   // هلهلهٔ جمعیت
      var chf = AC.createBiquadFilter(); chf.type='bandpass'; chf.Q.value = 1.6;
      chf.frequency.setValueAtTime(520, st); chf.frequency.linearRampToValueAtTime(760, st + .8);
      chf.frequency.linearRampToValueAtTime(430, st + dur);
      var chg = AC.createGain();
      chg.gain.setValueAtTime(.0001, st); chg.gain.linearRampToValueAtTime(.13, st + .6);
      chg.gain.exponentialRampToValueAtTime(.0008, st + dur);
      ch.connect(chf); chf.connect(chg); chg.connect(AC.destination); ch.start(st); ch.stop(st + dur + .1);
    }
  } catch(e){}
}

/* باز کردن قفل صدا با اولین تماس کاربر (سیاست autoplay مرورگرها) — بدون هیچ صدای پنل */
function sndHint(show){
  var h = document.getElementById('l3d-sndhint');
  if (h) h.classList[show ? 'add' : 'remove']('on');
}
['pointerdown','touchstart','keydown'].forEach(function(ev){
  document.addEventListener(ev, function(){
    initAudio();
    setTimeout(function(){ if (audioOn()) sndHint(false); }, 120);
  }, { passive: true });
});

/* ─────────── اطلاعات سایت (قابل ویرایش از پلن مدیریت) ─────────── */
function siteInfo(){
  try {
    if (window.MGMT && MGMT.getSiteInfo) return MGMT.getSiteInfo();
  } catch(e){}
  return {
    contact: { phone:'۰۶۱-۳۲۴۴۵۶۷۸', email:'info@golfacademy.sa', address:'زمین گلف مسجدسلیمان، خیابان ورزش', website:'GolfAcademy.sa', social:'اینستاگرام · تلگرام · واتساپ', hours:'شنبه تا پنجشنبه ۸ تا ۲۰', qr:'https://golfacademy.sa' },
    info: { intro:'', address:'', hours:'' }
  };
}

/* ─────────── دادهٔ زنده ─────────── */
function liveState(){
  try {
    var st = D.loadState ? D.loadState() : null;
    var A = st ? (D.compute ? D.compute(st) : null) : null;
    return A && A.LB ? A : null;
  } catch(e){ return null; }
}
function medalsOf(r){
  var m = '';
  if (r.rank === 1) m += '🥇'; else if (r.rank === 2) m += '🥈'; else if (r.rank === 3) m += '🥉';
  if (r.win > 1) m += ' 🏅×' + D.fa(r.win);
  return m || '—';
}
function photoOf(pid){
  try { return D.photoOf ? D.photoOf(pid) : (pid % 2 ? 'assets/avatar_m.webp' : 'assets/avatar_f.webp'); }
  catch(e){ return 'assets/avatar_m.webp'; }
}

/* ─────────── سکانس افتتاحیه — لایو-اکشن MARVEL (~۱۰ ثانیه) ─────────── */
var introTimers = [];
function playIntro(){
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches){
    STATE.introDone = true; sndHint(false);
    intro.classList.add('l3d-hide');
    renderDock();
    try { var appEl = document.getElementById('app');
      if (localStorage.getItem('ga_session') && appEl && appEl.classList.contains('on') && root.parentNode) root.parentNode.removeChild(root);
    } catch(e){}
    return;
  }
  initAudio();
  // سیاست مرورگرها: تا اولین لمس، صدا اجرا نمی‌شود → راهنمای کوچک نمایش داده می‌شود
  setTimeout(function(){ if (!audioOn() && !STATE.introDone) sndHint(true); }, 500);
  // لوگو اسلم: حروف GOLFACADEMY یکی‌یکی
  var word = 'GOLFACADEMY';
  var lg = $('#l3d-lg');
  word.split('').forEach(function(ch, i){
    var s = document.createElement('span');
    s.className = 'lg-ch'; s.textContent = ch;
    s.style.animationDelay = (i * 0.08) + 's';
    lg.appendChild(s);
  });
  var steps = [
    { t: 200,  fn: function(){ lg.querySelectorAll('.lg-ch').forEach(function(c){ c.classList.add('on'); }); sfx('whoosh'); } },  // حروف در حال ورود
    { t: 1400, fn: function(){ lg.classList.add('hit'); intro.classList.add('shake'); sfx('boom'); } },                            // اسلم لوگو + لرزش
    { t: 1500, fn: function(){ $('#l3d-flash').classList.add('on'); } },                                                          // فلش نور
    { t: 1800, fn: function(){ $('#l3d-lgsub').classList.add('on'); $('#l3d-lgline').classList.add('on'); } },                    // زیرنویس
    { t: 3000, fn: function(){ lg.style.opacity = 0; sfx('whoosh'); } },                                                          // محو لوگو
    { t: 3400, fn: function(){ frames[0].classList.add('on','kz'); sfx('whoosh'); } },                                            // توپ روی Tee
    { t: 4900, fn: function(){ frames[0].classList.remove('on'); frames[1].classList.add('on','kz2'); sfx('sweet'); } },           // ضربهٔ Swing + صدای سوئیت‌اسپات
    { t: 6200, fn: function(){ frames[1].classList.remove('on'); frames[2].classList.add('on','kz'); sfx('whoosh'); $('#l3d-flash').classList.add('on'); } },  // تعقیب توپ در آسمان
    { t: 7700, fn: function(){ frames[2].classList.remove('on'); frames[3].classList.add('on','kz2'); sfx('drop'); sfx('applause'); } },  // ورود توپ به حفره + تشویق جمعیت
    { t: 8900, fn: function(){ frames[3].classList.add('kz'); $('#l3d-wave').classList.add('on'); sfx('boom'); } },               // موج قهرمانی
    { t: 10000, fn: function(){ finishIntro(); } }                                                                                 // لابی ظاهر می‌شود
  ];
  steps.forEach(function(s){ introTimers.push(setTimeout(s.fn, s.t)); });
  introTimers.push(setTimeout(function(){ intro.classList.add('l3d-hide'); }, 11000));
}
function finishIntro(){
  STATE.introDone = true;
  sndHint(false);
  for (var i=0;i<frames.length;i++) frames[i].style.opacity = 0;
  $('#l3d-flash').classList.remove('on'); $('#l3d-wave').classList.remove('on');
  intro.style.opacity = 0;
  setTimeout(function(){ intro.classList.add('l3d-hide'); intro.style.opacity = 1; }, 750);
  renderDock();
  // اگر کاربر از قبل وارد شده بود → مستقیم به برنامه
  try {
    var appEl = document.getElementById('app');
    if (localStorage.getItem('ga_session') && appEl && appEl.classList.contains('on')){
      setTimeout(function(){ if (root.parentNode) root.parentNode.removeChild(root); }, 900);
    }
  } catch(e){}
}

/* ─────────── پارالاکس ۵-۱۰ درجه ─────────── */
var rotY = 0, rotX = 0, tRotY = 0, tRotX = 0;
(function parallaxLoop(){
  rotY += (tRotY - rotY) * .06;
  rotX += (tRotX - rotX) * .06;
  stage.style.transform = 'rotateY(' + rotY + 'deg) rotateX(' + rotX + 'deg)';
  requestAnimationFrame(parallaxLoop);
})();
document.addEventListener('mousemove', function(e){
  if (STATE.mode !== 'lobby') return;
  var nx = (e.clientX / innerWidth) * 2 - 1;
  var ny = (e.clientY / innerHeight) * 2 - 1;
  tRotY = nx * 4.2;
  tRotX = -ny * 3.2;
});
function resetParallax(){ tRotY = 0; tRotX = 0; }

/* ─────────── ذرات غبار ─────────── */
(function(){
  var ctx = dust.getContext('2d');
  var W, H, pts = [];
  function size(){
    W = dust.width = innerWidth; H = dust.height = innerHeight;
    pts = [];
    for (var i=0;i<Math.min(60, Math.round(innerWidth/30));i++){
      pts.push({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.7 + .5, s: Math.random()*.32 + .07, o: Math.random()*.45 + .12 });
    }
  }
  size(); addEventListener('resize', size);
  (function dustLoop(){
    ctx.clearRect(0,0,W,H);
    for (var i=0;i<pts.length;i++){
      var p = pts[i];
      p.x += Math.sin(performance.now()/3800 + i) * .18 + p.s;
      p.y += Math.cos(performance.now()/5200 + i) * .13 - p.s*.35;
      if (p.x > W + 6) p.x = -6; if (p.y > H + 6) p.y = -6; if (p.y < -6) p.y = H + 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7);
      ctx.fillStyle = 'rgba(230,210,150,' + p.o + ')'; ctx.fill();
    }
    requestAnimationFrame(dustLoop);
  })();
})();

/* ─────────── منوی پایین — فقط ۴ آیکن ─────────── */
var DOCK = [
  ['contact','📞','landing.contact','تماس با ما'],
  ['info','ℹ️','landing.info','اطلاعات'],
  ['cal','📅','landing.calendar','تقویم آکادمی'],
  ['rec','🏆','landing.records','رکوردداران']
];
function renderDock(){
  var h = '';
  DOCK.forEach(function(it){
    h += '<div class="di" data-sec="' + it[0] + '"><span class="ic">' + it[1] + '</span><span class="tx">' + esc(L(it[2],it[3])) + '</span></div>';
  });
  dock.innerHTML = h;
  dock.querySelectorAll('.di').forEach(function(d){
    d.addEventListener('click', function(ev){ ev.stopPropagation(); openPanel(d.dataset.sec); });
  });
}

/* ─────────── پنل‌ها ─────────── */
var panelNav = null, monthSel = 0, trophySel = 0;
function openPanel(sec){
  STATE.panel = sec;
  var html = '';
  if (sec === 'reception') html = panelReception();
  else if (sec === 'info') html = panelInfo();
  else if (sec === 'cal') html = panelCal();
  else if (sec === 'rec') html = panelRecords();
  else if (sec === 'contact') html = panelContact();
  pbody.innerHTML = html;
  panel.classList.add('on');
  STATE.mode = 'zoom';
  wirePanel();
}
function closePanel(){
  if (!panel.classList.contains('on')) return;
  panel.classList.remove('on');
  resetParallax();
  STATE.mode = 'lobby';
  STATE.panel = null;
}
function wirePanel(){
  var b = $('#l3d-pclose');
  if (b){ b.onclick = function(){ closePanel(); }; }
  panel.querySelectorAll('.l3d-nav button').forEach(function(bt){
    bt.addEventListener('click', function(){
      panelNav = bt.dataset.nav;
      panel.querySelectorAll('.l3d-nav button').forEach(function(x){ x.classList.remove('on'); });
      bt.classList.add('on');
      var html = STATE.panel === 'reception' ? receptionTab(panelNav) : (STATE.panel === 'info' ? infoTab(panelNav) : '');
      if (html){ pbody.innerHTML = html; wirePanel(); }
    });
  });
  panel.querySelectorAll('.l3d-months button').forEach(function(bt){
    bt.addEventListener('click', function(){
      monthSel = +bt.dataset.m;
      panel.querySelectorAll('.l3d-months button').forEach(function(x){ x.classList.remove('on'); });
      bt.classList.add('on');
      var html = panelCal(); pbody.innerHTML = html; wirePanel();
    });
  });
  panel.querySelectorAll('.l3d-tro .cup').forEach(function(c){
    c.addEventListener('click', function(){
      trophySel = +c.dataset.c;
      var html = panelRecords(); pbody.innerHTML = html; wirePanel();
    });
  });
}

/* ─────────── محتوا ─────────── */
function panelReception(){
  panelNav = panelNav || 'intro';
  var navs = [
    ['intro','🏛️ ' + L('landing.intro','معرفی')], ['signup','📝 ' + L('landing.signup','ثبت‌نام')],
    ['courses','🎓 ' + L('landing.courses','دوره‌ها')], ['tuition','💰 ' + L('landing.tuition','شهریه')],
    ['rules','📜 ' + L('landing.rules','قوانین')], ['contact','📞 ' + L('landing.contact','تماس با ما')]
  ];
  var navHtml = '<div class="l3d-nav">' + navs.map(function(n){
    return '<button data-nav="' + n[0] + '" class="' + (panelNav === n[0] ? 'on' : '') + '">' + esc(n[1]) + '</button>';
  }).join('') + '</div>';
  return '<div class="hd"><span class="ic">🛎️</span><h3>' + esc(L('landing.reception','رسپشن')) + ' آکادمی گلف ۱۴۰۵</h3><span class="tg">GolfAcademy.sa</span></div>' + navHtml + receptionTab(panelNav);
}
function receptionTab(tab){
  if (tab === 'intro'){
    var SI = siteInfo();
    var introTxt = SI.info.intro ? SI.info.intro : 'آکادمی تخصصی گلف با زمین ۱۸ حفره‌ای «مسجدسلیمان» (پار ۷۲) — دوره‌های آموزشی، اردوهای گروهی، تمرین‌های هفتگی و مسابقات ماهانه برای همهٔ سنین. تمرین‌های گروهی هر پنجشنبه · مسابقات آخرین جمعهٔ هر ماه · دوره‌های ۲ روزه در خرداد و آذر.';
    return '<div class="sub"><b>به آکادمی گلف ۱۴۰۵ خوش آمدید.</b><br>' + esc(introTxt).replace(/\n/g, '<br>') + '<br><br>گلف ورزش دقت و آرامش است — ثبت‌نام در هر فصل از همین رسپشن انجام می‌شود.</div>';
  }
  if (tab === 'signup'){
    return '<div class="sub">ثبت‌نام اعضای جدید — فرم در ' + esc(L('nav.mgmt','پنل مدیریت')) + ' «' + esc(L('admin.players','بازیکنان')) + '» تکمیل می‌شود.<br>برای ثبت‌نام حضوری به ' + esc(L('landing.reception','رسپشن')) + ' آکادمی مراجعه کنید یا با شمارهٔ تماس هماهنگ کنید.</div>' +
      '<div class="golfrule">همهٔ اعضا باید لباس رسمی گلف (پیراهن سفید با لوگوی آکادمی) داشته باشند.</div>';
  }
  if (tab === 'courses'){
    var progs = [];
    try { progs = D.loadPrograms ? D.loadPrograms() : []; } catch(e){}
    var h = '<div class="sub">دوره‌ها و کلاس‌های آموزشی فصل ۱۴۰۵:</div>';
    if (progs.length){
      progs.forEach(function(p){
        var ic = p.type === 'اردو' ? '🏕️' : (p.type === 'تمرین' ? '🏌️' : '🎓');
        h += '<div class="row"><span class="pnm"><span>' + ic + '</span>' + esc(p.name) + '</span><span>' + esc(p.start || '') + '</span></div>';
      });
    } else {
      h += '<div class="row">دورهٔ آموزشی ۲روزهٔ گلف — خرداد</div><div class="row">دورهٔ آماده‌سازی جام بزرگ — آذر</div>';
    }
    return h;
  }
  if (tab === 'tuition'){
    return '<div class="sub">شهریهٔ فصل ۱۴۰۵:</div>' +
      '<div class="row"><span>عضویت سالانه</span><b>طبق تعرفهٔ رسپشن</b></div>' +
      '<div class="row"><span>تمرین گروهی (هر جلسه)</span><b>شامل عضویت</b></div>' +
      '<div class="row"><span>دورهٔ ۲روزهٔ تخصصی</span><b>شامل عضویت</b></div>' +
      '<div class="row"><span>مسابقات ماهانه</span><b>رایگان برای اعضا</b></div>' +
      '<div class="note">جزئیات دقیق شهریه از رسپشن آکادمی دریافت می‌شود.</div>';
  }
  if (tab === 'rules'){
    return '<div class="sub">قوانین آکادمی:</div>' +
      '<div class="row"><span>کد لباس</span><b>پیراهن سفید + لوگوی آکادمی</b></div>' +
      '<div class="row"><span>زمان تمرین</span><b>پنجشنبه‌ها — حضور همهٔ اعضا</b></div>' +
      '<div class="row"><span>رزرو زمین</span><b>از طریق رسپشن</b></div>' +
      '<div class="golfrule">⛳ قانون گلف: هر مسابقه ۱۸ حفره و پار ۷۲ است؛ برنده کسی است که کمترین ضربه را بزند (مثلاً ۶۵ نسبت به ۷۰ برنده است).</div>';
  }
  if (tab === 'contact'){
    var SIc = siteInfo().contact;
    return '<div class="sub"><b>تماس با آکادمی:</b><br>📞 تلفن: ' + esc(SIc.phone) + '<br>✉️ ایمیل: ' + esc(SIc.email) + '<br>📍 آدرس: ' + esc(SIc.address) + '<br>🌐 وب‌سایت: ' + esc(SIc.website) + '<br>📱 شبکه‌های اجتماعی: ' + esc(SIc.social) + '</div>';
  }
  return '';
}
function panelInfo(){
  panelNav = panelNav || 'intro';
  var navs = [
    ['intro','🏛️ ' + L('landing.intro','معرفی')], ['courses','🎓 ' + L('landing.courses','دوره‌ها')],
    ['tuition','💰 ' + L('landing.tuition','شهریه')], ['rules','📜 ' + L('landing.rules','قوانین')]
  ];
  var navHtml = '<div class="l3d-nav">' + navs.map(function(n){
    return '<button data-nav="' + n[0] + '" class="' + (panelNav === n[0] ? 'on' : '') + '">' + esc(n[1]) + '</button>';
  }).join('') + '</div>';
  return '<div class="hd"><span class="ic">ℹ️</span><h3>' + esc(L('landing.info','اطلاعات')) + ' آکادمی</h3><span class="tg">GolfAcademy.sa</span></div>' + navHtml + infoTab(panelNav);
}
function infoTab(tab){
  if (tab === 'intro'){
    var SIi = siteInfo().info;
    var introTxt = SIi.intro ? SIi.intro : 'آکادمی گلف ۱۴۰۵ — مرکز تخصصی گلف مسجدسلیمان. زمین رسمی ۱۸ حفره‌ای (پار ۷۲) با چمن استاندارد · باشگاه با امکانات کامل · مربیان رسمی فدراسیون گلف. تمرین گروهی اعضا هر پنجشنبه · مسابقهٔ ماهانه آخرین جمعهٔ هر ماه · دوره‌های ۲ روزه در خرداد و آذر.';
    var addr = SIi.address ? SIi.address : 'زمین گلف مسجدسلیمان، خیابان ورزش';
    var hours = SIi.hours ? SIi.hours : 'شنبه تا پنجشنبه، ۸ تا ۲۰';
    return '<div class="sub"><b>آکادمی گلف ۱۴۰۵ — مرکز تخصصی گلف مسجدسلیمان.</b><br><br>' +
      esc(introTxt).replace(/\n/g, '<br>') + '<br><br>' +
      '📍 آدرس: ' + esc(addr) + '<br>⏰ پذیرش: ' + esc(hours) + '</div>';
  }
  if (tab === 'courses') return receptionTab('courses');
  if (tab === 'tuition') return receptionTab('tuition');
  if (tab === 'rules') return receptionTab('rules');
  return '';
}
function panelCal(){
  var h = '<div class="hd"><span class="ic">📅</span><h3>' + esc(L('landing.calendar','تقویم آکادمی')) + ' — فصل ۱۴۰۵</h3><span class="tg">مسابقات · کلاس‌ها · اردوها · تمرین</span></div>';
  var monthNames = D.MONTHS_FA || ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  var mh = '<div class="l3d-months">';
  for (var i=0;i<12;i++) mh += '<button data-m="' + i + '" class="' + (monthSel === i ? 'on' : '') + '">' + monthNames[i] + '</button>';
  mh += '</div>';
  h += mh;
  var mm = String(monthSel + 1).padStart(2, '0');
  var rows = [];
  var tours = [];
  try { tours = (D.visibleTours ? D.visibleTours() : D.TOURNAMENTS) || []; } catch(e){}
  tours.forEach(function(t){ if (t[5] && t[5].slice(5,7) === mm) rows.push({ ic: '🏆', txt: esc(t[1]) + ' — مسابقه', dt: esc(t[5]) }); });
  var thu = [];
  try { thu = D.thursdaysSeason ? D.thursdaysSeason() : []; } catch(e){}
  thu.forEach(function(d){ if (d && d.slice(5,7) === mm) rows.push({ ic: '🏌️', txt: 'تمرین هفتگی پنجشنبه — همهٔ اعضا', dt: esc(d) }); });
  var progs = [];
  try { progs = D.loadPrograms ? D.loadPrograms() : []; } catch(e){}
  progs.forEach(function(p){
    var d = p.start || '';
    if (d && d.slice(5,7) === mm){
      var ic = p.type === 'اردو' ? '🏕️' : (p.type === 'تمرین' ? '🏌️' : '🎓');
      rows.push({ ic: ic, txt: esc(p.name), dt: esc(d) });
    }
  });
  if (!rows.length) h += '<div class="sub" style="color:rgba(248,250,252,.55)">رویدادی در این ماه ثبت نشده است.</div>';
  else {
    rows.sort(function(x,y){ return (x.dt < y.dt) ? -1 : 1; });
    rows.forEach(function(r){ h += '<div class="row"><span class="pnm"><span>' + r.ic + '</span>' + r.txt + '</span><span style="direction:ltr">' + r.dt + '</span></div>'; });
  }
  h += '<div class="note">مکان همهٔ رویدادها: زمین گلف مسجدسلیمان (۱۸ حفره، پار ۷۲).</div>';
  return h;
}
function panelRecords(){
  var A = liveState();
  var h = '<div class="hd"><span class="ic">🏆</span><h3>' + esc(L('landing.records','رکوردداران')) + ' فصل ۱۴۰۵</h3><span class="tg">تالار افتخارات</span></div>';
  var cups = [ ['🏆','جام قهرمانی فصل'], ['🥇','مدال طلا'], ['🥈','مدال نقره'], ['🥉','مدال برنز'] ];
  h += '<div class="l3d-tro">' + cups.map(function(c,i){
    return '<div class="cup" data-c="' + i + '"><div class="em">' + c[0] + '</div><div class="cn">' + c[1] + '</div></div>';
  }).join('') + '</div>';
  if (!A || !A.LB.length){ h += '<div class="sub">هنوز رکوردی ثبت نشده.</div>'; return h; }
  var top3 = A.LB.slice(0, 3);
  var pod = '<div class="podium">';
  top3.forEach(function(r){
    pod += '<div class="st"><div class="rk">' + (r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉') + '</div><div class="nm2">' + esc(r.name) + '</div><div class="pv2">' + D.fa(r.pts) + ' امتیاز</div></div>';
  });
  pod += '</div>';
  h += '<div class="sub">سکؤ برتر فصل:</div>' + pod;
  var best = A.LB.slice().sort(function(x,y){ return (x.best_total||999) - (y.best_total||999); })[0];
  var mostWin = A.LB.slice().sort(function(x,y){ return y.win - x.win; })[0];
  h += '<div class="row hl"><span>🏆 جام قهرمانی فصل</span><b>' + esc(A.LB[0].name) + ' — ' + D.fa(A.LB[0].pts) + ' امتیاز</b></div>';
  h += '<div class="row"><span>🥇 بیشترین برد</span><b>' + esc(mostWin.name) + ' — ' + D.fa(mostWin.win) + ' برد</b></div>';
  h += '<div class="row"><span>⛳ بهترین دور (کمترین ضربه)</span><b>' + esc(best.name) + ' — ' + (best.best_total ? D.fa(best.best_total) + ' ضربه' : '—') + '</b></div>';
  if (trophySel >= 0 && cups[trophySel]){
    h += '<div class="golfrule" style="text-align:center;font-size:15px">' + cups[trophySel][0] + ' ' + cups[trophySel][1] + ' — در پایان فصل به نفرات برتر اهدا می‌شود.</div>';
  }
  return h;
}
function panelContact(){
  var c = siteInfo().contact;
  var h = '<div class="hd"><span class="ic">📞</span><h3>' + esc(L('landing.contact','تماس با ما')) + '</h3><span class="tg">' + esc(c.website) + '</span></div>';
  h += '<div class="sub">' +
    '<div class="row"><span>📞 تلفن</span><b>' + esc(c.phone) + '</b></div>' +
    '<div class="row"><span>✉️ ایمیل</span><b style="direction:ltr">' + esc(c.email) + '</b></div>' +
    '<div class="row"><span>📍 آدرس</span><b>' + esc(c.address) + '</b></div>' +
    '<div class="row"><span>🌐 وب‌سایت</span><b style="direction:ltr">' + esc(c.website) + '</b></div>' +
    '<div class="row"><span>📱 شبکه‌های اجتماعی</span><b>' + esc(c.social) + '</b></div>' +
    '</div>';
  h += '<div class="qrwrap"><span class="sub" style="flex:1">برای ارتباط سریع، کد QR کنار را اسکن کنید:<br>باز شدن صفحهٔ تماس ' + esc(c.website) + '</span><span id="l3d-qr"></span></div>';
  h += '<div class="note">ساعت پاسخ‌گویی: ' + esc(c.hours) + '</div>';
  try {
    setTimeout(function(){
      var host = $('#l3d-qr'); if (!host || typeof qrcode === 'undefined') return;
      var qr = qrcode(0, 'M'); qr.addData(c.qr || 'https://golfacademy.sa'); qr.make();
      var img = document.createElement('img');
      img.src = qr.createDataURL(5, 8); img.style.cssText = 'width:110px;height:110px;border-radius:10px';
      host.appendChild(img);
    }, 60);
  } catch(e){}
  return h;
}

/* ─────────── تعامل: تک‌کلیک / دبل‌کلیک ─────────── */
var lastClickT = 0, lastClickXY = { x: 0, y: 0 };
root.addEventListener('click', function(e){
  if (!STATE.introDone) return;
  if (e.target.closest('.di') || e.target.closest('#l3d-reception') || e.target.closest('#l3d-panel') || e.target.closest('#l3d-enter')) return;
  var now = Date.now();
  var dbl = (now - lastClickT < 330) && Math.abs(e.clientX - lastClickXY.x) < 7 && Math.abs(e.clientY - lastClickXY.y) < 7;
  lastClickT = now; lastClickXY = { x: e.clientX, y: e.clientY };
  if (dbl){ closePanel(); }
});
$('#l3d-reception').addEventListener('click', function(ev){ ev.stopPropagation(); openPanel('reception'); });
$('#l3d-enter').addEventListener('click', function(){
  root.classList.add('fadeout');
  setTimeout(function(){
    root.style.display = 'none';
    var lg = document.getElementById('login');
    if (lg) lg.classList.add('on');
  }, 650);
});

/* ─────────── ورود از طریق لندینگ → app ─────────── */
try {
  setInterval(function(){
    var app = document.getElementById('app');
    if (app && app.classList.contains('on')){ if (root.parentNode) root.parentNode.removeChild(root); }
  }, 700);
} catch(e){}

/* ─────────── شروع ─────────── */
renderDock();
playIntro();

function refreshLabels(){
  var lb = $('#l3d-reception .lb'); if (lb) lb.innerHTML = '🛎️ ' + esc(L('landing.reception','رسپشن'));
  var en = $('#l3d-enter'); if (en) en.innerHTML = '👤 ' + esc(L('landing.enter','ورود اعضا'));
  renderDock();
  if (STATE.panel){
    var sec = STATE.panel, html = '';
    if (sec === 'reception') html = panelReception();
    else if (sec === 'info') html = panelInfo();
    else if (sec === 'cal') html = panelCal();
    else if (sec === 'rec') html = panelRecords();
    else if (sec === 'contact') html = panelContact();
    if (html){ pbody.innerHTML = html; wirePanel(); }
  }
}

/* ─────────── API تست ─────────── */
window.__L3D = {
  state: function(){ return { mode: STATE.mode, panel: STATE.panel, introDone: STATE.introDone }; },
  reception: function(){ openPanel('reception'); },
  goto: function(sec){ openPanel(sec); },
  month: function(i){ monthSel = i; var html = panelCal(); pbody.innerHTML = html; panel.classList.add('on'); wirePanel(); },
  trophy: function(i){ trophySel = i; var html = panelRecords(); pbody.innerHTML = html; panel.classList.add('on'); wirePanel(); },
  pickAt: function(x, y){
    var el = document.elementFromPoint(x, y);
    var hs = el ? el.closest('#l3d-reception') : null;
    return hs ? 'reception' : null;
  },
  skipIntro: function(){ finishIntro(); },
  refreshLabels: function(){ refreshLabels(); },
  close: function(){ closePanel(); }
};
})();
