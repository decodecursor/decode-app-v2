import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🔍 DEBUG: Testing Crossmint API connection')
  
  try {
    const apiKey = process.env.CROSSMINT_API_KEY || process.env.NEXT_PUBLIC_CROSSMINT_API_KEY
    const projectId = process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'No Crossmint API key found',
        details: {
          serverSideKey: process.env.CROSSMINT_API_KEY ? 'SET' : 'MISSING',
          clientSideKey: process.env.NEXT_PUBLIC_CROSSMINT_API_KEY ? 'SET' : 'MISSING'
        }
      }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({
        error: 'No Crossmint Project ID found',
        details: {
          projectId: process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID
        }
      }, { status: 400 })
    }

    console.log('🔍 DEBUG: Testing with Project ID:', projectId)
    console.log('🔍 DEBUG: API Key format:', apiKey.substring(0, 20) + '...')

    // Test 1: Try to get project info (if such endpoint exists)
    let projectTest = null
    try {
      const projectResponse = await fetch(`https://www.crossmint.com/api/2022-06-09/projects/${projectId}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        }
      })
      
      if (projectResponse.ok) {
        projectTest = await projectResponse.json()
      } else {
        projectTest = {
          error: `HTTP ${projectResponse.status}`,
          statusText: projectResponse.statusText,
          response: await projectResponse.text()
        }
      }
    } catch (err) {
      projectTest = {
        error: 'Network error',
        message: err instanceof Error ? err.message : 'Unknown error'
      }
    }

    // Test 2: Try to create a simple order (the actual API call that's failing)
    let orderTest = null
    try {
      const orderPayload = {
        payment: {
          method: 'fiat',
          currency: 'USD'
        },
        lineItems: [{
          callData: {
            totalPrice: '1.00',
            currency: 'USD',
            quantity: 1
          },
          metadata: {
            test: true,
            description: 'Test order for API validation'
          }
        }]
      }

      console.log('🔍 DEBUG: Testing order creation with payload:', JSON.stringify(orderPayload, null, 2))

      const orderResponse = await fetch('https://www.crossmint.com/api/2022-06-09/orders', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderPayload)
      })

      if (orderResponse.ok) {
        orderTest = await orderResponse.json()
      } else {
        const errorText = await orderResponse.text()
        orderTest = {
          error: `HTTP ${orderResponse.status}`,
          statusText: orderResponse.statusText,
          response: errorText
        }
        console.error('❌ DEBUG: Order creation failed:', errorText)
      }
    } catch (err) {
      orderTest = {
        error: 'Network error',
        message: err instanceof Error ? err.message : 'Unknown error'
      }
    }

    // Test 3: Check if embedded checkout endpoint is different
    let checkoutTest = null
    try {
      const checkoutUrl = `https://www.crossmint.com/api/2023-06-09/checkout/orders?clientId=${projectId}&checkoutType=EMBEDDED`
      
      console.log('🔍 DEBUG: Testing checkout endpoint:', checkoutUrl)
      
      const checkoutResponse = await fetch(checkoutUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        }
      })

      if (checkoutResponse.ok) {
        checkoutTest = await checkoutResponse.json()
      } else {
        const errorText = await checkoutResponse.text()
        checkoutTest = {
          error: `HTTP ${checkoutResponse.status}`,
          statusText: checkoutResponse.statusText,
          response: errorText
        }
      }
    } catch (err) {
      checkoutTest = {
        error: 'Network error',
        message: err instanceof Error ? err.message : 'Unknown error'
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Crossmint API test completed',
      config: {
        projectId: projectId,
        hasApiKey: !!apiKey,
        apiKeyPrefix: apiKey.substring(0, 20) + '...',
        environment: process.env.CROSSMINT_ENVIRONMENT || 'production'
      },
      tests: {
        projectInfo: projectTest,
        orderCreation: orderTest,
        embeddedCheckout: checkoutTest
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ DEBUG: Error testing Crossmint API:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to test Crossmint API',
        debug: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorType: typeof error
        }
      },
      { status: 500 }
    )
  }
}