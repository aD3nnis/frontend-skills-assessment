import { describe, expect, it } from "vitest"

import { CardBrand, TransactionStatus } from "../models/transaction.js"
import type { Transaction } from "../models/transaction.js"
import { createTransactionService, isProcessed, listTransactions, sumProcessedAmount } from "./transaction-service.js"

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

// Fixture rows with explicit fields so search and ordering cases can be targeted
const row = (id: string, over: Partial<Transaction> & { status?: string } = {}): Transaction => ({
  ...make(id, over.status ?? "APPROVED", over.total ?? 10),
  ...over,
  status: (over.status ?? "APPROVED") as TransactionStatus,
})

describe("listTransactions", () => {
  const params = { q: "", page: 1, pageSize: 2 }

  it("returns one page and the match count and approved total for every match", () => {
    const rows = [
      row("t1", { total: 10 }),
      row("t2", { total: 20, status: "DECLINED" }),
      row("t3", { total: 30 }),
      row("t4", { total: 40, status: "VOIDED" }),
      row("t5", { total: 50 }),
    ]
    const result = listTransactions(rows, params)
    expect(result.transactions).toHaveLength(2)
    expect(result.total).toBe(5)
    // 10 + 30 + 50 across all pages, not just the 2 rows shown
    expect(result.totalProcessed).toBe(90)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(2)
  })

  it("matches merchantName, id, cardBrand and status, case-insensitively and trimmed", () => {
    const rows = [
      row("txn_000001", { merchantName: "Blue Ridge Outfitters", cardBrand: CardBrand.VISA }),
      row("txn_000002", { merchantName: "Acme", cardBrand: CardBrand.AMEX }),
      row("txn_000003", { merchantName: "Zed", cardBrand: CardBrand.DISCOVER, status: "PENDING" }),
    ]
    const ids = (q: string) => listTransactions(rows, { q, page: 1, pageSize: 10 }).transactions.map((t) => t.id)
    expect(ids("  blue RIDGE ")).toEqual(["txn_000001"])
    expect(ids("TXN_000002")).toEqual(["txn_000002"])
    expect(ids("amex")).toEqual(["txn_000002"])
    expect(ids("pend")).toEqual(["txn_000003"])
    expect(ids("")).toHaveLength(3)
    expect(ids("   ")).toHaveLength(3)
    expect(ids("no such thing")).toEqual([])
  })

  it("orders newest first and breaks timestamp ties by id so pages never repeat or skip a row", () => {
    const same = "2026-05-17T00:00:00.000Z"
    const rows = [
      row("t3", { createdAt: same }),
      row("t1", { createdAt: same }),
      row("t4", { createdAt: "2026-06-01T00:00:00.000Z" }),
      row("t2", { createdAt: same }),
      row("t5", { createdAt: "2026-01-01T00:00:00.000Z" }),
    ]
    const all = [1, 2, 3].flatMap((page) => listTransactions(rows, { q: "", page, pageSize: 2 }).transactions)
    expect(all.map((t) => t.id)).toEqual(["t4", "t1", "t2", "t3", "t5"])
  })

  it("returns an empty page, with the real total, past the last page", () => {
    const rows = [row("t1"), row("t2"), row("t3")]
    const result = listTransactions(rows, { q: "", page: 9, pageSize: 2 })
    expect(result.transactions).toEqual([])
    expect(result.total).toBe(3)
  })

  it("does not change the order of the array it is given", () => {
    const rows = [row("t1", { createdAt: "2026-01-01T00:00:00.000Z" }), row("t2", { createdAt: "2026-02-01T00:00:00.000Z" })]
    listTransactions(rows, params)
    expect(rows.map((t) => t.id)).toEqual(["t1", "t2"])
  })
})

describe("service.list", () => {
  it("covers the whole shipped dataset across pages and agrees with getSummary", () => {
    const service = createTransactionService()
    const first = service.list({ q: "", page: 1, pageSize: 25 })
    expect(first.total).toBe(10000)
    expect(first.transactions).toHaveLength(25)
    expect(first.totalProcessed).toBe(service.getSummary().totalVolume)
  })

  it("puts a newly created transaction first", () => {
    const service = createTransactionService()
    const created = service.create({ merchantName: "Zzz New Merchant", cardBrand: CardBrand.VISA, amount: 5 })
    const page = service.list({ q: "", page: 1, pageSize: 25 })
    expect(page.transactions[0].id).toBe(created.id)
    expect(page.total).toBe(10001)
  })
})
