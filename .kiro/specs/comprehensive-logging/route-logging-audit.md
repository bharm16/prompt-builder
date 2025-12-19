# Route Logging Audit Report

## Summary

This document audits all route files in `server/src/routes/` to identify gaps in logging coverage according to Requirements 2.1-2.7.

## Audit Criteria

For each route, we check:
- ✅ Request received logging (info level with requestId, method, path)
- ✅ Response sent logging (info level with requestId, status, duration)
- ✅ Operation start logging (debug level)
- ✅ Error logging (error level with Error object and request context)
- ✅ Handled error logging (warn level with error details in meta)
- ✅ Sanitized headers (no sensitive data)
- ✅ Trace ID propagation

## Route Files Analysis

### 1. api.routes.js

**Status**: ✅ GOOD - Most routes have comprehensive logging

**Endpoints Analyzed**:

#### POST /api/optimize
- ✅ Request received: Yes (info level with requestId, operation, prompt length, mode, context flags)
- ✅ Response sent: Yes (info level with duration, input/output lengths)
- ✅ Operation start: Implicit via request received log
- ✅ Error logging: Yes (error level with Error object, duration, context)
- ⚠️ Handled errors: N/A (no try-catch with graceful handling)
- ✅ Sanitization: Yes (only logs lengths, not content)

#### POST /api/optimize-stream
- ✅ Request received: Yes (info level with requestId, operation, prompt length, mode, context flags)
- ✅ Response sent: Yes (info level with duration, usedFallback flag)
- ✅ Operation start: Implicit via request received log
- ✅ Error logging: Yes (error level with Error object, duration, context)
- ⚠️ Handled errors: N/A (no try-catch with graceful handling)
- ✅ Sanitization: Yes (only logs lengths, not content)

#### POST /api/video/suggestions
- ✅ Request received: Yes (info level with requestId, operation, element type, context flags)
- ✅ Response sent: Yes (info level with duration, suggestion count)
- ✅ Operation start: Implicit via request received log
- ✅ Error logging: Yes (error level with Error object, duration, context)
- ⚠️ Handled errors: N/A (no try-catch with graceful handling)
- ✅ Sanitization: Yes (only logs flags and counts)

#### POST /api/video/validate
- ❌ Request received: No
- ❌ Response sent: No
- ❌ Operation start: No
- ❌ Error logging: No (relies on asyncHandler)
- ❌ Handled errors: No
- ❌ Sanitization: N/A

#### POST /api/video/complete
- ❌ Request received: No
- ❌ Response sent: No
- ❌ Operation start: No
- ❌ Error logging: No (relies on asyncHandler)
- ❌ Handled errors: No
- ❌ Sanitization: N/A

#### POST /api/video/variations
- ❌ Request received: No
- ❌ Response sent: No
- ❌ Operation start: No
- ❌ Error logging: No (relies on asyncHandler)
- ❌ Handled errors: No
- ❌ Sanitization: N/A

#### POST /api/video/parse
- ❌ Request received: No
- ❌ Response sent: No
- ❌ Operation start: No
- ❌ Error logging: No (relies on asyncHandler)
- ❌ Handled errors: No
- ❌ Sanitization: N/A

