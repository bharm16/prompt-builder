# Server (Backend)

Express API server for the Vidra video prompt editor.

## Stack

- Node.js 20, Express
- TypeScript executed via tsx
- ESM (`"type": "module"`)
- LLM providers: OpenAI, Gemini, Groq
- Firebase Admin for auth and storage
- Stripe for payments
- Redis (optional) for caching
- Pino for structured logging

## Commands

```bash
npm run server      # Start dev server (port 3001)
npm run server:e2e  # Start server in test mode
npm run test:unit   # Run unit tests (from root)
npm run lint        # ESLint (from root)
```

## Structure

```
server/
├── index.ts               # Entry point
├── src/
│   ├── app.ts             # Express app setup
│   ├── server.ts          # HTTP server wiring
│   ├── services/          # Business logic (main pattern)
│   ├── routes/            # HTTP route handlers
│   ├── clients/           # External API clients (LLM, etc.)
│   ├── llm/               # LLM orchestration and span labeling
│   ├── middleware/        # Express middleware
│   ├── schemas/           # Zod validation schemas
│   ├── contracts/         # Request/response contracts
│   └── utils/             # Shared helpers
```

## Architecture Pattern

Follow the **PromptOptimizationService** pattern in `server/src/services/prompt-optimization/`:

```
ServiceName/
├── ServiceNameService.ts  # Thin orchestrator
├── services/              # Specialized sub-services
│   ├── SubService1.ts
│   └── SubService2.ts
├── templates/             # External .md prompt templates
│   └── template.md
└── types.ts               # Service-specific types
```

### Orchestrator Pattern

```typescript
// ServiceNameService.ts
export class ServiceNameService {
  constructor(
    private subService1: SubService1,
    private subService2: SubService2,
  ) {}

  async process(input: Input): Promise<Output> {
    // Orchestration only - no business logic here
    const step1Result = await this.subService1.execute(input);
    const step2Result = await this.subService2.execute(step1Result);
    return step2Result;
  }
}
```

## Conventions

### Routes

- Keep route handlers thin
- All business logic goes in services
- Validate request body with Zod schemas
- Return consistent response shapes

```typescript
// routes/feature.routes.ts
import { z } from 'zod';

const RequestSchema = z.object({
  prompt: z.string().min(1),
  options: z.object({ /* ... */ }).optional(),
});

router.post('/feature', async (req, res) => {
  const validated = RequestSchema.parse(req.body);
  const result = await featureService.process(validated);
  res.json({ success: true, data: result });
});
```

### Services

- Single responsibility per service
- Inject dependencies via constructor
- Use templates for LLM prompts (external `.md` files)
- Structured logging with Pino

### LLM Clients

- All LLM providers in `clients/` with adapters
- Use `LLMClient` abstraction for provider switching
- Handle rate limits and retries at client level

### Validation

- Zod schemas in `schemas/` folder
- Validate all external input (API requests, env vars)
- Use `z.infer<typeof Schema>` for types

### Error Handling

- Use typed error classes
- Log errors with context using Pino
- Return appropriate HTTP status codes

```typescript
try {
  const result = await service.process(input);
  res.json({ success: true, data: result });
} catch (error) {
  if (error instanceof ValidationError) {
    res.status(400).json({ success: false, error: error.message });
  } else if (error instanceof NotFoundError) {
    res.status(404).json({ success: false, error: error.message });
  } else {
    logger.error({ error }, 'Unexpected error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
```

### TypeScript

- Explicit return types for all exported functions
- No `any` - use `unknown` with type guards
- Discriminated unions for result types
- Zod at all external boundaries

## Commit Protocol (MANDATORY)

Before EVERY commit, run all three checks in order:

1. `npx tsc --noEmit` — must exit 0
2. `npx eslint --config config/lint/eslint.config.js . --quiet` — must have 0 errors
3. `npm run test:unit` — must pass all shards

If any check fails, DO NOT commit. Fix the failures first.

A pre-commit hook enforces checks 1-2 automatically. Run `bash scripts/install-hooks.sh` after cloning.

### Commit Scope Rules

- Maximum ~10 files per commit unless it's a mechanical refactor (rename, import path change).
- If a fix requires touching 20+ files, stop and reconsider — there's probably a root cause fix that touches 2-3 files.
- Never combine dependency upgrades with code changes in the same commit.

### Change Scope Limits

- Type changes to shared interfaces: must run `tsc --noEmit` BEFORE continuing to other files.
- Dependency version bumps: isolated commit, nothing else in it.
- If fixing types requires adding `| null` or `| undefined` to more than 3 interfaces, STOP — find the root cause instead of widening types.
- If a test fix requires changing the production type to make it pass, that's a production code change, not a test fix.

## Common Patterns

### Service with Dependencies

```typescript
export class FeatureService {
  constructor(
    private llmClient: LLMClient,
    private storageService: StorageService,
    private logger: Logger,
  ) {}

  async process(input: FeatureInput): Promise<FeatureOutput> {
    this.logger.info({ input }, 'Processing feature');
    // ... implementation
  }
}
```

### LLM Prompt Template

```typescript
// Load template from external file
import { readFileSync } from 'fs';
import { join } from 'path';

const template = readFileSync(
  join(__dirname, 'templates', 'prompt.md'),
  'utf-8'
);

// Interpolate variables
const prompt = template
  .replace('{{input}}', userInput)
  .replace('{{context}}', contextData);
```

## Documentation

- Logging patterns: `docs/architecture/typescript/LOGGING_PATTERNS.md`
- Zod patterns: `docs/architecture/typescript/ZOD_PATTERNS.md`
- Architecture standard: `docs/architecture/typescript/ARCHITECTURE_STANDARD.md`
