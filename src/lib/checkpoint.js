import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

/**
 * Print a table of exactly who is about to be emailed.
 * @param {import('../types.js').Contact[]} contacts
 */
export function renderSummary(contacts) {
  const headers = ['Name', 'Title', 'Company', 'Email'];
  const rows = contacts.map((c) => [
    c.fullName || '\u2014',
    c.title || '\u2014',
    c.companyName || c.companyDomain || '\u2014',
    c.email,
  ]);

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cols) => cols.map((v, i) => String(v).padEnd(widths[i])).join('  |  ');

  console.log('\n' + line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('--+--'));
  rows.forEach((r) => console.log(line(r)));
  console.log(`\n${contacts.length} email(s) ready to send.`);
}

/** Require an explicit yes before any send fires. */
export async function confirmSend() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question('\nProceed with sending? (yes/no): ');
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}
