#!/usr/bin/env node

/**
 * Test script for short ID generation
 * Run with: node scripts/test-short-id-generation.js
 */

const { generateShortId, generateUniqueShortId, isValidShortId, isValidUUID, isValidPaymentLinkId } = require('../lib/short-id.ts');

// Mock function to simulate database checks
const mockExistingIds = new Set(['12345678', 'ABCDEF12', '87654321']);

async function mockCheckExists(id) {
  // Simulate some database latency
  await new Promise(resolve => setTimeout(resolve, 1));
  return mockExistingIds.has(id);
}

async function testShortIdGeneration() {
  console.log('🧪 Testing Short ID Generation System\n');

  // Test 1: Basic ID generation
  console.log('Test 1: Basic ID generation');
  for (let i = 0; i < 5; i++) {
    const id = generateShortId();
    console.log(`  Generated ID ${i + 1}: ${id} (${id.length} chars)`);
    console.log(`  Is valid short ID: ${isValidShortId(id)}`);
  }
  console.log('');

  // Test 2: Unique ID generation with collision detection
  console.log('Test 2: Unique ID generation with collision detection');
  console.log('  Mock existing IDs:', Array.from(mockExistingIds));
  
  for (let i = 0; i < 3; i++) {
    const uniqueId = await generateUniqueShortId(mockCheckExists);
    console.log(`  Unique ID ${i + 1}: ${uniqueId}`);
    console.log(`  Already exists: ${mockExistingIds.has(uniqueId)}`);
  }
  console.log('');

  // Test 3: Validation functions
  console.log('Test 3: Validation functions');
  const testCases = [
    { id: '12345678', desc: '8-char hex' },
    { id: 'ABCDEF12', desc: '8-char hex uppercase' },
    { id: 'abcdef12', desc: '8-char hex lowercase' },
    { id: '1234567', desc: '7-char (invalid)' },
    { id: '123456789', desc: '9-char (invalid)' },
    { id: '1234567G', desc: '8-char with invalid char' },
    { id: 'ccaf60ce-6265-4182-b43f-41b3117fb469', desc: 'UUID v4' },
    { id: 'invalid-uuid', desc: 'Invalid UUID' }
  ];

  testCases.forEach(({ id, desc }) => {
    console.log(`  ${desc.padRight ? desc.padRight(20) : desc.padEnd(20)}: ${id}`);
    console.log(`    Short ID: ${isValidShortId(id)}`);
    console.log(`    UUID: ${isValidUUID(id)}`);
    console.log(`    Valid Link ID: ${isValidPaymentLinkId(id)}`);
    console.log('');
  });

  // Test 4: Collision probability simulation
  console.log('Test 4: Collision probability simulation');
  const generatedIds = new Set();
  const totalGenerated = 10000;
  let collisions = 0;

  for (let i = 0; i < totalGenerated; i++) {
    const id = generateShortId();
    if (generatedIds.has(id)) {
      collisions++;
    }
    generatedIds.add(id);
  }

  console.log(`  Generated ${totalGenerated} IDs`);
  console.log(`  Unique IDs: ${generatedIds.size}`);
  console.log(`  Collisions: ${collisions}`);
  console.log(`  Collision rate: ${(collisions / totalGenerated * 100).toFixed(4)}%`);
  console.log('');

  // Test 5: URL examples
  console.log('Test 5: URL examples with short IDs');
  const baseUrl = 'https://app.welovedecode.com/pay/';
  for (let i = 0; i < 3; i++) {
    const id = generateShortId();
    console.log(`  ${baseUrl}${id}`);
  }
  console.log('');

  console.log('✅ Short ID generation tests completed!');
  console.log('');
  console.log('Summary:');
  console.log('- 8-character hex IDs provide 4.3 billion combinations');
  console.log('- Collision probability is extremely low for startup scale');
  console.log('- URLs are much shorter and more user-friendly');
  console.log('- System maintains backward compatibility with existing UUIDs');
}

// Add padding function for older Node versions
if (!String.prototype.padEnd) {
  String.prototype.padEnd = function(targetLength, padString) {
    targetLength = targetLength >> 0;
    padString = String(padString || ' ');
    if (this.length >= targetLength) {
      return String(this);
    }
    targetLength = targetLength - this.length;
    if (targetLength > padString.length) {
      padString += padString.repeat(targetLength / padString.length);
    }
    return String(this) + padString.slice(0, targetLength);
  };
}

// Run the tests
if (require.main === module) {
  testShortIdGeneration().catch(console.error);
}

module.exports = { testShortIdGeneration };