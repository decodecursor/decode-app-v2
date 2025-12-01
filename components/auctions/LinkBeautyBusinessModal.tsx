/**
 * Link Beauty Business Modal
 * Modal for selecting existing beauty businesses or creating new ones
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { createClient } from '@/utils/supabase/client';

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
}

export function LinkBeautyBusinessModal({ isOpen, onClose, onLink }: LinkBeautyBusinessModalProps) {
  const [businessType, setBusinessType] = useState<'existing' | 'new' | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop complete callback - MUST be before early return to follow Rules of Hooks
  const onCropComplete = useCallback(async (_: unknown, croppedAreaPixelsParam: { x: number, y: number, width: number, height: number }) => {
    if (!selectedImage) return;
    setCroppedAreaPixels(croppedAreaPixelsParam);
    const cropped = await getCroppedImg(selectedImage, croppedAreaPixelsParam);
    const croppedUrl = URL.createObjectURL(cropped);
    setCroppedImage(croppedUrl);
  }, [selectedImage]);

  // Reset state when modal closes
  const handleClose = () => {
    setBusinessType(null);
    setSelectedBusiness('');
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

    onClose();
  };

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

    // Reset editor state
    setSelectedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCroppedImage(null);
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
    setFormData({ ...formData, businessPhotoUrl: '' });
  };

  const uploadBusinessPhoto = async (userId: string): Promise<string | null> => {
    if (!selectedImage || !croppedAreaPixels) return null;

    try {
      const croppedImageBlob = await getCroppedImg(selectedImage, croppedAreaPixels);

      const fileExt = 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `business-photos/${fileName}`;

      const supabase = createClient();

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, croppedImageBlob, {
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
      if (savedBusinessPhoto && croppedAreaPixels) {
        // TODO: Get actual user ID from auth context
        const userId = 'demo-user-id';
        const uploadedUrl = await uploadBusinessPhoto(userId);

        if (uploadedUrl) {
          photoUrl = uploadedUrl;
        } else {
          alert('Failed to upload business photo. Please try again.');
          setPhotoUploading(false);
          return;
        }
      }

      // Update formData with photo URL
      const businessData = {
        ...formData,
        businessPhotoUrl: photoUrl
      };

      // TODO: API call to create new business
      console.log('Creating new business:', businessData);
      alert('Business created successfully! (UI demo - not saved yet)');

      // Clean up blob URL
      if (savedBusinessPhoto) {
        URL.revokeObjectURL(savedBusinessPhoto);
      }

      // Reset form
      setFormData({ businessName: '', instagramHandle: '', city: '', businessPhotoUrl: '' });
      setSavedBusinessPhoto(null);
      setBusinessType(null);
    } catch (error) {
      console.error('Error creating business:', error);
      alert('Failed to create business. Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleLinkBusiness = () => {
    // TODO: Link selected business to auction
    console.log('Linking business:', selectedBusiness);
    onLink(selectedBusiness || null);
    onClose();
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
              onClick={() => setBusinessType('existing')}
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                businessType === 'existing'
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className="font-medium text-sm">Existing Business</span>
              <span className="text-[10px] opacity-90 mt-0.5">
                {businessType === 'existing' ? 'Select from list' : 'My connected businesses'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBusinessType('new')}
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-lg transition-all ${
                businessType === 'new'
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className="font-medium text-sm">New Business</span>
              <span className="text-[10px] opacity-90 mt-0.5">
                {businessType === 'new' ? 'Fill in details below' : 'Create new business'}
              </span>
            </button>
          </div>

          {/* Existing Business Content */}
          {businessType === 'existing' && (
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                My Connected Beauty Businesses
              </label>
              <div className="w-full px-4 py-8 bg-gray-800 border border-gray-600 rounded-lg text-center">
                <p className="text-gray-400 text-sm">Empty</p>
              </div>
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
                  placeholder="e.g., Glow Beauty Studio"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Instagram Handle */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Instagram Handle
                </label>
                <div className="flex items-center bg-gray-800 border border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent">
                  <span className="pl-4 text-gray-400">@</span>
                  <input
                    type="text"
                    required
                    value={formData.instagramHandle}
                    onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                    placeholder="beautyglowstudio"
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
                  placeholder="e.g., Los Angeles"
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

                    {/* Preview */}
                    {croppedImage && (
                      <div className="flex justify-center">
                        <img
                          src={croppedImage}
                          alt="Cropped preview"
                          className="w-20 h-20 rounded-full border-2 border-purple-500"
                        />
                      </div>
                    )}

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
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <img
                        src={savedBusinessPhoto}
                        alt="Business profile"
                        className="w-32 h-32 rounded-full border-2 border-purple-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={removeSavedPhoto}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      Remove Photo
                    </button>
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
                      className="w-full px-4 py-8 bg-gray-800 border border-dashed border-gray-600 hover:border-purple-500 rounded-lg text-center transition-colors"
                    >
                      <svg className="w-12 h-12 mx-auto text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-gray-400">Click to upload</p>
                      <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF (max 5MB)</p>
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={photoUploading}
                className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {photoUploading ? (
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
