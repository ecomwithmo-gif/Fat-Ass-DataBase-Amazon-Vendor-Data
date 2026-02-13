async function testBySkus() {
  console.log('Testing POST http://localhost:3000/api/products/by-skus...');
  
  // First, find some Amazon Data products to query
  try {
      const listRes = await fetch('http://localhost:3000/api/products?vendor=Amazon%20Data');
      const products = await listRes.json();
      
      if (products.length === 0) {
          console.log('No Amazon Data products found to test with.');
          return;
      }
      
      const sampleSkus = products.slice(0, 3).map(p => p.sku);
      console.log('Testing with SKUs:', sampleSkus);

      const response = await fetch('http://localhost:3000/api/products/by-skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            vendor: 'Amazon Data', 
            skus: sampleSkus 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Endpoint Success! Retrieved ${data.length} products.`);
        data.forEach(p => console.log(` - Found: ${p.sku} (${p.title})`));
      } else {
        console.error('Endpoint Failed:', response.status, response.statusText);
        const text = await response.text();
        console.error('Response:', text);
      }

  } catch (err) {
      console.error('Fetch Error:', err);
  }
}

testBySkus();
