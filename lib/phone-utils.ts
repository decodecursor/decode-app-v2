/**
 * Phone number utilities for AUTHKEY WhatsApp integration
 * Parses E.164 format phone numbers into country_code and mobile components
 */

import { COUNTRY_CODES } from './country-codes';

export interface ParsedPhone {
  countryCode: string; // Without + prefix (e.g., "971")
  mobile: string;      // Local number without country code
  isValid: boolean;
}

/**
 * Parse an E.164 formatted phone number into country code and mobile number
 * @param phone - Phone number in E.164 format (e.g., +971501234567)
 * @returns Parsed phone object with countryCode and mobile
 */
export function parseE164(phone: string): ParsedPhone {
  // Remove any spaces or dashes
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Must start with +
  if (!cleaned.startsWith('+')) {
    return { countryCode: '', mobile: '', isValid: false };
  }

  // Remove the + prefix for matching
  const withoutPlus = cleaned.substring(1);

  // Sort country codes by length (longest first) to match correctly
  // e.g., +1684 (American Samoa) should match before +1 (USA)
  const sortedCodes = [...COUNTRY_CODES].sort(
    (a, b) => b.code.length - a.code.length
  );

  // Find matching country code
  for (const country of sortedCodes) {
    const codeWithoutPlus = country.code.substring(1); // Remove + from country code
    if (withoutPlus.startsWith(codeWithoutPlus)) {
      const mobile = withoutPlus.substring(codeWithoutPlus.length);

      // Validate mobile part has digits
      if (mobile.length >= 5 && /^\d+$/.test(mobile)) {
        return {
          countryCode: codeWithoutPlus,
          mobile: mobile,
          isValid: true,
        };
      }
    }
  }

  // Fallback: Try to extract country code heuristically
  // Common country codes are 1-4 digits
  for (let len = 4; len >= 1; len--) {
    const possibleCode = withoutPlus.substring(0, len);
    const mobile = withoutPlus.substring(len);

    if (/^\d+$/.test(possibleCode) && mobile.length >= 5 && /^\d+$/.test(mobile)) {
      return {
        countryCode: possibleCode,
        mobile: mobile,
        isValid: true,
      };
    }
  }

  return { countryCode: '', mobile: '', isValid: false };
}

/**
 * Format a phone number to E.164 format
 * @param countryCode - Country code without + (e.g., "971")
 * @param mobile - Local mobile number
 * @returns E.164 formatted phone number (e.g., "+971501234567")
 */
export function toE164(countryCode: string, mobile: string): string {
  const cleanCode = countryCode.replace(/\D/g, '');
  const cleanMobile = mobile.replace(/\D/g, '');
  return `+${cleanCode}${cleanMobile}`;
}

/**
 * Validate E.164 phone number format
 * @param phone - Phone number to validate
 * @returns true if valid E.164 format
 */
export function isValidE164(phone: string): boolean {
  // E.164 format: +[country code][number], total 8-15 digits after +
  const e164Regex = /^\+[1-9]\d{7,14}$/;
  return e164Regex.test(phone.replace(/[\s\-\(\)]/g, ''));
}
