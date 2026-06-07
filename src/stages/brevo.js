import { config } from '../config.js';
import { request } from '../lib/http.js';
import { buildEmail } from '../email/template.js';

/**
 * Stage 4 — send a personalized outreach email via Brevo.
 *
 * Docs: POST https://api.brevo.com/v3/smtp/email  (auth via "api-key" header)
 *
 * Errors are caught and returned as a failed SendResult so one bad send doesn't
 * abort the rest of the batch.
 *
 * @param {import('../types.js').Contact} contact
 * @param {{ mock?: boolean, seedDomain: string }} opts
 * @returns {Promise<import('../types.js').SendResult>}
 */
export async function sendEmail(contact, { mock = false, seedDomain }) {
  const { subject, html, text } = buildEmail(contact, { seedDomain });

  if (mock) {
    return {
      contact,
      status: 'sent',
      messageId: 'mock-' + Math.random().toString(36).slice(2, 8),
    };
  }

  try {
    const data = await request(
      `${config.brevo.baseUrl}/smtp/email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
          'api-key': config.brevo.key,
        },
        body: JSON.stringify({
          sender: { name: config.sender.name, email: config.sender.email },
          to: [{ email: contact.email, name: contact.fullName }],
          subject,
          htmlContent: html,
          textContent: text,
        }),
      }
    );
    return { contact, status: 'sent', messageId: data?.messageId };
  } catch (err) {
    return { contact, status: 'failed', error: err.message };
  }
}
