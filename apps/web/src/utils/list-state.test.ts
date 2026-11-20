import { describe, expect, it } from "vitest"

import { LIST_LINK_STATE, cameFromList } from "./list-state"

describe("cameFromList", () => {
  it("is true for the state the list's row links carry", () => {
    expect(cameFromList(LIST_LINK_STATE)).toBe(true)
  })

  it("is false for a direct visit or a new tab, where there is no router state", () => {
    expect(cameFromList(null)).toBe(false)
    expect(cameFromList(undefined)).toBe(false)
  })

  it("ignores state it didn't write (wrong shape or wrong type)", () => {
    expect(cameFromList("fromList")).toBe(false)
    expect(cameFromList({})).toBe(false)
    expect(cameFromList({ fromList: false })).toBe(false)
    expect(cameFromList({ fromList: "yes" })).toBe(false)
    expect(cameFromList({ listSearch: "?q=x" })).toBe(false)
  })
})
