import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import AddListingClient from '@/components/ambassador/AddListingClient'

type Category = { id: string; label: string; slug: string }

type Professional = {
  id: string
  instagram_handle: string
  name: string
  city: string
  country: string
  avatar_photo_url: string
  created_by: string
  google_place_id: string | null
  whatsapp_number: string | null
  google_places_cache: { displayName?: { text?: string } } | null
}

type ListingPrefill = {
  id: string
  is_free_trial: boolean
  status: string
  category_id: string | null
  category_custom: string | null
  media_type: 'video' | 'photos' | null
  video_url: string | null
  photo_url_1: string | null
  photo_url_2: string | null
  photo_url_3: string | null
  price_30: number | null
  price_60: number | null
  price_90: number | null
}

type RawListingRow = ListingPrefill & {
  model_professionals: Professional | null
}

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/model/auth')

  const admin = createServiceRoleClient()

  const { data: profile } = await admin
    .from('model_profiles')
    .select('id, currency, is_suspended')
    .eq('user_id', user.id)
    .maybeSingle<{ id: string; currency: string; is_suspended: boolean }>()

  if (!profile) redirect('/model/setup')

  if (profile.is_suspended) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}>
        <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>
          Account suspended
        </h1>
        <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.65, maxWidth: '300px' }}>
          Your account has been suspended. Please contact support at{' '}
          <span style={{ color: '#e91e8c' }}>hello@welovedecode.com</span>{' '}
          for assistance.
        </p>
      </div>
    )
  }

  // Owner-scoped fetch. Redirect to /model/listings if the listing doesn't
  // exist or belongs to a different ambassador. model_professionals joined
  // via the explicit FK hint (same pattern used in Slice 3A GET / DELETE).
  const { data: row } = await admin
    .from('model_listings')
    .select(
      'id, is_free_trial, status, category_id, category_custom, media_type, video_url, photo_url_1, photo_url_2, photo_url_3, price_30, price_60, price_90, model_professionals!model_listings_professional_id_fkey ( id, instagram_handle, name, city, country, avatar_photo_url, created_by, google_place_id, whatsapp_number, google_places_cache )',
    )
    .eq('id', id)
    .eq('model_id', profile.id)
    .maybeSingle<RawListingRow>()

  if (!row || !row.model_professionals) redirect('/model/listings')

  const { model_professionals: professional, ...listing } = row

  const { data: categoriesData } = await admin
    .from('model_categories')
    .select('id, label, slug')
    .eq('is_active', true)
    .order('label', { ascending: true })
    .returns<Category[]>()

  return (
    <AddListingClient
      mode="edit"
      listing={listing}
      professional={professional}
      categories={categoriesData ?? []}
      currency={profile.currency}
      profileId={profile.id}
    />
  )
}
