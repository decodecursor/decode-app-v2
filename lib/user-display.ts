/**
 * Utility functions for user display names
 * Prioritizes company name over email address for better user experience
 */

export interface UserDisplayInfo {
  id: string
  email: string
  company_name?: string | null
  full_name?: string | null
}

/**
 * Get the best display name for a user
 * Priority: company_name > full_name > email (first part) 
 */
export function getUserDisplayName(user: UserDisplayInfo): string {
  if (user.company_name?.trim()) {
    return user.company_name.trim()
  }
  
  if (user.full_name?.trim()) {
    return user.full_name.trim()
  }
  
  // Fallback to first part of email
  return user.email?.split('@')[0] || 'User'
}

/**
 * Get display name with fallback text
 */
export function getUserDisplayNameWithFallback(
  user: UserDisplayInfo | null | undefined, 
  fallback: string = 'User'
): string {
  if (!user) return fallback
  return getUserDisplayName(user)
}

/**
 * Check if user has a proper display name (not just email fallback)
 */
export function hasProperDisplayName(user: UserDisplayInfo): boolean {
  return Boolean(user.company_name?.trim() || user.full_name?.trim())
}

/**
 * Get user identifier for business contexts (shows company name if available)
 */
export function getBusinessDisplayName(user: UserDisplayInfo): string {
  if (user.company_name?.trim()) {
    return user.company_name.trim()
  }
  
  // For business contexts, show full name or email as fallback
  return user.full_name?.trim() || user.email?.split('@')[0] || 'Business'
}