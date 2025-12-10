'use client'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  confirmButtonClass?: string
  loading?: boolean
  children?: React.ReactNode
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Remove",
  confirmButtonClass = "bg-red-600 hover:bg-red-700",
  loading = false,
  children
}: ConfirmationModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-md">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>

          <p className="text-gray-300 mb-4">{message}</p>

          {children && (
            <div className="mb-6">
              {children}
            </div>
          )}

          <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-3 mb-6">
            <p className="text-yellow-100 text-sm">
              ⚠️ This action cannot be undone. You will need to re-add your payment method to receive future payouts.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 cosmic-button-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 ${confirmButtonClass} text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? 'Removing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}