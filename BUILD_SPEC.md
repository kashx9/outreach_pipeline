# BUILD SPEC — Automated Cold-Outreach Pipeline

> Hand this to Claude Code. It contains the full goal, the verified API contracts, the
> architecture, what's already scaffolded, and the acceptance criteria. Build the rest
> against this spec. When an API detail here conflicts with reality, trust the live docs
> (linked per stage) and update this file.

---

## 1. Goal

Build a **single command-line program** that runs a four-stage cold-outreach pipeline. A
human supplies **one** input — a seed `company.domain` — and the system runs everything
after that with **no manual steps**, except one safety checkpoint before emails send.

```
seed domain
  -> Ocean.io      find lookalike companies        (-> company domains)
  -> Prospeo       find decision-makers            (-> people + LinkedIn URLs)
  -> Eazyreach     resolve work emails             (-> verified emails)
  -> [CHECKPOINT]  show summary, require confirm
  -> Brevo         send personalized outreach
```

Each stage's output is the next stage's input. No copy-paste, no human in the loop between
stages.

---

## 2. Stack & constraints

- **Runtime:** Node.js 18+ (ESM, `"type": "module"`). Native `fetch` available.
- **Dependencies:** keep minimal. `dotenv` for config; `@getbrevo/brevo` for stage 4
  (optional — raw REST also fine). Everything else (retry, concurrency, CLI) is hand-rolled.
- **Output:** one CLI entrypoint, runnable as `node src/index.js <domain> [flags]`.
- **No secrets in code.** All keys via `.env`.

---

## 3. Verified API contracts

### 3.1 Ocean.io — Stage 1 (lookalike companies)

- Docs: https://docs.ocean.io  ·  Base URL: `https://api.ocean.io`
- **Auth:** API token from dashboard (Settings -> API tokens). Send as header
  `x-api-token: TOKEN` **OR** query `?apiToken=TOKEN` — **never both** (returns a
  "conflicting API tokens" error).
- **Signup requires a company email** (free providers rejected) — see §7.
- **Credits** are consumed per result.

`POST /v2/search/companies`

```json
{
  "size": 10,
  "from": 0,
  "companiesFilters": {
    "lookalikeDomains": ["<seed-domain>"],
    "minScore": 0.8,
    "excludeDomains": ["<seed-domain>"],
    "companySizes": ["11-50", "51-200", "201-500"]
  }
}
```

- **Pagination:** `size` (page size) + `from` (offset), or the `searchAfter` cursor from
  responses for deep paging.
- **Returns:** ranked companies with `domain`, `name`, `size`, `primaryCountry`,
  `description`. Map to the normalized `Company` shape (§5).

### 3.2 Prospeo — Stage 2 (decision-makers)

- Docs: https://prospeo.io/api-docs  ·  Base URL: `https://api.prospeo.io`
- **Auth:** header `X-KEY: <key>` + `Content-Type: application/json`. **All endpoints are
  POST only.** Key from `app.prospeo.io/api`.
- **Every response has an `error` boolean** (`false` = ok); failures include `error_code`.

`POST /search-person`

```json
{
  "page": 1,
  "filters": {
    "company": { "websites": { "include": ["<company-domain-1>", "<company-domain-2>"] } },
    "person_seniority": { "include": ["Founder/Owner", "C-Suite"] }
  }
}
```

- **CRITICAL:** Search Person returns **no email/mobile** — only `person` (`person_id`,
  `linkedin_url`, `current_job_title`, `job_history[].seniority`) + `company`. Email comes
  from Eazyreach in stage 3. (Do not try to read an email field here.)
- **Pre-filter** on up to 500 company websites at once via `filters.company.websites.include`.
- **Pagination:** 25 per page; response has
  `pagination { current_page, per_page, total_page, total_count }`. Max 1000 pages.
- **Credits:** 1 per request returning >=1 person; identical filters+page within 30 days
  returns `"free": true`.
- **Seniority enum:** fetch exact accepted values from
  https://prospeo.io/api-docs/enum/seniorities before hardcoding them.
- **Error codes:** `INVALID_FILTERS`, `NO_RESULTS`, `INSUFFICIENT_CREDITS`,
  `INVALID_API_KEY`, `RATE_LIMITED`.
