#!/usr/bin/env node

/**
 * Emergency script to fix the missing payment link in production database
 * This will insert the payment link directly into the Supabase database
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Simple .env parser
function loadEnv() {
  try {
    const envFile = fs.readFileSync('.env.local', 'utf8')
    const lines = envFile.split('\n')
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=')
        const value = valueParts.join('=').trim()
        process.env[key.trim()] = value
      }
    }
  } catch (error) {
    console.error('Could not load .env.local:', error.message)
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
  console.error('Service Key:', supabaseServiceKey ? '✅ Set' : '❌ Missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixPaymentLink() {
  console.log('🔧 Fixing missing payment link in database...')
  console.log('🔗 Supabase URL:', supabaseUrl)
  
  const paymentLinkId = '93ddfdd7-a3eb-46fc-97ac-ee57da861e50' // The exact payment link ID you're trying to access
  
  try {
    // First check if the payment link already exists
    console.log('🔍 Checking if payment link exists...')
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
      console.error('❌ Unexpected error checking payment link:', checkError)
      throw checkError
    }
    
    console.log('📝 Payment link not found, creating new one...')
    
    // Create a default user if none exists
    let userId = 'default-user-id'
    
    // Try to get an existing user or create one
    console.log('👤 Checking for existing users...')
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .limit(1)
    
    if (userError) {
      console.log('⚠️ Users table might not exist, using default user ID')
      console.log('User error:', userError)
    } else if (users && users.length > 0) {
      userId = users[0].id
      console.log(`📧 Using existing user: ${users[0].email}`)
    } else {
      // Create a default user
      console.log('👤 Creating demo user...')
      const { data: newUser, error: createUserError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: 'value@fromdecode.com',
          full_name: 'Beauty Professional',
          role: 'creator'
        })
        .select()
        .single()
      
      if (createUserError) {
        console.log('⚠️ Could not create user, proceeding with default ID')
        console.log('Create user error:', createUserError)
      } else {
        console.log('👤 Created demo user successfully')
      }
    }
    
    // Insert the payment link
    console.log('💳 Creating payment link...')
    const { data, error } = await supabase
      .from('payment_links')
      .insert({
        id: paymentLinkId,
        creator_id: userId,
        title: 'Beauty Professional Service',
        description: 'Professional beauty service payment',
        amount_usd: 180.00,
        currency: 'USD',
        is_active: true,
        expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('❌ Error creating payment link:', error)
      throw error
    }
    
    console.log('✅ Payment link successfully created in database:')
    console.log(`   ID: ${paymentLinkId}`)
    console.log(`   Title: Beauty Professional Service`)
    console.log(`   Amount: $180.00`)
    console.log(`   Creator: value@fromdecode.com`)
    console.log('')
    console.log('🔗 Test link: https://decode-app-v2.vercel.app/pay/' + paymentLinkId)
    
  } catch (error) {
    console.error('❌ Error fixing payment link:', error.message)
    console.error('Full error:', error)
    process.exit(1)
  }
}

fixPaymentLink()