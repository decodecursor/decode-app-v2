# Copy Link Functionality Test Guide

## Prerequisites
1. My Links page working with payment links displayed
2. Modern browser with clipboard support
3. Test on both secure (HTTPS) and insecure (HTTP) contexts

## Manual Testing Steps

### 1. **Start the development server:**
   ```bash
   npm run dev
   ```

### 2. **Navigate to My Links page:**
   - Login as Beauty Professional
   - Create 2-3 payment links if none exist
   - Navigate to `http://localhost:3000/my-links`

### 3. **Test Payment URL Generation:**
   - Verify each payment link card shows:
     - "Payment Link:" label
     - Generated URL in format: `http://localhost:3000/pay/{linkId}`
     - URL displayed in monospace font
     - URL truncates if too long (responsive design)

### 4. **Test Copy Button Appearance:**
   - Each payment link should have "Copy Link" button
   - Button should show copy icon + "Copy Link" text
   - Button styled with cosmic theme (border, hover effects)
   - Button should be right-aligned next to the URL

### 5. **Test Copy Functionality - Desktop:**
   #### Modern Browser (Chrome, Firefox, Safari, Edge):
   - Click "Copy Link" button
   - **Expected behavior:**
     - Button changes to "Copying..." with spinner
     - Button becomes disabled during copy
     - Success message appears: "Payment link copied to clipboard!"
     - Message disappears after 3 seconds
     - Button returns to normal state

   #### Verify Clipboard Content:
   - After copying, paste (Ctrl+V / Cmd+V) into text editor
   - Should paste the complete payment URL
   - URL should match what's displayed in the card

### 6. **Test Copy Functionality - Mobile:**
   - Switch to mobile viewport (or use actual mobile device)
   - Test copy functionality on mobile browsers:
     - iOS Safari
     - Android Chrome
     - Mobile Firefox
   - Copy behavior should be identical to desktop
   - Touch targets should be adequate size

### 7. **Test Multiple Links Copying:**
   - Copy first payment link
   - Immediately try copying second payment link
   - Each should work independently
   - Only the clicked button should show "Copying..." state
   - Success message should update for each copy

### 8. **Test Error Handling:**
   #### Simulate Copy Failure:
   - In browser dev tools, temporarily override navigator.clipboard
   - Or test in very old browser without clipboard support
   - **Expected behavior:**
     - Should fall back to document.execCommand method
     - If that fails, show error message: "Failed to copy link. Please try again."
     - Error message should be red styling
     - Message should disappear after 3 seconds

### 9. **Test Fallback Method:**
   #### For browsers without Clipboard API:
   - The code includes fallback using textarea + document.execCommand
   - Test in older browsers or with clipboard API disabled
   - Should still successfully copy to clipboard

### 10. **Test Success Message Display:**
   - Success message should appear in cosmic-card above payment links
   - Green styling for success: "Payment link copied to clipboard!"
   - Red styling for errors: "Failed to copy link. Please try again."
   - Message should auto-dismiss after 3 seconds
   - Multiple copies should update the same message area

### 11. **Test Loading States:**
   - Click copy button
   - During copy operation:
     - Button shows spinning icon + "Copying..."
     - Button is disabled (not clickable)
     - Other copy buttons remain functional
   - After copy completes:
     - Button returns to normal state
     - All buttons become clickable again

### 12. **Test URL Format:**
   - Generated URLs should follow pattern: `{origin}/pay/{linkId}`
   - Link IDs should be valid UUIDs from database
   - URLs should be absolute (include protocol and domain)
   - URLs should work consistently across different environments

## Expected Behavior

### URL Generation
✅ URLs generated in format: `{origin}/pay/{linkId}`
✅ Uses actual payment link ID from database
✅ URLs are absolute with full domain
✅ URLs display in monospace font with truncation

### Copy Functionality
✅ Modern browsers: Uses navigator.clipboard.writeText()
✅ Legacy browsers: Falls back to document.execCommand('copy')
✅ Mobile browsers: Works on iOS Safari, Android Chrome
✅ Error handling for copy failures

### UI States
✅ Default state: Copy icon + "Copy Link" text
✅ Loading state: Spinner + "Copying..." text + disabled
✅ Success: Green message + auto-dismiss after 3s
✅ Error: Red message + auto-dismiss after 3s

### Mobile Responsiveness
✅ Copy buttons remain functional on mobile
✅ Touch targets are adequate size (44px minimum)
✅ Success messages display properly on small screens
✅ URL truncation works on narrow screens

## Technical Verification

### Browser Compatibility
- **Modern browsers** (Chrome 66+, Firefox 63+, Safari 13.1+, Edge 79+): Uses Clipboard API
- **Legacy browsers**: Falls back to document.execCommand
- **Mobile browsers**: Works on iOS 13.4+ Safari, Android Chrome 66+

### Security Context
- **HTTPS/localhost**: Uses modern Clipboard API
- **HTTP (insecure context)**: Falls back to legacy method
- **File:// protocol**: Falls back to legacy method

### Error Scenarios
1. **Clipboard permission denied**: Shows error message
2. **Network issues**: Copy still works (client-side operation)
3. **Very old browsers**: Fallback method handles most cases
4. **Copy API unavailable**: Graceful degradation to textarea method

## Debugging Tips
- Check browser console for any JavaScript errors
- Test clipboard permissions in browser settings
- Verify secure context (HTTPS) for modern Clipboard API
- Test fallback by disabling navigator.clipboard in dev tools
- Check Network tab for any unexpected API calls during copy
- Test with various URL lengths to verify truncation

## Accessibility Notes
- Copy buttons have proper ARIA labels
- Loading states are clearly indicated
- Success/error messages are announced to screen readers
- Keyboard navigation works for copy buttons
- Focus states are visible and consistent