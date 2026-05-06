import { createHash } from "node:crypto";

/**
 * Simple deterministic string hash for seed derivation.
 */
export const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return Math.abs(hash);
};

/**
 * SHA-256 hash as hexadecimal string. Optionally truncated to `length` chars.
 */
export function sha256Hex(data: string, length?: number): string {
  const full = createHash("sha256").update(data).digest("hex");
  return length ? full.slice(0, length) : full;
}
