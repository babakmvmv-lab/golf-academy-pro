// ga-accounts — مدیریت حساب‌های ابری پنل آکادمی (Supabase Edge Function) — 2026-10-07
// فقط مدیر adminpanel (جدول adminpanel_access، نقش owner/admin) اجازه دارد.
// رمزها فقط در Supabase Auth ذخیره می‌شوند (هش)، هرگز در ga_store یا پاسخ این تابع.
// ایمیل ورود هر یوزر مصنوعی است: <username>@members.puttclub.ir (ایمیلی ارسال نمی‌شود).
// اکشن‌ها:
//   list                                   → فهرست حساب‌ها (بدون رمز)
//   create   {user,name,role,pid?,pass,id?,main?}
//   update   {id, user?, name?, role?, active?, pid?}
//   password {id, pass}
//   delete   {id}
//   bulk     {accounts:[{user,name,role,pid?,pass,id?,main?}]}  → ساخت گروهی (نادیده‌گرفتن یوزرهای موجود)
import { createClient } from "jsr:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") || "";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const DOMAIN = "members.puttclub.ir";
const MIN_PASS = 8;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const okUser = (u: unknown) => typeof u === "string" && /^[a-z0-9][a-z0-9._-]{0,39}$/.test(u);
const emailOf = (u: string) => `${u}@${DOMAIN}`;
/* همهٔ نشست‌های یک حساب روی همهٔ مرورگرها باطل شود (تغییر رمز/یوزرنیم، غیرفعال‌سازی) */
async function revokeSessions(uid: string): Promise<void> {
  try { await db.rpc("ga_revoke_sessions", { p_uid: uid }); } catch (_) { /* نبودِ تابع نباید عملیات اصلی را خراب کند */ }
}
const COLS = "user_id,legacy_id,username,name,role,main,active,pid,created_at,updated_at";
const view = (r: any) => ({
  id: r.legacy_id, user: r.username, name: r.name, role: r.role, main: !!r.main,
  active: !!r.active, pid: r.pid == null ? null : r.pid, cloud: true, created_at: r.created_at,
});

async function consoleAdmin(req: Request): Promise<{ uid: string; email: string } | null> {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!t || t.split(".").length !== 3) return null;
  let { data, error } = await db.auth.getUser(t);
  if (error && !/expired|invalid|malformed|not found|bad_jwt/i.test(String(error.message || ""))) ({ data, error } = await db.auth.getUser(t)); // خطای گذرا: یک تلاش دیگر
  if (error || !data || !data.user) return null;
  const ap = await db.from("adminpanel_access").select("role,active").eq("user_id", data.user.id).eq("active", true).maybeSingle();
  if (!ap.data || !["owner", "admin"].includes(ap.data.role)) return null;
  return { uid: data.user.id, email: data.user.email || "" };
}

async function byLegacy(id: unknown) {
  if (!Number.isInteger(+(id as number))) return null;
  const r = await db.from("ga_accounts").select(COLS).eq("legacy_id", +(id as number)).maybeSingle();
  return r.data || null;
}
async function nextLegacyId(prefer?: number): Promise<number> {
  if (Number.isInteger(prefer) && (prefer as number) > 0) {
    const r = await db.from("ga_accounts").select("legacy_id").eq("legacy_id", prefer as number).maybeSingle();
    if (!r.data) return prefer as number;
  }
  const m = await db.from("ga_accounts").select("legacy_id").order("legacy_id", { ascending: false }).limit(1);
  return ((m.data && m.data[0] && m.data[0].legacy_id) || 0) + 1;
}

