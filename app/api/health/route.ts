import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export async function GET(request: NextRequest) {
  try {
    // Check database connectivity
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single()

    if (error) {
      console.error('Database health check failed:', error)
      return NextResponse.json(
        {
          status: 'unhealthy',
          message: 'Database connection failed',
          timestamp: new Date().toISOString(),
          checks: {
            database: 'failed',
            application: 'healthy'
          }
        },
        { status: 503 }
      )
    }

    // All checks passed
    return NextResponse.json(
      {
        status: 'healthy',
        message: 'All systems operational',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        checks: {
          database: 'healthy',
          application: 'healthy'
        },
        uptime: process.uptime()
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'unknown',
          application: 'failed'
        }
      },
      { status: 503 }
    )
  }
}