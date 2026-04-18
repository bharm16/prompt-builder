# PromptCanvas - Interactive Editing for AI Video Prompts

> **An interactive editing environment where every phrase is semantically labeled. Click any word to get context-aware alternatives. It's Grammarly for Sora, Runway, and Veo3.**

![Status](https://img.shields.io/badge/status-in%20development-blue)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **🚀 For quick start and installation, see [README.md](README.md)**

---

## See It In Action

<!-- TODO: Add GIF/screenshot showing the click-to-enhance flow -->

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PromptCanvas                                                    [Copy] [Share] │
├──────────────────┬──────────────────────────────────────┬───────────────────┤
│                  │                                      │                   │
│  Detected        │  "A [woman in her 30s] walks along   │  Suggestions for  │
│  Elements        │   a [pristine beach] at [golden      │  "woman in her    │
│                  │   hour], [gentle waves] lapping..."  │   30s":           │
│  ┌────────────┐  │                                      │                   │
│  │ Subject    │  │   ↑ Click any highlight              │  • elderly man    │
│  │ 3 spans    │  │                                      │    with weathered │
│  └────────────┘  │                                      │    features       │
│  ┌────────────┐  │                                      │                   │
│  │ Location   │  │                                      │  • young dancer   │
│  │ 2 spans    │  │                                      │    in flowing     │
│  └────────────┘  │                                      │    silk           │
│  ┌────────────┐  │                                      │                   │
│  │ Lighting   │  │                                      │  • shadowy figure │
│  │ 2 spans    │  │                                      │    in a dark coat │
│  └────────────┘  │                                      │                   │
│                  │                                      │  [Click to apply] │
└──────────────────┴──────────────────────────────────────┴───────────────────┘
```

---

## How It Works (30 Seconds)

```
1. Write or paste your prompt
        ↓
2. Every phrase gets labeled automatically
   (subject, camera, lighting, action, style...)
        ↓
3. See 15+ color-coded highlights appear
        ↓
4. Click ANY highlight → get 5 AI alternatives
        ↓
5. One-click replace → prompt updates instantly
        ↓
6. Repeat until perfect
```

**This is NOT paste-and-optimize.** This is iterative, interactive refinement where you control every word.

---

## What Makes This Different

| Traditional Prompt Tools  | PromptCanvas                                                   |
| ------------------------- | -------------------------------------------------------------- |
| Paste prompt → get output | Interactive editing canvas                                     |
| One-shot optimization     | Click-to-refine any phrase                                     |
| Generic text improvement  | 9 semantic categories for video (subject, camera, lighting...) |
| No feedback on structure  | See exactly what elements your prompt contains                 |
| Wait for full response    | Sub-300ms draft, then progressive refinement                   |

**The core insight:** AI video prompts aren't monolithic text—they're composed of distinct elements (subject, action, camera, lighting, style). PromptCanvas lets you refine each element individually while maintaining consistency.

---

## The Product: PromptCanvas

PromptCanvas is a three-pane editing environment purpose-built for AI video prompts.

### Left Pane: Span Bento Grid

Visual overview of every detected element in your prompt:

- **Subject** (3 spans) - "woman in her 30s", "auburn hair", "white linen dress"
- **Action** (1 span) - "walks barefoot"
- **Location** (2 spans) - "pristine beach", "shoreline"
- **Lighting** (2 spans) - "golden hour", "backlight"
- **Camera** (1 span) - "lateral tracking shot"
- **Style** (1 span) - "Terrence Malick aesthetic"

Click any category to jump to those spans in the editor. See at a glance what's covered and what's missing.

### Center Pane: Interactive Editor

Your prompt with ML-powered highlighting:

- Every phrase is color-coded by semantic category
- **Click any highlight** → suggestions panel activates
- **Select any text manually** → get suggestions for that selection
- Full editing: type, delete, paste, undo/redo
- Typewriter animation shows optimization progress

### Right Pane: AI Suggestions

Context-aware alternatives for the selected text:

- 3-5 suggestions that match the semantic category
- Understand surrounding context (what comes before/after)
- Respect edit history (maintain consistency with previous changes)
- One-click replacement
- Custom request: "make it more mysterious" → get tailored suggestions

### The Click-to-Enhance Flow

```
1. You click "woman in her 30s" (highlighted as Subject)
        ↓
2. System knows:
   - Category: subject.identity
   - Context before: "Wide shot:"
   - Context after: "walks barefoot along..."
   - Your previous edits in this session
        ↓
3. AI generates category-aligned alternatives:
   • "elderly man with weathered features"
   • "young dancer in flowing silk"
   • "shadowy figure in a dark coat"
   • "child clutching a red balloon"
   • "couple walking hand-in-hand"
        ↓
4. You click one → text replaces instantly
        ↓
5. Highlights update, suggestions panel ready for next edit
```

---

## Supporting Features

### Video Concept Builder

Don't know where to start? The guided wizard builds prompts element-by-element:

1. **Subject** → "Who or what is in the scene?"
2. **Action** → "What are they doing?"
3. **Location** → "Where does this take place?"
4. **Camera** → "How should this be shot?"
5. **Lighting** → "What's the lighting like?"
6. **Style** → "What's the visual aesthetic?"

Each step provides AI suggestions. Conflict detection warns you if elements don't work together ("person under a tree" + "open wheat field" = conflict).

### Two-Stage Optimization

Speed + quality:

- **Stage 1 (~300ms):** Fast draft via Groq (Llama 3.1 8B)
- **Stage 1.5 (parallel):** Span labeling runs simultaneously
- **Stage 2 (~2s):** Quality refinement via OpenAI (GPT-4o-mini)

You see results in under a second. Refinement happens in the background.

### Semantic Taxonomy

9 parent categories, 30+ attributes, built specifically for video:

| Category        | What It Covers                           |
| --------------- | ---------------------------------------- |
| **Shot**        | Framing: wide shot, close-up, bird's eye |
| **Subject**     | Identity, appearance, wardrobe, emotion  |
| **Action**      | Movement, state, gestures                |
| **Environment** | Location, weather, context               |
| **Lighting**    | Source, quality, time of day             |
| **Camera**      | Movement, lens, angle                    |
| **Style**       | Aesthetic, film stock                    |
| **Technical**   | Aspect ratio, FPS, resolution, duration  |
| **Audio**       | Score, sound effects                     |

This taxonomy is the backbone of span labeling. When you click "golden hour," the system knows it's `lighting.timeOfDay` and generates lighting-appropriate alternatives.

### History & Sharing

- Auto-save up to 100 prompts per user
- Search and filter your history
- Share via UUID link (anyone can view)
- Export as TXT, Markdown, or JSON

---

## The Technical Edge

### Why This Is Hard to Replicate

1. **Domain-specific taxonomy** - 30+ semantic categories tuned for video, not generic NLP
2. **Context-aware suggestions** - Understands before/after text, edit history, category alignment
3. **Two-stage pipeline** - Sub-second perceived latency with background quality refinement
4. **Multi-provider LLM routing** - Automatic fallback, circuit breakers, operation-based routing
5. **Performance optimized** - 80%+ cache hit rate, request batching, parallel span labeling

### Architecture Overview

```
┌─────────────────────────────────────────────┐
│         React Frontend (Vite)               │
│  - PromptCanvas (interactive editor)        │
│  - SpanBentoGrid (element overview)         │
│  - SuggestionsPanel (AI alternatives)       │
│  - VideoConceptBuilder (guided wizard)      │
└─────────────┬───────────────────────────────┘
              │ HTTP/SSE (streaming)
┌─────────────┴───────────────────────────────┐
│         Express Backend                     │
│  - PromptOptimizationService                │
│  - SpanLabelingService (taxonomy-driven)    │
│  - EnhancementService (suggestions)         │
│  - AIModelService (multi-provider router)   │
└─────────────┬───────────────────────────────┘
              │
┌─────────────┴───────────────────────────────┐
│         LLM Providers                       │
│  - OpenAI (GPT-4o-mini) - quality           │
│  - Groq (Llama 3.1 8B) - speed              │
│  - Gemini (Pro) - diversity                 │
└─────────────────────────────────────────────┘
```

### Key Technical Features

- **Dependency injection** - Fully testable, no module-level state
- **Circuit breakers** - Per-provider, prevents cascade failures
- **Multi-tier caching** - In-memory + Redis, 80%+ hit rate
- **SSE streaming** - Real-time updates as optimization progresses
- **Request coalescing** - Deduplicates identical concurrent requests

---

## Example: Before & After

### Input

```
"cyberpunk street scene"
```

### PromptCanvas Output (with detected elements)

```
[Shot: Wide establishing shot]: A rain-slicked neon-lit street in a
towering cyberpunk metropolis at night, [Subject: holographic advertisements]
flicker across glass skyscrapers as [Subject: crowds of people in luminous
clothing] navigate between [Environment: food stalls emitting colorful steam].

[Camera: Slow descending crane shot] starting 50 feet high, gradually
lowering to street level over 8 seconds. Camera moves forward through
the crowd at walking pace. [Camera: Smooth gimbal movement] with slight
handheld micro-vibrations for realism.

[Lighting: Dominant cyan and magenta neon lighting] from storefronts
and holograms. [Lighting: Warm amber pools of light] from street vendors.
Overhead cool blue-white lights create dramatic shadows. Light
reflects off wet pavement creating mirror-like reflections.

[Style: Blade Runner-inspired cyberpunk aesthetic]. Shot on Arri Alexa
with [Camera: anamorphic lens] creating characteristic horizontal flares.
[Style: Color grading]: deep shadows, vibrant neons, desaturated mid-tones.
Film grain texture overlay.

[Technical: 24fps] for cinematic feel, [Technical: 2.39:1 aspect ratio],
shallow depth of field (f/2.8).
```

**15 labeled spans across 6 categories.** Click any one to refine it.

---

## Who Is This For?

### Primary: Professional AI Video Creators

- Agencies producing AI video content
- Creators using Sora, Runway, Veo3, Kling, Luma regularly
- People who generate 10-100+ videos per week
- **Value prop:** Better prompts = fewer iterations = time saved = money saved

### Secondary: Prosumers Learning the Craft

- Hobbyists experimenting with AI video
- Filmmakers exploring AI as a tool
- **Value prop:** Learn cinematographic language through interactive feedback

---

## Getting Started

```bash
# Clone and install
git clone https://github.com/yourusername/prompt-builder.git
cd prompt-builder
npm install

# Configure — create a local `.env` file. The server fails fast at startup
# with a precise list of any missing required vars. See
# server/src/config/env.ts (Zod schema) for the authoritative list, and
# CLAUDE.md for feature flags.
touch .env
# Populate with your OpenAI / Firebase / etc. keys

# Run
npm start
# Open http://localhost:5173
```

**Requirements:**

- Node.js >= 20.0.0
- OpenAI API key (required)
- Groq API key (optional, enables fast drafts)
- Firebase account (for auth/storage)

---

## Project Status

**Current:** In active development (v0.1.0)

**Recent:**

- ✅ Two-stage optimization pipeline
- ✅ Span labeling with 30+ categories
- ✅ Click-to-enhance suggestions
- ✅ Video Concept Builder wizard
- ✅ Multi-provider LLM support

**Next:**

- [ ] Payment integration
- [ ] Team collaboration
- [ ] API access tier
- [ ] Prompt template marketplace

---

## Technology Stack

| Layer          | Tech                                  |
| -------------- | ------------------------------------- |
| Frontend       | React 18, Vite, Tailwind, TypeScript  |
| Backend        | Express, TypeScript, Firebase         |
| LLMs           | OpenAI, Groq, Gemini                  |
| Infrastructure | Docker, Kubernetes, Redis, Prometheus |

---

## Documentation

- **[README.md](README.md)** - Quick start and installation
- **[docs/API.md](docs/API.md)** - API reference
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Development guide

---

## License

MIT License - Free for commercial and personal use

---

## The Bottom Line

PromptCanvas is not another "make my prompt better" tool. It's an **interactive editing environment** that:

1. **Shows you** what elements your prompt contains (semantic labeling)
2. **Lets you refine** each element individually (click-to-enhance)
3. **Maintains consistency** across your edits (context awareness)
4. **Specializes in video** (30+ video-specific categories)

**Try it:** Write a simple prompt, see it labeled, click a highlight, pick a suggestion. That's the experience.

---

_Built for the AI video generation community_
