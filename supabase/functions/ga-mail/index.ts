// ga-mail — دالان دوم ایمیل پنل آکادمی (Supabase Edge Function) — 2026-10-07
// وقتی مرورگر مدیر به EmailJS دسترسی ندارد (فیلتر/شبکه)، پنل همین تابع را صدا می‌زند.
// فقط مدیر (adminpanel_access owner/admin یا ga_accounts.role=admin) — با JWT در Authorization.
// ترتیب ارسال:
//   ۱) Resend — اگر سکرت RESEND_API_KEY تنظیم شده باشد (فرستنده: MAIL_FROM یا no-reply@puttclub.ir؛ DKIM دامنه آماده است)
//   ۲) EmailJS REST با همان سرویس/قالب ga_email_cfg — نیازمند روشن‌بودن «API for non-browser applications»
//      در داشبورد EmailJS (و در صورت فعال‌بودن Private Key، سکرت EMAILJS_PRIVATE_KEY)
// اگر هیچ‌کدام ممکن نبود، خطای روشن و قابل‌اقدام برمی‌گردد (نه ۴۰۴).
import { createClient } from "jsr:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") || "";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const EMAIL_DEFAULTS = { key: "olblhtePYhlS_a4Rv", svc: "service_ewdayg4", tpl: "template_k2dhpqd" }; // همان پیش‌فرض mgmt.js (کلید عمومی EmailJS)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function adminOf(req: Request): Promise<string | null> {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!t || t.split(".").length !== 3) return null;
  let { data, error } = await db.auth.getUser(t);
  if (error && !/expired|invalid|malformed|not found|bad_jwt/i.test(String(error.message || ""))) ({ data, error } = await db.auth.getUser(t)); // خطای گذرا: یک تلاش دیگر
  if (error || !data || !data.user) return null;
  const uid = data.user.id;
  const [ap, ac] = await Promise.all([
    db.from("adminpanel_access").select("role").eq("user_id", uid).eq("active", true).maybeSingle(),
    db.from("ga_accounts").select("username,role,active").eq("user_id", uid).maybeSingle(),
  ]);
  if (ap.data && ["owner", "admin"].includes(ap.data.role)) return data.user.email || "admin";
  if (ac.data && ac.data.active && ac.data.role === "admin") return ac.data.username;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method !== "POST") return json({ ok: false, err: "POST only" }, 405);
    const who = await adminOf(req);
    if (!who) return json({ ok: false, err: "ارسال ایمیل فقط برای مدیرِ واردشده مجاز است؛ دوباره وارد شوید.", code: "FORBIDDEN" }, 403);
    let b: any;
    try { b = await req.json(); } catch { return json({ ok: false, err: "invalid JSON" }, 400); }
    const to = String(b && b.to || "").trim();
    const subject = String(b && b.subject || "").trim().slice(0, 200);
    const html = String(b && b.html || "");
    const text = String(b && b.text || "");
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) return json({ ok: false, err: "آدرس ایمیل گیرنده نامعتبر است" }, 400);
    if (!subject) return json({ ok: false, err: "موضوع ایمیل خالی است" }, 400);
    if (html.length > 200000 || text.length > 50000) return json({ ok: false, err: "متن ایمیل بیش از حد بزرگ است" }, 413);

    const tried: string[] = [];
    /* ۱) Resend */
    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    if (resendKey) {
      const from = Deno.env.get("MAIL_FROM") || "PuttClub <no-reply@puttclub.ir>";
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, html: html || undefined, text: text || undefined }),
      });
      if (r.ok) return json({ ok: true, via: "resend" });
      tried.push("Resend " + r.status + ": " + (await r.text().catch(() => "")).slice(0, 160));
    }

    /* ۲) EmailJS از سمت سرور */
    let cfg: any = Object.assign({}, EMAIL_DEFAULTS);
    try {
      const row = await db.from("ga_store").select("v").eq("k", "ga_email_cfg").maybeSingle();
      if (row.data && row.data.v && typeof row.data.v === "object") cfg = Object.assign(cfg, row.data.v);
    } catch (_) { /* پیش‌فرض */ }
    if (typeof cfg.tpl === "string" && /^templates_/.test(cfg.tpl)) cfg.tpl = cfg.tpl.replace(/^templates_/, "template_");
    const payload: any = {
      service_id: cfg.svc, template_id: cfg.tpl, user_id: cfg.key,
      template_params: {
        to_email: to, to_name: b.to_name || "", name: b.to_name || "", subject, message: text, html,
        email: "", time: new Date().toLocaleString("fa-IR", { timeZone: "Asia/Tehran" }), academy: b.academy || "",
      },
    };
    const priv = Deno.env.get("EMAILJS_PRIVATE_KEY") || "";
    if (priv) payload.accessToken = priv;
    const r2 = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (r2.ok) return json({ ok: true, via: "emailjs" });
    const t2 = (await r2.text().catch(() => "")).slice(0, 200);
    tried.push("EmailJS " + r2.status + ": " + t2);
    if (r2.status === 403 && /non-browser/i.test(t2)) {
      return json({
        ok: false, code: "EMAIL_NOT_CONFIGURED", tried,
        err: "سرور ایمیل هنوز تنظیم نشده است: یا در داشبورد EmailJS بخش Account → Security گزینهٔ «Allow EmailJS API for non-browser applications» را روشن کنید، یا کلید Resend را به‌عنوان سکرت RESEND_API_KEY روی Supabase بگذارید.",
      }, 503);
    }
    return json({ ok: false, code: "EMAIL_SEND_FAILED", tried, err: "ارسال ایمیل از سرور انجام نشد: " + tried.join(" | ") }, 502);
  } catch (e) {
    return json({ ok: false, err: String(e) }, 500);
  }
});
