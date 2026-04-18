/**
 * URL validation utility to prevent SSRF attacks.
 * Validates that URLs use safe schemes and don't target internal/private resources.
 */

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254", // AWS metadata
  "169.254.170.2", // ECS metadata
  "metadata.google.internal", // GCP metadata
  "[::1]",
]);

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
];

// Matches IPv4-mapped IPv6 hostnames (e.g. ::ffff:127.0.0.1 or the
// hex-normalized [::ffff:7f00:1] that Node's URL parser produces). The
// bracket is optional because Node returns hostnames bracketed for IPv6
// literals but the raw dotted form appears in pre-parsed inputs.
const IPV4_MAPPED_IPV6_PATTERN = /^\[?::ffff:/i;

function isIpv4Mapped(hostname: string): boolean {
  return IPV4_MAPPED_IPV6_PATTERN.test(hostname);
}

export function isUrlSafe(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    if (!ALLOWED_SCHEMES.has(url.protocol)) {
      return false;
    }

    const rawHostname = url.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(rawHostname)) {
      return false;
    }

    // Reject IPv4-mapped IPv6 entirely. Legitimate CDN/storage URLs never use
    // this notation; it only appears in SSRF bypass attempts that route mapped
    // addresses past IPv4-only hostname/pattern checks.
    if (isIpv4Mapped(rawHostname)) {
      return false;
    }

    // Node normalizes IPv6 literals as bracketed (e.g. "[fc00::1]"). Strip
    // brackets before applying private-range regex so IPv6 patterns match.
    const unbracketed = rawHostname.replace(/^\[|\]$/g, "");
    if (PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(unbracketed))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function assertUrlSafe(urlString: string, fieldName: string): void {
  if (!isUrlSafe(urlString)) {
    throw new Error(
      `Invalid URL for ${fieldName}: URL must use https and target a public host`,
    );
  }
}
