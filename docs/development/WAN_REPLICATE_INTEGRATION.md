# Wan 2.2 Replicate Integration Guide

This guide details the integration strategy for the **Wan 2.2 Text-to-Video** model hosted on Replicate (`wan-video/wan-2.2-t2v-fast`).

## 1. API Schema & Parameters

The Replicate implementation differs slightly from the direct Alibaba API. Key parameters include:

*   **`prompt`**: The narrative description (optimized to 80-120 words).
*   **`negative_prompt`**: Mandatory for quality (defaults provided).
*   **`size`**: The resolution string (e.g., "1280*720"). **Note:** Replicate uses `*` separator, not `x`.
*   **`num_frames`**: Defaults to `81` for optimal motion consistency.
*   **`frames_per_second`**: Defaults to `16` (cinematic standard for this model).
*   **`prompt_extend`**: Defaults to `true` to use the model's internal prompt enhancer.

## 2. Strategy Implementation (`WanReplicateStrategy`)

We have implemented a specialized strategy that:
1.  **Validates** input length (max 300 words).
2.  **Maps** standard aspect ratios (`16:9`, `9:16`, `1:1`) to Replicate-compatible `size` strings.
3.  **Structures** the prompt using the "Subject → Environment → Camera → Lighting" flow.
4.  **Augments** the prompt with specific triggers: `ultra-high definition`, `masterpiece`, `cinematic motion`, `volumetric lighting`, `4k`.

### Aspect Ratio Mapping

| Aspect Ratio | Replicate `size` |
| :--- | :--- |
| 16:9 | `1280*720` |
| 9:16 | `720*1280` |
| 1:1 | `1024*1024` |
| 4:3 | `1024*768` |
| 3:4 | `768*1024` |

## 3. Usage

```typescript
import { wanReplicateStrategy } from '@services/video-prompt-analysis/strategies';

// 1. Optimize Prompt
const context = { constraints: { formRequirement: '16:9' } };
const result = await wanReplicateStrategy.optimize(userPrompt, context);

// 2. Get API Payload
const payload = wanReplicateStrategy.getApiPayload(result.prompt, context);

// 3. Call Replicate
await replicate.run("wan-video/wan-2.2-t2v-fast", { input: payload });
```
