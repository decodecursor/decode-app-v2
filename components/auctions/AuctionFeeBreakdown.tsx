'use client';

import { calculateProfit, calculatePlatformFee, calculateModelAmount, DEFAULT_AUCTION_FEE_PERCENTAGE } from '@/lib/models/AuctionPayout.model';

interface AuctionFeeBreakdownProps {
  auctionStartPrice: number;
  currentBid: number;
  serviceName: string;
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
  serviceName,
  isCompleted = false,
  className = ''
}: AuctionFeeBreakdownProps) {
  const profit = calculateProfit(currentBid, auctionStartPrice);
  const decodeFee = calculatePlatformFee(currentBid, auctionStartPrice);
  const modelEarnings = calculateModelAmount(profit, decodeFee);

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
        {/* Current/Winning Bid */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600" style={{ fontSize: '16px' }}>{isCompleted ? 'Winning Bid:' : 'Highest Bid:'}</span>
          <span className="font-semibold text-green-600" style={{ fontSize: '16px' }}>{formatCurrency(currentBid)}</span>
        </div>

        {/* Starting Price */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">
            <span style={{ fontSize: '16px' }}>Auction Starting Price </span>
            <span style={{ fontSize: '11px' }}>(Beauty Service Cost):</span>
          </span>
          <span className="font-medium text-gray-900" style={{ fontSize: '16px' }}>- {formatCurrency(auctionStartPrice)}</span>
        </div>

        <div className="border-t border-gray-200 my-3"></div>

        {/* Profit Calculation */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">
            <span style={{ fontSize: '16px' }}>Profit </span>
            <span style={{ fontSize: '11px' }}>(Highest Bid – Auction Starting Price):</span>
          </span>
          <span className="font-medium text-gray-900" style={{ fontSize: '16px' }}>{formatCurrency(profit)}</span>
        </div>

        {/* DECODE Fee */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">
            <span style={{ fontSize: '16px' }}>DECODE Service Fee </span>
            <span style={{ fontSize: '11px' }}>({DEFAULT_AUCTION_FEE_PERCENTAGE}% of Profit):</span>
          </span>
          <span className="font-medium text-gray-900" style={{ fontSize: '16px' }}>- {formatCurrency(decodeFee)}</span>
        </div>

        <div className="border-t border-gray-300 my-3"></div>

        {/* Model Net Earnings */}
        <div className="flex justify-between items-center">
          <span className="font-bold text-gray-900" style={{ fontSize: '17px' }}>Your Net Profit (+FREE {serviceName}):</span>
          <span className="text-xl font-bold text-gray-900">{formatCurrency(modelEarnings)}</span>
        </div>

        {/* Explanation */}
        {profit === 0 && (
          <p className="text-xs text-gray-500 mt-2 italic">
            No profit yet. DECODE fee only applies to profit above the starting price.
          </p>
        )}

        {!isCompleted && currentBid > auctionStartPrice && (
          <p className="text-xs text-gray-500 mt-2 italic">
            * These earnings are based on the highest bid so far and will finalize at auction end.
          </p>
        )}
      </div>
    </div>
  );
}
