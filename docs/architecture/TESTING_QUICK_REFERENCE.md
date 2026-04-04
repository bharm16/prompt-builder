# Testing Quick Reference Card

## 🚫 NEVER Do This

```javascript
// ❌ Mock fetch directly
global.fetch = vi.fn();

// ❌ Test implementation details
expect(component.state.value).toBe("test");

// ❌ Test CSS classes
expect(container).toHaveClass("flex-col");

// ❌ Module-level mocking in services
vi.mock("../SomeService");
```

## ✅ ALWAYS Do This

```javascript
// ✅ Mock at service boundaries
const mockService = { getData: vi.fn() };

// ✅ Test user behavior
await user.click(screen.getByRole("button"));
expect(screen.getByText("Success")).toBeInTheDocument();

// ✅ Constructor dependency injection
new Service({ dependency: mockDependency });

// ✅ Clear AAA pattern
// Arrange
const input = "test";
// Act
const result = doSomething(input);
// Assert
expect(result).toBe("expected");
```

## Test Structure Formula

### Frontend (React)

```javascript
describe("Component", () => {
  let mockService;

  beforeEach(() => {
    mockService = { method: vi.fn() };
  });

  const renderComponent = (props = {}) => {
    return render(<Component service={mockService} {...props} />);
  };

  it("should [behavior] when [user action]", async () => {
    // Arrange
    const user = userEvent.setup();
    renderComponent();

    // Act
    await user.click(screen.getByRole("button"));

    // Assert
    expect(screen.getByText("Result")).toBeInTheDocument();
  });
});
```

### Backend (Service)

```javascript
describe("Service", () => {
  let service;
  let mockDependency;

  beforeEach(() => {
    mockDependency = { method: vi.fn() };
    service = new Service({ dependency: mockDependency });
  });

  it("should [result] when [condition]", async () => {
    // Arrange
    mockDependency.method.mockResolvedValue("data");

    // Act
    const result = await service.doSomething();

    // Assert
    expect(result).toBe("expected");
    expect(mockDependency.method).toHaveBeenCalled();
  });
});
```

## Coverage Priorities

1. **User flows** - Complete happy paths
2. **Error handling** - What goes wrong
3. **Edge cases** - Null, undefined, empty
4. **Accessibility** - Keyboard, screen readers
5. **Performance** - Timeouts, concurrency

## Test Naming

```javascript
// ✅ Good - Describes behavior
it("should show error message when form is submitted without required fields");

// ❌ Bad - Vague
it("should work correctly");
```

## Commands

```bash
# Run specific test
npm test -- ComponentName

# With coverage
npm test -- --coverage ComponentName

# Watch mode
npm test -- --watch

# Update snapshots
npm test -- -u
```

## Gold Standard Examples

- **Frontend:** `EXAMPLE_FRONTEND_TEST.test.jsx`
- **Backend:** `EXAMPLE_BACKEND_TEST.test.js`

---

_Print this and keep it visible while writing tests_
