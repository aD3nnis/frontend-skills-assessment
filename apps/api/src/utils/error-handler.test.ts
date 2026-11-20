import { describe, expect, it, vi } from "vitest"
import type { NextFunction, Request, Response } from "express"

import { errorHandler } from "./error-handler.js"

const run = (err: Error, headersSent = false) => {
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))
  const next = vi.fn()
  errorHandler(err, {} as Request, { status, headersSent } as unknown as Response, next as unknown as NextFunction)
  return { status, json, next }
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

  it("answers unexpected errors with a generic 500 and logs the real one, without leaking it", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const err = new Error("ENOENT: /srv/app/secret/path")
    const { status, json } = run(err)
    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({ error: "Internal server error" })
    expect(log).toHaveBeenCalledWith(err)
    log.mockRestore()
  })

  it("hands the error to Express when the response has already started", () => {
    const err = new Error("boom after headers")
    const { status, json, next } = run(err, true)
    expect(next).toHaveBeenCalledWith(err)
    expect(status).not.toHaveBeenCalled()
    expect(json).not.toHaveBeenCalled()
  })
})
