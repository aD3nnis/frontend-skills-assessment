import { createApp } from "./app.js"
import { PORT } from "./config.js"
import { createTransactionService } from "./services/transaction-service.js"

const transactionService = createTransactionService()
const app = createApp(transactionService)

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT} (${transactionService.getAll().length} transactions)`)
})
