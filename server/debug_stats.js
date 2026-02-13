const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load env vars from process.env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { readVendorList } = require('./utils/fileHandler');

(async () => {
  try {
    const vendors = readVendorList();
    const vendorName = "CMA Gifts"; // The one from the screenshot
    const normalizedVendorName = vendorName.trim().toLowerCase();

    console.log(`Looking for vendor: "${vendorName}" (normalized: "${normalizedVendorName}")`);

    const { data: products, error } = await supabase
      .from('products')
      .select('vendor_name');
    
    if (error) throw error;

    console.log(`Total products in DB: ${products.length}`);
    
    const matchingProducts = products.filter(p => (p.vendor_name || '').trim().toLowerCase() === normalizedVendorName);
    console.log(`Products matching normalized name: ${matchingProducts.length}`);

    if (matchingProducts.length === 0) {
        console.log("No matches found. Dumping first 5 unique vendor names from DB:");
        const dbVendors = [...new Set(products.map(p => p.vendor_name))];
        console.log(dbVendors.slice(0, 5));
        
        console.log("Dumping first 5 normalized DB vendor names:");
        console.log(dbVendors.map(v => (v || '').trim().toLowerCase()).slice(0, 5));
    }

  } catch (err) {
    console.error(err);
  }
})();
