# Test Writing Instructions

You are writing tests for the PromptCanvas codebase. Follow these rules exactly.

---

## Rule 1: The Deletion Test

Before writing ANY assertion, ask yourself:
> "If the developer deletes the implementation and returns a hardcoded value, will this test fail?"

If the answer is NO, the test is useless. Rewrite it.

**Example of a useless test:**
```typescript
mockService.getData.mockReturnValue({ value: 42 });
const result = await myFunction();
expect(result.value).toBe(42);
```
This passes even if `myFunction` is `async () => ({ value: 42 })`. It tests nothing.

**Example of a useful test:**
```typescript
mockService.getData.mockReturnValue({ rawValue: 42, timestamp: 1000 });
const result = await myFunction();
expect(result.formattedValue).toBe('$42.00');  // Tests transformation
expect(result.isStale).toBe(true);              // Tests calculation based on timestamp
```
This fails if the transformation logic is deleted.

---

## Rule 2: Test Distribution

Write tests in this order and ratio:

1. **Error cases (40-60% of tests)**
   - What happens when dependencies throw?
   - What happens when network fails?
   - What happens when response is malformed?
   - What happens when input is invalid?

2. **Edge cases (30% of tests)**
   - Null and undefined inputs
   - Empty arrays and strings
   - Boundary values (0, -1, MAX_INT, etc.)
   - Race conditions

3. **Happy path (10-20% of tests)**
   - Only 1-2 tests for the success case
   - This is the LEAST important category

---

## Rule 3: Forbidden Patterns

NEVER write these:

```typescript
// ❌ FORBIDDEN: Testing that mock returns what you configured
mockFn.mockReturnValue(X);
const result = await fn();
expect(result).toBe(X);

// ❌ FORBIDDEN: Mock verification as the only assertion
await fn();
expect(mockService.method).toHaveBeenCalled();

// ❌ FORBIDDEN: Structural assertions without value checks
expect(result).toHaveProperty('data');
expect(result).toBeDefined();
expect(result).toMatchSnapshot();

// ❌ FORBIDDEN: Testing your test setup
vi.spyOn(Math, 'random').mockReturnValue(0.5);
expect(generateId()).toContain('0.5');
```

---

## Rule 4: Required Patterns

ALWAYS write these instead:

```typescript
// ✅ REQUIRED: Test transformations
mockApi.get.mockResolvedValue({ raw: 42 });
const result = await processData();
expect(result.formatted).toBe('$42.00');  // Code must transform
expect(result.timestamp).toBeInstanceOf(Date);  // Code must add metadata

// ✅ REQUIRED: Test error propagation
mockApi.get.mockRejectedValue(new Error('timeout'));
await expect(processData()).rejects.toThrow('timeout');

// ✅ REQUIRED: Test error handling behavior
mockApi.get.mockRejectedValue(new Error('timeout'));
await expect(processData()).rejects.toThrow();
expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('timeout'));

// ✅ REQUIRED: Test state transitions (for hooks)
const { result } = renderHook(() => useCounter());
act(() => result.current.increment());
expect(result.current.count).toBe(1);  // Test the resulting state

// ✅ REQUIRED: Test invariants with property-based testing
import * as fc from 'fast-check';
fc.assert(fc.property(fc.string(), (input) => {
  const result = sanitize(input);
  expect(result).not.toContain('<script>');  // Invariant must hold for all inputs
}));
```

---

## Rule 5: By File Type

### React Hooks
```typescript
// Test state transitions
it('increments count when increment is called', () => {
  const { result } = renderHook(() => useCounter());
  act(() => result.current.increment());
  expect(result.current.count).toBe(1);
});

// Test effect cleanup
it('clears interval on unmount', () => {
  const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
  const { unmount } = renderHook(() => useTimer());
  unmount();
  expect(clearIntervalSpy).toHaveBeenCalled();
});

// Test error states
it('sets error state when fetch fails', async () => {
  mockFetch.mockRejectedValue(new Error('Network error'));
  const { result } = renderHook(() => useFetchData());
  await waitFor(() => expect(result.current.error).toBe('Network error'));
});
```

