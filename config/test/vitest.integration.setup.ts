process.env.NODE_ENV = 'test';
process.env.GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'prompt-builder-test-bucket';
process.env.VIDEO_GENERATE_IDEMPOTENCY_MODE = process.env.VIDEO_GENERATE_IDEMPOTENCY_MODE || 'soft';
