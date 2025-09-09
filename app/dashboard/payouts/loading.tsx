export default function Loading() {
  return (
    <div className="cosmic-bg min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="cosmic-card">
          <div className="animate-pulse">
            <div className="h-8 w-32 bg-gray-700 rounded mb-4" />
            <div className="space-y-3">
              <div className="h-4 w-48 bg-gray-700 rounded" />
              <div className="h-4 w-64 bg-gray-700 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}