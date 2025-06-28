/**
 * Payment Receipt Email Template
 * 
 * Detailed receipt for completed payments
 */

import React from 'react'

export interface PaymentReceiptProps {
  buyerName?: string
  buyerEmail: string
  transactionId: string
  amount: number
  currency: string
  serviceTitle: string
  serviceDescription?: string
  creatorName: string
  creatorBusinessInfo?: {
    name: string
    address?: string
    taxId?: string
    website?: string
  }
  paymentMethod: string
  transactionDate: string
  fees?: {
    processing: number
    platform: number
  }
  receiptNumber: string
}

export default function PaymentReceipt({
  buyerName,
  buyerEmail,
  transactionId,
  amount,
  currency,
  serviceTitle,
  serviceDescription,
  creatorName,
  creatorBusinessInfo,
  paymentMethod,
  transactionDate,
  fees,
  receiptNumber
}: PaymentReceiptProps) {
  const formattedDate = new Date(transactionDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const subtotal = amount
  const processingFee = fees?.processing || 0
  const platformFee = fees?.platform || 0
  const total = subtotal + processingFee + platformFee

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Payment Receipt - DECODE</title>
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
              Payment Receipt
            </h2>
          </div>

          {/* Content */}
          <div style={{ padding: '40px 30px' }}>
            {/* Receipt Header */}
            <div style={{
              backgroundColor: '#f8f9fa',
              border: '2px solid #e9ecef',
              borderRadius: '8px',
              padding: '30px',
              marginBottom: '30px',
              textAlign: 'center'
            }}>
              <h3 style={{
                margin: '0 0 20px 0',
                fontSize: '24px',
                color: '#333'
              }}>
                Official Receipt
              </h3>
              <table style={{ borderCollapse: 'collapse', maxWidth: '400px' }}>
                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #e9ecef', 
                    width: '140px', 
                    verticalAlign: 'top',
                    fontWeight: '600'
                  }}>
                    Receipt Number:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #e9ecef', 
                    verticalAlign: 'top',
                    fontFamily: 'monospace'
                  }}>
                    {receiptNumber}
                  </td>
                </tr>
                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    width: '140px', 
                    verticalAlign: 'top',
                    fontWeight: '600'
                  }}>
                    Date:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    verticalAlign: 'top'
                  }}>
                    {formattedDate}
                  </td>
                </tr>
              </table>
            </div>

            {/* Customer Information */}
            <div style={{
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              padding: '25px',
              marginBottom: '30px'
            }}>
              <h4 style={{
                margin: '0 0 20px 0',
                fontSize: '18px',
                color: '#333',
                borderBottom: '2px solid #e9ecef',
                paddingBottom: '10px'
              }}>
                Customer Information
              </h4>
              <table style={{ borderCollapse: 'collapse', maxWidth: '350px' }}>
                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #e9ecef', 
                    width: '100px', 
                    verticalAlign: 'top',
                    fontWeight: '600'
                  }}>
                    Name:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #e9ecef', 
                    verticalAlign: 'top'
                  }}>
                    {buyerName || 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    width: '100px', 
                    verticalAlign: 'top',
                    fontWeight: '600'
                  }}>
                    Email:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    verticalAlign: 'top'
                  }}>
                    {buyerEmail}
                  </td>
                </tr>
              </table>
            </div>

            {/* Service Details */}
            <div style={{
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              padding: '25px',
              marginBottom: '30px'
            }}>
              <h4 style={{
                margin: '0 0 20px 0',
                fontSize: '18px',
                color: '#333',
                borderBottom: '2px solid #e9ecef',
                paddingBottom: '10px'
              }}>
                Service Details
              </h4>
              
              <table style={{ borderCollapse: 'collapse', maxWidth: '450px' }}>
                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #e9ecef', 
                    width: '120px', 
                    verticalAlign: 'top',
                    fontWeight: '600'
                  }}>
                    Service:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #e9ecef', 
                    verticalAlign: 'top'
                  }}>
                    {serviceTitle}
                  </td>
                </tr>

                {serviceDescription && (
                  <tr>
                    <td style={{ 
                      padding: '8px 0', 
                      borderBottom: '1px solid #e9ecef', 
                      width: '120px', 
                      verticalAlign: 'top',
                      fontWeight: '600'
                    }}>
                      Description:
                    </td>
                    <td style={{ 
                      padding: '8px 0', 
                      borderBottom: '1px solid #e9ecef', 
                      verticalAlign: 'top'
                    }}>
                      {serviceDescription}
                    </td>
                  </tr>
                )}

                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    width: '120px', 
                    verticalAlign: 'top',
                    fontWeight: '600'
                  }}>
                    Provider:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    verticalAlign: 'top'
                  }}>
                    {creatorName}
                  </td>
                </tr>
              </table>
            </div>

            {/* Payment Summary */}
            <div style={{
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              padding: '25px',
              marginBottom: '30px'
            }}>
              <h4 style={{
                margin: '0 0 20px 0',
                fontSize: '18px',
                color: '#333',
                borderBottom: '2px solid #e9ecef',
                paddingBottom: '10px'
              }}>
                Payment Summary
              </h4>
              
              <table style={{ borderCollapse: 'collapse', maxWidth: '350px' }}>
                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #e9ecef', 
                    width: '140px', 
                    verticalAlign: 'top'
                  }}>
                    Service Amount:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #e9ecef', 
                    verticalAlign: 'top',
                    textAlign: 'right'
                  }}>
                    ${subtotal.toFixed(2)}
                  </td>
                </tr>

                {processingFee > 0 && (
                  <tr>
                    <td style={{ 
                      padding: '8px 0', 
                      borderBottom: '1px solid #e9ecef', 
                      width: '140px', 
                      verticalAlign: 'top',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      Processing Fee:
                    </td>
                    <td style={{ 
                      padding: '8px 0', 
                      borderBottom: '1px solid #e9ecef', 
                      verticalAlign: 'top',
                      textAlign: 'right',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      ${processingFee.toFixed(2)}
                    </td>
                  </tr>
                )}

                {platformFee > 0 && (
                  <tr>
                    <td style={{ 
                      padding: '8px 0', 
                      borderBottom: '1px solid #e9ecef', 
                      width: '140px', 
                      verticalAlign: 'top',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      Platform Fee:
                    </td>
                    <td style={{ 
                      padding: '8px 0', 
                      borderBottom: '1px solid #e9ecef', 
                      verticalAlign: 'top',
                      textAlign: 'right',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      ${platformFee.toFixed(2)}
                    </td>
                  </tr>
                )}

                <tr>
                  <td colSpan={2} style={{ padding: '15px 0' }}>
                    <hr style={{
                      border: 'none',
                      borderTop: '2px solid #e9ecef',
                      margin: '0'
                    }} />
                  </td>
                </tr>

                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    width: '140px', 
                    verticalAlign: 'top',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    Total Paid:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    verticalAlign: 'top',
                    textAlign: 'right',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#333'
                  }}>
                    ${total.toFixed(2)} {currency}
                  </td>
                </tr>
              </table>
            </div>

            {/* Payment Information */}
            <div style={{
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              padding: '25px',
              marginBottom: '30px'
            }}>
              <h4 style={{
                margin: '0 0 20px 0',
                fontSize: '18px',
                color: '#333',
                borderBottom: '2px solid #e9ecef',
                paddingBottom: '10px'
              }}>
                Payment Information
              </h4>
              
              <table style={{ borderCollapse: 'collapse', maxWidth: '450px' }}>
                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #e9ecef', 
                    width: '140px', 
                    verticalAlign: 'top',
                    fontWeight: '600'
                  }}>
                    Transaction ID:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #e9ecef', 
                    verticalAlign: 'top',
                    fontFamily: 'monospace', 
                    fontSize: '14px'
                  }}>
                    {transactionId}
                  </td>
                </tr>

                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #e9ecef', 
                    width: '140px', 
                    verticalAlign: 'top',
                    fontWeight: '600'
                  }}>
                    Payment Method:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    borderBottom: '1px solid #e9ecef', 
                    verticalAlign: 'top'
                  }}>
                    {paymentMethod}
                  </td>
                </tr>

                <tr>
                  <td style={{ 
                    padding: '8px 0', 
                    width: '140px', 
                    verticalAlign: 'top',
                    fontWeight: '600'
                  }}>
                    Status:
                  </td>
                  <td style={{ 
                    padding: '8px 0', 
                    verticalAlign: 'top',
                    color: '#4CAF50', 
                    fontWeight: '600'
                  }}>
                    ✅ Completed
                  </td>
                </tr>
              </table>
            </div>

            {/* Service Provider Information */}
            {creatorBusinessInfo && (
              <div style={{
                backgroundColor: '#f9f9f9',
                borderRadius: '8px',
                padding: '25px',
                marginBottom: '30px'
              }}>
                <h4 style={{
                  margin: '0 0 20px 0',
                  fontSize: '18px',
                  color: '#333',
                  borderBottom: '2px solid #e9ecef',
                  paddingBottom: '10px'
                }}>
                  Service Provider
                </h4>
                
                <div style={{ marginBottom: '10px' }}>
                  <strong>{creatorBusinessInfo.name}</strong>
                </div>
                
                {creatorBusinessInfo.address && (
                  <div style={{ marginBottom: '10px', fontSize: '14px' }}>
                    {creatorBusinessInfo.address}
                  </div>
                )}
                
                {creatorBusinessInfo.website && (
                  <div style={{ marginBottom: '10px', fontSize: '14px' }}>
                    Website: <a href={creatorBusinessInfo.website}>{creatorBusinessInfo.website}</a>
                  </div>
                )}
                
                {creatorBusinessInfo.taxId && (
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    Tax ID: {creatorBusinessInfo.taxId}
                  </div>
                )}
              </div>
            )}

            {/* Important Notes */}
            <div style={{
              backgroundColor: '#e3f2fd',
              borderLeft: '4px solid #2196F3',
              padding: '20px',
              marginBottom: '30px'
            }}>
              <p style={{
                margin: '0',
                fontSize: '14px',
                color: '#333'
              }}>
                <strong>Please keep this receipt for your records.</strong><br />
                This serves as proof of payment and may be required for warranty claims or service inquiries.
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
              This receipt was generated by DECODE Beauty Platform
            </p>
            <p style={{
              margin: '0 0 15px 0',
              fontSize: '12px',
              color: '#999'
            }}>
              For support inquiries, please reference transaction ID: {transactionId}
            </p>
            <div style={{
              fontSize: '12px',
              color: '#999'
            }}>
              Receipt generated on {new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

// Text version for email clients that don't support HTML
export function PaymentReceiptText({
  buyerName,
  buyerEmail,
  transactionId,
  amount,
  currency,
  serviceTitle,
  serviceDescription,
  creatorName,
  creatorBusinessInfo,
  paymentMethod,
  transactionDate,
  fees,
  receiptNumber
}: PaymentReceiptProps): string {
  const formattedDate = new Date(transactionDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const subtotal = amount
  const processingFee = fees?.processing || 0
  const platformFee = fees?.platform || 0
  const total = subtotal + processingFee + platformFee

  return `
DECODE - Payment Receipt

OFFICIAL RECEIPT
================
Receipt Number: ${receiptNumber}
Date: ${formattedDate}

CUSTOMER INFORMATION
-------------------
Name: ${buyerName || 'N/A'}
Email: ${buyerEmail}

SERVICE DETAILS
---------------
Service: ${serviceTitle}
${serviceDescription ? `Description: ${serviceDescription}` : ''}
Provider: ${creatorName}

PAYMENT SUMMARY
---------------
Service Amount: $${subtotal.toFixed(2)}
${processingFee > 0 ? `Processing Fee: $${processingFee.toFixed(2)}` : ''}
${platformFee > 0 ? `Platform Fee: $${platformFee.toFixed(2)}` : ''}
---------------------------------
Total Paid: $${total.toFixed(2)} ${currency}

PAYMENT INFORMATION
-------------------
Transaction ID: ${transactionId}
Payment Method: ${paymentMethod}
Status: ✅ Completed

${creatorBusinessInfo ? `
SERVICE PROVIDER
----------------
${creatorBusinessInfo.name}
${creatorBusinessInfo.address || ''}
${creatorBusinessInfo.website ? `Website: ${creatorBusinessInfo.website}` : ''}
${creatorBusinessInfo.taxId ? `Tax ID: ${creatorBusinessInfo.taxId}` : ''}
` : ''}

IMPORTANT: Please keep this receipt for your records.
This serves as proof of payment and may be required for warranty claims or service inquiries.

---
DECODE Beauty Platform
For support inquiries, please reference transaction ID: ${transactionId}
Receipt generated on ${new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}
`.trim()
}