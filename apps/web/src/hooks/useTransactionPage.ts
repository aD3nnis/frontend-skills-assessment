import { useCallback, useEffect, useState } from "react"

import type { TransactionPage } from "../models/transaction"
import { fetchTransactions } from "../services/transaction-service"
import { resultMatches } from "../utils/result-matches"
import type { LoadedResult } from "../utils/result-matches"

interface UseTransactionPageParams {
  q: string
  page: number
  pageSize: number
}

interface Loaded extends LoadedResult {
  result: TransactionPage
}

interface Settled {
  key: string
  error: Error | null
}

export const useTransactionPage = ({ q, page, pageSize }: UseTransactionPageParams) => {
  // The last successful result, kept while the next request is in flight so the list doesn't blank between pages.
  // It remembers the search it answered, because `TransactionPage` itself does not carry `q`.
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // Which request last finished, and how. `loading` and `error` are derived from it rather than stored on their
  // own: a stored flag only changes after an effect, so on the render where q or page changes it would still
  // describe the previous request (spinner off, old error showing, old results taken for the new search's).
  const [settled, setSettled] = useState<Settled | null>(null)
  const [attempt, setAttempt] = useState(0)

  const key = JSON.stringify([q, page, pageSize, attempt])
  const isSettled = settled?.key === key
  const loading = !isSettled
  const error = isSettled ? settled.error : null

  // False when `data` belongs to an earlier search or page, e.g. after the newest request failed
  const dataMatches = resultMatches(loaded, q, page, pageSize)

  useEffect(() => {
    // Changing q or page runs the cleanup below first, which aborts the previous request, so a slow old
    // response can never overwrite a newer one.
    const controller = new AbortController()

    fetchTransactions({ q, page, pageSize, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return
        setLoaded({ q, result })
        setSettled({ key, error: null })
      })
      .catch((err: Error) => {
        if (controller.signal.aborted) return
        setSettled({ key, error: err })
      })

    return () => controller.abort()
  }, [q, page, pageSize, key])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { data: loaded?.result ?? null, dataMatches, loading, error, retry }
}
