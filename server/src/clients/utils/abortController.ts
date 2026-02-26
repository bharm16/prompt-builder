export interface AbortControllerResult {
  controller: AbortController;
  timeoutId: NodeJS.Timeout;
  abortedByTimeout: { value: boolean };
}

export const createAbortController = (
  timeout: number,
  externalSignal?: AbortSignal
): AbortControllerResult => {
  const controller = new AbortController();
  const abortedByTimeout = { value: false };
  const timeoutId = setTimeout(() => {
    abortedByTimeout.value = true;
    controller.abort();
  }, timeout);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  return { controller, timeoutId, abortedByTimeout };
};
