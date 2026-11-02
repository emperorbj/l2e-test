# Learn2Earn SSO with a stand-in: step-by-step plan

How we test the full Learn2Earn (L2E) sign-in and intern application flow before real L2E is ready. A stand-in app on Vercel acts as L2E's sign-in server.

| Team | Owns |
|---|---|
| **TN backend** | Env vars, database checks, backend fixes |
| **Stand-in** | The Vercel app that imitates L2E sign-in and lists jobs |
| **TN frontend** | The TN Build web app (proxy, sign-in, application form, tracker) |

**Status:**

- **TN frontend:** built and tested against a local mock. Not committed or deployed yet.
- **TN backend:** SSO built. On dev, only `L2E_API_KEY` is set so far.
- **Stand-in:** not started.

URLs used below:

- **TN frontend (dev):** `https://talent-nation-build-fe-dev-14573850302.europe-west1.run.app`
- **TN backend (dev):** `<dev backend URL>`
- **Stand-in:** `https://<project>.vercel.app`

> **Never point production at the stand-in.** It signs in anyone who knows its password.

---

## Phase 1: Preparation

### 1.1 TN backend: check the intern role exists on dev

```sql
SELECT name, is_public FROM roles WHERE name = 'intern';
```

It should return one row with `is_public = false`. It's added by migration `20261028000200-add-l2e-intern-role.js`. Without it, sign-in fails with `503 "The intern role is not configured."`

### 1.2 TN backend: generate the secrets

| Value | Rule | Used by |
|---|---|---|
| `SSO_STATE_SECRET` | Random, at least 32 characters | Backend only. Store in Secret Manager. |
| `L2E_API_KEY` | Random, starts with `L2E-` | Backend and stand-in. Share securely. **Dev: already set on the backend (2 Nov 2026).** |

Everything runs on dev; there's no local TN backend in this plan.

### 1.3 TN backend: publish a test job listing

Create and publish at least one job listing on dev through tn-build-admin. Note its ID.

### 1.4 TN frontend: merge-ready, not deployed

The frontend SSO work is ready to commit on `feat/talent-skills-quiz`. **Don't deploy it to dev until Phase 4, step 4.3.** Before that, the **Continue with Learn2Earn** buttons show interns the backend's raw `503` JSON.

---

## Phase 2: Build the stand-in

**Owner:** stand-in. Separate repo (for example `l2e-sso-standin`), using Next.js route handlers on Vercel.

### 2.1 Routes

| Route | What it does |
|---|---|
| `GET /cas/login?service=...` | Shows a form for a test intern's name and email, protected by a shared password. On submit, redirects to `service` with `&ticket=<ticket>` added. |
| `GET /cas/p3/serviceValidate?service=...&ticket=...&format=JSON` | Checks the ticket and returns the intern's details (see 2.4). |
| `GET /jobs` | Calls `GET /api/v1/l2e-interns/job-listings` from the server, with header `x-api-key: <L2E_API_KEY>`, and lists jobs with **Apply** buttons. |

**Apply button link:**

```text
<TN frontend URL>/signup/intern?jobListingId=<listing id>
```

### 2.2 `/cas/login` rules

- Only accept emails ending `@l2e-test.dev`.
- Keep the received `service` URL exactly as it came, including `?state=...`.
- Add the ticket with `&`, because `service` already has a query string:

```text
<service>&ticket=L2ECASTK-...
```

### 2.3 Tickets

**Format** (checked by the backend):

```text
^(?:L2ECASTK|TN)-[A-Za-z0-9_-]{20,}$
```

**Build a signed ticket** so any Vercel function can check it without shared memory:

```text
L2ECASTK-<payload><signature>
```

- **Payload:** base64url JSON of `email`, `firstName`, `lastName`, `service` and `expiresAt` (5 minutes ahead).
- **Signature:** HMAC-SHA256 of the payload with `TICKET_SECRET`, base64url. It's always 43 characters, so split it off as the last 43 characters. Don't use `.` as a separator, because the format doesn't allow it.

