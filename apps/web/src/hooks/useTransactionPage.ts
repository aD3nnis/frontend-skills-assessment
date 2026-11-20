import { useCallback, useEffect, useState } from "react"

import type { TransactionPage } from "../models/transaction"
import { fetchTransactions } from "../services/transaction-service"

interface UseTransactionPageParams {
  q: string
  page: number
  pageSize: number
}

export const useTransactionPage = ({ q, page, pageSize }: UseTransactionPageParams) => {
  // `data` is deliberately kept while the next request is in flight, so the list doesn't blank between pages
  const [data, setData] = useState<TransactionPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // Changing q or page runs the cleanup below first, which aborts the previous request, so a slow old
    // response can never overwrite a newer one.
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetchTransactions({ q, page, pageSize, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        setData(result)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return
        setError(err)
        setLoading(false)
      })

    return () => controller.abort()
  }, [q, page, pageSize, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { data, loading, error, retry }
}
