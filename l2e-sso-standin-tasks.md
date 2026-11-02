# Learn2Earn SSO stand-in: tasks for the stand-in developer

Build a small app on Vercel that acts as Learn2Earn's (L2E) sign-in server, so we can test TN Build's intern sign-in and application flow before real L2E is ready.

> **Test only.** It signs in anyone who knows its password. Never point production at it.

URLs used below:

- **TN frontend (dev):** `https://talent-nation-build-fe-dev-14573850302.europe-west1.run.app`
- **TN backend (dev):** `<dev backend URL>`, from the TN backend team
- **Stand-in:** `https://<project>.vercel.app`

## What you need from the TN backend team

There's no local TN backend. You build and test against the **dev** backend.

- **The dev `L2E_API_KEY`**, shared securely. It's already set on the dev backend, so `/jobs` works against dev right away.
- **The dev backend URL.**
- **A published job listing ID on dev.**

## Step 1: Set up the project

1. Create a separate repo, for example `l2e-sso-standin`, using Next.js with route handlers.
2. Connect **Upstash Redis** from the Vercel Marketplace. It's used to reject reused tickets.

## Step 2: Build the routes

| Route | What it does |
|---|---|
| `GET /cas/login?service=...` | Shows a form for a test intern's first name, last name and email, protected by a shared password. On submit, redirects to `service` with `&ticket=<ticket>` added. |
| `GET /cas/p3/serviceValidate?service=...&ticket=...&format=JSON` | Checks the ticket and returns the intern's details (step 4). |
| `GET /jobs` | Calls `GET <TN_API_BASE_URL>/api/v1/l2e-interns/job-listings` from the server, with header `x-api-key: <L2E_API_KEY>`, and lists jobs with **Apply** buttons. Never call it from the browser. |

**Apply button link:**

```text
<TN frontend URL>/signup/intern?jobListingId=<listing id>
```

**`/cas/login` rules:**

- Only accept emails ending `@l2e-test.dev`.
- Keep the received `service` URL exactly as it came, including `?state=...`.
- Add the ticket with `&`, because `service` already has a query string:

```text
<service>&ticket=L2ECASTK-...
```

## Step 3: Tickets

**Format** (the TN backend rejects anything else):

```text
^(?:L2ECASTK|TN)-[A-Za-z0-9_-]{20,}$
```

**Build a signed ticket**, so any Vercel function can check it without shared memory:

```text
L2ECASTK-<payload><signature>
```

- **Payload:** base64url JSON of `email`, `firstName`, `lastName`, `service` and `expiresAt` (5 minutes ahead).
- **Signature:** HMAC-SHA256 of the payload with `TICKET_SECRET`, base64url. It's always 43 characters, so split it off as the last 43 characters. Don't use `.` as a separator, because the format doesn't allow it.

**Reject a ticket in `serviceValidate` if:**

- the signature is wrong,
- it has expired,
- its `service` doesn't match the `service` in the request,
- it was already used: run `SET used:<ticket> 1 NX EX 600` in Redis. If the key exists, reject it. The TN backend doesn't track used tickets, so this is the stand-in's job.

**Stable user ID.** The TN backend uses `user` to recognise returning interns, so derive it from the email:

```text
user = "standin-" + sha256(lowercased email)
```

## Step 4: `serviceValidate` response

**Always:**

- status **200**, including for a rejected ticket. Any other status makes the TN backend report `503 "validation is unavailable"` instead of a rejected login.
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
| `firstName`, `lastName` | Required, max 100 characters each. `first_name` and `last_name` also work. |

Each value can be a plain string or a one-item array such as `["Ada"]`.

**Failure:**

```json
{
  "serviceResponse": {
    "authenticationFailure": { "code": "INVALID_TICKET", "description": "Ticket not recognized" }
  }
}
```

## Step 5: Environment variables

```env
TN_API_BASE_URL=<TN dev backend URL>
L2E_API_KEY=<dev key, from the TN backend team>
TICKET_SECRET=<random, 32+ characters>
STANDIN_PASSWORD=<shared test password>
ALLOWED_EMAIL_DOMAIN=l2e-test.dev
# plus the Upstash Redis variables Vercel adds when you connect it
```

Use Project Settings → Environment Variables on Vercel. For local work, `vercel env pull .env.local` copies them, including the Redis variables.

## Step 6: Check it on your own, locally

Run `npm run dev` on `localhost:3000`, with `TN_API_BASE_URL` set to the **dev** backend.

The full sign-in can't run from here: the dev backend can't reach `localhost`. Check each part on its own instead:

1. **Jobs:** `http://localhost:3000/jobs` lists the dev job, and **Apply** links to the TN dev frontend.
2. **Login:** open `http://localhost:3000/cas/login?service=https%3A%2F%2Fexample.test%2Fcallback%3Fstate%3Dabc`. After signing in, it should redirect to `https://example.test/callback?state=abc&ticket=L2ECASTK-...`. That page won't load, which is fine: copy the ticket from the address bar.
3. **Ticket check:** call `/cas/p3/serviceValidate?service=<same service, encoded>&ticket=<ticket>&format=JSON`:
   - The first call returns `authenticationSuccess`, with status 200 and `Content-Type: application/json`.
   - The same call again returns `authenticationFailure`, because the ticket was already used.
   - A different `service` returns `authenticationFailure`.
   - The `user` value is the same each time you sign in with the same email.
4. **Email rule:** an email outside `@l2e-test.dev` is refused on the login form.

## Step 7: Deploy to Vercel

1. Deploy to **production**, with `TN_API_BASE_URL` set to the dev backend and the dev `L2E_API_KEY`.
2. Use only the **production domain** (`https://<project>.vercel.app`), never per-deploy preview URLs.
3. Under **Deployment Protection**, make sure the production domain doesn't require a Vercel login. The TN backend can't reach `serviceValidate` otherwise.
4. Keep `serviceValidate` light (one Redis call and an HMAC), so a cold start stays well under 5 seconds.
5. Open `https://<project>.vercel.app/jobs` in a private window. It must load without a Vercel login and list the dev job.
6. Send the URL to the TN backend team, who set it as `SSO_BASE_URL`.
7. Once the TN backend team has set the SSO env vars and the TN frontend team has deployed, test the full flow together from `https://<project>.vercel.app/jobs`.

## Step 8: When real L2E is ready

The TN backend team switches to L2E's URL and gives L2E a new API key. After a final test from L2E's own jobs page, delete the Vercel project.
