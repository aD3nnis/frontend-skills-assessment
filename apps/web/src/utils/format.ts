import { TransactionStatus } from "../models/transaction"
import type { Transaction } from "../models/transaction"

export const formatCurrency = (value: number): string => {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleDateString("en-US")
}

// Mirrors isProcessed / sumProcessedAmount in apps/api/src/services/transaction-service.ts (the apps share
// no package, so change both together). Only APPROVED counts, as an allowlist, so VOIDED and any
// unknown status stay out. Sums `total` in integer cents because float += drifts (0.1 + 0.2).
export const computeTotal = (transactions: Transaction[]): number => {
  let cents = 0
  for (const t of transactions) {
    if (t.status === TransactionStatus.APPROVED) {
      cents += Math.round(t.total * 100)
    }
  }
  return cents / 100
}
