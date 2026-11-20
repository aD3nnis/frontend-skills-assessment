import express from "express"
import type { Request, Response } from "express"
import cors from "cors"

import { PORT } from "./config.js"
import { createTransactionService } from "./services/transaction-service.js"
import { errorHandler } from "./utils/error-handler.js"
import { validateNewTransaction } from "./utils/validation.js"

const app = express()

app.use(cors({ origin: "*", credentials: true }))
app.use(express.json())

const transactionService = createTransactionService()

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" })
})

app.get("/api/transactions", (req: Request, res: Response) => {
  console.log("GET /api/transactions", req.query)
  const transactions = transactionService.getAll()
  res.json({ transactions })
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

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT} (${transactionService.getAll().length} transactions)`)
})
