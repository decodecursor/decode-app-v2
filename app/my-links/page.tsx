'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import HeartAnimation from '@/components/effects/HeartAnimation'

interface PaymentLink {
  id: string
  client_name: string | null
  title: string
  amount_aed: number
  service_amount_aed?: number
  decode_amount_aed?: number
  total_amount_aed?: number
  description?: string | null
  expiration_date: string
  is_active: boolean
  payment_status: 'unpaid' | 'paid' | 'failed' | 'refunded'
  paid_at: string | null
  is_paid?: boolean
  created_at: string
}

function MyLinksContent() {
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // Format amount with thousands separators 
  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }
  const [error, setError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [linkToDeactivate, setLinkToDeactivate] = useState<PaymentLink | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  const [linkToDelete, setLinkToDelete] = useState<PaymentLink | null>(null)
  const [showDeactivateFirstDialog, setShowDeactivateFirstDialog] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('')
  const [currentQRLink, setCurrentQRLink] = useState<PaymentLink | null>(null)
  const [generatingQR, setGeneratingQR] = useState(false)
  const [newPayLinkId, setNewPayLinkId] = useState<string | null>(null)
  const [highlightingId, setHighlightingId] = useState<string | null>(null)
  const [heartAnimatingId, setHeartAnimatingId] = useState<string | null>(null)
  const [lastCheckedTimestamp, setLastCheckedTimestamp] = useState<number>(Date.now())
  const [visibleCount, setVisibleCount] = useState(6)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }
      await fetchPaymentLinks(user.id)
      
      // Set up real-time subscription for payment status changes
      console.log('🔄 Setting up real-time subscription for user:', user.id); // Force deployment
      const subscription = supabase
        .channel('payment_links_changes')
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'payment_links'
            // Removed filter to test if that's blocking updates
          }, 
          (payload) => {
            // Only process updates for this user's payment links
            if (payload.new?.creator_id !== user.id) {
              return; // Skip updates for other users
            }
            console.log('💖 Real-time payment update received:', payload)
            console.log('💖 Payload details:', {
              event_type: payload.eventType,
              old_is_paid: payload.old?.is_paid,
              new_is_paid: payload.new?.is_paid,
              link_id: payload.new?.id
            })
            
            // Check if is_paid changed to true (handle null/undefined as false)
            if (payload.new.is_paid === true && !payload.old?.is_paid) {
              console.log('🎉 Payment completed! Triggering heart animation for:', payload.new.id)
              
              // Trigger heart animation
              setHeartAnimatingId(payload.new.id)
              
              // Auto-hide after 3 seconds
              setTimeout(() => {
                setHeartAnimatingId(null)
              }, 3000)
            }
            
            // Always update the payment link in state for any change
            console.log('🔄 Updating payment link state...')
            setPaymentLinks(prev => {
              const updated = prev.map(link => 
                link.id === payload.new.id 
                  ? {
                      ...link,
                      is_paid: payload.new.is_paid || false,
                      is_active: payload.new.is_active || false,
                      payment_status: (payload.new.is_paid ? 'paid' : 'unpaid') as 'paid' | 'unpaid'
                    }
                  : link
              )
              console.log('✅ Payment links state updated')
              return updated
            })
          }
        )
        .subscribe((status) => {
          console.log('📡 Real-time subscription status:', status)
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to real-time updates')
          } else {
            console.warn('⚠️ Real-time subscription status:', status)
          }
        })
        
      // Fallback polling mechanism (every 10 seconds)
      console.log('🔄 Setting up fallback polling for payment status changes...');
      const pollingInterval = setInterval(async () => {
        try {
          console.log('🔍 Polling for payment status changes...');
          
          // Fetch current payment links and compare with state
          const { data: currentLinks, error } = await (supabase as any)
            .from('payment_links')
            .select('id, is_paid, is_active')
            .eq('creator_id', user.id);
            
          if (!error && currentLinks) {
            const currentTime = Date.now();
            
            currentLinks.forEach((currentLink: any) => {
              // Use functional state update to get current state
              setPaymentLinks(prev => {
                const existingLink = prev.find(link => link.id === currentLink.id);
                
                // Check if payment status changed to paid
                if (existingLink && !existingLink.is_paid && currentLink.is_paid) {
                  console.log('🎉 POLLING: Payment completed! Triggering heart animation for:', currentLink.id);
                  
                  // Trigger heart animation
                  setHeartAnimatingId(currentLink.id);
                  setTimeout(() => setHeartAnimatingId(null), 3000);
                  
                  // Update this link to paid
                  return prev.map(link => 
                    link.id === currentLink.id 
                      ? { ...link, is_paid: true, payment_status: 'paid' as 'paid' }
                      : link
                  );
                }
                
                // No change needed
                return prev;
              });
            });
            
            setLastCheckedTimestamp(currentTime);
          }
        } catch (pollingError) {
          console.error('❌ Polling error:', pollingError);
        }
      }, 10000); // Check every 10 seconds
      
      // Cleanup subscription and polling
      return () => {
        subscription.unsubscribe()
        clearInterval(pollingInterval)
      }
    }
    
    getUser()
  }, [router])

  // Detect new PayLink from URL parameter and trigger highlight effect
  useEffect(() => {
    const newId = searchParams.get('new')
    if (newId) {
      setNewPayLinkId(newId)
      // Start highlighting effect after a short delay to ensure the page is loaded
      setTimeout(() => {
        setHighlightingId(newId)
        // Remove highlight after 1.5 seconds
        setTimeout(() => {
          setHighlightingId(null)
          setNewPayLinkId(null)
          // Clean up URL parameter
          const url = new URL(window.location.href)
          url.searchParams.delete('new')
          window.history.replaceState({}, '', url.toString())
        }, 1500)
      }, 500)
    }
  }, [searchParams])

  // Create magical highlight effect for new PayLink
  const createNewPayLinkHighlight = (cardElement: HTMLElement) => {
    if (typeof window === 'undefined') return
    
    const rect = cardElement.getBoundingClientRect()
    const totalStars = 30
    const starTypes = ['star-sparkle', 'star-dot', 'star-diamond', 'star-triangle', 'click-star']
    const animations = ['magic-fly-1', 'magic-fly-2', 'magic-fly-3', 'magic-fly-4', 'magic-fly-5', 'magic-spiral']
    
    for (let i = 0; i < totalStars; i++) {
      setTimeout(() => {
        if (typeof window === 'undefined') return
        
        const star = document.createElement('div')
        
        const starType = starTypes[Math.floor(Math.random() * starTypes.length)]
        star.className = `click-star ${starType}`
        
        const x = rect.left + Math.random() * rect.width
        const y = rect.top + Math.random() * rect.height
        
        star.style.left = x + 'px'
        star.style.top = y + 'px'
        
        const animation = animations[Math.floor(Math.random() * animations.length)]
        star.classList.add(animation || 'magic-fly-1')
        
        const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#fff']
        if (starType === 'star-dot') {
          star.style.background = colors[Math.floor(Math.random() * colors.length)] || '#ffd700'
        }
        
        document.body.appendChild(star)
        
        setTimeout(() => {
          if (star.parentNode) {
            star.parentNode.removeChild(star)
          }
        }, 2500)
      }, i * 30)
    }
  }

  const fetchPaymentLinks = async (userId: string) => {
    try {
      setLoading(true)
      setError('')

      // Fetch payment links with backwards compatible is_paid and paid_at columns
      let paymentLinksData, fetchError
      try {
        // Try to get payment_status and paid_at columns (from migration) + transaction data as backup
        console.log('🔍 Attempting to fetch with payment_status, paid_at, and transaction data...')
        const result = await (supabase as any)
          .from('payment_links')
          .select(`
            id, client_name, title, description, amount_aed, service_amount_aed, decode_amount_aed, total_amount_aed, 
            expiration_date, is_active, created_at, payment_status, paid_at,
            transactions (
              id,
              status,
              created_at,
              completed_at
            )
          `)
          .eq('creator_id', userId)
          .order('created_at', { ascending: false })
        
        paymentLinksData = result.data
        fetchError = result.error
        
        if (!fetchError) {
          console.log('✅ Successfully fetched with payment_status and paid_at fields')
          console.log('🔍 RAW DATABASE DATA:', JSON.stringify(paymentLinksData, null, 2))
        } else {
          console.log('❌ Error with payment_status query:', fetchError)
          throw fetchError
        }
      } catch (primaryError) {
        console.log('⚠️ Primary query failed, trying fallback with is_paid field...', primaryError)
        try {
          // Fallback to is_paid column (older migration) + transaction data
          const result = await (supabase as any)
            .from('payment_links')
            .select(`
              id, client_name, title, description, amount_aed, service_amount_aed, decode_amount_aed, total_amount_aed, 
              expiration_date, is_active, created_at, is_paid,
              transactions (
                id,
                status,
                created_at,
                completed_at
              )
            `)
            .eq('creator_id', userId)
            .order('created_at', { ascending: false })
          
          paymentLinksData = result.data
          fetchError = result.error
          
          if (!fetchError) {
            console.log('✅ Successfully fetched with is_paid field (fallback)')
          } else {
            console.log('❌ Error with is_paid fallback query:', fetchError)
            throw fetchError
          }
        } catch (fallbackError) {
          console.log('⚠️ is_paid fallback failed, using basic query...', fallbackError)
          // Final fallback without payment status fields but with transaction data
          const result = await supabase
            .from('payment_links')
            .select(`
              id, client_name, title, description, amount_aed, service_amount_aed, decode_amount_aed, total_amount_aed, 
              expiration_date, is_active, created_at,
              transactions (
                id,
                status,
                created_at,
                completed_at
              )
            `)
            .eq('creator_id', userId)
            .order('created_at', { ascending: false })
          
          paymentLinksData = result.data
          fetchError = result.error
          
          if (!fetchError) {
            console.log('✅ Successfully fetched with basic query (final fallback)')
          }
        }
      }

      if (fetchError) {
        throw fetchError
      }

      // Transform the data to include fields expected by PaymentLink interface
      const paymentLinksWithStatus = (paymentLinksData || []).map((link: any) => {
        // Determine payment status from available fields (priority: payment_status > is_paid)
        let isPaid = false
        let paymentStatus: 'unpaid' | 'paid' | 'failed' | 'refunded' = 'unpaid'
        
        if (link?.payment_status) {
          // Use payment_status field if available (from migration)
          paymentStatus = link.payment_status as 'unpaid' | 'paid' | 'failed' | 'refunded'
          isPaid = paymentStatus === 'paid'
          console.log(`📊 Using payment_status field for link ${link.id}: ${paymentStatus}`)
        } else if (typeof link?.is_paid !== 'undefined') {
          // Fallback to is_paid field
          isPaid = Boolean(link.is_paid)
          paymentStatus = isPaid ? 'paid' : 'unpaid'
          console.log(`📊 Using is_paid field for link ${link.id}: ${isPaid}`)
        } else {
          // No payment status available, assume unpaid
          console.log(`📊 No payment status fields available for link ${link.id}, assuming unpaid`)
        }
        
        // Calculate actual payment date from multiple sources
        let actualPaidAt = null
        
        if (isPaid) {
          // Priority order for payment date:
          // 1. paid_at field (from migration)
          // 2. earliest completed transaction
          // 3. earliest transaction of any status (as last resort)
          
          if (link?.paid_at) {
            actualPaidAt = link.paid_at
            console.log(`💰 Using paid_at field for link ${link.id}: ${actualPaidAt}`)
          } else if (link?.transactions && link.transactions.length > 0) {
            // Find completed transactions first
            const completedTransactions = link.transactions.filter((t: any) => t.status === 'completed')
            
            if (completedTransactions.length > 0) {
              // Use completed_at if available, otherwise created_at
              const earliestCompleted = completedTransactions.reduce((earliest: any, current: any) => {
                const currentDate = current.completed_at || current.created_at
                const earliestDate = earliest.completed_at || earliest.created_at
                return new Date(currentDate) < new Date(earliestDate) ? current : earliest
              })
              actualPaidAt = earliestCompleted.completed_at || earliestCompleted.created_at
              console.log(`💰 Using earliest completed transaction date for link ${link.id}: ${actualPaidAt}`)
            } else {
              // No completed transactions, use earliest transaction as fallback
              const earliestTransaction = link.transactions.reduce((earliest: any, current: any) => {
                return new Date(current.created_at) < new Date(earliest.created_at) ? current : earliest
              })
              actualPaidAt = earliestTransaction.created_at
              console.log(`💰 Using earliest transaction date as fallback for link ${link.id}: ${actualPaidAt}`)
            }
          } else {
            console.log(`⚠️ No payment date available for paid link ${link.id}, will fallback to expiry date`)
          }
        }
        
        // Debug logging for each link
        console.log(`🔍 Processing link ${link.id}:`, {
          payment_status: link?.payment_status,
          is_paid: link?.is_paid,
          paid_at: link?.paid_at,
          transactions_count: link?.transactions?.length || 0,
          computed_isPaid: isPaid,
          computed_paymentStatus: paymentStatus,
          final_actualPaidAt: actualPaidAt
        })
        
        return {
          id: link?.id || '',
          client_name: link?.client_name,
          title: link?.title || '',
          amount_aed: link?.amount_aed || 0,
          expiration_date: link?.expiration_date || '',
          is_active: link?.is_active || false,
          created_at: link?.created_at || '',
          description: link?.description,
          is_paid: isPaid,
          payment_status: paymentStatus,
          paid_at: actualPaidAt
        }
      })
      
      setPaymentLinks(paymentLinksWithStatus)
    } catch (error) {
      console.error('❌ DETAILED ERROR in fetchPaymentLinks:')
      console.error('Error object:', error)
      console.error('Error message:', (error as any)?.message)
      console.error('Full error details:', JSON.stringify(error, null, 2))
      
      let errorMessage = 'Failed to load payment links'
      if ((error as any)?.message) {
        errorMessage += `: ${(error as any).message}`
      }
      if ((error as any)?.code) {
        errorMessage += ` (Code: ${(error as any).code})`
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  const getStatus = (link: PaymentLink) => {
    // Priority: Paid > Expired > Deactivated > Active
    if (link.is_paid) return 'Paid'
    if (!link.is_active) return 'Deactivated'
    
    const now = new Date()
    const expirationDate = new Date(link.expiration_date)
    
    return now > expirationDate ? 'Expired' : 'Active'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'text-green-400'
      case 'Paid':
        return 'text-green-400'
      case 'Expired':
        return 'text-red-400'
      case 'Deactivated':
        return 'text-red-400'
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
      
      // Show success state on button
      setCopiedId(linkId)
      
      // Clear button state after 2 seconds
      setTimeout(() => {
        setCopiedId(null)
      }, 2000)
      
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

  const generateQRCode = async (link: PaymentLink) => {
    try {
      setGeneratingQR(true)
      setCurrentQRLink(link)
      
      // Generate the payment URL
      const paymentUrl = generatePaymentUrl(link.id)
      
      // Fetch user profile for company name
      const { data: { user } } = await supabase.auth.getUser()
      let companyName = 'Our Business'
      
      if (user) {
        const { data: profileData } = await supabase
          .from('users')
          .select('professional_center_name')
          .eq('id', user.id)
          .single()
        
        if (profileData?.professional_center_name) {
          companyName = profileData.professional_center_name
        }
      }
      
      // Create WhatsApp share URL with new format
      const clientName = link.client_name || 'Client'
      const serviceName = link.title || 'Service'
      const whatsappMessage = `Spoil ${clientName} with a ${serviceName} at ${companyName} \n${paymentUrl}`
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`
      
      // Generate QR code for the WhatsApp URL
      const qrDataURL = await QRCode.toDataURL(whatsappUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      
      setQrCodeDataURL(qrDataURL)
      setShowQRModal(true)
      
    } catch (error) {
      console.error('Error generating QR code:', error)
      setCopyMessage('Failed to generate QR code. Please try again.')
      setTimeout(() => setCopyMessage(''), 3000)
    } finally {
      setGeneratingQR(false)
    }
  }

  const closeQRModal = () => {
    setShowQRModal(false)
    setQrCodeDataURL('')
    setCurrentQRLink(null)
  }

  // Loading state removed - show content immediately

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
                <h1 className="cosmic-heading mb-2">PayLinks</h1>
              </div>
              <Link 
                href="/payment/create" 
                className="bg-gradient-to-br from-gray-800 to-black text-white border-none rounded-lg text-[17px] font-medium px-6 py-3 cursor-pointer transition-all duration-200 ease-in-out hover:scale-[1.02] hover:from-gray-600 hover:to-gray-900 hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] inline-block"
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
          {/* Error Messages Only */}
          {error && (
            <div className="cosmic-card mb-8">
              <div className="text-center p-4 text-red-300 bg-red-900/20 rounded-lg">
                {error}
              </div>
            </div>
          )}

          {!initialLoading && paymentLinks.length === 0 ? (
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
          ) : !initialLoading ? (
            /* Payment Links List */
            <div className="cosmic-card">
              <div className="space-y-6">
                {paymentLinks.slice(0, visibleCount).map((link) => {
                  const status = getStatus(link)
                  const statusColor = getStatusColor(status)
                  const isInactive = status === 'Expired' || status === 'Deactivated'
                  const isPaid = status === 'Paid'
                  const isNewPayLink = highlightingId === link.id
                  const isHeartAnimating = heartAnimatingId === link.id
                  
                  return (
                    <div 
                      key={link.id} 
                      ref={(el) => {
                        if (el && isNewPayLink) {
                          createNewPayLinkHighlight(el)
                        }
                      }}
                      className={`relative overflow-hidden border border-gray-600 border-l-4 rounded-lg shadow-lg p-5 transition-all duration-300 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700 before:ease-out ${
                        isNewPayLink
                          ? 'bg-slate-900/85 border-l-yellow-500/40 border-yellow-400/60 bg-yellow-900/10 shadow-2xl shadow-yellow-400/40 scale-[1.02] animate-pulse'
                          : isPaid
                            ? 'bg-slate-900/60 border-l-green-500/50 bg-green-900/10 opacity-60 hover:border-green-400 hover:bg-slate-800/60 hover:shadow-2xl hover:shadow-green-400/60 hover:scale-[1.01]'
                            : isInactive 
                              ? 'bg-slate-900/60 border-l-red-500/50 bg-red-900/10 opacity-75 hover:border-red-400 hover:bg-slate-800/60 hover:shadow-2xl hover:shadow-red-400/60 hover:scale-[1.01]'
                              : 'bg-slate-900/85 border-l-purple-500/50 hover:border-purple-400 hover:bg-slate-800/90 hover:shadow-2xl hover:shadow-purple-400/60 hover:scale-[1.01]'
                      }`}>
                      
                      {/* Heart Animation Effect */}
                      <HeartAnimation isActive={isHeartAnimating} />
                      {/* Status Ribbon */}
                      {(isPaid || isInactive) && (
                        <div className={`ribbon ${
                          isPaid ? 'ribbon-paid' : 
                          status === 'Expired' ? 'ribbon-expired' : 
                          'ribbon-deactivated'
                        }`}>
                          {status}
                        </div>
                      )}
                      
                      <div className="flex flex-col gap-3">
                        {/* Top Row: Title, Amount, Status */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex-1">
                            {link.client_name && (
                              <p className="text-purple-400 text-base font-semibold mb-1">
                                {link.client_name}
                              </p>
                            )}
                            <h3 className="text-white font-medium text-lg mb-1">
                              {link.title}
                            </h3>
                          </div>
                          
                          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                            <div className="text-right">
                              {link.is_active && (
                                <p className={`text-sm ${getExpiryColor(link.expiration_date)}`}>
                                  {(() => {
                                    if (isPaid) {
                                      return `Paid ${formatDate(link.paid_at || link.expiration_date)}`
                                    }
                                    const now = new Date()
                                    const expirationDate = new Date(link.expiration_date)
                                    const isExpired = now > expirationDate
                                    return `${isExpired ? 'Expired' : 'Expires'} ${formatDate(link.expiration_date)}`
                                  })()}
                                </p>
                              )}
                            </div>
                            
                            <div className="text-right">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColor} bg-gray-800`}>
                                {status}
                              </span>
                            </div>
                          </div>
                        </div>


                        {/* Bottom Row: Amount and Action Buttons */}
                        <div className="pt-2 border-t border-gray-700">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="text-white font-medium text-xl">
                                AED {formatAmount(link.service_amount_aed || (link.amount_aed / 1.09))}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => copyToClipboard(link.id)}
                              disabled={copyingId === link.id || deactivatingId === link.id || deletingId === link.id}
                              className={`px-4 py-2 text-sm border rounded-lg transition-colors disabled:opacity-50 ${
                                copiedId === link.id 
                                  ? 'border-green-500 bg-green-500/10' 
                                  : 'cosmic-button-secondary border-white/30 hover:bg-white/10'
                              }`}
                              style={copiedId === link.id ? { color: '#4ade80' } : undefined}
                            >
                              {copyingId === link.id ? (
                                <span className="flex items-center gap-2">
                                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Copying...
                                </span>
                              ) : copiedId === link.id ? (
                                <span className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Copied!
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

                            {/* QR Code button */}
                            <button
                              onClick={() => generateQRCode(link)}
                              disabled={generatingQR || copyingId === link.id || deactivatingId === link.id || deletingId === link.id}
                              className="cosmic-button-secondary px-4 py-2 text-sm border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {generatingQR && currentQRLink?.id === link.id ? (
                                <span className="flex items-center gap-2">
                                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Generating...
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                                  </svg>
                                  QR Code
                                </span>
                              )}
                            </button>

                            {/* Only show deactivate button for active links (not paid) */}
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
              
              {/* Load More Button */}
              {visibleCount < paymentLinks.length && (
                <div className="flex justify-center pt-6">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 6)}
                    className="cosmic-button-secondary px-6 py-3 flex flex-col items-center"
                    style={{ textDecoration: 'none' }}
                  >
                    <span className="text-lg font-bold">Load More</span>
                    <span className="text-xs font-normal">{paymentLinks.length - visibleCount} remaining</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Initial Loading - Show nothing to prevent empty state flash */
            <div className="cosmic-card h-40"></div>
          )}
          </div>
        </div>

        {/* Confirmation Dialog */}
        {showConfirmDialog && linkToDeactivate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="cosmic-card max-w-md w-full">
              <h3 className="cosmic-heading mb-4 text-white">Deactivate Payment Link</h3>
              <p className="cosmic-body text-gray-300 mb-4">
                Are you sure you want to deactivate the payment link for &lsquo;{linkToDeactivate.client_name || 'Client'}&rsquo; and the &lsquo;{linkToDeactivate.title}&rsquo;?
              </p>
              <p className="cosmic-body text-gray-400 text-sm mb-6">
                Amount: AED {formatAmount(linkToDeactivate.service_amount_aed || (linkToDeactivate.amount_aed / 1.09))}
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
                Amount: AED {formatAmount(linkToDelete.service_amount_aed || (linkToDelete.amount_aed / 1.09))}
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
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                  disabled={deactivatingId === linkToDelete.id}
                >
                  {deactivatingId === linkToDelete.id ? 'Deactivating...' : 'Deactivate & Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Modal */}
        {showQRModal && currentQRLink && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="cosmic-card max-w-md w-full text-center">
              <div className="flex justify-end mb-4">
                <button
                  onClick={closeQRModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Header text at top */}
              <p className="text-white font-medium mb-6">Scan to Share via WhatsApp</p>

              {/* QR Code below header */}
              {qrCodeDataURL && (
                <div className="mb-6">
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <img 
                      src={qrCodeDataURL} 
                      alt="WhatsApp QR Code" 
                      className="w-64 h-64 mx-auto"
                    />
                  </div>
                </div>
              )}

              {/* Client, Service, Original Amount between QR and Close button */}
              <div className="mb-6 space-y-2">
                <p className="text-white text-xl font-semibold">{currentQRLink.client_name || 'Client'}</p>
                <p className="text-white text-lg">{currentQRLink.title}</p>
                <p className="text-white text-xl font-semibold">AED {formatAmount(currentQRLink.service_amount_aed || (currentQRLink.amount_aed / 1.09))}</p>
              </div>

              <button
                onClick={closeQRModal}
                className="cosmic-button-primary w-full py-3"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default function MyLinks() {
  return (
    <Suspense fallback={
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <div className="cosmic-body text-white">Loading your payment links...</div>
          </div>
        </div>
      </div>
    }>
      <MyLinksContent />
    </Suspense>
  )
}