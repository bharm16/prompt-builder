/**
 * URL validation utility to prevent SSRF attacks.
 * Validates that URLs use safe schemes and don't target internal/private resources.
 */

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254', // AWS metadata
  '169.254.170.2',   // ECS metadata
  'metadata.google.internal', // GCP metadata
  '[::1]',
]);

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
];

export function isUrlSafe(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    if (!ALLOWED_SCHEMES.has(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname)) {
      return false;
    }

    if (PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function assertUrlSafe(urlString: string, fieldName: string): void {
  if (!isUrlSafe(urlString)) {
    throw new Error(`Invalid URL for ${fieldName}: URL must use https and target a public host`);
  }
}
