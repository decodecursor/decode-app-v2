'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  id: string
  email: string
  professional_center_name: string | null
  full_name: string
  role: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form states
  const [professionalCenterName, setProfessionalCenterName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailVerificationSent, setEmailVerificationSent] = useState(false)

  // Photo upload states
  const [photoUploading, setPhotoUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageScale, setImageScale] = useState(1)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
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
        .select('id, email, full_name, professional_center_name, role')
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
        setMessage({ type: 'success', text: 'Company name updated successfully' })
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
    }
    reader.readAsDataURL(file)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setImagePosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoom = (direction: 'in' | 'out') => {
    const newScale = direction === 'in' ? imageScale * 1.1 : imageScale * 0.9
    setImageScale(Math.max(0.5, Math.min(3, newScale)))
  }

  const getCroppedImg = (): Promise<Blob> => {
    if (!imgRef.current) throw new Error('No image selected')
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const image = imgRef.current
    
    // Set canvas size for profile photo (square for circular crop)
    const size = 400
    canvas.width = size
    canvas.height = size
    
    // Create circular clipping path
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.clip()
    
    // Calculate image dimensions and position
    const scaledWidth = image.naturalWidth * imageScale
    const scaledHeight = image.naturalHeight * imageScale
    
    // Draw the image with current scale and position
    ctx.drawImage(
      image,
      0, 0, image.naturalWidth, image.naturalHeight,
      imagePosition.x, imagePosition.y, scaledWidth, scaledHeight
    )

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob!)
      }, 'image/jpeg', 0.95)
    })
  }

  const uploadProfilePhoto = async () => {
    if (!imgRef.current || !profile || !selectedImage) return

    setPhotoUploading(true)
    try {
      const croppedImageBlob = await getCroppedImg()
      
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

      // For now, just show success message since we uploaded to storage successfully
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

  // Loading state removed - show content immediately

  return (
    <div className="cosmic-bg">
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
                  <div className="w-48 h-48 mx-auto rounded-full overflow-hidden bg-gray-700 ring-4 ring-white/10">
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

              {/* Circular Photo Selector */}
              {selectedImage && (
                  <div className="mb-8">
                    <div className="text-center mb-4">
                      <p className="text-gray-300 text-sm">Drag to position and use controls to zoom</p>
                    </div>
                    
                    <div className="circular-photo-selector"
                         onMouseDown={handleMouseDown}
                         onMouseMove={handleMouseMove}
                         onMouseUp={handleMouseUp}
                         onMouseLeave={handleMouseUp}>
                      <img
                        ref={imgRef}
                        src={selectedImage}
                        alt="Profile photo"
                        style={{
                          transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
                          transformOrigin: 'center'
                        }}
                        draggable={false}
                      />
                    </div>
                    
                    <div className="photo-controls">
                      <button 
                        onClick={() => handleZoom('out')}
                        className="zoom-button"
                        type="button"
                      >
                        −
                      </button>
                      <button 
                        onClick={() => handleZoom('in')}
                        className="zoom-button"
                        type="button"
                      >
                        +
                      </button>
                    </div>
                    
                    <div className="flex flex-col justify-center items-center gap-3 mt-6">
                      <button
                        onClick={uploadProfilePhoto}
                        disabled={photoUploading || !selectedImage}
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
            <h2 className="text-xl font-semibold text-white mb-6">Company Name</h2>
            <div className="space-y-4">
              <input
                type="text"
                value={professionalCenterName}
                onChange={(e) => setProfessionalCenterName(e.target.value)}
                placeholder="Enter your company/business name"
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
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-semibold text-white">Email Address</h2>
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