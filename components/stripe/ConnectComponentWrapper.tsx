'use client'

import { useEffect } from 'react'

interface ConnectComponentWrapperProps {
  children: React.ReactNode
  title?: string
  description?: string
}

export function ConnectComponentWrapper({ 
  children, 
  title,
  description 
}: ConnectComponentWrapperProps) {
  useEffect(() => {
    // Apply custom styles to Stripe Connect components after they mount
    const applyCustomStyles = () => {
      const style = document.createElement('style')
      style.textContent = `
        /* Stripe Connect Component Custom Styles */
        
        /* Background and containers */
        .StripeElement,
        .StripeConnectElement {
          background-color: transparent !important;
        }
        
        /* Input fields */
        .StripeElement input,
        .StripeConnectElement input,
        .StripeElement select,
        .StripeConnectElement select {
          background-color: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          color: #ffffff !important;
          border-radius: 8px !important;
          padding: 12px !important;
          font-size: 14px !important;
          transition: all 0.2s ease !important;
        }
        
        /* Input focus states */
        .StripeElement input:focus,
        .StripeConnectElement input:focus,
        .StripeElement select:focus,
        .StripeConnectElement select:focus {
          border-color: #7C3AED !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1) !important;
          background-color: rgba(255, 255, 255, 0.08) !important;
        }
        
        /* Labels */
        .StripeElement label,
        .StripeConnectElement label {
          color: #e5e7eb !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          margin-bottom: 6px !important;
        }
        
        /* Buttons */
        .StripeElement button,
        .StripeConnectElement button {
          background: linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%) !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 12px 24px !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }
        
        .StripeElement button:hover,
        .StripeConnectElement button:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 20px rgba(124, 58, 237, 0.3) !important;
        }
        
        /* Secondary buttons */
        .StripeElement button[type="button"],
        .StripeConnectElement button[type="button"] {
          background: rgba(255, 255, 255, 0.1) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
        
        /* Error messages */
        .StripeElement .error,
        .StripeConnectElement .error,
        .StripeElement [role="alert"],
        .StripeConnectElement [role="alert"] {
          color: #ef4444 !important;
          background-color: rgba(239, 68, 68, 0.1) !important;
          border: 1px solid rgba(239, 68, 68, 0.3) !important;
          border-radius: 6px !important;
          padding: 8px 12px !important;
          font-size: 13px !important;
        }
        
        /* Success messages */
        .StripeElement .success,
        .StripeConnectElement .success {
          color: #10b981 !important;
          background-color: rgba(16, 185, 129, 0.1) !important;
          border: 1px solid rgba(16, 185, 129, 0.3) !important;
          border-radius: 6px !important;
          padding: 8px 12px !important;
        }
        
        /* Links */
        .StripeElement a,
        .StripeConnectElement a {
          color: #7C3AED !important;
          text-decoration: none !important;
          transition: color 0.2s ease !important;
        }
        
        .StripeElement a:hover,
        .StripeConnectElement a:hover {
          color: #6D28D9 !important;
          text-decoration: underline !important;
        }
        
        /* Progress indicators */
        .StripeElement [role="progressbar"],
        .StripeConnectElement [role="progressbar"] {
          background-color: rgba(124, 58, 237, 0.2) !important;
        }
        
        .StripeElement [role="progressbar"] > div,
        .StripeConnectElement [role="progressbar"] > div {
          background-color: #7C3AED !important;
        }
        
        /* Card containers */
        .StripeElement > div,
        .StripeConnectElement > div {
          background-color: transparent !important;
          border-radius: 12px !important;
        }
        
        /* Form sections */
        .StripeElement fieldset,
        .StripeConnectElement fieldset {
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 8px !important;
          padding: 16px !important;
          margin-bottom: 16px !important;
        }
        
        /* Checkboxes and radio buttons */
        .StripeElement input[type="checkbox"],
        .StripeConnectElement input[type="checkbox"],
        .StripeElement input[type="radio"],
        .StripeConnectElement input[type="radio"] {
          accent-color: #7C3AED !important;
        }
        
        /* Notification banner specific */
        .NotificationBanner {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%) !important;
          border: 1px solid rgba(239, 68, 68, 0.3) !important;
          border-radius: 8px !important;
          color: #fbbf24 !important;
        }
        
        /* Account management specific */
        .AccountManagement .section-header {
          color: #ffffff !important;
          font-weight: 600 !important;
          margin-bottom: 12px !important;
        }
        
        /* Loading states */
        .StripeElement .loading,
        .StripeConnectElement .loading {
          color: #9ca3af !important;
        }
        
        /* Disabled states */
        .StripeElement input:disabled,
        .StripeConnectElement input:disabled,
        .StripeElement select:disabled,
        .StripeConnectElement select:disabled {
          background-color: rgba(255, 255, 255, 0.02) !important;
          color: #6b7280 !important;
          cursor: not-allowed !important;
        }
      `
      document.head.appendChild(style)
      
      return () => {
        document.head.removeChild(style)
      }
    }
    
    // Apply styles after a short delay to ensure Stripe components are mounted
    const timeout = setTimeout(applyCustomStyles, 100)
    
    return () => clearTimeout(timeout)
  }, [])
  
  return (
    <div className="cosmic-card">
      {title && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {description && (
            <p className="text-gray-400 text-sm mt-2">{description}</p>
          )}
        </div>
      )}
      <div className="stripe-connect-wrapper">
        {children}
      </div>
    </div>
  )
}