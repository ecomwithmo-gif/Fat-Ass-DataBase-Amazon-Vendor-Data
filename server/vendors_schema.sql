create table if not exists vendors (
  id uuid default gen_random_uuid() primary key,
  vendor_name text not null,
  url text,
  status text,
  type text,
  category text,
  scrape_status text,
  product_add_status text,
  order_status text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Separate index creation to avoid errors if it exists (or just rely on if not exists if supported, but standard SQL usually separate)
create index if not exists vendors_name_idx on vendors (vendor_name);

-- RLS
alter table vendors enable row level security;
create policy "Public access" on vendors for all using (true);
