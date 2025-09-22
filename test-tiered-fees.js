// Test script for tiered fee calculations

function getTieredFeePercentage(amount) {
  if (amount >= 1 && amount <= 1999) {
    return 9; // 9% for AED 1-1999
  } else if (amount >= 2000 && amount <= 4999) {
    return 7.5; // 7.5% for AED 2000-4999
  } else if (amount >= 5000 && amount <= 100000) {
    return 6; // 6% for AED 5000-100000
  } else {
    // Default to 9% for amounts outside defined ranges
    return 9;
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

console.log('🧪 Testing Tiered Fee Calculations:');
console.log('');

// Test cases for each tier
const testCases = [
  { amount: 1500, expectedFee: 9, tier: 'Tier 1 (1-1999)' },
  { amount: 1999, expectedFee: 9, tier: 'Tier 1 (1-1999)' },
  { amount: 2000, expectedFee: 7.5, tier: 'Tier 2 (2000-4999)' },
  { amount: 3000, expectedFee: 7.5, tier: 'Tier 2 (2000-4999)' },
  { amount: 4999, expectedFee: 7.5, tier: 'Tier 2 (2000-4999)' },
  { amount: 5000, expectedFee: 6, tier: 'Tier 3 (5000-100000)' },
  { amount: 8000, expectedFee: 6, tier: 'Tier 3 (5000-100000)' },
  { amount: 50000, expectedFee: 6, tier: 'Tier 3 (5000-100000)' }
];

testCases.forEach(test => {
  const result = calculateMarketplaceFee(test.amount);
  const expectedFeeAmount = Number((test.amount * test.expectedFee / 100).toFixed(2));
  const expectedTotal = Number((test.amount + expectedFeeAmount).toFixed(2));

  console.log(`Amount: AED ${test.amount}`);
  console.log(`  Tier: ${test.tier}`);
  console.log(`  Expected Fee: ${test.expectedFee}% = AED ${expectedFeeAmount}`);
  console.log(`  Calculated Fee: ${result.feePercentage}% = AED ${result.feeAmount}`);
  console.log(`  Total Amount: AED ${result.totalAmount} (expected: AED ${expectedTotal})`);

  const isCorrectPercentage = result.feePercentage === test.expectedFee;
  const isCorrectAmount = Math.abs(result.feeAmount - expectedFeeAmount) < 0.01;
  const isCorrectTotal = Math.abs(result.totalAmount - expectedTotal) < 0.01;

  console.log(`  ✅ ${isCorrectPercentage && isCorrectAmount && isCorrectTotal ? 'PASS' : 'FAIL'}`);

  if (!isCorrectPercentage || !isCorrectAmount || !isCorrectTotal) {
    console.log(`  ❌ Issues: ${!isCorrectPercentage ? 'percentage ' : ''}${!isCorrectAmount ? 'amount ' : ''}${!isCorrectTotal ? 'total' : ''}`);
  }
  console.log('');
});

console.log('🎯 Summary of fee structure:');
console.log('  • AED 1 - 1,999: 9% fee');
console.log('  • AED 2,000 - 4,999: 7.5% fee');
console.log('  • AED 5,000 - 100,000: 6% fee');
console.log('');
console.log('✅ All tests completed!');