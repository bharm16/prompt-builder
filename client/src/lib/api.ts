import { API_CONFIG } from '../config/api.config';
import { RoleClassifyResponseSchema } from '../schemas/roleClassify';
import type { ClientSpan, LabeledSpan } from '../types/roleClassify';

export { ClientSpan, LabeledSpan };

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

