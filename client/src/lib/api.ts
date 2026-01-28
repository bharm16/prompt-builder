import { RoleClassifyResponseSchema } from '../schemas/roleClassify';
import type { ClientSpan, LabeledSpan } from '../types/roleClassify';
import { buildFirebaseAuthHeaders } from '../services/http/firebaseAuth';

export { ClientSpan, LabeledSpan };

export async function fetchRoles(spans: ClientSpan[], templateVersion: string = 'v1'): Promise<LabeledSpan[]> {
  const authHeaders = await buildFirebaseAuthHeaders();
  const res = await fetch('/api/role-classify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...authHeaders,
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
