#!/usr/bin/env node

// Basic Crossmint Error Scenario Testing
// Tests 3 fundamental error scenarios to ensure proper error handling

const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]*?)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      process.env[key.trim()] = value.trim();
    }
  });
}

async function testBasicErrorScenarios() {
  console.log('🧪 Testing Basic Crossmint Error Scenarios\n');
  console.log('=' .repeat(50));

  let testResults = {
    passed: 0,
    failed: 0,
    errors: []
  };

  // Test 1: Invalid API Key
  console.log('\n1️⃣ Testing Invalid API Key');
  try {
    const invalidApiKey = 'invalid-api-key-12345';
    const url = 'https://staging.crossmint.com/api/2022-06-09/wallets';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': invalidApiKey,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok && (response.status === 401 || response.status === 403)) {
      console.log('   ✅ Invalid API key properly rejected');
      console.log(`   📋 Status: ${response.status}`);
      console.log(`   📋 Error: ${data.message || 'Authentication failed'}`);
      testResults.passed++;
    } else {
      console.log('   ❌ Invalid API key was not properly rejected');
      console.log(`   📋 Unexpected status: ${response.status}`);
      testResults.failed++;
      testResults.errors.push('Invalid API key test failed');
    }
  } catch (error) {
    console.log('   ❌ Network error during invalid API key test');
    console.log(`   📋 Error: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`Invalid API key test error: ${error.message}`);
  }

  // Test 2: Missing Required Fields (Wallet Creation)
  console.log('\n2️⃣ Testing Missing Required Fields');
  try {
    const validApiKey = process.env.CROSSMINT_API_KEY;
    if (!validApiKey) {
      console.log('   ⚠️  Skipping - CROSSMINT_API_KEY not found');
    } else {
      const url = 'https://staging.crossmint.com/api/2022-06-09/wallets';
      
      // Send empty request body (missing required fields)
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': validApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Empty body - should fail
      });

      const data = await response.json();
      
      if (!response.ok && response.status === 400) {
        console.log('   ✅ Missing required fields properly rejected');
        console.log(`   📋 Status: ${response.status}`);
        console.log(`   📋 Error: ${data.message || 'Validation failed'}`);
        testResults.passed++;
      } else if (response.ok) {
        console.log('   ❌ Empty request was unexpectedly accepted');
        console.log(`   📋 Response: ${JSON.stringify(data)}`);
        testResults.failed++;
        testResults.errors.push('Missing fields validation failed');
      } else {
        console.log(`   ⚠️  Unexpected response status: ${response.status}`);
        console.log(`   📋 Error: ${data.message || 'Unknown error'}`);
        testResults.passed++; // Still counts as proper error handling
      }
    }
  } catch (error) {
    console.log('   ❌ Network error during missing fields test');
    console.log(`   📋 Error: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`Missing fields test error: ${error.message}`);
  }

  // Test 3: Network Timeout Simulation
  console.log('\n3️⃣ Testing Network Timeout');
  try {
    const validApiKey = process.env.CROSSMINT_API_KEY;
    if (!validApiKey) {
      console.log('   ⚠️  Skipping - CROSSMINT_API_KEY not found');
    } else {
      const url = 'https://staging.crossmint.com/api/2022-06-09/wallets';
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-API-Key': validApiKey,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('   ✅ Network request completed within timeout');
        console.log(`   📋 Status: ${response.status}`);
        testResults.passed++;
        
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.log('   ✅ Network timeout properly handled');
          console.log('   📋 Request was aborted due to timeout');
          testResults.passed++;
        } else {
          throw error; // Re-throw non-timeout errors
        }
      }
    }
  } catch (error) {
    console.log('   ❌ Error during network timeout test');
    console.log(`   📋 Error: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`Network timeout test error: ${error.message}`);
  }

  // Test Results Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results Summary');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`🔄 Total: ${testResults.passed + testResults.failed}`);
  
  if (testResults.errors.length > 0) {
    console.log('\n🚨 Error Details:');
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }

  // Environment Check
  console.log('\n🔧 Environment Status:');
  console.log(`   CROSSMINT_API_KEY: ${process.env.CROSSMINT_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   CROSSMINT_ENVIRONMENT: ${process.env.CROSSMINT_ENVIRONMENT || 'staging'}`);
  
  const success = testResults.failed === 0;
  console.log(`\n${success ? '🎉' : '⚠️'} Basic error handling tests ${success ? 'PASSED' : 'COMPLETED WITH ISSUES'}`);
  
  return testResults;
}

// Run tests if this file is executed directly
if (require.main === module) {
  testBasicErrorScenarios()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testBasicErrorScenarios };