/**
 * Shared response builders for E2E tests.
 *
 * These helpers construct the route-fulfill payloads that Playwright's
 * `page.route()` expects, eliminating duplication across spec files.
 */

export const jsonResponse = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/**
 * Build a Server-Sent Events body string from an array of typed events.
 * Each entry becomes `event: <name>\ndata: <json>\n\n`.
 */
export function sseBody(events: Array<{ event: string; data: unknown }>): string {
  return (
    events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n`).join('\n') + '\n'
  );
}

/** Minimal 1x1 transparent PNG for upload tests. */
export const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+Q5dbWQAAAABJRU5ErkJggg==',
  'base64',
);
