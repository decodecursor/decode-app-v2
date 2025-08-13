'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PasswordInput from '@/components/PasswordInput'
// Removed ReactCrop - using custom Instagram-style interface

interface UserProfile {
  id: string
  email: string
  professional_center_name: string | null
  user_name: string
  role: string
  profile_photo_url?: string | null // NOTE: Requires database column: ALTER TABLE users ADD COLUMN profile_photo_url TEXT;
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
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [imageScale, setImageScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChanging, setPasswordChanging] = useState(false)

  // Feedback states
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)

  useEffect(() => {
    // Only run on client-side
    if (typeof window !== 'undefined') {
      checkUser()
    }
  }, [])

  const checkUser = async () => {
    // Additional client-side guard
    if (typeof window === 'undefined') return
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      setUser(user)

      // Fetch user profile using available database fields
      // Type casting to bypass Supabase type checking for profile_photo_url column
      const { data: profileData, error } = await supabase
        .from('users')
        .select('id, email, user_name, professional_center_name, role, profile_photo_url')
        .eq('id', user.id)
        .single() as { data: UserProfile | null, error: any }

      if (error) {
        console.error('Error fetching profile:', error)
        setMessage({ type: 'error', text: 'Failed to load profile' })
      } else if (profileData) {
        setProfile(profileData)
        setProfessionalCenterName(profileData.professional_center_name || '')
        setNewEmail(profileData.email || user.email || '')
        setProfilePhotoUrl(profileData.profile_photo_url || null)
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

  const getCroppedImg = (image: HTMLImageElement): Promise<Blob> => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    const size = 300 // Fixed circular crop size
    canvas.width = size
    canvas.height = size

    // Create circular clipping path
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI)
    ctx.clip()

    // Calculate scaled dimensions
    const scaledWidth = image.naturalWidth * imageScale
    const scaledHeight = image.naturalHeight * imageScale

    // Draw image with position and scale
    ctx.drawImage(
      image,
      imagePosition.x,
      imagePosition.y,
      scaledWidth,
      scaledHeight
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
      const croppedImageBlob = await getCroppedImg(imgRef.current)
      
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

      // Reset editor state without showing success message
      setSelectedImage(null)
      setImagePosition({ x: 0, y: 0 })
      setImageScale(1)
    } catch (error) {
      console.error('Error uploading photo:', error)
      setMessage({ type: 'error', text: 'Failed to upload profile photo. Check console for details.' })
    } finally {
      setPhotoUploading(false)
    }
  }

  // Handle mouse/touch events for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y })
  }

  // Document-level drag handling for proper mouse tracking
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!imgRef.current) return
      
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      
      // Calculate simple boundaries for smooth dragging in all directions
      const img = imgRef.current
      const scaledWidth = img.naturalWidth * imageScale
      const scaledHeight = img.naturalHeight * imageScale
      const containerWidth = 320
      const containerHeight = 320
      const buffer = 100 // Allow image to move beyond container but keep some portion visible
      
      // Simple boundary logic - allow generous movement in all directions
      const minX = -scaledWidth + buffer
      const maxX = containerWidth - buffer
      const minY = -scaledHeight + buffer  
      const maxY = containerHeight - buffer
      
      setImagePosition({
        x: Math.max(minX, Math.min(maxX, newX)),
        y: Math.max(minY, Math.min(maxY, newY))
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart.x, dragStart.y, imageScale])

  // Handle zoom slider
  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageScale(parseFloat(e.target.value))
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
        <div className="space-y-6 flex justify-center">
          <div className="w-full max-w-2xl">
            {/* Back to Dashboard Link - Positioned to align with centered cosmic cards */}
            <div className="mb-8" style={{ width: '28vw', marginLeft: 'auto', marginRight: 'auto' }}>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center text-gray-300 hover:text-white transition-colors w-fit"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </button>
            </div>
            
            <div className="space-y-8">
          {/* Profile Photo Section - Admin Only */}  
          {profile?.role === 'Admin' && (
          <div className="cosmic-card-profile h-fit">
            <h2 className="text-xl font-semibold text-white mb-8">Company Profile Photo</h2>
            
            <div className="text-center">
              {/* Profile Photo Display */}
              {!selectedImage && (
                <div className="mb-8">
                  <div className="w-48 h-48 mx-auto rounded-full overflow-hidden bg-gray-700 ring-4 ring-white/10">
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

              {/* Instagram-Style Image Editor */}
              {selectedImage && (
                  <div className="mb-8">
                    <div className="flex justify-center">
                      {/* Main Image Container */}
                      <div className="relative">
                        <div 
                          ref={containerRef}
                          className={`relative w-80 h-80 bg-gray-600 rounded-2xl overflow-hidden transition-all duration-200 ${
                            isDragging ? 'cursor-grabbing' : 'cursor-grab'
                          }`}
                          onMouseDown={handleMouseDown}
                          style={{
                            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                            backgroundSize: '20px 20px'
                          }}
                        >
                          {/* Image Behind Mask */}
                          <img
                            ref={imgRef}
                            src={selectedImage}
                            alt="Edit preview"
                            className={`absolute select-none border-2 rounded-lg shadow-lg transition-all duration-200 ${
                              isDragging 
                                ? 'border-blue-400 shadow-blue-400/50' 
                                : 'border-white/50 hover:border-white/80'
                            }`}
                            style={{
                              transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale})`,
                              transformOrigin: 'center',
                              transition: isDragging ? 'none' : 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                              zIndex: 1
                            }}
                            onLoad={() => {
                              if (imgRef.current && containerRef.current) {
                                const img = imgRef.current
                                const container = containerRef.current
                                
                                // Calculate proper centering based on natural dimensions
                                const containerWidth = 320 // 80 * 4 = 320px
                                const containerHeight = 320
                                
                                // Scale image to fill circular crop area (256px diameter)
                                const minScale = Math.max(256 / img.naturalWidth, 256 / img.naturalHeight)
                                const scaledWidth = img.naturalWidth * minScale
                                const scaledHeight = img.naturalHeight * minScale
                                
                                // Center the scaled image
                                setImagePosition({
                                  x: (containerWidth - scaledWidth) / 2,
                                  y: (containerHeight - scaledHeight) / 2
                                })
                                setImageScale(minScale)
                              }
                            }}
                          />

                          {/* Circular Crop Mask - Above Image */}
                          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
                            <div 
                              className="absolute inset-0 bg-black bg-opacity-70"
                              style={{
                                maskImage: 'radial-gradient(circle 128px at center, transparent 128px, black 128px)',
                                WebkitMaskImage: 'radial-gradient(circle 128px at center, transparent 128px, black 128px)'
                              }}
                            ></div>
                            <div className="absolute top-1/2 left-1/2 w-64 h-64 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30"></div>
                          </div>
                        </div>
                        
                        {/* Zoom Slider */}
                        <div className="mt-6 flex items-center gap-3">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.1"
                            value={imageScale}
                            onChange={handleZoomChange}
                            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                          </svg>
                        </div>
                        
                        <p className="text-sm text-gray-400 text-center mt-4">Drag to reposition • Use slider to zoom</p>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex justify-center gap-4 mt-8">
                      <button
                        onClick={() => {
                          setSelectedImage(null)
                          setImagePosition({ x: 0, y: 0 })
                          setImageScale(1)
                        }}
                        className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full font-medium transition-all duration-200 transform hover:scale-105"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={uploadProfilePhoto}
                        disabled={photoUploading}
                        className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                      >
                        {photoUploading ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Uploading...
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
                      className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
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
          )}

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