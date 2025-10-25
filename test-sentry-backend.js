#!/usr/bin/env node

/**
 * Sentry Backend Test Script
 * Tests error tracking for Express backend
 */

const API_URL = 'http://localhost:3001';

console.log('🔥 Testing Sentry Backend Error Tracking\n');

async function testBackendErrors() {
  const tests = [
    {
      name: '404 Error - Non-existent endpoint',
      url: `${API_URL}/api/this-does-not-exist`,
      method: 'GET',
      expectedStatus: 404
    },
    {
      name: '404 Error - Invalid route',
      url: `${API_URL}/nonexistent-route`,
      method: 'GET',
      expectedStatus: 404
    },
    {
      name: 'Auth Error - Missing API key',
      url: `${API_URL}/api/optimize`,
      method: 'POST',
      body: { input: 'test', mode: 'default' },
      expectedStatus: 401
    },
    {
      name: 'Validation Error - Empty input',
      url: `${API_URL}/api/optimize`,
      method: 'POST',
      headers: { 'X-API-Key': 'dev-key-12345' },
      body: { input: '', mode: 'default' },
      expectedStatus: 400
    },
    {
      name: 'Validation Error - Invalid mode',
      url: `${API_URL}/api/optimize`,
      method: 'POST',
      headers: { 'X-API-Key': 'dev-key-12345' },
      body: { input: 'test prompt', mode: 'invalid-mode' },
      expectedStatus: 400
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\n📝 Test: ${test.name}`);
      console.log(`   URL: ${test.url}`);
      
      const options = {
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
          ...(test.headers || {})
        }
      };

      if (test.body) {
        options.body = JSON.stringify(test.body);
      }

      const response = await fetch(test.url, options);
      const data = await response.json();

      if (response.status === test.expectedStatus) {
        console.log(`   ✅ Status: ${response.status} (Expected)`);
      } else {
        console.log(`   ⚠️  Status: ${response.status} (Expected: ${test.expectedStatus})`);
      }

      console.log(`   Response:`, JSON.stringify(data, null, 2).split('\n').map(l => `      ${l}`).join('\n').trim());

      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n\n✅ Backend Error Tests Complete!');
  console.log('\n📊 Check your Sentry dashboard:');
  console.log('   https://sentry.io');
  console.log('\n💡 You should see:');
  console.log('   - 404 errors with request paths');
  console.log('   - Auth errors with request details');
  console.log('   - Validation errors with input data');
  console.log('   - Request IDs for tracking');
  console.log('\n⏱️  Errors may take 5-10 seconds to appear in Sentry');
}

// Run tests
testBackendErrors().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
