-- Same Supabase project, independent website/shop public-content storage.
-- Deliberately does NOT read, copy, alter, or reference academy ga_store/sp_* data.
begin;
create table if not exists public.web_store (
  k text primary key,
  v jsonb not null,
  updated_at timestamptz not null default clock_timestamp(),
  constraint web_store_key_scope check (
    k ~ '^web_(setting_(brand|theme|contact|menu|hero|about|courses_section|testimonials_section|footer|shop_gate)|(product|category|course|testimonial|review)_[0-9]+)$'
  ),
  constraint web_store_json_shape check (jsonb_typeof(v) in ('object','array'))
);
alter table public.web_store enable row level security;
revoke all on public.web_store from anon, authenticated;
grant select on public.web_store to anon, authenticated;
grant all on public.web_store to service_role;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='web_store' and policyname='web_public_content_read') then
    create policy web_public_content_read on public.web_store for select to anon, authenticated using (true);
  end if;
end $$;
comment on table public.web_store is 'Website/shop PUBLIC content only. Independent of academy storage. Writes exclusively through authenticated web-sync; no credentials, customer orders, or private submissions.';
create index if not exists web_store_updated_at_idx on public.web_store(updated_at);
commit;
