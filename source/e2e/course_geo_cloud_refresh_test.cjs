/* Contract checks: cloud geo merges survive device sync and the Smart Course map rerenders. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'source/js/app.js'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'source/js/cloud.js'), 'utf8');
const coursegeo = fs.readFileSync(path.join(root, 'source/js/coursegeo.js'), 'utf8');

const refreshStart = app.indexOf('const __cloudApplied = () => {');
const refreshEnd = app.indexOf('let __cloudT', refreshStart);
assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, 'cloud-applied handler is extractable');
const refresh = app.slice(refreshStart, refreshEnd);
assert.match(refresh, /S = D\.loadState\(\);\s*A = D\.compute\(S\);/,
  'analytics state reloads after cloud data arrives');
assert.match(refresh, /else if \(currentPage === 'course'\) go\('course'\)/,
  'an already-open Smart Course remounts its map after geo sync');
assert.match(cloud, /var COURSE_MERGE = \{ ga_courses: 1, ga_course_geo: 1 \}/,
  'course metadata and KML geometry both use structural merge');
assert.match(cloud, /mergeCourseValue\(r\.k, localRaw, remoteVal, false\)/,
  'pull merges remote geo with local-only course records');
assert.match(cloud, /mergeCourseValue\(k, raw, remoteValue, true\)/,
  'push preserves other devices’ geo IDs');
assert.match(coursegeo, /all\[key\]\.updatedAt = new Date\(\)\.toISOString\(\)/,
  'hole edits keep per-course geometry versions');
assert.match(coursegeo, /Object\.assign\(\{\}, data, \{ updatedAt:new Date\(\)\.toISOString\(\) \}\)/,
  'replacing KML geometry stamps that specific course record');
console.log('PASS — cloud geo merge and Smart Course refresh contract');
