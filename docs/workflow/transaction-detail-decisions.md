# Decisions: transaction detail
Date: 2026-11-19 · [Spec](transaction-detail-spec.md) · [Plan](transaction-detail-plan.md)

Branch: worktree-task4-detail-page
Type: Feature
Phase: Ship

## Detours and switches
- 2026-11-19: type chosen as Feature (new page and navigation, not a fix or refactor), confirmed with the user. Phase moved Understand → Plan after the user's OK.

## Options considered
| Decision | Chosen | Turned down | Why |
|---|---|---|---|
| Fate of the existing modal | Replace it with navigation to `/transactions/:id`; delete `TransactionModal` and the `selected` state | Keep both; keep the modal only | One place to see details, shareable URL, back button works, matches the routed `/transactions/new` page; two views of the same data would need maintaining. The opening lag is the 10,000-row re-render, not the modal (reasoned from code, not measured) |
| Where the page gets its data | Fetch by id from `GET /api/transactions/:id` | Read from the list's state | A direct link or reload must work, and the endpoint already exists |
| Testing scope for one evening | Unit-test the service function; check page states by hand in the browser | Add testing-library + jsdom and component-test the page | No DOM test tooling in `apps/web/package.json`; adding it is not tonight's work. Gap recorded in `NOTES.md` |
| How the page tells not-found from failure (proposed in the plan; confirmed when the user approves it) | Service throws `TransactionNotFoundError` on 404, plain `Error` otherwise | return `null` for 404; compare HTTP status numbers in the page | Keeps status codes out of the UI and leaves room for more outcomes; costs one small class |
| List slowness | Leave to Task 1 (pagination); the only list-render change is `key={t.id}` on the row line already being rewritten into a `Link` (kept after the reviewer flagged it, user's call 2026-11-19) | Memoize rows; leave `key={i}` | Task 1 is editing the same files in another session and pagination removes the cause; the key change costs nothing extra because that line changes anyway |

- 2026-11-19: after the code review the user asked to take the `NOTES.md` changes out of this branch; they will write the notes in a separate PR. `NOTES.md` is restored to `main`'s version, so every "noted in `NOTES.md`" below means "to go in that separate notes PR". The draft text is in history: `git show 8bab2f0:NOTES.md`.

## What changed and why
- Service: `apps/web/src/services/transaction-service.ts` and its new test: `fetchTransactionById`, `TransactionNotFoundError`; checks `rsp.ok`, encodes the id.
- List: `TransactionList.tsx` rows are `Link`s (keyboard works, `key={t.id}`); `onSelect` removed. `TransactionsPage.tsx` lost the `selected` state and the modal; `TransactionModal.tsx` deleted.
- Page: new `hooks/useTransaction.ts` and `pages/TransactionDetailPage.tsx`; route added in `App.tsx`; CSS in `App.css`.

## Departures from the plan
- The row `key` changed from `key={i}` to `key={t.id}`; the spec had listed stable keys as out of scope. Kept on the user's decision after the reviewer flagged it (spec and NOTES.md corrected).
- Plan task 3 (hook and page; not the spec's Task 3, the form) also edited `apps/web/src/App.css` (outside its listed files) for the detail page's width and heading margin; no other file was needed.
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
| 12. Notes | Moved out of this branch by the user's decision (separate notes PR); `NOTES.md` unchanged here |

`/transactions/new` still shows the form (regression check for the route order).

### Break-it checks
Each line was broken alone, `npm test -w @assessment/web` run, then the file restored (`git diff` empty after each).

| Criterion | Line broken | Test that failed |
|---|---|---|
| 3. Not found | `transaction-service.ts:18` (404 check removed) | "throws TransactionNotFoundError on 404…" |
| 4. Failure is not not-found | `transaction-service.ts:19` (`rsp.ok` check removed) | "throws a plain Error, not TransactionNotFoundError, on a 500" |
| 9. Odd ids encoded | `transaction-service.ts:17` (`encodeURIComponent` removed) | "encodes the id so characters like / and spaces…" |
| 1. Returns the transaction | `transaction-service.ts:20` (returns `{}`) | "returns the transaction on 200" |
| 4. Network failure | `transaction-service.ts:17` (rejection turned into not-found) | "lets a network failure reject as a plain Error" |
| 8. No stale data | `useTransaction.ts:23,26` (`if (!stale)` removed) | **none failed: criterion 8 is unproven by tests**; checked by hand only (decided with the user: leave it, list the gap in `NOTES.md`; testing it needs DOM test tooling) |

Criteria 1-2, 5-7 and the route are browser-checked only; no automated test covers them.

## Reviewed by hand
Depth chosen: riskiest few.
- `apps/web/src/services/transaction-service.ts`: the user answered the 404/500/network-down question with the generic error message (right for 500 and network-down, not for 404, which gets "Transaction not found"); on why only the new function checks `rsp.ok` the user said "I don't know" and Claude explained it.
- `apps/web/src/hooks/useTransaction.ts`: Claude asked what goes wrong without the stale check; the user moved on to the break-it checks instead of answering. Claude's answer: the id tag stops wrong data, the stale flag stops losing the right data.
- Read by Claude only: `apps/web/src/pages/TransactionDetailPage.tsx`, `apps/web/src/components/TransactionList.tsx`, `apps/web/src/pages/TransactionsPage.tsx`, `apps/web/src/App.tsx`, `apps/web/src/App.css`, `apps/web/src/services/transaction-service.test.ts`, deleted `TransactionModal.tsx`.

## Second opinion (Claude)
1. Going back to the list loses the search and refetches everything (search is local state, `TransactionsPage.tsx:11`). Task 1's area; noted in `NOTES.md`.
2. Any 404 shows "not found" (`transaction-service.ts:18`). Minor; noted.
3. Errors were swallowed silently (`useTransaction.ts:25-26`). **Fixed** with a `console.error` for non-not-found failures.
4. Row link text is the whole row for screen readers (`TransactionList.tsx:27`). Noted for Task 5.
5. No page title on the detail page. Skipped.

## Reviewer subagent (against the spec, 2026-11-19)
No criterion unmet in behavior; it ran `npm test`, lint and the web build (all pass) but not a browser. Automated coverage: criteria 9, 10, 11. Half covered (service throws tested, page mapping not): 3 and 4. Browser-only: 1, 2, 5, 6, 7, 8.
- Row `key` changed against the spec's out-of-scope list: user kept it; spec, decisions and `NOTES.md` corrected.
- Page-level tests absent although some criteria say "test of the page": decided earlier (no DOM test tooling); the gap is now stated precisely in `NOTES.md`.
- A → B → back to A before B loads can briefly show A's old result or error (`useTransaction.ts:42`); traced in code, not run; noted in `NOTES.md`, not fixed.
- "Task 3" wording in the departures section clarified (plan task, not the form).

## Code review (`/code-review`, 2026-11-19)
9 findings. What was done about each:
1. **Fixed.** `/transactions/summary` crashed the page: the API's `/summary` route answers for the id "summary" with 200 and the totals, which the service returned as a transaction (`transaction-service.ts:20`), so `formatCurrency(undefined)` threw. The service now treats a 200 body without a string `id` as not found. Two tests written first and seen failing (body is the totals object; body is `null`), now passing.
2. Going back loses the search, scroll position and refetches everything: not fixed here, Task 1's area (search in the URL); for the notes PR.
3. 10,000 `Link` rows may be heavier than plain rows: skipped, unmeasured; Task 1's pagination cuts the row count.
4. No automated tests for the page states or the stale guard: skipped; no DOM test tooling (decided earlier).
5. Returning to an earlier id briefly shows its old result: skipped, minor, traced in code only.
6. Focus outline may be clipped by `overflow: hidden` on the list (`App.css:94`): skipped, not checked visually.
7. Any 404 reads as "not found": skipped, minor; the new body check does not change this.
8. Dead `!transaction` guard and key-only span: skipped, cosmetic.
9. Route path written in two places: skipped, two places only.

### Second `/code-review` run (after the fix, 2026-11-19)
10 findings: the 8 above again, plus 2 new ones about the new check, both skipped by the user's decision: (a) the body's `id` is not compared with the requested id (`transaction-service.ts:23`; hypothetical, one-token fix `body.id !== id`); (b) the real cause of the `/summary` collision is in the API (two routes share one namespace, `apps/api/src/index.ts:25` vs `:35`), so the web check is a safety net, not the root fix.

## Map
- Deferred: the repo has code and no `docs/workflow/map.md`. The user chose to defer `/map` (2026-11-19) as not needed for tonight's change. Until it runs, the map is missing, so "Where" in the spec came from reading the code directly.

## Not verified
- The opening lag has not been measured by Claude, only reasoned from the code.
- Row-link cost: each of the 10,000 list rows is now a react-router `Link` (per-row router hooks), which `/simplify`'s efficiency review flagged as possibly heavier than the old plain rows. Not measured. Left as is (2026-11-19, user's call) because Task 1's pagination cuts the row count; alternative if it still matters: plain `<a href>` rows with one delegated click handler.
- `/simplify` ran (4 reviewers) and changed no code; its optional suggestions were skipped (merge the two `Result` blocks, key the page by id to simplify the hook, abort the request, a `transactionPath` helper).
- The user reports (2026-11-19) that Task 1's branch fixes the loading problem; they tested it there. Claude has not read or run that branch, so this is the user's word, not checked here.
