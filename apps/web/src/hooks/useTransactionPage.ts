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
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Which request last finished (success or failure). `loading` is derived from it rather than stored, so on the
  // very render where q or page changes it is already true: a stored flag only flips after an effect, and callers
  // reading `data` in that render would take the previous search's results for the new one's.
  const [settledKey, setSettledKey] = useState<string | null>(null)

  const key = `${q}\n${page}\n${pageSize}\n${attempt}`
  const loading = settledKey !== key

  useEffect(() => {
    // Changing q or page runs the cleanup below first, which aborts the previous request, so a slow old
    // response can never overwrite a newer one.
    const controller = new AbortController()
    setError(null)

    fetchTransactions({ q, page, pageSize, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        setData(result)
        setSettledKey(key)
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return
        setError(err)
        setSettledKey(key)
      })

    return () => controller.abort()
  }, [q, page, pageSize, attempt, key])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { data, loading, error, retry }
}
