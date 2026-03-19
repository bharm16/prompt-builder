import { promptOptimizationApiV2 } from '@/services';

const COMPILE_TIMEOUT_MS = 4000;

export async function compileWanPrompt(
  prompt: string,
  signal: AbortSignal
): Promise<string> {
  let compiledPrompt = prompt.trim();
  const compileAbortController = new AbortController();
  const abortCompile = () => compileAbortController.abort();
  const timeoutId = window.setTimeout(() => compileAbortController.abort(), COMPILE_TIMEOUT_MS);
  signal.addEventListener('abort', abortCompile, { once: true });
  try {
    const compiled = await promptOptimizationApiV2.compilePrompt({
      prompt: compiledPrompt,
      targetModel: 'wan',
      signal: compileAbortController.signal,
    });
    if (!compileAbortController.signal.aborted) {
      const trimmed = compiled?.compiledPrompt?.trim();
      if (trimmed) compiledPrompt = trimmed;
    }
  } catch {
    // Best-effort compile; fallback to original prompt.
  } finally {
    window.clearTimeout(timeoutId);
    signal.removeEventListener('abort', abortCompile);
  }
  return compiledPrompt;
}
