-- backup settings v2 — private config + run history for scripts/run.py in golf-academy-backups
-- فایلِ آماده؛ **اجرا نشده**. اجراش کن وقتی موتور v2 روی ریپوی بکاپ نشسته باشد (ترتیب مهم نیست:
-- موتور و web-erp هر دو تا نبودِ این تابع‌ها همان کلید web_store را می‌خواند/می‌نویسد).
-- چرا: تنظیمات بکاپ (گیرنده‌ها، مقصدها، وضعیت، تاریخچه) تا امروز در public.web_store بود که
-- با anon key خواندنی است. این فایل آن‌ها را به web_shop.* می‌برد و ۴ پوستهٔ public می‌سازد تا
-- PostgREST هم آن‌ها را ببیند. اجرا: psql "$SUPABASE_DB_URL" -f supabase/backup_v2_settings.sql
-- (یا SQL Editor). بازرسیِ بعد از اجرا در انتهای فایل هست.
-- ═════════════════════════════════════════════════════════════════════════════
-- B1 — تنظیمات بکاپ از «web_store عمومی» به «web_shop خصوصی» منتقل می‌شود
-- اجرا: Supabase Dashboard ← SQL Editor (idempotent — چند بار اجرا بی‌ضرر)
--
-- چرا: وب‌سایت کل public.web_store را با کلید anon می‌خواند (policy using(true) را
-- در گزارش C1/M3 دیدیم). یعنی «چه کسی به او بکاپ می‌فرستد» و «وضعیت آخرین اجرا»
-- روی اینترنت بود. جدول ۱ سطر در schema خصوصی همان کار را با RLS انجام می‌دهد.
-- ═════════════════════════════════════════════════════════════════════════════
begin;

-- ── ۱) جدول تنظیمات (یک سطر) ────────────────────────────────────────────────
create schema if not exists web_shop;

create table if not exists web_shop.backup_settings (
  id          smallint primary key default 1 check (id = 1),
  v           jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id),
  constraint backup_settings_shape check (jsonb_typeof(v) = 'object')
);
comment on table web_shop.backup_settings is
  'تنظیمات موتور بکاپ v2 — ساختار دقیق در audit/fixes/backup/engine.py::DEFAULTS. خصوصی؛ هیچ نقش عمومی دسترسی ندارد.';

alter table web_shop.backup_settings enable row level security;
revoke all on web_shop.backup_settings from public, anon, authenticated;
grant select, insert, update on web_shop.backup_settings to service_role;

-- ── ۲) تاریخچهٔ اجراها (برای کارت «سلامت بکاپ» و نمودار در پنل) ──────────────
create table if not exists web_shop.backup_runs (
  id           bigint generated always as identity primary key,
  run_id       text unique not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  took_sec     int,
  date_fa      text not null,
  trigger      text not null,
  result       text not null check (result in ('ok','partial','error','skipped')),
  structures   text[] not null default '{}',
  destinations text[] not null default '{}',
  files        int  not null default 0,
  total_bytes  bigint not null default 0,
  manifest     jsonb not null default '{}'::jsonb,   -- فهرست فایل + sha256 کامل
  errors       text[] not null default '{}',
  warnings     text[] not null default '{}',
  pinned       boolean not null default false,
  verified     boolean,                              -- verify-after-write نتیجه
  actor        uuid references auth.users(id)
);
create index if not exists backup_runs_started_idx on web_shop.backup_runs (started_at desc);
create index if not exists backup_runs_date_idx    on web_shop.backup_runs (date_fa desc, result);
alter table web_shop.backup_runs enable row level security;
revoke all on web_shop.backup_runs from public, anon, authenticated;
grant select, insert, update on web_shop.backup_runs to service_role;

-- ── ۳) گیرنده‌های ایمیل: در جدول، تا «افزودن/حذف» تک‌تک و قابل‌اعتبارسنجی باشد ──
create table if not exists web_shop.backup_recipients (
  email   text primary key check (email ~* '^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$'),
  label   text,
  on_fail boolean not null default true,
  on_ok   boolean not null default false,
  digest  boolean not null default true,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id)
);
alter table web_shop.backup_recipients enable row level security;
revoke all on web_shop.backup_recipients from public, anon, authenticated;
grant select, insert, update, delete on web_shop.backup_recipients to service_role;

