import express from "express"
import type { NextFunction, Request, Response } from "express"
import cors from "cors"

import type { TransactionService } from "./services/transaction-service.js"
import { parseListQuery } from "./utils/list-query.js"

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
    const { merchantName, cardBrand, amount } = req.body
    const transaction = transactionService.create({ merchantName, cardBrand, amount })
    res.status(201).json(transaction)
  })

  app.get("/api/transactions/:id", (req: Request, res: Response) => {
    const transaction = transactionService.getById(req.params.id)
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" })
    }
    res.json(transaction)
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err)
    res.status(500).json({ error: err.message, stack: err.stack })
  })

  return app
}
