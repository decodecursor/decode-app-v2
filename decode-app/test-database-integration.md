# Payment Link Database Integration Test Guide

## Prerequisites
1. Supabase project with payment_links table created
2. Users table with user records containing valid roles
3. RLS policies enabled and configured
4. Authentication working properly

## Manual Testing Steps

### 1. **Start the development server:**
   ```bash
   npm run dev
   ```

### 2. **Test Database Connection:**
   - Navigate to `http://localhost:3000/payment/create`
   - Login as Beauty Professional user
   - Verify form loads without errors

### 3. **Test Successful Form Submission:**
   - Fill out form with valid data:
     - Service Title: "Hair Styling Session"
     - Amount: "75.00"
   - Click "Create Payment Link"
   - **Expected behavior:**
     - Button text changes to "Saving to Database..."
     - Button becomes disabled
     - No error messages appear
     - Success state shows after save completes

### 4. **Test Success State:**
   - After successful submission, verify:
     - Green checkmark icon appears
     - "Payment Link Created!" message shows
     - "Your payment link has been saved to the database successfully." message
     - "Redirecting to My Links page..." message in purple
     - Payment details show entered service and amount
     - Expiration date shows (7 days from creation)
     - "Create Another Link" button available
     - "Go to My Links" button available
     - Automatic redirect to `/my-links` after 2 seconds

### 5. **Test Database Record Creation:**
   - Check Supabase dashboard payment_links table
   - Verify new record was created with:
     - `title`: "Hair Styling Session"
     - `amount_usd`: 75.00
     - `expiration_date`: 7 days from creation time
     - `creator_id`: Current user's ID
     - `is_active`: true
     - `created_at`: Current timestamp

### 6. **Test Form Validation with Database:**
   - Try submitting with empty fields - should block before database call
   - Try submitting with invalid amount - should block before database call
   - Ensure validation happens client-side first

### 7. **Test Error Handling:**
   #### Database Error Simulation:
   - To test error handling, you can:
     - Temporarily disable internet connection
     - Or modify Supabase URL in environment to invalid value
     - Or remove user from database to trigger RLS error
   - Submit valid form data
   - **Expected behavior:**
     - Button shows "Saving to Database..." then returns to normal
     - Red error message appears above button
     - Form remains editable
     - No success state shown

### 8. **Test Authentication Requirements:**
   - Logout and try to access `/payment/create`
   - Should redirect to auth page
   - Login and verify access is restored

### 9. **Test "Create Another Link" Flow:**
   - Complete a successful form submission
   - Click "Create Another Link" in success state
   - Verify form resets to empty state
   - Submit another payment link
   - Check database has 2 records

### 10. **Test Manual Navigation:**
   - Complete a successful submission
   - Before auto-redirect, click "Go to My Links"
   - Should navigate to `/my-links` page immediately

## Expected Database Schema
```sql
payment_links table should contain:
- id (UUID, auto-generated)
- title (TEXT, matches form input)
- amount_usd (DECIMAL(10,2), matches form input)
- expiration_date (TIMESTAMPTZ, 7 days from creation)
- creator_id (UUID, current user's ID)
- is_active (BOOLEAN, true)
- created_at (TIMESTAMPTZ, auto-generated)
```

## Success Criteria

### Form Behavior
✅ Form validates before database submission
✅ Button shows loading state during save
✅ Error handling for database failures
✅ Success state shows after successful save
✅ Automatic redirect after 2 seconds

### Database Integration
✅ Records saved to payment_links table
✅ All fields correctly populated
✅ Expiration date calculated correctly (7 days)
✅ User authentication respected
✅ RLS policies enforced

### User Experience
✅ Clear success messaging
✅ Helpful error messages
✅ Loading states during operations
✅ Easy navigation to My Links page
✅ Option to create multiple links

## Error Scenarios to Test
1. **Network Failure**: Disconnect internet during submission
2. **Authentication Error**: Remove user from database
3. **Permission Error**: Test with incorrect RLS policies
4. **Database Constraint**: Test with invalid data types
5. **Timeout**: Test with very slow network connection

## Visual Verification
- Success checkmark appears
- Loading spinner or text during save
- Error messages in red styling
- Success messages in green/purple styling
- Expiration date formatted properly
- Payment details display correctly

## Debugging Tips
- Check browser console for any JavaScript errors
- Monitor Supabase dashboard for new records
- Check Network tab for API calls to Supabase
- Verify user authentication status
- Check RLS policy permissions in Supabase