#### POST /api/video/semantic-parse
- ✅ Request received: Yes (info level with requestId, operation, text length)
- ✅ Response sent: Yes (info level with duration, span count)
- ✅ Operation start: Implicit via request received log
- ✅ Error logging: Yes (error level with Error object, duration, context)
- ⚠️ Handled errors: Partial (catches error but doesn't use warn level)
- ✅ Sanitization: Yes (only logs text length)

#### POST /api/get-enhancement-suggestions
- ✅ Request received: Yes (info level with requestId, operation, lengths, category, context flags)
- ✅ Response sent: Yes (info level with duration, suggestion count, cache hit, category)
- ✅ Operation start: Implicit via request received log
- ✅ Error logging: Yes (error level with Error object, duration, context)
- ⚠️ Handled errors: N/A (no try-catch with graceful handling)
- ✅ Sanitization: Yes (only logs lengths and flags)

#### POST /api/get-custom-suggestions
- ✅ Request received: Yes (info level with requestId, operation, text lengths)
- ✅ Response sent: Yes (info level with duration, suggestion count)
- ✅ Operation start: Implicit via request received log
- ✅ Error logging: Yes (error level with Error object, duration, context)
- ⚠️ Handled errors: N/A (no try-catch with graceful handling)
- ✅ Sanitization: Yes (only logs lengths)

#### POST /api/detect-scene-change
- ❌ Request received: No
- ❌ Response sent: No
- ❌ Operation start: No
- ❌ Error logging: No (relies on asyncHandler)
- ❌ Handled errors: No
- ❌ Sanitization: N/A

#### GET /api/test-nlp
- ❌ Request received: No
- ❌ Response sent: No
- ❌ Operation start: No
- ❌ Error logging: No (relies on asyncHandler)
- ❌ Handled errors: No
- ❌ Sanitization: N/A

**Missing Logging**: 7 endpoints need logging added

---

### 2. health.routes.js

**Status**: ✅ EXCELLENT - All routes have appropriate logging

**Endpoints Analyzed**:

#### GET /health
- ✅ Request received: Yes (debug level with requestId, operation)
- ✅ Response sent: Implicit (simple health check)
- ✅ Operation start: Yes (debug level)
- ⚠️ Error logging: N/A (no error handling needed)
- ⚠️ Handled errors: N/A
- ✅ Sanitization: N/A

#### GET /health/ready
- ✅ Request received: Yes (debug level with requestId, operation)
- ✅ Response sent: Yes (info level with duration, status, checks)
- ✅ Operation start: Yes (debug level)
- ⚠️ Error logging: N/A (wrapped in asyncHandler)
- ⚠️ Handled errors: N/A
- ✅ Sanitization: N/A

#### GET /health/live
- ✅ Request received: Yes (debug level with requestId, operation)
- ✅ Response sent: Implicit (simple liveness check)
- ✅ Operation start: Yes (debug level)
- ⚠️ Error logging: N/A (no error handling needed)
- ⚠️ Handled errors: N/A
- ✅ Sanitization: N/A

#### GET /metrics
- ⚠️ Request received: No (but protected endpoint, minimal logging acceptable)
- ⚠️ Response sent: No
- ⚠️ Operation start: No
- ⚠️ Error logging: No (wrapped in asyncHandler)
- ⚠️ Handled errors: N/A
- ✅ Sanitization: N/A

#### GET /stats
- ✅ Request received: Yes (debug level with requestId, operation)
- ✅ Response sent: Yes (info level with duration)
- ✅ Operation start: Yes (debug level)
- ⚠️ Error logging: N/A (no error handling)
- ⚠️ Handled errors: N/A
- ✅ Sanitization: N/A

#### GET /debug-sentry
- ⚠️ Request received: No (test endpoint, acceptable)
- ⚠️ Response sent: N/A (throws error)
- ⚠️ Operation start: No
- ⚠️ Error logging: N/A (intentional error)
- ⚠️ Handled errors: N/A
- ✅ Sanitization: N/A

**Missing Logging**: None critical (GET /metrics could use minimal logging)

---

### 3. labelSpansRoute.ts

**Status**: ✅ GOOD - Has comprehensive logging

**Endpoints Analyzed**:

#### POST /label-spans
- ✅ Request received: Yes (debug level with requestId, operation, text length, params)
- ✅ Response sent: Yes (info level with duration, span count, cache hit, API time)
- ✅ Operation start: Yes (debug level)
- ✅ Error logging: Yes (error level with Error object, duration, context)
- ⚠️ Handled errors: N/A (no graceful error handling)
- ✅ Sanitization: Yes (only logs text length, not content)
- ✅ Cache logging: Yes (separate debug log for cache hits)

**Missing Logging**: None

---

### 4. preview.routes.ts

**Status**: ✅ GOOD - Has comprehensive logging

**Endpoints Analyzed**:

#### POST /api/preview/generate
- ✅ Request received: Yes (debug level with requestId, operation, userId, prompt length, aspect ratio)
- ✅ Response sent: Yes (info level with duration, userId)
- ✅ Operation start: Yes (debug level)
- ✅ Error logging: Yes (error level with Error object, duration, context, status code)
- ⚠️ Handled errors: Partial (catches errors but doesn't use warn for handled cases)
- ✅ Sanitization: Yes (only logs prompt length and preview substring)

**Missing Logging**: None

---

### 5. roleClassifyRoute.ts

**Status**: ✅ EXCELLENT - Has comprehensive logging

**Endpoints Analyzed**:

#### POST /role-classify
- ✅ Request received: Yes (debug level with requestId, operation)
- ✅ Response sent: Yes (info level with duration, span counts, template version)
- ✅ Operation start: Yes (debug level)
- ✅ Error logging: Yes (error level with Error object, duration)
- ✅ Handled errors: Yes (warn level for invalid requests with error details in meta)
- ✅ Sanitization: Yes (only logs counts and flags)
- ✅ Additional logging: Yes (debug logs for span processing steps)

**Missing Logging**: None

---

### 6. suggestions.js

**Status**: ✅ GOOD - Has comprehensive logging

**Endpoints Analyzed**:

#### POST /api/suggestions/evaluate
- ✅ Request received: Yes (debug level with requestId, operation, suggestion count, rubric, flags)
- ✅ Response sent: Yes (info level with duration, overall score)
- ✅ Operation start: Yes (debug level)
- ✅ Error logging: Yes (error level with Error object, duration)
- ⚠️ Handled errors: N/A (validation errors return early)
- ✅ Sanitization: Yes (only logs counts and flags)

#### POST /api/suggestions/evaluate/single
- ✅ Request received: Yes (debug level with requestId, operation, suggestion length, rubric)
- ✅ Response sent: Yes (info level with duration, overall score)
- ✅ Operation start: Yes (debug level)
- ❌ Error logging: Partial (logs error but doesn't pass Error object correctly)
- ⚠️ Handled errors: N/A
- ✅ Sanitization: Yes (only logs lengths)

#### POST /api/suggestions/evaluate/compare
- ✅ Request received: Yes (debug level with requestId, operation, set counts)
- ✅ Response sent: Yes (info level with duration, winner, score difference)
- ✅ Operation start: Yes (debug level)
- ❌ Error logging: Partial (logs error but doesn't pass Error object correctly)
- ⚠️ Handled errors: N/A
- ✅ Sanitization: Yes (only logs counts)

#### GET /api/suggestions/evaluate/rubrics
- ❌ Request received: No
- ❌ Response sent: No
- ❌ Operation start: No
- ❌ Error logging: No
- ⚠️ Handled errors: N/A
- ✅ Sanitization: N/A

**Missing Logging**: 1 endpoint needs logging, 2 endpoints need error logging fixes

---

## Summary of Findings

### Routes with Complete Logging
1. ✅ health.routes.js - All endpoints properly logged
2. ✅ labelSpansRoute.ts - Comprehensive logging
3. ✅ roleClassifyRoute.ts - Excellent logging with child logger
4. ✅ preview.routes.ts - Good logging coverage

### Routes Needing Logging Additions

#### api.routes.js
**Missing logging in 7 endpoints**:
1. POST /api/video/validate
2. POST /api/video/complete
3. POST /api/video/variations
4. POST /api/video/parse
5. POST /api/detect-scene-change
6. GET /api/test-nlp
7. GET /metrics (health.routes.js) - optional

#### suggestions.js
**Issues in 3 endpoints**:
1. POST /api/suggestions/evaluate/single - Fix error logging (not passing Error object)
2. POST /api/suggestions/evaluate/compare - Fix error logging (not passing Error object)
3. GET /api/suggestions/evaluate/rubrics - Add basic logging

### Common Patterns Found

**Good Patterns**:
- Most routes use `performance.now()` for timing
- Most routes include `requestId` from request
- Most routes log operation name consistently
- Most routes sanitize data (log lengths, not content)

**Issues to Fix**:
- Some routes rely solely on asyncHandler for error logging
- Some error handlers don't pass Error object correctly to logger.error()
- Some simple GET endpoints lack any logging
- No routes currently use warn() for handled errors (acceptable for most cases)

## Recommendations

### Priority 1: Add logging to missing endpoints in api.routes.js
- POST /api/video/validate
- POST /api/video/complete
- POST /api/video/variations
- POST /api/video/parse
- POST /api/detect-scene-change
- GET /api/test-nlp

### Priority 2: Fix error logging in suggestions.js
- POST /api/suggestions/evaluate/single
- POST /api/suggestions/evaluate/compare

### Priority 3: Add minimal logging to simple endpoints
- GET /api/suggestions/evaluate/rubrics
- GET /metrics (optional)

## Requirements Coverage

- ✅ Requirement 2.1: Most routes log request received with requestId, method, path
- ✅ Requirement 2.2: Most routes log response sent with requestId, status, duration
- ✅ Requirement 2.3: Most routes log operation start (debug level)
- ⚠️ Requirement 2.4: Most routes log errors, but some need fixes
- ⚠️ Requirement 2.5: Few routes use warn for handled errors (acceptable pattern)
- ✅ Requirement 2.6: All routes sanitize sensitive data appropriately
- ⚠️ Requirement 2.7: Trace ID propagation not explicitly implemented (uses requestId)

## Next Steps

Proceed to subtask 4.2 to add logging to the identified routes.
