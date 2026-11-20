import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Alert, Button, Input, Pagination, Spin } from "antd"
import { SearchOutlined } from "@ant-design/icons"

import { SummaryBar } from "../components/SummaryBar"
import { TransactionList } from "../components/TransactionList"
import { TransactionModal } from "../components/TransactionModal"
import { useTransactionPage } from "../hooks/useTransactionPage"
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
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { data, loading, error, retry } = useTransactionPage({ q, page, pageSize: PAGE_SIZE })

  // Only typing starts this timer, so a URL change on its own (Back button, pasted link) never writes back to the URL.
  // The URL gets the search text once typing pauses, on page 1 (page 7 of the old search means nothing for a new one).
  // `replace` keeps each search term out of the history, so Back still goes through pages and visits.
  const handleSearchChange = (value: string) => {
    setInput(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      const term = value.trim()
      // Read the URL as it is now: `searchParams` from this render is up to 300 ms old, and writing it back would
      // undo a page click made while the timer was pending.
      // Typing only a space (or reverting to the same text) must not bounce the user back to page 1.
      const currentQ = parseListParams(new URLSearchParams(window.location.search)).q
      if (currentQ !== term) setSearchParams(buildListSearch({ q: term, page: 1 }), { replace: true })
    }, SEARCH_DEBOUNCE_MS)
  }

  // The search text in the URL changed on its own (Back to another search, a pasted link): show it in the input and
  // drop the pending write, which belonged to the old text. A change to the page alone does not run this: the typed
  // text stays in the input and its pending write still applies, so the box and the URL end up agreeing.
  // The trim comparison keeps a trailing space the user typed.
  useEffect(() => {
    clearTimeout(searchTimer.current)
    setInput((current) => (current.trim() === q ? current : q))
  }, [q])

  useEffect(() => () => clearTimeout(searchTimer.current), [])

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
          onChange={(e) => handleSearchChange(e.target.value)}
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

      {!data && loading && (
        <div className="app-loading">
          <Spin size="large" />
        </div>
      )}

      {data && (
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
      )}

      <TransactionModal transaction={selected} onClose={() => setSelected(null)} />
    </>
  )
}
