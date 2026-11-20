export interface ListParams {
  q: string
  page: number
}

// Lenient on purpose, unlike the API: a URL is typed or pasted by a person, so a bad `page` falls back to page 1
// instead of showing an error.
const parsePage = (value: string | null): number => {
  if (value === null || !/^[0-9]+$/.test(value)) return 1
  const n = Number(value)
  return Number.isSafeInteger(n) && n >= 1 ? n : 1
}

export const parseListParams = (search: URLSearchParams): ListParams => ({
  q: search.get("q") ?? "",
  page: parsePage(search.get("page")),
})

// Leaves out the defaults so the plain list keeps a clean "/" URL. Returns "" or a string starting with "?".
export const buildListSearch = ({ q, page }: ListParams): string => {
  const search = new URLSearchParams()
  if (q) search.set("q", q)
  if (page > 1) search.set("page", String(page))
  const text = search.toString()
  return text ? `?${text}` : ""
}
