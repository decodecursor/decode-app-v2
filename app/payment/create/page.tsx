'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { SplitRecipientsEditor, SplitTemplateManager } from '@/components/payment-splitting'
import type { SplitRecipient } from '@/lib/payment-splitting'
import { addSplitRecipients, validateSplitRecipients } from '@/lib/payment-splitting'

export default function CreatePayment() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    amount: ''
  })
  const [errors, setErrors] = useState({
    title: '',
    amount: '',
    splits: ''
  })
  const [splitRecipients, setSplitRecipients] = useState<SplitRecipient[]>([])
  const [showSplitSection, setShowSplitSection] = useState(false)
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [currentStep, setCurrentStep] = useState(1) // 1: Basic Info, 2: Splits, 3: Review
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }
      setUser(user)
      setLoading(false)
    }

    getUser()
  }, [router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear errors when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = (step: number = currentStep) => {
    const newErrors = { title: '', amount: '', splits: '' }
    let isValid = true

    // Step 1: Basic Info Validation
    if (step >= 1) {
      if (!formData.title.trim()) {
        newErrors.title = 'Service title is required'
        isValid = false
      }

      if (!formData.amount.trim()) {
        newErrors.amount = 'Amount is required'
        isValid = false
      } else {
        const amount = parseFloat(formData.amount)
        if (isNaN(amount) || amount <= 0) {
          newErrors.amount = 'Please enter a valid amount greater than $0'
          isValid = false
        }
      }
    }

    // Step 2: Split Validation
    if (step >= 2 && splitRecipients.length > 0) {
      try {
        validateSplitRecipients(splitRecipients)
      } catch (error) {
        newErrors.splits = error instanceof Error ? error.message : 'Invalid split configuration'
        isValid = false
      }
    }

    setErrors(newErrors)
    return isValid
  }

  const nextStep = () => {
    if (validateForm(currentStep)) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    setCurrentStep(currentStep - 1)
  }

  const generatePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm(3)) {
      return
    }

    if (!user) {
      setError('User not authenticated')
      return
    }

    setCreating(true)
    setError('')

    try {
      // Calculate expiration date (7 days from now)
      const expirationDate = new Date()
      expirationDate.setDate(expirationDate.getDate() + 7)

      // Save payment link to Supabase
      const { data, error: saveError } = await supabase
        .from('payment_links')
        .insert({
          title: formData.title.trim(),
          description: null,
          amount_usd: parseFloat(formData.amount),
          expiration_date: expirationDate.toISOString(),
          creator_id: user.id,
          is_active: true
        })
        .select()
        .single()

      if (saveError) {
        throw saveError
      }

      // Add split recipients if any are configured
      if (splitRecipients.length > 0) {
        await addSplitRecipients(data.id, splitRecipients)
      }

      console.log('Payment link created successfully:', data)
      setSuccess(true)
      
      // Redirect to My Links page after 2 seconds
      setTimeout(() => {
        router.push('/my-links')
      }, 2000)

    } catch (error) {
      console.error('Error creating payment link:', error)
      setError(error instanceof Error ? error.message : 'Failed to create payment link')
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setFormData({ title: '', amount: '' })
    setErrors({ title: '', amount: '', splits: '' })
    setSplitRecipients([])
    setCurrentStep(1)
    setShowSplitSection(false)
    setShowTemplateManager(false)
    setSuccess(false)
    setError('')
  }

  const handleTemplateApplied = (recipients: SplitRecipient[]) => {
    setSplitRecipients(recipients)
    setShowSplitSection(true)
    setShowTemplateManager(false)
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return 'Basic Information'
      case 2:
        return 'Payment Splitting (Optional)'
      case 3:
        return 'Review & Create'
      default:
        return 'Create Payment Link'
    }
  }

  if (loading) {
    return (
      <div className="cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card text-center">
            <div className="cosmic-body">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen px-4 py-8">
        {/* Back to Dashboard Link */}
        <div className="flex justify-center mb-8">
          <div className="w-full" style={{maxWidth: '70vw'}}>
          <Link href="/dashboard" className="inline-flex items-center text-gray-300 hover:text-white transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex justify-center">
          {!success ? (
            /* Payment Form */
            <div className="cosmic-card">
              {/* Progress Indicator */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                        step === currentStep 
                          ? 'bg-purple-600 text-white' 
                          : step < currentStep 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-300 text-gray-600'
                      }`}>
                        {step < currentStep ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          step
                        )}
                      </div>
                      {step < 3 && (
                        <div className={`w-16 h-1 mx-2 ${
                          step < currentStep ? 'bg-green-600' : 'bg-gray-300'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
                <h1 className="cosmic-heading text-center">{getStepTitle()}</h1>
              </div>

              <form onSubmit={generatePaymentLink} className="space-y-6">
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <label className="cosmic-label block mb-2">Service *</label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        placeholder="e.g., Hair Styling, Makeup Session, Manicure"
                        className={`cosmic-input ${errors.title ? 'border-red-500' : ''}`}
                        disabled={creating}
                      />
                      {errors.title && (
                        <p className="mt-2 text-sm text-red-400">{errors.title}</p>
                      )}
                    </div>


                    <div>
                      <label className="cosmic-label block mb-2">Amount in USD *</label>
                      <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleInputChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className={`cosmic-input text-xl ${errors.amount ? 'border-red-500' : ''}`}
                        disabled={creating}
                      />
                      {errors.amount && (
                        <p className="mt-2 text-sm text-red-400">{errors.amount}</p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={nextStep}
                        className="cosmic-button-primary px-8 py-3"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Payment Splitting */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    {/* Template Manager */}
                    <div className="mb-6">
                      <button
                        type="button"
                        onClick={() => setShowTemplateManager(!showTemplateManager)}
                        className="mb-4 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-white bg-transparent hover:bg-white/10"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {showTemplateManager ? 'Hide Templates' : 'Use Split Template'}
                      </button>

                      {showTemplateManager && user && (
                        <SplitTemplateManager
                          userId={user.id}
                          onTemplateApplied={handleTemplateApplied}
                          showApplyButton={false}
                        />
                      )}
                    </div>

                    {/* Split Recipients Editor */}
                    <SplitRecipientsEditor
                      paymentAmount={parseFloat(formData.amount) || 0}
                      recipients={splitRecipients}
                      onChange={setSplitRecipients}
                      disabled={creating}
                    />

                    {errors.splits && (
                      <div className="text-center p-3 rounded-lg text-sm text-red-300 bg-red-900/20">
                        {errors.splits}
                      </div>
                    )}

                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={prevStep}
                        className="cosmic-button-secondary px-8 py-3"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={nextStep}
                        className="cosmic-button-primary px-8 py-3"
                      >
                        Next: Review
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Review & Create */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    {/* Payment Link Summary */}
                    <div className="bg-black/20 rounded-lg p-6">
                      <h3 className="cosmic-heading mb-4">Payment Link Summary</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="cosmic-label">Service:</span>
                          <span className="cosmic-body font-medium">{formData.title}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="cosmic-label">Amount:</span>
                          <span className="cosmic-body text-2xl font-bold">${formData.amount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="cosmic-label">Recipients:</span>
                          <span className="cosmic-body font-medium">
                            {splitRecipients.length === 0 ? 'You (100%)' : `${splitRecipients.length + 1} recipients`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Split Recipients Summary */}
                    {splitRecipients.length > 0 && (
                      <div className="bg-black/20 rounded-lg p-6">
                        <h3 className="cosmic-heading mb-4">Split Recipients</h3>
                        <div className="space-y-3">
                          {splitRecipients.map((recipient, index) => (
                            <div key={index} className="flex justify-between items-center">
                              <div>
                                <span className="cosmic-body font-medium">
                                  {recipient.recipientName || recipient.recipientEmail || 'Platform User'}
                                </span>
                                {recipient.isPrimaryRecipient && (
                                  <span className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded">Primary</span>
                                )}
                              </div>
                              <span className="cosmic-body">
                                {recipient.splitType === 'percentage' 
                                  ? `${recipient.splitPercentage}%`
                                  : `$${recipient.splitAmountFixed}`
                                }
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="text-center p-3 rounded-lg text-sm text-red-300 bg-red-900/20">
                        {error}
                      </div>
                    )}

                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={prevStep}
                        className="cosmic-button-secondary px-8 py-3"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="cosmic-button-primary px-8 py-4 text-lg font-medium"
                      >
                        {creating ? 'Creating Payment Link...' : 'Create Payment Link'}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          ) : (
            /* Success State */
            <div className="cosmic-card text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h2 className="cosmic-heading mb-2">Payment Link Created!</h2>
                <p className="cosmic-body opacity-80 mb-4">
                  Your payment link has been saved to the database successfully.
                </p>
                <p className="cosmic-body text-purple-400">
                  Redirecting to My Links page...
                </p>
              </div>

              <div className="bg-black/20 rounded-lg p-4 mb-6">
                <div className="cosmic-label mb-2">Payment Details</div>
                <div className="cosmic-body mb-1">Service: <span className="font-medium">{formData.title}</span></div>
                <div className="cosmic-body">Amount: <span className="text-2xl font-medium">${formData.amount}</span></div>
                <div className="cosmic-body text-sm text-gray-400 mt-2">
                  Expires: {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={resetForm}
                  className="cosmic-button-primary flex-1"
                >
                  Create Another Link
                </button>
                <Link href="/my-links" className="cosmic-button-secondary flex-1 text-center py-3 border border-white/30 rounded-lg">
                  Go to My Links
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}