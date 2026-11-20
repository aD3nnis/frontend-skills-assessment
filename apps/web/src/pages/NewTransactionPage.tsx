import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Alert, Button, Form, Input, Select, message } from "antd"

import { CardBrand } from "../models/transaction"
import { ApiError, createTransaction } from "../services/transaction-service"
import { splitFieldErrors } from "../utils/field-errors"
import { formatCurrency } from "../utils/format"
import { MAX_AMOUNT, MAX_MERCHANT_NAME_LENGTH, parseAmount, validateAmount } from "../utils/money"

interface FormValues {
  merchantName: string
  cardBrand: CardBrand
  amount: string
}

const FORM_FIELDS = ["merchantName", "cardBrand", "amount"] as const satisfies readonly (keyof FormValues)[]

const CARD_BRAND_OPTIONS = Object.values(CardBrand).map((brand) => ({ value: brand, label: brand }))

export const NewTransactionPage = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm<FormValues>()
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (values: FormValues) => {
    // A ref, not the `submitting` state: antd validates asynchronously, so a second Enter can reach
    // this function before React re-renders, and the state captured by this closure is still false.
    if (inFlight.current) return
    inFlight.current = true
    setSubmitting(true)
    setError(null)
    const amount = parseAmount(values.amount)
    try {
      await createTransaction({ merchantName: values.merchantName.trim(), cardBrand: values.cardBrand, amount })
    } catch (err) {
      const { known, unknown } =
        err instanceof ApiError ? splitFieldErrors(err.fields, FORM_FIELDS) : { known: [], unknown: [] }
      // Server-side rules are the source of truth; surface them on the matching inputs.
      form.setFields(known.map(({ name, message }) => ({ name, errors: [message] })))
      // Anything the form cannot attach to an input, or no field errors at all, goes in the alert.
      if (unknown.length > 0) setError(unknown.join(". "))
      else if (known.length === 0) setError(err instanceof Error ? err.message : "Something went wrong")
      return
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
    // From here the payment exists, so nothing below may be reported as a failed create (the user
    // would retry into a duplicate). The toast uses the amount we sent, not the response body.
    message.success(`Created transaction for ${formatCurrency(amount)}`)
    navigate("/")
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
            {
              // The API trims before checking length, so measure the trimmed value here too
              transform: (value: string | undefined) => value?.trim(),
              max: MAX_MERCHANT_NAME_LENGTH,
              message: `Merchant name must be at most ${MAX_MERCHANT_NAME_LENGTH} characters`,
            },
          ]}
        >
          {/* +1 so an over-long paste still triggers the rule above instead of being silently cut */}
          <Input placeholder="Merchant name" maxLength={MAX_MERCHANT_NAME_LENGTH + 1} />
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
