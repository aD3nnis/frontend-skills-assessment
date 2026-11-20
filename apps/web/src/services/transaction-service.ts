import type { CardBrand, Transaction } from "../models/transaction"

const API_BASE = "/api"

export const fetchTransactions = async (): Promise<Transaction[]> => {
  const rsp = await fetch(`${API_BASE}/transactions`)
  const data = await rsp.json()
  return data.transactions
}

export interface NewTransactionInput {
  merchantName: string
  cardBrand: CardBrand
  amount: number
}

// Thrown for non-2xx responses so callers can show the server's per-field messages.
export class ApiError extends Error {
  status: number
  fields: Partial<Record<keyof NewTransactionInput, string>>

  constructor(status: number, message: string, fields: ApiError["fields"] = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

const pickFieldMessages = (fields: unknown): ApiError["fields"] => {
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) return {}
  return Object.fromEntries(Object.entries(fields).filter(([, message]) => typeof message === "string"))
}

export const createTransaction = async (input: NewTransactionInput): Promise<Transaction | null> => {
  const rsp = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!rsp.ok) {
    // The body may not be JSON (proxy error page), so don't let parsing mask the real failure.
    const body = await rsp.json().catch(() => ({}))
    // The body is untrusted: valid JSON can still be `null`, or carry `fields` as a string or array,
    // so check the shape instead of trusting it (Object.entries("oops") would yield one entry per letter).
    const message = typeof body?.error === "string" ? body.error : "Could not create the transaction"
    throw new ApiError(rsp.status, message, pickFieldMessages(body?.fields))
  }
  // A 2xx means the payment exists. An unreadable body must not turn that into a rejection, or the
  // caller reports a failed create and the user retries into a duplicate.
  return rsp.json().catch(() => null)
}
