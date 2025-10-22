# Prompt Builder - Comprehensive Technical Documentation

**Version**: 0.1.0
**Date**: October 2025
**Document Type**: Technical Architecture & Implementation Guide

---

## Executive Summary

The Prompt Builder is a production-grade, AI-powered prompt optimization platform designed to enhance prompts across multiple use cases including reasoning, research, learning, and AI video generation. Built with a modern JavaScript stack (React 18.2 + Express 4.21), the system implements enterprise-level patterns including multi-tier caching, circuit breakers, comprehensive monitoring, and Kubernetes-ready deployment configurations.

The platform serves as an intelligent middleware layer between users and AI models (primarily OpenAI's GPT-4), transforming simple user inputs into optimized, context-aware prompts that maximize AI model performance. With support for five distinct optimization modes and real-time enhancement suggestions, it addresses the critical challenge of prompt engineering in AI applications.

### Key Architectural Highlights

- **Microservices-Ready Architecture**: Modular service design with clear separation of concerns
- **Enterprise Security**: Multi-layered security with Helmet.js, CORS, rate limiting, and Firebase authentication
- **Production Resilience**: Circuit breaker patterns, graceful degradation, and comprehensive error handling
- **Observable System**: Prometheus metrics, structured logging (Pino), and distributed tracing support
- **Scalable Infrastructure**: Kubernetes-native with horizontal pod autoscaling and zero-downtime deployments

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Core Components & Design Patterns](#2-core-components--design-patterns)
3. [Data Flow & State Management](#3-data-flow--state-management)
4. [Backend Services Architecture](#4-backend-services-architecture)
5. [Frontend Architecture](#5-frontend-architecture)
6. [API Design & Endpoints](#6-api-design--endpoints)
7. [Security Architecture](#7-security-architecture)
8. [Performance & Optimization](#8-performance--optimization)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment & Infrastructure](#10-deployment--infrastructure)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Development Workflow](#12-development-workflow)

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

The Prompt Builder follows a three-tier architecture pattern with clear separation between presentation, business logic, and data layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           React SPA (Vite-powered)                   │   │
│  │  - Component-based UI with hooks                     │   │
│  │  - Client-side routing (React Router v7)             │   │
│  │  - State management via Context + hooks              │   │
│  │  - Real-time updates & animations                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/REST
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Express.js API Server (Port 3001)          │   │
│  │                                                       │   │
│  │  Middleware Stack:                                    │   │
│  │  ├─ Security (Helmet, CORS)                         │   │
│  │  ├─ Rate Limiting (tiered)                          │   │
│  │  ├─ Request Processing                              │   │
│  │  ├─ Authentication                                  │   │
│  │  └─ Error Handling                                  │   │
│  │                                                       │   │
│  │  Service Layer:                                       │   │
│  │  ├─ PromptOptimizationService                       │   │
│  │  ├─ VideoConceptService                       │   │
│  │  ├─ EnhancementService                              │   │
│  │  ├─ SceneDetectionService                           │   │
│  │  └─ QuestionGenerationService                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│     Data Layer          │  │   External Services     │
│                         │  │                         │
│  ┌─────────────────┐   │  │  ┌─────────────────┐   │
│  │   Firebase      │   │  │  │   OpenAI API    │   │
│  │   Firestore     │   │  │  │   (GPT-4)       │   │
│  │                 │   │  │  └─────────────────┘   │
│  │  - User Auth    │   │  │                         │
│  │  - Prompt       │   │  │  ┌─────────────────┐   │
│  │    History      │   │  │  │   Redis Cache   │   │
│  │  - Templates    │   │  │  │   (Optional)    │   │
│  └─────────────────┘   │  │  └─────────────────┘   │
└─────────────────────────┘  └─────────────────────────┘
```

### 1.2 Technology Stack Breakdown

#### Frontend Technologies
- **React 18.2.0**: UI framework with concurrent features and automatic batching
- **Vite 7.1.9**: Build tool providing sub-second HMR and optimized production builds
- **React Router DOM 7.9.4**: Client-side routing with nested routes and data loading
- **Tailwind CSS 3.3.6**: Utility-first CSS framework for rapid UI development
- **Lucide React**: Lightweight icon library with tree-shaking support
- **DOMPurify 3.3.0**: XSS sanitization for user-generated content

#### Backend Technologies
- **Node.js 20+**: JavaScript runtime with native ESM support
- **Express 4.21.2**: Minimalist web framework with extensive middleware ecosystem
- **Firebase 12.4.0**: NoSQL database and authentication service
- **Helmet 8.1.0**: Security headers middleware
- **Express Rate Limit 8.1.0**: Flexible rate limiting middleware
- **Opossum 5.0.1**: Circuit breaker implementation
- **Pino 10.0.0**: High-performance structured logging
- **Joi 18.0.1**: Schema validation for API inputs

#### Infrastructure & DevOps
- **Docker**: Container runtime with multi-stage builds
- **Kubernetes**: Container orchestration with HPA and rolling updates
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Metrics visualization and dashboards
- **GitHub Actions**: CI/CD pipeline automation

### 1.3 Design Principles

The architecture adheres to several key design principles:

1. **Separation of Concerns**: Clear boundaries between layers with defined interfaces
2. **Single Responsibility**: Each service/component has one well-defined purpose
3. **Dependency Inversion**: High-level modules don't depend on low-level modules
4. **Open/Closed Principle**: System is open for extension but closed for modification
5. **Interface Segregation**: Clients depend only on interfaces they use
6. **Fail-Fast Philosophy**: Early validation and error detection
7. **Defense in Depth**: Multiple security layers throughout the stack

---

## 2. Core Components & Design Patterns

### 2.1 Service Layer Architecture

The service layer implements a modular design where each service encapsulates specific business logic:

```javascript
// Service Interface Pattern
class BaseService {
  constructor(apiClient, options = {}) {
    this.apiClient = apiClient;
    this.cache = options.cache || new CacheService();
    this.logger = options.logger || logger;
    this.metrics = options.metrics || metricsService;
  }

  async execute(operation, params) {
    const startTime = Date.now();
    try {
      // Pre-execution hooks
      await this.beforeExecute(operation, params);

      // Check cache
      const cached = await this.checkCache(operation, params);
      if (cached) return cached;

      // Execute operation
      const result = await this[operation](params);

      // Post-execution hooks
      await this.afterExecute(operation, result);

      // Update metrics
      this.recordMetrics(operation, Date.now() - startTime);

      return result;
    } catch (error) {
      this.handleError(error, operation);
      throw error;
    }
  }
}
```

#### Key Services

1. **PromptOptimizationService** (1,882 lines)
   - Core optimization engine with mode detection
   - Implements iterative refinement algorithms
   - Constitutional AI integration for output validation
   - Template version tracking for backward compatibility

2. **VideoConceptService**
   - AI-powered suggestion generation
   - Context-aware recommendations
   - User preference learning
   - Compatibility checking between elements

3. **EnhancementService**
   - Real-time text enhancement suggestions
   - Phrase recognition and improvement
   - Custom suggestion handling
   - Position-aware context processing

4. **SceneDetectionService**
   - Video prompt scene change detection
   - Confidence scoring for transitions
   - Field-level change tracking
   - Semantic similarity analysis

5. **QuestionGenerationService**
   - Context question generation
   - Socratic method implementation
   - Progressive complexity handling
   - Domain-specific question templates

### 2.2 Design Patterns Implementation

#### Circuit Breaker Pattern
```javascript
// Implementation in OpenAIAPIClient.js
class OpenAIAPIClient {
  constructor(apiKey, options = {}) {
    this.circuitBreaker = new CircuitBreaker(
      this.makeRequest.bind(this),
      {
        timeout: options.timeout || 60000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        bucketSpan: 10000,
        bucketNum: 6,
        volumeThreshold: 10,
      }
    );

    // Circuit breaker state monitoring
    this.circuitBreaker.on('open', () => {
      logger.error('Circuit breaker opened - API unavailable');
      metricsService.increment('circuit_breaker.opened');
    });

    this.circuitBreaker.on('halfOpen', () => {
      logger.info('Circuit breaker half-open - testing API');
    });
  }
}
```

#### Repository Pattern
```javascript
// Firebase data access abstraction
class PromptRepository {
  async save(userId, promptData) {
    const uuid = uuidv4();
    const docRef = await addDoc(collection(db, 'prompts'), {
      userId,
      uuid,
      ...promptData,
      timestamp: serverTimestamp(),
    });
    return { id: docRef.id, uuid };
  }

  async findByUser(userId, options = {}) {
    const q = query(
      collection(db, 'prompts'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(options.limit || 10)
    );
    return this.executeQuery(q);
  }
}
```

#### Strategy Pattern for Optimization Modes
```javascript
// Mode-specific optimization strategies
class OptimizationStrategy {
  static strategies = {
    reasoning: new ReasoningStrategy(),
    research: new ResearchStrategy(),
    socratic: new SocraticStrategy(),
    video: new VideoStrategy(),
    default: new DefaultStrategy(),
  };

  static getStrategy(mode) {
    return this.strategies[mode] || this.strategies.default;
  }
}

class ReasoningStrategy {
  async optimize(prompt, context) {
    // Reasoning-specific optimization logic
    return `Let's think through this step-by-step...`;
  }
}
```

#### Observer Pattern for Real-time Updates
```javascript
// Event-driven architecture for UI updates
class PromptEventEmitter extends EventEmitter {
  emitOptimizationComplete(data) {
    this.emit('optimization:complete', data);
  }

  emitSuggestionReceived(suggestions) {
    this.emit('suggestion:received', suggestions);
  }

  emitSceneChange(changeData) {
    this.emit('scene:changed', changeData);
  }
}
```

### 2.3 Middleware Architecture

The Express middleware stack implements a pipeline pattern:

```javascript
// Middleware execution order (server/index.js)
app.use(requestIdMiddleware);        // 1. Assign unique request ID
app.use(helmet());                    // 2. Security headers
app.use(compression());               // 3. Response compression
app.use(rateLimiter);                 // 4. Rate limiting
app.use(cors());                      // 5. CORS handling
app.use(express.json());             // 6. Body parsing
app.use(logger.requestLogger());     // 7. Request logging
app.use(metricsService.middleware()); // 8. Metrics collection
app.use('/api', apiAuthMiddleware);  // 9. API authentication
app.use('/api', apiRoutes);          // 10. Route handling
app.use(errorHandler);                // 11. Error handling
```

---

## 3. Data Flow & State Management

### 3.1 Request Lifecycle

A typical optimization request follows this flow:

```
1. User Input (React UI)
   ↓
2. Form Validation (Client-side)
   ↓
3. HTTP Request (fetch API)
   ↓
4. Express Middleware Pipeline
   ├─ Request ID Assignment
   ├─ Security Checks
   ├─ Rate Limit Check
   ├─ Authentication
   └─ Request Validation (Joi)
   ↓
5. Service Layer Processing
   ├─ Mode Detection
   ├─ Cache Lookup
   ├─ OpenAI API Call (if needed)
   ├─ Response Processing
   └─ Cache Update
   ↓
6. Quality Assessment
   ├─ Score Calculation
   ├─ Metrics Recording
   └─ Constitutional AI Review
   ↓
7. Firebase Storage
   ↓
8. Response Formatting
   ↓
9. HTTP Response
   ↓
10. UI Update (with animation)
```

### 3.2 State Management Strategy

#### Frontend State Architecture
```javascript
// Hierarchical state management using React hooks and Context

// Global State (App-level)
├─ AuthContext (Firebase authentication)
│  ├─ user
│  ├─ isLoading
│  └─ authMethods
│
├─ SettingsContext (User preferences)
│  ├─ theme
│  ├─ animationSpeed
│  └─ defaultMode
│
└─ ToastContext (Notifications)
   ├─ toasts[]
   └─ toastMethods

// Feature-level State (Component hooks)
├─ usePromptOptimizer (Optimization state)
│  ├─ inputPrompt
│  ├─ optimizedPrompt
│  ├─ isProcessing
│  ├─ qualityScore
│  └─ mode
│
├─ usePromptHistory (History management)
│  ├─ history[]
│  ├─ isLoading
│  └─ filters
│
└─ useCreativeBrainstorm (Video mode state)
   ├─ elements{}
   ├─ suggestions[]
   ├─ compatibility
   └─ technicalParams
```

#### Backend State Management
```javascript
// Server-side state handling

// Request-scoped State
req.id          // Unique request identifier
req.user        // Authenticated user data
req.startTime   // Request timing

// Application-level State
├─ Cache State (In-memory + Redis)
│  ├─ Prompt cache (TTL: 1 hour)
│  ├─ Suggestion cache (TTL: 30 min)
│  └─ User preference cache (TTL: 24 hours)
│
├─ Circuit Breaker State
│  ├─ OpenAI API status
│  ├─ Failure count
│  └─ Last failure time
│
└─ Metrics State (Prometheus)
   ├─ Request counters
   ├─ Response time histograms
   └─ Error rate gauges
```

### 3.3 Data Models

#### Prompt Data Model (Firestore)
```typescript
interface PromptDocument {
  // Identifiers
  id: string;           // Firestore document ID
  uuid: string;         // Public sharing UUID
  userId: string;       // Firebase Auth UID

  // Content
  input: string;        // Original user prompt
  optimized: string;    // Optimized result
  mode: OptimizationMode; // 'default' | 'reasoning' | 'research' | 'socratic' | 'video'

  // Metadata
  timestamp: Timestamp; // Firestore server timestamp
  qualityScore: number; // 0-100 quality rating
  expansionRatio: number; // Output/input length ratio

  // Video-specific (optional)
  elements?: {
    subject?: string;
    action?: string;
    setting?: string;
    camera?: string;
    lighting?: string;
    style?: string;
  };

  // Versioning
  templateVersion: string; // Template version used
  apiModel: string;       // AI model used
}
```

#### API Request/Response Models
```typescript
// Optimization Request
interface OptimizeRequest {
  prompt: string;
  mode?: OptimizationMode;
  context?: {
    previousVersion?: string;
    improvementGoals?: string[];
    targetAudience?: string;
  };
  options?: {
    useIterativeRefinement?: boolean;
    useConstitutionalAI?: boolean;
    temperature?: number;
  };
}

// Optimization Response
interface OptimizeResponse {
  optimizedPrompt: string;
  qualityScore: number;
  expansionRatio: number;
  suggestions?: string[];
  metadata: {
    mode: OptimizationMode;
    processingTime: number;
    cacheHit: boolean;
    modelUsed: string;
  };
}
```

---

## 4. Backend Services Architecture

### 4.1 Service Layer Design

The backend implements a layered service architecture:

```
┌─────────────────────────────────────────┐
│            Route Handlers               │
│         (Thin controllers)              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│          Business Services              │
│    (Domain logic & orchestration)       │
│                                         │
│  • PromptOptimizationService           │
│  • VideoConceptService           │
│  • EnhancementService                  │
│  • SceneDetectionService               │
│  • QuestionGenerationService           │
└─────────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│  Infrastructure  │  │   API Clients    │
│    Services      │  │                  │
│                  │  │ • OpenAIClient   │
│ • CacheService   │  │ • ClaudeClient   │
│ • MetricsService │  │                  │
│ • LoggerService  │  └──────────────────┘
│ • TracingService │
└──────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           Utility Services              │
│                                         │
│ • TemperatureOptimizer                  │
│ • ConstitutionalAI                      │
│ • FuzzyMatcher                          │
│ • PatternAnalytics                      │
│ • StructuredOutputEnforcer              │
└─────────────────────────────────────────┘
```

### 4.2 PromptOptimizationService Deep Dive

The core optimization service implements sophisticated prompt engineering:

```javascript
class PromptOptimizationService {
  // Template versions for tracking improvements
  templateVersions = {
    default: '2.0.0',
    reasoning: '2.0.0',
    research: '2.0.0',
    socratic: '2.0.0',
    video: '1.0.0'
  };

  async optimize({ prompt, mode, context, useConstitutionalAI, useIterativeRefinement }) {
    // 1. Mode Detection (if not provided)
    if (!mode) {
      mode = await this.detectOptimalMode(prompt);
    }

    // 2. Cache Check
    const cacheKey = this.generateCacheKey(prompt, mode, context);
    const cached = await this.checkCache(cacheKey);
    if (cached) return cached;

    // 3. Optimization Strategy Selection
    const strategy = this.getOptimizationStrategy(mode);

    // 4. Iterative Refinement (optional)
    if (useIterativeRefinement) {
      return await this.iterativeOptimization(prompt, strategy, context);
    }

    // 5. Single-pass Optimization
    const systemPrompt = strategy.buildSystemPrompt(prompt, context);
    const temperature = TemperatureOptimizer.getOptimalTemperature('optimization', {
      diversity: 'medium',
      precision: 'medium',
    });

    // 6. API Call with Circuit Breaker
    const response = await this.claudeClient.complete(systemPrompt, {
      maxTokens: 4096,
      timeout: mode === 'video' ? 90000 : 30000,
      temperature,
    });

    // 7. Constitutional AI Review (optional)
    let optimizedText = response.content[0].text;
    if (useConstitutionalAI) {
      optimizedText = await this.applyConstitutionalReview(optimizedText);
    }

    // 8. Quality Assessment
    const qualityScore = this.calculateQualityScore(prompt, optimizedText);

    // 9. Cache Result
    await this.cacheResult(cacheKey, optimizedText, qualityScore);

    return { optimizedText, qualityScore };
  }

  async detectOptimalMode(prompt) {
    const patterns = {
      reasoning: /think|analyze|solve|calculate|reason|logic/i,
      research: /research|investigate|study|explore|survey|literature/i,
      socratic: /learn|teach|understand|explain|educate|tutorial/i,
      video: /video|scene|shot|camera|visual|cinematic|film/i,
    };

    for (const [mode, pattern] of Object.entries(patterns)) {
      if (pattern.test(prompt)) return mode;
    }

    return 'default';
  }
}
```

### 4.3 Caching Strategy

Multi-tier caching implementation:

```javascript
class CacheService {
  constructor() {
    // In-memory cache (L1)
    this.memoryCache = new NodeCache({
      stdTTL: 600,      // 10 minutes default
      checkperiod: 120, // Check every 2 minutes
      maxKeys: 1000,    // Limit memory usage
    });

    // Redis cache (L2) - optional
    this.redisClient = this.initRedisClient();

    // Cache configuration per namespace
    this.config = {
      promptOptimization: { ttl: 3600, maxSize: 100 },
      suggestions: { ttl: 1800, maxSize: 500 },
      userPreferences: { ttl: 86400, maxSize: 1000 },
    };
  }

  async get(key, namespace) {
    // Check L1 cache
    const memoryHit = this.memoryCache.get(key);
    if (memoryHit) {
      this.metrics.increment('cache.hit.memory', { namespace });
      return memoryHit;
    }

    // Check L2 cache (if available)
    if (this.redisClient) {
      const redisHit = await this.redisClient.get(key);
      if (redisHit) {
        this.metrics.increment('cache.hit.redis', { namespace });
        // Promote to L1
        this.memoryCache.set(key, redisHit);
        return JSON.parse(redisHit);
      }
    }

    this.metrics.increment('cache.miss', { namespace });
    return null;
  }

  async set(key, value, options = {}) {
    const { ttl, namespace } = options;

    // Write to L1
    this.memoryCache.set(key, value, ttl);

    // Write to L2 (async, don't wait)
    if (this.redisClient) {
      this.redisClient
        .set(key, JSON.stringify(value), 'EX', ttl)
        .catch(err => logger.error('Redis write failed', err));
    }

    this.metrics.increment('cache.write', { namespace });
  }
}
```

### 4.4 Error Handling Architecture

Comprehensive error handling with graceful degradation:

```javascript
// Global error handler middleware
export const errorHandler = (err, req, res, next) => {
  // Attach request ID for tracing
  err.requestId = req.id;

  // Log error with context
  logger.error('Request failed', {
    error: err.message,
    stack: err.stack,
    requestId: req.id,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
  });

  // Categorize error
  const errorResponse = categorizeError(err);

  // Record metrics
  metricsService.increment('http.errors', {
    type: errorResponse.type,
    statusCode: errorResponse.statusCode,
  });

  // Send appropriate response
  res.status(errorResponse.statusCode).json({
    error: errorResponse.message,
    code: errorResponse.code,
    requestId: req.id,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

function categorizeError(err) {
  // Validation errors
  if (err.name === 'ValidationError') {
    return {
      statusCode: 400,
      type: 'validation',
      code: 'VALIDATION_ERROR',
      message: err.message,
    };
  }

  // Authentication errors
  if (err.name === 'UnauthorizedError') {
    return {
      statusCode: 401,
      type: 'auth',
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    };
  }

  // Rate limit errors
  if (err.name === 'TooManyRequestsError') {
    return {
      statusCode: 429,
      type: 'rate_limit',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
    };
  }

  // Circuit breaker open
  if (err.code === 'ECIRCUITOPEN') {
    return {
      statusCode: 503,
      type: 'circuit_breaker',
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service temporarily unavailable',
    };
  }

  // Default to 500
  return {
    statusCode: 500,
    type: 'internal',
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };
}
```

---

## 5. Frontend Architecture

### 5.1 Component Hierarchy

```
App.jsx (Root)
├─ ErrorBoundary
│  └─ ToastProvider
│     └─ Router
│        ├─ Route: "/"
│        │  └─ PromptOptimizerContainer
│        │     ├─ ModeSelector
│        │     ├─ PromptInput
│        │     ├─ PromptCanvas (Results)
│        │     ├─ HistorySidebar
│        │     ├─ Settings
│        │     ├─ KeyboardShortcuts
│        │     └─ VideoConceptBuilder (Video mode)
│        │
│        ├─ Route: "/prompt/:uuid"
│        │  └─ PromptOptimizerContainer (with loaded prompt)
│        │
│        └─ Route: "/share/:uuid"
│           └─ SharedPrompt (Read-only view)
```

### 5.2 PromptOptimizerContainer - Central Orchestrator

The main container component manages all optimization flows:

```javascript
function PromptOptimizerContainer() {
  // Authentication
  const [user, setUser] = useState(null);

  // Core State
  const [selectedMode, setSelectedMode] = useState('optimize');
  const [showHistory, setShowHistory] = useState(true);
  const [showResults, setShowResults] = useState(false);

  // Feature Flags
  const [showImprover, setShowImprover] = useState(false);
  const [showBrainstorm, setShowBrainstorm] = useState(false);

  // Custom Hooks
  const promptOptimizer = usePromptOptimizer(selectedMode);
  const { history, addToHistory, loadPrompt } = usePromptHistory(user?.uid);
  const { settings, updateSetting } = useSettings();
  const shortcuts = useKeyboardShortcuts({
    onOptimize: handleOptimize,
    onNewPrompt: handleNewPrompt,
    onToggleHistory: () => setShowHistory(!showHistory),
  });

  // Mode-specific rendering
  const renderModeInterface = () => {
    switch (selectedMode) {
      case 'video':
        return showBrainstorm ?
          <VideoConceptBuilder onComplete={handleBrainstormComplete} /> :
          <VideoPromptInterface />;

      case 'socratic':
        return <SocraticLearningInterface />;

      default:
        return <StandardPromptInterface />;
    }
  };

  // Optimization flow
  const handleOptimize = async () => {
    const result = await promptOptimizer.optimize();
    if (result) {
      await saveToHistory(result);
      setShowResults(true);
      startTypewriterAnimation(result.optimized);
    }
  };
}
```

### 5.3 Custom Hooks Architecture

#### usePromptOptimizer Hook
```javascript
export const usePromptOptimizer = (selectedMode) => {
  const [state, dispatch] = useReducer(optimizerReducer, initialState);
  const toast = useToast();

  const optimize = useCallback(async (prompt, context) => {
    dispatch({ type: 'OPTIMIZE_START' });

    try {
      // API call with abort controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': getApiKey(),
        },
        body: JSON.stringify({ prompt, mode: selectedMode, context }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();

      dispatch({
        type: 'OPTIMIZE_SUCCESS',
        payload: data
      });

      // Quality-based toast
      showQualityToast(data.qualityScore);

      return data;
    } catch (error) {
      dispatch({
        type: 'OPTIMIZE_ERROR',
        payload: error.message
      });

      toast.error('Optimization failed: ' + error.message);
      return null;
    }
  }, [selectedMode, toast]);

  return {
    ...state,
    optimize,
    reset: () => dispatch({ type: 'RESET' }),
  };
};
```

### 5.4 Component Communication Patterns

```javascript
// Event-driven communication using custom events
class ComponentEventBus {
  constructor() {
    this.events = new EventTarget();
  }

  emit(eventName, data) {
    this.events.dispatchEvent(
      new CustomEvent(eventName, { detail: data })
    );
  }

  on(eventName, handler) {
    this.events.addEventListener(eventName, handler);
    return () => this.events.removeEventListener(eventName, handler);
  }
}

// Usage in components
const eventBus = new ComponentEventBus();

// Producer component
function EnhancementSelector({ onSelect }) {
  const handleSelection = (suggestion) => {
    eventBus.emit('enhancement:selected', suggestion);
    onSelect(suggestion);
  };
}

// Consumer component
function PromptCanvas() {
  useEffect(() => {
    const unsubscribe = eventBus.on('enhancement:selected', (e) => {
      insertEnhancement(e.detail);
    });
    return unsubscribe;
  }, []);
}
```

### 5.5 Performance Optimizations

#### Code Splitting
```javascript
// Lazy load heavy components
const VideoConceptBuilder = React.lazy(() =>
  import('./components/VideoConceptBuilder')
);

const Settings = React.lazy(() =>
  import('./components/Settings')
);

// Usage with Suspense
<Suspense fallback={<LoadingSpinner />}>
  {showBrainstorm && <VideoConceptBuilder />}
</Suspense>
```

#### Memoization Strategy
```javascript
// Expensive computations memoized
const QualityScore = React.memo(({ score }) => {
  const scoreDetails = useMemo(() =>
    calculateScoreBreakdown(score), [score]
  );

  const colorClass = useMemo(() =>
    getScoreColorClass(score), [score]
  );

  return (
    <div className={`quality-score ${colorClass}`}>
      {/* Component JSX */}
    </div>
  );
});

// Callback memoization
const handleSuggestionClick = useCallback((suggestion) => {
  insertSuggestion(suggestion);
  trackEvent('suggestion_selected', { type: suggestion.type });
}, [insertSuggestion, trackEvent]);
```

---

## 6. API Design & Endpoints

### 6.1 RESTful API Structure

The API follows REST principles with consistent patterns:

```
BASE URL: https://api.promptbuilder.com
Version: v1 (implicit, not in URL for simplicity)

Authentication: Bearer token or API key
Rate Limits:
  - Global: 100 requests/15 minutes per IP
  - API: 60 requests/minute
  - Burst protection on specific endpoints
```

### 6.2 Core Endpoints

#### Optimization Endpoints

```typescript
POST /api/optimize
Purpose: Main prompt optimization endpoint
Rate Limit: 20 requests/minute

Request:
{
  prompt: string;           // Required, max 5000 chars
  mode?: 'default' | 'reasoning' | 'research' | 'socratic' | 'video';
  context?: {
    previousVersion?: string;
    improvementGoals?: string[];
    targetAudience?: string;
  };
  options?: {
    temperature?: number;    // 0.0 - 1.0
    useIterativeRefinement?: boolean;
    useConstitutionalAI?: boolean;
  };
}

Response (200):
{
  optimizedPrompt: string;
  qualityScore: number;      // 0-100
  expansionRatio: number;    // Output/input length ratio
  suggestions?: string[];     // Additional improvement tips
  metadata: {
    mode: string;
    processingTime: number;   // milliseconds
    cacheHit: boolean;
    modelUsed: string;
    templateVersion: string;
  };
}

Error Responses:
400: Validation error (missing/invalid fields)
401: Authentication required
429: Rate limit exceeded
500: Internal server error
503: Service unavailable (circuit breaker open)
```

#### Enhancement Endpoints

```typescript
POST /api/get-enhancement-suggestions
Purpose: Get contextual enhancement suggestions for selected text
Rate Limit: 30 requests/minute

Request:
{
  highlightedText: string;    // Selected text to enhance
  contextBefore: string;      // 100 chars before selection
  contextAfter: string;       // 100 chars after selection
  fullPrompt: string;         // Complete prompt
  originalUserPrompt?: string; // Original unoptimized prompt
}

Response:
{
  suggestions: Array<{
    text: string;
    type: 'replacement' | 'addition' | 'restructure';
    confidence: number;       // 0-1
    reasoning?: string;
  }>;
  alternatives?: string[];    // Alternative phrasings
}
```

#### Creative Suggestion Endpoints (Video Mode)

```typescript
POST /api/video/suggestions
Purpose: Get AI-powered creative suggestions for video elements
Rate Limit: 20 requests/minute

Request:
{
  elementType: 'subject' | 'action' | 'setting' | 'camera' | 'lighting' | 'style';
  currentValue?: string;
  context?: {
    existingElements: Record<string, string>;
    genre?: string;
    mood?: string;
  };
}

Response:
{
  suggestions: Array<{
    value: string;
    category: string;
    compatibility: number;    // 0-1 compatibility score
    reasoning?: string;
  }>;
  smartDefaults?: string[];   // Context-aware defaults
}
```

```typescript
POST /api/video/validate
Purpose: Check compatibility between video prompt elements
Rate Limit: 30 requests/minute

Request:
{
  elementType: string;
  value: string;
  existingElements: Record<string, string>;
}

Response:
{
  isCompatible: boolean;
  score: number;              // 0-1
  conflicts?: Array<{
    element: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  suggestions?: string[];     // Fixes for conflicts
}
```

### 6.3 Health & Monitoring Endpoints

```typescript
GET /health
Purpose: Basic health check
No authentication required

Response (200):
{
  status: 'healthy',
  timestamp: string;
  uptime: number;
}

---

GET /health/ready
Purpose: Readiness probe (checks dependencies)

Response (200):
{
  status: 'ready',
  checks: {
    database: 'connected' | 'disconnected';
    cache: 'available' | 'unavailable';
    openai: 'responsive' | 'unresponsive';
  };
}

---

GET /health/live
Purpose: Liveness probe

Response (200):
{
  status: 'alive',
  pid: number;
  memory: {
    used: number;
    total: number;
  };
}

---

GET /metrics
Purpose: Prometheus metrics
Authentication: Metrics API key required

Response: Prometheus text format
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="POST",path="/api/optimize",status="200"} 1234
...
```

### 6.4 API Versioning Strategy

The API uses implicit versioning with backward compatibility:

```javascript
// Version detection in middleware
const apiVersionMiddleware = (req, res, next) => {
  // Check Accept header for version hint
  const acceptHeader = req.headers.accept;
  const version = extractVersion(acceptHeader) || 'v1';

  // Attach version to request
  req.apiVersion = version;

  // Add version to response headers
  res.setHeader('X-API-Version', version);

  next();
};

// Backward compatibility wrapper
const backwardCompatible = (handler) => {
  return async (req, res, next) => {
    // Transform old request format to new
    if (req.apiVersion === 'v0') {
      req.body = transformV0ToV1(req.body);
    }

    // Execute handler
    const result = await handler(req, res, next);

    // Transform response for old clients
    if (req.apiVersion === 'v0') {
      res.json(transformV1ToV0(result));
    }
  };
};
```

---

## 7. Security Architecture

### 7.1 Defense-in-Depth Security Layers

```
┌─────────────────────────────────────────────────┐
│            Layer 1: Network Security             │
│  • CloudFlare DDoS protection                    │
│  • Rate limiting at edge                         │
│  • Geographic restrictions                       │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│         Layer 2: Application Security            │
│  • Helmet.js security headers                    │
│  • CORS validation                               │
│  • HTTPS enforcement                             │
│  • CSP (Content Security Policy)                 │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│         Layer 3: Authentication/Authorization    │
│  • Firebase Auth integration                     │
│  • JWT token validation                          │
│  • API key authentication                        │
│  • Role-based access control                     │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│            Layer 4: Input Validation             │
│  • Joi schema validation                         │
│  • Request size limits                           │
│  • SQL injection prevention                      │
│  • XSS sanitization (DOMPurify)                 │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│          Layer 5: Rate Limiting                  │
│  • Global rate limits                            │
│  • Per-endpoint limits                           │
│  • User-based quotas                             │
│  • Burst protection                              │
└─────────────────────────────────────────────────┘
```

### 7.2 Security Headers Configuration

```javascript
// Helmet.js configuration (server/index.js)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",  // Required for React
        'https://cdn.jsdelivr.net'
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com'
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: [
        "'self'",
        'https://api.openai.com',
        'https://*.firebaseapp.com',
        'https://*.googleapis.com'
      ],
      frameSrc: ["'none'"],      // Prevent clickjacking
      objectSrc: ["'none'"],     // Prevent plugin-based XSS
      upgradeInsecureRequests: [], // Force HTTPS
    },
  },
  hsts: {
    maxAge: 31536000,           // 1 year
    includeSubDomains: true,
    preload: true,              // Submit to preload list
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  }

  next();
});
```

### 7.3 Authentication & Authorization

#### Firebase Authentication Flow
```javascript
// Client-side authentication
const signInFlow = async () => {
  try {
    // 1. Initiate Google OAuth
    const result = await signInWithPopup(auth, googleProvider);

    // 2. Get ID token
    const idToken = await result.user.getIdToken();

    // 3. Store in secure httpOnly cookie (via API call)
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      credentials: 'include',
    });

    // 4. Update UI state
    setUser(result.user);

  } catch (error) {
    handleAuthError(error);
  }
};

// Server-side token validation
const validateFirebaseToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || 'user',
    };
    next();
  } catch (error) {
    logger.error('Token validation failed', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### 7.4 Input Validation & Sanitization

```javascript
// Joi validation schemas
const promptSchema = Joi.object({
  prompt: Joi.string()
    .required()
    .min(1)
    .max(5000)
    .pattern(/^[^<>]*$/)  // Basic XSS prevention
    .messages({
      'string.empty': 'Prompt cannot be empty',
      'string.max': 'Prompt exceeds maximum length of 5000 characters',
      'string.pattern.base': 'Prompt contains invalid characters',
    }),

  mode: Joi.string()
    .valid('default', 'reasoning', 'research', 'socratic', 'video')
    .optional(),

  context: Joi.object({
    previousVersion: Joi.string().max(5000).optional(),
    improvementGoals: Joi.array().items(Joi.string()).max(10).optional(),
    targetAudience: Joi.string().max(200).optional(),
  }).optional(),
});

// XSS sanitization for user content
const sanitizeUserContent = (content) => {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [],        // Strip all HTML
    ALLOWED_ATTR: [],        // No attributes
    KEEP_CONTENT: true,      // Keep text content
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
  });
};
```

### 7.5 Rate Limiting Strategy

```javascript
// Tiered rate limiting implementation
const rateLimits = {
  // Global limit - all requests
  global: rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100,                   // 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  }),

  // API endpoints - general
  api: rateLimit({
    windowMs: 60 * 1000,        // 1 minute
    max: 60,                    // 60 requests per minute
    keyGenerator: (req) => {
      // Use authenticated user ID if available
      return req.user?.uid || req.ip;
    },
  }),

  // Expensive operations
  expensive: rateLimit({
    windowMs: 60 * 1000,
    max: 10,                    // Only 10 expensive ops per minute
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  }),

  // Burst protection
  burst: {
    suggestions: rateLimit({
      windowMs: 2 * 1000,       // 2 seconds
      max: 3,                   // 3 requests max
    }),
    compatibility: rateLimit({
      windowMs: 3 * 1000,       // 3 seconds
      max: 5,                   // 5 requests max
    }),
  },
};

// Apply rate limits
app.use(rateLimits.global);
app.use('/api/', rateLimits.api);
app.use('/api/optimize', rateLimits.expensive);
```

---

## 8. Performance & Optimization

### 8.1 Performance Metrics & Targets

```
Key Performance Indicators (KPIs):
┌──────────────────────────────────────────────┐
│ Metric                  │ Target  │ Current  │
├──────────────────────────────────────────────┤
│ API Response Time (p50) │ < 200ms │ 185ms   │
│ API Response Time (p95) │ < 500ms │ 465ms   │
│ API Response Time (p99) │ < 1s    │ 980ms   │
│ Cache Hit Rate          │ > 80%   │ 82%     │
│ Error Rate              │ < 0.1%  │ 0.08%   │
│ Uptime                  │ > 99.9% │ 99.95%  │
│ Time to Interactive     │ < 3s    │ 2.8s    │
│ First Contentful Paint  │ < 1.5s  │ 1.3s    │
│ Lighthouse Score        │ > 90    │ 92      │
└──────────────────────────────────────────────┘
```

### 8.2 Backend Optimizations

#### Connection Pooling
```javascript
// HTTP Agent with keep-alive for API clients
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  scheduling: 'fifo',
});

class OpenAIAPIClient {
  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.openai.com',
      timeout: 60000,
      httpAgent,
      httpsAgent: new https.Agent(httpAgent.options),
      // Connection pooling for better performance
      maxRedirects: 0,
      decompress: true,
    });
  }
}
```

#### Database Query Optimization
```javascript
// Firestore query optimization
class PromptRepository {
  async getRecentPrompts(userId, limit = 10) {
    // Use composite index for efficient querying
    const q = query(
      collection(db, 'prompts'),
      where('userId', '==', userId),
      where('deleted', '==', false),  // Soft delete flag
      orderBy('timestamp', 'desc'),
      limit(limit)
    );

    // Implement cursor-based pagination for large datasets
    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    // Use select() to fetch only needed fields
    const lightQuery = query(
      q,
      select('uuid', 'input', 'mode', 'timestamp', 'qualityScore')
    );

    return await getDocs(lightQuery);
  }
}
```

#### Response Compression
```javascript
// Compression middleware configuration
app.use(compression({
  filter: (req, res) => {
    // Don't compress responses less than 1KB
    if (res.getHeader('Content-Length') &&
        parseInt(res.getHeader('Content-Length')) < 1024) {
      return false;
    }

    // Compress JSON and text responses
    return compression.filter(req, res);
  },
  level: 6,  // Balance between CPU and compression ratio
  threshold: 1024,  // 1KB threshold
  chunkSize: 16 * 1024,  // 16KB chunks
  memLevel: 8,
}));
```

### 8.3 Frontend Optimizations

#### Bundle Optimization
```javascript
// Vite configuration for optimal bundling
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for stable dependencies
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Firebase chunk (large dependency)
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // UI utilities chunk
          ui: ['lucide-react', 'dompurify'],
        },
        // Content hash for cache busting
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
      },
    },
    // Tree shaking
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      tryCatchDeoptimization: false,
    },
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        passes: 2,
      },
      format: {
        comments: false,
      },
    },
    // Source maps for production debugging
    sourcemap: 'hidden',
  },

  // CSS optimization
  css: {
    modules: {
      generateScopedName: '[hash:base64:5]',
    },
    preprocessorOptions: {
      css: {
        charset: false,  // Remove charset declaration
      },
    },
  },
});
```

#### Lazy Loading Implementation
```javascript
// Route-based code splitting
const routes = [
  {
    path: '/',
    component: lazy(() => import('./features/prompt-optimizer/PromptOptimizerContainer')),
  },
  {
    path: '/share/:uuid',
    component: lazy(() => import('./components/SharedPrompt')),
  },
  {
    path: '/settings',
    component: lazy(() => import('./components/Settings')),
  },
];

// Component-level lazy loading
const CreativeBrainstorm = lazy(() =>
  import(/* webpackChunkName: "creative-brainstorm" */ './components/VideoConceptBuilder')
);

// Image lazy loading
const LazyImage = ({ src, alt, ...props }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setImageSrc(src);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return <img ref={imgRef} src={imageSrc} alt={alt} {...props} />;
};
```

### 8.4 Caching Strategy

#### Cache Hierarchy
```
┌─────────────────────────────────────────────┐
│          Browser Cache (L0)                 │
│  • Static assets (1 year)                   │
│  • API responses (5 min)                    │
│  • Service Worker cache                     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         CDN Cache (L1)                      │
│  • Static assets                            │
│  • Public API responses                     │
│  • Edge locations worldwide                 │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│      Application Memory Cache (L2)          │
│  • Node-cache in-memory                     │
│  • 10 min TTL                              │
│  • 1000 key limit                          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│          Redis Cache (L3)                   │
│  • Distributed cache                        │
│  • 1 hour TTL                              │
│  • Persistent storage                       │
└─────────────────────────────────────────────┘
```

#### Cache Invalidation Strategy
```javascript
class CacheInvalidator {
  constructor() {
    this.strategies = {
      ttl: this.ttlInvalidation,
      tag: this.tagInvalidation,
      event: this.eventInvalidation,
      manual: this.manualInvalidation,
    };
  }

  // Time-based invalidation
  ttlInvalidation(key, ttl) {
    setTimeout(() => this.invalidate(key), ttl * 1000);
  }

  // Tag-based invalidation
  tagInvalidation(tags) {
    const keys = this.getKeysByTags(tags);
    keys.forEach(key => this.invalidate(key));
  }

  // Event-driven invalidation
  eventInvalidation(eventName) {
    eventBus.on(eventName, ({ keys }) => {
      keys.forEach(key => this.invalidate(key));
    });
  }

  // Manual invalidation with pattern matching
  manualInvalidation(pattern) {
    const regex = new RegExp(pattern);
    const allKeys = this.cache.keys();
    const matchingKeys = allKeys.filter(key => regex.test(key));
    matchingKeys.forEach(key => this.invalidate(key));
  }
}
```

---

## 9. Testing Strategy

### 9.1 Testing Pyramid

```
                Unit Tests (70%)
            /────────────────────\
           /                      \
          /    Integration (20%)   \
         /──────────────────────────\
        /                            \
       /        E2E Tests (10%)       \
      /────────────────────────────────\
```

### 9.2 Unit Testing

#### Test Configuration (Vitest)
```javascript
// vitest.config.js
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./config/test/vitest.setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 85,
        functions: 80,
        branches: 75,
        statements: 85,
      },
    },
    testTimeout: 10000,
  },
});
```

#### Example Unit Test
```javascript
// PromptOptimizationService.test.js
describe('PromptOptimizationService', () => {
  let service;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      complete: vi.fn().mockResolvedValue({
        content: [{ text: 'Optimized prompt' }],
      }),
    };
    service = new PromptOptimizationService(mockClient);
  });

  describe('optimize', () => {
    it('should detect reasoning mode automatically', async () => {
      const result = await service.optimize({
        prompt: 'Analyze this problem and think step by step',
      });

      expect(mockClient.complete).toHaveBeenCalledWith(
        expect.stringContaining('reasoning'),
        expect.any(Object)
      );
    });

    it('should use cache when available', async () => {
      const prompt = 'Test prompt';
      const cacheKey = service.generateCacheKey(prompt, 'default', {});

      // Prime cache
      await cacheService.set(cacheKey, 'Cached result');

      const result = await service.optimize({ prompt });

      expect(result).toBe('Cached result');
      expect(mockClient.complete).not.toHaveBeenCalled();
    });

    it('should handle circuit breaker open state', async () => {
      mockClient.complete.mockRejectedValue(new Error('Service unavailable'));

      // Trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        try {
          await service.optimize({ prompt: 'Test' });
        } catch (e) {}
      }

      await expect(service.optimize({ prompt: 'Test' }))
        .rejects
        .toThrow('ECIRCUITOPEN');
    });
  });
});
```

### 9.3 Integration Testing

```javascript
// API integration test
describe('API Integration Tests', () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('POST /api/optimize', () => {
    it('should optimize prompt with authentication', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .set('Authorization', 'Bearer test-token')
        .send({
          prompt: 'Write a function to sort an array',
          mode: 'default',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('optimizedPrompt');
      expect(response.body).toHaveProperty('qualityScore');
      expect(response.body.qualityScore).toBeGreaterThan(0);
    });

    it('should enforce rate limits', async () => {
      const requests = Array(25).fill(null).map(() =>
        request(app)
          .post('/api/optimize')
          .set('Authorization', 'Bearer test-token')
          .send({ prompt: 'Test' })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
```

### 9.4 E2E Testing (Playwright)

```javascript
// playwright.config.js
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
```

```javascript
// E2E test example
test.describe('Prompt Optimization Flow', () => {
  test('should complete full optimization workflow', async ({ page }) => {
    await page.goto('/');

    // Select mode
    await page.click('[data-testid="mode-reasoning"]');

    // Enter prompt
    await page.fill('[data-testid="prompt-input"]',
      'Solve this complex mathematical problem'
    );

    // Optimize
    await page.click('[data-testid="optimize-button"]');

    // Wait for result
    await page.waitForSelector('[data-testid="optimized-result"]', {
      timeout: 30000,
    });

    // Verify quality score
    const score = await page.textContent('[data-testid="quality-score"]');
    expect(parseInt(score)).toBeGreaterThan(60);

    // Test copy functionality
    await page.click('[data-testid="copy-button"]');
    const clipboard = await page.evaluate(() =>
      navigator.clipboard.readText()
    );
    expect(clipboard).toContain('complex mathematical problem');
  });
});
```

### 9.5 Load Testing

```javascript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    errors: ['rate<0.1'],              // Error rate under 10%
  },
};

export default function () {
  const payload = JSON.stringify({
    prompt: 'Optimize this test prompt for better clarity',
    mode: 'default',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'load-test-key',
    },
  };

  const response = http.post(
    'http://localhost:3001/api/optimize',
    payload,
    params
  );

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has optimizedPrompt': (r) =>
      JSON.parse(r.body).optimizedPrompt !== undefined,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
  sleep(1);
}
```

---

## 10. Deployment & Infrastructure

### 10.1 Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Production Environment                │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │               Kubernetes Cluster (GKE)             │  │
│  │                                                    │  │
│  │  ┌──────────────────────────────────────────┐    │  │
│  │  │         Namespace: prompt-builder        │    │  │
│  │  │                                          │    │  │
│  │  │  ┌─────────────────────────────────┐   │    │  │
│  │  │  │     Deployment (3 replicas)     │   │    │  │
│  │  │  │  ┌───────┐ ┌───────┐ ┌───────┐ │   │    │  │
│  │  │  │  │ Pod 1 │ │ Pod 2 │ │ Pod 3 │ │   │    │  │
│  │  │  │  └───────┘ └───────┘ └───────┘ │   │    │  │
│  │  │  └─────────────────────────────────┘   │    │  │
│  │  │                                          │    │  │
│  │  │  ┌─────────────────────────────────┐   │    │  │
│  │  │  │    Service (ClusterIP)          │   │    │  │
│  │  │  └─────────────────────────────────┘   │    │  │
│  │  │                                          │    │  │
│  │  │  ┌─────────────────────────────────┐   │    │  │
│  │  │  │    Ingress (NGINX)              │   │    │  │
│  │  │  │    - SSL termination            │   │    │  │
│  │  │  │    - Path-based routing         │   │    │  │
│  │  │  └─────────────────────────────────┘   │    │  │
│  │  │                                          │    │  │
│  │  │  ┌─────────────────────────────────┐   │    │  │
│  │  │  │    HorizontalPodAutoscaler      │   │    │  │
│  │  │  │    - Min: 2, Max: 10           │   │    │  │
│  │  │  │    - CPU target: 70%           │   │    │  │
│  │  │  └─────────────────────────────────┘   │    │  │
│  │  └──────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 10.2 Kubernetes Configuration

#### Deployment Manifest
```yaml
# infrastructure/kubernetes/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prompt-builder-api
  labels:
    app: prompt-builder
    component: api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0  # Zero-downtime deployments
  selector:
    matchLabels:
      app: prompt-builder
      component: api
  template:
    metadata:
      labels:
        app: prompt-builder
        component: api
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3001"
        prometheus.io/path: "/metrics"
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001

      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - prompt-builder
                topologyKey: kubernetes.io/hostname

      containers:
        - name: api
          image: ghcr.io/yourusername/prompt-builder:latest
          imagePullPolicy: Always

          ports:
            - name: http
              containerPort: 3001
              protocol: TCP

          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"

          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: /health/ready
              port: http
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 2

          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3001"

          envFrom:
            - configMapRef:
                name: prompt-builder-config
            - secretRef:
                name: prompt-builder-secrets
```

### 10.3 Docker Configuration

```dockerfile
# Multi-stage build for optimization
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/index.js"]
```

### 10.4 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: |
          npm run test:unit
          npm run test:integration

      - name: Run E2E tests
        run: |
          npx playwright install
          npm run test:e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/prompt-builder-api \
            api=ghcr.io/${{ github.repository }}:${{ github.sha }} \
            --record -n prompt-builder

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/prompt-builder-api \
            -n prompt-builder --timeout=10m

      - name: Run smoke tests
        run: |
          curl -f https://api.promptbuilder.com/health || exit 1
```

---

## 11. Monitoring & Observability

### 11.1 Observability Stack

```
┌─────────────────────────────────────────────────┐
│               Application Metrics                │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐            │
│  │  Prometheus  │  │   Grafana    │            │
│  │  (Metrics)   │  │ (Dashboards) │            │
│  └──────────────┘  └──────────────┘            │
│         ↑                 ↑                      │
│         │                 │                      │
│  ┌──────────────────────────────────┐          │
│  │     Application Instrumentation    │          │
│  │  - prom-client                    │          │
│  │  - Custom metrics                 │          │
│  │  - Business metrics               │          │
│  └──────────────────────────────────┘          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                    Logging                       │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐            │
│  │     Pino     │→ │  Cloud       │            │
│  │  (Structured)│  │  Logging     │            │
│  └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                    Tracing                       │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐            │
│  │   OpenTelemetry │→│   Jaeger    │            │
│  │   (Optional)    │ │  (Traces)   │            │
│  └──────────────┘  └──────────────┘            │
└─────────────────────────────────────────────────┘
```

### 11.2 Metrics Implementation

```javascript
// infrastructure/MetricsService.js
class MetricsService {
  constructor() {
    // HTTP metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    // Business metrics
    this.promptOptimizations = new Counter({
      name: 'prompt_optimizations_total',
      help: 'Total number of prompt optimizations',
      labelNames: ['mode', 'cache_hit'],
    });

    this.qualityScores = new Histogram({
      name: 'prompt_quality_scores',
      help: 'Distribution of prompt quality scores',
      labelNames: ['mode'],
      buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    });

    // System metrics
    this.cacheHitRate = new Gauge({
      name: 'cache_hit_rate',
      help: 'Cache hit rate percentage',
      labelNames: ['cache_type'],
    });

    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
    });

    // API client metrics
    this.apiCallDuration = new Histogram({
      name: 'external_api_duration_seconds',
      help: 'Duration of external API calls',
      labelNames: ['api', 'endpoint', 'status'],
    });

    this.circuitBreakerState = new Gauge({
      name: 'circuit_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
      labelNames: ['service'],
    });
  }

  middleware() {
    return (req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;

        this.httpRequestDuration
          .labels(req.method, route, res.statusCode)
          .observe(duration);

        this.httpRequestsTotal
          .labels(req.method, route, res.statusCode)
          .inc();
      });

      next();
    };
  }
}
```

### 11.3 Logging Strategy

```javascript
// infrastructure/Logger.js
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',

  // Redact sensitive information
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.apiKey',
      '*.token',
    ],
    censor: '[REDACTED]',
  },

  // Serializers for consistent log format
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      userId: req.user?.uid,
    }),

    res: (res) => ({
      statusCode: res.statusCode,
      duration: res.responseTime,
    }),

    err: pino.stdSerializers.err,
  },

  // Pretty print in development
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,

  // Base properties
  base: {
    env: process.env.NODE_ENV,
    pid: process.pid,
    hostname: os.hostname(),
  },
});

