import type { NextFunction, Request, Response } from "express"

interface HttpError extends Error {
  status?: number
  type?: string
}

// express.json() rejects a malformed or oversized body before any route runs. Those errors carry
// a 4xx `status`; answering them with 500 and a stack trace blamed the server for a client mistake
// and leaked file paths, and it made the POST contract ("400 for bad input") untrue for bad JSON.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  if (typeof err.status === "number" && err.status >= 400 && err.status < 500) {
    // The parser's own message quotes the bad input, so use a fixed one for parse failures.
    const error = err.type === "entity.parse.failed" ? "Invalid JSON body" : err.message
    return res.status(err.status).json({ error })
  }
  console.error(err)
  res.status(500).json({ error: err.message, stack: err.stack })
}
