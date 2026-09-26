/* Test the actual ga-sync TypeScript handler with an in-memory DB.
 * Requires esbuild for TS transpilation. No Deno server or real network is used.
 * node source/e2e/ga_sync_size_e2e.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { transformSync } = require('esbuild');
const LIMIT = 2 * 1024 * 1024;
const source = fs.readFileSync(path.join(__dirname, '../../supabase/functions/ga-sync/index.ts'), 'utf8');
const code = transformSync(source.replace(/^import .*createClient.*;\s*$/m, ''), { loader: 'ts', target: 'es2022' }).code;
let passed = 0;

function setup() {
  const writes = [], rows = new Map();
  let handler;
  const db = {
    from(table) {
      return {
        async upsert(records) {
          const list = Array.isArray(records) ? records : [records];
          writes.push({ operation: 'upsert', table, count: list.length });
          if (table === 'ga_store') list.forEach(r => rows.set(r.k, r));
          return { error: null };
        },
        delete() {
          return {
            async in(field, keys) { writes.push({ operation: 'delete', table, count: keys.length }); keys.forEach(k => rows.delete(k)); return { error: null }; },
            async eq(field, value) { writes.push({ operation: 'delete', table, field, value }); return { error: null }; },
          };
        },
        async insert(records) { writes.push({ operation: 'insert', table, count: records.length }); return { error: null }; },
      };
    },
  };
  vm.runInNewContext(code, {
    Request, Response, Headers, TextEncoder, Date,
    Deno: {
      env: { get: key => key === 'SUPABASE_URL' ? 'https://fake.supabase.co' : 'fake-server-only-key' },
      serve(fn) { handler = fn; },
    },
    createClient(url, key) {
      assert.equal(url, 'https://fake.supabase.co');
      assert.equal(key, 'fake-server-only-key');
      return db;
    },
    fetch() { throw new Error('Real network is forbidden in ga-sync unit tests'); },
  });
  return {
    writes, rows,
    invoke(body, method = 'POST', headers = {}) {
      return handler(new Request('https://fake.supabase.co/functions/v1/ga-sync', {
        method, headers: { 'content-type': 'application/json', ...headers },
        body: ['GET', 'HEAD', 'OPTIONS'].includes(method) ? undefined : body,
      }));
    },
  };
}

function payload(size) {
  const body = { action: 'kv', rows: [{ k: 'ga_academy', v: { fixture: '' }, updated_at: '2026-09-26T00:00:00.000Z' }] };
  body.rows[0].v.fixture = 'x'.repeat(size - Buffer.byteLength(JSON.stringify(body)));
  const raw = JSON.stringify(body);
  assert.equal(Buffer.byteLength(raw), size);
  return raw;
}

async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }

(async () => {
  await test('823 KiB academy snapshot passes the real handler unchanged', async () => {
    const s = setup(), raw = payload(823 * 1024);
    const r = await s.invoke(raw);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, put: 1, del: 0 });
    assert.equal(JSON.stringify(s.rows.get('ga_academy').v), JSON.stringify(JSON.parse(raw).rows[0].v));
    assert.equal(s.writes.length, 1);
  });
  await test('Exactly 2 MiB is accepted including JSON envelope', async () => {
    const s = setup(), r = await s.invoke(payload(LIMIT));
    assert.equal(r.status, 200);
    assert.equal(s.writes.length, 1);
  });
  await test('2 MiB plus one byte is rejected before any DB operation', async () => {
    const s = setup(), r = await s.invoke(payload(LIMIT + 1));
    assert.equal(r.status, 413);
    const error = await r.json();
    assert.equal(error.code, 'PAYLOAD_TOO_LARGE');
    assert.equal(error.maxBytes, LIMIT);
    assert.equal(error.receivedBytes, LIMIT + 1);
    assert.equal(s.writes.length, 0);
  });
  await test('UTF-8 bytes, not character count, enforce the server limit', async () => {
    const s = setup(), raw = JSON.stringify({ action: 'kv', rows: [{ k: 'ga_academy', v: { fixture: 'گ'.repeat(1100000) } }] });
    assert.ok(raw.length < LIMIT && Buffer.byteLength(raw) > LIMIT);
    const r = await s.invoke(raw);
    assert.equal(r.status, 413);
    assert.equal(s.writes.length, 0);
  });
  await test('Declared oversized bodies fail before parsing', async () => {
    const s = setup(), r = await s.invoke('invalid', 'POST', { 'content-length': String(LIMIT + 1) });
    assert.equal(r.status, 413);
    assert.equal(s.writes.length, 0);
  });
  await test('Invalid JSON and non-object bodies do not reach the database', async () => {
    for (const raw of ['bad json', 'null', '[]', '42']) {
      const s = setup(), r = await s.invoke(raw);
      assert.equal(r.status, 400);
      assert.equal(s.writes.length, 0);
    }
  });
  await test('An empty-row size probe at 823 KiB is validated but never written', async () => {
    const s = setup(), raw = JSON.stringify({ action: 'kv', rows: [], probe: 'x'.repeat(823 * 1024) });
    const r = await s.invoke(raw);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).err, 'no valid rows');
    assert.equal(s.writes.length, 0);
  });
  await test('CORS and non-POST method behavior stay unchanged', async () => {
    const s = setup();
    const preflight = await s.invoke(undefined, 'OPTIONS');
    assert.equal(preflight.status, 200);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal((await s.invoke(undefined, 'GET')).status, 405);
    assert.equal(s.writes.length, 0);
  });
  await test('Existing shots and KV delete paths still work without schema changes', async () => {
    const s = setup();
    let r = await s.invoke(JSON.stringify({ action: 'shots', session: { id: 'fixture' }, shots: [{ sid: 'fixture', pid: 1, club: '7i', res: 'straight', yds: 100 }] }));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).shots, 1);
    r = await s.invoke(JSON.stringify({ action: 'kv', rows: [{ k: 'ga_fixture', v: { __del: 1 } }] }));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).del, 1);
  });
  console.log(`PASS — ${passed} real-handler size tests, entirely mocked; no server deployment and no live DB writes.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