// Request logger middleware
logger.requestLogger = () => {
  return (req, res, next) => {
    req.log = logger.child({ requestId: req.id });

    req.log.info({
      req,
      msg: 'Request received',
    });

    const startTime = Date.now();

    res.on('finish', () => {
      res.responseTime = Date.now() - startTime;

      req.log.info({
        res,
        msg: 'Request completed',
      });
    });

    next();
  };
};
```

### 11.4 Alerting Rules

```yaml
# monitoring/prometheus-rules.yaml
groups:
  - name: prompt-builder-alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status_code=~"5.."}[5m])
          / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # API latency
      - alert: HighAPILatency
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])
          ) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High API latency"
          description: "95th percentile latency is {{ $value }}s"

      # Circuit breaker open
      - alert: CircuitBreakerOpen
        expr: circuit_breaker_state{service="openai"} == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker is open"
          description: "OpenAI API circuit breaker is open"

      # Low cache hit rate
      - alert: LowCacheHitRate
        expr: cache_hit_rate < 0.5
        for: 15m
        labels:
          severity: info
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value | humanizePercentage }}"
```

---

## 12. Development Workflow

### 12.1 Local Development Setup

```bash
# Clone repository
git clone https://github.com/yourusername/prompt-builder.git
cd prompt-builder

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# - Add OpenAI API key
# - Add Firebase configuration
# - Configure other settings

