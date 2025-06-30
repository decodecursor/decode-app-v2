'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PaymentLink {
  id: string
  client_name?: string
  title: string
  amount_aed: number
  expiration_date: string
  is_active: boolean
  created_at: string
}

export default function MyLinks() {
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [linkToDeactivate, setLinkToDeactivate] = useState<PaymentLink | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  const [linkToDelete, setLinkToDelete] = useState<PaymentLink | null>(null)
  const [showDeactivateFirstDialog, setShowDeactivateFirstDialog] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }
      await fetchPaymentLinks(user.id)
    }
    
    getUser()
  }, [router])

  const fetchPaymentLinks = async (userId: string) => {
    try {
      setLoading(true)
      setError('')

      const { data, error: fetchError } = await supabase
        .from('payment_links')
        .select('id, client_name, title, amount_aed, expiration_date, is_active, created_at')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw fetchError
      }

      setPaymentLinks(data || [])
    } catch (error) {
      console.error('Error fetching payment links:', error)
      setError('Failed to load payment links')
    } finally {
      setLoading(false)
    }
  }

  const getStatus = (link: PaymentLink) => {
    if (!link.is_active) return 'Deactivated'
    
    const now = new Date()
    const expirationDate = new Date(link.expiration_date)
    
    return now > expirationDate ? 'Expired' : 'Active'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'text-green-400'
      case 'Expired':
        return 'text-yellow-400'
      case 'Deactivated':
        return 'text-gray-400'
      default:
        return 'text-gray-400'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getTimeUntilExpiry = (expirationDateString: string) => {
    const now = new Date()
    const expirationDate = new Date(expirationDateString)
    const diffInMs = expirationDate.getTime() - now.getTime()
    const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInDays < 0) {
      const pastDays = Math.abs(diffInDays)
      return pastDays === 1 ? 'expired 1 day ago' : `expired ${pastDays} days ago`
    } else if (diffInDays === 0) {
      return 'expires today'
    } else if (diffInDays === 1) {
      return 'in 1 day'
    } else {
      return `in ${diffInDays} days`
    }
  }

  const getExpiryColor = (expirationDateString: string) => {
    const now = new Date()
    const expirationDate = new Date(expirationDateString)
    const diffInMs = expirationDate.getTime() - now.getTime()
    const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInDays < 0) {
      return 'text-red-400' // Expired
    } else if (diffInDays <= 1) {
      return 'text-red-400' // Less than 1 day
    } else if (diffInDays <= 2) {
      return 'text-yellow-400' // 1-2 days
    } else {
      return 'text-green-400' // More than 2 days
    }
  }

  const generatePaymentUrl = (linkId: string) => {
    // Generate public payment URL using environment variable
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    const finalUrl = `${baseUrl}/pay/${linkId}`
    
    // DEBUG: Log the URL generation details
    console.log('🔍 MyLinks URL Debug:', {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      windowLocationOrigin: typeof window !== 'undefined' ? window.location.origin : 'N/A (SSR)',
      baseUrl,
      linkId,
      finalUrl
    })
    
    return finalUrl
  }

  const copyToClipboard = async (linkId: string) => {
    try {
      setCopyingId(linkId)
      const paymentUrl = generatePaymentUrl(linkId)
      
      // Use the modern Clipboard API if available
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(paymentUrl)
      } else {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement('textarea')
        textArea.value = paymentUrl
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }
      
      setCopyMessage('Payment link copied to clipboard!')
      
      // Clear the success message after 3 seconds
      setTimeout(() => {
        setCopyMessage('')
      }, 3000)
      
    } catch (error) {
      console.error('Failed to copy:', error)
      setCopyMessage('Failed to copy link. Please try again.')
      
      setTimeout(() => {
        setCopyMessage('')
      }, 3000)
    } finally {
      setCopyingId(null)
    }
  }

  const handleDeactivateClick = (link: PaymentLink) => {
    setLinkToDeactivate(link)
    setShowConfirmDialog(true)
  }

  const confirmDeactivation = async () => {
    if (!linkToDeactivate) return

    try {
      setDeactivatingId(linkToDeactivate.id)
      setShowConfirmDialog(false)

      const { error: updateError } = await supabase
        .from('payment_links')
        .update({ is_active: false })
        .eq('id', linkToDeactivate.id)

      if (updateError) {
        throw updateError
      }

      // Update the local state to reflect the change
      setPaymentLinks(prev => 
        prev.map(link => 
          link.id === linkToDeactivate.id 
            ? { ...link, is_active: false }
            : link
        )
      )

      setCopyMessage('Payment link deactivated successfully!')
      
      setTimeout(() => {
        setCopyMessage('')
      }, 3000)

    } catch (error) {
      console.error('Error deactivating payment link:', error)
      setCopyMessage('Failed to deactivate payment link. Please try again.')
      
      setTimeout(() => {
        setCopyMessage('')
      }, 3000)
    } finally {
      setDeactivatingId(null)
      setLinkToDeactivate(null)
    }
  }

  const cancelDeactivation = () => {
    setShowConfirmDialog(false)
    setLinkToDeactivate(null)
  }

  const handleDeleteClick = (link: PaymentLink) => {
    const status = getStatus(link)
    if (status === 'Active') {
      setLinkToDelete(link)
      setShowDeactivateFirstDialog(true)
    } else {
      setLinkToDelete(link)
      setShowDeleteConfirmDialog(true)
    }
  }

  const confirmDeletion = async () => {
    if (!linkToDelete) return

    try {
      setDeletingId(linkToDelete.id)
      setShowDeleteConfirmDialog(false)

      const { error: deleteError } = await supabase
        .from('payment_links')
        .delete()
        .eq('id', linkToDelete.id)

      if (deleteError) {
        throw deleteError
      }

      // Remove from local state
      setPaymentLinks(prev => prev.filter(link => link.id !== linkToDelete.id))

      setCopyMessage('Payment link deleted successfully!')
      
      setTimeout(() => {
        setCopyMessage('')
      }, 3000)

    } catch (error) {
      console.error('Error deleting payment link:', error)
      setCopyMessage('Failed to delete payment link. Please try again.')
      
      setTimeout(() => {
        setCopyMessage('')
      }, 3000)
    } finally {
      setDeletingId(null)
      setLinkToDelete(null)
    }
  }

  const cancelDeletion = () => {
    setShowDeleteConfirmDialog(false)
    setLinkToDelete(null)
  }

  const handleDeactivateFirst = async () => {
    if (!linkToDelete) return

    try {
      setDeactivatingId(linkToDelete.id)
      setShowDeactivateFirstDialog(false)

      const { error: updateError } = await supabase
        .from('payment_links')
        .update({ is_active: false })
        .eq('id', linkToDelete.id)

      if (updateError) {
        throw updateError
      }

      // Update the local state
      setPaymentLinks(prev => 
        prev.map(link => 
          link.id === linkToDelete.id 
            ? { ...link, is_active: false }
            : link
        )
      )

      // Now show delete confirmation
      setShowDeleteConfirmDialog(true)

    } catch (error) {
      console.error('Error deactivating payment link:', error)
      setCopyMessage('Failed to deactivate payment link. Please try again.')
      
      setTimeout(() => {
        setCopyMessage('')
      }, 3000)
      
      setLinkToDelete(null)
    } finally {
      setDeactivatingId(null)
    }
  }

  const cancelDeactivateFirst = () => {
    setShowDeactivateFirstDialog(false)
    setLinkToDelete(null)
  }

  if (loading) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <div className="cosmic-body text-white">Loading your payment links...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen px-4 py-8">
        {/* Back to Dashboard Link */}
        <div className="flex justify-center mb-8">
          <div style={{width: '70vw'}}>
          <Link href="/dashboard" className="inline-flex items-center text-gray-300 hover:text-white transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-center mb-8">
          <div style={{width: '70vw'}}>
          <div className="cosmic-card">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="cosmic-heading mb-2">My PayLinks</h1>
              </div>
              <Link 
                href="/payment/create" 
                className="cosmic-button-primary px-4 py-2 !w-fit"
              >
                Create PayLink
              </Link>
            </div>
          </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex justify-center">
          <div style={{width: '70vw'}}>
          {/* Success/Error Messages */}
          {(error || copyMessage) && (
            <div className="cosmic-card mb-8">
              {error && (
                <div className="text-center p-4 text-red-300 bg-red-900/20 rounded-lg mb-4">
                  {error}
                </div>
              )}
              {copyMessage && (
                <div className={`text-center p-4 rounded-lg ${
                  copyMessage.includes('Failed') 
                    ? 'text-red-300 bg-red-900/20' 
                    : 'text-green-300 bg-green-900/20'
                }`}>
                  {copyMessage}
                </div>
              )}
            </div>
          )}

          {paymentLinks.length === 0 ? (
            /* Empty State */
            <div className="cosmic-card text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <h2 className="cosmic-heading mb-2 text-white">No Payment Links Yet</h2>
                <p className="cosmic-body text-gray-300 mb-6">
                  Create your first payment link to start accepting payments from customers.
                </p>
                <Link 
                  href="/payment/create" 
                  className="cosmic-button-primary px-8 py-3"
                >
                  Create Your First Link
                </Link>
              </div>
            </div>
          ) : (
            /* Payment Links List */
            <div className="cosmic-card">
              <div className="space-y-6">
                {paymentLinks.map((link) => {
                  const status = getStatus(link)
                  const statusColor = getStatusColor(status)
                  
                  return (
                    <div key={link.id} className="relative overflow-hidden bg-slate-900/85 border border-gray-600 border-l-4 border-l-purple-500/50 rounded-lg shadow-lg p-5 hover:border-blue-400 hover:bg-slate-800/90 hover:shadow-2xl hover:shadow-blue-400/60 hover:scale-[1.01] transition-all duration-300 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700 before:ease-out">
                      <div className="flex flex-col gap-4">
                        {/* Top Row: Title, Amount, Status */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex-1">
                            {link.client_name && (
                              <p className="text-purple-400 text-base font-semibold mb-1">
                                {link.client_name}
                              </p>
                            )}
                            <h3 className="text-white font-medium text-lg mb-3">
                              {link.title}
                            </h3>
                          </div>
                          
                          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                            <div className="text-right">
                              <div className="text-white font-medium text-xl">
                                AED {link.amount_aed.toFixed(2)}
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColor} bg-gray-800`}>
                                {status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Date Row - Full Width */}
                        <div className="w-full flex justify-between items-center">
                          <p className="text-gray-400 text-sm">
                            Created {formatDate(link.created_at)}
                          </p>
                          {link.is_active && (
                            <p className={`text-sm ${getExpiryColor(link.expiration_date)}`}>
                              Expires {formatDate(link.expiration_date)} ({getTimeUntilExpiry(link.expiration_date)})
                            </p>
                          )}
                        </div>

                        {/* Bottom Row: Payment URL and Action Buttons */}
                        <div className="pt-3 border-t border-gray-700">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-400 text-xs mb-1">Payment Link:</p>
                              <p className="text-gray-300 text-sm font-mono truncate">
                                {generatePaymentUrl(link.id)}
                              </p>
                            </div>
                            <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => copyToClipboard(link.id)}
                              disabled={copyingId === link.id || deactivatingId === link.id || deletingId === link.id}
                              className="cosmic-button-secondary px-4 py-2 text-sm border border-white/30 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                            >
                              {copyingId === link.id ? (
                                <span className="flex items-center gap-2">
                                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Copying...
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  Copy Link
                                </span>
                              )}
                            </button>

                            {/* Only show deactivate button for active links */}
                            {status === 'Active' && (
                              <button
                                onClick={() => handleDeactivateClick(link)}
                                disabled={deactivatingId === link.id || copyingId === link.id || deletingId === link.id}
                                className="px-4 py-2 text-sm border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {deactivatingId === link.id ? (
                                  <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Deactivating...
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                                    </svg>
                                    Deactivate
                                  </span>
                                )}
                              </button>
                            )}

                            {/* Delete button - compact size (20% width of other buttons) */}
                            <button
                              onClick={() => handleDeleteClick(link)}
                              disabled={deletingId === link.id || copyingId === link.id || deactivatingId === link.id}
                              className="px-2 py-2 text-sm border border-gray-500/50 text-gray-400 hover:bg-gray-500/10 hover:border-gray-500 hover:text-red-400 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete payment link"
                            >
                              {deletingId === link.id ? (
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Confirmation Dialog */}
        {showConfirmDialog && linkToDeactivate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="cosmic-card max-w-md w-full">
              <h3 className="cosmic-heading mb-4 text-white">Deactivate Payment Link</h3>
              <p className="cosmic-body text-gray-300 mb-4">
                Are you sure you want to deactivate the payment link for &ldquo;{linkToDeactivate.title}&rdquo;? 
                This will prevent customers from making payments through this link.
              </p>
              <p className="cosmic-body text-gray-400 text-sm mb-6">
                Amount: AED {linkToDeactivate.amount_aed.toFixed(2)}
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={cancelDeactivation}
                  className="cosmic-button-secondary flex-1 py-3 border border-white/30 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeactivation}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Deactivate Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirmDialog && linkToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="cosmic-card max-w-md w-full">
              <h3 className="cosmic-heading mb-4 text-white">Delete Payment Link</h3>
              <p className="cosmic-body text-gray-300 mb-4">
                Are you sure you want to permanently delete the payment link for &ldquo;{linkToDelete.title}&rdquo;? 
                This action cannot be undone.
              </p>
              <p className="cosmic-body text-gray-400 text-sm mb-6">
                Amount: AED {linkToDelete.amount_aed.toFixed(2)}
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={cancelDeletion}
                  className="cosmic-button-secondary flex-1 py-3 border border-white/30 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeletion}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deactivate First Dialog */}
        {showDeactivateFirstDialog && linkToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="cosmic-card max-w-md w-full">
              <h3 className="cosmic-heading mb-4 text-white">Link is Active</h3>
              <p className="cosmic-body text-gray-300 mb-4">
                The payment link &ldquo;{linkToDelete.title}&rdquo; is currently active. 
                You need to deactivate it first before you can delete it.
              </p>
              <p className="cosmic-body text-gray-400 text-sm mb-6">
                Would you like to deactivate it now and proceed with deletion?
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={cancelDeactivateFirst}
                  className="cosmic-button-secondary flex-1 py-3 border border-white/30 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivateFirst}
                  className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
                  disabled={deactivatingId === linkToDelete.id}
                >
                  {deactivatingId === linkToDelete.id ? 'Deactivating...' : 'Deactivate & Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}