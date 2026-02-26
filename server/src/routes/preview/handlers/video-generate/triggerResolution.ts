import { GENERATION_ERROR_CODES } from '@routes/generationErrorCodes';
import { TRIGGER_REGEX } from './constants';
import type {
  TriggerResolutionArgs,
  TriggerResolutionSuccess,
  VideoErrorResult,
} from './types';

export const extractPromptTriggers = (prompt: string): string[] =>
  Array.from(prompt.matchAll(TRIGGER_REGEX))
    .map((match) => match[1]?.toLowerCase().trim())
    .filter((trigger): trigger is string => Boolean(trigger));

export const resolvePromptTriggers = async (
  args: TriggerResolutionArgs
): Promise<{ ok: true; value: TriggerResolutionSuccess } | { ok: false; error: VideoErrorResult }> => {
  const {
    cleanedPrompt,
    hasPromptTriggers,
    uniquePromptTriggerCount,
    userId,
    requestId,
    characterAssetId,
    assetService,
    log,
  } = args;

  let nextPrompt = cleanedPrompt;
  let nextCharacterAssetId = characterAssetId;
  let resolvedAssetCount = 0;
  let resolvedCharacterCount = 0;
  let promptExpandedFromTrigger = false;

  if (hasPromptTriggers) {
    if (!assetService) {
      log.warn('Asset service unavailable for video trigger resolution', {
        requestId,
        userId,
        uniquePromptTriggerCount,
      });
    } else {
      try {
        const resolvedPrompt = await assetService.resolvePrompt(userId, nextPrompt);
        const expandedPrompt = resolvedPrompt.expandedText.trim();
        resolvedAssetCount = resolvedPrompt.assets.length;
        resolvedCharacterCount = resolvedPrompt.characters.length;

        if (expandedPrompt.length > 0 && expandedPrompt !== nextPrompt) {
          nextPrompt = expandedPrompt;
          promptExpandedFromTrigger = true;
        }

        if (!nextCharacterAssetId) {
          nextCharacterAssetId = resolvedPrompt.characters[0]?.id;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error(
          'Video prompt trigger resolution failed',
          error instanceof Error ? error : new Error(errorMessage),
          {
            requestId,
            userId,
            uniquePromptTriggerCount,
          }
        );
        return {
          ok: false,
          error: {
            status: 500,
            payload: {
              error: 'Prompt resolution failed',
              code: GENERATION_ERROR_CODES.GENERATION_FAILED,
              details: errorMessage,
            },
          },
        };
      }
    }
  }

  return {
    ok: true,
    value: {
      cleanedPrompt: nextPrompt,
      ...(nextCharacterAssetId ? { characterAssetId: nextCharacterAssetId } : {}),
      resolvedAssetCount,
      resolvedCharacterCount,
      promptExpandedFromTrigger,
    },
  };
};
