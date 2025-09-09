import { NextRequest, NextResponse } from 'next/server'

// Proxy endpoint to handle Supabase requests with retry logic
// This works around connection reset issues

const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // Start with 1 second

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })
      
      // If we get a response (even error), return it
      if (response) {
        return response
      }
    } catch (error: any) {
      console.log(`Attempt ${i + 1} failed:`, error.message)
      
      // If this is the last retry, throw the error
      if (i === retries - 1) {
        throw error
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, i)))
    }
  }
  
  throw new Error('All retry attempts failed')
}

export async function POST(request: NextRequest) {
  try {
    const { endpoint, method, headers, body } = await request.json()
    
    // Construct the Supabase URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const fullUrl = `${supabaseUrl}${endpoint}`
    
    // Add API key to headers
    const proxyHeaders = {
      ...headers,
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      'Content-Type': 'application/json',
    }
    
    console.log(`Proxying ${method} request to: ${endpoint}`)
    
    // Make the request with retry logic
    const response = await fetchWithRetry(fullUrl, {
      method,
      headers: proxyHeaders,
      body: body ? JSON.stringify(body) : undefined,
    })
    
    const data = await response.json()
    
    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
  } catch (error: any) {
    console.error('Proxy error:', error)
    
    // Return a proper error response
    return NextResponse.json(
      { 
        error: 'Connection failed after retries',
        details: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 503 } // Service Unavailable
    )
  }
}

export async function GET(request: NextRequest) {
  // Health check endpoint
  return NextResponse.json({ 
    status: 'ok',
    proxy: 'active',
    timestamp: new Date().toISOString()
  })
}