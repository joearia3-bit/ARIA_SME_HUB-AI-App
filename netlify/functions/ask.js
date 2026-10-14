// ARIA HUB - Ask AI about an item photo.
// Uses Google Gemini (free tier) and follows TRUTHMODE rules.
// The Gemini key is read from Netlify settings, never written in this file.

const MODEL = 'gemini-3.5-flash';

const TRUTHMODE = `You are ARIA HUB's assistant for people selling items in Papua New Guinea.
Follow these TRUTHMODE rules strictly:
1. Only state what you can see in the photo or what you are sure about.
2. If you are not sure, say "I'm not sure" and explain what would help you know.
3. Never invent prices, sellers, or market facts. Mark any price as a rough estimate and suggest the user check local sellers.
4. Keep answers short, clear, and in simple English that a 10-year-old could follow.
5. Give 5 to 10 selling or do-it-yourself ideas when asked about selling options.
6. Never give advice about anything dangerous or illegal.`;

const json = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Please send the request again.' });
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'The request could not be read. Please try again.' });
  }

  const image = data.image || '';
  const question = (data.question || '').toString().slice(0, 500);

  // Expect a JPEG or PNG data URL like "data:image/jpeg;base64,...."
  const match = image.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
  if (!match) {
    return json(400, { error: 'Please choose a valid photo.' });
  }
  if (match[2].length > 4000000) {
    return json(400, { error: 'This photo is too big. Try a smaller photo.' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return json(500, { error: 'The AI service is not set up yet.' });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: TRUTHMODE }] },
          contents: [
            {
              role: 'user',
              parts: [
                { inline_data: { mime_type: match[1], data: match[2] } },
                { text: `Question from the seller: ${question || 'What is this item and what could I do with it?'}` },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 800, temperature: 0.3 },
        }),
      }
    );

    if (res.status === 429) {
      return json(429, { error: 'The free AI limit for today is used up. Please try again tomorrow.' });
    }
    if (!res.ok) {
      return json(500, { error: 'The AI could not answer right now. Please try again.' });
    }

    const result = await res.json();
    const parts = (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) || [];
    const text = parts.map((p) => p.text || '').join('').trim();

    if (!text) {
      return json(500, { error: 'The AI gave no answer. Please try a different photo.' });
    }
    return json(200, { answer: text });
  } catch (e) {
    return json(500, { error: 'The AI could not answer right now. Please try again.' });
  }
};
