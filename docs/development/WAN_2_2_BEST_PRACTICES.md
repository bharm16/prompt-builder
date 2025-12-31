# Wan 2.2 Text-to-Video Best Practices (December 2025)

This guide outlines the best practices for prompting and API integration for the **Wan 2.2** model (developed by Alibaba/Wanx).

## 1. Model Overview
Wan 2.2 is an advanced Mixture-of-Experts (MoE) video generation model that excels in technical instruction adherence, particularly for camera movements and lighting.

*   **Optimal Duration:** 5-8 seconds (5s recommended for 1080p).
*   **Strengths:** Precise camera control, high-quality negative prompt enforcement, and intelligent prompt extension.
*   **Architecture:** 5B Hybrid MoE model.

---

## 2. Prompting Strategy
Wan 2.2 performs best when prompts follow a structured, cinematic narrative rather than a list of keywords.

### The Recommended Structure
`[Subject & Action] + [Environment/Scene] + [Camera Movement] + [Lighting & Style]`

*   **Subject:** Describe the main focus and its specific motion (e.g., "A golden retriever puppy jumping into a pile of autumn leaves").
*   **Environment:** Detail both foreground and background to give the model depth cues (e.g., "Background: a blurry red farmhouse. Foreground: crisp, colorful fallen leaves").
*   **Camera Movements:** Use technical terms. Wan 2.2 is highly responsive to:
    *   `Pan left/right`
    *   `Tilt up/down`
    *   `Dolly in/out` (Zooming in/out while moving the camera)
    *   `Orbital arc` (Moving in a circle around the subject)
    *   `Crane shot` (Rising vertically while looking down)
*   **Visual Style:** Specify lighting and film stock (e.g., `Volumetric dusk lighting`, `Anamorphic lens bokeh`, `35mm film grain`).

### Golden Rules
1.  **Word Count:** Target 80–120 words for the most detailed results.
2.  **Negative Prompting:** Always use a negative prompt to avoid common AI artifacts.
    *   *Example:* `morphing, distorted, disfigured, text, watermark, low quality, blurry, static, extra limbs, fused fingers.`
3.  **Prompt Extension:** Enable the `prompt_extend` or `enhance_prompt` flag in the API to allow the model to enrich your input.

---

## 3. API Implementation
Wan 2.2 APIs (via Novita AI, AIMLAPI, etc.) typically follow an **asynchronous** pattern.

### Workflow
1.  **Submit:** Send a `POST` request with your prompt and parameters. Receive a `task_id` or `id`.
2.  **Poll:** Send a `GET` request using the ID every 5-10 seconds until the status is `completed`.

### Parameter Reference

| Parameter | Recommended Value | Description |
| :--- | :--- | :--- |
| `size` / `resolution` | `1280*720` (720p) | Optimal balance. 1080p is slower and often limited to 5s. |
| `duration` | `5` | Higher stability; 8s is supported but prone to "morphing". |
| `prompt_extend` | `true` | Highly recommended to use the model's internal optimizer. |
| `aspect_ratio` | `16:9` | Standard cinematic ratio. |

### cURL Example (Novita AI)
```bash
curl --request POST \
  --url https://api.novita.ai/v3/async/wan-2.2-t2v \
  --header 'Authorization: Bearer <YOUR_API_KEY>' \
  --header 'Content-Type: application/json' \
  --data 
    {
      "input": {
        "prompt": "Cinematic orbital arc around a cyberpunk hacker in a rainy neon city, typing on a holographic interface, 4k, photorealistic.",
        "negative_prompt": "low quality, blurry, static, text, watermark"
      },
      "parameters": {
        "size": "1280*720",
        "duration": 5,
        "prompt_extend": true
      }
    }
```

### Python Example (Generic Async)
```python
import requests
import time

def generate_video(prompt, api_key):
    # 1. Submit
    res = requests.post(
        "https://api.your-provider.com/v2/video",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"prompt": prompt, "model": "wan-2.2-t2v", "enhance": True}
    )
    task_id = res.json()["id"]
    
    # 2. Poll
    while True:
        status_res = requests.get(f"https://api.your-provider.com/status/{task_id}")
        data = status_res.json()
        if data["status"] == "completed":
            return data["url"]
        elif data["status"] == "failed":
            raise Exception("Generation failed")
        time.sleep(10)
```