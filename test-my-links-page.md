# My Links Page Test Guide

## Prerequisites
1. Supabase payment_links table with data
2. User authentication working
3. Payment creation form working (to create test data)

## Manual Testing Steps

### 1. **Start the development server:**
   ```bash
   npm run dev
   ```

### 2. **Test Authentication:**
   - Navigate directly to `http://localhost:3000/my-links` without login
   - Should redirect to `/auth` page
   - Login as Beauty Professional user
   - Should be able to access My Links page

### 3. **Test Empty State (No Links):**
   - With a user who has no payment links created
   - Navigate to `http://localhost:3000/my-links`
   - **Expected display:**
     - Header with "My Payment Links" title
     - "Create New Link" button in header
     - Empty state card with:
       - Link icon
       - "No Payment Links Yet" heading
       - Descriptive text about creating first link
       - "Create Your First Link" button
     - "Back to Dashboard" link at top

### 4. **Test Loading State:**
   - Navigate to My Links page
   - Should briefly show loading spinner with "Loading your payment links..." text
   - Loading state should have cosmic styling

### 5. **Test With Payment Links:**
   - Create 2-3 payment links using the Create Payment Link form
   - Navigate to My Links page
   - **Expected display:**
     - List of payment links in cards
     - Most recent links at the top (ordered by created_at desc)
     - Each link shows:
       - Service title (large, white text)
       - Created date (formatted: "Jan 15, 2024")
       - Amount (right-aligned, $XX.XX format)
       - Status badge (Active/Expired/Inactive)

### 6. **Test Status Logic:**
   #### Active Links:
   - Links created within 7 days should show "Active" status
   - Status badge should be green

   #### Expired Links:
   - To test expired links, you can manually update expiration_date in database to past date
   - Should show "Expired" status
   - Status badge should be yellow

   #### Inactive Links:
   - Manually set is_active to false in database
   - Should show "Inactive" status
   - Status badge should be gray

### 7. **Test Mobile Responsiveness:**
   - Switch to mobile viewport (< 768px)
   - Payment link cards should stack properly
   - Amount and status should move below title/date on mobile
   - Touch targets should be adequate size
   - Header should remain functional

### 8. **Test Navigation:**
   - Click "Back to Dashboard" - should navigate to `/dashboard`
   - Click "Create New Link" (header) - should navigate to `/payment/create`
   - Click "Create Your First Link" (empty state) - should navigate to `/payment/create`

### 9. **Test Error Handling:**
   - To test error state:
     - Temporarily break Supabase connection
     - Or modify table name in query to invalid value
   - Navigate to My Links page
   - Should show error message in red styling
   - Page should remain functional (navigation still works)

### 10. **Test Data Formatting:**
   - Verify dates are formatted properly (e.g., "Jan 15, 2024")
   - Verify amounts show 2 decimal places (e.g., "$75.00")
   - Verify service titles display correctly
   - Check status badges have proper colors and styling

### 11. **Test Real-time Data:**
   - Create a new payment link
   - Navigate to My Links page
   - New link should appear at the top of the list
   - Refresh page - data should persist

## Expected Behavior

### Page Structure
✅ Header with title and Create New Link button
✅ Back to Dashboard navigation
✅ List of payment links or empty state
✅ Dark theme styling throughout

### Data Display
✅ Payment links ordered by newest first
✅ Service title prominently displayed
✅ Created date formatted nicely
✅ Amount formatted as currency
✅ Status calculated and displayed correctly

### Status Calculation
✅ Active: is_active = true AND expiration_date > now
✅ Expired: is_active = true AND expiration_date < now
✅ Inactive: is_active = false

### States
✅ Loading state with spinner
✅ Empty state with helpful messaging
✅ Error state with error display
✅ Populated state with payment links list

### Mobile Responsive
✅ Cards stack properly on mobile
✅ Information reorganizes for smaller screens
✅ Navigation remains accessible
✅ Touch-friendly button sizes

## Database Query Verification
Check that the page queries:
- Only payment links for current user (creator_id = user.id)
- Orders by created_at descending (newest first)
- Fetches all required fields: id, title, amount_usd, expiration_date, is_active, created_at

## Visual Checks
- Cards have proper spacing and borders
- Hover effects on cards (purple border)
- Status badges have proper colors
- Typography hierarchy is clear
- Loading spinner animates smoothly
- Empty state icon and messaging are clear

## Error Scenarios to Test
1. **Network failure** during data fetch
2. **Database connection issues**
3. **User without proper permissions**
4. **Malformed data** in payment_links table
5. **Very long service titles** (text overflow)
6. **Many payment links** (scroll behavior)

## Integration Testing
- Create payment link → verify it appears in My Links
- Check status changes when expiration date passes
- Verify RLS policies prevent seeing other users' links
- Test navigation flow: Dashboard → Create Link → My Links