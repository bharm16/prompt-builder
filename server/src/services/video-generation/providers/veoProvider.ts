import type { VideoAssetStore, StoredVideoAsset } from '../storage';
import { toNodeReadableStream } from '../storage/utils';
import { downloadVeoVideoStream } from './veo/download';
import { extractVeoVideoUri, startVeoGeneration, waitForVeoOperation } from './veo/operations';

type LogSink = {
  info: (message: string, meta?: Record<string, unknown>) => void;
};

export const DEFAULT_VEO_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const VEO_MODEL_ID = 'veo-3.1-generate-preview';

const VEO_STATUS_POLL_INTERVAL_MS = 10000;
const VEO_TASK_TIMEOUT_MS = 5 * 60 * 1000;

export async function generateVeoVideo(
  apiKey: string,
  baseUrl: string,
  prompt: string,
  assetStore: VideoAssetStore,
  log: LogSink
): Promise<StoredVideoAsset> {
  const operationName = await startVeoGeneration(baseUrl, apiKey, prompt, VEO_MODEL_ID);
  log.info('Veo generation started', { operationName, model: VEO_MODEL_ID });

  const operation = await waitForVeoOperation(baseUrl, apiKey, operationName, {
    pollIntervalMs: VEO_STATUS_POLL_INTERVAL_MS,
    timeoutMs: VEO_TASK_TIMEOUT_MS,
  });
  const videoUri = extractVeoVideoUri(operation.response);

  if (!videoUri) {
    throw new Error('Veo generation completed without a downloadable video URI.');
  }

  const { stream, contentType } = await downloadVeoVideoStream(apiKey, videoUri);
  return await assetStore.storeFromStream(toNodeReadableStream(stream), contentType);
}
