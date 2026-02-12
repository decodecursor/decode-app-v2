-- Fix: Fall back to user's profile_photo_url when business_photo_url is null
CREATE OR REPLACE VIEW public_active_offers AS
SELECT o.id, o.business_id, o.created_by, o.title, o.description,
       o.category, o.price, o.original_price, o.quantity, o.quantity_sold,
       o.image_url, o.offer_code, o.is_active, o.expires_at,
       o.created_at, o.updated_at,
       b.business_name,
       COALESCE(b.business_photo_url, u.profile_photo_url) AS business_photo_url,
       b.city, b.google_rating, b.google_reviews_count,
       b.whatsapp_number, b.instagram_handle
FROM beauty_offers o
JOIN beauty_businesses b ON o.business_id = b.id
JOIN users u ON b.creator_id = u.id
WHERE o.is_active = true AND o.expires_at > now() AND o.quantity_sold < o.quantity;
