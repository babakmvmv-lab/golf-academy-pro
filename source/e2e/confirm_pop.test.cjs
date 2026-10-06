/* تست confirmPop — استخراج و اجرای مستقیم */
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('/home/user/work/golf-academy-pro/source/js/app.js','utf8');
const startIdx = app.indexOf('let __confirmPopEl = null;');
let depth = 0, endIdx = -1, started = false;
for (let i = startIdx; i < app.length; i++) {
  const c = app[i];
  if (c === '{') { depth++; started = true; }
  else if (c === '}') { depth--; if (started && depth === 0) { endIdx = i + 1; break; } }
}
const snippet = app.slice(startIdx, endIdx);

// ساخت DOM واقعی با happy-dom (اگر در دسترس است) — در غیر این صورت، چک ایستا
let useHappyDom = false;
try { require('happy-dom'); useHappyDom = true; } catch(_) {}

if (useHappyDom) {
  const { Window } = require('happy-dom');
  const w = new Window();
  const doc = w.document;
  w.eval('var esc = function(s){return String(s==null?\'\':s)};\n' + snippet + '\nthis.confirmPop = confirmPop;');
  const confirmPop = w.confirmPop;
  if (typeof confirmPop !== 'function') { console.error('FAIL — confirmPop not exposed'); process.exit(1); }

  (async () => {
    let yesCalled = false;
    const p1 = confirmPop({ title:'حذف', itemName:'اهواز', body:'توضیح', onYes: () => { yesCalled = true; } });
    const yes = doc.getElementById('ga-cp-yes');
    if (!yes) { console.error('FAIL — yes button not in DOM'); process.exit(1); }
    const html = doc.getElementById('ga-confirm-pop').innerHTML;
    if (!html.includes('اهواز')) { console.error('FAIL — item name not in HTML'); process.exit(1); }
    if (!html.includes('e74c3c')) { console.error('FAIL — red color not in HTML'); process.exit(1); }
    if (!html.includes('font-size:18px')) { console.error('FAIL — 18px size not in HTML'); process.exit(1); }
    if (!html.includes('font-weight:900')) { console.error('FAIL — bold weight not in HTML'); process.exit(1); }
    yes.click();
    const r1 = await p1;
    if (r1 !== true) { console.error('FAIL — yes should resolve true, got', r1); process.exit(1); }
    if (!yesCalled) { console.error('FAIL — onYes not fired'); process.exit(1); }

    const p2 = confirmPop({ title:'t', itemName:'X' });
    doc.getElementById('ga-cp-no').click();
    const r2 = await p2;
    if (r2 !== false) { console.error('FAIL — no should resolve false'); process.exit(1); }

    const p3 = confirmPop({ title:'t', itemName:'Y' });
    doc.dispatchEvent(new w.KeyboardEvent('keydown', { key:'Escape' }));
    const r3 = await p3;
    if (r3 !== false) { console.error('FAIL — ESC should resolve false'); process.exit(1); }

    console.log('PASS — confirmPop: red bold 18px item name visible; yes->true+onYes; no/ESC->false');
  })();
} else {
  // حالت ایستا: فقط بررسی قالب
  if (!snippet.includes('#e74c3c')) { console.error('FAIL — red color missing'); process.exit(1); }
  if (!snippet.includes('font-size:18px')) { console.error('FAIL — 18px missing'); process.exit(1); }
  if (!snippet.includes('font-weight:900')) { console.error('FAIL — bold weight missing'); process.exit(1); }
  if (!snippet.includes('ga-cp-yes') || !snippet.includes('ga-cp-no')) { console.error('FAIL — buttons missing'); process.exit(1); }
  if (!snippet.includes("keydown")) { console.error('FAIL — keyboard handler missing'); process.exit(1); }
  console.log('PASS (static) — confirmPop template has red bold 18px item box, yes/no buttons, keydown handler');
}
