'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressTracker } from '@/components/ambassador/ProgressTracker'

type Currency = { c: string; f: string; n: string }

const CURRS: Currency[] = [
  { c: 'AED', f: '🇦🇪', n: 'UAE Dirham' },
  { c: 'AFN', f: '🇦🇫', n: 'Afghan Afghani' },
  { c: 'ALL', f: '🇦🇱', n: 'Albanian Lek' },
  { c: 'AMD', f: '🇦🇲', n: 'Armenian Dram' },
  { c: 'ANG', f: '🇳🇱', n: 'Netherlands Antillean Guilder' },
  { c: 'AOA', f: '🇦🇴', n: 'Angolan Kwanza' },
  { c: 'ARS', f: '🇦🇷', n: 'Argentine Peso' },
  { c: 'AUD', f: '🇦🇺', n: 'Australian Dollar' },
  { c: 'AWG', f: '🇦🇼', n: 'Aruban Florin' },
  { c: 'AZN', f: '🇦🇿', n: 'Azerbaijani Manat' },
  { c: 'BAM', f: '🇧🇦', n: 'Bosnia-Herzegovina Mark' },
  { c: 'BBD', f: '🇧🇧', n: 'Barbadian Dollar' },
  { c: 'BDT', f: '🇧🇩', n: 'Bangladeshi Taka' },
  { c: 'BGN', f: '🇧🇬', n: 'Bulgarian Lev' },
  { c: 'BIF', f: '🇧🇮', n: 'Burundian Franc' },
  { c: 'BMD', f: '🇧🇲', n: 'Bermudian Dollar' },
  { c: 'BND', f: '🇧🇳', n: 'Brunei Dollar' },
  { c: 'BOB', f: '🇧🇴', n: 'Bolivian Boliviano' },
  { c: 'BRL', f: '🇧🇷', n: 'Brazilian Real' },
  { c: 'BSD', f: '🇧🇸', n: 'Bahamian Dollar' },
  { c: 'BWP', f: '🇧🇼', n: 'Botswana Pula' },
  { c: 'BYN', f: '🇧🇾', n: 'Belarusian Ruble' },
  { c: 'BZD', f: '🇧🇿', n: 'Belize Dollar' },
  { c: 'CAD', f: '🇨🇦', n: 'Canadian Dollar' },
  { c: 'CDF', f: '🇨🇩', n: 'Congolese Franc' },
  { c: 'CHF', f: '🇨🇭', n: 'Swiss Franc' },
  { c: 'CLP', f: '🇨🇱', n: 'Chilean Peso' },
  { c: 'CNY', f: '🇨🇳', n: 'Chinese Yuan' },
  { c: 'COP', f: '🇨🇴', n: 'Colombian Peso' },
  { c: 'CRC', f: '🇨🇷', n: 'Costa Rican Colón' },
  { c: 'CVE', f: '🇨🇻', n: 'Cape Verdean Escudo' },
  { c: 'CZK', f: '🇨🇿', n: 'Czech Koruna' },
  { c: 'DJF', f: '🇩🇯', n: 'Djiboutian Franc' },
  { c: 'DKK', f: '🇩🇰', n: 'Danish Krone' },
  { c: 'DOP', f: '🇩🇴', n: 'Dominican Peso' },
  { c: 'DZD', f: '🇩🇿', n: 'Algerian Dinar' },
  { c: 'EGP', f: '🇪🇬', n: 'Egyptian Pound' },
  { c: 'ETB', f: '🇪🇹', n: 'Ethiopian Birr' },
  { c: 'EUR', f: '🇪🇺', n: 'Euro' },
  { c: 'FJD', f: '🇫🇯', n: 'Fijian Dollar' },
  { c: 'FKP', f: '🇫🇰', n: 'Falkland Islands Pound' },
  { c: 'GBP', f: '🇬🇧', n: 'British Pound' },
  { c: 'GEL', f: '🇬🇪', n: 'Georgian Lari' },
  { c: 'GIP', f: '🇬🇮', n: 'Gibraltar Pound' },
  { c: 'GMD', f: '🇬🇲', n: 'Gambian Dalasi' },
  { c: 'GNF', f: '🇬🇳', n: 'Guinean Franc' },
  { c: 'GTQ', f: '🇬🇹', n: 'Guatemalan Quetzal' },
  { c: 'GYD', f: '🇬🇾', n: 'Guyanese Dollar' },
  { c: 'HKD', f: '🇭🇰', n: 'Hong Kong Dollar' },
  { c: 'HNL', f: '🇭🇳', n: 'Honduran Lempira' },
  { c: 'HTG', f: '🇭🇹', n: 'Haitian Gourde' },
  { c: 'HUF', f: '🇭🇺', n: 'Hungarian Forint' },
  { c: 'IDR', f: '🇮🇩', n: 'Indonesian Rupiah' },
  { c: 'ILS', f: '🇮🇱', n: 'Israeli Shekel' },
  { c: 'INR', f: '🇮🇳', n: 'Indian Rupee' },
  { c: 'ISK', f: '🇮🇸', n: 'Icelandic Króna' },
  { c: 'JMD', f: '🇯🇲', n: 'Jamaican Dollar' },
  { c: 'JPY', f: '🇯🇵', n: 'Japanese Yen' },
  { c: 'KES', f: '🇰🇪', n: 'Kenyan Shilling' },
  { c: 'KGS', f: '🇰🇬', n: 'Kyrgyzstani Som' },
  { c: 'KHR', f: '🇰🇭', n: 'Cambodian Riel' },
  { c: 'KMF', f: '🇰🇲', n: 'Comorian Franc' },
  { c: 'KRW', f: '🇰🇷', n: 'South Korean Won' },
  { c: 'KYD', f: '🇰🇾', n: 'Cayman Islands Dollar' },
  { c: 'KZT', f: '🇰🇿', n: 'Kazakhstani Tenge' },
  { c: 'LAK', f: '🇱🇦', n: 'Lao Kip' },
  { c: 'LBP', f: '🇱🇧', n: 'Lebanese Pound' },
  { c: 'LKR', f: '🇱🇰', n: 'Sri Lankan Rupee' },
  { c: 'LRD', f: '🇱🇷', n: 'Liberian Dollar' },
  { c: 'LSL', f: '🇱🇸', n: 'Lesotho Loti' },
  { c: 'MAD', f: '🇲🇦', n: 'Moroccan Dirham' },
  { c: 'MDL', f: '🇲🇩', n: 'Moldovan Leu' },
  { c: 'MGA', f: '🇲🇬', n: 'Malagasy Ariary' },
  { c: 'MKD', f: '🇲🇰', n: 'Macedonian Denar' },
  { c: 'MMK', f: '🇲🇲', n: 'Myanmar Kyat' },
  { c: 'MNT', f: '🇲🇳', n: 'Mongolian Tögrög' },
  { c: 'MOP', f: '🇲🇴', n: 'Macanese Pataca' },
  { c: 'MUR', f: '🇲🇺', n: 'Mauritian Rupee' },
  { c: 'MVR', f: '🇲🇻', n: 'Maldivian Rufiyaa' },
  { c: 'MWK', f: '🇲🇼', n: 'Malawian Kwacha' },
  { c: 'MXN', f: '🇲🇽', n: 'Mexican Peso' },
  { c: 'MYR', f: '🇲🇾', n: 'Malaysian Ringgit' },
  { c: 'MZN', f: '🇲🇿', n: 'Mozambican Metical' },
  { c: 'NAD', f: '🇳🇦', n: 'Namibian Dollar' },
  { c: 'NGN', f: '🇳🇬', n: 'Nigerian Naira' },
  { c: 'NIO', f: '🇳🇮', n: 'Nicaraguan Córdoba' },
  { c: 'NOK', f: '🇳🇴', n: 'Norwegian Krone' },
  { c: 'NPR', f: '🇳🇵', n: 'Nepalese Rupee' },
  { c: 'NZD', f: '🇳🇿', n: 'New Zealand Dollar' },
  { c: 'PAB', f: '🇵🇦', n: 'Panamanian Balboa' },
  { c: 'PEN', f: '🇵🇪', n: 'Peruvian Sol' },
  { c: 'PGK', f: '🇵🇬', n: 'Papua New Guinean Kina' },
  { c: 'PHP', f: '🇵🇭', n: 'Philippine Peso' },
  { c: 'PKR', f: '🇵🇰', n: 'Pakistani Rupee' },
  { c: 'PLN', f: '🇵🇱', n: 'Polish Złoty' },
  { c: 'PYG', f: '🇵🇾', n: 'Paraguayan Guaraní' },
  { c: 'QAR', f: '🇶🇦', n: 'Qatari Riyal' },
  { c: 'RON', f: '🇷🇴', n: 'Romanian Leu' },
  { c: 'RSD', f: '🇷🇸', n: 'Serbian Dinar' },
  { c: 'RUB', f: '🇷🇺', n: 'Russian Ruble' },
  { c: 'RWF', f: '🇷🇼', n: 'Rwandan Franc' },
  { c: 'SAR', f: '🇸🇦', n: 'Saudi Riyal' },
  { c: 'SBD', f: '🇸🇧', n: 'Solomon Islands Dollar' },
  { c: 'SCR', f: '🇸🇨', n: 'Seychellois Rupee' },
  { c: 'SEK', f: '🇸🇪', n: 'Swedish Krona' },
  { c: 'SGD', f: '🇸🇬', n: 'Singapore Dollar' },
  { c: 'SHP', f: '🇸🇭', n: 'Saint Helena Pound' },
  { c: 'SLE', f: '🇸🇱', n: 'Sierra Leonean Leone' },
  { c: 'SOS', f: '🇸🇴', n: 'Somali Shilling' },
  { c: 'SRD', f: '🇸🇷', n: 'Surinamese Dollar' },
  { c: 'STD', f: '🇸🇹', n: 'São Tomé & Príncipe Dobra' },
  { c: 'SZL', f: '🇸🇿', n: 'Swazi Lilangeni' },
  { c: 'THB', f: '🇹🇭', n: 'Thai Baht' },
  { c: 'TJS', f: '🇹🇯', n: 'Tajikistani Somoni' },
  { c: 'TOP', f: '🇹🇴', n: 'Tongan Paʻanga' },
  { c: 'TRY', f: '🇹🇷', n: 'Turkish Lira' },
  { c: 'TTD', f: '🇹🇹', n: 'Trinidad & Tobago Dollar' },
  { c: 'TWD', f: '🇹🇼', n: 'New Taiwan Dollar' },
  { c: 'TZS', f: '🇹🇿', n: 'Tanzanian Shilling' },
  { c: 'UAH', f: '🇺🇦', n: 'Ukrainian Hryvnia' },
  { c: 'UGX', f: '🇺🇬', n: 'Ugandan Shilling' },
  { c: 'USD', f: '🇺🇸', n: 'US Dollar' },
  { c: 'UYU', f: '🇺🇾', n: 'Uruguayan Peso' },
  { c: 'UZS', f: '🇺🇿', n: "Uzbekistani So'm" },
  { c: 'VND', f: '🇻🇳', n: 'Vietnamese Đồng' },
  { c: 'VUV', f: '🇻🇺', n: 'Vanuatu Vatu' },
  { c: 'WST', f: '🇼🇸', n: 'Samoan Tālā' },
  { c: 'XAF', f: '🌍', n: 'Central African CFA Franc' },
  { c: 'XCD', f: '🏝️', n: 'East Caribbean Dollar' },
  { c: 'XOF', f: '🌍', n: 'West African CFA Franc' },
  { c: 'XPF', f: '🇵🇫', n: 'CFP Franc' },
  { c: 'YER', f: '🇾🇪', n: 'Yemeni Rial' },
  { c: 'ZAR', f: '🇿🇦', n: 'South African Rand' },
  { c: 'ZMW', f: '🇿🇲', n: 'Zambian Kwacha' },
]

