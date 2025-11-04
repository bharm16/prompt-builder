// src/lib/api.js
import { API_CONFIG } from '../config/api.config';

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

export async function fetchRoles(spans, templateVersion = 'v1') {
  const res = await fetch('/api/role-classify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-API-Key': API_CONFIG.apiKey,
    },
    body: JSON.stringify({ spans, templateVersion }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data = await res.json();
  return (data.spans ?? []);
}
