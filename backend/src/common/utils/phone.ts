/**
 * Normalizes Indian phone numbers according to D44 and D50:
 * - Accepts a 10-digit number starting with 6-9, prepending "+91"
 * - Accepts an existing "+91" number with 10 digits starting with 6-9
 * - Returns normalized E.164 string "+91XXXXXXXXXX"
 * - Returns null if invalid
 */
export function normalizeIndianPhone(input: string | null | undefined): string | null {
  if (!input) return null;

  const cleaned = input.replace(/[\s\-()]/g, "");

  // Case 1: Bare 10-digit input starting with 6-9
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // Case 2: +91 prefix with 10 digits starting with 6-9
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  // Case 3: 91 prefix without plus with 10 digits starting with 6-9
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return null;
}

export function isValidIndianPhone(input: string | null | undefined): boolean {
  return normalizeIndianPhone(input) !== null;
}
