-- ════════════════════════════════════════════════════════════════════════
-- پات کلاب — قفل ga_store (بخش B)  — 2026-10-07
-- پیش‌نیاز: supabase/ga_accounts.sql اجرا شده، کلاینت جدید (ورود Supabase Auth) منتشر شده
-- و ga-sync نسخهٔ JWT-دار مستقر است. هیچ ردیفی حذف یا تغییر نمی‌کند.
-- بازگشت اضطراری: supabase/ga_store_lockdown_rollback.sql
-- ════════════════════════════════════════════════════════════════════════
-- B1) نوشتن مستقیم برای همه بسته؛ نوشتن فقط از ga-sync (کلید سرور + بررسی JWT)
drop policy if exists ga_store_share on public.ga_store;
revoke insert, update, delete, truncate, references, trigger on public.ga_store from anon, authenticated;
-- B2) خواندن:
--   • مهمان (قبل از ورود): فقط کلیدهای نمایشی عمومی صفحهٔ ورود (بدون اطلاعات شخصی)
--   • عضو/مدیر واردشده: همه، به‌جز تنظیمات ایمیل که فقط مدیر
drop policy if exists ga_store_read on public.ga_store;
create policy ga_store_public_read on public.ga_store for select to anon, authenticated
  using (k in ('ga_academy','ga_siteinfo','ga_home_skin','ga_ui','ga_events','ga_tournaments','ga_tour_hidden',
               'ga_tour_override','ga_tour_rules','ga_programs','ga_courses','ga_course_override','ga_results',
               'ga_plans','ga_billing_cycles','ga_plan_features','ga_rank_skin'));
create policy ga_store_member_read on public.ga_store for select to authenticated
  using (public.ga_is_member() and (k <> 'ga_email_cfg' or public.ga_is_admin()));
grant select on public.ga_store to anon, authenticated;
