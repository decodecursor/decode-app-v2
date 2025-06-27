/**
 * Payment Confirmation Email Template
 * 
 * This template is designed to work with both React Email and standalone HTML generation
 */

import React from 'react'

export interface PaymentConfirmationProps {
  buyerName?: string
  transactionId: string
  amount: number
  currency: string
  serviceTitle: string
  serviceDescription?: string
  creatorName: string
  paymentMethod?: string
  transactionDate: string
  receiptUrl?: string
}

export default function PaymentConfirmation({
  buyerName,
  transactionId,
  amount,
  currency,
  serviceTitle,
  serviceDescription,
  creatorName,
  paymentMethod,
  transactionDate,
  receiptUrl
}: PaymentConfirmationProps) {
  const formattedDate = new Date(transactionDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Payment Confirmation - DECODE</title>
      </head>
      <body style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        lineHeight: '1.6',
        color: '#333',
        margin: 0,
        padding: 0,
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          backgroundColor: '#ffffff'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #ff1744 0%, #e91e63 100%)',
            color: 'white',
            padding: '40px 30px',
            textAlign: 'center'
          }}>
            <h1 style={{
              margin: '0 0 10px 0',
              fontSize: '28px',
              fontWeight: '300',
              letterSpacing: '2px'
            }}>
              DECODE
            </h1>
            <h2 style={{
              margin: '0',
              fontSize: '24px',
              fontWeight: '400'
            }}>
              Payment Confirmed!
            </h2>
          </div>

          {/* Content */}
          <div style={{ padding: '40px 30px' }}>
            {/* Success Message */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{
                fontSize: '64px',
                marginBottom: '20px',
                lineHeight: '1'
              }}>
                ✅
              </div>
              <h3 style={{
                margin: '0 0 20px 0',
                fontSize: '24px',
                color: '#333'
              }}>
                {buyerName ? `Thank you, ${buyerName}!` : 'Thank you for your payment!'}
              </h3>
              <div style={{
                fontSize: '36px',
                fontWeight: 'bold',
                color: '#4CAF50',
                margin: '20px 0'
              }}>
                ${amount.toFixed(2)} {currency}
              </div>
              <p style={{
                margin: '0',
                fontSize: '16px',
                color: '#666'
              }}>
                Your payment has been successfully processed.
              </p>
            </div>

            {/* Service Details */}
            <div style={{
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              padding: '30px',
              marginBottom: '30px'
            }}>
              <h4 style={{
                margin: '0 0 20px 0',
                fontSize: '18px',
                color: '#333'
              }}>
                Service Details
              </h4>
              
              <table style={{ borderCollapse: 'collapse', maxWidth: '450px' }}>
                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #eee', 
                    width: '140px', 
                    verticalAlign: 'top',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Service:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #eee', 
                    verticalAlign: 'top'
                  }}>
                    {serviceTitle}
                  </td>
                </tr>

                {serviceDescription && (
                  <tr>
                    <td style={{ 
                      padding: '8px 0', 
                      borderBottom: '1px solid #eee', 
                      width: '140px', 
                      verticalAlign: 'top',
                      fontWeight: '600',
                      color: '#333'
                    }}>
                      Description:
                    </td>
                    <td style={{ 
                      padding: '8px 0', 
                      borderBottom: '1px solid #eee', 
                      verticalAlign: 'top'
                    }}>
                      {serviceDescription}
                    </td>
                  </tr>
                )}

                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #eee', 
                    width: '140px', 
                    verticalAlign: 'top',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Provider:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #eee', 
                    verticalAlign: 'top'
                  }}>
                    {creatorName}
                  </td>
                </tr>

                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #eee', 
                    width: '140px', 
                    verticalAlign: 'top',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Date:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #eee', 
                    verticalAlign: 'top'
                  }}>
                    {formattedDate}
                  </td>
                </tr>

                {paymentMethod && (
                  <tr>
                    <td style={{ 
                      padding: '8px 0', 
                      borderBottom: '1px solid #eee', 
                      width: '140px', 
                      verticalAlign: 'top',
                      fontWeight: '600',
                      color: '#333'
                    }}>
                      Payment Method:
                    </td>
                    <td style={{ 
                      padding: '8px 0', 
                      borderBottom: '1px solid #eee', 
                      verticalAlign: 'top'
                    }}>
                      {paymentMethod}
                    </td>
                  </tr>
                )}

                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    width: '140px', 
                    verticalAlign: 'top',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Transaction ID:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    verticalAlign: 'top',
                    fontFamily: 'monospace', 
                    fontSize: '14px'
                  }}>
                    {transactionId}
                  </td>
                </tr>
              </table>
            </div>

            {/* Next Steps */}
            <div style={{
              backgroundColor: '#e3f2fd',
              borderLeft: '4px solid #2196F3',
              padding: '20px',
              marginBottom: '30px'
            }}>
              <p style={{
                margin: '0',
                fontSize: '16px',
                color: '#333'
              }}>
                <strong>What&apos;s next?</strong><br />
                You will receive your service details from {creatorName} soon. 
                They will contact you directly to coordinate the service delivery.
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              {receiptUrl && (
                <a
                  href={receiptUrl}
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#ff1744',
                    color: 'white',
                    padding: '15px 30px',
                    textDecoration: 'none',
                    borderRadius: '5px',
                    fontWeight: '600',
                    margin: '10px'
                  }}
                >
                  View Detailed Receipt
                </a>
              )}
            </div>

            {/* Support */}
            <div style={{
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <p style={{
                margin: '0',
                fontSize: '14px',
                color: '#666'
              }}>
                Questions about your payment? Contact us with your transaction ID: {transactionId}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '30px',
            textAlign: 'center',
            borderTop: '1px solid #eee'
          }}>
            <p style={{
              margin: '0 0 10px 0',
              fontSize: '14px',
              color: '#666'
            }}>
              This email was sent by DECODE Beauty Platform
            </p>
            <p style={{
              margin: '0',
              fontSize: '12px',
              color: '#999'
            }}>
              You received this email because you made a payment through our platform.
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}

// Text version for email clients that don't support HTML
export function PaymentConfirmationText({
  buyerName,
  transactionId,
  amount,
  currency,
  serviceTitle,
  serviceDescription,
  creatorName,
  paymentMethod,
  transactionDate,
  receiptUrl
}: PaymentConfirmationProps): string {
  const formattedDate = new Date(transactionDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return `
DECODE - Payment Confirmed!

${buyerName ? `Thank you, ${buyerName}!` : 'Thank you for your payment!'}

PAYMENT AMOUNT: $${amount.toFixed(2)} ${currency}

Your payment has been successfully processed.

SERVICE DETAILS
---------------
Service: ${serviceTitle}
${serviceDescription ? `Description: ${serviceDescription}` : ''}
Provider: ${creatorName}
Date: ${formattedDate}
${paymentMethod ? `Payment Method: ${paymentMethod}` : ''}
Transaction ID: ${transactionId}

WHAT'S NEXT?
You will receive your service details from ${creatorName} soon. 
They will contact you directly to coordinate the service delivery.

${receiptUrl ? `View Detailed Receipt: ${receiptUrl}` : ''}

Questions about your payment? Contact us with your transaction ID: ${transactionId}

---
DECODE Beauty Platform
You received this email because you made a payment through our platform.
`.trim()
}