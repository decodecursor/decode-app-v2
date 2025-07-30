'use client'

import { useState, useEffect } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

interface CustomPaymentFormProps {
  paymentLinkId: string;
  amount: number;
  currency: string;
  description: string;
  beautyProfessionalName: string;
  customerName?: string;
  customerEmail?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface PaymentFormProps extends CustomPaymentFormProps {
  clientSecret: string;
}

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function PaymentForm({ 
  paymentLinkId,
  amount,
  currency,
  description,
  beautyProfessionalName,
  customerName = '',
  customerEmail = '',
  clientSecret,
  onSuccess,
  onError
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState({
    name: customerName,
    email: customerEmail
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/pay/success?paymentLinkId=${paymentLinkId}`,
          payment_method_data: {
            billing_details: {
              email: clientInfo.email,
            },
          },
        },
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cosmic-bg min-h-screen flex items-center justify-center px-4 py-8">
      <div className="cosmic-card-login max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src="/logo.png" 
            alt="DECODE" 
            className="mx-auto mb-2" 
            style={{height: '40px', filter: 'brightness(0) invert(1)'}} 
          />
          <p className="!text-xs cosmic-body opacity-70">Making Girls More Beautiful</p>
        </div>

        {/* Payment Information */}
        <div className="space-y-6 mb-8">
          <div className="text-center space-y-2">
            <div className="cosmic-body text-lg font-medium text-white">
              {beautyProfessionalName}
            </div>
            <div className="cosmic-body text-white opacity-80">
              {customerName || 'Client Name'}
            </div>
            <div className="cosmic-body text-white opacity-80">
              {description}
            </div>
            <div className="cosmic-body text-2xl font-bold text-white mt-4">
              {currency} {amount.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Client Information Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Email Address"
                value={clientInfo.email}
                onChange={(e) => setClientInfo(prev => ({ ...prev, email: e.target.value }))}
                className="cosmic-input"
                required
              />
            </div>
          </div>

          {/* Payment Element */}
          <div className="space-y-4">
            <div className="cosmic-input p-0 overflow-hidden">
              <PaymentElement 
                options={{
                  layout: 'tabs',
                  paymentMethodOrder: ['apple_pay', 'google_pay', 'card'],
                  wallets: {
                    applePay: 'always',
                    googlePay: 'always'
                  },
                  fields: {
                    billingDetails: {
                      email: 'auto'
                    }
                  }
                }} 
              />
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
            {loading ? 'Processing...' : `Pay ${currency} ${amount.toFixed(2)}`}
          </button>
        </form>
      </div>
    </div>
  );
}

export function CustomPaymentForm(props: CustomPaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realClientName, setRealClientName] = useState<string | null>(null);

  useEffect(() => {
    // Create payment intent when component mounts
    const createPaymentIntent = async () => {
      try {
        console.log('🔍 DEBUG: Creating payment intent for:', props.paymentLinkId);
        
        // Create payment intent directly (skip the stripe session API)
        const intentResponse = await fetch('/api/payment/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentLinkId: props.paymentLinkId,
            amount: Math.round(props.amount * 100), // Convert AED to cents for Stripe
            currency: 'usd', // Stripe processes in USD (converted from AED)
            customerEmail: props.customerEmail,
            customerName: props.customerName,
          }),
        });

        const intentData = await intentResponse.json();
        
        console.log('🔍 DEBUG: Payment intent response:', intentData);
        
        if (!intentResponse.ok) {
          console.error('❌ DEBUG: Payment intent failed:', intentData);
          throw new Error(intentData.error || 'Failed to create payment intent');
        }

        setClientSecret(intentData.clientSecret);
        
        // Extract the real client name from the payment details
        if (intentData.paymentDetails?.clientName) {
          setRealClientName(intentData.paymentDetails.clientName);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize payment';
        setError(errorMessage);
        props.onError?.(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [props.paymentLinkId]);

  if (loading) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center px-4">
        <div className="cosmic-card-login max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="cosmic-body text-white">Preparing payment...</p>
        </div>
      </div>
    );
  }

  if (error || !clientSecret) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center px-4">
        <div className="cosmic-card-login max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Payment Error</h1>
          <p className="cosmic-body text-white opacity-80">{error || 'Unable to initialize payment'}</p>
        </div>
      </div>
    );
  }

  const stripeOptions: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#7C3AED',
        colorBackground: 'rgba(255, 255, 255, 0.1)',
        colorText: '#ffffff',
        colorDanger: '#ef4444',
        fontFamily: 'Inter, sans-serif',
        borderRadius: '8px',
      },
      rules: {
        '.Input': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          color: '#ffffff',
        },
        '.Input:focus': {
          border: '1px solid rgba(255, 255, 255, 0.6)',
          boxShadow: 'none',
        },
        '.Label': {
          color: '#ffffff',
          fontSize: '14px',
        },
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={stripeOptions}>
      <PaymentForm {...props} clientSecret={clientSecret} customerName={realClientName || props.customerName} />
    </Elements>
  );
}

export default CustomPaymentForm;