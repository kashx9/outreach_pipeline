import 'dotenv/config';

const BASE_URL = 'https://api.superflow.run/b2b';
const CLIENT_ID = process.env.EAZYREACH_CLIENT_ID;
const CLIENT_SECRET = process.env.EAZYREACH_CLIENT_SECRET;

// --- Step 1: get auth token ---
console.log('=== Eazyreach — Step 1: POST /createAuthToken/ ===');
const authRes = await fetch(`${BASE_URL}/createAuthToken/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
});

const authData = await authRes.json();
console.log(`Status: ${authRes.status}`);
console.log('Response:', JSON.stringify(authData, null, 2));

const token = authData?.authToken ?? authData?.auth_token;
if (!token) {
  console.error('No auth token received — stopping.');
  process.exit(1);
}

// --- Step 2: resolve LinkedIn URL to email ---
const linkedinUrl = 'www.linkedin.com/in/patrick-collison';

console.log('\n=== Eazyreach — Step 2: POST /linkedin-emails ===');
console.log('LinkedIn URL:', linkedinUrl);
console.log('---');

const emailRes = await fetch(`${BASE_URL}/linkedin-emails`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ linkedinUrl }),
});

const emailData = await emailRes.json();
console.log(`Status: ${emailRes.status}`);
console.log('Response:', JSON.stringify(emailData, null, 2));
