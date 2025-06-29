'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PaymentLink {
  id: string
  title: string
  amount_usd: number
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
        .select('id, title, amount_usd, expiration_date, is_active, created_at')
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
    if (!link.is_active) return 'Inactive'
    
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
      case 'Inactive':
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
          <div className="w-full" style={{maxWidth: '70vw'}}>
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
          <div className="cosmic-card" style={{width: '70vw'}}>
          <div className="cosmic-card">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="cosmic-heading mb-2">My Payment Links</h1>
                <p className="cosmic-body text-gray-300">
                  Manage your payment links and track their status
                </p>
              </div>
              <Link 
                href="/payment/create" 
                className="cosmic-button-primary px-6 py-3"
              >
                Create New Link
              </Link>
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
              <div className="space-y-4">
                {paymentLinks.map((link) => {
                  const status = getStatus(link)
                  const statusColor = getStatusColor(status)
                  
                  return (
                    <div key={link.id} className="border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        {/* Left: Title and Date */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium text-lg truncate">
                            {link.title}
                          </h3>
                          <p className="text-gray-400 text-sm">
                            Created {formatDate(link.created_at)}
                          </p>
                        </div>
                        
                        {/* Center: Amount */}
                        <div className="text-center">
                          <div className="text-white font-medium text-xl">
                            ${link.amount_usd.toFixed(2)}
                          </div>
                        </div>
                        
                        {/* Right: Status and Actions */}
                        <div className="flex items-center gap-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColor} bg-gray-800`}>
                            {status}
                          </span>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyToClipboard(link.id)}
                              disabled={copyingId === link.id || deactivatingId === link.id}
                              className="cosmic-button-secondary px-3 py-2 text-sm border border-white/30 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                              title={generatePaymentUrl(link.id)}
                            >
                              {copyingId === link.id ? (
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>

                            {status === 'Active' && (
                              <button
                                onClick={() => handleDeactivateClick(link)}
                                disabled={deactivatingId === link.id || copyingId === link.id}
                                className="px-3 py-2 text-sm border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {deactivatingId === link.id ? (
                                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                                  </svg>
                                )}
                              </button>
                            )}
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
                Amount: ${linkToDeactivate.amount_usd.toFixed(2)}
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
      </div>
    </div>
  )
}