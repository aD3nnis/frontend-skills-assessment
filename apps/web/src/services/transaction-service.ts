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

export const createTransaction = async (input: NewTransactionInput): Promise<Transaction> => {
  const rsp = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!rsp.ok) {
    // The body may not be JSON (proxy error page), so don't let parsing mask the real failure.
    const body = await rsp.json().catch(() => ({}))
    throw new ApiError(rsp.status, body.error ?? "Could not create the transaction", body.fields)
  }
  return rsp.json()
}
