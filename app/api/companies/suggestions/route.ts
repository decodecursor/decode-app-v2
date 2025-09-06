import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Helper function to add CORS headers
function corsHeaders(request?: NextRequest) {
  const origin = request?.headers.get('origin') || 'http://localhost:3000'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true',
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders(request) })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 3) {
      return NextResponse.json(
        { suggestions: [] },
        { headers: corsHeaders(request) }
      )
    }

    const { data: companies, error } = await supabase
      .from('users')
      .select('company_name')
      .not('company_name', 'is', null)
      .ilike('company_name', `%${query}%`)
      .limit(3)

    if (error) {
      console.error('Error fetching company suggestions:', error)
      // Return empty suggestions if column doesn't exist yet
      if (error.message?.includes('column') && error.message?.includes('company_name')) {
        return NextResponse.json(
          { suggestions: [] },
          { headers: corsHeaders(request) }
        )
      }
      return NextResponse.json(
        { error: 'Failed to fetch suggestions' }, 
        { status: 500, headers: corsHeaders(request) }
      )
    }

    // Get unique company names
    const uniqueCompanies = [...new Set((companies || []).map((c: any) => c.company_name))]
      .filter(name => name && name.trim())
      .slice(0, 3)

    return NextResponse.json(
      { suggestions: uniqueCompanies },
      { headers: corsHeaders(request) }
    )
  } catch (error) {
    console.error('Company suggestions API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500, headers: corsHeaders(request) }
    )
  }
}