import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Alert, Button, Form, Input, Select, message } from "antd"

import { CardBrand } from "../models/transaction"
import { ApiError, createTransaction } from "../services/transaction-service"
import { formatCurrency } from "../utils/format"
import { MAX_AMOUNT, parseAmount, validateAmount } from "../utils/money"

interface FormValues {
  merchantName: string
  cardBrand: CardBrand
  amount: string
}

const CARD_BRAND_OPTIONS = Object.values(CardBrand).map((brand) => ({ value: brand, label: brand }))

export const NewTransactionPage = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm<FormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (values: FormValues) => {
    // Guards against a double Enter/click before the disabled state renders.
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createTransaction({
        merchantName: values.merchantName.trim(),
        cardBrand: values.cardBrand,
        amount: parseAmount(values.amount),
      })
      message.success(`Created transaction for ${formatCurrency(created.amount)}`)
      navigate("/")
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) {
        // Server-side rules are the source of truth; surface them on the matching inputs.
        form.setFields(
          (Object.entries(err.fields) as [keyof FormValues, string][]).map(([name, msg]) => ({ name, errors: [msg] })),
        )
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong")
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="new-transaction">
      <h2>New Transaction</h2>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ cardBrand: CardBrand.VISA }}
        onFinish={handleSubmit}
        disabled={submitting}
      >
        <Form.Item
          label="Merchant name"
          name="merchantName"
          rules={[
            { required: true, whitespace: true, message: "Merchant name is required" },
            { max: 100, message: "Merchant name must be at most 100 characters" },
          ]}
        >
          <Input placeholder="Merchant name" maxLength={101} />
        </Form.Item>

        <Form.Item label="Card brand" name="cardBrand">
          <Select options={CARD_BRAND_OPTIONS} />
        </Form.Item>

        <Form.Item
          label="Amount (USD)"
          name="amount"
          extra={`Up to ${formatCurrency(MAX_AMOUNT)}, 2 decimal places`}
          rules={[
            {
              validator: (_rule, value: string | undefined) => {
                const problem = validateAmount(value ?? "")
                return problem ? Promise.reject(new Error(problem)) : Promise.resolve()
              },
            },
          ]}
        >
          <Input prefix="$" placeholder="0.00" inputMode="decimal" />
        </Form.Item>

        <div className="form-actions">
          <Button type="primary" htmlType="submit" loading={submitting}>
            Create
          </Button>
          <Button onClick={() => navigate("/")} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </Form>
    </div>
  )
}
