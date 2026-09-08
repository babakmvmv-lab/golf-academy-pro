-- ════════════════════════════════════════════════════════════════
-- پات کلاب — فاز ۱: جدول‌های واقعی تمرین + ویوی تحلیل (بدون ریسک، همین الان اجرا کن)
-- مسیر اجرا: Supabase Dashboard ← SQL Editor ← New query ← paste ← Run
-- ════════════════════════════════════════════════════════════════

-- ۱) جلسات تمرین (هر سطر = یک جلسه)
create table if not exists public.sp_sessions (
  id         text primary key,
  no         int,
  type       text,            -- Range | Putting | Chipping | Approach | On-Course
  date_fa    text,
  status     text,            -- open | closed
  by_user    text,
  created_at timestamptz,
  closed_at  timestamptz
);

-- ۲) ضربه‌ها (هر سطر = یک ضربه — قلب آنالیزهای آینده)
create table if not exists public.sp_shots (
  id         bigint generated always as identity primary key,
  session_id text references public.sp_sessions(id) on delete cascade,
  pid        int,
  club       text,
  yds        int,
  res        text,            -- straight | slice | hook | miss
  t          bigint
);

create index if not exists sp_shots_session_idx on public.sp_shots (session_id);
create index if not exists sp_shots_pid_club_idx on public.sp_shots (pid, club);
create index if not exists sp_shots_type_idx    on public.sp_shots (club, res);

-- ۳) ویوی آمادهٔ تحلیل: بازیکن × نوع × کلاب (درصد صاف + Max Carry از قبل محاسبه‌شده)
create or replace view public.v_player_club_stats as
  select
    s.pid,
    e.type,
    s.club,
    count(*)                                                          as shots,
    round(100.0 * count(*) filter (where s.res = 'straight') / count(*), 1) as straight_pct,
    max(s.yds) filter (where s.res = 'straight')                      as max_carry,
    count(distinct e.id)                                              as sessions
  from public.sp_shots s
  join public.sp_sessions e on e.id = s.session_id
  where e.status = 'closed'
  group by s.pid, e.type, s.club;

-- ۴) امنیت جدول‌های جدید: خواندن برای همه، نوشتن فقط از Edge Function (service_role)
alter table public.sp_sessions enable row level security;
alter table public.sp_shots    enable row level security;
drop policy if exists sp_sessions_read on public.sp_sessions;
drop policy if exists sp_shots_read    on public.sp_shots;
create policy sp_sessions_read on public.sp_sessions for select using (true);
create policy sp_shots_read    on public.sp_shots    for select using (true);
grant select on public.sp_sessions to anon;
grant select on public.sp_shots    to anon;
grant select on public.v_player_club_stats to anon;

-- ✔ پایان فاز ۱ — هیچ تغییری در عملکرد فعلی سایت نمی‌کند.
