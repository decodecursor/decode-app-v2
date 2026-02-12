import type { Metadata } from 'next'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import OfferDetailClient from './OfferDetailClient'

async function fetchOfferForMetadata(id: string) {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('offers')
    .select('title, description')
    .eq('id', id)
    .single()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const offer = await fetchOfferForMetadata(id)

  const title = offer?.title || 'Beauty Offer'
  const description = offer?.description || 'Check out this beauty offer on DECODE'

  return {
    title,
    openGraph: {
      title,
      type: 'website',
      description,
      url: `https://app.welovedecode.com/offers/${id}`,
      images: [
        {
          url: 'https://app.welovedecode.com/logonew.png',
          width: 1200,
          height: 630,
          alt: 'DECODE - Make Girls More Beautiful',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://app.welovedecode.com/logonew.png'],
    },
  }
}

export default function OfferDetailPage() {
  return <OfferDetailClient />
}
