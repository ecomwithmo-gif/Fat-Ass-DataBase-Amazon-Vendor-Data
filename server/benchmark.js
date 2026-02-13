const axios = require('axios'); // You might need to install axios or use fetch (node 18+)
// Using fetch since it's built-in in newer node versions, or we can use http

async function benchmark() {
  const url = 'http://localhost:3000/api/vendors';
  console.log(`Benchmarking ${url}...`);

  const start = performance.now();
  try {
    const response = await fetch(url);
    const data = await response.json();
    const end = performance.now();

    console.log(`Status: ${response.status}`);
    console.log(`Data count: ${Array.isArray(data) ? data.length : 'N/A'}`);
    console.log(`Time taken: ${(end - start).toFixed(2)} ms`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

benchmark();
