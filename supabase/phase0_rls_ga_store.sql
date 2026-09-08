-- ════════════════════════════════════════════════════════════════
-- پات کلاب — فاز صفر (امنیت): قفل‌کردن جدول ga_store
-- ⚠️ این فایل را **آخرِ کار و فقط بعد از آپدیت جدید سایت** اجرا کن.
--    (سایتِ بعدی سینک را از مسیر امن Edge Function انجام می‌دهد؛
--     اگر زود اجرا کنی، سینک موقتاً قطع می‌شود تا آن آپدیت برسد)
-- مسیر اجرا: Supabase Dashboard ← SQL Editor ← New query ← paste ← Run
-- ════════════════════════════════════════════════════════════════

-- ۱) RLS روشن → بدون policy، anon دیگر نمی‌تواند INSERT/UPDATE/DELETE کند
alter table public.ga_store enable row level security;

-- ۲) خواندن همچنان آزاد می‌ماند (سایت برای pull به SELECT نیاز دارد)
drop policy if exists ga_store_read on public.ga_store;
create policy ga_store_read on public.ga_store for select using (true);
grant select on public.ga_store to anon;

-- ۳) دفاع دولایه: سطح گرنتِ مستقیم هم بسته شود
revoke insert, update, delete on public.ga_store from anon;

-- ✔ نتیجه: کلید عمومی فقط «می‌خواند». نوشتن فقط از Edge Function با کلید مخفی سرور.
