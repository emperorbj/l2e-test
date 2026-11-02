import type { Metadata } from "next"

import { LoginForm } from "@/app/cas/login/login-form"
import { allowedEmailDomain } from "@/lib/env"
import { isValidService } from "@/lib/service"

export const metadata: Metadata = {
  title: "Learn2Earn stand-in sign in",
  robots: { index: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { service } = await searchParams

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6 text-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium">Learn2Earn stand-in</h1>
          <p className="text-muted-foreground">
            Test sign-in for TN Build dev. Only @{allowedEmailDomain()} emails.
          </p>
        </div>
        {typeof service === "string" && isValidService(service) ? (
          <LoginForm service={service} domain={allowedEmailDomain()} />
        ) : (
          <p role="alert" className="text-destructive">
            This page needs a valid <code>service</code> URL. Start from TN
            Build&apos;s Continue with Learn2Earn button or the jobs page.
          </p>
        )}
      </div>
    </main>
  )
}
