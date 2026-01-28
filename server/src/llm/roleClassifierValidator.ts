import { logger } from '@infrastructure/Logger';
import { VALID_CATEGORIES, TAXONOMY } from '#shared/taxonomy.js';
import type { InputSpan, LabeledSpan } from './types.js';

// Use taxonomy validation set directly
export const ROLE_SET = VALID_CATEGORIES;

/**
 * Normalize and validate a role against the taxonomy
 */
export function normalizeRole(role: string | null | undefined): string {
  const log = logger.child({ service: 'roleClassifier' });

  if (!role || typeof role !== 'string') {
    log.warn('Invalid role type, defaulting to subject', {
      operation: 'normalizeRole',
      role: role || null,
    });
    return TAXONOMY.SUBJECT.id;
  }

  // Check if it's already a valid taxonomy ID
  if (ROLE_SET.has(role)) {
    return role;
  }

  // Log warning for unknown roles
  log.warn('Unknown role, defaulting to subject', {
    operation: 'normalizeRole',
    role,
  });
  return TAXONOMY.SUBJECT.id;
}

/**
 * Validate labeled spans against source spans
 */
export function validate(source: InputSpan[], labeled: unknown[]): LabeledSpan[] {
  const srcSet = new Set(source.map((s) => `${s.text}|${s.start}|${s.end}`));

  const out: LabeledSpan[] = [];
  for (const item of labeled) {
    if (!item || typeof item !== 'object') continue;
    const itemObj = item as Record<string, unknown>;
    const { text, start, end } = itemObj;
    if (
      typeof text === 'string' &&
      typeof start === 'number' &&
      typeof end === 'number' &&
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      end > start &&
      srcSet.has(`${text}|${start}|${end}`)
    ) {
      // Normalize role to valid taxonomy ID
      const role = normalizeRole(itemObj.role as string | undefined);
      const confidence =
        typeof itemObj.confidence === 'number'
          ? Math.max(0, Math.min(1, itemObj.confidence))
          : 0.7;

      const words = (text.match(/\b[\p{L}\p{N}']+\b/gu) || []).length;
      // Skip very long spans unless they're technical specs
      if (role !== TAXONOMY.TECHNICAL.id && words > 6) continue;

      out.push({
        text,
        start,
        end,
        role,
        confidence,
      });
    }
  }

  out.sort((a, b) => a.start - b.start || b.end - a.end);

  const final: LabeledSpan[] = [];
  for (const span of out) {
    const last = final[final.length - 1];
    if (last && span.start < last.end) {
      // Prefer technical specs and higher confidence
      const score = (candidate: LabeledSpan) =>
        (candidate.role === TAXONOMY.TECHNICAL.id ? 2 : 0) + (candidate.confidence || 0);
      if (score(span) > score(last)) {
        final[final.length - 1] = span;
      }
    } else {
      final.push(span);
    }
  }

  return final;
}