-- ── ۴) مقصدها: «افزودن به هرکدام» با فیلد کانفیگ — بدون کلید در Git ──────────
--    رازها (secret) فقط در GitHub Secrets می‌مانند؛ اینجا یک نام اشاره‌گر است.
create table if not exists web_shop.backup_destinations (
  type     text not null check (type in ('github','supabase','s3','webhook','email')),
  label    text not null,
  enabled  boolean not null default true,
  config   jsonb not null default '{}'::jsonb,   -- مقدار غیرحساس (bucket, branch, path…)
  secret_ref text,                                -- نام secret در Actions، نه خود secret
  primary key (type)
);
insert into web_shop.backup_destinations(type,label,enabled,config,secret_ref) values
  ('github','ریپوی گیت‌هاب (golf-academy-backups)', true,
   '{"branch":"main","path":"backups","commitPrefix":"backup"}'::jsonb, 'GITHUB_TOKEN (built-in)'),
  ('supabase','فضای ابری سوپابیس', false, '{"bucket":"golf-backups","public":false}'::jsonb, null)
on conflict (type) do nothing;
alter table web_shop.backup_destinations enable row level security;
revoke all on web_shop.backup_destinations from public, anon, authenticated;
grant select, insert, update, delete on web_shop.backup_destinations to service_role;

-- ── ۵) تنظیمات پیش‌فرض را بنویس (مطابق DEFAULTS در engine.py) ────────────────
insert into web_shop.backup_settings(id, v)
values (1, $j${
  "version": 2,
  "enabled": true,
  "mode": "daily",
  "time": "04:00",
  "intervalHours": 6,
  "weekday": 6,
  "monthDay": 1,
  "structures": {"siteShop": true, "academy": true},
  "format": "json",
  "compress": true,
  "redact": {"authUsers": "ids-only", "dropTables": ["audit"]},
  "retention": {"daily": 30, "weekly": 13, "monthly": 12, "maxTotalMB": 2000, "pinOnRelease": true},
  "emails": {"notify": false, "onSuccess": true, "list": [], "digest": "weekly", "subjectPrefix": "[پات‌کلاب]"},
  "verify": {"afterWrite": true, "restoreDrill": "none", "graceMinutes": 90},
  "limits": {"maxTotalMB": 900, "timeoutSec": 900, "retries": 2}
}$j$::jsonb)
on conflict (id) do nothing;

-- ── ۶) RPCها: تنها راهِ خواندن/نوشتن تنظیمات (owner فقط) ─────────────────────
create or replace function web_shop.backup_get() returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, web_shop as $fn$
declare o jsonb; r jsonb; d jsonb; runs jsonb;
begin
  select v into o from web_shop.backup_settings where id = 1;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.added_at), '[]'::jsonb) into r
    from web_shop.backup_recipients x;
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into d from web_shop.backup_destinations x;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into runs
    from (select run_id, date_fa, trigger, result, files, total_bytes, took_sec, errors, warnings, verified, pinned,
                 to_char(started_at at time zone 'Asia/Tehran','YYYY-MM-DD HH24:MI') as started_fa
            from web_shop.backup_runs order by started_at desc limit 30) t;
  return jsonb_build_object('settings', o, 'recipients', r, 'destinations', d, 'runs', runs,
                            'state', (select to_jsonb(x) from web_shop.backup_runs x
                                       where x.result <> 'skipped' order by x.started_at desc limit 1));
end $fn$;

