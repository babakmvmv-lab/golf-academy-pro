/* Unit/contract test for Distance readout in the Earth Intelligence hole wizard. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const earthmap = fs.readFileSync(path.join(root, 'source/js/earthmap.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'source/css/mgmt.css'), 'utf8');
const start = earthmap.indexOf('  function courseHoleDistance(');
const end = earthmap.indexOf('  function vsStrokeColor(', start);
assert.ok(start >= 0 && end > start, 'distance lookup/card helpers exist');

const courseDistances = {
  41: [98.5, 121, null, ''],
  42: [180, 200.25]
};
const context = vm.createContext({
  window: { Data: { distancesOf: id => courseDistances[id] || [] } },
  selectedCourse: 41,
  courseKey: () => context.selectedCourse,
  fa: value => String(value)
});
vm.runInContext(earthmap.slice(start, end), context, { filename: 'earthmap-distance-helpers.js' });

assert.equal(context.courseHoleDistance(1), 98.5, 'reads the first field from the selected course');
assert.equal(context.courseHoleDistance(2), 121, 'reads the selected field by hole number');
context.selectedCourse = 42;
assert.equal(context.courseHoleDistance(1), 180, 'switching course reads that course, not the previous one');
assert.equal(context.courseHoleDistance(2), 200.25, 'decimal distances are preserved');
assert.equal(context.courseHoleDistance(3), null, 'missing distance stays empty');
assert.equal(context.courseHoleDistance(0), null, 'zero is not a valid hole number');
assert.equal(context.courseHoleDistance(-1), null, 'negative hole numbers are rejected');
assert.equal(context.courseHoleDistance(''), null, 'empty hole selection is rejected');

const present = context.holeDistanceCard(2);
assert.match(present, /class="ew-distance-card"/);
assert.match(present, /<span>Distance<\/span><b>200\.25<\/b>/);
assert.match(present, /role="status"/);
assert.doesNotMatch(present, /\b(?:yd|yard|m|meter|متر)\b/i, 'does not invent a unit');
const empty = context.holeDistanceCard(3);
assert.match(empty, /<span>Distance<\/span><b>—<\/b>/, 'empty values have an explicit dash');

const readyStart = earthmap.indexOf("} else if (wizStep === 'ready'){");
const readyEnd = earthmap.indexOf("} else if (wizStep === 'club'){", readyStart);
const readyMarkup = earthmap.slice(readyStart, readyEnd);
assert.ok(readyMarkup.indexOf('id="ew-lock"') >= 0, 'ready-state row includes the register-field button');
assert.ok(readyMarkup.indexOf('id="ew-lock"') < readyMarkup.indexOf('holeDistanceCard(holeSel)'),
  'Distance card is rendered beside/after the register-field button');
assert.match(earthmap, /hole\.onchange = function\(\)\{[\s\S]*?renderWiz\(\); renderHist\(\);[\s\S]*?\n\s*\};/,
  'changing the selected field refreshes the wizard readout');
assert.match(earthmap, /if \(holeSel === 'all' && wizStep === 'ready'\) wizStep = 'hole'/,
  'clearing the field selection returns to the field picker');
assert.match(earthmap, /else if \(holeSel !== 'all' && wizStep === 'hole'\)\{ wizStep = 'ready'; wizEdit = -1; \}/,
  'choosing a field from the selector opens the readout row');
assert.match(css, /\.ew-distance-card\s*\{/,'Distance card has dedicated styling');

console.log('earth_distance_display_test: 20 assertions passed');
