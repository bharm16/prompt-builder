process.env.NODE_ENV = "test";
process.env.GCS_BUCKET_NAME =
  process.env.GCS_BUCKET_NAME || "prompt-builder-test-bucket";
process.env.VIDEO_GENERATE_IDEMPOTENCY_MODE =
  process.env.VIDEO_GENERATE_IDEMPOTENCY_MODE || "soft";

// Default Firebase-backed integration tests to run unless explicitly opted out.
// Set RUN_FIREBASE_INTEGRATION=false to skip (e.g. when no emulator is running).
process.env.RUN_FIREBASE_INTEGRATION =
  process.env.RUN_FIREBASE_INTEGRATION ?? "true";
