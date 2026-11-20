import _ from "lodash"

import { TransactionStatus } from "../models/transaction.js"
import type { CardBrand, Transaction } from "../models/transaction.js"
import { loadTransactions } from "../data/transactions.js"

export interface TransactionSummary {
  count: number
  totalVolume: number
  totalSurcharge: number
}

export interface NewTransactionInput {
  merchantName: string
  cardBrand: CardBrand
  amount: number
}

// Allowlist on purpose: only APPROVED counts, so DECLINED, PENDING, REFUNDED, the data's unknown
// VOIDED and any future status stay out. This is the only copy of the rule: the web shows the total
// the API computes (totalProcessed in listTransactions).
export const isProcessed = (t: { status: string }): boolean => t.status === TransactionStatus.APPROVED

// Adds in integer cents because float addition drifts (0.1 + 0.2 = 0.30000000000000004).
export const sumProcessedAmount = (transactions: Transaction[]): number => {
  const cents = _.sumBy(transactions.filter(isProcessed), (t) => Math.round(t.total * 100))
  return cents / 100
}

export interface ListParams {
  q: string
  page: number
  pageSize: number
}

export interface TransactionPage {
  transactions: Transaction[]
  page: number
  pageSize: number
  total: number
  totalProcessed: number
}

const matchesSearch = (t: Transaction, term: string): boolean =>
  [t.merchantName, t.id, t.cardBrand, t.status].some((field) => field.toLowerCase().includes(term))

// Filters before sorting so a narrow search only sorts its matches. Newest first; many rows share a timestamp, so
// ties fall back to id: without a total order a row could appear on two pages or none while paging.
// `totalProcessed` covers every match, not just the page, so the summary stays right however the caller pages.
// Does not mutate `transactions` (filter and orderBy both return new arrays).
export const listTransactions = (transactions: Transaction[], { q, page, pageSize }: ListParams): TransactionPage => {
  const term = q.trim().toLowerCase()
  const matches = _.orderBy(
    transactions.filter((t) => matchesSearch(t, term)),
    ["createdAt", "id"],
    ["desc", "asc"],
  )
  const start = (page - 1) * pageSize
  return {
    transactions: matches.slice(start, start + pageSize),
    page,
    pageSize,
    total: matches.length,
    totalProcessed: sumProcessedAmount(matches),
  }
}

export const createTransactionService = () => {
  const transactions = loadTransactions()

  const getAll = (): Transaction[] => transactions

  const list = (params: ListParams): TransactionPage => listTransactions(transactions, params)

  const getById = (id: string): Transaction | undefined => transactions.find((t) => t.id === id)

  const getSummary = (): TransactionSummary => ({
    count: transactions.length,
    totalVolume: sumProcessedAmount(transactions),
    totalSurcharge: _.round(_.sumBy(transactions, "surcharge"), 2),
  })

  const create = (input: NewTransactionInput): Transaction => {
    const transaction: Transaction = {
      id: `txn_${String(transactions.length + 1).padStart(6, "0")}`,
      merchantName: input.merchantName,
      cardBrand: input.cardBrand,
      amount: input.amount,
      surchargeRate: 0,
      surcharge: 0,
      total: input.amount,
      status: TransactionStatus.APPROVED,
      createdAt: new Date().toISOString(),
    }
    transactions.unshift(transaction)
    return transaction
  }

  return { getAll, getById, getSummary, list, create }
}

export type TransactionService = ReturnType<typeof createTransactionService>
