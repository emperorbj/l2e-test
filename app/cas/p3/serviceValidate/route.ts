import type { NextRequest } from "next/server"

import { stableUserId, verifyTicket } from "@/lib/ticket"
import { markTicketUsed } from "@/lib/used-tickets"

// The TN backend treats any non-2xx status as "validation is unavailable",
// so every outcome, including a rejected ticket, is a 200 JSON response.
function failure(code: string, description: string) {
  return Response.json(
    { serviceResponse: { authenticationFailure: { code, description } } },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  )
}

export async function GET(request: NextRequest) {
  const service = request.nextUrl.searchParams.get("service")
  const ticket = request.nextUrl.searchParams.get("ticket")
  if (!service || !ticket) {
    return failure("INVALID_REQUEST", "Both service and ticket are required")
  }

  try {
    const check = verifyTicket(ticket, service)
    if (!check.ok) {
      return failure("INVALID_TICKET", check.reason)
    }
    if (!(await markTicketUsed(ticket))) {
      return failure("INVALID_TICKET", "Ticket has already been used")
    }

    const { email, firstName, lastName } = check.intern
    return Response.json(
      {
        serviceResponse: {
          authenticationSuccess: {
            user: stableUserId(email),
            attributes: { email, firstName, lastName },
          },
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("serviceValidate failed", error)
    return failure("INTERNAL_ERROR", "Ticket could not be validated")
  }
}
