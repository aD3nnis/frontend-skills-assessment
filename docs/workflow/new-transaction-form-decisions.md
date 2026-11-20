# Decisions: new transaction form
Date: 2026-11-19

Branch: feat/new-transaction-form
Type: Feature
Phase: Review

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

- 2026-11-19: `/simplify` (4 reviewers) applied two fixes: `MAX_MERCHANT_NAME_LENGTH` constant in `money.ts`, and `setSubmitting(false)` moved to `finally`. After it: API 18 and web 21 tests pass, lint 0 errors, web typecheck clean. Skipped on purpose: a shared package for the duplicated rules, validation middleware (one route), the double-submit guard, client-side `trim()`, the unused `ApiError.status`.
- Curl with the API stopped, through the Vite proxy: `POST /api/transactions` returned `500 Internal Server Error`, `Content-Type: text/plain`. `fetch` resolves, `!rsp.ok` is true, `.json()` fails, and the page shows "Could not create the transaction" (`transaction-service.ts:35-38`, `NewTransactionPage.tsx:44`).

### Break-it checks (walkthrough, 2026-11-19)
Each line was broken, the test file run, and the line restored with `git checkout`; `git status` afterwards showed no changes to tracked files.
| Criterion | Line broken | Test that failed |
|---|---|---|
| Whole cents only (API) | `validation.ts:39`, `> 1e-6` to `> Infinity` | `rejects an amount that is 3 decimal places` |
| Known card brand (API) | `validation.ts:26`, condition to `false` | `rejects blank merchant names and unknown card brands`, `rejects a non-object body with an error per field` |
| Merchant name required (API) | `validation.ts:19`, `if (!merchantName)` to `if (false)` | the same two tests |
| Amount above 0 (API) | `validation.ts:41`, `cents <= 0` to `cents < 0` | `rejects an amount that is zero` |
| Amount cap (API) | `validation.ts:43`, `amount > MAX_AMOUNT` to `false` | `rejects an amount that is above the cap` |
| Amounts must be numbers (API) | `validation.ts:35`, `typeof amount !== "number" \|\|` removed | none failed, no test added: `Number.isFinite("12")` is already false for a string, so the `typeof` is redundant at runtime and kept only to narrow `unknown` for TypeScript |
| `parseAmount` does not truncate (web) | `money.ts:22`, `Number(...)` to `parseInt(...)` | `parses decimals instead of truncating like parseInt did` |
| Two decimals max (web) | `money.ts:8`, `\d{1,2}` to `\d+` | `rejects "12.345"` |
| Above 0 (web) | `money.ts:15`, `<= 0` to `< 0` | `rejects "0"`, `rejects "0.00"` |

## Reviewed by hand
- The user asked Claude to answer the walkthrough questions, so nothing below is the user's own finding. Claude answered: why `0.1 + 0.2` is accepted and `1.005` rejected (`validation.ts:38-39`, tolerance check, not `Math.round` alone); what happens in the form when the API is down (`NewTransactionPage.tsx:24-49`, `transaction-service.ts:35-38`); why the `.catch` on `rsp.json()` stays (`transaction-service.ts:37`).
- The user's one partial answer (amount accepted "because it is two decimal places and Math.round takes care of it") was corrected: `Math.round` alone would have accepted `1.005`; the tolerance check rejects it.
- Read by Claude only: `apps/api/src/utils/validation.ts`, `apps/web/src/pages/NewTransactionPage.tsx`, `apps/web/src/services/transaction-service.ts`, `apps/web/src/utils/money.ts`, `apps/api/src/index.ts`, `apps/web/src/App.css`, and both test files.

## Second opinion (Claude, walkthrough)
- The form page has no automated tests (`ApiError` mapping, failure paths); it needs jsdom and testing-library, which are not installed.
- Not confirmed that the list shows the new row after `navigate("/")`; Task 1 may change how the list loads.
- `apps/api/src/index.ts:44-47` still returns the stack trace in a 500, including for malformed JSON.

