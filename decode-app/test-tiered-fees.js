// Test script for tiered fee calculations

function getTieredFeePercentage(amount) {
  if (amount >= 5 && amount <= 999) {
    return 7; // 7% for AED 5-999
  } else if (amount >= 1000 && amount <= 2499) {
    return 6; // 6% for AED 1,000-2,499
  } else if (amount >= 2500 && amount <= 4999) {
    return 5; // 5% for AED 2,500-4,999
  } else if (amount >= 5000 && amount <= 9999) {
    return 4; // 4% for AED 5,000-9,999
  } else if (amount >= 10000 && amount <= 24999) {
    return 3.5; // 3.5% for AED 10,000-24,999
  } else if (amount >= 25000 && amount <= 49999) {
    return 3.4; // 3.4% for AED 25,000-49,999
  } else if (amount >= 50000 && amount <= 74999) {
    return 3.3; // 3.3% for AED 50,000-74,999
  } else if (amount >= 75000 && amount <= 100000) {
    return 3.2; // 3.2% for AED 75,000-100,000
  } else {
    // Default to 7% for amounts outside defined ranges
    return 7;
  }
}

function calculateMarketplaceFee(originalAmount) {
  const feePercentage = getTieredFeePercentage(originalAmount);
  const feeDecimal = feePercentage / 100;

  // Calculate fee based on tiered percentage
  const feeAmount = Number((originalAmount * feeDecimal).toFixed(2));
  const totalAmount = Number((originalAmount + feeAmount).toFixed(2));

  return {
    originalAmount: Number(originalAmount.toFixed(2)),
    feePercentage,
    feeAmount,
    totalAmount
  };
}

console.log('🧪 Testing 8-Tier Fee Calculations:');
console.log('');

// Test cases for each tier
const testCases = [
  { amount: 500, expectedFee: 7, tier: 'Tier 1 (5-999)' },
  { amount: 999, expectedFee: 7, tier: 'Tier 1 (5-999)' },
  { amount: 1000, expectedFee: 6, tier: 'Tier 2 (1000-2499)' },
  { amount: 1500, expectedFee: 6, tier: 'Tier 2 (1000-2499)' },
  { amount: 2499, expectedFee: 6, tier: 'Tier 2 (1000-2499)' },
  { amount: 2500, expectedFee: 5, tier: 'Tier 3 (2500-4999)' },
  { amount: 3000, expectedFee: 5, tier: 'Tier 3 (2500-4999)' },
  { amount: 4999, expectedFee: 5, tier: 'Tier 3 (2500-4999)' },
  { amount: 5000, expectedFee: 4, tier: 'Tier 4 (5000-9999)' },
  { amount: 7500, expectedFee: 4, tier: 'Tier 4 (5000-9999)' },
  { amount: 9999, expectedFee: 4, tier: 'Tier 4 (5000-9999)' },
  { amount: 10000, expectedFee: 3.5, tier: 'Tier 5 (10000-24999)' },
  { amount: 15000, expectedFee: 3.5, tier: 'Tier 5 (10000-24999)' },
  { amount: 24999, expectedFee: 3.5, tier: 'Tier 5 (10000-24999)' },
  { amount: 25000, expectedFee: 3.4, tier: 'Tier 6 (25000-49999)' },
  { amount: 35000, expectedFee: 3.4, tier: 'Tier 6 (25000-49999)' },
  { amount: 49999, expectedFee: 3.4, tier: 'Tier 6 (25000-49999)' },
  { amount: 50000, expectedFee: 3.3, tier: 'Tier 7 (50000-74999)' },
  { amount: 60000, expectedFee: 3.3, tier: 'Tier 7 (50000-74999)' },
  { amount: 74999, expectedFee: 3.3, tier: 'Tier 7 (50000-74999)' },
  { amount: 75000, expectedFee: 3.2, tier: 'Tier 8 (75000-100000)' },
  { amount: 90000, expectedFee: 3.2, tier: 'Tier 8 (75000-100000)' },
  { amount: 100000, expectedFee: 3.2, tier: 'Tier 8 (75000-100000)' }
];

testCases.forEach(test => {
  const result = calculateMarketplaceFee(test.amount);
  const expectedFeeAmount = Number((test.amount * test.expectedFee / 100).toFixed(2));
  const expectedTotal = Number((test.amount + expectedFeeAmount).toFixed(2));

  console.log(`Amount: AED ${test.amount.toLocaleString()}`);
  console.log(`  Tier: ${test.tier}`);
  console.log(`  Expected Fee: ${test.expectedFee}% = AED ${expectedFeeAmount.toLocaleString()}`);
  console.log(`  Calculated Fee: ${result.feePercentage}% = AED ${result.feeAmount.toLocaleString()}`);
  console.log(`  Total Amount: AED ${result.totalAmount.toLocaleString()} (expected: AED ${expectedTotal.toLocaleString()})`);

  const isCorrectPercentage = result.feePercentage === test.expectedFee;
  const isCorrectAmount = Math.abs(result.feeAmount - expectedFeeAmount) < 0.01;
  const isCorrectTotal = Math.abs(result.totalAmount - expectedTotal) < 0.01;

  console.log(`  ${isCorrectPercentage && isCorrectAmount && isCorrectTotal ? '✅ PASS' : '❌ FAIL'}`);

  if (!isCorrectPercentage || !isCorrectAmount || !isCorrectTotal) {
    console.log(`  ❌ Issues: ${!isCorrectPercentage ? 'percentage ' : ''}${!isCorrectAmount ? 'amount ' : ''}${!isCorrectTotal ? 'total' : ''}`);
  }
  console.log('');
});

console.log('🎯 Summary of NEW 8-Tier Fee Structure:');
console.log('  • AED 5 - 999: 7% fee');
console.log('  • AED 1,000 - 2,499: 6% fee');
console.log('  • AED 2,500 - 4,999: 5% fee');
console.log('  • AED 5,000 - 9,999: 4% fee');
console.log('  • AED 10,000 - 24,999: 3.5% fee');
console.log('  • AED 25,000 - 49,999: 3.4% fee');
console.log('  • AED 50,000 - 74,999: 3.3% fee');
console.log('  • AED 75,000 - 100,000: 3.2% fee');
console.log('');
console.log('✅ All tests completed!');
