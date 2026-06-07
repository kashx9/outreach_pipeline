import { config } from '../config.js';
import { request } from '../lib/http.js';
import { prospeoFixture } from './_fixtures.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Seniority values from https://prospeo.io/api-docs/enum/seniorities
const SENIORITY_FILTER = ['Founder/Owner', 'C-Suite'];

/**
 * Stage 2 — find decision-makers for a company via Prospeo /search-person.
 *
 * Auth: header X-KEY
 * Endpoint: POST /search-person
 * Pagination: 25 per page; stops when enough prospects gathered or pages exhausted.
 * Note: response has NO email fields — those come from Eazyreach in stage 3.
 *
 * @param {import('../types.js').Company} company
 * @param {{ mock?: boolean, maxPerCompany?: number }} [opts]
 * @returns {Promise<import('../types.js').Prospect[]>}
 */
export async function findDecisionMakers(company, { mock = false, maxPerCompany = 3 } = {}) {
  if (mock) return prospeoFixture(company).slice(0, maxPerCompany);

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
      const linkedinUrl = p.linkedin_url;
      if (!linkedinUrl) continue;

      prospects.push({
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

  return prospects;
}
