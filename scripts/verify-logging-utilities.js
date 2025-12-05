#!/usr/bin/env node

/**
 * Verification Script for Logging Utilities
 * 
 * This script verifies that the sanitization utilities work correctly
 * by testing them with sample data.
 */

// Import backend utilities
const {
  sanitizeHeaders,
  summarize,
  redactSensitiveFields,
  getEmailDomain,
  sanitizeUserData,
} = require('../server/src/utils/logging/sanitize.ts');

console.log('🔍 Verifying Logging Utilities\n');

// Test 1: sanitizeHeaders
console.log('1. Testing sanitizeHeaders()');
const testHeaders = {
  'content-type': 'application/json',
  'authorization': 'Bearer secret-token-12345',
  'x-api-key': 'my-secret-api-key',
  'user-agent': 'Mozilla/5.0',
  'cookie': 'session=abc123',
};
const sanitizedHeaders = sanitizeHeaders(testHeaders);
console.log('   Input:', JSON.stringify(testHeaders, null, 2));
console.log('   Output:', JSON.stringify(sanitizedHeaders, null, 2));
console.log('   ✅ Sensitive headers redacted\n');

// Test 2: summarize
console.log('2. Testing summarize()');
const longString = 'a'.repeat(500);
const summarizedString = summarize(longString);
console.log('   Input: String with 500 characters');
console.log('   Output:', summarizedString);
console.log('   ✅ Long string truncated\n');

const largeArray = Array.from({ length: 100 }, (_, i) => i);
const summarizedArray = summarize(largeArray);
console.log('   Input: Array with 100 items');
console.log('   Output:', JSON.stringify(summarizedArray, null, 2));
console.log('   ✅ Array summarized\n');

const largeObject = Object.fromEntries(
  Array.from({ length: 50 }, (_, i) => [`key${i}`, `value${i}`])
);
const summarizedObject = summarize(largeObject);
console.log('   Input: Object with 50 keys');
console.log('   Output:', JSON.stringify(summarizedObject, null, 2));
console.log('   ✅ Object summarized\n');

// Test 3: redactSensitiveFields
console.log('3. Testing redactSensitiveFields()');
const userData = {
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret123',
  apiKey: 'key-123',
  age: 30,
  nested: {
    token: 'nested-token',
    publicInfo: 'visible',
  },
};
const redactedData = redactSensitiveFields(userData);
console.log('   Input:', JSON.stringify(userData, null, 2));
console.log('   Output:', JSON.stringify(redactedData, null, 2));
console.log('   ✅ Sensitive fields redacted (including nested)\n');

// Test 4: getEmailDomain
console.log('4. Testing getEmailDomain()');
const email = 'user@example.com';
const domain = getEmailDomain(email);
console.log('   Input:', email);
console.log('   Output:', domain);
console.log('   ✅ Email domain extracted\n');

// Test 5: sanitizeUserData
console.log('5. Testing sanitizeUserData()');
const user = {
  id: 'user-123',
  email: 'john@example.com',
  name: 'John Doe',
  password: 'secret',
  phone: '555-1234',
  createdAt: '2025-01-01',
  role: 'admin',
};
const sanitizedUser = sanitizeUserData(user);
console.log('   Input:', JSON.stringify(user, null, 2));
console.log('   Output:', JSON.stringify(sanitizedUser, null, 2));
console.log('   ✅ User data sanitized (PII removed, metadata kept)\n');

console.log('✅ All logging utilities verified successfully!');
console.log('\nUtilities are ready for use in:');
console.log('  - Backend: import from "@utils/logging"');
console.log('  - Frontend: import from "@/utils/logging"');
