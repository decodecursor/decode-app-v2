'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getUserWithProxy } from '@/utils/auth-helper'
import RoleSelectionModal from '@/components/RoleSelectionModal'
import { safeLocalStorage, safeSessionStorage } from '@/utils/storage-helper'

// Country codes for phone input
const COUNTRY_CODES = [
  // Popular countries (top of list)
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+1', country: 'USA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬' },
  // All countries A-Z
  { code: '+93', country: 'Afghanistan', flag: '🇦🇫' },
  { code: '+355', country: 'Albania', flag: '🇦🇱' },
  { code: '+213', country: 'Algeria', flag: '🇩🇿' },
  { code: '+1684', country: 'American Samoa', flag: '🇦🇸' },
  { code: '+376', country: 'Andorra', flag: '🇦🇩' },
  { code: '+244', country: 'Angola', flag: '🇦🇴' },
  { code: '+1264', country: 'Anguilla', flag: '🇦🇮' },
  { code: '+1268', country: 'Antigua and Barbuda', flag: '🇦🇬' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+374', country: 'Armenia', flag: '🇦🇲' },
  { code: '+297', country: 'Aruba', flag: '🇦🇼' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+43', country: 'Austria', flag: '🇦🇹' },
  { code: '+994', country: 'Azerbaijan', flag: '🇦🇿' },
  { code: '+1242', country: 'Bahamas', flag: '🇧🇸' },
  { code: '+973', country: 'Bahrain', flag: '🇧🇭' },
  { code: '+880', country: 'Bangladesh', flag: '🇧🇩' },
  { code: '+1246', country: 'Barbados', flag: '🇧🇧' },
  { code: '+375', country: 'Belarus', flag: '🇧🇾' },
  { code: '+32', country: 'Belgium', flag: '🇧🇪' },
  { code: '+501', country: 'Belize', flag: '🇧🇿' },
  { code: '+229', country: 'Benin', flag: '🇧🇯' },
  { code: '+1441', country: 'Bermuda', flag: '🇧🇲' },
  { code: '+975', country: 'Bhutan', flag: '🇧🇹' },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴' },
  { code: '+387', country: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  { code: '+267', country: 'Botswana', flag: '🇧🇼' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+673', country: 'Brunei', flag: '🇧🇳' },
  { code: '+359', country: 'Bulgaria', flag: '🇧🇬' },
  { code: '+226', country: 'Burkina Faso', flag: '🇧🇫' },
  { code: '+257', country: 'Burundi', flag: '🇧🇮' },
  { code: '+855', country: 'Cambodia', flag: '🇰🇭' },
  { code: '+237', country: 'Cameroon', flag: '🇨🇲' },
  { code: '+1', country: 'Canada', flag: '🇨🇦' },
  { code: '+238', country: 'Cape Verde', flag: '🇨🇻' },
  { code: '+1345', country: 'Cayman Islands', flag: '🇰🇾' },
  { code: '+236', country: 'Central African Republic', flag: '🇨🇫' },
  { code: '+235', country: 'Chad', flag: '🇹🇩' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+269', country: 'Comoros', flag: '🇰🇲' },
  { code: '+242', country: 'Congo', flag: '🇨🇬' },
  { code: '+243', country: 'Congo (DRC)', flag: '🇨🇩' },
  { code: '+682', country: 'Cook Islands', flag: '🇨🇰' },
  { code: '+506', country: 'Costa Rica', flag: '🇨🇷' },
  { code: '+225', country: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { code: '+385', country: 'Croatia', flag: '🇭🇷' },
  { code: '+53', country: 'Cuba', flag: '🇨🇺' },
  { code: '+357', country: 'Cyprus', flag: '🇨🇾' },
  { code: '+420', country: 'Czech Republic', flag: '🇨🇿' },
  { code: '+45', country: 'Denmark', flag: '🇩🇰' },
  { code: '+253', country: 'Djibouti', flag: '🇩🇯' },
  { code: '+1767', country: 'Dominica', flag: '🇩🇲' },
  { code: '+1809', country: 'Dominican Republic', flag: '🇩🇴' },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨' },
  { code: '+503', country: 'El Salvador', flag: '🇸🇻' },
  { code: '+240', country: 'Equatorial Guinea', flag: '🇬🇶' },
  { code: '+291', country: 'Eritrea', flag: '🇪🇷' },
  { code: '+372', country: 'Estonia', flag: '🇪🇪' },
  { code: '+251', country: 'Ethiopia', flag: '🇪🇹' },
  { code: '+500', country: 'Falkland Islands', flag: '🇫🇰' },
  { code: '+298', country: 'Faroe Islands', flag: '🇫🇴' },
  { code: '+679', country: 'Fiji', flag: '🇫🇯' },
  { code: '+358', country: 'Finland', flag: '🇫🇮' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+594', country: 'French Guiana', flag: '🇬🇫' },
  { code: '+689', country: 'French Polynesia', flag: '🇵🇫' },
  { code: '+241', country: 'Gabon', flag: '🇬🇦' },
  { code: '+220', country: 'Gambia', flag: '🇬🇲' },
  { code: '+995', country: 'Georgia', flag: '🇬🇪' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+233', country: 'Ghana', flag: '🇬🇭' },
  { code: '+350', country: 'Gibraltar', flag: '🇬🇮' },
  { code: '+30', country: 'Greece', flag: '🇬🇷' },
  { code: '+299', country: 'Greenland', flag: '🇬🇱' },
  { code: '+1473', country: 'Grenada', flag: '🇬🇩' },
  { code: '+590', country: 'Guadeloupe', flag: '🇬🇵' },
  { code: '+1671', country: 'Guam', flag: '🇬🇺' },
  { code: '+502', country: 'Guatemala', flag: '🇬🇹' },
  { code: '+224', country: 'Guinea', flag: '🇬🇳' },
  { code: '+245', country: 'Guinea-Bissau', flag: '🇬🇼' },
  { code: '+592', country: 'Guyana', flag: '🇬🇾' },
  { code: '+509', country: 'Haiti', flag: '🇭🇹' },
  { code: '+504', country: 'Honduras', flag: '🇭🇳' },
  { code: '+852', country: 'Hong Kong', flag: '🇭🇰' },
  { code: '+36', country: 'Hungary', flag: '🇭🇺' },
  { code: '+354', country: 'Iceland', flag: '🇮🇸' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+98', country: 'Iran', flag: '🇮🇷' },
  { code: '+964', country: 'Iraq', flag: '🇮🇶' },
  { code: '+353', country: 'Ireland', flag: '🇮🇪' },
  { code: '+972', country: 'Israel', flag: '🇮🇱' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+1876', country: 'Jamaica', flag: '🇯🇲' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+962', country: 'Jordan', flag: '🇯🇴' },
  { code: '+7', country: 'Kazakhstan', flag: '🇰🇿' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+686', country: 'Kiribati', flag: '🇰🇮' },
  { code: '+383', country: 'Kosovo', flag: '🇽🇰' },
  { code: '+965', country: 'Kuwait', flag: '🇰🇼' },
  { code: '+996', country: 'Kyrgyzstan', flag: '🇰🇬' },
  { code: '+856', country: 'Laos', flag: '🇱🇦' },
  { code: '+371', country: 'Latvia', flag: '🇱🇻' },
  { code: '+961', country: 'Lebanon', flag: '🇱🇧' },
  { code: '+266', country: 'Lesotho', flag: '🇱🇸' },
  { code: '+231', country: 'Liberia', flag: '🇱🇷' },
  { code: '+218', country: 'Libya', flag: '🇱🇾' },
  { code: '+423', country: 'Liechtenstein', flag: '🇱🇮' },
  { code: '+370', country: 'Lithuania', flag: '🇱🇹' },
  { code: '+352', country: 'Luxembourg', flag: '🇱🇺' },
  { code: '+853', country: 'Macau', flag: '🇲🇴' },
  { code: '+389', country: 'Macedonia', flag: '🇲🇰' },
  { code: '+261', country: 'Madagascar', flag: '🇲🇬' },
  { code: '+265', country: 'Malawi', flag: '🇲🇼' },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+960', country: 'Maldives', flag: '🇲🇻' },
  { code: '+223', country: 'Mali', flag: '🇲🇱' },
  { code: '+356', country: 'Malta', flag: '🇲🇹' },
  { code: '+692', country: 'Marshall Islands', flag: '🇲🇭' },
  { code: '+596', country: 'Martinique', flag: '🇲🇶' },
  { code: '+222', country: 'Mauritania', flag: '🇲🇷' },
  { code: '+230', country: 'Mauritius', flag: '🇲🇺' },
  { code: '+262', country: 'Mayotte', flag: '🇾🇹' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽' },
  { code: '+691', country: 'Micronesia', flag: '🇫🇲' },
  { code: '+373', country: 'Moldova', flag: '🇲🇩' },
  { code: '+377', country: 'Monaco', flag: '🇲🇨' },
  { code: '+976', country: 'Mongolia', flag: '🇲🇳' },
  { code: '+382', country: 'Montenegro', flag: '🇲🇪' },
  { code: '+1664', country: 'Montserrat', flag: '🇲🇸' },
  { code: '+212', country: 'Morocco', flag: '🇲🇦' },
  { code: '+258', country: 'Mozambique', flag: '🇲🇿' },
  { code: '+95', country: 'Myanmar', flag: '🇲🇲' },
  { code: '+264', country: 'Namibia', flag: '🇳🇦' },
  { code: '+674', country: 'Nauru', flag: '🇳🇷' },
  { code: '+977', country: 'Nepal', flag: '🇳🇵' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+687', country: 'New Caledonia', flag: '🇳🇨' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '+505', country: 'Nicaragua', flag: '🇳🇮' },
  { code: '+227', country: 'Niger', flag: '🇳🇪' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+683', country: 'Niue', flag: '🇳🇺' },
  { code: '+850', country: 'North Korea', flag: '🇰🇵' },
  { code: '+47', country: 'Norway', flag: '🇳🇴' },
  { code: '+968', country: 'Oman', flag: '🇴🇲' },
  { code: '+92', country: 'Pakistan', flag: '🇵🇰' },
  { code: '+680', country: 'Palau', flag: '🇵🇼' },
  { code: '+970', country: 'Palestine', flag: '🇵🇸' },
  { code: '+507', country: 'Panama', flag: '🇵🇦' },
  { code: '+675', country: 'Papua New Guinea', flag: '🇵🇬' },
  { code: '+595', country: 'Paraguay', flag: '🇵🇾' },
  { code: '+51', country: 'Peru', flag: '🇵🇪' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭' },
  { code: '+48', country: 'Poland', flag: '🇵🇱' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹' },
  { code: '+1787', country: 'Puerto Rico', flag: '🇵🇷' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦' },
  { code: '+262', country: 'Réunion', flag: '🇷🇪' },
  { code: '+40', country: 'Romania', flag: '🇷🇴' },
  { code: '+7', country: 'Russia', flag: '🇷🇺' },
  { code: '+250', country: 'Rwanda', flag: '🇷🇼' },
  { code: '+290', country: 'Saint Helena', flag: '🇸🇭' },
  { code: '+1869', country: 'Saint Kitts and Nevis', flag: '🇰🇳' },
  { code: '+1758', country: 'Saint Lucia', flag: '🇱🇨' },
  { code: '+508', country: 'Saint Pierre and Miquelon', flag: '🇵🇲' },
  { code: '+1784', country: 'Saint Vincent and the Grenadines', flag: '🇻🇨' },
  { code: '+685', country: 'Samoa', flag: '🇼🇸' },
  { code: '+378', country: 'San Marino', flag: '🇸🇲' },
  { code: '+239', country: 'São Tomé and Príncipe', flag: '🇸🇹' },
  { code: '+221', country: 'Senegal', flag: '🇸🇳' },
  { code: '+381', country: 'Serbia', flag: '🇷🇸' },
  { code: '+248', country: 'Seychelles', flag: '🇸🇨' },
  { code: '+232', country: 'Sierra Leone', flag: '🇸🇱' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+421', country: 'Slovakia', flag: '🇸🇰' },
  { code: '+386', country: 'Slovenia', flag: '🇸🇮' },
  { code: '+677', country: 'Solomon Islands', flag: '🇸🇧' },
  { code: '+252', country: 'Somalia', flag: '🇸🇴' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+211', country: 'South Sudan', flag: '🇸🇸' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+94', country: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+249', country: 'Sudan', flag: '🇸🇩' },
  { code: '+597', country: 'Suriname', flag: '🇸🇷' },
  { code: '+268', country: 'Swaziland', flag: '🇸🇿' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+963', country: 'Syria', flag: '🇸🇾' },
  { code: '+886', country: 'Taiwan', flag: '🇹🇼' },
  { code: '+992', country: 'Tajikistan', flag: '🇹🇯' },
  { code: '+255', country: 'Tanzania', flag: '🇹🇿' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+670', country: 'Timor-Leste', flag: '🇹🇱' },
  { code: '+228', country: 'Togo', flag: '🇹🇬' },
  { code: '+690', country: 'Tokelau', flag: '🇹🇰' },
  { code: '+676', country: 'Tonga', flag: '🇹🇴' },
  { code: '+1868', country: 'Trinidad and Tobago', flag: '🇹🇹' },
  { code: '+216', country: 'Tunisia', flag: '🇹🇳' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷' },
  { code: '+993', country: 'Turkmenistan', flag: '🇹🇲' },
  { code: '+1649', country: 'Turks and Caicos Islands', flag: '🇹🇨' },
  { code: '+688', country: 'Tuvalu', flag: '🇹🇻' },
  { code: '+256', country: 'Uganda', flag: '🇺🇬' },
  { code: '+380', country: 'Ukraine', flag: '🇺🇦' },
  { code: '+598', country: 'Uruguay', flag: '🇺🇾' },
  { code: '+998', country: 'Uzbekistan', flag: '🇺🇿' },
  { code: '+678', country: 'Vanuatu', flag: '🇻🇺' },
  { code: '+379', country: 'Vatican City', flag: '🇻🇦' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
  { code: '+1284', country: 'Virgin Islands (British)', flag: '🇻🇬' },
  { code: '+1340', country: 'Virgin Islands (US)', flag: '🇻🇮' },
  { code: '+681', country: 'Wallis and Futuna', flag: '🇼🇫' },
  { code: '+967', country: 'Yemen', flag: '🇾🇪' },
  { code: '+260', country: 'Zambia', flag: '🇿🇲' },
  { code: '+263', country: 'Zimbabwe', flag: '🇿🇼' },
]

type AuthMethod = 'select' | 'email' | 'whatsapp'
type AuthStep = 'input' | 'verify' | 'success'

function AuthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // State
  const [authMethod, setAuthMethod] = useState<AuthMethod>('select')
  const [authStep, setAuthStep] = useState<AuthStep>('input')
  const [email, setEmail] = useState('')
  const [countryCode, setCountryCode] = useState('+971')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [inviteData, setInviteData] = useState<any>(null)
  const [preselectedRole, setPreselectedRole] = useState<string | null>(null)
  const [authenticatedEmail, setAuthenticatedEmail] = useState('')

  // Format phone number for display (XX XXX XXXX)
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`
  }

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (message && message.toLowerCase().includes('error')) {
      const timer = setTimeout(() => setMessage(''), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  // Handle resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  // Handle invite parameter and pre-selected role from URL
  useEffect(() => {
    const inviteParam = searchParams?.get('invite')
    const roleParam = searchParams?.get('role')
    const verifiedParam = searchParams?.get('verified')

    // Handle pre-selected role for direct registration links
    if (roleParam) {
      const roleMapping: { [key: string]: string } = {
        'admin': 'Admin',
        'user': 'Staff',
        'model': 'Model'
      }
      const mappedRole = roleMapping[roleParam.toLowerCase()]
      if (mappedRole) {
        setPreselectedRole(mappedRole)
        safeSessionStorage.setItem('preselectedRole', mappedRole)
        safeLocalStorage.setItem('decode_preselectedRole', mappedRole)
      }
    }

    // Handle invitation parameter
    if (inviteParam) {
      try {
        const decodedData = JSON.parse(Buffer.from(inviteParam, 'base64').toString())
        setInviteData(decodedData)
        setEmail(decodedData.email || '')
        setMessage(`Welcome! You've been invited to join ${decodedData.companyName}`)

        const inviteDataStr = JSON.stringify(decodedData)
        safeSessionStorage.setItem('inviteData', inviteDataStr)
        safeLocalStorage.setItem('decode_inviteData', inviteDataStr)
        safeLocalStorage.setItem('decode_inviteTimestamp', Date.now().toString())
      } catch (error) {
        console.error('❌ [AUTH] Invalid invite link:', error)
        setMessage('Invalid invitation link')
      }
    }

    // Handle email verification return
    if (verifiedParam === 'true') {
      checkAuthState()
    }
  }, [searchParams])

  // Check for authenticated user (handles email verification returns)
  const checkAuthState = async () => {
    try {
      const { user } = await getUserWithProxy()

      if (user && user.email_confirmed_at) {
        console.log('✅ [AUTH] Found verified user:', user.id)

        // Store user email for role modal
        if (user.email) {
          setAuthenticatedEmail(user.email)
        }

        // Check if user has a profile
        const { data: profileData } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()

        if (profileData) {
          // User has profile, redirect to dashboard
          router.push('/dashboard')
        } else {
          // Show role selection modal
          setShowRoleModal(true)
        }
      }
    } catch (error) {
      console.error('❌ [AUTH] Error checking auth state:', error)
    }
  }

  // Email magic link handler
  const handleEmailSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Use Supabase Auth magic link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?verified=true`,
        }
      })

      if (error) throw error

      // Store email for role modal
      setAuthenticatedEmail(email)

      // Switch to email verify screen
      setAuthMethod('email')
      setAuthStep('verify')
      setMessage('Magic link sent! Check your email and click the link to sign in.')
      setResendCooldown(60)
    } catch (error: any) {
      console.error('❌ [AUTH] Magic link error:', error)
      setMessage(error.message || 'Failed to send magic link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // WhatsApp OTP send handler
  const handleWhatsAppSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
    setMessage('')

    const fullPhone = `${countryCode}${phoneNumber}`

    try {
      const response = await fetch('/api/auth/send-whatsapp-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: fullPhone })
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to send OTP')

      // Switch to WhatsApp verify screen
      setAuthMethod('whatsapp')
      setAuthStep('verify')
      setMessage('OTP sent to your WhatsApp! Enter the 6-digit code.')
      setResendCooldown(60)
    } catch (error: any) {
      console.error('❌ [AUTH] WhatsApp OTP error:', error)
      setMessage(error.message || 'Failed to send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // WhatsApp OTP verification handler
  const handleOTPVerify = async () => {
    const code = otpCode.join('')
    if (code.length !== 6) {
      setMessage('Please enter the complete 6-digit code')
      return
    }

    setLoading(true)
    setMessage('')

    const fullPhone = `${countryCode}${phoneNumber}`

    try {
      const response = await fetch('/api/auth/verify-whatsapp-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: fullPhone,
          otpCode: code
        })
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Invalid OTP code')

      // OTP verified successfully
      console.log('✅ [AUTH] WhatsApp OTP verified')

      // Store phone as placeholder email for role modal
      setAuthenticatedEmail(`${fullPhone}@whatsapp.user`)

      // Wait a moment for backend to create session
      await new Promise(resolve => setTimeout(resolve, 500))

      // Refresh session to get latest auth state
      await supabase.auth.refreshSession()

      // Check if user has profile
      if (data.user?.hasProfile) {
        // User has profile, redirect to dashboard
        console.log('✅ [AUTH] User has profile, redirecting to dashboard')
        router.push('/dashboard')
      } else {
        // Show role selection modal for new users
        console.log('🆕 [AUTH] New user, showing role selection')
        setShowRoleModal(true)
      }
    } catch (error: any) {
      console.error('❌ [AUTH] OTP verification error:', error)
      setMessage(error.message || 'Invalid code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // OTP input handler (auto-advance to next field)
  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return // Only allow digits

    const newOTP = [...otpCode]
    newOTP[index] = value.slice(-1) // Only take last digit
    setOtpCode(newOTP)

    // Auto-advance to next field
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }

    // Auto-verify when all 6 digits entered
    if (index === 5 && value) {
      const code = newOTP.join('')
      if (code.length === 6) {
        setTimeout(() => handleOTPVerify(), 100)
      }
    }
  }

  // OTP backspace handler
  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  // Resend handler
  const handleResend = async () => {
    if (resendCooldown > 0) return

    if (authMethod === 'email') {
      await handleEmailSubmit({ preventDefault: () => {} } as React.FormEvent)
    } else if (authMethod === 'whatsapp') {
      await handleWhatsAppSubmit({ preventDefault: () => {} } as React.FormEvent)
    }
  }

  // Role modal handlers
  const handleRoleModalComplete = async (role: string) => {
    setShowRoleModal(false)
    console.log('✅ [AUTH] Profile creation completed for role:', role)
    window.location.href = '/dashboard?new_user=true'
  }

  // Reset to start
  const handleBack = () => {
    setAuthMethod('select')
    setAuthStep('input')
    setMessage('')
    setOtpCode(['', '', '', '', '', ''])
  }

  // Render single-page auth with both options
  if (authMethod === 'select') {
    return (
      <>
        <RoleSelectionModal
          isOpen={showRoleModal}
          userEmail={authenticatedEmail || email}
          termsAcceptedAt={new Date().toISOString()}
          inviteData={inviteData}
          preselectedRole={preselectedRole}
          onClose={() => setShowRoleModal(false)}
          onComplete={handleRoleModalComplete}
        />
      <div className="auth-page cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card-login">
            {/* Logo and Tagline */}
            <div className="text-center mb-12">
              <img
                src="/logo.png"
                alt="DECODE"
                className="mx-auto mb-2"
                style={{ height: '40px', filter: 'brightness(0) invert(1)' }}
              />
              <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
            </div>

            {/* WhatsApp Section */}
            <div className="space-y-2 mb-6">
              <div className="flex space-x-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="cosmic-input text-sm border border-purple-500 !w-[117px] md:!w-[92px]"
                  disabled={loading}
                >
                  {COUNTRY_CODES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code}
                    </option>
                  ))}
                </select>

                <input
                  type="tel"
                  placeholder="50 123 4567"
                  value={formatPhoneNumber(phoneNumber)}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="cosmic-input flex-1"
                  disabled={loading}
                  autoComplete="tel"
                />
              </div>

              <button
                onClick={handleWhatsAppSubmit}
                className={`w-full py-3 text-base rounded-lg font-medium transition-all ${
                  phoneNumber
                    ? 'bg-black border border-purple-600 hover:border-purple-700'
                    : 'bg-gradient-to-br from-gray-700 to-black hover:bg-purple-600'
                } ${loading || !phoneNumber ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={loading || !phoneNumber}
              >
                {loading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    <span>Sending...</span>
                  </span>
                ) : (
                  'Continue with WhatsApp'
                )}
              </button>
            </div>

            {/* OR Divider */}
            <div className="relative my-5">
              <div className="relative flex justify-center text-sm">
                <span className="text-gray-400 font-light">OR</span>
              </div>
            </div>

            {/* Email Section */}
            <div className="space-y-2">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="cosmic-input"
                disabled={loading}
                autoComplete="email"
              />

              <button
                onClick={handleEmailSubmit}
                className={`w-full py-3 text-base rounded-lg font-medium transition-all ${
                  email
                    ? 'bg-black border border-purple-600 hover:border-purple-700'
                    : 'bg-gradient-to-br from-gray-700 to-black hover:bg-purple-600'
                } ${loading || !email ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={loading || !email}
              >
                {loading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    <span>Sending...</span>
                  </span>
                ) : (
                  'Continue with Email'
                )}
              </button>
            </div>

            {/* Error/Success Messages */}
            {message && (
              <div className={`mt-6 p-3 rounded-lg text-sm text-center ${
                message.toLowerCase().includes('error')
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {message}
              </div>
            )}

            {/* Terms and Privacy */}
            <p className="text-center text-gray-400 font-light mt-8" style={{ fontSize: '11px' }}>
              By continuing, you agree to DECODE's<br />
              <a href="https://welovedecode.com/#terms" className="hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="https://welovedecode.com/#privacy" className="hover:underline">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
      </>
    )
  }

  // Render email magic link flow
  if (authMethod === 'email') {
    if (authStep === 'verify') {
      return (
        <div className="auth-page cosmic-bg">
          <div className="min-h-screen flex items-center justify-center px-4 py-8">
            <div className="cosmic-card-login">
              <div className="text-center mb-16">
                <img
                  src="/logo.png"
                  alt="DECODE"
                  className="mx-auto mb-2"
                  style={{ height: '40px', filter: 'brightness(0) invert(1)' }}
                />
                <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
              </div>

              <div className="text-center mb-8">
                <div className="text-6xl mb-4">📬</div>
                <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
                <p className="text-gray-400">
                  We sent a magic link to <span className="text-white font-medium">{email}</span>
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="cosmic-button-secondary w-full"
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend magic link'}
                </button>

                <button
                  onClick={handleBack}
                  className="text-gray-400 hover:text-white w-full py-2 text-sm"
                >
                  ← Back to sign in
                </button>
              </div>

              {message && (
                <div className={`mt-6 p-3 rounded-lg text-sm text-center ${
                  message.toLowerCase().includes('error')
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="auth-page cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card-login">
            <div className="text-center mb-16">
              <img
                src="/logo.png"
                alt="DECODE"
                className="mx-auto mb-2"
                style={{ height: '40px', filter: 'brightness(0) invert(1)' }}
              />
              <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
            </div>

            <button
              onClick={handleBack}
              className="text-gray-400 hover:text-white mb-6 flex items-center space-x-2"
            >
              <span>←</span>
              <span>Back</span>
            </button>

            <h2 className="text-2xl font-bold text-white mb-2">Sign in with Email</h2>
            <p className="text-gray-400 mb-8">
              We'll send you a magic link for a password-free sign in.
            </p>

            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="cosmic-input"
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                className="cosmic-button-primary w-full py-3"
                disabled={loading || !email}
              >
                {loading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    <span>Sending...</span>
                  </span>
                ) : (
                  'Send magic link'
                )}
              </button>
            </form>

            {message && (
              <div className={`mt-6 p-3 rounded-lg text-sm text-center ${
                message.toLowerCase().includes('error')
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render WhatsApp OTP flow
  if (authMethod === 'whatsapp') {
    if (authStep === 'verify') {
      return (
        <div className="auth-page cosmic-bg">
          <div className="min-h-screen flex items-center justify-center px-4 py-8">
            <div className="cosmic-card-login">
              <div className="text-center mb-16">
                <img
                  src="/logo.png"
                  alt="DECODE"
                  className="mx-auto mb-2"
                  style={{ height: '40px', filter: 'brightness(0) invert(1)' }}
                />
                <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
              </div>

              <div className="text-center mb-8">
                <div className="text-6xl mb-4">💬</div>
                <h2 className="text-2xl font-bold text-white mb-2">Enter verification code</h2>
                <p className="text-gray-400">
                  We sent a 6-digit code to <span className="text-white font-medium">{countryCode}{phoneNumber}</span>
                </p>
              </div>

              <div className="flex justify-center space-x-2 mb-6">
                {otpCode.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOTPChange(index, e.target.value)}
                    onKeyDown={(e) => handleOTPKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold cosmic-input"
                    disabled={loading}
                  />
                ))}
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleOTPVerify}
                  className="cosmic-button-primary w-full py-3"
                  disabled={loading || otpCode.join('').length !== 6}
                >
                  {loading ? (
                    <span className="flex items-center justify-center space-x-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      <span>Verifying...</span>
                    </span>
                  ) : (
                    'Verify code'
                  )}
                </button>

                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="cosmic-button-secondary w-full"
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend code'}
                </button>

                <button
                  onClick={handleBack}
                  className="text-gray-400 hover:text-white w-full py-2 text-sm"
                >
                  ← Back to sign in
                </button>
              </div>

              {message && (
                <div className={`mt-6 p-3 rounded-lg text-sm text-center ${
                  message.toLowerCase().includes('error')
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="auth-page cosmic-bg">
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
          <div className="cosmic-card-login">
            <div className="text-center mb-16">
              <img
                src="/logo.png"
                alt="DECODE"
                className="mx-auto mb-2"
                style={{ height: '40px', filter: 'brightness(0) invert(1)' }}
              />
              <p className="cosmic-body opacity-70">Make Girls More Beautiful</p>
            </div>

            <button
              onClick={handleBack}
              className="text-gray-400 hover:text-white mb-6 flex items-center space-x-2"
            >
              <span>←</span>
              <span>Back</span>
            </button>

            <h2 className="text-2xl font-bold text-white mb-2">Sign in with WhatsApp</h2>
            <p className="text-gray-400 mb-8">
              We'll send a verification code to your WhatsApp number.
            </p>

            <form onSubmit={handleWhatsAppSubmit} className="space-y-6">
              <div className="flex space-x-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="cosmic-input w-32"
                  disabled={loading}
                >
                  {COUNTRY_CODES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code}
                    </option>
                  ))}
                </select>

                <input
                  type="tel"
                  placeholder="Phone number"
                  value={formatPhoneNumber(phoneNumber)}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="cosmic-input flex-1"
                  required
                  disabled={loading}
                  autoComplete="tel"
                />
              </div>

              <button
                type="submit"
                className="cosmic-button-primary w-full py-3"
                disabled={loading || !phoneNumber}
              >
                {loading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    <span>Sending...</span>
                  </span>
                ) : (
                  'Send verification code'
                )}
              </button>
            </form>

            {message && (
              <div className={`mt-6 p-3 rounded-lg text-sm text-center ${
                message.toLowerCase().includes('error')
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Fallback return - should never reach here but just in case
  return (
    <>
      <div className="auth-page cosmic-bg">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>

      {/* Role Selection Modal */}
      <RoleSelectionModal
        isOpen={showRoleModal}
        userEmail={authenticatedEmail || email}
        termsAcceptedAt={new Date().toISOString()}
        inviteData={inviteData}
        preselectedRole={preselectedRole}
        onClose={() => setShowRoleModal(false)}
        onComplete={handleRoleModalComplete}
      />
    </>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="auth-page cosmic-bg">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  )
}
