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
