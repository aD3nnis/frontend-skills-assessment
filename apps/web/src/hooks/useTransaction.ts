import { useCallback, useEffect, useState } from "react"

import type { Transaction } from "../models/transaction"
import { TransactionNotFoundError, fetchTransactionById } from "../services/transaction-service"

interface Result {
  id: string
  transaction: Transaction | null
  error: Error | null
}

export const useTransaction = (id: string) => {
  // The result remembers which id it belongs to, so after navigating from one transaction to another
  // the old data is never shown under the new id while the new request is in flight.
  const [result, setResult] = useState<Result | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // `stale` stops a slow earlier request from overwriting the result of a later one
    let stale = false
    fetchTransactionById(id).then(
      (transaction) => {
        if (!stale) setResult({ id, transaction, error: null })
      },
      (e: unknown) => {
        if (stale) return
        // The page shows a generic message, so log the cause for whoever debugs it (not-found is an expected outcome)
        if (!(e instanceof TransactionNotFoundError)) console.error(`Failed to load transaction ${id}`, e)
        setResult({ id, transaction: null, error: e instanceof Error ? e : new Error(String(e)) })
      }
    )
    return () => {
      stale = true
    }
  }, [id, attempt])

  const reload = useCallback(() => {
    setResult(null)
    setAttempt((n) => n + 1)
  }, [])

  const loading = result === null || result.id !== id
  return {
    transaction: loading ? null : result.transaction,
    error: loading ? null : result.error,
    loading,
    reload,
  }
}
