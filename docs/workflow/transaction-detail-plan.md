# Plan: transaction detail
Date: 2026-11-19 · Spec: [transaction-detail-spec.md](transaction-detail-spec.md) · Starting state: existing project

## Goal
Clicking (or pressing Enter on) a transaction row opens `/transactions/:id`, a page that loads that one transaction and shows its details, with loading, not-found and error states; the modal is gone.

## Approach
Follow the existing web layers: a `fetch` function in the web service, a data hook in `hooks/`, a page in `pages/`, a route in `App.tsx`. The page reuses the modal's antd `Descriptions` layout, so the information shown is unchanged. The service tells "not found" from other failures by throwing a typed error, which lets the page choose between two states without reading status codes. Rows become react-router `Link`s so click, middle-click and keyboard all work.

## What it reuses
| Need | Already in the repo | Example |
|---|---|---|
| Page component location and style | antd page under `pages/` | `apps/web/src/pages/NewTransactionPage.tsx:8` |
| Fetch from the API | `fetch(`${API_BASE}/...`)` in the web service | `apps/web/src/services/transaction-service.ts:5-9` |
| Data-loading hook | `useEffect` + `loading` state | `apps/web/src/hooks/useTransactions.ts:6-18` |
| Loading indicator | antd `Spin` inside `.app-loading` | `apps/web/src/pages/TransactionsPage.tsx:28-34` |
| Field layout | antd `Descriptions` with the same items | `apps/web/src/components/TransactionModal.tsx:25-46` |
| Money and date formatting, status colour | `formatCurrency`, `formatDate`, `statusTagColor` | `apps/web/src/utils/format.ts`, `apps/web/src/utils/status.ts:3` |
| Router links | `Link`, `Routes`, `Route` from react-router-dom v6 | `apps/web/src/App.tsx:13,21-24` |
| Unit test style | vitest `describe/it/expect`, test next to the code | `apps/web/src/utils/format.test.ts` |

Departures from the repo's patterns:
- The hook cancels a stale response and has an error state with a retry; `useTransactions` has neither (it never handles failure). Needed for criteria 4 and 8.
- The service checks `rsp.ok`; the existing functions don't. Only the new function does, because Tasks 1 and 3 own the others.
- Not-found and error states use antd `Result`, which the repo hasn't used yet. It comes with antd, so there is no new dependency.

## Options
How the page tells "not found" from "request failed":
1. **Typed error (recommended).** The service throws `TransactionNotFoundError` on a 404 and a plain `Error` for anything else. The hook stores the error and the page checks `instanceof`. Costs a small class; keeps status codes out of the UI.
2. Return `null` for 404 and throw for the rest. Simpler, but `null` is easy to forget to check and a third kind of outcome can't be added.
3. Put the HTTP status on a generic error and compare numbers in the page. Spreads status-code knowledge into the UI.

Going with option 1 unless you say otherwise.

## Contracts
No server change: `GET /api/transactions/:id` returns the `Transaction` JSON, or `404 {"error":"Transaction not found"}` (`apps/api/src/index.ts:35-41`).

Web-side, fixed before building:
```ts
// apps/web/src/services/transaction-service.ts
export class TransactionNotFoundError extends Error {}
export const fetchTransactionById = (id: string): Promise<Transaction>
// GET `${API_BASE}/transactions/${encodeURIComponent(id)}`
// 200 -> the transaction · 404 -> throws TransactionNotFoundError · any other non-ok or network failure -> throws Error

// apps/web/src/hooks/useTransaction.ts
export const useTransaction = (id: string) => ({ transaction, loading, error, reload })
// transaction: Transaction | null · error: Error | null · reload(): void (retry)

// route: <Route path="/transactions/:id" element={<TransactionDetailPage />} />   (after "/transactions/new")
// row link: `/transactions/${t.id}`
```

