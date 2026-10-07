/* Gender-aware Distance and chart-colored Index readouts in the Earth Intelligence hole wizard. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const earthmap = fs.readFileSync(path.join(root, 'source/js/earthmap.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'source/js/app.js'), 'utf8');
const dataSource = fs.readFileSync(path.join(root, 'source/js/data.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'source/css/mgmt.css'), 'utf8');
const start = earthmap.indexOf('  function courseHoleDistance(');
const end = earthmap.indexOf('  function vsStrokeColor(', start);
assert.ok(start >= 0 && end > start, 'Distance and Index readout helpers exist');

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
const dataContext = {
  window:{}, localStorage:createStorage({ga_courses:'[]',ga_course_override:'{}'}), Date, Intl, Math, Promise,
  Object, Array, Number, String, RegExp, Set, Map, JSON, parseInt, isNaN, isFinite,
  encodeURIComponent, decodeURIComponent, setInterval:()=>0, clearInterval:()=>{}, console:{warn(){},error(){}},
};
vm.createContext(dataContext);
vm.runInContext(dataSource,dataContext,{filename:'source/js/data.js'});
const D = dataContext.window.Data;
D.PAR_MAP[41] = Array(18).fill(4);
D.INDEX_MAP[41] = [1,18,9];
D.PAR_MAP[42] = Array(9).fill(4);
D.INDEX_MAP[42] = [3,6,9];
const courseDistances = {
  41:{F:[98.5,121,null,''],M:[198.5,221,null,'']},
  42:{F:[180,200.25],M:[280,300.75]}
};
const lookups=[];
D.distancesOf = (id,gender) => { lookups.push([id,gender]); return (courseDistances[id]&&courseDistances[id][gender])||[]; };
const earthOpts = {holeCount:18};
const context = vm.createContext({
  window:{Data:D}, selectedCourse:41, selectedGender:'F', optsRef:earthOpts,
  courseKey:()=>context.selectedCourse, geoGender:()=>context.selectedGender,
  holeNums:()=>Array.from({length:earthOpts.holeCount},(_,i)=>i+1), fa:value=>String(value),
});
vm.runInContext(earthmap.slice(start,end),context,{filename:'earthmap-distance-index-helpers.js'});

assert.equal(context.courseHoleDistance(1),98.5,'female selector reads the female field distance');
assert.equal(context.courseHoleDistance(2),121,'female distance is indexed by the selected field');
assert.deepEqual(lookups.at(-1),[41,'F'],'female selector is passed to Data.distancesOf');
context.selectedGender='M';
assert.equal(context.courseHoleDistance(1),198.5,'male selector reads the separate male distance');
assert.equal(context.courseHoleDistance(2),221,'male distance is indexed by the selected field');
assert.deepEqual(lookups.at(-1),[41,'M'],'male selector is passed to Data.distancesOf');
context.selectedCourse=42; earthOpts.holeCount=9;
assert.equal(context.courseHoleDistance(1),280,'switching course reads the matching gender record');
assert.equal(context.courseHoleDistance(2),300.75,'decimal distance values remain unchanged');
assert.equal(context.courseHoleDistance(3),null,'missing distance stays empty');
assert.equal(context.courseHoleDistance(0),null,'zero is not a valid hole number');
assert.equal(context.courseHoleDistance(-1),null,'negative hole numbers are rejected');
assert.equal(context.courseHoleDistance(''),null,'empty hole selection is rejected');

const presentM=context.holeDistanceCard(2);
assert.match(presentM,/class="ew-distance-card"/);
assert.match(presentM,/data-ew-distance-gender="M"/);
assert.match(presentM,/<span>Distance آقایان<\/span><b>300\.75<\/b>/);
assert.match(presentM,/role="status"/);
assert.doesNotMatch(presentM.replace(/data-ew-distance-gender="[FM]"/,''),/\b(?:yd|yard|m|meter)\b|متر/i,'no unit is invented or converted');
context.selectedGender='F';
assert.match(context.holeDistanceCard(2),/data-ew-distance-gender="F"/);
assert.match(context.holeDistanceCard(2),/<span>Distance خانم‌ها<\/span><b>200\.25<\/b>/);
context.selectedCourse=41; earthOpts.holeCount=18;
assert.match(context.holeDistanceCard(3),/<span>Distance خانم‌ها<\/span><b>—<\/b>/,'blank female value uses an em dash');
context.selectedGender='M';
assert.match(context.holeDistanceCard(4),/<span>Distance آقایان<\/span><b>—<\/b>/,'blank male value stays blank');

assert.equal(context.courseHoleIndex(1),1,'Index is read from the selected course data');
assert.equal(context.courseHoleIndex(2),18,'Index is specific to the selected field');
assert.equal(context.courseHoleIndex(0),null,'invalid field number has no Index');
assert.equal(context.courseHoleIndex(19),null,'out-of-range field has no Index');
const red = context.holeIndexCard(1);
const green = context.holeIndexCard(2);
const middle = context.holeIndexCard(3);
assert.match(red,/class="ew-distance-card ew-index-card"/);
assert.match(red,/<span>Index<\/span><b>1<\/b>/);
assert.match(red,/data-ew-index-value="1"/);
assert.match(red,new RegExp('data-ew-index-color="'+D.scaleIndex(1,18)+'"'));
assert.match(red,new RegExp('--ew-index-color:'+D.scaleIndex(1,18)));
assert.match(green,new RegExp('--ew-index-color:'+D.scaleIndex(18,18)),'easy end of chart uses the chart’s green color');
assert.match(middle,new RegExp('--ew-index-color:'+D.scaleIndex(9,18)),'intermediate value uses the same chart scale');
assert.equal(context.courseHoleIndex(1),1,'Index does not change with selected tee gender');
context.selectedCourse=42; earthOpts.holeCount=9;
assert.equal(context.courseHoleIndex(1),3,'changing the course selects that course’s Index');
assert.match(context.holeIndexCard(1),new RegExp('--ew-index-color:'+D.scaleIndex(3,9)),'uses the selected course hole-count scale');
assert.match(context.holeIndexCard(20),/<span>Index<\/span><b>—<\/b>/,'missing Index is a dash');

const readyStart=earthmap.indexOf("} else if (wizStep === 'ready'){");
const readyEnd=earthmap.indexOf("} else if (wizStep === 'club'){",readyStart);
const readyMarkup=earthmap.slice(readyStart,readyEnd);
assert.ok(readyMarkup.indexOf('id="ew-lock"')>=0,'ready row includes the register-field button');
assert.ok(readyMarkup.indexOf('id="ew-lock"')<readyMarkup.indexOf('holeDistanceCard(holeSel)'),'Distance card is beside the button');
assert.ok(readyMarkup.indexOf('holeDistanceCard(holeSel)')<readyMarkup.indexOf('holeIndexCard(holeSel)'),'Index card is immediately beside Distance');
assert.match(earthmap,/hole\.onchange = function\(\)\{[\s\S]*?renderWiz\(\); renderHist\(\);[\s\S]*?\n\s*\};/,'field changes refresh both readouts');
assert.match(app,/courseTeeGender = b\.getAttribute\('data-gender'\) \|\| 'F'; go\('course'\)/,'gender selector rerenders Earth Intelligence');
assert.match(app,/gender: courseTeeGender \|\| 'F'/,'selected gender is passed into EarthMap');
assert.match(app,/holeCount: holes/,'EarthMap gets the same hole count used by the Index chart');
assert.match(app,/const cols = idxs\.map\(ix => \(D\.scaleIndex \? D\.scaleIndex\(ix, nH\) : '#E74C3C'\)\)/,'Index chart uses Data.scaleIndex');
assert.match(css,/\.ew-index-card\{border-color:var\(--ew-index-color/,'Index card frame follows the dynamic scale color');
assert.match(css,/\.ew-index-card b\{color:var\(--ew-index-color/,'Index value follows the dynamic scale color');
console.log('earth_distance_display_test: gender-aware Distance and chart-colored Index assertions passed');
