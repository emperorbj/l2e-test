"use server"

import { timingSafeEqual } from "node:crypto"
import { redirect } from "next/navigation"

import { allowedEmailDomain, standinPassword } from "@/lib/env"
import { isValidService } from "@/lib/service"
import { createTicket } from "@/lib/ticket"

export type LoginState = {
  error?: string
  values?: { firstName: string; lastName: string; email: string }
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function passwordMatches(input: string): boolean {
  const given = Buffer.from(input)
  const expected = Buffer.from(standinPassword())
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function signIn(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const service = String(formData.get("service") ?? "")
  const firstName = String(formData.get("firstName") ?? "").trim()
  const lastName = String(formData.get("lastName") ?? "").trim()
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  const password = String(formData.get("password") ?? "")
  const values = { firstName, lastName, email }

  if (!isValidService(service)) {
    return { error: "The service URL is missing or invalid.", values }
  }
  if (!passwordMatches(password)) {
    return { error: "Wrong stand-in password.", values }
  }
  if (!firstName || !lastName) {
    return { error: "First and last name are required.", values }
  }
  if (firstName.length > 100 || lastName.length > 100) {
    return { error: "Names must be at most 100 characters.", values }
  }
  const domain = allowedEmailDomain()
  if (
    email.length > 254 ||
    !EMAIL_FORMAT.test(email) ||
    !email.endsWith(`@${domain}`)
  ) {
    return { error: `Use an email ending @${domain}.`, values }
  }

  const ticket = createTicket({ email, firstName, lastName }, service)
  // `service` already carries `?state=...`, so the ticket is appended with `&`.
  const separator = service.includes("?") ? "&" : "?"
  redirect(`${service}${separator}ticket=${ticket}`)
}