**Rejecting a ticket.** In `serviceValidate`, reject it if:

- the signature is wrong,
- it has expired,
- its `service` doesn't match the `service` in the request,
- it was already used: run `SET used:<ticket> 1 NX EX 600` in Upstash Redis. If the key exists, reject it.

The backend doesn't track used tickets, so the stand-in has to.

**Stable user ID.** The backend uses `user` to recognise returning interns, so derive it from the email:

```text
user = "standin-" + sha256(lowercased email)
```

### 2.4 `serviceValidate` response

**Always:**

- status **200**, including for a rejected ticket
- `Content-Type: application/json`
- **no redirects**, including trailing-slash redirects. Serve exactly `/cas/p3/serviceValidate`.
- a response in **under 5 seconds**, with a body **under 64 KB**

**Success:**

```json
{
  "serviceResponse": {
    "authenticationSuccess": {
      "user": "standin-<sha256 of email>",
      "attributes": { "email": "ada@l2e-test.dev", "firstName": "Ada", "lastName": "Obi" }
    }
  }
}
```

| Field | Rule |
|---|---|
| `user` | Required, max 256 characters, stable for a person |
| `email` | Required, valid email, max 254 characters |
| `firstName`, `lastName` | Required, max 100 characters each |

**Failure:**

```json
{
  "serviceResponse": {
    "authenticationFailure": { "code": "INVALID_TICKET", "description": "Ticket not recognized" }
  }
}
```

The backend turns a failure into a `401`. Returning any status other than 2xx makes the backend report `503 "validation is unavailable"` instead.

### 2.5 Vercel setup

**Environment variables:**

```env
TN_API_BASE_URL=<TN backend URL>
L2E_API_KEY=<same value as the backend>
TICKET_SECRET=<random, 32+ characters>
STANDIN_PASSWORD=<shared test password>
ALLOWED_EMAIL_DOMAIN=l2e-test.dev
# plus the Upstash Redis variables Vercel adds when you connect it
```

**Project rules:**

- Use only the **production domain** (`https://<project>.vercel.app`), never per-deploy preview URLs.
- Under **Deployment Protection**, the production domain must not require a Vercel login, or the backend can't reach `serviceValidate`.
- Keep `serviceValidate` light (one Redis call and an HMAC), so a cold start stays well under 5 seconds.

---

## Phase 3: Check the stand-in on its own

**Owner:** stand-in. There's no local TN backend, and the dev backend can't reach `localhost`, so the full sign-in only runs once everything is deployed (Phase 5). Locally, check each part of the stand-in on its own, with `TN_API_BASE_URL` set to the **dev** backend:

