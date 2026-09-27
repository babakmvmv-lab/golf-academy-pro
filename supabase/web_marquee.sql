-- Add one public website setting; no academy/private financial schema or data is touched.
-- Idempotent: a repeated installation does not rewrite the constraint or seed any live value.
begin;
do $$begin
 if not exists(select 1 from pg_constraint c where c.conrelid='public.web_store'::regclass and c.conname='web_store_key_scope' and pg_get_constraintdef(c.oid) like '%marquee%') then
  alter table public.web_store drop constraint if exists web_store_key_scope;
  alter table public.web_store add constraint web_store_key_scope check (
   k ~ '^web_(setting_(brand|theme|contact|menu|hero|about|courses_section|testimonials_section|footer|shop_gate|marquee)|(product|category|course|testimonial|review)_[0-9]+)$'
  );
 end if;
end$$;
commit;
