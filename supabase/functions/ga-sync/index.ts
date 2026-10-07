// ga-sync — دروازهٔ امن نوشتن به دیتابیس پات کلاب (Supabase Edge Function) — نسخهٔ ۲ (2026-10-07)
// نوشتن فقط از اینجا: با کلید مخفی service_role که فقط روی سرور است، نه مرورگر کاربر.
// هویت: JWT کاربر Supabase Auth در هدر Authorization.
//   • مدیر (adminpanel_access owner/admin یا ga_accounts.role=admin): همهٔ کلیدهای ga_*
//   • عضو (ga_accounts.role=member): فقط کلیدهای عضو و فقط سهم خودش (ادغام سمت سرور)
//   • بدون JWT: فقط اگر GA_SYNC_ALLOW_ANON=1 (دورهٔ گذار) — در حالت قفل ۴۰۱
// اکشن‌ها:
//   { action:"kv",     rows:[{k, v, updated_at}] }      → آینهٔ کلید/مقدار
//   { action:"shots",  session:{...}, shots:[{...}] }  → sp_sessions / sp_shots (فقط مدیر)
//   { action:"public", rows:[{k, v}] }                 → سکو/تقویم فصل در web_store (فقط مدیر)
//   { action:"whoami" }                                 → نقش تشخیص‌داده‌شده (برای تست/عیب‌یابی)
// نوشتنِ بی‌اثر (محتوای یکسان با ابر) انجام نمی‌شود و updated_at عوض نمی‌شود.
import { createClient } from "jsr:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") || "";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const allowAnon = () => (Deno.env.get("GA_SYNC_ALLOW_ANON") || "") === "1";

// Same UTF-8 request-body budget as source/js/cloud.js.
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const okKey = (k: unknown) => typeof k === "string" && /^ga_[a-z0-9_]{1,40}$/.test(k);
const okRes = (r: unknown) => typeof r === "string" && ["straight", "slice", "hook", "miss"].includes(r);

/* POLICY-START — منطق خالص (بدون Deno/شبکه)؛ تست: source/e2e/ga_sync_policy_test.cjs */
const MEMBER_KEYS: Record<string, string> = {
  ga_msg_reads: "reads",   // { msgId: { userKey: iso } } — فقط userKey خودش
  ga_avatars: "own",       // { user: {...} }
  ga_cart: "own",
  ga_fav: "own",
  ga_coins: "coins",       // { user: {total, log} } — فقط خرج (کاهش)، نه افزایش
  ga_coinreq: "coinreq",   // [{id, user, status, ...}] — فقط درخواست تازهٔ «در انتظار» برای خودش
};
function stable(v: any): any {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") {
    const o: any = {};
    Object.keys(v).sort().forEach((k) => { o[k] = stable(v[k]); });
    return o;
  }
  return v;
}
function sameJson(a: any, b: any): boolean {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}
function isObj(v: any): boolean { return !!v && typeof v === "object" && !Array.isArray(v); }
function norm(u: any): string { return String(u == null ? "" : u).trim().toLowerCase(); }
/* ادغام نوشتن عضو: فقط سهم خودِ عضو از مقدار ارسالی برداشته می‌شود؛ بقیه از ابر. */
function mergeMember(k: string, current: any, incoming: any, user: string): { ok: boolean; v?: any; err?: string } {
  const mode = MEMBER_KEYS[k];
  const me = norm(user);
  if (!mode || !me) return { ok: false, err: "forbidden key for member" };
  if (mode === "own" || mode === "coins") {
    const cur = isObj(current) ? JSON.parse(JSON.stringify(current)) : {};
    const inc = isObj(incoming) ? incoming : {};
    let mine: any;
    Object.keys(inc).forEach((u) => { if (norm(u) === me) mine = inc[u]; });
    const curKey = Object.keys(cur).find((u) => norm(u) === me);
    if (mine === undefined) return { ok: true, v: cur };
    if (mode === "coins") {
      const before = curKey ? (+((cur[curKey] || {}).total) || 0) : 0;
      const after = +((mine || {}).total) || 0;
      if (!isObj(mine) || !Number.isFinite(after) || after > before) return { ok: false, err: "coins can only be spent by members" };
    }
    if (curKey && curKey !== me) delete cur[curKey];
    cur[me] = mine;
    return { ok: true, v: cur };
  }
  if (mode === "reads") {
    const cur = isObj(current) ? JSON.parse(JSON.stringify(current)) : {};
    const inc = isObj(incoming) ? incoming : {};
    Object.keys(inc).forEach((mid) => {
      const m = inc[mid];
      if (!isObj(m)) return;
      Object.keys(m).forEach((u) => {
        if (norm(u) !== me) return;
        if (!isObj(cur[mid])) cur[mid] = {};
        if (cur[mid][me] === undefined) cur[mid][me] = m[u];
      });
    });
    return { ok: true, v: cur };
  }
  if (mode === "coinreq") {
    const cur = Array.isArray(current) ? JSON.parse(JSON.stringify(current)) : [];
    const inc = Array.isArray(incoming) ? incoming : [];
    const ids = new Set(cur.map((r: any) => r && String(r.id)));
    inc.forEach((r: any) => {
      if (!isObj(r) || norm(r.user) !== me || r.id == null || ids.has(String(r.id))) return;
      const add = Object.assign({}, r, { user: me, status: "pending" });
      delete add.by; delete add.decidedAt; delete add.adminNote;
      cur.push(add); ids.add(String(r.id));
    });
    return { ok: true, v: cur };
  }
  return { ok: false, err: "forbidden key for member" };
}
/* POLICY-END */

