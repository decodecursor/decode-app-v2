-- SQL to fix the missing payment link issue
-- Run this in your Supabase SQL editor

-- First, insert the user (creator) if it doesn't exist
INSERT INTO users (
  id, 
  email, 
  full_name, 
  role,
  created_at,
  updated_at
) VALUES (
  'manual-creator-id',
  'value@fromdecode.com',
  'Beauty Professional',
  'creator',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Then insert the payment link
INSERT INTO payment_links (
  id, 
  creator_id, 
  title, 
  description, 
  amount_usd, 
  currency, 
  is_active, 
  expiration_date, 
  created_at, 
  updated_at
) VALUES (
  '93ddfdd7-a3eb-46fc-97ac-ee57da861e50',
  'manual-creator-id',
  'Beauty Professional Service',
  'Professional beauty service payment - value@fromdecode.com',
  180.00,
  'USD',
  true,
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verify the data was inserted
SELECT 
  pl.id,
  pl.title,
  pl.amount_usd,
  pl.is_active,
  pl.expiration_date,
  u.email as creator_email,
  u.full_name as creator_name
FROM payment_links pl
LEFT JOIN users u ON pl.creator_id = u.id
WHERE pl.id = '93ddfdd7-a3eb-46fc-97ac-ee57da861e50';