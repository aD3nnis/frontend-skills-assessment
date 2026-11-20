import { describe, expect, it } from "vitest"

import { CardBrand } from "../models/transaction.js"
import { MAX_AMOUNT, validateNewTransaction } from "./validation.js"

const valid = { merchantName: "Acme", cardBrand: "VISA", amount: 12.34 }

describe("validateNewTransaction", () => {
  it("accepts a valid body and trims the merchant name", () => {
    const result = validateNewTransaction({ ...valid, merchantName: "  Acme  " })
    expect(result).toEqual({ ok: true, value: { merchantName: "Acme", cardBrand: CardBrand.VISA, amount: 12.34 } })
  })

  it("rejects a non-object body with an error per field", () => {
    const result = validateNewTransaction(undefined)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["amount", "cardBrand", "merchantName"])
  })

  it("rejects blank merchant names and unknown card brands", () => {
    const result = validateNewTransaction({ ...valid, merchantName: "   ", cardBrand: "DINERS" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["cardBrand", "merchantName"])
  })

  it.each([
    ["a string", "12"],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["zero", 0],
    ["negative", -5],
    ["3 decimal places", 1.005],
    ["above the cap", MAX_AMOUNT + 1],
  ])("rejects an amount that is %s", (_label, amount) => {
    const result = validateNewTransaction({ ...valid, amount })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.amount).toBeDefined()
  })

  it("accepts floats that are whole cents despite binary representation (0.1 + 0.2)", () => {
    const result = validateNewTransaction({ ...valid, amount: 0.1 + 0.2 })
    expect(result).toMatchObject({ ok: true, value: { amount: 0.3 } })
  })
})
