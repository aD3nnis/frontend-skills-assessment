import type { AddressInfo } from "node:net"
import type { Server } from "node:http"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { createApp } from "./app.js"
import { createTransactionService } from "./services/transaction-service.js"

// Own app instance: a valid POST adds a row, which must not change the totals app.test.ts asserts on.
// These cover the wiring the unit tests cannot: that the route rejects bad input and that the error
// handler is registered on the app.
let server: Server
let url: string

beforeAll(async () => {
  server = createApp(createTransactionService()).listen(0)
  await new Promise((resolve) => server.once("listening", resolve))
  url = `http://localhost:${(server.address() as AddressInfo).port}/api/transactions`
})

afterAll(() => {
  server.close()
})

const post = async (body: string) => {
  const rsp = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body })
  return { status: rsp.status, body: (await rsp.json()) as Record<string, any> }
}

describe("POST /api/transactions", () => {
  it("creates a transaction from a valid body and normalises the amount to cents", async () => {
    const { status, body } = await post(JSON.stringify({ merchantName: "  Acme ", cardBrand: "VISA", amount: 12.5 }))
    expect(status).toBe(201)
    expect(body).toMatchObject({ merchantName: "Acme", cardBrand: "VISA", amount: 12.5, status: "APPROVED" })
  })

  it("answers an invalid body with 400 and per-field errors, and creates nothing", async () => {
    const before = (await (await fetch(url)).json()) as { total: number }
    const { status, body } = await post(JSON.stringify({ merchantName: "", cardBrand: "NOPE", amount: "12" }))
    expect(status).toBe(400)
    expect(Object.keys(body.fields).sort()).toEqual(["amount", "cardBrand", "merchantName"])
    const after = (await (await fetch(url)).json()) as { total: number }
    expect(after.total).toBe(before.total)
  })

  it("answers malformed JSON with 400 and no stack trace", async () => {
    const { status, body } = await post("{bad")
    expect(status).toBe(400)
    expect(body).toEqual({ error: "Invalid JSON body" })
  })

  it("answers an unexpected error with a generic 500 and no stack trace", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const service = createTransactionService()
    service.create = () => {
      throw new Error("ENOENT: /srv/app/secret/path")
    }
    const broken = createApp(service).listen(0)
    await new Promise((resolve) => broken.once("listening", resolve))
    try {
      const rsp = await fetch(`http://localhost:${(broken.address() as AddressInfo).port}/api/transactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merchantName: "Acme", cardBrand: "VISA", amount: 1 }),
      })
      expect(rsp.status).toBe(500)
      expect(await rsp.json()).toEqual({ error: "Internal server error" })
    } finally {
      broken.close()
      vi.restoreAllMocks()
    }
  })
})
