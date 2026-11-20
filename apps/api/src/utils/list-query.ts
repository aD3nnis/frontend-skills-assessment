import type { ListParams } from "../services/transaction-service.js"

export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export type ParsedListQuery = { ok: true; params: ListParams } | { ok: false; error: string }

// Strict on purpose: a bad `page` is a 400, not a silent fix, so a client bug shows up instead of showing page 1.
// Only plain digits are accepted ("1e2", "1.5", " 2" are not), and a repeated parameter (?page=1&page=2, which
// Express hands over as an array) is rejected rather than picking one.
const parsePositiveInt = (value: unknown, name: string, fallback: number): number | string => {
  if (value === undefined || value === "") return fallback
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) return `${name} must be a positive integer`
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 1) return `${name} must be a positive integer`
  return n
}

export const parseListQuery = (query: Record<string, unknown>): ParsedListQuery => {
  const { q } = query
  if (q !== undefined && typeof q !== "string") return { ok: false, error: "q must be a single string" }

  const page = parsePositiveInt(query.page, "page", 1)
  if (typeof page === "string") return { ok: false, error: page }

  const pageSize = parsePositiveInt(query.pageSize, "pageSize", DEFAULT_PAGE_SIZE)
  if (typeof pageSize === "string") return { ok: false, error: pageSize }
  if (pageSize > MAX_PAGE_SIZE) return { ok: false, error: `pageSize must be at most ${MAX_PAGE_SIZE}` }

  return { ok: true, params: { q: q ?? "", page, pageSize } }
}
