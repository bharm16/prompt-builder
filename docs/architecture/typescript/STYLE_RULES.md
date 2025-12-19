# TypeScript Style Rules

## Overview

This document defines the type safety rules and coding standards for TypeScript in the Prompt Builder codebase. Violations of these rules should be caught in code review and CI.

---

## 1. The `any` Ban

### Rule: Never Use `any`

```typescript
// ❌ FORBIDDEN
function process(data: any): any {
  return data.value;
}

// ❌ FORBIDDEN - Lazy casting
const result = response as any;

// ✅ CORRECT - Use unknown and narrow
function process(data: unknown): string {
  if (isValidData(data)) {
    return data.value;
  }
  throw new Error('Invalid data');
}

// ✅ CORRECT - Use generics
function process<T extends { value: string }>(data: T): string {
  return data.value;
}
```

### Acceptable Exception: Third-Party Libraries

If a library has incomplete types, use `any` with a `// TODO: Fix type` comment:

```typescript
// TODO: Fix type when @types/legacy-lib is updated
const result = legacyFunction() as any;
```

### What to Use Instead

| Instead of `any` | Use |
|------------------|-----|
| Unknown input | `unknown` + type guard |
| Generic data | `<T>` generic parameter |
| Object with unknown keys | `Record<string, unknown>` |
| Array of unknown | `unknown[]` |
| Function with unknown params | `(...args: unknown[]) => unknown` |

---

## 2. JSDoc is Dead (For Types)

### Rule: No Type Information in JSDoc

```typescript
// ❌ FORBIDDEN - JSDoc types
/**
 * @param {string} prompt - The input prompt
 * @param {Object} options - Configuration options
 * @returns {Promise<string>} The optimized result
 */
function optimize(prompt, options) {
  // ...
}

// ✅ CORRECT - TypeScript types + descriptive JSDoc
/**
 * Optimizes a prompt for video generation.
 * Uses the configured AI model to enhance clarity and specificity.
 */
function optimize(prompt: string, options: OptimizeOptions): Promise<string> {
  // ...
}
```

### JSDoc IS Allowed For:
- **Descriptions**: What the function does
- **Examples**: Usage examples
- **Deprecation**: `@deprecated` notices
- **See Also**: `@see` references

```typescript
/**
 * Calculates the quality score for an optimized prompt.
 * 
 * @example
 * const score = calculateScore(original, optimized);
 * console.log(`Quality: ${score}%`);
 * 
 * @see https://docs.example.com/scoring
 */
function calculateScore(original: string, optimized: string): number {
  // ...
}
```

---

## 3. No Magic Strings

### Rule: Lift String Literals to Union Types

```typescript
// ❌ FORBIDDEN - Magic strings
function setMode(mode: string) {
  if (mode === 'video') {
    // ...
  } else if (mode === 'research') {
    // ...
  }
}

// Call site has no type safety
setMode('vidoe'); // Typo goes unnoticed!

// ✅ CORRECT - Union type
type OptimizationMode = 'video' | 'research' | 'creative' | 'standard';

function setMode(mode: OptimizationMode) {
  if (mode === 'video') {
    // ...
  }
}

// Call site is type-checked
setMode('vidoe'); // TS Error: Argument of type '"vidoe"' is not assignable
```

### Pattern: `as const` Arrays

```typescript
// Define once, use everywhere
export const OPTIMIZATION_MODES = ['video', 'research', 'creative', 'standard'] as const;
export type OptimizationMode = typeof OPTIMIZATION_MODES[number];

// Use in validation
function isValidMode(mode: string): mode is OptimizationMode {
  return OPTIMIZATION_MODES.includes(mode as OptimizationMode);
}
```

---

## 4. Runtime Validation with Zod

### Rule: Validate External Data at Boundaries

TypeScript types disappear at runtime. Zod schemas exist at runtime.

```typescript
// ❌ DANGEROUS - Trust without verification
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();
  return data as User; // DANGEROUS: No runtime validation!
}

// ✅ SAFE - Runtime validation
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']),
});

type User = z.infer<typeof UserSchema>;

async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();
  return UserSchema.parse(data); // Throws ZodError if invalid
}
```

### Where to Use Zod

| Boundary | Use Zod? | Reason |
|----------|----------|--------|
| API responses | **YES** | External data, can't trust |
| User form input | **YES** | User-provided, must validate |
| URL parameters | **YES** | User-controlled |
| LocalStorage | **YES** | Can be corrupted |
| Inter-service calls | **YES** | API contracts can drift |
| Component props | No | Already type-checked by TS |
| Internal function args | No | TS handles this |

---

## 5. Optional Chaining: Deliberate, Not Defensive

### Rule: Use `?.` Only When Optionality is Intentional

```typescript
// ❌ BAD - Defensive chaining (you don't know what's required)
const street = user?.profile?.address?.street?.name;

// Ask yourself: SHOULD address be optional?
// If no, fix your types. If yes, handle the undefined case.

// ✅ GOOD - Deliberate optionality
interface User {
  profile: UserProfile; // Required
}

interface UserProfile {
  name: string;            // Required
  avatarUrl?: string;      // Explicitly optional
  address?: Address;       // Explicitly optional
}

// Now chaining is intentional
const avatar = user.profile.avatarUrl; // string | undefined - expected!
const street = user.profile.address?.street; // Only chain where optional
```

### The "2 Levels Deep" Rule

If you need `?.` more than 2 levels deep, your types are probably wrong:

```typescript
// ❌ Smells like bad types
data?.response?.result?.items?.[0]?.value

// ✅ Fix your types or add a type guard
if (isValidResponse(data)) {
  // data.response.result.items[0].value is now safe
}
```

