import type { CardBrand, Transaction } from "../models/transaction"

const API_BASE = "/api"

export const fetchTransactions = async (): Promise<Transaction[]> => {
  const rsp = await fetch(`${API_BASE}/transactions`)
  const data = await rsp.json()
  return data.transactions
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

export const createTransaction = async (input: NewTransactionInput): Promise<Transaction> => {
  const rsp = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  return rsp.json()
}
