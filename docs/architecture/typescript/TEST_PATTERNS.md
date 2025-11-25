# TypeScript Test Patterns

## Overview

This document covers TypeScript-specific testing patterns for the Prompt Builder codebase. It extends the existing test templates with type-safe mocking and assertion patterns.

---

## Core Principle: Type-Safe Mocking

The #1 mistake in TypeScript tests is losing type safety when mocking. Your mocks should be as typed as your production code.

---

## Pattern 1: Typed Mock Functions

### Using Vitest's `MockedFunction`

```typescript
import { vi, type MockedFunction } from 'vitest';
import type { IApiService } from '../contracts/IApiService';

// Define typed mock
let mockFetch: MockedFunction<typeof fetch>;

beforeEach(() => {
  mockFetch = vi.fn();
  global.fetch = mockFetch;
});

// Usage - TypeScript knows the signature
mockFetch.mockResolvedValue(new Response(JSON.stringify({ data: 'test' })));
```

### Creating Typed Mock Objects

```typescript
import { vi } from 'vitest';
import type { IClaudeClient } from '../contracts/IClaudeClient';

// ✅ GOOD - Fully typed mock
function createMockClaudeClient(): IClaudeClient {
  return {
    complete: vi.fn(),
    completeStreaming: vi.fn(),
    validateConnection: vi.fn(),
  };
}

// ❌ BAD - Loses type safety
const mockClient = {
  complete: vi.fn(),
} as unknown as IClaudeClient;
```

---

## Pattern 2: Service Test with Dependency Injection

```typescript
// OptimizationService.test.ts
import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { OptimizationService } from '../OptimizationService';
import type { IClaudeClient, ICache, ILogger } from '../contracts';
import type { OptimizationResult, OptimizationContext } from '../types';

describe('OptimizationService', () => {
  // Typed mocks
  let mockClaudeClient: {
    complete: MockedFunction<IClaudeClient['complete']>;
    validateConnection: MockedFunction<IClaudeClient['validateConnection']>;
  };
  
  let mockCache: {
    get: MockedFunction<ICache['get']>;
    set: MockedFunction<ICache['set']>;
  };
  
  let mockLogger: {
    info: MockedFunction<ILogger['info']>;
    error: MockedFunction<ILogger['error']>;
  };
  
  let service: OptimizationService;
  
  beforeEach(() => {
    // Create typed mocks
    mockClaudeClient = {
      complete: vi.fn(),
      validateConnection: vi.fn(),
    };
    
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
    };
    
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };
    
    // Inject typed dependencies
    service = new OptimizationService({
      claudeClient: mockClaudeClient as IClaudeClient,
      cache: mockCache as ICache,
      logger: mockLogger as ILogger,
    });
  });
  
  describe('optimize', () => {
    it('should return cached result when available', async () => {
      // Arrange - TypeScript validates mock return type
      const cachedResult: OptimizationResult = {
        optimized: 'cached prompt',
        score: 95,
        metadata: { source: 'cache' },
      };
      mockCache.get.mockResolvedValue(cachedResult);
      
      // Act
      const result = await service.optimize('test prompt');
      
      // Assert - TypeScript validates result shape
      expect(result).toEqual(cachedResult);
      expect(mockClaudeClient.complete).not.toHaveBeenCalled();
    });
    
    it('should call Claude when cache misses', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'optimized result' }],
        usage: { inputTokens: 10, outputTokens: 20 },
      });
      
      // Act
      const result = await service.optimize('test prompt');
      
      // Assert
      expect(result.optimized).toBe('optimized result');
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ optimized: 'optimized result' }),
      );
    });
  });
});
```

---

## Pattern 3: React Component Test with Typed Props

