import { describe, expect, it } from "vitest"

import { CardBrand, TransactionStatus } from "../models/transaction"
import type { Transaction } from "../models/transaction"
import { computeTotal } from "./format"

// `status` is a string so the fixture can hold statuses the enum has never seen (VOIDED is in the real data).
// Same cases as apps/api/src/services/transaction-service.test.ts: the two rules must agree.
const make = (id: string, status: string, total: number): Transaction => ({
  id,
  merchantName: "Test Merchant",
  cardBrand: CardBrand.VISA,
  amount: total,
  surchargeRate: 0,
  surcharge: 0,
  total,
  status: status as TransactionStatus,
  createdAt: "2026-01-01T00:00:00.000Z",
})

describe("computeTotal", () => {
  it("counts only the APPROVED row when every status is present", () => {
    const rows = [
      make("a", "APPROVED", 100),
      make("b", "DECLINED", 200),
      make("c", "PENDING", 300),
      make("d", "REFUNDED", 400),
      make("e", "VOIDED", 500),
      make("f", "SOMETHING_NEW", 600),
    ]
    expect(computeTotal(rows)).toBe(100)
  })

  it("sums total (amount + surcharge), not amount alone", () => {
    const row = { ...make("a", "APPROVED", 103), amount: 100, surcharge: 3 }
    expect(computeTotal([row])).toBe(103)
  })

  it("adds in cents so 1.15 + 2.30 is exactly 3.45", () => {
    const rows = [make("a", "APPROVED", 1.15), make("b", "APPROVED", 2.3)]
    expect(computeTotal(rows)).toBe(3.45)
  })

  it("returns 0 for an empty list and for a list with no APPROVED rows", () => {
    expect(computeTotal([])).toBe(0)
    expect(computeTotal([make("a", "DECLINED", 50)])).toBe(0)
  })
})
