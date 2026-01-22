# Flux PuLID Integration

> PuLID (Pure Lightning ID) is the 2025/2026 standard for face identity preservation in Flux, replacing the legacy IP-Adapter FaceID Plus v2 approach.

## Overview

- **Endpoint**: `https://fal.run/fal-ai/flux-pulid`
- **Model ID**: `fal-ai/flux-pulid`
- **Category**: text-to-image with face identity
- **Kind**: inference

## Why PuLID over IP-Adapter?

| Feature | IP-Adapter FaceID | Flux PuLID |
|---------|-------------------|------------|
| Base Model | SDXL (legacy) | Flux (current) |
| Face Identity | Good | Excellent |
| Lighting Handling | Basic | Advanced |
| Inference Speed | Moderate | Fast on fal.ai |
| Style Integration | Limited | Native Flux quality |

## API Information

### Input Schema

- **`prompt`** (`string`, _required_): Text description of the image
- **`reference_images`** (`array[string]`, _required_): Array of face reference image URLs
- **`id_weight`** (`float`, _optional_): Identity preservation strength (0.0-1.0). Default: `0.8`
- **`width`** (`int`, _optional_): Image width. Default: `1344`
- **`height`** (`int`, _optional_): Image height. Default: `768`
- **`num_inference_steps`** (`int`, _optional_): Inference steps. Default: `28`
- **`guidance_scale`** (`float`, _optional_): CFG scale. Default: `7.5`
- **`negative_prompt`** (`string`, _optional_): Negative prompt
- **`seed`** (`int`, _optional_): Random seed for reproducibility

### Output Schema

```json
{
  "images": [
    {
      "url": "https://v3.fal.media/files/...",
      "width": 1344,
      "height": 768,
      "content_type": "image/webp"
    }
  ],
  "seed": 123456
}
```

## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://queue.fal.run/fal-ai/flux-pulid \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "A professional headshot of a person in a modern office, cinematic lighting",
    "reference_images": ["https://example.com/face-reference.jpg"],
    "id_weight": 0.8,
    "width": 1344,
    "height": 768
  }'
```

### JavaScript (Node.js)

```javascript
import { FalPulidKeyframeProvider } from '@services/generation/providers';

const provider = new FalPulidKeyframeProvider();

const result = await provider.generateKeyframe({
  prompt: "A professional headshot of a person in a modern office, cinematic lighting",
  faceImageUrl: "https://example.com/face-reference.jpg",
  aspectRatio: "16:9",
  idWeight: 0.8,
});

console.log(result.imageUrl);
```

## Configuration

Set the following environment variable:

```bash
FAL_KEY=your_fal_api_key_here
```

Get your API key at: https://fal.ai/dashboard/keys

## Service Integration

The `KeyframeGenerationService` automatically uses PuLID when `FAL_KEY` is configured:

```typescript
import KeyframeGenerationService from '@services/generation/KeyframeGenerationService';

const service = new KeyframeGenerationService();

// Check which provider is available
const provider = service.getAvailableProvider();
// Returns: 'pulid' | 'ip-adapter-legacy' | null

// Generate keyframe (uses PuLID if available)
const keyframe = await service.generateKeyframe({
  prompt: "Portrait in cinematic lighting",
  character: {
    primaryImageUrl: "https://example.com/face.jpg",
  },
  aspectRatio: "16:9",
  faceStrength: 0.8,
});
```

## Fallback Behavior

If `FAL_KEY` is not configured but `REPLICATE_API_TOKEN` is available, the service falls back to the legacy IP-Adapter FaceID Plus v2 approach. A warning is logged when this happens:

```
WARN: Using legacy IP-Adapter. Consider configuring FAL_KEY for better results with PuLID.
```

## Best Practices

1. **ID Weight**: Start with 0.8 and adjust based on results
   - Lower (0.6-0.7): More creative freedom, softer likeness
   - Higher (0.9-1.0): Stronger likeness, less creative variation

2. **Reference Images**: Use clear, well-lit face photos
   - Front-facing preferred
   - Neutral expression works best
   - Multiple angles can improve results

3. **Prompts**: Be specific about the context
   - Include lighting descriptions
   - Specify camera angle if needed
   - Quality terms are automatically added

## Additional Resources

- [fal.ai PuLID Model](https://fal.ai/models/fal-ai/flux-pulid)
- [fal.ai Documentation](https://docs.fal.ai)
- [PuLID Paper](https://arxiv.org/abs/2404.16022)
