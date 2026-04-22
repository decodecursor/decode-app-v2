'use client'

export function CoverPhotoActionSheet({
  open,
  onClose,
  onUploadNew,
  onRemove,
}: {
  open: boolean
  onClose: () => void
  onUploadNew: () => void
  onRemove: () => void
}) {
  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1c1c1c',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 500,
          padding: '24px 20px 32px',
          border: '1px solid #262626',
          borderBottom: 'none',
        }}
      >
        <div style={{ width: 40, height: 4, background: '#444', borderRadius: 2, margin: '0 auto 20px' }} />

        <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 20, color: '#fff' }}>
          Cover photo
        </div>

        <div
          onClick={onUploadNew}
          style={{
            background: '#111',
            border: '1px solid #262626',
            borderRadius: 12,
            padding: 16,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            cursor: 'pointer',
            marginBottom: 10,
            userSelect: 'none',
          }}
        >
          Upload new photo
        </div>

        <div
          onClick={onRemove}
          style={{
            background: '#111',
            border: '1px solid #262626',
            borderRadius: 12,
            padding: 16,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600,
            color: '#ef4444',
            cursor: 'pointer',
            marginBottom: 10,
            userSelect: 'none',
          }}
        >
          Remove photo
        </div>

        <div
          onClick={onClose}
          style={{
            textAlign: 'center',
            fontSize: 14,
            color: '#888',
            cursor: 'pointer',
            padding: 8,
          }}
        >
          Cancel
        </div>
      </div>
    </div>
  )
}