type Who = { uid: string; admin: boolean; console: boolean; username: string } | null;
async function whoIs(req: Request): Promise<Who> {
  const h = req.headers.get("authorization") || "";
  const t = h.replace(/^Bearer\s+/i, "").trim();
  if (!t || t.split(".").length !== 3) return null; // کلید publishable / anon → مهمان
  let { data, error } = await db.auth.getUser(t);
  if (error && !/expired|invalid|malformed|not found|bad_jwt/i.test(String(error.message || ""))) ({ data, error } = await db.auth.getUser(t)); // خطای گذرا: یک تلاش دیگر
  if (error || !data || !data.user) return null;
  const uid = data.user.id;
  const [ap, ac] = await Promise.all([
    db.from("adminpanel_access").select("role,active").eq("user_id", uid).eq("active", true).maybeSingle(),
    db.from("ga_accounts").select("username,role,active").eq("user_id", uid).maybeSingle(),
  ]);
  const acc = ac.data && ac.data.active ? ac.data : null;
  if (ap.data && ["owner", "admin"].includes(ap.data.role)) {
    return { uid, admin: true, console: true, username: acc ? acc.username : (data.user.email || "admin") };
  }
  if (acc) return { uid, admin: acc.role === "admin", console: false, username: acc.username };
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method !== "POST") return json({ ok: false, err: "POST only" }, 405);
    const declaredBytes = Number(req.headers.get("content-length") || 0);
    if (declaredBytes > MAX_BODY_BYTES) return tooLarge(declaredBytes);
    const raw = await req.text();
    const receivedBytes = new TextEncoder().encode(raw).byteLength;
    if (receivedBytes > MAX_BODY_BYTES) return tooLarge(receivedBytes);
    let body;
    try { body = JSON.parse(raw); }
    catch { return json({ ok: false, err: "invalid JSON" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ ok: false, err: "invalid request body" }, 400);
    }

    const who = await whoIs(req);
    const legacy = !who && allowAnon();          // دورهٔ گذار: کلاینت قدیمی بدون JWT
    const isAdmin = !!(who && who.admin) || legacy;

    if (body.action === "whoami") {
      return json({ ok: true, role: who ? (who.admin ? "admin" : "member") : "guest", console: !!(who && who.console), user: who ? who.username : null, legacy });
    }
    if (!who && !legacy) return json({ ok: false, err: "ورود لازم است؛ دوباره وارد پنل شوید.", code: "AUTH_REQUIRED" }, 401);

    /* ── اکشن ۱: آینهٔ کلید/مقدار ── */
    if (body.action === "kv") {
      const rows = (body.rows || []).filter((r: any) => r && okKey(r.k)).map((r: any) => ({
        k: r.k,
        v: r.v,
        updated_at: r.updated_at || new Date().toISOString(),
      }));
      if (!rows.length) return json({ ok: false, err: "no valid rows" }, 400);
      if (!isAdmin) {
        const bad = rows.find((r: any) => !MEMBER_KEYS[r.k] || (r.v && r.v.__del));
        if (bad) return json({ ok: false, err: "این بخش فقط برای مدیر قابل ذخیره است: " + bad.k, code: "FORBIDDEN_KEY", key: bad.k }, 403);
      }
      const cur = await db.from("ga_store").select("k,v").in("k", rows.map((r: any) => r.k));
      if (cur.error) return json({ ok: false, err: cur.error.message }, 502);
      const current: Record<string, any> = {};
      (cur.data || []).forEach((r: any) => { current[r.k] = r.v; });
      const values: Record<string, any> = {};
      if (!isAdmin) {
        for (const r of rows) {
          const m = mergeMember(r.k, current[r.k], r.v, who!.username);
          if (!m.ok) return json({ ok: false, err: m.err, code: "FORBIDDEN_CHANGE", key: r.k }, 403);
          r.v = m.v;
          r.updated_at = new Date().toISOString();
          values[r.k] = m.v;
        }
      }
      const del = rows.filter((r: any) => r.v && r.v.__del).map((r: any) => r.k).filter((k: string) => k in current);
      const delAll = rows.filter((r: any) => r.v && r.v.__del).length;
      const put = rows.filter((r: any) => !(r.v && r.v.__del));
      const changed = put.filter((r: any) => !(r.k in current) || !sameJson(current[r.k], r.v));
      if (changed.length) {
        const e1 = await db.from("ga_store").upsert(changed);
        if (e1.error) return json({ ok: false, err: e1.error.message }, 502);
      }
      if (del.length) {
        const e2 = await db.from("ga_store").delete().in("k", del);
        if (e2.error) return json({ ok: false, err: e2.error.message }, 502);
      }
      const out: any = { ok: true, put: put.length, del: delAll, written: changed.length + del.length };
      if (!isAdmin) out.values = values;
      return json(out);
    }

    /* ── اکشن ۳: انتشار دادهٔ عمومی فصل در سایت (سکو و تقویم) — فقط مدیر ──
       فقط دو کلید مجاز است؛ محتوای یکسان (به‌جز updatedAt) دوباره نوشته نمی‌شود. */
    if (body.action === "public") {
      if (!isAdmin) return json({ ok: false, err: "انتشار در سایت فقط برای مدیر مجاز است.", code: "FORBIDDEN" }, 403);
      const rows = (body.rows || []).filter((r: any) =>
        r && typeof r.k === "string" && /^web_setting_(season_podium|season_calendar)$/.test(r.k) &&
        r.v && typeof r.v === "object" && !Array.isArray(r.v) && JSON.stringify(r.v).length <= 60000
      );
      if (!rows.length) return json({ ok: false, err: "no valid rows" }, 400);
      const strip = (v: any) => { const o = Object.assign({}, v || {}); delete o.updatedAt; return o; };
      const write: any[] = [];
      for (const r of rows) {
        const prev = await db.from("web_store").select("v,updated_at").eq("k", r.k).maybeSingle();
        if (prev.data && sameJson(strip(prev.data.v), strip(r.v))) continue; // بی‌تغییر
        if (prev.data && prev.data.updated_at) {
          const age = Date.now() - new Date(prev.data.updated_at).getTime();
          if (age >= 0 && age < 15000) {
            return json({ ok: false, err: "تازه‌ترین انتشار همین حالا ثبت شده؛ کمی بعد دوباره تلاش کنید." }, 429);
          }
        }
        write.push({ k: r.k, v: r.v, updated_at: new Date().toISOString() });
      }
      if (write.length) {
        const e1 = await db.from("web_store").upsert(write);
        if (e1.error) return json({ ok: false, err: e1.error.message }, 502);
      }
      return json({ ok: true, put: rows.length, written: write.length });
    }

    /* ── اکشن ۲: ثبت جلسه + ضربه‌ها در جدول‌های واقعی — فقط مدیر ── */
    if (body.action === "shots") {
      if (!isAdmin) return json({ ok: false, err: "ثبت جلسهٔ تمرین فقط برای مدیر/مربی مجاز است.", code: "FORBIDDEN" }, 403);
      const sn = body.session || {};
      const shots = (body.shots || []).filter((x: any) =>
        x && typeof x.sid === "string" && Number.isFinite(+x.pid) &&
        typeof x.club === "string" && okRes(x.res));
      if (!sn.id || !shots.length) return json({ ok: false, err: "session/shots missing" }, 400);
      const e1 = await db.from("sp_sessions").upsert({
        id: sn.id, no: sn.no || null, type: sn.type || null, date_fa: sn.dateFa || null,
        status: sn.status || null, created_at: sn.createdAt || null, closed_at: sn.closedAt || null,
      });
      if (e1.error) return json({ ok: false, err: e1.error.message }, 502);
      /* idempo: ضربه‌های تکراری همان جلسه دوباره ثبت نشوند */
      await db.from("sp_shots").delete().eq("session_id", sn.id);
      const e2 = await db.from("sp_shots").insert(shots.map((x: any) => ({
        session_id: x.sid, pid: +x.pid, club: String(x.club).slice(0, 40),
        yds: Math.round(+x.yds || 0), res: x.res, t: Math.round(+x.t || 0),
      })));
      if (e2.error) return json({ ok: false, err: e2.error.message }, 502);
      return json({ ok: true, shots: shots.length });
    }

    return json({ ok: false, err: "unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, err: String(e) }, 500);
  }
});

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function tooLarge(receivedBytes: number) {
  return json({
    ok: false,
    err: "payload too large",
    code: "PAYLOAD_TOO_LARGE",
    maxBytes: MAX_BODY_BYTES,
    receivedBytes,
  }, 413);
}
