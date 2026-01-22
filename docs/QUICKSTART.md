# Quick Start

Minimal local setup instructions for PromptCanvas.

## Prerequisites

- Node.js >= 20
- Firebase project (for auth/history)

## Run locally

```bash
# Clone (private repo)
git clone <REPO_URL>
cd prompt-builder

# Install
npm install

# Configure
cp .env.example .env
# Add required keys to .env

# Run
npm start
```

Open `http://localhost:5173`.

## Environment variables (high level)

- **Required for local dev**
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_PROJECT_ID`
  - At least one LLM provider key (commonly `OPENAI_API_KEY`)
- **Optional**
  - `GROQ_API_KEY` (fast drafts)
  - `REPLICATE_API_TOKEN` (preview generation + some fallbacks)
  - `FAL_KEY` / `FAL_API_KEY` (PuLID face-consistent keyframes)

For the full list, see `.env.example`.

