// Fixture data lets the full pipeline run end-to-end with --mock, before any
// real API keys arrive. Build against these shapes, then swap in real calls.

/** @returns {import('../types.js').Company[]} */
export function oceanFixture(_seedDomain) {
  return [
    { domain: 'acmehq.com', name: 'Acme HQ', similarityScore: 0.94, size: '51-200', country: 'us' },
    { domain: 'globex.io', name: 'Globex', similarityScore: 0.91, size: '11-50', country: 'in' },
    { domain: 'initech.dev', name: 'Initech', similarityScore: 0.88, size: '201-500', country: 'us' },
  ];
}

/** @returns {import('../types.js').Prospect[]} */
export function prospeoFixture(company) {
  return [
    {
      fullName: 'Priya Nair', firstName: 'Priya', lastName: 'Nair', title: 'CTO',
      linkedinUrl: `https://linkedin.com/in/priya-${company.domain}`,
      companyDomain: company.domain, companyName: company.name,
    },
    {
      fullName: 'Sam Carter', firstName: 'Sam', lastName: 'Carter', title: 'VP Engineering',
      linkedinUrl: `https://linkedin.com/in/sam-${company.domain}`,
      companyDomain: company.domain, companyName: company.name,
    },
  ];
}

/** @returns {import('../types.js').Contact} */
export function eazyreachFixture(prospect) {
  const handle = (prospect.firstName || 'contact').toLowerCase();
  return { ...prospect, email: `${handle}@${prospect.companyDomain}`, emailVerified: true };
}
