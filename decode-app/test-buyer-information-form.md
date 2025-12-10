# Buyer Information Form Test Guide

## Overview
The buyer information form on the public payment page (`/pay/[linkId]`) collects optional email information from customers before proceeding to payment processing.

## Manual Testing Steps

### 1. **Start the development server:**
   ```bash
   npm run dev
   ```

### 2. **Navigate to Payment Page:**
   - Get a valid payment link from My Links page
   - Navigate to `http://localhost:3000/pay/{validLinkId}`
   - Verify payment page loads with service details

### 3. **Test Form Layout:**
   - **Expected sections:**
     - Service details (title, amount, professional info)
     - "Contact Information" section with email field
     - "Continue to Payment" button
   - **Form positioning:** Between payment details and button
   - **Consistent styling:** Matches payment page design

### 4. **Test Email Field - Empty State:**
   - Leave email field empty
   - Click "Continue to Payment"
   - **Expected behavior:**
     - No validation errors (email is optional)
     - Payment process should proceed
     - Alert shows "Buyer email: Not provided"

### 5. **Test Email Field - Valid Email:**
   - Enter valid email: `test@example.com`
   - Click "Continue to Payment"
   - **Expected behavior:**
     - No validation errors
     - Payment process proceeds
     - Alert shows "Buyer email: test@example.com"
     - Console logs buyer information object

### 6. **Test Email Validation - Invalid Format:**
   - Enter invalid emails and test each:
     - `invalid-email` (no @ or domain)
     - `test@` (no domain)
     - `@example.com` (no local part)
     - `test@.com` (invalid domain)
     - `test@example` (no TLD)
   - **Expected behavior:**
     - Red border on input field
     - Error message: "Please enter a valid email address"
     - Button disabled while error exists
     - Error clears when user starts typing valid email

### 7. **Test Real-time Validation:**
   - Enter invalid email and click outside field (onBlur)
   - Verify error appears
   - Start typing valid email
   - Verify error clears immediately
   - Complete valid email
   - Verify button becomes enabled

### 8. **Test Button States:**
   #### Default State:
   - Purple background (`bg-purple-600`)
   - "Continue to Payment" text
   - Enabled when no email errors

   #### Processing State:
   - Triggered when clicking "Continue to Payment"
   - Shows spinning loader icon
   - Text changes to "Processing..."
   - Button disabled during processing
   - Gray background

   #### Error State:
   - When email validation fails
   - Gray background
   - Button disabled
   - Cannot proceed until error resolved

### 9. **Test Mobile Responsiveness:**
   - Switch to mobile viewport (< 768px)
   - **Expected behavior:**
     - Form stacks properly
     - Input field full width
     - Button remains full width
     - Touch targets adequate size
     - Text remains readable

### 10. **Test Form Accessibility:**
   - Use keyboard navigation (Tab key)
   - Verify focus states are visible
   - Test with screen reader
   - Verify proper label associations
   - Check color contrast meets standards

### 11. **Test Data Collection:**
   - Fill form with various email formats
   - Check browser console for logged data
   - **Expected data structure:**
     ```javascript
     {
       email: "test@example.com" | null,
       paymentLinkId: "uuid",
       amount: 75.00,
       serviceTitle: "Hair Styling Session"
     }
     ```

### 12. **Test Error Handling:**
   - Simulate JavaScript error in handleContinueToPayment
   - Verify error alert appears
   - Verify button returns to normal state
   - Verify form remains functional after error

## Expected Behavior

### Form Layout
✅ "Contact Information" section header
✅ Helpful explanatory text about optional email
✅ Labeled email input field with placeholder
✅ Clear visual separation from payment details
✅ Consistent styling with payment page

### Email Validation
✅ Optional field (empty is valid)
✅ Real-time format validation
✅ Error display with red styling
✅ Error clearing when user types
✅ Button disabled during validation errors

### Button Functionality
✅ Default: Purple "Continue to Payment"
✅ Processing: Gray with spinner "Processing..."
✅ Disabled: Gray when validation errors exist
✅ Proper loading states and transitions

### Data Management
✅ Email stored in component state
✅ Validation state properly managed
✅ Buyer information prepared for payment processor
✅ Console logging for debugging

### User Experience
✅ Professional, trustworthy appearance
✅ Clear guidance about optional email
✅ Immediate feedback on validation errors
✅ Smooth transitions and animations
✅ Mobile-responsive design

## Visual Design Verification

### Styling Consistency:
- Input field matches payment page design
- Purple accent colors for focus states
- Consistent border radius and spacing
- Professional typography hierarchy

### Error States:
- Red border for invalid input
- Red text for error messages
- Clear error messaging
- Proper contrast ratios

### Button Design:
- Purple primary button color
- Smooth hover transitions
- Loading spinner properly centered
- Disabled state clearly indicated

## Integration Readiness

### Payment Processor Integration:
- Buyer email collected and validated
- Payment link data accessible
- Amount and service info prepared
- Ready for Stripe, PayPal, or other processors

### Data Structure:
```javascript
const buyerInfo = {
  email: string | null,
  paymentLinkId: string,
  amount: number,
  serviceTitle: string
}
```

### Future Enhancements Ready:
- Additional buyer fields (name, phone)
- Address collection for shipping
- Payment method selection
- Terms and conditions acceptance

## Security Considerations
- Email validation prevents basic injection
- No sensitive data stored in component state
- Proper form sanitization
- Ready for secure payment processor integration