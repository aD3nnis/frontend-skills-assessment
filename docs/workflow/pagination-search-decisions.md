# Decisions: pagination and search
Date: 2026-11-19 · [Spec](pagination-search-spec.md) · [Plan](pagination-search-plan.md)

Branch: worktree-pagination-search
Type: Feature
Phase: Change

## Detours and switches
- 2026-11-19: the worktree's branch was first cut from `origin/main` (the initial commit, without the two merged fixes), so I reset it to local `main` (400e561) before any work. `.claude/` and `docs/workflow/map*` are git-excluded locally, so they were copied in from the main checkout.

## Options considered
| Decision | Chosen | Turned down | Why |
|---|---|---|---|
| Where filtering, paging and totals happen | Server | Browser (current) | The server holds the full dataset, and the summary totals must cover all matches, not one page. Also keeps the "approved only" rule in one place |
| How to test the web behavior (debounce, stale responses, URL state, errors) | Pure helpers tested with the existing vitest; the rest checked by hand | Add jsdom and Testing Library (3 dev dependencies) | The user chose no new dependencies. The cost is that debounce, stale-response and error-state behavior have no automated test |
| Pagination style | Offset (`page`, `pageSize`) | Cursor | The list is in memory and users jump between pages. A new row can shift boundaries, which the spec accepts |
| Page size in the UI | Fixed 25 | Page-size selector | Simpler; the API still accepts up to 100 |
