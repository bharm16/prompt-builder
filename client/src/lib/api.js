// src/lib/api.js

/**
 * @typedef {{ text: string, start: number, end: number }} ClientSpan
 */

/**
 * @typedef {{ text: string, start: number, end: number, role: string, confidence: number }} LabeledSpan
 */

/**
 * @param {ClientSpan[]} spans
 * @param {string} [templateVersion='v1']
 * @returns {Promise<LabeledSpan[]>}
 */
const API_KEY = 'dev-key-12345';

export async function fetchRoles(spans, templateVersion = 'v1') {
  const res = await fetch('/api/role-classify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({ spans, templateVersion }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data = await res.json();
  return (data.spans ?? []);
}
