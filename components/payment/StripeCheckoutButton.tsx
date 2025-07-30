'use client'

import React, { useState } from 'react';

interface StripeCheckoutButtonProps {
  paymentLinkId: string;
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
  customerName?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export function StripeCheckoutButton({
  paymentLinkId,
  amount,
  currency,
  description,
  customerEmail,
  customerName,
  onSuccess,
  onError,
  className = "cosmic-button-primary w-full"
}: StripeCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);

    try {
      // Create Stripe checkout session
      const response = await fetch('/api/payment/create-stripe-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentLinkId,
          customerEmail,
          customerName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No payment URL received');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      console.error('Stripe checkout error:', error);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={className}
    >
      {loading ? 'Processing...' : `Pay ${amount} ${currency} with Stripe`}
    </button>
  );
}

export default StripeCheckoutButton;