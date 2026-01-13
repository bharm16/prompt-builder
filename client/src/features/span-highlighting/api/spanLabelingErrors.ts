interface RequestError extends Error {
  status?: number;
}

export async function buildRequestError(res: Response): Promise<RequestError> {
  let message = `Request failed with status ${res.status}`;
  try {
    const errorBody: unknown = await res.json();
    if (isRecord(errorBody) && typeof errorBody.message === 'string') {
      message = errorBody.message;
    }
  } catch {
    // Ignore JSON parse errors and fall back to default message
  }
  const error: RequestError = Object.assign(new Error(message), { status: res.status });
  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
