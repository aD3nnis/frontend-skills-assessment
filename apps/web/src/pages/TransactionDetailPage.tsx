import { useLocation, useNavigate, useParams } from "react-router-dom"
import { Button, Descriptions, Result, Spin, Tag } from "antd"

import { useTransaction } from "../hooks/useTransaction"
import { TransactionNotFoundError } from "../services/transaction-service"
import { formatCurrency, formatDate } from "../utils/format"
import { cameFromList } from "../utils/list-state"
import { statusTagColor } from "../utils/status"

export const TransactionDetailPage = () => {
  const { id = "" } = useParams()
  const { transaction, error, loading, reload } = useTransaction(id)

  const navigate = useNavigate()
  const location = useLocation()
  // Opened from the list: step back in history, so the list returns with its own search and page and the browser's
  // Back button doesn't land on this page again (a pushed entry would make the two controls loop).
  // Otherwise (pasted link, new tab) there is no list entry to return to: replace this one with the plain list.
  const goBack = () => (cameFromList(location.state) ? navigate(-1) : navigate("/", { replace: true }))

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
        extra={
          <Button type="primary" onClick={goBack}>
            Back to transactions
          </Button>
        }
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
          <Button key="back" onClick={goBack}>
            Back to transactions
          </Button>,
        ]}
      />
    )
  }

  return (
    <div className="transaction-detail">
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
      <div className="transaction-detail-actions">
        <Button type="primary" onClick={goBack}>
          Back to transactions
        </Button>
      </div>
    </div>
  )
}
