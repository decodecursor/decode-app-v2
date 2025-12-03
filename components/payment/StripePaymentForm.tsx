'use client'

import React, { useState } from 'react';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe-client';

interface StripePaymentFormProps {
  paymentLinkId: string;
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
  customerName?: string;
  onSuccess?: (sessionId: string) => void;
  onError?: (error: string) => void;
}

interface PaymentFormProps extends StripePaymentFormProps {
  clientSecret?: string;
}

// Card element styling
const cardElementOptions = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
      fontFamily: 'Inter, sans-serif',
      backgroundColor: 'transparent',
    },
    invalid: {
      color: '#9e2146',
    },
  },
  hidePostalCode: true,
};

function PaymentForm({ 
  paymentLinkId, 
  amount, 
  currency, 
  description, 
  customerEmail, 
  customerName,
  onSuccess, 
  onError 
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create payment session
      const sessionResponse = await fetch('/api/payment/create-stripe-session', {
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

      const sessionData = await sessionResponse.json();

      if (!sessionResponse.ok) {
        throw new Error(sessionData.error || 'Failed to create payment session');
      }

      // Redirect to Stripe Checkout
      if (sessionData.url) {
        window.location.href = sessionData.url;
      } else {
        throw new Error('No payment URL received');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Details */}
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">Payment Details</h3>
        <p className="text-2xl font-bold text-white">
          {amount} {currency}
        </p>
        <p className="text-sm text-gray-300 mt-1">{description}</p>
      </div>

      {/* Customer Information */}
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={customerEmail || ''}
            onChange={() => {}} // Controlled by parent component
            className="cosmic-input"
            placeholder="your@email.com"
            required
          />
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
            Full Name
          </label>
          <input
            type="text"
            id="name"
            value={customerName || ''}
            onChange={() => {}} // Controlled by parent component
            className="cosmic-input"
            placeholder="John Doe"
            required
          />
        </div>
      </div>

      {/* Card Information */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Card Information
        </label>
        <div className="cosmic-input p-3">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="text-red-300 bg-red-900/20 p-3 rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="cosmic-button-primary w-full"
      >
        {loading ? 'Processing...' : `Pay ${amount} ${currency}`}
      </button>

      {/* Stripe Branding */}
      <div className="text-center text-xs text-gray-400">
        Powered by Stripe
      </div>
    </form>
  );
}

export function StripePaymentForm(props: StripePaymentFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm {...props} />
    </Elements>
  );
}

export default StripePaymentForm;