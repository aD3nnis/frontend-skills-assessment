import { Link, useParams } from "react-router-dom"
import { Button, Descriptions, Result, Spin, Tag } from "antd"

import { useTransaction } from "../hooks/useTransaction"
import { TransactionNotFoundError } from "../services/transaction-service"
import { formatCurrency, formatDate } from "../utils/format"
import { statusTagColor } from "../utils/status"

export const TransactionDetailPage = () => {
  const { id = "" } = useParams()
  const { transaction, error, loading, reload } = useTransaction(id)

  const backLink = <Link to="/">← Back to transactions</Link>

  if (loading) {
    return (
      <div className="app-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (error instanceof TransactionNotFoundError) {
    return (
      <Result
        status="404"
        title="Transaction not found"
        subTitle={`There is no transaction with the id "${id}".`}
        extra={backLink}
      />
    )
  }

  if (error || !transaction) {
    return (
      <Result
        status="error"
        title="Couldn't load this transaction"
        subTitle="Something went wrong while loading it. Check your connection and try again."
        extra={[
          <Button key="retry" type="primary" onClick={reload}>
            Try again
          </Button>,
          <span key="back">{backLink}</span>,
        ]}
      />
    )
  }

  return (
    <div className="transaction-detail">
      <p>{backLink}</p>
      <h2 className="mono">{transaction.id}</h2>
      <Descriptions
        column={1}
        size="small"
        bordered
        items={[
          { key: "merchant", label: "Merchant", children: transaction.merchantName },
          { key: "card", label: "Card brand", children: transaction.cardBrand },
          { key: "amount", label: "Amount", children: formatCurrency(transaction.amount) },
          {
            key: "surcharge",
            label: "Surcharge",
            children: `${formatCurrency(transaction.surcharge)} (${(transaction.surchargeRate * 100).toFixed(1)}%)`,
          },
          { key: "total", label: "Total", children: formatCurrency(transaction.total) },
          {
            key: "status",
            label: "Status",
            // statusTagColor returns undefined for a status the enum doesn't know (e.g. VOIDED), which antd renders as a plain tag
            children: <Tag color={statusTagColor(transaction.status)}>{transaction.status}</Tag>,
          },
          { key: "date", label: "Date", children: formatDate(transaction.createdAt) },
        ]}
      />
    </div>
  )
}