```typescript
// VideoBuilder.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type MockedFunction } from 'vitest';
import { VideoBuilder } from '../VideoBuilder';
import type { VideoBuilderProps } from '../types';
import type { VideoConceptResponse } from '../api/schemas';

// Create typed mock for API
vi.mock('../api', () => ({
  fetchVideoConcept: vi.fn(),
}));

import { fetchVideoConcept } from '../api';

const mockFetchVideoConcept = fetchVideoConcept as MockedFunction<typeof fetchVideoConcept>;

describe('VideoBuilder', () => {
  // Default props factory - ensures type safety
  const createProps = (overrides?: Partial<VideoBuilderProps>): VideoBuilderProps => ({
    onComplete: vi.fn(),
    mode: 'video',
    ...overrides,
  });
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should render with required props', () => {
    const props = createProps();
    render(<VideoBuilder {...props} />);
    
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });
  
  it('should call onComplete with typed result', async () => {
    // Arrange
    const onComplete = vi.fn<[VideoConceptResponse], void>();
    const props = createProps({ onComplete });
    
    const mockResponse: VideoConceptResponse = {
      id: '123',
      concept: 'A cat jumping',
      elements: { subject: 'cat', action: 'jumping', location: 'garden' },
      confidence: 0.95,
      suggestions: [],
      createdAt: new Date().toISOString(),
    };
    mockFetchVideoConcept.mockResolvedValue(mockResponse);
    
    const user = userEvent.setup();
    render(<VideoBuilder {...props} />);
    
    // Act
    await user.type(screen.getByLabelText(/subject/i), 'A cat');
    await user.click(screen.getByRole('button', { name: /generate/i }));
    
    // Assert - TypeScript validates the call signature
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(mockResponse);
    });
  });
  
  it('should handle API errors', async () => {
    // Arrange
    const props = createProps();
    mockFetchVideoConcept.mockRejectedValue(new Error('API Error'));
    
    const user = userEvent.setup();
    render(<VideoBuilder {...props} />);
    
    // Act
    await user.click(screen.getByRole('button', { name: /generate/i }));
    
    // Assert
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/error/i);
    });
  });
});
```

---

## Pattern 4: Hook Test with Typed Actions

```typescript
// useVideoState.test.ts
import { renderHook, act } from '@testing-library/react';
import { useVideoState } from '../useVideoState';
import type { VideoState, VideoAction, VideoFormData } from '../types';

describe('useVideoState', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useVideoState());
    
    // TypeScript validates state shape
    expect(result.current.state).toEqual<VideoState>({
      step: 0,
      formData: {
        subject: '',
        action: '',
        location: '',
      },
      errors: [],
      isSubmitting: false,
    });
  });
  
  it('should handle SET_FIELD action', async () => {
    const { result } = renderHook(() => useVideoState());
    
    await act(async () => {
      // TypeScript validates action shape
      result.current.dispatch({
        type: 'SET_FIELD',
        field: 'subject',
        value: 'A cat',
      });
    });
    
    expect(result.current.state.formData.subject).toBe('A cat');
  });
  
  it('should clear field error when field is updated', async () => {
    const { result } = renderHook(() => useVideoState());
    
    // Set initial error
    await act(async () => {
      result.current.dispatch({
        type: 'SET_ERRORS',
        errors: [{ field: 'subject', message: 'Required' }],
      });
    });
    
    expect(result.current.state.errors).toHaveLength(1);
    
    // Update field should clear its error
    await act(async () => {
      result.current.dispatch({
        type: 'SET_FIELD',
        field: 'subject',
        value: 'A cat',
      });
    });
    
    expect(result.current.state.errors).toHaveLength(0);
  });
  
  // Test type narrowing in reducer
  it('should handle all action types', async () => {
    const { result } = renderHook(() => useVideoState());
    
    const actions: VideoAction[] = [
      { type: 'SET_FIELD', field: 'subject', value: 'test' },
      { type: 'NEXT_STEP' },
      { type: 'PREV_STEP' },
      { type: 'SET_ERRORS', errors: [] },
      { type: 'RESET' },
    ];
    
    for (const action of actions) {
      await act(async () => {
        result.current.dispatch(action);
      });
      // No error = type narrowing works correctly
    }
  });
});
```

---

## Pattern 5: Zod Schema Tests

