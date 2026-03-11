import type { CompilationIntentLockState, CompilationState, ShotPlan } from '../types';

interface IntentLockLike {
  enforceIntentLock(params: {
    originalPrompt: string;
    optimizedPrompt: string;
    shotPlan: ShotPlan | null;
  }): {
    prompt: string;
    passed: boolean;
    repaired: boolean;
    required: { subject: string | null; action: string | null };
  };
}

export interface IntentLockPolicyResult {
  prompt: string;
  legacyMetadata: {
    intentLockPassed: boolean;
    intentLockRepaired: boolean;
    requiredIntent: { subject: string | null; action: string | null };
  };
  compilationIntentLock?: CompilationIntentLockState;
}

export function applyIntentLockPolicy(params: {
  intentLock: IntentLockLike;
  originalPrompt: string;
  optimizedPrompt: string;
  shotPlan: ShotPlan | null;
  compilation?: CompilationState | null;
}): IntentLockPolicyResult {
  const validateOnly = params.compilation?.status === 'compiled';
  const originalCompiledPrompt = params.optimizedPrompt.trim();

  try {
    const result = params.intentLock.enforceIntentLock({
      originalPrompt: params.originalPrompt,
      optimizedPrompt: params.optimizedPrompt,
      shotPlan: params.shotPlan,
    });

    if (validateOnly && result.repaired) {
      const warning =
        'Intent lock requested a repair, but repair was skipped to preserve model-specific output structure.';
      return {
        prompt: originalCompiledPrompt,
        legacyMetadata: {
          intentLockPassed: false,
          intentLockRepaired: false,
          requiredIntent: result.required,
        },
        compilationIntentLock: {
          passed: false,
          repaired: false,
          skippedRepair: true,
          warning,
          required: result.required,
        },
      };
    }

    return {
      prompt: result.prompt,
      legacyMetadata: {
        intentLockPassed: result.passed,
        intentLockRepaired: result.repaired,
        requiredIntent: result.required,
      },
      ...(params.compilation
        ? {
            compilationIntentLock: {
              passed: result.passed,
              repaired: result.repaired,
              skippedRepair: false,
              required: result.required,
            },
          }
        : {}),
    };
  } catch (error) {
    if (!validateOnly) {
      throw error;
    }

    const warning = error instanceof Error ? error.message : String(error);
    return {
      prompt: originalCompiledPrompt,
      legacyMetadata: {
        intentLockPassed: false,
        intentLockRepaired: false,
        requiredIntent: { subject: null, action: null },
      },
      compilationIntentLock: {
        passed: false,
        repaired: false,
        skippedRepair: true,
        warning,
        required: { subject: null, action: null },
      },
    };
  }
}
