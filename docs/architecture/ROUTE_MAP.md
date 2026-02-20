# Route → Service → Client API Map

Use this table to find the correct client-side file for a given backend route. If no client file exists, create one following the existing pattern (thin wrapper in `api/` or stateful client in `services/`).

| Route | Server Route File | Client API/Service |
|-------|-------------------|--------------------|
| `POST /api/optimize-stream` | `optimize.routes.ts` | `services/PromptOptimizationApi.ts` |
| `POST /api/enhance`, `POST /api/suggestions` | `enhancement.routes.ts`, `suggestions.ts` | `services/EnhancementApi.ts` |
| `POST /llm/label-spans` | `labelSpansRoute.ts` | `features/span-highlighting/api/spanLabelingApi.ts` |
| `/api/preview/*` | `preview.routes.ts` | `features/preview/api/` |
| `/api/payment/*` | `payment.routes.ts` | `api/billingApi.ts` |
| `/api/motion/*` | `motion.routes.ts` | `api/motionApi.ts` |
| `/api/storage/*` | `storage.routes.ts` | `api/storageApi.ts` |
| `/api/capabilities` | `capabilities.routes.ts` | `services/CapabilitiesApi.ts` |
| `/api/continuity/*` | `continuity.routes.ts` | `features/continuity/api/` |
| `/api/model-intelligence/*` | `model-intelligence.routes.ts` | `features/model-intelligence/api/` |
| `/api/sessions/*` | `sessions.routes.ts` | (no dedicated client — uses ApiClient directly) |
| `/api/video/*` | `video.routes.ts` | `services/VideoConceptApi.ts` |
| `/api/assets/*` | `asset.routes.ts` | `features/assets/` |
| `/api/reference-images/*` | `reference-images.routes.ts` | `features/reference-images/` |
| `/health` | `health.routes.ts` | (not called from client) |

## Rules

- API calls never go directly in React components. Use `client/src/api/` for thin fetch wrappers or `client/src/services/` for stateful clients with caching/retry.
- Feature-scoped APIs live in `client/src/features/<name>/api/`.
- Server route handlers are thin — all business logic in `server/src/services/`.
