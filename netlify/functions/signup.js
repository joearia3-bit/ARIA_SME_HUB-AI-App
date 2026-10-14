// ARIA HUB - sign-up. Saves an email and/or phone to the Supabase "accounts" table.
// Secret keys are read from Netlify settings, never written in this file.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s-]{7,20}$/;

const json = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Please send the form again.' });
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'The form could not be read. Please try again.' });
  }

  const email = (data.email || '').trim().toLowerCase();
  const phone = (data.phone || '').trim().replace(/\s+/g, ' ');

  if (!email && !phone) {
    return json(400, { error: 'Type an email or a phone number first.' });
  }
  if (email && (!EMAIL_RE.test(email) || email.length > 254)) {
    return json(400, { error: 'That email does not look right.' });
  }
  if (phone && !PHONE_RE.test(phone)) {
    return json(400, { error: 'That phone number does not look right.' });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return json(500, { error: 'The sign-up service is not set up yet.' });
  }

  try {
    const res = await fetch(`${url}/rest/v1/accounts`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        email: email || null,
        phone: phone || null,
      }),
    });

    if (res.status === 409) {
      return json(409, { error: 'This email or phone is already registered. You can continue.' });
    }
    if (!res.ok) {
      return json(500, { error: 'Sign-up did not work. Please try again.' });
    }
    return json(200, { message: 'Welcome! Your account is saved.' });
  } catch (e) {
    return json(500, { error: 'Sign-up did not work. Please try again.' });
  }
};
