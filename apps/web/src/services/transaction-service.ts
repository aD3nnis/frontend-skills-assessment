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
