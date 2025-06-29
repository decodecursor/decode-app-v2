#!/usr/bin/env node

/**
 * Emergency script to fix the missing payment link in production database
 * This will insert the payment link directly into the Supabase database
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixPaymentLink() {
  console.log('🔧 Fixing missing payment link in database...')
  
  const paymentLinkId = '93ddfdd7-a3eb-46fc-97ac-ee57da861e50'
  
  try {
    // First check if the payment link already exists
    const { data: existing, error: checkError } = await supabase
      .from('payment_links')
      .select('id')
      .eq('id', paymentLinkId)
      .single()
    
    if (existing) {
      console.log('✅ Payment link already exists in database')
      return
    }
    
    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError
    }
    
    // Create a default user if none exists
    let userId = 'default-user-id'
    
    // Try to get an existing user or create one
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .limit(1)
    
    if (userError) {
      console.log('⚠️ Users table might not exist, using default user ID')
    } else if (users && users.length > 0) {
      userId = users[0].id
      console.log(`📧 Using existing user: ${users[0].email}`)
    } else {
      // Create a default user
      const { data: newUser, error: createUserError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: 'demo@decode.beauty',
          full_name: 'Demo User',
          role: 'creator'
        })
        .select()
        .single()
      
      if (createUserError) {
        console.log('⚠️ Could not create user, proceeding with default ID')
      } else {
        console.log('👤 Created demo user')
      }
    }
    
    // Insert the payment link
    const { data, error } = await supabase
      .from('payment_links')
      .insert({
        id: paymentLinkId,
        creator_id: userId,
        title: 'Demo Beauty Service',
        description: 'Emergency test payment link for production debugging',
        amount_usd: 99.99,
        currency: 'USD',
        is_active: true,
        expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    console.log('✅ Payment link successfully created in database:')
    console.log(`   ID: ${paymentLinkId}`)
    console.log(`   Title: Demo Beauty Service`)
    console.log(`   Amount: $99.99`)
    console.log(`   Creator: ${userId}`)
    console.log('')
    console.log('🔗 Test link: https://decode-app-v2.vercel.app/pay/' + paymentLinkId)
    
  } catch (error) {
    console.error('❌ Error fixing payment link:', error.message)
    console.error('Full error:', error)
    process.exit(1)
  }
}

fixPaymentLink()