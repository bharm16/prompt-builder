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

- **Intelligent Enhancement System**
  - Real-time text selection suggestions
  - ML-powered phrase recognition
  - Context-aware improvements
  - Scene change detection

- **Creative Brainstorm** (Video Mode)
  - Interactive concept builder
  - Element-by-element construction
  - AI-powered suggestions
  - Compatibility checking
  - Technical parameter generation

- **Quality Assessment**
  - Automated quality scoring (0-100)
  - Expansion ratio tracking
  - Structure analysis
  - Completeness checks

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

### Enterprise Features

- Firebase authentication
- Multi-tier caching (in-memory + Redis)
- Circuit breaker pattern
- Rate limiting (global, API, route-specific)
- Comprehensive security (Helmet, CORS, validation)
- Structured logging (Pino)
- Prometheus metrics
- Health check endpoints
- Kubernetes-ready

---

## Architecture

### System Design

```
┌─────────────────┐
│   React UI      │
│  (Vite + React) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Express API    │
│  (Port 3001)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌─────────┐
│Firebase│ │ OpenAI  │
│Firestore│ │   API   │
└────────┘ └─────────┘
```

### Request Flow

```
User Input
  ↓
PromptOptimizerContainer (React State)
  ↓
usePromptOptimizer Hook
  ↓
fetch('/api/optimize')
  ↓
Express Middleware Stack
  ├─ Request ID
  ├─ Security (Helmet)
  ├─ CORS
  ├─ Rate Limiting
  ├─ Compression
  ├─ API Auth
  └─ Validation
  ↓
PromptOptimizationService
  ├─ Mode Detection
  ├─ Cache Check
  ├─ OpenAI API (Circuit Breaker)
  ├─ Constitutional AI
  └─ Response Validation
  ↓
Quality Assessment
  ↓
Firebase Storage
  ↓
Response with Results
```

### Directory Structure

```
prompt-builder/
├── src/
│   ├── components/          # React components (12 files)
│   │   ├── PromptOptimizerContainer.jsx (663 lines)
│   │   ├── PromptInput.jsx
│   │   ├── PromptCanvas.jsx
│   │   ├── VideoConceptBuilder.jsx
│   │   └── ...
│   ├── features/           # Feature modules
│   │   ├── auth/          # Firebase authentication
│   │   ├── history/       # Prompt history management
│   │   └── prompt-optimizer/
│   ├── services/          # Business logic (11 services)
│   │   ├── PromptOptimizationService.js (1882 lines)
│   │   ├── VideoConceptService.js
│   │   ├── EnhancementService.js
│   │   ├── SceneDetectionService.js
│   │   ├── QuestionGenerationService.js
│   │   ├── VideoPromptTemplates.js
│   │   ├── CacheService.js
│   │   └── ...
│   ├── clients/           # API clients (OpenAI, Claude)
│   ├── hooks/             # React custom hooks
│   ├── infrastructure/    # Logger, Metrics, Tracing
│   ├── middleware/        # Express middleware
│   ├── routes/            # API route definitions
│   └── utils/             # Utility functions
├── server/                # Backend server code
├── e2e/                  # Playwright E2E tests
├── __tests__/            # Vitest unit tests (169 files)
├── k8s/                  # Kubernetes configurations
├── monitoring/           # Monitoring configs
├── docs/                 # Documentation
└── scripts/              # Build/utility scripts
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
- **Helmet** - Security headers
- **express-rate-limit** - Rate limiting
- **Opossum** - Circuit breaker
- **prom-client** - Prometheus metrics
- **Compromise** - NLP library
- **Joi** - Validation schema

### Testing

- **Vitest 3.2.4** - Unit testing
- **Playwright 1.56.0** - E2E testing
- **Testing Library** - React testing utilities
- **Supertest** - API testing
- **Nock** - HTTP mocking

### Infrastructure

- **Docker** - Containerization
- **Kubernetes** - Orchestration
- **Prometheus** - Metrics collection
- **Grafana** - Dashboards
- **Redis** - Optional caching

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

Main prompt optimization endpoint.

**Request:**
```json
{
  "input": "Your prompt here",
  "mode": "default|reasoning|research|socratic|video",
  "modelName": "gpt-4-turbo-preview",
  "enableAI": true,
  "enhancementOptions": {},
  "previousVersion": null
}
```

**Response:**
```json
{
  "optimizedPrompt": "Optimized version...",
  "qualityScore": 85,
  "expansionRatio": 3.2,
  "suggestions": [],
  "metadata": {
    "mode": "default",
    "modelUsed": "gpt-4-turbo-preview",
    "processingTime": 1234
  }
}
```

#### POST /api/generate-questions

Generate context questions for deeper understanding.

**Request:**
```json
{
  "input": "Your prompt here",
  "mode": "default"
}
```

**Response:**
```json
{
  "questions": [
    "What is the primary goal?",
    "Who is the target audience?",
    "What constraints exist?"
  ]
}
```

#### POST /api/get-enhancement-suggestions

Get enhancement suggestions for selected text (video mode).

**Request:**
```json
{
  "selectedText": "a person walking",
  "fullPrompt": "a person walking on a beach",
  "cursorPosition": 15
}
```

**Response:**
```json
{
  "suggestions": [
    "a woman in her 30s walking",
    "a lone figure walking",
    "a silhouetted person walking"
  ]
}
```

#### POST /api/detect-scene-change

Detect if prompt describes a new scene (video mode).

**Request:**
```json
{
  "newPrompt": "Current prompt text",
  "previousPrompt": "Previous prompt text"
}
```

**Response:**
```json
{
  "isSceneChange": true,
  "confidence": 0.89,
  "reason": "Different location and subject"
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

#### PromptOptimizationService

Core optimization engine (1882 lines).

**Location:** `src/services/PromptOptimizationService.js`

**Key Methods:**

```javascript
// Main optimization method
async optimizePrompt(input, options)

// Mode-specific optimization
async optimizeForMode(input, mode, options)

// Quality assessment
calculateQualityScore(input, output)

// Constitutional AI filtering
async applyConstitutionalAI(prompt)
```

**Features:**
- 5 optimization modes
- Iterative refinement
- Template version tracking
- Caching integration
- Quality scoring

#### VideoConceptService

AI-powered creative suggestions for video prompts.

**Methods:**
```javascript
async getSuggestions(category, context)
async checkCompatibility(elements)
async generateVariations(concept)
```

#### EnhancementService

Text enhancement suggestions.

**Methods:**
```javascript
async getEnhancements(selectedText, fullPrompt, position)
async getCustomSuggestions(request)
```

#### SceneDetectionService

Scene change detection for video prompts.

**Methods:**
```javascript
async detectSceneChange(newPrompt, previousPrompt)
```

### Custom Hooks

#### usePromptOptimizer

Main optimization hook.

**Usage:**
```javascript
const {
  optimize,
  result,
  isLoading,
  error,
  qualityScore
} = usePromptOptimizer();
```

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
kubectl apply -f k8s/base/

# Apply environment overlay
kubectl apply -k k8s/overlays/production/
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

**Verify deployment:**
```bash
kubectl get pods -l app=prompt-builder
kubectl logs -f deployment/prompt-builder
```

**Scale deployment:**
```bash
kubectl scale deployment prompt-builder --replicas=5
```

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

Last Updated: October 2025
