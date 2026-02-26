# Face-Swap Preprocessing Implementation Plan

> **Status:** Planned  
> **Created:** 2026-02-01  
> **Target:** Enable `startImage + characterAssetId` to produce character-consistent i2v

---

## Problem Statement

### Current Behavior

The video generation API has a gap when both `startImage` and `characterAssetId` are provided:

```typescript
// videoGenerate.ts lines 194-196
if (characterAssetId && autoKeyframe && !startImage) {
  // PuLID runs — but ONLY when startImage is absent
}
```

| Input Combination | Current Behavior |
|-------------------|------------------|
| `startImage` only | ✅ Direct i2v |
| `characterAssetId` only | ✅ PuLID generates keyframe → i2v |
| `startImage` + `characterAssetId` | ❌ `characterAssetId` silently ignored |

### Original Intent

The original design (pre-PuLID migration) supported both inputs via IP-Adapter FaceID Plus v2:

```typescript
// Legacy approach (removed)
ip_adapter_image: styleReferenceUrl,  // Composition/pose
face_image: characterReferenceUrl,    // Face identity
```

When we migrated to PuLID for better face identity, we lost the dual-input capability because PuLID only takes a face reference—it generates new images rather than compositing onto existing ones.

### User Need

Users want to: "Animate this specific pose/composition image, but with my character's face"

- `startImage` = pose, framing, environment, lighting reference
- `characterAssetId` = whose face should appear in the image

---

## Solution: Face-Swap Preprocessing

Insert a face-swap step before i2v when both inputs are present:

```
startImage + characterAssetId
        ↓
   Face-Swap (Easel AI)
        ↓
   Swapped Image (character face on startImage composition)
        ↓
   i2v Generation
```

### Why Face-Swap vs Other Approaches

| Approach | Pros | Cons |
|----------|------|------|
| **Face-Swap (chosen)** | Clean separation, uses existing composition exactly | Extra API call, ~2 credits |
| Chain PuLID → ControlNet | Could match pose | Complex, slower, loses exact composition |
| Provider-native (Runway/Kling) | No preprocessing | Only works on 2 providers |
| Make it an error | Simple | Blocks valid use case |

---

## Technical Design

### Provider Selection: Easel AI on fal.ai

**Model:** `easel-ai/advanced-face-swap`

**Why Easel over basic InsightFace:**
- Preserves full body likeness (skin tone, racial features), not just face
- Maintains target image's outfits, lighting, and style
- Better handling of occlusion, angles, lighting edge cases
- Commercial license compatible

**Why fal.ai over Replicate:**
- Already have `FAL_KEY` configured for PuLID
- Same auth mechanism, consistent error handling
- Single provider dependency for face-related preprocessing

### API Schema

```typescript
// Input
{
  face_image_0: string;      // Character's face (from characterAssetId)
  target_image: string;      // Composition reference (startImage)
  workflow_type: "user_hair" | "target_hair";  // Hair preservation mode
  upscale?: boolean;         // 2x upscale + quality boost (default: true)
  gender_0?: string;         // Optional: "male" | "female" | ""
}

// Output
{
  image: {
    url: string;
    content_type: string;
    width: number;
    height: number;
  }
}
```

---

## Implementation

### New Files

#### 1. `server/src/services/generation/providers/FalFaceSwapProvider.ts`

```typescript
/**
 * FalFaceSwapProvider
 * 
 * Face-swap preprocessing using Easel AI on fal.ai.
 * Composites a character's face onto a target composition image.
 */

export interface FaceSwapOptions {
  faceImageUrl: string;      // Source face (character reference)
  targetImageUrl: string;    // Target composition (pose/environment)
  preserveHair?: 'user' | 'target';  // Whose hair to keep (default: 'user')
  upscale?: boolean;         // Apply 2x upscale (default: true)
}

export interface FaceSwapResult {
  imageUrl: string;
  width: number;
  height: number;
  contentType: string;
}

export class FalFaceSwapProvider {
  private readonly apiKey: string | null;
  
  constructor(options?: { apiKey?: string });
  
  public isAvailable(): boolean;
  
  public async swapFace(options: FaceSwapOptions): Promise<FaceSwapResult>;
}
```

