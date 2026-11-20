import express from "express"
import type { Request, Response } from "express"
import cors from "cors"

import type { TransactionService } from "./services/transaction-service.js"
import { errorHandler } from "./utils/error-handler.js"
import { parseListQuery } from "./utils/list-query.js"
import { validateNewTransaction } from "./utils/validation.js"

// Split from index.ts so the routes can be tested on a throwaway port without starting the real server
export const createApp = (transactionService: TransactionService) => {
  const app = express()

  app.use(cors({ origin: "*", credentials: true }))
  app.use(express.json())

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" })
  })

  app.get("/api/transactions", (req: Request, res: Response) => {
    const parsed = parseListQuery(req.query)
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error })
    }
    res.json(transactionService.list(parsed.params))
  })

  app.get("/api/transactions/summary", (_req: Request, res: Response) => {
    res.json(transactionService.getSummary())
  })

  app.post("/api/transactions", (req: Request, res: Response) => {
    const result = validateNewTransaction(req.body)
    if (!result.ok) {
      return res.status(400).json({ error: "Invalid transaction", fields: result.errors })
    }
    const transaction = transactionService.create(result.value)
    res.status(201).json(transaction)
  })

  app.get("/api/transactions/:id", (req: Request, res: Response) => {
    const transaction = transactionService.getById(req.params.id)
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" })
    }
    res.json(transaction)
  })

  app.use(errorHandler)

  return app
}
