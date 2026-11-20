// The list's rows pass the list's query string (search text and page) to the detail page in router state,
// so the detail page's back button can return to the same results. A visit with no state (a pasted link,
// a new tab) has no list to return to and gets "".
export const listSearchFromState = (state: unknown): string => {
  if (typeof state !== "object" || state === null) return ""
  const { listSearch } = state as { listSearch?: unknown }
  return typeof listSearch === "string" ? listSearch : ""
}
