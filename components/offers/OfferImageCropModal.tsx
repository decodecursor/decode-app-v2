'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'

interface CroppedArea {
  x: number
  y: number
  width: number
  height: number
}

interface OfferImageCropModalProps {
  imageSrc: string
  onCropComplete: (blob: Blob) => void
  onCancel: () => void
}

function getCroppedImg(
  imageSrc: string,
  croppedAreaPixels: CroppedArea
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = imageSrc
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!

      canvas.width = 1080
      canvas.height = 1350

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        1080,
        1350
      )

      // Try WebP first, fall back to JPEG
      const tryFormat = (format: string, quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              if (format === 'image/webp') {
                tryFormat('image/jpeg', 0.85)
                return
              }
              reject(new Error('Failed to create image blob'))
              return
            }
            // If > 5MB, reduce quality
            if (blob.size > 5 * 1024 * 1024 && quality > 0.5) {
              tryFormat(format, quality - 0.1)
              return
            }
            resolve(blob)
          },
          format,
          quality
        )
      }

      tryFormat('image/webp', 0.85)
    }
    image.onerror = () => reject(new Error('Failed to load image'))
  })
}

export default function OfferImageCropModal({
  imageSrc,
  onCropComplete,
  onCancel,
}: OfferImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedArea | null>(null)
  const [applying, setApplying] = useState(false)

  const onCropChange = useCallback(
    (_: unknown, croppedAreaPixels: CroppedArea) => {
      setCroppedAreaPixels(croppedAreaPixels)
    },
    []
  )

  const handleApply = async () => {
    if (!croppedAreaPixels) return
    setApplying(true)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
      onCropComplete(blob)
    } catch (err) {
      console.error('Crop failed:', err)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-[#1a1a2e] rounded-2xl overflow-hidden border border-white/10">
        {/* Crop area */}
        <div className="relative w-full" style={{ height: '400px' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={4 / 5}
            cropShape="rect"
            showGrid={true}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropChange}
          />
        </div>

        {/* Controls */}
        <div className="px-5 pt-4 pb-5 space-y-4">
          <p className="text-xs text-white/40 text-center">
            Position your image — shown in cards, detail page, and thumbnails
          </p>

          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-purple-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              className="flex-1 py-2.5 rounded-lg bg-purple-600 text-sm text-white font-medium hover:bg-purple-500 transition-colors disabled:opacity-50"
            >
              {applying ? 'Cropping...' : 'Apply Crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
