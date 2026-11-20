import type { AddressInfo } from "node:net"
import type { Server } from "node:http"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import { createTransactionService } from "./services/transaction-service.js"

// The unit tests cover parseListQuery and listTransactions; these cover the route that joins them, which is where
// a bad query becomes a 400 instead of a 500.
let server: Server
let base: string

beforeAll(async () => {
  server = createApp(createTransactionService()).listen(0)
  await new Promise((resolve) => server.once("listening", resolve))
  base = `http://localhost:${(server.address() as AddressInfo).port}/api/transactions`
})

afterAll(() => {
  server.close()
})

// fetch's json() is typed unknown; the tests assert on the shape themselves
const getJson = async (url: string) => {
  const rsp = await fetch(url)
  return { status: rsp.status, body: (await rsp.json()) as Record<string, any> }
}

describe("GET /api/transactions", () => {
  it("returns the first page with the match count and approved total", async () => {
    const { status, body } = await getJson(base)
    expect(status).toBe(200)
    expect(Object.keys(body).sort()).toEqual(["page", "pageSize", "total", "totalProcessed", "transactions"])
    expect(body.transactions).toHaveLength(25)
    expect(body.total).toBe(10000)
    expect(body.page).toBe(1)
  })

  it("applies q, page and pageSize from the query string", async () => {
    const { body } = await getJson(`${base}?q=%20VISA%20&page=2&pageSize=5`)
    expect(body.transactions).toHaveLength(5)
    expect(body.page).toBe(2)
    expect(body.pageSize).toBe(5)
    expect(body.total).toBeLessThan(10000)
    expect(body.transactions.every((t: { cardBrand: string }) => t.cardBrand === "VISA")).toBe(true)
  })

  it("returns an empty page, with the real total, past the last page", async () => {
    const { status, body } = await getJson(`${base}?page=99999`)
    expect(status).toBe(200)
    expect(body.transactions).toEqual([])
    expect(body.total).toBe(10000)
  })

  it.each(["page=0", "page=-1", "page=abc", "page=1.5", "page=1&page=2", "pageSize=101", "pageSize=0", "q=a&q=b"])(
    "answers %s with a 400 and an error message, not a 500",
    async (query) => {
      const { status, body } = await getJson(`${base}?${query}`)
      expect(status).toBe(400)
      expect(typeof body.error).toBe("string")
      expect(body.stack).toBeUndefined()
    },
  )
})
