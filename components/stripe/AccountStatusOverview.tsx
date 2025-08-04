'use client'

import { VerificationBadge } from './VerificationBadge'

interface AccountStatusOverviewProps {
  status: 'not_connected' | 'pending' | 'active' | 'restricted' | 'rejected'
  balance: number
  pending?: number
  nextPayoutDate: string | null
  currency?: string
}

export function AccountStatusOverview({
  status,
  balance,
  pending = 0,
  nextPayoutDate,
  currency = 'AED'
}: AccountStatusOverviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'active':
        return 'Your account is verified and ready to receive payments'
      case 'pending':
        return 'Your verification is in progress. This usually takes 1-2 business days.'
      case 'restricted':
        return 'Action required to complete your account setup'
      case 'rejected':
        return 'Your account application was not approved. Please contact support.'
      default:
        return 'Connect your bank account to start receiving payments'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'active':
        return 'from-green-600/20 to-green-600/5 border-green-500/30'
      case 'pending':
        return 'from-yellow-600/20 to-yellow-600/5 border-yellow-500/30'
      case 'restricted':
      case 'rejected':
        return 'from-red-600/20 to-red-600/5 border-red-500/30'
      default:
        return 'from-gray-600/20 to-gray-600/5 border-gray-500/30'
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getStatusColor()} border backdrop-blur-sm`}>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Account Overview</h2>
            <p className="text-gray-400 text-sm">{getStatusMessage()}</p>
          </div>
          <VerificationBadge status={status} size="lg" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Available Balance */}
          <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm">
            <p className="text-gray-400 text-sm mb-2">Available Balance</p>
            <p className="text-3xl font-bold text-white">
              {currency} {formatCurrency(balance)}
            </p>
            {balance > 0 && status === 'active' && (
              <p className="text-green-400 text-sm mt-2 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Ready for payout
              </p>
            )}
          </div>

          {/* Pending Balance */}
          <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm">
            <p className="text-gray-400 text-sm mb-2">Pending Balance</p>
            <p className="text-3xl font-bold text-white">
              {currency} {formatCurrency(pending)}
            </p>
            {pending > 0 && (
              <p className="text-yellow-400 text-sm mt-2">Processing</p>
            )}
          </div>

          {/* Next Payout */}
          <div className="bg-white/5 rounded-xl p-6 backdrop-blur-sm">
            <p className="text-gray-400 text-sm mb-2">Next Payout</p>
            {nextPayoutDate && status === 'active' ? (
              <>
                <p className="text-2xl font-semibold text-white">
                  {new Date(nextPayoutDate).toLocaleDateString('en-AE', { 
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Every Monday at 12:00 AM GST
                </p>
              </>
            ) : (
              <p className="text-xl text-gray-500">
                {status === 'active' ? 'No balance to payout' : 'Not available'}
              </p>
            )}
          </div>
        </div>

        {/* Action Button */}
        {status === 'restricted' && (
          <div className="mt-6">
            <button className="w-full md:w-auto cosmic-button-primary">
              Complete Account Setup
            </button>
          </div>
        )}
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-600 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600 rounded-full blur-3xl" />
      </div>
    </div>
  )
}