create or replace function web_shop.backup_put(p_actor uuid, p_settings jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog, web_shop as $fn$
begin
  -- عمداً web_shop.require() صدا نمی‌زنیم: مالک اصلی سایت ممکن است هیچ پروفایل ERP نداشته باشد
  -- و در نتیجه تنظیمات بکاپ قفل شود. کنترل دسترسی اینجا همان بررسی web_admin است
  -- (تابع هم فقط به service_role grant شده و web-erp قبل از آن web_admin را چک می‌کند).
  if p_actor is null or not exists (select 1 from auth.users u where u.id = p_actor
                                    and u.raw_app_meta_data->>'web_admin' = 'true') then
    raise exception 'فقط مدیر اصلی سایت می‌تواند تنظیمات بکاپ را تغییر دهد.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_settings) <> 'object' then
    raise exception 'تنظیمات باید یک آبجکت باشد.' using errcode = '22023';
  end if;
  -- گیت‌های سخت: هیچ مقدار نامعتبری وارد دیتابیس نشود (موتور هم clamp می‌کند، لایهٔ دوم)
  if p_settings ? 'time' and p_settings->>'time' !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'ساعت باید HH:MM باشد.' using errcode = '22023';
  end if;
  if p_settings ? 'mode' and p_settings->>'mode' not in ('daily','interval','weekly','monthly') then
    raise exception 'دورهٔ اجرا نامعتبر است.' using errcode = '22023';
  end if;
  if p_settings ? 'retention' and coalesce((p_settings->'retention'->>'daily')::int, 30) not between 0 and 3650 then
    raise exception 'نگهداشت روزانه باید بین ۰ تا ۳۶۵۰ روز باشد.' using errcode = '22023';
  end if;
  if p_settings ? 'emails' and jsonb_typeof(p_settings->'emails'->'list') = 'array'
     and exists (select 1 from jsonb_array_elements_text(p_settings->'emails'->'list') e
                  where e !~* '^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$') then
    raise exception 'یک یا چند ایمیل نامعتبر است.' using errcode = '22023';
  end if;
  if p_settings ? 'destinations' and exists (select 1 from jsonb_array_elements(p_settings->'destinations') d
                  where d->>'type' not in ('github','supabase','s3','webhook','email')) then
    raise exception 'نوع مقصد پشتیبانی نمی‌شود.' using errcode = '22023';
  end if;
  -- کلیدهای حساس اجازهٔ ماندن در تنظیمات را ندارند (secret همیشه در Actions)
  if p_settings::text ~* '"(secret|password|accesskey|private_key|token)"\s*:\s*"[^"<]{6,}"' then
    raise exception 'مقدار رازگونه در تنظیمات ممنوع است؛ آن را در Secrets گیت‌هاب بگذارید و اینجا فقط نامش را بنویسید.'
      using errcode = '42501';
  end if;
  update web_shop.backup_settings set v = p_settings, updated_at = now(), updated_by = p_actor where id = 1;
  return jsonb_build_object('ok', true, 'updated_at', now());
end $fn$;

-- ثبت نتیجهٔ اجرا از سمت موتور (service_role)
create or replace function web_shop.backup_log_run(p jsonb) returns void
language plpgsql security definer set search_path = pg_catalog, web_shop as $fn$
begin
  insert into web_shop.backup_runs (run_id, date_fa, trigger, result, structures, destinations,
                                    files, total_bytes, errors, warnings, manifest, verified, pinned)
  values (p->>'runId', p->>'date', p->>'trigger', p->>'result',
          array(select jsonb_array_elements_text(coalesce(p->'ran','[]'::jsonb))),
          array(select jsonb_array_elements_text(coalesce(p->'dest','[]'::jsonb))),
          coalesce((p->>'files')::int,0), coalesce((p->>'totalBytes')::bigint,0),
          coalesce(array(select jsonb_array_elements_text(p->'errors')),'{}'),
          coalesce(array(select jsonb_array_elements_text(p->'warnings')),'{}'),
          coalesce(p->'manifest','{}'::jsonb), (p->>'verified')::boolean,
          coalesce((p->>'pinned')::boolean,false))
  on conflict (run_id) do update set finished_at = now(), result = excluded.result,
       files = excluded.files, total_bytes = excluded.total_bytes, manifest = excluded.manifest,
       verified = excluded.verified, errors = excluded.errors, warnings = excluded.warnings;
end $fn$;

-- «پیون» کردن یک نسخه قبل از مایگریشن/تغییر بزرگ (از پنل)
create or replace function web_shop.backup_pin(p_actor uuid, p_run_id text, p_on boolean) returns void
language plpgsql security definer set search_path = pg_catalog, web_shop as $fn$
begin
  if not web_shop.manager(p_actor) then
    raise exception 'فقط مدیر می‌تواند نسخه‌ای را قفل کند.' using errcode = '42501';
  end if;
  update web_shop.backup_runs set pinned = p_on where run_id = p_run_id;
  if not found then raise exception 'اجرای % پیدا نشد.' , p_run_id using errcode = 'P0002'; end if;
end $fn$;

-- ── ۷) نمای public برای PostgREST (supabase-js و موتور فقط public را expose می‌بینند) ──────
-- بدون این پوسته‌ها، db.rpc('backup_get') در web-erp و /rest/v1/rpc/backup_get در موتور
-- کاری ندارند؛ با آن‌ها ترتیبِ اعمال (SQL قبل/بعد از دیپلوی) مهم نیست.
create or replace function public.backup_get() returns jsonb
language sql stable security definer set search_path = pg_catalog, web_shop as $$
  select web_shop.backup_get()
