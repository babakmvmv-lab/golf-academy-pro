/* ابر شبیه‌سازی‌شدهٔ Supabase برای تست‌های مرورگری پنل آکادمی (حساب‌های ابری 2026-10-07).
 * • هر درخواست به *.supabase.co با page.route پاسخ داده می‌شود؛ هر میزبان دیگری abort می‌شود
 *   (به‌جز https://qa.local که فایل ساخته‌شدهٔ پنل را سرو می‌کند) → هیچ خواندن/نوشتن زنده‌ای ممکن نیست.
 * • Auth (password/refresh/logout)، ga_accounts (RLS: فقط ردیف خود)، ga_store (مهمان: کلیدهای عمومی)،
 *   ga-sync (مدیر همه، عضو فقط کلیدهای عضو) و ga-accounts (فقط مدیر کنسول) را شبیه‌سازی می‌کند.
 * • داده‌ها ساختگی‌اند؛ هیچ اطلاعات واقعی یا رمز واقعی در این فایل نیست.
 */
const fs = require('fs');
const PUBLIC_KEYS = ['ga_academy', 'ga_siteinfo', 'ga_home_skin', 'ga_ui', 'ga_events', 'ga_tournaments', 'ga_tour_hidden',
  'ga_tour_override', 'ga_tour_rules', 'ga_programs', 'ga_courses', 'ga_course_override', 'ga_results',
  'ga_plans', 'ga_billing_cycles', 'ga_plan_features', 'ga_rank_skin'];
const MEMBER_KEYS = ['ga_msg_reads', 'ga_avatars', 'ga_cart', 'ga_fav', 'ga_coins', 'ga_coinreq'];

