/* دروازهٔ زمان (ga_epoch) — «دادهٔ قدیمی هرگز دادهٔ امروز را بازنویسی نمی‌کند».
 * اجرا: node source/e2e/epoch_gate_test.mjs
 *
 * سناریوها:
 *   ۱) دستگاهی که فقط کشِ قدیمی دارد (پس از برچسب با سرور هم‌تراز نشده) با pull
 *      دقیقاً نسخهٔ سرور را می‌گیرد؛ مسابقهٔ قدیمی برنمی‌گردد.
 *   ۲) صفِ ارسالِ کهنه (تغییرِ پیش از برچسب) هرگز فرستاده نمی‌شود.
 *   ۳) تغییری که کاربر پس از برچسب زده «تازه» است و مثل قبل ادغام می‌شود.
 *   ۴) دستگاهِ هم‌ترازشده پس از برچسب از ادغام اتحادی استفاده می‌کند (رفتار قبلی).
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../js/cloud.js', import.meta.url), 'utf8');
const KEY = 'test-publishable-0123456789-abcdefghijkl';
const CFG = JSON.stringify({ url: 'https://fake.supabase.co', key: KEY, on: true });
const json = body => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
const J = v => JSON.stringify(v);

const EPOCH = '2026-10-22T05:00:00.000Z';       // برچسب زمانِ مدیر
const OLD = '2026-10-20T10:00:00.000Z';          // آخرین هم‌ترازیِ دستگاه کهنه
const NEW = '2026-10-22T06:00:00.000Z';          // تغییرِ تازه پس از برچسب

const T_OLD = { name: 'مسابقهٔ قدیمی حذف‌شده', date: '2026-09-01', lvl: 3, course: 1, holes: 3 };
const T_NOW = { name: 'پات کلاب ۷', date: '2026-10-15', lvl: 3, course: 1, holes: 6 };
const T_NEW = { name: 'مسابقهٔ تازه', date: '2026-10-28', lvl: 4, course: 0, holes: 3 };
const tkey = t => [String(t.name || '').replace(/\s+/g, ' ').trim().toLowerCase(), t.date || '', t.lvl].join('|');
function merge(cur, inc) {
  const out = [], at = new Map();
  const put = t => { const k = tkey(t); if (at.has(k)) out[at.get(k)] = t; else { at.set(k, out.length); out.push(t); } };
  (Array.isArray(cur) ? cur : []).forEach(put);
  (Array.isArray(inc) ? inc : []).forEach(put);
  return out;
}

function server(rows) {
  const store = new Map(Object.entries(rows || {}).map(([k, v]) => [k, { k, v: JSON.parse(v), updated_at: OLD }]));
  store.set('ga_epoch', { k: 'ga_epoch', v: { at: EPOCH }, updated_at: EPOCH });
  return {
    rows: store, calls: [],
    async fetch(url, init) {
      const u = new URL(url);
      this.calls.push({ path: u.pathname, search: u.search, body: init && init.body ? JSON.parse(init.body) : null });
      if (u.pathname === '/rest/v1/ga_store') {
        const sel = u.searchParams.get('select') || '';
        if (sel === 'k,updated_at') return json([...this.rows.values()].map(r => ({ k: r.k, updated_at: r.updated_at })));
        const only = (u.searchParams.get('k') || '').match(/^in\.\((.*)\)$/);
        if (only) { const w = only[1].split(','); return json([...this.rows.values()].filter(r => w.includes(r.k))); }
        return json([...this.rows.values()]);
      }
      const body = init && init.body ? JSON.parse(init.body) : null;
      (body.rows || []).forEach(r => {
        const cur = this.rows.get(r.k);
        const v = (r.k === 'ga_tournaments' && cur) ? merge(cur.v, r.v) : r.v;
        this.rows.set(r.k, { k: r.k, v, updated_at: new Date().toISOString() });
      });
      return json({ ok: true, put: (body.rows || []).length, del: 0, stamps: {},
                    values: Object.fromEntries((body.rows || []).map(r => [r.k, this.rows.get(r.k).v])) });
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
  const element = () => ({ style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, appendChild() {}, addEventListener() {}, remove() {}, textContent: '', innerHTML: '', disabled: false });
  const elements = new Map();
  const document = {
    readyState: 'complete', visibilityState: 'visible', body: element(), createElement: element,
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    addEventListener() {},
  };
  const sandbox = {
    console, document, navigator: { onLine: true }, location: { reload() {} }, TextEncoder, AbortController, URL,
    setTimeout: () => 1, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
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

const tick = () => new Promise(r => setTimeout(r, 30));
const tours = d => JSON.parse(d.values.get('ga_tournaments') || '[]');
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('PASS ' + name); };

await test('دستگاهِ کهنه: مسابقهٔ قدیمی برنمی‌گردد و نسخهٔ سرور می‌نشیند', async () => {
  const api = server({ ga_tournaments: J([T_NOW]) });
  const d = await device(api, {
    ga_tournaments: J([T_OLD, T_NOW]),                       // کشِ قدیمی روی دستگاه
    ga_cloud_ts: J({ ga_tournaments: OLD }),                 // آخرین هم‌ترازی: پیش از برچسب
  });
  const names = tours(d).map(t => t.name);
  assert.deepEqual(names, [T_NOW.name], 'باید فقط نسخهٔ سرور بماند: ' + names.join(', '));
  assert.ok(!d.GA.dirty().includes('ga_tournaments'), 'نباید چیزی برای ارسال صف شود');
});

await test('صفِ کهنه (پیش از برچسب) ارسال نمی‌شود و در «پارک» می‌ماند', async () => {
  const api = server({ ga_tournaments: J([T_NOW]) });
  const d = await device(api, {
    ga_tournaments: J([T_OLD, T_NOW]),
    ga_cloud_ts: J({ ga_tournaments: OLD }),
    ga_cloud_dirty: J({ ga_tournaments: '2026-10-20T11:00:00.000Z' }),   // تغییرِ کهنه
  });
  api.calls.length = 0;
  await d.GA.push();
  assert.equal(api.writes().length, 0, 'هیچ نوشتنی نباید انجام شود');
  const parked = JSON.parse(d.values.get('ga_cloud_parked') || '{}');
  assert.ok(parked.ga_tournaments, 'مقدار کهنه باید در پارک بماند (بازیابی دستی)');
  assert.ok(!JSON.parse(d.values.get('ga_cloud_dirty') || '{}').ga_tournaments, 'صف باید خالی شود');
});

await test('تغییرِ تازهٔ کاربر (پس از برچسب) با ادغام می‌ماند', async () => {
  const api = server({ ga_tournaments: J([T_NOW]) });
  const d = await device(api, {
    ga_tournaments: J([T_NOW, T_NEW]),                       // کاربر همین حالا اضافه کرده
    ga_cloud_ts: J({ ga_tournaments: OLD }),
    ga_cloud_dirty: J({ ga_tournaments: NEW }),
  });
  assert.ok(tours(d).some(t => t.name === T_NEW.name), 'مسابقهٔ تازهٔ کاربر باید بماند');
  api.calls.length = 0;
  await d.GA.push();
  await tick();
  assert.equal(api.writes().length, 1, 'باید ارسال شود');
  const names = (api.rows.get('ga_tournaments').v || []).map(t => t.name);
  assert.ok(names.includes(T_NEW.name) && names.includes(T_NOW.name), 'سرور باید هر دو را داشته باشد: ' + names.join(', '));
});

await test('دستگاهِ هم‌ترازشده پس از برچسب، مثل قبل ادغام می‌کند', async () => {
  const api = server({ ga_tournaments: J([T_NOW, T_OLD]) });
  const d = await device(api, {
    ga_tournaments: J([T_NOW]),
    ga_cloud_ts: J({ ga_tournaments: NEW }),                 // بعد از برچسب با سرور هم‌تراز شده
  });
  assert.equal(tours(d).length, 2, 'ادغام اتحادی باید مسابقهٔ ابری را نگه دارد');
});

console.log('\n' + n + ' سناریو موفق');
