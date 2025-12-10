# Role-Based Navigation Test Guide

## Prerequisites
1. Users table must be created in Supabase
2. Users must have a `role` field with values 'Beauty Professional' or 'Beauty Model'

## Manual Testing Steps

### 1. **Start the development server:**
   ```bash
   npm run dev
   ```

### 2. **Test Beauty Professional Navigation:**
   - Sign up/login as a Beauty Professional user
   - Navigate to dashboard (`http://localhost:3000/dashboard`)
   - **Desktop Navigation Should Show:**
     - Dashboard (highlighted/active)
     - Create Payment Link
     - My Links
     - Logout (right-aligned with red hover effect)
   - **Mobile Navigation Should Show:**
     - Menu button with dropdown arrow
     - When clicked, shows same links in vertical layout
     - Menu closes when link is clicked

### 3. **Test Beauty Model Navigation:**
   - Sign up/login as a Beauty Model user
   - Navigate to dashboard (`http://localhost:3000/dashboard`)
   - **Desktop Navigation Should Show:**
     - Dashboard (highlighted/active)
     - Logout (right-aligned with red hover effect)
     - NO Create Payment Link or My Links options
   - **Mobile Navigation Should Show:**
     - Menu button with dropdown arrow
     - When clicked, shows Dashboard and Logout only

### 4. **Test Header Information:**
   - Verify user info shows in header:
     - Username (part before @ in email)
     - Full email address
     - User role (Beauty Professional/Beauty Model)

### 5. **Test Navigation Functionality:**
   - Click Dashboard - should highlight and stay on dashboard
   - Click Create Payment Link - should navigate to `/payment/create`
   - Click My Links - should navigate to `/my-links`
   - Click Logout - should sign out and redirect to `/auth`

### 6. **Test Mobile Responsiveness:**
   - Switch to mobile viewport (< 768px)
   - Navigation should switch to mobile menu
   - Click menu button - dropdown should appear with smooth animation
   - Click any link - menu should close and navigate
   - Test on various mobile screen sizes

### 7. **Test Authentication Flow:**
   - Try accessing dashboard without login - should redirect to auth
   - Login and verify role-based navigation appears correctly
   - Logout and verify redirect to auth page

## Expected Behavior by Role

### Beauty Professional Users
✅ See all navigation options: Dashboard, Create Payment Link, My Links, Logout
✅ Can access payment creation and management features
✅ Role displayed as "Beauty Professional" in header

### Beauty Model Users  
✅ See limited navigation: Dashboard, Logout only
✅ Cannot access payment creation features
✅ Role displayed as "Beauty Model" in header

## Visual/UX Checks

### Desktop Navigation
- Navigation items aligned horizontally
- Dashboard has active state (purple background)
- Hover effects on inactive items
- Logout button right-aligned with red hover
- Consistent spacing and typography

### Mobile Navigation
- Menu button shows dropdown arrow
- Arrow rotates when menu opens
- Navigation items stack vertically in dropdown
- Smooth animations for menu open/close
- Menu closes when selecting a link
- Touch targets are adequate size (44px+)

### Header
- User information clearly displayed
- Role badge shows in purple color
- Layout works on all screen sizes
- Information hierarchy is clear

## Error Cases to Test
- User with no role in database - should handle gracefully
- Database connection issues - should show loading state
- Invalid authentication - should redirect to auth
- Network errors during role fetch - should degrade gracefully

## Navigation Link Testing
Each link should navigate to the correct page:
- `/dashboard` - Dashboard page
- `/payment/create` - Payment creation page  
- `/my-links` - User's payment links page
- Logout action - Signs out and redirects to `/auth`