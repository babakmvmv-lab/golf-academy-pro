/* دیدبانی ۵ ثانیه‌ای — «درجا» بودن همگام‌سازی، با cloud.js واقعی در vm.
 * اجرا: node source/e2e/watch_remote_test.mjs
 * چه چیزی را ثابت می‌کند؟
 *   ۱) وقتی ابر تغییر نکرده، هر تیک فقط «فراداده» می‌خواند (نه چند مگابایت داده).
 *   ۲) وقتی پنل دیگر چیزی را عوض می‌کند، همان تیک «دریافت جزئی» همان کلید را می‌آورد.
 *   ۳) تبِ پنهان هیچ درخواستی نمی‌فرستد.
 *   ۴) دو پنل که هم‌زمان می‌نویسند، هیچ مسابقه‌ای را گم نمی‌کنند (کلاینت + ادغام سرور).
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../js/cloud.js', import.meta.url), 'utf8');
const KEY = 'test-publishable-0123456789-abcdefghijkl';
const CFG = JSON.stringify({ url: 'https://fake.supabase.co', key: KEY, on: true });
const json = body => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
const J = v => JSON.stringify(v);
const tkey = t => {
  const n = String((t && (t.name || t.n)) || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return n ? [n, t.date || t.d || '', t.lvl == null ? '' : t.lvl].join('|') : '';
};
/* همان ادغام اتحادی که ga-sync v11 می‌کند (برای اینکه تست، جفتِ کلاینت+سرور را بسنجد) */
function merge(cur, inc) {
  const out = [], at = new Map();
  const put = t => {
    const k = tkey(t);
    if (!k) return;
    if (at.has(k)) out[at.get(k)] = t;
    else { at.set(k, out.length); out.push(t); }
  };
  (Array.isArray(cur) ? cur : []).forEach(put);
  (Array.isArray(inc) ? inc : []).forEach(put);
  return out;
}

const A = { name: 'پات کلاب 7', date: '2026-10-22', lvl: 3, course: 1, holes: 6 };
const MINI = { uid: 'Tmini1', name: 'مینی گلف پات کلاب ۱', date: '2026-10-14', lvl: 4, course: 0, holes: 3, holeIds: [1, 2, 3] };
const T8 = { name: 'پات کلاب ۸', date: '2026-10-29', lvl: 3, course: 1, holes: 3 };

