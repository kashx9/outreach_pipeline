import { config } from '../config.js';
import { request } from '../lib/http.js';
import { log } from '../lib/logger.js';
import { dedupeBy } from '../lib/dedupe.js';
import { oceanFixture } from './_fixtures.js';

/**
 * Stage 1 — expand a seed domain into lookalike company domains.
 *
 * Auth: X-Api-Token header (v3). Never send both header and query param — causes "conflicting tokens" error.
 * Endpoint: POST /v3/search/companies
 * Pagination: size + from offset; searchAfter cursor for deep paging (>10k).
 *
 * @param {string} seedDomain
 * @param {{ mock?: boolean, limit?: number }} [opts]
 * @returns {Promise<import('../types.js').Company[]>}
 */
export async function findLookalikes(seedDomain, { mock = false, limit = 10 } = {}) {
  log.stage(1, 'Ocean.io — find lookalike companies');

  if (mock) {
    log.info('(mock) returning fixture companies');
    return oceanFixture(seedDomain).slice(0, limit);
  }

  const url = `${config.ocean.baseUrl}/v3/search/companies`;

  // v3 removed `from` pagination — use searchAfter instead.
  // minScore is not a valid v3 filter — removed.
  const body = {
    size: limit,
    companiesFilters: {
      lookalikeDomains: [seedDomain],
      excludeDomains: [seedDomain],
      companySizes: ['11-50', '51-200', '201-500'],
    },
  };

  const data = await request(url, {
    method: 'POST',
    headers: {
      'X-Api-Token': config.ocean.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = Array.isArray(data?.companies) ? data.companies : [];

  // v3 wraps each result: { company: { domain, name, ... }, relevanceScore }
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

  const unique = dedupeBy(companies, (c) => c.domain).slice(0, limit);
  log.ok(`${unique.length} lookalike companies found`);
  return unique;
}
