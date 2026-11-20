# Decisions: transaction detail
Date: 2026-11-19 · [Spec](transaction-detail-spec.md) · [Plan](transaction-detail-plan.md)

Branch: worktree-task4-detail-page
Type: Feature
Phase: Review

## Detours and switches
- 2026-11-19: type chosen as Feature (new page and navigation, not a fix or refactor), confirmed with the user. Phase moved Understand → Plan after the user's OK.

## Options considered
| Decision | Chosen | Turned down | Why |
|---|---|---|---|
| Fate of the existing modal | Replace it with navigation to `/transactions/:id`; delete `TransactionModal` and the `selected` state | Keep both; keep the modal only | One place to see details, shareable URL, back button works, matches the routed `/transactions/new` page; two views of the same data would need maintaining. The opening lag is the 10,000-row re-render, not the modal (reasoned from code, not measured) |
| Where the page gets its data | Fetch by id from `GET /api/transactions/:id` | Read from the list's state | A direct link or reload must work, and the endpoint already exists |
| Testing scope for one evening | Unit-test the service function; check page states by hand in the browser | Add testing-library + jsdom and component-test the page | No DOM test tooling in `apps/web/package.json`; adding it is not tonight's work. Gap recorded in `NOTES.md` |
| How the page tells not-found from failure (proposed in the plan; confirmed when the user approves it) | Service throws `TransactionNotFoundError` on 404, plain `Error` otherwise | return `null` for 404; compare HTTP status numbers in the page | Keeps status codes out of the UI and leaves room for more outcomes; costs one small class |
| List slowness | Leave to Task 1 (pagination) | Memoize rows / fix `key={i}` here | Task 1 is editing the same files in another session; pagination removes the cause |

## What changed and why
- Service: `apps/web/src/services/transaction-service.ts` and its new test: `fetchTransactionById`, `TransactionNotFoundError`; checks `rsp.ok`, encodes the id.
- List: `TransactionList.tsx` rows are `Link`s (keyboard works, `key={t.id}`); `onSelect` removed. `TransactionsPage.tsx` lost the `selected` state and the modal; `TransactionModal.tsx` deleted.
- Page: new `hooks/useTransaction.ts` and `pages/TransactionDetailPage.tsx`; route added in `App.tsx`; CSS in `App.css`.

## Departures from the plan
- Task 3 also edited `apps/web/src/App.css` (outside its listed files) for the detail page's width and heading margin; no other file was needed.
- Tasks 1 and 2 ran in order, not in parallel, as the plan allowed.
- `npm install` changed `package-lock.json`; I reverted it so it isn't in any commit.

## How it was verified
Run in this worktree on 2026-11-19 with the API on port 4100 and the web on 3100 (ports 3000/4000 were in use by another session).

| Criterion | Result |
|---|---|
| 1. All fields shown | `/transactions/txn_000083` shows merchant, card, $1,616.73, $48.50 (3.0%), $1,665.23, PENDING, 6/28/2026, matching the old modal |
| 2. Loading state | spinner shown while a delayed request was pending |
| 3. Not found | `/transactions/nope` shows "Transaction not found" and a back link |
| 4. Error and retry | API stopped: "Couldn't load this transaction"; API restarted, Try again showed the transaction |
| 5. Unknown status | `/transactions/txn_000681` renders status `VOIDED` |
| 6. Row navigation | 10,000 rows are `<a>`; focus + Enter opened the page; lint shows 0 warnings |
| 7. Direct URL, back | direct URLs loaded; browser back returned to the list with 10,000 rows |
| 8. No stale data | first request delayed 3s, switched ids; final page showed the second id, no old data in between |
| 9. Odd ids | `/transactions/a%2Fb` shows not-found for `a/b`; service test asserts the encoded URL |
| 10. `rsp.ok` checked | service tests (404 and 500 behave differently); older functions unchanged |
| 11. Checks | `npm test` (API 7, web 9 pass), `npm run lint` (0 problems), web and API builds pass |
| 12. Notes | `NOTES.md` has a Task 4 section |

`/transactions/new` still shows the form (regression check for the route order).

## Not verified
- The opening lag has not been measured by Claude, only reasoned from the code.
- Row-link cost: each of the 10,000 list rows is now a react-router `Link` (per-row router hooks), which `/simplify`'s efficiency review flagged as possibly heavier than the old plain rows. Not measured. Left as is (2026-11-19, user's call) because Task 1's pagination cuts the row count; alternative if it still matters: plain `<a href>` rows with one delegated click handler.
- `/simplify` ran (4 reviewers) and changed no code; its optional suggestions were skipped (merge the two `Result` blocks, key the page by id to simplify the hook, abort the request, a `transactionPath` helper).
- The user reports (2026-11-19) that Task 1's branch fixes the loading problem; they tested it there. Claude has not read or run that branch, so this is the user's word, not checked here.