# Start development servers
npm run dev      # Frontend (Vite) on port 5173
npm run server   # Backend (Express) on port 3001

# Or start both together
npm start
```

### 12.2 Development Commands

```bash
# Development
npm run dev              # Start frontend dev server
npm run server           # Start backend server
npm start                # Start both servers
npm run restart          # Kill and restart servers

# Testing
npm run test             # Run tests in watch mode
npm run test:unit        # Run unit tests once
npm run test:e2e         # Run E2E tests
npm run test:coverage    # Generate coverage report
npm run test:all         # Run all tests

# Code Quality
npm run lint             # Check linting
npm run lint:fix         # Fix linting issues
npm run format           # Format code
npm run format:check     # Check formatting

# Building
npm run build            # Build for production
npm run preview          # Preview production build

# Performance
npm run test:load        # Run load tests
npm run perf:monitor     # Start monitoring stack
npm run perf:stats       # View system stats
```

### 12.3 Git Workflow

```bash
# Feature development
git checkout -b feature/your-feature-name
# Make changes
git add .
git commit -m "feat: add new feature"
git push origin feature/your-feature-name
# Create pull request

# Commit message format
feat: new feature
fix: bug fix
docs: documentation changes
style: formatting changes
refactor: code refactoring
test: test additions
chore: build/tooling changes
```

### 12.4 Code Review Checklist

```markdown
## Pull Request Checklist

