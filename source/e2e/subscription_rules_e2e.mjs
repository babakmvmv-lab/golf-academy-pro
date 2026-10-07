/* Subscription entitlement regressions: node source/e2e/subscription_rules_e2e.mjs
 * Runs only the subscription module in an isolated VM with in-memory storage.
 * Never reads or writes Supabase or a browser profile.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../js/sub.js', import.meta.url), 'utf8');
const values = new Map();
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
};
const window = { APP: { users: { rec() { return null; } }, currentUser() { return ''; } } };
const document = { getElementById() { return null; } };
vm.runInNewContext(source, { window, document, localStorage, console }, { filename: 'sub.js' });
const SUB = window.GA_SUB;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function sub(overrides = {}) {
  const now = Date.now();
  return Object.assign({
    id: 'sub-test', user: 'member', plan: 'professional', status: 'active',
    start_at: new Date(now - 60000).toISOString(),
    end_at: new Date(now + 86400000).toISOString(),
    start_date: new Date(now - 60000).toISOString().slice(0, 10),
    end_date: new Date(now + 86400000).toISOString().slice(0, 10),
  }, overrides);
}

values.set('ga_subscriptions', JSON.stringify([sub({ end_at: new Date(Date.now() - 1500).toISOString() })]));
test('An end timestamp just in the past is expired immediately (no ceil grace)', () => {
  assert.equal(SUB.liveStatus(SUB.of('member')), 'expired');
  assert.equal(SUB.isAllowed('member'), false);
  assert.equal(SUB.canPage('member', 'cmd'), false);
});

values.set('ga_subscriptions', JSON.stringify([sub({ end_at: '', end_date: '' })]));
test('Missing subscription end is invalid and denied', () => {
  assert.equal(SUB.liveStatus(SUB.of('member')), 'invalid');
  assert.equal(SUB.isAllowed('member'), false);
});

values.set('ga_subscriptions', JSON.stringify([sub({ end_at: 'not-a-date' })]));
test('Malformed subscription end is invalid and denied', () => {
  assert.equal(SUB.liveStatus(SUB.of('member')), 'invalid');
  assert.equal(SUB.isAllowed('member'), false);
});

values.set('ga_subscriptions', JSON.stringify([sub({ start_at: new Date(Date.now() + 86400000).toISOString() })]));
test('A subscription with a future start is scheduled and grants no pages', () => {
  assert.equal(SUB.liveStatus(SUB.of('member')), 'scheduled');
  assert.equal(SUB.isAllowed('member'), false);
  assert.equal(SUB.canPage('member', 'mgmt'), false);
});

values.set('ga_subscriptions', JSON.stringify([sub({ plan: 'trial', status: 'past_due' })]));
test('past_due takes precedence over trial plan and grants no access', () => {
  assert.equal(SUB.liveStatus(SUB.of('member')), 'past_due');
  assert.equal(SUB.isAllowed('member'), false);
});

values.set('ga_subscriptions', JSON.stringify([sub({ plan: 'unknown-plan' })]));
test('Unknown plan/status values fail closed', () => {
  assert.equal(SUB.liveStatus(SUB.of('member')), 'invalid');
  assert.equal(SUB.isAllowed('member'), false);
  values.set('ga_subscriptions', JSON.stringify([sub({ status: 'mystery' })]));
  assert.equal(SUB.liveStatus(SUB.of('member')), 'invalid');
  assert.equal(SUB.canPage('member', 'cmd'), false);
});

values.set('ga_subscriptions', JSON.stringify([sub()]));
test('A valid in-range active subscription still grants enabled pages', () => {
  assert.equal(SUB.liveStatus(SUB.of('member')), 'active');
  assert.equal(SUB.isAllowed('member'), true);
  assert.equal(SUB.canPage('member', 'cmd'), true);
});

values.delete('ga_subscriptions');
test('Startup compatibility hook never auto-creates a paid/pro subscription', () => {
  assert.equal(SUB.ensureSeed([{ id: 7, user: 'member', role: 'member', active: true }]), false);
  assert.equal(SUB.list().length, 0);
  assert.equal(values.has('ga_subscriptions'), false);
});

values.set('ga_subscriptions', JSON.stringify([sub({ id: 'legacy-link', user: 'legacy', user_id: null })]));
test('Migrating a legacy login links unowned history to its new account ID without changing the username', () => {
  assert.equal(SUB.relinkUser('legacy', 'legacy', 88), 1);
  assert.equal(SUB.listOf('legacy')[0].user_id, 88);
  assert.equal(SUB.hasForeignSubscription('legacy', 88), false);
});

values.set('ga_subscriptions', JSON.stringify([sub({ id: 'foreign-link', user: 'legacy', user_id: 77 })]));
test('Same-name migration never overwrites history already linked to a different account', () => {
  assert.equal(SUB.relinkUser('legacy', 'legacy', 88), 0);
  assert.equal(SUB.listOf('legacy')[0].user_id, 77);
  assert.equal(SUB.hasForeignSubscription('legacy', 88), true);
});

values.set('ga_subscriptions', JSON.stringify([
  sub({ id: 'owned-row', user: 'shared-name', user_id: 42 }),
  sub({ id: 'foreign-row', user: 'shared-name', user_id: 77 }),
]));
test('Revoking a known account leaves rows linked to a different account untouched', () => {
  assert.equal(SUB.revokeUser('shared-name', 'remove account', 42), 1);
  const rows = SUB.listOf('shared-name');
  assert.equal(rows.find(row => row.id === 'owned-row').status, 'deleted');
  assert.equal(rows.find(row => row.id === 'foreign-row').status, 'active');
});

values.set('ga_subscriptions', JSON.stringify([sub({ id: 'old', user: 'old-name', user_id: 42 })]));
test('Renaming a username moves its subscription history; revoking the account blocks it', () => {
  assert.equal(SUB.relinkUser('old-name', 'new-name', 42), 1);
  assert.equal(SUB.listOf('old-name').length, 0);
  assert.equal(SUB.listOf('new-name')[0].user_id, 42);
  assert.equal(SUB.hasForeignSubscription('new-name', 99), true);
  assert.equal(SUB.revokeUser('new-name', 'test account removal'), 1);
  assert.equal(SUB.liveStatus(SUB.listOf('new-name')[0]), 'deleted');
  assert.equal(SUB.of('new-name'), null);
  assert.equal(SUB.isAllowed('new-name'), false);
});

console.log(`PASS — ${passed} subscription rule regressions; isolated VM only.`);
