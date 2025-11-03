/**
 * Groq client wrapper matching OpenAI signature for span labeling
 * Uses llama-3.1-8b-instant for <200ms response times
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function ensureFetch() {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available. Ensure Node 18+ or polyfill fetch.');
  }
  return fetch;
}

/**
 * Call Groq with OpenAI-compatible signature
 * @param {Object} params
 * @param {string} params.model - Model to use (default: llama-3.1-8b-instant)
 * @param {string} params.system - System prompt
 * @param {string} params.user - User message
 * @param {number} params.max_tokens - Max tokens (default: 800)
 * @param {number} params.temperature - Temperature (default: 0)
 * @param {number} params.timeout - Request timeout ms (default: 5000)
 * @returns {Promise<string>} Raw response text
 */
export async function callGroq({
  model = 'llama-3.1-8b-instant',
  system,
  user,
  max_tokens = 800,
  temperature = 0,
  timeout = 5000,
}) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error('Missing GROQ_API_KEY - set it in .env to use Groq for span labeling');
  }

  const fetchFn = ensureFetch();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetchFn(GROQ_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens,
        temperature,
        response_format: { type: 'json_object' }, // Force JSON mode
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq API ${res.status}: ${text}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';

    if (!text) {
      throw new Error('Groq API returned empty response');
    }

    return text;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error(`Groq API request timeout after ${timeout}ms`);
    }

    throw error;
  }
}
