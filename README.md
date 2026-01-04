# PromptCanvas

> **Interactive editing for AI video prompts. Every phrase is semantically labeled. Click any word to get context-aware alternatives.**

It's Grammarly + Production Studio for Sora, Runway, Veo, Kling, and Luma.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/react-18.2.0-blue)](https://reactjs.org/)

---

## What This Is

<!-- TODO: Add GIF showing the click-to-enhance flow -->

**PromptCanvas is NOT another paste-and-optimize tool.**

It's an interactive editing canvas where:

1. You write/paste a prompt
2. Every phrase gets ML-labeled (subject, camera, lighting, action, style...)
3. 15+ color-coded highlights appear
4. **Click ANY highlight** → get 5 AI-generated alternatives
5. One-click replace → prompt updates
6. **Visual preview** → See your prompt as an image (auto-generated with Flux Schnell)
7. Repeat until perfect

**You control every word. The AI assists, you decide.**

> 📖 **[Full documentation →](OVERVIEW.md)**

---

## Quick Start

```bash
# Clone
git clone https://github.com/yourusername/prompt-builder.git
cd prompt-builder

# Install
npm install

# Configure
cp .env.example .env
# Add your API keys to .env

# Run
npm start
# Open http://localhost:5173
```

**Required:**
- Node.js >= 20.0.0
- OpenAI API key

**Optional (but recommended):**
- Groq API key (free, enables sub-300ms drafts)
- Replicate API token (enables visual preview generation with Flux Schnell)
- Firebase account (for auth and history)

---

## The Experience

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SPAN BENTO        INTERACTIVE EDITOR                  SUGGESTIONS     │
│  ───────────       ──────────────────                  ───────────     │
│                                                                         │
│  Subject (3)       "A [woman in her 30s] walks        "woman in her    │
│  Action (1)         along a [pristine beach] at        30s":           │
│  Location (2)       [golden hour]..."                                  │
│  Lighting (2)                                          • elderly man   │
│  Camera (1)         ↑ Click any highlight              • young dancer  │
│  Style (1)                                             • shadowy figure│
│                                                                         │
│  [15 elements]                                         [Click to apply]│
│                                                                         │
│  ────────────────────────────────────────────────────────────────────── │
│  VISUAL PREVIEW (Flux Schnell)                                         │
│  [Generated preview image appears here as you type]                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Left:** Overview of detected elements by category  
**Center:** Your prompt with clickable highlights  
**Right:** AI suggestions for selected text  
**Bottom:** Visual preview generated automatically as you type

---

## Key Features

| Feature | What It Does |
|---------|--------------|
| **Semantic Labeling** | 30+ categories tuned for video (subject, camera, lighting, action, style...) |
| **Click-to-Enhance** | Click any highlight → get context-aware alternatives → one-click replace |
| **Direct Video Generation** | Generate actual videos using OpenAI Sora 2, Google Veo 4, Runway Gen-45, Luma Ray 3, and Kling |
| **Visual Preview** | Auto-generates preview images using Flux Schnell as you type (debounced) |
| **Two-Stage Speed** | Sub-300ms draft (Groq) + background refinement (OpenAI) |
| **Video Concept Builder** | Guided wizard: subject → action → location → camera → lighting → style |
| **Consistency Tracking** | Suggestions respect your edit history to maintain coherence |

---

## Why This Exists

AI video models (Sora, Runway, Veo3) are sensitive to prompt quality. The difference between:

❌ `"person on beach"`  
✅ `"Wide shot: woman in her 30s walks barefoot along pristine beach at golden hour, lateral tracking shot, warm backlight..."`

...is the difference between generic output and cinematic results.

**The problem:** Most people don't know cinematographic language.

**The solution:** PromptCanvas shows you what elements your prompt has, what's missing, and lets you refine each element with AI assistance.

---

## Supported Ecosystem

PromptCanvas is designed to be the all-in-one studio for the AI video ecosystem. It optimizes prompts AND directly generates video with:

*   **OpenAI Sora 2** (Physics simulation & continuity)
*   **Google Veo 4** (Cinematic lighting & atmosphere)
*   **Runway Gen-45** (Stylized visuals & VFX)
*   **Kling 2.6** (Character performance)
*   **Luma Ray 3** (Morphing & transitions)
*   **Wan 2.2** (High-fidelity previews)

---

## Strategic Value

### For Creative Agencies
*   **Standardize Quality:** Ensure every prompt sent to production meets a baseline of cinematographic detail.
*   **Asset Management:** Save, search, and share successful prompt patterns across the team.
*   **Client Alignment:** Use the visual preview to align with clients on style/mood before generating expensive video assets.

