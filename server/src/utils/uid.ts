import { randomUUID } from "node:crypto";

/**
 * Generate a prefixed unique ID using cryptographically secure randomness.
 *
 * Replaces the pattern `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
 * which used non-cryptographic Math.random() for ID generation.
 *
 * Format: `{prefix}_{timestamp}_{8-char-hex}`
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}
