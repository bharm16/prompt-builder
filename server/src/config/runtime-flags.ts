export interface RuntimeFlags {
  processRole: 'api' | 'worker';
  promptOutputOnly: boolean;
  enableConvergence: boolean;
  videoWorkerDisabled: boolean;
  videoJobInlineEnabled: boolean;
  videoWorkerShutdownDrainSeconds: number;
  allowUnhealthyGemini: boolean;
  unhandledRejectionMode: 'classified' | 'strict';
}

function isTrue(value: string | undefined): boolean {
  return value === 'true';
}

function resolveProcessRole(env: NodeJS.ProcessEnv): 'api' | 'worker' {
  const configured = env.PROCESS_ROLE;
  if (configured === 'api' || configured === 'worker') {
    return configured;
  }

  return env.NODE_ENV === 'production' ? 'api' : 'worker';
}

function resolvePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveUnhandledRejectionMode(value: string | undefined): 'classified' | 'strict' {
  return value === 'strict' ? 'strict' : 'classified';
}

export function getRuntimeFlags(env: NodeJS.ProcessEnv = process.env): RuntimeFlags {
  const processRole = resolveProcessRole(env);

  return {
    processRole,
    promptOutputOnly: isTrue(env.PROMPT_OUTPUT_ONLY),
    enableConvergence: env.ENABLE_CONVERGENCE !== 'false',
    videoWorkerDisabled: processRole !== 'worker' || isTrue(env.VIDEO_JOB_WORKER_DISABLED),
    videoJobInlineEnabled: isTrue(env.VIDEO_JOB_INLINE_ENABLED),
    videoWorkerShutdownDrainSeconds: resolvePositiveInt(env.VIDEO_WORKER_SHUTDOWN_DRAIN_SECONDS, 45),
    allowUnhealthyGemini: isTrue(env.ALLOW_UNHEALTHY_GEMINI) || isTrue(env.GEMINI_ALLOW_UNHEALTHY),
    unhandledRejectionMode: resolveUnhandledRejectionMode(env.UNHANDLED_REJECTION_MODE),
  };
}
