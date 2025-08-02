'use client'

import React, { useState, useEffect } from 'react'
import { SplitTemplate, SplitRecipient, getSplitTemplates, saveSplitTemplate, applySplitTemplate } from '@/lib/payment-splitting'

interface SplitTemplateManagerProps {
  userId: string
  onTemplateSelected?: (template: SplitTemplate) => void
  onTemplateApplied?: (recipients: SplitRecipient[]) => void
  showApplyButton?: boolean
  paymentLinkId?: string
}

export function SplitTemplateManager({
  userId,
  onTemplateSelected,
  onTemplateApplied,
  showApplyButton = false,
  paymentLinkId
}: SplitTemplateManagerProps) {
  const [templates, setTemplates] = useState<SplitTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<SplitTemplate | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDescription, setNewTemplateDescription] = useState('')
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [userId])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const templatesData = await getSplitTemplates(userId)
      setTemplates(templatesData)
    } catch (err) {
      console.error('Error loading templates:', err)
      setError('Failed to load split templates')
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateSelect = (template: SplitTemplate) => {
    setSelectedTemplate(template)
    if (onTemplateSelected) {
      onTemplateSelected(template)
    }
  }

  const handleApplyTemplate = async (template: SplitTemplate) => {
    if (!paymentLinkId) {
      setError('No payment link ID provided')
      return
    }

    try {
      setApplying(true)
      await applySplitTemplate(paymentLinkId, template.id!)
      
      if (onTemplateApplied) {
        onTemplateApplied(template.recipients)
      }
      
      setError('')
    } catch (err) {
      console.error('Error applying template:', err)
      setError('Failed to apply split template')
    } finally {
      setApplying(false)
    }
  }

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      setError('Template name is required')
      return
    }

    try {
      const newTemplate: SplitTemplate = {
        userId,
        templateName: newTemplateName.trim(),
        description: newTemplateDescription.trim() || undefined,
        recipients: [] // Start with empty recipients
      }

      await saveSplitTemplate(newTemplate)
      await loadTemplates()
      
      setNewTemplateName('')
      setNewTemplateDescription('')
      setShowCreateForm(false)
      setError('')
    } catch (err) {
      console.error('Error creating template:', err)
      setError('Failed to create template')
    }
  }

  const formatRecipientDisplay = (recipient: SplitRecipient) => {
    let name = 'Unknown'
    let contact = ''
    
    if (recipient.recipientType === 'platform_fee') {
      name = 'Platform Fee'
      contact = 'DECODE Platform'
    } else if (recipient.recipientName) {
      name = recipient.recipientName
      contact = recipient.recipientEmail || recipient.recipientUserId || ''
    } else if (recipient.recipientEmail) {
      name = recipient.recipientEmail?.split('@')[0] || 'Unknown'
      contact = recipient.recipientEmail
    } else if (recipient.recipientUserId) {
      name = 'Platform User'
      contact = recipient.recipientUserId
    }

    const amount = recipient.splitType === 'percentage' 
      ? `${recipient.splitPercentage}%`
      : `$${recipient.splitAmountFixed}`

    return { name, contact, amount }
  }

  // Loading state removed - show content immediately

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Split Templates</h3>
          <p className="text-sm text-gray-600">Manage reusable payment split configurations</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Template
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Create Template Form */}
      {showCreateForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Create New Template</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Studio Split, Freelancer Fee"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Describe when to use this template..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleCreateTemplate}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
              >
                Create Template
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setNewTemplateName('')
                  setNewTemplateDescription('')
                  setError('')
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates List */}
      {templates.length > 0 ? (
        <div className="space-y-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`bg-white border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                selectedTemplate?.id === template.id
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleTemplateSelect(template)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="text-lg font-semibold text-gray-900">{template.templateName}</h4>
                    {template.isDefault && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  
                  {template.description && (
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  )}

                  {/* Recipients Preview */}
                  {template.recipients.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">
                        Recipients ({template.recipients.length})
                      </p>
                      <div className="space-y-1">
                        {template.recipients.map((recipient, index) => {
                          const { name, contact, amount } = formatRecipientDisplay(recipient)
                          return (
                            <div key={index} className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                <span className="font-medium text-gray-900">{name}</span>
                                {contact && (
                                  <span className="text-gray-500">({contact})</span>
                                )}
                                {recipient.isPrimaryRecipient && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                                    Primary
                                  </span>
                                )}
                              </div>
                              <span className="font-semibold text-purple-600">{amount}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No recipients configured</p>
                  )}
                </div>

                {/* Apply Button */}
                {showApplyButton && paymentLinkId && (
                  <div className="ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleApplyTemplate(template)
                      }}
                      disabled={applying}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {applying ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Applying...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Apply
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Split Templates</h3>
          <p className="text-gray-600 mb-4">
            Create reusable templates to quickly configure payment splits for similar scenarios.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
          >
            Create Your First Template
          </button>
        </div>
      )}

      {/* Selected Template Details */}
      {selectedTemplate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Selected Template</h4>
          <p className="text-sm text-blue-800">
            <span className="font-medium">{selectedTemplate.templateName}</span>
            {selectedTemplate.description && (
              <span> - {selectedTemplate.description}</span>
            )}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            {selectedTemplate.recipients.length} recipient(s) configured
          </p>
        </div>
      )}
    </div>
  )
}

export default SplitTemplateManager