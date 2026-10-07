-- ════════════════════════════════════════════════════════════════════════
-- پات کلاب — نشست‌ها و زمانِ نسخه (2026-10-07)
-- ۱) ga_revoke_sessions: با تغییر رمز / غیرفعال‌سازی / تغییر یوزرنیم، همهٔ نشست‌های قبلیِ آن حساب
--    روی همهٔ مرورگرها باطل می‌شود (فقط service_role؛ از تابع ga-accounts صدا زده می‌شود).
-- ۲) اصلاح یک‌بارهٔ updated_at های «آینده» در ga_store که با ساعت اشتباهِ یک دستگاه ثبت شده‌اند.
--    هیچ مقداری (v) تغییر نمی‌کند؛ فقط زمانِ نسخه به زمان فعلی سرور برمی‌گردد.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.ga_revoke_sessions(p_uid uuid) returns integer
language plpgsql security definer set search_path = auth, public as $$
declare n integer;
begin
  delete from auth.sessions where user_id = p_uid;     -- refresh_tokens با cascade حذف می‌شوند
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.ga_revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function public.ga_revoke_sessions(uuid) to service_role;

update public.ga_store set updated_at = now() where updated_at > now() + interval '2 minutes';
