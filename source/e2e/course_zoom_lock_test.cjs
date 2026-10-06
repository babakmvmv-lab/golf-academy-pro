/* Unit/contract checks for the per-course zoom-out floor and fractional zoom buttons. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const earthmap = fs.readFileSync(path.join(root, 'source/js/earthmap.js'), 'utf8');
const mgmt = fs.readFileSync(path.join(root, 'source/js/mgmt.js'), 'utf8');

const helperStart = earthmap.indexOf('  const MAP_MIN_ZOOM =');
const helperEnd = earthmap.indexOf('\n\n  let map =', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'zoom-lock helpers are extractable');
const helperContext = vm.createContext({ window:{} });
vm.runInContext(earthmap.slice(helperStart, helperEnd) +
  '\nwindow.__zoomLock = { normalizeZoomLock, zoomLockFromRecord, MAP_MIN_ZOOM, MAP_MAX_ZOOM, MAP_ZOOM_STEP };',
  helperContext, { filename:'earthmap-zoom-lock-helpers.js' });
const helper = helperContext.window.__zoomLock;

const close = (a,b) => Math.abs(a-b) < 1e-9;
assert.equal(helper.MAP_ZOOM_STEP, 1/3);
assert.equal(helper.normalizeZoomLock(15.3333333333), 15 + 1/3, 'zoom floor is snapped to a third-step');
assert.equal(helper.normalizeZoomLock(1), 14, 'zoom floor stays at the map-wide minimum');
assert.equal(helper.normalizeZoomLock(99), 20, 'zoom floor stays below the map maximum');
assert.equal(helper.normalizeZoomLock(0), 0, 'zero means unlocked');
assert.equal(helper.zoomLockFromRecord({ minZoomLock:17, maxLock:15 }), 17, 'new field wins over legacy field');
assert.equal(helper.zoomLockFromRecord({ maxLock:16 }), 16, 'old maxLock is preserved as the intended zoom-out floor');
assert.equal(helper.zoomLockFromRecord({}), 0, 'missing lock stays unlocked');
console.log('PASS — lock values clamp, snap to thirds, and migrate legacy maxLock safely');

assert.match(earthmap, /minZoom,\s*maxZoom:MAP_MAX_ZOOM,\s*zoomSnap:MAP_ZOOM_STEP,\s*zoomDelta:MAP_ZOOM_STEP,[\s\S]{0,180}bounceAtZoomLimits:false/,
  'Leaflet uses a per-course zoom-out floor, fractional steps, and no touch-pinch overshoot at bounds');
assert.match(earthmap, /map\.setMinZoom\(\(!on && appliedMinZoomLock\) \? appliedMinZoomLock : MAP_MIN_ZOOM\)/,
  'the restriction is a zoom-out floor and the editor can temporarily inspect freely');
assert.match(earthmap, /state: function\(\)\{ return map \? \{ zoom: map\.getZoom\(\), minZoom: map\.getMinZoom\(\), maxZoom: map\.getMaxZoom\(\), lock: appliedMinZoomLock \|\| 0 \} : null; \}/,
  'map state exposes the effective zoom floor');
console.log('PASS — display maps enforce minimum zoom; editor mode remains adjustable');

const zoomHelpers = mgmt.slice(mgmt.indexOf('const COURSE_ZOOM_LOCK_MIN'), mgmt.indexOf('function mgmtCourses('));
const mgmtCourseBlock = mgmt.slice(mgmt.indexOf('function mgmtCourses(body)'), mgmt.indexOf('function showSatelliteModal('));
const editCourseBlock = mgmt.slice(mgmt.indexOf('function editCourseModal('), mgmt.indexOf('function courseSelectOptions('));
assert.match(zoomHelpers, /const raw = rec\.minZoomLock != null \? rec\.minZoomLock : rec\.maxLock/,
  'existing per-ground locks remain readable after reversing their behavior');
assert.match(zoomHelpers, /rec\.minZoomLock = n;\s*delete rec\.maxLock;/,
  'new settings are saved under the explicit minZoomLock field');
assert.match(editCourseBlock, /base \+ delta \* COURSE_ZOOM_LOCK_STEP/,
  'lock adjustment uses one-third zoom increments');
assert.match(editCourseBlock, /EarthMap\.setEdit\(true\)/,
  'only the viewer map is restricted; management editing stays free');
assert.match(editCourseBlock, /دکمه‌های نقشه هر بار یک‌سوم زوم کامل/,
  'the UI explains fine-grained map zoom steps');
assert.match(editCourseBlock, /data-earth-bg/, 'course editor retains its map-layer controls');
assert.match(mgmtCourseBlock, /courseZoomLockOf\(all\[k\]\)/, 'each course row reads its own lock state');
console.log('PASS — management stores the floor separately per course and adjusts it in thirds');

let z = 16;
for (let i=0;i<3;i++) z += helper.MAP_ZOOM_STEP;
assert.ok(close(z,17), 'three zoom-in taps equal one previous full zoom step');
for (let i=0;i<3;i++) z -= helper.MAP_ZOOM_STEP;
assert.ok(close(z,16), 'three zoom-out taps reverse one previous full zoom step');
console.log('PASS — three +/− taps compose to one full zoom step');
console.log('\n4 zoom-lock regression groups passed.');
