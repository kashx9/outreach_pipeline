import 'dotenv/config';

const BASE_URL = 'https://api.brevo.com/v3';
const API_KEY = process.env.BREVO_API_KEY;
const SENDER_NAME = process.env.SENDER_NAME || 'Test Sender';
const SENDER_EMAIL = process.env.SENDER_EMAIL;

const body = {
  sender: { name: SENDER_NAME, email: SENDER_EMAIL },
  to: [{ email: SENDER_EMAIL, name: SENDER_NAME }],
  subject: '[TEST] Brevo API check',
  htmlContent: '<p>This is a test email sent directly from the Brevo API test script.</p>',
  textContent: 'This is a test email sent directly from the Brevo API test script.',
};

console.log('=== Brevo — POST /smtp/email ===');
console.log(`Sending test email to: ${SENDER_EMAIL}`);
console.log('Request:', JSON.stringify(body, null, 2));
console.log('---');

const res = await fetch(`${BASE_URL}/smtp/email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    accept: 'application/json',
    'api-key': API_KEY,
  },
  body: JSON.stringify(body),
});

const data = await res.json();
console.log(`Status: ${res.status}`);
console.log('Response:', JSON.stringify(data, null, 2));