function b64(s) { return Buffer.from(s).toString('base64').replace(/=+$/, ''); }
function createMockCloud(opts) {
  opts = opts || {};
  const clock = { offsetMs: 0 };   // ساعتِ «سرور» mock نسبت به ساعت مرورگر (برای آزمون ساعت اشتباه دستگاه)
  const now = () => new Date(Date.now() + clock.offsetMs).toISOString();
  const site = { lastModified: null };   // سرآیند last-modified صفحه (آزمون بنر نسخهٔ جدید)
  const store = {};       // k → { v, updated_at }
  Object.entries(opts.store || {}).forEach(([k, v]) => { store[k] = { v, updated_at: '2026-10-01T00:00:00.000Z' }; });
  const accounts = {};    // username → { pass, uid, row, consoleAdmin }
  (opts.accounts || []).forEach((a, i) => {
    accounts[a.user] = { pass: a.pass, uid: 'uid-' + a.user, consoleAdmin: !!a.consoleAdmin,
      row: { legacy_id: a.id || i + 1, username: a.user, name: a.name || a.user, role: a.role, main: !!a.main, active: a.active !== false, pid: a.pid == null ? null : a.pid } };
  });
  const log = [];         // { kind, action, keys, uid, status }
  const tokenOf = (uid) => 'eyJhbGciOiJIUzI1NiJ9.' + b64(JSON.stringify({ sub: uid, n: Math.random() })) + '.sig';
  const tokens = {};      // token → uid
  const refresh = {};     // refresh → uid
  function session(uid, email) {
    const t = tokenOf(uid), r = 'rt-' + Math.random().toString(36).slice(2);
    tokens[t] = uid; refresh[r] = uid;
    return { access_token: t, refresh_token: r, expires_in: 3600, token_type: 'bearer', user: { id: uid, email } };
  }
  function who(headers) {
    const h = headers['authorization'] || '';
    const t = h.replace(/^Bearer\s+/i, '');
    const uid = tokens[t];
    if (!uid) return null;
    const a = Object.values(accounts).find(x => x.uid === uid);
    if (!a) return null;
    return { uid, user: a.row.username, admin: a.consoleAdmin || (a.row.active && a.row.role === 'admin'), member: a.row.active, console: a.consoleAdmin, acc: a };
  }

  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const headers = req.headers();
    const json = (o, status) => route.fulfill({ status: status || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Date', date: new Date(Date.now() + clock.offsetMs).toUTCString() }, body: JSON.stringify(o) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: '' });
    const p = url.pathname;
    let body = null; try { body = req.postDataJSON(); } catch (e) { body = null; }
    const w = who(headers);

    if (p === '/auth/v1/token') {
      const gt = url.searchParams.get('grant_type');
      if (gt === 'password') {
        const email = String(body && body.email || '');
        const user = email.endsWith('@members.puttclub.ir') ? email.split('@')[0] : email;
        const a = accounts[user];
        log.push({ kind: 'auth', action: 'password', user, ok: !!(a && a.pass === body.password) });
        if (!a || a.pass !== body.password) return json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
        if (!a.row.active) return json({ error: 'user_banned', error_description: 'User is banned' }, 400);
        return json(session(a.uid, email));
      }
      if (gt === 'refresh_token') {
        const uid = refresh[body && body.refresh_token];
        if (!uid) return json({ error: 'invalid_grant' }, 400);
        const a = Object.values(accounts).find(x => x.uid === uid);
        return json(session(uid, a ? a.row.username + '@members.puttclub.ir' : ''));
      }
    }
    if (p === '/auth/v1/user') {
      if (!w) return json({ code: 403, error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' }, 403);
      return json({ id: w.uid, email: w.user + '@members.puttclub.ir' });
    }
    if (p === '/auth/v1/logout') { log.push({ kind: 'auth', action: 'logout' }); return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' }); }

    if (p === '/rest/v1/adminpanel_access') {      // دسترسی کنسول ادمین‌پنل (فقط ردیف خود کاربر)
      if (!w || !w.console) return json([]);
      return json([{ role: 'owner', active: true }]);
    }
    if (p === '/rest/v1/ga_accounts') {
      if (!w) return json([]);
      const m = (url.searchParams.get('user_id') || '').replace(/^eq\./, '');
      return json(m === w.uid ? [w.acc.row] : []);
    }
    if (p === '/rest/v1/ga_store') {
      log.push({ kind: 'read', uid: w ? w.uid : null, auth: !!w });
      let keys = Object.keys(store);
      const kin = url.searchParams.get('k');
      if (kin && kin.startsWith('in.(')) { const want = kin.slice(4, -1).split(','); keys = keys.filter(k => want.includes(k)); }
      keys = keys.filter(k => (w && w.member) ? (k !== 'ga_email_cfg' || w.admin) : PUBLIC_KEYS.includes(k));
      return json(keys.map(k => ({ k, v: store[k].v, updated_at: store[k].updated_at })));
    }
    if (p.startsWith('/rest/v1/')) return json([]);

    if (p === '/functions/v1/ga-sync') {
      const action = body && body.action;
      const keys = (body && body.rows || []).map(r => r.k);
      const entry = { kind: 'sync', action, keys, uid: w ? w.uid : null, user: w ? w.user : null };
      log.push(entry);
      if (!w) { entry.status = 401; return json({ ok: false, err: 'auth', code: 'AUTH_REQUIRED' }, 401); }
      if (action === 'kv') {
        if (!w.admin) {
          const bad = keys.find(k => !MEMBER_KEYS.includes(k));
          if (bad) { entry.status = 403; return json({ ok: false, err: 'forbidden', code: 'FORBIDDEN_KEY', key: bad }, 403); }
        }
        const values = {};
        // نوشتنی که مقدارش با ابر یکی است «تکراری» است (همان مشکل ۵ نوشتن بیهوده در هر بارگذاری)
        entry.same = body.rows.filter(r => store[r.k] && JSON.stringify(store[r.k].v) === JSON.stringify(r.v)).map(r => r.k);
        const stamps = {}, t = now();     // مثل ga-sync v8+: زمانِ نسخه فقط از ساعت سرور
        body.rows.forEach(r => {
          if (r.v && r.v.__del) { delete store[r.k]; stamps[r.k] = null; }
          else if (store[r.k] && JSON.stringify(store[r.k].v) === JSON.stringify(r.v)) { stamps[r.k] = store[r.k].updated_at; values[r.k] = r.v; }
          else { store[r.k] = { v: r.v, updated_at: t }; values[r.k] = r.v; stamps[r.k] = t; }
        });
        entry.status = 200;
        return json(Object.assign({ ok: true, put: body.rows.filter(r => !(r.v && r.v.__del)).length, del: body.rows.filter(r => r.v && r.v.__del).length, stamps, now: t }, w.admin ? {} : { values }));
      }
      if (action === 'public' || action === 'shots') {
        if (!w.admin) { entry.status = 403; return json({ ok: false, err: 'forbidden' }, 403); }
        entry.status = 200; return json({ ok: true, put: (body.rows || []).length, shots: (body.shots || []).length });
      }
      return json({ ok: false, err: 'unknown action' }, 400);
    }
    if (p === '/functions/v1/ga-accounts') {
      log.push({ kind: 'accounts', action: body && body.action, uid: w ? w.uid : null });
      if (!w || !w.console) return json({ ok: false, err: 'forbidden', code: 'FORBIDDEN' }, 403);
      if (body.action === 'list') return json({ ok: true, accounts: Object.values(accounts).filter(a => !a.consoleAdmin).map(a => ({ id: a.row.legacy_id, user: a.row.username, name: a.row.name, role: a.row.role, main: a.row.main, active: a.row.active, pid: a.row.pid, cloud: true })) });
      return json({ ok: true });
    }
    if (p.startsWith('/functions/v1/')) return json({ ok: false, err: 'not mocked' }, 404);
    return json({}, 404);
  }

  /* context: کانتکست playwright؛ html: فایل ساخته‌شدهٔ پنل (برای https://qa.local/ و /index.html)
     یا { root: پوشه } برای سرو کردن یک سایت ایستا (مثلاً public/ ادمین‌پنل) روی https://qa.local/ */
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
  async function attach(context, src) {
    const pathMod = require('path');
    const root = src && typeof src === 'object' ? src.root : null;
    const html = root ? null : fs.readFileSync(src);
    await context.route('**/*', async (route) => {
      const u = route.request().url();
      const qa = u.match(/^https?:\/\/qa\.local(\/[^?#]*)/);
      if (qa) {
        if (!root) {
          if (/^\/(index\.html)?$/.test(qa[1])) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', headers: site.lastModified ? { 'last-modified': site.lastModified } : {}, body: route.request().method() === 'HEAD' ? '' : html });
          return route.fulfill({ status: 404, body: '' });
        }
        let rel = decodeURIComponent(qa[1]); if (rel.endsWith('/')) rel += 'index.html';
        const f = pathMod.join(root, pathMod.normalize(rel).replace(/^(\.\.[\/\\])+/, ''));
        if (f.startsWith(pathMod.resolve(root)) && fs.existsSync(f) && fs.statSync(f).isFile())
          return route.fulfill({ status: 200, contentType: MIME[pathMod.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
        return route.fulfill({ status: 404, body: '' });
      }
      if (/^https:\/\/[a-z0-9]+\.supabase\.co\//.test(u)) return handle(route);
      if (u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
      return route.abort();   // هیچ میزبان زنده‌ای (CDN، نقشه، EmailJS، پل پنل اعضا، …)
    });
  }
  /* باطل کردن همهٔ نشست‌های یک یوزر (مثل ga_revoke_sessions پس از تغییر رمز) */
  function revoke(user) {
    const a = accounts[user]; if (!a) return 0; let n = 0;
    Object.keys(tokens).forEach(t => { if (tokens[t] === a.uid) { delete tokens[t]; n++; } });
    Object.keys(refresh).forEach(r => { if (refresh[r] === a.uid) delete refresh[r]; });
    return n;
  }
  return { attach, store, accounts, log, revoke, clock, site, PUBLIC_KEYS, MEMBER_KEYS };
}
module.exports = { createMockCloud };
