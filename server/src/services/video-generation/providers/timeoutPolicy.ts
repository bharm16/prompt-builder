const DEFAULT_PROVIDER_POLL_TIMEOUT_MS = 270_000;
const DEFAULT_WORKFLOW_TIMEOUT_MS = 300_000;

function resolvePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getProviderPollTimeoutMs(): number {
  return resolvePositiveInt(process.env.VIDEO_PROVIDER_POLL_TIMEOUT_MS, DEFAULT_PROVIDER_POLL_TIMEOUT_MS);
}

export function getWorkflowWatchdogTimeoutMs(): number {
  const configured = resolvePositiveInt(
    process.env.VIDEO_WORKFLOW_TIMEOUT_MS,
    DEFAULT_WORKFLOW_TIMEOUT_MS
  );
  return Math.max(configured, getProviderPollTimeoutMs() + 10_000);
}
