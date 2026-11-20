import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Alert, Button, Input, Pagination, Spin } from "antd"
import { SearchOutlined } from "@ant-design/icons"

import { SummaryBar } from "../components/SummaryBar"
import { TransactionList } from "../components/TransactionList"
import { TransactionModal } from "../components/TransactionModal"
import { useDebouncedValue } from "../hooks/useDebouncedValue"
import { useTransactionPage } from "../hooks/useTransactions"
import type { Transaction } from "../models/transaction"
import { buildListSearch, parseListParams } from "../utils/list-params"

const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

export const TransactionsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  // The URL is the source of truth for what is shown; the input below only holds what is being typed
  const { q, page } = parseListParams(searchParams)
  const [input, setInput] = useState(q)
  const [selected, setSelected] = useState<Transaction | null>(null)

  const { data, loading, error, retry } = useTransactionPage({ q, page, pageSize: PAGE_SIZE })
  const debouncedInput = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS)

  // The debounce effect below must run only when the typed text settles, not when the URL changes (the browser's
  // back button would otherwise be overwritten), so it reads the current URL state through a ref.
  const latest = useRef({ q, setSearchParams })
  useEffect(() => {
    latest.current = { q, setSearchParams }
  })

  // Search text settled: put it in the URL, back on page 1 (page 7 of the old search means nothing for a new one).
  // `replace` keeps each search term out of the history, so Back still goes through pages and visits.
  useEffect(() => {
    const { q: currentQ, setSearchParams: setParams } = latest.current
    if (debouncedInput === currentQ) return
    setParams(buildListSearch({ q: debouncedInput, page: 1 }), { replace: true })
  }, [debouncedInput])

  // The URL changed on its own (back button, pasted link): show its search text in the input
  useEffect(() => {
    setInput((current) => (current.trim() === q ? current : q))
  }, [q])

  // A link to a page past the end (page=999) loads an empty page; move to the last real page instead
  useEffect(() => {
    if (!data || loading || data.page !== page) return
    const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
    if (page > lastPage) setSearchParams(buildListSearch({ q, page: lastPage }), { replace: true })
  }, [data, loading, page, q, setSearchParams])

  return (
    <>
      <header className="app-header">
        <h1>Transactions</h1>
        <Input
          style={{ width: 320 }}
          prefix={<SearchOutlined />}
          allowClear
          aria-label="Search transactions"
          placeholder="Search merchant, id, card, status..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </header>

      {error && (
        <Alert
          className="list-alert"
          type="error"
          showIcon
          message="Could not load transactions"
          description={error.message}
          action={
            <Button size="small" onClick={retry}>
              Retry
            </Button>
          }
        />
      )}

      {data ? (
        // Keeps showing the previous results (dimmed by the spinner) while the next page loads
        <Spin spinning={loading}>
          <SummaryBar total={data.total} totalProcessed={data.totalProcessed} />

          <TransactionList transactions={data.transactions} onSelect={setSelected} />

          {data.total === 0 && !loading && <p className="empty-state">No transactions match your search.</p>}

          <div className="pagination-bar">
            <Pagination
              current={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              showSizeChanger={false}
              hideOnSinglePage
              onChange={(next) => setSearchParams(buildListSearch({ q, page: next }))}
            />
          </div>
        </Spin>
      ) : (
        loading && (
          <div className="app-loading">
            <Spin size="large" />
          </div>
        )
      )}

      <TransactionModal transaction={selected} onClose={() => setSelected(null)} />
    </>
  )
}
