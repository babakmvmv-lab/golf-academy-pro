/* سناریوی حادثهٔ «مسابقه گم شد» — با cloud.js واقعی در vm، بدون شبکهٔ واقعی.
 * اجرا: node source/e2e/tour_sync_e2e.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../js/cloud.js', import.meta.url), 'utf8');
const KEY = 'test-publishable-0123456789-abcdefghijkl';
const CFG = JSON.stringify({ url: 'https://fake.supabase.co', key: KEY, on: true });
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body });
const J = v => JSON.stringify(v);

const A = { name: 'پات کلاب 7', date: '2026-10-22', lvl: 3, course: 1, holes: 6 };
const MINI = { uid: 'Tmini1', name: 'مینی گلف پات کلاب ۱', date: '2026-10-14', lvl: 4, course: 0, holes: 3, holeIds: [1, 2, 3] };
const T6 = { name: 'پات کلاب ۶', date: '2026-10-08', lvl: 3, course: 1, holes: 3 };

function server(rows) {
  const store = new Map(Object.entries(rows || {}).map(([k, v]) => [k, { k, v: JSON.parse(v), updated_at: '2026-10-21T00:00:00.000Z' }]));
  return {
    rows: store,
    calls: [],
    async fetch(url, init) {
      const u = new URL(url);
      assert.equal(u.origin, 'https://fake.supabase.co');
      this.calls.push({ path: u.pathname, body: init.body ? JSON.parse(init.body) : null, keys: u.searchParams.get('select') });
      if (u.pathname === '/rest/v1/ga_store') {
        const sel = (u.searchParams.get('select') || '').split(',').map(s => s.trim());
        const out = [...this.rows.values()];
        if (sel.length === 2 && sel.includes('k') && sel.includes('updated_at') && !sel.includes('v')) {
          return json(out.map(r => ({ k: r.k, updated_at: r.updated_at })));
        }
        return json(out);
      }
      assert.equal(u.pathname, '/functions/v1/ga-sync');
      const body = init.body ? JSON.parse(init.body) : null;
      body.rows.forEach(r => this.rows.set(r.k, { k: r.k, v: r.v, updated_at: new Date().toISOString() }));
      return json({ ok: true, put: body.rows.length, del: 0, stamps: Object.fromEntries(body.rows.map(r => [r.k, new Date().toISOString()])) });
    },
    writes() { return this.calls.filter(c => c.path === '/functions/v1/ga-sync'); },
  };
}

async function device(api, seed = {}) {
  const values = new Map(Object.entries({ ga_cloud_cfg: CFG, ...seed }));
  const proto = {
    getItem(k) { return values.has(k) ? values.get(k) : null; },
    setItem(k, v) { values.set(k, String(v)); },
    removeItem(k) { values.delete(k); },
    key(n) { return [...values.keys()][n]; },
  };
  Object.defineProperty(proto, 'length', { get() { return values.size; } });
  const storage = Object.create(proto);
  const element = () => ({ style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, appendChild() {}, addEventListener() {}, textContent: '', innerHTML: '', disabled: false });
  const elements = new Map();
  const document = {
    readyState: 'complete', visibilityState: 'visible', body: element(), createElement: element,
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    addEventListener() {},
  };
  const sandbox = {
    console, document, navigator: { onLine: true }, location: { reload() {} }, TextEncoder, AbortController, URL,
    setTimeout: () => 1, clearTimeout() {}, setInterval() {}, clearInterval() {},
    fetch: (url, init) => api.fetch(url, init),
    window: { localStorage: storage, addEventListener() {}, dispatchEvent() {} },
    localStorage: storage,
    CustomEvent: class { constructor(t, d) { this.type = t; this.detail = d; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'cloud.js' });
  const GA = sandbox.window.GA_CLOUD;
  await GA.pull();
  return { GA, values, storage };
}

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('PASS ' + name); };
const tours = d => JSON.parse(d.values.get('ga_tournaments') || '[]');

await test('دستگاه قدیمی با pull، مسابقهٔ ابری را پاک نمی‌کند', async () => {
  const api = server({ ga_tournaments: J([A, MINI, T6]) });
  const d = await device(api, { ga_tournaments: J([A, T6]) });
  const t = tours(d);
  assert.deepEqual(t.map(x => x.name), [A.name, MINI.name, T6.name]);
});

await test('مسابقهٔ ارسال‌نشده با pull از بین نمی‌رود', async () => {
  const api = server({ ga_tournaments: J([A, T6]) });
  const d = await device(api, { ga_tournaments: J([A, T6, MINI]) });
  assert.equal(tours(d).length, 3);
});

await test('مسابقهٔ حذف‌شده با pull برنمی‌گردد', async () => {
  const api = server({ ga_tournaments: J([A, MINI]) });
  const d = await device(api, { ga_tournaments: J([A, MINI]), ga_tour_del: J([{ k: 'UTmini1', at: new Date().toISOString() }]) });
  assert.deepEqual(tours(d).map(x => x.name), [A.name]);
});

await test('آرایهٔ خالی محلی، فهرست ابری را پاک نمی‌کند', async () => {
  const api = server({ ga_tournaments: J([A, MINI]) });
  const d = await device(api, { ga_tournaments: J([]) });
  assert.equal(tours(d).length, 2);
});

await test('اجتماع محلی در صف ارسال قرار می‌گیرد', async () => {
  const api = server({ ga_tournaments: J([A]) });
  const d = await device(api, { ga_tournaments: J([A, T6]) });
  assert.equal(tours(d).length, 2);
  assert.equal(d.GA.status().pending, 1);
  assert.ok(d.GA.dirty().includes('ga_tournaments'));
});

await test('سیاههٔ حذف نتایج هم از ابر خوانده و اجتماع می‌شود', async () => {
  const api = server({ ga_results_del: J([{ k: '1010', at: new Date().toISOString() }]) });
  const d = await device(api, { ga_results_del: J([{ k: '1009', at: new Date().toISOString() }]) });
  const list = JSON.parse(d.values.get('ga_results_del'));
  assert.equal(list.length, 2);
});

console.log('\n' + n + ' سناریو موفق');
