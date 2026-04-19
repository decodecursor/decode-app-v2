// Instagram handle: 1-30 chars, lowercase letters, digits, underscore, dot.
// Caller is expected to have stripped any leading "@" and lowercased.
export function isValidInstagramHandle(handle: string): boolean {
  return handle.length > 0 && handle.length <= 30 && /^[a-z0-9_.]+$/.test(handle)
}
