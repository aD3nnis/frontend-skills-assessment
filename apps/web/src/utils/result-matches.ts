// What the list hook keeps from its last successful request: the search it answered and the response.
// `TransactionPage` echoes `page` and `pageSize` but not `q`, so the search is stored beside it.
export interface LoadedResult {
  q: string
  result: { page: number; pageSize: number }
}

// True only when the kept result answers exactly this search, page and page size. It is false after the newest
// request failed (the kept result is an earlier one), and before anything has loaded.
export const resultMatches = (loaded: LoadedResult | null, q: string, page: number, pageSize: number): boolean =>
  loaded !== null && loaded.q === q && loaded.result.page === page && loaded.result.pageSize === pageSize
