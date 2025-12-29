# Model-Specific Prompt Optimization Guide (Advanced)

This document provides a detailed technical breakdown of prompt engineering requirements for leading AI video generation models. This data serves as the specification for the "Model-Specific Optimization" engine in the Prompt Builder.

---

## 1. Runway Gen-4.5 Alpha

Runway Gen-4.5 Alpha is the current #1 ranked video model (as of Dec 2025). It uses an **Autoregressive-to-Diffusion (A2D)** architecture for unprecedented physical accuracy and character expression.

### Technical Constraints
*   **Character Limit:** 1000 characters.
*   **Negative Prompts:** **Not Supported.** Use positive environmental descriptions.
*   **Architecture:** A2D (NVIDIA-backed).

### Core Syntax
Recommended format:
`[camera movement]: [establishing scene]. [subject details]. [lighting & atmosphere].`

---

## 2. Kling AI (2.6 / O1 / MemFlow)

Kling 2.6 (Dec 2025) is the first to feature **Native Audio** generation and the **MemFlow** dynamic memory mechanism for narrative coherence in long videos.

### Technical Constraints
*   **Aspect Ratios:** Native support for `16:9`, `9:16`, `1:1`.
*   **Negative Prompts:** Fully supported via a separate field.
*   **Consistent Characters:** Kling O1 supports multi-angle reference images.

### Core Structure (The 4-Layer Rule)
1.  **Subject:** Physical appearance, posture, clothing.
2.  **Action:** Specific motion (e.g., "running with high knees").
3.  **Context:** Setting, weather, time of day.
4.  **Style:** Cinematic genre (e.g., "Film Noir", "80s VHS").

---

## 3. Luma AI (Ray-3)

Luma Ray-3 (Sept 2025) is a reasoning-driven model that can "think" through scene descriptions to refine results.

### Technical Constraints
*   **HDR Pipeline:** First-to-market native 16-bit High Dynamic Range generation.
*   **Draft Mode:** High-speed preview generation.
*   **Keyframes:** Advanced first/middle/last frame control.

### Key Features
*   **Reasoning-Driven:** Automatically evaluates its own outputs for prompt adherence.
*   **Modify Video:** Supports character reference and complex video-to-video transformations.

---

## 4. Pika Labs (Pika 2.2 / 3.0)

Pika 2.2 (June 2025) and the 3.0 preview focus on **Pikaswaps** (video inpainting) and **Pikadditions**.

### Technical Parameters
| Parameter | Description | Values |
| :--- | :--- | :--- |
| `-fps` | Frames per second | `8 - 60` |
| `-motion` | Motion intensity | `0 - 4` |
| `-gs` | Guidance Scale | `8 - 24` |
| `-neg` | Negative Prompt | Space-separated keywords |
| `-ar` | Aspect Ratio | `16:9`, `9:16`, `1:1`, `4:5` |

---

## 5. MiniMax (Hailuo 2.3 Fast / 3.0)

Hailuo 2.3 Fast is optimized for "super-fast" 30-second turnaround for 6-second clips.

### Core Formula
`[Camera Shot + Motion] + [Subject + Description] + [Action] + [Scene + Description] + [Lighting] + [Style/Aesthetic] + [Atmosphere]`

---

## 6. Mochi 1.5 (Genmo)

Mochi 1.5 is the upgraded open-source model (Apache 2.0) with improved 720p/1080p photorealism.

---

## 7. HunYuan Video (Tencent 2.0/2.5)

HunyuanVideo 2.0 (Sept 2025) introduced the `image_embed_interlaved` algorithm for high-fidelity Img2Video.

---

## 8. Vidu AI (2.5 / Q3)

Vidu Q3 (Dec 2025) features advanced emotional reasoning and complex "Pedestal" shot support.

---

## 9. Wan (Wan 2.6 / 3.0)

Wan 3.0 (Late 2025) introduced **First-to-Last Frame control** and native synchronized speech.

---

## 10. DeepSeek Janus-Pro (Multimodal)

Janus-Pro remains the primary multimodal bridge for high-detail descriptive prompt generation.

---

## 11. Sora 2 (OpenAI)

Sora 2 (Sept 2025) now includes a **Disney Licensed Character** module (Dec 2025) for select users.

---

## 12. Veo 3.1 / 4 (Google)

Veo 3.1/4 generates up to **60-second 4K** video with native synchronized audio.

---

## Summary of Strategy for Prompt Builder

| Feature | Runway | Kling | Luma | Pika | Hailuo | HunYuan | Wan |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Neg Prompt** | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Param Style** | Narrative | Layered | Reasoning | CLI | Formula | Master | MoE |
| **Motion Cap** | Ultra | Ultra | Ultra | High | Ultra | High | High |
| **Max Tokens** | 1000ch | High | High | Med | High | Ultra | High |

### Optimizer Logic:
1.  **Normalization:** Strip all existing parameters (`--ar`, `-motion`, etc.).
2.  **Expansion:** Use the "Reasoning-Driven Expansion" for Luma Ray-3 and Sora 2.
3.  **Structuring:** Reorder text into `Subject -> Action -> Scene -> Style` for Kling/Wan.
4.  **Parameterization:** Convert keywords like "widescreen" into `-ar 16:9` for Pika.
5.  **Quality Injection:** Append model-specific quality boosters (e.g., "HDR Cinematic" for Luma, "A2D Photorealism" for Runway).

---

## Project-Based Prioritization (Current Codebase)

### Start Here (Best Fit)
1.  **Runway Gen-4.5 Alpha:** Narrative prompts, A2D architecture.
2.  **Luma Ray-3:** Reasoning-driven prompting; aligns with narrative expansion.
3.  **Kling AI 2.6:** Structured 4-layer rule + Native Audio.
4.  **Sora 2 + Veo 3.1/4:** Standard narrative targets with 60s/4K support.

### Hold Off / Later
1.  **Pika 2.2/3.0:** Requires CLI-style parameterization and explicit inpainting/addition fields.
2.  **MiniMax (Hailuo 2.3 Fast):** Fast-path workflow.
3.  **Wan 3.0:** First-to-Last frame logic.
4.  **Vidu Q3:** Emotional reasoning focus.
5.  **DeepSeek Janus-Pro:** Multimodal bridge tool.
6.  **Mochi 1.5:** Open-source photoreal focus.
