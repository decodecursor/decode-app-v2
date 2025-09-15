// Centralized user role definitions and validation

export const USER_ROLES = {
  ADMIN: 'Admin',
  USER: 'User'
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]

export const VALID_ROLES: UserRole[] = Object.values(USER_ROLES)

export function isValidRole(role: any): role is UserRole {
  return typeof role === 'string' && VALID_ROLES.includes(role as UserRole)
}

export function normalizeRole(role: any): UserRole | null {
  if (!role || typeof role !== 'string') {
    return null
  }

  const normalizedRole = role.trim()

  // Exact matches first
  if (normalizedRole === USER_ROLES.ADMIN) return USER_ROLES.ADMIN
  if (normalizedRole === USER_ROLES.USER) return USER_ROLES.USER

  // Case-insensitive matches
  const lowerRole = normalizedRole.toLowerCase()
  if (lowerRole === 'admin' || lowerRole === 'administrator') return USER_ROLES.ADMIN
  if (lowerRole === 'user' || lowerRole === 'employee' || lowerRole === 'member') return USER_ROLES.USER

  console.warn(`Unknown role encountered: "${role}". Valid roles are: ${VALID_ROLES.join(', ')}`)
  return null
}

export interface UserProfile {
  id: string
  role: UserRole
  user_name?: string
  company_name?: string
  professional_center_name?: string
  branch_name?: string
  approval_status: 'pending' | 'approved' | 'rejected'
  companyProfileImage?: string | null
  pendingUsersCount?: number
}

export function validateUserProfile(data: any): UserProfile {
  if (!data || typeof data !== 'object') {
    console.warn('Invalid user profile data: not an object, using defaults')
    return {
      id: '',
      role: USER_ROLES.USER, // Default to User role
      user_name: null,
      company_name: null,
      professional_center_name: null,
      branch_name: null,
      approval_status: 'pending',
      companyProfileImage: null,
      pendingUsersCount: 0
    }
  }

  const normalizedRole = normalizeRole(data.role)
  if (!normalizedRole) {
    console.warn(`Invalid user role: "${data.role}". Defaulting to User role`)
  }

  return {
    id: data.id || '',
    role: normalizedRole || USER_ROLES.USER, // Always provide a valid role
    user_name: data.user_name || null,
    company_name: data.company_name || null,
    professional_center_name: data.professional_center_name || null,
    branch_name: data.branch_name || null,
    approval_status: data.approval_status || 'pending',
    companyProfileImage: data.companyProfileImage || null,
    pendingUsersCount: data.pendingUsersCount || 0
  }
}