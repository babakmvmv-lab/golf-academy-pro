// ga-sync — دروازهٔ امن نوشتن به دیتابیس پات کلاب (Supabase Edge Function)
// نوشتن فقط از اینجا: با کلید مخفی service_role که فقط روی سرور است، نه مرورگر کاربر.
// اکشن‌ها:
//   { action:"kv",    rows:[{k, v, updated_at}] }            → آینهٔ کلید/مقدار (مثل امروز، ولی امن)
//   { action:"shots", session:{...}, shots:[{...}] }         → رکورد واقعی در sp_sessions / sp_shots
import { createClient } from "jsr:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") || "";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(url, key);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const okKey = (k: unknown) => typeof k === "string" && /^ga_[a-z0-9_]{1,40}$/.test(k);
const okRes = (r: unknown) => typeof r === "string" && ["straight", "slice", "hook", "miss"].includes(r);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method !== "POST") return json({ ok: false, err: "POST only" }, 405);
    const body = await req.json();
    const bodySize = JSON.stringify(body).length;
    if (bodySize > 800_000) return json({ ok: false, err: "payload too large" }, 413);

    /* ── اکشن ۱: آینهٔ کلید/مقدار (رفتار فعلی اپ، اما از مسیر امن) ── */
    if (body.action === "kv") {
      const rows = (body.rows || []).filter((r: any) => r && okKey(r.k)).map((r: any) => ({
        k: r.k,
        v: r.v,
        updated_at: r.updated_at || new Date().toISOString(),
      }));
      if (!rows.length) return json({ ok: false, err: "no valid rows" }, 400);
      const del = rows.filter((r: any) => r.v && r.v.__del).map((r: any) => r.k);
      const put = rows.filter((r: any) => !(r.v && r.v.__del));
      if (put.length) {
        const e1 = await db.from("ga_store").upsert(put);
        if (e1.error) return json({ ok: false, err: e1.error.message }, 502);
      }
      if (del.length) {
        const e2 = await db.from("ga_store").delete().in("k", del);
        if (e2.error) return json({ ok: false, err: e2.error.message }, 502);
      }
      return json({ ok: true, put: put.length, del: del.length });
    }

    /* ── اکشن ۲: ثبت جلسه + ضربه‌ها در جدول‌های واقعی (فاز ۱) ── */
    if (body.action === "shots") {
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
