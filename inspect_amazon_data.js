const http = require('http');

const url = 'http://localhost:3000/api/products?vendor=Amazon%20Data&limit=5000';

console.log(`Fetching from ${url}...`);

http.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const products = parsed.data || parsed;
      
      console.log(`Fetched ${products.length} products.`);

      const targetUPCs = ['664843140486', '028399349869'];
      
      targetUPCs.forEach(upc => {
          console.log(`\n--- Searching for UPC: ${upc} ---`);
          
          const match = products.find(p => {
              const pUpc = p.upc || p.additional_data?.upc;
              const pImported = p.additional_data?.ImportedBy;
              const pAsin = p.sku;
              const jsonStr = JSON.stringify(p);
              
              return jsonStr.includes(upc);
          });
          
          if (match) {
              console.log("MATCH FOUND!");
              console.log("Top Level Keys:", Object.keys(match));
              console.log("UPC:", match.upc);
              console.log("SKU:", match.sku);
              console.log("Additional Data:", JSON.stringify(match.additional_data, null, 2));
          } else {
              console.log("NO MATCH FOUND via simple string search");
          }
      });
      
      // Also dump one product to see the general structure of additional_data
      if (products.length > 0) {
          console.log("\n--- Sample Product Data Structure ---");
          // Find one with additional_data populated
          const sample = products.find(p => p.additional_data && Object.keys(p.additional_data).length > 0) || products[0];
          console.log(JSON.stringify(sample.additional_data, null, 2));
      }

    } catch (e) {
      console.error("Error parsing JSON:", e.message);
    }
  });

}).on("error", (err) => {
  console.error("Error fetching data:", err.message);
});
