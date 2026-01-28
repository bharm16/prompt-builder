# Feature 3: Director Mode

> **"Make it more cinematic."** — Natural language refinement of video prompts without cinematography expertise.

**Effort:** 3-4 weeks  
**Priority:** 3 (Build Third)  
**Dependencies:** Existing span labeling system, taxonomy

---

## Problem Statement

User generates a video. It's close, but:
- Camera is too static
- Lighting is too flat
- Character doesn't look confident enough

To fix it, they need to:
1. **Know what** prompt changes would help
2. **Know the vocabulary** (cinematography terminology)
3. **Manually edit** the prompt
4. **Regenerate** and hope

Most users don't have this knowledge. They just regenerate repeatedly, hoping for luck.

**Result:** Wasted credits, frustration, suboptimal outputs.

---

## Solution Overview

Natural language refinement. User says what they want:

> "Pull the camera back a bit and add some dramatic rim lighting"

PromptCanvas:
1. **Parses the intent** using LLM
2. **Maps to specific prompt modifications** using your taxonomy
3. **Shows the changes** before applying
4. **Regenerates** with modifications

**This is talking to an AI director who translates creative intent into technical prompts.**

### User Experience

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎬 Director Mode                                              [×]       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Current video playing...                                                │
│ ┌─────────────────────────────────────────────────────────────────┐    │
│ │                                                                 │    │
│ │                      [Video Preview]                            │    │
│ │                                                                 │    │
│ └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                         │
│ 💬 Chat with your director                                              │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐    │
│ │ You: Pull the camera back and add more dramatic lighting        │    │
│ └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐    │
│ │ Director: I'll make these changes:                              │    │
│ │                                                                 │    │
│ │   📷 Camera                                                     │    │
│ │      Medium shot → Wide shot                                    │    │
│ │                                                                 │    │
│ │   💡 Lighting                                                   │    │
│ │      + "dramatic rim lighting from behind"                      │    │
│ │                                                                 │    │
│ │ ─────────────────────────────────────────────────────────────── │    │
│ │                                                                 │    │
│ │ Before:                                                         │    │
│ │ "Medium shot of a woman walking through neon streets at night"  │    │
│ │                                                                 │    │
│ │ After:                                                          │    │
│ │ "Wide shot of a woman walking through neon streets at night,    │    │
│ │  dramatic rim lighting from behind"                             │    │
│ │                                                                 │    │
│ │           [Apply & Regenerate]  [Edit More]  [Cancel]           │    │
│ └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                         │
│ 💡 Quick suggestions based on your prompt:                              │
│                                                                         │
│ [Tighter framing] [Add camera movement] [Warmer lighting] [More moody] │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐    │
│ │ What would you like to change?                                  │    │
│ └─────────────────────────────────────────────────────────────────┘    │
│                                                     [Send →]            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Directory Structure

```
server/src/services/director/
├── index.ts                           # Public exports
├── types.ts                           # All type definitions
├── DirectorService.ts                 # Main orchestrator (< 300 lines)
├── IntentParserService.ts             # NL → structured intent (< 200 lines)
├── PromptModifierService.ts           # Intent → span mods (< 250 lines)
├── ModificationPreviewService.ts      # Generate diff preview (< 100 lines)
├── QuickSuggestionsService.ts         # Context-aware suggestions (< 150 lines)
├── templates/
│   ├── intent-parser.md               # LLM prompt for parsing
│   └── intent-mappings.json           # NL → category mappings
└── __tests__/
    ├── IntentParserService.test.ts
    ├── PromptModifierService.test.ts
    └── fixtures/
        └── intentExamples.ts

client/src/features/director/
├── index.ts
├── types.ts
├── context/
│   └── DirectorModeContext.tsx        # Director state management
├── hooks/
│   ├── useDirectorMode.ts             # Main director hook (< 100 lines)
│   ├── useIntentParsing.ts            # Parse user input (< 60 lines)
│   └── useQuickSuggestions.ts         # Get suggestions (< 50 lines)
├── components/
│   ├── DirectorMode/
│   │   ├── DirectorMode.tsx           # Main container (< 150 lines)
│   │   ├── DirectorChat.tsx           # Chat interface (< 120 lines)
│   │   ├── DirectorMessage.tsx        # Message bubble (< 80 lines)
│   │   └── index.ts
│   ├── ModificationPreview/
│   │   ├── ModificationPreview.tsx    # Change preview (< 120 lines)
│   │   ├── PromptDiff.tsx             # Before/after (< 80 lines)
│   │   ├── ChangeItem.tsx             # Single change (< 50 lines)
│   │   └── index.ts
│   ├── QuickSuggestions/
│   │   ├── QuickSuggestions.tsx       # Suggestion chips (< 80 lines)
│   │   └── index.ts
│   └── DirectorButton/
│       └── DirectorButton.tsx         # Entry point button (< 40 lines)
└── api/
    └── directorApi.ts                 # API calls (< 60 lines)
```

---

## Type Definitions

### Core Types

```typescript
// server/src/services/director/types.ts

import { TaxonomyCategory } from '@shared/taxonomy';
import { LabeledSpan } from '@/llm/span-labeling/types';

/**
 * User's natural language direction
 */
export interface DirectorInput {
  text: string;                      // "Pull the camera back and add rim lighting"
  conversationId?: string;           // For multi-turn
  previousModifications?: PromptModification[];  // Context from previous turns
}

/**
 * Parsed intent from natural language
 */
export interface DirectorIntent {
  id: string;
  rawInput: string;
  
  // Extracted modifications
  modifications: PromptModification[];
  
  // Parsing confidence
  confidence: number;
  
  // If clarification needed
  requiresClarification: boolean;
  clarificationQuestion?: string;
  
  // For multi-turn
  isFollowUp: boolean;
  referencedModifications?: string[];  // IDs of previous mods being refined
}

/**
 * A single modification to apply
 */
export interface PromptModification {
  id: string;
  
  // Type of modification
  type: 'add' | 'remove' | 'replace' | 'adjust';
  
  // What category this affects
  category: TaxonomyCategory;
  subcategory?: string;
  
  // For replace/remove: what to target
  target?: {
    text: string;                    // Existing span text
    spanId?: string;                 // If we have the span
  };
  
  // For add/replace: what to add
  value: string;
  
  // For adjust: magnitude
  adjustment?: {
    direction: 'increase' | 'decrease';
    magnitude: 'slight' | 'moderate' | 'significant';
  };
  
  // Human-readable explanation
  reason: string;
  
  // Confidence in this modification
  confidence: number;
}

/**
 * Result of applying modifications
 */
export interface ModificationResult {
  // Original and modified prompts
  originalPrompt: string;
  modifiedPrompt: string;
  
  // What was changed
  changes: AppliedChange[];
  
  // Summary
  summary: string;
}

/**
 * A single applied change
 */
export interface AppliedChange {
  type: 'add' | 'remove' | 'replace';
  category: TaxonomyCategory;
  
  before?: string;                   // For replace/remove
  after?: string;                    // For add/replace
  
  position?: {
    start: number;
    end: number;
  };
  
  reason: string;
}

/**
 * Director conversation state
 */
export interface DirectorConversation {
  id: string;
  
  // Original generation
  originalPrompt: string;
  originalSpans: LabeledSpan[];
  originalVideoId?: string;
  
  // Conversation turns
  turns: DirectorTurn[];
  
  // Accumulated modifications
  pendingModifications: PromptModification[];
  
  // Current preview
  previewPrompt: string;
  previewChanges: AppliedChange[];
  
  // State
  status: 'active' | 'applied' | 'cancelled';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A single conversation turn
 */
export interface DirectorTurn {
  id: string;
  type: 'user' | 'director';
  
  // Content
  content: string;
  
  // If director turn, the parsed intent
  intent?: DirectorIntent;
  
  // If director turn, the proposed changes
  proposedChanges?: AppliedChange[];
  
  timestamp: Date;
}

/**
 * Quick suggestion
 */
export interface QuickSuggestion {
  id: string;
  label: string;                     // "Tighter framing"
  intent: string;                    // "Get closer to the subject"
  category: TaxonomyCategory;
  icon?: string;
}

/**
 * Director mode entry request
 */
export interface StartDirectorRequest {
  prompt: string;
  spans?: LabeledSpan[];
  videoId?: string;
}

/**
 * Director input request
 */
export interface DirectorInputRequest {
  conversationId: string;
  input: string;
}

/**
 * Apply modifications request
 */
export interface ApplyModificationsRequest {
  conversationId: string;
  modelId?: string;                  // Override for regeneration
}
```

