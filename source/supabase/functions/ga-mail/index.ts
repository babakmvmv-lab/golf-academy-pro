// ga-mail — دالان ایمیل آکادمی پات کلاب (Supabase Edge Function)
// یک‌بار توسط مدیر ساخته می‌شود:  supabase functions deploy ga-mail
// سیکرت لازم: RESEND_API_KEY=re_...
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { to, to_name, subject, html, text } = await req.json();
    if (!to || !subject) return json({ ok: false, err: "to/subject لازم است" }, 400);
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "آکادمی گلف پات کلاب <info@puttclub.ir>",
        to: [to],
        subject,
        html: html || ("<p>" + String(text || "").replace(/\n/g, "<br>") + "</p>"),
      }),
    });
    const body = await r.text();
    if (!r.ok) return json({ ok: false, err: "Resend " + r.status + ": " + body.slice(0, 200) }, 502);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, err: String(e) }, 500);
  }
});
function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
