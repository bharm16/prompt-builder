import { API_CONFIG } from '../config/api.config';
import { z } from 'zod';

export interface ClientSpan {
  text: string;
  start: number;
  end: number;
}

export interface LabeledSpan {
  text: string;
  start: number;
  end: number;
  role: string;
  confidence: number;
}

const LabeledSpanSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  role: z.string(),
  confidence: z.number(),
});

const RoleClassifyResponseSchema = z.object({
  spans: z.array(LabeledSpanSchema).default([]),
});

export async function fetchRoles(spans: ClientSpan[], templateVersion: string = 'v1'): Promise<LabeledSpan[]> {
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
  const validated = RoleClassifyResponseSchema.parse(data);
  return validated.spans;
}

