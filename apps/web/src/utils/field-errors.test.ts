import { describe, expect, it } from "vitest"

import { splitFieldErrors } from "./field-errors"

const known = ["merchantName", "cardBrand", "amount"] as const

describe("splitFieldErrors", () => {
  it("puts errors for form inputs in `known`", () => {
    expect(splitFieldErrors({ amount: "Too big" }, known)).toEqual({
      known: [{ name: "amount", message: "Too big" }],
      unknown: [],
    })
  })

  it("keeps errors for fields the form has no input for, so they can be shown elsewhere", () => {
    expect(splitFieldErrors({ currency: "Unsupported", amount: "Too big" }, known)).toEqual({
      known: [{ name: "amount", message: "Too big" }],
      unknown: ["Unsupported"],
    })
  })

  it("returns nothing for an empty map", () => {
    expect(splitFieldErrors({}, known)).toEqual({ known: [], unknown: [] })
  })
})
