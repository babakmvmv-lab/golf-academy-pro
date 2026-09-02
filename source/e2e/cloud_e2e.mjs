/* ═══════════════════════════════════════════════════════════════════
   e2e: لایهٔ همگام‌سازی ابری (cloud.js) — بدون وابستگی، با node خالی اجرا می‌شود
   اجرا:  node source/e2e/cloud_e2e.mjs
   سرور Supabase و localStorage به‌صورت in-memory فیک‌شده‌اند؛ سناریو:
   نوشتن↔push، کشیدن↔pull روی دستگاه دوم، tombstone حذف، LWW، خطای کلید نامعتبر.
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLOUD_SRC = fs.readFileSync(path.join(ROOT, 'js', 'cloud.js'), 'utf8');

const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
function assert(cond, name) {
  console.log((cond ? '  ✔ ' : '  ✘ ') + name);
  if (!cond) failures++;
}

/* ── سرور PostgREST فیک ───────────────────────────────────────────── */
const SERVER_KEY = 'e2e-anon-key-0123456789-abcdefghij';
function makeServer({ apiKey = SERVER_KEY } = {}) {
  const rows = new Map(); // key -> {key, value, updated_at}
  return {
    rows,
    async handle(url, init = {}) {
      if (String(init.headers?.apikey || '') !== apiKey)
        return { status: 401, text: JSON.stringify({ message: 'Invalid API key', hint: 'Double check your API key.' }) };
      const u = new URL(url);
      if (!u.pathname.endsWith('/rest/v1/ga_store')) return { status: 404, text: '{}' };
      if (init.method === 'GET') {
        let list = [...rows.values()];
        const inF = u.searchParams.get('k');
        if (inF && inF.startsWith('in.(')) {
          const set = new Set(inF.slice(4, -1).split(',').map(decodeURIComponent));
          list = list.filter(r => set.has(r.k));
        }
        const limit = Number(u.searchParams.get('limit') || '1000');
        return { status: 200, text: JSON.stringify(list.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit)) };
      }
      if (init.method === 'POST') {
        const body = JSON.parse(init.body);
        const echo = body.map(r => { rows.set(r.k, r); return r; });
        return { status: 201, text: JSON.stringify(echo) };
      }
      if (init.method === 'DELETE') {
        const inF = u.searchParams.get('key') || '';
        inF.slice(4, -1).split(',').forEach(k => rows.delete(decodeURIComponent(k)));
        return { status: 204, text: '' };
      }
      return { status: 405, text: '{}' };
    }
  };
}

/* ── دستگاه مرورگری فیک (sandbox ایزوله برای هر تب) ───────────────── */
async function makeDevice(server, seed = {}) {
  // prototype مجزا برای هر دستگاه تا installGuard بین دستگاه‌ها تداخل نکند
  const store = new Map(Object.entries(seed));
  const proto = {};
  proto.getItem = function (k) { return store.has(k) ? store.get(k) : null; };
  proto.setItem = function (k, v) { store.set(k, String(v)); };
  proto.removeItem = function (k) { store.delete(k); };
  proto.key = function (i) { return [...store.keys()][i]; };
  Object.defineProperty(proto, 'length', { get() { return store.size; } });
  const storage = Object.create(proto);

  const el = () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, onclick: null, innerHTML: '', textContent: '', value: '', checked: false });
  const sandbox = {
    console,
    JSON, Math, Date, Object, Array, Promise, Set, String, Number, Boolean, Error, encodeURIComponent, decodeURIComponent, Blob: class { constructor() {} },
    setTimeout: (fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return t; },
    clearTimeout,
    setInterval: () => 0, clearInterval: () => {},
    fetch: async (url, init) => {
      const r = await server.handle(url, init);
      return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => r.text };
    },
    document: { readyState: 'complete', body: el(), createElement: el, getElementById: el, addEventListener() {} },
    navigator: { onLine: true },
    location: { reload() {} },
  };
  sandbox.window = { localStorage: storage, addEventListener() {} };
  sandbox.localStorage = storage; // در مرورگر، localStorage هم سراسری است هم روی window
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(CLOUD_SRC, sandbox, { filename: 'cloud.js' });
  await sleep(60); // pull اولیهٔ init
  return { GA: sandbox.window.GA_CLOUD, store, sandbox };
}

