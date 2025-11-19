'use client';

import { calculateProfit, calculatePlatformFee, calculateModelAmount, DEFAULT_AUCTION_FEE_PERCENTAGE } from '@/lib/models/AuctionPayout.model';

interface AuctionFeeBreakdownProps {
  auctionStartPrice: number;
  currentBid: number;
  isCompleted?: boolean;
  className?: string;
}

/**
 * AuctionFeeBreakdown Component
 * Displays the profit-based fee calculation for MODEL creators
 *
 * Shows:
 * - Auction Start Price (base service cost)
 * - Current/Winning Bid
 * - Profit (winning bid - start price)
 * - DECODE Fee (25% of profit)
 * - Model Net Earnings
 */
export function AuctionFeeBreakdown({
  auctionStartPrice,
  currentBid,
  isCompleted = false,
  className = ''
}: AuctionFeeBreakdownProps) {
  const profit = calculateProfit(currentBid, auctionStartPrice);
  const decodeFee = calculatePlatformFee(currentBid, auctionStartPrice);
  const modelEarnings = calculateModelAmount(currentBid, decodeFee);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 shadow-sm ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {isCompleted ? 'Final Earnings Breakdown' : 'Estimated Earnings'}
      </h3>

      <div className="space-y-3">
        {/* Starting Price */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Auction Start Price (Base Service Cost):</span>
          <span className="font-medium text-gray-900">{formatCurrency(auctionStartPrice)}</span>
        </div>

        {/* Current/Winning Bid */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">{isCompleted ? 'Winning Bid:' : 'Current Highest Bid:'}</span>
          <span className="font-semibold text-blue-600">{formatCurrency(currentBid)}</span>
        </div>

        <div className="border-t border-gray-200 my-3"></div>

        {/* Profit Calculation */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Profit (Bid - Start Price):</span>
          <span className="font-medium text-gray-900">{formatCurrency(profit)}</span>
        </div>

        {/* DECODE Fee */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">
            DECODE Auction Fee ({DEFAULT_AUCTION_FEE_PERCENTAGE}% of profit):
          </span>
          <span className="font-medium text-red-600">-{formatCurrency(decodeFee)}</span>
        </div>

        <div className="border-t border-gray-300 my-3"></div>

        {/* Model Net Earnings */}
        <div className="flex justify-between items-center bg-green-50 p-3 rounded-md">
          <span className="font-semibold text-gray-900">Your Net Earnings:</span>
          <span className="text-xl font-bold text-green-600">{formatCurrency(modelEarnings)}</span>
        </div>

        {/* Explanation */}
        {profit === 0 && (
          <p className="text-xs text-gray-500 mt-2 italic">
            No profit yet. DECODE fee only applies to profit above the starting price.
          </p>
        )}

        {!isCompleted && currentBid > auctionStartPrice && (
          <p className="text-xs text-gray-500 mt-2 italic">
            * These are estimated earnings based on the current highest bid. Final earnings will be calculated when the auction closes.
          </p>
        )}

        {/* Calculation Example */}
        {isCompleted && profit > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md text-xs text-gray-600">
            <p className="font-medium mb-1">Calculation:</p>
            <p>Service Cost: {formatCurrency(auctionStartPrice)}</p>
            <p>Profit: {formatCurrency(currentBid)} - {formatCurrency(auctionStartPrice)} = {formatCurrency(profit)}</p>
            <p>DECODE Fee: {formatCurrency(profit)} × 25% = {formatCurrency(decodeFee)}</p>
            <p>Your Earnings: {formatCurrency(auctionStartPrice)} + {formatCurrency(profit - decodeFee)} = {formatCurrency(modelEarnings)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
