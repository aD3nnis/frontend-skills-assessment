import { afterEach, describe, expect, it, vi } from "vitest"

import { CardBrand } from "../models/transaction"
import { ApiError, createTransaction } from "./transaction-service"

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

describe("createTransaction success", () => {
  it("returns the created transaction", async () => {
    respondWith(JSON.stringify({ id: "txn_010001", amount: 12.5 }), 201)
    await expect(createTransaction(input)).resolves.toMatchObject({ id: "txn_010001" })
  })
})
