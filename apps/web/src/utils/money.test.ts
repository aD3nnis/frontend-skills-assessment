import { describe, expect, it } from "vitest"

import { MAX_AMOUNT, parseAmount, validateAmount } from "./money"

describe("validateAmount", () => {
  it.each(["1", "12.5", "12.50", "0.01", " 99.99 ", String(MAX_AMOUNT)])("accepts %j", (raw) => {
    expect(validateAmount(raw)).toBeNull()
  })

  it.each(["", "  ", "abc", "-5", "1e3", "12.345", "1,000", "0", "0.00", String(MAX_AMOUNT + 1)])(
    "rejects %j",
    (raw) => {
      expect(validateAmount(raw)).toEqual(expect.any(String))
    },
  )
})

describe("parseAmount", () => {
  it("parses decimals instead of truncating like parseInt did", () => {
    expect(parseAmount("12.34")).toBe(12.34)
    expect(parseAmount(" 7 ")).toBe(7)
  })
})