function server(rows) {
  const store = new Map(Object.entries(rows || {}).map(([k, v]) => [k, { k, v: JSON.parse(v), updated_at: '2026-10-21T00:00:00.000Z' }]));
  return {
    rows: store,
    calls: [],
    touch(k, value, at) { store.set(k, { k, v: JSON.parse(value), updated_at: at || new Date().toISOString() }); },
    async fetch(url, init) {
      const u = new URL(url);
      this.calls.push({ path: u.pathname, search: u.search, body: init && init.body ? JSON.parse(init.body) : null });
      if (u.pathname === '/rest/v1/ga_store') {
        const sel = u.searchParams.get('select') || '';
        if (sel === 'k,updated_at') return json([...this.rows.values()].map(r => ({ k: r.k, updated_at: r.updated_at })));
        const only = (u.searchParams.get('k') || '').match(/^in\.\((.*)\)$/);
        if (only) {
          const want = only[1].split(',');
          return json([...this.rows.values()].filter(r => want.includes(r.k)));
        }
        return json([...this.rows.values()]);
      }
      assert.equal(u.pathname, '/functions/v1/ga-sync');
      const body = init && init.body ? JSON.parse(init.body) : null;
      (body.rows || []).forEach(r => {
        const cur = this.rows.get(r.k);
        const v = (r.k === 'ga_tournaments' && cur) ? merge(cur.v, r.v) : r.v;
        this.rows.set(r.k, { k: r.k, v, updated_at: new Date().toISOString() });
      });
      return json({ ok: true, put: (body.rows || []).length, del: 0, stamps: {},
                    values: Object.fromEntries((body.rows || []).map(r => [r.k, this.rows.get(r.k).v])) });
    },
    meta() { return this.calls.filter(c => c.path === '/rest/v1/ga_store' && /select=k,updated_at/.test(c.search)); },
    full() { return this.calls.filter(c => c.path === '/rest/v1/ga_store' && /select=k,v,updated_at/.test(c.search)); },
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
  const element = () => ({ style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, appendChild() {}, addEventListener() {}, remove() {}, textContent: '', innerHTML: '', disabled: false });
  const elements = new Map();
  const document = {
    readyState: 'complete', visibilityState: 'visible', body: element(), createElement: element,
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    addEventListener() {},
  };
  const timers = [];
  const sandbox = {
    console, document, navigator: { onLine: true }, location: { reload() {} }, TextEncoder, AbortController, URL,
    setTimeout: () => 1, clearTimeout() {}, setInterval(fn, ms) { timers.push({ fn, ms }); return timers.length; }, clearInterval() {},
    fetch: (url, init) => api.fetch(url, init),
    window: { localStorage: storage, addEventListener() {}, dispatchEvent() {} },
    localStorage: storage,
    CustomEvent: class { constructor(t, d) { this.type = t; this.detail = d; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'cloud.js' });
  const GA = sandbox.window.GA_CLOUD;
  await GA.pull();
  const watch = timers.find(x => x.ms === 5000);
  assert.ok(watch, 'دیدبانی ۵ ثانیه‌ای نصب نشده است');
  return { GA, values, storage, document, watch: watch.fn };
}

const tick = () => new Promise(r => setTimeout(r, 40));
const tours = d => JSON.parse(d.values.get('ga_tournaments') || '[]');
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('PASS ' + name); };

await test('تیکِ بی‌تغییر فقط فراداده می‌خواند (نه دریافت کامل)', async () => {
  const api = server({ ga_tournaments: J([A]) });
  const d = await device(api, { ga_tournaments: J([A]) });
  api.calls.length = 0;
  d.watch();
  await tick();
  assert.equal(api.calls.length, 1, 'باید دقیقاً یک درخواست بفرستد، شد: ' + api.calls.length);
  assert.equal(api.meta().length, 1);
  assert.equal(api.full().length, 0, 'نباید دریافت کامل انجام شود');
});

await test('تغییر پنل دیگر → دریافت جزئیِ همان کلید در همان تیک', async () => {
  const api = server({ ga_tournaments: J([A]) });
  const d = await device(api, { ga_tournaments: J([A]) });
  api.calls.length = 0;
  api.touch('ga_tournaments', J([A, MINI]));
  d.watch();
  await tick();
  assert.equal(api.meta().length, 1);
  const partial = api.calls.filter(c => /k=in\./.test(c.search));
  assert.equal(partial.length, 1, 'دریافت جزئی باید انجام شود');
  assert.match(decodeURIComponent(partial[0].search), /ga_tournaments/);
  assert.equal(tours(d).length, 2, 'مسابقهٔ پنل دیگر باید همین‌جا دیده شود');
  assert.ok(tours(d).some(t => t.name === MINI.name));
});

await test('تبِ پنهان هیچ درخواستی نمی‌فرستد', async () => {
  const api = server({ ga_tournaments: J([A]) });
  const d = await device(api, { ga_tournaments: J([A]) });
  api.calls.length = 0;
  d.document.visibilityState = 'hidden';
  d.watch();
  await tick();
  assert.equal(api.calls.length, 0);
  d.document.visibilityState = 'visible';
  d.watch();
  await tick();
  assert.equal(api.calls.length, 1);
});

await test('دو پنل هم‌زمان می‌نویسند: هیچ مسابقه‌ای گم نمی‌شود', async () => {
  const api = server({ ga_tournaments: J([A]) });
  const p1 = await device(api, { ga_tournaments: J([A]) });
  const p2 = await device(api, { ga_tournaments: J([A]) });
  /* پنل اعضا: مینی‌گلف را اضافه می‌کند */
  p1.values.set('ga_tournaments', J([A, MINI]));
  p1.values.set('ga_cloud_dirty', J({ ga_tournaments: '2026-10-22T00:00:10.000Z' }));
  await p1.GA.push();
  /* ادمین‌پنل: همان لحظه مسابقهٔ بعدی را اضافه می‌کند (نسخهٔ محلی‌اش مینی‌گلف را ندارد) */
  p2.values.set('ga_tournaments', J([A, T8]));
  p2.values.set('ga_cloud_dirty', J({ ga_tournaments: '2026-10-22T00:00:11.000Z' }));
  await p2.GA.push();
  const fresh = await device(api, {});
  const names = tours(fresh).map(t => t.name);
  assert.ok(names.includes(MINI.name), 'مسابقهٔ پنل اعضا باید بماند: ' + names.join(', '));
  assert.ok(names.includes(T8.name), 'مسابقهٔ ادمین‌پنل باید بماند: ' + names.join(', '));
  assert.ok(names.includes(A.name));
});

console.log('\n' + n + ' سناریو موفق');
