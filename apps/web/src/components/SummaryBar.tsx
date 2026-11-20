import { Statistic } from "antd"

interface SummaryBarProps {
  // Both cover every transaction matching the search, not only the rows on the current page; the API computes them
  total: number
  totalProcessed: number
}

export const SummaryBar = ({ total, totalProcessed }: SummaryBarProps) => {
  return (
    <div className="summary-bar">
      <Statistic title="Transactions" value={total} />
      <Statistic title="Total processed" value={totalProcessed} precision={2} prefix="$" />
    </div>
  )
}
