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

      // Fetch user profile
      const { data: profileData, error } = await supabase
        .from('users')
        .select('id, email, company_name, profile_photo_url, email_verified, pending_email')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        setMessage({ type: 'error', text: 'Failed to load profile' })
      } else {
        setProfile(profileData)
        setCompanyName(profileData.company_name || '')
        setNewEmail(profileData.email || '')
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

      if (error) throw error

      setProfile({ ...profile, company_name: companyName.trim() })
      setMessage({ type: 'success', text: 'Company name updated successfully' })
    } catch (error) {
      console.error('Error updating company name:', error)
      setMessage({ type: 'error', text: 'Failed to update company name' })
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

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath)

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_photo_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setProfile({ ...profile, profile_photo_url: publicUrl })
      setSelectedImage(null)
      setMessage({ type: 'success', text: 'Profile photo updated successfully' })
    } catch (error) {
      console.error('Error uploading photo:', error)
      setMessage({ type: 'error', text: 'Failed to upload profile photo' })
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Photo Section */}
          <div className="cosmic-card">
            <h2 className="text-xl font-semibold text-white mb-6">Profile Photo</h2>
            
            <div className="text-center">
              {/* Current Profile Photo */}
              <div className="mb-6">
                <div className="w-32 h-32 mx-auto rounded-full overflow-hidden bg-gray-700">
                  {profile?.profile_photo_url ? (
                    <img 
                      src={profile.profile_photo_url} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Image Cropper */}
              {selectedImage && (
                <div className="mb-6">
                  <div className="max-w-md mx-auto">
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
                        className="max-w-full max-h-80 mx-auto"
                      />
                    </ReactCrop>
                  </div>
                  
                  <div className="flex justify-center space-x-4 mt-4">
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
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="cosmic-button-primary"
                  >
                    Choose New Photo
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Profile Information */}
          <div className="cosmic-card">
            <h2 className="text-xl font-semibold text-white mb-6">Profile Information</h2>
            
            {/* Company Name */}
            <div className="mb-6">
              <label className="block text-gray-300 mb-2">Company Name</label>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Enter your company/business name"
                  className="cosmic-input flex-1"
                />
                <button
                  onClick={updateCompanyName}
                  disabled={saving || !companyName.trim() || companyName === profile?.company_name}
                  className="cosmic-button-primary disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Update'}
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-2">
                This name will be displayed instead of your email address throughout the system
              </p>
            </div>

            {/* Email Address */}
            <div className="mb-6">
              <label className="block text-gray-300 mb-2">Email Address</label>
              <div className="flex space-x-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="cosmic-input flex-1"
                />
                <button
                  onClick={changeEmail}
                  disabled={saving || !newEmail.trim() || newEmail === profile?.email}
                  className="cosmic-button-primary disabled:opacity-50"
                >
                  {saving ? 'Sending...' : 'Change'}
                </button>
              </div>
              
              {/* Email Status */}
              <div className="mt-2 flex items-center space-x-4">
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
                  <span className="text-sm">
                    {profile?.email_verified ? 'Verified' : 'Not Verified'}
                  </span>
                </div>
                
                {profile?.pending_email && (
                  <div className="text-blue-400 text-sm">
                    Pending: {profile.pending_email}
                  </div>
                )}
              </div>
              
              {emailVerificationSent && (
                <p className="text-blue-400 text-sm mt-2">
                  Verification email sent! Check your inbox and click the link to confirm your new email.
                </p>
              )}
            </div>

            {/* Current Email Display */}
            <div className="text-gray-400 text-sm">
              Current email: {profile?.email}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}