'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getUserWithProxy } from '@/utils/auth-helper'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@/providers/UserContext'
import Link from 'next/link'
import QRCode from 'qrcode'
import HeartAnimation from '@/components/effects/HeartAnimation'
import { formatUserNameWithStyle } from '@/lib/user-utils'

interface PaymentLink {
  id: string
  client_name: string | null
  title: string
  amount_aed: number
  service_amount_aed: number
  decode_amount_aed?: number
  total_amount_aed?: number
  description?: string | null
  expiration_date: string
  is_active: boolean
  payment_status: 'unpaid' | 'paid' | 'failed' | 'refunded'
  paid_at: string | null
  is_paid?: boolean
  branch_name?: string | null
  creator_name?: string | null
  creator_id: string
  created_at: string
  updated_at: string
}

function MyLinksContent() {
  const { user, profile, loading: contextLoading } = useUser()
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [companyBranchCount, setCompanyBranchCount] = useState<number>(0)

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

  // Debug logging for heartAnimatingId changes
  useEffect(() => {
    console.log('💖 STATE: heartAnimatingId changed to:', heartAnimatingId)
    if (heartAnimatingId) {
      console.log('💖 STATE: 🔥 HEART ANIMATION IS NOW ACTIVE FOR:', heartAnimatingId)
    } else {
      console.log('💖 STATE: ❌ Heart animation is now INACTIVE')
    }
  }, [heartAnimatingId])
  const [lastCheckedTimestamp, setLastCheckedTimestamp] = useState<number>(Date.now())
  const [visibleCount, setVisibleCount] = useState(6)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const [firstPollComplete, setFirstPollComplete] = useState(false)
  const [newLinkHighlightReady, setNewLinkHighlightReady] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    console.log('🔄 [MY-LINKS] Context state change:', {
      contextLoading,
      hasUser: !!user,
      hasProfile: !!profile,
      userId: user?.id
    })

    // Wait for user context to fully initialize
    if (contextLoading) {
      console.log('⏳ [MY-LINKS] User context still loading...')
      return
    }

    if (!user) {
      console.log('❌ [MY-LINKS] No user found in context, redirecting to auth')
      router.push('/auth')
      return
    }

    console.log('✅ [MY-LINKS] User context ready, initializing page...')

    const initializePaymentLinks = async () => {
      try {
        await fetchPaymentLinks(user.id)
        await fetchUserRoleAndBranchCount(user.id)
      } catch (error) {
        console.error('❌ [MY-LINKS] Error loading payment links:', error)
        setError('Failed to load payment links. Please try refreshing.')
        return // Exit early if data loading fails
      }

      // Set up real-time subscription separately (non-critical)
      try {
        console.log('🔄 Setting up real-time subscription for user:', user.id)
        const subscription = createClient()
          .channel('payment_links_changes')
          .on('postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'payment_links'
            },
            (payload) => {
              // Only process updates for this user's payment links
              if (payload.new?.creator_id !== user.id) {
                return; // Skip updates for other users
              }
              console.log('💖 Real-time payment update received:', payload)
              console.log('💖 Payload details:', {
                event_type: payload.eventType,
                table: payload.table,
                old_payment_status: payload.old?.payment_status,
                new_payment_status: payload.new?.payment_status,
                old_paid_at: payload.old?.paid_at,
                new_paid_at: payload.new?.paid_at,
                old_is_paid: payload.old?.is_paid,
                new_is_paid: payload.new?.is_paid,
                old_is_active: payload.old?.is_active,
                new_is_active: payload.new?.is_active,
                link_id: payload.new?.id,
                timestamp: new Date().toISOString()
              })

              // Enhanced payment detection - check ALL possible indicators
              const statusChangedToPaid = payload.new.payment_status === 'paid' && payload.old?.payment_status !== 'paid'
              const paidAtWasSet = payload.new.paid_at && !payload.old?.paid_at
              const isPaidWasSet = payload.new.is_paid && !payload.old?.is_paid
              const statusExistsAndPaid = payload.new.payment_status === 'paid' && (!payload.old?.payment_status || payload.old.payment_status !== 'paid')
              const isPaidIsTrue = payload.new.is_paid === true && payload.old?.is_paid !== true

              console.log('💖 Payment detection flags:', {
                statusChangedToPaid,
                paidAtWasSet,
                isPaidWasSet,
                statusExistsAndPaid,
                isPaidIsTrue
              })

              const justPaid = statusChangedToPaid || paidAtWasSet || isPaidWasSet || statusExistsAndPaid || isPaidIsTrue

              if (justPaid) {
                console.log('🎉 Payment completed! Triggering heart animation for:', payload.new.id)
                console.log('🎉 Current heart animating state:', heartAnimatingId)
                console.log('🎉 Setting heart animation for link:', payload.new.id, 'at timestamp:', new Date().toISOString())

                // Clear any existing animation first
                setHeartAnimatingId(null)

                // Use setTimeout to ensure state update processes
                setTimeout(() => {
                  console.log('🎉 Actually setting heart animation now for:', payload.new.id)
                  setHeartAnimatingId(payload.new.id)

                  // Auto-hide after 3 seconds with additional logging
                  setTimeout(() => {
                    console.log('🎉 Clearing heart animation for:', payload.new.id)
                    setHeartAnimatingId(null)
                  }, 3000)
                }, 50)

                // Also trigger a backup animation after 1 second in case the first one doesn't work
                setTimeout(() => {
                  console.log('🎉 Backup heart animation trigger for:', payload.new.id)
                  setHeartAnimatingId(payload.new.id)
                  setTimeout(() => setHeartAnimatingId(null), 3000)
                }, 1000)
              }

              // Always update the payment link in state for any change
              console.log('🔄 Updating payment link state...')
              setPaymentLinks(prev => {
                const updated = prev.map(link =>
                  link.id === payload.new.id
                    ? {
                        ...link,
                        is_paid: payload.new.payment_status === 'paid' || payload.new.is_paid || false,
                        is_active: payload.new.is_active !== undefined ? payload.new.is_active : link.is_active,
                        payment_status: payload.new.payment_status || (payload.new.is_paid ? 'paid' : 'unpaid') as 'paid' | 'unpaid',
                        paid_at: payload.new.paid_at || link.paid_at
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

        // Cleanup subscription only
        return () => {
          subscription.unsubscribe()
        }
      } catch (subscriptionError) {
        // Log subscription errors but don't show to user (non-critical feature)
        console.error('⚠️ [MY-LINKS] Real-time subscription error (non-critical):', subscriptionError)
        console.log('ℹ️ [MY-LINKS] Continuing without real-time updates - page will still work')
        // Don't set error - real-time updates are nice to have but not required
      }
    }

    initializePaymentLinks()
  }, [contextLoading, user, router])

  // Enhanced polling useEffect that depends on userRole and companyName being available
  useEffect(() => {
    console.log('🔍 POLLING SETUP: userRole:', userRole, 'companyName:', companyName)

    // Only start polling when we have user role and company name
    if (!userRole || !companyName) {
      console.log('🔍 POLLING SETUP: Missing userRole or companyName, skipping polling setup')
      return
    }

    console.log('🔍 POLLING SETUP: ✅ Starting enhanced polling with userRole:', userRole, 'companyName:', companyName)

    // Enhanced fallback polling mechanism (every 3 seconds for faster detection)
    const pollingInterval = setInterval(async () => {
      try {
        const timestamp = new Date().toISOString();
        console.log('🔍 POLLING CYCLE START:', timestamp);

        // Fetch current payment status via proxy API (compatible with proxy arrangement)
        const response = await fetch('/api/payment-links/status-check', {
          method: 'GET',
          credentials: 'include'
        })

        console.log('🔍 POLLING: API response status:', response.status, response.ok);

        if (!response.ok) {
          console.error('❌ POLLING: Failed to fetch payment status via proxy', response.status, response.statusText)
          return
        }

        const responseData = await response.json()
        console.log('🔍 POLLING: RAW API RESPONSE:', JSON.stringify(responseData, null, 2));

        const { paymentStatus: currentLinks } = responseData

        console.log('🔍 POLLING: PARSED LINKS:', currentLinks);
        console.log('🔍 POLLING: Array check - Is array?', Array.isArray(currentLinks), 'Length:', currentLinks?.length);

        if (currentLinks && currentLinks.length > 0) {
          currentLinks.forEach((link: any, index: number) => {
            console.log(`🔍 POLLING: Link ${index + 1}:`, {
              id: link.id,
              payment_status: link.payment_status,
              is_paid: link.is_paid,
              paid_at: link.paid_at
            });
          });
        }

        if (currentLinks && Array.isArray(currentLinks)) {
          const currentTime = Date.now();

          // Track which links just became paid - check BEFORE state update
          const newlyPaidLinks: string[] = [];

          // PROPER CHANGE DETECTION: Only animate links that changed from unpaid to paid
          currentLinks.forEach((currentLink: any) => {
            console.log('🔍 POLLING: Checking link:', currentLink.id, {
              payment_status: currentLink.payment_status,
              is_paid: currentLink.is_paid
            });

            // Find the existing link in our current state
            const existingLink = paymentLinks.find(link => link.id === currentLink.id);

            if (!existingLink) {
              console.log('🔍 POLLING: Link not found in current state, skipping:', currentLink.id);
              return;
            }

            // Check current payment status
            const currentIsPaid = currentLink.payment_status === 'paid' || currentLink.is_paid === true;
            const previousIsPaid = existingLink.payment_status === 'paid' || existingLink.is_paid === true;

            console.log(`🔍 POLLING: Link ${currentLink.id} status change:`, {
              previousIsPaid,
              currentIsPaid,
              changedToPaid: !previousIsPaid && currentIsPaid
            });

            // Only trigger animation if link changed from unpaid to paid AND both initial load and first poll are complete
            if (!previousIsPaid && currentIsPaid) {
              if (initialLoadComplete && firstPollComplete) {
                console.log('🎉 POLLING: 🚨 PAYMENT STATUS CHANGED! Link became paid:', currentLink.id);
                newlyPaidLinks.push(currentLink.id);
              } else {
                console.log('🔍 POLLING: Payment detected but synchronization not complete, skipping animation:', currentLink.id, {
                  initialLoadComplete,
                  firstPollComplete
                });
              }
            } else if (currentIsPaid) {
              console.log('🔍 POLLING: Link already paid, no animation needed:', currentLink.id);
            } else {
              console.log('🔍 POLLING: Link still unpaid:', currentLink.id);
            }
          });

          // Now update the payment links state
          currentLinks.forEach((currentLink: any) => {
            setPaymentLinks(prev => {
              const existingLink = prev.find(link => link.id === currentLink.id);

              if (!existingLink) return prev; // Link not found in state

              // Check if we need to update this link
              const needsUpdate = existingLink.payment_status !== currentLink.payment_status ||
                                 existingLink.is_paid !== currentLink.is_paid ||
                                 existingLink.paid_at !== currentLink.paid_at ||
                                 existingLink.is_active !== currentLink.is_active;

              if (needsUpdate) {
                console.log('🔄 POLLING: Updating link state for:', currentLink.id);
                return prev.map(link =>
                  link.id === currentLink.id
                    ? {
                        ...link,
                        is_active: currentLink.is_active,
                        payment_status: currentLink.payment_status || link.payment_status,
                        is_paid: currentLink.is_paid || link.is_paid,
                        paid_at: currentLink.paid_at || link.paid_at
                      }
                    : link
                );
              }

              // No changes needed
              return prev;
            });
          });

          // Now trigger heart animations for newly paid links (outside state update)
          console.log('🎉 POLLING: Final check - newlyPaidLinks array:', newlyPaidLinks);
          console.log('🎉 POLLING: Array length:', newlyPaidLinks.length);

          if (newlyPaidLinks.length > 0) {
            console.log('🎉 POLLING: 🚨 PAYMENT DETECTED! Triggering heart animations for:', newlyPaidLinks);

            // Trigger animation for the first newly paid link
            const linkToAnimate = newlyPaidLinks[0];
            console.log('🎉 POLLING: 🎯 Will animate link:', linkToAnimate);
            console.log('🎉 POLLING: Current heartAnimatingId before change:', heartAnimatingId);

            // Clear any existing animation
            console.log('🎉 POLLING: Clearing existing heartAnimatingId...');
            setHeartAnimatingId(null);

            // Set new animation after a brief delay
            setTimeout(() => {
              console.log('🎉 POLLING: 🔥 SETTING HEART ANIMATION FOR:', linkToAnimate);
              console.log('🎉 POLLING: Calling setHeartAnimatingId with:', linkToAnimate);
              setHeartAnimatingId(linkToAnimate);

              console.log('🎉 POLLING: ⏰ Setting clear timer for 3 seconds...');
              // Clear animation after 3 seconds
              setTimeout(() => {
                console.log('🎉 POLLING: ⏰ TIME UP! Clearing heart animation for:', linkToAnimate);
                setHeartAnimatingId(null);
              }, 3000);
            }, 100);
          } else {
            console.log('🎉 POLLING: No newly paid links detected this cycle');
          }

          setLastCheckedTimestamp(currentTime);

          // Mark first poll as complete after the first successful polling cycle
          if (!firstPollComplete) {
            console.log('✅ First polling cycle complete - enabling payment change detection');
            setFirstPollComplete(true);
          }
        }
      } catch (pollingError) {
        console.error('❌ Enhanced polling error:', pollingError);
      }
    }, 3000); // Check every 3 seconds via proxy API

    // Cleanup polling on unmount or dependency change
    return () => {
      console.log('🔍 POLLING SETUP: Cleaning up polling interval')
      clearInterval(pollingInterval)
    }
  }, [userRole, companyName, heartAnimatingId, initialLoadComplete, firstPollComplete, paymentLinks]) // Dependencies: userRole, companyName, heartAnimatingId, initialLoadComplete, firstPollComplete, and paymentLinks for state comparison

  // Detect new PayLink from URL parameter and trigger highlight effect
  useEffect(() => {
    const newId = searchParams.get('new')
    console.log('🌟 NEW LINK: URL parameter detected:', newId)

    if (newId) {
      setNewPayLinkId(newId)
      console.log('🌟 NEW LINK: Set newPayLinkId to:', newId)

      // Only start highlighting if new link highlighting is ready and payment links are loaded
      if (newLinkHighlightReady && paymentLinks.length > 0) {
        console.log('🌟 NEW LINK: Prerequisites met - starting highlight effect')
        tryHighlightNewLink(newId)
      } else {
        console.log('🌟 NEW LINK: Waiting for prerequisites:', {
          newLinkHighlightReady,
          paymentLinksCount: paymentLinks.length
        })
      }
    }
  }, [searchParams, newLinkHighlightReady, paymentLinks])

  // Function to try highlighting with retry logic
  const tryHighlightNewLink = (linkId: string, attempt = 1, maxAttempts = 5) => {
    console.log(`🌟 NEW LINK: Highlight attempt ${attempt}/${maxAttempts} for link:`, linkId)

    // Check if the payment link exists in our state
    const linkExists = paymentLinks.some(link => link.id === linkId)
    if (!linkExists) {
      console.log('🌟 NEW LINK: Link not found in payment links state:', linkId)
      if (attempt < maxAttempts) {
        setTimeout(() => tryHighlightNewLink(linkId, attempt + 1, maxAttempts), 500)
        return
      } else {
        console.log('🌟 NEW LINK: Max attempts reached, giving up on highlighting')
        return
      }
    }

    // Check if the DOM element exists
    const targetElement = document.getElementById(`payment-link-${linkId}`)
    if (!targetElement) {
      console.log('🌟 NEW LINK: DOM element not found, retrying...', `payment-link-${linkId}`)
      if (attempt < maxAttempts) {
        setTimeout(() => tryHighlightNewLink(linkId, attempt + 1, maxAttempts), 200)
        return
      } else {
        console.log('🌟 NEW LINK: Max attempts reached, element not found in DOM')
        return
      }
    }

    // Successfully found element, start highlighting
    console.log('🌟 NEW LINK: ✅ Element found, starting highlight effect')
    setHighlightingId(linkId)

    // Remove highlight after 1.5 seconds
    setTimeout(() => {
      console.log('🌟 NEW LINK: Clearing highlight effect')
      setHighlightingId(null)
      setNewPayLinkId(null)
      // Clean up URL parameter
      const url = new URL(window.location.href)
      url.searchParams.delete('new')
      window.history.replaceState({}, '', url.toString())
      console.log('🌟 NEW LINK: URL parameter cleaned up')
    }, 1500)
  }

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

      console.log('📡 [MY-LINKS] Fetching payment links for user:', userId)

      // Fetch payment links via proxy endpoint
      const response = await fetch('/api/payment-links/list', {
        method: 'GET',
        credentials: 'include'
      })

      console.log('📡 [MY-LINKS] API response status:', response.status, response.ok)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ [MY-LINKS] PRIMARY API FAILED - Response status:', response.status)
        console.error('❌ [MY-LINKS] PRIMARY API FAILED - Error data:', errorData)
        console.error('❌ [MY-LINKS] PRIMARY API FAILED - Response headers:', [...response.headers.entries()])

        // Show detailed error info to identify the issue
        console.error('🚨 [MY-LINKS] MAIN ENDPOINT FAILURE DETAILS:', {
          url: '/api/payment-links/list',
          status: response.status,
          statusText: response.statusText,
          error: errorData.error,
          details: errorData.details,
          timestamp: new Date().toISOString()
        })

        // Try fallback approach using status-check endpoint
        console.log('🔄 [MY-LINKS] FALLING BACK TO STATUS-CHECK - Main API failed, attempting fallback...')
        try {
          const fallbackResponse = await fetch('/api/payment-links/status-check', {
            method: 'GET',
            credentials: 'include'
          })

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json()
            const { paymentStatus } = fallbackData

            console.log('✅ [MY-LINKS] Fallback successful, got', paymentStatus?.length || 0, 'basic payment links')

            // Transform status-check data to match expected format
            const basicPaymentLinks = (paymentStatus || []).map((link: any) => ({
              id: link.id,
              title: 'Payment Link', // Default title since we don't have it
              client_name: null,
              amount_aed: 0, // Will need to be populated from somewhere else
              service_amount_aed: 0,
              decode_amount_aed: 0,
              total_amount_aed: 0,
              description: null,
              expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Default to 30 days
              is_active: link.is_active,
              payment_status: link.payment_status,
              paid_at: link.paid_at,
              is_paid: link.is_paid,
              branch_name: null,
              creator_name: 'Unknown User',
              creator_id: userId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }))

            setPaymentLinks(basicPaymentLinks)

            // Don't show error if we have data in fallback mode - just a warning
            if (basicPaymentLinks.length > 0) {
              // Clear error since we have usable data
              setError('')
              console.log('✅ [MY-LINKS] Fallback mode but data available - clearing error')
            } else {
              // Only show error if no data at all
              const mainApiError = errorData?.error || `HTTP ${response.status}`
              setError(`⚠️ No payment links found. Main API failed (${mainApiError}).`)
            }

            // Mark new link highlighting as ready immediately (fallback mode)
            console.log('✅ [MY-LINKS] Fallback: Setting newLinkHighlightReady to true immediately')
            setNewLinkHighlightReady(true)

            // Mark initial load as complete for fallback mode
            setTimeout(() => {
              console.log('✅ [MY-LINKS] Fallback initial load complete - enabling heart animations')
              setInitialLoadComplete(true)
            }, 500)

            console.log('✅ [MY-LINKS] Fallback payment links loaded with basic data')
            return // Skip the rest of the normal flow
          }
        } catch (fallbackError) {
          console.error('❌ [MY-LINKS] Fallback also failed:', fallbackError)
        }

        // If fallback also fails, show original error
        if (response.status === 401) {
          throw new Error('Authentication failed. Please try logging out and logging back in.')
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your account permissions.')
        } else {
          throw new Error(errorData.error || `Failed to fetch payment links (${response.status})`)
        }
      }

      const data = await response.json()
      const { paymentLinks: paymentLinksData, isAdmin } = data

      console.log('✅ [MY-LINKS] MAIN API SUCCESS - Received full payment links data:', {
        linksCount: paymentLinksData?.length || 0,
        isAdmin,
        sampleLink: paymentLinksData?.[0] ? {
          id: paymentLinksData[0].id,
          hasTitle: !!paymentLinksData[0].title,
          hasAmount: !!paymentLinksData[0].amount_aed,
          hasClient: !!paymentLinksData[0].client_name
        } : 'No links'
      })

      // Process the fetched payment links
      if (!paymentLinksData) {
        console.warn('⚠️ [MY-LINKS] No payment links data in response')
        throw new Error('No payment links data received from server')
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
          service_amount_aed: link?.service_amount_aed || link?.amount_aed || 0,
          decode_amount_aed: link?.decode_amount_aed,
          total_amount_aed: link?.total_amount_aed,
          expiration_date: link?.expiration_date || '',
          is_active: link?.is_active || false,
          created_at: link?.created_at || '',
          updated_at: link?.updated_at || '',
          description: link?.description,
          is_paid: isPaid,
          payment_status: paymentStatus,
          paid_at: actualPaidAt,
          branch_name: link?.branch_name,
          creator_name: link?.creator_name
        }
      })
      
      setPaymentLinks(paymentLinksWithStatus)

      console.log('✅ [MY-LINKS] Payment links state updated with', paymentLinksWithStatus.length, 'links')

      // Clear any previous errors since data loaded successfully
      setError('')
      console.log('✅ [MY-LINKS] Cleared any previous errors - data loaded successfully')

      // Mark new link highlighting as ready immediately (no delay)
      console.log('✅ [MY-LINKS] Setting newLinkHighlightReady to true immediately')
      setNewLinkHighlightReady(true)

      // Mark initial load as complete after delay (for heart animations)
      setTimeout(() => {
        console.log('✅ [MY-LINKS] Initial payment links load complete - enabling heart animations')
        setInitialLoadComplete(true)
      }, 1000) // Wait 1 second for state to settle
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

  const fetchUserRoleAndBranchCount = async (userId: string) => {
    try {
      // Use the same working API endpoint as dashboard and paylink pages
      const response = await fetch('/api/user/profile', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        console.error('Error fetching user profile:', await response.text())
        return
      }

      const { userData } = await response.json()
      setUserRole(userData.role)
      setCompanyName(userData.company_name || userData.professional_center_name)
      // Use the actual branch count from the API response
      setCompanyBranchCount(userData.branchCount || 1)
    } catch (error) {
      console.error('Error fetching user profile:', error)
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

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-800/30'
      case 'Paid':
        return 'bg-green-800/30'
      case 'Expired':
        return 'bg-red-900/20'
      case 'Deactivated':
        return 'bg-red-900/20'
      default:
        return 'bg-gray-800'
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
    } else if (diffInDays === 0) {
      return 'text-yellow-400' // Expires today
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

      const { error: updateError } = await createClient()
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

      console.log('🗑️ Attempting to delete payment link:', linkToDelete.id)
      console.log('🗑️ Link details:', {
        id: linkToDelete.id,
        title: linkToDelete.title,
        status: getStatus(linkToDelete),
        is_active: linkToDelete.is_active,
        payment_status: linkToDelete.payment_status
      })

      // Call the server-side API endpoint for deletion
      const response = await fetch('/api/payment-links/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ linkId: linkToDelete.id })
      })

      const result = await response.json()

      console.log('🗑️ API Response:', {
        status: response.status,
        ok: response.ok,
        result
      })

      if (!response.ok) {
        console.error('🗑️ Delete failed:', result)

        // Show specific error message from API
        let errorMessage = result.error || 'Failed to delete payment link'

        if (result.hasTransactions) {
          errorMessage = 'Cannot delete: This payment link has completed payments. Only links without successful payment history can be deleted.'
        }

        setCopyMessage(errorMessage)
        setTimeout(() => setCopyMessage(''), 6000) // Show error for 6 seconds

        return
      }

      // Successfully deleted
      console.log('✅ Payment link deleted successfully via API')

      // Remove from local state
      setPaymentLinks(prev => prev.filter(link => link.id !== linkToDelete.id))

      setCopyMessage('Payment link deleted successfully!')

      setTimeout(() => {
        setCopyMessage('')
      }, 3000)

    } catch (error: any) {
      console.error('🗑️ Exception in confirmDeletion:', error)
      console.error('🗑️ Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      })

      // Network or other unexpected error
      setCopyMessage(`Failed to delete: ${error?.message || 'Network error. Please check your connection and try again.'}`)
      setTimeout(() => setCopyMessage(''), 6000)
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

      const { error: updateError } = await createClient()
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
      const { data: { user } } = await createClient().auth.getUser()
      let companyName = 'Our Business'
      
      if (user) {
        const { data: profileData } = await createClient()
          .from('users')
          .select('professional_center_name')
          .eq('id', user.id)
          .single()
        
        if (profileData?.professional_center_name) {
          companyName = profileData.professional_center_name
        }
      }
      
      // Create WhatsApp share URL with new format
      // Generate QR code for WhatsApp URL with just the payment link (no descriptive text)
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(paymentUrl)}`
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
      
      // Auto-close QR modal after 20 seconds
      setTimeout(() => {
        closeQRModal()
      }, 20000)
      
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
      {/* Heart Animation - Positioned at specific payment link */}
      <HeartAnimation
        isActive={heartAnimatingId !== null}
        targetElementId={heartAnimatingId || undefined}
      />

      <div className="min-h-screen px-4 py-4 md:py-8">
        {/* Back to Dashboard Link */}
        <div className="flex justify-center dashboard-back-button-spacing">
          <div style={{width: '70vw'}} className="my-links-container">
          <Link href="/dashboard" className="inline-flex items-center text-gray-300 hover:text-white transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-center">
          <div style={{width: '70vw'}} className="my-links-container">
          <div className="cosmic-card header-card-mobile-spacing">
            <div className="flex justify-between items-center my-links-header-mobile">
              <div>
                <h1 className="cosmic-heading mb-2">PayLinks</h1>
              </div>
              <Link
                href="/payment/create"
                className="bg-black text-white border border-white/30 !rounded-lg text-[15px] font-medium px-6 py-3 cursor-pointer transition-all duration-200 ease-in-out hover:bg-gray-900 hover:border-white/50 hover:shadow-[0_4px_12px_rgba(255,255,255,0.1)] inline-block ml-auto"
              >
                Create PayLink
              </Link>
            </div>
          </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex justify-center">
          <div style={{width: '70vw'}} className="my-links-container">
          {/* Error Messages Only */}
          {error && (
            <div className="cosmic-card mb-8">
              <div className="text-center p-4 text-red-300 bg-red-900/20 rounded-lg">
                {error}
              </div>
            </div>
          )}

          {/* Copy/Action Messages */}
          {copyMessage && (
            <div className="cosmic-card mb-8">
              <div className={`text-center p-4 rounded-lg ${
                copyMessage.includes('successfully')
                  ? 'text-green-300 bg-green-800/30'
                  : copyMessage.includes('Failed') || copyMessage.includes('Cannot') || copyMessage.includes('Permission')
                    ? 'text-red-300 bg-red-900/20'
                    : 'text-yellow-300 bg-yellow-900/20'
              }`}>
                {copyMessage}
              </div>
            </div>
          )}

          {contextLoading ? (
            /* User Context Loading */
            <div className="cosmic-card text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <div className="cosmic-body text-white">Loading…</div>
            </div>
          ) : !initialLoading && paymentLinks.length === 0 ? (
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
            <div className="cosmic-card content-card-mobile-spacing">
              <div className="space-y-6">
                {paymentLinks.slice(0, visibleCount).map((link) => {
                  const status = getStatus(link)
                  const statusColor = getStatusColor(status)
                  const isInactive = status === 'Expired' || status === 'Deactivated'
                  const isPaid = status === 'Paid'
                  const isExpired = status === 'Expired'
                  const isDeactivated = status === 'Deactivated'
                  const isNewPayLink = highlightingId === link.id
                  const isHeartAnimating = heartAnimatingId === link.id

                  // Debug logging for heart animation state
                  if (heartAnimatingId !== null) {
                    console.log('💖 RENDER: Heart animating ID:', heartAnimatingId, 'Current link:', link.id, 'Is animating?', isHeartAnimating)
                  }

                  return (
                    <div
                      key={link.id}
                      id={`payment-link-${link.id}`}
                      ref={(el) => {
                        if (el && isNewPayLink) {
                          createNewPayLinkHighlight(el)
                        }
                      }}
                      className={`relative overflow-hidden border border-gray-600 border-l-4 rounded-lg shadow-lg p-5 payment-link-card-mobile transition-all duration-300 before:absolute before:inset-0 before:pointer-events-none before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700 before:ease-out ${
                        isNewPayLink
                          ? 'bg-yellow-900/10 border-l-yellow-500 border-yellow-400/60 shadow-2xl shadow-yellow-400/40 scale-[1.02] animate-pulse'
                          : isPaid
                            ? 'bg-blue-900/30 border-l-green-500 hover:border-green-400 hover:bg-blue-800/30 hover:shadow-2xl hover:shadow-green-400/60 hover:scale-[1.01]'
                            : isInactive
                              ? 'bg-blue-900/30 border-l-red-500 hover:border-red-400 hover:bg-blue-800/30 hover:shadow-2xl hover:shadow-red-400/60 hover:scale-[1.01]'
                              : 'bg-gray-900/80 border-l-purple-500 hover:border-purple-400 hover:bg-gray-800/80 hover:shadow-2xl hover:shadow-purple-400/60 hover:scale-[1.01]'
                      }`}>
                      {/* Status Ribbon - No longer needed, all inactive states use overlays now */}
                      
                      {/* PAID Overlay */}
                      {isPaid && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <span className="text-emerald-400 font-bold tracking-wider opacity-30 transform rotate-[-15deg] status-overlay-mobile"
                                style={{
                                  fontSize: '3.2rem',
                                  WebkitTextStroke: '1px rgba(16,185,129,0.4)'
                                }}>
                            PAID
                          </span>
                        </div>
                      )}

                      {/* EXPIRED Overlay */}
                      {isExpired && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <span className="text-red-400 font-bold tracking-wider opacity-30 transform rotate-[-15deg] status-overlay-mobile"
                                style={{
                                  fontSize: '3.2rem',
                                  WebkitTextStroke: '1px rgba(239,68,68,0.4)'
                                }}>
                            EXPIRED
                          </span>
                        </div>
                      )}

                      {/* DEACTIVATED Overlay */}
                      {isDeactivated && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <span className="text-red-400 font-bold tracking-wider opacity-30 transform rotate-[-15deg] status-overlay-mobile"
                                style={{
                                  fontSize: '3.2rem',
                                  WebkitTextStroke: '1px rgba(239,68,68,0.4)'
                                }}>
                            DEACTIVATED
                          </span>
                        </div>
                      )}

                      <div className={`flex flex-col gap-2 ${isPaid || isExpired || isDeactivated ? 'opacity-60 filter grayscale-[0.2]' : ''}`}>
                        {/* Mobile Layout - Hidden on desktop */}
                        <div className="md:hidden">
                          {/* Row with client name and status badge */}
                          <div className="flex justify-between items-start mb-0.5">
                            <p className="payment-link-client-mobile text-purple-400">
                              {link.client_name || ''}
                            </p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor} ${getStatusBg(status)}`}>
                              {status}
                            </span>
                          </div>

                          {/* Amount and Date in same row */}
                          <div className="flex justify-between items-start mb-2">
                            <div className="payment-link-amount-mobile text-white">
                              AED {formatAmount(link.service_amount_aed || link.amount_aed)}
                            </div>
                            <div className={`text-xs ${(() => {
                              if (isDeactivated || isExpired) return 'text-red-400'
                              if (isPaid) return 'text-green-400'
                              return 'text-gray-400'
                            })()}`}>
                              {(() => {
                                if (isDeactivated) return formatDate(link.updated_at || link.created_at)
                                if (isExpired) return formatDate(link.expiration_date)
                                if (isPaid) return formatDate(link.paid_at || link.expiration_date)
                                return formatDate(link.expiration_date)
                              })()}
                            </div>
                          </div>

                          {/* Mobile Action Buttons - Optimized sizing for one line */}
                          <div className={`flex gap-1 mt-2 pt-2 border-t border-gray-700 ${isPaid || isExpired || isDeactivated ? 'opacity-50' : ''}`}>
                            <button
                              onClick={() => copyToClipboard(link.id)}
                              disabled={copyingId === link.id || deactivatingId === link.id || deletingId === link.id}
                              className={`flex-1 px-2 py-1.5 text-xs ${copiedId === link.id ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-white/30 hover:bg-white/10 text-white'} border rounded-lg transition-colors disabled:opacity-50`}
                              title="Copy Link"
                            >
                              {copyingId === link.id ? (
                                "Copying..."
                              ) : copiedId === link.id ? (
                                "Copied!"
                              ) : (
                                "Copy Link"
                              )}
                            </button>

                            <button
                              onClick={() => generateQRCode(link)}
                              disabled={generatingQR || copyingId === link.id || deactivatingId === link.id || deletingId === link.id}
                              className="flex-1 px-2 py-1.5 text-xs border border-white/30 text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {generatingQR && currentQRLink?.id === link.id ? (
                                "Generating..."
                              ) : (
                                "QR Code"
                              )}
                            </button>

                            {status === 'Active' && (
                              <button
                                onClick={() => handleDeactivateClick(link)}
                                disabled={deactivatingId === link.id || copyingId === link.id || deletingId === link.id}
                                className="flex-1 px-2 py-1.5 text-xs border border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {deactivatingId === link.id ? (
                                  "Deactivating..."
                                ) : (
                                  "Deactivate"
                                )}
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteClick(link)}
                              disabled={deletingId === link.id || copyingId === link.id || deactivatingId === link.id}
                              className="flex items-center justify-center p-1.5 text-xs border border-gray-500/50 text-gray-400 hover:bg-gray-500/10 hover:border-gray-500 hover:text-red-400 rounded-lg transition-colors disabled:opacity-50 delete-button-mobile"
                              title="Delete"
                            >
                              {deletingId === link.id ? (
                                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Desktop Layout - Hidden on mobile */}
                        <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
                          
                          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 payment-link-info-mobile">
                            <div className="text-right">
                              <p className={`text-sm ${(() => {
                                const now = new Date()
                                const expirationDate = new Date(link.expiration_date)
                                const isExpired = now > expirationDate

                                if (isDeactivated) {
                                  return 'text-red-400' // Deactivated takes priority
                                } else if (isExpired) {
                                  return 'text-red-400' // Expired takes priority
                                } else if (isPaid) {
                                  return 'text-green-400' // Paid but not expired
                                } else {
                                  return getExpiryColor(link.expiration_date) // Active/future dates
                                }
                              })()}`}>
                                {(() => {
                                  const now = new Date()
                                  const expirationDate = new Date(link.expiration_date)
                                  const isExpired = now > expirationDate

                                  if (isDeactivated) {
                                    return `Deactivated ${formatDate(link.updated_at || link.created_at)}`
                                  } else if (isExpired) {
                                    return `Expired ${formatDate(link.expiration_date)}`
                                  } else if (isPaid) {
                                    return `Paid ${formatDate(link.paid_at || link.expiration_date)}`
                                  } else {
                                    return `Expires ${formatDate(link.expiration_date)}`
                                  }
                                })()}
                              </p>
                            </div>
                            
                            <div className="text-right">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColor} ${getStatusBg(status)}`}>
                                {status}
                              </span>
                            </div>
                          </div>
                        </div>


                        {/* Desktop Bottom Row: Amount and Action Buttons - Hidden on mobile */}
                        <div className="hidden md:block pt-2 border-t border-gray-700">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="text-white font-medium text-xl">
                                AED {formatAmount(link.service_amount_aed || link.amount_aed)}
                              </div>
                            </div>
                            {/* Branch Name and Creator Name Display */}
                            <div className="flex items-center gap-4 text-sm text-gray-400 payment-link-meta-mobile">
                              {/* For Admin accounts: Always show creator_name, show branch_name if company has 2+ branches */}
                              {userRole === 'Admin' && link.creator_name && (
                                <div className="flex items-center gap-2">
                                  <span className="text-purple-400">Creator:</span>
                                  <span className={formatUserNameWithStyle(link.creator_name, link.creator_id).className}>
                                    {formatUserNameWithStyle(link.creator_name, link.creator_id).name}
                                  </span>
                                </div>
                              )}
                              
                              {/* Show branch_name when company has multiple branches (for both user and admin) */}
                              {companyBranchCount >= 2 && link.branch_name && (
                                <div className="flex items-center gap-2">
                                  <span className="text-purple-400">Branch:</span>
                                  <span>{link.branch_name}</span>
                                </div>
                              )}
                            </div>
                            
                            <div className={`flex gap-2 ml-4 payment-link-actions-mobile ${isPaid || isExpired || isDeactivated ? 'opacity-50' : ''}`}>
                            <button
                              onClick={() => copyToClipboard(link.id)}
                              disabled={copyingId === link.id || deactivatingId === link.id || deletingId === link.id}
                              className={`px-4 py-2 text-sm border rounded-lg transition-colors disabled:opacity-50 ${
                                copiedId === link.id
                                  ? 'border-green-500 bg-green-500/10'
                                  : 'cosmic-button-secondary border-white/30 hover:bg-white/10'
                              }`}
                              style={copiedId === link.id ? { color: '#4ade80' } : undefined}
                              title="Copy Link"
                            >
                              {copyingId === link.id ? (
                                <span className="flex items-center gap-2">
                                  <svg className="animate-spin h-4 w-4 button-icon" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>Copying...</span>
                                </span>
                              ) : copiedId === link.id ? (
                                <span className="flex items-center gap-2">
                                  <svg className="w-4 h-4 button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span>Copied!</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <svg className="w-4 h-4 button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  <span>Copy Link</span>
                                </span>
                              )}
                            </button>

                            {/* QR Code button */}
                            <button
                              onClick={() => generateQRCode(link)}
                              disabled={generatingQR || copyingId === link.id || deactivatingId === link.id || deletingId === link.id}
                              className="cosmic-button-secondary px-4 py-2 text-sm border border-white/30 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {generatingQR && currentQRLink?.id === link.id ? (
                                <span className="flex items-center gap-2">
                                  <svg className="animate-spin h-4 w-4 button-icon" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>Generating...</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <svg className="w-4 h-4 button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                  </svg>
                                  <span>QR Code</span>
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
                                    <svg className="animate-spin h-4 w-4 button-icon" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Deactivating...</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <svg className="w-4 h-4 button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                    </svg>
                                    Deactivate
                                  </span>
                                )}
                              </button>
                            )}

                            {/* Test Heart Animation Button - Only show in development */}
                            {process.env.NODE_ENV === 'development' && (
                              <button
                                onClick={() => {
                                  console.log('🧪 TEST: Manually triggering heart animation for:', link.id)
                                  setHeartAnimatingId(link.id)
                                  setTimeout(() => {
                                    console.log('🧪 TEST: Clearing manual heart animation')
                                    setHeartAnimatingId(null)
                                  }, 3000)
                                }}
                                className="px-3 py-2 text-sm border border-pink-500/50 text-pink-400 hover:bg-pink-500/10 hover:border-pink-500 rounded-lg transition-colors"
                                title="Test heart animation"
                              >
                                💖
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
                Amount: AED {formatAmount(linkToDeactivate.service_amount_aed || linkToDeactivate.amount_aed)}
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
                Amount: AED {formatAmount(linkToDelete.service_amount_aed || linkToDelete.amount_aed)}
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

              {/* Client and Amount between QR and Close button */}
              <div className="mb-6 space-y-2">
                <p className="text-white text-xl font-semibold">{currentQRLink.client_name || 'Client'}</p>
                <p className="text-white text-xl font-semibold">AED {formatAmount(currentQRLink.service_amount_aed || currentQRLink.amount_aed)}</p>
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