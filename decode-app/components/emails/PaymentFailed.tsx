/**
 * Payment Failed Email Template
 * 
 * This template is sent when a payment fails to process
 */

import React from 'react'

export interface PaymentFailedProps {
  buyerName?: string
  transactionId: string
  amount: number
  currency: string
  serviceTitle: string
  failureReason: string
  retryUrl?: string
  supportEmail: string
  failureDate: string
}

export default function PaymentFailed({
  buyerName,
  transactionId,
  amount,
  currency,
  serviceTitle,
  failureReason,
  retryUrl,
  supportEmail,
  failureDate
}: PaymentFailedProps) {
  const formattedDate = new Date(failureDate).toLocaleDateString('en-US', {
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
        <title>Payment Failed - DECODE</title>
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
            background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
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
              Payment Failed
            </h2>
          </div>

          {/* Content */}
          <div style={{ padding: '40px 30px' }}>
            {/* Error Message */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{
                fontSize: '64px',
                marginBottom: '20px',
                lineHeight: '1'
              }}>
                ❌
              </div>
              <h3 style={{
                margin: '0 0 20px 0',
                fontSize: '24px',
                color: '#333'
              }}>
                {buyerName ? `Sorry, ${buyerName}` : 'We couldn&apos;t process your payment'}
              </h3>
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#f44336',
                margin: '20px 0'
              }}>
                ${amount.toFixed(2)} {currency}
              </div>
              <p style={{
                margin: '0',
                fontSize: '16px',
                color: '#666'
              }}>
                Don&apos;t worry - you have not been charged for this failed payment.
              </p>
            </div>

            {/* Error Details */}
            <div style={{
              backgroundColor: '#ffebee',
              border: '1px solid #f44336',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '30px'
            }}>
              <h4 style={{
                margin: '0 0 15px 0',
                fontSize: '16px',
                color: '#d32f2f',
                fontWeight: '600'
              }}>
                ⚠️ Error Details
              </h4>
              <p style={{
                margin: '0',
                fontSize: '14px',
                color: '#333',
                backgroundColor: '#fff',
                padding: '15px',
                borderRadius: '4px',
                border: '1px solid #ffcdd2'
              }}>
                {failureReason}
              </p>
            </div>

            {/* Payment Details */}
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
                Payment Details
              </h4>
              
              <table style={{ borderCollapse: 'collapse', maxWidth: '400px' }}>
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

                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #eee', 
                    width: '140px', 
                    verticalAlign: 'top',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Amount:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #eee', 
                    verticalAlign: 'top'
                  }}>
                    ${amount.toFixed(2)} {currency}
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
                    Failed on:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #eee', 
                    verticalAlign: 'top'
                  }}>
                    {formattedDate}
                  </td>
                </tr>

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

            {/* Common Solutions */}
            <div style={{
              backgroundColor: '#e8f5e8',
              borderLeft: '4px solid #4CAF50',
              padding: '20px',
              marginBottom: '30px'
            }}>
              <h4 style={{
                margin: '0 0 15px 0',
                fontSize: '16px',
                color: '#2e7d32'
              }}>
                💡 Common Solutions
              </h4>
              <ul style={{
                margin: '0',
                paddingLeft: '20px',
                fontSize: '14px',
                color: '#333'
              }}>
                <li style={{ marginBottom: '8px' }}>Check that your card has sufficient funds</li>
                <li style={{ marginBottom: '8px' }}>Verify your card details are correct</li>
                <li style={{ marginBottom: '8px' }}>Try a different payment method</li>
                <li style={{ marginBottom: '8px' }}>Contact your bank if the issue persists</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              {retryUrl && (
                <a
                  href={retryUrl}
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
                  Try Payment Again
                </a>
              )}
              
              <a
                href={`mailto:${supportEmail}?subject=Payment Failed - ${transactionId}`}
                style={{
                  display: 'inline-block',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  padding: '15px 30px',
                  textDecoration: 'none',
                  borderRadius: '5px',
                  fontWeight: '600',
                  margin: '10px'
                }}
              >
                Contact Support
              </a>
            </div>

            {/* Support Information */}
            <div style={{
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <p style={{
                margin: '0 0 10px 0',
                fontSize: '14px',
                color: '#333',
                fontWeight: '600'
              }}>
                Need Help?
              </p>
              <p style={{
                margin: '0 0 15px 0',
                fontSize: '14px',
                color: '#666'
              }}>
                Our support team is here to help with any payment issues.
              </p>
              <div style={{
                fontSize: '14px',
                color: '#666'
              }}>
                <p style={{ margin: '5px 0' }}>
                  <strong>Email:</strong> {supportEmail}
                </p>
                <p style={{ margin: '5px 0' }}>
                  <strong>Reference:</strong> {transactionId}
                </p>
              </div>
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
              You received this email because a payment attempt was made through our platform.
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}

// Text version for email clients that don't support HTML
export function PaymentFailedText({
  buyerName,
  transactionId,
  amount,
  currency,
  serviceTitle,
  failureReason,
  retryUrl,
  supportEmail,
  failureDate
}: PaymentFailedProps): string {
  const formattedDate = new Date(failureDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return `
DECODE - Payment Failed

${buyerName ? `Sorry, ${buyerName}` : 'We couldn\'t process your payment'}

We couldn't process your payment for ${serviceTitle}.

PAYMENT DETAILS
---------------
Service: ${serviceTitle}
Amount: $${amount.toFixed(2)} ${currency}
Failed on: ${formattedDate}
Transaction ID: ${transactionId}

ERROR DETAILS
${failureReason}

Don't worry - you have not been charged for this failed payment.

COMMON SOLUTIONS
- Check that your card has sufficient funds
- Verify your card details are correct
- Try a different payment method
- Contact your bank if the issue persists

${retryUrl ? `Try payment again: ${retryUrl}` : ''}

NEED HELP?
Our support team is here to help with any payment issues.
Email: ${supportEmail}
Reference: ${transactionId}

---
DECODE Beauty Platform
You received this email because a payment attempt was made through our platform.
`.trim()
}