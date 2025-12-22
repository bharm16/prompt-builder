# Repository Analysis: PromptCanvas (`prompt-builder`)

**PromptCanvas** is an advanced, interactive editing environment designed to professionalize the workflow of creating text-to-video prompts for next-generation AI models like Sora, Runway Gen-3/4, and Kling. Unlike simple "magic expand" tools that blindly rewrite text, PromptCanvas acts as a "Grammarly for video," parsing natural language prompts into a structured semantic taxonomy (Subject, Action, Lighting, Camera, etc.). It empowers users to iteratively refine specific components of their prompt using context-aware AI suggestions, ensuring that the final output aligns with cinematographic best practices rather than generic descriptions.

The architecture is robust and production-ready, featuring a **React/Vite frontend** that uses a custom "Bento Grid" layout to visualize prompt structure and a **Node.js/Express backend** built with TypeScript. The system employs a sophisticated **multi-provider LLM strategy**, routing tasks to different models based on need (Groq/Llama 3 for sub-300ms draft labeling, OpenAI/GPT-4o for high-quality semantic refinement). Key architectural patterns include Dependency Injection for testability, a tiered caching strategy (memory + Redis) to minimize latency, and an SSE (Server-Sent Events) streaming pipeline for real-time feedback. It also integrates **Replicate (Flux Schnell)** to provide near-instant visual previews of the video prompt as the user types.

Currently, the feature set includes semantic span labeling with a 30+ category video-specific taxonomy, a "click-to-enhance" interface for generating alternatives, and a "Video Concept Builder" wizard for guiding users through prompt creation. The target audience includes professional AI video creators and agencies who need precise control over their generation parameters (physics, lighting, camera movement) rather than random "lucky dip" results. The provided gap analysis indicates the project is actively pivoting to address the specific needs of 2025-era models, which function more as physics simulators than simple image generators.

---

# Feature Ideas

## 1. Temporal "Beat Sheet" Editor

- **Description**: Transform the linear text input into a timeline-based view that allows users to define prompts for specific timestamps (e.g., "0s: Opening Shot," "3s: Action Shift," "6s: End State"). The system would compile these into the specific "multi-stage" prompt format required by models like Sora 2 or Kling.
- **Value Proposition**: Modern video models are temporal; they describe change over time. A static text block often fails to control pacing. This allows creators to act as directors, explicitly choreographing the video's progression.
- **Implementation Complexity**: **High** (Requires significant UI changes to support a timeline view and backend logic to parse/compile temporal markers).
- **Priority Rationale**: Identified as a critical gap (P1) in the provided analysis. Essential for controlling narrative flow in longer (>5s) generations.

## 2. Physics & Forces Vocabulary Engine

- **Description**: A specialized suggestion module that detects "static" visual descriptions (e.g., "a fast car") and suggests "physics-based" alternatives (e.g., "chassis compressing under braking, tires deforming against asphalt").
- **Value Proposition**: As noted in the gap analysis, 2025-era models act as physics simulators. Describing forces (gravity, friction, inertia) yields far more realistic motion than describing appearance alone.
- **Implementation Complexity**: **Medium** (Leverages existing suggestion engine but requires fine-tuning/prompt engineering for a specific "physics" persona).
- **Priority Rationale**: Directly addresses the "floaty" look common in AI video by aligning with the "Simulator" nature of new models (P0 priority).

## 3. Interactive Camera Movement Widget

- **Description**: A graphical UI widget (dial or grid) where users can visually select camera movements (Dolly In, Truck Left, Crane Up, Dutch Angle). The tool automatically inserts the precise, jargon-correct text into the prompt.
- **Value Proposition**: Many users struggle with correct cinematographic terminology. A visual control bridges the gap between "I want the camera to move closer" and the effective prompt "slow push-in with rack focus."
- **Implementation Complexity**: **Low** (Frontend-focused component; integrates easily with existing insertion logic).
- **Priority Rationale**: Camera movement is the second most important factor in cinematic video after the subject, yet it is often neglected in text prompts.

## 4. Platform-Specific "Compiler" Profiles

- **Description**: A dropdown to select the target model (e.g., "Runway Gen-3," "Sora," "Kling"). The system automatically adjusts its suggestions and validation rules to match that model's quirks (e.g., enforcing negative prompts for Kling, using natural language physics for Sora).
- **Value Proposition**: "One prompt fits all" no longer works. Each model has distinct "activation tokens" and preferences. This ensures the user's carefully crafted prompt actually works on their chosen tool.
- **Implementation Complexity**: **Medium** (Requires maintaining config files/templates for each supported model).
- **Priority Rationale**: Increases the tool's utility significantly for professionals who use multiple generation platforms.

## 5. Reference Image "Anchor" Workflow

- **Description**: Extend the current Flux preview feature to allow users to "Pin" a generated image. The system then analyzes this image to extract style/color/lighting keywords and ensures the text prompt remains consistent with that visual anchor.
- **Value Proposition**: Consistency is the hardest problem in AI video. Using an image as the "ground truth" for the text prompt helps align the user's mental image with the model's output.
- **Implementation Complexity**: **High** (Requires vision-model integration to analyze images and "guardrail" the text generation).
- **Priority Rationale**: OpenAI's own guides emphasize using image-to-video workflows. This prepares the tool for that pipeline.

## 6. "Audio Soundscape" Layer

- **Description**: A dedicated panel for constructing the audio component of the video (Ambience, Score, Foley/SFX). It would treat audio as a separate semantic layer, ensuring it doesn't get mixed up with visual descriptions.
- **Value Proposition**: Models like Kling and Veo now generate audio. Most prompters forget to specify it, leading to generic or silent results.
- **Implementation Complexity**: **Low** (Leverages existing categorization infrastructure, just adds a new primary category and UI section).
- **Priority Rationale**: Supports the multi-modal nature of newer models (P2 priority).

## 7. Negative Prompt "Safety Net"

- **Description**: An intelligent background process that analyzes the positive prompt and automatically generates a tailored negative prompt to prevent common failure modes associated with those specific subjects (e.g., if prompting "hands," auto-add "malformed fingers, extra digits" to negative).
- **Value Proposition**: Reduces "wasted" generations by proactively blocking known artifacts before they happen, saving the user money on generation credits.
- **Implementation Complexity**: **Medium** (Requires a mapping logic or LLM call to infer likely defects from subjects).
- **Priority Rationale**: Essential for models like Stable Video Diffusion and Kling that rely heavily on negative prompting.

## 8. Collaborative "Writers Room" Mode

- **Description**: Enable real-time multiplayer editing of the prompt canvas, allowing a director and a prompter to work on the same semantic labels simultaneously.
- **Value Proposition**: Professional video production is collaborative. This moves the tool from a single-player utility to an enterprise workflow solution.
- **Implementation Complexity**: **High** (Requires WebSockets/CRDTs or leveraging Firebase's real-time capabilities more aggressively).
- **Priority Rationale**: Differentiates the product from simple "GPT wrapper" tools and creates a moat for team usage.
