export interface RuntimeFlags {
  promptOutputOnly: boolean;
  enableConvergence: boolean;
  videoWorkerDisabled: boolean;
  allowUnhealthyGemini: boolean;
}

function isTrue(value: string | undefined): boolean {
  return value === 'true';
}

export function getRuntimeFlags(env: NodeJS.ProcessEnv = process.env): RuntimeFlags {
  return {
    promptOutputOnly: isTrue(env.PROMPT_OUTPUT_ONLY),
    enableConvergence: env.ENABLE_CONVERGENCE !== 'false',
    videoWorkerDisabled: isTrue(env.VIDEO_JOB_WORKER_DISABLED),
    allowUnhealthyGemini: isTrue(env.ALLOW_UNHEALTHY_GEMINI) || isTrue(env.GEMINI_ALLOW_UNHEALTHY),
  };
}
