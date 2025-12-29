# Model-Specific Prompt Optimization Guide (Advanced)

This document provides a detailed technical breakdown of prompt engineering requirements for leading AI video generation models. This data serves as the specification for the "Model-Specific Optimization" engine in the Prompt Builder.

---

## 1. Runway Gen-3 Alpha

Runway Gen-3 Alpha is highly sensitive to structure and favors cinematic terminology over raw technical parameters.

### Technical Constraints
*   **Character Limit:** 1000 characters.
*   **Negative Prompts:** **Not Supported.** Using negative words (e.g., "no", "without") often triggers the model to *include* that element.
*   **Optimization Strategy:** Convert negative constraints into positive environmental descriptions.

### Core Syntax
Recommended format:
`[camera movement]: [establishing scene]. [subject details]. [lighting & atmosphere].`

---

## 2. Kling AI

Kling AI is a structured model that benefits from clear separation of elements and supports native negative prompting.

### Technical Constraints
*   **Aspect Ratios:** Native support for `16:9`, `9:16`, `1:1`.
*   **Negative Prompts:** Fully supported via a separate field or specific keywords at the end.
*   **Motion Control:** Handled via descriptive verbs and "Camera Language" modifiers.

### Core Structure (The 4-Layer Rule)
1.  **Subject:** Physical appearance, posture, clothing.
2.  **Action:** Specific motion (e.g., "running with high knees").
3.  **Context:** Setting, weather, time of day.
4.  **Style:** Cinematic genre (e.g., "Film Noir", "80s VHS").

---

## 3. Luma Dream Machine

Luma emphasizes natural language "conversations" and sophisticated temporal transitions.

### Technical Constraints
*   **Negative Prompts:** Discouraged. Like Runway, it performs better with positive descriptions.
*   **Transitions:** Supports "Keyframes" (Start Image + End Image).
*   **Max Length:** 5 seconds (standard), extendable to 9+ seconds.

### Key Features
*   **Looping:** Native support via the keyword `loop` or `looping video`.
*   **Enhance Prompt:** Luma has an internal expansion engine; if this is off, the prompt must be extremely detailed.

---

## 4. Pika Labs (Pika 2.0)

Pika is unique for its "Command Line" style parameter system appended to the end of prompts.

### Technical Parameters
| Parameter | Description | Values |
| :--- | :--- | :--- |
| `-fps` | Frames per second | `8 - 24` (Default: 24) |
| `-motion` | Motion intensity | `0 - 4` (Default: 1) |
| `-gs` | Guidance Scale | `8 - 24` (Default: 12) |
| `-neg` | Negative Prompt | Space-separated keywords |
| `-ar` | Aspect Ratio | `16:9`, `9:16`, `1:1`, `4:5` |

### Special Effects (Pikaffects)
Pika 2.0 supports specific transformation keywords:
`crush it`, `melt it`, `inflate it`, `cake-ify it`, `explode it`.

---

## 5. MiniMax (Hailuo AI)

Hailuo AI is currently one of the highest-rated models for motion fidelity and instruction following.

### Core Formula
`[Camera Shot + Motion] + [Subject + Description] + [Action] + [Scene + Description] + [Lighting] + [Style/Aesthetic] + [Atmosphere]`

### Advanced Control (Hailuo 02)
*   **Camera Prompting:** Supports direct commands like `walk-right`, `zoom-in`.
*   **Scene Anchoring:** Better at maintaining object positions compared to earlier models.

---

## 6. Mochi 1 (Genmo)

Mochi 1 is an open-source model (Apache 2.0) with 10B parameters, optimized for photorealism.

### Technical Constraints
*   **Architecture:** Asymmetric Diffusion Transformer (AsymmDiT).
*   **Resolution:** 480p (initial), 720p (planned).
*   **Duration:** 5.4 seconds at 30 fps.
*   **Strength:** Excellent adherence to complex motion instructions.
*   **Weakness:** Poor performance with animation/stylized content; strictly photoreal.

---

## 7. HunYuan Video (Tencent)

Tencent's large-scale open-source model which benefits from "Prompt Rewriting" logic.

### Optimization Strategy
*   **Rewrite Model:** HunYuan has a built-in "Master Mode" that prioritizes composition and lighting over raw semantic detail.
*   **Subject First:** Prompts should always start with the subject and immediately follow with the scene.
*   **Cinematography:** Responds exceptionally well to specific lens descriptions (e.g., "anamorphic lens", "bokeh").

---

## 8. Vidu AI

Vidu is a powerful model emphasizing emotional depth and multi-entity consistency.

### Best Practices
*   **Emotional Detail:** Describe the *reason* for an expression (e.g., "tears of joy as she sees her long-lost brother").
*   **Reference Integration:** Optimized for "Character Reference" and "Start/End Frame" consistency.
*   **Shot Types:** Supports complex "Pedestal shots" (straight up/down movement).

---

## 9. Wan2.1

Wan2.1 uses a highly structured "Dimension-based" prompting system.

### Advanced Formulas
*   **Transformation Formula:** `[Subject A] + [Transformation Process] + [Subject B] + [Scene] + [Motion]...`
*   **Camera Movement Formula:** Prepend the camera description to the very beginning of the prompt.
*   **Length:** Responds best to 80-100 word prompts for high-detail generations.

---

## 10. DeepSeek Janus-Pro (Multimodal)

Janus-Pro is a unified model for both image understanding and generation, which can be used to "Bridge" prompts.

### Technical Bridge
*   **Image-to-Prompt:** Can take a source frame and generate a high-detail descriptive prompt that other video models (like Sora or Kling) can consume.
*   **Instruction Following:** Known for superior alignment with complex layout instructions (e.g., "Subject A on the left, Subject B on the right").

---

## 11. LivePortrait (Motion Transfer)

LivePortrait is not a text-to-video model but a "driving" model.

### Optimization Strategy
*   **Identity Anchors:** When generating the *source image* for LivePortrait, use "Identity Anchors" (scars, moles, specific asymmetries) to prevent the face from "averaging out" during animation.
*   **Neutral Start:** Source images must be neutral; driving videos should start with a neutral expression for best calibration.

---

## Summary of Strategy for Prompt Builder

| Feature | Runway | Kling | Luma | Pika | Hailuo | HunYuan | Wan2.1 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Neg Prompt** | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Param Style** | Narrative | Layered | Natural | CLI | Formula | Master | Dim. |
| **Motion Cap** | High | Med | High | High | Ultra | Med | Med |
| **Max Tokens** | 1000ch | High | Med | Med | High | Ultra | High |

### Optimizer Logic:
1.  **Normalization:** Strip all existing parameters (`--ar`, `-motion`, etc.).
2.  **Expansion:** Use the "Narrative Expansion" for Sora/Luma/Runway.
3.  **Structuring:** Reorder text into `Subject -> Action -> Scene -> Style` for Kling/Wan2.1.
4.  **Parameterization:** Convert keywords like "widescreen" into `-ar 16:9` for Pika.
5.  **Quality Injection:** Append model-specific quality boosters (e.g., "hyperrealistic" for Mochi, "Master Mode" style for HunYuan).
