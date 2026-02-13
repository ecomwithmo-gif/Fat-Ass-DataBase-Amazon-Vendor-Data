-- Trigger 1: When a regular product is inserted/updated, check for Amazon Data match
CREATE OR REPLACE FUNCTION lookup_amazon_asins_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Only look up if UPC is present and it's not an Amazon Data product itself
  IF NEW.upc IS NOT NULL AND NEW.upc != '' AND NEW.vendor_name != 'Amazon Data' THEN
    -- Find asins from Amazon Data products with same UPC
    SELECT array_agg(sku)
    INTO NEW.linked_asins
    FROM products
    WHERE vendor_name = 'Amazon Data' AND upc = NEW.upc;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF exists trigger_lookup_amazon_asins ON products;

CREATE TRIGGER trigger_lookup_amazon_asins
BEFORE INSERT OR UPDATE OF upc ON products
FOR EACH ROW
EXECUTE FUNCTION lookup_amazon_asins_trigger();


-- Trigger 2: When an Amazon Data product is inserted/updated, update other products
CREATE OR REPLACE FUNCTION update_linked_products_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendor_name = 'Amazon Data' AND NEW.upc IS NOT NULL AND NEW.upc != '' THEN
    UPDATE products
    SET linked_asins = (
      SELECT array_agg(sku)
      FROM products a
      WHERE a.vendor_name = 'Amazon Data' AND a.upc = products.upc
    )
    WHERE vendor_name != 'Amazon Data' AND upc = NEW.upc;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF exists trigger_update_linked_products ON products;

CREATE TRIGGER trigger_update_linked_products
AFTER INSERT OR UPDATE OF upc ON products
FOR EACH ROW
EXECUTE FUNCTION update_linked_products_trigger();
