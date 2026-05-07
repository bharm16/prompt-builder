/**
 * Shared response builders for E2E tests.
 *
 * These helpers construct the route-fulfill payloads that Playwright's
 * `page.route()` expects, eliminating duplication across spec files.
 */

export const jsonResponse = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

/** Minimal 1x1 transparent PNG for upload tests. */
export const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+Q5dbWQAAAABJRU5ErkJggg==",
  "base64",
);
