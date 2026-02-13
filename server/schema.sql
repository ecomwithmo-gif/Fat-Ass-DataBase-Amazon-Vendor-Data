-- Run this in the Supabase SQL Editor

create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  vendor_name text,
  vendor_image text,
  parent_sku text,
  sku text,
  upc text,
  title text,
  brand text,
  msrp numeric,
  cost numeric,
  size text,
  color text,
  additional_data jsonb,
  linked_asins text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Basic RLS (Optional, for now just open or service role access)
alter table products enable row level security;
create policy "Public access" on products for all using (true);
