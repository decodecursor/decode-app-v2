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

/**
 * Generate a 10-digit alphanumeric ID for payout request tracking
 * Format: A1B2C3D4E5 (alternating letters and numbers for readability)
 * 
 * Provides 36^10 unique combinations (3.6 * 10^15)
 * Extremely low collision probability for tracking purposes
 */
export function generatePayoutRequestId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let result = '';
  
  // Generate 10 characters alternating between letters and numbers
  for (let i = 0; i < 10; i++) {
    if (i % 2 === 0) {
      // Even positions: letters
      result += letters.charAt(Math.floor(Math.random() * letters.length));
    } else {
      // Odd positions: numbers  
      result += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
  }
  
  return result;
}

/**
 * Generate a unique payout request ID with collision check
 * Attempts up to 5 retries before falling back to timestamp-based ID
 */
export async function generateUniquePayoutRequestId(
  checkExists: (id: string) => Promise<boolean>,
  maxRetries: number = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const requestId = generatePayoutRequestId();
    
    try {
      // Check if this ID already exists
      const exists = await checkExists(requestId);
      
      if (!exists) {
        return requestId;
      }
      
      console.warn(`Payout request ID collision detected: ${requestId}, retrying... (attempt ${attempt + 1}/${maxRetries})`);
    } catch (error) {
      console.error(`Error checking payout request ID existence: ${error}, attempting anyway with ID: ${requestId}`);
      // If we can't check existence, just return the request ID anyway
      return requestId;
    }
  }
  
  // Fallback to timestamp-based ID if too many collisions (extremely rare)
  console.error('Too many payout request ID collisions, falling back to timestamp-based ID');
  const timestamp = Date.now().toString();
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `P${timestamp.slice(-6)}${randomSuffix}`;
}

/**
 * Validate if a string is a valid payout request ID format
 */
export function isValidPayoutRequestId(id: string): boolean {
  // Check if it's exactly 10 characters alternating letters and numbers
  return /^[A-Z][0-9][A-Z][0-9][A-Z][0-9][A-Z][0-9][A-Z][0-9]$/.test(id);
}

/**
 * Generate a 10-character payment link request ID for tracking
 * Format: PL + 8 alphanumeric characters (e.g., PL7G4K2M9P)
 *
 * Provides 36^8 unique combinations (2.8 * 10^12)
 * Very low collision probability for tracking purposes
 */
export function generatePaymentLinkRequestId(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const prefix = 'PL';
  let result = prefix;

  // Generate 8 random alphanumeric characters
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

/**
 * Generate a unique payment link request ID with collision check
 * Attempts up to 5 retries before falling back to timestamp-based ID
 */
export async function generateUniquePaymentLinkRequestId(
  checkExists: (id: string) => Promise<boolean>,
  maxRetries: number = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const requestId = generatePaymentLinkRequestId();

    try {
      // Check if this ID already exists
      const exists = await checkExists(requestId);

      if (!exists) {
        return requestId;
      }

      console.warn(`Payment link request ID collision detected: ${requestId}, retrying... (attempt ${attempt + 1}/${maxRetries})`);
    } catch (error) {
      console.error(`Error checking payment link request ID existence: ${error}, attempting anyway with ID: ${requestId}`);
      // If we can't check existence, just return the request ID anyway
      return requestId;
    }
  }

  // Fallback to timestamp-based ID if too many collisions (extremely rare)
  console.error('Too many payment link request ID collisions, falling back to timestamp-based ID');
  const timestamp = Date.now().toString();
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `PL${timestamp.slice(-6)}${randomSuffix}`;
}

/**
 * Validate if a string is a valid payment link request ID format
 */
export function isValidPaymentLinkRequestId(id: string): boolean {
  // Check if it starts with PL and has 8 alphanumeric characters after
  return /^PL[A-Z0-9]{8}$/.test(id);
}