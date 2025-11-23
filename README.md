# Prompt Optimizer

> AI-powered prompt optimization platform with enterprise-grade architecture and multi-mode support

A production-ready, full-stack application for optimizing prompts across multiple AI use cases, from reasoning and research to video generation. Built with React, Express, and Firebase, featuring comprehensive testing, monitoring, and deployment configurations.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/react-18.2.0-blue)](https://reactjs.org/)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage Modes](#usage-modes)
- [API Reference](#api-reference)
- [Components](#components)
- [Testing](#testing)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Core Capabilities

- **Multi-Mode Optimization**: 5 specialized modes for different use cases
  - Standard Prompt - General-purpose optimization
  - Reasoning Prompt - Deep thinking for o1/o3 models
  - Deep Research - Research plan generation
  - Socratic Learning - Educational question sequences
  - Video Prompt - AI video generation (Sora, Veo3, RunwayML, Kling, Luma)

- **Two-Stage Optimization with Streaming**
  - Fast draft generation (sub-second response)
  - Parallel span labeling for immediate highlighting
  - Refined optimization with quality improvements
  - Server-Sent Events (SSE) for real-time updates
  - Progressive enhancement workflow

- **Intelligent Span Labeling System**
  - Real-time text categorization and highlighting
  - Dynamic taxonomy-based role detection
  - Multi-provider LLM support (OpenAI, Groq, Gemini)
  - Chunked processing for large texts
  - Substring position caching for performance
  - Batch processing API for concurrent requests
  - Automatic span validation and repair

- **Intelligent Enhancement System**
  - Real-time text selection suggestions
  - ML-powered phrase recognition
  - Context-aware improvements with brainstorm context
  - Edit history tracking for consistency
  - Scene change detection
  - Simple prompt mode (feature flag) for faster responses
  - Category-aligned suggestions

- **Creative Brainstorm** (Video Mode)
  - Interactive concept builder
  - Element-by-element construction
  - AI-powered suggestions
  - Compatibility checking
  - Conflict detection
  - Technical parameter generation
  - Scene completion and variations

- **Quality Assessment**
  - Automated quality scoring (0-100)
  - Expansion ratio tracking
  - Structure analysis
  - Completeness checks
  - Quality feedback system with ML-based scoring

- **History & Collaboration**
  - Last 10 optimizations per user
  - Search and filter
  - Share via UUID
  - Firebase sync

### User Experience

- Typewriter animation for results
- Keyboard shortcuts (Ctrl/Cmd + K, N, O)
- Export formats (Text, Markdown, JSON)
- Settings persistence
- Toast notifications
- Real-time span highlighting
- Interactive text selection with suggestions

### Enterprise Features

- **Multi-Provider LLM Support**
  - Generic LLMClient architecture (OpenAI-compatible)
  - Unified AIModelService router
  - Zero-code provider switching via configuration
  - Automatic fallback between providers
  - Provider-specific circuit breakers

- **Dependency Injection Container**
  - Service registration and resolution
  - Testable architecture
  - No module-level mutable state

- **Firebase authentication**
- **Multi-tier caching** (in-memory + Redis + Span labeling cache)
- **Circuit breaker pattern** (per-provider configuration)
- **Rate limiting** (global, API, route-specific)
- **Comprehensive security** (Helmet, CORS, validation)
- **Structured logging** (Pino with Sentry integration)
- **Prometheus metrics**
- **Health check endpoints** (health, ready, live)
- **Kubernetes-ready** with HPA and PodDisruptionBudget
- **Edge deployment** (Cloudflare Workers support)
- **Request batching and coalescing** for performance

---

## Architecture

### System Design

```
┌─────────────────┐
│   React UI      │
│  (Vite + React) │
│  + Span Labels  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Express API    │
│  (Port 3001)    │
│  + DI Container │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────────────┐
│Firebase│ │  AIModelService  │
│Firestore│ │   (Router)       │
└────────┘ └────────┬─────────┘
                     │
            ┌────────┴────────┐
            │                 │
            ▼                 ▼
    ┌─────────────┐   ┌─────────────┐
    │  LLMClient  │   │  LLMClient  │
    │  (OpenAI)    │   │  (Groq)     │
    └─────────────┘   └─────────────┘
```

### Request Flow

```
User Input
  ↓
PromptOptimizerContainer (React State)
  ↓
usePromptOptimizer Hook / useSpanLabeling Hook
  ↓
fetch('/api/optimize-stream') or fetch('/llm/label-spans')
  ↓
Express Middleware Stack
  ├─ Request ID
  ├─ Security (Helmet)
  ├─ CORS
  ├─ Rate Limiting
  ├─ Compression
  ├─ API Auth
  ├─ Request Batching (for /label-spans-batch)
  └─ Validation
  ↓
Service Layer (via DI Container)
  ├─ PromptOptimizationService
  │   ├─ Two-Stage Optimization
  │   ├─ Mode Detection
  │   ├─ Cache Check
  │   └─ Parallel Span Labeling
  ├─ SpanLabelingService
  │   ├─ Chunked Processing (large texts)
  │   ├─ Cache Check (SubstringPositionCache)
  │   └─ Validation & Repair
  └─ EnhancementService
      ├─ Context Building
      ├─ Simple/Complex Prompt Mode
      └─ Suggestion Processing
  ↓
AIModelService (Unified Router)
  ├─ Operation Routing (from ModelConfig)
  ├─ Provider Selection
  ├─ Fallback Logic
  └─ Circuit Breaker
  ↓
LLMClient (Generic, Provider-Agnostic)
  ├─ Adapter Pattern (OpenAI, Groq, Gemini)
  ├─ Circuit Breaker
  ├─ Concurrency Limiting
  └─ Metrics Collection
  ↓
LLM Provider (OpenAI/Groq/Gemini)
  ↓
Response Processing
  ├─ Quality Assessment
  ├─ Span Validation
  └─ Cache Storage
  ↓
Firebase Storage / Redis Cache
  ↓
Response with Results (SSE for streaming)
```

### Directory Structure

```
prompt-builder/
├── client/
│   └── src/
│       ├── components/          # React components (54 files)
│       ├── features/           # Feature modules
│       │   ├── auth/          # Firebase authentication
│       │   ├── history/       # Prompt history management
│       │   ├── prompt-optimizer/
│       │   ├── span-highlighting/  # Span labeling UI
│       │   └── video-concept-builder/
│       ├── services/          # API clients and services
│       │   ├── http/          # HTTP client infrastructure
│       │   ├── EnhancementApi.js
│       │   ├── PromptOptimizationApi.js
│       │   └── VideoConceptApi.js
│       ├── hooks/             # React custom hooks
│       ├── config/            # Feature flags, API config
│       └── utils/             # Utility functions
├── server/
│   └── src/
│       ├── clients/           # LLM API clients
│       │   ├── LLMClient.js   # Generic LLM client
│       │   └── adapters/      # Provider adapters (OpenAI, Gemini)
│       ├── services/          # Business logic services
│       │   ├── ai-model/      # AIModelService (unified router)
│       │   ├── prompt-optimization/  # Two-stage optimization
│       │   ├── enhancement/   # Enhancement service + sub-services
│       │   ├── cache/         # Multi-tier caching
│       │   ├── video-concept/ # Video concept builder services
│       │   ├── quality-feedback/  # Quality assessment ML
│       │   ├── taxonomy-validation/  # Taxonomy validation
│       │   └── text-categorization/  # Text categorization
│       ├── llm/              # LLM-specific services
│       │   ├── span-labeling/  # Span labeling system
│       │   │   ├── cache/      # SubstringPositionCache
│       │   │   ├── config/     # Configuration
│       │   │   ├── processing/ # Span processing pipeline
│       │   │   ├── templates/  # Prompt templates
│       │   │   ├── utils/      # Utilities
│       │   │   └── validation/ # Schema & span validation
│       │   └── roleClassifier.js
│       ├── config/           # Configuration
│       │   ├── services.config.js  # DI container setup
│       │   ├── modelConfig.js      # LLM operation routing
│       │   └── routes.config.js    # Route registration
│       ├── infrastructure/   # Cross-cutting concerns
│       │   ├── DIContainer.js # Dependency injection
│       │   ├── Logger.js      # Pino logger
│       │   └── MetricsService.js  # Prometheus metrics
│       ├── middleware/        # Express middleware
│       │   ├── requestBatching.js  # Batch request handling
│       │   ├── requestCoalescing.js  # Request deduplication
│       │   └── performanceMonitor.js
│       └── routes/           # API route definitions
├── shared/                  # Shared code (taxonomy, constants)
├── infrastructure/         # Deployment configs
│   ├── kubernetes/         # K8s manifests (base + overlays)
│   ├── docker/             # Docker configs
│   ├── edge/               # Cloudflare Workers
│   └── ci-cd/              # ArgoCD configs
├── tests/                  # Test suites
│   ├── e2e/               # Playwright E2E tests
│   └── integration/       # Integration tests
├── docs/                  # Documentation
├── scripts/               # Utility scripts
└── config/                # Build/test/lint configs
```

---

## Tech Stack

### Frontend

- **React 18.2.0** - UI framework
- **React Router DOM 7.9.4** - Client-side routing
- **Vite 7.1.9** - Build tool with HMR
- **Tailwind CSS 3.3.6** - Utility-first styling
- **Lucide React** - Icon library
- **DOMPurify** - XSS sanitization

### Backend

- **Express 4.21.2** - Web framework
- **Firebase 12.4.0** - Authentication & database
- **Pino** - Structured logging
- **Sentry** - Error tracking and performance monitoring
- **Helmet** - Security headers
- **express-rate-limit** - Rate limiting
- **Opossum** - Circuit breaker
- **prom-client** - Prometheus metrics
- **Compromise** - NLP library
- **Joi** - Validation schema
- **ioredis** - Redis client (optional caching)
- **node-cache** - In-memory caching

### LLM Integration

- **Generic LLMClient** - Provider-agnostic LLM client
- **AIModelService** - Unified router for LLM operations
- **Multi-Provider Support** - OpenAI, Groq, Gemini
- **Adapter Pattern** - Provider-specific protocol handling
- **Automatic Fallback** - Failover between providers
- **Operation-Based Routing** - Configuration-driven model selection

### Testing

- **Vitest 3.2.4** - Unit testing
- **Playwright 1.56.0** - E2E testing
- **Testing Library** - React testing utilities
- **Supertest** - API testing
- **Nock** - HTTP mocking

### Infrastructure

- **Docker** - Containerization
- **Kubernetes** - Orchestration (with HPA, PDB)
- **Prometheus** - Metrics collection
- **Grafana** - Dashboards
- **Redis** - Optional caching (multi-tier)
- **Cloudflare Workers** - Edge deployment support
- **ArgoCD** - GitOps deployment

---

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Firebase account (for authentication & database)
- OpenAI API key

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/prompt-builder.git
cd prompt-builder
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory (see `.env.example`):

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Server Configuration
PORT=3001
NODE_ENV=development

# Sentry Error Tracking (Recommended)
SENTRY_DSN=your_sentry_dsn_here
VITE_SENTRY_DSN=your_sentry_dsn_here

# Optional: Redis Configuration
REDIS_URL=redis://localhost:6379
```

**Setting up Sentry (Recommended):**

1. Sign up for a free account at [sentry.io](https://sentry.io)
2. Create a new project for your application
3. Copy the DSN from your project settings
4. Add it to your `.env` file as shown above

4. **Start development servers**

**Option 1: Run both servers together**

```bash
./start.sh
# or
npm start
```

**Option 2: Run servers separately**

Terminal 1 (Backend):
```bash
npm run server
```

Terminal 2 (Frontend):
```bash
npm run dev
```

5. **Access the application**

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health

### Quick Restart

Kill existing processes and restart:

```bash
npm run restart
```

---

## Usage Modes

### 1. Standard Prompt

General-purpose optimization for any prompt type.

**Example Input:**
```
Write a function to sort an array
```

**Example Output:**
```
Create a robust, well-documented sorting function that:
- Accepts an array of numbers as input
- Implements an efficient sorting algorithm (quicksort or mergesort)
- Handles edge cases (empty arrays, single elements)
- Returns the sorted array in ascending order
- Includes comprehensive JSDoc comments
- Has O(n log n) time complexity
```

### 2. Reasoning Prompt

Optimized for OpenAI's o1/o3 reasoning models. Emphasizes deep thinking and verification.

**Example Input:**
```
Solve this logic puzzle
```

**Example Output:**
```
[Structured reasoning prompt with step-by-step analysis framework]
```

### 3. Deep Research

Generates comprehensive research plans.

**Example Input:**
```
Research quantum computing applications
```

**Example Output:**
```
[Detailed research methodology with sources, approach, and deliverables]
```

### 4. Socratic Learning

Creates educational question sequences for learning.

**Example Input:**
```
Teach me about recursion
```

**Example Output:**
```
[Progressive question sequence that guides understanding]
```

### 5. Video Prompt

Optimizes prompts for AI video generation platforms (Sora, Veo3, RunwayML, Kling, Luma).

**Template Structure:**

```
[SHOT TYPE] [SUBJECT doing ACTION] in/at [SETTING],
[CAMERA BEHAVIOR], [LIGHTING], [STYLE/MOOD]
```

**Elements (priority order):**
1. Shot type (wide, medium, close-up, extreme close-up)
2. Subject with 2-3 visual details
3. One clear action
4. Setting and time of day
5. Camera movement and angle
6. Lighting direction and quality
7. Film style reference

**Example Input:**
```
A person walking on a beach
```

**Example Output:**
```
Wide shot: A woman in her 30s with flowing auburn hair and a
white linen dress walks barefoot along a pristine beach at
sunset, gentle waves lapping at her feet. Camera: Slow lateral
tracking shot, maintaining consistent distance. Lighting: Golden
hour backlight creates a warm silhouette with rim lighting on her
hair. Style: Cinematic, reminiscent of Terrence Malick's
contemplative cinematography, soft focus on background, sharp
subject detail.

[120 words - optimized for AI video generation]
```

**Why 100-150 Words?**

Testing shows this length works best for AI video models. Shorter prompts follow instructions more reliably than verbose descriptions.

---

## API Reference

### Base URL

```
http://localhost:3001/api
```

### Authentication

API requests require an API key in the header:

```
Authorization: Bearer YOUR_API_KEY
```

### Endpoints

#### POST /api/optimize

Single-stage prompt optimization endpoint (backward compatible).

**Request:**
```json
{
  "prompt": "Your prompt here",
  "mode": "default|reasoning|research|socratic|video",
  "context": {},
  "brainstormContext": {}
}
```

**Response:**
```json
{
  "optimizedPrompt": "Optimized version...",
  "metadata": {
    "mode": "default",
    "processingTime": 1234
  }
}
```

#### POST /api/optimize-stream

Two-stage optimization with Server-Sent Events (SSE) streaming.

**Request:**
```json
{
  "prompt": "Your prompt here",
  "mode": "default|reasoning|research|socratic|video",
  "context": {},
  "brainstormContext": {}
}
```

**Response:** SSE stream with events:
- `draft` - Fast draft version (sub-second)
- `spans` - Span labels for highlighting (parallel with draft)
- `refined` - Final optimized version
- `done` - Completion signal

#### POST /llm/label-spans

Label text spans with semantic categories for highlighting.

**Request:**
```json
{
  "text": "A woman walks on a beach at sunset",
  "policy": "highlighting",
  "options": {
    "maxSpans": 10,
    "minConfidence": 0.7
  }
}
```

**Response:**
```json
{
  "spans": [
    {
      "id": "span-1",
      "text": "woman",
      "start": 2,
      "end": 7,
      "role": "subject",
      "category": "subject.person",
      "confidence": 0.95
    }
  ],
  "meta": {
    "templateVersion": "2.0",
    "processingTime": 234
  }
}
```

#### POST /llm/label-spans-batch

Batch endpoint for processing multiple span labeling requests (reduces API calls by 60%).

**Request:**
```json
{
  "requests": [
    {
      "text": "First text",
      "policy": "highlighting"
    },
    {
      "text": "Second text",
      "policy": "highlighting"
    }
  ]
}
```

**Response:**
```json
{
  "results": [
    { "spans": [...], "meta": {...} },
    { "spans": [...], "meta": {...} }
  ]
}
```

#### POST /api/get-enhancement-suggestions

Get enhancement suggestions for selected text.

**Request:**
```json
{
  "highlightedText": "a person walking",
  "fullPrompt": "a person walking on a beach",
  "contextBefore": "",
  "contextAfter": "",
  "originalUserPrompt": "beach scene",
  "brainstormContext": {},
  "highlightedCategory": "subject",
  "highlightedCategoryConfidence": 0.9,
  "highlightedPhrase": "person walking",
  "allLabeledSpans": [],
  "nearbySpans": [],
  "editHistory": []
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "text": "a woman in her 30s walking",
      "category": "subject",
      "explanation": "Adds specific details"
    }
  ],
  "fromCache": false,
  "metadata": {
    "promptMode": "simple",
    "processingTime": 813
  }
}
```

#### POST /api/get-custom-suggestions

Get custom enhancement suggestions based on user request.

**Request:**
```json
{
  "highlightedText": "sunset",
  "customRequest": "make it more dramatic",
  "fullPrompt": "beach at sunset"
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "text": "dramatic sunset with deep orange and purple hues",
      "category": "lighting"
    }
  ]
}
```

#### POST /api/detect-scene-change

Detect if prompt describes a new scene (video mode).

**Request:**
```json
{
  "changedField": "location",
  "newValue": "mountain peak",
  "oldValue": "beach",
  "fullPrompt": "Current prompt text",
  "affectedFields": ["location", "lighting"],
  "sectionHeading": "Setting",
  "sectionContext": "..."
}
```

**Response:**
```json
{
  "isSceneChange": true,
  "confidence": 0.89,
  "reason": "Different location and subject",
  "affectedElements": ["location", "lighting"]
}
```

#### POST /api/role-classify

Classify text spans by semantic role (subject, action, location, etc.).

**Request:**
```json
{
  "text": "A woman walks on a beach"
}
```

**Response:**
```json
{
  "roles": [
    {
      "text": "woman",
      "role": "subject",
      "confidence": 0.95
    }
  ]
}
```

#### POST /api/video/suggestions

Get creative suggestions for the video concept builder.

**Request:**
```json
{
  "elementType": "subject",
  "currentValue": "elderly historian",
  "context": {
    "location": "sun-drenched wheat field",
    "mood": "nostalgic warmth"
  },
  "concept": "Quiet character portrait"
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "text": "elderly historian with weathered hands polishing a silver pocket watch",
      "explanation": "Builds on the subject while reinforcing the nostalgic tone."
    },
    {
      "text": "elderly historian shielding his notes beneath an ancient oak",
      "explanation": "Keeps the subject consistent and resolves the lighting/location conflict."
    }
  ]
}
```
#### POST /api/video/validate

Validate element compatibility and detect conflicts in a single call.

**Request:**
```json
{
  "elementType": "location",
  "value": "sun-drenched wheat field",
  "elements": {
    "subject": "elderly historian beneath an ancient oak tree",
    "mood": "nostalgic warmth"
  }
}
```

**Response:**
```json
{
  "compatibility": {
    "score": 0.42,
    "feedback": "Subject is under an oak tree while location says wheat field.",
    "conflicts": [
      "subject vs. location"
    ],
    "suggestions": [
      "Clarify if the historian is in the field or under the tree."
    ]
  },
  "conflicts": [
    {
      "elements": ["subject", "location"],
      "severity": "medium",
      "message": "The location and subject describe different setups.",
      "resolution": "Either move the subject into the wheat field or adjust the location."
    }
  ]
}
```

#### POST /api/video/complete

Auto-complete missing elements and optionally fetch smart defaults for a specific slot.

**Request:**
```json
{
  "existingElements": {
    "subject": "elderly historian with weathered hands",
    "location": "sun-drenched wheat field"
  },
  "concept": "Quiet character portrait",
  "smartDefaultsFor": "camera"
}
```

**Response:**
```json
{
  "suggestions": {
    "subject": "elderly historian with weathered hands",
    "location": "sun-drenched wheat field",
    "action": "gently polishing an heirloom pocket watch",
    "mood": "nostalgic warmth",
    "style": "shot on 35mm film with soft backlight"
  },
  "smartDefaults": {
    "camera": {
      "angle": "medium close-up from waist height",
      "movement": "gentle dolly in",
      "lens": "50mm at f/2"
    }
  }
}
```

#### POST /api/video/variations

Generate alternative takes on the current concept.

**Request:**
```json
{
  "elements": {
    "subject": "elderly historian with weathered hands",
    "location": "sun-drenched wheat field",
    "action": "gently polishing an heirloom pocket watch"
  },
  "concept": "Quiet character portrait"
}
```

**Response:**
```json
{
  "variations": [
    {
      "name": "Dusty Archives",
      "description": "Moves the historian indoors surrounded by parchment scrolls.",
      "elements": { "...": "..." },
      "changes": ["Relocates scene to archive", "Cool, desaturated palette"]
    },
    {
      "name": "Golden Hour Memories",
      "description": "Keeps the wheat field but introduces family photographs fluttering in the breeze.",
      "elements": { "...": "..." },
      "changes": ["Adds prop storytelling", "Warmer lighting emphasis"]
    }
  ]
}
```

#### POST /api/video/parse

Convert a free-form concept paragraph into structured elements.

**Request:**
```json
{
  "concept": "An aging jazz musician plays a final set under flickering club lights."
}
```

**Response:**
```json
{
  "elements": {
    "subject": "aging jazz musician with weathered trumpet",
    "action": "playing a heartfelt final set",
    "location": "smoke-filled underground jazz club",
    "mood": "melancholic and soulful",
    "style": "shot on 16mm film with warm practical lighting"
  }
}
```

#### POST /api/validate-prompt

Validate prompt quality before optimization.

**Request:**
```json
{
  "prompt": "Your prompt here",
  "mode": "default"
}
```

**Response:**
```json
{
  "isValid": true,
  "issues": [],
  "score": 78,
  "recommendations": [
    "Add more specific details",
    "Clarify the desired outcome"
  ]
}
```

### Health Endpoints

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness probe (checks dependencies)
- `GET /health/live` - Liveness probe

### Metrics

- `GET /metrics` - Prometheus metrics
- `GET /stats` - System statistics (JSON)

---

## Components

### Frontend Components

#### PromptOptimizerContainer

Main container component managing state and orchestration.

**Location:** `src/components/PromptOptimizerContainer.jsx` (663 lines)

**Key Features:**
- State management for entire optimization flow
- Mode switching
- History management
- Settings persistence
- Toast notifications

**Props:** None (root component)

#### PromptInput

Text input interface with real-time validation.

**Props:**
```javascript
{
  value: string,
  onChange: (value: string) => void,
  placeholder: string,
  disabled: boolean
}
```

#### PromptCanvas

Results display with typewriter animation.

**Props:**
```javascript
{
  result: string,
  qualityScore: number,
  isLoading: boolean,
  onCopy: () => void,
  onExport: (format: 'text'|'markdown'|'json') => void
}
```

#### VideoConceptBuilder

Interactive concept builder for video mode.

**Features:**
- Element-by-element construction
- AI-powered suggestions
- Compatibility checking
- Technical parameter generation
- Scene completion

**Props:**
```javascript
{
  onConceptComplete: (concept: object) => void,
  initialConcept: object
}
```

#### HistorySidebar

Prompt history with search and filtering.

**Props:**
```javascript
{
  userId: string,
  onSelectPrompt: (prompt: object) => void,
  isOpen: boolean,
  onClose: () => void
}
```

### Backend Services

#### AIModelService

Unified router for all LLM operations. Decouples business logic from specific providers.

**Location:** `server/src/services/ai-model/AIModelService.js`

**Key Methods:**

```javascript
// Execute operation with automatic routing
async execute(operation, params)

