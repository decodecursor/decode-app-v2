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

    // Query payment_links for frequently used service titles
    // Only get services that have been used more than 3 times in paid payment links
    const { data: frequentServices, error } = await supabase
      .from('payment_links')
      .select('title')
      .eq('creator_id', user.id)
      .eq('payment_status', 'paid')
      .not('title', 'is', null)
      .ilike('title', `%${query}%`)
    
    if (error) {
      console.error('Error fetching service suggestions:', error)
      return NextResponse.json({ suggestions: [] })
    }

    // Count occurrences of each service title
    const serviceCounts = new Map<string, number>()
    
    frequentServices?.forEach((record) => {
      const title = record.title?.trim()
      if (title) {
        serviceCounts.set(title, (serviceCounts.get(title) || 0) + 1)
      }
    })

    // Filter services that have been used more than 3 times
    // Sort by usage count descending
    const suggestions = Array.from(serviceCounts.entries())
      .filter(([_, count]) => count > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) // Limit to top 5 suggestions
      .map(([name, count]) => ({
        name,
        count
      }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Service suggestions API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}