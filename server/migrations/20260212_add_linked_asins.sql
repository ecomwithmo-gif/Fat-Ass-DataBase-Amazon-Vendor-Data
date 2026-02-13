-- Add linked_asins column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS linked_asins text[];

-- Create index on upc for faster matching
CREATE INDEX IF NOT EXISTS products_upc_idx ON products (upc);

-- Create a function to match ASINs (Robust version with TRIM)
CREATE OR REPLACE FUNCTION match_amazon_asins()
RETURNS void AS $$
BEGIN
  UPDATE products p
  SET linked_asins = subquery.asins
  FROM (
    SELECT p2.id, array_agg(a.sku) as asins
    FROM products p2
    JOIN products a ON TRIM(p2.upc) = TRIM(a.upc)
    WHERE a.vendor_name = 'Amazon Data'
      AND p2.vendor_name != 'Amazon Data'
      AND p2.upc IS NOT NULL
      AND p2.upc != ''
    GROUP BY p2.id
  ) AS subquery
  WHERE p.id = subquery.id;
END;
$$ LANGUAGE plpgsql;
