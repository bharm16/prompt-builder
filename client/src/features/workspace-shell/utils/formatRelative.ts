/**
 * Pure relative-time formatter ("just now" / "5m ago" / "2h ago" / "3d ago").
 *
 * Pure: takes both `epoch` and `now` as inputs so the caller owns the clock.
 * This makes the function unit-testable without monkey-patching `Date.now()`
 * and lets components be storybook-friendly with stable timestamps.
 */
export function formatRelative(epoch: number, now: number): string {
  const delta = now - epoch;
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
