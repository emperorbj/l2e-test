import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

export default function Page() {
  return (
    <main className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Learn2Earn SSO stand-in</h1>
          <p>
            Imitates Learn2Earn sign-in so TN Build dev can test the intern
            flow. Test only: never point production at this app.
          </p>
        </div>
        <Link href="/jobs" className={buttonVariants({ className: "w-fit" })}>
          View jobs
        </Link>
      </div>
    </main>
  )
}
