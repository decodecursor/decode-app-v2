'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface UserProfile {
  id: string
  email: string
  professional_center_name: string | null
  full_name: string
  role: string
  profile_photo_url: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form states
  const [professionalCenterName, setProfessionalCenterName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailVerificationSent, setEmailVerificationSent] = useState(false)

  // Photo upload states
  const [photoUploading, setPhotoUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>({ unit: '%', x: 25, y: 25, width: 50, height: 50 })
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChanging, setPasswordChanging] = useState(false)

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

      // Fetch user profile using available database fields
      const { data: profileData, error } = await supabase
        .from('users')
        .select('id, email, full_name, professional_center_name, role, profile_photo_url')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        setMessage({ type: 'error', text: 'Failed to load profile' })
      } else if (profileData) {
        setProfile(profileData)
        setProfessionalCenterName(profileData.professional_center_name || '')
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

  const updateProfessionalCenterName = async () => {
    if (!profile || !professionalCenterName.trim()) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ professional_center_name: professionalCenterName.trim() })
        .eq('id', profile.id)

      if (error) {
        console.error('Professional center name update error:', error)
        throw error
      } else {
        setProfile({ ...profile, professional_center_name: professionalCenterName.trim() })
        setMessage({ type: 'success', text: 'Professional center name updated successfully' })
      }
    } catch (error) {
      console.error('Error updating professional center name:', error)
      setMessage({ type: 'error', text: 'Failed to update professional center name. Check console for details.' })
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

      // Update user profile with the photo URL
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_photo_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) {
        console.error('Database update error:', updateError)
        throw updateError
      }

      // Update local profile state
      setProfile({ ...profile, profile_photo_url: publicUrl })
      setMessage({ type: 'success', text: 'Profile photo uploaded successfully!' })
      setSelectedImage(null)
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

        <div className="space-y-8">
          {/* Profile Photo Section */}  
          <div className="cosmic-card-profile h-fit">
            <h2 className="text-xl font-semibold text-white mb-8">Profile Photo</h2>
            
            <div className="text-center">
              {/* Current Profile Photo */}
              <div className="mb-8">
                  <div className="w-48 h-48 mx-auto rounded-lg overflow-hidden bg-gray-700 ring-4 ring-white/10">
                    {profile?.profile_photo_url ? (
                      <img 
                        src={profile.profile_photo_url} 
                        alt="Profile photo" 
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
                      >
                        <img
                          ref={imgRef}
                          src={selectedImage}
                          alt="Crop preview"
                          className="max-w-full max-h-64 mx-auto rounded-lg"
                        />
                      </ReactCrop>
                    </div>
                    
                    <div className="flex flex-col justify-center items-center gap-3">
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
                  </div>
              )}
            </div>
          </div>

          {/* Professional Center Name Card */}
          <div className="cosmic-card-profile">
            <h2 className="text-xl font-semibold text-white mb-6">Professional Center Name</h2>
            <div className="space-y-4">
              <input
                type="text"
                value={professionalCenterName}
                onChange={(e) => setProfessionalCenterName(e.target.value)}
                placeholder="Enter your professional center/business name"
                className="cosmic-input w-full"
              />
              <button
                onClick={updateProfessionalCenterName}
                disabled={saving || !professionalCenterName.trim() || professionalCenterName === profile?.professional_center_name}
                className="cosmic-button-primary disabled:opacity-50 w-full"
              >
                {saving ? 'Saving...' : 'Change'}
              </button>
            </div>
          </div>

          {/* Email Address Card */}
          <div className="cosmic-card-profile">
            <h2 className="text-xl font-semibold text-white mb-6">Email Address</h2>
            <div className="space-y-4">
              {/* Email Info */}
              <div className="text-gray-400 text-sm mb-4">
                Current email: {profile?.email}
              </div>

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
                {saving ? 'Sending...' : 'Change Email'}
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
          <div className="cosmic-card-profile">
            <h2 className="text-xl font-semibold text-white mb-6">Password</h2>
            <div className="space-y-4">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="cosmic-input w-full"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="cosmic-input w-full"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
  )
}