-- Backup system v3: private, operationally independent site+shop and academy profiles.
-- This file is a migration artifact only. It has NOT been applied to production.
-- Apply only after reviewing the transaction below; then set the GitHub repository variable
-- BACKUP_V3_ENABLED=true to switch schedules from the legacy combined workflow to the two v3 jobs.
-- No data is sent to GitHub by this migration, and it does not execute a restore.

begin;

create schema if not exists web_shop;

create table if not exists web_shop.backup_system_settings (
  system_key text primary key check (system_key in ('siteShop','academy')),
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  last_state jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists web_shop.backup_system_runs (
  system_key text not null check (system_key in ('siteShop','academy')),
  run_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  date_fa text not null,
  trigger text not null default 'scheduled',
  result text not null check (result in ('ok','partial','error','skipped')),
  structures text[] not null default '{}',
  destinations text[] not null default '{}',
  destination_status jsonb not null default '{}'::jsonb,
  files integer not null default 0 check (files >= 0),
  total_bytes bigint not null default 0 check (total_bytes >= 0),
  took_sec integer,
  archive_path text,
  archive_bucket text,
  manifest jsonb not null default '{}'::jsonb,
  state jsonb,
  errors text[] not null default '{}',
  warnings text[] not null default '{}',
  verified boolean,
  pinned boolean not null default false,
  primary key (system_key, run_id)
);

create index if not exists backup_system_runs_recent_idx
  on web_shop.backup_system_runs (system_key, started_at desc);
create index if not exists backup_system_runs_date_idx
  on web_shop.backup_system_runs (system_key, date_fa desc, result);

alter table web_shop.backup_system_settings enable row level security;
alter table web_shop.backup_system_runs enable row level security;
revoke all on web_shop.backup_system_settings from public, anon, authenticated;
revoke all on web_shop.backup_system_runs from public, anon, authenticated;
grant select, insert, update, delete on web_shop.backup_system_settings to service_role;
grant select, insert, update, delete on web_shop.backup_system_runs to service_role;

-- Default private destination: Supabase Storage bucket with public access disabled.
insert into storage.buckets (id, name, public, file_size_limit)
values ('puttclub-backups', 'puttclub-backups', false, 2147483648)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Seed two independent profiles. They may start with similar schedules, but every later change
-- is saved against exactly one system_key and never changes the other profile.
insert into web_shop.backup_system_settings (system_key, settings)
values
('siteShop', $site${
  "version": 3, "enabled": true, "mode": "daily", "time": "04:00", "intervalHours": 6,
  "weekday": 6, "monthDay": 1, "structures": {"siteShop": true, "academy": false},
  "academySchedule": {"on": false, "mode": "", "time": "", "intervalHours": 0},
  "format": "json", "compress": true,
  "redact": {"authUsers": "ids-only", "dropTables": []},
  "retention": {"daily": 30, "weekly": 13, "monthly": 12, "maxTotalMB": 4000,
                "pinOnRelease": true, "pinnedDates": []},
  "destinations": [
    {"type": "supabase", "label": "فضای ابری خصوصی سوپابیس", "on": true,
     "config": {"bucket": "puttclub-backups", "public": false}},
    {"type": "github", "label": "ریپوی خصوصی گیت‌هاب", "on": false,
     "config": {"branch": "main", "path": "backups", "commitPrefix": "backup"}}
  ],
  "emails": {"notify": false, "onSuccess": true, "list": [], "digest": "none", "subjectPrefix": "[پات‌کلاب]"},
  "verify": {"afterWrite": true, "restoreDrill": "weekly", "graceMinutes": 90},
  "limits": {"maxTotalMB": 2000, "timeoutSec": 1800, "retries": 2}
}$site$::jsonb),
('academy', $acad${
  "version": 3, "enabled": true, "mode": "daily", "time": "04:30", "intervalHours": 6,
  "weekday": 6, "monthDay": 1, "structures": {"siteShop": false, "academy": true},
  "academySchedule": {"on": false, "mode": "", "time": "", "intervalHours": 0},
  "format": "json", "compress": true,
  "redact": {"authUsers": "ids-only", "dropTables": []},
  "retention": {"daily": 30, "weekly": 13, "monthly": 12, "maxTotalMB": 4000,
                "pinOnRelease": true, "pinnedDates": []},
  "destinations": [
    {"type": "supabase", "label": "فضای ابری خصوصی سوپابیس", "on": true,
     "config": {"bucket": "puttclub-backups", "public": false}},
    {"type": "github", "label": "ریپوی خصوصی گیت‌هاب", "on": false,
     "config": {"branch": "main", "path": "backups", "commitPrefix": "backup"}}
  ],
  "emails": {"notify": false, "onSuccess": true, "list": [], "digest": "none", "subjectPrefix": "[پات‌کلاب]"},
  "verify": {"afterWrite": true, "restoreDrill": "weekly", "graceMinutes": 90},
  "limits": {"maxTotalMB": 2000, "timeoutSec": 1800, "retries": 2}
}$acad$::jsonb)
on conflict (system_key) do nothing;

-- Migrate the previous combined policy into both independent profiles, translating the old
-- academy-only schedule. On first install only: do not overwrite profiles if this migration is
-- re-run after an owner has edited them.
do $migration$
declare
  old_settings jsonb;
  old_state jsonb;
  site_state jsonb;
  academy_state jsonb;
  site_settings jsonb;
  academy_settings jsonb;
begin
  if to_regclass('web_shop.backup_settings') is not null then
    execute 'select v from web_shop.backup_settings where id = 1' into old_settings;
  end if;
  if to_regclass('public.web_store') is not null then
    if old_settings is null then
      execute 'select v from public.web_store where k = $1 limit 1' into old_settings using 'web_setting_backup';
    end if;
    execute 'select v from public.web_store where k = $1 limit 1' into old_state using 'web_setting_backup_state';
  end if;

  if old_settings is not null and jsonb_typeof(old_settings) = 'object'
     and not exists (select 1 from web_shop.backup_system_settings where settings->>'migrationSource' = 'v2-combined') then
    select settings into site_settings from web_shop.backup_system_settings where system_key = 'siteShop';
    select settings into academy_settings from web_shop.backup_system_settings where system_key = 'academy';
    -- Site/shop keeps the legacy common schedule. Academy keeps its own seeded schedule unless
    -- the old independent academy clock was enabled, in which case that schedule is translated.
    site_settings := site_settings || old_settings;
    academy_settings := academy_settings ||
      (old_settings - 'version' - 'mode' - 'time' - 'intervalHours' - 'weekday' - 'monthDay'
                    - 'structures' - 'academySchedule' - 'destinations');
    site_settings := jsonb_set(site_settings, '{version}', '3'::jsonb, true);
    academy_settings := jsonb_set(academy_settings, '{version}', '3'::jsonb, true);
    site_settings := jsonb_set(site_settings, '{structures}', '{"siteShop":true,"academy":false}'::jsonb, true);
    academy_settings := jsonb_set(academy_settings, '{structures}', '{"siteShop":false,"academy":true}'::jsonb, true);
    -- New backups default to a private bucket; the legacy GitHub destination is not enabled by
    -- migration. It can be added again intentionally from the owner panel (with a PII warning).
    site_settings := jsonb_set(site_settings, '{destinations}',
      (select settings->'destinations' from web_shop.backup_system_settings where system_key='siteShop'), true);
    academy_settings := jsonb_set(academy_settings, '{destinations}',
      (select settings->'destinations' from web_shop.backup_system_settings where system_key='academy'), true);
    site_settings := jsonb_set(site_settings, '{redact,authUsers}', '"ids-only"'::jsonb, true);
    academy_settings := jsonb_set(academy_settings, '{redact,authUsers}', '"ids-only"'::jsonb, true);
    site_settings := jsonb_set(site_settings, '{redact,dropTables}', '[]'::jsonb, true);
    academy_settings := jsonb_set(academy_settings, '{redact,dropTables}', '[]'::jsonb, true);
    site_settings := jsonb_set(site_settings, '{academySchedule}',
      '{"on":false,"mode":"","time":"","intervalHours":0}'::jsonb, true);
    if lower(coalesce(old_settings #>> '{academySchedule,on}','false')) = 'true' then
      if (old_settings #>> '{academySchedule,mode}') in ('daily','interval','weekly','monthly') then
        academy_settings := jsonb_set(academy_settings, '{mode}', to_jsonb(old_settings #>> '{academySchedule,mode}'), true);
      end if;
      if coalesce(old_settings #>> '{academySchedule,time}', '') <> '' then
        academy_settings := jsonb_set(academy_settings, '{time}', to_jsonb(old_settings #>> '{academySchedule,time}'), true);
      end if;
      if coalesce(old_settings #>> '{academySchedule,intervalHours}', '') ~ '^[0-9]{1,3}$' then
        if (old_settings #>> '{academySchedule,intervalHours}')::integer between 1 and 168 then
          academy_settings := jsonb_set(academy_settings, '{intervalHours}',
            to_jsonb((old_settings #>> '{academySchedule,intervalHours}')::integer), true);
        end if;
      end if;
    end if;
    academy_settings := jsonb_set(academy_settings, '{academySchedule}',
      '{"on":false,"mode":"","time":"","intervalHours":0}'::jsonb, true);
    site_settings := jsonb_set(site_settings, '{migrationSource}', '"v2-combined"'::jsonb, true);
    academy_settings := jsonb_set(academy_settings, '{migrationSource}', '"v2-combined"'::jsonb, true);
    update web_shop.backup_system_settings set settings = site_settings, updated_at = now()
      where system_key = 'siteShop';
    update web_shop.backup_system_settings set settings = academy_settings, updated_at = now()
      where system_key = 'academy';
  end if;

  if old_state is null and to_regclass('public.web_store') is not null then
    execute 'select v from public.web_store where k = $1 limit 1' into old_state using 'web_setting_backup_state';
  end if;
  if old_state is not null then
    site_state := coalesce(old_state #> '{lastRunByKind,siteShop}', old_state);
    academy_state := old_state #> '{lastRunByKind,academy}';
    if site_state is not null then
      update web_shop.backup_system_settings set last_state = site_state where system_key = 'siteShop' and last_state is null;
    end if;
    if academy_state is not null then
      update web_shop.backup_system_settings set last_state = academy_state where system_key = 'academy' and last_state is null;
    end if;
  end if;

  -- Once copied in this same transaction, remove the public-readable copies of recipients and state.
  if to_regclass('public.web_store') is not null then
    execute 'delete from public.web_store where k in ($1,$2)'
      using 'web_setting_backup', 'web_setting_backup_state';
  end if;
end
$migration$;

create or replace function web_shop.backup_system_get(p_system text)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, web_shop as $fn$
declare
  cfg jsonb;
  st jsonb;
  history jsonb;
begin
  if p_system not in ('siteShop','academy') then
    raise exception 'سیستم بکاپ نامعتبر است.' using errcode = '22023';
  end if;
  select settings, last_state into cfg, st
    from web_shop.backup_system_settings where system_key = p_system;
  if cfg is null then raise exception 'پروفایل بکاپ پیدا نشد.' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.started_at desc), '[]'::jsonb) into history
    from (select run_id, system_key, date_fa, trigger, result, files, total_bytes, took_sec,
                 started_at, archive_path, archive_bucket, destination_status, state, errors, warnings, verified, pinned,
                 to_char(started_at at time zone 'Asia/Tehran','YYYY-MM-DD HH24:MI') as started_fa
          from web_shop.backup_system_runs where system_key = p_system
          order by started_at desc limit 50) x;
  return jsonb_build_object('system', p_system, 'settings', cfg, 'state', st,
                            'runs', history, 'updated_at',
                            (select updated_at from web_shop.backup_system_settings where system_key = p_system));
end $fn$;

create or replace function web_shop.backup_system_download_info(p_system text, p_run_id text)
returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, web_shop as $fn$
declare r web_shop.backup_system_runs%rowtype;
begin
  if p_system not in ('siteShop','academy') then
    raise exception 'سیستم بکاپ نامعتبر است.' using errcode = '22023';
  end if;
  select * into r from web_shop.backup_system_runs
   where system_key = p_system and run_id = p_run_id;
  if not found then return null; end if;
  return jsonb_build_object('run_id',r.run_id,'result',r.result,'archive_path',r.archive_path,
      'archive_bucket',r.archive_bucket,'files',r.files,'destination_status',r.destination_status,
      'verified',r.verified);
end $fn$;

create or replace function web_shop.backup_system_save(p_actor uuid, p_system text, p_settings jsonb)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, web_shop as $fn$
declare
  v jsonb;
begin
  if p_system not in ('siteShop','academy') then
    raise exception 'سیستم بکاپ نامعتبر است.' using errcode = '22023';
  end if;
  if p_actor is null or not exists (
      select 1 from auth.users u where u.id = p_actor and u.raw_app_meta_data->>'web_admin' = 'true') then
    raise exception 'فقط مدیر اصلی سایت می‌تواند تنظیمات بکاپ را تغییر دهد.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_settings) is distinct from 'object' then
    raise exception 'تنظیمات باید یک آبجکت باشد.' using errcode = '22023';
  end if;
  v := p_settings;
  v := jsonb_set(v, '{version}', '3'::jsonb, true);
  v := jsonb_set(v, '{structures}',
       case when p_system = 'siteShop' then '{"siteShop":true,"academy":false}'::jsonb
            else '{"siteShop":false,"academy":true}'::jsonb end, true);
  v := jsonb_set(v, '{academySchedule}', '{"on":false,"mode":"","time":"","intervalHours":0}'::jsonb, true);
  if coalesce(v->>'mode','') not in ('daily','interval','weekly','monthly') then
    raise exception 'دورهٔ اجرا نامعتبر است.' using errcode = '22023';
  end if;
  if coalesce(v->>'time','') !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'ساعت باید HH:MM باشد.' using errcode = '22023';
  end if;
  if jsonb_typeof(v->'destinations') is distinct from 'array' then
    raise exception 'فهرست مقصدها نامعتبر است.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v->'destinations') as x(dest)
             where coalesce(dest->>'type','') not in ('github','supabase','s3','webhook')) then
    raise exception 'نوع مقصد پشتیبانی نمی‌شود.' using errcode = '22023';
  end if;
  if not exists (select 1 from jsonb_array_elements(v->'destinations') as x(dest)
                 where dest->>'type' = 'supabase' and coalesce(dest->'on' = 'true'::jsonb, false)) then
    raise exception 'برای دانلود مستقیم از پنل، مقصد خصوصی سوپابیس باید فعال باشد.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v->'destinations') as x(dest)
             where dest->>'type' = 'supabase'
               and coalesce(dest #>> '{config,bucket}','') !~ '^[a-z0-9][a-z0-9_-]{2,62}$') then
    raise exception 'نام bucket سوپابیس باید ۳ تا ۶۳ نویسهٔ امن داشته باشد.' using errcode = '22023';
  end if;
  if jsonb_typeof(v #> '{emails,list}') is distinct from 'array' then
    raise exception 'فهرست گیرندگان نامعتبر است.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements_text(v #> '{emails,list}') as x(email)
             where email is null or email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][A-Za-z]{2,}$') then
    raise exception 'یک یا چند ایمیل نامعتبر است.' using errcode = '22023';
  end if;
  if v::text ~* '"(secret|password|accesskey|private_key|token)"[[:space:]]*:[[:space:]]*"[^"<]{6,}"' then
    raise exception 'مقدار رازگونه در تنظیمات ممنوع است؛ فقط نام Secret را ثبت کنید.' using errcode = '42501';
  end if;
  update web_shop.backup_system_settings
     set settings = v, updated_at = now(), updated_by = p_actor
   where system_key = p_system;
  if not found then raise exception 'پروفایل بکاپ پیدا نشد.' using errcode = 'P0002'; end if;
  return jsonb_build_object('ok', true, 'system', p_system, 'updated_at', now());
end $fn$;

create or replace function web_shop.backup_system_log_run(p_system text, p_payload jsonb)
returns void
language plpgsql security definer set search_path = pg_catalog, web_shop as $fn$
declare
  run_state jsonb;
  dest_status jsonb;
  run_result text;
begin
  if p_system not in ('siteShop','academy') then
    raise exception 'سیستم بکاپ نامعتبر است.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or coalesce(p_payload->>'runId','') = '' then
    raise exception 'جزئیات اجرای بکاپ نامعتبر است.' using errcode = '22023';
  end if;
  run_state := p_payload->'state';
  dest_status := coalesce(p_payload->'destinationStatus','{}'::jsonb);
  run_result := coalesce(p_payload->>'result','error');
  if run_result not in ('ok','partial','error','skipped') then run_result := 'error'; end if;
  insert into web_shop.backup_system_runs (
    system_key, run_id, started_at, finished_at, date_fa, trigger, result, structures,
    destinations, destination_status, files, total_bytes, took_sec, archive_path, archive_bucket,
    manifest, state, errors, warnings, verified, pinned)
  values (
    p_system, p_payload->>'runId',
    coalesce(nullif(p_payload->>'startedAt','')::timestamptz, now()), now(),
    coalesce(p_payload->>'date', to_char(now() at time zone 'Asia/Tehran','YYYY-MM-DD')),
    coalesce(nullif(p_payload->>'trigger',''), 'scheduled'), run_result,
    array(select jsonb_array_elements_text(coalesce(p_payload->'ran','[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_payload->'dest','[]'::jsonb))),
    dest_status, coalesce((p_payload->>'files')::integer,0), coalesce((p_payload->>'totalBytes')::bigint,0),
    nullif(p_payload->>'tookSec','')::integer, nullif(p_payload->>'archivePath',''),
    nullif(p_payload->>'archiveBucket',''), coalesce(p_payload->'manifest','{}'::jsonb), run_state,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'errors','[]'::jsonb))),'{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'warnings','[]'::jsonb))),'{}'),
    (p_payload->>'verified')::boolean, coalesce((p_payload->>'pinned')::boolean,false))
  on conflict (system_key, run_id) do update set
    finished_at = now(), result = excluded.result, destinations = excluded.destinations,
    destination_status = excluded.destination_status, files = excluded.files,
    total_bytes = excluded.total_bytes, took_sec = excluded.took_sec,
    archive_path = excluded.archive_path, archive_bucket = excluded.archive_bucket,
    manifest = excluded.manifest, state = excluded.state, errors = excluded.errors,
    warnings = excluded.warnings, verified = excluded.verified, pinned = excluded.pinned;

  if coalesce((p_payload->>'pinned')::boolean,false) and coalesce(p_payload->>'date','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    update web_shop.backup_system_settings s
       set settings = jsonb_set(s.settings, '{retention,pinnedDates}',
         (select coalesce(jsonb_agg(to_jsonb(x.d) order by x.d), '[]'::jsonb)
            from (select distinct value as d
                    from jsonb_array_elements_text(coalesce(s.settings #> '{retention,pinnedDates}','[]'::jsonb)) as pin_dates(value)
                  union select p_payload->>'date') x), true),
           updated_at = now()
     where s.system_key = p_system;
  end if;

  -- Advance the scheduler only after at least one durable destination accepted the full archive.
  -- GitHub alone remains pending until the workflow callback confirms its push.
  if run_result in ('ok','partial') and run_state is not null and coalesce((p_payload->>'files')::integer,0) > 0 and (
       (coalesce((dest_status->'supabase'->>'uploaded')::integer,0) >= (p_payload->>'files')::integer
        and (dest_status->'supabase'->>'verified') is distinct from 'false')
       or coalesce((dest_status->'s3'->>'ok')::boolean,false)) then
    update web_shop.backup_system_settings set last_state = run_state where system_key = p_system;
  end if;
end $fn$;

create or replace function web_shop.backup_system_finish_github(p_system text, p_run_id text, p_success boolean)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, web_shop as $fn$
declare
  r web_shop.backup_system_runs%rowtype;
  next_result text;
  next_state jsonb;
  other_store boolean;
begin
  if p_system not in ('siteShop','academy') then
    raise exception 'سیستم بکاپ نامعتبر است.' using errcode = '22023';
  end if;
  select * into r from web_shop.backup_system_runs
   where system_key = p_system and run_id = p_run_id for update;
  if not found then raise exception 'اجرای بکاپ پیدا نشد.' using errcode = 'P0002'; end if;
  other_store := (r.files > 0
                  and coalesce((r.destination_status->'supabase'->>'uploaded')::integer,0) >= r.files
                  and (r.destination_status->'supabase'->>'verified') is distinct from 'false')
                 or coalesce((r.destination_status->'s3'->>'ok')::boolean,false);
  next_result := case when p_success and cardinality(r.errors) = 0 then 'ok'
                      when p_success or other_store then 'partial' else 'error' end;
  next_state := r.state;
  if next_state is not null then
    next_state := jsonb_set(next_state, '{result}', to_jsonb(next_result), true);
    next_state := jsonb_set(next_state, '{destinations,github,committed}', to_jsonb(p_success), true);
  end if;
  update web_shop.backup_system_runs
     set destination_status = jsonb_set(coalesce(destination_status,'{}'::jsonb),
           '{github,committed}', to_jsonb(p_success), true),
         result = next_result, state = next_state, finished_at = now(),
         errors = case when p_success then errors else array_append(errors,'push به GitHub تأیید نشد') end
   where system_key = p_system and run_id = p_run_id;
  if p_success and next_result = 'ok' and next_state is not null then
    update web_shop.backup_system_settings set last_state = next_state, updated_at = now()
      where system_key = p_system;
  end if;
  return jsonb_build_object('ok', p_success, 'result', next_result);
end $fn$;

-- Public-schema wrappers exist only because PostgREST exposes public RPCs in this deployment.
create or replace function public.backup_system_get(p_system text) returns jsonb
language sql stable security definer set search_path = pg_catalog, web_shop as $$
  select web_shop.backup_system_get(p_system)
$$;
create or replace function public.backup_system_download_info(p_system text, p_run_id text) returns jsonb
language sql stable security definer set search_path = pg_catalog, web_shop as $$
  select web_shop.backup_system_download_info(p_system, p_run_id)
$$;
create or replace function public.backup_system_save(p_actor uuid, p_system text, p_settings jsonb) returns jsonb
language sql volatile security definer set search_path = pg_catalog, web_shop as $$
  select web_shop.backup_system_save(p_actor, p_system, p_settings)
$$;
create or replace function public.backup_system_log_run(p_system text, p_payload jsonb) returns void
language sql volatile security definer set search_path = pg_catalog, web_shop as $$
  select web_shop.backup_system_log_run(p_system, p_payload)
$$;
create or replace function public.backup_system_finish_github(p_system text, p_run_id text, p_success boolean) returns jsonb
language sql volatile security definer set search_path = pg_catalog, web_shop as $$
  select web_shop.backup_system_finish_github(p_system, p_run_id, p_success)
$$;

revoke all on function web_shop.backup_system_get(text) from public, anon, authenticated;
revoke all on function web_shop.backup_system_download_info(text,text) from public, anon, authenticated;
revoke all on function web_shop.backup_system_save(uuid,text,jsonb) from public, anon, authenticated;
revoke all on function web_shop.backup_system_log_run(text,jsonb) from public, anon, authenticated;
revoke all on function web_shop.backup_system_finish_github(text,text,boolean) from public, anon, authenticated;
revoke all on function public.backup_system_get(text) from public, anon, authenticated;
revoke all on function public.backup_system_download_info(text,text) from public, anon, authenticated;
revoke all on function public.backup_system_save(uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.backup_system_log_run(text,jsonb) from public, anon, authenticated;
revoke all on function public.backup_system_finish_github(text,text,boolean) from public, anon, authenticated;
grant execute on function web_shop.backup_system_get(text) to service_role;
grant execute on function web_shop.backup_system_download_info(text,text) to service_role;
grant execute on function web_shop.backup_system_save(uuid,text,jsonb) to service_role;
grant execute on function web_shop.backup_system_log_run(text,jsonb) to service_role;
grant execute on function web_shop.backup_system_finish_github(text,text,boolean) to service_role;
grant execute on function public.backup_system_get(text) to service_role;
grant execute on function public.backup_system_download_info(text,text) to service_role;
grant execute on function public.backup_system_save(uuid,text,jsonb) to service_role;
grant execute on function public.backup_system_log_run(text,jsonb) to service_role;
grant execute on function public.backup_system_finish_github(text,text,boolean) to service_role;

commit;

-- Read-only post-migration checks (run manually after applying):
-- select system_key, settings->>'version', last_state from web_shop.backup_system_settings order by system_key;
-- select system_key, run_id, result, verified, archive_path from web_shop.backup_system_runs order by started_at desc limit 10;
-- select k from public.web_store where k in ('web_setting_backup','web_setting_backup_state'); -- expected: no rows