#### 2. `server/src/services/generation/FaceSwapService.ts`

```typescript
/**
 * FaceSwapService
 * 
 * Orchestrates face-swap preprocessing for character-consistent i2v.
 * Used when both startImage and characterAssetId are provided.
 */

export interface FaceSwapRequest {
  characterPrimaryImageUrl: string;
  targetCompositionUrl: string;
  aspectRatio?: string;
}

export interface FaceSwapResponse {
  swappedImageUrl: string;
  provider: 'easel';
  durationMs: number;
}

export class FaceSwapService {
  constructor(options?: { faceSwapProvider?: FalFaceSwapProvider });
  
  public isAvailable(): boolean;
  
  public async swap(request: FaceSwapRequest): Promise<FaceSwapResponse>;
}
```

### Modified Files

#### 1. `server/src/routes/preview/handlers/videoGenerate.ts`

Add face-swap branch to the preprocessing logic:

```typescript
// Line ~190, replace current logic with:

let resolvedStartImage = startImage;
let generatedKeyframeUrl: string | null = null;
let swappedImageUrl: string | null = null;
let keyframeCost = 0;
let faceSwapCost = 0;

if (startImage && characterAssetId) {
  // CASE 1: Both provided → Face-swap preprocessing
  if (!faceSwapService) {
    log.warn('Face-swap service unavailable', { requestId, characterAssetId });
    return res.status(400).json({
      success: false,
      error: 'Face-swap not available',
      message: 'Character + composition reference requires face-swap service. Use startImage alone for direct i2v, or characterAssetId alone for auto-keyframe.',
    });
  }

  const FACE_SWAP_CREDIT_COST = 2;
  const hasFaceSwapCredits = await userCreditService.reserveCredits(userId, FACE_SWAP_CREDIT_COST);
  if (!hasFaceSwapCredits) {
    return res.status(402).json({
      success: false,
      error: 'Insufficient credits',
      message: `Character-composition face-swap requires ${FACE_SWAP_CREDIT_COST} credits plus video credits.`,
    });
  }
  faceSwapCost = FACE_SWAP_CREDIT_COST;

  try {
    const characterData = await assetService.getAssetForGeneration(userId, characterAssetId);
    if (!characterData.primaryImageUrl) {
      await userCreditService.refundCredits(userId, faceSwapCost);
      return res.status(400).json({
        success: false,
        error: 'Character has no reference image',
        message: 'The character asset must have a reference image for face-swap.',
      });
    }

    log.info('Performing face-swap preprocessing', {
      requestId,
      characterAssetId,
      hasStartImage: true,
    });

    const swapResult = await faceSwapService.swap({
      characterPrimaryImageUrl: characterData.primaryImageUrl,
      targetCompositionUrl: startImage,
    });

    resolvedStartImage = swapResult.swappedImageUrl;
    swappedImageUrl = swapResult.swappedImageUrl;

    log.info('Face-swap completed', {
      requestId,
      characterAssetId,
      durationMs: swapResult.durationMs,
    });

  } catch (error) {
    await userCreditService.refundCredits(userId, faceSwapCost);
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Face-swap failed', error instanceof Error ? error : new Error(errorMessage), {
      requestId,
      characterAssetId,
    });
    return res.status(500).json({
      success: false,
      error: 'Face-swap failed',
      message: `Failed to composite character face: ${errorMessage}`,
    });
  }

} else if (characterAssetId && autoKeyframe && !startImage) {
  // CASE 2: Character only → PuLID keyframe (existing logic)
  // ... existing PuLID code unchanged ...

} else if (startImage) {
  // CASE 3: startImage only → Direct i2v (existing logic)
  resolvedStartImage = startImage;
}
```

#### 2. `server/src/routes/preview/videoRequest.ts`

No changes needed—already parses both fields.

#### 3. `server/src/services/index.ts` (or services config)

Add FaceSwapService to dependency injection:

