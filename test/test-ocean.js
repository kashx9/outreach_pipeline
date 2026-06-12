import 'dotenv/config';

const BASE_URL = 'https://api.ocean.io';
const TOKEN = process.env.OCEAN_API_TOKEN;

const body = {
  size: 3,
  companiesFilters: {
    lookalikeDomains: ['stripe.com'],
    excludeDomains: ['stripe.com'],
    companySizes: ['11-50', '51-200', '201-500'],
  },
};

console.log('Seed domain: stripe.com');
console.log('Request:', JSON.stringify(body, null, 2));

const res = await fetch(`${BASE_URL}/v3/search/companies`, {
  method: 'POST',
  headers: {
    'X-Api-Token': TOKEN,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

const data = await res.json();

 const raw = Array.isArray(data?.companies) ? data.companies : [];

const companies = raw
    .map((entry) => {
      const c = entry.company ?? entry;
      return {
        domain: c.domain,
        name: c.name,
        similarityScore: entry.relevanceScore ?? entry.score,
        size: c.companySize ?? c.size,
        country: c.primaryCountry,
      };
    })
    .filter((c) => c.domain);

console.log(`Status: ${res.status}`);
console.log('Response:', JSON.stringify(companies, null, 2));