## Tasks
| # | Component | Task | Files it may touch | Done when | Proved by | Depends on |
|---|---|---|---|---|---|---|
| 1 | Web service | Write the test first and watch it fail, then add `TransactionNotFoundError` and `fetchTransactionById` | `apps/web/src/services/transaction-service.ts`, `apps/web/src/services/transaction-service.test.ts` (new) | ok, 404, other status, network failure and odd-character ids behave as in Contracts | `npm test -w @assessment/web` (test failing first, then passing) | none |
| 2 | List and modal | Make each row a `Link` to `/transactions/<id>` (keyboard works, `key={t.id}`), drop the `onSelect` prop, delete `TransactionModal` and the `selected` state, add link CSS | `apps/web/src/components/TransactionList.tsx`, `apps/web/src/pages/TransactionsPage.tsx`, `apps/web/src/components/TransactionModal.tsx` (delete), `apps/web/src/App.css` | rows are links; no modal code remains; the grid look is unchanged | `npm run lint` (the 2 warnings gone), `npm run build`, browser check | none |
| 3 | Web page | `useTransaction` hook and `TransactionDetailPage` with loading, not-found, error + retry, back link, `Descriptions` | `apps/web/src/hooks/useTransaction.ts` (new), `apps/web/src/pages/TransactionDetailPage.tsx` (new) | page renders all states from the hook's output | `npm run build` (types), browser check | 1 |
| 4 | Routing | Register `/transactions/:id` after `/transactions/new` | `apps/web/src/App.tsx` | the URL renders the page; `/transactions/new` still shows the form | browser check | 3 |
| 5 | Verify and notes | Run all checks; walk the browser checklist; write the Task 4 section of `NOTES.md` and fill "How it was verified" in the decisions file | `NOTES.md`, `docs/workflow/transaction-detail-decisions.md` | criteria 1-12 each have a result recorded | `npm test`, `npm run lint`, `npm run build`, `npm run build -w @assessment/api` | 1-4 |

## Order
- Group A (in parallel): 1 and 2 (no shared files; task 2 only links to a URL and doesn't need the page to exist)
- Then: 3, then 4, then 5

In practice it's one evening and one person, so running 1, 2, 3, 4 in order is just as fine; Group A is only an option.

## Tests
| Acceptance criterion | Test or check |
|---|---|
| 1. Page shows all fields for an existing id | Browser: `/transactions/txn_000001` against `curl localhost:4000/api/transactions/txn_000001` |
| 2. Loading indicator while pending | Browser with network throttling |
| 3. Unknown id shows not-found with a way back | Service test (404 throws `TransactionNotFoundError`) + browser at `/transactions/nope` |
| 4. Failed request shows error state with retry | Service test (500 and network failure throw) + browser with the API stopped, then retry |
| 5. `VOIDED` row renders | Browser at `/transactions/txn_000681` |
| 6. Row click and Enter navigate; lint warnings gone | Browser (Tab to a row, Enter); `npm run lint` |
| 7. Direct URL, reload and back work | Browser |
| 8. Changing ids doesn't show stale data | Browser: go from one id to another while the first request is slow |
| 9. Odd ids are encoded and end in not-found | Service test asserting the requested URL; browser at `/transactions/a%2Fb` |
| 10. `rsp.ok` checked in the new call; other functions untouched | Service test; `git diff` shows only the added function |
| 11. `npm test`, lint and build pass | the three commands |
| 12. `NOTES.md` has a Task 4 section | read the file |

## Running this plan
The session that builds this plan is the controller. It owns git and the plan; nothing else commits.
- **A parallel group:** start one subagent per task, all in one message. Give each its task row, the Contracts section, the conventions for its component (no `map.md` exists, so use the "What it reuses" table), and these rules: edit only the files in your border; if you need a file outside it, stop and report; don't commit.
- **After each group:** run `git status --short` and check every changed file sits inside a task's border. Read each diff against its "Done when". Run the tests. Then commit one task at a time.
- **Tasks in order:** the controller does them itself.
- **Worktrees are not used for subagents:** a subagent's worktree starts from the default branch, so it would not see this branch's earlier tasks. Tasks with separate file borders are safe in one checkout. (This session itself is already in its own worktree.)
- **When the build departs from this plan:** say so to the user and add it to `transaction-detail-decisions.md` with the reason. Don't quietly edit the plan to match.