```typescript
// schemas.test.ts
import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  VideoConceptResponseSchema,
  VideoFormSchema,
  type VideoConceptResponse,
  type VideoFormData,
} from '../schemas';

describe('VideoConceptResponseSchema', () => {
  it('should parse valid response', () => {
    const validResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      concept: 'A cat jumping',
      elements: {
        subject: 'cat',
        action: 'jumping',
        location: 'garden',
      },
      confidence: 0.95,
      suggestions: ['Try adding time of day'],
      createdAt: '2024-01-15T10:30:00Z',
    };
    
    const result = VideoConceptResponseSchema.parse(validResponse);
    
    // TypeScript knows result is VideoConceptResponse
    expect(result.concept).toBe('A cat jumping');
    expect(result.confidence).toBe(0.95);
  });
  
  it('should reject invalid UUID', () => {
    const invalidResponse = {
      id: 'not-a-uuid',
      concept: 'A cat',
      elements: { subject: 'cat', action: 'sit', location: 'home' },
      confidence: 0.5,
      suggestions: [],
      createdAt: '2024-01-15T10:30:00Z',
    };
    
    expect(() => VideoConceptResponseSchema.parse(invalidResponse))
      .toThrow(ZodError);
  });
  
  it('should reject confidence out of range', () => {
    const invalidResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      concept: 'A cat',
      elements: { subject: 'cat', action: 'sit', location: 'home' },
      confidence: 1.5, // Out of range
      suggestions: [],
      createdAt: '2024-01-15T10:30:00Z',
    };
    
    expect(() => VideoConceptResponseSchema.parse(invalidResponse))
      .toThrow(ZodError);
  });
  
  it('should handle optional fields', () => {
    const minimalResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      concept: 'A cat',
      elements: { subject: 'cat', action: 'sit', location: 'home' },
      confidence: 0.5,
      createdAt: '2024-01-15T10:30:00Z',
      // suggestions is optional
    };
    
    const result = VideoConceptResponseSchema.parse(minimalResponse);
    expect(result.suggestions).toEqual([]); // Default value
  });
});

describe('VideoFormSchema', () => {
  it('should validate minimum length', () => {
    const shortForm: Partial<VideoFormData> = {
      subject: 'ab', // Too short (min 3)
      action: 'run',
      location: 'park',
    };
    
    const result = VideoFormSchema.safeParse(shortForm);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain('subject');
    }
  });
  
  it('should provide custom error messages', () => {
    const emptyForm = {
      subject: '',
      action: '',
      location: '',
    };
    
    const result = VideoFormSchema.safeParse(emptyForm);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map(e => e.message);
      expect(messages).toContain('Subject must be at least 3 characters');
    }
  });
});
```

---

## Pattern 6: API Layer Test with Zod

```typescript
// api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';
import { fetchVideoConcept } from '../api';
import { VideoConceptResponseSchema } from '../schemas';

describe('fetchVideoConcept', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should return typed response on success', async () => {
    // Arrange
    const mockResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      concept: 'A cat jumping',
      elements: { subject: 'cat', action: 'jumping', location: 'garden' },
      confidence: 0.95,
      suggestions: [],
      createdAt: '2024-01-15T10:30:00Z',
    };
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    
    // Act
    const result = await fetchVideoConcept('A cat jumping');
    
    // Assert - TypeScript knows the shape
    expect(result.concept).toBe('A cat jumping');
    expect(result.confidence).toBe(0.95);
  });
  
  it('should throw ZodError on invalid response shape', async () => {
    // Arrange - API returns wrong shape
    const invalidResponse = {
      id: 'not-a-uuid',
      // Missing required fields
    };
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(invalidResponse),
    });
    
    // Act & Assert
    await expect(fetchVideoConcept('test'))
      .rejects.toThrow(ZodError);
  });
  
  it('should throw on HTTP error', async () => {
    // Arrange
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    
    // Act & Assert
    await expect(fetchVideoConcept('test'))
      .rejects.toThrow('API error: 500');
  });
});
```

---

## Pattern 7: Type Guard Tests

