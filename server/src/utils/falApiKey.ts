const TEMPLATE_PATTERN = /\$\{[^}]+\}/;

const normalize = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const isFalKeyPlaceholder = (value?: string | null): boolean => {
  const normalized = normalize(value);
  if (!normalized) return false;
  return (
    TEMPLATE_PATTERN.test(normalized) ||
    normalized.startsWith('$') ||
    normalized === 'undefined' ||
    normalized === 'null'
  );
};

export const resolveFalApiKey = (explicitKey?: string): string | null => {
  const explicit = normalize(explicitKey);
  if (explicit && !isFalKeyPlaceholder(explicit)) {
    return explicit;
  }

  const envFalKey = normalize(process.env.FAL_KEY);
  if (envFalKey && !isFalKeyPlaceholder(envFalKey)) {
    return envFalKey;
  }

  const envFalApiKey = normalize(process.env.FAL_API_KEY);
  if (envFalApiKey) {
    return envFalApiKey;
  }

  const envKeyId = normalize(process.env.FAL_KEY_ID);
  const envKeySecret = normalize(process.env.FAL_KEY_SECRET);
  if (envKeyId && envKeySecret) {
    return `${envKeyId}:${envKeySecret}`;
  }

  return null;
};
