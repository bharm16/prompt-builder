import { Storage } from '@google-cloud/storage';
import fs from 'node:fs';
import path from 'node:path';

const bucketName = process.env.GCS_BUCKET_NAME;
if (!bucketName) {
  throw new Error('Missing required env var: GCS_BUCKET_NAME');
}

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const fallbackCredentialsPath = path.resolve(process.cwd(), 'gcs-service-account.json');

if (credentialsPath) {
  const looksLikePlaceholder =
    credentialsPath === '/path/to/service-account.json' ||
    credentialsPath.startsWith('/path/to/') ||
    credentialsPath.includes('/path/to/service-account.json');
  const exists = fs.existsSync(credentialsPath);
  if (!exists) {
    if (looksLikePlaceholder && fs.existsSync(fallbackCredentialsPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = fallbackCredentialsPath;
      console.warn(
        [
          `Warning: GOOGLE_APPLICATION_CREDENTIALS points to a missing placeholder path: ${credentialsPath}`,
          `Using local credentials file instead: ${fallbackCredentialsPath}`,
          'Fix your `.env` to avoid this warning.',
        ].join('\n')
      );
    } else {
      throw new Error(
        [
          `GOOGLE_APPLICATION_CREDENTIALS is set but the file does not exist: ${credentialsPath}`,
          looksLikePlaceholder
            ? 'It looks like a placeholder value. Point it to your real service account JSON file.'
            : 'Double-check the path is correct and readable.',
          'Alternatively, unset GOOGLE_APPLICATION_CREDENTIALS and use Application Default Credentials (e.g. `gcloud auth application-default login`).',
        ].join('\n')
      );
    }
  }
} else if (fs.existsSync(fallbackCredentialsPath)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = fallbackCredentialsPath;
}

const storage = new Storage();
const bucket = storage.bucket(bucketName);

async function test() {
  const [exists] = await bucket.exists();
  console.log(`Bucket exists: ${exists}`);
  if (!exists) {
    throw new Error(
      [
        `Bucket not found (or you don't have permission): ${bucketName}`,
        'Fix by setting GCS_BUCKET_NAME to a bucket that exists in your GCP project, or create it first.',
        'If you created the service account with the provided script, you can create the bucket via `scripts/setup-gcs.sh` (after setting PROJECT_ID).',
      ].join('\n')
    );
  }

  // Test upload
  await bucket.file('test.txt').save('Hello from PromptCanvas!');
  console.log('Test file uploaded');

  // Clean up
  await bucket.file('test.txt').delete();
  console.log('Test file deleted');
}

test().catch(console.error);
