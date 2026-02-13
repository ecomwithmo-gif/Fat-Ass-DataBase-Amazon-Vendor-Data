const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const createTableSQL = `
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
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table products enable row level security;
create policy "Public access" on products for all using (true);
`;

async function main() {
  console.log('Initializing database schema...');
  // Note: Supabase JS client doesn't support raw SQL execution unless you use the management API or have a function.
  // BUT the postgres-js library would.
  // However, since we can't easily install new libs without potentially breaking things,
  // we will try to use the `rpc` if a function exists, OR just warn the user.
  // Actually, we can use the `pg` library if we had the connection string.
  // We don't have the connection string password.
  // So we really rely on the user running the SQL.
  
  console.log('Please run the following SQL in your Supabase SQL Editor:');
  console.log(createTableSQL);
}

main();
