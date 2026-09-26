/* Cloud queue regressions: node source/e2e/cloud_queue_e2e.mjs
 * All data, storage, timers and HTTP are mocked. NEVER contacts Supabase.
 * Covers partial failures, explicit server ACKs, in-flight edits, bounded
 * mobile keepalive, practice merges and the read-success/write-error UI state.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../js/cloud.js', import.meta.url), 'utf8');
const KEY = 'test-publishable-0123456789-abcdefghijkl';
const CFG = JSON.stringify({ url: 'https://fake.supabase.co', key: KEY, on: true });
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body });
const pause = () => new Promise(resolve => setImmediate(resolve));
let passed = 0;

function server() {
  return {
    rows: new Map(), calls: [], overrides: new Map(), beforeWrite: null, readFailure: null,
    async fetch(url, init) {
      const u = new URL(url);
      assert.equal(u.origin, 'https://fake.supabase.co', 'No real network allowed in tests');
      const body = init.body ? JSON.parse(init.body) : null;
      this.calls.push({ method: init.method, path: u.pathname, body, bytes: init.body ? Buffer.byteLength(init.body) : 0, keepalive: !!init.keepalive });
      if (init.headers.apikey !== KEY) return json({ message: 'Invalid API key' }, 401);
      if (u.pathname === '/rest/v1/ga_store') {
        assert.equal(init.method, 'GET', 'A write must NEVER fall back to anonymous table REST');
        if (this.readFailure) return this.readFailure(u, init);
        const filter = u.searchParams.get('k');
        const keys = filter?.startsWith('in.(') ? filter.slice(4, -1).split(',') : null;
        return json([...this.rows.values()].filter(r => !keys || keys.includes(r.k)).slice(0, +(u.searchParams.get('limit') || 500)));
      }
      assert.equal(u.pathname, '/functions/v1/ga-sync');
      assert.equal(init.method, 'POST');
      assert.equal(body.action, 'kv');
      if (this.beforeWrite) await this.beforeWrite(body, init);
      if (JSON.stringify(body).length > 800000) return json({ ok: false, err: 'payload too large' }, 413);
      const override = this.overrides.get(body.rows[0].k);
      if (override) return override(body, init);
      if (body.rows.some(row => row.v === null)) return json({ ok: false, err: 'null value in column v violates not-null constraint' }, 502);
      body.rows.forEach(row => this.rows.set(row.k, row));
      return json({ ok: true, put: body.rows.length, del: 0 });
    },
    writes() { return this.calls.filter(c => c.path === '/functions/v1/ga-sync'); },
  };
}

async function device(api, seed = {}, { shortTimeout = false } = {}) {
  const values = new Map(Object.entries({ ga_cloud_cfg: CFG, ...seed }));
  const proto = {
    getItem(k) { return values.has(k) ? values.get(k) : null; },
    setItem(k, v) { values.set(k, String(v)); },
    removeItem(k) { values.delete(k); },
    key(n) { return [...values.keys()][n]; },
  };
  Object.defineProperty(proto, 'length', { get() { return values.size; } });
  const storage = Object.create(proto), handlers = {}, docHandlers = {}, timers = new Map();
  let tid = 0;
  const element = () => ({ style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, appendChild() {}, addEventListener() {}, textContent: '', innerHTML: '', disabled: false });
  const elements = new Map();
  const document = {
    readyState: 'complete', visibilityState: 'visible', body: element(), createElement: element,
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    addEventListener(k, fn) { docHandlers[k] = fn; },
  };
  const sandbox = {
    console, document, navigator: { onLine: true }, location: { reload() {} },
    TextEncoder, AbortController, URL,
    setTimeout(fn, ms) {
      if (shortTimeout && ms === 25000) return setTimeout(fn, 15);
      const id = ++tid; timers.set(id, { fn, ms }); return id;
    },
    clearTimeout(id) { if (typeof id === 'object') clearTimeout(id); else timers.delete(id); },
    setInterval() {}, clearInterval() {},
    fetch: (url, init) => api.fetch(url, init),
    window: { localStorage: storage, addEventListener(k, fn) { handlers[k] = fn; }, dispatchEvent() {} },
    localStorage: storage,
    CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'cloud.js' });
  const GA = sandbox.window.GA_CLOUD;
  await GA.pull();
  return { GA, storage, values, timers, handlers, docHandlers, sandbox, elements };
}

async function test(name, fn) {
  await fn(); passed++; console.log('PASS ' + name);
}
const set = (d, k, value) => d.storage.setItem(k, JSON.stringify(value));

await test('HTTP 401/403/500 without ok:false never clears a queued edit', async () => {
  for (const status of [401, 403, 500]) {
    const api = server(), d = await device(api);
    set(d, 'ga_probe', { value: 1 });
    api.overrides.set('ga_probe', () => json({ code: String(status), message: 'write rejected' }, status));
    assert.equal(await d.GA.push('manual'), false);
    assert.ok(d.GA.dirty().includes('ga_probe'));
    assert.equal(d.GA.status().phase, 'error');
    assert.match(d.GA.status().err, new RegExp(String(status)));
    assert.equal(api.writes().length, 1);
    assert.equal(JSON.parse(d.values.get('ga_probe')).value, 1);
  }
});

await test('Even HTTP 200 requires ok:true AND the exact acknowledged row count', async () => {
  for (const response of [{}, { message: 'error' }, { ok: false, err: 'failed' }, { ok: true }, { ok: true, put: 0, del: 0 }]) {
    const api = server(), d = await device(api);
    set(d, 'ga_probe', 1); api.overrides.set('ga_probe', () => json(response));
    assert.equal(await d.GA.push('manual'), false);
    assert.ok(d.GA.dirty().includes('ga_probe'));
  }
});

await test('Read test succeeds WITHOUT hiding the existing write error', async () => {
  const api = server(), d = await device(api, { ga_session: 'local-session' });
  set(d, 'ga_probe', 1);
  api.overrides.set('ga_probe', () => json({ ok: false, err: 'database write denied' }, 502));
  await d.GA.push('manual');
  const result = await d.GA.test();
  assert.equal(result.ok, true);
  assert.match(result.why, /تأیید ارسال تغییرات نیست/);
  assert.equal(d.GA.status().phase, 'error');
  assert.equal(d.GA.status().pending, 1);
  assert.match(d.elements.get('gc-status').textContent, /database write denied/);
  assert.match(d.elements.get('gc-read-status').textContent, /خواندن/);
});

await test('Two large but valid keys are sent independently below server payload limit', async () => {
  const api = server(), d = await device(api);
  set(d, 'ga_large_a', { text: 'x'.repeat(440000) });
  set(d, 'ga_large_b', { text: 'x'.repeat(440000) });
  assert.equal(await d.GA.push('manual'), true);
  assert.equal(d.GA.dirty().length, 0);
  assert.equal(api.writes().length, 2);
  assert.ok(api.writes().every(c => c.body.rows.length === 1 && c.bytes < 740000));
});

await test('An individually oversized key is preserved; smaller siblings still sync', async () => {
  const api = server(), d = await device(api);
  set(d, 'ga_oversized', { text: 'x'.repeat(810000) });
  set(d, 'ga_small', { value: 7 });
  assert.equal(await d.GA.push('manual'), false);
  assert.equal(d.GA.dirty().join(','), 'ga_oversized');
  assert.equal(api.rows.get('ga_small').v.value, 7);
  assert.equal(api.writes().length, 1);
  assert.equal(d.GA.status().errors[0].status, 413);
  assert.match(d.GA.status().msg, /ga_oversized/);
});

await test('A bad key does not keep successful keys in the queue', async () => {
  const api = server(), d = await device(api);
  for (const key of ['ga_good_a', 'ga_bad', 'ga_good_b']) set(d, key, { value: key });
  api.overrides.set('ga_bad', () => json({ ok: false, err: 'record rejected' }, 502));
  assert.equal(await d.GA.push('manual'), false);
  assert.equal(d.GA.dirty().join(','), 'ga_bad');
  assert.equal(d.GA.status().pushed, 2);
  assert.equal(api.writes().length, 3);
  api.overrides.clear();
  assert.equal(await d.GA.push('manual'), true);
  assert.equal(d.GA.dirty().length, 0);
  assert.equal(api.writes().length, 4, 'Already acknowledged keys are not resent');
});

await test('Edit while a write is in flight is not erased by the old ACK', async () => {
  const api = server(), d = await device(api);
  let release;
  api.beforeWrite = () => new Promise(resolve => { release = resolve; });
  set(d, 'ga_probe', { version: 1 });
  const oldStamp = JSON.parse(d.values.get('ga_cloud_dirty')).ga_probe;
  const flight = d.GA.push('manual'); await pause();
  set(d, 'ga_probe', { version: 2 });
  const newStamp = JSON.parse(d.values.get('ga_cloud_dirty')).ga_probe;
  assert.notEqual(oldStamp, newStamp);
  release(); await flight;
  assert.ok(d.GA.dirty().includes('ga_probe'));
  assert.equal(JSON.parse(d.values.get('ga_probe')).version, 2);
  assert.equal(api.rows.get('ga_probe').v.version, 1);
  api.beforeWrite = null;
  await d.GA.push('manual');
  assert.equal(api.rows.get('ga_probe').v.version, 2);
  assert.equal(d.GA.dirty().length, 0);
});

await test('Concurrent manual/automatic pushes share one request cycle', async () => {
  const api = server(), d = await device(api); let release;
  api.beforeWrite = () => new Promise(resolve => { release = resolve; });
  set(d, 'ga_probe', { value: 1 });
  const a = d.GA.push('manual'), b = d.GA.push('auto');
  assert.equal(a, b); await pause();
  assert.equal(api.writes().length, 1);
  release(); await Promise.all([a, b]);
  assert.equal(d.GA.dirty().length, 0);
});

await test('Same-value setItem is not a new edit; protected credentials never enter sync', async () => {
  const api = server(), d = await device(api);
  set(d, 'ga_probe', 1); await d.GA.push('manual');
  set(d, 'ga_probe', 1);
  set(d, 'ga_users', [{ user: 'fake', pass: 'never-upload' }]);
  set(d, 'ga_player_users', { 1: 'never-upload' });
  set(d, 'ga_session', 'never-upload');
  assert.equal(d.GA.dirty().length, 0);
  await d.GA.push('manual');
  assert.equal(api.writes().length, 1);
});

await test('Practice tomb maps merge as OBJECTS; deleted shots/sessions stay deleted', async () => {
  const api = server(), d = await device(api);
  const shotA = { sid: 's1', t: 1, pid: 1, club: '7i', res: 'straight' };
  const shotB = { sid: 's2', t: 2, pid: 1, club: '7i', res: 'straight' };
  api.rows.set('ga_sp_tomb', { k: 'ga_sp_tomb', v: { ses: { s1: 10 }, shot: {} }, updated_at: '2026-01-01T00:00:00.000Z' });
  api.rows.set('ga_sp_sessions', { k: 'ga_sp_sessions', v: { s1: { id: 's1' } }, updated_at: '2026-01-01T00:00:00.000Z' });
  api.rows.set('ga_sp_shots', { k: 'ga_sp_shots', v: [shotA], updated_at: '2026-01-01T00:00:00.000Z' });
  set(d, 'ga_sp_tomb', { ses: { s3: 20 }, shot: {} });
  set(d, 'ga_sp_sessions', { s1: { id: 's1' }, s2: { id: 's2' } });
  set(d, 'ga_sp_shots', [shotA, shotB]);
  assert.equal(await d.GA.push('manual'), true);
  assert.deepEqual(api.rows.get('ga_sp_tomb').v, { ses: { s1: 10, s3: 20 }, shot: {} });
  assert.deepEqual(Object.keys(api.rows.get('ga_sp_sessions').v), ['s2']);
  assert.deepEqual(api.rows.get('ga_sp_shots').v.map(s => s.sid), ['s2']);
});

await test('Failed pre-merge never overwrites practice data blindly', async () => {
  const api = server(), d = await device(api);
  set(d, 'ga_sp_sessions', { local: { id: 'local' } });
  api.readFailure = u => u.searchParams.has('k') ? json({ message: 'read unavailable' }, 500) : json([]);
  assert.equal(await d.GA.push('manual'), false);
  assert.equal(api.writes().length, 0);
  assert.ok(d.GA.dirty().includes('ga_sp_sessions'));
});

await test('Network interruption stops a request storm and retry uses the retained queue', async () => {
  const api = server(), d = await device(api);
  set(d, 'ga_a', 1); set(d, 'ga_b', 2);
  api.beforeWrite = () => { throw new TypeError('Failed to fetch'); };
  assert.equal(await d.GA.push('manual'), false);
  assert.equal(api.writes().length, 1);
  assert.equal(d.GA.dirty().length, 2);
  assert.ok([...d.timers.values()].some(t => t.ms >= 10000));
  api.beforeWrite = null;
  d.handlers.online();
  assert.ok([...d.timers.values()].some(t => t.ms === 100));
  await d.GA.push('manual');
  assert.equal(d.GA.dirty().length, 0);
});

await test('Hung request times out without clearing data', async () => {
  const api = server(), d = await device(api, {}, { shortTimeout: true });
  set(d, 'ga_probe', 1);
  api.beforeWrite = (_body, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
  });
  assert.equal(await d.GA.push('manual'), false);
  assert.ok(d.GA.dirty().includes('ga_probe'));
  assert.equal(d.GA.status().errors[0].code, 'TIMEOUT');
});

await test('Mobile unload sends at most one SMALL keepalive; big/practice keys stay queued', async () => {
  const api = server(), d = await device(api);
  set(d, 'ga_large', { value: 'x'.repeat(90000) });
  set(d, 'ga_sp_sessions', { s1: { id: 's1' } });
  set(d, 'ga_small', 3);
  d.handlers.beforeunload();
  await pause(); await pause();
  assert.equal(api.writes().length, 1);
  assert.equal(api.writes()[0].keepalive, true);
  assert.ok(api.writes()[0].bytes < 48 * 1024);
  assert.equal(api.writes()[0].body.rows[0].k, 'ga_small');
  assert.ok(d.GA.dirty().includes('ga_large'));
  assert.ok(d.GA.dirty().includes('ga_sp_sessions'));
  assert.ok(!d.GA.dirty().includes('ga_small'));
});

await test('Malformed saved timestamp does not break recording new local edits', async () => {
  const api = server(), d = await device(api);
  d.values.set('ga_cloud_dirty', JSON.stringify({ ga_probe: 'broken' }));
  set(d, 'ga_probe', 1);
  assert.ok(Number.isFinite(Date.parse(JSON.parse(d.values.get('ga_cloud_dirty')).ga_probe)));
  await d.GA.push('manual');
  assert.equal(d.GA.dirty().length, 0);
});


await test('Literal null round-trips without violating the NOT NULL JSONB column', async () => {
  const api = server(), d = await device(api);
  set(d, 'ga_nullable', null);
  assert.equal(await d.GA.push('manual'), true);
  assert.equal(d.GA.dirty().length, 0);
  assert.notEqual(api.rows.get('ga_nullable').v, null);
  const other = await device(api);
  assert.equal(other.values.get('ga_nullable'), 'null');
});

await test('A pull does not discard an unacknowledged local edit, even with a newer server timestamp', async () => {
  const api = server(), d = await device(api);
  set(d, 'ga_probe', { local: 'keep me' });
  api.overrides.set('ga_probe', () => json({ ok: false, err: 'temporary failure' }, 502));
  await d.GA.push('manual');
  api.rows.set('ga_probe', { k: 'ga_probe', v: { remote: 'other device' }, updated_at: '2199-01-01T00:00:00.000Z' });
  await d.GA.pull();
  assert.ok(d.GA.dirty().includes('ga_probe'));
  assert.equal(JSON.parse(d.values.get('ga_probe')).local, 'keep me');
  assert.equal(d.GA.status().phase, 'error');
});

await test('Old malformed queue metadata is repaired without editing the actual data', async () => {
  const api = server(), d = await device(api);
  d.values.set('ga_probe', '{"keep":true}');
  d.values.set('ga_cloud_dirty', JSON.stringify({ ga_probe: 'not-a-timestamp' }));
  assert.equal(await d.GA.push('manual'), true);
  assert.equal(d.values.get('ga_probe'), '{"keep":true}');
  assert.ok(Number.isFinite(Date.parse(api.rows.get('ga_probe').updated_at)));
});

await test('Normal upload uses the server character limit, not an incorrect UTF-8 byte limit for Persian', async () => {
  const api = server(), d = await device(api);
  set(d, 'ga_persian', { text: 'گ'.repeat(420000) });
  assert.equal(await d.GA.push('manual'), true);
  assert.equal(d.GA.dirty().length, 0);
  assert.ok(api.writes()[0].bytes > 790000);
  assert.ok(JSON.stringify(api.writes()[0].body).length < 790000);
});

console.log(`PASS — ${passed} cloud queue regression scenarios; zero live database requests.`);
