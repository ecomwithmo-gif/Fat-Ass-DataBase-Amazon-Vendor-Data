const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');

// GET all vendors (lighter version, no products fetch unless requested, but for now just vendors)
router.get('/', async (req, res) => {
  try {
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('*')
      .order('vendor_name', { ascending: true });

    if (error) throw error;

    // Map to frontend format but init stats to 0/empty
    const mappedVendors = vendors.map(v => ({
      id: v.id,
      Vendor: v.vendor_name,
      URL: v.url,
      Status: v.status,
      Type: v.type,
      Category: v.category,
      Scrape: v.scrape_status,
      'Proudct Add': v.product_add_status,
      Order: v.order_status,
      // Default stats (will be fetched separately)
      product_count: 0,
      brand_count: 0,
      total_value: 0
    }));

    res.json(mappedVendors);
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET vendor stats (Optimized RPC or improved query)
// For now, let's still calculate in memory but ONLY if hit this endpoint, 
// OR use a lighter query. 
// Actually, fetching just the necessary columns (vendor_name, brand, cost, additional_data) is okay 
// IF we do it in a background or separate call.
router.get('/stats', async (req, res) => {
    try {
        console.log("Fetching vendor stats from Supabase...");
        // Fetch only necessary columns for stats
        const { data: products, error: productError } = await supabase
          .from('products')
          .select('vendor_name, brand, cost, additional_data');
    
        if (productError) throw productError;
        
        console.log(`Fetched ${products?.length} products for stats aggregation.`);
    
        const stats = {};
        products.forEach(p => {
          const vNameKey = (p.vendor_name || '').trim().toLowerCase();
          
          if (!stats[vNameKey]) {
            stats[vNameKey] = { count: 0, brands: new Set(), total_value: 0 };
          }
          
          stats[vNameKey].count += 1;
          if (p.brand) stats[vNameKey].brands.add(p.brand);
          
          // Calculate value
          // Check both cost and msrp/price if needed, but logic seems to be cost * quantity
          const cost = parseFloat(p.cost) || 0;
          const quantity = parseInt(p.additional_data?.quantity) || 0;
          stats[vNameKey].total_value += cost * quantity;
        });

        // Convert sets to size for JSON
        const response = {};
        for (const [key, val] of Object.entries(stats)) {
            response[key] = {
                count: val.count,
                brand_count: val.brands.size,
                total_value: val.total_value
            };
        }

        res.json(response);
    } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET single vendor by name
router.get('/by-name/:name', async (req, res) => {
    const { name } = req.params;
    try {
        const { data, error } = await supabase
            .from('vendors')
            .select('*')
            .ilike('vendor_name', name) // Case-insensitive matching
            .single();

        if (error) {
            // if code is PGRST116 (0 rows), return 404
            if (error.code === 'PGRST116') return res.status(404).json({ error: 'Vendor not found' });
            throw error;
        }

        const v = data;
        // Basic map
        const response = {
            id: v.id,
            Vendor: v.vendor_name, 
            URL: v.url,
            Status: v.status,
            Type: v.type,
            Category: v.category,
            Scrape: v.scrape_status,
            'Proudct Add': v.product_add_status,
            Order: v.order_status
        };

        res.json(response);
    } catch (error) {
        console.error("Error fetching vendor by name:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST create new vendor
router.post('/', async (req, res) => {
  const { Vendor, URL, Status, Type, Category } = req.body;

  if (!Vendor) {
    return res.status(400).json({ error: 'Vendor name is required' });
  }

  try {
    const { data, error } = await supabase
      .from('vendors')
      .insert([{
        vendor_name: Vendor,
        url: URL,
        status: Status || 'Open',
        type: Type,
        category: Category,
        // Default statuses
        scrape_status: 'Not started',
        product_add_status: 'Not started',
        order_status: 'Not started'
      }])
      .select();

    if (error) throw error;

    const v = data[0];
    const response = {
        id: v.id,
        Vendor: v.vendor_name,
        URL: v.url,
        Status: v.status,
        Type: v.type,
        Category: v.category,
        Scrape: v.scrape_status,
        'Proudct Add': v.product_add_status,
        Order: v.order_status
    };

    res.json(response);
  } catch (error) {
    console.error("Create vendor error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update vendor
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Map frontend keys back to DB columns
    const dbUpdates = {};
    if (updates.Vendor !== undefined) dbUpdates.vendor_name = updates.Vendor;
    if (updates.URL !== undefined) dbUpdates.url = updates.URL;
    if (updates.Status !== undefined) dbUpdates.status = updates.Status;
    if (updates.Type !== undefined) dbUpdates.type = updates.Type;
    if (updates.Category !== undefined) dbUpdates.category = updates.Category;
    if (updates.Scrape !== undefined) dbUpdates.scrape_status = updates.Scrape;
    if (updates['Proudct Add'] !== undefined) dbUpdates.product_add_status = updates['Proudct Add'];
    if (updates.Order !== undefined) dbUpdates.order_status = updates.Order;

    const { data, error } = await supabase
      .from('vendors')
      .update(dbUpdates)
      .eq('id', id)
      .select();

    if (error) throw error;
    if (data.length === 0) return res.status(404).json({ error: 'Vendor not found' });

    // Map back to frontend for response
    const v = data[0];
    const response = {
        id: v.id,
        Vendor: v.vendor_name, 
        URL: v.url,
        Status: v.status,
        Type: v.type,
        Category: v.category,
        Scrape: v.scrape_status,
        'Proudct Add': v.product_add_status,
        Order: v.order_status
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE vendor
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper for pure mapping (without stats)
function mapVendorsToFrontend(vendors) {
    return vendors.map(v => ({
        id: v.id,
        Vendor: v.vendor_name,
        URL: v.url,
        Status: v.status,
        Type: v.type,
        Category: v.category,
        Scrape: v.scrape_status,
        'Proudct Add': v.product_add_status,
        Order: v.order_status
    }));
}

module.exports = router;
