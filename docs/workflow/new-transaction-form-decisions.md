# Decisions: new transaction form
Date: 2026-11-19

Branch: feat/new-transaction-form
Type: Feature
Phase: Verify

## Detours and switches
- 2026-11-19: Claude made the code changes without suggesting a workflow first: no type, branch, spec or plan. The user stopped this and asked to go through the workflow so they could understand the code better. They chose a short retroactive route: branch and this file first, then commit, then their own review with `/walkthrough`. No `/spec` or `/plan`; "done" is Task 3 in `INSTRUCTIONS.md` (validation, feedback, consistency with the app, correct money handling, and a better `POST /api/transactions`).

## What changed and why
- API validation: `apps/api/src/utils/validation.ts` (new): `validateNewTransaction` checks the untrusted body at runtime: non-empty trimmed merchant name (max 100), known card brand, amount is a number > 0, whole cents, at most 1,000,000. Returns per-field errors.
- API route: `apps/api/src/index.ts`: `POST /api/transactions` returns `400 {error, fields}` on invalid input and creates from the validated, trimmed value. Before, `req.body` was passed straight through.
- Web money parsing: `apps/web/src/utils/money.ts` (new): `validateAmount` / `parseAmount`. The old form used `parseInt`, so `12.99` was sent as `12` and `abc` as `NaN`.
- Web service: `apps/web/src/services/transaction-service.ts`: `createTransaction` throws `ApiError` (status, per-field messages) on non-2xx. Before, it returned the error body as if it were a transaction and the page navigated away.
- Web form: `apps/web/src/pages/NewTransactionPage.tsx`, `apps/web/src/App.css`: antd `Form` (already used in the app) with labels, inline errors, `$` prefix, loading state that blocks double submit, Cancel, success toast, server field errors mapped onto inputs, alert for other failures.
- Tests: `apps/api/src/utils/validation.test.ts`, `apps/web/src/utils/money.test.ts`.

## Options considered
| Decision | Chosen | Turned down | Why |
|---|---|---|---|
| Amount unit on the wire | dollars as a number (e.g. 12.5) | integer cents | Matches the stored data and every existing read path (`amount: 1616.73`); the API rejects anything that is not whole cents instead of rounding |
| Amount input | text `Input` + regex check | antd `InputNumber`, `parseFloat` | The regex rejects `1e3`, `-5` and `12.345` before they become numbers; `parseFloat`/`parseInt` accept them silently |
| Validation library | hand-written function | zod or similar | Three fields; the repo has no validation dependency and none was added |
| Where rules live | both web and API, kept in step by hand | API only | The web gives instant feedback, the API is the source of truth (it also guards other clients). The apps share no package, so the max amount is duplicated with a comment pointing at the other copy |
| Autofocus on first field | none | `autoFocus` | The repo's `jsx-a11y/no-autofocus` lint rule rejects it |

## Departures from the plan
- No plan existed (see Detours and switches).

## Tried and abandoned
- `autoFocus` on the merchant input: removed after lint failed.

## How it was verified
Run from the repo root on 2026-11-19, before commit:
- `npm test`: API 2 files / 18 tests, web 2 files / 21 tests, all pass.
- `npm run lint`: 0 errors, the 2 existing warnings at `apps/web/src/components/TransactionList.tsx:26`.
- `npx tsc --noEmit -p apps/web` and `-p apps/api`: no output (clean).
- API on a spare port (4999), `POST /api/transactions`:
  - body `{"merchantName":"","cardBrand":"X","amount":"5"}` returned 400 with errors for all three fields.
  - body `{"merchantName":"Acme","cardBrand":"VISA","amount":12.5}` returned 201 with `amount` 12.5 and `total` 12.5.

## Not verified
- The form has not been driven in a browser by Claude. By-hand checks for the user: submit empty (inline errors); `12.999`, `-5`, `abc`, `1e3`, `0` are rejected; `12.34` shows as 12.34 in the list, not 12; with the API stopped, an error alert shows and the page stays.
- No break-it checks (each test shown failing against broken code) have been done yet.
- The created transaction's list refresh after `navigate("/")` was not checked.
- `/walkthrough`, the `reviewer` subagent and `/code-review` have not run.

## With more time
- New transactions still get `surchargeRate: 0` and status `APPROVED`; the seed data's rates (2.5, 3, 3.5%) are not tied to card brand, so no rule was invented.
- Malformed JSON bodies reach the global error handler, which returns a 500 with the stack trace (`apps/api/src/index.ts`); should be a 400 without the stack.
- IDs come from `transactions.length + 1`, which breaks under deletes or concurrent creates.
- Component tests for the form (needs jsdom and testing-library, neither is installed).
- Idempotency key on `POST` so a retry after a timeout cannot create a duplicate payment.