---

## Implementation Details

### 1. IntentParserService

Converts natural language to structured modifications.

```typescript
// server/src/services/director/IntentParserService.ts

import { LLMService } from '@/services/llm/LLMService';
import { LabeledSpan } from '@/llm/span-labeling/types';
import { DirectorInput, DirectorIntent, PromptModification } from './types';
import { loadTemplate } from '@/utils/templates';
import { INTENT_MAPPINGS } from './templates/intent-mappings';

export class IntentParserService {
  private parserPrompt: string;

  constructor(private llm: LLMService) {
    this.parserPrompt = loadTemplate('director/intent-parser.md');
  }

  /**
   * Parse user's natural language into structured intent
   */
  async parseIntent(
    input: DirectorInput,
    currentPrompt: string,
    currentSpans: LabeledSpan[]
  ): Promise<DirectorIntent> {
    // First, try rule-based parsing for common patterns
    const quickParse = this.tryQuickParse(input.text);
    if (quickParse && quickParse.confidence > 0.9) {
      return quickParse;
    }

    // Fall back to LLM parsing
    const llmResult = await this.llmParse(input, currentPrompt, currentSpans);
    
    // Merge with any quick parse results
    if (quickParse) {
      return this.mergeIntents(quickParse, llmResult);
    }

    return llmResult;
  }

  /**
   * Quick rule-based parsing for common patterns
   */
  private tryQuickParse(input: string): DirectorIntent | null {
    const lower = input.toLowerCase();
    const modifications: PromptModification[] = [];
    let confidence = 0;

    // Camera/framing patterns
    const framingPatterns = [
      { pattern: /pull\s*(the\s+)?camera\s+back|wider\s+(shot|framing)|see\s+more/i, 
        mod: this.createMod('replace', 'shot.type', 'wider framing', 'Pull camera back') },
      { pattern: /get\s+closer|tighter\s+(shot|framing)|zoom\s+in/i,
        mod: this.createMod('replace', 'shot.type', 'closer framing', 'Get closer') },
      { pattern: /from\s+above|bird'?s?\s+eye|overhead/i,
        mod: this.createMod('replace', 'shot.angle', 'high angle, from above', 'High angle') },
      { pattern: /from\s+below|low\s+angle|looking\s+up/i,
        mod: this.createMod('replace', 'shot.angle', 'low angle, looking up', 'Low angle') },
    ];

    // Camera movement patterns
    const movementPatterns = [
      { pattern: /tracking\s+shot|follow\s+(the\s+)?subject/i,
        mod: this.createMod('add', 'camera.movement', 'tracking shot following the subject', 'Add tracking') },
      { pattern: /orbit|circle\s+around/i,
        mod: this.createMod('add', 'camera.movement', 'orbital camera movement', 'Add orbit') },
      { pattern: /dolly\s+in|push\s+in/i,
        mod: this.createMod('add', 'camera.movement', 'slow dolly in', 'Push in') },
      { pattern: /static|locked\s+off|no\s+movement/i,
        mod: this.createMod('replace', 'camera.movement', 'static camera', 'Static camera') },
    ];

    // Lighting patterns
    const lightingPatterns = [
      { pattern: /rim\s+light|backlight|back\s+light/i,
        mod: this.createMod('add', 'lighting.direction', 'rim lighting from behind', 'Add rim light') },
      { pattern: /more\s+dramatic|moodier|dramatic\s+lighting/i,
        mod: this.createMod('add', 'lighting.quality', 'dramatic, high-contrast lighting', 'Dramatic lighting') },
      { pattern: /softer\s+(light|lighting)|gentler/i,
        mod: this.createMod('replace', 'lighting.quality', 'soft, diffused lighting', 'Softer lighting') },
      { pattern: /warmer|warm\s+(up|tones)/i,
        mod: this.createMod('add', 'lighting.color', 'warm golden tones', 'Warmer lighting') },
      { pattern: /cooler|cool\s+tones|colder/i,
        mod: this.createMod('add', 'lighting.color', 'cool blue tones', 'Cooler lighting') },
    ];

    // Subject/character patterns
    const subjectPatterns = [
      { pattern: /more\s+confident|confident\s+posture/i,
        mod: this.createMod('add', 'subject.emotion', 'confident posture and expression', 'More confident') },
      { pattern: /sadder|more\s+emotional|sad\s+expression/i,
        mod: this.createMod('add', 'subject.emotion', 'sad, emotional expression', 'More emotional') },
      { pattern: /more\s+intense|intense\s+focus/i,
        mod: this.createMod('add', 'subject.emotion', 'intense, focused expression', 'More intense') },
    ];

    // Style patterns
    const stylePatterns = [
      { pattern: /more\s+cinematic|cinematic\s+look/i,
        mod: this.createMod('add', 'style.look', 'cinematic film quality', 'More cinematic') },
      { pattern: /grittier|gritty|raw/i,
        mod: this.createMod('add', 'style.look', 'gritty, raw aesthetic', 'Grittier') },
      { pattern: /dreamier|dreamy|soft\s+focus/i,
        mod: this.createMod('add', 'style.look', 'dreamy, soft focus', 'Dreamier') },
    ];

    const allPatterns = [
      ...framingPatterns,
      ...movementPatterns,
      ...lightingPatterns,
      ...subjectPatterns,
      ...stylePatterns,
    ];

    for (const { pattern, mod } of allPatterns) {
      if (pattern.test(lower)) {
        modifications.push(mod);
        confidence = Math.max(confidence, 0.85);
      }
    }

    if (modifications.length === 0) {
      return null;
    }

    return {
      id: this.generateIntentId(),
      rawInput: input,
      modifications,
      confidence,
      requiresClarification: false,
      isFollowUp: false,
    };
  }

  /**
   * LLM-based parsing for complex intents
   */
  private async llmParse(
    input: DirectorInput,
    currentPrompt: string,
    currentSpans: LabeledSpan[]
  ): Promise<DirectorIntent> {
    const prompt = this.buildParserPrompt(input, currentPrompt, currentSpans);
    
    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: this.parserPrompt },
        { role: 'user', content: prompt },
      ],
      responseFormat: 'json',
      temperature: 0.3,  // Low temperature for consistency
      maxTokens: 1000,
    });

    const parsed = JSON.parse(response.content);
    return this.validateAndNormalize(parsed, input.text);
  }

  /**
   * Build prompt for LLM parser
   */
  private buildParserPrompt(
    input: DirectorInput,
    currentPrompt: string,
    currentSpans: LabeledSpan[]
  ): string {
    const spansJson = currentSpans.map(s => ({
      text: s.text,
      category: s.category,
      start: s.start,
      end: s.end,
    }));

    return `