1. **Jobs:** `http://localhost:3000/jobs` lists the dev job, and **Apply** links to the TN dev frontend.
2. **Login:** open `http://localhost:3000/cas/login?service=https%3A%2F%2Fexample.test%2Fcallback%3Fstate%3Dabc`, sign in, and copy the ticket from the redirect to `https://example.test/callback?state=abc&ticket=L2ECASTK-...` (that page won't load, which is fine).
3. **Ticket check:** call `/cas/p3/serviceValidate` with the same `service` and the ticket:
   - The first call returns `authenticationSuccess`, with status 200 and `Content-Type: application/json`.
   - The same call again returns `authenticationFailure`.
   - A different `service` returns `authenticationFailure`.
4. **Email rule:** an email outside `@l2e-test.dev` is refused.

---

## Phase 4: Set up dev

| Step | Owner | Action |
|---|---|---|
| 4.1 | Stand-in | Deploy to Vercel production with `TN_API_BASE_URL` set to the dev backend and the dev `L2E_API_KEY`. Open `https://<project>.vercel.app/jobs` in a private window: it must load without a Vercel login and list the dev job. |
| 4.2 | TN backend | Set the env vars below on `talent-nation-build-be-dev`, wait for the new revision to serve, then check that `<dev backend>/api/v1/auth/sso/start` no longer returns `503 "Learn2Earn SSO is not configured."` |
| 4.3 | TN frontend | Commit and merge to `develop`, then deploy. Only after 4.2 passes. |

**Dev backend env vars:**

```env
SSO_BASE_URL=https://<project>.vercel.app
SSO_INTERNAL_BASE_URL=
SSO_CALLBACK_URL=https://talent-nation-build-fe-dev-14573850302.europe-west1.run.app/api/v1/auth/sso/callback
SSO_FRONTEND_ORIGINS=https://talent-nation-build-fe-dev-14573850302.europe-west1.run.app
SSO_STATE_SECRET=<dev value, from Secret Manager>
```

- `L2E_API_KEY` is already set on dev. Keep it, and use the same value on Vercel.
- `SSO_INTERNAL_BASE_URL` stays empty, because the backend and the browser reach Vercel at the same address.
- `SSO_CALLBACK_URL` must not contain a query string or `#`.
- `SSO_FRONTEND_ORIGINS` is origins only: no trailing `/` and no path.

---

## Phase 5: Test on dev

**Owner:** everyone, together. Start from `https://<project>.vercel.app/jobs`. A local TN frontend can't be used: the dev backend only sends interns back to the dev frontend.

| # | Check | Expected |
|---|---|---|
| 1 | **Apply** with a new `@l2e-test.dev` email | Stand-in login → TN form with name and email locked and the right job → submit → tracker showing "under review" |
| 2 | **Apply** to the same job again | Toast "already applied", then the tracker. No new application. |
| 3 | **Apply** to a different job while signed in | Goes straight to the form, without the stand-in login |
| 4 | **Continue with Learn2Earn** on `/login` | Signs in and opens the tracker |
| 5 | Copy a `/login?sso_code=...` URL from the Network tab after signing in, and open it again | TN `/login` shows "We couldn't sign you in" with **Try again** |
| 6 | Open the skills assessment before approval | Sent back to the tracker |
| 7 | Approve the application as admin | Skills assessment opens |
| 8 | Double-click **Submit Application** | Only one application is created |
| 9 | Pick a track that doesn't match the job, or leave out a required GitHub or portfolio link | The backend's error message shows on the form |

In DevTools, check that requests to `/api/v1/auth/sso/*` go to the **frontend's** address and that `/exchange` sends the `tn_build_l2e_sso` cookie.

---

## Phase 6: Switch to real L2E

| Step | Owner | Action |
|---|---|---|
| 6.1 | TN backend | Delete the stand-in's `@l2e-test.dev` interns from the dev database. |
| 6.2 | TN backend | Set `SSO_BASE_URL`, and `SSO_INTERNAL_BASE_URL` if L2E gives one, to L2E's URL. |
| 6.3 | TN backend | Give L2E a **new** `L2E_API_KEY`, and remove the old one from Vercel. |
| 6.4 | L2E | Allow `SSO_CALLBACK_URL` as a service URL (matched by prefix), return `email`, `firstName` and `lastName`, provide a test account, and link **Apply** to `<TN frontend URL>/signup/intern?jobListingId=<id>`. |
| 6.5 | Everyone | Run the Phase 5 checks from L2E's own jobs page. |
| 6.6 | Stand-in | Delete the Vercel project. |

---

## Rules while testing

- **Only `@l2e-test.dev` emails.** `SSO_BASE_URL` is part of each intern's stored ID. An email used with the stand-in fails with a **500** when it later signs in through real L2E.
- **Never the email of an existing talent or recruiter account.** It returns **409** (an admin has to link it), shown to the intern as raw JSON.
- **Never on production.**

## Known limits

| Item | Owner | Effect until fixed |
|---|---|---|
| Errors at `/callback` (401, 409, 503) show raw JSON | TN backend | Redirect them to `/login?sso_error=<code>`; the frontend then needs a message for each |
| The frontend can't read a job's track | TN backend | The intern picks the track; a mismatch shows the backend's error |
| Duplicate applications to the same job are accepted | TN backend | The frontend checks the application history, but two tabs can still create duplicates |
| Changing `SSO_BASE_URL` makes existing intern emails fail with a 500 | TN backend | Use test emails only, and clean up before switching |
