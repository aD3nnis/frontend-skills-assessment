import type { CardBrand, Transaction, TransactionPage } from "../models/transaction"

const API_BASE = "/api"

export interface FetchTransactionsParams {
  q: string
  page: number
  pageSize: number
  signal?: AbortSignal
}

export const fetchTransactions = async ({ q, page, pageSize, signal }: FetchTransactionsParams): Promise<TransactionPage> => {
  const search = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (q) search.set("q", q)
  const rsp = await fetch(`${API_BASE}/transactions?${search}`, { signal })
  // Without this check a 400 or 500 body would be parsed as if it were a page of transactions
  if (!rsp.ok) throw new Error(`Could not load transactions (HTTP ${rsp.status})`)
  return rsp.json()
}

// Thrown on a 404 so callers can show "not found" instead of a generic failure.
export class TransactionNotFoundError extends Error {}

// Unlike the functions around it, this checks `rsp.ok`: a 404 body is `{ error }`, not a Transaction.
export const fetchTransactionById = async (id: string): Promise<Transaction> => {
  // encodeURIComponent keeps ids containing "/" or "%" inside a single path segment
  const rsp = await fetch(`${API_BASE}/transactions/${encodeURIComponent(id)}`)
  if (rsp.status === 404) throw new TransactionNotFoundError(`Transaction ${id} not found`)
  if (!rsp.ok) throw new Error(`Failed to load transaction (HTTP ${rsp.status})`)
  const body = await rsp.json()
  // GET /api/transactions/summary is registered before /:id, so the id "summary" gets 200 with the totals
  // object instead of a 404. Anything without a string `id` is not a transaction, so treat it as not found.
  if (typeof body?.id !== "string") throw new TransactionNotFoundError(`Transaction ${id} not found`)
  return body
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
