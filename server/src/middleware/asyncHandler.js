/**
 * Wrapper for async route handlers
 * Automatically catches errors and passes to error middleware
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
