# Email Verification Customization Guide

## Customizing Supabase Email Templates

### 1. Access Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Settings** → **Email Templates**

### 2. Available Email Templates
- **Confirm signup** - Email sent when user registers
- **Magic Link** - Passwordless login emails  
- **Change Email Address** - When user changes email
- **Reset Password** - Password reset emails

### 3. Customizing the Signup Confirmation Email

**Current Default Subject:** `Confirm your signup`

**To customize:**
1. Click on **"Confirm signup"** template
2. Edit the **Subject** field:
   ```
   Verify your DECODE account
   ```

3. Edit the **Body** template (HTML):
   ```html
   <h2>Welcome to DECODE!</h2>
   <p>Thank you for joining our beauty platform.</p>
   <p>Please click the link below to verify your email address and complete your registration:</p>
   <p><a href="{{ .ConfirmationURL }}">Verify Email Address</a></p>
   <p>This link will expire in {{ .TokenExpiry }} hours.</p>
   
   <p>If you didn't create a DECODE account, you can safely ignore this email.</p>
   
   <p>Best regards,<br>
   The DECODE Team</p>
   ```

### 4. Custom Variables Available
- `{{ .ConfirmationURL }}` - The verification link
- `{{ .TokenExpiry }}` - Hours until link expires (default: 24)
- `{{ .Email }}` - User's email address
- `{{ .SiteURL }}` - Your site URL from settings

### 5. Advanced Customization Options

**Add your logo:**
```html
<img src="https://your-domain.com/logo.png" alt="DECODE" style="width: 120px; margin-bottom: 20px;">
```

**Custom styling:**
```html
<div style="max-width: 600px; margin: 0 auto; font-family: 'Inter', sans-serif;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Welcome to DECODE</h1>
  </div>
  <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 8px 8px;">
    <!-- Email content here -->
  </div>
</div>
```

### 6. Current In-App Messages

**Files with verification messages:**
- `app/verify-email/page.tsx` - Main verification screen
- `app/auth/page.tsx` - Auth page fallback messages

**To change the in-app verification messages:**

1. **Main heading** (line 34 in verify-email/page.tsx):
   ```tsx
   <h1 className="cosmic-heading text-2xl mb-2">Check Your Email</h1>
   ```

2. **Description** (line 35-37):
   ```tsx
   <p className="cosmic-body opacity-70 text-sm">
     We've sent a verification link to your email address.
   </p>
   ```

3. **Instructions** (line 51-56):
   ```tsx
   <div className="text-xs text-gray-400 space-y-1">
     <p>• Check your spam folder if you don't see the email</p>
     <p>• The verification link expires in 24 hours</p>
     <p>• You can close this tab after clicking the link</p>
   </div>
   ```

### 7. Testing Email Templates

1. **Save** your template changes in Supabase
2. Test by registering a new user
3. Check that emails are delivered with your custom content

### 8. Email Delivery Settings

**SMTP Configuration (Optional):**
- By default, Supabase uses their SMTP
- For custom branding, configure your own SMTP in **Authentication** → **Settings** → **SMTP Settings**

**Domain Setup:**
- For production, use your own domain for better deliverability
- Configure DNS records as shown in Supabase dashboard

---

## Quick Changes Summary

**Most Important Customizations:**
1. ✅ Email subject: `"Verify your DECODE account"`
2. ✅ Welcome message: `"Welcome to DECODE!"`
3. ✅ Button text: `"Verify Email Address"`
4. ✅ Expiry notice: `"This link expires in 24 hours"`
5. ✅ Signature: `"The DECODE Team"`