const http = require('http');

// Test the running server on port 3002
const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/health',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('✅ Server is running!');
    console.log('Status:', res.statusCode);
    console.log('Response:', JSON.parse(data));
    console.log('\n🚀 Your FamSpace API is available at: http://localhost:3002');
    console.log('📋 API routes: http://localhost:3002/api');
  });
});

req.on('error', (err) => {
  console.log('❌ Server not responding:', err.message);
});

req.end();