Current prompt:
"""
${currentPrompt}
"""

Current prompt elements (spans):
${JSON.stringify(spansJson, null, 2)}

${input.previousModifications ? `
Previous modifications in this session:
${JSON.stringify(input.previousModifications, null, 2)}
` : ''}

User's direction:
"""
${input.text}
"""

Parse this direction into specific prompt modifications.
`;
  }

  /**
   * Merge quick parse with LLM results
   */
  private mergeIntents(quick: DirectorIntent, llm: DirectorIntent): DirectorIntent {
    // Prefer quick parse for high-confidence matches
    const merged = [...quick.modifications];
    
    // Add LLM modifications that don't conflict
    for (const llmMod of llm.modifications) {
      const conflicts = merged.some(m => 
        m.category === llmMod.category && m.type === llmMod.type
      );
      if (!conflicts) {
        merged.push(llmMod);
      }
    }

    return {
      ...quick,
      modifications: merged,
      confidence: Math.max(quick.confidence, llm.confidence),
      requiresClarification: llm.requiresClarification,
      clarificationQuestion: llm.clarificationQuestion,
    };
  }

  /**
   * Validate and normalize LLM output
   */
  private validateAndNormalize(parsed: any, rawInput: string): DirectorIntent {
    const modifications: PromptModification[] = [];

    if (parsed.modifications && Array.isArray(parsed.modifications)) {
      for (const mod of parsed.modifications) {
        if (this.isValidModification(mod)) {
          modifications.push({
            id: this.generateModId(),
            type: mod.type,
            category: mod.category,
            subcategory: mod.subcategory,
            target: mod.target,
            value: mod.value,
            adjustment: mod.adjustment,
            reason: mod.reason || 'User requested',
            confidence: mod.confidence || 0.8,
          });
        }
      }
    }

    return {
      id: this.generateIntentId(),
      rawInput,
      modifications,
      confidence: parsed.confidence || 0.7,
      requiresClarification: parsed.requiresClarification || false,
      clarificationQuestion: parsed.clarificationQuestion,
      isFollowUp: parsed.isFollowUp || false,
      referencedModifications: parsed.referencedModifications,
    };
  }

  /**
   * Create a modification object
   */
  private createMod(
    type: PromptModification['type'],
    category: string,
    value: string,
    reason: string
  ): PromptModification {
    return {
      id: this.generateModId(),
      type,
      category: category as any,
      value,
      reason,
      confidence: 0.9,
    };
  }

  private isValidModification(mod: any): boolean {
    return (
      mod &&
      typeof mod.type === 'string' &&
      ['add', 'remove', 'replace', 'adjust'].includes(mod.type) &&
      typeof mod.category === 'string' &&
      (mod.type !== 'add' || typeof mod.value === 'string')
    );
  }

  private generateIntentId(): string {
    return `intent_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateModId(): string {
    return `mod_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}
```

### Intent Parser LLM Prompt

```markdown
<!-- server/src/services/director/templates/intent-parser.md -->

You are a cinematography director assistant. Parse the user's natural language direction into specific prompt modifications.

Your job is to translate creative intent into technical prompt changes.

## Category Mappings

CAMERA/FRAMING (shot.type, shot.angle):
- "pull back", "wider", "see more" → shot.type: wider framing
- "get closer", "tighter", "zoom in" → shot.type: closer framing  
- "from above", "bird's eye" → shot.angle: high angle
- "from below", "low angle" → shot.angle: low angle

CAMERA MOVEMENT (camera.movement):
- "follow", "track" → tracking shot
- "orbit", "circle around" → orbital movement
- "push in", "dolly in" → dolly in
- "pull out", "dolly out" → dolly out
- "pan" → pan shot
- "static", "still", "locked off" → static camera

LIGHTING (lighting.quality, lighting.direction, lighting.color):
- "more dramatic", "moodier" → dramatic, high-contrast lighting
- "rim light", "backlight" → rim lighting from behind
- "softer", "gentler" → soft, diffused lighting
- "warmer" → warm golden tones
- "cooler", "colder" → cool blue tones
- "brighter" → increased lighting intensity
- "darker", "dimmer" → decreased lighting intensity

SUBJECT/CHARACTER (subject.emotion, subject.action):
- "more confident" → confident posture and expression
- "sadder", "more emotional" → sad, emotional expression
- "more intense" → intense, focused expression
- "relaxed" → relaxed, casual posture

STYLE (style.look, style.aesthetic):
- "more cinematic" → cinematic film quality
- "grittier" → gritty, raw aesthetic
- "dreamier" → dreamy, soft focus
- "more realistic" → photorealistic quality

## Response Format

Return a JSON object:

```json
{
  "modifications": [
    {
      "type": "add | remove | replace | adjust",
      "category": "category.subcategory",
      "target": { "text": "existing text to replace" },  // For replace/remove
      "value": "new text to add",  // For add/replace
      "adjustment": {  // For adjust
        "direction": "increase | decrease",
        "magnitude": "slight | moderate | significant"
      },
      "reason": "Why this change helps",
      "confidence": 0.0-1.0
    }
  ],
  "confidence": 0.0-1.0,
  "requiresClarification": false,
  "clarificationQuestion": "If clarification needed, what to ask",
  "isFollowUp": false
}
```

## Guidelines

1. Map user language to the most specific category possible
2. If user says "a bit" or "slightly", use magnitude: "slight"
3. If user says "much more" or "significantly", use magnitude: "significant"
4. If unclear what user wants, set requiresClarification: true
5. Multiple changes in one request should all be captured
6. Consider context from previous modifications if provided
7. Don't invent changes the user didn't ask for
```

### 2. PromptModifierService

Applies modifications to prompts using span awareness.

```typescript
// server/src/services/director/PromptModifierService.ts

import { LabeledSpan } from '@/llm/span-labeling/types';
import { SpanLabelingService } from '@/llm/span-labeling/SpanLabelingService';
import { PromptModification, ModificationResult, AppliedChange } from './types';
import { TaxonomyService } from '@/services/taxonomy/TaxonomyService';

export class PromptModifierService {
  constructor(
    private spanLabeler: SpanLabelingService,
    private taxonomy: TaxonomyService
  ) {}

  /**
   * Apply modifications to a prompt
   */
  async applyModifications(
    prompt: string,
    spans: LabeledSpan[],
    modifications: PromptModification[]
  ): Promise<ModificationResult> {
    let modifiedPrompt = prompt;
    const changes: AppliedChange[] = [];

    // Sort modifications by position (reverse order for replacements)
    const sortedMods = this.sortModifications(modifications, spans);

    for (const mod of sortedMods) {
      const result = await this.applySingleModification(
        modifiedPrompt,
        spans,
        mod
      );

      if (result) {
        modifiedPrompt = result.prompt;
        changes.push(result.change);
        
        // Update spans for subsequent modifications
        spans = await this.spanLabeler.labelSpans(modifiedPrompt);
      }
    }

    return {
      originalPrompt: prompt,
      modifiedPrompt,
      changes,
      summary: this.generateSummary(changes),
    };
  }

  /**
   * Apply a single modification
   */
  private async applySingleModification(
    prompt: string,
    spans: LabeledSpan[],
    mod: PromptModification
  ): Promise<{ prompt: string; change: AppliedChange } | null> {
    switch (mod.type) {
      case 'add':
        return this.applyAddition(prompt, spans, mod);
      case 'remove':
        return this.applyRemoval(prompt, spans, mod);
      case 'replace':
        return this.applyReplacement(prompt, spans, mod);
      case 'adjust':
        return this.applyAdjustment(prompt, spans, mod);
      default:
        return null;
    }
  }

  /**
   * Add new content to prompt
   */
  private applyAddition(
    prompt: string,
    spans: LabeledSpan[],
    mod: PromptModification
  ): { prompt: string; change: AppliedChange } {
    // Find best insertion point based on category
    const insertPosition = this.findInsertPosition(prompt, spans, mod.category);
    
    // Format the value
    const formattedValue = this.formatValue(mod.value, mod.category);
    
    // Insert at position
    const newPrompt = this.insertAt(prompt, insertPosition, formattedValue);

    return {
      prompt: newPrompt,
      change: {
        type: 'add',
        category: mod.category,
        after: formattedValue,
        position: { start: insertPosition, end: insertPosition + formattedValue.length },
        reason: mod.reason,
      },
    };
  }

  /**
   * Remove content from prompt
   */
  private applyRemoval(
    prompt: string,
    spans: LabeledSpan[],
    mod: PromptModification
  ): { prompt: string; change: AppliedChange } | null {
    // Find the span to remove
    const targetSpan = this.findTargetSpan(spans, mod);
    
    if (!targetSpan) {
      return null;
    }

    // Remove the span (including surrounding punctuation/whitespace)
    const { newPrompt, removed } = this.removeSpan(prompt, targetSpan);

    return {
      prompt: newPrompt,
      change: {
        type: 'remove',
        category: mod.category,
        before: removed,
        position: { start: targetSpan.start, end: targetSpan.end },
        reason: mod.reason,
      },
    };
  }

  /**
   * Replace content in prompt
   */
  private applyReplacement(
    prompt: string,
    spans: LabeledSpan[],
    mod: PromptModification
  ): { prompt: string; change: AppliedChange } | null {
    // Find the span to replace
    const targetSpan = this.findTargetSpan(spans, mod);
    
    if (!targetSpan) {
      // If no existing span, treat as addition
      return this.applyAddition(prompt, spans, mod);
    }

    // Format the new value
    const formattedValue = this.formatValue(mod.value, mod.category);
    
    // Replace the span
    const newPrompt = this.replaceAt(prompt, targetSpan.start, targetSpan.end, formattedValue);

    return {
      prompt: newPrompt,
      change: {
        type: 'replace',
        category: mod.category,
        before: targetSpan.text,
        after: formattedValue,
        position: { start: targetSpan.start, end: targetSpan.start + formattedValue.length },
        reason: mod.reason,
      },
    };
  }

  /**
   * Adjust existing content (intensity/magnitude)
   */
  private async applyAdjustment(
    prompt: string,
    spans: LabeledSpan[],
    mod: PromptModification
  ): Promise<{ prompt: string; change: AppliedChange } | null> {
    const targetSpan = this.findTargetSpan(spans, mod);
    
    if (!targetSpan) {
      // If no existing span, add with the adjustment
      const adjustedValue = this.applyMagnitude(mod.value, mod.adjustment);
      return this.applyAddition(prompt, spans, { ...mod, value: adjustedValue });
    }

    // Generate adjusted version of existing content
    const adjustedValue = this.adjustExistingValue(
      targetSpan.text,
      mod.adjustment!,
      mod.category
    );

    const newPrompt = this.replaceAt(prompt, targetSpan.start, targetSpan.end, adjustedValue);

    return {
      prompt: newPrompt,
      change: {
        type: 'replace',
        category: mod.category,
        before: targetSpan.text,
        after: adjustedValue,
        position: { start: targetSpan.start, end: targetSpan.start + adjustedValue.length },
        reason: mod.reason,
      },
    };
  }

  /**
   * Find best position to insert based on category
   */
  private findInsertPosition(
    prompt: string,
    spans: LabeledSpan[],
    category: string
  ): number {
    // Category ordering preference
    const categoryOrder = [
      'shot',      // Shot type first
      'camera',    // Then camera
      'subject',   // Then subject
      'action',    // Then action
      'environment', // Then environment
      'lighting',  // Then lighting
      'style',     // Style near end
      'technical', // Technical last
    ];

    const categoryRoot = category.split('.')[0];
    const targetOrderIndex = categoryOrder.indexOf(categoryRoot);

    // Find spans that come after this category
    const spansAfter = spans.filter(s => {
      const spanRoot = s.category.split('.')[0];
      const spanOrderIndex = categoryOrder.indexOf(spanRoot);
      return spanOrderIndex > targetOrderIndex;
    });

    if (spansAfter.length > 0) {
      // Insert before the first span that should come after
      const firstAfter = spansAfter.reduce((min, s) => 
        s.start < min.start ? s : min
      );
      return firstAfter.start;
    }

    // Find spans in the same category
    const sameCategory = spans.filter(s => s.category.startsWith(categoryRoot));
    if (sameCategory.length > 0) {
      // Insert after the last span in same category
      const lastSame = sameCategory.reduce((max, s) => 
        s.end > max.end ? s : max
      );
      return lastSame.end;
    }

    // Default: insert near the end, before any trailing punctuation
    const trimmed = prompt.trimEnd();
    return trimmed.length;
  }

  /**
   * Find target span for modification
   */
  private findTargetSpan(
    spans: LabeledSpan[],
    mod: PromptModification
  ): LabeledSpan | null {
    // If we have explicit target text, find that
    if (mod.target?.text) {
      const exactMatch = spans.find(s => 
        s.text.toLowerCase() === mod.target!.text.toLowerCase()
      );
      if (exactMatch) return exactMatch;

      // Try partial match
      const partialMatch = spans.find(s => 
        s.text.toLowerCase().includes(mod.target!.text.toLowerCase()) ||
        mod.target!.text.toLowerCase().includes(s.text.toLowerCase())
      );
      if (partialMatch) return partialMatch;
    }

    // Find by category
    const categoryMatches = spans.filter(s => 
      s.category === mod.category || 
      s.category.startsWith(mod.category + '.') ||
      mod.category.startsWith(s.category + '.')
    );

    if (categoryMatches.length === 1) {
      return categoryMatches[0];
    }

    if (categoryMatches.length > 1) {
      // Return the one that best matches the value being replaced
      return categoryMatches[0]; // Simple: take first
    }

    return null;
  }

  /**
   * Format value for insertion
   */
  private formatValue(value: string, category: string): string {
    // Add appropriate punctuation/spacing
    let formatted = value.trim();
    
    // Ensure it starts with lowercase (will be mid-sentence)
    if (!/^[A-Z][a-z]/.test(formatted)) {
      formatted = formatted.charAt(0).toLowerCase() + formatted.slice(1);
    }

    return formatted;
  }

  /**
   * Apply magnitude adjustment to value
   */
  private applyMagnitude(
    value: string,
    adjustment?: PromptModification['adjustment']
  ): string {
    if (!adjustment) return value;

    const magnitudeWords = {
      slight: adjustment.direction === 'increase' ? 'subtle' : 'slightly less',
      moderate: adjustment.direction === 'increase' ? 'more' : 'less',
      significant: adjustment.direction === 'increase' ? 'very' : 'much less',
    };

    const magnitudeWord = magnitudeWords[adjustment.magnitude];
    return `${magnitudeWord} ${value}`;
  }

  /**
   * Adjust existing value with magnitude
   */
  private adjustExistingValue(
    existingValue: string,
    adjustment: NonNullable<PromptModification['adjustment']>,
    category: string
  ): string {
    // This could be more sophisticated with LLM help
    // For now, simple word substitution
    
    if (adjustment.direction === 'increase') {
      // Intensify
      if (existingValue.includes('soft')) {
        return existingValue.replace('soft', 'very soft');
      }
      if (existingValue.includes('dramatic')) {
        return existingValue.replace('dramatic', 'extremely dramatic');
      }
      return `more ${existingValue}`;
    } else {
      // Reduce
      if (existingValue.includes('very')) {
        return existingValue.replace('very ', '');
      }
      if (existingValue.includes('extremely')) {
        return existingValue.replace('extremely', 'moderately');
      }
      return `subtle ${existingValue}`;
    }
  }

  /**
   * Insert text at position
   */
  private insertAt(prompt: string, position: number, text: string): string {
    // Check if we need to add comma/space
    const before = prompt.slice(0, position);
    const after = prompt.slice(position);
    
    let separator = '';
    if (before.length > 0 && !before.endsWith(' ') && !before.endsWith(',')) {
      separator = ', ';
    } else if (before.endsWith(',')) {
      separator = ' ';
    }

    return before + separator + text + after;
  }

  /**
   * Replace text at range
   */
  private replaceAt(prompt: string, start: number, end: number, text: string): string {
    return prompt.slice(0, start) + text + prompt.slice(end);
  }

  /**
   * Remove span from prompt
   */
  private removeSpan(prompt: string, span: LabeledSpan): { newPrompt: string; removed: string } {
    let start = span.start;
    let end = span.end;

    // Expand to include surrounding punctuation/whitespace
    while (start > 0 && /[,\s]/.test(prompt[start - 1])) {
      start--;
    }
    while (end < prompt.length && /[,\s]/.test(prompt[end])) {
      end++;
    }

    const removed = prompt.slice(span.start, span.end);
    const newPrompt = prompt.slice(0, start) + prompt.slice(end);

    return { newPrompt: newPrompt.replace(/\s+/g, ' ').trim(), removed };
  }

  /**
   * Sort modifications for application order
   */
  private sortModifications(
    modifications: PromptModification[],
    spans: LabeledSpan[]
  ): PromptModification[] {
    // Apply removals first (in reverse order), then replacements, then additions
    const typeOrder = { remove: 0, replace: 1, adjust: 2, add: 3 };
    
    return [...modifications].sort((a, b) => {
      const typeCompare = typeOrder[a.type] - typeOrder[b.type];
      if (typeCompare !== 0) return typeCompare;
      
      // For same type, sort by position (reverse for removals)
      const aSpan = spans.find(s => s.category === a.category);
      const bSpan = spans.find(s => s.category === b.category);
      
      if (aSpan && bSpan) {
        return a.type === 'remove' 
          ? bSpan.start - aSpan.start  // Reverse for removals
          : aSpan.start - bSpan.start;
      }
      
      return 0;
    });
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(changes: AppliedChange[]): string {
    const parts = changes.map(c => {
      const categoryLabel = this.taxonomy.getCategoryLabel(c.category);
      switch (c.type) {
        case 'add':
          return `Added ${categoryLabel}: "${c.after}"`;
        case 'remove':
          return `Removed ${categoryLabel}: "${c.before}"`;
        case 'replace':
          return `Changed ${categoryLabel}: "${c.before}" → "${c.after}"`;
        default:
          return '';
      }
    });

    return parts.filter(Boolean).join('. ');
  }
}
```

### 3. QuickSuggestionsService

Generates context-aware suggestions.

```typescript
// server/src/services/director/QuickSuggestionsService.ts

import { LabeledSpan } from '@/llm/span-labeling/types';
import { QuickSuggestion } from './types';

export class QuickSuggestionsService {
  /**
   * Generate quick suggestions based on current prompt
   */
  generateSuggestions(
    prompt: string,
    spans: LabeledSpan[]
  ): QuickSuggestion[] {
    const suggestions: QuickSuggestion[] = [];

    // Camera/framing suggestions
    suggestions.push(...this.getCameraSuggestions(spans));
    
    // Lighting suggestions
    suggestions.push(...this.getLightingSuggestions(spans));
    
    // Movement suggestions
    suggestions.push(...this.getMovementSuggestions(spans));
    
    // Style suggestions
    suggestions.push(...this.getStyleSuggestions(spans));

    // Return top 4-6 most relevant
    return this.rankAndFilter(suggestions, spans).slice(0, 6);
  }

  private getCameraSuggestions(spans: LabeledSpan[]): QuickSuggestion[] {
    const suggestions: QuickSuggestion[] = [];
    
    const shotSpan = spans.find(s => s.category === 'shot.type');
    
    if (shotSpan) {
      const shotText = shotSpan.text.toLowerCase();
      
      if (shotText.includes('wide') || shotText.includes('establishing')) {
        suggestions.push({
          id: 'tighter',
          label: 'Tighter framing',
          intent: 'Get closer to the subject',
          category: 'shot.type',
          icon: '🔍',
        });
      } else if (shotText.includes('close')) {
        suggestions.push({
          id: 'wider',
          label: 'Pull back',
          intent: 'Show more of the scene',
          category: 'shot.type',
          icon: '↔️',
        });
      }
    } else {
      // No shot type specified
      suggestions.push({
        id: 'add-shot',
        label: 'Add shot type',
        intent: 'Add a medium shot framing',
        category: 'shot.type',
        icon: '📷',
      });
    }

    // Angle suggestions
    const angleSpan = spans.find(s => s.category === 'shot.angle');
    if (!angleSpan) {
      suggestions.push({
        id: 'add-angle',
        label: 'Add angle',
        intent: 'Add a slight low angle for dramatic effect',
        category: 'shot.angle',
        icon: '📐',
      });
    }

    return suggestions;
  }

  private getLightingSuggestions(spans: LabeledSpan[]): QuickSuggestion[] {
    const suggestions: QuickSuggestion[] = [];
    
    const lightingSpans = spans.filter(s => s.category.startsWith('lighting.'));
    
    if (lightingSpans.length === 0) {
      suggestions.push(
        {
          id: 'dramatic-light',
          label: 'Dramatic lighting',
          intent: 'Add dramatic rim lighting',
          category: 'lighting.quality',
          icon: '💡',
        },
        {
          id: 'golden-hour',
          label: 'Golden hour',
          intent: 'Set the lighting to golden hour',
          category: 'lighting.quality',
          icon: '🌅',
        }
      );
    } else {
      // Has some lighting, offer variations
      const hasWarm = lightingSpans.some(s => 
        s.text.toLowerCase().includes('warm') || s.text.toLowerCase().includes('golden')
      );
      
      suggestions.push({
        id: hasWarm ? 'cooler' : 'warmer',
        label: hasWarm ? 'Cooler tones' : 'Warmer tones',
        intent: hasWarm ? 'Make the lighting cooler' : 'Make the lighting warmer',
        category: 'lighting.color',
        icon: hasWarm ? '❄️' : '🔥',
      });
    }

    return suggestions;
  }

  private getMovementSuggestions(spans: LabeledSpan[]): QuickSuggestion[] {
    const suggestions: QuickSuggestion[] = [];
    
    const movementSpan = spans.find(s => s.category === 'camera.movement');
    
    if (!movementSpan) {
      suggestions.push(
        {
          id: 'tracking',
          label: 'Add tracking',
          intent: 'Add a slow tracking shot',
          category: 'camera.movement',
          icon: '🎥',
        },
        {
          id: 'static',
          label: 'Lock off camera',
          intent: 'Make the camera completely static',
          category: 'camera.movement',
          icon: '🔒',
        }
      );
    } else if (movementSpan.text.toLowerCase().includes('static')) {
      suggestions.push({
        id: 'add-movement',
        label: 'Add movement',
        intent: 'Add subtle camera movement',
        category: 'camera.movement',
        icon: '🎥',
      });
    }

    return suggestions;
  }

  private getStyleSuggestions(spans: LabeledSpan[]): QuickSuggestion[] {
    const suggestions: QuickSuggestion[] = [];
    
    const styleSpans = spans.filter(s => s.category.startsWith('style.'));
    
    if (styleSpans.length === 0) {
      suggestions.push({
        id: 'cinematic',
        label: 'More cinematic',
        intent: 'Make it more cinematic with film-like quality',
        category: 'style.look',
        icon: '🎬',
      });
    }

    // Always offer mood adjustments
    suggestions.push({
      id: 'moodier',
      label: 'More moody',
      intent: 'Make the overall mood darker and more atmospheric',
      category: 'style.mood',
      icon: '🌑',
    });

    return suggestions;
  }

  /**
   * Rank and filter suggestions by relevance
   */
  private rankAndFilter(
    suggestions: QuickSuggestion[],
    spans: LabeledSpan[]
  ): QuickSuggestion[] {
    // Score each suggestion
    const scored = suggestions.map(s => {
      let score = 0;
      
      // Prefer suggestions for missing categories
      const hasCategory = spans.some(sp => 
        sp.category === s.category || sp.category.startsWith(s.category + '.')
      );
      if (!hasCategory) {
        score += 2;
      }
      
      // Prefer commonly used improvements
      const popularCategories = ['lighting.quality', 'shot.type', 'camera.movement'];
      if (popularCategories.includes(s.category)) {
        score += 1;
      }

      return { suggestion: s, score };
    });

    // Sort by score and dedupe by category
    scored.sort((a, b) => b.score - a.score);
    
    const seen = new Set<string>();
    const filtered: QuickSuggestion[] = [];
    
    for (const { suggestion } of scored) {
      if (!seen.has(suggestion.category)) {
        seen.add(suggestion.category);
        filtered.push(suggestion);
      }
    }

    return filtered;
  }
}
```

### 4. DirectorService (Orchestrator)

```typescript
// server/src/services/director/DirectorService.ts

import { SpanLabelingService } from '@/llm/span-labeling/SpanLabelingService';
import { VideoGenerationService } from '@/services/video-generation/VideoGenerationService';
import { 
  DirectorConversation, 
  DirectorTurn, 
  DirectorIntent,
  ModificationResult,
  QuickSuggestion,
  StartDirectorRequest,
  DirectorInputRequest,
  ApplyModificationsRequest
} from './types';
import { IntentParserService } from './IntentParserService';
import { PromptModifierService } from './PromptModifierService';
import { QuickSuggestionsService } from './QuickSuggestionsService';

export class DirectorService {
  private conversations: Map<string, DirectorConversation> = new Map();

  constructor(
    private spanLabeler: SpanLabelingService,
    private intentParser: IntentParserService,
    private promptModifier: PromptModifierService,
    private suggestionService: QuickSuggestionsService,
    private videoGenerator: VideoGenerationService
  ) {}

  /**
   * Start a new director session
   */
  async startSession(request: StartDirectorRequest): Promise<{
    conversation: DirectorConversation;
    suggestions: QuickSuggestion[];
  }> {
    // Get spans if not provided
    const spans = request.spans || await this.spanLabeler.labelSpans(request.prompt);

    const conversation: DirectorConversation = {
      id: this.generateConversationId(),
      originalPrompt: request.prompt,
      originalSpans: spans,
      originalVideoId: request.videoId,
      turns: [],
      pendingModifications: [],
      previewPrompt: request.prompt,
      previewChanges: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.conversations.set(conversation.id, conversation);

    // Generate initial suggestions
    const suggestions = this.suggestionService.generateSuggestions(
      request.prompt,
      spans
    );

    return { conversation, suggestions };
  }

  /**
   * Process user direction
   */
  async processDirection(request: DirectorInputRequest): Promise<{
    intent: DirectorIntent;
    preview: ModificationResult;
    suggestions: QuickSuggestion[];
  }> {
    const conversation = this.conversations.get(request.conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation not found: ${request.conversationId}`);
    }

    // Add user turn
    const userTurn: DirectorTurn = {
      id: this.generateTurnId(),
      type: 'user',
      content: request.input,
      timestamp: new Date(),
    };
    conversation.turns.push(userTurn);

    // Parse intent
    const intent = await this.intentParser.parseIntent(
      {
        text: request.input,
        conversationId: request.conversationId,
        previousModifications: conversation.pendingModifications,
      },
      conversation.previewPrompt,
      conversation.originalSpans
    );

    // Handle clarification needed
    if (intent.requiresClarification) {
      const directorTurn: DirectorTurn = {
        id: this.generateTurnId(),
        type: 'director',
        content: intent.clarificationQuestion!,
        intent,
        timestamp: new Date(),
      };
      conversation.turns.push(directorTurn);
      conversation.updatedAt = new Date();

      return {
        intent,
        preview: {
          originalPrompt: conversation.originalPrompt,
          modifiedPrompt: conversation.previewPrompt,
          changes: [],
          summary: 'Clarification needed',
        },
        suggestions: [],
      };
    }

    // Add new modifications to pending
    conversation.pendingModifications.push(...intent.modifications);

    // Apply all pending modifications
    const preview = await this.promptModifier.applyModifications(
      conversation.originalPrompt,
      conversation.originalSpans,
      conversation.pendingModifications
    );

    // Update preview state
    conversation.previewPrompt = preview.modifiedPrompt;
    conversation.previewChanges = preview.changes;

    // Add director turn
    const directorTurn: DirectorTurn = {
      id: this.generateTurnId(),
      type: 'director',
      content: this.formatDirectorResponse(intent, preview),
      intent,
      proposedChanges: preview.changes,
      timestamp: new Date(),
    };
    conversation.turns.push(directorTurn);
    conversation.updatedAt = new Date();

    // Generate new suggestions based on modified prompt
    const newSpans = await this.spanLabeler.labelSpans(preview.modifiedPrompt);
    const suggestions = this.suggestionService.generateSuggestions(
      preview.modifiedPrompt,
      newSpans
    );

    return { intent, preview, suggestions };
  }

  /**
   * Apply modifications and regenerate
   */
  async applyAndRegenerate(request: ApplyModificationsRequest): Promise<{
    videoId: string;
    prompt: string;
  }> {
    const conversation = this.conversations.get(request.conversationId);
    
    if (!conversation) {
      throw new Error(`Conversation not found: ${request.conversationId}`);
    }

    // Generate video with modified prompt
    const result = await this.videoGenerator.generate({
      prompt: conversation.previewPrompt,
      modelId: request.modelId,
      // ... other options from original generation
    });

    // Mark conversation as applied
    conversation.status = 'applied';
    conversation.updatedAt = new Date();

    return {
      videoId: result.videoId,
      prompt: conversation.previewPrompt,
    };
  }

  /**
   * Cancel director session
   */
  cancelSession(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.status = 'cancelled';
      conversation.updatedAt = new Date();
    }
  }

  /**
   * Undo last modification
   */
  async undoLastModification(conversationId: string): Promise<ModificationResult | null> {
    const conversation = this.conversations.get(conversationId);
    
    if (!conversation || conversation.pendingModifications.length === 0) {
      return null;
    }

    // Remove last modification
    conversation.pendingModifications.pop();

    // Recompute preview
    if (conversation.pendingModifications.length === 0) {
      conversation.previewPrompt = conversation.originalPrompt;
      conversation.previewChanges = [];
      
      return {
        originalPrompt: conversation.originalPrompt,
        modifiedPrompt: conversation.originalPrompt,
        changes: [],
        summary: 'Reverted to original',
      };
    }

    const preview = await this.promptModifier.applyModifications(
      conversation.originalPrompt,
      conversation.originalSpans,
      conversation.pendingModifications
    );

    conversation.previewPrompt = preview.modifiedPrompt;
    conversation.previewChanges = preview.changes;
    conversation.updatedAt = new Date();

    return preview;
  }

  /**
   * Get conversation state
   */
  getConversation(conversationId: string): DirectorConversation | null {
    return this.conversations.get(conversationId) || null;
  }

  /**
   * Format director response
   */
  private formatDirectorResponse(
    intent: DirectorIntent,
    preview: ModificationResult
  ): string {
    const changeDescriptions = preview.changes.map(c => {
      switch (c.type) {
        case 'add':
          return `+ Added: "${c.after}"`;
        case 'remove':
          return `- Removed: "${c.before}"`;
        case 'replace':
          return `~ Changed: "${c.before}" → "${c.after}"`;
        default:
          return '';
      }
    });

    return `I'll make these changes:\n\n${changeDescriptions.join('\n')}\n\n` +
           `${preview.summary}`;
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTurnId(): string {
    return `turn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}
```

---

## API Endpoints

```typescript
// server/src/routes/director.ts

import { Router } from 'express';
import { authenticateUser } from '@/middleware/auth';

const router = Router();

router.use(authenticateUser);

/**
 * POST /api/director/start
 * Start a new director session
 */
router.post('/start', async (req, res) => {
  const { prompt, spans, videoId } = req.body;
  
  try {
    const service = req.app.get('directorService');
    const result = await service.startSession({ prompt, spans, videoId });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start director session' });
  }
});

/**
 * POST /api/director/:conversationId/direction
 * Process a user direction
 */
router.post('/:conversationId/direction', async (req, res) => {
  const { input } = req.body;
  
  try {
    const service = req.app.get('directorService');
    const result = await service.processDirection({
      conversationId: req.params.conversationId,
      input,
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process direction' });
  }
});

/**
 * POST /api/director/:conversationId/apply
 * Apply modifications and regenerate
 */
router.post('/:conversationId/apply', async (req, res) => {
  const { modelId } = req.body;
  
  try {
    const service = req.app.get('directorService');
    const result = await service.applyAndRegenerate({
      conversationId: req.params.conversationId,
      modelId,
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply modifications' });
  }
});

/**
 * POST /api/director/:conversationId/undo
 * Undo last modification
 */
router.post('/:conversationId/undo', async (req, res) => {
  try {
    const service = req.app.get('directorService');
    const result = await service.undoLastModification(req.params.conversationId);
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to undo modification' });
  }
});

/**
 * DELETE /api/director/:conversationId
 * Cancel director session
 */
router.delete('/:conversationId', (req, res) => {
  const service = req.app.get('directorService');
  service.cancelSession(req.params.conversationId);
  
  res.json({ success: true });
});

/**
 * GET /api/director/:conversationId
 * Get conversation state
 */
router.get('/:conversationId', (req, res) => {
  const service = req.app.get('directorService');
  const conversation = service.getConversation(req.params.conversationId);
  
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  res.json({ success: true, data: conversation });
});

export default router;
```

---

## Client Implementation

### Context Provider

```typescript
// client/src/features/director/context/DirectorModeContext.tsx

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { directorApi } from '../api/directorApi';
import type { 
  DirectorConversation, 
  DirectorIntent, 
  ModificationResult,
  QuickSuggestion 
} from '../types';

interface DirectorState {
  isOpen: boolean;
  conversation: DirectorConversation | null;
  suggestions: QuickSuggestion[];
  isProcessing: boolean;
  error: string | null;
}

type DirectorAction =
  | { type: 'OPEN'; conversation: DirectorConversation; suggestions: QuickSuggestion[] }
  | { type: 'CLOSE' }
  | { type: 'SET_PROCESSING'; isProcessing: boolean }
  | { type: 'UPDATE_CONVERSATION'; conversation: DirectorConversation; suggestions: QuickSuggestion[] }
  | { type: 'SET_ERROR'; error: string | null };

const reducer = (state: DirectorState, action: DirectorAction): DirectorState => {
  switch (action.type) {
    case 'OPEN':
      return { 
        ...state, 
        isOpen: true, 
        conversation: action.conversation,
        suggestions: action.suggestions,
        error: null 
      };
    case 'CLOSE':
      return { 
        ...state, 
        isOpen: false, 
        conversation: null, 
        suggestions: [],
        error: null 
      };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.isProcessing };
    case 'UPDATE_CONVERSATION':
      return { 
        ...state, 
        conversation: action.conversation,
        suggestions: action.suggestions,
        isProcessing: false 
      };
    case 'SET_ERROR':
      return { ...state, error: action.error, isProcessing: false };
    default:
      return state;
  }
};

interface DirectorContextValue extends DirectorState {
  openDirector: (prompt: string, videoId?: string) => Promise<void>;
  closeDirector: () => void;
  sendDirection: (input: string) => Promise<void>;
  applySuggestion: (suggestion: QuickSuggestion) => Promise<void>;
  applyAndRegenerate: (modelId?: string) => Promise<{ videoId: string }>;
  undo: () => Promise<void>;
}

const DirectorContext = createContext<DirectorContextValue | null>(null);

export function DirectorModeProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    isOpen: false,
    conversation: null,
    suggestions: [],
    isProcessing: false,
    error: null,
  });

  const openDirector = useCallback(async (prompt: string, videoId?: string) => {
    try {
      const { conversation, suggestions } = await directorApi.startSession({ 
        prompt, 
        videoId 
      });
      dispatch({ type: 'OPEN', conversation, suggestions });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to start director mode' });
    }
  }, []);

  const closeDirector = useCallback(() => {
    if (state.conversation) {
      directorApi.cancelSession(state.conversation.id);
    }
    dispatch({ type: 'CLOSE' });
  }, [state.conversation]);

  const sendDirection = useCallback(async (input: string) => {
    if (!state.conversation) return;
    
    dispatch({ type: 'SET_PROCESSING', isProcessing: true });
    
    try {
      const result = await directorApi.processDirection(state.conversation.id, input);
      
      // Update conversation with new turn and preview
      const updatedConversation = await directorApi.getConversation(state.conversation.id);
      
      dispatch({ 
        type: 'UPDATE_CONVERSATION', 
        conversation: updatedConversation,
        suggestions: result.suggestions 
      });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to process direction' });
    }
  }, [state.conversation]);

  const applySuggestion = useCallback(async (suggestion: QuickSuggestion) => {
    await sendDirection(suggestion.intent);
  }, [sendDirection]);

  const applyAndRegenerate = useCallback(async (modelId?: string) => {
    if (!state.conversation) throw new Error('No active conversation');
    
    dispatch({ type: 'SET_PROCESSING', isProcessing: true });
    
    try {
      const result = await directorApi.applyAndRegenerate(
        state.conversation.id, 
        modelId
      );
      dispatch({ type: 'CLOSE' });
      return result;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to regenerate' });
      throw error;
    }
  }, [state.conversation]);

  const undo = useCallback(async () => {
    if (!state.conversation) return;
    
    dispatch({ type: 'SET_PROCESSING', isProcessing: true });
    
    try {
      await directorApi.undo(state.conversation.id);
      const updatedConversation = await directorApi.getConversation(state.conversation.id);
      
      dispatch({ 
        type: 'UPDATE_CONVERSATION', 
        conversation: updatedConversation,
        suggestions: state.suggestions // Keep existing suggestions
      });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to undo' });
    }
  }, [state.conversation, state.suggestions]);

  return (
    <DirectorContext.Provider
      value={{
        ...state,
        openDirector,
        closeDirector,
        sendDirection,
        applySuggestion,
        applyAndRegenerate,
        undo,
      }}
    >
      {children}
    </DirectorContext.Provider>
  );
}

export function useDirectorMode() {
  const context = useContext(DirectorContext);
  if (!context) {
    throw new Error('useDirectorMode must be used within DirectorModeProvider');
  }
  return context;
}
```

### Main Component

```typescript
// client/src/features/director/components/DirectorMode/DirectorMode.tsx

import React, { useState, useRef, useEffect } from 'react';
import { useDirectorMode } from '../../context/DirectorModeContext';
import { DirectorChat } from './DirectorChat';
import { ModificationPreview } from '../ModificationPreview';
import { QuickSuggestions } from '../QuickSuggestions';
import { X, Undo, Check } from 'lucide-react';

export function DirectorMode() {
  const {
    isOpen,
    conversation,
    suggestions,
    isProcessing,
    error,
    closeDirector,
    sendDirection,
    applySuggestion,
    applyAndRegenerate,
    undo,
  } = useDirectorMode();

  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen || !conversation) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    
    const direction = input;
    setInput('');
    await sendDirection(direction);
  };

  const handleApply = async () => {
    try {
      const { videoId } = await applyAndRegenerate();
      // Handle successful regeneration (e.g., navigate to video)
    } catch (error) {
      // Error handled in context
    }
  };

  const hasChanges = conversation.previewChanges.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-zinc-900 rounded-xl 
                      shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <h2 className="text-lg font-semibold text-white">Director Mode</h2>
          </div>
          <button 
            onClick={closeDirector}
            className="p-1 text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-4">
          <DirectorChat turns={conversation.turns} isProcessing={isProcessing} />
        </div>

        {/* Modification preview */}
        {hasChanges && (
          <div className="border-t border-zinc-700 p-4 bg-zinc-800/50">
            <ModificationPreview
              originalPrompt={conversation.originalPrompt}
              modifiedPrompt={conversation.previewPrompt}
              changes={conversation.previewChanges}
            />
          </div>
        )}

        {/* Quick suggestions */}
        {suggestions.length > 0 && (
          <div className="px-4 py-2 border-t border-zinc-700">
            <QuickSuggestions 
              suggestions={suggestions} 
              onSelect={applySuggestion}
              disabled={isProcessing}
            />
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-zinc-700 p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What would you like to change?"
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg
                       text-white placeholder:text-zinc-500 focus:outline-none 
                       focus:border-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </form>
        </div>

        {/* Action bar */}
        {hasChanges && (
          <div className="flex items-center justify-between px-4 py-3 border-t 
                         border-zinc-700 bg-zinc-800">
            <button
              onClick={undo}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-zinc-400 
                       hover:text-white transition-colors disabled:opacity-50"
            >
              <Undo size={16} />
              Undo
            </button>
            <div className="flex gap-2">
              <button
                onClick={closeDirector}
                className="px-4 py-2 text-zinc-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white 
                         rounded-lg hover:bg-green-500 disabled:opacity-50 
                         disabled:cursor-not-allowed transition-colors"
              >
                <Check size={16} />
                Apply & Regenerate
              </button>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Integration: Director Button

Add to existing generation view:

```typescript
// client/src/features/director/components/DirectorButton/DirectorButton.tsx

import React from 'react';
import { useDirectorMode } from '../../context/DirectorModeContext';
import { Wand2 } from 'lucide-react';

interface DirectorButtonProps {
  prompt: string;
  videoId?: string;
  className?: string;
}

export function DirectorButton({ prompt, videoId, className = '' }: DirectorButtonProps) {
  const { openDirector } = useDirectorMode();

  return (
    <button
      onClick={() => openDirector(prompt, videoId)}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 
                 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors
                 ${className}`}
    >
      <Wand2 size={16} />
      Refine with Director
    </button>
  );
}
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Director mode activation | > 15% of generations | Track opens from generation view |
| Avg turns per session | > 2 | Track conversation lengths |
| Apply rate | > 50% of sessions | Track apply vs cancel |
| Re-generation reduction | -20% | Compare before/after director mode |
| Intent parsing accuracy | > 85% | Sample and evaluate |

---

## Effort Breakdown

| Task | Estimate | Dependencies |
|------|----------|--------------|
| IntentParserService (rule-based + LLM) | 3 days | LLM service |
| PromptModifierService | 3 days | Span labeling |
| QuickSuggestionsService | 1 day | Taxonomy |
| DirectorService orchestrator | 2 days | All above |
| API endpoints | 1 day | Services |
| Client: Context provider | 2 days | API |
| Client: DirectorMode component | 3 days | Context |
| Client: ModificationPreview | 2 days | Context |
| Client: QuickSuggestions | 1 day | Context |
| Integration + testing | 3 days | All above |
| **Total** | **~3.5 weeks** | |

---

## Open Questions

1. **Intent ambiguity**: How to handle "make it better" with no specific direction?

2. **Magnitude calibration**: Does "a bit" translate consistently across categories?

3. **Multi-turn memory**: How much context to retain across a long conversation?

4. **Conflict resolution**: What if user asks for conflicting changes?

5. **Preview before regenerate**: Should we show a Wan preview of modifications before final gen?

---

## Next Steps

1. [ ] Implement IntentParserService with rule-based patterns
2. [ ] Add LLM fallback for complex intents
3. [ ] Build PromptModifierService with span awareness
4. [ ] Create QuickSuggestionsService
5. [ ] Build DirectorService orchestrator
6. [ ] Create API endpoints
7. [ ] Build React context and components
8. [ ] Add Director button to generation view
9. [ ] Test with various prompts and directions
10. [ ] Tune intent parsing accuracy
