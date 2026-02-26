export const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    const abortError = new Error('Request aborted');
    abortError.name = 'AbortError';
    throw abortError;
  }
};
