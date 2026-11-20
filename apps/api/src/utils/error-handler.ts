import type { NextFunction, Request, Response } from "express"

interface HttpError extends Error {
  status?: number
  type?: string
}

// express.json() rejects a malformed or oversized body before any route runs. Those errors carry
// a 4xx `status`; answering them with 500 and a stack trace blamed the server for a client mistake
// and leaked file paths, and it made the POST contract ("400 for bad input") untrue for bad JSON.
export const errorHandler = (err: HttpError, _req: Request, res: Response, next: NextFunction) => {
  // Once the response has started we can't send a new status; Express's default handler closes
  // the connection, which is what it expects an error handler to ask for here.
  if (res.headersSent) return next(err)
  if (typeof err.status === "number" && err.status >= 400 && err.status < 500) {
    // The parser's own message quotes the bad input, so use a fixed one for parse failures.
    const error = err.type === "entity.parse.failed" ? "Invalid JSON body" : err.message
    return res.status(err.status).json({ error })
  }
  // The real error goes to the server log only: its message and stack carry file paths and internals.
  console.error(err)
  res.status(500).json({ error: "Internal server error" })
}
