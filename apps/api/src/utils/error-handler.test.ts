import { describe, expect, it, vi } from "vitest"
import type { NextFunction, Request, Response } from "express"

import { errorHandler } from "./error-handler.js"

const run = (err: Error) => {
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))
  errorHandler(err, {} as Request, { status } as unknown as Response, vi.fn() as unknown as NextFunction)
  return { status, json }
}

describe("errorHandler", () => {
  it("answers a malformed JSON body with 400 and no stack trace", () => {
    // body-parser's error shape for `{bad`
    const err = Object.assign(new SyntaxError("Unexpected token b in JSON at position 1"), {
      status: 400,
      type: "entity.parse.failed",
    })
    const { status, json } = run(err)
    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ error: "Invalid JSON body" })
  })

  it("keeps other 4xx statuses from the body parser, e.g. 413", () => {
    const err = Object.assign(new Error("request entity too large"), { status: 413, type: "entity.too.large" })
    const { status, json } = run(err)
    expect(status).toHaveBeenCalledWith(413)
    expect(json).toHaveBeenCalledWith({ error: "request entity too large" })
  })

  it("still answers unexpected errors with 500", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const { status, json } = run(new Error("boom"))
    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: "boom" }))
  })
})
