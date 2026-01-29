export const safeUrlHost = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
};
