// server/llm/openAIClient.js
// Minimal OpenAI client wrapper using the Chat Completions API.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function ensureFetch() {
  if (typeof fetch !== 'function') {
    throw new Error(
      'Global fetch is not available. Please ensure you are running on Node 18+ or polyfill fetch.'
    );
  }
  return fetch;
}

/**
 * @typedef {Object} OpenAIArgs
 * @property {string} [model]
 * @property {string} system
 * @property {string} user
 * @property {number} [max_tokens]
 * @property {number} [temperature]
 */

/**
 * Call OpenAI chat completions with a system + user payload and return raw text.
 * @param {OpenAIArgs} params
 * @returns {Promise<string>}
 */
export async function callOpenAI({
  model = 'gpt-4o-mini',
  system,
  user,
  max_tokens = 512,
  temperature = 0,
  timeout = 3000, // 3-second timeout for fast response
}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY');

  const fetchFn = ensureFetch();

  // Create an abort controller for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetchFn(OPENAI_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens,
        temperature,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API ${res.status}: ${text}`);
    }

    const data = await res.json();
    const text =
      data.choices?.[0]?.message?.content?.trim() ??
      (data.choices?.[0]?.message?.content ?? '');

    if (!text) {
      throw new Error('OpenAI API returned an empty response');
    }

    return text;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error(`OpenAI API request timeout after ${timeout}ms`);
    }

    throw error;
  }
}
