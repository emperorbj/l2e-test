import "server-only"

const DEFAULT_TN_FRONTEND_URL =
  "https://talent-nation-build-fe-dev-14573850302.europe-west1.run.app"

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable ${name}`)
  }
  return value
}

export function ticketSecret(): string {
  const secret = required("TICKET_SECRET")
  if (secret.length < 32) {
    throw new Error("TICKET_SECRET must be at least 32 characters")
  }
  return secret
}

export function standinPassword(): string {
  return required("STANDIN_PASSWORD")
}

export function allowedEmailDomain(): string {
  return (process.env.ALLOWED_EMAIL_DOMAIN || "l2e-test.dev").toLowerCase()
}

export function tnApiBaseUrl(): string {
  return required("TN_API_BASE_URL").replace(/\/+$/, "")
}

export function l2eApiKey(): string {
  return required("L2E_API_KEY")
}

export function tnFrontendUrl(): string {
  return (process.env.TN_FRONTEND_URL || DEFAULT_TN_FRONTEND_URL).replace(
    /\/+$/,
    ""
  )
}
