import { describe, expect, it } from "vitest"

import { CardBrand, TransactionStatus } from "../models/transaction.js"
import type { Transaction } from "../models/transaction.js"
import { createTransactionService, isProcessed, sumProcessedAmount } from "./transaction-service.js"

// `status` is a string so the fixture can hold statuses the enum has never seen (VOIDED is in the real data)
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

describe("isProcessed", () => {
  it("is true only for APPROVED", () => {
    expect(isProcessed({ status: "APPROVED" })).toBe(true)
    expect(isProcessed({ status: "DECLINED" })).toBe(false)
    expect(isProcessed({ status: "PENDING" })).toBe(false)
    expect(isProcessed({ status: "REFUNDED" })).toBe(false)
  })

  it("excludes VOIDED and statuses it has never seen (allowlist)", () => {
    expect(isProcessed({ status: "VOIDED" })).toBe(false)
    expect(isProcessed({ status: "SOMETHING_NEW" })).toBe(false)
  })
})

describe("sumProcessedAmount", () => {
  it("counts only the APPROVED row when every status is present", () => {
    const rows = [
      make("a", "APPROVED", 100),
      make("b", "DECLINED", 200),
      make("c", "PENDING", 300),
      make("d", "REFUNDED", 400),
      make("e", "VOIDED", 500),
      make("f", "SOMETHING_NEW", 600),
    ]
    expect(sumProcessedAmount(rows)).toBe(100)
  })

  it("sums total (amount + surcharge), not amount alone", () => {
    const row = { ...make("a", "APPROVED", 103), amount: 100, surcharge: 3 }
    expect(sumProcessedAmount([row])).toBe(103)
  })

  it("adds in cents so 1.15 + 2.30 is exactly 3.45", () => {
    const rows = [make("a", "APPROVED", 1.15), make("b", "APPROVED", 2.3)]
    expect(sumProcessedAmount(rows)).toBe(3.45)
  })

  it("returns 0 for an empty list and for a list with no APPROVED rows", () => {
    expect(sumProcessedAmount([])).toBe(0)
    expect(sumProcessedAmount([make("a", "DECLINED", 50)])).toBe(0)
  })
})

describe("getSummary on the shipped data", () => {
  it("totalVolume is the APPROVED total only", () => {
    expect(createTransactionService().getSummary().totalVolume).toBe(6488615.4)
  })
})