### Services
```typescript
// Test error wrapping
it('wraps API errors with context', async () => {
  mockApi.fetch.mockRejectedValue(new Error('500'));
  await expect(service.getData()).rejects.toThrow('Failed to fetch data: 500');
});

// Test retry logic
it('retries 3 times before failing', async () => {
  mockApi.fetch.mockRejectedValue(new Error('timeout'));
  await expect(service.getData()).rejects.toThrow();
  expect(mockApi.fetch).toHaveBeenCalledTimes(3);
});

// Test cache behavior differences
it('skips API call when cache hits', async () => {
  mockCache.get.mockResolvedValue({ data: 'cached' });
  const result = await service.getData();
  expect(result.source).toBe('cache');
  expect(mockApi.fetch).not.toHaveBeenCalled();
});

it('calls API and caches result on cache miss', async () => {
  mockCache.get.mockResolvedValue(null);
  mockApi.fetch.mockResolvedValue({ data: 'fresh' });
  await service.getData();
  expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), { data: 'fresh' });
});
```

### API Layers
```typescript
// Test Zod validation failures
it('throws ZodError when response shape is invalid', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ invalid: 'shape' }),
  });
  await expect(fetchData()).rejects.toThrow(ZodError);
});

// Test HTTP error mapping
it('throws typed error for 404', async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 404 });
  await expect(fetchData()).rejects.toThrow(NotFoundError);
});

it('throws typed error for 500', async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 500 });
  await expect(fetchData()).rejects.toThrow(ServerError);
});
```

### Utility Functions
```typescript
// Use property-based testing for invariants
it('never returns string longer than maxLength', () => {
  fc.assert(fc.property(
    fc.string(),
    fc.integer({ min: 1, max: 100 }),
    (input, maxLength) => {
      const result = truncate(input, maxLength);
      expect(result.length).toBeLessThanOrEqual(maxLength);
    }
  ));
});

// Test boundary values
it('handles empty string', () => {
  expect(truncate('', 10)).toBe('');
});

it('handles maxLength of 0', () => {
  expect(truncate('hello', 0)).toBe('');
});

it('handles maxLength equal to string length', () => {
  expect(truncate('hello', 5)).toBe('hello');
});
```

---

## Rule 6: Test Structure

Follow this structure for every test file:

```typescript
describe('ServiceName', () => {
  // Setup
  let service: ServiceUnderTest;
  let mockDependency: MockedObject<IDependency>;

  beforeEach(() => {
    mockDependency = {
      method: vi.fn(),
    };
    service = new ServiceUnderTest(mockDependency);
  });

  // Group 1: Error handling (FIRST and MOST tests)
  describe('error handling', () => {
    it('throws when dependency fails', async () => {});
    it('throws when input is invalid', async () => {});
    it('throws when response is malformed', async () => {});
  });

  // Group 2: Edge cases
  describe('edge cases', () => {
    it('handles null input', async () => {});
    it('handles empty array', async () => {});
    it('handles boundary values', async () => {});
  });

  // Group 3: Core behavior (LAST and FEWEST tests)
  describe('core behavior', () => {
    it('transforms data correctly', async () => {});
    it('returns expected result on success', async () => {});
  });
});
```

---

## Rule 7: Assertions Must Be Specific

```typescript
// ❌ BAD: Vague assertions
expect(result).toBeTruthy();
expect(result).toBeDefined();
expect(result).toHaveProperty('data');
expect(array.length).toBeGreaterThan(0);

// ✅ GOOD: Specific assertions
expect(result).toBe(true);
expect(result.data.id).toBe('expected-id');
expect(result.data.score).toBeCloseTo(0.95, 2);
expect(array).toHaveLength(3);
expect(array[0].name).toBe('first-item');
```

---

## References

When you need patterns for:

- **Typed mocking with vitest**: See `docs/architecture/typescript/TEST_PATTERNS.md`
- **Zod schema testing**: See `docs/architecture/typescript/TEST_PATTERNS.md` Pattern 5
- **Finding untested files**: See `docs/architecture/typescript/TEST_COVERAGE_REPORT.md`
- **Property-based testing examples**: See `tests/unit/sora-safety-filtering.property.test.ts`
- **Service test examples**: See `server/src/services/storage/__tests__/StorageService.test.ts`

---

## Self-Check Before Submitting

For every test you write, verify:

| Check | Required |
|-------|----------|
| Can this test fail if implementation is deleted? | YES |
| Are error cases tested? | YES |
| Are edge cases (null, empty, boundary) tested? | YES |
| Do assertions check specific values, not just structure? | YES |
| Is mock verification accompanied by outcome assertions? | YES |
| Are happy path tests the minority? | YES |

If any check fails, rewrite the test before submitting.
