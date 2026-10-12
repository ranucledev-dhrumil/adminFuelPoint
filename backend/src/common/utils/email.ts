/**
 * Normalizes email strings:
 * - Trims whitespace
 * - Converts to lower-case
 * - Returns null for empty, null, or undefined inputs
 */
export function normalizeEmail(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const trimmed = input.trim();
  if (trimmed === "") return null;
  return trimmed.toLowerCase();
}

export function isValidEmailFormat(input: string | null | undefined): boolean {
  if (!input) return false;
  const normalized = normalizeEmail(input);
  if (!normalized) return false;
  // Standard RFC-compliant basic regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
