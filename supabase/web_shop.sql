-- Golf shop operations. Independent private schema in the existing Supabase project.
-- No academy tables, identities or functions are read/copied/changed.
begin;
create schema if not exists web_shop;
revoke all on schema web_shop from public, anon, authenticated;
grant usage on schema web_shop to service_role;

create table if not exists web_shop.staff (
 user_id uuid primary key references auth.users(id), name text not null,
 department text not null check(department in ('manager','sales','purchasing')),
 active boolean not null default true, permissions jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists web_shop.settings (
 id boolean primary key default true check(id), currency text not null default 'تومان',
 warehouse_name text not null default 'انبار اصلی', tax_enabled boolean not null default false,
 default_tax numeric(8,3) not null default 0 check(default_tax between 0 and 100),
 purchase_tax_recoverable boolean not null default false, closed_through date,
 initialized boolean not null default false
);
insert into web_shop.settings(id) values(true) on conflict do nothing;
create table if not exists web_shop.parties (
 id bigint generated always as identity primary key, name text not null check(length(trim(name))>=2),
 type text not null default 'person' check(type in ('person','company','store')),
 customer boolean not null default false, supplier boolean not null default false,
 phone text not null default '', address text not null default '', note text not null default '',
 active boolean not null default true, version integer not null default 1,
 created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(customer or supplier)
);
create sequence if not exists web_shop.product_id_seq start 1000000;
create table if not exists web_shop.products (
 id bigint primary key default nextval('web_shop.product_id_seq'), sku text not null unique,
 name text not null, category text not null, brand text not null default '', model text not null default '',
 attributes jsonb not null default '{}', unit text not null default 'عدد', barcode text,
 sale_price numeric(20,2) not null default 0 check(sale_price>=0), min_stock integer not null default 0 check(min_stock>=0),
 active boolean not null default true, version integer not null default 1,
 public_data jsonb not null default '{}', legacy_qty integer not null default 0,
 opening_required boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists web_shop_barcode_unique on web_shop.products(barcode) where barcode is not null and barcode<>'';
create table if not exists web_shop.inventory (
 product_id bigint primary key references web_shop.products(id), qty integer not null default 0 check(qty>=0),
 value numeric(24,2) not null default 0 check(value>=0), updated_at timestamptz not null default now(),
 check(qty>0 or value=0)
);
create table if not exists web_shop.accounts (
 code text primary key, name text not null, kind text not null check(kind in ('asset','liability','equity','revenue','expense'))
);
insert into web_shop.accounts(code,name,kind) values
 ('1000','صندوق','asset'),('1010','بانک','asset'),('1100','موجودی کالا','asset'),('1200','حساب دریافتنی مشتریان','asset'),
 ('1300','مالیات خرید قابل‌بازیافت','asset'),('2100','حساب پرداختنی تأمین‌کنندگان','liability'),('2200','مالیات فروش','liability'),
 ('3100','سرمایه و افتتاحیه','equity'),('4100','فروش خالص کالا','revenue'),('4200','اضافات انبار','revenue'),
 ('5100','بهای تمام‌شدهٔ فروش','expense'),('5101','اختلاف بهای برگشت خرید','expense'),('6100','هزینه‌های فروشگاه','expense'),('6200','کسری و ضایعات انبار','expense')
 on conflict do nothing;
create table if not exists web_shop.documents (
 id bigint generated always as identity primary key, client_id uuid not null unique,
 kind text not null check(kind in ('purchase','sale','purchase_return','sale_return','opening','adjustment')),
 request_hash text, state text not null default 'draft' check(state in ('draft','posted','void')),
 number text, doc_date date not null, due_date date, party_id bigint references web_shop.parties(id),
 original_id bigint references web_shop.documents(id), reference text not null default '', note text not null default '',
 freight numeric(20,2) not null default 0 check(freight>=0), net numeric(20,2) not null default 0,
 tax numeric(20,2) not null default 0, total numeric(20,2) not null default 0,
 paid_initial numeric(20,2) not null default 0 check(paid_initial>=0), pay_account text not null default '1000' references web_shop.accounts(code),
 tax_recoverable boolean not null default false, revision integer not null default 1, version integer not null default 1,
 created_by uuid not null, posted_by uuid, created_at timestamptz not null default now(), posted_at timestamptz
);
create unique index if not exists web_shop_doc_number_unique on web_shop.documents(number) where number is not null;
create table if not exists web_shop.lines (
 id bigint generated always as identity primary key, document_id bigint not null references web_shop.documents(id),
 product_id bigint not null references web_shop.products(id), product_snapshot jsonb not null default '{}', qty integer not null check(qty>0),
 unit_price numeric(20,2) not null check(unit_price>=0), discount numeric(20,2) not null default 0 check(discount>=0),
 tax_rate numeric(8,3) not null default 0 check(tax_rate between 0 and 100),
 net numeric(20,2) not null, tax numeric(20,2) not null, cost numeric(24,2) not null default 0,
 direction integer not null default 1 check(direction in (-1,1)), unique(document_id,product_id)
);
create table if not exists web_shop.stock_moves (
 id bigint generated always as identity primary key, document_id bigint not null references web_shop.documents(id),
 revision integer not null, product_id bigint not null references web_shop.products(id),
 qty integer not null, value numeric(24,2) not null, move_date date not null,
 reversal boolean not null default false, created_by uuid not null, created_at timestamptz not null default now()
);
create table if not exists web_shop.journals (
 id bigint generated always as identity primary key, doc_date date not null, source text not null,
 document_id bigint references web_shop.documents(id), revision integer, description text not null,
 reversal_of bigint references web_shop.journals(id), created_by uuid not null, created_at timestamptz not null default now()
);
create table if not exists web_shop.journal_lines (
 id bigint generated always as identity primary key, journal_id bigint not null references web_shop.journals(id),
 account text not null references web_shop.accounts(code), party_id bigint references web_shop.parties(id),
 debit numeric(24,2) not null default 0 check(debit>=0), credit numeric(24,2) not null default 0 check(credit>=0),
 check((debit>0 and credit=0) or (credit>0 and debit=0))
);
create table if not exists web_shop.payments (
 id bigint generated always as identity primary key, client_id uuid not null unique,
 kind text not null check(kind in ('receipt','payment','expense','capital','withdrawal','transfer','opening_receivable','opening_payable')),
 doc_date date not null, party_id bigint references web_shop.parties(id), document_id bigint references web_shop.documents(id),
 request_hash text, amount numeric(20,2) not null check(amount>0), account text not null default '1000' references web_shop.accounts(code),
 note text not null default '', reference text not null default '', automatic boolean not null default false,
 state text not null default 'posted' check(state in ('posted','void')), journal_id bigint references web_shop.journals(id),
 created_by uuid not null, created_at timestamptz not null default now()
);
alter table web_shop.lines add column if not exists product_snapshot jsonb not null default '{}';
alter table web_shop.documents add column if not exists tax_recoverable boolean not null default false;
alter table web_shop.documents add column if not exists request_hash text;
alter table web_shop.payments add column if not exists request_hash text;
alter table web_shop.payments drop constraint if exists payments_kind_check;
alter table web_shop.payments add constraint payments_kind_check check(kind in ('receipt','payment','expense','capital','withdrawal','transfer','opening_receivable','opening_payable'));
create table if not exists web_shop.audit (
 id bigint generated always as identity primary key, actor uuid, action text not null, entity text not null,
 entity_id text, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create table if not exists web_shop.counters (period text not null, kind text not null, n bigint not null, primary key(period,kind));
create index if not exists web_shop_moves_product_idx on web_shop.stock_moves(product_id,id);
create index if not exists web_shop_docs_date_idx on web_shop.documents(doc_date desc);
create index if not exists web_shop_gl_account_idx on web_shop.journal_lines(account,party_id);
create index if not exists web_shop_payments_doc_idx on web_shop.payments(document_id,state);

do $$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='web_shop' loop
  execute format('alter table web_shop.%I enable row level security',r.tablename);
  execute format('revoke all on web_shop.%I from public, anon, authenticated',r.tablename);
  execute format('grant all on web_shop.%I to service_role',r.tablename);
 end loop;
end $$;
grant usage,select on all sequences in schema web_shop to service_role;

create or replace function web_shop.manager(a uuid) returns boolean language sql stable security definer set search_path=pg_catalog,web_shop as $$
 select exists(select 1 from auth.users where id=a and raw_app_meta_data->>'web_admin'='true')
 or exists(select 1 from web_shop.staff where user_id=a and active and department='manager')
$$;
create or replace function web_shop.allowed(a uuid,cap text) returns boolean language sql stable security definer set search_path=pg_catalog,web_shop as $$
 select web_shop.manager(a) or exists(select 1 from web_shop.staff where user_id=a and active and permissions->>cap='true')
$$;
create or replace function web_shop.require(a uuid,cap text) returns void language plpgsql security definer set search_path=pg_catalog,web_shop as $$
begin if not web_shop.allowed(a,cap) then raise exception using errcode='42501',message='اجازهٔ این عملیات را ندارید؛ مدیر باید دسترسی را فعال کند.';end if;end $$;
create or replace function web_shop.cap(k text) returns text language sql immutable as $$
 select case when k in ('sale','sale_return') then 'sales' when k in ('purchase','purchase_return') then 'purchases' else 'inventory' end
$$;
create or replace function web_shop.today() returns date language sql stable as $$ select (now() at time zone 'Asia/Tehran')::date $$;
create or replace function web_shop.date_ok(d date) returns void language plpgsql security definer set search_path=pg_catalog,web_shop as $$
begin
 perform 1 from web_shop.settings where id for share;
 if d is null or d>web_shop.today() then raise exception 'تاریخ ثبت قطعی نمی‌تواند بعد از امروز باشد.';end if;
 if d<=(select closed_through from web_shop.settings where id) then raise exception 'این دورهٔ مالی بسته است؛ اصلاح باید در دورهٔ باز انجام شود.';end if;
end $$;
create or replace function web_shop.audit(a uuid,act text,ent text,eid text,b jsonb,n jsonb) returns void language sql security definer set search_path=pg_catalog,web_shop as $$
 insert into web_shop.audit(actor,action,entity,entity_id,before_data,after_data) values(a,act,ent,eid,b,n)
$$;
create or replace function web_shop.line(j bigint,acc text,dr numeric,cr numeric,p bigint default null) returns void language plpgsql security definer set search_path=pg_catalog,web_shop as $$
begin if round(dr,2)>0 or round(cr,2)>0 then insert into web_shop.journal_lines(journal_id,account,party_id,debit,credit) values(j,acc,p,round(dr,2),round(cr,2));end if;end $$;
create or replace function web_shop.balanced(j bigint) returns void language plpgsql security definer set search_path=pg_catalog,web_shop as $$
begin if coalesce((select sum(debit-credit) from web_shop.journal_lines where journal_id=j),0)<>0 then raise exception 'سند حسابداری متوازن نیست؛ هیچ‌کدام از تغییرات ثبت نشد.';end if;end $$;
create or replace function web_shop.publish_product(pid bigint) returns void language plpgsql security definer set search_path=pg_catalog,web_shop as $$
declare p web_shop.products;v jsonb;b web_shop.inventory;begin
 select * into p from web_shop.products where id=pid;select * into b from web_shop.inventory where product_id=pid;
 -- The public projection never contains cost, suppliers, customers, ledgers or staff.
 select coalesce(jsonb_object_agg(key,value),'{}') into v from jsonb_each(p.public_data) where key=any(array['id','slug','name','category','price','oldPrice','shortDesc','description','features','images','rating','reviewCount','stock','badge','isNew','isFeatured','createdAt']);
 v=v || jsonb_build_object('id',p.id,'name',p.name,'category',p.category,'price',p.sale_price,'stock',case when p.active and not p.opening_required then coalesce(b.qty,0) else 0 end);
 if not p.active then v=jsonb_build_object('id',p.id,'_deleted',true);end if;
 insert into public.web_store(k,v,updated_at) values('web_product_'||pid,v,clock_timestamp()) on conflict(k) do update set v=excluded.v,updated_at=excluded.updated_at;
end $$;
create or replace function web_shop.context(a uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,web_shop as $$
declare s web_shop.staff;u record;m boolean;begin
 select id,email,raw_user_meta_data into u from auth.users where id=a;
 if u.id is null then raise exception using errcode='42501',message='نشست معتبر نیست.';end if;
 m=web_shop.manager(a);select * into s from web_shop.staff where user_id=a and active;
 if not m and s.user_id is null then raise exception using errcode='42501',message='برای این حساب، دسترسی فعال فروشگاه تعریف نشده است.';end if;
 return jsonb_build_object('id',a,'name',coalesce(s.name,u.raw_user_meta_data->>'name',u.email),'email',u.email,'manager',m,'department',case when m then 'manager' else s.department end,'permissions',coalesce(s.permissions,'{}'::jsonb),'today',web_shop.today());
end $$;
create or replace function web_shop.product_json(a uuid,p web_shop.products) returns jsonb language sql stable security definer set search_path=pg_catalog,web_shop as $$
 select to_jsonb(p) || jsonb_build_object('stock',coalesce(i.qty,0)) ||
 case when web_shop.allowed(a,'cost.view') then jsonb_build_object('inventory_value',coalesce(i.value,0),'average_cost',case when i.qty>0 then round(i.value/i.qty,2) else 0 end) else '{}'::jsonb end
 from (select 1) x left join web_shop.inventory i on i.product_id=p.id
$$;
create or replace function web_shop.doc_json(a uuid,did bigint) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,web_shop as $$
declare d web_shop.documents;v jsonb;ls jsonb;paid numeric;returned numeric;refunds numeric;remaining numeric;original_paid numeric;begin
 select * into d from web_shop.documents where id=did;if not found then raise exception 'فاکتور پیدا نشد.';end if;
 perform web_shop.require(a,web_shop.cap(d.kind)||'.view');
 select coalesce(jsonb_agg((to_jsonb(l) || jsonb_build_object('name',coalesce(l.product_snapshot->>'name',p.name),'sku',coalesce(l.product_snapshot->>'sku',p.sku),'attributes',coalesce(l.product_snapshot->'attributes',p.attributes),'returned_qty',(select coalesce(sum(rl.qty),0) from web_shop.lines rl join web_shop.documents rd on rd.id=rl.document_id where rd.original_id=did and rd.state='posted' and rl.product_id=l.product_id))) - case when web_shop.allowed(a,'cost.view') then array[]::text[] else array['cost'] end order by l.id),'[]') into ls from web_shop.lines l join web_shop.products p on p.id=l.product_id where document_id=did;
 select coalesce(sum(amount),0) into paid from web_shop.payments where document_id=did and state='posted';
 select coalesce(sum(total),0) into returned from web_shop.documents where original_id=did and state='posted';
 select coalesce(sum(p.amount),0) into refunds from web_shop.payments p join web_shop.documents r on r.id=p.document_id where r.original_id=did and p.state='posted';
 remaining=greatest(0,d.total-paid-returned+refunds);
 if d.kind in ('sale_return','purchase_return') then
  select coalesce(sum(amount),0) into original_paid from web_shop.payments where document_id=d.original_id and state='posted';
  select coalesce(sum(p.amount),0) into refunds from web_shop.payments p join web_shop.documents r on r.id=p.document_id where r.original_id=d.original_id and p.state='posted';
  remaining=least(greatest(0,d.total-paid),greatest(0,original_paid-refunds));
 end if;
 v=to_jsonb(d)||jsonb_build_object('lines',ls,'party_name',(select name from web_shop.parties where id=d.party_id),'paid',paid,'paid_initial',(select coalesce(sum(amount),0) from web_shop.payments where document_id=did and automatic and state='posted'),'returned',returned,'remaining',remaining);
 return v;
end $$;

-- Finalization: inventory and double-entry accounting run in ONE database transaction.
create or replace function web_shop.post_document(a uuid,did bigint) returns jsonb language plpgsql security definer set search_path=pg_catalog,web_shop as $$
declare d web_shop.documents;l record;b web_shop.inventory;p web_shop.products;s web_shop.settings;orig web_shop.documents;
 q integer;val numeric;total_cost numeric:=0;j bigint;payj bigint;n bigint;yr text;prefix text;ret_qty integer;original_line web_shop.lines;freight_left numeric;freight_part numeric;line_count integer;ix integer:=0;prev_net numeric;prev_tax numeric;prev_cost numeric;pos_cost numeric;neg_cost numeric;original_paid numeric;old_refunds numeric;
begin
 select * into d from web_shop.documents where id=did for update;if not found then raise exception 'فاکتور پیدا نشد.';end if;
 perform web_shop.require(a,web_shop.cap(d.kind)||'.create');
 if d.kind in ('sale_return','purchase_return') then perform web_shop.require(a,web_shop.cap(d.kind)||'.return');end if;
 if d.state='posted' then return web_shop.doc_json(a,did);end if;
 if d.state<>'draft' then raise exception 'سند باطل‌شده قابل ثبت دوباره نیست.';end if;
 perform web_shop.date_ok(d.doc_date);select * into s from web_shop.settings where id;
 if d.kind='purchase' then if d.revision>1 then s.purchase_tax_recoverable=d.tax_recoverable;end if;update web_shop.documents set tax_recoverable=s.purchase_tax_recoverable where id=did;end if;
 if d.kind='opening' and not web_shop.manager(a) then raise exception using errcode='42501',message='تأیید موجودی افتتاحیه فقط با مدیر است.';end if;
 if d.kind in ('sale_return','purchase_return') then
  select * into orig from web_shop.documents where id=d.original_id for update;
  if orig.state<>'posted' or orig.kind<>(case when d.kind='sale_return' then 'sale' else 'purchase' end) then raise exception 'برگشت باید به فاکتور اصلیِ قطعی مرتبط باشد.';end if;
  if d.kind='purchase_return' then s.purchase_tax_recoverable=orig.tax_recoverable;update web_shop.documents set tax_recoverable=orig.tax_recoverable where id=did;end if;
  if d.party_id is distinct from orig.party_id then raise exception 'طرف حساب برگشت باید با فاکتور اصلی یکسان باشد.';end if;
 end if;
 select count(*) into line_count from web_shop.lines where document_id=did;if line_count=0 then raise exception 'حداقل یک کالا لازم است.';end if;
 if d.kind in ('opening','adjustment') and (d.freight<>0 or d.paid_initial<>0) then raise exception 'سند موجودی هزینهٔ حمل یا تسویه ندارد.';end if;
 if d.party_id is not null and not exists(select 1 from web_shop.parties where id=d.party_id and active and (case when d.kind in ('purchase','purchase_return') then supplier else customer end)) then raise exception 'نوع طرف حساب با این سند سازگار نیست.';end if;
 if d.paid_initial>d.total then raise exception 'پرداخت اولیه بیشتر از مبلغ فاکتور است.';end if;
 if d.pay_account not in ('1000','1010') then raise exception 'حساب دریافت/پرداخت معتبر نیست.';end if;
 if d.party_id is null and (d.kind in ('purchase','purchase_return') or d.kind='sale' and d.paid_initial<d.total) then raise exception 'خرید و فروش نسیه باید طرف حساب مشخص داشته باشد.';end if;
 if d.kind='purchase' and d.reference<>'' and exists(select 1 from web_shop.documents x where x.id<>d.id and x.kind='purchase' and x.state='posted' and x.party_id=d.party_id and x.reference=d.reference) then raise exception 'شمارهٔ فاکتور این تأمین‌کننده قبلاً ثبت شده است.';end if;
 freight_left=d.freight;
 -- Stable lock ordering prevents competing sales of the same final item.
 for l in select * from web_shop.lines where document_id=did order by product_id loop
  ix=ix+1;select * into p from web_shop.products where id=l.product_id for update;
  if not p.active then raise exception 'کالای غیرفعال در سند وجود دارد.';end if;
  if p.opening_required and d.kind<>'opening' then raise exception 'ابتدا مقدار و بهای افتتاحیهٔ کالای % را تأیید کنید.',p.sku;end if;
  insert into web_shop.inventory(product_id) values(p.id) on conflict do nothing;select * into b from web_shop.inventory where product_id=p.id for update;
  if exists(select 1 from web_shop.stock_moves m where m.product_id=p.id and m.move_date>d.doc_date) then raise exception 'ثبت عقب‌تر از گردش موجودی فعلی مجاز نیست؛ سند اصلاحی را در تاریخ باز ثبت کنید.';end if;
  q=0;val=0;
  if d.kind='purchase' then
   freight_part=case when ix=line_count then freight_left else round(case when d.net>0 then d.freight*l.net/d.net else d.freight/line_count end,2) end;
   freight_left=freight_left-freight_part;q=l.qty;val=l.net+freight_part+case when s.purchase_tax_recoverable then 0 else l.tax end;
  elsif d.kind='opening' then
   if exists(select 1 from web_shop.stock_moves where product_id=p.id) then raise exception 'افتتاحیهٔ این کالا قبلاً تعیین شده؛ از سند اصلاح موجودی استفاده کنید.';end if;
   q=l.qty;val=l.net;update web_shop.products set opening_required=false where id=p.id;
  elsif d.kind='sale' then
   if b.qty<l.qty then raise exception 'موجودی کالای % کافی نیست؛ هیچ بخشی از فروش ثبت نشد.',p.sku;end if;
   q=-l.qty;val=-case when b.qty=l.qty then b.value else round(b.value*l.qty/b.qty,2) end;
  elsif d.kind in ('sale_return','purchase_return') then
   select * into original_line from web_shop.lines where document_id=d.original_id and product_id=p.id;
   if not found then raise exception 'این کالا در فاکتور اصلی نیست.';end if;
   select coalesce(sum(rl.qty),0) into ret_qty from web_shop.lines rl join web_shop.documents rd on rd.id=rl.document_id where rd.original_id=d.original_id and rd.state='posted' and rd.kind=d.kind and rl.product_id=p.id;
   if ret_qty+l.qty>original_line.qty then raise exception 'تعداد برگشت از تعداد قابل برگشت فاکتور اصلی بیشتر است.';end if;
   select coalesce(sum(rl.net),0),coalesce(sum(rl.tax),0),coalesce(sum(rl.cost),0) into prev_net,prev_tax,prev_cost from web_shop.lines rl join web_shop.documents rd on rd.id=rl.document_id where rd.original_id=d.original_id and rd.state='posted' and rl.product_id=p.id;
   l.net=case when ret_qty+l.qty=original_line.qty then original_line.net-prev_net else round(original_line.net*l.qty/original_line.qty,2) end;
   l.tax=case when ret_qty+l.qty=original_line.qty then original_line.tax-prev_tax else round(original_line.tax*l.qty/original_line.qty,2) end;
   update web_shop.lines set unit_price=original_line.unit_price,discount=l.qty*original_line.unit_price-l.net,tax_rate=original_line.tax_rate,net=l.net,tax=l.tax where id=l.id;
   if d.kind='sale_return' then q=l.qty;val=case when ret_qty+l.qty=original_line.qty then original_line.cost-prev_cost else round(original_line.cost*l.qty/original_line.qty,2) end;
   else
    if b.qty<l.qty then raise exception 'موجودی برای برگشت به تأمین‌کننده کافی نیست.';end if;
    q=-l.qty;val=-case when b.qty=l.qty then b.value else round(b.value*l.qty/b.qty,2) end;
   end if;
  else
   q=l.qty*l.direction;
   if q<0 then
    if b.qty<l.qty then raise exception 'اصلاح موجودی، تعداد منفی ایجاد می‌کند.';end if;
    val=-case when b.qty=l.qty then b.value else round(b.value*l.qty/b.qty,2) end;
   else val=l.net;end if;
  end if;
  update web_shop.inventory set qty=qty+q,value=value+val,updated_at=now() where product_id=p.id;
  insert into web_shop.stock_moves(document_id,revision,product_id,qty,value,move_date,created_by) values(did,d.revision,p.id,q,val,d.doc_date,a);
  update web_shop.lines set cost=abs(val) where id=l.id;total_cost=total_cost+abs(val);
  perform web_shop.publish_product(p.id);
 end loop;
 if d.kind in ('sale_return','purchase_return') then
  if d.freight>orig.freight-coalesce((select sum(freight) from web_shop.documents where original_id=orig.id and state='posted'),0) then raise exception 'هزینهٔ حمل برگشتی بیش از ماندهٔ فاکتور اصلی است.';end if;
  select sum(net),sum(tax) into d.net,d.tax from web_shop.lines where document_id=did;d.total=d.net+d.tax+d.freight;
  update web_shop.documents set net=d.net,tax=d.tax,total=d.total where id=did;
  select coalesce(sum(amount),0) into original_paid from web_shop.payments where document_id=orig.id and state='posted';
  select coalesce(sum(pmt.amount),0) into old_refunds from web_shop.payments pmt join web_shop.documents r on r.id=pmt.document_id where r.original_id=orig.id and pmt.state='posted';
  if d.paid_initial>least(d.total,greatest(0,original_paid-old_refunds)) then raise exception 'استرداد نقدی بیشتر از وجه تسویه‌شدهٔ فاکتور اصلی است؛ برگشت ابتدا ماندهٔ حساب را اصلاح می‌کند.';end if;
 end if;
 yr=extract(year from d.doc_date)::text;prefix=case d.kind when 'purchase' then 'P' when 'sale' then 'S' when 'purchase_return' then 'PR' when 'sale_return' then 'SR' when 'opening' then 'O' else 'A' end;
 if d.number is null then
  insert into web_shop.counters(period,kind,n) values(yr,d.kind,1) on conflict(period,kind) do update set n=web_shop.counters.n+1 returning web_shop.counters.n into n;
  d.number=prefix||'-'||yr||'-'||lpad(n::text,5,'0');
 end if;
 insert into web_shop.journals(doc_date,source,document_id,revision,description,created_by) values(d.doc_date,d.kind,did,d.revision,d.number,a) returning id into j;
 if d.kind='purchase' then
  perform web_shop.line(j,'1100',total_cost,0);if s.purchase_tax_recoverable then perform web_shop.line(j,'1300',d.tax,0);end if;perform web_shop.line(j,'2100',0,d.total,d.party_id);
 elsif d.kind='sale' then
  perform web_shop.line(j,'1200',d.total,0,d.party_id);perform web_shop.line(j,'4100',0,d.net+d.freight);perform web_shop.line(j,'2200',0,d.tax);
  perform web_shop.line(j,'5100',total_cost,0);perform web_shop.line(j,'1100',0,total_cost);
 elsif d.kind='sale_return' then
  perform web_shop.line(j,'4100',d.net+d.freight,0);perform web_shop.line(j,'2200',d.tax,0);perform web_shop.line(j,'1200',0,d.total,d.party_id);
  perform web_shop.line(j,'1100',total_cost,0);perform web_shop.line(j,'5100',0,total_cost);
 elsif d.kind='purchase_return' then
  perform web_shop.line(j,'2100',d.total,0,d.party_id);perform web_shop.line(j,'1100',0,total_cost);
  if s.purchase_tax_recoverable then perform web_shop.line(j,'1300',0,d.tax);end if;
  val=d.total-total_cost-case when s.purchase_tax_recoverable then d.tax else 0 end;
  if val>0 then perform web_shop.line(j,'5101',0,val);elsif val<0 then perform web_shop.line(j,'5101',-val,0);end if;
 elsif d.kind='opening' then perform web_shop.line(j,'1100',total_cost,0);perform web_shop.line(j,'3100',0,total_cost);
 else
  select coalesce(sum(value) filter(where value>0),0),coalesce(-sum(value) filter(where value<0),0) into pos_cost,neg_cost from web_shop.stock_moves where document_id=did and revision=d.revision and not reversal;
  perform web_shop.line(j,'1100',pos_cost,0);perform web_shop.line(j,'4200',0,pos_cost);
  perform web_shop.line(j,'6200',neg_cost,0);perform web_shop.line(j,'1100',0,neg_cost);
 end if;
 perform web_shop.balanced(j);
 if d.paid_initial>0 and d.kind in ('purchase','sale','purchase_return','sale_return') then
  insert into web_shop.journals(doc_date,source,document_id,revision,description,created_by) values(d.doc_date,'settlement',did,d.revision,'تسویهٔ اولیه '||d.number,a) returning id into payj;
  if d.kind in ('sale','purchase_return') then
   perform web_shop.line(payj,d.pay_account,d.paid_initial,0);perform web_shop.line(payj,case when d.kind='sale' then '1200' else '2100' end,0,d.paid_initial,d.party_id);
  else
   perform web_shop.line(payj,case when d.kind='purchase' then '2100' else '1200' end,d.paid_initial,0,d.party_id);perform web_shop.line(payj,d.pay_account,0,d.paid_initial);
  end if;
  insert into web_shop.payments(client_id,kind,doc_date,party_id,document_id,amount,account,note,automatic,journal_id,created_by)
   values(gen_random_uuid(),case when d.kind in ('sale','purchase_return') then 'receipt' else 'payment' end,d.doc_date,d.party_id,did,d.paid_initial,d.pay_account,'تسویهٔ اولیه',true,payj,a);
  perform web_shop.balanced(payj);
 end if;
 update web_shop.documents set state='posted',number=d.number,posted_at=now(),posted_by=a,version=version+1 where id=did;
 perform web_shop.audit(a,'post','document',did::text,null,jsonb_build_object('kind',d.kind,'number',d.number,'total',d.total));
 return web_shop.doc_json(a,did);
end $$;

-- Reverse only when no later stock/payment/return depends on this invoice.
create or replace function web_shop.reverse_document(a uuid,did bigint,reason text) returns void language plpgsql security definer set search_path=pg_catalog,web_shop as $$
declare d web_shop.documents;m record;j record;newj bigint;begin
 select * into d from web_shop.documents where id=did for update;
 perform web_shop.require(a,web_shop.cap(d.kind)||'.edit');perform web_shop.require(a,'posted.correct');perform web_shop.date_ok(d.doc_date);
 if length(trim(coalesce(reason,'')))<5 then raise exception 'علت اصلاح یا ابطال سند قطعی را بنویسید.';end if;
 if d.state<>'posted' then raise exception 'سند قطعی نیست.';end if;
 if exists(select 1 from web_shop.payments where document_id=did and state='posted' and not automatic) or exists(select 1 from web_shop.documents where original_id=did and state='posted') then raise exception 'سند پرداخت/برگشت وابسته وجود دارد؛ ویرایش مستقیم مالی مجاز نیست.';end if;
 -- Lock all affected items before checking for dependent movements.
 perform 1 from web_shop.products where id in(select product_id from web_shop.lines where document_id=did) order by id for update;
 if exists(select 1 from web_shop.stock_moves later join web_shop.stock_moves ownm on later.product_id=ownm.product_id and later.id>ownm.id where ownm.document_id=did and ownm.revision=d.revision and not ownm.reversal and later.document_id<>did) then raise exception 'کالای این سند گردش بعدی دارد؛ از برگشت مستند یا اصلاح مالی مجاز استفاده کنید.';end if;
 for m in select * from web_shop.stock_moves where document_id=did and revision=d.revision and not reversal order by product_id loop
  update web_shop.inventory set qty=qty-m.qty,value=value-m.value,updated_at=now() where product_id=m.product_id;
  insert into web_shop.stock_moves(document_id,revision,product_id,qty,value,move_date,reversal,created_by) values(did,d.revision,m.product_id,-m.qty,-m.value,d.doc_date,true,a);
  perform web_shop.publish_product(m.product_id);
 end loop;
 for j in select * from web_shop.journals where document_id=did and revision=d.revision and reversal_of is null and not exists(select 1 from web_shop.journals r where r.reversal_of=web_shop.journals.id) loop
  insert into web_shop.journals(doc_date,source,document_id,revision,description,reversal_of,created_by) values(d.doc_date,'reversal',did,d.revision,reason,j.id,a) returning id into newj;
  insert into web_shop.journal_lines(journal_id,account,party_id,debit,credit) select newj,account,party_id,credit,debit from web_shop.journal_lines where journal_id=j.id;
  perform web_shop.balanced(newj);
 end loop;
 update web_shop.payments set state='void' where document_id=did and automatic and state='posted';
 perform web_shop.audit(a,'reverse','document',did::text,web_shop.doc_json(a,did),jsonb_build_object('reason',reason));
end $$;

create or replace function web_shop.save_document(a uuid,p jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,web_shop as $$
declare d web_shop.documents;did bigint;kind text;ln jsonb;pid bigint;qty integer;price numeric;disc numeric;rate numeric;net numeric;tax numeric;s web_shop.settings;old jsonb;was_posted boolean:=false;begin
 kind=p->>'kind';if kind not in ('purchase','sale','purchase_return','sale_return','opening','adjustment') then raise exception 'نوع سند معتبر نیست.';end if;
 perform web_shop.require(a,web_shop.cap(kind)||'.create');
 if kind in ('sale_return','purchase_return') then perform web_shop.require(a,web_shop.cap(kind)||'.return');end if;
 if jsonb_typeof(p->'lines')<>'array' or jsonb_array_length(p->'lines')=0 then raise exception 'حداقل یک ردیف کالا لازم است.';end if;
 if p->>'id' is not null then
  select * into d from web_shop.documents where id=(p->>'id')::bigint for update;if not found then raise exception 'سند پیدا نشد.';end if;
  if d.kind<>kind then raise exception 'نوع سند موجود تغییر نمی‌کند.';end if;
  perform web_shop.require(a,web_shop.cap(kind)||'.edit');if d.version is distinct from (p->>'version')::integer then raise exception using errcode='40001',message='نسخهٔ سند تغییر کرده؛ دوباره باز کنید.';end if;
  old=web_shop.doc_json(a,d.id);was_posted=d.state='posted';if d.state='void' then raise exception 'سند باطل‌شده قابل ویرایش نیست.';end if;
  if was_posted then perform web_shop.reverse_document(a,d.id,p->>'reason');end if;
  did=d.id;delete from web_shop.lines where document_id=did;
 else
  select id into did from web_shop.documents where client_id=(p->>'client_id')::uuid;
  if did is not null then if (select request_hash from web_shop.documents where id=did) is distinct from md5(p::text) then raise exception using errcode='40001',message='این درخواست قبلاً با اطلاعات دیگری ثبت شده؛ سند موجود را باز کنید.';end if;return web_shop.doc_json(a,did);end if;
  insert into web_shop.documents(client_id,kind,doc_date,created_by,request_hash) values((p->>'client_id')::uuid,kind,coalesce((p->>'date')::date,web_shop.today()),a,md5(p::text)) returning id into did;
 end if;
 select * into s from web_shop.settings where id;
 update web_shop.documents set state='draft',doc_date=coalesce((p->>'date')::date,web_shop.today()),due_date=nullif(p->>'due_date','')::date,
 party_id=nullif(p->>'party_id','')::bigint,original_id=nullif(p->>'original_id','')::bigint,reference=coalesce(p->>'reference',''),note=coalesce(p->>'note',''),
 freight=coalesce((p->>'freight')::numeric,0),paid_initial=coalesce((p->>'paid')::numeric,0),pay_account=coalesce(p->>'pay_account','1000'),
 revision=revision+case when was_posted then 1 else 0 end,version=version+1 where id=did;
 for ln in select value from jsonb_array_elements(p->'lines') loop
  pid=(ln->>'product_id')::bigint;qty=(ln->>'qty')::integer;price=(ln->>'price')::numeric;disc=coalesce((ln->>'discount')::numeric,0);rate=coalesce((ln->>'tax_rate')::numeric,0);
  if kind='sale' and not web_shop.allowed(a,'sales.price') and (price is distinct from (select sale_price from web_shop.products where id=pid) or disc<>0) then raise exception using errcode='42501',message='تغییر قیمت یا تخفیف فروش به اجازهٔ مدیر نیاز دارد.';end if;
  if qty<=0 or price<0 or disc<0 or disc>qty*price or rate<0 or rate>100 then raise exception 'تعداد، قیمت یا تخفیف ردیف معتبر نیست.';end if;
  if rate>0 and not s.tax_enabled and kind not in ('sale_return','purchase_return') then raise exception 'مالیات هنوز در تنظیمات مدیر فعال نشده است.';end if;
  if kind in ('opening','adjustment') and (rate<>0 or disc<>0) then raise exception 'سند موجودی مالیات یا تخفیف ندارد.';end if;
  net=round(qty*price-disc,2);tax=round(net*rate/100,2);
  insert into web_shop.lines(document_id,product_id,product_snapshot,qty,unit_price,discount,tax_rate,net,tax,direction) values(did,pid,(select jsonb_build_object('name',pr.name,'sku',pr.sku,'attributes',pr.attributes,'category',pr.category,'unit',pr.unit) from web_shop.products pr where pr.id=pid),qty,price,disc,rate,net,tax,case when kind='adjustment' and ln->>'direction'='-1' then -1 else 1 end);
 end loop;
 update web_shop.documents set net=(select sum(l.net) from web_shop.lines l where document_id=did),tax=(select sum(l.tax) from web_shop.lines l where document_id=did) where id=did;
 update web_shop.documents x set total=x.net+x.tax+x.freight where x.id=did;
 perform web_shop.audit(a,case when old is null then 'create' else 'edit' end,'document',did::text,old,web_shop.doc_json(a,did));
 if coalesce((p->>'post')::boolean,false) or was_posted then return web_shop.post_document(a,did);end if;
 return web_shop.doc_json(a,did);
end $$;

create or replace function web_shop.make_payment(a uuid,p jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,web_shop as $$
declare v_id bigint;j bigint;kind text:=p->>'kind';amt numeric:=(p->>'amount')::numeric;dt date:=coalesce((p->>'date')::date,web_shop.today());acc text:=coalesce(p->>'account','1000');d web_shop.documents;party bigint;remaining numeric;begin
 perform web_shop.require(a,'finance.create');perform web_shop.date_ok(dt);
 select web_shop.payments.id into v_id from web_shop.payments where client_id=(p->>'client_id')::uuid;if v_id is not null then if (select request_hash from web_shop.payments where web_shop.payments.id=v_id) is distinct from md5(p::text) then raise exception using errcode='40001',message='این درخواست پرداخت قبلاً با اطلاعات دیگری ثبت شده است.';end if;return jsonb_build_object('id',v_id);end if;
 if amt<=0 or acc not in ('1000','1010') or kind not in ('receipt','payment','expense','capital','withdrawal','transfer','opening_receivable','opening_payable') then raise exception 'اطلاعات دریافت/پرداخت معتبر نیست.';end if;
 if kind in ('receipt','payment') then
  select * into d from web_shop.documents where web_shop.documents.id=(p->>'document_id')::bigint for update;
  if d.state<>'posted' then raise exception 'دریافت/پرداخت باید به فاکتور قطعی مرتبط شود.';end if;
  perform web_shop.require(a,web_shop.cap(d.kind)||'.view');
  if (kind='receipt') is distinct from (d.kind in ('sale','purchase_return')) then raise exception 'جهت دریافت/پرداخت با فاکتور سازگار نیست.';end if;
  if d.original_id is not null then perform 1 from web_shop.documents where web_shop.documents.id=d.original_id for update;end if;
  remaining=(web_shop.doc_json(a,d.id)->>'remaining')::numeric;
  if amt>remaining then raise exception 'مبلغ از ماندهٔ فاکتور بیشتر است.';end if;party=d.party_id;
 elsif not web_shop.manager(a) then raise exception using errcode='42501',message='هزینه، افتتاحیه و انتقال وجه فقط با مدیر ثبت می‌شود.';
 end if;
 if kind in ('opening_receivable','opening_payable') then
  party=nullif(p->>'party_id','')::bigint;
  if not exists(select 1 from web_shop.parties where id=party and active and (case when kind='opening_receivable' then customer else supplier end)) then raise exception 'طرف حساب مناسب برای ماندهٔ افتتاحیه انتخاب کنید.';end if;
  if exists(select 1 from web_shop.payments x where x.kind=p->>'kind' and x.party_id=party and x.state='posted') then raise exception 'ماندهٔ افتتاحیهٔ این حساب قبلاً ثبت شده؛ ابتدا سند قبلی را بررسی کنید.';end if;
 end if;
 insert into web_shop.journals(doc_date,source,document_id,description,created_by) values(dt,kind,d.id,coalesce(p->>'note','دریافت/پرداخت'),a) returning web_shop.journals.id into j;
 if kind='receipt' then perform web_shop.line(j,acc,amt,0);perform web_shop.line(j,case when d.kind='sale' then '1200' else '2100' end,0,amt,party);
 elsif kind='payment' then perform web_shop.line(j,case when d.kind='purchase' then '2100' else '1200' end,amt,0,party);perform web_shop.line(j,acc,0,amt);
 elsif kind='expense' then perform web_shop.line(j,'6100',amt,0);perform web_shop.line(j,acc,0,amt);
 elsif kind='transfer' then perform web_shop.line(j,case when acc='1000' then '1010' else '1000' end,amt,0);perform web_shop.line(j,acc,0,amt);
 elsif kind='opening_receivable' then perform web_shop.line(j,'1200',amt,0,party);perform web_shop.line(j,'3100',0,amt);
 elsif kind='opening_payable' then perform web_shop.line(j,'3100',amt,0);perform web_shop.line(j,'2100',0,amt,party);
 elsif kind='capital' then perform web_shop.line(j,acc,amt,0);perform web_shop.line(j,'3100',0,amt);
 else perform web_shop.line(j,'3100',amt,0);perform web_shop.line(j,acc,0,amt);end if;
 perform web_shop.balanced(j);
 insert into web_shop.payments(client_id,kind,doc_date,party_id,document_id,amount,account,note,reference,journal_id,created_by,request_hash) values((p->>'client_id')::uuid,kind,dt,party,d.id,amt,acc,coalesce(p->>'note',''),coalesce(p->>'reference',''),j,a,md5(p::text)) returning web_shop.payments.id into v_id;
 perform web_shop.audit(a,'post','payment',v_id::text,null,jsonb_build_object('kind',kind,'amount',amt,'document_id',d.id));return jsonb_build_object('id',v_id);
end $$;

create or replace function public.web_shop_api(p_actor uuid,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog,web_shop as $$
declare ctx jsonb;v_settings web_shop.settings;v_product web_shop.products;v_party web_shop.parties;v_doc web_shop.documents;v_id bigint;v jsonb;result jsonb;old jsonb;cap text;uid uuid;from_d date;to_d date;begin
 ctx=web_shop.context(p_actor);
 if p_action='bootstrap' then
  select * into v_settings from web_shop.settings where web_shop.settings.id;
  select coalesce(jsonb_agg(web_shop.product_json(p_actor,p) order by p.name),'[]') into v from web_shop.products p where web_shop.allowed(p_actor,'catalog.view') or web_shop.allowed(p_actor,'inventory.view') or web_shop.allowed(p_actor,'sales.view') or web_shop.allowed(p_actor,'purchases.view');
  return jsonb_build_object('user',ctx,'settings',to_jsonb(v_settings),'products',v,'parties',coalesce((select jsonb_agg(to_jsonb(x) || case when web_shop.allowed(p_actor,'sales.view') then jsonb_build_object('receivable',coalesce((select sum(debit-credit) from web_shop.journal_lines where party_id=x.id and account='1200'),0)) else '{}'::jsonb end || case when web_shop.allowed(p_actor,'purchases.view') then jsonb_build_object('payable',coalesce((select sum(credit-debit) from web_shop.journal_lines where party_id=x.id and account='2100'),0)) else '{}'::jsonb end order by x.name) from web_shop.parties x where (x.customer and web_shop.allowed(p_actor,'sales.view')) or (x.supplier and web_shop.allowed(p_actor,'purchases.view'))),'[]'::jsonb),'accounts',(select jsonb_agg(to_jsonb(x) order by code) from web_shop.accounts x));
 elsif p_action='party_save' then
  cap=case when coalesce((p_payload->>'supplier')::boolean,false) then 'purchases' else 'sales' end;perform web_shop.require(p_actor,cap||'.create');
  if coalesce((p_payload->>'supplier')::boolean,false) and coalesce((p_payload->>'customer')::boolean,false) then perform web_shop.require(p_actor,'sales.create');perform web_shop.require(p_actor,'purchases.create');end if;
  if p_payload->>'id' is not null then
   perform web_shop.require(p_actor,cap||'.edit');select * into v_party from web_shop.parties where web_shop.parties.id=(p_payload->>'id')::bigint for update;old=to_jsonb(v_party);
   if v_party.supplier then perform web_shop.require(p_actor,'purchases.edit');end if;if v_party.customer then perform web_shop.require(p_actor,'sales.edit');end if;
   if v_party.version is distinct from (p_payload->>'version')::integer then raise exception using errcode='40001',message='اطلاعات شخص تغییر کرده؛ دوباره باز کنید.';end if;v_id=v_party.id;
   update web_shop.parties set name=trim(p_payload->>'name'),type=coalesce(p_payload->>'type','person'),customer=coalesce((p_payload->>'customer')::boolean,false),supplier=coalesce((p_payload->>'supplier')::boolean,false),phone=coalesce(p_payload->>'phone',''),address=coalesce(p_payload->>'address',''),note=coalesce(p_payload->>'note',''),version=version+1,updated_at=now() where web_shop.parties.id=v_id;
  else insert into web_shop.parties(name,type,customer,supplier,phone,address,note,created_by) values(trim(p_payload->>'name'),coalesce(p_payload->>'type','person'),coalesce((p_payload->>'customer')::boolean,false),coalesce((p_payload->>'supplier')::boolean,false),coalesce(p_payload->>'phone',''),coalesce(p_payload->>'address',''),coalesce(p_payload->>'note',''),p_actor) returning web_shop.parties.id into v_id;end if;
  select to_jsonb(x) into v from web_shop.parties x where x.id=v_id;perform web_shop.audit(p_actor,'save','party',v_id::text,old,v);return v;
 elsif p_action='product_save' then
  perform web_shop.require(p_actor,case when p_payload->>'id' is null then 'catalog.create' else 'catalog.edit' end);
  if length(trim(coalesce(p_payload->>'name','')))<2 or length(trim(coalesce(p_payload->>'category','')))<2 then raise exception 'نام و دستهٔ کالا را کامل وارد کنید.';end if;
  if p_payload->>'id' is not null then select * into v_product from web_shop.products where web_shop.products.id=(p_payload->>'id')::bigint for update;old=to_jsonb(v_product);if v_product.version is distinct from (p_payload->>'version')::integer then raise exception using errcode='40001',message='کالا تغییر کرده؛ دوباره باز کنید.';end if;v_id=v_product.id;
  else v_id=nextval('web_shop.product_id_seq');insert into web_shop.products(id,sku,name,category) values(v_id,coalesce(nullif(p_payload->>'sku',''),'GOLF-'||v_id),trim(p_payload->>'name'),trim(p_payload->>'category'));end if;
  update web_shop.products set sku=coalesce(nullif(p_payload->>'sku',''),sku),name=trim(p_payload->>'name'),category=trim(p_payload->>'category'),brand=coalesce(p_payload->>'brand',''),model=coalesce(p_payload->>'model',''),attributes=coalesce((select jsonb_object_agg(key,value) from jsonb_each(coalesce(p_payload->'attributes','{}')) where key=any(array['hand','loft','flex','length','size','color'])),'{}'),unit=coalesce(p_payload->>'unit','عدد'),barcode=nullif(p_payload->>'barcode',''),sale_price=coalesce((p_payload->>'sale_price')::numeric,0),min_stock=coalesce((p_payload->>'min_stock')::integer,0),active=coalesce((p_payload->>'active')::boolean,true),version=version+1,updated_at=now(),
   public_data=coalesce(public_data,'{}')||jsonb_build_object('id',v_id,'slug',coalesce(nullif(p_payload->>'slug',''),public_data->>'slug','golf-'||v_id),'name',trim(p_payload->>'name'),'category',trim(p_payload->>'category'),'price',coalesce((p_payload->>'sale_price')::numeric,0),'oldPrice',null,'shortDesc',coalesce(p_payload->>'description',''),'description',coalesce(p_payload->>'description',''),'features',coalesce(p_payload->'features','[]'),'images',coalesce(p_payload->'images','["/images/academy-logo.jpg"]'),'rating',0,'reviewCount',0,'stock',0,'isNew',false,'isFeatured',coalesce((p_payload->>'featured')::boolean,false),'createdAt',coalesce(public_data->>'createdAt',now()::text)) where web_shop.products.id=v_id;
  insert into web_shop.inventory(product_id) values(v_id) on conflict do nothing;
  select * into v_product from web_shop.products where web_shop.products.id=v_id;perform web_shop.publish_product(v_id);perform web_shop.audit(p_actor,'save','product',v_id::text,old,to_jsonb(v_product));return web_shop.product_json(p_actor,v_product);
 elsif p_action='category_rename' then
  if not web_shop.manager(p_actor) then raise exception using errcode='42501',message='تغییر دسته‌بندی گروهی فقط با مدیر است.';end if;
  if length(trim(coalesce(p_payload->>'to','')))<2 then raise exception 'نام دستهٔ جدید را بنویسید.';end if;
  for v_id in select p.id from web_shop.products p where p.category=p_payload->>'from' order by p.id for update loop
   update web_shop.products set category=trim(p_payload->>'to'),version=version+1,updated_at=now() where web_shop.products.id=v_id;perform web_shop.publish_product(v_id);
  end loop;
  perform web_shop.audit(p_actor,'rename','category',p_payload->>'from',null,p_payload);return jsonb_build_object('ok',true);
 elsif p_action='catalog_import' then
  if not web_shop.manager(p_actor) then raise exception using errcode='42501',message='ورود کاتالوگ فقط با مدیر است.';end if;
  for v in select value from jsonb_array_elements(p_payload->'products') loop
   if exists(select 1 from web_shop.products where web_shop.products.id=(v->>'id')::bigint) then continue;end if;
   insert into web_shop.products(id,sku,name,category,sale_price,public_data,legacy_qty,opening_required) values((v->>'id')::bigint,'GOLF-'||(v->>'id'),v->>'name',v->>'category',coalesce((v->>'price')::numeric,0),(select jsonb_object_agg(key,value) from jsonb_each(v) where key=any(array['id','slug','name','category','price','oldPrice','shortDesc','description','features','images','rating','reviewCount','stock','badge','isNew','isFeatured','createdAt'])),coalesce((v->>'stock')::integer,0),true);
   insert into web_shop.inventory(product_id) values((v->>'id')::bigint);perform web_shop.publish_product((v->>'id')::bigint);
  end loop;
  perform web_shop.audit(p_actor,'import','catalog',null,null,jsonb_build_object('count',jsonb_array_length(p_payload->'products')));return jsonb_build_object('ok',true);
 elsif p_action='opening_zero' then
  if not web_shop.manager(p_actor) then raise exception using errcode='42501',message='تأیید افتتاحیه فقط با مدیر است.';end if;
  v_id=(p_payload->>'product_id')::bigint;perform 1 from web_shop.products where web_shop.products.id=v_id for update;
  if exists(select 1 from web_shop.stock_moves where product_id=v_id) then raise exception 'کالا گردش دارد؛ افتتاحیهٔ صفر مجاز نیست.';end if;
  update web_shop.products set opening_required=false,version=version+1 where web_shop.products.id=v_id;perform web_shop.publish_product(v_id);perform web_shop.audit(p_actor,'opening_zero','product',v_id::text,null,null);return jsonb_build_object('ok',true);
 elsif p_action='document_save' then return web_shop.save_document(p_actor,p_payload);
 elsif p_action='document_post' then return web_shop.post_document(p_actor,(p_payload->>'id')::bigint);
 elsif p_action='document_void' then
  v_id=(p_payload->>'id')::bigint;select * into v_doc from web_shop.documents where web_shop.documents.id=v_id for update;
  if v_doc.state='void' then return web_shop.doc_json(p_actor,v_id);end if;
  if v_doc.state='posted' then perform web_shop.reverse_document(p_actor,v_id,p_payload->>'reason');else perform web_shop.require(p_actor,web_shop.cap(v_doc.kind)||'.edit');end if;
  update web_shop.documents set state='void',version=version+1 where web_shop.documents.id=v_id;return web_shop.doc_json(p_actor,v_id);
 elsif p_action='document_get' then return web_shop.doc_json(p_actor,(p_payload->>'id')::bigint);
 elsif p_action='documents' then
  cap=coalesce(p_payload->>'section','sales');perform web_shop.require(p_actor,cap||'.view');
  return coalesce((select jsonb_agg(q.doc order by q.id desc) from(select d.id,web_shop.doc_json(p_actor,d.id) as doc from web_shop.documents d where web_shop.cap(d.kind)=cap and (coalesce(p_payload->>'state','all')='all' or d.state=p_payload->>'state') and (coalesce(p_payload->>'query','')='' or coalesce(d.number,'') ilike '%'||(p_payload->>'query')||'%' or d.reference ilike '%'||(p_payload->>'query')||'%' or exists(select 1 from web_shop.parties pp where pp.id=d.party_id and pp.name ilike '%'||(p_payload->>'query')||'%')) order by d.id desc limit least(300,greatest(1,coalesce((p_payload->>'limit')::integer,300))) offset greatest(0,coalesce((p_payload->>'offset')::integer,0))) q),'[]');
 elsif p_action='inventory' then
  perform web_shop.require(p_actor,'inventory.view');v_id=nullif(p_payload->>'product_id','')::bigint;
  return coalesce((select jsonb_agg((to_jsonb(m)||jsonb_build_object('name',p.name,'sku',p.sku,'number',d.number,'kind',d.kind)) - case when web_shop.allowed(p_actor,'cost.view') then array[]::text[] else array['value'] end order by m.id desc) from (select * from web_shop.stock_moves where nullif(p_payload->>'product_id','') is null or product_id=(p_payload->>'product_id')::bigint order by web_shop.stock_moves.id desc limit 400) m join web_shop.products p on p.id=m.product_id join web_shop.documents d on d.id=m.document_id),'[]');
 elsif p_action='payment_post' then return web_shop.make_payment(p_actor,p_payload);
 elsif p_action='payment_void' then
  if not web_shop.manager(p_actor) then raise exception using errcode='42501',message='ابطال سند مالی فقط با مدیر است.';end if;
  if length(trim(coalesce(p_payload->>'reason','')))<5 then raise exception 'علت ابطال سند مالی را بنویسید.';end if;
  declare pay web_shop.payments; jid bigint;begin
   select * into pay from web_shop.payments where web_shop.payments.id=(p_payload->>'id')::bigint for update;
   if pay.id is null then raise exception 'سند مالی پیدا نشد.';end if;
   if pay.state='void' then return jsonb_build_object('ok',true);end if;
   perform web_shop.date_ok(pay.doc_date);
   insert into web_shop.journals(doc_date,source,document_id,description,reversal_of,created_by) values(pay.doc_date,'payment_reversal',pay.document_id,p_payload->>'reason',pay.journal_id,p_actor) returning web_shop.journals.id into jid;
   insert into web_shop.journal_lines(journal_id,account,party_id,debit,credit) select jid,account,party_id,credit,debit from web_shop.journal_lines where journal_id=pay.journal_id;
   perform web_shop.balanced(jid);update web_shop.payments set state='void' where web_shop.payments.id=pay.id;
   perform web_shop.audit(p_actor,'void','payment',pay.id::text,to_jsonb(pay),p_payload);return jsonb_build_object('ok',true);
  end;
 elsif p_action='payments' then
  perform web_shop.require(p_actor,'finance.view');return coalesce((select jsonb_agg(to_jsonb(x) order by x.id desc) from(select p.*,d.number,pt.name as party_name from web_shop.payments p left join web_shop.documents d on d.id=p.document_id left join web_shop.parties pt on pt.id=p.party_id where (d.id is not null and web_shop.allowed(p_actor,web_shop.cap(d.kind)||'.view')) or (d.id is null and web_shop.manager(p_actor)) order by p.id desc limit 300) x),'[]');
 elsif p_action='report' then
  perform web_shop.require(p_actor,'reports.view');from_d=coalesce((p_payload->>'from')::date,web_shop.today()-29);to_d=coalesce((p_payload->>'to')::date,web_shop.today());
  select jsonb_agg(to_jsonb(q) order by q.code) into v from(select ac.code,ac.name,ac.kind,coalesce(sum(l.debit) filter(where j.doc_date between from_d and to_d),0) as debit,coalesce(sum(l.credit) filter(where j.doc_date between from_d and to_d),0) as credit,coalesce(sum(l.debit-l.credit) filter(where j.doc_date<=to_d),0) as balance from web_shop.accounts ac left join web_shop.journal_lines l on l.account=ac.code left join web_shop.journals j on j.id=l.journal_id group by ac.code,ac.name,ac.kind) q;
  return jsonb_build_object('from',from_d,'to',to_d,'accounts',v,'inventory_value',(select coalesce(sum(value),0) from web_shop.inventory),'journal',(select coalesce(jsonb_agg(to_jsonb(q) order by q.id desc),'[]') from(select j.id,j.doc_date,j.description,j.source,sum(l.debit) as debit,sum(l.credit) as credit from web_shop.journals j join web_shop.journal_lines l on l.journal_id=j.id where j.doc_date between from_d and to_d group by j.id order by j.id desc limit 300) q));
 elsif p_action='journal_get' then
  perform web_shop.require(p_actor,'reports.view');
  return jsonb_build_object('journal',(select to_jsonb(j) from web_shop.journals j where j.id=(p_payload->>'id')::bigint),'lines',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('account_name',ac.name,'party_name',p.name) order by l.id) from web_shop.journal_lines l join web_shop.accounts ac on ac.code=l.account left join web_shop.parties p on p.id=l.party_id where l.journal_id=(p_payload->>'id')::bigint),'[]'));
 elsif p_action='ledger' then
  perform web_shop.require(p_actor,'reports.view');from_d=coalesce((p_payload->>'from')::date,web_shop.today()-29);to_d=coalesce((p_payload->>'to')::date,web_shop.today());
  return jsonb_build_object('account',(select to_jsonb(ac) from web_shop.accounts ac where ac.code=p_payload->>'account'),'opening',coalesce((select sum(l.debit-l.credit) from web_shop.journal_lines l join web_shop.journals j on j.id=l.journal_id where l.account=p_payload->>'account' and j.doc_date<from_d),0),'rows',coalesce((select jsonb_agg(to_jsonb(q) order by q.doc_date,q.id) from(select l.id,j.doc_date,j.description,l.debit,l.credit,j.document_id from web_shop.journal_lines l join web_shop.journals j on j.id=l.journal_id where l.account=p_payload->>'account' and j.doc_date between from_d and to_d) q),'[]'));
 elsif p_action='party_statement' then
  v_id=(p_payload->>'id')::bigint;select * into v_party from web_shop.parties where web_shop.parties.id=v_id;
  perform web_shop.require(p_actor,case when v_party.customer and web_shop.allowed(p_actor,'sales.view') then 'sales.view' else 'purchases.view' end);
  return jsonb_build_object('party',to_jsonb(v_party),'rows',coalesce((select jsonb_agg(to_jsonb(q) order by q.doc_date,q.id) from(select l.id,j.doc_date,j.description,l.account,l.debit,l.credit,d.number from web_shop.journal_lines l join web_shop.journals j on j.id=l.journal_id left join web_shop.documents d on d.id=j.document_id where l.party_id=v_party.id and ((l.account='1200' and web_shop.allowed(p_actor,'sales.view')) or (l.account='2100' and web_shop.allowed(p_actor,'purchases.view'))) order by j.doc_date,l.id) q),'[]'));
 elsif p_action='dashboard' then
  return jsonb_build_object('today',web_shop.today(),'low_stock',(select count(*) from web_shop.products p left join web_shop.inventory i on i.product_id=p.id where p.active and coalesce(i.qty,0)<=p.min_stock),'needs_opening',(select count(*) from web_shop.products where opening_required),'sales_today',case when web_shop.allowed(p_actor,'sales.view') then (select coalesce(sum(total),0) from web_shop.documents where kind='sale' and state='posted' and doc_date=web_shop.today()) else null end,'purchases_today',case when web_shop.allowed(p_actor,'purchases.view') then (select coalesce(sum(total),0) from web_shop.documents where kind='purchase' and state='posted' and doc_date=web_shop.today()) else null end,'pending',(select count(*) from web_shop.documents d where state='draft' and web_shop.allowed(p_actor,web_shop.cap(d.kind)||'.view')));
 elsif p_action='staff' then
  if not web_shop.manager(p_actor) then raise exception using errcode='42501',message='مدیریت دسترسی فقط با مدیر است.';end if;
  return coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('email',u.email) order by s.name) from web_shop.staff s join auth.users u on u.id=s.user_id),'[]');
 elsif p_action='staff_save' then
  if not web_shop.manager(p_actor) then raise exception using errcode='42501',message='مدیریت دسترسی فقط با مدیر است.';end if;
  uid=(p_payload->>'user_id')::uuid;
  if exists(select 1 from auth.users where auth.users.id=uid and raw_app_meta_data->>'web_admin'='true') then raise exception 'مدیر اصلی از این بخش قابل محدودکردن نیست.';end if;
  if uid=p_actor and (p_payload->>'department'<>'manager' or p_payload->>'active'='false') then raise exception 'دسترسی مدیریتی خودتان را نمی‌توانید قطع کنید.';end if;
  for cap in select jsonb_object_keys(coalesce(p_payload->'permissions','{}')) loop
   if cap not in ('sales.view','sales.create','sales.edit','sales.return','sales.price','purchases.view','purchases.create','purchases.edit','purchases.return','inventory.view','inventory.create','inventory.edit','catalog.view','catalog.create','catalog.edit','finance.view','finance.create','reports.view','cost.view','posted.correct') then raise exception 'کلید دسترسی نامعتبر است.';end if;
  end loop;
  select to_jsonb(x) into old from web_shop.staff x where user_id=uid;
  insert into web_shop.staff(user_id,name,department,active,permissions) values(uid,p_payload->>'name',p_payload->>'department',coalesce((p_payload->>'active')::boolean,true),coalesce(p_payload->'permissions','{}')) on conflict(user_id) do update set name=excluded.name,department=excluded.department,active=excluded.active,permissions=excluded.permissions,updated_at=now();
  perform web_shop.audit(p_actor,'permissions','staff',uid::text,old,p_payload-'password');return jsonb_build_object('ok',true);
 elsif p_action='settings_save' then
  if not web_shop.manager(p_actor) then raise exception using errcode='42501',message='تنظیمات فقط با مدیر است.';end if;
  select to_jsonb(x) into old from web_shop.settings x where x.id;
  update web_shop.settings set warehouse_name=coalesce(p_payload->>'warehouse_name',warehouse_name),tax_enabled=coalesce((p_payload->>'tax_enabled')::boolean,tax_enabled),default_tax=coalesce((p_payload->>'default_tax')::numeric,default_tax),purchase_tax_recoverable=coalesce((p_payload->>'purchase_tax_recoverable')::boolean,purchase_tax_recoverable),closed_through=case when p_payload ? 'closed_through' then nullif(p_payload->>'closed_through','')::date else closed_through end where web_shop.settings.id;
  perform web_shop.audit(p_actor,'settings','settings','1',old,p_payload);return jsonb_build_object('ok',true);
 elsif p_action='audit' then
  if not web_shop.manager(p_actor) then raise exception using errcode='42501',message='سوابق کنترل فقط برای مدیر است.';end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.id desc) from(select a.id,a.actor,a.action,a.entity,a.entity_id,a.created_at from web_shop.audit a order by a.id desc limit 200) x),'[]');
 elsif p_action='ops_reset' then
  -- One-shot operational zeroing for going live: only the web owner (main manager) may run it.
  -- Catalog, staff, permissions, settings, public site content and the audit trail survive.
  if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'web_admin'='true') then raise exception using errcode='42501',message='صفرسازی عملیاتی فقط با مدیر اصلی سایت انجام می‌شود.';end if;
  declare removed jsonb;begin
   select jsonb_build_object('documents',(select count(*) from web_shop.documents),'payments',(select count(*) from web_shop.payments),'parties',(select count(*) from web_shop.parties),'moves',(select count(*) from web_shop.stock_moves),'journals',(select count(*) from web_shop.journals),'products',(select count(*) from web_shop.products)) into removed;
   truncate web_shop.payments,web_shop.journal_lines,web_shop.journals,web_shop.lines,web_shop.stock_moves,web_shop.documents,web_shop.parties,web_shop.inventory restart identity;
   delete from web_shop.counters;
   update web_shop.products set opening_required=true,version=version+1,updated_at=now();
   for v_id in select id from web_shop.products loop perform web_shop.publish_product(v_id);end loop;
   update web_shop.settings set closed_through=null,initialized=false where web_shop.settings.id;
   perform web_shop.audit(p_actor,'reset','operations','all',removed,jsonb_build_object('at',now()));
   return jsonb_build_object('ok',true,'removed',removed);
  end;
 else raise exception 'عملیات ناشناخته است.';end if;
end $$;
revoke all on all functions in schema web_shop from public,anon,authenticated;
grant execute on all functions in schema web_shop to service_role;
revoke all on function public.web_shop_api(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.web_shop_api(uuid,text,jsonb) to service_role;
create or replace function public.web_shop_managed_product(p_product_id bigint) returns boolean language sql stable security definer set search_path=pg_catalog,web_shop as $$
 select exists(select 1 from web_shop.products where id=p_product_id)
$$;
revoke all on function public.web_shop_managed_product(bigint) from public,anon,authenticated;
grant execute on function public.web_shop_managed_product(bigint) to service_role;
comment on schema web_shop is 'Private golf-shop purchasing, inventory, sales, double-entry ledger and staff permissions. Separate from academy and public website content.';
commit;
