'use client'

import React, { useState, useEffect } from 'react';
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

// Initialize Stripe with fallback
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_51Rpnj8BCENH8RexyycBntN40xSM7w5MbstofjrV5tAROxMI71UDw0AKAwFFlwGN6OaMlDa62A4BukU4yZxmQ4Euz00X3NoqUYG';

console.log('🔍 Stripe Publishable Key:', STRIPE_PUBLISHABLE_KEY ? 'Available' : 'Missing');

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY).catch(error => {
  console.error('❌ Stripe SDK loading error:', error);
  return null;
});

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

  // Simplified device detection for payment capabilities
  const detectPaymentCapabilities = () => {
    // Check multiple ways to detect iOS devices
    const userAgent = navigator.userAgent;
    const platform = navigator.platform || '';

    // Check for iOS - don't lowercase as iPhone/iPad have capital letters
    const isIOS = /iPhone|iPad|iPod/.test(userAgent) ||
                   /iPhone|iPad|iPod/.test(platform) ||
                   (platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad Pro detection

    const isAndroid = /Android/.test(userAgent);
    const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);

    console.log('🔍 Device Detection:', {
      isIOS,
      isAndroid,
      isMobile,
      isSafari,
      userAgent: navigator.userAgent,
      platform: navigator.platform
    });

    return { isIOS, isAndroid, isMobile, isSafari };
  };

  // Dynamic ExpressCheckout configuration based on device
  const getExpressCheckoutOptions = () => {
    const { isIOS, isAndroid, isMobile } = detectPaymentCapabilities();

    // Base configuration
    const baseConfig = {
      buttonTheme: {
        applePay: 'white-outline' as const,
        googlePay: 'white' as const
      },
      buttonType: {
        googlePay: 'plain' as const
      }
    };

    if (isIOS) {
      console.log('📱 iOS device detected - showing Apple Pay only');
      return {
        ...baseConfig,
        paymentMethods: {
          applePay: 'always' as const,  // Force Apple Pay to show on iOS
          googlePay: 'never' as const   // Don't show Google Pay on iOS
        },
        paymentMethodOrder: ['applePay']
      };
    } else if (isAndroid) {
      console.log('🤖 Android device - showing Google Pay and Apple Pay as fallback');
      return {
        ...baseConfig,
        paymentMethods: {
          applePay: 'auto' as const,    // Show Apple Pay if available as fallback
          googlePay: 'always' as const  // Always show Google Pay on Android
        },
        paymentMethodOrder: ['googlePay', 'applePay']
      };
    } else {
      console.log('🖥️ Desktop/other device - showing both payment methods');
      return {
        ...baseConfig,
        paymentMethods: {
          applePay: 'auto' as const,    // Show if available
          googlePay: 'always' as const  // Always show Google Pay on desktop
        },
        paymentMethodOrder: ['googlePay', 'applePay']
      };
    }
  };


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
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/pay/success?id=${paymentLinkId}&amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}&clientName=${encodeURIComponent(customerName || '')}&timestamp=${Date.now()}`,
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
        <div className="bg-black rounded-lg px-4 py-6 mb-6">
          <div className="text-center space-y-1">
            <div className="cosmic-body text-xs text-white font-bold" style={{fontSize: '14px'}}>
              Beauty Service at {beautyProfessionalName}
            </div>
            <div className="cosmic-body text-xs font-bold text-white" style={{fontSize: '14px'}}>
              {customerName || 'Client Name'}
            </div>
            <div className="cosmic-body text-xs font-bold text-white mt-4" style={{fontSize: '14px'}}>
              {currency} {amount.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Render payment elements */}
        <>
            {/* Express Checkout (Apple Pay, Google Pay) */}
            <div className="mb-4 express-checkout-expanded" style={{ minHeight: '60px' }}>
              <div className="cosmic-input express-checkout-no-border" style={{ minHeight: '56px', display: 'block' }}>
                <ExpressCheckoutElement
                  options={getExpressCheckoutOptions()}
              onReady={(event) => {
                const { isIOS, isAndroid, isMobile, isSafari } = detectPaymentCapabilities();

                console.log('🍎 Express Checkout ready - Device-specific configuration applied');
                console.log('🍎 Available payment methods:', event.availablePaymentMethods);
                console.log('🍎 Device info:', { isIOS, isAndroid, isMobile, isSafari });

                // Log if no payment methods are available
                if (!event.availablePaymentMethods ||
                    (!event.availablePaymentMethods.applePay && !event.availablePaymentMethods.googlePay)) {
                  console.warn('⚠️ No express payment methods available on this device');
                  console.log('Debug: Check if Stripe is properly initialized and payment methods are configured');
                }

                // Function to force vertical layout on mobile
                const forceVerticalLayout = () => {
                  if (!isMobile) return;

                  const expressCheckout = document.querySelector('.express-checkout-expanded');
                  if (expressCheckout) {
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
                      const lastButton = allButtons[allButtons.length - 1];
                      if (lastButton) {
                        lastButton.style.marginBottom = '0';
                      }
                    }
                  }
                };

                // Device-specific button handling
                setTimeout(() => {
                  const showMoreButton = document.querySelector('button[aria-label*="Show more"], button[aria-label*="show more"], [class*="ShowMore"]') as HTMLButtonElement;

                  // For single payment method devices, hide "Show More" button
                  if (showMoreButton && (isIOS || isAndroid)) {
                    console.log(`🔒 Hiding Show More button for ${isIOS ? 'iOS' : 'Android'} device`);
                    showMoreButton.style.display = 'none';
                  } else if (showMoreButton) {
                    console.log('🔄 Auto-clicking Show More button for desktop');
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

                // Log available payment methods for debugging
                if (event.availablePaymentMethods?.applePay) {
                  console.log('✅ Apple Pay is available and configured');
                }
                if (event.availablePaymentMethods?.googlePay) {
                  console.log('✅ Google Pay is available and configured');
                }
                if (!event.availablePaymentMethods?.applePay && !event.availablePaymentMethods?.googlePay) {
                  console.warn('⚠️ No express payment methods available');
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
                      return_url: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/pay/success?id=${paymentLinkId}&amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}&clientName=${encodeURIComponent(customerName || '')}&timestamp=${Date.now()}`,
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
            <div style={{ 
              fontSize: '14px', 
              minHeight: '250px',
              position: 'relative'
            }}>
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
                onReady={() => {
                  console.log('✅ PaymentElement ready and visible');
                }}
                onLoaderStart={() => {
                  console.log('🔄 PaymentElement loading...');
                }}
                onLoadError={(error) => {
                  console.error('❌ PaymentElement load error:', error);
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

        {!clientSecret && (
          <div className="text-center py-8">
            <div className="cosmic-body text-white opacity-60">Client secret not available - Elements may not function</div>
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
      setLoading(true);
      setError(null);

      try {
        console.log('🔍 DEBUG: Creating payment intent for:', props.paymentLinkId);
        console.log('🔍 DEBUG: Request data:', {
          paymentLinkId: props.paymentLinkId,
          amount: props.amount,
          currency: 'aed',
          customerEmail: props.customerEmail,
          customerName: props.customerName
        });

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

        console.log('🔍 DEBUG: Payment intent response status:', intentResponse.status);
        console.log('🔍 DEBUG: Payment intent response headers:', Object.fromEntries(intentResponse.headers.entries()));

        const intentData = await intentResponse.json();

        console.log('🔍 DEBUG: Payment intent response data:', intentData);

        if (!intentResponse.ok) {
          console.error('❌ DEBUG: Payment intent failed with status:', intentResponse.status);
          console.error('❌ DEBUG: Payment intent error data:', intentData);
          throw new Error(intentData.error || `API Error: ${intentResponse.status} - Failed to create payment intent`);
        }

        if (!intentData.clientSecret) {
          console.error('❌ DEBUG: No clientSecret in response:', intentData);
          throw new Error('Payment intent created but no client secret returned');
        }

        console.log('✅ DEBUG: Payment intent created successfully, setting clientSecret');
        setClientSecret(intentData.clientSecret);

        // Extract the real client name from the payment details
        if (intentData.paymentDetails?.clientName) {
          console.log('🔍 DEBUG: Setting client name from payment details:', intentData.paymentDetails.clientName);
          setRealClientName(intentData.paymentDetails.clientName);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize payment';
        console.error('❌ DEBUG: Payment intent creation failed:', err);
        console.error('❌ DEBUG: Error details:', {
          message: errorMessage,
          stack: err instanceof Error ? err.stack : undefined
        });
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
          <h1 className="text-2xl font-bold text-white mb-4">Payment Setup Error</h1>
          <p className="cosmic-body text-white opacity-80 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="cosmic-button-primary"
          >
            Retry Payment Setup
          </button>
          <div className="mt-4 text-xs text-gray-400 text-left bg-gray-900/50 p-3 rounded">
            <p className="font-mono">Debug Info:</p>
            <p className="font-mono">Payment Link ID: {props.paymentLinkId}</p>
            <p className="font-mono">Amount: {props.amount} AED</p>
            <p className="font-mono">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading || !clientSecret) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center px-4">
        <p className="text-white text-lg">Loading...</p>
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