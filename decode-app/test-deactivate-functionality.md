# Deactivate Payment Links Test Guide

## Prerequisites
1. My Links page working with active payment links
2. Supabase database with payment_links table
3. User authentication working
4. At least 2-3 active payment links for testing

## Manual Testing Steps

### 1. **Start the development server:**
   ```bash
   npm run dev
   ```

### 2. **Navigate to My Links page:**
   - Login as Beauty Professional
   - Ensure you have active payment links (create some if needed)
   - Navigate to `http://localhost:3000/my-links`

### 3. **Test Button Visibility:**
   - **Active links** should show red "Deactivate" button with X icon
   - **Expired links** should NOT show deactivate button (no longer needed)
   - **Inactive links** should NOT show deactivate button (already inactive)
   - Only "Active" status links should have the deactivate option

### 4. **Test Confirmation Dialog:**
   - Click "Deactivate" button on an active payment link
   - **Expected behavior:**
     - Modal dialog appears with dark overlay
     - Dialog shows "Deactivate Payment Link" title
     - Shows service name in quotes: "Hair Styling Session"
     - Shows warning message about preventing customer payments
     - Shows payment amount: "Amount: $75.00"
     - Two buttons: "Cancel" (gray) and "Deactivate Link" (red)

### 5. **Test Dialog Cancellation:**
   - Open confirmation dialog
   - Click "Cancel" button
   - **Expected behavior:**
     - Dialog closes
     - No changes to payment link
     - Payment link remains active
     - Page returns to normal state

### 6. **Test Successful Deactivation:**
   - Open confirmation dialog
   - Click "Deactivate Link" button
   - **Expected behavior:**
     - Dialog closes immediately
     - Deactivate button shows "Deactivating..." with spinner
     - After completion:
       - Status badge changes from "Active" (green) to "Inactive" (gray)
       - Deactivate button disappears (no longer needed)
       - Success message: "Payment link deactivated successfully!" (green)
       - Success message auto-dismisses after 3 seconds

### 7. **Test Database Updates:**
   - After successful deactivation, check Supabase dashboard
   - Verify the payment_links record has `is_active = false`
   - Other fields should remain unchanged
   - created_at and other timestamps should be preserved

### 8. **Test Page State Updates:**
   - After deactivation, refresh the page
   - Deactivated link should still show as "Inactive"
   - Status should persist across page reloads
   - No deactivate button should appear for the inactive link

### 9. **Test Multiple Link Deactivation:**
   - Deactivate first payment link
   - While success message is still showing, deactivate another link
   - **Expected behavior:**
     - Each deactivation works independently
     - Success message updates for the latest action
     - Both links end up as "Inactive"
     - No interference between operations

### 10. **Test Button States:**
   #### During Deactivation:
   - Deactivate button shows spinner + "Deactivating..."
   - Deactivate button is disabled
   - Copy button is also disabled (prevents conflicts)
   - Other payment links' buttons remain functional

   #### After Deactivation:
   - Deactivate button disappears completely
   - Copy button remains functional
   - Status reflects new "Inactive" state

### 11. **Test Error Handling:**
   #### Simulate Database Error:
   - Temporarily break Supabase connection
   - Or modify payment link ID to invalid value
   - Attempt deactivation
   - **Expected behavior:**
     - Button shows "Deactivating..." then returns to normal
     - Error message: "Failed to deactivate payment link. Please try again." (red)
     - Payment link remains active
     - User can retry the operation

### 12. **Test Mobile Responsiveness:**
   - Switch to mobile viewport
   - Test confirmation dialog on mobile:
     - Dialog should be responsive and readable
     - Buttons should be touch-friendly
     - Dialog should fit mobile screen
   - Test deactivate button on mobile:
     - Button should be adequately sized for touch
     - Loading states should be visible

### 13. **Test Edge Cases:**
   #### Rapid Clicking:
   - Rapidly click deactivate button multiple times
   - Should only trigger one deactivation operation
   - Button should become disabled after first click

   #### Dialog During Copy Operation:
   - Start copying a payment link
   - Try to open deactivate dialog during copy
   - Deactivate button should be disabled during copy

   #### Multiple Browser Tabs:
   - Open same My Links page in two tabs
   - Deactivate a link in one tab
   - Refresh the other tab - should show updated status

## Expected Behavior

### Button Logic
✅ Deactivate button only appears for "Active" status links
✅ Button disappears after successful deactivation
✅ Button shows loading state during operation
✅ Button is disabled during copy operations

### Confirmation Dialog
✅ Modal overlay with dark background
✅ Shows payment link details (title, amount)
✅ Clear warning message about consequences
✅ Cancel and Deactivate buttons with proper styling
✅ Closes on successful action or cancellation

### Database Operations
✅ Updates is_active field to false in Supabase
✅ Preserves all other payment link data
✅ Change persists across page reloads
✅ Respects RLS policies (user can only deactivate own links)

### UI Updates
✅ Status badge changes from "Active" (green) to "Inactive" (gray)
✅ Deactivate button disappears after deactivation
✅ Success/error messages with appropriate styling
✅ Real-time updates without page refresh

### Error Handling
✅ Database errors show user-friendly messages
✅ Network failures are handled gracefully
✅ Failed operations don't change link status
✅ User can retry after errors

## Database Verification
After deactivation, verify in Supabase:
```sql
SELECT id, title, amount_usd, is_active, created_at 
FROM payment_links 
WHERE creator_id = 'user-uuid'
ORDER BY created_at DESC;
```

## Security Considerations
- RLS policies prevent users from deactivating others' links
- Only payment link creator can deactivate their own links
- Deactivation is irreversible through UI (admin could reactivate via database)
- No sensitive data exposed in confirmation dialog

## Performance Notes
- Deactivation updates local state immediately for responsive UX
- Database update happens asynchronously
- Page doesn't need to refresh to show changes
- Minimal API calls (only the update operation)