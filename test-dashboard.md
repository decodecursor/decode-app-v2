# Dashboard Layout Test Guide

## Manual Testing Steps

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test Authentication Flow:**
   - Go to `http://localhost:3000/dashboard` (without being logged in)
   - Should redirect to `/auth` automatically
   - Sign in with valid credentials
   - Should redirect back to dashboard

3. **Test Header Layout:**
   - Verify DECODE logo appears on the left
   - Check user name displays (first part of email before @)
   - Verify full email shows below username (desktop only)
   - Confirm "Sign out" button is visible on desktop

4. **Test Mobile Responsiveness:**
   - Switch to mobile viewport in developer tools
   - Verify hamburger menu button appears
   - Click hamburger menu - should show mobile menu with:
     - User name and email
     - Sign out button
   - Test menu toggle (open/close)

5. **Test Navigation Menu:**
   - Verify navigation appears below header
   - Check all navigation links:
     - Dashboard (should be highlighted/active)
     - Create Payment Link
     - Transactions  
     - Profile
   - Test hover effects on navigation items

6. **Test Welcome Message:**
   - Verify personalized welcome message shows user's name
   - Example: "Welcome back, john!" (if email is john@example.com)
   - Confirm welcome text describes the platform

7. **Test Logout Functionality:**
   - Click "Sign out" button (desktop or mobile menu)
   - Should redirect to `/auth` page
   - Try accessing `/dashboard` again - should redirect to auth

8. **Test Loading State:**
   - Refresh page while logged in
   - Should show loading message briefly
   - Then load dashboard with user data

## Expected Behavior

✅ Authentication required to access dashboard
✅ User name displayed in header from email
✅ Mobile-responsive header with hamburger menu
✅ Navigation menu with proper styling
✅ Personalized welcome message
✅ Proper logout functionality with Supabase
✅ Loading state while fetching user data
✅ Responsive layout on all screen sizes

## Visual Checks

- Header maintains cosmic/dark theme styling
- Navigation items have hover effects
- Mobile menu slides in properly
- User info is readable and well-positioned
- All buttons are properly styled
- Layout works on mobile, tablet, and desktop viewports