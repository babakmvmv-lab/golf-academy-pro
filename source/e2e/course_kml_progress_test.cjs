/* Unit/contract tests for the polished KML summary and per-image completion signals. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const mgmt = fs.readFileSync(path.join(root, 'source/js/mgmt.js'), 'utf8');
const shot = fs.readFileSync(path.join(root, 'source/js/earthshot.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'source/css/mgmt.css'), 'utf8');

const mgmtStart = mgmt.indexOf("  let mgmtTab = 'players';");
const mgmtEnd = mgmt.indexOf('  function pageMgmt(){', mgmtStart);
assert.ok(mgmtStart >= 0 && mgmtEnd > mgmtStart, 'KML report state and renderer are present');
const reportEl = {
  innerHTML: '',
  _className: '',
  classList: { names: new Set(), add(name){ this.names.add(name); } }
};
Object.defineProperty(reportEl, 'className', {
  get(){ return this._className; },
  set(value){ this._className = value; this.classList.names = new Set(String(value).split(/\s+/)); }
});
const context = vm.createContext({
  D: { fa: value => String(value).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]) },
  $: selector => selector === '#mc-kml-rep' ? reportEl : null,
  esc: value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]))
});
vm.runInContext(mgmt.slice(mgmtStart, mgmtEnd), context, { filename: 'mgmt-kml-report-helpers.js' });

vm.runInContext('renderCourseKmlReport()', context);
assert.ok(reportEl.classList.names.has('is-guide'), 'empty state renders the styled KML guide');
assert.match(reportEl.innerHTML, /<details class="mc-kml-format">/, 'existing KML naming guidance remains available');

vm.runInContext(`kmlReportState = {
  summary:{ holes:12, teesF:12, teesM:12, greens:12, fairways:12 }, notices:[],
  captures:{ sat:{status:'running',progress:43}, topo:{status:'pending',progress:0} }
}; renderCourseKmlReport()`, context);
assert.match(reportEl.innerHTML, /data-kml-stat="holes"/);
assert.equal((reportEl.innerHTML.match(/class="mc-kml-stat is-ok"/g) || []).length, 5, 'all five detected KML categories receive green checks');
assert.match(reportEl.innerHTML, /data-kml-capture="sat" data-status="running"/);
assert.match(reportEl.innerHTML, /aria-valuenow="43"/);
assert.match(reportEl.innerHTML, /۴۳٪/);
assert.match(reportEl.innerHTML, /data-kml-capture="topo" data-status="pending"/);

vm.runInContext(`kmlReportState.captures.sat = {status:'done',progress:100};
kmlReportState.captures.topo = {status:'done',progress:100}; renderCourseKmlReport()`, context);
assert.equal((reportEl.innerHTML.match(/data-status="done"/g) || []).length, 2, 'each captured image gets an independent completed state');
assert.equal((reportEl.innerHTML.match(/۱۰۰٪/g) || []).length, 4, 'both completed stages show 100 percent in the bar and label');
assert.match(reportEl.innerHTML, /mc-kml-stage-chip"><i[^>]*>✓<\/i>تکمیل شد/);

vm.runInContext(`kmlReportState = {summary:{holes:12,teesF:12,teesM:0,greens:12,fairways:12},notices:['تی‌باکس آقایان یافت نشد'],captures:{sat:{status:'unavailable'},topo:{status:'unavailable'}}}; renderCourseKmlReport()`, context);
assert.match(reportEl.innerHTML, /data-kml-stat="tees-m"/);
assert.match(reportEl.innerHTML, /mc-kml-stat is-missing/);
assert.match(reportEl.innerHTML, /تی‌باکس آقایان یافت نشد/);
assert.match(reportEl.innerHTML, /data-status="unavailable"/);

vm.runInContext(`kmlReportState = {error:true,message:'KML نامعتبر'}; renderCourseKmlReport()`, context);
assert.ok(reportEl.classList.names.has('is-error'), 'bad files receive a clear error presentation');
assert.match(reportEl.innerHTML, /KML نامعتبر/);
assert.match(css, /\.mc-kml-capture\.is-done[^{]*\{/);
assert.match(css, /\.mc-kml-progress/);
assert.equal((mgmt.match(/createKmlReportState\(sm, hasBounds, (?:hasCapture|canCapture)\)/g) || []).length, 2,
  'new-ground and edit-ground KML flows share the same checked summary');
assert.match(mgmt, /<div id="ec-kml-rep" class="mc-kml-report"><\/div>/,
  'edit-ground KML status uses the same professional report container');
assert.match(mgmt, /EarthShot\.captureFor\(geoId, g\.bounds, updateCapture\)/,
  'edit-ground image capture reports its own progress and completion');

const captureStart = shot.indexOf('  function captureFor(');
const captureEnd = shot.indexOf('  /* جابه‌جایی کلید', captureStart);
assert.ok(captureStart >= 0 && captureEnd > captureStart, 'EarthShot capture lifecycle is extractable');
let shouldFailSat = false;
const events = [];
const captureContext = vm.createContext({
  expand: () => ({ south:1, north:2, west:3, east:4 }),
  render: (mode, bounds, onProgress) => {
    if (mode === 'sat' && shouldFailSat) return Promise.reject(new Error('satellite unavailable'));
    if (onProgress) onProgress(mode, 37, 'mock-source');
    return Promise.resolve({ blob:{ id:mode }, meta:{ mode } });
  },
  idb: () => Promise.resolve(),
  keyOf: (key, mode) => String(key) + ':' + mode,
  urls: new Map(),
  URL: { createObjectURL: blob => 'blob:' + blob.id }
});
vm.runInContext(shot.slice(captureStart, captureEnd), captureContext, { filename: 'earthshot-captureFor.js' });

(async () => {
  const success = await captureContext.captureFor('course', {}, (mode, percent, meta) => events.push({ mode, percent, meta }));
  assert.ok(success.sat && success.topo, 'both capture results are returned on success');
  const satDone = events.findIndex(e => e.mode === 'sat' && e.meta && e.meta.complete && e.meta.ok);
  const topoStart = events.findIndex(e => e.mode === 'topo' && typeof e.meta === 'string');
  assert.ok(satDone >= 0 && topoStart > satDone, 'satellite completion is reported before topo capture starts');
  assert.equal(events.filter(e => e.meta && e.meta.complete && e.meta.ok).length, 2, 'both stages report their own successful completion');

  shouldFailSat = true;
  events.length = 0;
  const partial = await captureContext.captureFor('course-2', {}, (mode, percent, meta) => events.push({ mode, percent, meta }));
  assert.equal(partial.sat, null, 'failed satellite capture is returned as missing');
  assert.ok(partial.topo, 'topography still proceeds after satellite failure');
  assert.ok(events.some(e => e.mode === 'sat' && e.meta && e.meta.complete && !e.meta.ok), 'failed stage emits an explicit unsuccessful completion');
  assert.ok(events.some(e => e.mode === 'topo' && e.meta && e.meta.complete && e.meta.ok), 'later stage still emits a successful completion');
  console.log('course_kml_progress_test: 31 assertions passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
