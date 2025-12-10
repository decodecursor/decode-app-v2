import AITextLoading from '@/components/ui/AITextLoading'

export default function Loading() {
  return (
    <div className="cosmic-bg min-h-screen">
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="rounded-xl overflow-hidden shadow-lg">
          <AITextLoading />
        </div>
      </div>
    </div>
  )
}
