# Automated Cold Outreach Pipeline

A command-line tool that takes one company domain as input and runs a four-stage pipeline to find similar companies, identify decision-makers, resolve their work emails, and send personalized outreach -- fully automated except for one confirmation checkpoint before any email is sent.

---

## How It Works

You provide a seed domain (for example, stripe.com). The pipeline runs four stages in sequence, with each stage's output feeding directly into the next:

Stage 1 -- Ocean.io finds companies that resemble the seed domain based on industry, size, and technology signals.

Stage 2 -- Prospeo searches each discovered company for founders and C-suite executives, returning their names, titles, and LinkedIn profile URLs.

Stage 3 -- Eazyreach resolves each LinkedIn URL into a verified work email address.

Stage 4 -- Brevo sends a personalized outreach email to each contact.

Before Stage 4 fires, the pipeline prints a summary table of every recipient and asks for explicit confirmation. This is the only manual step in the entire run.

---

## Account Setup

Set these up in this order. The order matters because Ocean.io requires a company email to sign up, which means you need a custom domain first.

1. Buy a domain (Namecheap is cheap; GitHub Student Pack offers a free one). Vocallabs reimburses this.
2. Create a company email on that domain, for example you@yourdomain.com.
3. Sign up for Ocean.io using that company email. Free email providers like Gmail are rejected.
4. Sign up for Prospeo, Eazyreach, and Brevo separately.
5. In Eazyreach, copy the Client ID and Client Secret from your dashboard and send them to Vocallabs to have your wallet topped up. Do not purchase credits yourself.
6. In Brevo, verify your sender domain by adding the SPF and DKIM records Brevo provides to your domain's DNS settings. Emails sent from an unverified domain will land in spam or be rejected.

---

## Installation

```
npm install
cp .env.example .env
```

Open .env and fill in every value.

```
OCEAN_API_TOKEN=          your Ocean.io API token (Settings > API Tokens)
PROSPEO_API_KEY=          your Prospeo API key (app.prospeo.io/api)
EAZYREACH_CLIENT_ID=      from Eazyreach dashboard
EAZYREACH_CLIENT_SECRET=  from Eazyreach dashboard
BREVO_API_KEY=            your Brevo API key
SENDER_NAME=              the name that appears in the From field
SENDER_EMAIL=             must be on your Brevo-verified domain
MAX_COMPANIES=10          how many lookalike companies to find
MAX_CONTACTS_PER_COMPANY=3   max decision-makers per company
REQUEST_CONCURRENCY=1     parallel requests (keep at 1 to avoid rate limits on free plans)
```

---

## Usage

Start here to verify everything works before spending any credits:

```
node src/index.js stripe.com --mock --dry-run
```

This runs the full pipeline on fixture data with zero API calls. You will see all four stages fire and a summary table printed, but nothing is sent and no keys are needed.

Once you have real API keys, test with live data but stop before sending:

```
node src/index.js stripe.com --dry-run
```

Full run with confirmation prompt before sending:

```
node src/index.js stripe.com
```

Full run with no prompt, for automation or scripts:

```
node src/index.js stripe.com --yes
```

---

## Flags

```
--mock      Run on fixture data. No API calls, no keys required.
--dry-run   Run Stages 1-3 and print the summary, then stop. No emails sent.
--yes       Skip the confirmation prompt and send immediately.
--help      Print usage information.
```

---

## Project Structure

```
src/
  index.js          Entry point. Parses arguments, validates keys, starts the pipeline.
  config.js         Loads .env, exposes all settings, fails fast on missing keys.
  pipeline.js       Orchestrator. Chains the four stages and handles the checkpoint.
  types.js          JSDoc type definitions shared across all files.

  stages/
    ocean.js        Stage 1 -- POST /v3/search/companies (Ocean.io)
    prospeo.js      Stage 2 -- POST /search-person (Prospeo)
    eazyreach.js    Stage 3 -- POST /linkedin-emails (Eazyreach via superflow.run)
    brevo.js        Stage 4 -- POST /v3/smtp/email (Brevo)
    _fixtures.js    Fake data used by --mock mode

  email/
    template.js     Builds the personalized subject and body for each contact

  lib/
    http.js         Fetch wrapper with automatic retry and exponential backoff
    concurrency.js  Runs async tasks with a bounded concurrency limit
    dedupe.js       Removes duplicate companies, people, and emails
    checkpoint.js   Prints the pre-send summary table and handles confirmation
    logger.js       Consistent console output across all stages
```

