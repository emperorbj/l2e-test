import "server-only"

import { l2eApiKey, tnApiBaseUrl } from "@/lib/env"

export type JobListing = {
  id: string
  title: string
  details: string[]
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// The listing endpoint's envelope isn't pinned down, so look for the first
// array in the usual places: the body itself, `data`, or a named list in `data`.
function findListings(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body
  if (!isObject(body)) return null
  for (const key of ["data", "jobListings", "listings", "items", "results"]) {
    const value = body[key]
    if (Array.isArray(value)) return value
    if (isObject(value)) {
      const nested = findListings(value)
      if (nested) return nested
    }
  }
  return null
}

function text(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number") return String(value)
  if (isObject(value) && typeof value.name === "string") return value.name
  return undefined
}

function toListing(raw: unknown): JobListing | null {
  if (!isObject(raw)) return null
  const id = text(raw.id ?? raw._id ?? raw.jobListingId ?? raw.uuid)
  if (!id) return null
  const title = text(raw.title ?? raw.name ?? raw.role ?? raw.position)
  const details = [
    raw.company ?? raw.companyName ?? raw.organization,
    raw.track,
    raw.location,
    raw.workMode ?? raw.type ?? raw.employmentType,
  ]
    .map(text)
    .filter((value): value is string => Boolean(value))
  return { id, title: title ?? "Untitled listing", details }
}

export async function fetchJobListings(): Promise<JobListing[]> {
  const response = await fetch(
    `${tnApiBaseUrl()}/api/v1/l2e-interns/job-listings`,
    {
      headers: { "x-api-key": l2eApiKey(), accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }
  )
  if (!response.ok) {
    throw new Error(`TN backend returned ${response.status}`)
  }
  const listings = findListings(await response.json())
  if (!listings) {
    throw new Error("TN backend response had no job listing array")
  }
  return listings
    .map(toListing)
    .filter((listing): listing is JobListing => listing !== null)
}
