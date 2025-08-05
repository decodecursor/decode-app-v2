'use client'

import { useState, useEffect } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
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
          return_url: `${window.location.origin}/pay/success?id=${paymentLinkId}&amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}&clientName=${encodeURIComponent(customerName || '')}&timestamp=${Date.now()}`,
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
    <div className="cosmic-bg min-h-screen flex items-center justify-center px-4 py-2">
      <div className="cosmic-card-login max-w-6xl md:max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-7">
          <img 
            src="/logo.png" 
            alt="DECODE" 
            className="mx-auto mb-2" 
            style={{height: '38px', filter: 'brightness(0) invert(1)'}} 
          />
          <p className="cosmic-body opacity-70" style={{ fontSize: '0.95rem', marginTop: '-4px' }}>Make Girls More Beautiful</p>
        </div>

        {/* Payment Information */}
        <div className="bg-black rounded-lg p-6 mb-6">
          <div className="text-center space-y-1">
            <div className="cosmic-body text-base text-white">
              Service by {beautyProfessionalName}
            </div>
            <div className="cosmic-body text-sm font-bold text-white">
              {customerName || 'Client Name'}
            </div>
            <div className="cosmic-body text-sm text-white">
              {description}
            </div>
            <div className="cosmic-body text-2xl font-bold text-white mt-2">
              {currency} {amount.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Only render payment elements when clientSecret is ready */}
        {clientSecret ? (
          <>
            {/* Express Checkout (Apple Pay, Google Pay) */}
            <div className="mb-4 express-checkout-expanded">
              <div className="cosmic-input express-checkout-no-border" style={{ minHeight: 'auto' }}>
                <ExpressCheckoutElement
                  options={{
                    paymentMethods: {
                      applePay: 'always',
                      googlePay: 'always'
                    },
                    buttonTheme: {
                      applePay: 'white-outline',
                      googlePay: 'white'
                    },
                    buttonType: {
                      googlePay: 'plain'
                    },
                    paymentMethodOrder: ['applePay', 'googlePay']
                  }}
              onReady={(event) => {
                console.log('🍎 DEBUG: Express Checkout ready event:', event);
                console.log('🍎 DEBUG: Available payment methods:', event.availablePaymentMethods);
                
                // Function to force vertical layout
                const forceVerticalLayout = () => {
                  // Check if we're on mobile
                  const isMobile = window.innerWidth <= 768;
                  if (!isMobile) return;
                  
                  // Find all possible containers and buttons
                  const expressCheckout = document.querySelector('.express-checkout-expanded');
                  if (expressCheckout) {
                    // Get all divs and buttons within express checkout
                    const allDivs = expressCheckout.querySelectorAll('div');
                    const allButtons = expressCheckout.querySelectorAll('button');
                    
                    // Force vertical layout on all divs
                    allDivs.forEach((div) => {
                      if (div.style.display === 'flex' || getComputedStyle(div).display === 'flex') {
                        div.style.cssText += 'flex-direction: column !important; width: 100% !important;';
                      }
                    });
                    
                    // Force full width on all buttons
                    allButtons.forEach((button) => {
                      button.style.cssText += 'width: 100% !important; max-width: 100% !important; margin-bottom: 8px !important; display: block !important;';
                    });
                    
                    // Remove margin from last button
                    if (allButtons.length > 0) {
                      allButtons[allButtons.length - 1].style.marginBottom = '0';
                    }
                  }
                };
                
                // Auto-click Show More button and force layout
                setTimeout(() => {
                  const showMoreButton = document.querySelector('button[aria-label*="Show more"], button[aria-label*="show more"], [class*="ShowMore"]') as HTMLButtonElement;
                  if (showMoreButton) {
                    console.log('🔄 Auto-clicking Show More button');
                    showMoreButton.click();
                  }
                  
                  // Force vertical layout after Stripe renders
                  forceVerticalLayout();
                  
                  // Set up MutationObserver to maintain layout
                  const observer = new MutationObserver(() => {
                    forceVerticalLayout();
                  });
                  
                  const expressCheckout = document.querySelector('.express-checkout-expanded');
                  if (expressCheckout) {
                    observer.observe(expressCheckout, { 
                      childList: true, 
                      subtree: true, 
                      attributes: true,
                      attributeFilter: ['style', 'class']
                    });
                  }
                }, 300);
                
                // Also force layout on window resize
                window.addEventListener('resize', forceVerticalLayout);
                
                if (!event.availablePaymentMethods) {
                  console.warn('⚠️ DEBUG: No payment methods available in Express Checkout');
                } else {
                  if (event.availablePaymentMethods.applePay) {
                    console.log('✅ DEBUG: Apple Pay is available');
                  } else {
                    console.log('❌ DEBUG: Apple Pay is NOT available');
                  }
                  if (event.availablePaymentMethods.googlePay) {
                    console.log('✅ DEBUG: Google Pay is available');
                  } else {
                    console.log('❌ DEBUG: Google Pay is NOT available');
                  }
                }
              }}
              onConfirm={async (event) => {
                console.log('🍎 DEBUG: Express Checkout onConfirm called', event);
                
                if (!stripe || !elements) {
                  console.log('❌ DEBUG: Stripe or elements not available');
                  return;
                }

                try {
                  console.log('✅ DEBUG: Confirming Express Checkout payment');
                  // Use the same payment confirmation logic
                  const { error: confirmError } = await stripe.confirmPayment({
                    elements,
                    clientSecret,
                    confirmParams: {
                      return_url: `${window.location.origin}/pay/success?id=${paymentLinkId}&amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}&clientName=${encodeURIComponent(customerName || '')}&timestamp=${Date.now()}`,
                    },
                  });

                  if (confirmError) {
                    setError(confirmError.message || 'Payment failed');
                    onError?.(confirmError.message || 'Payment failed');
                  } else {
                    onSuccess?.();
                  }
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : 'Payment failed';
                  setError(errorMessage);
                  onError?.(errorMessage);
                }
                  }}
                />
              </div>
            </div>

        {/* Divider */}
        <div className="flex items-center space-x-4 my-2">
          <div className="flex-1 h-px bg-white/20"></div>
          <span className="!text-sm cosmic-body text-white opacity-60">or pay with card</span>
          <div className="flex-1 h-px bg-white/20"></div>
        </div>

        {/* Client Information Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
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
          <div className="space-y-2">
            <div style={{ fontSize: '14px', overflow: 'hidden' }}>
              <PaymentElement 
                options={{
                  layout: 'tabs',
                  paymentMethodOrder: ['card'],
                  wallets: {
                    applePay: 'never',
                    googlePay: 'never'
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
          </>
        ) : (
          <div className="text-center py-8">
            <div className="cosmic-body text-white opacity-60">Loading payment form...</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CustomPaymentForm(props: CustomPaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
            amount: props.amount, // Send AED amount as-is, API will handle conversion
            currency: 'aed', // Always send AED, API will convert to USD for Stripe
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

  // Only show error if there's an actual error
  if (error) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center px-4">
        <div className="cosmic-card-login max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Payment Error</h1>
          <p className="cosmic-body text-white opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  // Only create Elements when we have a clientSecret
  if (!clientSecret) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center px-4">
        <div className="cosmic-card-login max-w-md w-full text-center">
          <div className="cosmic-body text-white opacity-60">Loading...</div>
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
        colorBackground: '#1a1a1a',
        colorText: '#ffffff',
        colorDanger: '#ef4444',
        fontFamily: 'Inter, sans-serif',
        fontSizeBase: '14px',
        borderRadius: '8px',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': {
          backgroundColor: '#1a1a1a',
          border: '1px solid #4d4d4d',
          color: '#ffffff',
          padding: '8px 12px',
          fontSize: '14px',
          lineHeight: '1.2',
        },
        '.Input:focus': {
          border: '1px solid #999999',
          boxShadow: 'none',
        },
        '.Label': {
          color: '#ffffff',
          fontSize: '12px',
          marginBottom: '7px',
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