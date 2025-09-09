import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get environment variables status
    const envCheck = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      
      // Supabase variables
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
        serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
      },
      
      // Crossmint variables
      crossmint: {
        apiKey: process.env.CROSSMINT_API_KEY ? 'SET' : 'MISSING',
        projectId: process.env.NEXT_PUBLIC_CROSSMINT_PROJECT_ID || 'MISSING',
        environment: process.env.CROSSMINT_ENVIRONMENT || 'MISSING',
      },
      
      // Stripe variables
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY ? 'SET' : 'MISSING',
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? 'SET' : 'MISSING',
      },
      
      // App URLs
      urls: {
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'MISSING',
        nextAuthUrl: process.env.NEXTAUTH_URL || 'MISSING',
      }
    }
    
    // Test Supabase client initialization
    let supabaseStatus = 'NOT_TESTED'
    try {
      // Try a simple query to test connection
      const { error } = await supabase.from('users').select('id').limit(1)
      if (error) {
        supabaseStatus = `ERROR: ${error.message}`
      } else {
        supabaseStatus = 'CONNECTED'
      }
    } catch (err: any) {
      supabaseStatus = `INIT_ERROR: ${err.message}`
    }
    
    return NextResponse.json({
      success: true,
      env: envCheck,
      supabaseClientStatus: supabaseStatus,
      message: 'Environment check complete'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to check environment'
    }, { status: 500 })
  }
}