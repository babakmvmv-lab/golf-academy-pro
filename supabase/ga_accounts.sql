-- ════════════════════════════════════════════════════════════════════════
-- پات کلاب — حساب‌های ابری آکادمی (بخش A — افزایشی)  (2026-10-07)
-- دو بخش جدا دارد و ترتیب مهم است:
--   بخش A (افزایشی، بی‌خطر): جدول ga_accounts + توابع نقش. رفتار فعلی را عوض نمی‌کند.
--   بخش B (قفل): فقط بعد از انتشار کلاینت جدید (ورود Supabase Auth) و ساخت حساب‌ها.
-- هیچ ردیفی از ga_store حذف یا تغییر نمی‌کند.
-- ════════════════════════════════════════════════════════════════════════

-- ───────────── بخش A ─────────────
create table if not exists public.ga_accounts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  legacy_id  integer not null unique,            -- همان id عددی قدیمی (اشتراک‌ها با user_id به آن وصل‌اند)
  username   text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  name       text not null default '',
  role       text not null check (role in ('admin','member')),
  main       boolean not null default false,
  active     boolean not null default true,
  pid        integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);
create unique index if not exists ga_accounts_pid_uniq on public.ga_accounts(pid) where pid is not null;
comment on table public.ga_accounts is
  'حساب‌های پنل آکادمی (یوزر/نقش). رمز فقط در Supabase Auth است. نوشتن فقط از تابع ga-accounts با کلید سرور.';

alter table public.ga_accounts enable row level security;
drop policy if exists ga_accounts_self_read on public.ga_accounts;
create policy ga_accounts_self_read on public.ga_accounts
  for select to authenticated using (user_id = auth.uid());
revoke all on public.ga_accounts from anon, authenticated;
grant select on public.ga_accounts to authenticated;

-- عضو معتبر آکادمی: حساب فعال ga_accounts یا مدیر adminpanel
create or replace function public.ga_is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ga_accounts a where a.user_id = auth.uid() and a.active)
      or exists (select 1 from public.adminpanel_access p where p.user_id = auth.uid() and p.active and p.role in ('owner','admin'));
$$;
create or replace function public.ga_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ga_accounts a where a.user_id = auth.uid() and a.active and a.role = 'admin')
      or exists (select 1 from public.adminpanel_access p where p.user_id = auth.uid() and p.active and p.role in ('owner','admin'));
$$;
revoke all on function public.ga_is_member() from public;
revoke all on function public.ga_is_admin() from public;
grant execute on function public.ga_is_member() to anon, authenticated;
grant execute on function public.ga_is_admin() to anon, authenticated;
-- بخش B (قفل خواندن/نوشتن ga_store): supabase/ga_store_lockdown.sql