const POPULAR_CURRS = ['USD', 'EUR', 'AED']
const SYMBOL_MAP: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

const AedSvg = () => (
  <svg
    width="13"
    height="11"
    viewBox="0 0 344.84 299.91"
    fill="currentColor"
    style={{ display: 'inline-block', verticalAlign: -2 }}
  >
    <path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z" />
  </svg>
)

function SymbolFor({ code }: { code: string }) {
  if (code === 'AED') return <AedSvg />
  const s = SYMBOL_MAP[code]
  return s ? <span>{s}</span> : null
}

function hasSymbol(code: string): boolean {
  return code === 'AED' || code in SYMBOL_MAP
}

function capFirst(s: string): string {
  return s
    .replace(/[^a-zA-Z\s'-]/g, '')
    .replace(/(^|\s)([a-z])/g, (_m, a, b) => a + b.toUpperCase())
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

type GoPhase = 'idle' | 'ready' | 'working' | 'success'
type SlugStatus = 'idle' | 'short' | 'checking' | 'available' | 'taken'

export default function SetupPage() {
  const router = useRouter()

  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [url, setUrl] = useState('')
  const [urlEdited, setUrlEdited] = useState(false)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const [slugError, setSlugError] = useState('')
  const [ig, setIg] = useState('')
  const [curr, setCurr] = useState('AED')
  const [flag, setFlag] = useState('🇦🇪')

  const [cover, setCover] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverY, setCoverY] = useState(50)
  const [dragging, setDragging] = useState(false)
  const [pillVisible, setPillVisible] = useState(false)

  const [showSheet, setShowSheet] = useState(false)
  const [search, setSearch] = useState('')

  const [goPhase, setGoPhase] = useState<GoPhase>('idle')
  const [trackerStep, setTrackerStep] = useState<1 | 2 | 3>(2)
  const [submitError, setSubmitError] = useState('')

  const [focusId, setFocusId] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const coverRef = useRef<HTMLDivElement>(null)
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pillTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragState = useRef({ startY: 0, startPct: 50 })

  const isReady =
    first.trim() !== '' &&
    last.trim() !== '' &&
    slugStatus === 'available' &&
    ig.trim() !== ''

  useEffect(() => {
    if (goPhase === 'working' || goPhase === 'success') return
    setGoPhase(isReady ? 'ready' : 'idle')
  }, [isReady, goPhase])

  const checkUrl = useCallback((value: string) => {
    setSlugError('')
    if (!value) {
      setSlugStatus('idle')
      return
    }
    if (value.length < 3) {
      setSlugStatus('short')
      setSlugError('Min 3 characters')
      return
    }
    setSlugStatus('checking')
    if (urlTimer.current) clearTimeout(urlTimer.current)
    const query = value
    urlTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/ambassador/model/check-slug?slug=${encodeURIComponent(query)}`,
        )
        const data = await res.json()
        if (data.available) {
          setSlugStatus('available')
          setSlugError('')
        } else {
          setSlugStatus('taken')
          setSlugError(data.error || 'Not available')
        }
      } catch {
        setSlugStatus('idle')
      }
    }, 450)
  }, [])

  useEffect(() => {
    return () => {
      if (urlTimer.current) clearTimeout(urlTimer.current)
      if (pillTimer.current) clearTimeout(pillTimer.current)
    }
  }, [])

  const onFirstChange = (v: string) => {
    const next = capFirst(v)
    setFirst(next)
    if (!urlEdited) {
      const slug = slugify(next + last)
      setUrl(slug)
      checkUrl(slug)
    }
  }

  const onLastChange = (v: string) => {
    const next = capFirst(v)
    setLast(next)
    if (!urlEdited) {
      const slug = slugify(first + next)
      setUrl(slug)
      checkUrl(slug)
    }
  }

  const onUrlChange = (v: string) => {
    const clean = v.toLowerCase().replace(/[^a-z0-9._-]/g, '')
    setUrl(clean)
    setUrlEdited(true)
    checkUrl(clean)
  }

  const onIgChange = (v: string) => {
    const clean = v.replace(/^@+/, '').replace(/[^a-zA-Z0-9._]/g, '')
    setIg(clean)
  }

  const pickCover = () => {
    if (!cover) fileRef.current?.click()
  }

  const loadCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setCoverFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCover(ev.target?.result as string)
      setCoverY(50)
    }
    reader.readAsDataURL(f)
  }

  const positionImg = useCallback(() => {
    const img = imgRef.current
    const box = coverRef.current
    if (!img || !box || !img.naturalWidth) return
    const cw = box.offsetWidth
    const ch = box.offsetHeight
    const scale = cw / img.naturalWidth
    const sh = img.naturalHeight * scale
    img.style.width = cw + 'px'
    img.style.height = sh + 'px'
    const maxOffset = Math.max(0, sh - ch)
    img.style.top = `${-maxOffset * (coverY / 100)}px`
  }, [coverY])

  useEffect(() => {
    positionImg()
  }, [cover, coverY, positionImg])

  useEffect(() => {
    const onResize = () => positionImg()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [positionImg])

  const showPill = () => {
    setPillVisible(true)
    if (pillTimer.current) {
      clearTimeout(pillTimer.current)
      pillTimer.current = null
    }
  }
  const hidePillLater = () => {
    if (pillTimer.current) clearTimeout(pillTimer.current)
    pillTimer.current = setTimeout(() => setPillVisible(false), 1000)
  }

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!cover) return
    setDragging(true)
    showPill()
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragState.current = { startY: y, startPct: coverY }
    if ('preventDefault' in e) e.preventDefault()
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e: MouseEvent | TouchEvent) => {
      const y = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
      const img = imgRef.current
      const box = coverRef.current
      if (!img || !box) return
      const sh = img.offsetHeight
      const ch = box.offsetHeight
      const maxOffset = sh - ch
      if (maxOffset <= 0) return
      const dy = y - dragState.current.startY
      let pct = dragState.current.startPct - (dy / maxOffset) * 100
      if (pct < 0) pct = 0
      if (pct > 100) pct = 100
      setCoverY(pct)
    }
    const up = () => {
      setDragging(false)
      hidePillLater()
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
    }
  }, [dragging])

  const openSheet = () => {
    setSearch('')
    setShowSheet(true)
  }
  const closeSheet = () => setShowSheet(false)
  const pickCurr = (code: string, f: string) => {
    setCurr(code)
    setFlag(f)
    closeSheet()
  }

  const goLive = async () => {
    if (goPhase !== 'ready') return
    setSubmitError('')
    setGoPhase('working')

    const formData = new FormData()
    formData.append('firstName', first.trim())
    formData.append('lastName', last.trim())
    formData.append('slug', url)
    formData.append('instagram', ig.trim())
    formData.append('currency', curr.toLowerCase())
    formData.append('coverPhotoPositionY', String(Math.round(coverY)))
    if (coverFile) formData.append('coverPhoto', coverFile)

    try {
      const res = await fetch('/api/ambassador/model/setup', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.redirect) {
          router.replace(data.redirect)
          return
        }
        if (res.status === 409 && /already exists|profile exists/i.test(data.error ?? '')) {
          router.replace('/model')
          return
        }
        setSubmitError(data.error || 'Failed to create profile')
        setGoPhase('ready')
        return
      }

      setTrackerStep(3)
      setGoPhase('success')
      setTimeout(() => router.replace('/model'), 450)
    } catch {
      setSubmitError('Network error. Please try again.')
      setGoPhase('ready')
    }
  }

  const currencyList = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      const popularRows = POPULAR_CURRS.map((code) =>
        CURRS.find((x) => x.c === code),
      ).filter((x): x is Currency => !!x)
      const sorted = [...CURRS].sort((a, b) => a.c.localeCompare(b.c))
      const sections: {
        type: 'header' | 'row'
        key: string
        header?: string
        row?: Currency
      }[] = []
      sections.push({ type: 'header', key: 'hdr-POPULAR', header: 'POPULAR' })
      popularRows.forEach((r) =>
        sections.push({ type: 'row', key: `pop-${r.c}`, row: r }),
      )
      let lastLetter = ''
      sorted.forEach((r) => {
        const letter = r.c.charAt(0)
        if (letter !== lastLetter) {
          sections.push({ type: 'header', key: `hdr-${letter}`, header: letter })
          lastLetter = letter
        }
        sections.push({ type: 'row', key: `az-${r.c}`, row: r })
      })
      return { sections, empty: false }
    }
    const filtered = CURRS.filter(
      (c) =>
        c.c.toLowerCase().includes(q) || c.n.toLowerCase().includes(q),
    )
    return {
      sections: filtered.map((r) => ({
        type: 'row' as const,
        key: `flat-${r.c}`,
        row: r,
      })),
      empty: filtered.length === 0,
    }
  }, [search])

  const goBtnLabel =
    goPhase === 'success'
      ? "You're live!"
      : goPhase === 'working'
      ? 'Going live…'
      : 'Go live'
  const goBtnActive = goPhase !== 'idle'

  const inputRowStyle = (id: string, error: boolean): React.CSSProperties => ({
    background: '#1c1c1c',
    border: `1.5px solid ${
      error ? '#ef4444' : focusId === id ? '#e91e8c' : '#262626'
    }`,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    transition: 'border-color 0.15s',
  })

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    fontSize: 14,
    color: '#fff',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontFamily: 'inherit',
  }

  const urlHasError = slugStatus === 'taken' || slugStatus === 'short'

  return (
    <div style={{ color: '#fff' }}>
      <ProgressTracker
        steps={['Verify', 'Set up', 'Live']}
        step={trackerStep}
        padding="20px 22px 0"
      />

      <div style={{ padding: '24px 22px 16px', textAlign: 'center' }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.2px',
            marginBottom: 4,
          }}
        >
          You&apos;re almost live!
        </div>
        <div style={{ fontSize: 11, color: '#888' }}>Let&apos;s set up your page</div>
      </div>

      <div style={{ padding: '0 20px 8px' }}>
        <div
          ref={coverRef}
          onClick={pickCover}
          onMouseDown={cover ? onDragStart : undefined}
          onTouchStart={cover ? onDragStart : undefined}
          style={{
            position: 'relative',
            height: 110,
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 16,
            background: 'linear-gradient(135deg,#2a2a2a 0%,#1a1a1a 100%)',
            border: `1.5px ${cover ? 'solid #262626' : 'dashed #333'}`,
            cursor: cover ? (dragging ? 'grabbing' : 'grab') : 'pointer',
            userSelect: 'none',
          }}
        >
          {cover && (
            <img
              ref={imgRef}
              src={cover}
              alt=""
              onLoad={positionImg}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                width: '100%',
                pointerEvents: 'none',
              }}
            />
          )}
          {!cover && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                color: '#666',
                pointerEvents: 'none',
              }}
            >
              Add cover photo
            </div>
          )}
          {cover && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                fontSize: 9,
                color: '#fff',
                background: 'rgba(0,0,0,0.55)',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '4px 9px',
                borderRadius: 12,
                pointerEvents: 'none',
                letterSpacing: '0.3px',
                opacity: pillVisible ? 1 : 0,
                transition: 'opacity 0.3s',
              }}
            >
              Drag to reposition
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              width: 28,
              height: 28,
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={loadCover}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Eyebrow>First name</Eyebrow>
            <div style={inputRowStyle('first', false)}>
              <input
                value={first}
                onChange={(e) => onFirstChange(e.target.value)}
                onFocus={() => setFocusId('first')}
                onBlur={() => setFocusId(null)}
                placeholder="Sara"
                autoComplete="off"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Eyebrow>Last name</Eyebrow>
            <div style={inputRowStyle('last', false)}>
              <input
                value={last}
                onChange={(e) => onLastChange(e.target.value)}
                onFocus={() => setFocusId('last')}
                onBlur={() => setFocusId(null)}
                placeholder="Johnson"
                autoComplete="off"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 9,
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 6,
              paddingLeft: 4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Page URL</span>
            <span
              style={{
                color: '#ef4444',
                textTransform: 'none',
                letterSpacing: 0,
                fontWeight: 600,
              }}
            >
              {slugError}
            </span>
          </div>
          <div
            onClick={() => document.getElementById('setup-url')?.focus()}
            style={inputRowStyle('url', urlHasError)}
          >
            <span
              style={{
                padding: '14px 0 14px 16px',
                fontSize: 13,
                color: '#666',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'text',
              }}
            >
              welovedecode.com/
            </span>
            <input
              id="setup-url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              onFocus={() => setFocusId('url')}
              onBlur={() => setFocusId(null)}
              placeholder="yourname"
              autoComplete="off"
              maxLength={30}
              style={{
                padding: '14px 10px 14px 1px',
                fontSize: 14,
                fontWeight: 500,
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <span
              style={{
                paddingRight: 14,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {slugStatus === 'checking' && (
                <span
                  style={{
                    width: 12,
                    height: 12,
                    border: '1.5px solid #333',
                    borderTopColor: '#888',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'setup-spin 0.7s linear infinite',
                  }}
                />
              )}
              {slugStatus === 'available' && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {slugStatus === 'taken' && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <Eyebrow>Instagram</Eyebrow>
          <div style={inputRowStyle('ig', false)}>
            <span
              style={{ marginLeft: 16, flexShrink: 0, display: 'inline-flex' }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#e91e8c"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </span>
            <input
              value={ig}
              onChange={(e) => onIgChange(e.target.value)}
              onFocus={() => setFocusId('ig')}
              onBlur={() => setFocusId(null)}
              placeholder="your username"
              autoComplete="off"
              style={{ ...inputStyle, paddingLeft: 10 }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 6 }}>
          <Eyebrow>Currency</Eyebrow>
          <div style={inputRowStyle('curr', false)}>
            <div
              onClick={openSheet}
              style={{
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <span style={{ marginRight: 10, fontSize: 18 }}>{flag}</span>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{curr}</span>
              {hasSymbol(curr) && (
                <span
                  style={{
                    marginLeft: 6,
                    color: '#fff',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    lineHeight: 1,
                  }}
                >
                  <span style={{ marginRight: 6 }}>·</span>
                  <SymbolFor code={curr} />
                </span>
              )}
              <span style={{ marginLeft: 'auto', color: '#555' }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#555"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </div>
          </div>
          <div
            style={{ fontSize: 9, color: '#666', marginTop: 5, paddingLeft: 4 }}
          >
            Set once — can&apos;t be changed later
          </div>
        </div>
      </div>

      <div style={{ padding: '8px 20px 22px' }}>
        <button
          onClick={goLive}
          style={{
            width: '100%',
            background: goBtnActive ? '#e91e8c' : '#1c1c1c',
            border: `1px solid ${goBtnActive ? '#e91e8c' : '#262626'}`,
            borderRadius: 12,
            padding: 16,
            fontSize: 15,
            fontWeight: 700,
            color: goBtnActive ? '#fff' : '#555',
            letterSpacing: '0.2px',
            cursor:
              goPhase === 'ready'
                ? 'pointer'
                : goPhase === 'working' || goPhase === 'success'
                ? 'default'
                : 'not-allowed',
            transition: 'all 0.2s',
            fontFamily: 'inherit',
          }}
        >
          {goBtnLabel}
        </button>
        {submitError && (
          <div
            style={{
              textAlign: 'center',
              color: '#ef4444',
              fontSize: 12,
              marginTop: 12,
            }}
          >
            {submitError}
          </div>
        )}
      </div>

      <div id="turnstile-container" style={{ display: 'none' }} />

      {showSheet && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSheet()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: '#0a0a0a',
              borderTop: '1px solid #1a1a1a',
              borderRadius: '20px 20px 0 0',
              maxHeight: '80vh',
              overflowY: 'auto',
              color: '#fff',
            }}
          >
            <div
              style={{
                position: 'sticky',
                top: 0,
                background: '#0a0a0a',
                zIndex: 2,
              }}
            >
              <div
                style={{
                  padding: '18px 22px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  Choose currency
                </div>
                <div
                  onClick={closeSheet}
                  style={{
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: 20,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </div>
              </div>
              <div style={{ padding: '0 22px 14px', background: '#0a0a0a' }}>
                <div
                  style={{
                    background: '#1c1c1c',
                    border: '1.5px solid #262626',
                    borderRadius: 12,
                  }}
                >
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search 135 currencies…"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      fontSize: 13,
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>
            </div>
            <div>
              {currencyList.empty && (
                <div
                  style={{
                    padding: '28px 22px',
                    textAlign: 'center',
                    color: '#666',
                    fontSize: 12,
                  }}
                >
                  No match
                </div>
              )}
              {currencyList.sections.map((s) => {
                if (s.type === 'header') {
                  return (
                    <div
                      key={s.key}
                      style={{
                        padding: '14px 22px 6px',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#888',
                        letterSpacing: '1px',
                        background: '#0a0a0a',
                      }}
                    >
                      {s.header}
                    </div>
                  )
                }
                const r = s.row!
                const selected = r.c === curr
                return (
                  <div
                    key={s.key}
                    onClick={() => pickCurr(r.c, r.f)}
                    style={{
                      padding: '14px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      borderBottom: '1px solid #151515',
                      fontSize: 14,
                      color: selected ? '#fff' : undefined,
                      fontWeight: selected ? 600 : undefined,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{r.f}</span>
                    <span style={{ flex: 1 }}>
                      {r.c} · {r.n}
                      {hasSymbol(r.c) && (
                        <>
                          {' · '}
                          <span style={{ color: '#fff', fontWeight: 500 }}>
                            <SymbolFor code={r.c} />
                          </span>
                        </>
                      )}
                    </span>
                    {selected && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#e91e8c"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes setup-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9,
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: 6,
        paddingLeft: 4,
      }}
    >
      {children}
    </div>
  )
}
