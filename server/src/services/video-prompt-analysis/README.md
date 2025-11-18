# Video Prompt Analysis Service

## Overview

The Video Prompt Analysis Service is a specialized module for detecting, analyzing, and managing constraints for AI video generation prompts. It provides intelligent analysis of video prompt structure, phrase roles, and generates appropriate replacement constraints for suggestion generation.

## Architecture

This service follows the **Orchestrator Pattern** with clean separation of concerns:

- **Main Orchestrator**: `VideoPromptService` coordinates all sub-services
- **Detection Services**: Identify video prompts, target models, and template sections
- **Analysis Services**: Analyze phrase roles and generate constraints
- **Guidance Services**: Provide fallback strategies and category-specific guidance
- **Configuration**: Declarative configuration files for easy maintenance
- **Utilities**: Pure functions for text processing

### Directory Structure

```
video-prompt-analysis/
├── VideoPromptService.js          # Main orchestrator
├── index.js                       # Barrel exports
├── README.md                      # This file
├── REFACTORING_HISTORY.md         # Historical documentation
├── services/
│   ├── detection/                 # Detection services
│   │   ├── VideoPromptDetectionService.js
│   │   ├── ModelDetectionService.js
│   │   └── SectionDetectionService.js
│   ├── analysis/                  # Analysis services
│   │   ├── PhraseRoleAnalysisService.js
│   │   └── ConstraintGenerationService.js
│   └── guidance/                  # Guidance services
│       ├── FallbackStrategyService.js
│       └── CategoryGuidanceService.js
├── config/                        # Configuration files
│   ├── detectionMarkers.js
│   ├── categoryMapping.js
│   ├── constraintModes.js
│   ├── fallbackStrategy.js
│   └── categoryGuidance.js
├── utils/                         # Utility functions
│   └── textHelpers.js
└── __tests__/                     # Integration tests
    └── VideoPromptService.integration.test.js
```

## Services

### Detection Services

#### 1. VideoPromptDetectionService
**Purpose**: Detects whether a prompt is for video generation

**Methods**:
- `isVideoPrompt(fullPrompt)` - Returns `true` if prompt contains video-specific markers

**Detection Criteria**:
- Legacy template markers (`**main prompt:**`, `**technical parameters:**`)
- Modern template markers (`**prompt:**`, `**technical specs`, `**alternative approaches`)
- Technical field patterns (`duration:`, `aspect ratio:`, `frame rate:`)

#### 2. ModelDetectionService
**Purpose**: Identifies the target AI video model (Sora, Veo3, Runway, Kling, Luma)

**Methods**:
- `detectTargetModel(fullPrompt)` - Returns model identifier or `null`
- `getModelCapabilities(model)` - Returns strengths and weaknesses
- `getModelSpecificGuidance(model, category)` - Returns model-specific suggestions
- `formatModelContext(model)` - Formats context for prompt inclusion

**Supported Models**:
- **Sora**: Realistic motion, physics simulation, long takes
- **Veo3**: Cinematic lighting, atmospheric effects, mood
- **Runway**: Stylized visuals, artistic filters, creative effects
- **Kling**: Character animation, facial expressions, dialogue
- **Luma**: Surreal visuals, abstract concepts, morphing effects

#### 3. SectionDetectionService
**Purpose**: Identifies which section of a prompt template is being edited

**Methods**:
- `detectSection(highlightedText, fullPrompt, contextBefore)` - Returns section identifier
- `getSectionConstraints(section)` - Returns section-specific constraints
- `getSectionGuidance(section, category)` - Returns guidance for that section
- `formatSectionContext(section)` - Formats section context

**Sections**:
- `main_prompt`: Descriptive narrative content
- `technical_specs`: Technical parameters and specifications
- `alternatives`: Creative variations and alternatives
- `style_direction`: Visual style and aesthetic references

### Analysis Services

#### 4. PhraseRoleAnalysisService
**Purpose**: Analyzes the role of a highlighted phrase in a video prompt

**Methods**:
- `detectVideoPhraseRole(highlightedText, contextBefore, contextAfter, explicitCategory)` - Returns phrase role

**Detected Roles**:
- Subject or character detail
- Lighting description
- Camera or framing description
- Location or environment detail
- Wardrobe and costume detail
- Color and visual tone
- Style or tone descriptor
- Technical specification
- Audio or score descriptor
- General visual detail (default)

#### 5. ConstraintGenerationService
**Purpose**: Generates replacement constraints based on phrase context

**Methods**:
- `getVideoReplacementConstraints(details, options)` - Returns constraint configuration

**Constraint Modes**:
- **Micro**: 2-6 word noun phrase (subjects, character details)
- **Lighting**: 6-14 word lighting clause (light source, direction, temperature)
- **Camera**: 6-12 word camera clause (movement, lens, framing)
- **Location**: 6-14 word location beat (setting, atmosphere, time)
- **Style**: 5-12 word stylistic phrase (era, tone, medium)
- **Phrase**: 5-12 word cinematic clause (general production detail)
- **Sentence**: 10-25 word cinematic sentence (complex descriptions)

### Guidance Services

#### 6. FallbackStrategyService
**Purpose**: Determines fallback constraints when suggestion generation fails

