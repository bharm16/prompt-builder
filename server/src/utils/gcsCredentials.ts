import fs from 'node:fs';
import path from 'node:path';
import { logger } from '@infrastructure/Logger';

const FALLBACK_CREDENTIALS_FILENAME = 'gcs-service-account.json';
let checkedCredentials = false;

function isPlaceholderPath(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed === '/path/to/service-account.json' ||
    trimmed.startsWith('/path/to/') ||
    trimmed.includes('/path/to/service-account.json')
  );
}

export function ensureGcsCredentials(): void {
  if (checkedCredentials) {
    return;
  }
  checkedCredentials = true;

  const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const fallbackPath = path.resolve(process.cwd(), FALLBACK_CREDENTIALS_FILENAME);

  if (configuredPath) {
    const exists = fs.existsSync(configuredPath);
    if (!exists) {
      if (isPlaceholderPath(configuredPath) && fs.existsSync(fallbackPath)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = fallbackPath;
        logger.warn('GOOGLE_APPLICATION_CREDENTIALS points to a placeholder file; using local credentials', {
          fallbackPath,
        });
      } else {
        logger.warn('GOOGLE_APPLICATION_CREDENTIALS file not found; GCS operations may fail', {
          configuredPath,
        });
      }
    }
    return;
  }

  if (fs.existsSync(fallbackPath)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = fallbackPath;
    logger.warn('GOOGLE_APPLICATION_CREDENTIALS not set; using local credentials', {
      fallbackPath,
    });
  }
}
