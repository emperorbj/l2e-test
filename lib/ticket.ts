import "server-only"

import { createHash, createHmac, timingSafeEqual } from "node:crypto"

import { ticketSecret } from "@/lib/env"

// Checked by the TN backend; anything else is rejected before validation.
export const TICKET_FORMAT = /^(?:L2ECASTK|TN)-[A-Za-z0-9_-]{20,}$/

const PREFIX = "L2ECASTK-"
// base64url of a 32-byte HMAC-SHA256 digest, without padding.
const SIGNATURE_LENGTH = 43
const TICKET_TTL_MS = 5 * 60 * 1000

export type Intern = {
  email: string
  firstName: string
  lastName: string
}

type TicketPayload = Intern & {
  service: string
  expiresAt: number
}

function sign(payload: string): string {
  return createHmac("sha256", ticketSecret())
    .update(payload)
    .digest("base64url")
}

export function createTicket(intern: Intern, service: string): string {
  const body: TicketPayload = {
    ...intern,
    service,
    expiresAt: Date.now() + TICKET_TTL_MS,
  }
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url")
  return `${PREFIX}${payload}${sign(payload)}`
}

export type TicketCheck =
  | { ok: true; intern: Intern }
  | { ok: false; reason: string }

// Checks signature, expiry and service. Single use is enforced separately,
// so only tickets that pass here consume a Redis key.
export function verifyTicket(ticket: string, service: string): TicketCheck {
  if (!TICKET_FORMAT.test(ticket) || !ticket.startsWith(PREFIX)) {
    return { ok: false, reason: "Ticket not recognized" }
  }

  const rest = ticket.slice(PREFIX.length)
  if (rest.length <= SIGNATURE_LENGTH) {
    return { ok: false, reason: "Ticket not recognized" }
  }
  const payload = rest.slice(0, -SIGNATURE_LENGTH)
  const signature = Buffer.from(rest.slice(-SIGNATURE_LENGTH))
  const expected = Buffer.from(sign(payload))
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(signature, expected)
  ) {
    return { ok: false, reason: "Ticket not recognized" }
  }

  let body: TicketPayload
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return { ok: false, reason: "Ticket not recognized" }
  }

  if (typeof body.expiresAt !== "number" || body.expiresAt < Date.now()) {
    return { ok: false, reason: "Ticket has expired" }
  }
  if (body.service !== service) {
    return { ok: false, reason: "Ticket was not issued for this service" }
  }

  return {
    ok: true,
    intern: {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
    },
  }
}

// The TN backend recognises returning interns by this value.
export function stableUserId(email: string): string {
  const hash = createHash("sha256").update(email.toLowerCase()).digest("hex")
  return `standin-${hash}`
}
