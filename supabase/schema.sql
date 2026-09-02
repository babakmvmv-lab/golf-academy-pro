-- ═══════════════════════════════════════════════════════════════════
-- GolfAcademy PRO — همگام‌سازی ابری، فاز ۱: آینهٔ localStorage
-- اجرا در: Supabase Dashboard → SQL Editor (قابل اجراى مجدد — idempotent)
-- پروژه: https://mszrzhoezqrjvonxrefi.supabase.co
-- ═══════════════════════════════════════════════════════════════════

-- جدول کلید/مقدار: هر کلید localStorage با پیشوند ga_ یک ردیف است.
create table if not exists public.ga_store (
  k          text primary key,
  v          jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.ga_store is
  'آینهٔ کلید/مقدارِ localStorage (پیشوند ga_) برای همگام‌سازی بین دستگاه‌ها — LWW';

-- اگر جدول قدیمی با ستون‌های ناقص ساخته شده باشد، کاملش می‌کند:
alter table public.ga_store add column if not exists v jsonb;
alter table public.ga_store add column if not exists updated_at timestamptz not null default now();

-- ── دسترسی ──────────────────────────────────────────────────────────
-- فاز ۱: یک باشگاه مشترک، بدون احراز هویت کاربر؛ کلید public (anon /
-- publishable) اجازهٔ خواندن/نوشتن روی همین جدول را دارد.
-- ⚠️ این یعنی هر کسی با URL + کلید public می‌تواند این جدول را بخواند/بنویسد.
-- برای فاز ۲ (چندباشگاهی/حریم خصوصی) این policy محدودتر می‌شود —
-- مسیر تکامل در docs/CLOUD_PLAN.md توضیح داده شده است.
alter table public.ga_store enable row level security;

drop policy if exists ga_store_share on public.ga_store;
create policy ga_store_share on public.ga_store
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- فقط از طریق PostgREST (نه exposes مجدد در schema‌های دیگر)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.ga_store to anon, authenticated;

-- ── اگر شکلِ جدولِ قبلی با این اسکيما نمی‌خواند، با اجرای این خط
--    همه‌چیز از صفر ساخته می‌شود (دادهٔ فعلی حذف می‌شود):
-- drop table if exists public.ga_store;  -- سپس کل فایل را دوباره اجرا کنید
