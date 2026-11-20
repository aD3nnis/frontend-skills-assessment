import { afterEach, describe, expect, it, vi } from "vitest"

import { CardBrand, TransactionStatus } from "../models/transaction"
import type { Transaction } from "../models/transaction"
import { TransactionNotFoundError, fetchTransactionById } from "./transaction-service"

const transaction: Transaction = {
  id: "txn_000001",
  merchantName: "Test Merchant",
  cardBrand: CardBrand.VISA,
  amount: 100,
  surchargeRate: 0.03,
  surcharge: 3,
  total: 103,
  status: TransactionStatus.APPROVED,
  createdAt: "2026-01-01T00:00:00.000Z",
}

// The service only reads `ok`, `status` and `json()`, so a plain object stands in for a Response.
const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchTransactionById", () => {
  it("returns the transaction on 200", async () => {
    vi.stubGlobal("fetch", respond(200, transaction))
    await expect(fetchTransactionById("txn_000001")).resolves.toEqual(transaction)
  })

  it("throws TransactionNotFoundError on 404 and does not treat the error body as a transaction", async () => {
    vi.stubGlobal("fetch", respond(404, { error: "Transaction not found" }))
    await expect(fetchTransactionById("nope")).rejects.toBeInstanceOf(TransactionNotFoundError)
  })

  it("throws a plain Error, not TransactionNotFoundError, on a 500", async () => {
    vi.stubGlobal("fetch", respond(500, { error: "boom" }))
    const failure = await fetchTransactionById("txn_000001").catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(TransactionNotFoundError)
  })

  it("lets a network failure reject as a plain Error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
    const failure = await fetchTransactionById("txn_000001").catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(TransactionNotFoundError)
  })

  it("encodes the id so characters like / and spaces stay inside one path segment", async () => {
    const fetchMock = respond(404, { error: "Transaction not found" })
    vi.stubGlobal("fetch", fetchMock)
    await fetchTransactionById("a/b c%").catch(() => undefined)
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions/a%2Fb%20c%25")
  })
})
