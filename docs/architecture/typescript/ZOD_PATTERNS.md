# Zod Patterns Guide

## Overview

This document covers how to use Zod for runtime validation in the Prompt Builder codebase. Zod provides runtime validation that TypeScript's compile-time checks cannot.

---

## Why Zod?

TypeScript types **disappear at runtime**. This code compiles but crashes:

```typescript
interface User {
  id: string;
  name: string;
}

async function fetchUser(): Promise<User> {
  const response = await fetch('/api/user');
  const data = await response.json();
  return data as User; // DANGER: No runtime check!
}

// API returns { userId: '123', userName: 'Alice' } (wrong shape)
const user = await fetchUser();
console.log(user.name); // undefined - runtime error!
```

Zod **validates at runtime**:

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
});

type User = z.infer<typeof UserSchema>;

async function fetchUser(): Promise<User> {
  const response = await fetch('/api/user');
  const data = await response.json();
  return UserSchema.parse(data); // Throws ZodError if invalid
}
```

---

## Installation

```bash
npm install zod
```

---

## Core Patterns

### Pattern 1: API Response Validation

```typescript
// api/schemas.ts
import { z } from 'zod';

// Define the schema
export const VideoConceptResponseSchema = z.object({
  id: z.string().uuid(),
  concept: z.string(),
  elements: z.object({
    subject: z.string(),
    action: z.string(),
    location: z.string(),
    atmosphere: z.string().optional(),
  }),
  confidence: z.number().min(0).max(1),
  suggestions: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
});

// Derive TypeScript type
export type VideoConceptResponse = z.infer<typeof VideoConceptResponseSchema>;

// api/index.ts
import { VideoConceptResponseSchema, type VideoConceptResponse } from './schemas';

export async function fetchVideoConcept(prompt: string): Promise<VideoConceptResponse> {
  const response = await fetch('/api/video-concept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  return VideoConceptResponseSchema.parse(data);
}
```

### Pattern 2: Form Validation

```typescript
// schemas/forms.ts
import { z } from 'zod';

export const VideoFormSchema = z.object({
  subject: z.string()
    .min(3, 'Subject must be at least 3 characters')
    .max(100, 'Subject must be under 100 characters'),
  action: z.string()
    .min(3, 'Action must be at least 3 characters'),
  location: z.string()
    .min(3, 'Location must be at least 3 characters'),
  duration: z.number()
    .min(1, 'Duration must be at least 1 second')
    .max(60, 'Duration must be under 60 seconds')
    .optional(),
  style: z.enum(['cinematic', 'documentary', 'abstract']).default('cinematic'),
});

export type VideoFormData = z.infer<typeof VideoFormSchema>;

// hooks/useVideoForm.ts
import { useState } from 'react';
import { VideoFormSchema, type VideoFormData } from '../schemas/forms';
import type { ZodError } from 'zod';

interface ValidationErrors {
  [key: string]: string;
}

export function useVideoForm() {
  const [errors, setErrors] = useState<ValidationErrors>({});
  
  const validate = (data: unknown): data is VideoFormData => {
    try {
      VideoFormSchema.parse(data);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: ValidationErrors = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };
  
  const validateField = (field: keyof VideoFormData, value: unknown): string | null => {
    const fieldSchema = VideoFormSchema.shape[field];
    const result = fieldSchema.safeParse(value);
    return result.success ? null : result.error.errors[0]?.message ?? 'Invalid value';
  };
  
  return { errors, validate, validateField };
}
```

### Pattern 3: URL Parameter Validation

```typescript
// schemas/params.ts
import { z } from 'zod';

export const VideoParamsSchema = z.object({
  id: z.string().uuid(),
  mode: z.enum(['edit', 'view', 'preview']).default('view'),
  tab: z.coerce.number().min(0).max(4).default(0),
});

export type VideoParams = z.infer<typeof VideoParamsSchema>;

// hooks/useVideoParams.ts
import { useParams, useSearchParams } from 'react-router-dom';
import { VideoParamsSchema, type VideoParams } from '../schemas/params';

export function useVideoParams(): VideoParams {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  
  const rawParams = {
    id,
    mode: searchParams.get('mode'),
    tab: searchParams.get('tab'),
  };
  
  // Will throw if invalid - wrap in ErrorBoundary
  return VideoParamsSchema.parse(rawParams);
}
```

### Pattern 4: Environment Variables

```typescript
// config/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_API_KEY: z.string().min(1),
  VITE_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  VITE_MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024),
});

// Validate at app startup
export const env = EnvSchema.parse(import.meta.env);

// Type-safe access
console.log(env.VITE_API_URL); // string (guaranteed)
```

---

## Advanced Patterns

### Pattern 5: Discriminated Unions

```typescript
// schemas/events.ts
import { z } from 'zod';

const BaseEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
});

