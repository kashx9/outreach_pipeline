import { config } from './config.js';
import { log } from './lib/logger.js';
import { mapLimit } from './lib/concurrency.js';
import { dedupeBy } from './lib/dedupe.js';
import { renderSummary, confirmSend } from './lib/checkpoint.js';
import * as ocean from './stages/ocean.js';
import * as prospeo from './stages/prospeo.js';
// import * as eazyreach from './stages/eazyreach.js';
import * as brevo from './stages/brevo.js';

/**
 * Chain all four stages: the output of each is the input to the next.
 *
 * @param {string} seedDomain
 * @param {{ mock?: boolean, dryRun?: boolean, autoYes?: boolean }} [options]
 */
export async function runPipeline(seedDomain, options = {}) {
  const { mock = false, dryRun = false, autoYes = false } = options;
  const { maxCompanies, maxContactsPerCompany, concurrency } = config.limits;

  // --- Stage 1: seed domain -> lookalike companies ---
  const companies = await ocean.findLookalikes(seedDomain, { mock, limit: maxCompanies });
  if (!companies.length) return log.warn('No lookalike companies found. Stopping.');

  // --- Stage 2: companies -> decision-makers + verified emails (Prospeo) ---
  log.stage(2, 'Prospeo — find decision-makers & resolve emails');
  const prospectResults = await mapLimit(companies, concurrency, (c) =>
    prospeo.findDecisionMakers(c, { mock, maxPerCompany: maxContactsPerCompany })
  );
  let contacts = [];
  for (const r of prospectResults) {
    if (r.error) { log.fail(`${r.item.domain}: ${r.error.message}`); continue; }
    log.ok(`${r.item.domain}: ${r.value.length} contact(s) with email`);
    contacts.push(...r.value);
  }
  contacts = dedupeBy(contacts, (c) => c.email);
  if (!contacts.length) return log.warn('No contacts with verified emails found. Stopping.');

  // --- Stage 3: LinkedIn URLs -> verified emails (Eazyreach) ---
  // Commented out — Eazyreach API keys unavailable; emails now resolved in Stage 2 via Prospeo /enrich-person.
  // log.stage(3, 'Eazyreach — resolve work emails');
  // const contactResults = await mapLimit(prospects, concurrency, (p) =>
  //   eazyreach.resolveEmail(p, { mock })
  // );
  // let contacts = [];
  // for (const r of contactResults) {
  //   if (r.error) { log.fail(`${r.item.fullName}: ${r.error.message}`); continue; }
  //   if (!r.value) { log.warn(`${r.item.fullName}: no email found, skipping`); continue; }
  //   log.ok(`${r.value.fullName} → ${r.value.email}`);
  //   contacts.push(r.value);
  // }
  // contacts = dedupeBy(contacts, (c) => c.email);
  // if (!contacts.length) return log.warn('No verified emails resolved. Stopping.');

  // --- Safety checkpoint before any send fires ---
  log.stage(4, 'Brevo — send outreach');
  renderSummary(contacts);
  if (dryRun) return log.done('Dry run complete — no emails sent.');
  if (!autoYes) {
    const ok = await confirmSend();
    if (!ok) return log.warn('Aborted by user — no emails sent.');
  }

  // --- Stage 4: send ---
  const sendResults = await mapLimit(contacts, concurrency, (c) =>
    brevo.sendEmail(c, { mock, seedDomain })
  );
  let sent = 0, failed = 0;
  for (const r of sendResults) {
    const res = r.value || { status: 'failed', error: r.error?.message, contact: r.item };
    if (res.status === 'sent') { sent++; log.ok(`Sent → ${res.contact.email}`); }
    else { failed++; log.fail(`Failed → ${res.contact.email}: ${res.error}`); }
  }
  log.done(`Pipeline complete: ${sent} sent, ${failed} failed.`);
}
