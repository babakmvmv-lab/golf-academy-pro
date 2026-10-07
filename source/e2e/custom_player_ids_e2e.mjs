/* Custom-player identity regressions: node source/e2e/custom_player_ids_e2e.mjs
 * data.js is evaluated with isolated in-memory storage; no browser or cloud access.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
const values = new Map();
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
};
const window = {};
vm.runInNewContext(source, { window, localStorage, console, URL, Intl }, { filename: 'data.js' });
const Data = window.Data;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function players(rows) {
  values.set('ga_custom_players', JSON.stringify(rows));
  return Array.from(Data.loadState().players.filter(p => p[0] >= 9000).map(p => p[0]));
}

test('First and second custom player use 9000 and 9001, never collide with base pid 1', () => {
  assert.deepEqual(Array.from(Data.customPlayerOffsets([{ id: 0 }, { id: 1 }])), [0, 1]);
  assert.deepEqual(players([{ id: 0, name: 'First' }, { id: 1, name: 'Second' }]), [9000, 9001]);
});

test('The historical negative ID is resolved by its stable array slot instead of pid 1', () => {
  assert.deepEqual(Array.from(Data.customPlayerOffsets([{ id: 0 }, { id: -8999 }])), [0, 1]);
  assert.deepEqual(players([{ id: 0, name: 'First' }, { id: -8999, name: 'Second' }]), [9000, 9001]);
});

test('Deleting a middle record does not renumber later custom players', () => {
  assert.deepEqual(players([{ id: 0, name: 'First' }, { id: 2, name: 'Third' }]), [9000, 9002]);
});

test('Duplicate/invalid offsets receive distinct deterministic IDs', () => {
  assert.deepEqual(Array.from(Data.customPlayerOffsets([{ id: 0 }, { id: 0 }, { id: 'bad' }])), [0, 1, 2]);
  assert.deepEqual(players([{ id: 0, name: 'First' }, { id: 0, name: 'Second' }, { id: 'bad', name: 'Third' }]), [9000, 9001, 9002]);
});

console.log(`PASS — ${passed} custom player ID regressions; isolated storage only.`);
