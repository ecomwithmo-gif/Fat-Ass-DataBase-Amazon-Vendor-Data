const { createClient } = require('@supabase/supabase-js');
const { readVendorList } = require('./utils/fileHandler');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateVendors() {
  console.log("Starting vendor migration...");
  
  // 1. Read from Excel
  const vendors = readVendorList();
  console.log(`Read ${vendors.length} vendors from Excel.`);

  if (vendors.length === 0) {
    console.log("No vendors to migrate.");
    return;
  }

  // 2. Map to DB schema
  const dbRecords = vendors.map(v => ({
    vendor_name: v.Vendor,
    url: v.URL,
    status: v.Status,
    type: v.Type,
    category: v.Category,
    scrape_status: v.Scrape,
    product_add_status: v['Proudct Add'], // Ensure exact key match from inspect output
    order_status: v.Order
  }));

  // 3. Insert into Supabase
  // We'll use upsert on vendor_name to avoid duplicates if run multiple times
  // But wait, vendor_name isn't a primary key, but we made a unique index? 
  // actually I didn't make a unique constraint in the SQL, just an index.
  // So we should check if they exist or just insert. 
  // For migration, let's assume empty table or just insert.
  // Actually, upsert requires a unique constraint.
  // Let's just do insert for now, or check existence.
  
  const { data, error } = await supabase
    .from('vendors')
    .insert(dbRecords)
    .select();

  if (error) {
    console.error("Migration failed:", error);
  } else {
    console.log(`Successfully migrated ${data.length} vendors.`);
  }
}

migrateVendors();