## Reviewer subagent (2026-11-19)
Checked the diff against this file and Task 3. All criteria met except "whole flow (list shows the new row)", which is unproven.
- Fixed: `createTransaction` threw a `TypeError` for a JSON error body of `null` or `fields: null` (`transaction-service.ts:35-38`), leaving the user with no message. Now `body?.error` and `body?.fields ?? {}`; `transaction-service.test.ts` (new) shows the two null cases failing before the fix (2 failed, 3 passed) and passing after. API 18 and web 26 tests pass, lint 0 errors, web typecheck clean.
- Left as is: the `"12"` string test cannot fail (see break-it table); the 1,000,000 cap and 100-character name limit were not asked for in Task 3 (a real payment over $1M gets a 400, so the cap is a policy choice); Cancel button and success toast are small additions; `.5`, `5.` and `1,000` are rejected on purpose.
- New note: created transactions get `surcharge: 0`, so `totalSurcharge` in the summary ignores them (also under With more time).

## Code review (`/code-review medium main`, 2026-11-19)
10 findings, none blocking. Three fixed, the rest skipped:
- Fixed: unknown server field errors were swallowed (`NewTransactionPage.tsx`). `splitFieldErrors` (`utils/field-errors.ts`) separates errors for form inputs from the rest; the rest go in the alert. Test written first: failed with "Failed to load url ./field-errors", passes now (3 tests).
- Fixed: the `if (submitting)` double-submit guard read a stale closure. Now a `useRef` flag. Not covered by a test (the web workspace has no jsdom or testing-library); checked by reading only.
- Fixed: malformed JSON got a 500 with a stack trace. New `utils/error-handler.ts` answers parser errors with their 4xx status (400 `{"error":"Invalid JSON body"}`) and keeps the 500 path for everything else; `index.ts` uses it. Test written first (3 tests), and curl of `{bad` against the API returned `400 {"error":"Invalid JSON body"}`. Other 500s still return the stack trace (Task 5 / ship-no-ship).
- Skipped, low: POST 400 route wiring still untested (`index.ts` listens on import); client length rule counts untrimmed whitespace; error alert stays until the next submit; error body fields not shape-checked; created transactions get surcharge 0; `let cents` sentinel in `validation.ts`; field-error type duplicated between web and API.
- After the fixes: API 21 and web 29 tests pass, lint 0 errors, both typechecks clean.

## Map
- Deferred: the user agreed to defer on 2026-11-19. Tasks 1 (pagination, new list contract) and 4 (detail page) will change the documented components and data flow again, so `/map` should run once after they land. Facts this change moved, meanwhile: the POST data-flow row (response can be a 400 with field errors; `transaction-service.ts:18` has shifted), the API's responsibility (it now validates input), and `utils/money.ts` among the web helpers. The map was also already stale on "no tests exist".

## Not verified
- The form has not been driven in a browser by Claude; the user was given a by-hand checklist (submit empty; `12.999`, `-5`, `abc`, `1e3`, `0` rejected; `12.34` shows as 12.34 in the list, not 12; API stopped shows an error alert and the page stays).
- The list refresh after `navigate("/")` was not checked.
- `/code-review` has not run.

## With more time
- New transactions still get `surchargeRate: 0` and status `APPROVED`, so the summary's `totalSurcharge` ignores them; the seed data's rates (2.5, 3, 3.5%) are not tied to card brand, so no rule was invented.
- Malformed JSON bodies reach the global error handler, which returns a 500 with the stack trace (`apps/api/src/index.ts`); should be a 400 without the stack.
- IDs come from `transactions.length + 1`, which breaks under deletes or concurrent creates.
- Component tests for the form (needs jsdom and testing-library, neither is installed).
- Idempotency key on `POST` so a retry after a timeout cannot create a duplicate payment.
