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

// Allowlist on purpose: DECLINED, PENDING, REFUNDED, the data's unknown VOIDED status and any
// future status stay out of "processed" until someone decides they belong.
// The web app mirrors this rule in apps/web/src/utils/format.ts (computeTotal); change both.
export const isProcessed = (t: { status: string }): boolean => t.status === TransactionStatus.APPROVED

// Adds in integer cents because float addition drifts (0.1 + 0.2 = 0.30000000000000004).
export const sumProcessedAmount = (transactions: Transaction[]): number => {
  const cents = _.sumBy(transactions.filter(isProcessed), (t) => Math.round(t.total * 100))
  return cents / 100
}

export const createTransactionService = () => {
  const transactions = loadTransactions()

  const getAll = (): Transaction[] => transactions

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

  return { getAll, getById, getSummary, create }
}

export type TransactionService = ReturnType<typeof createTransactionService>
