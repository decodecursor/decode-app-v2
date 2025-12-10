# Public Payment Page Test Guide

## Prerequisites
1. Payment links created in database with valid data
2. Users table with creator information
3. Active payment links for testing
4. Expired and inactive payment links for error testing

## Manual Testing Steps

### 1. **Start the development server:**
   ```bash
   npm run dev
   ```

### 2. **Get Test Payment Link IDs:**
   - Navigate to My Links page as Beauty Professional
   - Copy some payment link IDs from the displayed URLs
   - Note which links are Active, Expired, or Inactive

### 3. **Test Valid Active Payment Link:**
   - Navigate to `http://localhost:3000/pay/{validLinkId}`
   - **Expected display:**
     - Clean, professional white design on dark gradient background
     - DECODE branding with purple icon
     - "Service Details" section with payment link title
     - Large, prominent amount display (e.g., "$75.00 USD")
     - "Beauty Professional" section with creator info
     - Creator name (full_name or email username)
     - Creator email address
     - Creation and expiration dates
     - Disabled "Payment Integration Coming Soon" button

### 4. **Test Loading State:**
   - Navigate to a valid payment link
   - Should briefly show loading spinner with "Loading payment information..." message
   - Loading state has clean white card design

### 5. **Test Invalid Payment Link:**
   - Navigate to `http://localhost:3000/pay/invalid-uuid`
   - **Expected behavior:**
     - Shows error state with warning icon
     - "Payment Link Unavailable" heading
     - "Payment link not found" message
     - "Please contact the service provider for assistance" footer

### 6. **Test Inactive Payment Link:**
   - Deactivate a payment link through My Links page
   - Navigate to the deactivated link's URL
   - **Expected behavior:**
     - Shows error state
     - "This payment link has been deactivated" message

### 7. **Test Expired Payment Link:**
   - Manually set expiration_date to past date in database
   - Navigate to the expired link's URL
   - **Expected behavior:**
     - Shows error state
     - "This payment link has expired" message

### 8. **Test Creator Information Display:**
   #### With Full Name:
   - Payment link from user with full_name set
   - Should display full name as primary text
   - Email should show as secondary text

   #### Without Full Name:
   - Payment link from user without full_name
   - Should display email username (part before @) as primary text
   - Full email should show as secondary text

### 9. **Test Responsive Design:**
   - Test on various screen sizes:
     - Mobile (320px - 768px)
     - Tablet (768px - 1024px)
     - Desktop (1024px+)
   - **Expected behavior:**
     - Card should be responsive and centered
     - Text should remain readable
     - Spacing should adjust appropriately
     - Payment amount should remain prominent

### 10. **Test Data Formatting:**
   - **Amount**: Should show 2 decimal places (e.g., "$75.00")
   - **Dates**: Should format as "January 15, 2024"
   - **Service Title**: Should display exactly as entered
   - **Creator Info**: Should handle both full names and email-only

### 11. **Test Database Validation:**
   #### Missing Creator:
   - Remove user record from users table
   - Navigate to their payment link
   - Should show "Creator information not found" error

   #### Network Issues:
   - Temporarily break internet connection
   - Navigate to payment link
   - Should show "Failed to load payment information" error

### 12. **Test URL Structure:**
   - URLs should follow format: `/pay/{uuid}`
   - Should work with any valid UUID format
   - Invalid UUID formats should show appropriate errors

### 13. **Test Security:**
   - Public page should not require authentication
   - Should work in incognito/private browsing mode
   - Should not expose sensitive user information
   - Only shows necessary payment and creator info

### 14. **Test SEO/Meta Tags:**
   - Page should have appropriate title
   - Should not be indexed by search engines (payment links)
   - Should work with social media link previews

## Expected Behavior

### Valid Payment Link Display
✅ Clean, professional white card design
✅ Dark gradient background for contrast
✅ DECODE branding clearly visible
✅ Service title prominently displayed
✅ Amount in large, bold text with currency
✅ Creator information with name and email
✅ Creation and expiration dates formatted nicely
✅ Placeholder for future payment integration

### Error States
✅ Clear error messaging for each scenario:
   - Link not found
   - Link deactivated
   - Link expired
   - Creator info missing
   - Network/loading errors
✅ Consistent error page design
✅ Helpful guidance for users

### Data Validation
✅ Checks link exists in database
✅ Validates is_active = true
✅ Validates expiration_date > current date
✅ Ensures creator information exists
✅ Handles missing or null data gracefully

### Design Requirements
✅ Professional, trustworthy appearance
✅ Mobile-responsive layout
✅ Clear visual hierarchy
✅ Accessible color contrast
✅ Consistent with DECODE branding

## Database Queries
The page performs these queries:
```sql
SELECT 
  payment_links.id,
  payment_links.title,
  payment_links.amount_usd,
  payment_links.expiration_date,
  payment_links.is_active,
  payment_links.created_at,
  users.full_name,
  users.email
FROM payment_links
JOIN users ON payment_links.creator_id = users.id
WHERE payment_links.id = '{linkId}'
```

## Error Scenarios

### 1. Invalid Link ID
- **URL**: `/pay/not-a-uuid`
- **Error**: "Payment link not found"

### 2. Link Not Found
- **URL**: `/pay/00000000-0000-0000-0000-000000000000`
- **Error**: "Payment link not found"

### 3. Inactive Link
- **Condition**: `is_active = false`
- **Error**: "This payment link has been deactivated"

### 4. Expired Link
- **Condition**: `expiration_date < NOW()`
- **Error**: "This payment link has expired"

### 5. Missing Creator
- **Condition**: Creator user deleted from database
- **Error**: "Creator information not found"

### 6. Network Error
- **Condition**: Database connection failed
- **Error**: "Failed to load payment information"

## Performance Considerations
- Single database query with join
- Minimal data fetched (only necessary fields)
- Client-side validation for immediate feedback
- Responsive images and icons
- Optimized loading states

## Security Notes
- No authentication required (public access)
- Only public payment information exposed
- Creator email shown (consider if this should be optional)
- No sensitive financial data exposed
- URL parameters validated server-side