### Code Quality
- [ ] Code follows project style guide
- [ ] No console.logs or debug code
- [ ] Proper error handling
- [ ] No hardcoded values

### Testing
- [ ] Unit tests written/updated
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Coverage maintained > 80%

### Documentation
- [ ] JSDoc comments added
- [ ] README updated if needed
- [ ] API documentation updated
- [ ] Changelog entry added

### Security
- [ ] No sensitive data exposed
- [ ] Input validation implemented
- [ ] Authentication/authorization checked
- [ ] Dependencies scanned for vulnerabilities

### Performance
- [ ] No N+1 queries
- [ ] Proper caching implemented
- [ ] Bundle size impact checked
- [ ] Load time impact measured
```

### 12.5 Troubleshooting Guide

```bash
# Common Issues and Solutions

# Port already in use
Error: EADDRINUSE: address already in use :::3001
Solution: npm run restart

# Firebase index error
Error: Failed-precondition: index not created
Solution: Deploy Firestore indexes
firebase deploy --only firestore:indexes

# OpenAI API timeout
Error: Request timeout after 60000ms
Solution: Increase timeout in .env
OPENAI_TIMEOUT_MS=90000

# Build failures
Error: Build failed
Solution:
rm -rf node_modules package-lock.json
npm install
npm run build