$$;

create or replace function public.backup_put(p_actor uuid, p_settings jsonb) returns jsonb
language sql volatile security definer set search_path = pg_catalog, web_shop as $$
  select web_shop.backup_put(p_actor, p_settings)
$$;

create or replace function public.backup_log_run(p jsonb) returns void
language sql volatile security definer set search_path = pg_catalog, web_shop as $$
  select web_shop.backup_log_run(p)
$$;

create or replace function public.backup_pin(p_actor uuid, p_run_id text, p_on boolean) returns void
language sql volatile security definer set search_path = pg_catalog, web_shop as $$
  select web_shop.backup_pin(p_actor, p_run_id, p_on)
$$;

revoke all on function public.backup_get()                     from public, anon, authenticated;
revoke all on function public.backup_put(uuid,jsonb)           from public, anon, authenticated;
revoke all on function public.backup_log_run(jsonb)            from public, anon, authenticated;
revoke all on function public.backup_pin(uuid,text,boolean)    from public, anon, authenticated;
grant execute on function public.backup_get()                  to service_role;
grant execute on function public.backup_put(uuid,jsonb)        to service_role;
grant execute on function public.backup_log_run(jsonb)         to service_role;
grant execute on function public.backup_pin(uuid,text,boolean) to service_role;

-- ── ۸) grantها: هیچ نقش عمومی نباید اینها را ببیند ──────────────────────────
revoke all on function web_shop.backup_get()                        from public, anon, authenticated;
revoke all on function web_shop.backup_put(uuid,jsonb)              from public, anon, authenticated;
revoke all on function web_shop.backup_log_run(jsonb)               from public, anon, authenticated;
revoke all on function web_shop.backup_pin(uuid,text,boolean)       from public, anon, authenticated;
grant execute on function web_shop.backup_get()                  to service_role;
grant execute on function web_shop.backup_put(uuid,jsonb)        to service_role;
grant execute on function web_shop.backup_log_run(jsonb)         to service_role;
grant execute on function web_shop.backup_pin(uuid,text,boolean) to service_role;

-- ── ۹) مهاجرت یک‌باره از web_store قدیمی (اگر سطرش وجود دارد) ────────────────
do $$
declare old jsonb;
begin
  select v into old from public.web_store where k = 'web_setting_backup';
  if old is not null then
    update web_shop.backup_settings set v = old where id = 1;   -- تنظیمات کاربر را از دست نده
    raise notice 'تنظیمات از web_setting_backup مهاجرت کرد — حالا می‌توانی کلید قدیمی را پاک کنی';
  end if;
exception when undefined_table then
  raise notice 'جدول web_store پیدا نشد — مهاجرت لازم نیست';
end $$;

-- پاک‌کردن کلیدهای قدیمی از جدول عمومی (بعد از تأیید پنل، دستی اجرا کن):
-- delete from public.web_store where k in ('web_setting_backup','web_setting_backup_state');

-- ── ۹) اگر اصرار داری تنظیمات در web_store بماند (راه‌حل کوتاه‌مدت) ──────────
--   Constraint فعلیِ repo این کلید را **رد می‌کند** (و همین نشان می‌دهد دیتابیس
--    زنده با فایل‌های repo همگام نیست — گزارش M6). برای همگام کردن:
-- alter table public.web_store drop constraint web_store_key_scope;
-- alter table public.web_store add constraint web_store_key_scope check (
--   k ~ '^web_(setting_(brand|theme|contact|menu|hero|about|courses_section|testimonials_section|footer|shop_gate|marquee|payment_gateways|pay_cards|season_podium|season_calendar|course_signup|shop_categories|backup|backup_state)|(product|category|course|testimonial|review)_[0-9]+)$');
-- ⚠ ولی این کار «خوانا بودن تنظیمات برای کل اینترنت» را نگه می‌دارد؛ مسیر درست همان بند ۱ است.

commit;

-- ═════════════════════════════════════════════════════════════════════════════
-- بررسی سریع بعد از اجرا (در همان SQL Editor):
--   select web_shop.backup_get()::text;          -- باید settings را برگرداند
--   select k from public.web_store where k like 'web_setting_backup%';   -- بعد از پاک‌سازی: 0 ردیف
-- ═════════════════════════════════════════════════════════════════════════════
