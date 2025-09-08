import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.length < 3) {
      return NextResponse.json({ suggestions: [] })
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
        return NextResponse.json({ suggestions: [] })
      }
      return NextResponse.json(
        { error: 'Failed to fetch suggestions' }, 
        { status: 500 }
      )
    }

    // Get unique company names
    const uniqueCompanies = [...new Set((companies || []).map((c: any) => c.company_name))]
      .filter((name: any) => name && typeof name === 'string' && name.trim())
      .slice(0, 3)

    return NextResponse.json({ suggestions: uniqueCompanies })
  } catch (error) {
    console.error('Company suggestions API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}