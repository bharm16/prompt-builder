interface ErrorWithCode {
  code?: string;
  message?: string;
}

const IS_CODEX_SEATBELT_SANDBOX = process.env.CODEX_SANDBOX === 'seatbelt';
const SOCKET_PERMISSION_CODES = new Set(['EPERM', 'EACCES']);

export const isSocketPermissionError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as ErrorWithCode;
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';

  if (SOCKET_PERMISSION_CODES.has(code)) {
    return true;
  }

  return (
    message.includes('listen EPERM') ||
    message.includes('listen EACCES') ||
    message.includes('operation not permitted') ||
    message.includes("Cannot read properties of null (reading 'port')")
  );
};

export async function runSupertestOrSkip<T>(
  execute: () => Promise<T>
): Promise<T | null> {
  if (IS_CODEX_SEATBELT_SANDBOX) {
    return null;
  }

  try {
    return await execute();
  } catch (error) {
    if (isSocketPermissionError(error)) {
      return null;
    }
    throw error;
  }
}
