# Role Selection Test Guide

## Manual Testing Steps

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to the auth page:**
   - Go to `http://localhost:3000/auth`

3. **Test Login Mode (no role selection should show):**
   - Default mode should be "Sign in"
   - Verify no role selection appears
   - Form should only show email and password fields

4. **Test Signup Mode (role selection should appear):**
   - Click "Don't have an account? Sign up"
   - Verify role selection section appears with:
     - "Beauty Professional" option with description
     - "Beauty Model" option with description
   - Both options should be styled with dark theme

5. **Test Role Validation:**
   - Try submitting signup form without selecting a role
   - Should show error message: "Please select your role"
   - Form should not submit

6. **Test Role Selection:**
   - Select "Beauty Professional" - radio button should be highlighted
   - Select "Beauty Model" - should switch selection
   - Only one option should be selectable at a time

7. **Test Mobile Responsiveness:**
   - Test on mobile viewport (developer tools)
   - Role selection cards should stack properly
   - Touch targets should be adequate size

## Expected Behavior

✅ Role selection only appears in signup mode
✅ Both role options are clearly labeled and described
✅ Form validates role selection before submission
✅ Radio buttons follow dark theme styling
✅ Mobile responsive layout
✅ No Admin option visible (database only)

## Visual Checks

- Radio buttons should be purple-themed
- Cards should have hover effects
- Text should be readable on dark background
- Spacing should be consistent with existing form elements