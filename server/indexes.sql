-- Run this in the Supabase SQL Editor to improve query performance

-- Index for filtering products by vendor (used heavily in VendorDetail and ProductTable)
create index if not exists products_vendor_name_idx on products (vendor_name);

-- Index for looking up products by SKU (used in Amazon matching and lookups)
create index if not exists products_sku_idx on products (sku);

-- Index for searching products by title (used in global search)
-- Using gin index for text search if we were using to_tsvector, but for ilike, a trigram index is better if pg_trgm is enabled.
-- For standard btree, it helps with equality or prefix searches.
create index if not exists products_title_idx on products (title);
