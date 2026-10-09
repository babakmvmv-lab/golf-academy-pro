-- ═══════════════════════════════════════════════════════════════════════════
-- باشگاه پات کلاب (PuttClub Gym — gym.puttclub.ir) — دیتابیس اختصاصی
-- اسکیمای جداگانهٔ «gym» در همان پروژهٔ Supabase آکادمی (مثل web_shop):
--   • ورود = همان حساب‌های Supabase Auth آکادمی (<username>@members.puttclub.ir)؛
--     تغییر رمز، تغییر نام کاربری، غیرفعال‌سازی و یوزر تازه از ga-accounts خودبه‌خود اعمال می‌شود.
--   • جدول‌ها خصوصی‌اند: anon/authenticated هیچ دسترسی مستقیمی ندارند (PostgREST اسکیمای gym را نمی‌بیند).
--   • تنها درگاه: public.gym_api(p_action, p_payload) — SECURITY DEFINER، هویت از JWT (auth.uid())،
--     دسترسی از «اشتراک‌ها ← ماتریس دسترسی» (ga_plan_features، گروه «باشگاه پات کلاب» = gym.*)
--     و اشتراک زندهٔ یوزر (ga_subscriptions) — دقیقاً همان قواعد source/js/sub.js. مدیران همه‌چیز را می‌بینند.
--   • عضو فقط دادهٔ خودش را می‌خواند/می‌نویسد؛ مدیر برای مربی‌گری همهٔ اعضا را می‌بیند و برنامه تخصیص می‌دهد.
-- اعمال: idempotent (create if not exists / create or replace) — اجرای دوباره بی‌خطر است.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

create schema if not exists gym;
revoke all on schema gym from public, anon, authenticated;
grant usage on schema gym to service_role;

