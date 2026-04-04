---
name: api-doc
description: Regenerate the OpenAPI spec from route definitions and validate route coverage against the documented route table in CLAUDE.md.
disable-model-invocation: true
---

## API Documentation Workflow

### Step 1: Regenerate OpenAPI Spec

Run the spec generator:

```bash
npx tsx scripts/generate-openapi.ts
```

If this fails, investigate the error — likely a missing import or type issue in `server/src/openapi/spec.ts`.

### Step 2: Validate Route Coverage

Compare the generated spec against the route table documented in `CLAUDE.md` (under "Route -> Service -> Client API Map").

For each route in the CLAUDE.md table, verify:

1. The route exists in the generated OpenAPI spec
2. The HTTP method matches
3. The route path matches

For each route in the OpenAPI spec, verify:

1. It is documented in the CLAUDE.md table
2. It has a corresponding client API file listed

### Step 3: Check for Undocumented Routes

Scan all route registration files for routes not in the spec:

```bash
grep -rn 'router\.\(get\|post\|put\|patch\|delete\)' server/src/routes/ --include='*.ts'
```

Cross-reference against the OpenAPI spec output. Flag any routes that exist in code but are missing from the spec.

### Step 4: Report

```
## API Documentation Report

### Spec Generation: PASS/FAIL

### Coverage Summary
- Routes in CLAUDE.md table: N
- Routes in OpenAPI spec: N
- Routes in code: N

### Missing from OpenAPI spec
[List routes found in code but not in spec]

### Missing from CLAUDE.md
[List routes found in spec but not in the documentation table]

### Undocumented Client APIs
[List routes that have no client API file listed]
```

### Step 5: Update CLAUDE.md (If Gaps Found)

If new routes were found that are missing from the CLAUDE.md route table, update the table to include them. Follow the existing format:

```
| Route | Server Route File | Client API/Service |
```

Do NOT remove existing entries — only add missing ones.
