# Notes

## What I changed and why

## Task 2 bug

**The bug.** `computeTotal` (`apps/web/src/utils/format.ts`) summed every transaction whatever its status, so "Total processed" showed $25,438,084.33 instead of $6,488,615.40. The API's `getSummary().totalVolume` had the same flaw.

**The fix.**
- Only `APPROVED` counts. It is an allowlist, so DECLINED, PENDING, REFUNDED, the one `VOIDED` row and any future status are left out by default.
- Amounts are added in integer cents, so float drift (25438084.33000013) can't creep in.
- The API owns the rule (`isProcessed`, `sumProcessedAmount` in `apps/api/src/services/transaction-service.ts`). The web mirrors it in `computeTotal` with a "change both" comment, because the two apps share no package.
- Each workspace has a vitest test that failed first, then passed (API 7 tests, web 4).

**Assumptions** (and the alternative):
- "Processed" means approved only, so refunded doesn't count. Counting REFUNDED is arguable.
- I sum `total` (amount + surcharge): what the card was charged and what a processor statement shows. `amount` alone would give $6,299,522.49.
- The total keeps following the search filter, matching the Transactions count beside it.

**Noticed, not fixed.**
- `VOIDED` is missing from the `TransactionStatus` enum on both sides.
- `totalSurcharge` and `count` in `getSummary` still cover all statuses.
- Two existing jsx-a11y lint warnings at `apps/web/src/components/TransactionList.tsx:26`.
- Two copies of the rule until Task 1; a server-side summary the web reads would remove the web copy.

**How I checked.** Tests, lint and both builds exit 0. In the browser the bar showed $6,488,615.40 with no filter and $0.00 for `declined`. I did not use plain `npm run dev` on ports 3000/4000 because another dev server held them.

## Task 5 improvements

## Q1 Data flow

## Q2 Task 1 call

## Q3 Ship/no-ship

## What I'd do with more time
