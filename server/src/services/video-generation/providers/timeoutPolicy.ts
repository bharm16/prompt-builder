const DEFAULT_PROVIDER_POLL_TIMEOUT_MS = 270_000;
const DEFAULT_WORKFLOW_TIMEOUT_MS = 300_000;

let configuredPollTimeoutMs = DEFAULT_PROVIDER_POLL_TIMEOUT_MS;
let configuredWorkflowTimeoutMs = DEFAULT_WORKFLOW_TIMEOUT_MS;

export function setTimeoutPolicyConfig(config: {
  pollTimeoutMs: number;
  workflowTimeoutMs: number;
}): void {
  configuredPollTimeoutMs = config.pollTimeoutMs;
  configuredWorkflowTimeoutMs = config.workflowTimeoutMs;
}

export function getProviderPollTimeoutMs(): number {
  return configuredPollTimeoutMs;
}

export function getWorkflowWatchdogTimeoutMs(): number {
  return Math.max(configuredWorkflowTimeoutMs, configuredPollTimeoutMs + 10_000);
}
