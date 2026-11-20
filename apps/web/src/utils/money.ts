// Mirrors MAX_AMOUNT in apps/api/src/utils/validation.ts (no shared package, so change both).
export const MAX_AMOUNT = 1_000_000

// Digits with an optional 1-2 digit fraction. Rejects "1e3", "-5", "12.345" and "" up front, which
// parseFloat/parseInt would silently accept as 1, -5, 12.345 and NaN.
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

export const validateAmount = (raw: string): string | null => {
  const value = raw.trim()
  if (!value) return "Amount is required"
  if (!AMOUNT_PATTERN.test(value)) return "Enter a dollar amount with at most 2 decimals, e.g. 12.50"
  const amount = Number(value)
  if (amount <= 0) return "Amount must be greater than 0"
  if (amount > MAX_AMOUNT) return "Amount is too large"
  return null
}

// Only call after validateAmount returned null. Number("12.34") is the nearest double and the API
// re-checks it is whole cents, so there is no extra rounding here.
export const parseAmount = (raw: string): number => Number(raw.trim())
