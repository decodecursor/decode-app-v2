/**
 * Formats IBAN string with spaces every 4 characters
 * Example: "AE070030012769313820001" -> "AE07 0030 0127 6931 3820 001"
 *
 * @param value - Raw IBAN input (may contain spaces)
 * @returns Formatted IBAN with spaces every 4 characters
 */
export function formatIBAN(value: string): string {
  // Remove all spaces and convert to uppercase
  const cleanValue = value.replace(/\s/g, '').toUpperCase()

  // Split into groups of 4 characters
  const groups: string[] = []
  for (let i = 0; i < cleanValue.length; i += 4) {
    groups.push(cleanValue.slice(i, i + 4))
  }

  // Join with spaces
  return groups.join(' ')
}

/**
 * Removes all spaces from IBAN string
 * Used for backend submission
 *
 * @param value - Formatted IBAN (may contain spaces)
 * @returns Clean IBAN without spaces
 */
export function cleanIBAN(value: string): string {
  return value.replace(/\s/g, '')
}

/**
 * Calculates the cursor position after formatting
 * Ensures cursor stays in the correct position when spaces are added/removed
 *
 * @param rawValue - Original value before formatting
 * @param formattedValue - Value after formatting
 * @param currentCursorPos - Current cursor position
 * @returns New cursor position after formatting
 */
export function calculateCursorPosition(
  rawValue: string,
  formattedValue: string,
  currentCursorPos: number
): number {
  // Count how many non-space characters are before the cursor
  const charsBeforeCursor = rawValue
    .slice(0, currentCursorPos)
    .replace(/\s/g, '').length

  // Find the position in formatted string that has the same number of non-space chars
  let count = 0
  let newPos = 0

  for (let i = 0; i < formattedValue.length; i++) {
    if (formattedValue[i] !== ' ') {
      count++
      if (count === charsBeforeCursor) {
        newPos = i + 1
        break
      }
    }
  }

  // If we didn't find enough chars, cursor goes to end
  if (count < charsBeforeCursor) {
    newPos = formattedValue.length
  }

  return newPos
}
