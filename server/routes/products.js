const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');

  // POST match Amazon ASINs
router.post('/match-amazon', async (req, res) => {
  const { error } = await supabase.rpc('match_amazon_asins');

  if (error) {
    console.error('Error matching ASINs:', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'ASIN matching completed successfully' });
});

// Fetch products by SKUs (for Amazon Match Details)
router.post('/by-skus', async (req, res) => {
    const { vendor, skus } = req.body;
    
    if (!skus || !Array.isArray(skus)) {
        return res.status(400).json({ error: "Invalid SKUs array" });
    }

    let query = supabase
        .from('products')
        .select('*')
        .in('sku', skus);

    if (vendor) {
        query = query.eq('vendor_name', vendor);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching by SKUs:', error);
        return res.status(500).json({ error: error.message });
    }

    res.json(data);
});

  // GET products (filter by vendor, with pagination, and SEARCH)
router.get('/', async (req, res) => {
  const { vendor, page = 1, limit = 50, search } = req.query;
  
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' });
  
  if (vendor) {
    query = query.eq('vendor_name', vendor);
  }

  // Search Filter
  if (search) {
      const term = search.trim();
      // Search across Title, SKU, UPC, and maybe Vendor Name
      // confusing syntax: "column.ilike.%term%,other.ilike.%term%"
      const searchFilter = `title.ilike.%${term}%,sku.ilike.%${term}%,upc.ilike.%${term}%,vendor_name.ilike.%${term}%`;
      query = query.or(searchFilter);
  }

  // Order by created_at desc by default, or id
  query = query.order('id', { ascending: true }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ data, count });
});

// POST import products (Bulk insert) - MOVED UP due to route conflict with /:id if not careful, 
// but actually /batch is better to be explicit.
router.post('/batch', async (req, res) => {
  const { products } = req.body; // Expects { products: [] }
  
  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'Invalid products array' });
  }

  const { data, error } = await supabase
    .from('products')
    .insert(products)
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// POST create product
router.post('/', async (req, res) => {
  const product = req.body;
  
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data[0]);
});

// PUT update product
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data[0]);
});

// DELETE product
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'Deleted successfully' });
});

// POST import products (Bulk insert)
router.post('/import', async (req, res) => {
  const products = req.body; // Array of products

  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'Invalid products array' });
  }

  // Basic validation or mapping could happen here.
  // We assume the frontend sends data matching the Supabase schema mostly.
  
  const { data, error } = await supabase
    .from('products')
    .insert(products)
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

module.exports = router;
