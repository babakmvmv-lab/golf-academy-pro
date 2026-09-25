-- فروشگاه پات‌کلاب — جدا از ga_store و جدا از عضو آکادمی
-- اجرا در Supabase SQL Editor (idempotent)

create table if not exists public.shop_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.shop_products (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  category      text not null,
  price_toman   int not null,
  old_price     int,
  short_desc    text,
  description   text,
  features      jsonb not null default '[]'::jsonb,
  images        jsonb not null default '[]'::jsonb,
  stock         int not null default 0,
  badge         text,
  is_new        boolean not null default false,
  is_featured   boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.shop_reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references public.shop_products(id) on delete cascade,
  author      text not null,
  rating      int not null check (rating between 1 and 5),
  comment     text not null,
  status      text not null default 'approved',
  created_at  timestamptz not null default now()
);

create table if not exists public.shop_orders (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  customer_name  text not null,
  phone          text not null,
  email          text,
  address        text not null,
  city           text not null default 'اهواز',
  note           text,
  items          jsonb not null,
  subtotal       int not null,
  shipping       int not null default 0,
  total          int not null,
  status         text not null default 'pending',
  created_at     timestamptz not null default now()
);

-- محتوای ویترین (خانه، تماس، منو، قالب) — نه عضو آکادمی
create table if not exists public.site_content (
  k           text primary key,
  v           jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.shop_categories enable row level security;
alter table public.shop_products   enable row level security;
alter table public.shop_reviews    enable row level security;
alter table public.shop_orders     enable row level security;
alter table public.site_content    enable row level security;

drop policy if exists shop_cat_read on public.shop_categories;
drop policy if exists shop_prod_read on public.shop_products;
drop policy if exists shop_rev_read on public.shop_reviews;
drop policy if exists site_content_read on public.site_content;

create policy shop_cat_read on public.shop_categories for select using (true);
create policy shop_prod_read on public.shop_products for select using (true);
create policy shop_rev_read on public.shop_reviews for select using (status = 'approved');
create policy site_content_read on public.site_content for select using (true);

grant select on public.shop_categories, public.shop_products, public.shop_reviews, public.site_content to anon, authenticated;
-- سفارش: نوشتن فقط از طریق لایهٔ بعدی (فعلاً ثبت نمایشی سمت کلاینت)

comment on table public.shop_products is 'کالای فروشگاه عمومی — جدا از فروشگاه آواتار اعضا و جدا از ga_store';
comment on table public.shop_orders is 'سفارش ویترین؛ کاربر فروشگاه ≠ عضو آکادمی';
