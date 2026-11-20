import { CardBrand } from "../models/transaction.js"
import type { NewTransactionInput } from "../services/transaction-service.js"

export const MAX_MERCHANT_NAME_LENGTH = 100
// Sanity cap, not a business rule: stops typos like an extra three zeros from becoming a "valid" payment.
export const MAX_AMOUNT = 1_000_000

export type FieldErrors = Partial<Record<keyof NewTransactionInput, string>>

export type ValidationResult = { ok: true; value: NewTransactionInput } | { ok: false; errors: FieldErrors }

// The body is untrusted JSON, so every field is checked at runtime: the TypeScript types on the
// route's `req.body` are `any` and promise nothing.
export const validateNewTransaction = (body: unknown): ValidationResult => {
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>
  const errors: FieldErrors = {}

  const merchantName = typeof input.merchantName === "string" ? input.merchantName.trim() : ""
  if (!merchantName) {
    errors.merchantName = "Merchant name is required"
  } else if (merchantName.length > MAX_MERCHANT_NAME_LENGTH) {
    errors.merchantName = `Merchant name must be at most ${MAX_MERCHANT_NAME_LENGTH} characters`
  }

  const cardBrand = input.cardBrand
  if (!Object.values(CardBrand).includes(cardBrand as CardBrand)) {
    errors.cardBrand = `Card brand must be one of ${Object.values(CardBrand).join(", ")}`
  }

  // Amounts are dollars in the data (1616.73), so reject anything that isn't a whole number of cents
  // rather than silently rounding money the caller never meant. Strings are rejected too: "12" is
  // what a client sends when it forgot to parse.
  const amount = input.amount
  let cents = 0
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    errors.amount = "Amount must be a number"
  } else {
    cents = Math.round(amount * 100)
    if (Math.abs(amount * 100 - cents) > 1e-6) {
      errors.amount = "Amount can have at most 2 decimal places"
    } else if (cents <= 0) {
      errors.amount = "Amount must be greater than 0"
    } else if (amount > MAX_AMOUNT) {
      errors.amount = `Amount must be at most ${MAX_AMOUNT}`
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: { merchantName, cardBrand: cardBrand as CardBrand, amount: cents / 100 } }
}
