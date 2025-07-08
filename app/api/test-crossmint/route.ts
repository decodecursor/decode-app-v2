// Crossmint API authentication test - UPDATED VERSION
// GET /api/test-crossmint

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.CROSSMINT_API_KEY;
    const environment = process.env.CROSSMINT_ENVIRONMENT || 'staging';
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'CROSSMINT_API_KEY not configured',
        config: {
          hasApiKey: false,
          environment,
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    // Test PRODUCTION Crossmint API endpoint
    const testUrl = 'https://www.crossmint.com/api/2022-06-09/orders';

    console.log(`🔄 Testing Crossmint API: ${testUrl}`);
    
    try {
      // Test minimal order creation
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'DECODE-Beauty-Platform/1.0'
        },
        body: JSON.stringify({
          payment: {
            method: 'polygon-amoy',
            currency: 'usdc'
          },
          lineItems: [
            {
              callData: {
                totalPrice: '10.00',
                service: 'beauty',
                description: 'Test beauty service payment'
              }
            }
          ],
          recipient: {
            email: 'test@decode-beauty.com'
          },
          metadata: {
            service: 'beauty',
            platform: 'DECODE_Beauty_Test'
          }
        })
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      console.log(`📊 Status: ${response.status}, Data:`, responseData);

      return NextResponse.json({
        success: true,
        message: 'Crossmint API test completed',
        config: {
          hasApiKey: true,
          apiKeyLength: apiKey.length,
          apiKeyPrefix: apiKey.substring(0, 10) + '...',
          environment,
          endpoint: testUrl,
          timestamp: new Date().toISOString()
        },
        test: {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          success: response.ok
        }
      });

    } catch (error) {
      console.error(`❌ API test failed:`, error);
      
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        config: {
          hasApiKey: true,
          apiKeyLength: apiKey.length,
          apiKeyPrefix: apiKey.substring(0, 10) + '...',
          environment,
          endpoint: testUrl
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Crossmint test error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}