const UserCreatedSchema = BaseEventSchema.extend({
  type: z.literal('USER_CREATED'),
  payload: z.object({
    userId: z.string(),
    email: z.string().email(),
  }),
});

const UserUpdatedSchema = BaseEventSchema.extend({
  type: z.literal('USER_UPDATED'),
  payload: z.object({
    userId: z.string(),
    changes: z.record(z.unknown()),
  }),
});

const UserDeletedSchema = BaseEventSchema.extend({
  type: z.literal('USER_DELETED'),
  payload: z.object({
    userId: z.string(),
  }),
});

export const EventSchema = z.discriminatedUnion('type', [
  UserCreatedSchema,
  UserUpdatedSchema,
  UserDeletedSchema,
]);

export type Event = z.infer<typeof EventSchema>;

// Usage - type narrowing works automatically
function handleEvent(event: Event) {
  switch (event.type) {
    case 'USER_CREATED':
      // TypeScript knows event.payload has userId and email
      console.log(event.payload.email);
      break;
    case 'USER_DELETED':
      // TypeScript knows event.payload only has userId
      console.log(event.payload.userId);
      break;
  }
}
```

### Pattern 6: Recursive Schemas

```typescript
// schemas/tree.ts
import { z } from 'zod';

interface TreeNode {
  id: string;
  name: string;
  children: TreeNode[];
}

// Use z.lazy for recursive types
const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    children: z.array(TreeNodeSchema),
  })
);

export type { TreeNode };
export { TreeNodeSchema };
```

### Pattern 7: Transform and Coerce

```typescript
// schemas/transforms.ts
import { z } from 'zod';

// Coerce string to number
const PortSchema = z.coerce.number().min(1).max(65535);

// Transform date string to Date object
const DateSchema = z.string().transform((val) => new Date(val));

// Transform with validation
const SlugSchema = z.string()
  .transform((val) => val.toLowerCase().replace(/\s+/g, '-'))
  .pipe(z.string().regex(/^[a-z0-9-]+$/));

// Parse and transform API response
const ApiUserSchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  created_at: z.string(),
}).transform((data) => ({
  id: data.user_id,
  name: data.user_name,
  createdAt: new Date(data.created_at),
}));

type User = z.infer<typeof ApiUserSchema>;
// { id: string; name: string; createdAt: Date }
```

### Pattern 8: Refinements

```typescript
// schemas/refinements.ts
import { z } from 'zod';

// Custom validation logic
const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    (val) => /[A-Z]/.test(val),
    'Password must contain uppercase letter'
  )
  .refine(
    (val) => /[0-9]/.test(val),
    'Password must contain a number'
  );

// Cross-field validation
const DateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
}).refine(
  (data) => data.endDate > data.startDate,
  {
    message: 'End date must be after start date',
    path: ['endDate'], // Which field the error belongs to
  }
);

// Async validation
const UniqueEmailSchema = z.string().email().refine(
  async (email) => {
    const exists = await checkEmailExists(email);
    return !exists;
  },
  'Email already in use'
);
```

---

## Error Handling

### Pattern 9: Safe Parsing

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
});

// .parse() throws on error
try {
  const user = UserSchema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log(error.errors);
  }
}

// .safeParse() returns a result object
const result = UserSchema.safeParse(data);

if (result.success) {
  console.log(result.data); // User
} else {
  console.log(result.error.errors); // ZodError[]
}
```

### Pattern 10: Custom Error Messages

```typescript
// schemas/messages.ts
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string({
    required_error: 'Name is required',
    invalid_type_error: 'Name must be a string',
  }).min(2, { message: 'Name must be at least 2 characters' }),
  
  email: z.string()
    .email({ message: 'Please enter a valid email address' }),
  
  age: z.number({
    required_error: 'Age is required',
    invalid_type_error: 'Age must be a number',
  }).min(0, { message: 'Age cannot be negative' })
    .max(150, { message: 'Please enter a valid age' }),
});
```

### Pattern 11: Error Formatting

```typescript
// utils/zodErrors.ts
import { ZodError } from 'zod';

interface FormattedError {
  field: string;
  message: string;
}

export function formatZodError(error: ZodError): FormattedError[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

export function zodErrorToRecord(error: ZodError): Record<string, string> {
  const record: Record<string, string> = {};
  error.errors.forEach((err) => {
    const field = err.path.join('.');
    if (!record[field]) {
      record[field] = err.message;
    }
  });
  return record;
}
```

---

## Integration with React Hook Form

```typescript
// schemas/form.ts
import { z } from 'zod';

export const ContactFormSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(10).max(1000),
});

export type ContactFormData = z.infer<typeof ContactFormSchema>;

// components/ContactForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ContactFormSchema, type ContactFormData } from '../schemas/form';

export function ContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(ContactFormSchema),
  });
  
  const onSubmit = (data: ContactFormData) => {
    // data is already validated and typed
    console.log(data);
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
      
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      
      <textarea {...register('message')} />
      {errors.message && <span>{errors.message.message}</span>}
      
      <button type="submit">Send</button>
    </form>
  );
}
```