---

## API Details

### Ocean.io (Stage 1)

- Endpoint: POST /v3/search/companies
- Auth: X-Api-Token header
- Filters applied: lookalikeDomains, excludeDomains (seed excluded from results), companySizes (11-50, 51-200, 201-500)
- Response shape: each result is wrapped as { company: { domain, name, companySize, primaryCountry }, relevanceScore }

### Prospeo (Stage 2)

- Endpoint: POST /search-person
- Auth: X-KEY header
- Filters applied: company.websites.include (the company domain), person_seniority.include (Founder/Owner, C-Suite)
- Returns person objects with linkedin_url and current_job_title. No email is returned here.
- Pagination: 25 results per page. The pipeline stops once maxContactsPerCompany is reached.
- Daily limit on free plan: 50 requests. One run of 10 companies uses 10 requests.

### Eazyreach (Stage 3)

- Base URL: https://api.superflow.run/b2b (not eazyreach.app)
- Auth: Two-step. POST /createAuthToken/ with clientId and clientSecret returns a Bearer token. That token is cached for the duration of the run and refreshed automatically if a 401 is received.
- Endpoint: POST /linkedin-emails with { linkedinUrl: "www.linkedin.com/in/handle" }
- Response: { emails: [ { email, verification: "verified" | "probable", source } ] }
- The pipeline prefers verified emails. If no verified email exists, it falls back to probable. If neither exists, the contact is skipped without crashing.
- A 402 (insufficient balance) or 404 (profile not found) causes that contact to be skipped silently.

### Brevo (Stage 4)

- Endpoint: POST https://api.brevo.com/v3/smtp/email
- Auth: api-key header
- The sender email must be on a domain verified in Brevo with SPF and DKIM records.

---

## Resilience Behavior

The pipeline is designed so that a failure on one item never stops the rest of the run.

- If a company returns no decision-makers, it is logged and skipped.
- If a LinkedIn profile has no email, that contact is skipped.
- If a single email send fails, it is logged and the remaining sends continue.
- Duplicate company domains, LinkedIn URLs, and email addresses are removed before each stage.
- The HTTP wrapper retries automatically on 429 (rate limited) and 5xx (server error) responses, respecting the Retry-After header if one is present.

---

## Running the Full Pipeline

The recommended sequence for a first run with live keys:

```
node src/index.js stripe.com --mock --dry-run   verify everything is wired up
node src/index.js stripe.com --dry-run           check real data, no sends
node src/index.js stripe.com                     full run, confirm before sending
```

Keep MAX_COMPANIES and MAX_CONTACTS_PER_COMPANY small during initial testing to conserve credits.

---

## Rubric Mapping

This table maps the project requirements to where they are implemented:

| Requirement | Implementation |
|---|---|
| One domain in, all stages fire automatically | pipeline.js chains all four stages |
| Correct auth per API | Each stage module handles its own auth (Ocean header, Prospeo X-KEY, Eazyreach two-step Bearer, Brevo api-key) |
| Pagination | Ocean: size parameter; Prospeo: page loop with pagination.total_page |
| Resilient to partial failures | mapLimit in concurrency.js captures per-item errors; pipeline.js logs and continues |
| Rate limit handling | http.js retries on 429/5xx with exponential backoff and Retry-After support |
| Deduplication | dedupe.js applied after each stage on domain, linkedin_url, and email |
| Safety checkpoint | checkpoint.js prints summary table and requires explicit yes before any send |
| Dry run and mock modes | --dry-run stops before Stage 4; --mock bypasses all API calls |
| Personalized email copy | template.js uses first name, company, and title as merge fields |