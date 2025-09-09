import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    // Get current user
    const supabase = await createClient()
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // If no query or query is too short, return empty suggestions
    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    // Query payment_links for frequently used client names
    // Only get clients that have been used more than 3 times in paid payment links
    const { data: frequentClients, error } = await supabase
      .from('payment_links')
      .select('client_name')
      .eq('creator_id', user.id)
      .eq('payment_status', 'paid')
      .not('client_name', 'is', null)
      .ilike('client_name', `%${query}%`)
    
    if (error) {
      console.error('Error fetching client suggestions:', error)
      return NextResponse.json({ suggestions: [] })
    }

    // Count occurrences of each client name
    const clientCounts = new Map<string, number>()
    
    frequentClients?.forEach((record) => {
      const name = record.client_name?.trim()
      if (name) {
        clientCounts.set(name, (clientCounts.get(name) || 0) + 1)
      }
    })

    // Filter clients that have been used more than 3 times
    // Sort by usage count descending
    const suggestions = Array.from(clientCounts.entries())
      .filter(([_, count]) => count > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) // Limit to top 5 suggestions
      .map(([name, count]) => ({
        name,
        count
      }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Client suggestions API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}