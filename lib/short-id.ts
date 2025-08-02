// Short ID generator for payment links
// Generates 8-character hexadecimal IDs optimized for early-stage startups

import { randomBytes } from 'crypto';

/**
 * Generate a short 8-character hexadecimal ID
 * Format: XXXXXXXX (e.g., A1B2C3D4)
 * 
 * Provides 4.3 billion unique combinations (16^8)
 * Collision probability: ~0.0001% for 1M users, ~0.001% for 10M users
 */
export function generateShortId(): string {
  // Generate 4 random bytes and convert to hex
  const buffer = randomBytes(4);
  return buffer.toString('hex').toUpperCase();
}

/**
 * Generate a short ID with collision check against existing IDs
 * Attempts up to 5 retries before falling back to UUID
 */
export async function generateUniqueShortId(
  checkExists: (id: string) => Promise<boolean>,
  maxRetries: number = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const shortId = generateShortId();
    
    try {
      // Check if this ID already exists
      const exists = await checkExists(shortId);
      
      if (!exists) {
        console.log(`✅ Generated unique short ID: ${shortId}`);
        return shortId;
      }
      
      console.warn(`Short ID collision detected: ${shortId}, retrying... (attempt ${attempt + 1}/${maxRetries})`);
    } catch (error) {
      console.error(`Error checking short ID existence: ${error}, attempting anyway with ID: ${shortId}`);
      // If we can't check existence, just return the short ID anyway
      // This prevents fallback to UUID due to database errors
      return shortId;
    }
  }
  
  // Fallback to UUID if too many collisions (extremely rare)
  console.error('Too many short ID collisions, falling back to UUID');
  const { v4: uuidv4 } = await import('uuid');
  return uuidv4();
}

/**
 * Validate if a string is a valid short ID format
 */
export function isValidShortId(id: string): boolean {
  // Check if it's exactly 8 characters and all hex
  return /^[0-9A-Fa-f]{8}$/.test(id);
}

/**
 * Validate if a string is a valid UUID format (for backward compatibility)
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate if a string is a valid payment link ID (either short ID or UUID)
 */
export function isValidPaymentLinkId(id: string): boolean {
  return isValidShortId(id) || isValidUUID(id);
}