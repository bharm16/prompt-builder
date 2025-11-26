# Prompt Optimizer

> AI-powered prompt optimization platform with enterprise-grade architecture, specialized for AI video generation

A production-ready, full-stack application for optimizing prompts for AI video generation (Sora, Veo3, RunwayML, Kling, Luma). Built with React, Express, and Firebase, featuring comprehensive testing, monitoring, and deployment configurations.

> **📖 For comprehensive documentation, see [OVERVIEW.md](OVERVIEW.md)**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/react-18.2.0-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)](https://www.typescriptlang.com/)

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [API Reference](#api-reference)
- [Components](#components)
- [Testing](#testing)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Contributing](#contributing)
- [Documentation](#documentation)
- [License](#license)

---

## Features

- **Video Prompt Optimization** - Specialized for AI video generation (Sora, Veo3, RunwayML, Kling, Luma)
- **Two-Stage Optimization** - Fast draft generation with progressive refinement via SSE streaming
- **Intelligent Span Labeling** - Real-time text categorization with color-coded highlights
- **Interactive Enhancement** - Click-to-improve suggestions with context-aware AI recommendations
- **Video Concept Builder** - Element-by-element concept construction with compatibility checking
- **Quality Assessment** - Automated scoring (0-100) with expansion ratio and completeness tracking
- **History & Collaboration** - Up to 100 saved optimizations with search, filter, and UUID sharing
- **PromptCanvas** - Three-pane interactive editor with undo/redo, export, and keyboard shortcuts
- **Enterprise Architecture** - Multi-provider LLM support, circuit breakers, caching, monitoring, Kubernetes-ready

> **For detailed feature explanations and examples, see [OVERVIEW.md](OVERVIEW.md)**

---

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Firebase account (for authentication & database)
- OpenAI API key

### Installation

1. **Clone and install:**
```bash
git clone https://github.com/yourusername/prompt-builder.git
cd prompt-builder
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your API keys
```

**Required environment variables:**
```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

3. **Start the application:**
```bash
npm start
```

This starts both backend (port 3001) and frontend (port 5173). Open http://localhost:5173

4. **Create your first optimization:**
   - Sign up/sign in
   - Enter a prompt: `"A person walking on a beach"`
   - Click "Optimize" or press `Ctrl/Cmd + K`

> **For detailed setup instructions, see [OVERVIEW.md](OVERVIEW.md#getting-started)**

---

## Architecture

High-level system architecture:

```
┌─────────────────────────────────────────────┐
│         React Frontend (Vite)               │
│  - Interactive UI                           │
│  - Real-time highlighting                   │
│  - SSE streaming                            │
└─────────────┬───────────────────────────────┘
              │ HTTP/SSE
┌─────────────┴───────────────────────────────┐
│         Express Backend API                 │
│  ┌──────────────────────────────────────┐ │
│  │   Dependency Injection Container       │ │
│  │  - Services: Optimization, Enhancement │ │
│  │  - Span Labeling, Video Concept       │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │      AIModelService (Router)         │ │
│  │  - Multi-provider LLM support        │ │
│  │  - Automatic fallback                │ │
│  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
              │
┌─────────────┴───────────────────────────────┐
│      External Services & Storage            │
│  - Firebase (Auth & Firestore)              │
│  - Redis (Optional caching)                 │
│  - OpenAI, Groq, Gemini APIs                │
└─────────────────────────────────────────────┘
```

> **For detailed architecture flows and component descriptions, see [OVERVIEW.md](OVERVIEW.md#technical-architecture)**

---

## Tech Stack

**Frontend:** React 18.2, Vite 7.1, Tailwind CSS, TypeScript 5.9  
**Backend:** Express 4.21, Firebase 12.4, TypeScript 5.9  
**LLM:** OpenAI (GPT-4o-mini), Groq (Llama 3.1 8B), Gemini Pro  
**Testing:** Vitest, Playwright, k6  
**Infrastructure:** Docker, Kubernetes, Prometheus, Grafana, Redis

> **For detailed tech stack explanations, see [OVERVIEW.md](OVERVIEW.md#technology-stack)**

---

## API Reference

**Base URL:** `http://localhost:3001/api` (dev) | `https://your-domain.com/api` (prod)

**Authentication:** `Authorization: Bearer YOUR_API_KEY`

### Key Endpoints

**POST /api/optimize-stream** - Two-stage optimization with SSE streaming
```json
{
  "prompt": "A person walking on a beach",
  "mode": "video"
}
```

**POST /llm/label-spans** - Label text spans with semantic categories
```json
{
  "text": "A woman walks on a beach at sunset",
  "policy": "highlighting"
}
```

**Health:** `GET /health`, `GET /health/ready`, `GET /metrics`

> **For complete API documentation, see [docs/API.md](docs/API.md)**

---

## Components

**Frontend:** PromptCanvas (interactive editor), SpanBentoGrid (highlighting), VideoConceptBuilder (concept construction)

**Backend:** AIModelService (LLM router), PromptOptimizationService, SpanLabelingService, EnhancementService

> **For detailed component documentation, see [OVERVIEW.md](OVERVIEW.md#technical-architecture)**

---

## Testing

```bash
npm run test          # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
npm run test:load     # Load tests (k6)
npm run lint          # Linting
```

> **For detailed testing guide, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**

---

## Deployment

**Docker:**
```bash
docker build -t prompt-builder:latest .
docker run -p 3001:3001 -e OPENAI_API_KEY=your_key prompt-builder:latest
```

**Kubernetes:**
```bash
kubectl apply -f infrastructure/kubernetes/base/
kubectl apply -k infrastructure/kubernetes/overlays/production/
```

**Firebase Hosting:**
```bash
npm run build
firebase deploy --only hosting:production
```

> **For detailed deployment guides, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

## Monitoring

**Health:** `GET /health`, `GET /health/ready`, `GET /health/live`  
**Metrics:** `GET /metrics` (Prometheus format)  
**Monitoring Stack:** `npm run perf:monitor` (Prometheus + Grafana)

> **For detailed monitoring setup, see [docs/monitoring/README.md](docs/monitoring/README.md)**

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and run tests: `npm run test:all && npm run lint`
4. Commit with conventional commits: `git commit -m "feat: add new feature"`
5. Push and create PR

**Commit types:** `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`

> **For detailed development guidelines, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**

---

## Documentation

- **[OVERVIEW.md](OVERVIEW.md)** - Comprehensive project overview, features, and use cases
- **[docs/API.md](docs/API.md)** - Complete API reference
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Development guide and testing
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment guides

## Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/prompt-builder/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/prompt-builder/discussions)

---

## License

MIT License - see [LICENSE](LICENSE) file for details.