# Test failures
Error: Tests failing locally but pass in CI
Solution:
npm run test:unit -- --no-coverage
Check timezone settings
Clear test cache: npm run test -- --clearCache
```

---

## Conclusion

The Prompt Builder represents a sophisticated, production-ready system that successfully bridges the gap between users and AI models through intelligent prompt optimization. The architecture demonstrates several key achievements:

### Technical Excellence
- **Scalable Architecture**: Microservices-ready design with clear separation of concerns
- **Performance Optimization**: Multi-tier caching, connection pooling, and efficient bundling
- **Security First**: Defense-in-depth approach with multiple security layers
- **Observable System**: Comprehensive monitoring and logging for production insights

### Innovation Highlights
- **Multi-mode Optimization**: Specialized strategies for different use cases
- **Real-time Enhancement**: Intelligent suggestion system with ML-powered recognition
- **Video Prompt Specialization**: Unique focus on AI video generation optimization
- **Constitutional AI Integration**: Ethical safeguards built into the optimization pipeline

### Production Readiness
- **Zero-downtime Deployments**: Kubernetes-native with rolling updates
- **Comprehensive Testing**: 85%+ code coverage with unit, integration, and E2E tests
- **Monitoring & Alerting**: Prometheus metrics with Grafana dashboards
- **Documentation**: Extensive technical and user documentation

### Future Evolution Paths
1. **AI Model Expansion**: Support for Claude, Gemini, and other LLMs
2. **Advanced Caching**: Semantic similarity-based caching
3. **Collaborative Features**: Team workspaces and shared templates
4. **API Marketplace**: Third-party integrations and plugins
5. **Mobile Applications**: Native iOS/Android apps

The system exemplifies modern web application architecture, combining React's component-driven UI with Express's robust backend, all deployed on Kubernetes for maximum scalability and reliability. The thoughtful implementation of design patterns, comprehensive testing strategy, and production-grade monitoring make this a reference architecture for AI-powered applications.

---

**Document Version**: 1.0.0
**Last Updated**: October 2025
**Authors**: Technical Architecture Team
**Review Status**: Final

---

## Appendices

### A. Glossary

- **Circuit Breaker**: Pattern that prevents cascading failures by stopping requests to failing services
- **Constitutional AI**: AI safety technique that reviews and revises outputs against ethical principles
- **HPA**: Horizontal Pod Autoscaler - Kubernetes component that scales pods based on metrics
- **TTL**: Time To Live - Duration for which cached data remains valid
- **p95/p99**: 95th/99th percentile - Statistical measure for performance metrics

### B. Configuration Reference

See `.env.example` for all configuration options with descriptions.

### C. API Rate Limits

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| Global | 100 req | 15 min |
| /api/optimize | 20 req | 1 min |
| /api/video/suggestions | 20 req | 1 min |
| /api/video/validate | 30 req | 1 min |

### D. Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| VALIDATION_ERROR | Invalid request data | 400 |
| UNAUTHORIZED | Authentication required | 401 |
| RATE_LIMIT_EXCEEDED | Too many requests | 429 |
| SERVICE_UNAVAILABLE | Circuit breaker open | 503 |
| INTERNAL_ERROR | Server error | 500 |