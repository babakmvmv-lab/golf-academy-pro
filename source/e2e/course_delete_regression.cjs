/* Regression test for wrong-course deletion and stable custom-course identity.
   Run from the repository root: node source/e2e/course_delete_regression.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = value => JSON.parse(JSON.stringify(value));

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

const legacyCourses = [
  { name:'پات کلاب اهواز', loc:'اهواز', holes:9, pars:[4,4,3,4,5,4,3,4,5], index:[1,2,3,4,5,6,7,8,9], geoId:'geo-ahvaz' },
  { name:'زمین تست ایثار', loc:'اهواز', holes:3, pars:[4,3,4], index:[1,2,3], geoId:'geo-test' },
];

// Reproduce the shipped bug: data-idx was the custom-array index, but the
// click handler used it to index the combined base+custom rows array.
const combinedRows = [{ name:'زمین پایه', base:true }, ...legacyCourses.map((c, idx) => ({ ...c, base:false, idx }))];
const clickedDeleteButtonIndex = 1; // the second custom course's old data-idx
const wronglyResolvedRow = combinedRows[clickedDeleteButtonIndex];
const oldResult = legacyCourses.slice();
oldResult.splice(wronglyResolvedRow.idx, 1);
assert.equal(wronglyResolvedRow.name, 'پات کلاب اهواز');
assert.deepEqual(oldResult.map(c => c.name), ['زمین تست ایثار']);
console.log('PASS — reproducer confirms legacy delete of the second custom course removed Putt Club Ahvaz');

const storage = createStorage({
  ga_seed_v2: '1405',
  ga_courses: JSON.stringify(legacyCourses),
  ga_course_geo: JSON.stringify({
    'geo-ahvaz': { name:'پات کلاب اهواز', holes:{ 1:{ par:4 } } },
    'geo-test': { name:'زمین تست ایثار', holes:{ 1:{ par:4 } } },
  }),
  ga_tournaments: JSON.stringify([
    { name:'پات کلاب ۱', lvl:1, course:1000, holes:9, date:'2026-04-01' },
  ]),
  ga_scorecards: JSON.stringify([]),
});
const context = {
  window: {}, localStorage: storage, Date, Intl, Math, Promise, Object, Array, Number, String,
  RegExp, Set, Map, JSON, parseInt, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
  setInterval: () => 0, clearInterval: () => {}, console: { warn(){}, error(){} },
};
vm.createContext(context);
vm.runInContext(read('source/js/data.js'), context, { filename:'source/js/data.js' });
vm.runInContext(read('source/js/coursegeo.js'), context, { filename:'source/js/coursegeo.js' });
const D = context.window.Data;
const Geo = context.window.CourseGeo;
assert.ok(D && Geo, 'Data and CourseGeo modules loaded');

const before = D.courseRecords();
assert.deepEqual(json(before.map(c => [c.name, c.courseId])), [
  ['پات کلاب اهواز', 1000], ['زمین تست ایثار', 1001],
]);
assert.deepEqual(json(D.loadState().courses.filter(c => c[0] >= 1000).map(c => c[0])), [1000,1001]);
assert.equal(Geo.keyOf(1000), 'geo-ahvaz');
assert.equal(Geo.keyOf(1001), 'geo-test');

// This is the operation now wired to the stable data-course-id attribute.
D.archiveCourse(1001);
let active = D.loadState().courses.filter(c => c[0] >= 1000);
assert.deepEqual(json(active.map(c => [c[0],c[1]])), [[1000,'پات کلاب اهواز']]);
assert.equal(D.courseById(1000).name, 'پات کلاب اهواز');
assert.equal(D.courseById(1001).name, 'زمین تست ایثار'); // retained for old references
assert.deepEqual(json(D.parsOf(1000)), [4,4,3,4,5,4,3,4,5]);
assert.deepEqual(json(D.parsOf(1001)), [4,3,4]);
assert.equal(Geo.keyOf(1000), 'geo-ahvaz');
assert.equal(Geo.keyOf(1001), 'geo-test'); // archived map remains addressable
const storedGeo = JSON.parse(storage.getItem('ga_course_geo'));
assert.ok(storedGeo['geo-ahvaz'] && storedGeo['geo-test'], 'archiving never purges course geometry');

const created = D.createCourse({ name:'زمین جدید', loc:'تهران', holes:3, pars:[4,3,4], index:[1,2,3] });
assert.equal(created.courseId, 1002, 'new IDs are append-only; archived IDs are not reused');
assert.equal(D.courseById(1000).name, 'پات کلاب اهواز', 'older course identity remains unchanged');
D.restoreCourse(1001);
active = D.loadState().courses.filter(c => c[0] >= 1000);
assert.deepEqual(json(active.map(c => c[0])), [1000,1001,1002]);
assert.equal(D.COURSE_NAME[1000], 'پات کلاب اهواز');
assert.equal(D.loadState().tournaments.at(-1)[3], 1000, 'existing tournament reference is unchanged');
console.log('PASS — archive/restore preserves Ahvaz, legacy course IDs, KML keys, pars and tournament references');

// Guard the UI wiring: deletion must use the course's own ID, never splice by
// the mixed display-row index or compact the stored array.
const mgmt = read('source/js/mgmt.js');
const app = read('source/js/app.js');
const mgmtCoursesBlock = mgmt.slice(mgmt.indexOf('function mgmtCourses(body)'), mgmt.indexOf('function showSatelliteModal('));
const academyCoursesBlock = app.slice(app.indexOf('function pageACourses()'), app.indexOf('function pageATours()'));
assert.match(mgmtCoursesBlock, /data-act="delc" data-course-id="\$\{r\.id\}"/);
assert.match(mgmtCoursesBlock, /const courseId = \+b\.dataset\.courseId;[\s\S]{0,700}D\.archiveCourse\(courseId\)/);
assert.doesNotMatch(mgmtCoursesBlock, /lst\.splice\(r\.idx\s*,\s*1\)/);
assert.match(academyCoursesBlock, /D\.archiveCourse\(courseId\)/);
assert.doesNotMatch(academyCoursesBlock, /lst\.splice\(\+b\.dataset\.del\s*,\s*1\)/);
console.log('PASS — Academy and Management delete buttons are wired by stable course ID; no physical splice remains');
console.log('\n3 regression groups passed.');
