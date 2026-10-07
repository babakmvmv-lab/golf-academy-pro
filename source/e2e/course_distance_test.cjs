/* Manual per-hole Distance fields by gender: UI, alignment, compatibility and persistence contracts. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const mgmt = read('source/js/mgmt.js');
const css = read('source/css/style.css');
const dataSource = read('source/js/data.js');

function functionSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `could not locate ${startMarker}`);
  return source.slice(start, end);
}

const normalizeCode = functionSlice(mgmt, '  function normalizeHoleDistances(', '  function parEditorHtml(');
const editorCode = functionSlice(mgmt, '  function parEditorHtml(', '  function extraTours(){');
const htmlEscape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));
const ui = vm.createContext({
  D: { fa: String }, esc: htmlEscape, holeName: n => 'میدان ' + n,
  $$: (selector, root) => root.querySelectorAll(selector), APP: { toast() {} },
  Number, String, Array, Math,
});
vm.runInContext(normalizeCode + editorCode, ui, { filename: 'mgmt-course-distance-functions.js' });

const normalized = Array.from(ui.normalizeHoleDistances(['', '275', '-4', '123.5', 'abc', null, 0], 7));
assert.deepEqual(normalized, [null, 275, null, 123.5, null, null, 0]);
console.log('PASS — both gender-specific Distance arrays support blank, numeric, non-negative and decimal values');

const rendered = ui.parEditorHtml([4, 3], [1, 2], [145.5, null], [275, null]);
assert.equal((rendered.match(/class="input pe-distance pe-distance-f"/g) || []).length, 2);
assert.equal((rendered.match(/class="input pe-distance pe-distance-m"/g) || []).length, 2);
assert.match(rendered, /Distance<br><small>خانم‌ها<\/small>/);
assert.match(rendered, /Distance<br><small>آقایان<\/small>/);
assert.match(rendered, /aria-label="Distance خانم‌ها میدان 1"/);
assert.match(rendered, /aria-label="Distance آقایان میدان 1"/);
assert.match(rendered, /value="145\.5"/);
assert.match(rendered, /value="275"/);
assert.match(rendered, /value="" placeholder="—"/);
const legacyRendered = ui.parEditorHtml([4], [1], [188.5], []);
assert.match(legacyRendered, /pe-distance-f"[^>]*value="188\.5"/);
assert.match(legacyRendered, /pe-distance-m"[^>]*value="" placeholder="—"/);
const escaped = ui.parEditorHtml([4], [1], ['" autofocus onfocus="alert(1)'], ['<img src=x onerror=alert(1)>']);
assert.match(escaped, /&quot; autofocus onfocus=&quot;alert\(1\)/);
assert.match(escaped, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(escaped, /value="" autofocus/);
assert.doesNotMatch(escaped, /value="<img/);
console.log('PASS — female/male inputs render separately; legacy female values remain and male starts blank');

class FakeElement {
  constructor(attrs) { this.dataset = { i:String(attrs.i == null ? '' : attrs.i) }; this.value = attrs.value == null ? '' : attrs.value; this.listeners = {}; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatch(type) { (this.listeners[type] || []).forEach(callback => callback({ target:this })); }
  click() { this.dispatch('click'); }
}
function attr(tag, name) {
  const match = tag.match(new RegExp('\\b' + name + '="([^"]*)"'));
  return match ? match[1] : '';
}
const box = {
  elements: {},
  set innerHTML(value) {
    this._html = value; this.elements = {};
    const add = (selector, element) => (this.elements[selector] ||= []).push(element);
    const selectors = ['.pe-par', '.pe-idx', '.pe-distance-f', '.pe-distance-m', '.pe-del'];
    for (const selector of selectors) {
      const cls = selector.slice(1);
      const tags = value.match(new RegExp('<(?:input|button)\\b[^>]*class="[^"]*\\b' + cls + '\\b[^"]*"[^>]*>', 'g')) || [];
      tags.forEach(tag => add(selector, new FakeElement({ i:attr(tag,'data-i'), value:attr(tag,'value') })));
    }
    const addTag = (value.match(/<button\b[^>]*id="pe-add"[^>]*>/) || [])[0];
    this.addButton = addTag ? new FakeElement({}) : null;
  },
  get innerHTML() { return this._html; },
  querySelectorAll(selector) { return this.elements[selector] || []; },
  querySelector(selector) { return selector === '#pe-add' ? this.addButton : null; },
};
const pars = [4,5], indexes = [1,2], female = ['',''], male = ['',''];
ui.bindParEditor(box, pars, indexes, female, male);
assert.equal(box.querySelectorAll('.pe-distance-f').length, 2);
assert.equal(box.querySelectorAll('.pe-distance-m').length, 2);
box.querySelectorAll('.pe-distance-f')[0].value='101.5'; box.querySelectorAll('.pe-distance-f')[0].dispatch('input');
box.querySelectorAll('.pe-distance-m')[0].value='301.5'; box.querySelectorAll('.pe-distance-m')[0].dispatch('input');
box.querySelectorAll('.pe-distance-f')[1].value='202'; box.querySelectorAll('.pe-distance-f')[1].dispatch('input');
box.querySelectorAll('.pe-distance-m')[1].value='402'; box.querySelectorAll('.pe-distance-m')[1].dispatch('input');
assert.deepEqual(Array.from(female), [101.5,202]);
assert.deepEqual(Array.from(male), [301.5,402]);
box.querySelectorAll('.pe-del')[0].click();
assert.deepEqual(Array.from(pars), [5]);
assert.deepEqual(Array.from(female), [202]);
assert.deepEqual(Array.from(male), [402]);
box.querySelector('#pe-add').click();
assert.deepEqual(Array.from(pars), [5,4]);
assert.deepEqual(Array.from(female), [202,'']);
assert.deepEqual(Array.from(male), [402,'']);
box.querySelectorAll('.pe-distance-f')[1].value='88.25'; box.querySelectorAll('.pe-distance-f')[1].dispatch('input');
box.querySelectorAll('.pe-distance-m')[1].value='288.25'; box.querySelectorAll('.pe-distance-m')[1].dispatch('input');
assert.deepEqual(Array.from(ui.normalizeHoleDistances(female, pars.length)), [202,88.25]);
assert.deepEqual(Array.from(ui.normalizeHoleDistances(male, pars.length)), [402,288.25]);
console.log('PASS — both Distance arrays stay aligned on input, delete, add and rerender');

assert.match(mgmt, /const distancesF = Array\.isArray\(o\.distancesF\) \? o\.distancesF : \(Array\.isArray\(o\.distances\) \? o\.distances : \[\]\)/);
assert.match(mgmt, /const distancesF = Array\.isArray\(c\.distancesF\) \? c\.distancesF : \(Array\.isArray\(c\.distances\) \? c\.distances : \[\]\)/);
assert.match(mgmt, /const legacyDistanceF = Array\.isArray\(r\.distancesF\) \? r\.distancesF : r\.distances/);
assert.match(mgmt, /distances:distancesF, distancesF, distancesM/);
assert.match(mgmt, /distances:distanceFemaleSave, distancesF:distanceFemaleSave, distancesM:distanceMaleSave/);
assert.match(mgmt, /distanceFVals\.splice\(i, 1\); distanceMVals\.splice\(i, 1\)/);
assert.match(mgmt, /distanceFVals\.push\(''\); distanceMVals\.push\(''\)/);
assert.match(css, /grid-template-columns:minmax\(3\.6rem,1\.15fr\) 3\.4rem 3\.4rem 4\.2rem 4\.2rem 1\.9rem/);
assert.match(css, /@media \(min-width:900px\)[\s\S]*?\.hp-par-board\{grid-template-columns:1fr 1fr/);
assert.match(css, /@media \(max-width:380px\)[\s\S]*?\.hp-par-head,.hp-par\{grid-template-columns:minmax\(2\.1rem,1fr\) 2rem 2\.1rem 2\.65rem 2\.65rem 1\.25rem/);
assert.match(css, /\.hp-par \.pe-distance-f\{color:#f0a9cb/);
assert.match(css, /\.hp-par \.pe-distance-m\{color:#7dccff/);
console.log('PASS — create/edit persistence keeps legacy female alias and responsive six-column layout');

function createStorage(seed) {
  const rows = new Map(Object.entries(seed || {}).map(([k,v]) => [k,String(v)]));
  return {
    getItem(key) { return rows.has(String(key)) ? rows.get(String(key)) : null; },
    setItem(key,value) { rows.set(String(key),String(value)); },
    removeItem(key) { rows.delete(String(key)); },
    key(index) { return [...rows.keys()][index] ?? null; },
    get length() { return rows.size; },
  };
}
const storage = createStorage({ ga_courses:'[]', ga_course_override:'{}' });
const dataContext = {
  window:{}, localStorage:storage, Date, Intl, Math, Promise, Object, Array, Number, String,
  RegExp, Set, Map, JSON, parseInt, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
  setInterval:() => 0, clearInterval:() => {}, console:{warn(){},error(){}},
};
vm.createContext(dataContext);
vm.runInContext(dataSource, dataContext, { filename:'source/js/data.js' });
const D=dataContext.window.Data;
const legacyCourse=D.createCourse({name:'Legacy Distance QA',loc:'QA',holes:3,pars:[4,3,4],index:[1,2,3],distances:[120,null,178.5]});
assert.deepEqual(Array.from(D.distancesOf(legacyCourse.courseId)), [120,null,178.5], 'default gender reads legacy female values');
assert.deepEqual(Array.from(D.distancesOf(legacyCourse.courseId,'F')), [120,null,178.5]);
assert.deepEqual(Array.from(D.distancesOf(legacyCourse.courseId,'M')), [], 'legacy values never become male values');
const femaleUpdate=[125,91,null], maleUpdate=[320,270,180];
D.updateCourse(legacyCourse.courseId,{distances:femaleUpdate,distancesF:femaleUpdate,distancesM:maleUpdate});
let savedCourse=JSON.parse(storage.getItem('ga_courses')).find(c => c.courseId===legacyCourse.courseId);
assert.deepEqual(savedCourse.distances,femaleUpdate);
assert.deepEqual(savedCourse.distancesF,femaleUpdate);
assert.deepEqual(savedCourse.distancesM,maleUpdate);
assert.deepEqual(Array.from(D.distancesOf(legacyCourse.courseId,'F')),femaleUpdate);
assert.deepEqual(Array.from(D.distancesOf(legacyCourse.courseId,'M')),maleUpdate);
const copy=D.distancesOf(legacyCourse.courseId,'M'); copy[0]=0;
assert.deepEqual(Array.from(D.distancesOf(legacyCourse.courseId,'M')),maleUpdate,'reader returns a detached array');
storage.setItem('ga_course_override',JSON.stringify({1:{distances:[160,null,190]}}));
assert.deepEqual(Array.from(D.distancesOf(1,'F')),[160,null,190],'legacy base override is female');
assert.deepEqual(Array.from(D.distancesOf(1,'M')),[],'men remain blank until saved');
storage.setItem('ga_course_override',JSON.stringify({1:{distancesF:[161,null,191],distancesM:[301,251,201]}}));
assert.deepEqual(Array.from(D.distancesOf(1,'F')),[161,null,191]);
assert.deepEqual(Array.from(D.distancesOf(1,'M')),[301,251,201]);
assert.deepEqual(Array.from(D.distancesOf(1,'m')),[301,251,201],'gender is case-insensitive');
assert.deepEqual(Array.from(D.distancesOf('not-a-course','M')),[]);
console.log('PASS — custom courses and base overrides read/persist gender arrays with backward compatibility');
console.log('\n5 gender-specific Distance regression groups passed.');
