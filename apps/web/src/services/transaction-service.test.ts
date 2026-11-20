import { afterEach, describe, expect, it, vi } from "vitest"

import { CardBrand, TransactionStatus } from "../models/transaction"
import type { Transaction } from "../models/transaction"
import { ApiError, TransactionNotFoundError, createTransaction, fetchTransactionById } from "./transaction-service"

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

const input = { merchantName: "Acme", cardBrand: CardBrand.VISA, amount: 12.5 }

const respondWith = (body: string, status: number) =>
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status })))

const failure = async (): Promise<ApiError> => {
  const err = await createTransaction(input).then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(ApiError)
  return err as ApiError
}

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

  it("treats a 200 body that is not a transaction as not found (the API's /summary route answers for the id \"summary\")", async () => {
    vi.stubGlobal("fetch", respond(200, { count: 10000, totalVolume: 6488615.4, totalSurcharge: 763737.79 }))
    await expect(fetchTransactionById("summary")).rejects.toBeInstanceOf(TransactionNotFoundError)
  })

  it("treats a 200 with a null body as not found", async () => {
    vi.stubGlobal("fetch", respond(200, null))
    await expect(fetchTransactionById("x")).rejects.toBeInstanceOf(TransactionNotFoundError)
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

describe("createTransaction errors", () => {
  it("carries the server's per-field messages on a 400", async () => {
    respondWith(JSON.stringify({ error: "Invalid transaction", fields: { amount: "Amount must be a number" } }), 400)
    const err = await failure()
    expect(err.status).toBe(400)
    expect(err.message).toBe("Invalid transaction")
    expect(err.fields).toEqual({ amount: "Amount must be a number" })
  })

  it("falls back to a generic message when the body is not JSON (proxy 500)", async () => {
    respondWith("Error occurred while trying to proxy", 500)
    const err = await failure()
    expect(err.status).toBe(500)
    expect(err.message).toBe("Could not create the transaction")
    expect(err.fields).toEqual({})
  })

  it("survives a JSON body of null", async () => {
    respondWith("null", 500)
    const err = await failure()
    expect(err.message).toBe("Could not create the transaction")
    expect(err.fields).toEqual({})
  })

  it("survives fields: null, so callers can call Object.keys(err.fields)", async () => {
    respondWith(JSON.stringify({ error: "Boom", fields: null }), 500)
    const err = await failure()
    expect(err.message).toBe("Boom")
    expect(err.fields).toEqual({})
  })
})

describe("createTransaction error body shape", () => {
  it.each([
    ["a string", "oops"],
    ["an array", ["amount", "bad"]],
    ["a number", 5],
  ])("ignores `fields` that is %s", async (_label, fields) => {
    respondWith(JSON.stringify({ error: "Boom", fields }), 400)
    const err = await failure()
    expect(err.message).toBe("Boom")
    expect(err.fields).toEqual({})
  })

  it("keeps only string messages inside `fields`", async () => {
    respondWith(JSON.stringify({ fields: { amount: "Too big", merchantName: { nested: 1 } } }), 400)
    const err = await failure()
    expect(err.fields).toEqual({ amount: "Too big" })
  })

  it("ignores an `error` that is not a string", async () => {
    respondWith(JSON.stringify({ error: { code: 502 } }), 502)
    const err = await failure()
    expect(err.message).toBe("Could not create the transaction")
  })
})

describe("createTransaction success", () => {
  it("still resolves when a 2xx response has no usable body, because the payment was created", async () => {
    respondWith("", 201)
    await expect(createTransaction(input)).resolves.toBeNull()
  })

  it("returns the created transaction", async () => {
    respondWith(JSON.stringify({ id: "txn_010001", amount: 12.5 }), 201)
    await expect(createTransaction(input)).resolves.toMatchObject({ id: "txn_010001" })
  })
})
