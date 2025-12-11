/**
 * Link Beauty Business Modal
 * Modal for selecting existing beauty businesses or creating new ones
 */

'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { createClient } from '@/utils/supabase/client';
import type { BeautyBusiness } from '@/lib/models/BeautyBusiness.model';
/**
 * Instagram Icon Component
 */
function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

/**
 * Search Icon Component
 */
function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

// Helper function to crop image (moved outside component to avoid hooks issue)
const getCroppedImg = (imageSrc: string, croppedAreaPixels: { x: number, y: number, width: number, height: number }): Promise<Blob> => {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const outputSize = 256;
      canvas.width = outputSize;
      canvas.height = outputSize;

      // Create circular clipping path
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, 2 * Math.PI);
      ctx.clip();

      // Draw cropped image
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
      );

      canvas.toBlob((blob) => {
        resolve(blob!);
      }, 'image/jpeg', 0.95);
    };
  });
};

interface LinkBeautyBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLink: (businessId: string | null) => void;
  linkedBusinessId?: string | null;
}

export function LinkBeautyBusinessModal({ isOpen, onClose, onLink, linkedBusinessId }: LinkBeautyBusinessModalProps) {
  const [businessType, setBusinessType] = useState<'existing' | 'new' | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    businessName: '',
    instagramHandle: '',
    city: '',
    businessPhotoUrl: '',
  });

  // Photo management states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [savedBusinessPhoto, setSavedBusinessPhoto] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [tempCroppedBlob, setTempCroppedBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing businesses states
  const [existingBusinesses, setExistingBusinesses] = useState<BeautyBusiness[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);

  // Linked business state (to fetch and display the currently linked business)
  const [linkedBusinessData, setLinkedBusinessData] = useState<BeautyBusiness | null>(null);

  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BeautyBusiness[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Crop complete callback - MUST be before early return to follow Rules of Hooks
  const onCropComplete = useCallback(async (_: unknown, croppedAreaPixelsParam: { x: number, y: number, width: number, height: number }) => {
    if (!selectedImage) return;
    setCroppedAreaPixels(croppedAreaPixelsParam);
    const cropped = await getCroppedImg(selectedImage, croppedAreaPixelsParam);
    const croppedUrl = URL.createObjectURL(cropped);
    setCroppedImage(croppedUrl);
    setTempCroppedBlob(cropped); // Store the blob for later upload
  }, [selectedImage]);

  // Fetch existing businesses from API
  const fetchExistingBusinesses = useCallback(async () => {
    setLoadingBusinesses(true);
    try {
      const response = await fetch('/api/beauty-businesses/list');

      // Check response status BEFORE parsing JSON
      if (!response.ok) {
        let errorMessage = 'Failed to fetch businesses';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If error response isn't JSON, use status text
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        console.error('Error fetching beauty businesses:', errorMessage);
        setExistingBusinesses([]);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setExistingBusinesses(data.businesses || []);
      }
    } catch (error) {
      console.error('Error fetching beauty businesses:', error);
      setExistingBusinesses([]);
    } finally {
      setLoadingBusinesses(false);
    }
  }, []);

  // Fetch the linked business by ID
  const fetchLinkedBusiness = useCallback(async (businessId: string) => {
    try {
      const response = await fetch(`/api/beauty-businesses/${businessId}`);

      if (!response.ok) {
        console.error('Error fetching linked business:', businessId);
        return;
      }

      const data = await response.json();
      if (data.success && data.business) {
        setLinkedBusinessData(data.business as BeautyBusiness);
      }
    } catch (error) {
      console.error('Error fetching linked business:', error);
    }
  }, []);

  // Fetch businesses when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchExistingBusinesses();

      // Auto-select "Existing Business" tab if there's a linked business
      if (linkedBusinessId) {
        setBusinessType('existing');
        fetchLinkedBusiness(linkedBusinessId);
      }
    }
  }, [isOpen, fetchExistingBusinesses, fetchLinkedBusiness, linkedBusinessId]);

  // Debounced search functionality
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/beauty-businesses/search?query=${encodeURIComponent(searchTerm)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSearchResults(data.businesses || []);
          }
        }
      } catch (error) {
        console.error('Error searching businesses:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset state when modal closes
  const handleClose = () => {
    setBusinessType(null);
    setSelectedBusiness('');
    setSelectedBusinessId(null);
    setFormData({ businessName: '', instagramHandle: '', city: '', businessPhotoUrl: '' });

    // Reset photo states
    setSelectedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCroppedImage(null);
    if (savedBusinessPhoto) {
      URL.revokeObjectURL(savedBusinessPhoto);
    }
    setSavedBusinessPhoto(null);
    setPhotoUploading(false);
    setShowSuccess(false);
    setCroppedBlob(null);
    setTempCroppedBlob(null);

    // Reset linked business data
    setLinkedBusinessData(null);

    onClose();
  };

  // Compute sorted businesses list with linked business at the top
  const sortedBusinesses = useMemo(() => {
    let businessesToShow = searchTerm.trim() ? searchResults : existingBusinesses;

    // Add linked business to the list if it exists and isn't already included
    if (linkedBusinessData && !businessesToShow.find(b => b.id === linkedBusinessData.id)) {
      businessesToShow = [linkedBusinessData, ...businessesToShow];
    }

    // Sort to put linked business at the top
    return linkedBusinessId
      ? [...businessesToShow].sort((a, b) => {
          if (a.id === linkedBusinessId) return -1;
          if (b.id === linkedBusinessId) return 1;
          return 0;
        })
      : businessesToShow;
  }, [searchTerm, searchResults, existingBusinesses, linkedBusinessData, linkedBusinessId]);

  if (!isOpen) return null;

  // Photo management helper functions
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedImage(null);
      setCroppedAreaPixels(null);
    };
    reader.readAsDataURL(file);
  };

  const saveCroppedPhoto = () => {
    if (!croppedImage) return;

    // Save the cropped preview
    setSavedBusinessPhoto(croppedImage);

    // Store the blob for later upload
    if (tempCroppedBlob) {
      setCroppedBlob(tempCroppedBlob);
    }

    // Reset editor state
    setSelectedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCroppedImage(null);
    setTempCroppedBlob(null);
  };

  const cancelPhotoEdit = () => {
    setSelectedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedImage(null);
    setCroppedAreaPixels(null);
  };

  const removeSavedPhoto = () => {
    if (savedBusinessPhoto) {
      URL.revokeObjectURL(savedBusinessPhoto);
    }
    setSavedBusinessPhoto(null);
    setCroppedBlob(null);
    setFormData({ ...formData, businessPhotoUrl: '' });
  };

  const uploadBusinessPhoto = async (userId: string): Promise<string | null> => {
    if (!croppedBlob) return null;

    try {
      const fileExt = 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `business-photos/${fileName}`;

      const supabase = createClient();

      // Upload to Supabase storage using the stored blob
      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading business photo:', error);
      return null;
    }
  };

  const handleSubmitNew = async (e: React.FormEvent) => {
    e.preventDefault();

    setPhotoUploading(true);

    try {
      let photoUrl = '';

      // Upload business photo if one was selected and cropped
      if (savedBusinessPhoto && croppedBlob) {
        // Get actual user ID from auth context
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          alert('You must be logged in to create a business');
          setPhotoUploading(false);
          return;
        }

        const uploadedUrl = await uploadBusinessPhoto(user.id);

        if (uploadedUrl) {
          photoUrl = uploadedUrl;
        } else {
          alert('Failed to upload business photo. Please try again.');
          setPhotoUploading(false);
          return;
        }
      }

      // Call API to create new business
      const response = await fetch('/api/beauty-businesses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: formData.businessName,
          instagram_handle: formData.instagramHandle,
          city: formData.city,
          business_photo_url: photoUrl,
        }),
      });

      // Check response status BEFORE parsing JSON
      if (!response.ok) {
        let errorMessage = 'Failed to create business';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If error response isn't JSON, use status text
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        alert(errorMessage);
        setPhotoUploading(false);
        return;
      }

      const result = await response.json();

      if (!result.success) {
        alert(result.error || 'Failed to create business');
        setPhotoUploading(false);
        return;
      }

      // Show success in button
      setShowSuccess(true);
      setPhotoUploading(false);

      setTimeout(() => {
        // Call onLink with the new business_id
        onLink(result.business_id);

        // Clean up blob URL
        if (savedBusinessPhoto) {
          URL.revokeObjectURL(savedBusinessPhoto);
        }

        // Close the modal
        handleClose();
      }, 1500);
    } catch (error) {
      console.error('Error creating business:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to create business: ${errorMsg}. Please try again.`);
      setPhotoUploading(false);
    } finally {
      // Don't reset photoUploading here since we're waiting for timeout
    }
  };

  const handleLinkBusiness = () => {
    // TODO: Link selected business to auction
    console.log('Linking business:', selectedBusiness);
    onLink(selectedBusiness || null);
    onClose();
  };

  const handleLinkExisting = (businessId: string) => {
    setSelectedBusinessId(businessId);
    onLink(businessId);

    // Close after 2 seconds to show checkmark confirmation
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Link Beauty Business</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Selection Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setBusinessType('existing');
                setSuccessMessage(null);
              }}
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                businessType === 'existing'
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : 'bg-gray-800 border-purple-500 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className="font-medium text-sm">Existing Business</span>
              <span className="text-[10px] opacity-90 mt-0.5">
                Select
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBusinessType('new');
                setSuccessMessage(null);
              }}
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                businessType === 'new'
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : 'bg-gray-800 border-purple-500 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className="font-medium text-sm">New Business</span>
              <span className="text-[10px] opacity-90 mt-0.5">
                Connect
              </span>
            </button>
          </div>

          {/* Existing Business Content */}
          {businessType === 'existing' && (
            <div>
              {/* Search Input */}
              <div className="relative mb-4">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search across all users"
                  className="w-full pl-10 pr-4 py-[7px] bg-gray-800 border-0 rounded-lg text-white placeholder-gray-500 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Display businesses based on search */}
              <>
                {/* Loading state */}
                {(searchTerm.trim() ? isSearching : loadingBusinesses) && (
                  <div className="w-full px-4 py-8 bg-gray-800 border border-gray-600 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-400 text-sm">{searchTerm.trim() ? 'Searching...' : 'Loading businesses...'}</p>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!(searchTerm.trim() ? isSearching : loadingBusinesses) && sortedBusinesses.length === 0 && (
                  <div className="w-full px-4 py-8 bg-gray-800 border border-gray-600 rounded-lg text-center">
                    <p className="text-gray-400 text-sm">
                      {searchTerm.trim()
                        ? 'No businesses found matching your search.'
                        : 'No businesses yet. Create one using "New Business"!'}
                    </p>
                  </div>
                )}

                {/* Businesses list */}
                {!(searchTerm.trim() ? isSearching : loadingBusinesses) && sortedBusinesses.length > 0 && (
                  <div className="space-y-3">
                    {sortedBusinesses.map((business) => (
                      <button
                        key={business.id}
                        type="button"
                        onClick={() => handleLinkExisting(business.id)}
                        className={`w-full p-4 border rounded-lg transition-all text-left ${
                          business.id === selectedBusinessId || business.id === linkedBusinessId
                            ? 'border-purple-500'
                            : 'border-transparent hover:border-purple-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="instagram-avatar-sm flex-shrink-0">
                            {business.business_photo_url ? (
                              <img
                                src={business.business_photo_url}
                                alt={business.business_name}
                              />
                            ) : (
                              <div className="avatar-fallback">
                                {business.business_name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-white font-semibold">{business.business_name}</h3>
                              {/* Green checkmark right after business name */}
                              {(business.id === selectedBusinessId || business.id === linkedBusinessId) && (
                                <div className="w-5 h-5 bg-green-600/80 rounded-full flex items-center justify-center flex-shrink-0">
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <InstagramIcon className="w-3 h-3 text-pink-600" />
                              <a
                                href={`https://www.instagram.com/${business.instagram_handle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-pink-600 hover:underline transition-colors"
                              >
                                {business.instagram_handle}
                              </a>
                              <span>•</span>
                              <span>{business.city}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            </div>
          )}

          {/* New Business Form */}
          {businessType === 'new' && (
            <form onSubmit={handleSubmitNew} className="space-y-4">
              {/* Business Name */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="Glow Beauty Salon"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Instagram Handle */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Instagram Handle
                </label>
                <div className="flex items-center bg-gray-800 border border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent">
                  <div className="pl-4">
                    <InstagramIcon className="w-4 h-4 text-pink-600" />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.instagramHandle}
                    onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value.toLowerCase() })}
                    placeholder="glowbeauty"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    className="flex-1 px-2 py-3 bg-transparent text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* City */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  City
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Dubai"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Profile Image Upload */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Profile Image
                </label>

                {/* STATE 1: Image Editor (when selectedImage exists) */}
                {selectedImage && (
                  <div className="space-y-4">
                    {/* Crop Area */}
                    <div className="relative w-full h-64 bg-gray-800 rounded-lg overflow-hidden">
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
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                      </svg>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={cancelPhotoEdit}
                        className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveCroppedPhoto}
                        disabled={!croppedImage}
                        className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {/* STATE 2: Saved Photo Preview (when savedBusinessPhoto exists but not editing) */}
                {!selectedImage && savedBusinessPhoto && (
                  <div className="flex justify-center">
                    <div className="relative inline-block">
                      <img
                        src={savedBusinessPhoto}
                        alt="Business profile"
                        className="w-32 h-32 rounded-full border-2 border-purple-500 object-cover"
                      />
                      <button
                        type="button"
                        onClick={removeSavedPhoto}
                        className="absolute -top-2 -right-2 w-7 h-7 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* STATE 3: Upload Button (when no image selected or saved) */}
                {!selectedImage && !savedBusinessPhoto && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-4 py-[26px] bg-gray-800 border border-dashed border-gray-600 hover:border-purple-500 rounded-lg text-center transition-colors"
                    >
                      <svg className="w-[38px] h-[38px] mx-auto text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-gray-400">Click to upload</p>
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={photoUploading || showSuccess}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {showSuccess ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Success!
                  </div>
                ) : photoUploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Uploading...
                  </div>
                ) : (
                  'Link Business'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document.body level, bypassing backdrop-filter containment
  if (typeof window === 'undefined') return modalContent;
  return createPortal(modalContent, document.body);
}
