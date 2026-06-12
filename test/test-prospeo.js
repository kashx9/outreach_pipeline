import 'dotenv/config';

const BASE_URL = 'https://api.prospeo.io';
const API_KEY = process.env.PROSPEO_API_KEY;

// Step 1: search to get person_id
const searchRes = await fetch(`${BASE_URL}/search-person`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-KEY': API_KEY },
  body: JSON.stringify({
    page: 1,
    filters: {
      company: { websites: { include: ['stripe.com'] } },
      person_seniority: { include: ['Founder/Owner', 'C-Suite'] },
    },
  }),
});
const searchData = await searchRes.json();
const first = searchData?.results?.[0];
const personId = first?.person_id ?? first?.person?.person_id;
const fullName = first?.person?.full_name ?? first?.full_name;

console.log('Step 1 — search status:', searchRes.status);
console.log(`Enriching: ${fullName}  (person_id: ${personId})\n`);

// Step 2: enrich using person_id to reveal actual email
const enrichRes = await fetch(`${BASE_URL}/enrich-person`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-KEY': API_KEY },
  body: JSON.stringify({
    data: { person_id: personId },
    only_verified_email: true,
  }),
});

console.log('Step 2 — enrich status:', enrichRes.status);
console.log('Response:', JSON.stringify(await enrichRes.json(), null, 2));
