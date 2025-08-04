'use client'

interface OnboardingProgressProps {
  currentStep: 'create' | 'onboarding' | 'complete'
}

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  const steps = [
    { id: 'create', label: 'Create Account', icon: '1' },
    { id: 'onboarding', label: 'Complete Setup', icon: '2' },
    { id: 'complete', label: 'Start Receiving', icon: '3' }
  ]

  const getStepStatus = (stepId: string) => {
    const currentIndex = steps.findIndex(s => s.id === currentStep)
    const stepIndex = steps.findIndex(s => s.id === stepId)
    
    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'current'
    return 'upcoming'
  }

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id)
          const isLast = index === steps.length - 1
          
          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                {/* Step Circle */}
                <div
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm
                    transition-all duration-300 relative
                    ${status === 'completed' 
                      ? 'bg-green-500 text-white' 
                      : status === 'current'
                      ? 'bg-purple-600 text-white ring-4 ring-purple-600/20'
                      : 'bg-gray-800 text-gray-500 border border-gray-700'
                    }
                  `}
                >
                  {status === 'completed' ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.icon
                  )}
                  
                  {/* Pulse effect for current step */}
                  {status === 'current' && (
                    <div className="absolute inset-0 rounded-full bg-purple-600 animate-ping opacity-20" />
                  )}
                </div>
                
                {/* Step Label */}
                <span 
                  className={`
                    mt-2 text-sm font-medium whitespace-nowrap
                    ${status === 'completed' 
                      ? 'text-green-400' 
                      : status === 'current'
                      ? 'text-white'
                      : 'text-gray-500'
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>
              
              {/* Connector Line */}
              {!isLast && (
                <div className="flex-1 mx-4 mt-0">
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className={`
                        h-full bg-gradient-to-r from-green-500 to-purple-600 transition-all duration-500
                        ${status === 'completed' ? 'w-full' : 'w-0'}
                      `}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}