import { describe, expect, it } from "vitest"

import { resultMatches } from "./result-matches"

const loaded = { q: "visa", result: { page: 2, pageSize: 25 } }

describe("resultMatches", () => {
  it("is true when the search, page and page size all match", () => {
    expect(resultMatches(loaded, "visa", 2, 25)).toBe(true)
  })

  it("is true for an empty search that matches an empty search", () => {
    expect(resultMatches({ q: "", result: { page: 1, pageSize: 25 } }, "", 1, 25)).toBe(true)
  })

  it("is false before anything has loaded", () => {
    expect(resultMatches(null, "", 1, 25)).toBe(false)
  })

  it("is false for another search on the same page (the case after a failed request for the new search)", () => {
    expect(resultMatches(loaded, "amex", 2, 25)).toBe(false)
  })

  it("is false for the same search on another page", () => {
    expect(resultMatches(loaded, "visa", 3, 25)).toBe(false)
  })

  it("is false for another page size", () => {
    expect(resultMatches(loaded, "visa", 2, 50)).toBe(false)
  })

  it("compares the search exactly, with no trimming or case folding", () => {
    expect(resultMatches(loaded, "Visa", 2, 25)).toBe(false)
    expect(resultMatches(loaded, "visa ", 2, 25)).toBe(false)
  })
})
