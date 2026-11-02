# Learn2Earn SSO stand-in

A test-only Vercel app that imitates Learn2Earn's CAS sign-in, so TN Build dev can test the intern sign-in and application flow before real L2E is ready. See `l2e-sso-standin-tasks.md` for the full spec.

> **Never point production at this app.** It signs in anyone who knows its password.

## Routes

| Route | Purpose |
|---|---|
| `/cas/login?service=...` | Password-protected form for a test intern. Redirects to `<service>&ticket=L2ECASTK-...`. |
| `/cas/p3/serviceValidate?service=...&ticket=...` | Verifies the signed ticket (signature, expiry, service, single use) and returns CAS JSON. Always 200. |
| `/jobs` | Lists the TN backend's job listings, with Apply links to TN Build's intern sign-up. |

## Setup

1. Copy `.env.example` to `.env.local` and fill it in, or run `vercel env pull .env.local`.
2. Connect Upstash Redis from the Vercel Marketplace. Without it, `next dev` uses an in-memory used-ticket store; production refuses to validate.
3. `yarn install` and `yarn dev`.

Deploy to Vercel production only, and make sure Deployment Protection doesn't cover the production domain.