- **Email fallback (optional):** `POST /enrich-person` with a `person_id` returns
  `person.email { status, email }`. Wire this only as a backup if Eazyreach 404s a profile.

### 3.3 Eazyreach — Stage 3 (LinkedIn URL -> verified email)

- Docs: https://docs.eazyreach.app/eazyreach  ·  Base URL: `https://api.superflow.run/b2b`
  (note: **superflow.run**, not eazyreach.app)
- **Auth is two-step:**
  1. `POST /createAuthToken/` with `{ "clientId": "...", "clientSecret": "..." }`
     -> `{ status, auth_token, id }`
  2. Send `Authorization: Bearer <auth_token>` on every subsequent call.
  Cache the token for the run; refresh on 401.
- **Prepaid wallet:** each lookup debits balance. `GET /getGreenBalance` -> `{ balance }`.
  A lookup with no funds returns `402 insufficient balance`.

`POST /linkedin-emails`

```json
{ "linkedinUrl": "www.linkedin.com/in/<handle>" }
```

- **Returns:** `{ status, emails: [ { email, verification: "verified" | "probable", source } ] }`.
  Prefer `verified` over `probable`; if none, treat as "no email" (skip, don't crash).
- **Errors:** `400` invalid URL, `401` unauthorized, `402` insufficient balance,
  `404` profile not found. Treat 404/402 per-item as skip-and-continue.

### 3.4 Brevo — Stage 4 (send email)

- Docs: https://developers.brevo.com/guides/node-js
- **Preferred — official SDK** `@getbrevo/brevo` (v5):

```js
import { BrevoClient } from '@getbrevo/brevo';
const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

const result = await brevo.transactionalEmails.sendTransacEmail({
  subject, htmlContent, textContent,
  sender: { name: SENDER_NAME, email: SENDER_EMAIL },
  to: [{ email: contact.email, name: contact.fullName }],
});
// result.messageId
```

  SDK handles retries/backoff and exposes typed errors (`UnauthorizedError`,
  `TooManyRequestsError`, `BrevoError`).
- **Or raw REST:** `POST https://api.brevo.com/v3/smtp/email` with header `api-key`, same body.
- **Deliverability:** the `sender.email` must be on a domain verified in Brevo (SPF/DKIM).
  Use the same domain bought for the Ocean.io signup.

---

## 4. Architecture & file layout (already scaffolded)

```
src/
  index.js          CLI entry + arg parsing (--mock, --dry-run, --yes)   [DONE]
  config.js         env loading, defaults, required-key validation       [UPDATE: see §6]
  pipeline.js       orchestrator — chains the four stages                [DONE, minor tweaks]
  types.js          shared data shapes (JSDoc)                           [DONE]
  stages/
    ocean.js        Stage 1                                              [FINISH: real mapping]
    prospeo.js      Stage 2                                              [REWRITE: /search-person]
    eazyreach.js    Stage 3                                              [REWRITE: superflow + token]
    brevo.js        Stage 4                                              [OPTIONAL: switch to SDK]
    _fixtures.js    mock data for --mock                                 [DONE]
  email/template.js personalized copy                                    [IMPROVE copy]
  lib/
    http.js         fetch wrapper + retry/backoff (429/5xx + Retry-After)[DONE]
    concurrency.js  mapLimit — bounded parallelism, per-item errors      [DONE]
    dedupe.js       de-duplication helper                                [DONE]
    checkpoint.js   summary table + confirmation prompt                  [DONE]
```

Keep one stage = one file, each exporting a single function that takes the previous stage's
output and returns the normalized next shape.

---

## 5. Normalized data contract (flows between stages)

```
Company  { domain, name?, similarityScore?, size?, country? }
Prospect { fullName, firstName?, lastName?, title?, linkedinUrl, companyDomain, companyName? }
Contact  = Prospect & { email, emailVerified }
SendResult { contact, status: 'sent'|'failed'|'skipped', messageId?, error? }
```

A missing optional field in one stage must never break the next stage.

---

## 6. Environment variables (`.env`)

```
OCEAN_API_TOKEN=
PROSPEO_API_KEY=
EAZYREACH_CLIENT_ID=          # two-step auth — NOT a single bearer key
EAZYREACH_CLIENT_SECRET=
BREVO_API_KEY=
SENDER_NAME=
SENDER_EMAIL=                 # must be on a Brevo-verified domain
MAX_COMPANIES=10
MAX_CONTACTS_PER_COMPANY=3
REQUEST_CONCURRENCY=3
```

> Update `config.js` and `.env.example`: replace the old single `EAZYREACH_API_KEY` with
> `EAZYREACH_CLIENT_ID` + `EAZYREACH_CLIENT_SECRET`.

---

## 7. Account setup order (the gotcha — document in README)

1. Buy a cheap domain (Namecheap; or free via GitHub Student Pack). Reimbursed by Vocallabs.
2. Create a company email on that domain (`you@yourdomain`).
3. Sign up Ocean.io **with that company email** (free providers are rejected).
4. Create Prospeo, Eazyreach, Brevo accounts.
5. Eazyreach: grab `clientId`/`clientSecret`, send to Vocallabs to top up the wallet
   (credits are provided — do not purchase).
6. Verify the sender domain in Brevo (SPF/DKIM) for deliverability.

---

## 8. Functional requirements

1. **End-to-end from one input.** `node src/index.js stripe.com` runs all four stages.
2. **`--mock`** runs the full pipeline on fixture data with zero API calls / keys.
3. **`--dry-run`** runs stages 1–3 + the summary, then stops before any send.
4. **`--yes`** skips the interactive confirm (for automation); default is interactive.
5. **Safety checkpoint:** before sending, print a table of who will be emailed and require
   an explicit `yes`.
6. **Resilience:** per-item failures (no decision-makers, 404 profile, no email, a single
   failed send) are logged and skipped — they must not abort the run.
7. **Retries/backoff** on `429` and `5xx`, honoring `Retry-After`.
8. **Bounded concurrency** (default 3) on the per-company and per-person fan-out stages.
9. **Dedupe** company domains, people (by `linkedin_url`), and final emails.
10. **Personalized email** copy with real merge fields (name, company, role) — not a
    generic blast.

---

## 9. Acceptance criteria (maps to the evaluation rubric)

- [ ] Runs end to end: one domain in, all four stages fire, zero manual steps after input.
- [ ] Integrations correct: per-tool auth (Ocean token, Prospeo `X-KEY`, Eazyreach two-step
      bearer, Brevo key), pagination (Ocean `from`/`searchAfter`, Prospeo `page`), and
      error handling wired to each real API.
- [ ] Clean, modular code: one stage = one unit, normalized shapes between them.
- [ ] Resilient to messy data: missing contacts, rate limits, and partial failures don't crash.
- [ ] Good judgment: checkpoint before send, `--dry-run`, `--mock`, sensible default limits.
- [ ] Sharp email copy: personalized, something a recipient would actually open.

---

## 10. Suggested task order for the agent

1. Update `config.js` + `.env.example` for the Eazyreach two-key auth (§6).
2. Rewrite `stages/eazyreach.js`: `createAuthToken` handshake (cache token, refresh on 401),
   then `/linkedin-emails`; map to `Contact`; skip on 402/404.
3. Rewrite `stages/prospeo.js`: `/search-person` with `company.websites` + `person_seniority`
   filters; paginate; map `person` -> `Prospect`; return no email.
4. Finish `stages/ocean.js`: confirm the real response keys and finalize the `Company` mapping
   + pagination.
5. (Optional) Switch `stages/brevo.js` to the `@getbrevo/brevo` SDK.
6. Improve `email/template.js` copy.
7. Run `node src/index.js stripe.com --mock --dry-run` and confirm the full flow.
8. Run a real `--dry-run` with live keys (stops before sending, spends minimal credits) to
   validate stages 1–3.
9. Do one real end-to-end send to a test address you control.
10. Update README with setup, run commands, and the rubric mapping.

---

## 11. Out of scope / notes

- No web UI — CLI only.
- Cap `size`/pages while testing; credits are real and limited.
- Eazyreach also exposes `/linkedin-phones` and `/din-emails` (Indian MCA directors by DIN)
  — not needed for the core pipeline.
- Prospeo `/enrich-person` is the email fallback only; the primary email source is Eazyreach.
