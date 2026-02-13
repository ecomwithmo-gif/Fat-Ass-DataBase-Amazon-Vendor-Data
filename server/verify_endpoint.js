async function testEndpoint() {
  console.log('Testing POST http://localhost:3000/api/products/match-amazon...');
  
  try {
    const response = await fetch('http://localhost:3000/api/products/match-amazon', {
        method: 'POST'
    });
    
    if (response.ok) {
        const data = await response.json();
        console.log('Endpoint Success:', data);
    } else {
        console.log('Endpoint Failed:', response.status, response.statusText);
        const text = await response.text();
        console.log('Response:', text);
    }
  } catch (err) {
      console.error('Fetch Error:', err);
  }
}

testEndpoint();