// Stream operation for real-time updates
async stream(operation, params, onChunk)
```

**Features:**
- Operation-based routing (from ModelConfig)
- Automatic fallback between providers
- Streaming support
- Circuit breaker awareness
- Environment variable overrides

**Example:**
```javascript
const response = await aiService.execute('optimize_standard', {
  systemPrompt: 'You are a helpful assistant',
  userMessage: 'Optimize this prompt...',
  temperature: 0.7
});
```

#### LLMClient

Generic, provider-agnostic LLM client using adapter pattern.

**Location:** `server/src/clients/LLMClient.js`

**Features:**
- Works with any OpenAI-compatible API
- Provider adapters (OpenAI, Groq, Gemini)
- Circuit breaker per provider
- Concurrency limiting
- Metrics collection
- JSON mode support

#### PromptOptimizationService

Core optimization engine with two-stage optimization.

**Location:** `server/src/services/prompt-optimization/PromptOptimizationService.js`

**Key Methods:**

```javascript
// Single-stage optimization (backward compatible)
async optimize({ prompt, mode, context, brainstormContext })

// Two-stage optimization with streaming
async optimizeTwoStage({ prompt, mode, context, brainstormContext, onDraft })
```

**Features:**
- 5 optimization modes
- Two-stage optimization (draft + refined)
- Parallel span labeling
- Template version tracking
- Caching integration
- Quality scoring

#### SpanLabelingService

Comprehensive span labeling system for text categorization and highlighting.

**Location:** `server/src/llm/span-labeling/SpanLabelingService.js`

**Key Methods:**

```javascript
// Label spans in text
async labelSpans(text, policy, options)

