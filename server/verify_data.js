const supabase = require('./config/supabaseClient');
require('dotenv').config();

async function verifyData() {
  console.log('Verifying linked_asins...');
  
  console.log('--- Targeted Check for UPC 035000764102 ---');
  
  const { data: targetProducts, error } = await supabase
    .from('products')
    .select('id, vendor_name, upc, linked_asins')
    .eq('upc', '035000764102');

  if (error) {
    console.error("Error:", error);
    return;
  }

  if (targetProducts && targetProducts.length > 0) {
    targetProducts.forEach(p => {
       console.log(`Product from "${p.vendor_name}": UPC="${p.upc}" (len:${p.upc.length}) Linked=${JSON.stringify(p.linked_asins)}`);
    });
  } else {
    console.log('No products found with this UPC.');
  }
}

verifyData();
