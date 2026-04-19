// Mask an email for safe logging: keep first 3 chars of the local part,
// then "****", then "@domain". Returns "****" if the input is empty/invalid.
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '****'
  const at = email.indexOf('@')
  if (at < 0) return email.slice(0, 3) + '****'
  const local = email.slice(0, at)
  const domain = email.slice(at)
  return local.slice(0, 3) + '****' + domain
}
