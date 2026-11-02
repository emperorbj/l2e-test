"use client"

import { useActionState } from "react"

import { signIn, type LoginState } from "@/app/cas/login/actions"
import { Button } from "@/components/ui/button"

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

export function LoginForm({
  service,
  domain,
}: {
  service: string
  domain: string
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signIn,
    {}
  )

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="service" value={service} />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">First name</span>
          <input
            name="firstName"
            required
            maxLength={100}
            defaultValue={state.values?.firstName}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Last name</span>
          <input
            name="lastName"
            required
            maxLength={100}
            defaultValue={state.values?.lastName}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          placeholder={`ada@${domain}`}
          defaultValue={state.values?.email}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Stand-in password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>

      {state.error && (
        <p role="alert" className="text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
