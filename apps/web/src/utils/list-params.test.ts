import { describe, expect, it } from "vitest"

import { buildListSearch, parseListParams } from "./list-params"

describe("parseListParams", () => {
  it("defaults to an empty search on page 1", () => {
    expect(parseListParams(new URLSearchParams(""))).toEqual({ q: "", page: 1 })
  })

  it("reads q and page", () => {
    expect(parseListParams(new URLSearchParams("q=visa&page=3"))).toEqual({ q: "visa", page: 3 })
  })

  it.each(["0", "-2", "abc", "1.5", "", "99999999999999999999"])("falls back to page 1 for page=%j", (page) => {
    expect(parseListParams(new URLSearchParams({ page })).page).toBe(1)
  })
})

describe("buildListSearch", () => {
  it("leaves out the defaults so the plain list has a clean URL", () => {
    expect(buildListSearch({ q: "", page: 1 })).toBe("")
  })

  it("includes q and page when set, and encodes the search text", () => {
    expect(buildListSearch({ q: "blue ridge&co", page: 2 })).toBe("?q=blue+ridge%26co&page=2")
  })

  it("includes only page when the search is empty", () => {
    expect(buildListSearch({ q: "", page: 4 })).toBe("?page=4")
  })

  it("round-trips through parseListParams", () => {
    const state = { q: "a b/c?d", page: 7 }
    expect(parseListParams(new URLSearchParams(buildListSearch(state)))).toEqual(state)
  })
})