// Chunked processing for large texts
async labelSpansChunked(text, policy, options)
```

**Features:**
- Dynamic taxonomy generation from shared/taxonomy.js
- Chunked processing for large texts (parallel execution)
- Substring position caching
- Schema validation and automatic repair
- Multi-provider LLM support
- Batch processing support

#### EnhancementService

Text enhancement suggestions with multiple sub-services.

**Location:** `server/src/services/enhancement/EnhancementService.js`

**Key Methods:**

```javascript
async getEnhancementSuggestions({
  highlightedText,
  fullPrompt,
  brainstormContext,
  allLabeledSpans,
  editHistory
})

async getCustomSuggestions({ highlightedText, customRequest, fullPrompt })
```

**Features:**
- Simple/Complex prompt modes (feature flag)
- Context-aware suggestions
- Edit history tracking
- Category alignment
- Style transfer
- Fallback regeneration

**Sub-Services:**
- `BrainstormContextBuilder` - Builds context from brainstorm data
- `CleanPromptBuilder` - Generates clean prompts
- `SuggestionValidationService` - Validates suggestions
- `SuggestionDeduplicator` - Ensures diversity
- `CategoryAlignmentService` - Aligns suggestions with categories
- `StyleTransferService` - Transfers style between suggestions

#### VideoConceptService

AI-powered creative suggestions for video prompts.

**Location:** `server/src/services/VideoConceptService.js`

**Methods:**
```javascript
async getCreativeSuggestions({ elementType, currentValue, context, concept })
async checkCompatibility({ elementType, value, existingElements })
async detectConflicts({ elements })
async completeScene({ existingElements, concept })
async generateVariations({ elements, concept })
async parseConcept({ concept })
```

#### QualityFeedbackService

ML-based quality assessment system.

**Location:** `server/src/services/quality-feedback/QualityFeedbackService.js`

**Features:**
- Feature extraction from prompts
- Quality scoring model
- Feedback repository
- Statistical analysis

#### TextCategorizerService

Semantic text parsing into categorized spans.

**Location:** `server/src/services/text-categorization/TextCategorizerService.js`

**Methods:**
```javascript
async parseText({ text })
```

#### TaxonomyValidationService

Validates taxonomy structure and detects orphans.

**Location:** `server/src/services/taxonomy-validation/TaxonomyValidationService.js`

**Features:**
- Hierarchy validation
- Orphan detection
- Validation reporting

### Custom Hooks

#### usePromptOptimizer

Main optimization hook with streaming support.

**Usage:**
```javascript
const {
  optimize,
  optimizeStream,
  result,
  isLoading,
  error,
  qualityScore
} = usePromptOptimizer();
```

#### useSpanLabeling

Span labeling hook with debouncing and caching.

**Location:** `client/src/features/span-highlighting/hooks/useSpanLabeling.js`

**Usage:**
```javascript
const {
  spans,
  status,
  error,
  refresh
} = useSpanLabeling({
  text: "Your text here",
  policy: "highlighting",
  options: {}
});
```

**Features:**
- Automatic debouncing
- Client-side caching
- Request cancellation
- Performance tracking

#### usePromptHistory

History management hook.

**Usage:**
```javascript
const {
  history,
  addToHistory,
  deleteFromHistory,
  searchHistory
} = usePromptHistory(userId);
```

#### useSettings

Settings persistence hook.

**Usage:**
```javascript
const {
  settings,
  updateSettings,
  resetSettings
} = useSettings();
```

---

## Testing

### Unit Tests

**Framework:** Vitest with Testing Library

**Run tests:**
```bash
npm run test              # Watch mode
npm run test:unit         # Run once
npm run test:ui           # UI mode
npm run test:coverage     # With coverage
```

**Test Structure:**
```
__tests__/
├── components/          # Component tests
├── services/           # Service tests
├── hooks/              # Hook tests
├── utils/              # Utility tests
└── integration/        # Integration tests
```

**Coverage Requirements:**
- Statements: > 80%
- Branches: > 75%
- Functions: > 80%
- Lines: > 80%

### E2E Tests

**Framework:** Playwright

**Run tests:**
```bash
npm run test:e2e          # Headless
npm run test:e2e:ui       # UI mode
npm run test:e2e:debug    # Debug mode
```

**Test Scenarios:**
```
e2e/
├── optimization.spec.js    # Core optimization flows
├── history.spec.js         # History management
├── video-mode.spec.js      # Video prompt features
└── authentication.spec.js  # Auth flows
```

### Load Tests

**Framework:** k6

**Run tests:**
```bash
npm run test:load              # Basic load test
npm run test:load:stress       # Stress test
npm run test:load:quick        # Quick 30s test
```

### Linting & Formatting

```bash
npm run lint              # Check linting
npm run lint:fix          # Fix linting issues
npm run lint:security     # Security linting
npm run format            # Format code
npm run format:check      # Check formatting
```

---

## Deployment

### Environment Setup

Set required environment variables for production:

```env
NODE_ENV=production
PORT=3001
OPENAI_API_KEY=your_production_key
REDIS_URL=redis://production-redis:6379
```

### Docker Deployment

**Build image:**
```bash
docker build -t prompt-builder:latest .
```

**Run container:**
```bash
docker run -p 3001:3001 \
  -e OPENAI_API_KEY=your_key \
  -e NODE_ENV=production \
  prompt-builder:latest
