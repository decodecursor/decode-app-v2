'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getUserWithProxy } from '@/utils/auth-helper'
import { User } from '@supabase/supabase-js'
import PasswordInput from '@/components/PasswordInput'
import Cropper from 'react-easy-crop'
import { useUser } from '@/providers/UserContext'

interface UserProfile {
  id: string
  email: string
  professional_center_name: string | null
  company_name: string | null
  user_name: string
  role: string
  profile_photo_url?: string | null // NOTE: Requires database column: ALTER TABLE users ADD COLUMN profile_photo_url TEXT;
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const { refreshProfile } = useUser()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form states
  const [professionalCenterName, setProfessionalCenterName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailVerificationSent, setEmailVerificationSent] = useState(false)

  // Photo upload states
  const [photoUploading, setPhotoUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedImage, setCroppedImage] = useState<string | null>(null)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChanging, setPasswordChanging] = useState(false)

  // Feedback states
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const [companyNameSaved, setCompanyNameSaved] = useState(false)

  // Load profile data when user is available
  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { user: authUser } = await getUserWithProxy()
        if (!authUser) {
          console.log('🚪 Profile: No authenticated user, redirecting to auth')
          router.push('/auth')
          return
        }
        setUser(authUser)
      } catch (error) {
        console.error('Auth check failed:', error)
        router.push('/auth')
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()
  }, [router, supabase])

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        console.log('🚪 Profile: No user, waiting for auth...')
        return
      }

      try {
        console.log('🔍 Profile: Loading profile for user:', user.id)
        setLoading(true)

      // Fetch user profile using available database fields
      let profileData = null
      try {
        // Type casting to bypass Supabase type checking for profile_photo_url column
        const { data, error } = await supabase
          .from('users')
          .select('id, email, user_name, professional_center_name, company_name, role, profile_photo_url')
          .eq('id', user.id)
          .single() as { data: UserProfile | null, error: any }

        if (error) {
          console.log('⚠️ Profile: Database query failed, using user data from session:', error.message)
          // Create profile from available user data
          profileData = {
            id: user.id,
            email: user.email || '',
            user_name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            professional_center_name: null,
            company_name: null,
            role: 'User',
            profile_photo_url: null
          }
        } else {
          profileData = data
        }
      } catch (queryError) {
        console.log('⚠️ Profile: Query failed, using fallback profile data')
        profileData = {
          id: user.id,
          email: user.email || '',
          user_name: user.email?.split('@')[0] || 'User',
          professional_center_name: null,
          company_name: null,
          role: 'User',
          profile_photo_url: null
        }
      }

      if (profileData) {
        setProfile(profileData)
        setProfessionalCenterName(profileData.company_name || profileData.professional_center_name || '')
        setNewEmail(profileData.email || user.email || '')
        setProfilePhotoUrl(profileData.profile_photo_url || null)
      } else {
        setMessage({ type: 'error', text: 'No profile data found' })
      }
    } catch (error) {
      console.error('Profile loading error:', error)
      setMessage({ type: 'error', text: 'Failed to load profile data' })
    } finally {
      setLoading(false)
    }
    }

    loadProfile()
  }, [user, router])

  // Handle authentication redirect

  const updateProfessionalCenterName = async () => {
    if (!profile || !professionalCenterName.trim()) return

    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({
          professional_center_name: professionalCenterName.trim(),
          company_name: professionalCenterName.trim()
        })
        .eq('id', profile.id)

      if (error) {
        console.error('Professional center name update error:', error)
        throw error
      } else {
        setProfile({
          ...profile,
          professional_center_name: professionalCenterName.trim(),
          company_name: professionalCenterName.trim()
        })

        // Show success on button for 3 seconds
        setCompanyNameSaved(true)
        setTimeout(() => {
          setCompanyNameSaved(false)
        }, 3000)
      }
    } catch (error) {
      console.error('Error updating professional center name:', error)
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
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedImage(null)
      setCroppedAreaPixels(null)
    }
    reader.readAsDataURL(file)
  }

  const getCroppedImg = (imageSrc: string, croppedAreaPixels: { x: number, y: number, width: number, height: number }): Promise<Blob> => {
    return new Promise((resolve) => {
      const image = new Image()
      image.src = imageSrc
      image.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!

        // Set canvas to desired output size (square for circular crop)
        const outputSize = 256
        canvas.width = outputSize
        canvas.height = outputSize

        // Create circular clipping path first
        ctx.beginPath()
        ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, 2 * Math.PI)
        ctx.clip()

        // Draw the cropped area from source image to canvas
        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          outputSize,
          outputSize
        )

        canvas.toBlob((blob) => {
          resolve(blob!)
        }, 'image/jpeg', 0.95)
      }
    })
  }

  // Helper function to check if storage bucket exists
  const checkStorageBucket = async (supabase: any): Promise<boolean> => {
    try {
      console.log('🪣 Checking if storage bucket exists...')
      const { data, error } = await supabase.storage.listBuckets()

      if (error) {
        console.error('❌ Error listing buckets:', error)
        return false
      }

      const bucketExists = data?.some((bucket: any) => bucket.name === 'user-uploads')
      console.log('✅ Bucket check result:', { bucketExists, availableBuckets: data?.map((b: any) => b.name) })

      return bucketExists || false
    } catch (error) {
      console.error('❌ Unexpected error checking bucket:', error)
      return false
    }
  }

  const onCropComplete = useCallback(async (_, croppedAreaPixelsParam) => {
    if (!selectedImage) return
    setCroppedAreaPixels(croppedAreaPixelsParam)
    const cropped = await getCroppedImg(selectedImage, croppedAreaPixelsParam)
    const croppedUrl = URL.createObjectURL(cropped)
    setCroppedImage(croppedUrl)
  }, [selectedImage])

  const uploadProfilePhoto = async () => {
    if (!profile || !selectedImage || !croppedAreaPixels) return

    setPhotoUploading(true)
    try {
      const croppedImageBlob = await getCroppedImg(selectedImage, croppedAreaPixels)

      const fileExt = 'jpg'
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`
      const filePath = `profile-photos/${fileName}`

      const supabase = createClient()

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

      // Update profile photo URL in state and database
      setProfilePhotoUrl(publicUrl)

      // Update user profile in database with photo URL
      // Type casting to bypass Supabase type checking for profile_photo_url column
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_photo_url: publicUrl } as any)
        .eq('id', profile.id)

      if (updateError) {
        console.error('Error updating profile photo URL:', updateError)
        setMessage({ type: 'error', text: 'Failed to save profile photo. Please try again.' })
        return
      }

      // Refresh profile context to update dashboard image
      await refreshProfile()

      // Reset editor state without showing success message
      setSelectedImage(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedImage(null)
      setCroppedAreaPixels(null)
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

  const changePassword = async () => {
    if (!user || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) return

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' })
      return
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters long' })
      return
    }

    setPasswordChanging(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        throw error
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage({ type: 'success', text: 'Password updated successfully' })
    } catch (error) {
      console.error('Error changing password:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to change password' })
    } finally {
      setPasswordChanging(false)
    }
  }

  // Show loading spinner while checking authentication or loading profile
  if (authLoading || loading) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-300">{authLoading ? 'Authenticating...' : 'Loading profile...'}</p>
          </div>
        </div>
      </div>
    )
  }

  // Ensure user exists before rendering
  if (!user) {
    return null
  }

  return (
    <div className="cosmic-bg">
      <div className="container mx-auto px-4 py-2 md:py-8">
        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-600/20 text-green-100 border border-green-500/30' : 
            'bg-red-600/20 text-red-100 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-6">
          <div className="w-full md:max-w-2xl md:mx-auto">
            {/* Back to Dashboard Link - Positioned to align with centered cosmic cards */}
            <div className="profile-back-button-spacing pl-5 md:pl-0 profile-back-button">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center text-gray-300 hover:text-white transition-colors w-fit"
                style={{ marginLeft: 'calc((100% - 28vw) / 2)' }}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
            </div>
            
            <div className="space-y-4 md:space-y-8">
          {/* Profile Photo Section - Admin Only */}  
          {profile?.role === 'Admin' && (
          <div className="cosmic-card-profile h-fit w-full">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4 md:mb-8">Company Profile Photo</h2>
            
            <div className="text-center">
              {/* Profile Photo Display */}
              {!selectedImage && (
                <div className="mb-4 md:mb-8">
                  <div className="w-32 h-32 md:w-48 md:h-48 mx-auto rounded-full overflow-hidden bg-gray-700 ring-4 ring-white/10">
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
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
              )}

              {/* React Easy Crop Image Editor */}
              {selectedImage && (
                  <div className="mb-4 md:mb-8">
                    <div className="flex flex-col items-center gap-4 md:gap-6">
                      {/* Crop Area */}
                      <div className="relative w-60 h-60 md:w-80 md:h-80 bg-gray-800 rounded-2xl overflow-hidden">
                        <Cropper
                          image={selectedImage}
                          crop={crop}
                          zoom={zoom}
                          aspect={1}
                          cropShape="round"
                          showGrid={false}
                          onCropChange={setCrop}
                          onZoomChange={setZoom}
                          onCropComplete={onCropComplete}
                        />
                      </div>

                      {/* Zoom Slider */}
                      <div className="flex items-center gap-3 w-60 md:w-80">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="range"
                          min="1"
                          max="3"
                          step="0.1"
                          value={zoom}
                          onChange={(e) => setZoom(parseFloat(e.target.value))}
                          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                        </svg>
                      </div>

                      {/* Preview */}
                      {croppedImage && (
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={croppedImage}
                            alt="Cropped preview"
                            className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-white/30"
                          />
                          <p className="text-xs text-gray-400">Preview</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex justify-center gap-3 md:gap-4 mt-4 md:mt-8">
                      <button
                        onClick={() => {
                          setSelectedImage(null)
                          setCrop({ x: 0, y: 0 })
                          setZoom(1)
                          setCroppedImage(null)
                          setCroppedAreaPixels(null)
                        }}
                        className="px-6 py-3 md:px-8 md:py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full font-medium transition-all duration-200 transform hover:scale-105"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={uploadProfilePhoto}
                        disabled={photoUploading}
                        className="px-6 py-3 md:px-8 md:py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                      >
                        {photoUploading ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            {uploadProgress || 'Uploading...'}
                          </div>
                        ) : (
                          'Save Photo'
                        )}
                      </button>
                    </div>
                  </div>
                )}

              {/* Modern Upload Button */}
              {!selectedImage && (
                  <div className="space-y-6">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="group relative px-6 py-3 md:px-8 md:py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center group-hover:bg-opacity-30 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        Choose Photo
                      </div>
                      <div className="absolute inset-0 bg-white bg-opacity-0 group-hover:bg-opacity-10 rounded-2xl transition-all duration-300"></div>
                    </button>
                    <p className="text-sm text-gray-400 text-center">JPG, PNG or GIF (max 5MB)</p>
                  </div>
              )}
            </div>
          </div>
          )}

          {/* Professional Center Name Card - Admin Only */}
          {profile?.role === 'Admin' && (
          <div className="cosmic-card-profile w-full">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-white">Company Name</h2>
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-600/20 text-gray-400 text-xs font-medium rounded-full border border-gray-500/30">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Permanent
              </div>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={professionalCenterName}
                disabled={true}
                placeholder="Set at registration"
                className="cosmic-input w-full opacity-60 cursor-not-allowed"
              />
              <button
                disabled={true}
                className="cosmic-button-primary disabled:opacity-50 w-full cursor-not-allowed"
              >
                Set at Registration
              </button>
            </div>
          </div>
          )}

          {/* Email Address Card */}
          <div className="cosmic-card-profile w-full">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-lg md:text-xl font-semibold text-white">Email Address</h2>
              {user?.email_confirmed_at && (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-400 text-xs font-medium rounded-full border border-green-500/30">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Verified
                </div>
              )}
            </div>
            <div className="space-y-4">

              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter your email address"
                className="cosmic-input w-full"
              />
              <button
                onClick={changeEmail}
                disabled={saving || !newEmail.trim() || newEmail === profile?.email}
                className="cosmic-button-primary disabled:opacity-50 w-full"
              >
                {saving ? 'Sending...' : 'Change'}
              </button>
              
              {emailVerificationSent && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-blue-400 text-sm">
                    Verification email sent! Check your inbox and click the link to confirm your new email.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Password Change Card */}
          <div className="cosmic-card-profile w-full">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4 md:mb-6">Password</h2>
            <div className="space-y-4">
              <PasswordInput
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="Current password"
                className="cosmic-input w-full"
              />
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                placeholder="New password"
                className="cosmic-input w-full"
              />
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Confirm new password"
                className="cosmic-input w-full"
              />
              <button
                onClick={changePassword}
                disabled={passwordChanging || !currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()}
                className="cosmic-button-primary disabled:opacity-50 w-full"
              >
                {passwordChanging ? 'Changing...' : 'Change'}
              </button>
            </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}