import type { Metadata } from "next"
import { connection } from "next/server"

import { buttonVariants } from "@/components/ui/button"
import { tnFrontendUrl } from "@/lib/env"
import { fetchJobListings, type JobListing } from "@/lib/jobs"

export const metadata: Metadata = {
  title: "Learn2Earn stand-in jobs",
  robots: { index: false },
}

function applyUrl(listing: JobListing): string {
  const url = new URL("/signup/intern", tnFrontendUrl())
  url.searchParams.set("jobListingId", listing.id)
  return url.toString()
}

export default async function JobsPage() {
  // Always fetch fresh listings from the TN backend.
  await connection()

  let listings: JobListing[] = []
  let error: string | null = null
  try {
    listings = await fetchJobListings()
  } catch (err) {
    console.error("Failed to load job listings", err)
    error = err instanceof Error ? err.message : "Unknown error"
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-6 text-sm">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Learn2Earn stand-in jobs</h1>
        <p className="text-muted-foreground">
          Published TN Build listings. Apply opens TN Build&apos;s intern
          sign-up.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-destructive">
          Couldn&apos;t load job listings: {error}
        </p>
      ) : listings.length === 0 ? (
        <p className="text-muted-foreground">No published job listings.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {listings.map((listing) => (
            <li
              key={listing.id}
              className="flex items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{listing.title}</span>
                {listing.details.length > 0 && (
                  <span className="text-muted-foreground">
                    {listing.details.join(" · ")}
                  </span>
                )}
                <span className="font-mono text-xs text-muted-foreground">
                  {listing.id}
                </span>
              </div>
              <a href={applyUrl(listing)} className={buttonVariants()}>
                Apply
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
