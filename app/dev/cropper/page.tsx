'use client'

/**
 * Standalone verifier for components/ambassador/ImageCropper.
 *
 * Route: /dev/cropper
 *
 * Mounts the canonical <ImageCropper> with a File picked locally plus a
 * mode toggle (avatar 400x400 / listing 720x1280). On Use, the page
 * receives the cropped Blob and renders a preview with size + type.
 *
 * Safe to delete after verification. No auth, no persistence, no side
 * effects.
 */

import { useState } from 'react'
import { ImageCropper } from '@/components/ambassador/ImageCropper'

type Mode = 'avatar' | 'listing'

const LABELS: Record<Mode, string> = {
  avatar:  'Avatar (400×400 circle)',
  listing: 'Listing (720×1280 portrait)',
}

export default function CropperVerifierPage() {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<Mode>('avatar')
  const [open, setOpen] = useState(false)
  const [output, setOutput] = useState<{ url: string; sizeKb: number; type: string } | null>(null)

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    setFile(picked)
    setOutput(null)
    e.target.value = ''
  }

  const handleCropComplete = (blob: Blob) => {
    setOpen(false)
    const url = URL.createObjectURL(blob)
    setOutput({ url, sizeKb: Math.round(blob.size / 1024), type: blob.type })
    // eslint-disable-next-line no-console
    console.log('[cropper verifier] output blob:', { size: blob.size, type: blob.type, mode })
  }

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
        Standalone verifier. Pick a local image, pick a mode, crop, inspect output blob.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(Object.keys(LABELS) as Mode[]).map((k) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: mode === k ? '1.5px solid #e91e8c' : '1.5px solid #262626',
              background: mode === k ? '#1c1c1c' : '#0c0c0c',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {LABELS[k]}
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
        {file ? `Replace image (${file.name})` : 'Pick an image'}
        <input type="file" accept="image/*" onChange={handlePick} style={{ display: 'none' }} />
      </label>

      {file && (
        <button
          onClick={() => setOpen(true)}
          style={{
            marginBottom: 16,
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
      )}

      {output && (
        <div style={{ padding: 16, background: '#0c0c0c', borderRadius: 12, border: '1px solid #262626' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>Output blob</div>
          <div style={{ fontSize: 12, marginBottom: 6 }}>type: <span style={{ color: '#4ade80' }}>{output.type}</span></div>
          <div style={{ fontSize: 12, marginBottom: 6 }}>size: <span style={{ color: '#4ade80' }}>{output.sizeKb} KB</span></div>
          <div style={{ fontSize: 12, marginBottom: 12 }}>mode: {mode}</div>
          { /* eslint-disable-next-line @next/next/no-img-element */ }
          <img
            src={output.url}
            alt="output"
            style={{
              maxWidth: '100%',
              borderRadius: mode === 'avatar' ? '50%' : 8,
              display: 'block',
            }}
          />
        </div>
      )}

      {open && file && (
        <ImageCropper
          sourceFile={file}
          mode={mode}
          onCropComplete={handleCropComplete}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  )
}
