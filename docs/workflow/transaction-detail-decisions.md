# Decisions: transaction detail
Date: 2026-11-19 · [Spec](transaction-detail-spec.md) · [Plan](transaction-detail-plan.md)

Branch: worktree-task4-detail-page
Type: Feature
Phase: Change

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

## Not verified
- The opening lag has not been measured by Claude, only reasoned from the code.
- The user reports (2026-11-19) that Task 1's branch fixes the loading problem; they tested it there. Claude has not read or run that branch, so this is the user's word, not checked here.