### For Marketing Teams
*   **Speed to Market:** Reduce the "prompt engineering" learning curve for social media managers and content creators.
*   **Consistency:** Maintain brand aesthetics by reusing specific Style and Lighting tokens.

---

## Current Status

**Production Ready Features:**
*   ✅ Advanced Text Optimization Engine (Two-Stage Pipeline)
*   ✅ Direct Video Generation (Sora 2, Veo 4, Luma Ray 3, Runway Gen-45)
*   ✅ Video Preview Generation (Wan 2.2)
*   ✅ Image Preview Generation (Flux Schnell)
*   ✅ Concept Builder & Improvement Wizards
*   ✅ Scene Change & Conflict Detection
*   ✅ Enterprise-grade History & Auto-save
*   ✅ Multi-Format Export (JSON/MD/TXT)

**[→ View Full Documentation](OVERVIEW.md)**

---

## Tech Stack

| | |
|-|-|
| **Frontend** | React 18, Vite, Tailwind, TypeScript |
| **Backend** | Express, TypeScript, Firebase |
| **LLMs** | OpenAI (quality), Groq (speed), Gemini (diversity) |
| **Infra** | Docker, Kubernetes, Redis, Prometheus |

---

## Project Structure

```
prompt-builder/
├── client/                    # React frontend
│   └── src/
│       ├── features/
│       │   └── prompt-optimizer/
│       │       ├── PromptCanvas.tsx      # Main editor
│       │       └── SpanBentoGrid/        # Element overview
│       └── components/
│           ├── SuggestionsPanel/         # AI suggestions
│           └── VideoConceptBuilder/      # Guided wizard
├── server/                    # Express backend
│   └── src/
│       ├── services/
│       │   ├── prompt-optimization/      # Core optimization
│       │   ├── enhancement/              # Suggestions
│       │   └── ai-model/                 # LLM routing
│       └── llm/
│           └── span-labeling/            # Semantic labeling
└── shared/
    └── taxonomy.ts            # 30+ video categories
```

---

## API

**Optimize with streaming:**
```bash
POST /api/optimize-stream
Content-Type: application/json

{
  "prompt": "person walking on beach",
  "mode": "video"
}

# Returns SSE stream: draft → spans → refined → done
```

**Get suggestions for a span:**
```bash
POST /api/enhance
Content-Type: application/json

{
  "highlightedText": "woman in her 30s",
  "contextBefore": "Wide shot: ",
  "contextAfter": " walks barefoot...",
  "fullPrompt": "...",
  "highlightedCategory": "subject.identity"
}
```

**Generate preview image:**
```bash
POST /api/preview/generate
Content-Type: application/json

{
  "prompt": "woman in her 30s walks along pristine beach at golden hour",
  "aspectRatio": "16:9"  // optional, defaults to "16:9"
}

# Returns:
{
  "success": true,
  "data": {
    "imageUrl": "https://...",
    "metadata": {
      "model": "flux-schnell",
      "aspectRatio": "16:9",
      "generatedAt": "2024-..."
    }
  }
}
```

> 📖 **[Full API docs →](docs/API.md)**

---

## Scripts

```bash
npm start           # Run both frontend + backend
npm run dev         # Frontend only (Vite)
npm run server      # Backend only (Express)
npm run test        # Unit tests (Vitest)
npm run test:e2e    # E2E tests (Playwright)
npm run lint        # ESLint
npm run build       # Production build
```

---

## Environment Variables

```env
# Required
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Optional (enables fast drafts)
GROQ_API_KEY=gsk_...

# Optional (enables visual preview generation)
REPLICATE_API_TOKEN=r8_...

# Firebase (for auth/history)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

See `.env.example` for full list.

---

## Documentation

| Doc | Contents |
|-----|----------|
| **[OVERVIEW.md](OVERVIEW.md)** | Full product documentation, architecture, features |
| **[docs/API.md](docs/API.md)** | API reference |
| **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** | Development guide |
| **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** | Deployment instructions |

---

## Status

**In active development.** Core features working:

- ✅ Two-stage optimization
- ✅ Semantic span labeling (30+ categories)
- ✅ Click-to-enhance suggestions
- ✅ Direct Video Generation (Sora 2, Veo 4, Luma Ray 3, Runway Gen-45)
- ✅ Video Preview Generation (Wan 2.2)
- ✅ Image Preview Generation (Flux Schnell)
- ✅ Video Concept Builder
- ✅ Multi-provider LLM support
- ⏳ Payment integration
- ⏳ Team collaboration

---

## License

MIT

---

## Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature/your-feature`
3. Run tests: `npm run test && npm run lint`
4. Commit: `git commit -m "feat: add feature"`
5. Push and create PR

---

**[→ Full documentation](OVERVIEW.md)** · **[→ API reference](docs/API.md)**