async function createOne(a: any, by: string) {
  const user = String(a.user || "").trim().toLowerCase();
  if (!okUser(user)) return { ok: false, err: "نام کاربری فقط حروف انگلیسی کوچک، عدد و . _ - (حداکثر ۴۰ نویسه): " + user };
  const role = a.role === "admin" ? "admin" : a.role === "member" ? "member" : null;
  if (!role) return { ok: false, err: "نقش نامعتبر است" };
  const pass = String(a.pass || "");
  if (pass.length < MIN_PASS) return { ok: false, err: `رمز باید حداقل ${MIN_PASS} نویسه باشد` };
  const dup = await db.from("ga_accounts").select("legacy_id").eq("username", user).maybeSingle();
  if (dup.data) return { ok: false, err: "این نام کاربری قبلاً ثبت شده است", code: "DUP" };
  const pid = a.pid == null || a.pid === "" ? null : +a.pid;
  if (pid != null) {
    const dp = await db.from("ga_accounts").select("username").eq("pid", pid).maybeSingle();
    if (dp.data) return { ok: false, err: "این بازیکن قبلاً حساب دارد: " + dp.data.username, code: "DUP_PID" };
  }
  const created = await db.auth.admin.createUser({
    email: emailOf(user), password: pass, email_confirm: true,
    app_metadata: { ga_account: true }, user_metadata: { username: user },
  });
  if (created.error || !created.data || !created.data.user) return { ok: false, err: "Auth: " + (created.error ? created.error.message : "createUser failed") };
  const uid = created.data.user.id;
  const legacy_id = await nextLegacyId(+a.id);
  const ins = await db.from("ga_accounts").insert({
    user_id: uid, legacy_id, username: user, name: String(a.name || user).slice(0, 80), role,
    main: !!a.main, active: a.active !== false, pid, created_by: by,
  }).select(COLS).single();
  if (ins.error) {
    await db.auth.admin.deleteUser(uid);
    return { ok: false, err: ins.error.message };
  }
  if (a.active === false) await db.auth.admin.updateUserById(uid, { ban_duration: "876000h" });
  return { ok: true, account: view(ins.data) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method !== "POST") return json({ ok: false, err: "POST only" }, 405);
    const admin = await consoleAdmin(req);
    if (!admin) return json({ ok: false, err: "فقط مدیر پنل مدیریت (adminpanel) اجازهٔ مدیریت حساب‌ها را دارد.", code: "FORBIDDEN" }, 403);
    let body: any;
    try { body = await req.json(); } catch { return json({ ok: false, err: "invalid JSON" }, 400); }
    const action = body && body.action;

    if (action === "list") {
      const r = await db.from("ga_accounts").select(COLS).order("legacy_id");
      if (r.error) return json({ ok: false, err: r.error.message }, 502);
      return json({ ok: true, accounts: (r.data || []).map(view) });
    }

    if (action === "create") {
      const out = await createOne(body, admin.uid);
      return json(out, out.ok ? 200 : (out.code ? 409 : 400));
    }

    if (action === "bulk") {
      const list = Array.isArray(body.accounts) ? body.accounts.slice(0, 500) : [];
      const results = [];
      for (const a of list) {
        const r = await createOne(a, admin.uid);
        results.push({ user: a && a.user, ok: r.ok, err: r.ok ? undefined : r.err, account: r.ok ? r.account : undefined });
      }
      return json({ ok: true, results });
    }

    if (action === "update") {
      const cur = await byLegacy(body.id);
      if (!cur) return json({ ok: false, err: "حساب پیدا نشد" }, 404);
      const patch: any = { updated_at: new Date().toISOString() };
      const authPatch: any = {};
      if (body.user !== undefined) {
        const u = String(body.user || "").trim().toLowerCase();
        if (!okUser(u)) return json({ ok: false, err: "نام کاربری نامعتبر است" }, 400);
        if (u !== cur.username) {
          const dup = await db.from("ga_accounts").select("legacy_id").eq("username", u).maybeSingle();
          if (dup.data) return json({ ok: false, err: "این نام کاربری قبلاً ثبت شده است", code: "DUP" }, 409);
          patch.username = u;
          authPatch.email = emailOf(u);
          authPatch.email_confirm = true;
          authPatch.user_metadata = { username: u };
        }
      }
      if (body.name !== undefined) patch.name = String(body.name || "").slice(0, 80);
      if (body.role !== undefined) {
        if (!["admin", "member"].includes(body.role)) return json({ ok: false, err: "نقش نامعتبر است" }, 400);
        if (cur.main && body.role !== "admin") return json({ ok: false, err: "نقش مدیر اصلی قابل تغییر نیست" }, 400);
        patch.role = body.role;
      }
      if (body.pid !== undefined) {
        const pid = body.pid == null || body.pid === "" ? null : +body.pid;
        if (pid != null && pid !== cur.pid) {
          const dp = await db.from("ga_accounts").select("username").eq("pid", pid).maybeSingle();
          if (dp.data) return json({ ok: false, err: "این بازیکن قبلاً حساب دارد: " + dp.data.username, code: "DUP_PID" }, 409);
        }
        patch.pid = pid;
      }
      if (body.active !== undefined) {
        if (cur.main && body.active === false) return json({ ok: false, err: "مدیر اصلی غیرفعال نمی‌شود" }, 400);
        patch.active = body.active !== false;
        authPatch.ban_duration = patch.active ? "none" : "876000h"; // غیرفعال = نشست‌های بعدی هم رد می‌شوند
      }
      if (Object.keys(authPatch).length) {
        const ua = await db.auth.admin.updateUserById(cur.user_id, authPatch);
        if (ua.error) return json({ ok: false, err: "Auth: " + ua.error.message }, 502);
        if (authPatch.email || patch.active === false) await revokeSessions(cur.user_id);
      }
      const up = await db.from("ga_accounts").update(patch).eq("user_id", cur.user_id).select(COLS).single();
      if (up.error) return json({ ok: false, err: up.error.message }, 502);
      return json({ ok: true, account: view(up.data) });
    }

    if (action === "password") {
      const cur = await byLegacy(body.id);
      if (!cur) return json({ ok: false, err: "حساب پیدا نشد" }, 404);
      const pass = String(body.pass || "");
      if (pass.length < MIN_PASS) return json({ ok: false, err: `رمز باید حداقل ${MIN_PASS} نویسه باشد` }, 400);
      const ua = await db.auth.admin.updateUserById(cur.user_id, { password: pass });
      if (ua.error) return json({ ok: false, err: "Auth: " + ua.error.message }, 502);
      await revokeSessions(cur.user_id);   // رمز عوض شد → ورودهای قبلی روی همهٔ مرورگرها خارج می‌شوند
      await db.from("ga_accounts").update({ updated_at: new Date().toISOString() }).eq("user_id", cur.user_id);
      return json({ ok: true });
    }

    if (action === "delete") {
      const cur = await byLegacy(body.id);
      if (!cur) return json({ ok: true, deleted: 0 });
      if (cur.main) return json({ ok: false, err: "مدیر اصلی حذف نمی‌شود" }, 400);
      const d = await db.auth.admin.deleteUser(cur.user_id); // ga_accounts با cascade حذف می‌شود
      if (d.error) return json({ ok: false, err: "Auth: " + d.error.message }, 502);
      return json({ ok: true, deleted: 1 });
    }

    return json({ ok: false, err: "unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, err: String(e) }, 500);
  }
});
