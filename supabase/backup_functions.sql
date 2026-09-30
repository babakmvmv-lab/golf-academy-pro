-- توابع بکاپ (استفادهٔ خودکار توسط ریپوی خصوصی golf-academy-backups)
-- امنیت: فقط service_role اجازهٔ اجرا دارد؛ anon/authenticated صریحاً revoke شده‌اند.
create or replace function public.backup_site_shop() returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, web_shop, shop_private as $fn$
declare
  r record; t jsonb;
  out jsonb := jsonb_build_object('web_store', '[]'::jsonb, 'web_shop', '{}'::jsonb, 'shop_private', '{}'::jsonb);
begin
  execute 'select coalesce(jsonb_agg(to_jsonb(x) order by x.k), ''[]''::jsonb) from public.web_store x' into t;
  out := jsonb_set(out, '{web_store}', t);
  for r in select table_schema as sch, table_name as tbl from information_schema.tables
           where table_schema in ('web_shop','shop_private') and table_type='BASE TABLE'
           order by 1,2 loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from %I.%I x', r.sch, r.tbl) into t;
    out := jsonb_set(out, ('{'||r.sch||','||r.tbl||'}')::text[], t);
  end loop;
  return out;
end $fn$;

create or replace function public.backup_academy() returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $fn$
declare t jsonb;
begin
  execute 'select coalesce(jsonb_agg(to_jsonb(x) order by x.k), ''[]''::jsonb) from public.ga_store x' into t;
  return jsonb_build_object('ga_store', t);
end $fn$;

revoke execute on function public.backup_site_shop() from public, anon, authenticated;
revoke execute on function public.backup_academy() from public, anon, authenticated;
grant execute on function public.backup_site_shop() to service_role;
grant execute on function public.backup_academy() to service_role;
