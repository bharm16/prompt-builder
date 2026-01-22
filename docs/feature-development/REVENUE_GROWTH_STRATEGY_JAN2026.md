# Revenue Growth & Feature Expansion Strategy (January 2026)

This document outlines high-impact features designed to increase the revenue potential of PromptCanvas by moving from a "Prompt Tool" to a "Production Studio."

## 1. Character & Style Locker (The Consistency Engine)
**Market Context:** Leonardo.ai, Runway Custom Models, Midjourney Personalization.
**The Problem:** Professional creators need character and style consistency across multiple shots. "A woman" isn't enough; it needs to be "the same woman."

### Core Features
- **Asset Tokens:** Users define custom tokens (e.g., `@Alice`, `@CyberCity`) linked to reference images or specific descriptor sets.
- **Span Injection:** When the editor detects a character token, it automatically injects the necessary technical descriptors into the hidden system prompt for the target model (Sora/Kling/Veo).
- **Consistency Guardrails:** Warn the user if they try to change the identity of a "Locked" character mid-session.

### Revenue Impact
- **Tier Gating:** Lock character slots (e.g., Free: 1, Pro: 10, Agency: Unlimited).
- **Retention:** Users are unlikely to switch platforms once their "Character Library" is established.

---

## 2. Audio Canvas (Multimodal Expansion)
**Market Context:** ElevenLabs, Suno, Udio.
**The Problem:** A silent video preview is only half of the pitch. Creators currently have to jump between 3 tools to get a rough cut with sound.

### Core Features
- **Semantic SFX:** Use existing `[Environment]` and `[Action]` spans to auto-generate ambient soundscapes (e.g., "gentle waves", "city rain").
- **Dialogue Extraction:** Detect dialogue markers in the prompt (e.g., `Subject says: "..."`) and pipe them to a text-to-speech engine.
- **Unified Preview:** The Flux/Wan preview includes a generated 8-second audio loop.

### Revenue Impact
- **Credit Consumption:** Charge separate credits for Audio generations (e.g., 5 credits per SFX layer).
- **Value Prop:** Increases the "Production Value" of the low-cost previews.

---

## 3. Storyboard Mode (Sequence Workflow)
**Market Context:** Frame.io, traditional NLEs, Runway Gen-3 Alpha Storyboard.
**The Problem:** Video isn't a single shot; it's a sequence. Prompting one-by-one is tedious and leads to continuity errors.

### Core Features
- **Timeline View:** A horizontal view of multiple "Prompt Cards."
- **Contextual Continuity:** The LLM analyzes Prompt N-1 to suggest transitions for Prompt N.
- **Batch Preview:** Generate Flux previews for an entire 5-shot sequence with one click.

### Revenue Impact
- **Higher Credit Velocity:** Encourages users to think in "scenes" (5-10 generations) rather than "shots" (1 generation).
- **Agency Workflow:** Essential for the $179/mo tier where team collaboration on sequences is required.

---

## 4. Enterprise Collaboration & Governance
**Market Context:** Figma, Canva for Enterprise.
**The Problem:** In agencies, a junior might write 100 prompts, but a Creative Director needs to approve the "Expensive Generations" before the budget is spent.

### Core Features
- **Generation Approval:** Lock the "Generate Sora" button for junior seats until a "Manager" seat approves the prompt.
- **Shared Prompt Libraries:** A private "Team Golden Set" of prompts that work well for specific clients.
- **Span Comments:** Threaded comments directly on the PromptCanvas (e.g., "This lighting span is too bright for the brand guidelines").

### Revenue Impact
- **Per-Seat Pricing:** Shift from "Credit Only" to "SaaS Subscription + Credits."
- **Budget Control:** Attracts larger companies by offering administrative control over AI spend.

---

## Strategic Recommendation: The "Low Hanging Fruit"
**Prioritize the Audio Canvas.**
Because PromptCanvas already has high-quality **Semantic Span Labeling**, the technical foundation for "Contextual Audio" is already 80% complete. Piping identified `Environment` and `Action` text into an SFX API is a high-visibility update with low implementation overhead compared to building a full Storyboard NLE.
