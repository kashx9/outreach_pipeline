import { config } from '../config.js';

/**
 * Build a personalized outreach email.
 * Uses real merge fields: first name, company, role, and seed context.
 *
 * @param {import('../types.js').Contact} contact
 * @param {{ seedDomain: string }} ctx
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildEmail(contact, ctx) {
  const first = contact.firstName || contact.fullName?.split(' ')[0] || 'there';
  const company = contact.companyName || contact.companyDomain;
  const seedName = ctx.seedDomain.replace(/\.(com|io|co|net|org).*/, '');

  // Title-aware opening line
  const roleHook = contact.title
    ? `As ${contact.title} at ${company}, you're probably the right person to flag this to.`
    : `Given what ${company} is building, I think you're the right person to reach out to.`;

  const subject = `${company} + ${seedName} — quick idea`;

  const lines = [
    `Hi ${first},`,
    '',
    `I was looking at companies similar to ${seedName} and ${company} kept coming up.`,
    '',
    roleHook,
    '',
    `We help companies like yours cut prospecting time by 80% with an automated outreach pipeline — the same kind ${seedName}-scale teams use to fill their pipeline without manual work. Takes about a day to set up.`,
    '',
    `Would a 15-minute call this week make sense? Happy to show you exactly how it works for a ${contact.companyDomain?.split('.')[0] || company}-sized team.`,
    '',
    `Best,`,
    config.sender.name,
  ];

  const text = lines.join('\n');
  const html = lines
    .map((l) => (l === '' ? '<br>' : `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`))
    .join('\n');

  return { subject, html, text };
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
