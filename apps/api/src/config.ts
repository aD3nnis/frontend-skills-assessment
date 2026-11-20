export const PORT = Number(process.env.PORT) || 4000

// Secrets come from the environment, never from source. Read lazily and fail loudly
// at the point of use, so the server and tests still boot where the processor
// integration isn't configured (the webhook helper isn't wired up yet).
const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const getProcessorWebhookSecret = (): string => requireEnv("PROCESSOR_WEBHOOK_SECRET")