```

**Docker Compose:**
```bash
docker-compose up -d
```

This starts:
- API service (Node.js)
- Redis (caching)
- Prometheus (metrics)
- Grafana (dashboards)

### Kubernetes Deployment

**Prerequisites:**
- kubectl configured
- Kubernetes cluster access

**Deploy:**
```bash
# Apply base configurations
kubectl apply -f infrastructure/kubernetes/base/

# Apply environment overlay
kubectl apply -k infrastructure/kubernetes/overlays/production/
```

**Resources created:**
- Deployment (3 replicas)
- Service (ClusterIP)
- HorizontalPodAutoscaler (2-10 pods)
- Ingress (HTTPS)
- ConfigMap (configuration)
- Secret (sensitive data)
- ServiceAccount
- PodDisruptionBudget
- ServiceMonitor (Prometheus)

**Verify deployment:**
```bash
kubectl get pods -l app=prompt-builder
kubectl logs -f deployment/prompt-builder
```

**Scale deployment:**
```bash
kubectl scale deployment prompt-builder --replicas=5
```

### Edge Deployment (Cloudflare Workers)

Deploy span labeling endpoint to Cloudflare edge for reduced latency.

**Location:** `infrastructure/edge/`

**Deploy:**
```bash
cd infrastructure/edge
wrangler deploy
```

**Features:**
- Edge caching for span labeling
- Reduced latency for global users
- Automatic cache invalidation
- Origin fallback on cache miss

### Firebase Hosting

**Build frontend:**
```bash
npm run build
```

**Deploy to production:**
```bash
firebase deploy --only hosting:production
```

**Deploy to staging:**
```bash
firebase deploy --only hosting:staging
```

**Deploy Firestore rules:**
```bash
firebase deploy --only firestore:rules
```

### CI/CD Pipeline

Automated deployment with GitHub Actions (example):

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:e2e

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: docker build -t prompt-builder .
      - run: docker push prompt-builder
      - run: kubectl apply -k k8s/overlays/production/
```

