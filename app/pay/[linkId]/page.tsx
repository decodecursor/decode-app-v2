import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { getBusinessDisplayName } from '@/lib/user-display'
import PaymentPageClient from '@/components/payment/PaymentPageClient'

interface PaymentLinkData {
  id: string
  title: string
  amount_aed: number
  total_amount_aed: number
  client_name: string | null
  expiration_date: string
  is_active: boolean
  created_at: string
  isPaid?: boolean
  creator: {
    id: string
    user_name: string | null
    email: string
    company_name: string | null
  }
}

// Server-side function to fetch payment data for metadata
async function fetchPaymentDataForMetadata(linkId: string): Promise<PaymentLinkData | null> {
  try {
    console.log('🔍 Server: Fetching payment link for metadata:', linkId)
    
    // Fetch payment link data
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', linkId)
      .single()

    if (linkError || !paymentLink) {
      console.error('❌ Server: Payment link not found:', linkError)
      return null
    }

    // Fetch creator data
    const { data: creator, error: creatorError } = await supabase
      .from('users')
      .select('id, user_name, email, professional_center_name')
      .eq('id', paymentLink.creator_id)
      .single()

    if (creatorError || !creator) {
      console.error('❌ Server: Creator not found:', creatorError)
      return null
    }

    // Check if payment link is valid
    if (!paymentLink.is_active) {
      console.log('❌ Server: Payment link is deactivated')
      return null
    }

    const now = new Date()
    const expirationDate = new Date(paymentLink.expiration_date)
    if (now > expirationDate) {
      console.log('❌ Server: Payment link expired')
      return null
    }

    const transformedData: PaymentLinkData = {
      ...paymentLink,
      total_amount_aed: paymentLink.amount_aed, // Add missing field
      isPaid: (paymentLink as any).is_paid || paymentLink.payment_status === 'paid',
      creator: { 
        id: creator.id, 
        user_name: creator.user_name, 
        email: creator.email || 'creator@example.com',
        company_name: creator.professional_center_name
      }
    }

    console.log('✅ Server: Payment data loaded successfully for metadata')
    return transformedData
    
  } catch (error) {
    console.error('❌ Server: Error fetching payment data for metadata:', error)
    return null
  }
}

// Generate dynamic metadata for social sharing
export async function generateMetadata({ params }: { params: { linkId: string } }): Promise<Metadata> {
  const linkId = params.linkId
  const paymentData = await fetchPaymentDataForMetadata(linkId)

  // Default metadata
  const defaultMetadata: Metadata = {
    title: 'It\'s Pamper Time',
    description: 'A special beauty treatment awaits you',
    openGraph: {
      title: 'It\'s Pamper Time',
      description: 'A special beauty treatment awaits you',
      type: 'website',
      url: `https://decode-app-v2.vercel.app/pay/${linkId}`,
    },
    twitter: {
      card: 'summary',
      title: 'It\'s Pamper Time',
      description: 'A special beauty treatment awaits you',
    },
  }

  // If we have payment data, create personalized metadata
  if (paymentData) {
    const clientName = paymentData.client_name || 'you'
    const serviceName = paymentData.title || 'a beauty service'
    const companyName = getBusinessDisplayName(paymentData.creator) || 'our salon'
    
    const personalizedTitle = 'It\'s Pamper Time'
    const personalizedDescription = `Spoil ${clientName} with a ${serviceName} at ${companyName}:`

    return {
      title: personalizedTitle,
      description: personalizedDescription,
      openGraph: {
        title: personalizedTitle,
        description: personalizedDescription,
        type: 'website',
        url: `https://decode-app-v2.vercel.app/pay/${linkId}`,
      },
      twitter: {
        card: 'summary',
        title: personalizedTitle,
        description: personalizedDescription,
      },
    }
  }

  return defaultMetadata
}

export default function PaymentPage() {
  return <PaymentPageClient />
}