```typescript
import { FalFaceSwapProvider } from './generation/providers/FalFaceSwapProvider';
import { FaceSwapService } from './generation/FaceSwapService';

// In service factory:
const faceSwapProvider = new FalFaceSwapProvider();
const faceSwapService = faceSwapProvider.isAvailable() 
  ? new FaceSwapService({ faceSwapProvider })
  : null;
```

#### 4. `server/src/routes/types.ts`

Add to `PreviewRoutesServices`:

```typescript
export interface PreviewRoutesServices {
  // ... existing
  faceSwapService?: FaceSwapService;
}
```

---

## Credit Costs

| Operation | Credits | When |
|-----------|---------|------|
| Face-swap preprocessing | 2 | `startImage + characterAssetId` |
| PuLID keyframe | 2 | `characterAssetId` only |
| Video generation | 15-80 | Always (varies by model/duration) |

**Example user flows:**

1. **Direct i2v:** 0 + 40 = **40 credits**
2. **Auto-keyframe:** 2 + 40 = **42 credits**
3. **Face-swap + i2v:** 2 + 40 = **42 credits**

---

## Response Schema Updates

Add new fields to video generation response:

```typescript
{
  success: true,
  data: {
    jobId: string;
    status: string;
    creditsReserved: number;
    creditsDeducted: number;
    
    // Existing
    keyframeGenerated: boolean;
    keyframeUrl: string | null;
    
    // NEW
    faceSwapApplied: boolean;
    faceSwapUrl: string | null;
  }
}
```

---

## Testing Plan

### Unit Tests

1. **FalFaceSwapProvider**
   - `isAvailable()` returns true when FAL_KEY set
   - `swapFace()` calls correct fal.ai endpoint
   - Handles API errors gracefully
   - Validates input URLs

2. **FaceSwapService**
   - Orchestrates provider correctly
   - Returns swapped image URL
   - Logs duration metrics

3. **videoGenerate handler**
   - `startImage + characterAssetId` → triggers face-swap
   - `characterAssetId` only → triggers PuLID (unchanged)
   - `startImage` only → direct i2v (unchanged)
   - Credit reservation/refund on failure
   - Error responses for missing services

### Integration Tests

1. Real fal.ai call with test images
2. End-to-end: upload character → provide composition → verify swapped output
3. Credit deduction verification

### Manual QA

1. Upload character asset with clear face
2. Provide composition image (e.g., movie scene, stock photo)
3. Verify:
   - Character's face appears in composition
   - Lighting/style of composition preserved
   - Video animates correctly from swapped frame

---

## Rollout Plan

### Phase 1: Implementation (1-2 days)
- [ ] Implement `FalFaceSwapProvider`
- [ ] Implement `FaceSwapService`
- [ ] Update `videoGenerate.ts` handler
- [ ] Add to service factory / DI

### Phase 2: Testing (1 day)
- [ ] Unit tests for new services
- [ ] Integration test with real fal.ai
- [ ] Manual QA with various face/composition combos

### Phase 3: Documentation (0.5 day)
- [ ] Update API.md with new behavior
- [ ] Add face-swap to capabilities docs
- [ ] Update client-side types if needed

### Phase 4: Deploy (0.5 day)
- [ ] Deploy to staging
- [ ] Verify FAL_KEY available in environment
- [ ] Smoke test face-swap flow
- [ ] Deploy to production

---

## Future Enhancements

1. **Provider fallback:** If fal.ai unavailable, try Replicate's `easel/advanced-face-swap`
2. **Quality presets:** Low (fast) vs High (upscaled) face-swap modes
3. **Multi-face support:** Handle compositions with multiple people
4. **Face validation:** Verify swap succeeded using face embedding similarity (like keyframe validation)

---

## References

- [Easel AI Advanced Face Swap - fal.ai](https://fal.ai/models/easel-ai/advanced-face-swap/api)
- [PuLID Keyframe Provider](../server/src/services/generation/providers/FalPulidKeyframeProvider.ts)
- [Video Generate Handler](../server/src/routes/preview/handlers/videoGenerate.ts)
- [Original IP-Adapter FaceID discussion](https://claude.ai/chat/b9a8bcf5-d76a-4c1b-8b85-2f4f0cf7252a)
