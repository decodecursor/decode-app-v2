// Utility functions for handling user display and deleted users

const DELETED_USER_ID = '00000000-0000-0000-0000-000000000000'

/**
 * Formats a user name for display, handling deleted users gracefully
 * @param creatorName - The creator name from the database
 * @param creatorId - The creator ID (optional, for additional checking)
 * @returns Formatted display name
 */
export function formatUserName(creatorName: string | null, creatorId?: string | null): string {
  // Check if this is the deleted user by ID
  if (creatorId === DELETED_USER_ID) {
    return 'Deleted User'
  }

  // Check if this is the deleted user by name
  if (creatorName === 'Deleted User') {
    return 'Deleted User'
  }

  // Return the actual name or fallback
  return creatorName || 'Unknown User'
}

/**
 * Checks if a user ID represents a deleted user
 * @param userId - The user ID to check
 * @returns True if the user is deleted
 */
export function isDeletedUser(userId: string | null): boolean {
  return userId === DELETED_USER_ID
}

/**
 * Formats creator name with appropriate styling for deleted users
 * @param creatorName - The creator name from the database
 * @param creatorId - The creator ID (optional)
 * @returns Object with display name and style class
 */
export function formatUserNameWithStyle(creatorName: string | null, creatorId?: string | null): {
  name: string
  className: string
} {
  if (creatorId === DELETED_USER_ID || creatorName === 'Deleted User') {
    return {
      name: 'Deleted User',
      className: 'text-gray-500 italic'
    }
  }

  return {
    name: creatorName || 'Unknown User',
    className: ''
  }
}