---

## Monitoring

### Health Checks

**Endpoints:**
- `/health` - Basic health check
- `/health/ready` - Readiness (checks dependencies)
- `/health/live` - Liveness (checks process)

**Kubernetes probes:**
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 5
```

### Metrics

**Prometheus metrics exposed at `/metrics`:**

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration histogram
- `http_request_size_bytes` - Request size
- `http_response_size_bytes` - Response size
- `cache_hits_total` - Cache hits
- `cache_misses_total` - Cache misses
- `openai_api_calls_total` - OpenAI API calls
- `openai_api_errors_total` - OpenAI API errors
- `circuit_breaker_opened_total` - Circuit breaker opens

**View metrics:**
```bash
curl http://localhost:3001/metrics
```

**System stats:**
```bash
curl http://localhost:3001/stats | jq
```

### Logging

**Structured logging with Pino:**

```javascript
{
  "level": "info",
  "time": 1234567890,
  "pid": 12345,
  "hostname": "pod-xyz",
  "requestId": "abc-123",
  "method": "POST",
  "url": "/api/optimize",
  "statusCode": 200,
  "duration": 234,
  "msg": "Request completed"
}
```

**Log levels:**
- `error` - Errors requiring attention
- `warn` - Warning conditions
- `info` - Informational messages
- `debug` - Debug information

### Monitoring Stack

**Start monitoring:**
```bash
npm run perf:monitor
```

This starts:
- **Prometheus** (http://localhost:9090) - Metrics collection
- **Grafana** (http://localhost:3000) - Dashboards

**Grafana credentials:**
- Username: `admin`
- Password: `admin`

**Pre-configured dashboards:**
- API Performance
- Cache Performance
- Error Rates
- Circuit Breaker Status

**Stop monitoring:**
```bash
npm run perf:monitor:stop
```

---

## Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Run tests**
   ```bash
   npm run test:all
   ```
5. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add new feature"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Create a Pull Request**

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Test additions or updates
- `chore:` - Build process or tooling changes

### Code Style

- **JavaScript:** ESLint + Prettier
- **React:** Functional components + hooks
- **Naming:** camelCase for functions/variables, PascalCase for components
- **Comments:** JSDoc for functions, inline for complex logic

### Pull Request Checklist

- [ ] Tests pass (`npm run test:all`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code formatted (`npm run format`)
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No console.logs or debug code
- [ ] Security considerations addressed

---

## Security

### Best Practices

- **API Keys:** Never commit API keys (use `.env` files)
- **Input Validation:** All inputs validated with Joi schemas
- **XSS Prevention:** DOMPurify sanitization
- **CSRF Protection:** Tokens for state-changing operations
- **Rate Limiting:** Tiered limits on all endpoints
- **Security Headers:** Helmet.js configuration
- **Authentication:** Firebase Auth with secure tokens

### Reporting Vulnerabilities

Email security issues to: security@yourproject.com

---

## Performance

### Optimization Strategies

- **Caching:** Multi-tier (in-memory + Redis)
- **Compression:** Gzip/Brotli compression
- **Circuit Breaker:** Prevents cascade failures
- **Connection Pooling:** Reuse HTTP connections
- **CDN:** Static assets via CDN
- **Code Splitting:** Lazy load components

### Performance Benchmarks

- **API Response Time:** < 500ms (p95)
- **Cache Hit Rate:** > 80%
- **Error Rate:** < 0.1%
- **Uptime:** > 99.9%

---

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
npm run restart
```

