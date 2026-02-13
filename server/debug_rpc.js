const supabase = require('./config/supabaseClient');
require('dotenv').config();

async function testRpc() {
  console.log('Attempting to call match_amazon_asins RPC...');
  
  try {
    const { data, error } = await supabase.rpc('match_amazon_asins');
    
    if (error) {
      console.error('RPC Error:', error);
      console.error('Stack:', error.stack);
      console.error('Details:', JSON.stringify(error, null, 2));
    } else {
      console.log('RPC Success!', data);
    }
  } catch (err) {
    console.error('Unexpected Exception:', err);
  }
}

testRpc();