---

## Schema Organization

### File Structure

```text
src/
├── schemas/                  # Global schemas
│   ├── index.ts              # Barrel exports
│   ├── common.ts             # Shared schema fragments
│   ├── api.ts                # API response schemas
│   └── forms.ts              # Form validation schemas
├── features/
│   └── video-builder/
│       └── schemas/          # Feature-specific schemas
│           ├── index.ts
│           └── videoForm.ts
└── types/                    # TypeScript types
    └── index.ts              # Re-export inferred types
```

### Schema Naming Convention

| Schema Type | Naming Pattern | Example |
|-------------|----------------|---------|
| API Response | `{Resource}ResponseSchema` | `VideoConceptResponseSchema` |
| API Request | `{Action}RequestSchema` | `CreateVideoRequestSchema` |
| Form Data | `{Form}Schema` | `VideoFormSchema` |
| Params | `{Resource}ParamsSchema` | `VideoParamsSchema` |
| Events | `{Event}Schema` | `UserCreatedEventSchema` |

---

## Performance Tips

### 1. Reuse Schema Instances

```typescript
// ❌ Bad - creates new schema each render
function Component() {
  const schema = z.object({ name: z.string() });
  // ...
}

// ✅ Good - schema defined outside component
const schema = z.object({ name: z.string() });

function Component() {
  // Use schema
}
```

### 2. Use `.partial()` and `.pick()` Instead of Redefining

```typescript
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
});

// Partial for updates
const UpdateUserSchema = UserSchema.partial();

// Pick specific fields
const UserCredentialsSchema = UserSchema.pick({ email: true, role: true });

// Omit specific fields
const CreateUserSchema = UserSchema.omit({ id: true });
```

### 3. Lazy Loading for Large Schemas

```typescript
// For very large schemas, load dynamically
const getLargeSchema = () => import('./largeSchema').then((m) => m.schema);

async function validateLargeData(data: unknown) {
  const schema = await getLargeSchema();
  return schema.parse(data);
}
```

---

## Common Mistakes

### Mistake 1: Not Using `z.infer`

```typescript
// ❌ Bad - manual type that can drift
interface User {
  id: string;
  name: string;
}

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(), // Added but forgot to update interface!
});

// ✅ Good - type derived from schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

type User = z.infer<typeof UserSchema>;
```

### Mistake 2: Forgetting `.safeParse()` in User Input

```typescript
// ❌ Bad - throws in user's face
function handleSubmit(data: unknown) {
  const validated = Schema.parse(data); // Throws!
}

// ✅ Good - graceful error handling
function handleSubmit(data: unknown) {
  const result = Schema.safeParse(data);
  if (!result.success) {
    setErrors(formatZodError(result.error));
    return;
  }
  // Use result.data
}
```

### Mistake 3: Over-validating

```typescript
// ❌ Bad - validating data already validated
function processUser(user: User) {
  // user is already typed - no need to validate again!
  const validated = UserSchema.parse(user);
}

// ✅ Good - trust internal types
function processUser(user: User) {
  // TypeScript already guarantees the shape
  console.log(user.name);
}
```

---

## Quick Reference

```typescript
import { z } from 'zod';

// Primitives
z.string()
z.number()
z.boolean()
z.bigint()
z.date()
z.undefined()
z.null()
z.void()
z.any()
z.unknown()

// Strings
z.string().min(1).max(100)
z.string().email()
z.string().url()
z.string().uuid()
z.string().regex(/pattern/)
z.string().startsWith('prefix')
z.string().endsWith('suffix')

// Numbers
z.number().min(0).max(100)
z.number().int()
z.number().positive()
z.number().negative()
z.number().finite()

// Objects
z.object({ key: z.string() })
z.object({}).strict() // No extra keys
z.object({}).passthrough() // Allow extra keys
z.record(z.string()) // { [key: string]: string }

// Arrays
z.array(z.string())
z.array(z.string()).min(1).max(10)
z.array(z.string()).nonempty()
z.tuple([z.string(), z.number()])

// Unions & Enums
z.enum(['a', 'b', 'c'])
z.union([z.string(), z.number()])
z.discriminatedUnion('type', [...schemas])

// Optionality
z.string().optional() // string | undefined
z.string().nullable() // string | null
z.string().nullish() // string | null | undefined
z.string().default('default')

// Transforms
z.string().transform(val => val.toUpperCase())
z.coerce.number() // Coerce to number
z.coerce.boolean() // Coerce to boolean

// Refinements
z.string().refine(val => val.length > 5, 'Too short')
z.object({...}).superRefine((data, ctx) => { ... })
```

---

*Companion docs: [ARCHITECTURE_STANDARD.md](./ARCHITECTURE_STANDARD.md), [STYLE_RULES.md](./STYLE_RULES.md)*
