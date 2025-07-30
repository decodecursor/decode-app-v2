'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface UserProfile {
  id: string
  email: string
  company_name: string | null
  profile_photo_url: string | null
  email_verified: boolean
  pending_email: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form states
  const [companyName, setCompanyName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailVerificationSent, setEmailVerificationSent] = useState(false)

  // Photo upload states
  const [photoUploading, setPhotoUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>({ unit: '%', x: 25, y: 25, width: 50, height: 50 })
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Feedback states
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      setUser(user)

      // Fetch user profile - try new schema first, fallback to old schema
      let { data: profileData, error } = await supabase
        .from('users')
        .select('id, email, company_name, profile_photo_url, email_verified, pending_email')
        .eq('id', user.id)
        .single()

      // If new schema fails, try old schema
      if (error && error.message?.includes('column')) {
        console.log('New columns not found, using fallback query...')
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('users')
          .select('id, email, full_name')
          .eq('id', user.id)
          .single()
        
        if (fallbackError) {
          console.error('Error fetching profile:', fallbackError)
          setMessage({ type: 'error', text: 'Failed to load profile. Please run database migration.' })
        } else {
          // Create profile object with fallback values
          profileData = {
            id: fallbackData.id,
            email: fallbackData.email,
            company_name: null,
            profile_photo_url: null,
            email_verified: false,
            pending_email: null
          }
          setProfile(profileData)
          setCompanyName('')
          setNewEmail(fallbackData.email || user.email || '')
          setMessage({ type: 'error', text: 'Database migration required. Some features may not work.' })
        }
      } else if (error) {
        console.error('Error fetching profile:', error)
        setMessage({ type: 'error', text: 'Failed to load profile' })
      } else if (profileData) {
        setProfile(profileData)
        setCompanyName(profileData.company_name || '')
        setNewEmail(profileData.email || user.email || '')
      } else {
        setMessage({ type: 'error', text: 'No profile data found' })
      }
    } catch (error) {
      console.error('Auth error:', error)
      router.push('/auth')
    } finally {
      setLoading(false)
    }
  }

  const updateCompanyName = async () => {
    if (!profile || !companyName.trim()) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ company_name: companyName.trim() })
        .eq('id', profile.id)

      if (error) {
        console.error('Company name update error:', error)
        if (error.message?.includes('column') || error.message?.includes('company_name')) {
          setMessage({ type: 'error', text: 'Database migration required. Please run the database migration first.' })
        } else {
          throw error
        }
      } else {
        setProfile({ ...profile, company_name: companyName.trim() })
        setMessage({ type: 'success', text: 'Company name updated successfully' })
      }
    } catch (error) {
      console.error('Error updating company name:', error)
      setMessage({ type: 'error', text: 'Failed to update company name. Check console for details.' })
    } finally {
      setSaving(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be less than 5MB' })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setSelectedImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    canvas.width = crop.width
    canvas.height = crop.height

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    )

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob!)
      }, 'image/jpeg', 0.95)
    })
  }

  const uploadProfilePhoto = async () => {
    if (!completedCrop || !imgRef.current || !profile) return

    setPhotoUploading(true)
    try {
      const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop)
      
      const fileExt = 'jpg'
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`
      const filePath = `profile-photos/${fileName}`

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, croppedImageBlob, {
          contentType: 'image/jpeg',
          upsert: true
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('bucket')) {
          setMessage({ type: 'error', text: 'Storage bucket not found. Please create "user-uploads" bucket in Supabase Storage.' })
        } else {
          throw uploadError
        }
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath)

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_photo_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) {
        console.error('Profile update error:', updateError)
        if (updateError.message?.includes('column') || updateError.message?.includes('profile_photo_url')) {
          setMessage({ type: 'error', text: 'Database migration required. Please run the database migration first.' })
        } else {
          throw updateError
        }
        return
      }

      setProfile({ ...profile, profile_photo_url: publicUrl })
      setSelectedImage(null)
      setMessage({ type: 'success', text: 'Profile photo updated successfully' })
    } catch (error) {
      console.error('Error uploading photo:', error)
      setMessage({ type: 'error', text: 'Failed to upload profile photo. Check console for details.' })
    } finally {
      setPhotoUploading(false)
    }
  }

  const changeEmail = async () => {
    if (!profile || !newEmail.trim() || newEmail === profile.email) return

    setSaving(true)
    try {
      const response = await fetch('/api/profile/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: newEmail.trim() })
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      setEmailVerificationSent(true)
      setMessage({ type: 'success', text: 'Verification email sent. Please check your new email address.' })
    } catch (error) {
      console.error('Error changing email:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to change email' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading profile...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center text-gray-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-600/20 text-green-100 border border-green-500/30' : 
            'bg-red-600/20 text-red-100 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
          {/* Profile Photo Section */}  
          <div style={{ width: '40%', flexShrink: 0 }}>
            <div className="cosmic-card h-fit">
              <h2 className="text-xl font-semibold text-white mb-8">Profile Photo</h2>
              
              <div className="text-center">
                {/* Current Profile Photo */}
                <div className="mb-8">
                  <div className="w-48 h-48 mx-auto rounded-full overflow-hidden bg-gray-700 ring-4 ring-white/10">
                    {profile?.profile_photo_url ? (
                      <img 
                        src={profile.profile_photo_url} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Image Cropper */}
                {selectedImage && (
                  <div className="mb-8">
                    <div className="max-w-sm mx-auto mb-6">
                      <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={1}
                        circularCrop
                      >
                        <img
                          ref={imgRef}
                          src={selectedImage}
                          alt="Crop preview"
                          className="max-w-full max-h-64 mx-auto rounded-lg"
                        />
                      </ReactCrop>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                      <button
                        onClick={uploadProfilePhoto}
                        disabled={photoUploading || !completedCrop}
                        className="cosmic-button-primary disabled:opacity-50"
                      >
                        {photoUploading ? 'Uploading...' : 'Save Photo'}
                      </button>
                      <button
                        onClick={() => setSelectedImage(null)}
                        className="cosmic-button-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload Button */}
                {!selectedImage && (
                  <div className="space-y-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="cosmic-button-primary px-6 py-3"
                    >
                      <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Choose New Photo
                    </button>
                    <p className="text-gray-400 text-sm">Upload a square image for best results</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Profile Information */}
          <div style={{ width: '60%', flexShrink: 0 }}>
            <div className="cosmic-card">
              <h2 className="text-xl font-semibold text-white mb-8">Profile Information</h2>
              
              {/* Company Name */}
              <div className="mb-8">
                <label className="block text-gray-300 mb-3 font-medium">Company Name</label>
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Enter your company/business name"
                      className="cosmic-input flex-1 max-w-md"
                    />
                    <button
                      onClick={updateCompanyName}
                      disabled={saving || !companyName.trim() || companyName === profile?.company_name}
                      className="cosmic-button-primary disabled:opacity-50 px-6 whitespace-nowrap"
                    >
                      {saving ? 'Saving...' : 'Update'}
                    </button>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    This name will be displayed instead of your email address throughout the system
                  </p>
                </div>
              </div>

              {/* Email Address */}
              <div className="mb-8">
                <label className="block text-gray-300 mb-3 font-medium">Email Address</label>
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="cosmic-input flex-1 max-w-lg"
                    />
                    <button
                      onClick={changeEmail}
                      disabled={saving || !newEmail.trim() || newEmail === profile?.email}
                      className="cosmic-button-primary disabled:opacity-50 px-6 whitespace-nowrap"
                    >
                      {saving ? 'Sending...' : 'Change'}
                    </button>
                  </div>
                  
                  {/* Email Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className={`flex items-center space-x-2 ${
                      profile?.email_verified ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d={profile?.email_verified ? 
                            "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : 
                            "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                          } 
                        />
                      </svg>
                      <span className="text-sm font-medium">
                        {profile?.email_verified ? 'Verified' : 'Not Verified'}
                      </span>
                    </div>
                    
                    {profile?.pending_email && (
                      <div className="text-blue-400 text-sm bg-blue-500/10 px-3 py-1 rounded-full">
                        Pending: {profile.pending_email}
                      </div>
                    )}
                  </div>
                  
                  {emailVerificationSent && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <p className="text-blue-400 text-sm leading-relaxed">
                        Verification email sent! Check your inbox and click the link to confirm your new email.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Current Email Display */}
              <div className="pt-6 border-t border-gray-600/30">
                <div className="text-gray-400 text-sm">
                  <span className="font-medium">Current email:</span> {profile?.email}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}