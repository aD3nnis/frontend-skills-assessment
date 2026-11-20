import { TransactionStatus } from "../models/transaction"
import type { Transaction } from "../models/transaction"

export const formatCurrency = (value: number): string => {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleDateString("en-US")
}

// Mirrors isProcessed / sumProcessedAmount in apps/api/src/services/transaction-service.ts, which
// explains the rule. The apps share no package, so change both together.
export const computeTotal = (transactions: Transaction[]): number => {
  let cents = 0
  for (const t of transactions) {
    if (t.status === TransactionStatus.APPROVED) {
      cents += Math.round(t.total * 100)
    }
  }
  return cents / 100
}
