import { config } from '../config.js';
import { request, HttpError } from '../lib/http.js';
import { eazyreachFixture } from './_fixtures.js';

// Store the promise (not just the value) so concurrent calls share one HTTP request.
let _tokenPromise = null;

async function fetchToken() {
  const data = await request(
    `${config.eazyreach.baseUrl}/createAuthToken/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: config.eazyreach.clientId,
        clientSecret: config.eazyreach.clientSecret,
      }),
    }
  );
  // API returns camelCase `authToken`, not snake_case `auth_token`
  const token = data?.authToken ?? data?.auth_token;
  if (!token) throw new Error('Eazyreach: no authToken in createAuthToken response');
  return token;
}

async function getToken() {
  if (!_tokenPromise) _tokenPromise = fetchToken();
  return _tokenPromise;
}

/** Normalize any LinkedIn URL to the format Eazyreach expects: www.linkedin.com/in/<handle> */
function normalizeLinkedIn(url) {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (!match) return url.replace(/^https?:\/\//, '');
  return `www.linkedin.com/in/${match[1]}`;
}

/**
 * Stage 3 — resolve a LinkedIn profile URL into a verified work email.
 * Auth: POST /createAuthToken/ -> Bearer token cached per run, refreshed on 401.
 * Endpoint: POST /linkedin-emails
 *
 * Returns null (never throws) for 402 (no balance) or 404 (profile not found) —
 * these are skip-and-continue, not fatal errors.
 *
 * @param {import('../types.js').Prospect} prospect
 * @param {{ mock?: boolean }} [opts]
 * @returns {Promise<import('../types.js').Contact|null>}
 */
export async function resolveEmail(prospect, { mock = false } = {}) {
  if (mock) return eazyreachFixture(prospect);

  const linkedinUrl = normalizeLinkedIn(prospect.linkedinUrl);

  const doRequest = async () => {
    const token = await getToken();
    return request(
      `${config.eazyreach.baseUrl}/linkedin-emails`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ linkedinUrl }),
      }
    );
  };

  let data;
  try {
    data = await doRequest();
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) {
      _tokenPromise = null;
      try {
        data = await doRequest();
      } catch (retryErr) {
        if (retryErr instanceof HttpError && (retryErr.status === 402 || retryErr.status === 404)) {
          return null;
        }
        throw retryErr;
      }
    } else if (err instanceof HttpError && (err.status === 402 || err.status === 404)) {
      return null;
    } else {
      throw err;
    }
  }

  const emails = Array.isArray(data?.emails) ? data.emails : [];
  const verified = emails.find((e) => e.verification === 'verified');
  const best = verified || emails[0];
  if (!best?.email) return null;

  return {
    ...prospect,
    email: best.email,
    emailVerified: best.verification === 'verified',
  };
}
