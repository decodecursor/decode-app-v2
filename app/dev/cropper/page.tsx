'use client'

/**
 * Standalone verifier for components/ambassador/ImageCropper.
 *
 * Route: /dev/cropper
 * Shipped during Slice 3B Phase 2 to satisfy "render in a test route
 * or Storybook-style standalone render, crop a sample image, confirm
 * output Blob dimensions" per the slice instructions.
 *
 * Expected behavior:
 *   - Pick a local image, choose a target preset (400x400 square or
 *     720x1280 portrait), tap Open cropper.
 *   - The cropper opens full-screen with the image fitted to the
 *     window. Drag to pan, slider to zoom 1–4×.
 *   - Tap "Use". The component calls onCrop(blob). This page reads
 *     the blob, logs size + dims, and renders a preview.
 *
 * Safe to delete after verification. No auth, no data persistence,
 * no side effects.
 */

import { useState } from 'react'
import { ImageCropper } from '@/components/ambassador/ImageCropper'

type Preset = 'avatar' | 'listing'

const PRESETS: Record<Preset, { w: number; h: number; label: string; shape: 'circle' | 'rect' }> = {
  avatar:  { w: 400,  h: 400,  label: 'Avatar (400×400 circle)', shape: 'circle' },
  listing: { w: 720,  h: 1280, label: 'Listing (720×1280 portrait)', shape: 'rect' },
}

export default function CropperVerifierPage() {
  const [source, setSource] = useState<string | null>(null)
  const [preset, setPreset] = useState<Preset>('avatar')
  const [open, setOpen] = useState(false)
  const [output, setOutput] = useState<{ url: string; sizeKb: number; type: string } | null>(null)

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setSource(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
    setOutput(null)
  }

  const handleCrop = (blob: Blob) => {
    setOpen(false)
    const url = URL.createObjectURL(blob)
    setOutput({ url, sizeKb: Math.round(blob.size / 1024), type: blob.type })
    // eslint-disable-next-line no-console
    console.log('[cropper verifier] output blob:', { size: blob.size, type: blob.type, targetW: PRESETS[preset].w, targetH: PRESETS[preset].h })
  }

  const p = PRESETS[preset]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: 24,
      maxWidth: 640,
      margin: '0 auto',
    }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>ImageCropper verifier</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        Standalone Phase-2 verifier. Pick a local image, choose a preset, crop, inspect output blob.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(Object.keys(PRESETS) as Preset[]).map((k) => (
          <button
            key={k}
            onClick={() => setPreset(k)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: preset === k ? '1.5px solid #e91e8c' : '1.5px solid #262626',
              background: preset === k ? '#1c1c1c' : '#0c0c0c',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {PRESETS[k].label}
          </button>
        ))}
      </div>

      <label style={{
        display: 'block',
        padding: 16,
        background: '#1c1c1c',
        border: '1.5px dashed #333',
        borderRadius: 12,
        textAlign: 'center',
        cursor: 'pointer',
        fontSize: 13,
        color: '#888',
        marginBottom: 16,
      }}>
        {source ? 'Replace image' : 'Pick an image'}
        <input type="file" accept="image/*" onChange={handlePick} style={{ display: 'none' }} />
      </label>

      {source && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>Source</div>
          { /* eslint-disable-next-line @next/next/no-img-element */ }
          <img src={source} alt="source" style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
          <button
            onClick={() => setOpen(true)}
            style={{
              marginTop: 12,
              width: '100%',
              padding: 14,
              background: '#e91e8c',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Open cropper
          </button>
        </div>
      )}

      {output && (
        <div style={{ padding: 16, background: '#0c0c0c', borderRadius: 12, border: '1px solid #262626' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>Output blob</div>
          <div style={{ fontSize: 12, marginBottom: 6 }}>type: <span style={{ color: '#4ade80' }}>{output.type}</span></div>
          <div style={{ fontSize: 12, marginBottom: 6 }}>size: <span style={{ color: '#4ade80' }}>{output.sizeKb} KB</span></div>
          <div style={{ fontSize: 12, marginBottom: 12 }}>target: {p.w}×{p.h}</div>
          { /* eslint-disable-next-line @next/next/no-img-element */ }
          <img src={output.url} alt="output" style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
        </div>
      )}

      <ImageCropper
        open={open}
        source={source}
        targetWidth={p.w}
        targetHeight={p.h}
        shape={p.shape}
        onCancel={() => setOpen(false)}
        onCrop={handleCrop}
      />
    </div>
  )
}
