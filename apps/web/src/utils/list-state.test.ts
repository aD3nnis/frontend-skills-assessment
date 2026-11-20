import { describe, expect, it } from "vitest"

import { listSearchFromState } from "./list-state"

describe("listSearchFromState", () => {
  it("returns the list's query string when the row link carried one", () => {
    expect(listSearchFromState({ listSearch: "?q=declined&page=2" })).toBe("?q=declined&page=2")
  })

  it("returns an empty string for a direct visit, where there is no router state", () => {
    expect(listSearchFromState(null)).toBe("")
    expect(listSearchFromState(undefined)).toBe("")
  })

  it("ignores state it didn't write (wrong shape or wrong type)", () => {
    expect(listSearchFromState("?q=x")).toBe("")
    expect(listSearchFromState({})).toBe("")
    expect(listSearchFromState({ listSearch: 5 })).toBe("")
    expect(listSearchFromState({ listSearch: null })).toBe("")
  })
})