**Methods**:
- `getVideoFallbackConstraints(currentConstraints, details, attemptedModes, getConstraintsFn)` - Returns next fallback constraints or `null`

**Fallback Order**:
- `sentence` → `phrase` → `micro`
- `phrase` → `micro`
- Specialized modes (`lighting`, `camera`, `location`, `style`) → `micro`

#### 7. CategoryGuidanceService
**Purpose**: Provides context-aware category-specific guidance

**Methods**:
- `getCategoryFocusGuidance(phraseRole, categoryHint, fullContext, allSpans, editHistory)` - Returns guidance array

**Guidance Features**:
- **Context-aware**: Analyzes existing prompt elements
- **Gap identification**: Detects missing aspects
- **Relationship analysis**: Considers constraints between elements
- **Edit history awareness**: Maintains consistency with recent edits

**Categories**:
- Lighting, Camera, Subject, Wardrobe, Location, Color, Style, Action, Technical

## Usage

### Basic Usage

```javascript
import { VideoPromptService } from './services/video-prompt-analysis/index.js';

const videoService = new VideoPromptService();

// Detect if this is a video prompt
const isVideo = videoService.isVideoPrompt(fullPrompt);

if (isVideo) {
  // Detect phrase role
  const phraseRole = videoService.detectVideoPhraseRole(
    highlightedText,
    contextBefore,
    contextAfter,
    category
  );

  // Get constraints
  const constraints = videoService.getVideoReplacementConstraints({
    highlightWordCount,
    phraseRole,
    highlightedText,
    highlightedCategory,
    highlightedCategoryConfidence,
  });

  // Get model-specific guidance
  const model = videoService.detectTargetModel(fullPrompt);
  if (model) {
    const guidance = videoService.getModelSpecificGuidance(model, category);
  }

  // Get section-specific guidance
  const section = videoService.detectPromptSection(
    highlightedText,
    fullPrompt,
    contextBefore
  );
  const sectionGuidance = videoService.getSectionGuidance(section, category);
}
```

### Advanced Usage - Individual Services

```javascript
import {
  VideoPromptDetectionService,
  ModelDetectionService,
  ConstraintGenerationService,
} from './services/video-prompt-analysis/index.js';

// Use detection service directly
const detector = new VideoPromptDetectionService();
const isVideo = detector.isVideoPrompt(fullPrompt);

// Use model detection service
const modelDetector = new ModelDetectionService();
const model = modelDetector.detectTargetModel(fullPrompt);
const capabilities = modelDetector.getModelCapabilities(model);

// Use constraint generator directly
const constraintGen = new ConstraintGenerationService();
const constraints = constraintGen.getVideoReplacementConstraints(details, options);
```

### Configuration Access

```javascript
import {
  DETECTION_MARKERS,
  CONSTRAINT_MODES,
  CATEGORY_GUIDANCE,
} from './services/video-prompt-analysis/index.js';

// Access configuration for testing or debugging
console.log(DETECTION_MARKERS.MODERN);
console.log(CONSTRAINT_MODES.micro(5, 'subject detail'));
console.log(CATEGORY_GUIDANCE.lighting);
```

## Integration Points

This service is primarily used by:

1. **EnhancementService** (`services/enhancement/EnhancementService.js`)
   - Detects video prompts
   - Analyzes phrase roles
   - Generates constraints for suggestions

2. **PromptBuilderService** (`services/enhancement/services/SystemPromptBuilder.js`)
   - Builds model-specific context
   - Builds section-specific context
   - Gets category guidance for prompts

## Configuration

All configuration is externalized to `config/` directory:

- **detectionMarkers.js**: Patterns for video prompt detection
- **categoryMapping.js**: Category to phrase role mappings
- **constraintModes.js**: Constraint mode definitions
- **fallbackStrategy.js**: Fallback order configuration
- **categoryGuidance.js**: Category-specific guidance strings

## Testing

Integration tests are located in `__tests__/VideoPromptService.integration.test.js`

Run tests:
```bash
npm test -- video-prompt
```

## Design Principles

1. **Single Responsibility**: Each service has one well-defined purpose
2. **Configuration-Driven**: Logic separated from configuration data
3. **Orchestrator Pattern**: Main service coordinates sub-services
4. **Dependency Injection**: Services are injected, not instantiated internally
5. **Pure Functions**: Utilities have no side effects
6. **Testability**: Services can be tested in isolation

## Performance Considerations

- **Caching**: Services are stateless; caching happens at orchestrator level
- **Lazy Evaluation**: Services only execute when called
- **No I/O**: All services operate on in-memory data
- **Minimal Dependencies**: Only imports what's needed

## Backward Compatibility

The main export `VideoPromptService` maintains the same API as before the refactoring. All existing code using `VideoPromptService` will continue to work without changes.

## Future Enhancements

Potential areas for improvement:
- Machine learning-based phrase role detection
- Dynamic constraint generation based on model feedback
- Multi-model support in single prompt
- A/B testing for different constraint modes
- User preference learning for constraint selection

---

**Maintainer**: AI Services Team  
**Last Updated**: November 2024  
**Version**: 2.0.0

