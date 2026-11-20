import { describe, expect, it } from "vitest"

import { parseListQuery } from "./list-query.js"

describe("parseListQuery", () => {
  it("applies defaults when nothing is given", () => {
    expect(parseListQuery({})).toEqual({ ok: true, params: { q: "", page: 1, pageSize: 25 } })
  })

  it("parses valid values", () => {
    expect(parseListQuery({ q: "visa", page: "3", pageSize: "100" })).toEqual({
      ok: true,
      params: { q: "visa", page: 3, pageSize: 100 },
    })
  })

  it("treats an empty page or pageSize like a missing one", () => {
    expect(parseListQuery({ page: "", pageSize: "" })).toEqual({ ok: true, params: { q: "", page: 1, pageSize: 25 } })
  })

  it.each(["0", "-1", "abc", "1.5", "1e2", " 2", "2 "])("rejects page=%j", (page) => {
    const result = parseListQuery({ page })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/page/)
  })

  it.each(["0", "-5", "x", "2.5", "101"])("rejects pageSize=%j", (pageSize) => {
    const result = parseListQuery({ pageSize })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/pageSize/)
  })

  it("rejects repeated or nested parameters instead of picking one", () => {
    expect(parseListQuery({ q: ["a", "b"] }).ok).toBe(false)
    expect(parseListQuery({ page: ["1", "2"] }).ok).toBe(false)
    expect(parseListQuery({ pageSize: { a: "1" } }).ok).toBe(false)
  })

  it("rejects a page too large to be a safe integer", () => {
    expect(parseListQuery({ page: "99999999999999999999" }).ok).toBe(false)
  })
})
