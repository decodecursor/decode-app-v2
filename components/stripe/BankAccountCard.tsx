'use client'

import { VerificationBadge } from './VerificationBadge'

interface BankAccountCardProps {
  bankName: string
  accountNumber: string // Should be masked like ****1234
  accountHolderName: string
  isPrimary: boolean
  isVerified: boolean
  status: 'pending' | 'verified' | 'rejected' | 'suspended'
  onSetPrimary?: () => void
  onRemove?: () => void
}

export function BankAccountCard({
  bankName,
  accountNumber,
  accountHolderName,
  isPrimary,
  isVerified,
  status,
  onSetPrimary,
  onRemove
}: BankAccountCardProps) {
  const getStatusBadge = () => {
    if (status === 'verified' && isVerified) {
      return 'active'
    } else if (status === 'pending') {
      return 'pending'
    } else if (status === 'rejected') {
      return 'rejected'
    } else {
      return 'restricted'
    }
  }

  return (
    <div className="group relative bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/8 hover:border-white/20 transition-all duration-300">
      {/* Primary Badge */}
      {isPrimary && (
        <div className="absolute top-4 right-4">
          <span className="text-xs bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full border border-purple-500/30">
            Primary
          </span>
        </div>
      )}

      <div className="space-y-4">
        {/* Bank Info */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">{bankName}</h3>
          <p className="text-gray-400 text-sm">{accountHolderName}</p>
        </div>

        {/* Account Number */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Account Number</p>
            <p className="text-white font-mono">{accountNumber}</p>
          </div>
          <VerificationBadge status={getStatusBadge()} size="sm" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {!isPrimary && onSetPrimary && (
            <button
              onClick={onSetPrimary}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Set as Primary
            </button>
          )}
          {onRemove && !isPrimary && (
            <button
              onClick={onRemove}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Hover Effect Gradient */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600/0 via-purple-600/5 to-purple-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  )
}