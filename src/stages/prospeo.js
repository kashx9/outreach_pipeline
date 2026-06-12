import { config } from '../config.js';
import { request } from '../lib/http.js';
import { prospeoFixture } from './_fixtures.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Seniority values from https://prospeo.io/api-docs/enum/seniorities
const SENIORITY_FILTER = ['Founder/Owner', 'C-Suite'];

/**
 * Stage 2 — find decision-makers and resolve their emails entirely within Prospeo.
 * Chains /search-person (discover people + person_id) → /enrich-person (reveal email).
 *
 * @param {import('../types.js').Company} company
 * @param {{ mock?: boolean, maxPerCompany?: number }} [opts]
 * @returns {Promise<import('../types.js').Contact[]>}
 */
export async function findDecisionMakers(company, { mock = false, maxPerCompany = 3 } = {}) {
  if (mock) {
    return prospeoFixture(company).slice(0, maxPerCompany).map((p) => ({
      ...p,
      email: `${(p.firstName || 'contact').toLowerCase()}@${company.domain}`,
      emailVerified: true,
    }));
  }

  // 1.2s gap between companies keeps us well under Prospeo's per-minute limit.
  await sleep(1200);

  const prospects = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && prospects.length < maxPerCompany) {
    const data = await request(
      `${config.prospeo.baseUrl}/search-person`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KEY': config.prospeo.key,
        },
        body: JSON.stringify({
          page,
          filters: {
            company: { websites: { include: [company.domain] } },
            person_seniority: { include: SENIORITY_FILTER },
          },
        }),
      }
    );

    if (data?.error) {
      const code = data.error_code;
      if (code === 'NO_RESULTS') break;
      throw new Error(`Prospeo error ${code || ''}: ${data.message || 'unknown'}`);
    }

    const people = Array.isArray(data?.results) ? data.results : [];
    for (const entry of people) {
      if (prospects.length >= maxPerCompany) break;
      const p = entry.person ?? entry;
      const personId = entry.person_id ?? p.person_id;
      const linkedinUrl = p.linkedin_url;
      if (!personId && !linkedinUrl) continue;

      prospects.push({
        personId,
        fullName: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
        firstName: p.first_name || undefined,
        lastName: p.last_name || undefined,
        title: p.current_job_title || undefined,
        linkedinUrl,
        companyDomain: company.domain,
        companyName: company.name || entry.company?.name,
      });
    }

    totalPages = data?.pagination?.total_page ?? 1;
    page++;
  }

  
  const contacts = [];
  for (const { personId, ...prospect } of prospects) {
    const email = await enrichEmail(personId, prospect.linkedinUrl);
    if (!email) continue;
    contacts.push({ ...prospect, email, emailVerified: true });
  }

  return contacts;
}

async function enrichEmail(personId, linkedinUrl) {
  await sleep(500);
  const identifier = personId ? { person_id: personId } : { linkedin_url: linkedinUrl };

  let data;
  try {
    data = await request(
      `${config.prospeo.baseUrl}/enrich-person`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KEY': config.prospeo.key,
        },
        body: JSON.stringify({ data: identifier, only_verified_email: true }),
      }
    );
  } catch {
    return null;
  }

  if (data?.error) return null;
  const emailObj = data?.person?.email;
  if (!emailObj?.revealed || !emailObj?.email) return null;
  return emailObj.email;
}
