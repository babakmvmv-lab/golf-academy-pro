/* Manual per-hole Distance field: UI, row alignment, normalization and persistence contracts. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const mgmt = read('source/js/mgmt.js');
const css = read('source/css/style.css');

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
  D: { fa: String },
  esc: htmlEscape,
  holeName: n => 'میدان ' + n,
  $$: (selector, root) => root.querySelectorAll(selector),
  APP: { toast() {} },
  Number, String, Array, Math,
});
vm.runInContext(normalizeCode + editorCode, ui, { filename: 'mgmt-course-distance-functions.js' });

const normalized = Array.from(ui.normalizeHoleDistances(['', '275', '-4', '123.5', 'abc', null, 0], 7));
assert.deepEqual(normalized, [null, 275, null, 123.5, null, null, 0]);
console.log('PASS — Distance values stay optional, numeric, non-negative and preserve decimals');

const rendered = ui.parEditorHtml([4, 3], [1, 2], [145.5, null]);
assert.equal((rendered.match(/class="input pe-distance"/g) || []).length, 2);
assert.match(rendered, /<span>Distance<\/span>/);
assert.match(rendered, /aria-label="Distance 1"/);
assert.match(rendered, /value="145\.5"/);
assert.match(rendered, /value="" placeholder="—"/);
const escaped = ui.parEditorHtml([4], [1], ['" autofocus onfocus="alert(1)']);
assert.match(escaped, /&quot; autofocus onfocus=&quot;alert\(1\)/);
assert.doesNotMatch(escaped, /value="" autofocus/);
console.log('PASS — One labelled Distance input renders for each hole; blank and existing values display safely');

class FakeElement {
  constructor(attrs) {
    this.dataset = { i: String(attrs.i == null ? '' : attrs.i) };
    this.value = attrs.value == null ? '' : attrs.value;
    this.listeners = {};
  }
  addEventListener(type, callback) {
    (this.listeners[type] ||= []).push(callback);
  }
  dispatch(type) {
    (this.listeners[type] || []).forEach(callback => callback({ target: this }));
  }
  click() { this.dispatch('click'); }
}
function attr(tag, name) {
  const match = tag.match(new RegExp('\\b' + name + '="([^"]*)"'));
  return match ? match[1] : '';
}
const box = {
  elements: {},
  set innerHTML(value) {
    this._html = value;
    this.elements = {};
    const add = (selector, element) => (this.elements[selector] ||= []).push(element);
    const selectors = ['.pe-par', '.pe-idx', '.pe-distance', '.pe-del'];
    for (const selector of selectors) {
      const cls = selector.slice(1);
      const tags = value.match(new RegExp('<(?:input|button)\\b[^>]*class="[^"]*\\b' + cls + '\\b[^"]*"[^>]*>', 'g')) || [];
      tags.forEach(tag => add(selector, new FakeElement({ i: attr(tag, 'data-i'), value: attr(tag, 'value') })));
    }
    const addTag = (value.match(/<button\b[^>]*id="pe-add"[^>]*>/) || [])[0];
    this.addButton = addTag ? new FakeElement({}) : null;
  },
  get innerHTML() { return this._html; },
  querySelectorAll(selector) { return this.elements[selector] || []; },
  querySelector(selector) { return selector === '#pe-add' ? this.addButton : null; },
};
const bindCode = functionSlice(mgmt, '  function bindParEditor(', '  function extraTours(){');
vm.runInContext(bindCode, ui, { filename: 'mgmt-course-distance-binding.js' });
const pars = [4, 5], indexes = [1, 2], distances = ['', ''];
ui.bindParEditor(box, pars, indexes, distances);
assert.equal(box.querySelectorAll('.pe-distance').length, 2);
box.querySelectorAll('.pe-distance')[0].value = '101.5';
box.querySelectorAll('.pe-distance')[0].dispatch('input');
box.querySelectorAll('.pe-distance')[1].value = '202';
box.querySelectorAll('.pe-distance')[1].dispatch('input');
assert.deepEqual(Array.from(distances), [101.5, 202]);
box.querySelectorAll('.pe-del')[0].click();
assert.deepEqual(Array.from(pars), [5]);
assert.deepEqual(Array.from(distances), [202]);
box.querySelector('#pe-add').click();
assert.deepEqual(Array.from(pars), [5, 4]);
assert.deepEqual(Array.from(distances), [202, '']);
box.querySelectorAll('.pe-distance')[1].value = '88.25';
box.querySelectorAll('.pe-distance')[1].dispatch('input');
assert.deepEqual(Array.from(ui.normalizeHoleDistances(distances, pars.length)), [202, 88.25]);
console.log('PASS — Distance follows its hole on delete/add and stays editable after rerender');

assert.match(mgmt, /distances:Array\.isArray\(c\.distances\)\?c\.distances:\[\]/);
assert.match(mgmt, /const distances = Array\.isArray\(o\.distances\) \? o\.distances : \[\]/);
assert.match(mgmt, /distances: normalizeHoleDistances\(distanceVals, pars\.length\)/);
assert.match(mgmt, /ov\[r\.id\] = Object\.assign\(\{\}, ov\[r\.id\], \{[^\n]*distances: distanceSave \}\)/);
assert.match(mgmt, /D\.updateCourse\(r\.id, \{[^\n]*distances: distanceSave \}\)/);
assert.match(mgmt, /distanceVals\.splice\(i, 1\)/);
assert.match(css, /grid-template-columns:minmax\(3\.6rem,1\.15fr\) 3\.6rem 3\.6rem 4rem 1\.9rem/);
assert.match(css, /\.hp-par \.pe-distance\{color:#7adbb4/);
console.log('PASS — New/custom and base-course save paths persist distances; layout includes all five columns');

function createStorage(seed) {
  const rows = new Map(Object.entries(seed || {}).map(([k, v]) => [k, String(v)]));
  return {
    getItem(key) { return rows.has(String(key)) ? rows.get(String(key)) : null; },
    setItem(key, value) { rows.set(String(key), String(value)); },
    removeItem(key) { rows.delete(String(key)); },
    key(index) { return [...rows.keys()][index] ?? null; },
    get length() { return rows.size; },
  };
}
const storage = createStorage({ ga_courses: '[]', ga_course_override: '{}' });
const dataContext = {
  window: {}, localStorage: storage, Date, Intl, Math, Promise, Object, Array, Number, String,
  RegExp, Set, Map, JSON, parseInt, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
  setInterval: () => 0, clearInterval: () => {}, console: { warn(){}, error(){} },
};
vm.createContext(dataContext);
vm.runInContext(read('source/js/data.js'), dataContext, { filename: 'source/js/data.js' });
const D = dataContext.window.Data;
const course = D.createCourse({ name:'Distance QA', loc:'QA', holes:3, pars:[4,3,4], index:[1,2,3], distances:[120, null, 178.5] });
assert.deepEqual(JSON.parse(storage.getItem('ga_courses'))[0].distances, [120, null, 178.5]);
assert.deepEqual(Array.from(D.distancesOf(course.courseId)), [120, null, 178.5]);
D.updateCourse(course.courseId, { distances:[125, 91, null] });
assert.deepEqual(JSON.parse(storage.getItem('ga_courses'))[0].distances, [125, 91, null]);
assert.deepEqual(Array.from(D.distancesOf(course.courseId)), [125, 91, null]);
storage.setItem('ga_course_override', JSON.stringify({ 1:{ distances:[160, null, 190] } }));
assert.deepEqual(Array.from(D.distancesOf(1)), [160, null, 190]);
console.log('PASS — Distance arrays persist for custom courses and base-course overrides and are exposed through Data.distancesOf');
console.log('\n5 regression groups passed.');