**Firebase authentication errors:**
- Check Firebase console for project settings
- Verify environment variables
- Ensure Firestore rules are deployed

**OpenAI API errors:**
- Verify API key is valid
- Check rate limits
- Monitor circuit breaker status

**Build failures:**
```bash
rm -rf node_modules
rm package-lock.json
npm install
npm run build
```

---

## License

MIT License - see [LICENSE](LICENSE) file for details

---

## Acknowledgments

- OpenAI for GPT API
- Firebase team for backend infrastructure
- React community for excellent tooling
- All contributors to this project

---

## Support

- **Documentation:** [docs/](docs/)
- **Issues:** [GitHub Issues](https://github.com/yourusername/prompt-builder/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/prompt-builder/discussions)
- **Email:** support@yourproject.com

---

**Built with ❤️ by [Your Name/Team]**

---

## Recent Major Changes

### LLM Architecture Refactoring (November 2025)

- **Generic LLMClient**: Replaced provider-specific clients (OpenAIAPIClient, GroqAPIClient) with a single generic `LLMClient` that works with any OpenAI-compatible API
- **AIModelService Router**: Unified router for all LLM operations with operation-based routing and automatic fallback
- **Zero-Code Provider Addition**: New providers can be added via configuration only (no code changes)
- **Fixed Critical Bugs**: Span labeling JSON mode, fallback model switching

### Span Labeling System

- **Comprehensive Text Categorization**: Real-time span labeling with dynamic taxonomy
- **Chunked Processing**: Handles large texts efficiently with parallel chunk processing
- **Batch API**: `/llm/label-spans-batch` reduces API calls by 60% under concurrent load
- **Substring Position Caching**: Performance-optimized caching for span positions
- **Multi-Provider Support**: Works with OpenAI, Groq, and Gemini

### Two-Stage Optimization

- **Fast Draft Generation**: Sub-second draft responses using Groq
- **Parallel Span Labeling**: Spans generated alongside draft for immediate highlighting
- **Streaming Support**: Server-Sent Events (SSE) for real-time updates
- **Progressive Enhancement**: Draft → Spans → Refined workflow

### Enhancement Service Improvements

- **Simple Prompt Mode**: Feature flag for faster, cleaner prompts
- **Edit History Tracking**: Consistency across multiple edits
- **Brainstorm Context**: Integration with brainstorm data for better suggestions
- **Category Alignment**: Suggestions aligned with semantic categories

### Infrastructure Improvements

- **Dependency Injection Container**: Clean service registration and resolution
- **Request Batching & Coalescing**: Performance optimizations for concurrent requests
- **Sentry Integration**: Error tracking and performance monitoring
- **Edge Deployment**: Cloudflare Workers support for span labeling
- **Enhanced Monitoring**: Prometheus metrics, health checks, performance tracking

---

Last Updated: November 2025
