import 'dotenv/config';

const int = (v, d) => (v ? parseInt(v, 10) : d);

export const config = {
  ocean: {
    token: process.env.OCEAN_API_TOKEN,
    baseUrl: 'https://api.ocean.io',
  },
  prospeo: {
    key: process.env.PROSPEO_API_KEY,
    baseUrl: 'https://api.prospeo.io',
  },
  eazyreach: {
    clientId: process.env.EAZYREACH_CLIENT_ID,
    clientSecret: process.env.EAZYREACH_CLIENT_SECRET,
    baseUrl: 'https://api.superflow.run/b2b',
  },
  brevo: {
    key: process.env.BREVO_API_KEY,
    baseUrl: 'https://api.brevo.com/v3',
  },
  sender: {
    name: process.env.SENDER_NAME || '',
    email: process.env.SENDER_EMAIL || '',
  },
  limits: {
    maxCompanies: int(process.env.MAX_COMPANIES, 10),
    maxContactsPerCompany: int(process.env.MAX_CONTACTS_PER_COMPANY, 3),
    concurrency: int(process.env.REQUEST_CONCURRENCY, 3),
  },
};

/** Fail fast if a real run is missing credentials. Skipped in mock mode. */
export function assertKeys({ mock }) {
  if (mock) return;
  const missing = [];
  if (!config.ocean.token) missing.push('OCEAN_API_TOKEN');
  if (!config.prospeo.key) missing.push('PROSPEO_API_KEY');
  if (!config.eazyreach.clientId) missing.push('EAZYREACH_CLIENT_ID');
  if (!config.eazyreach.clientSecret) missing.push('EAZYREACH_CLIENT_SECRET');
  if (!config.brevo.key) missing.push('BREVO_API_KEY');
  if (!config.sender.email) missing.push('SENDER_EMAIL');
  if (missing.length) {
    throw new Error(
      `Missing required env vars: ${missing.join(', ')}.`
    );
  }
}
