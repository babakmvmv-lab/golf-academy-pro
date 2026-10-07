-- بازگشت اضطراری قفل ga_store به وضعیت قبل از 2026-10-07 (فقط در صورت قطع کامل پنل).
-- توجه: این کار دوباره خواندن عمومی و نوشتن مستقیم کاربران واردشده را باز می‌کند.
drop policy if exists ga_store_public_read on public.ga_store;
drop policy if exists ga_store_member_read on public.ga_store;
create policy ga_store_read on public.ga_store for select using (true);
create policy ga_store_share on public.ga_store for all to anon, authenticated using (true) with check (true);
grant select on public.ga_store to anon;
grant select, insert, update, delete on public.ga_store to authenticated;
