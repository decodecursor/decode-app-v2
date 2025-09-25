// Storage helper with mobile-safe fallbacks
// Handles cases where localStorage/sessionStorage are blocked or throw errors

// In-memory fallback storage for when real storage is unavailable
const memoryStorage: { [key: string]: string } = {}

// Check if storage is available
function isStorageAvailable(type: 'localStorage' | 'sessionStorage'): boolean {
  try {
    const storage = window[type]
    const testKey = '__storage_test__'
    storage.setItem(testKey, 'test')
    storage.removeItem(testKey)
    return true
  } catch (e) {
    console.warn(`${type} is not available:`, e)
    return false
  }
}

// Safe localStorage wrapper
export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && isStorageAvailable('localStorage')) {
        return localStorage.getItem(key)
      }
    } catch (e) {
      console.warn('localStorage.getItem failed:', e)
    }
    // Fallback to memory storage
    return memoryStorage[`local_${key}`] || null
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && isStorageAvailable('localStorage')) {
        localStorage.setItem(key, value)
        return
      }
    } catch (e) {
      console.warn('localStorage.setItem failed:', e)
    }
    // Fallback to memory storage
    memoryStorage[`local_${key}`] = value
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && isStorageAvailable('localStorage')) {
        localStorage.removeItem(key)
        return
      }
    } catch (e) {
      console.warn('localStorage.removeItem failed:', e)
    }
    // Fallback to memory storage
    delete memoryStorage[`local_${key}`]
  },

  clear(): void {
    try {
      if (typeof window !== 'undefined' && isStorageAvailable('localStorage')) {
        localStorage.clear()
      }
    } catch (e) {
      console.warn('localStorage.clear failed:', e)
    }
    // Clear memory storage for localStorage keys
    Object.keys(memoryStorage).forEach(key => {
      if (key.startsWith('local_')) {
        delete memoryStorage[key]
      }
    })
  }
}

// Safe sessionStorage wrapper
export const safeSessionStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && isStorageAvailable('sessionStorage')) {
        return sessionStorage.getItem(key)
      }
    } catch (e) {
      console.warn('sessionStorage.getItem failed:', e)
    }
    // Fallback to memory storage
    return memoryStorage[`session_${key}`] || null
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && isStorageAvailable('sessionStorage')) {
        sessionStorage.setItem(key, value)
        return
      }
    } catch (e) {
      console.warn('sessionStorage.setItem failed:', e)
    }
    // Fallback to memory storage
    memoryStorage[`session_${key}`] = value
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && isStorageAvailable('sessionStorage')) {
        sessionStorage.removeItem(key)
        return
      }
    } catch (e) {
      console.warn('sessionStorage.removeItem failed:', e)
    }
    // Fallback to memory storage
    delete memoryStorage[`session_${key}`]
  },

  clear(): void {
    try {
      if (typeof window !== 'undefined' && isStorageAvailable('sessionStorage')) {
        sessionStorage.clear()
      }
    } catch (e) {
      console.warn('sessionStorage.clear failed:', e)
    }
    // Clear memory storage for sessionStorage keys
    Object.keys(memoryStorage).forEach(key => {
      if (key.startsWith('session_')) {
        delete memoryStorage[key]
      }
    })
  }
}

// Redirect loop detection
export function detectRedirectLoop(): boolean {
  const key = 'redirect_count'
  const timeKey = 'redirect_time'
  const maxRedirects = 3
  const timeWindow = 5000 // 5 seconds

  const now = Date.now()
  const lastTime = safeSessionStorage.getItem(timeKey)
  const count = safeSessionStorage.getItem(key)

  if (lastTime && count) {
    const timeDiff = now - parseInt(lastTime)
    const redirectCount = parseInt(count)

    if (timeDiff < timeWindow) {
      if (redirectCount >= maxRedirects) {
        // Clear the counter to prevent permanent blocking
        safeSessionStorage.removeItem(key)
        safeSessionStorage.removeItem(timeKey)
        return true // Loop detected
      }
      // Increment counter
      safeSessionStorage.setItem(key, (redirectCount + 1).toString())
      safeSessionStorage.setItem(timeKey, now.toString())
    } else {
      // Reset counter if outside time window
      safeSessionStorage.setItem(key, '1')
      safeSessionStorage.setItem(timeKey, now.toString())
    }
  } else {
    // Initialize counter
    safeSessionStorage.setItem(key, '1')
    safeSessionStorage.setItem(timeKey, now.toString())
  }

  return false
}

// Clear redirect loop counter
export function clearRedirectLoop(): void {
  safeSessionStorage.removeItem('redirect_count')
  safeSessionStorage.removeItem('redirect_time')
}

// Check if we're on a mobile device
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera

  // Check for mobile user agents
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
  return mobileRegex.test(userAgent)
}

// Get device info for debugging
export function getDeviceInfo(): string {
  if (typeof window === 'undefined') return 'SSR'

  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    isMobile: isMobileDevice(),
    storageAvailable: {
      localStorage: isStorageAvailable('localStorage'),
      sessionStorage: isStorageAvailable('sessionStorage')
    }
  }

  return JSON.stringify(info, null, 2)
}