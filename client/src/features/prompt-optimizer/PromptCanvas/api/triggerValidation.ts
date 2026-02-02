import { assetApi } from '@features/assets/api/assetApi';
import { logger } from '@/services/LoggingService';

const log = logger.child('TriggerValidation');

export async function validatePromptTriggers(text: string): Promise<void> {
  if (!text.trim() || !text.includes('@')) {
    return;
  }
  try {
    const validation = await assetApi.validate(text);
    if (!validation.isValid) {
      log.warn('Missing triggers', {
        missingTriggers: validation.missingTriggers,
      });
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    log.error('Trigger validation failed', errorObj);
  }
}