---

## 6. Type Assertions: Use Sparingly

### Rule: Prefer Type Guards Over Assertions

```typescript
// ❌ AVOID - Type assertion (tells TS to trust you)
const user = data as User;

// ✅ PREFER - Type guard (proves to TS the type is correct)
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data
  );
}

if (isUser(data)) {
  // TS knows data is User here
}
```

### When Assertions ARE Acceptable

1. **After Zod validation** (Zod already proved the type):
   ```typescript
   const validated = UserSchema.parse(data);
   // validated is already typed correctly
   ```

2. **DOM elements** when you know the element type:
   ```typescript
   const input = document.getElementById('email') as HTMLInputElement;
   ```

3. **Test mocks**:
   ```typescript
   const mockService = { fetch: vi.fn() } as unknown as IApiService;
   ```

---

## 7. Discriminated Unions for Actions

### Rule: Use Discriminated Unions for Reducer Actions

```typescript
// ❌ BAD - Loose typing
type Action = {
  type: string;
  payload?: any;
};

// ✅ GOOD - Discriminated union
type Action =
  | { type: 'SET_USER'; user: User }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_USER':
      // TS knows action.user exists here
      return { ...state, user: action.user };
    case 'SET_LOADING':
      // TS knows action.loading exists here
      return { ...state, loading: action.loading };
    // ...
  }
}
```

---

## 8. Function Return Types

### Rule: Explicit Return Types for Public APIs

```typescript
// ❌ Implicit return type (OK for internal functions)
function calculateScore(a: number, b: number) {
  return a + b;
}

// ✅ Explicit return type (REQUIRED for exported functions)
export function calculateScore(a: number, b: number): number {
  return a + b;
}

// ✅ REQUIRED for async functions
export async function fetchUser(id: string): Promise<User> {
  // ...
}

// ✅ REQUIRED for React components
export function UserCard({ user }: UserCardProps): React.ReactElement {
  return <div>{user.name}</div>;
}
```

### Exception: Simple Arrow Functions

```typescript
// OK - Type is obvious
const double = (n: number) => n * 2;

// OK - Callback in typed context
users.map(user => user.name);
```

---

## 9. Null vs Undefined

### Rule: Prefer `undefined` Over `null`

TypeScript's optional properties use `undefined`. Be consistent.

```typescript
// ❌ Inconsistent - mixing null and undefined
interface User {
  name: string;
  email: string | null;
  phone?: string; // This is string | undefined
}

// ✅ Consistent - use undefined
interface User {
  name: string;
  email?: string;  // string | undefined
  phone?: string;  // string | undefined
}

// Exception: API contracts that explicitly use null
interface ApiResponse {
  data: User | null; // API returns null, not undefined
}
```

---

## 10. Generic Constraints

### Rule: Constrain Generics When Possible

```typescript
// ❌ Too loose
function getProperty<T>(obj: T, key: string): unknown {
  return obj[key]; // TS Error: T might not have string index
}

// ✅ Properly constrained
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Usage is now type-safe
const user = { name: 'Alice', age: 30 };
const name = getProperty(user, 'name'); // string
const invalid = getProperty(user, 'invalid'); // TS Error!
```

---

## 11. Async Error Handling

### Rule: Typed Error Handling

```typescript
// ❌ Untyped catch
try {
  await fetchUser(id);
} catch (error) {
  console.log(error.message); // TS Error: error is unknown
}

// ✅ Typed error handling
try {
  await fetchUser(id);
} catch (error) {
  if (error instanceof ZodError) {
    console.log('Validation failed:', error.errors);
  } else if (error instanceof ApiError) {
    console.log('API error:', error.message);
  } else {
    console.log('Unknown error:', error);
  }
}

// ✅ Or use a Result type
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

async function fetchUserSafe(id: string): Promise<Result<User, ApiError>> {
  try {
    const user = await fetchUser(id);
    return { ok: true, value: user };
  } catch (error) {
    return { ok: false, error: error as ApiError };
  }
}
```

---

## 12. Index Signatures

### Rule: Use `Record<K, V>` Over Index Signatures

```typescript
// ❌ Old style
interface StringMap {
  [key: string]: string;
}

// ✅ Modern style
type StringMap = Record<string, string>;

// ✅ With undefined (safer)
type StringMap = Record<string, string | undefined>;
```

### With `noUncheckedIndexedAccess`

When enabled, indexed access returns `T | undefined`:

```typescript
const map: Record<string, string> = { a: 'A' };
const value = map['b']; // string | undefined (not just string)

// Must handle undefined
if (value !== undefined) {
  console.log(value.toUpperCase());
}
```

---

## ESLint Rules to Enforce

Add these to your ESLint config:

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': ['error', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true,
    }],
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
  },
};
```

---

## Quick Reference Card

| Rule | Bad | Good |
|------|-----|------|
| No `any` | `: any` | `: unknown` + guard |
| No JSDoc types | `@param {string}` | TS annotation |
| No magic strings | `'video'` | `OptimizationMode` |
| Zod at boundaries | `as User` | `Schema.parse()` |
| Deliberate `?.` | `a?.b?.c?.d` | Fix types |
| Discriminated unions | `{ type: string }` | `{ type: 'X'; ... }` |
| Explicit returns | Inferred | `: ReturnType` |
| Prefer `undefined` | `null` | `undefined` |
| Constrain generics | `<T>` | `<T extends X>` |

---

*Companion docs: [ARCHITECTURE_STANDARD.md](./ARCHITECTURE_STANDARD.md), [ZOD_PATTERNS.md](./ZOD_PATTERNS.md)*
