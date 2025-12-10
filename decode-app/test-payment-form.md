# Payment Link Form Test Guide

## Manual Testing Steps

### 1. **Start the development server:**
   ```bash
   npm run dev
   ```

### 2. **Access the Form:**
   - Navigate to `http://localhost:3000/payment/create`
   - Should redirect to auth if not logged in
   - Login as Beauty Professional user (only they should have access)

### 3. **Test Form Fields:**

#### Service Title Field:
   - **Label**: "Service Title"
   - **Placeholder**: "e.g., Hair Styling, Makeup Session, Manicure"
   - **Validation**: Required field
   - Try submitting empty - should show "Service title is required"
   - Enter text - error should clear immediately

#### Amount in USD Field:
   - **Label**: "Amount in USD"
   - **Dollar sign**: Should appear on the left side
   - **Placeholder**: "0.00"
   - **Validation**: Required, must be > 0
   - Try submitting empty - should show "Amount is required"
   - Try entering 0 or negative - should show "Please enter a valid amount greater than $0"
   - Try entering text - should be prevented or show validation error
   - Enter valid amount - error should clear immediately

### 4. **Test Form Validation:**
   - Submit form with empty fields - should show both error messages
   - Fill only Service Title - should still show amount error
   - Fill only Amount - should still show title error
   - Fill both fields correctly - should submit successfully

### 5. **Test Form Submission:**
   - Fill both fields with valid data
   - Click "Create Payment Link" button
   - Button should change to "Creating Link..." and be disabled
   - Should show success state with:
     - Green checkmark icon
     - "Payment Link Created!" message
     - Payment details showing service and amount
     - Generated payment link
     - Copy button for the link
     - "Create Another Link" and "Back to Dashboard" buttons

### 6. **Test Mobile Responsiveness:**
   - Switch to mobile viewport (< 768px)
   - Form should stack properly
   - Input fields should be full width
   - Touch targets should be adequate size
   - Text should be readable
   - Button should be full width

### 7. **Test Navigation:**
   - "Back to Dashboard" link should work
   - In success state, "Back to Dashboard" button should work
   - "Create Another Link" should reset form

## Expected Behavior

### Form Validation
✅ Service Title: Required text field
✅ Amount: Required number field, must be > 0
✅ Real-time validation error clearing
✅ Submit blocked until all fields valid

### Visual Design
✅ Dark theme consistent with app
✅ Purple accent colors
✅ Red error messages below fields
✅ Fields highlight red border when invalid
✅ Dollar sign positioned correctly in amount field

### Mobile Responsive
✅ Form stacks vertically on mobile
✅ Full-width inputs and buttons
✅ Proper spacing and typography
✅ Touch-friendly button sizes

### Submit Behavior
✅ Button disables during submission
✅ Loading state shows "Creating Link..."
✅ Success state shows payment details
✅ Generated link can be copied
✅ Form can be reset for another link

## Error Cases to Test
- Submit with empty fields
- Submit with invalid amount (0, negative, text)
- Test form while loading/disabled state
- Test navigation without authentication
- Test with very long service titles
- Test with very large amounts

## Visual Checks
- Form fits well in cosmic-card container
- Proper spacing between elements
- Error messages appear smoothly
- Button styling matches app theme
- Success state is visually clear and celebratory
- Back navigation is intuitive

## Accessibility
- Form labels are properly associated
- Error messages are descriptive
- Focus states are visible
- Form can be navigated with keyboard
- Button states are clear