-- ── کتابخانهٔ حرکات (فقط حرکاتی که مدل سه‌بعدی‌شان ساخته شده فعال‌اند) ──
create table if not exists gym.exercises (
  code        text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name_fa     text not null,
  name_en     text,
  equipment   text,
  muscles     jsonb not null default '[]'::jsonb,   -- [[نام, id, ضریب]]
  stabilizers text,
  cues        jsonb not null default '[]'::jsonb,
  golf        text,
  model       text,                                  -- مسیر پخش سه‌بعدی (play/…)
  active      boolean not null default true,
  sort        integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- ── برنامه‌ها (قالب‌های پیش‌فرض بر اساس جنس/سن + برنامه‌های اختصاصی مربی) ──
create table if not exists gym.programs (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  name        text not null,
  level       text,
  audience    text check (audience in ('m','f','g','t')),
  weeks       smallint not null default 8 check (weeks between 1 and 52),
  bar_kg      numeric(5,1) not null default 20 check (bar_kg between 0 and 50),
  youth_guard boolean not null default false,
  is_template boolean not null default false,
  active      boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists gym.program_items (
  program_id  uuid not null references gym.programs(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),   -- ۰ = شنبه
  ord         smallint not null default 0 check (ord between 0 and 20),
  title       text not null,
  exercise    text not null references gym.exercises(code),
  sets        smallint not null check (sets between 1 and 20),
  reps        smallint not null check (reps between 1 and 100),
  load_kg     numeric(6,2) not null default 0 check (load_kg between 0 and 500),
  rpe         text,
  tempo       text,
  rest_s      smallint not null default 90 check (rest_s between 0 and 900),
  primary key (program_id, weekday, ord)
);

-- ── تخصیص برنامه به عضو (هر عضو حداکثر یک برنامهٔ فعال) ──
create table if not exists gym.assignments (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references auth.users(id) on delete cascade,
  program_id  uuid not null references gym.programs(id),
  start_date  date not null default ((now() at time zone 'Asia/Tehran')::date),
  end_date    date,
  note        text,
  active      boolean not null default true,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists gym_assign_one_active on gym.assignments(member_id) where active;

-- ── جلسه‌های تمرین و ست‌ها ──
create table if not exists gym.workouts (
  id          text primary key check (id ~ '^[A-Za-z0-9_-]{4,64}$'),   -- شناسهٔ سمت دستگاه → ارسال دوباره بی‌خطر
  member_id   uuid not null references auth.users(id) on delete cascade,
  program_id  uuid references gym.programs(id) on delete set null,
  weekday     smallint check (weekday between 0 and 6),
  exercise    text not null references gym.exercises(code),
  started_at  timestamptz not null,
  duration_s  integer not null default 0 check (duration_s between 0 and 86400),
  volume_kg   numeric(10,2) not null default 0,
  e1rm_kg     numeric(7,2) not null default 0,
  n_sets      smallint not null default 0,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists gym_workouts_member on gym.workouts(member_id, started_at desc);

create table if not exists gym.workout_sets (
  workout_id  text not null references gym.workouts(id) on delete cascade,
  idx         smallint not null check (idx between 0 and 49),
  kg          numeric(6,2) not null default 0 check (kg between 0 and 500),
  reps        smallint not null default 0 check (reps between 0 and 100),
  done        boolean not null default false,
  rpe         numeric(3,1) check (rpe is null or rpe between 1 and 10),
  primary key (workout_id, idx)
);

-- ── اندازه‌گیری‌های بدن (سانتی‌متر / کیلوگرم) ──
create table if not exists gym.measurements (
  id          text primary key check (id ~ '^[A-Za-z0-9_-]{4,64}$'),
  member_id   uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null,
  height  numeric(5,1) check (height  is null or height  between 50 and 250),
  weight  numeric(5,1) check (weight  is null or weight  between 10 and 350),
  neck    numeric(5,1) check (neck    is null or neck    between 10 and 80),
  biceps  numeric(5,1) check (biceps  is null or biceps  between 10 and 80),
  forearm numeric(5,1) check (forearm is null or forearm between 10 and 70),
  chest   numeric(5,1) check (chest   is null or chest   between 40 and 200),
  waist   numeric(5,1) check (waist   is null or waist   between 30 and 200),
  hip     numeric(5,1) check (hip     is null or hip     between 40 and 200),
  thigh   numeric(5,1) check (thigh   is null or thigh   between 20 and 120),
  calf    numeric(5,1) check (calf    is null or calf    between 15 and 80),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
-- سطح ۲ و ۳ اندازه‌گیری (طول‌ها، پهناها، دورهای تکمیلی، چربی زیرپوستی، اعداد مشتق از عکس) — فقط کلیدهای مجاز با بازهٔ معتبر
alter table gym.measurements add column if not exists extra jsonb;
do $$ begin
  alter table gym.measurements add constraint measurements_extra_chk check (extra is null or (jsonb_typeof(extra) = 'object' and pg_column_size(extra) < 4000));
exception when duplicate_object then null; end $$;

create or replace function gym.meas_extra(p jsonb) returns jsonb
language plpgsql immutable set search_path = gym, pg_temp as $$
declare
  r jsonb := '{}'::jsonb; k text; v numeric;
  spec constant jsonb := '{"sit":[40,140],"span":[80,240],"uarmL":[12,55],"farmL":[10,45],"handL":[8,30],"thighL":[18,70],"shankL":[18,65],"footL":[10,36],
    "biac":[18,62],"biil":[14,50],"chestB":[14,50],"bicepsF":[12,70],"wrist":[9,26],"midthigh":[20,95],"ankle":[12,42],"shoulder":[60,180],
    "sf_triceps":[1.5,80],"sf_subscap":[1.5,80],"sf_biceps":[1.5,80],"sf_iliac":[1.5,80],"sf_supra":[1.5,80],"sf_abd":[1.5,80],"sf_thigh":[1.5,80],"sf_calf":[1.5,80],
    "w_chest":[8,75],"d_chest":[8,75],"w_waist":[8,75],"d_waist":[8,75],"w_hip":[8,75],"d_hip":[8,75],"bf":[2,70],"tier":[1,3],"age":[5,100]}'::jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  for k in select jsonb_object_keys(p) loop
    if spec ? k then
      begin v := (p->>k)::numeric; exception when others then continue; end;
      if v between (spec->k->>0)::numeric and (spec->k->>1)::numeric then r := r || jsonb_build_object(k, round(v, 1)); end if;
    elsif k = 'bfm' and (p->>k) in ('navy', 'dw', 'slaughter', 'deur', 'deurc') then
      r := r || jsonb_build_object(k, p->>k);
    end if;
  end loop;
  if r = '{}'::jsonb then return null; end if;
  return r;
end $$;

create index if not exists gym_meas_member on gym.measurements(member_id, measured_at);

-- ── تنظیمات هر عضو ──
create table if not exists gym.member_settings (
  member_id   uuid primary key references auth.users(id) on delete cascade,
  character   text check (character in ('m','f','g','t')),
  sound       boolean not null default true,
  vibrate     boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- ── ردپای تغییرات ──
create table if not exists gym.audit (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  actor   uuid,
  action  text not null,
  target  text,
  detail  jsonb
);

-- RLS روی همه (لایهٔ دوم امنیت؛ مسیر واقعی فقط gym_api است)
do $$
declare t text;
begin
  foreach t in array array['exercises','programs','program_items','assignments','workouts','workout_sets','measurements','member_settings','audit'] loop
    execute format('alter table gym.%I enable row level security', t);
    execute format('revoke all on gym.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on gym.%I to service_role', t);
  end loop;
end $$;
grant usage, select on sequence gym.audit_id_seq to service_role;

drop policy if exists own_rows on gym.workouts;
create policy own_rows on gym.workouts for select using (member_id = auth.uid() or public.ga_is_admin());
drop policy if exists own_rows on gym.measurements;
create policy own_rows on gym.measurements for select using (member_id = auth.uid() or public.ga_is_admin());
drop policy if exists own_rows on gym.member_settings;
create policy own_rows on gym.member_settings for select using (member_id = auth.uid() or public.ga_is_admin());
drop policy if exists own_rows on gym.assignments;
create policy own_rows on gym.assignments for select using (member_id = auth.uid() or public.ga_is_admin());
drop policy if exists own_rows on gym.workout_sets;
create policy own_rows on gym.workout_sets for select using (exists (select 1 from gym.workouts w where w.id = workout_id and (w.member_id = auth.uid() or public.ga_is_admin())));
drop policy if exists read_all on gym.exercises;
create policy read_all on gym.exercises for select using (true);
drop policy if exists read_all on gym.programs;
create policy read_all on gym.programs for select using (true);
drop policy if exists read_all on gym.program_items;
create policy read_all on gym.program_items for select using (true);

-- ═══ درخت دسترسی باشگاه — باید با گروه «gym» در ACCESS_TREE (source/js/sub.js) یکی باشد ═══
create or replace function gym.access_nodes() returns text[] language sql immutable as $$
  select array[
    'gym',
    'gym.summary','gym.summary.rings','gym.summary.next','gym.summary.metrics','gym.summary.trends','gym.summary.awards',
    'gym.train','gym.train.program','gym.train.session','gym.train.timer',
    'gym.player','gym.player.form','gym.player.anatomy',
    'gym.progress','gym.progress.meas','gym.progress.strength','gym.progress.muscles'
  ]::text[]
$$;

-- لحظهٔ شروع/پایان اشتراک — مثل boundMoment در sub.js؛ تاریخ/ساعت بدون منطقه = وقت تهران
create or replace function gym.bound(v text, is_end boolean) returns timestamptz
language plpgsql immutable as $$
begin
  v := btrim(coalesce(v, ''));
  if v = '' then return null; end if;
  if v ~ '^\d{4}-\d{2}-\d{2}$' then
    return ((v::date)::timestamp + case when is_end then interval '1 day' - interval '1 millisecond' else interval '0' end) at time zone 'Asia/Tehran';
  end if;
  if v ~ '(Z|[+-]\d{2}:?\d{2})$' then return v::timestamptz; end if;
  return (v::timestamp) at time zone 'Asia/Tehran';
exception when others then return null;
end $$;

-- دسترسی یک کاربر به باشگاه — همان isStaff / isAllowed / featOn در sub.js
create or replace function gym.access_for(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public, gym, pg_temp as $$
declare
  acc record; console boolean; staff boolean;
  s jsonb; st text; t0 timestamptz; t1 timestamptz;
  best jsonb := null; best_end timestamptz; any_exp boolean := false; any_sch boolean := false; any_pd boolean := false;
  feats jsonb; f jsonb; out jsonb := '{}'::jsonb; node text; parts text[]; on_ boolean; i int;
  plans text[] := array['trial','starter','professional','business','enterprise'];
begin
  select a.username, a.name, a.role, a.main, a.active, a.pid into acc from ga_accounts a where a.user_id = p_uid;
  console := exists (select 1 from adminpanel_access p where p.user_id = p_uid and p.active and p.role in ('owner','admin'));
  if acc.username is null and not console then
    return jsonb_build_object('allowed', false, 'reason', 'no_account');
  end if;
  if acc.username is not null and acc.active is not true and not console then
    return jsonb_build_object('allowed', false, 'reason', 'inactive');
  end if;
  staff := console or coalesce(acc.main, false) or acc.role = 'admin';
  if staff then
    foreach node in array gym.access_nodes() loop out := out || jsonb_build_object(node, true); end loop;
    return jsonb_build_object('allowed', true, 'staff', true, 'plan', null, 'status', 'staff', 'feats', out);
  end if;

  for s in
    select e from ga_store g, jsonb_array_elements(case when jsonb_typeof(g.v::jsonb) = 'array' then g.v::jsonb else '[]'::jsonb end) e
    where g.k = 'ga_subscriptions' and lower(btrim(coalesce(e->>'user', ''))) = lower(acc.username)
  loop
    if coalesce(s->>'deleted_at', '') <> '' or s->>'status' = 'deleted' or s->>'status' = 'canceled' then continue; end if;
    if not (coalesce(s->>'plan', '') = any (plans)) then continue; end if;
    if not (coalesce(s->>'status', '') in ('active', 'trial', 'past_due')) then continue; end if;
    t0 := gym.bound(coalesce(nullif(s->>'start_at', ''), s->>'start_date'), false);
    t1 := gym.bound(coalesce(nullif(s->>'end_at', ''), s->>'end_date'), true);
    if t0 is null or t1 is null then continue; end if;
    if t1 <= now() then any_exp := true; continue; end if;
    if t0 > now() then any_sch := true; continue; end if;
    if s->>'status' = 'past_due' then any_pd := true; continue; end if;
    if best is null or t1 > best_end then best := s; best_end := t1; end if;
  end loop;

  if best is null then
    return jsonb_build_object('allowed', false, 'staff', false,
      'reason', case when any_pd then 'past_due' when any_sch then 'scheduled' when any_exp then 'expired' else 'no_subscription' end);
  end if;

  select g.v::jsonb into feats from ga_store g where g.k = 'ga_plan_features';
  f := coalesce(feats -> (best->>'plan'), feats -> 'professional', '{}'::jsonb);
  foreach node in array gym.access_nodes() loop
    parts := string_to_array(node, '.'); on_ := true;
    for i in 1 .. array_length(parts, 1) loop
      if (f -> array_to_string(parts[1:i], '.')) = 'false'::jsonb then on_ := false; end if;
    end loop;
    out := out || jsonb_build_object(node, on_);
  end loop;
  return jsonb_build_object('allowed', true, 'staff', false, 'plan', best->>'plan', 'status', best->>'status',
    'end', coalesce(nullif(best->>'end_at', ''), best->>'end_date'), 'feats', out);
end $$;

-- برنامه به‌صورت JSON (همان شکل PLANS در اپ)
create or replace function gym.program_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = gym, pg_temp as $$
  select jsonb_build_object('id', p.id, 'code', p.code, 'name', p.name, 'lvl', p.level, 'audience', p.audience,
    'weeks', p.weeks, 'bar', p.bar_kg, 'guard', p.youth_guard, 'template', p.is_template,
    'days', coalesce((select jsonb_object_agg(i.weekday::text, jsonb_build_object('t', i.title, 'ex', i.exercise, 'sets', i.sets,
                'reps', i.reps, 'kg', i.load_kg, 'rpe', i.rpe, 'tempo', i.tempo, 'rest', i.rest_s))
              from gym.program_items i where i.program_id = p.id and i.ord = 0), '{}'::jsonb))
  from gym.programs p where p.id = p_id
$$;

create or replace function gym.workout_json(w gym.workouts) returns jsonb
language sql stable security definer set search_path = gym, pg_temp as $$
  select jsonb_build_object('id', w.id, 'date', to_char(w.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'day', w.weekday, 'ex', w.exercise, 'dur', w.duration_s, 'vol', w.volume_kg, 'e1rm', w.e1rm_kg, 'nsets', w.n_sets,
    'pid', w.program_id,
    'sets', coalesce((select jsonb_agg(jsonb_build_object('kg', s.kg, 'reps', s.reps, 'done', s.done) order by s.idx)
                      from gym.workout_sets s where s.workout_id = w.id), '[]'::jsonb))
$$;

create or replace function gym.meas_json(m gym.measurements) returns jsonb
language sql stable security definer set search_path = gym, pg_temp as $$
  select jsonb_strip_nulls(jsonb_build_object('id', m.id, 'date', to_char(m.measured_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'height', m.height, 'weight', m.weight, 'neck', m.neck, 'biceps', m.biceps, 'forearm', m.forearm,
    'chest', m.chest, 'waist', m.waist, 'hip', m.hip, 'thigh', m.thigh, 'calf', m.calf, 'extra', m.extra))
$$;

-- دادهٔ باشگاهِ یک عضو (برای خودش یا برای مربی)
create or replace function gym.member_bundle(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = gym, public, pg_temp as $$
declare asg record;
begin
  select a.program_id, a.start_date into asg from gym.assignments a where a.member_id = p_uid and a.active limit 1;
  return jsonb_build_object(
    'assigned', case when asg.program_id is null then null else gym.program_json(asg.program_id) || jsonb_build_object('start', asg.start_date) end,
    'settings', coalesce((select jsonb_build_object('character', ms.character, 'sound', ms.sound, 'vib', ms.vibrate)
                          from gym.member_settings ms where ms.member_id = p_uid), '{}'::jsonb),
    'workouts', coalesce((select jsonb_agg(gym.workout_json(w) order by w.started_at)
                          from (select * from gym.workouts w0 where w0.member_id = p_uid and w0.deleted_at is null
                                order by w0.started_at desc limit 500) w), '[]'::jsonb),
    'meas', coalesce((select jsonb_agg(gym.meas_json(m) order by m.measured_at)
                      from (select * from gym.measurements m0 where m0.member_id = p_uid and m0.deleted_at is null
                            order by m0.measured_at desc limit 300) m), '[]'::jsonb));
end $$;

-- ═══ تنها درگاه باشگاه ═══
create or replace function public.gym_api(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = gym, public, pg_temp as $$
declare
  uid uuid := auth.uid();
  acc jsonb; feats jsonb; staff boolean;
  me record; pl jsonb; r jsonb; v jsonb; x jsonb; i int;
  wid text; ex text; t timestamptz; vol numeric := 0; best numeric := 0; n int := 0; kg numeric; reps int; done boolean;
  target uuid; prog uuid;
  mf text[] := array['height','weight','neck','biceps','forearm','chest','waist','hip','thigh','calf'];
begin
  if uid is null then return jsonb_build_object('ok', false, 'err', 'auth'); end if;
  p_payload := coalesce(p_payload, '{}'::jsonb);
  acc := gym.access_for(uid);
  feats := coalesce(acc->'feats', '{}'::jsonb);
  staff := coalesce((acc->>'staff')::boolean, false);
  select a.username, a.name, a.role, a.pid into me from ga_accounts a where a.user_id = uid;

  if p_action = 'bootstrap' then
    if me.pid is not null then
      select g.v::jsonb -> (me.pid::text) into pl from ga_store g where g.k = 'ga_players';
    end if;
    r := jsonb_build_object('ok', true, 'server_time', now(), 'access', acc,
      'profile', jsonb_build_object('username', coalesce(me.username, 'admin'), 'name', coalesce(pl->>'name', me.name, me.username),
        'family', coalesce(pl->>'family', ''), 'role', coalesce(me.role, 'admin'), 'pid', me.pid,
        'gender', coalesce(pl->>'gender', ''), 'birth', coalesce(pl->>'birth', ''), 'hcp', pl->'hcp', 'photo', coalesce(pl->>'photo', '')));
    if not coalesce((acc->>'allowed')::boolean, false) or not coalesce((feats->>'gym')::boolean, false) then return r; end if;
    return r || gym.member_bundle(uid) || jsonb_build_object(
      'exercises', coalesce((select jsonb_object_agg(e.code, jsonb_build_object('name', e.name_fa, 'en', e.name_en, 'eq', e.equipment,
                     'mus', e.muscles, 'stab', e.stabilizers, 'cues', e.cues, 'golf', e.golf, 'model', e.model))
                   from gym.exercises e where e.active), '{}'::jsonb),
      'templates', coalesce((select jsonb_object_agg(p.audience, gym.program_json(p.id))
                   from gym.programs p where p.is_template and p.active and p.audience is not null), '{}'::jsonb));
  end if;

  -- همهٔ اکشن‌های دیگر: یوزر مجاز + گروه «باشگاه پات کلاب» روشن
  if not coalesce((acc->>'allowed')::boolean, false) then return jsonb_build_object('ok', false, 'err', 'denied', 'access', acc); end if;
  if not coalesce((feats->>'gym')::boolean, false) then return jsonb_build_object('ok', false, 'err', 'feature_off', 'feature', 'gym'); end if;

  if p_action = 'workout_save' then
    if not coalesce((feats->>'gym.train.session')::boolean, false) then return jsonb_build_object('ok', false, 'err', 'feature_off', 'feature', 'gym.train.session'); end if;
    wid := p_payload->>'id'; ex := coalesce(p_payload->>'ex', 'bench');
    if wid is null or wid !~ '^[A-Za-z0-9_-]{4,64}$' then return jsonb_build_object('ok', false, 'err', 'bad id'); end if;
    if not exists (select 1 from gym.exercises e where e.code = ex) then return jsonb_build_object('ok', false, 'err', 'unknown exercise'); end if;
    begin t := (p_payload->>'date')::timestamptz; exception when others then t := null; end;
    if t is null or t > now() + interval '1 day' or t < now() - interval '3 years' then return jsonb_build_object('ok', false, 'err', 'bad date'); end if;
    if jsonb_typeof(p_payload->'sets') <> 'array' or jsonb_array_length(p_payload->'sets') > 50 then return jsonb_build_object('ok', false, 'err', 'bad sets'); end if;
    if exists (select 1 from gym.workouts w where w.id = wid and w.member_id <> uid) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
    for x in select * from jsonb_array_elements(p_payload->'sets') loop
      kg := least(greatest(coalesce((x->>'kg')::numeric, 0), 0), 500);
      reps := least(greatest(coalesce((x->>'reps')::numeric, 0), 0), 100)::int;
      if coalesce((x->>'done')::boolean, false) and kg > 0 and reps > 0 then
        n := n + 1; vol := vol + kg * reps; best := greatest(best, kg * (1 + least(reps, 12) / 30.0));
      end if;
    end loop;
    insert into gym.workouts as w (id, member_id, program_id, weekday, exercise, started_at, duration_s, volume_kg, e1rm_kg, n_sets, note)
    values (wid, uid, nullif(p_payload->>'pid', '')::uuid, nullif(p_payload->>'day', '')::smallint, ex, t,
            least(greatest(coalesce((p_payload->>'dur')::numeric, 0), 0), 86400)::int, round(vol, 2), round(best, 2), n, left(p_payload->>'note', 500))
    on conflict (id) do update set weekday = excluded.weekday, exercise = excluded.exercise, started_at = excluded.started_at,
      duration_s = excluded.duration_s, volume_kg = excluded.volume_kg, e1rm_kg = excluded.e1rm_kg, n_sets = excluded.n_sets,
      note = excluded.note, updated_at = now(), deleted_at = null
    where w.member_id = uid;
    delete from gym.workout_sets s where s.workout_id = wid;
    i := 0;
    for x in select * from jsonb_array_elements(p_payload->'sets') loop
      insert into gym.workout_sets (workout_id, idx, kg, reps, done)
      values (wid, i, least(greatest(coalesce((x->>'kg')::numeric, 0), 0), 500),
              least(greatest(coalesce((x->>'reps')::numeric, 0), 0), 100)::int, coalesce((x->>'done')::boolean, false));
      i := i + 1;
    end loop;
    insert into gym.audit (actor, action, target, detail) values (uid, 'workout_save', wid, jsonb_build_object('n', n, 'vol', vol));
    return jsonb_build_object('ok', true, 'workout', (select gym.workout_json(w) from gym.workouts w where w.id = wid));
  end if;

  if p_action = 'workout_delete' then
    update gym.workouts set deleted_at = now(), updated_at = now() where id = p_payload->>'id' and member_id = uid and deleted_at is null;
    insert into gym.audit (actor, action, target) values (uid, 'workout_delete', p_payload->>'id');
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'meas_save' then
    if not coalesce((feats->>'gym.progress.meas')::boolean, false) then return jsonb_build_object('ok', false, 'err', 'feature_off', 'feature', 'gym.progress.meas'); end if;
    wid := p_payload->>'id';
    if wid is null or wid !~ '^[A-Za-z0-9_-]{4,64}$' then return jsonb_build_object('ok', false, 'err', 'bad id'); end if;
    begin t := (p_payload->>'date')::timestamptz; exception when others then t := null; end;
    if t is null or t > now() + interval '1 day' then return jsonb_build_object('ok', false, 'err', 'bad date'); end if;
    if exists (select 1 from gym.measurements m where m.id = wid and m.member_id <> uid) then return jsonb_build_object('ok', false, 'err', 'forbidden'); end if;
    begin
      insert into gym.measurements as m (id, member_id, measured_at, height, weight, neck, biceps, forearm, chest, waist, hip, thigh, calf, extra)
      values (wid, uid, t, (p_payload->>'height')::numeric, (p_payload->>'weight')::numeric, (p_payload->>'neck')::numeric,
              (p_payload->>'biceps')::numeric, (p_payload->>'forearm')::numeric, (p_payload->>'chest')::numeric,
              (p_payload->>'waist')::numeric, (p_payload->>'hip')::numeric, (p_payload->>'thigh')::numeric, (p_payload->>'calf')::numeric,
              gym.meas_extra(p_payload->'extra'))
      on conflict (id) do update set measured_at = excluded.measured_at, height = excluded.height, weight = excluded.weight,
        neck = excluded.neck, biceps = excluded.biceps, forearm = excluded.forearm, chest = excluded.chest, waist = excluded.waist,
        hip = excluded.hip, thigh = excluded.thigh, calf = excluded.calf, extra = excluded.extra, updated_at = now(), deleted_at = null
      where m.member_id = uid;
    exception when check_violation or invalid_text_representation or numeric_value_out_of_range then
      return jsonb_build_object('ok', false, 'err', 'out of range');
    end;
    insert into gym.audit (actor, action, target) values (uid, 'meas_save', wid);
    return jsonb_build_object('ok', true, 'meas', (select gym.meas_json(m) from gym.measurements m where m.id = wid));
  end if;

  if p_action = 'meas_delete' then
    update gym.measurements set deleted_at = now(), updated_at = now() where id = p_payload->>'id' and member_id = uid and deleted_at is null;
    insert into gym.audit (actor, action, target) values (uid, 'meas_delete', p_payload->>'id');
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'settings_save' then
    insert into gym.member_settings as ms (member_id, character, sound, vibrate)
    values (uid, case when p_payload->>'character' in ('m','f','g','t') then p_payload->>'character' end,
            coalesce((p_payload->>'sound')::boolean, true), coalesce((p_payload->>'vib')::boolean, true))
    on conflict (member_id) do update set
      character = case when p_payload ? 'character' then excluded.character else ms.character end,
      sound = case when p_payload ? 'sound' then excluded.sound else ms.sound end,
      vibrate = case when p_payload ? 'vib' then excluded.vibrate else ms.vibrate end,
      updated_at = now();
    return jsonb_build_object('ok', true);
  end if;

  -- ── مربی / مدیر ──
  if p_action in ('admin_members', 'admin_member', 'assign', 'unassign', 'programs') then
    if not staff then return jsonb_build_object('ok', false, 'err', 'admin only'); end if;
    if p_action = 'programs' then
      return jsonb_build_object('ok', true, 'programs', coalesce((select jsonb_agg(gym.program_json(p.id) order by p.is_template desc, p.name)
        from gym.programs p where p.active), '[]'::jsonb));
    end if;
    if p_action = 'admin_members' then
      return jsonb_build_object('ok', true, 'members', coalesce((select jsonb_agg(jsonb_build_object(
          'username', a.username, 'name', a.name, 'role', a.role, 'active', a.active, 'pid', a.pid,
          'access', gym.access_for(a.user_id),
          'program', (select p.name from gym.assignments s join gym.programs p on p.id = s.program_id where s.member_id = a.user_id and s.active),
          'workouts', (select count(*) from gym.workouts w where w.member_id = a.user_id and w.deleted_at is null),
          'last_workout', (select max(w.started_at) from gym.workouts w where w.member_id = a.user_id and w.deleted_at is null),
          'last_meas', (select max(m.measured_at) from gym.measurements m where m.member_id = a.user_id and m.deleted_at is null)
        ) order by a.legacy_id) from ga_accounts a where a.user_id is not null), '[]'::jsonb));
    end if;
    select a.user_id into target from ga_accounts a where lower(a.username) = lower(coalesce(p_payload->>'username', ''));
    if target is null then return jsonb_build_object('ok', false, 'err', 'unknown user'); end if;
    if p_action = 'admin_member' then
      return jsonb_build_object('ok', true, 'access', gym.access_for(target)) || gym.member_bundle(target);
    end if;
    if p_action = 'unassign' then
      update gym.assignments set active = false, updated_at = now() where member_id = target and active;
      insert into gym.audit (actor, action, target) values (uid, 'unassign', p_payload->>'username');
      return jsonb_build_object('ok', true);
    end if;
    select p.id into prog from gym.programs p where p.code = p_payload->>'program' and p.active;
    if prog is null then return jsonb_build_object('ok', false, 'err', 'unknown program'); end if;
    update gym.assignments set active = false, updated_at = now() where member_id = target and active;
    insert into gym.assignments (member_id, program_id, start_date, note, assigned_by)
    values (target, prog, coalesce(nullif(p_payload->>'start', '')::date, (now() at time zone 'Asia/Tehran')::date), left(p_payload->>'note', 500), uid);
    insert into gym.audit (actor, action, target, detail) values (uid, 'assign', p_payload->>'username', jsonb_build_object('program', p_payload->>'program'));
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'err', 'unknown action');
end $$;

revoke all on function public.gym_api(text, jsonb) from public, anon;
grant execute on function public.gym_api(text, jsonb) to authenticated, service_role;
do $$
declare f text;
begin
  foreach f in array array['gym.access_nodes()','gym.bound(text,boolean)','gym.access_for(uuid)','gym.program_json(uuid)',
                           'gym.workout_json(gym.workouts)','gym.meas_json(gym.measurements)','gym.member_bundle(uuid)'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
  end loop;
end $$;

-- ═══ دادهٔ پایه: حرکت ساخته‌شده + سه قالب برنامه (همان PLANS نسخهٔ ۱ اپ) ═══
insert into gym.exercises (code, name_fa, name_en, equipment, muscles, stabilizers, cues, golf, model, sort)
values ('bench', 'پرس سینه با هالتر', 'Barbell Bench Press', 'هالتر · نیمکت تخت',
  '[["سینه‌ای بزرگ","chest",1],["دلتوئید قدامی","delt",0.5],["سه‌سر بازو","tri",0.5]]'::jsonb,
  'کتف، مرکز بدن، پاها',
  '["پنج نقطهٔ تماس: سر، کتف‌ها و باسن روی نیمکت؛ دو پا محکم روی زمین","کتف‌ها جمع و پایین، قفسهٔ سینه باز","آرنج‌ها حدود ۴۵ تا ۷۰ درجه نسبت به تنه","میله تا خط نوک سینه و برگشت در مسیر J به بالای شانه‌ها","مچ صاف بالای آرنج؛ دم هنگام پایین آمدن، بازدم هنگام فشار"]'::jsonb,
  'قدرت فشاری بالاتنه و ثبات کتف، انتقال نیرو در داون‌سوئینگ و کنترل چوب در لحظهٔ ضربه را بهتر می‌کند. روز «سرعت میله» توان انفجاری را برای سرعت سر چوب می‌سازد.',
  'play/bench-press.html', 1)
on conflict (code) do nothing;

insert into gym.programs (code, name, level, audience, weeks, bar_kg, youth_guard, is_template) values
  ('tpl_m', 'قدرت و توان گلف', 'بزرگسال · متوسط', 'm', 8, 20, false, true),
  ('tpl_f', 'قدرت و فرم گلف', 'بزرگسال · متوسط', 'f', 8, 15, false, true),
  ('tpl_g', 'پایهٔ قدرت نوجوان', 'نوجوان · مبتدی', 'g', 8, 10, true, true),
  ('tpl_t', 'پایهٔ قدرت نوجوان', 'نوجوان · مبتدی', 't', 8, 10, true, true)
on conflict (code) do nothing;

insert into gym.program_items (program_id, weekday, ord, title, exercise, sets, reps, load_kg, rpe, tempo, rest_s)
select p.id, d.weekday, 0, d.title, 'bench', d.sets, d.reps, d.kg, d.rpe, d.tempo, d.rest
from gym.programs p join (values
  ('tpl_m', 0, 'قدرت', 4, 6, 70.0, '۸', '۲-۱-۱', 120), ('tpl_m', 2, 'حجم', 3, 10, 57.5, '۷', '۳-۰-۱', 90), ('tpl_m', 5, 'سرعت میله', 5, 3, 50.0, '۶', 'انفجاری', 90),
  ('tpl_f', 0, 'قدرت', 3, 8, 35.0, '۷', '۲-۱-۱', 90), ('tpl_f', 2, 'حجم', 3, 12, 27.5, '۷', '۳-۰-۱', 75), ('tpl_f', 5, 'سرعت میله', 5, 3, 25.0, '۶', 'انفجاری', 75),
  ('tpl_g', 0, 'تکنیک و قدرت', 2, 12, 15.0, '۵–۶', '۲-۱-۲', 60), ('tpl_g', 2, 'کنترل', 2, 10, 15.0, '۵', '۲-۱-۲', 60), ('tpl_g', 5, 'تکنیک', 3, 6, 10.0, '۴–۵', '۲-۱-۲', 60),
  ('tpl_t', 0, 'تکنیک و قدرت', 2, 12, 15.0, '۵–۶', '۲-۱-۲', 60), ('tpl_t', 2, 'کنترل', 2, 10, 15.0, '۵', '۲-۱-۲', 60), ('tpl_t', 5, 'تکنیک', 3, 6, 10.0, '۴–۵', '۲-۱-۲', 60)
) as d(code, weekday, title, sets, reps, kg, rpe, tempo, rest) on d.code = p.code
on conflict do nothing;

commit;

-- ── v1.9 (2026-10-09): کتابخانهٔ کامل — ۷۹ حرکت با مدل سه‌بعدی (۵۵ حرکت جدید: پا، سرشانه، پشت، بازو، شکم و پهلو، توان چرخشی گلف؛ منبع: gym-app/tools/exercises.py + exercises2.py)
-- full library: 79 exercises with a 3D model (generated by gym-app/tools/exercises.py)
insert into gym.exercises (code, name_fa, name_en, equipment, muscles, stabilizers, cues, golf, model, sort) values
  ('bench', 'پرس سینه هالتر', 'Barbell Bench Press', 'هالتر · نیمکت تخت', '[["سینه‌ای بزرگ", "chest", 1], ["دلتوئید قدامی", "delt", 0.5], ["سه‌سر بازو", "tri", 0.5]]'::jsonb, 'کتف، مرکز بدن، پاها', '["پنج نقطهٔ تماس: سر، کتف‌ها و باسن روی نیمکت؛ دو پا محکم روی زمین", "کتف‌ها جمع و پایین، قفسهٔ سینه باز", "آرنج‌ها حدود ۴۵ تا ۷۰ درجه نسبت به تنه", "میله تا خط نوک سینه و برگشت در مسیر J به بالای شانه‌ها", "مچ صاف بالای آرنج؛ دم هنگام پایین آمدن، بازدم هنگام فشار"]'::jsonb, 'قدرت فشاری بالاتنه و ثبات کتف، انتقال نیرو در داون‌سوئینگ و کنترل چوب در لحظهٔ ضربه را بهتر می‌کند. روز «سرعت میله» توان انفجاری را برای سرعت سر چوب می‌سازد.', 'play/bench-press.html', 1),
  ('bench_incline', 'پرس بالا سینه هالتر', 'Incline Barbell Bench Press', 'هالتر · نیمکت شیب‌دار ۳۰ درجه', '[["سینه‌ای بزرگ — بخش بالایی (ترقوه‌ای)", "chest", 1], ["دلتوئید قدامی", "delt", 0.7], ["سه‌سر بازو", "tri", 0.45]]'::jsonb, 'کتف، مرکز بدن، پاها', '["پشتی نیمکت ۳۰ درجه؛ باسن روی صندلی و کتف‌ها روی پشتی", "کتف‌ها جمع، قفسهٔ سینه رو به بالا", "میله تا بالای سینه، زیر ترقوه", "فشار عمودی به بالای شانه‌ها؛ آرنج‌ها کمی جلوتر از میله", "پاها محکم روی زمین؛ کمر از نیمکت جدا نشود"]'::jsonb, 'قدرت فشاری بالاتنه و ثبات کتف، انتقال نیرو در داون‌سوئینگ و کنترل چوب در لحظهٔ ضربه را بهتر می‌کند.', 'play/bench-press.html', 2),
  ('bench_decline', 'پرس زیر سینه هالتر', 'Decline Barbell Bench Press', 'هالتر · نیمکت منفی ۱۸ درجه', '[["سینه‌ای بزرگ — بخش پایینی (جناغی)", "chest", 1], ["سه‌سر بازو", "tri", 0.5], ["دلتوئید قدامی", "delt", 0.3]]'::jsonb, 'کتف، مرکز بدن، پاها', '["پاها زیر غلتک‌ها قفل؛ سر پایین‌تر از لگن", "کتف‌ها جمع و پایین", "میله تا پایین سینه (زیر خط نوک سینه)", "فشار عمودی و کنترل‌شده؛ میله بالای شانه‌ها قفل شود", "حتماً با کمک‌دهنده؛ برخاستن آرام بعد از ست"]'::jsonb, 'قدرت فشاری بالاتنه و ثبات کتف، انتقال نیرو در داون‌سوئینگ و کنترل چوب در لحظهٔ ضربه را بهتر می‌کند.', 'play/bench-press.html', 3),
  ('bench_close', 'پرس سینه دست جمع هالتر', 'Close-Grip Bench Press', 'هالتر · نیمکت تخت · دست به عرض شانه', '[["سه‌سر بازو", "tri", 1], ["سینه‌ای بزرگ", "chest", 0.7], ["دلتوئید قدامی", "delt", 0.5]]'::jsonb, 'کتف، مرکز بدن، پاها', '["دست‌ها به عرض شانه (نه چسبیده)", "آرنج‌ها نزدیک بدن، ۱۵ تا ۴۵ درجه", "میله تا پایین جناغ", "مچ‌ها صاف و درست بالای آرنج", "قفل کامل آرنج در بالا؛ تمرکز روی پشت بازو"]'::jsonb, 'پشت بازوی قوی، صاف شدن دست راست (برای راست‌دست‌ها) در لحظهٔ ضربه و انتقال نیرو به چوب را محکم‌تر می‌کند.', 'play/bench-press.html', 4),
  ('bench_wide', 'پرس سینه دست باز هالتر', 'Wide-Grip Bench Press', 'هالتر · نیمکت تخت · دست باز', '[["سینه‌ای بزرگ", "chest", 1], ["دلتوئید قدامی", "delt", 0.55], ["سه‌سر بازو", "tri", 0.35]]'::jsonb, 'کتف، مرکز بدن، پاها', '["دست‌ها حدود ۱٫۵ تا ۲ برابر عرض شانه", "کتف‌ها کاملاً جمع تا شانه محافظت شود", "دامنهٔ کوتاه‌تر؛ میله تا وسط سینه", "آرنج‌ها ۶۰ تا ۸۵ درجه؛ فشار به سمت بالا و کمی عقب", "وزنهٔ سبک‌تر از پرس معمولی انتخاب کنید"]'::jsonb, 'قدرت فشاری بالاتنه و ثبات کتف، انتقال نیرو در داون‌سوئینگ و کنترل چوب در لحظهٔ ضربه را بهتر می‌کند.', 'play/bench-press.html', 5),
  ('db_bench', 'پرس سینه دمبل', 'Dumbbell Bench Press', 'دمبل · نیمکت تخت', '[["سینه‌ای بزرگ", "chest", 1], ["دلتوئید قدامی", "delt", 0.5], ["سه‌سر بازو", "tri", 0.4]]'::jsonb, 'روتاتور کاف، کتف، مرکز بدن، پاها', '["دمبل‌ها کنار سینه؛ کف دست رو به پا", "کتف‌ها جمع و پایین", "پایین آوردن تا هم‌سطح سینه با کشش کامل", "فشار به بالا و کمی به داخل؛ دمبل‌ها بالای شانه به هم نزدیک شوند", "دو دست هم‌زمان و یکسان"]'::jsonb, 'هر دست مستقل کار می‌کند؛ عدم تقارن چپ و راست کم می‌شود و ثبات شانه برای چرخش کنترل‌شدهٔ سوئینگ بالا می‌رود.', 'play/bench-press.html', 6),
  ('db_incline', 'پرس بالا سینه دمبل', 'Incline Dumbbell Press', 'دمبل · نیمکت شیب‌دار ۳۰ درجه', '[["سینه‌ای بزرگ — بخش بالایی (ترقوه‌ای)", "chest", 1], ["دلتوئید قدامی", "delt", 0.7], ["سه‌سر بازو", "tri", 0.4]]'::jsonb, 'روتاتور کاف، کتف، مرکز بدن، پاها', '["پشتی ۳۰ درجه؛ دمبل‌ها کنار بالای سینه", "کتف‌ها روی پشتی جمع", "آرنج‌ها حدود ۴۵ تا ۷۵ درجه", "فشار عمودی به بالای شانه‌ها", "کنترل در پایین؛ پرتاب نکنید"]'::jsonb, 'هر دست مستقل کار می‌کند؛ عدم تقارن چپ و راست کم می‌شود و ثبات شانه برای چرخش کنترل‌شدهٔ سوئینگ بالا می‌رود.', 'play/bench-press.html', 7),
  ('db_decline', 'پرس زیر سینه دمبل', 'Decline Dumbbell Press', 'دمبل · نیمکت منفی ۱۸ درجه', '[["سینه‌ای بزرگ — بخش پایینی (جناغی)", "chest", 1], ["سه‌سر بازو", "tri", 0.45], ["دلتوئید قدامی", "delt", 0.3]]'::jsonb, 'روتاتور کاف، کتف، مرکز بدن، پاها', '["پاها زیر غلتک‌ها قفل", "دمبل‌ها کنار پایین سینه", "فشار عمودی و هم‌زمان", "در پایان ست دمبل‌ها را روی سینه بیاورید و آرام بنشینید", "گردن رها، نگاه به سقف"]'::jsonb, 'هر دست مستقل کار می‌کند؛ عدم تقارن چپ و راست کم می‌شود و ثبات شانه برای چرخش کنترل‌شدهٔ سوئینگ بالا می‌رود.', 'play/bench-press.html', 8),
  ('db_neutral', 'پرس سینه دمبل دست خنثی', 'Neutral-Grip Dumbbell Press', 'دمبل · نیمکت تخت · کف دست‌ها رو به هم', '[["سینه‌ای بزرگ", "chest", 0.85], ["سه‌سر بازو", "tri", 0.7], ["دلتوئید قدامی", "delt", 0.55]]'::jsonb, 'روتاتور کاف، کتف، مرکز بدن، پاها', '["کف دست‌ها رو به هم در تمام حرکت", "آرنج‌ها نزدیک بدن (۱۰ تا ۴۰ درجه)", "دمبل‌ها تا کنار سینه", "فشار مستقیم به بالا", "دوستدار شانه؛ مناسب وقتی شانه حساس است"]'::jsonb, 'هر دست مستقل کار می‌کند؛ عدم تقارن چپ و راست کم می‌شود و ثبات شانه برای چرخش کنترل‌شدهٔ سوئینگ بالا می‌رود.', 'play/bench-press.html', 9),
  ('db_incline_neutral', 'پرس بالا سینه دمبل دست خنثی', 'Incline Neutral-Grip Dumbbell Press', 'دمبل · نیمکت شیب‌دار ۳۰ درجه · کف دست‌ها رو به هم', '[["سینه‌ای بزرگ — بخش بالایی (ترقوه‌ای)", "chest", 0.85], ["دلتوئید قدامی", "delt", 0.7], ["سه‌سر بازو", "tri", 0.6]]'::jsonb, 'روتاتور کاف، کتف، مرکز بدن، پاها', '["پشتی ۳۰ درجه؛ کف دست‌ها رو به هم", "آرنج‌ها نزدیک بدن", "دمبل‌ها تا کنار بالای سینه", "فشار عمودی به بالای شانه‌ها", "کتف‌ها روی پشتی ثابت"]'::jsonb, 'هر دست مستقل کار می‌کند؛ عدم تقارن چپ و راست کم می‌شود و ثبات شانه برای چرخش کنترل‌شدهٔ سوئینگ بالا می‌رود.', 'play/bench-press.html', 10),
  ('db_fly', 'فلای سینه دمبل', 'Dumbbell Chest Fly', 'دمبل · نیمکت تخت', '[["سینه‌ای بزرگ", "chest", 1], ["دلتوئید قدامی", "delt", 0.4]]'::jsonb, 'روتاتور کاف، کتف، مرکز بدن، پاها', '["آرنج‌ها کمی خم و ثابت (مثل بغل کردن یک درخت)", "دست‌ها در یک قوس باز شوند تا کشش سینه", "پایین‌تر از سطح شانه نروید", "برگرداندن با انقباض سینه، نه با خم و راست کردن آرنج", "وزنه سبک‌تر از پرس؛ کنترل کامل"]'::jsonb, 'دامنهٔ حرکتی و کشش کنترل‌شدهٔ قفسهٔ سینه را زیاد می‌کند؛ برای چرخش آزاد شانه در بک‌سوئینگ و جلوگیری از جمع شدن شانه‌ها مفید است.', 'play/bench-press.html', 11),
  ('db_fly_incline', 'فلای بالا سینه دمبل', 'Incline Dumbbell Fly', 'دمبل · نیمکت شیب‌دار ۳۰ درجه', '[["سینه‌ای بزرگ — بخش بالایی (ترقوه‌ای)", "chest", 1], ["دلتوئید قدامی", "delt", 0.55]]'::jsonb, 'روتاتور کاف، کتف، مرکز بدن، پاها', '["پشتی ۳۰ درجه", "آرنج‌ها کمی خم و ثابت", "قوس باز شدن در سطح بالای سینه", "جمع کردن دست‌ها بالای شانه‌ها", "کشش کنترل‌شده؛ بدون ضربه در پایین"]'::jsonb, 'دامنهٔ حرکتی و کشش کنترل‌شدهٔ قفسهٔ سینه را زیاد می‌کند؛ برای چرخش آزاد شانه در بک‌سوئینگ و جلوگیری از جمع شدن شانه‌ها مفید است.', 'play/bench-press.html', 12),
  ('db_fly_decline', 'فلای زیر سینه دمبل', 'Decline Dumbbell Fly', 'دمبل · نیمکت منفی ۱۸ درجه', '[["سینه‌ای بزرگ — بخش پایینی (جناغی)", "chest", 1], ["دلتوئید قدامی", "delt", 0.3]]'::jsonb, 'روتاتور کاف، کتف، مرکز بدن، پاها', '["پاها زیر غلتک‌ها قفل", "آرنج‌ها کمی خم و ثابت", "باز کردن تا سطح بدن", "جمع کردن با انقباض پایین سینه", "آهسته و کنترل‌شده"]'::jsonb, 'دامنهٔ حرکتی و کشش کنترل‌شدهٔ قفسهٔ سینه را زیاد می‌کند؛ برای چرخش آزاد شانه در بک‌سوئینگ و جلوگیری از جمع شدن شانه‌ها مفید است.', 'play/bench-press.html', 13),
  ('smith_bench', 'پرس سینه اسمیت', 'Smith Machine Bench Press', 'دستگاه اسمیت · نیمکت تخت', '[["سینه‌ای بزرگ", "chest", 1], ["دلتوئید قدامی", "delt", 0.45], ["سه‌سر بازو", "tri", 0.5]]'::jsonb, 'کتف و مرکز بدن (مسیر میله ثابت است)', '["نیمکت را طوری بگذارید که میله روی خط نوک سینه پایین بیاید", "قلاب‌ها را با چرخش مچ آزاد کنید", "مسیر میله عمودی است؛ کتف‌ها جمع", "ضامن‌های ایمنی را کمی بالاتر از سینه تنظیم کنید", "در پایان، میله را با چرخش مچ روی قلاب قفل کنید"]'::jsonb, 'مسیر هدایت‌شده اجازه می‌دهد با خیال راحت روی بار و حجم تمرکز کنید؛ گزینهٔ امن برای تمرین بدون کمک‌دهنده.', 'play/bench-press.html', 14),
  ('smith_incline', 'پرس بالا سینه اسمیت', 'Smith Machine Incline Press', 'دستگاه اسمیت · نیمکت شیب‌دار ۳۰ درجه', '[["سینه‌ای بزرگ — بخش بالایی (ترقوه‌ای)", "chest", 1], ["دلتوئید قدامی", "delt", 0.65], ["سه‌سر بازو", "tri", 0.45]]'::jsonb, 'کتف و مرکز بدن (مسیر میله ثابت است)', '["نیمکت ۳۰ درجه زیر میله؛ میله روی بالای سینه فرود بیاید", "کتف‌ها روی پشتی جمع", "مسیر عمودی و کنترل‌شده", "ضامن ایمنی بالای سینه", "آرنج‌ها ۴۵ تا ۷۰ درجه"]'::jsonb, 'مسیر هدایت‌شده اجازه می‌دهد با خیال راحت روی بار و حجم تمرکز کنید؛ گزینهٔ امن برای تمرین بدون کمک‌دهنده.', 'play/bench-press.html', 15),
  ('smith_decline', 'پرس زیر سینه اسمیت', 'Smith Machine Decline Press', 'دستگاه اسمیت · نیمکت منفی ۱۸ درجه', '[["سینه‌ای بزرگ — بخش پایینی (جناغی)", "chest", 1], ["سه‌سر بازو", "tri", 0.5], ["دلتوئید قدامی", "delt", 0.3]]'::jsonb, 'کتف و مرکز بدن (مسیر میله ثابت است)', '["پاها زیر غلتک‌ها قفل", "میله روی پایین سینه فرود بیاید", "مسیر عمودی؛ کتف‌ها جمع و پایین", "ضامن ایمنی بالای سینه", "بعد از ست آرام بنشینید"]'::jsonb, 'مسیر هدایت‌شده اجازه می‌دهد با خیال راحت روی بار و حجم تمرکز کنید؛ گزینهٔ امن برای تمرین بدون کمک‌دهنده.', 'play/bench-press.html', 16),
  ('machine_press', 'پرس سینه دستگاه', 'Machine Chest Press', 'دستگاه پرس سینه نشسته · وزنه‌خانه', '[["سینه‌ای بزرگ", "chest", 1], ["سه‌سر بازو", "tri", 0.55], ["دلتوئید قدامی", "delt", 0.5]]'::jsonb, 'کتف روی پشتی (مسیر دستگاه هدایت‌شده است)', '["ارتفاع صندلی را طوری تنظیم کنید که دستگیره‌ها هم‌سطح وسط سینه باشند", "کتف‌ها جمع و چسبیده به پشتی؛ سینه باز", "فشار رو به جلو تا تقریباً صاف شدن آرنج، بدون قفل ضربه‌ای", "برگشت آهسته تا کشش سینه؛ وزنه‌ها به هم نخورند", "مچ صاف در امتداد ساعد؛ دم در برگشت، بازدم در فشار"]'::jsonb, 'مسیر ثابت اجازه می‌دهد بدون کمک‌دهنده تا نزدیک ناتوانی کار کنید؛ قدرت فشاری پایه برای انتقال نیرو در سوئینگ را می‌سازد.', 'play/bench-press.html', 17),
  ('machine_fly', 'فلای دستگاه (پک‌دک)', 'Pec Deck Machine Fly', 'دستگاه پک‌دک · وزنه‌خانه', '[["سینه‌ای بزرگ", "chest", 1], ["دلتوئید قدامی", "delt", 0.45]]'::jsonb, 'کتف روی پشتی، مرکز بدن', '["صندلی را طوری تنظیم کنید که دستگیره‌ها کمی پایین‌تر از شانه باشند", "آرنج‌ها کمی خم و ثابت در تمام حرکت", "دست‌ها را در یک قوس جلوی سینه به هم برسانید و یک ثانیه منقبض کنید", "برگشت کنترل‌شده تا هم‌راستای بدن؛ عقب‌تر نروید", "کتف‌ها به پشتی چسبیده؛ شانه‌ها بالا نروند"]'::jsonb, 'دامنهٔ حرکتی و کشش کنترل‌شدهٔ قفسهٔ سینه را زیاد می‌کند؛ برای چرخش آزاد شانه در بک‌سوئینگ و جلوگیری از جمع شدن شانه‌ها مفید است.', 'play/bench-press.html', 18),
  ('cable_cross_high', 'کراس‌اور سیم‌کش از بالا', 'High-to-Low Cable Crossover', 'کراس‌اور سیم‌کش · قرقره بالا', '[["سینه‌ای بزرگ — بخش پایینی (جناغی)", "chest", 1], ["دلتوئید قدامی", "delt", 0.3]]'::jsonb, 'مرکز بدن، پاها (ایستاده با پای جلو و عقب)', '["قرقره‌ها در بالاترین نقطه؛ یک قدم جلو با پاهای جلو و عقب", "تنه کمی به جلو خم، کمر صاف", "دست‌ها در یک قوس رو به پایین و جلو تا جلوی ناف به هم برسند", "آرنج‌ها کمی خم و ثابت؛ حرکت از شانه است", "برگشت آهسته تا کشش سینه، بدون رها کردن وزنه"]'::jsonb, 'ایستاده و بدون تکیه‌گاه است؛ کنترل مرکز بدن و ثبات پاها را مثل حالت آدرس در گلف تمرین می‌دهد.', 'play/bench-press.html', 19),
  ('cable_cross_low', 'کراس‌اور سیم‌کش از پایین', 'Low-to-High Cable Crossover', 'کراس‌اور سیم‌کش · قرقره پایین', '[["سینه‌ای بزرگ — بخش بالایی (ترقوه‌ای)", "chest", 1], ["دلتوئید قدامی", "delt", 0.6]]'::jsonb, 'مرکز بدن، پاها، کتف', '["قرقره‌ها در پایین‌ترین نقطه؛ ایستاده با پاهای جلو و عقب", "کف دست‌ها رو به بالا و جلو", "دست‌ها در یک قوس رو به بالا تا جلوی بالای سینه به هم برسند", "آرنج‌ها کمی خم و ثابت؛ شانه‌ها بالا نروند", "برگشت کنترل‌شده تا کنار ران"]'::jsonb, 'بالای سینه و جلوی شانه را در مسیری شبیه حرکت دست‌ها بعد از ضربه تقویت می‌کند.', 'play/bench-press.html', 20),
  ('cable_fly_single', 'فلای سیم‌کش تک‌دست', 'Single-Arm Cable Fly', 'سیم‌کش · قرقره هم‌سطح سینه · تک‌دست', '[["سینه‌ای بزرگ", "chest", 1], ["دلتوئید قدامی", "delt", 0.45]]'::jsonb, 'عضلات مورب شکم، مرکز بدن (ضد چرخش)', '["قرقره هم‌سطح سینه؛ بغل به دستگاه بایستید", "دست آزاد روی کمر؛ لگن و شانه‌ها رو به جلو", "دست را در یک قوس افقی تا کمی جلوتر از خط وسط بدن بیاورید", "تنه نچرخد؛ مقاومت در برابر چرخش را حس کنید", "هر دو طرف با تعداد یکسان"]'::jsonb, 'کار تک‌دست، پایداری ضد چرخش تنه را می‌سازد و عدم تقارن چپ و راست را که در گلف رایج است کم می‌کند.', 'play/bench-press.html', 21),
  ('pushup', 'شنا سوئدی', 'Push-Up', 'وزن بدن · کف زمین', '[["سینه‌ای بزرگ", "chest", 1], ["سه‌سر بازو", "tri", 0.6], ["دلتوئید قدامی", "delt", 0.5]]'::jsonb, 'مرکز بدن (پلانک)، دندانه‌ای قدامی، باسن', '["دست‌ها کمی بازتر از عرض شانه، انگشتان رو به جلو", "بدن از سر تا پاشنه یک خط صاف؛ باسن نه بالا نه پایین", "آرنج‌ها حدود ۴۵ درجه نسبت به تنه", "پایین تا جایی که سینه نزدیک زمین شود", "فشار به زمین تا صاف شدن کامل دست‌ها؛ در بالا کتف‌ها کمی باز شوند"]'::jsonb, 'ثبات کتف و مرکز بدن را با هم می‌سازد؛ بدون تجهیزات و در هر جای سفر قابل انجام است.', 'play/bench-press.html', 22),
  ('pushup_decline', 'شنا سوئدی شیب منفی', 'Decline Push-Up', 'وزن بدن · پاها روی سکو', '[["سینه‌ای بزرگ — بخش بالایی (ترقوه‌ای)", "chest", 1], ["دلتوئید قدامی", "delt", 0.65], ["سه‌سر بازو", "tri", 0.55]]'::jsonb, 'مرکز بدن (پلانک)، دندانه‌ای قدامی', '["پنجهٔ پاها روی سکو یا نیمکت (حدود ۴۰ سانتی‌متر)", "بدن یک خط صاف؛ کمر گود نشود", "دست‌ها کمی بازتر از شانه", "پایین تا نزدیک زمین با آرنج‌های ۴۵ درجه", "فشار کامل به بالا؛ گردن در امتداد بدن"]'::jsonb, 'بخش بالایی سینه و جلوی شانه را بیشتر درگیر می‌کند؛ نسخهٔ سخت‌تر شنا برای تمرین در خانه و سفر.', 'play/bench-press.html', 23),
  ('dip_chest', 'دیپ پارالل — تمرکز سینه', 'Chest Dip (Parallel Bars)', 'وزن بدن · پارالل', '[["سینه‌ای بزرگ — بخش پایینی (جناغی)", "chest", 1], ["سه‌سر بازو", "tri", 0.75], ["دلتوئید قدامی", "delt", 0.6]]'::jsonb, 'کتف، مرکز بدن', '["دستگیره‌ها کمی بازتر از عرض شانه؛ شروع با دست‌های صاف", "تنه حدود ۲۰ تا ۳۰ درجه به جلو؛ زانوها خم و پاها عقب", "پایین تا جایی که بازو تقریباً موازی زمین شود", "آرنج‌ها کمی باز به طرفین؛ شانه‌ها بالا نروند", "فشار به بالا بدون قفل ضربه‌ای؛ برای وزنهٔ اضافه از کمربند دیپ استفاده کنید"]'::jsonb, 'قدرت فشاری بالاتنه با وزن خود بدن؛ اگر شانه حساس است دامنه را کوتاه‌تر کنید.', 'play/bench-press.html', 24),
  ('squat', 'اسکوات هالتر', 'Barbell Back Squat', 'هالتر · رک اسکوات', '[["چهارسر ران", "quads", 1], ["سرینی بزرگ", "glutes", 0.8], ["نزدیک‌کننده‌های ران", "adductor", 0.5]]'::jsonb, 'مرکز بدن، راست‌کنندهٔ ستون فقرات، ساق', '["میله روی عضلهٔ ذوزنقه، نه روی گردن؛ کتف‌ها جمع", "پاها کمی بازتر از عرض شانه، پنجه کمی رو به بیرون", "باسن به عقب و پایین؛ زانوها هم‌جهت با پنجه", "تا موازی شدن ران با زمین یا پایین‌تر با کمر صاف", "از پاشنه و وسط پا فشار بده؛ دم پایین، بازدم بالا"]'::jsonb, 'پایه‌ای‌ترین حرکت برای قدرت پایین‌تنه؛ نیروی زمین را که سرعت سر چوب از آن شروع می‌شود افزایش می‌دهد.', 'play/bench-press.html', 25),
  ('rdl', 'ددلیفت رومانیایی', 'Romanian Deadlift', 'هالتر', '[["همسترینگ", "hams", 1], ["سرینی بزرگ", "glutes", 0.85], ["راست‌کنندهٔ ستون فقرات", "erector", 0.7]]'::jsonb, 'ساعد، مرکز بدن، زیربغل', '["زانوها کمی خم و ثابت می‌مانند", "لولا از مفصل ران: باسن به عقب، میله نزدیک ران‌ها و ساق", "کمر کاملاً صاف و قفسهٔ سینه باز", "تا کشش کامل همسترینگ پایین برو و با فشار باسن بالا بیا"]'::jsonb, 'لولای ران را قوی می‌کند؛ برای حفظ زاویهٔ خم شدن در ستاپ و انتقال نیرو از باسن در داون‌سوئینگ حیاتی است.', 'play/bench-press.html', 26),
  ('db_lunge', 'لانج دمبل', 'Dumbbell Reverse Lunge', 'دو دمبل', '[["چهارسر ران", "quads", 1], ["سرینی بزرگ", "glutes", 0.85], ["نزدیک‌کننده‌های ران", "adductor", 0.5]]'::jsonb, 'مرکز بدن، ساق، ثبات‌دهنده‌های لگن', '["گام بلند رو به عقب؛ تنه عمود بماند", "زانوی جلو بالای مچ پا و هم‌جهت با پنجه", "زانوی عقب نزدیک زمین، بدون برخورد", "با فشار پاشنهٔ جلو به حالت ایستاده برگرد"]'::jsonb, 'حرکت تک‌پا تعادل و ثبات لگن را می‌سازد و عدم تقارن پای جلو و عقب در سوئینگ را کم می‌کند.', 'play/bench-press.html', 27),
  ('hip_thrust', 'هیپ تراست هالتر', 'Barbell Hip Thrust', 'هالتر · نیمکت', '[["سرینی بزرگ", "glutes", 1], ["همسترینگ", "hams", 0.5], ["چهارسر ران", "quads", 0.4]]'::jsonb, 'مرکز بدن، نزدیک‌کننده‌ها', '["بالای کتف روی لبهٔ نیمکت، میله روی چین ران با پد", "ساق‌ها در بالای حرکت عمود بر زمین", "چانه رو به پایین، دنده‌ها پایین؛ قوس کمر نده", "باسن را کامل منقبض کن و یک لحظه مکث کن"]'::jsonb, 'قوی‌ترین حرکت برای باز شدن انفجاری مفصل ران — همان حرکتی که در ضربه سرعت چوب را می‌سازد.', 'play/bench-press.html', 28),
  ('goblet_squat', 'اسکوات گابلت', 'Goblet Squat', 'یک دمبل', '[["چهارسر ران", "quads", 1], ["سرینی بزرگ", "glutes", 0.75], ["نزدیک‌کننده‌های ران", "adductor", 0.55]]'::jsonb, 'مرکز بدن، بالاتنه', '["دمبل عمودی جلوی سینه، آرنج‌ها رو به پایین", "تنه صاف؛ آرنج‌ها بین زانوها پایین می‌روند", "پاشنه‌ها روی زمین، زانوها رو به بیرون", "از وسط پا فشار بده و کامل بایست"]'::jsonb, 'الگوی اسکوات را با کمر صاف آموزش می‌دهد و تحرک مچ پا و لگن را برای ستاپ پایدار بهتر می‌کند.', 'play/bench-press.html', 29),
  ('leg_press', 'پرس پا', 'Leg Press', 'دستگاه پرس پا', '[["چهارسر ران", "quads", 1], ["سرینی بزرگ", "glutes", 0.7], ["نزدیک‌کننده‌های ران", "adductor", 0.5]]'::jsonb, '— (پشت و لگن روی پد)', '["کمر و باسن کامل روی پشتی", "پاها به عرض شانه وسط صفحه", "تا زاویهٔ حدود ۹۰ درجهٔ زانو پایین بیا", "زانو را در بالا قفل نکن"]'::jsonb, 'حجم کار پا را بدون فشار روی ستون فقرات بالا می‌برد؛ مناسب روزهای پرحجم فصل مسابقه.', 'play/bench-press.html', 30),
  ('leg_extension', 'جلوپا دستگاه', 'Leg Extension', 'دستگاه جلوپا', '[["چهارسر ران", "quads", 1], ["ساق جلویی", "tibialis", 0.15]]'::jsonb, '—', '["محور زانو هم‌راستای محور دستگاه", "پد پایینی روی جلوی مچ پا", "باز کردن کامل و یک لحظه مکث در بالا", "برگشت آهسته و کنترل‌شده"]'::jsonb, 'چهارسر را جداگانه تقویت می‌کند و به ثبات زانوی جلو در لحظهٔ ضربه کمک می‌کند.', 'play/bench-press.html', 31),
  ('leg_curl', 'پشت‌پا دستگاه', 'Seated Leg Curl', 'دستگاه پشت‌پا نشسته', '[["همسترینگ", "hams", 1], ["ساق پا", "calves", 0.35]]'::jsonb, '—', '["محور زانو هم‌راستای محور دستگاه", "پد ران محکم روی ران‌ها", "پاشنه را تا زیر صندلی بکش", "برگشت آهسته تا باز شدن کامل"]'::jsonb, 'همسترینگ قوی از زانو و لگن در چرخش سریع محافظت می‌کند و تعادل جلو و پشت ران را حفظ می‌کند.', 'play/bench-press.html', 32),
  ('calf_raise_machine', 'ساق پا دستگاه', 'Standing Calf Raise Machine', 'دستگاه ساق ایستاده', '[["ساق پا", "calves", 1], ["ساق جلویی", "tibialis", 0.15]]'::jsonb, 'مرکز بدن', '["پنجهٔ پا روی لبهٔ سکو، پاشنه آزاد", "زانوها صاف اما قفل نشده", "تا بالاترین نقطه روی پنجه بالا برو و مکث کن", "پاشنه را کامل پایین بیاور تا کشش ساق"]'::jsonb, 'ساق قوی انتقال وزن از پای عقب به جلو و چرخش پاشنه در فینیش را پایدار می‌کند.', 'play/bench-press.html', 33),
  ('cable_kickback', 'کیک‌بک باسن سیم‌کش', 'Cable Glute Kickback', 'سیم‌کش پایین · مچ‌بند', '[["سرینی بزرگ", "glutes", 1], ["همسترینگ", "hams", 0.45], ["راست‌کنندهٔ ستون فقرات", "erector", 0.3]]'::jsonb, 'مرکز بدن، پای تکیه‌گاه', '["دست‌ها روی ستون؛ تنه کمی جلو", "پا را رو به عقب و بالا بکش؛ لگن نچرخد", "کمر قوس برندارد؛ حرکت فقط از ران", "در انتها باسن را منقبض کن و آهسته برگرد"]'::jsonb, 'باسن را تک‌طرفه فعال می‌کند؛ برای ثبات لگن پای عقب در بک‌سوئینگ مفید است.', 'play/bench-press.html', 34),
  ('bulgarian_split_squat', 'اسپلیت اسکوات بلغاری', 'Bulgarian Split Squat', 'نیمکت · وزن بدن یا دمبل', '[["چهارسر ران", "quads", 1], ["سرینی بزرگ", "glutes", 0.9], ["نزدیک‌کننده‌های ران", "adductor", 0.5]]'::jsonb, 'مرکز بدن، ثبات‌دهنده‌های لگن', '["روی پای عقب روی نیمکت؛ پای جلو یک گام جلوتر", "تنه کمی رو به جلو و صاف", "عمودی پایین برو تا ران جلو موازی زمین", "با فشار پاشنهٔ جلو بالا بیا"]'::jsonb, 'قوی‌ترین حرکت تک‌پا برای تعادل، قدرت و تحرک لگن پای عقب.', 'play/bench-press.html', 35),
  ('glute_bridge', 'پل باسن', 'Glute Bridge', 'تشک · وزن بدن', '[["سرینی بزرگ", "glutes", 1], ["همسترینگ", "hams", 0.55], ["راست‌کنندهٔ ستون فقرات", "erector", 0.3]]'::jsonb, 'مرکز بدن', '["به پشت دراز بکش؛ زانوها خم، پاها به عرض لگن", "باسن را بالا بیاور تا خط صاف شانه تا زانو", "دنده‌ها پایین؛ قوس کمر نده", "بالا مکث کن و آهسته پایین بیا"]'::jsonb, 'فعال‌سازی باسن قبل از تمرین و ضربه؛ پایهٔ قدرت باز شدن لگن.', 'play/bench-press.html', 36),
  ('ohp', 'پرس سرشانه هالتر', 'Barbell Overhead Press', 'هالتر · ایستاده', '[["دلتوئید قدامی", "deltA", 1], ["سه‌سر بازو", "triceps", 0.7], ["دلتوئید میانی", "deltL", 0.6]]'::jsonb, 'مرکز بدن، باسن، ذوزنقه', '["میله روی جلوی شانه، مچ صاف", "باسن و شکم سفت؛ کمر قوس برندارد", "سر کمی عقب تا میله رد شود، سپس زیر میله برگرد", "قفل کامل بالای سر با میله روی وسط پا"]'::jsonb, 'قدرت بالای سر و ثبات کتف؛ از شانه در فینیش بلند محافظت می‌کند.', 'play/bench-press.html', 37),
  ('db_shoulder_press', 'پرس سرشانه دمبل', 'Seated Dumbbell Shoulder Press', 'دو دمبل · نیمکت ۸۰ درجه', '[["دلتوئید قدامی", "deltA", 1], ["دلتوئید میانی", "deltL", 0.7], ["سه‌سر بازو", "triceps", 0.65]]'::jsonb, 'روتاتور کاف، کتف', '["پشت کامل روی پشتی", "دمبل‌ها کنار گوش، ساعد عمود", "بالا در یک قوس کوچک به سمت هم", "پایین تا هم‌سطح گوش، کنترل‌شده"]'::jsonb, 'هر دست مستقل کار می‌کند؛ عدم تقارن شانه‌ها را کم می‌کند.', 'play/bench-press.html', 38),
  ('lateral_raise', 'نشر جانب دمبل', 'Dumbbell Lateral Raise', 'دو دمبل', '[["دلتوئید میانی", "deltL", 1], ["ذوزنقه", "traps", 0.55], ["دلتوئید قدامی", "deltA", 0.35]]'::jsonb, 'روتاتور کاف، مرکز بدن', '["آرنج کمی خم و ثابت", "بازو را در صفحهٔ کتف تا هم‌سطح شانه بالا ببر", "شانه بالا نیاید؛ گردن آزاد", "پایین آوردن آهسته در ۲ تا ۳ ثانیه"]'::jsonb, 'دلتوئید میانی شانه را در وضعیت بالای بک‌سوئینگ پایدار می‌کند.', 'play/bench-press.html', 39),
  ('rear_delt_fly', 'نشر خم دمبل', 'Bent-Over Rear Delt Fly', 'دو دمبل · خم', '[["دلتوئید خلفی", "deltP", 1], ["ذوزنقه", "traps", 0.65], ["روتاتور کاف", "cuff", 0.55]]'::jsonb, 'راست‌کنندهٔ ستون فقرات، همسترینگ', '["از ران خم شو تا تنه تقریباً موازی زمین", "آرنج کمی خم؛ دست‌ها را به طرفین باز کن", "کتف‌ها را به هم نزدیک کن", "بدون تاب دادن تنه"]'::jsonb, 'پشت شانه و کتف را متعادل می‌کند و قامت گرد شده را اصلاح می‌کند.', 'play/bench-press.html', 40),
  ('smith_shoulder_press', 'پرس سرشانه اسمیت', 'Smith Machine Shoulder Press', 'دستگاه اسمیت · نیمکت', '[["دلتوئید قدامی", "deltA", 1], ["سه‌سر بازو", "triceps", 0.75], ["دلتوئید میانی", "deltL", 0.55]]'::jsonb, 'کتف (مسیر میله ثابت است)', '["نیمکت زیر میله طوری که میله جلوی صورت پایین بیاید", "دست‌ها کمی بازتر از شانه", "پایین تا چانه، بالا تا نزدیک قفل", "قفل‌های ایمنی را تنظیم کن"]'::jsonb, 'بار سنگین‌تر با مسیر امن؛ مناسب تمرین بدون کمک‌دهنده.', 'play/bench-press.html', 41),
  ('machine_shoulder_press', 'پرس سرشانه دستگاه', 'Machine Shoulder Press', 'دستگاه وزنه‌خانه‌دار', '[["دلتوئید قدامی", "deltA", 1], ["سه‌سر بازو", "triceps", 0.7], ["دلتوئید میانی", "deltL", 0.55]]'::jsonb, '—', '["دسته‌ها هم‌سطح شانه", "پشت روی پشتی", "فشار بالا بدون قفل خشن", "برگشت کنترل‌شده"]'::jsonb, 'حجم کار سرشانه را با ثبات کامل بالا می‌برد.', 'play/bench-press.html', 42),
  ('cable_lateral_raise', 'نشر جانب سیم‌کش', 'Single-Arm Cable Lateral Raise', 'سیم‌کش پایین · دستهٔ تکی', '[["دلتوئید میانی", "deltL", 1], ["ذوزنقه", "traps", 0.5], ["روتاتور کاف", "cuff", 0.4]]'::jsonb, 'مرکز بدن، مورب‌ها', '["کنار ستون بایست؛ سیم از جلوی بدن", "آرنج کمی خم، بازو تا هم‌سطح شانه", "تنه به سمت ستون خم نشود", "کشش ثابت در تمام دامنه"]'::jsonb, 'کشش یکنواخت در کل دامنه؛ دلتوئید میانی را بدون فشار مفصلی تقویت می‌کند.', 'play/bench-press.html', 43),
  ('face_pull', 'فیس‌پول', 'Face Pull', 'سیم‌کش بالا · طناب', '[["دلتوئید خلفی", "deltP", 1], ["روتاتور کاف", "cuff", 0.85], ["ذوزنقه", "traps", 0.7]]'::jsonb, 'مرکز بدن', '["قرقره هم‌سطح صورت؛ طناب با کف دست رو به پایین", "طناب را به سمت صورت بکش و دست‌ها را باز کن", "آرنج‌ها بالا؛ در انتها چرخش بیرونی", "کتف‌ها جمع و آهسته برگرد"]'::jsonb, 'سلامت شانه و روتاتور کاف؛ تعادل در برابر حجم زیاد سوئینگ و حرکات فشاری.', 'play/bench-press.html', 44),
  ('pike_pushup', 'پایک پوش‌آپ', 'Pike Push-Up', 'وزن بدن', '[["دلتوئید قدامی", "deltA", 1], ["سه‌سر بازو", "triceps", 0.75], ["دندانه‌ای قدامی", "serratus", 0.5]]'::jsonb, 'مرکز بدن، کتف', '["باسن بالا تا بدن شکل ۸ وارونه شود", "دست‌ها کمی بازتر از شانه", "سر به سمت زمین بین دست‌ها پایین می‌آید", "با فشار کف دست به بالا برگرد"]'::jsonb, 'قدرت فشار بالای سر با وزن بدن؛ ثبات کتف بدون نیاز به وسیله.', 'play/bench-press.html', 45),
  ('deadlift', 'ددلیفت هالتر', 'Conventional Deadlift', 'هالتر', '[["سرینی بزرگ", "glutes", 1], ["راست‌کنندهٔ ستون فقرات", "erector", 0.95], ["همسترینگ", "hams", 0.85]]'::jsonb, 'ساعد، زیربغل، ذوزنقه، مرکز بدن', '["میله بالای وسط پا؛ ساق نزدیک میله", "کمر صاف، زیربغل سفت، شانه‌ها کمی جلوتر از میله", "زمین را با پاها هل بده؛ میله نزدیک بدن بالا بیاید", "در بالا باسن را کامل باز کن؛ عقب خم نشو"]'::jsonb, 'قدرت کل زنجیرهٔ پشت بدن؛ پایهٔ نیرو و ثبات برای سوئینگ قوی و بدون آسیب کمر.', 'play/bench-press.html', 46),
  ('bb_row', 'زیربغل هالتر خم', 'Barbell Bent-Over Row', 'هالتر', '[["زیربغل (لت)", "lats", 1], ["ذوزنقه", "traps", 0.75], ["دلتوئید خلفی", "deltP", 0.65]]'::jsonb, 'راست‌کنندهٔ ستون فقرات، همسترینگ', '["از ران خم شو تا حدود ۴۵ درجه؛ کمر صاف", "میله را به سمت پایین شکم بکش", "آرنج‌ها نزدیک بدن به عقب", "بدون تاب دادن تنه، آهسته پایین"]'::jsonb, 'پشت قوی زاویهٔ خم شدن را در کل سوئینگ حفظ می‌کند.', 'play/bench-press.html', 47),
  ('db_row', 'زیربغل تک‌خم دمبل', 'Single-Arm Dumbbell Row', 'یک دمبل · نیمکت', '[["زیربغل (لت)", "lats", 1], ["ذوزنقه", "traps", 0.65], ["دلتوئید خلفی", "deltP", 0.6]]'::jsonb, 'مرکز بدن، مورب‌ها', '["زانو و دست یک طرف روی نیمکت؛ کمر صاف و موازی زمین", "دمبل را به سمت لگن بکش", "آرنج نزدیک بدن؛ تنه نچرخد", "کشش کامل در پایین"]'::jsonb, 'کار تک‌طرفه عدم تقارن زیربغل‌ها را کم می‌کند و ضد چرخش تنه را تمرین می‌دهد.', 'play/bench-press.html', 48),
  ('tbar_row', 'زیربغل تی‌بار', 'T-Bar Row', 'لندماین · دستهٔ V', '[["زیربغل (لت)", "lats", 1], ["ذوزنقه", "traps", 0.8], ["راست‌کنندهٔ ستون فقرات", "erector", 0.65]]'::jsonb, 'همسترینگ، مرکز بدن', '["روی میله بایست؛ زانو کمی خم", "از ران خم شو؛ کمر صاف", "دسته را به سمت سینه بکش", "کتف‌ها جمع؛ آهسته پایین"]'::jsonb, 'بار سنگین برای ضخامت پشت با مسیر ثابت‌تر از هالتر.', 'play/bench-press.html', 49),
  ('machine_row', 'زیربغل دستگاه نشسته', 'Seated Machine Row', 'دستگاه وزنه‌خانه‌دار · پد سینه', '[["زیربغل (لت)", "lats", 1], ["ذوزنقه", "traps", 0.8], ["دلتوئید خلفی", "deltP", 0.6]]'::jsonb, '— (سینه روی پد)', '["سینه روی پد؛ دسته‌ها در دسترس با دست صاف", "دسته‌ها را به عقب بکش، آرنج نزدیک بدن", "کتف‌ها را جمع کن و مکث کن", "برگشت کنترل‌شده تا کشش کامل"]'::jsonb, 'پشت را بدون فشار روی کمر تقویت می‌کند؛ مناسب روزهای پس از مسابقه.', 'play/bench-press.html', 50),
  ('lat_pulldown', 'لت پول‌داون', 'Lat Pulldown', 'دستگاه وزنه‌خانه‌دار · میلهٔ پهن', '[["زیربغل (لت)", "lats", 1], ["دوسر بازو", "biceps", 0.6], ["ذوزنقه", "traps", 0.45]]'::jsonb, 'مرکز بدن', '["ران زیر پد؛ کمی به عقب متمایل", "میله را تا بالای سینه بکش", "آرنج‌ها رو به پایین و عقب", "آهسته برگرد تا کشش کامل زیربغل"]'::jsonb, 'زیربغل قوی پایین آمدن چوب در داون‌سوئینگ و ثبات شانه را بهتر می‌کند.', 'play/bench-press.html', 51),
  ('cable_row', 'قایقی سیم‌کش', 'Seated Cable Row', 'سیم‌کش پایین · دستهٔ V', '[["زیربغل (لت)", "lats", 1], ["ذوزنقه", "traps", 0.75], ["دلتوئید خلفی", "deltP", 0.55]]'::jsonb, 'راست‌کنندهٔ ستون فقرات، مرکز بدن', '["پاها روی صفحه؛ زانو کمی خم", "تنه صاف؛ دسته را به سمت شکم بکش", "کتف‌ها را جمع کن؛ تنه تاب نخورد", "برگشت با کشش کامل کتف"]'::jsonb, 'تعادل حرکات فشاری و قامت صاف پشت در ستاپ.', 'play/bench-press.html', 52),
  ('straight_arm_pulldown', 'پول‌اوور سیم‌کش ایستاده', 'Straight-Arm Cable Pulldown', 'سیم‌کش بالا · میلهٔ کوتاه', '[["زیربغل (لت)", "lats", 1], ["راست شکمی", "abs", 0.45], ["سه‌سر بازو", "triceps", 0.4]]'::jsonb, 'مرکز بدن، کتف', '["کمی از ران خم شو؛ دست‌ها تقریباً صاف", "میله را در یک قوس تا ران پایین بکش", "شکم سفت؛ کمر قوس برندارد", "آهسته برگرد تا بالای سر"]'::jsonb, 'دقیقاً الگوی پایین کشیدن دست‌ها در داون‌سوئینگ؛ اتصال زیربغل به مرکز بدن.', 'play/bench-press.html', 53),
  ('pullup', 'بارفیکس', 'Pull-Up', 'میلهٔ بارفیکس · وزن بدن', '[["زیربغل (لت)", "lats", 1], ["دوسر بازو", "biceps", 0.7], ["ساعد و مچ", "forearm", 0.6]]'::jsonb, 'مرکز بدن، ساعد', '["آویزان با دست کمی بازتر از شانه", "کتف‌ها را پایین بکش و سینه را به میله نزدیک کن", "چانه بالای میله؛ بدون تاب", "پایین آمدن کامل و کنترل‌شده"]'::jsonb, 'قدرت نسبی بالاتنه و چنگش قوی برای کنترل چوب.', 'play/bench-press.html', 54),
  ('back_extension', 'فیله کمر (هایپراکستنشن)', '45° Back Extension', 'دستگاه هایپر ۴۵ درجه', '[["راست‌کنندهٔ ستون فقرات", "erector", 1], ["سرینی بزرگ", "glutes", 0.8], ["همسترینگ", "hams", 0.75]]'::jsonb, '—', '["پد زیر لگن؛ پاشنه زیر غلتک", "دست‌ها روی سینه یا وزنه جلوی سینه", "از ران خم شو و با باسن بالا بیا", "در بالا خط صاف؛ قوس اضافه نده"]'::jsonb, 'استقامت کمر و باسن برای حفظ زاویهٔ ستاپ در ۱۸ سوراخ.', 'play/bench-press.html', 55),
  ('bb_curl', 'جلوبازو هالتر', 'Barbell Curl', 'هالتر', '[["دوسر بازو", "biceps", 1], ["ساعد و مچ", "forearm", 0.65]]'::jsonb, 'مرکز بدن، شانه', '["آرنج‌ها کنار بدن ثابت", "میله را بدون تاب دادن بالا بیاور", "بالا مکث و انقباض", "پایین آوردن آهسته تا باز شدن کامل"]'::jsonb, 'آرنج و ساعد قوی کنترل چوب را در ضربه‌های سخت بهتر می‌کند.', 'play/bench-press.html', 56),
  ('hammer_curl', 'جلوبازو چکشی دمبل', 'Hammer Curl', 'دو دمبل', '[["ساعد و مچ", "forearm", 1], ["دوسر بازو", "biceps", 0.85]]'::jsonb, 'مرکز بدن', '["کف دست‌ها رو به هم", "آرنج کنار بدن ثابت", "بالا آوردن بدون چرخش مچ", "پایین آوردن کنترل‌شده"]'::jsonb, 'عضلهٔ بازویی‌زندی و ساعد را برای مچ پایدار در ضربه تقویت می‌کند.', 'play/bench-press.html', 57),
  ('skull_crusher', 'پشت‌بازو خوابیده هالتر', 'Barbell Skull Crusher', 'هالتر · نیمکت تخت', '[["سه‌سر بازو", "triceps", 1], ["ساعد و مچ", "forearm", 0.35], ["زیربغل (لت)", "lats", 0.25]]'::jsonb, 'شانه، کتف', '["بازوها عمود و کمی رو به سر", "فقط از آرنج خم شو تا میله نزدیک پیشانی", "آرنج‌ها باز نشوند", "با سه‌سر باز کن؛ شانه ثابت"]'::jsonb, 'سه‌سر قوی بازوی چپ را در ضربه صاف نگه می‌دارد.', 'play/bench-press.html', 58),
  ('wrist_curl', 'مچ و ساعد هالتر', 'Barbell Wrist Curl', 'هالتر · نیمکت', '[["ساعد و مچ", "forearm", 1], ["دوسر بازو", "biceps", 0.15]]'::jsonb, '—', '["ساعد روی ران؛ مچ بیرون از زانو", "کف دست رو به بالا", "فقط با مچ میله را بالا بیاور", "پایین تا کشش کامل و آهسته"]'::jsonb, 'چنگش و مچ قوی؛ کنترل صورت چوب و پیشگیری از درد آرنج گلف.', 'play/bench-press.html', 59),
  ('preacher_machine', 'جلوبازو لاری دستگاه', 'Machine Preacher Curl', 'دستگاه وزنه‌خانه‌دار', '[["دوسر بازو", "biceps", 1], ["ساعد و مچ", "forearm", 0.55]]'::jsonb, '—', '["پشت بازو کامل روی پد", "آرنج هم‌راستای محور دستگاه", "بالا آوردن بدون بلند شدن از پد", "پایین کنترل‌شده تا نزدیک باز شدن"]'::jsonb, 'دوسر را جدا و بدون تقلب تقویت می‌کند.', 'play/bench-press.html', 60),
  ('triceps_machine', 'پشت‌بازو دستگاه', 'Machine Triceps Extension', 'دستگاه وزنه‌خانه‌دار', '[["سه‌سر بازو", "triceps", 1], ["ساعد و مچ", "forearm", 0.3]]'::jsonb, '—', '["بازو روی پد؛ آرنج هم‌راستای محور", "دسته‌ها را تا باز شدن کامل پایین بده", "مکث در انقباض", "برگشت آهسته"]'::jsonb, 'سه‌سر را با ثبات کامل تقویت می‌کند.', 'play/bench-press.html', 61),
  ('rope_pushdown', 'پشت‌بازو سیم‌کش طنابی', 'Rope Triceps Pushdown', 'سیم‌کش بالا · طناب', '[["سه‌سر بازو", "triceps", 1], ["ساعد و مچ", "forearm", 0.35]]'::jsonb, 'مرکز بدن', '["آرنج‌ها کنار بدن ثابت", "طناب را پایین بکش و در انتها باز کن", "شانه‌ها پایین؛ تنه ثابت", "برگشت تا ۹۰ درجهٔ آرنج"]'::jsonb, 'سه‌سر و ثبات آرنج؛ مکمل حرکات فشاری.', 'play/bench-press.html', 62),
  ('cable_curl', 'جلوبازو سیم‌کش', 'Cable Curl', 'سیم‌کش پایین · میلهٔ کوتاه', '[["دوسر بازو", "biceps", 1], ["ساعد و مچ", "forearm", 0.6]]'::jsonb, 'مرکز بدن', '["رو به ستون؛ آرنج کنار بدن", "میله را بالا بیاور؛ کشش ثابت", "بالا مکث", "پایین آهسته"]'::jsonb, 'کشش ثابت در تمام دامنه برای آرنج سالم.', 'play/bench-press.html', 63),
  ('bench_dip', 'دیپ نیمکت', 'Bench Dip', 'نیمکت · وزن بدن', '[["سه‌سر بازو", "triceps", 1], ["دلتوئید قدامی", "deltA", 0.55], ["سینه‌ای بزرگ", "pec", 0.4]]'::jsonb, 'کتف', '["دست‌ها روی لبهٔ نیمکت پشت سر", "باسن نزدیک نیمکت؛ پاها جلو", "تا ۹۰ درجهٔ آرنج پایین برو", "با سه‌سر بالا بیا؛ شانه بالا نیاید"]'::jsonb, 'سه‌سر با وزن بدن؛ هر جایی قابل اجرا.', 'play/bench-press.html', 64),
  ('russian_twist', 'چرخش روسی با وزنه', 'Weighted Russian Twist', 'صفحهٔ وزنه · تشک', '[["مورب‌های شکم", "oblique", 1], ["راست شکمی", "abs", 0.8], ["راست‌کنندهٔ ستون فقرات", "erector", 0.3]]'::jsonb, 'خم‌کننده‌های ران', '["نشسته، تنه حدود ۴۰ درجه به عقب", "وزنه جلوی سینه با دست‌های کمی خم", "چرخش از قفسهٔ سینه، نه فقط دست‌ها", "کمر صاف؛ تنفس منظم"]'::jsonb, 'چرخش کنترل‌شدهٔ تنه — همان جداسازی شانه از لگن در سوئینگ.', 'play/bench-press.html', 65),
  ('farmer_walk', 'راه رفتن کشاورز', 'Farmer’s Walk', 'دو دمبل سنگین', '[["ساعد و مچ", "forearm", 1], ["ذوزنقه", "traps", 0.85], ["راست شکمی", "abs", 0.6]]'::jsonb, 'مورب‌ها، باسن، ساق', '["دمبل‌ها کنار بدن؛ شانه‌ها پایین و عقب", "قامت کاملاً صاف؛ شکم سفت", "گام‌های کوتاه و کنترل‌شده", "تنه به طرفین خم نشود"]'::jsonb, 'چنگش، ثبات تنه و قامت؛ انتقال قدرت از پا به دست.', 'play/bench-press.html', 66),
  ('machine_crunch', 'کرانچ دستگاه', 'Machine Ab Crunch', 'دستگاه وزنه‌خانه‌دار', '[["راست شکمی", "abs", 1], ["مورب‌های شکم", "oblique", 0.55]]'::jsonb, '—', '["دسته‌ها کنار شانه", "ستون فقرات را از بالا به پایین خم کن", "در انتها بازدم و مکث", "برگشت آهسته بدون رها کردن وزنه"]'::jsonb, 'قدرت خم شدن تنه با بار قابل اندازه‌گیری.', 'play/bench-press.html', 67),
  ('pallof_press', 'پالوف پرس', 'Pallof Press', 'سیم‌کش · دستهٔ تکی', '[["مورب‌های شکم", "oblique", 1], ["راست شکمی", "abs", 0.75], ["سرینی بزرگ", "glutes", 0.4]]'::jsonb, 'باسن، شانه', '["پهلو به ستون؛ دسته جلوی سینه", "دست‌ها را مستقیم جلو بده", "تنه نچرخد؛ مقاومت در برابر کشش سیم", "مکث و برگشت به سینه"]'::jsonb, 'ضد چرخش؛ کنترل تنه در لحظهٔ ضربه و توقف چرخش اضافی.', 'play/bench-press.html', 68),
  ('cable_crunch', 'کرانچ سیم‌کش زانو', 'Kneeling Cable Crunch', 'سیم‌کش بالا · طناب', '[["راست شکمی", "abs", 1], ["مورب‌های شکم", "oblique", 0.5]]'::jsonb, '—', '["زانو زده رو به ستون؛ طناب کنار سر", "لگن ثابت؛ ستون فقرات را خم کن", "آرنج‌ها به سمت ران", "برگشت آهسته تا کشش شکم"]'::jsonb, 'شکم قوی برای انتقال نیرو از پایین‌تنه به بالاتنه.', 'play/bench-press.html', 69),
  ('plank', 'پلانک', 'Forearm Plank', 'تشک · وزن بدن', '[["راست شکمی", "abs", 1], ["مورب‌های شکم", "oblique", 0.65], ["دلتوئید قدامی", "deltA", 0.45]]'::jsonb, 'باسن، چهارسر', '["ساعد زیر شانه؛ آرنج زیر شانه", "بدن یک خط صاف از سر تا پاشنه", "باسن و شکم سفت؛ کمر نیفتد", "تنفس آرام و منظم"]'::jsonb, 'ثبات پایهٔ مرکز بدن برای سوئینگ تکرارپذیر.', 'play/bench-press.html', 70),
  ('side_plank', 'پلانک پهلو', 'Side Plank', 'تشک · وزن بدن', '[["مورب‌های شکم", "oblique", 1], ["سرینی بزرگ", "glutes", 0.5], ["راست شکمی", "abs", 0.55]]'::jsonb, 'شانه، نزدیک‌کننده‌ها', '["آرنج زیر شانه؛ پاها روی هم", "لگن بالا تا خط صاف", "لگن به عقب یا جلو نچرخد", "دو طرف را برابر نگه دار"]'::jsonb, 'ثبات جانبی لگن و تنه؛ جلوگیری از سوی و اسلاید در سوئینگ.', 'play/bench-press.html', 71),
  ('captains_chair', 'زیرشکم خلبانی', 'Captain’s Chair Knee Raise', 'ایستگاه خلبانی', '[["راست شکمی", "abs", 1], ["مورب‌های شکم", "oblique", 0.55], ["چهارسر ران", "quads", 0.35]]'::jsonb, 'ساعد، زیربغل', '["پشت روی پد؛ ساعد روی دسته‌ها", "زانوها را تا هم‌سطح لگن بالا بیاور", "لگن کمی به جلو بچرخد", "بدون تاب؛ آهسته پایین"]'::jsonb, 'شکم پایینی و کنترل لگن.', 'play/bench-press.html', 72),
  ('dead_bug', 'ددباگ', 'Dead Bug', 'تشک · وزن بدن', '[["راست شکمی", "abs", 1], ["مورب‌های شکم", "oblique", 0.6], ["چهارسر ران", "quads", 0.25]]'::jsonb, 'خم‌کننده‌های ران', '["به پشت؛ دست‌ها رو به سقف، زانو و ران ۹۰ درجه", "کمر به زمین چسبیده", "دست و پای مخالف را آهسته باز کن", "برگرد و طرف دیگر"]'::jsonb, 'هماهنگی دست و پای مخالف با تنهٔ ثابت؛ پایهٔ کنترل حرکتی سوئینگ.', 'play/bench-press.html', 73),
  ('medball_rot_throw', 'پرتاب چرخشی مدیسین‌بال', 'Medicine Ball Rotational Throw', 'مدیسین‌بال · دیوار', '[["مورب‌های شکم", "oblique", 1], ["سرینی بزرگ", "glutes", 0.75], ["راست شکمی", "abs", 0.7]]'::jsonb, 'شانه، نزدیک‌کننده‌ها', '["پهلو به دیوار در حالت ستاپ", "توپ را کنار ران عقب بارگیری کن", "لگن اول، بعد تنه و دست‌ها می‌چرخند", "پرتاب انفجاری به دیوار و فینیش متعادل"]'::jsonb, 'مستقیم‌ترین تمرین توان چرخشی؛ ترتیب حرکتی لگن، تنه و دست‌ها مثل سوئینگ.', 'play/bench-press.html', 74),
  ('landmine_rotation', 'چرخش لندماین', 'Landmine Rotation', 'لندماین · صفحه', '[["مورب‌های شکم", "oblique", 1], ["راست شکمی", "abs", 0.7], ["دلتوئید قدامی", "deltA", 0.6]]'::jsonb, 'باسن، پاها', '["انتهای میله جلوی سینه با دست صاف", "میله را در یک قوس به کنار ران ببر", "لگن و پاها همراه چرخش؛ کمر نچرخد", "برگشت کنترل‌شده و طرف دیگر"]'::jsonb, 'قدرت چرخش با بار؛ کنترل تنه در دامنهٔ کامل سوئینگ.', 'play/bench-press.html', 75),
  ('woodchop_high', 'وودچاپ سیم‌کش بالا به پایین', 'High-to-Low Cable Woodchop', 'سیم‌کش بالا · دستهٔ تکی', '[["مورب‌های شکم", "oblique", 1], ["راست شکمی", "abs", 0.7], ["سرینی بزرگ", "glutes", 0.45]]'::jsonb, 'شانه، پاها', '["پهلو به ستون؛ دسته بالای شانه", "با دست‌های بلند به سمت ران مخالف بکش", "لگن و پای عقب همراه بچرخند", "برگشت آهسته به بالا"]'::jsonb, 'الگوی داون‌سوئینگ؛ انتقال نیرو از بالا به پایین و چرخش تنه.', 'play/bench-press.html', 76),
  ('woodchop_low', 'وودچاپ سیم‌کش پایین به بالا', 'Low-to-High Cable Woodchop', 'سیم‌کش پایین · دستهٔ تکی', '[["مورب‌های شکم", "oblique", 1], ["دلتوئید قدامی", "deltA", 0.6], ["سرینی بزرگ", "glutes", 0.55]]'::jsonb, 'پاها، شانه', '["پهلو به ستون؛ دسته کنار مچ پا", "با فشار پاها به سمت بالای شانهٔ مخالف بکش", "لگن جلوتر از دست‌ها می‌چرخد", "برگشت کنترل‌شده"]'::jsonb, 'توان از زمین به بالا؛ الگوی بالا رفتن و فینیش.', 'play/bench-press.html', 77),
  ('tspine_rotation', 'چرخش ستون فقرات سینه‌ای', 'Quadruped T-Spine Rotation', 'تشک · وزن بدن', '[["مورب‌های شکم", "oblique", 0.7], ["راست‌کنندهٔ ستون فقرات", "erector", 0.6], ["ذوزنقه", "traps", 0.5]]'::jsonb, 'شانه', '["چهار دست و پا؛ یک دست پشت سر", "آرنج را به سمت سقف باز کن", "لگن ثابت؛ چرخش فقط از قفسهٔ سینه", "آرنج را به سمت دست مقابل برگردان"]'::jsonb, 'تحرک چرخشی قفسهٔ سینه برای بک‌سوئینگ کامل بدون جبران کمر.', 'play/bench-press.html', 78),
  ('hip_90_90', 'تحرک لگن ۹۰/۹۰', '90/90 Hip Mobility', 'تشک · وزن بدن', '[["سرینی بزرگ", "glutes", 1], ["نزدیک‌کننده‌های ران", "adductor", 0.7], ["راست‌کنندهٔ ستون فقرات", "erector", 0.4]]'::jsonb, '—', '["نشسته؛ هر دو زانو ۹۰ درجه، یکی جلو و یکی کنار", "تنه صاف بالای پای جلو", "آهسته روی ساق جلو خم شو", "تنفس عمیق در کشش و برگشت"]'::jsonb, 'چرخش داخلی و خارجی لگن — کلید چرخش پای جلو در فینیش.', 'play/bench-press.html', 79)
on conflict (code) do update set name_fa=excluded.name_fa, name_en=excluded.name_en, equipment=excluded.equipment, muscles=excluded.muscles,
  stabilizers=excluded.stabilizers, cues=excluded.cues, golf=excluded.golf, model=excluded.model, sort=excluded.sort, active=true, updated_at=now();
