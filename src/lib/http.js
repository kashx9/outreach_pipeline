export class HttpError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch wrapper: JSON in/out + retry with exponential backoff on rate limits
 * (429) and server errors (5xx). Respects a Retry-After header when present.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {{ retries?: number, baseDelay?: number }} [opts]
 */
export async function request(url, options = {}, { retries = 3, baseDelay = 500 } = {}) {
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (networkErr) {
      lastErr = networkErr; // transient network blip — retry
      if (attempt < retries) { await sleep(baseDelay * 2 ** attempt); continue; }
      throw networkErr;
    }

    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const delay = retryAfter ? retryAfter * 1000 : baseDelay * 2 ** attempt;
      lastErr = new HttpError(`Upstream ${res.status} on ${url}`, { status: res.status });
      if (attempt < retries) { await sleep(delay); continue; }
      throw lastErr;
    }

    const text = await res.text();
    const body = text ? safeJson(text) : null;
    if (!res.ok) {
      throw new HttpError(`Request failed ${res.status} on ${url}`, { status: res.status, body });
    }
    return body;
  }

  throw lastErr;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return text; }
}