const waitIdle = async (GA, ms = 3000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (['idle', 'error', 'off'].includes(GA.status().phase)) return;
    await sleep(25);
  }
};

/* ── سناریو ────────────────────────────────────────────────────────── */
const KEY = 'e2e-anon-key-0123456789-abcdefghij';
const server = makeServer({ apiKey: KEY });
const cfgStr = JSON.stringify({ url: 'https://fake.supabase.co', key: KEY, on: true });

console.log('cloud_e2e:');

// دستگاه A: نوشتن و push
const A = await makeDevice(server, { ga_cloud_cfg: cfgStr });
A.store.set('ga_players', '[{"n":"Ali"}]');
A.sandbox.localStorage.setItem('ga_players', '[{"n":"Ali"},{"n":"Reza"}]'); // از نگهبان عبور می‌کند
assert(A.GA.dirty().includes('ga_players'), 'نگهبان setItem، کلید را در صف کثیف می‌گذارد');
await A.GA.push('manual');
assert(server.rows.has('ga_players'), 'push، ردیف ga_players را روی سرور upsert کرد');
assert(Array.isArray(server.rows.get('ga_players').v), 'مقدار JSON به‌صورت ساخت‌یافته (jsonb) ذخیره شد');
assert(!server.rows.has('ga_cloud_cfg'), 'کلیدهای داخلی هرگز sync نمی‌شوند');

// ga_session (در لیست SKIP) نباید sync شود
A.sandbox.localStorage.setItem('ga_session', 'tok');
await A.GA.push('manual');
assert(!server.rows.has('ga_session'), 'ga_session هرگز ارسال نمی‌شود');

// test() موفق
const t1 = await A.GA.test();
assert(t1.ok === true, 'تست اتصال با کلید معتبر: ok');

// دستگاه B: pull همان داده را می‌گیرد
const B = await makeDevice(server, { ga_cloud_cfg: cfgStr });
await B.GA.pull();
assert(B.store.get('ga_players') === '[{"n":"Ali"},{"n":"Reza"}]', 'pull در دستگاه دوم، مقدار را اعمال کرد');

// LWW: نوشتن محلیِ تازه‌تر از pullِ سرور نمی‌سوزد
A.sandbox.localStorage.setItem('ga_players', '[{"n":"New"}]');
await sleep(5); // تفکیک میلی‌ثانیه‌ای برچسب‌های زمانی LWW
await A.GA.push('manual');
await B.GA.pull();
assert(B.store.get('ga_players') === '[{"n":"New"}]', 'LWW: مقدار تازه‌تر روی دستگاه دوم اعمال شد');

// حذف: tombstone روی سرور می‌ماند و در pull دستگاه دیگر اعمال می‌شود
await sleep(5);
A.sandbox.localStorage.removeItem('ga_players');
assert(A.GA.dirty().includes('ga_players'), 'removeItem هم در صف کثیف ثبت می‌شود');
await A.GA.push('manual');
assert(server.rows.get('ga_players')?.v?.__del === 1, 'حذف به‌صورت tombstone روی سرور ثبت شد');
await B.GA.pull();
assert(!B.store.has('ga_players'), 'tombstone در pull دستگاه دوم، کلید محلی را حذف کرد');

// وضعیت‌ها
assert(['idle', 'error', 'off'].includes(A.GA.status().phase), 'chiپ وضعیت در فاز معتبر است');

// دستگاه C: کلید نامعتبر → خطای 401 و پیام راهنما
const server2 = makeServer({ apiKey: KEY });
const C = await makeDevice(server2, { ga_cloud_cfg: JSON.stringify({ url: 'https://fake.supabase.co', key: 'sb_publis...chars', on: true }) });
const t2 = await C.GA.test();
assert(t2.ok === false && /401/.test(t2.why), 'کلید نامعتبر → پیام «کلید نامعتبر است (401)»');

console.log(failures ? `FAIL (${failures})` : 'PASS — همهٔ ادعاها برقرارند');
process.exitCode = failures ? 1 : 0;
