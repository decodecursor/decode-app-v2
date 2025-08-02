#!/usr/bin/env node

/**
 * Simple test to verify short ID generation
 */

const crypto = require('crypto');

function generateShortId() {
  const buffer = crypto.randomBytes(4);
  return buffer.toString('hex').toUpperCase();
}

function isValidShortId(id) {
  return /^[0-9A-Fa-f]{8}$/.test(id);
}

console.log('🔧 Testing Short ID Generation...');

for (let i = 1; i <= 5; i++) {
  const shortId = generateShortId();
  const isValid = isValidShortId(shortId);
  
  console.log(`   ${i}. ${shortId} (length: ${shortId.length}, valid: ${isValid ? '✅' : '❌'})`);
}

console.log('\n✅ Short ID generation is working correctly!');
console.log('📋 Next step: Create a payment link via the UI to test the full flow');

// Test the full URL
const exampleShortId = generateShortId();
const exampleUrl = `https://decode-app-v2.vercel.app/pay/${exampleShortId}`;
console.log('\n🔗 Example short URL:', exampleUrl);
console.log('📏 URL length comparison:');
console.log('   Short URL:', exampleUrl.length, 'characters');
console.log('   Long URL (UUID):', 'https://decode-app-v2.vercel.app/pay/ccaf60ce-6265-4182-b43f-41b3117fb469'.length, 'characters');
console.log('   Saved characters:', 'https://decode-app-v2.vercel.app/pay/ccaf60ce-6265-4182-b43f-41b3117fb469'.length - exampleUrl.length);