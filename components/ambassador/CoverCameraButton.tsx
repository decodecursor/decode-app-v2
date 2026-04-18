'use client'

export function CoverCameraButton({
  onClick,
  size = 28,
}: {
  onClick: (e: React.MouseEvent) => void
  size?: number
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        bottom: '10px',
        right: '16px',
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.7)',
        border: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 -1 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: 'block' }}
      >
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    </button>
  )
}