```typescript
// typeGuards.test.ts
import { describe, it, expect } from 'vitest';
import { isVideoFormData, isApiError } from '../typeGuards';
import type { VideoFormData, ApiError } from '../types';

describe('Type Guards', () => {
  describe('isVideoFormData', () => {
    it('should return true for valid VideoFormData', () => {
      const valid: VideoFormData = {
        subject: 'A cat',
        action: 'jumping',
        location: 'garden',
      };
      
      expect(isVideoFormData(valid)).toBe(true);
    });
    
    it('should return false for missing fields', () => {
      const invalid = {
        subject: 'A cat',
        // Missing action and location
      };
      
      expect(isVideoFormData(invalid)).toBe(false);
    });
    
    it('should return false for wrong types', () => {
      const invalid = {
        subject: 123, // Should be string
        action: 'jumping',
        location: 'garden',
      };
      
      expect(isVideoFormData(invalid)).toBe(false);
    });
    
    it('should return false for null/undefined', () => {
      expect(isVideoFormData(null)).toBe(false);
      expect(isVideoFormData(undefined)).toBe(false);
    });
  });
  
  describe('isApiError', () => {
    it('should narrow unknown to ApiError', () => {
      const error: unknown = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        status: 400,
      };
      
      if (isApiError(error)) {
        // TypeScript knows error is ApiError here
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.status).toBe(400);
      } else {
        throw new Error('Should have been ApiError');
      }
    });
  });
});
```

---

## Pattern 8: Testing Generic Functions

```typescript
// utils.test.ts
import { describe, it, expect } from 'vitest';
import { groupBy, mapValues, filterNullish } from '../utils';

describe('Generic Utils', () => {
  describe('groupBy', () => {
    it('should group by string key', () => {
      interface Item {
        category: string;
        name: string;
      }
      
      const items: Item[] = [
        { category: 'a', name: 'item1' },
        { category: 'b', name: 'item2' },
        { category: 'a', name: 'item3' },
      ];
      
      const result = groupBy(items, 'category');
      
      // TypeScript knows result is Record<string, Item[]>
      expect(result.a).toHaveLength(2);
      expect(result.b).toHaveLength(1);
    });
  });
  
  describe('filterNullish', () => {
    it('should remove null and undefined', () => {
      const items: (string | null | undefined)[] = ['a', null, 'b', undefined, 'c'];
      
      const result = filterNullish(items);
      
      // TypeScript knows result is string[]
      expect(result).toEqual(['a', 'b', 'c']);
    });
    
    it('should narrow type correctly', () => {
      interface User {
        name: string;
        email: string | null;
      }
      
      const users: (User | null)[] = [
        { name: 'Alice', email: 'alice@example.com' },
        null,
        { name: 'Bob', email: null },
      ];
      
      const result = filterNullish(users);
      
      // TypeScript knows result is User[]
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
    });
  });
});
```

---

## Common Mistakes

### Mistake 1: Losing Types with `as unknown as`

```typescript
// ❌ BAD - Loses all type safety
const mockService = {} as unknown as IApiService;

// ✅ GOOD - Maintains type safety
const mockService: IApiService = {
  fetch: vi.fn(),
  post: vi.fn(),
  // ... all required methods
};
```

### Mistake 2: Not Typing Mock Return Values

```typescript
// ❌ BAD - No type checking on mock return
mockApi.fetch.mockResolvedValue({ wrong: 'shape' });

// ✅ GOOD - TypeScript validates mock return
const validResponse: ApiResponse = {
  data: { id: '1', name: 'test' },
  success: true,
};
mockApi.fetch.mockResolvedValue(validResponse);
```

### Mistake 3: Using `any` in Test Assertions

```typescript
// ❌ BAD
expect(result).toEqual(expect.any(Object));

// ✅ GOOD - Type-safe assertion
expect(result).toEqual<ExpectedType>({
  id: expect.any(String),
  name: 'test',
});
```

---

## Quick Reference: Test Utilities

```typescript
import { vi, type MockedFunction, type Mock } from 'vitest';

// Typed mock function
const mockFn: MockedFunction<(x: string) => number> = vi.fn();

// Mock implementation with correct types
mockFn.mockImplementation((x) => x.length);

// Mock resolved value
mockFn.mockResolvedValue(42);

// Spy on object method
const spy = vi.spyOn(object, 'method');

// Create mock object from interface
function createMock<T>(overrides?: Partial<T>): T {
  return overrides as T;
}
```

---

*Companion docs: [ARCHITECTURE_STANDARD.md](./ARCHITECTURE_STANDARD.md), [STYLE_RULES.md](./STYLE_RULES.md)*
*Reference: [../CLAUDE_CODE_TEST_TEMPLATES.md](../CLAUDE_CODE_TEST_TEMPLATES.md)*
