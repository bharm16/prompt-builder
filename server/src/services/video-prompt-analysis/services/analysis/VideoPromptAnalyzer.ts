import nlp from 'compromise';
import { extractSemanticSpans } from '../../../../llm/span-labeling/nlp/NlpSpanService';
import { GeminiAdapter } from '../../../../clients/adapters/GeminiAdapter';
import type { VideoPromptIR } from '../../types';

interface LlmIrResult {
  narrative: string;
  subjects?: string[];
  actions?: string[];
  camera?: {
    shotType?: string;
    angle?: string;
    movements?: string[];
  };
  environment?: {
    setting?: string;
    lighting?: string[];
    weather?: string;
  };
  audio?: {
    dialogue?: string;
    music?: string;
    sfx?: string;
    ambience?: string;
  };
  meta?: {
    mood?: string[];
    style?: string[];
  };
  technical?: Record<string, string>;
}

const TECHNICAL_HEADER_LABELS = [
  'technical specs',
  'technical specifications',
  'technical details',
  'tech specs',
  'specifications',
  'technical',
  'parameters',
] as const;

const ALTERNATIVE_HEADER_LABELS = [
  'alternative approaches',
  'alternatives',
  'variations',
  'alt approaches',
] as const;

/**
 * Service responsible for analyzing raw text and extracting structured VideoPromptIR
 * Uses a hybrid approach:
 * 1. Deterministic structural parsing (Narrative vs Specs)
 * 2. Semantic Entity Extraction (GLiNER) for high-fidelity role detection
 */
export class VideoPromptAnalyzer {
  private adapter: GeminiAdapter | null = null;
  
  /**
   * Analyze raw text and produce a structured Intermediate Representation (IR)
   * 
   * @param text - The raw user input
   * @returns Structured VideoPromptIR
   */
  async analyze(text: string): Promise<VideoPromptIR> {
    const llmParsed = await this.tryAnalyzeWithLLM(text);
    if (llmParsed) {
      const cleanNarrative = this.cleanText(llmParsed.raw);
      try {
        const extractionResult = await extractSemanticSpans(cleanNarrative, { useGliner: true });
        this.mapSpansToIR(extractionResult.spans, llmParsed);
      } catch (error) {
        if (this.isIrSparse(llmParsed)) {
          this.extractBasicHeuristics(cleanNarrative, llmParsed);
        }
      }
      if (llmParsed.technical && Object.keys(llmParsed.technical).length > 0) {
        this.enrichFromTechnicalSpecs(llmParsed.technical, llmParsed);
      }
      this.enrichIR(llmParsed);
      return llmParsed;
    }

    const ir = this.createEmptyIR(text);

    // 1. Structural Parsing (Markdown headers / JSON)
    const sections = this.parseInputStructure(text);
    ir.raw = sections.narrative;
    const cleanNarrative = this.cleanText(sections.narrative);

    // 2. Semantic Extraction (Tier 2 NLP: GLiNER)
    // We use the existing high-fidelity NLP service to detect roles semantically
    try {
      // Use the project's established ML pipeline for open-vocabulary extraction
      const extractionResult = await extractSemanticSpans(cleanNarrative, { useGliner: true });
      this.mapSpansToIR(extractionResult.spans, ir);
    } catch (error) {
      // Fallback to basic heuristics if the ML service is unavailable
      this.extractBasicHeuristics(cleanNarrative, ir);
    }

    // 3. Structured Enrichment (From Technical Specs)
    if (sections.technical) {
      ir.technical = sections.technical;
      this.enrichFromTechnicalSpecs(sections.technical, ir);
    }

    // 4. Basic Inference Enrichment
    this.enrichIR(ir);

    return ir;
  }

  private createEmptyIR(raw: string): VideoPromptIR {
    return {
      subjects: [],
      actions: [],
      camera: {
        movements: [],
      },
      environment: {
        setting: '',
        lighting: [],
      },
      audio: {},
      meta: {
        mood: [],
        style: [],
      },
      technical: {},
      raw,
    };
  }

  private getAdapter(): GeminiAdapter {
    if (!this.adapter) {
      this.adapter = new GeminiAdapter({
        apiKey: process.env.GEMINI_API_KEY || '',
        defaultModel: 'gemini-2.5-flash',
      });
    }
    return this.adapter;
  }

  private async tryAnalyzeWithLLM(text: string): Promise<VideoPromptIR | null> {
    try {
      const adapter = this.getAdapter();
      const response = (await adapter.generateStructuredOutput(
        this.buildLlmPrompt(text),
        this.getIrSchema()
      )) as LlmIrResult;

      if (!response || typeof response.narrative !== 'string' || response.narrative.trim().length === 0) {
        return null;
      }

      return this.buildIrFromLlm(response, text);
    } catch {
      return null;
    }
  }

  private buildIrFromLlm(parsed: LlmIrResult, raw: string): VideoPromptIR {
    const ir = this.createEmptyIR(raw);

    ir.raw = parsed.narrative.trim();

    if (Array.isArray(parsed.subjects)) {
      ir.subjects = parsed.subjects
        .map((text) => text?.trim())
        .filter((text): text is string => Boolean(text))
        .map((text) => ({ text, attributes: [] }));
    }

    if (Array.isArray(parsed.actions)) {
      ir.actions = parsed.actions
        .map((action) => action?.trim())
        .filter((action): action is string => Boolean(action))
        .map((action) => action.toLowerCase());
    }

    if (parsed.camera) {
      if (Array.isArray(parsed.camera.movements)) {
        ir.camera.movements = parsed.camera.movements
          .map((movement) => movement?.trim())
          .filter((movement): movement is string => Boolean(movement))
          .map((movement) => movement.toLowerCase());
      }
      if (parsed.camera.shotType) {
        ir.camera.shotType = parsed.camera.shotType.trim().toLowerCase();
      }
      if (parsed.camera.angle) {
        ir.camera.angle = parsed.camera.angle.trim().toLowerCase();
      }
    }

    if (parsed.environment) {
      if (parsed.environment.setting) {
        ir.environment.setting = parsed.environment.setting.trim();
      }
      if (Array.isArray(parsed.environment.lighting)) {
        ir.environment.lighting = parsed.environment.lighting
          .map((lighting) => lighting?.trim())
          .filter((lighting): lighting is string => Boolean(lighting))
          .map((lighting) => lighting.toLowerCase());
      }
      if (parsed.environment.weather) {
        ir.environment.weather = parsed.environment.weather.trim().toLowerCase();
      }
    }

    if (parsed.audio) {
      if (parsed.audio.dialogue) ir.audio.dialogue = parsed.audio.dialogue.trim();
      if (parsed.audio.music) ir.audio.music = parsed.audio.music.trim();
      if (parsed.audio.sfx) ir.audio.sfx = parsed.audio.sfx.trim();
    }

    if (parsed.meta) {
      if (Array.isArray(parsed.meta.mood)) {
        ir.meta.mood = parsed.meta.mood
          .map((mood) => mood?.trim())
          .filter((mood): mood is string => Boolean(mood))
          .map((mood) => mood.toLowerCase());
      }
      if (Array.isArray(parsed.meta.style)) {
        ir.meta.style = parsed.meta.style
          .map((style) => style?.trim())
          .filter((style): style is string => Boolean(style))
          .map((style) => style.toLowerCase());
      }
    }

    if (parsed.technical && typeof parsed.technical === 'object') {
      ir.technical = parsed.technical;
    }

    return ir;
  }

  private buildLlmPrompt(text: string): string {
    return `Extract a structured video prompt IR from the input text.

Rules:
- narrative: main visual description only (exclude section headers or bullet labels).
- subjects: primary subjects as noun phrases.
- actions: key verbs describing motion.
- camera.movements: list of movements (e.g., "dolly in", "pan left").
- camera.shotType: shot framing if stated (e.g., "wide shot").
- camera.angle: angle if stated (e.g., "low angle").
- environment.setting, lighting, weather: scene setting and lighting cues.
- meta.style and meta.mood: style/mood keywords if present.
- audio.dialogue/music/sfx: only if clearly specified.
- technical: key-value specs (duration, aspect ratio, frame rate, resolution, etc).

Input:
"""
${text}
"""

Return ONLY the JSON object.`;
  }

  private getIrSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        narrative: { type: 'string' },
        subjects: { type: 'array', items: { type: 'string' } },
        actions: { type: 'array', items: { type: 'string' } },
        camera: {
          type: 'object',
          properties: {
            shotType: { type: 'string' },
            angle: { type: 'string' },
            movements: { type: 'array', items: { type: 'string' } },
          },
        },
        environment: {
          type: 'object',
          properties: {
            setting: { type: 'string' },
            lighting: { type: 'array', items: { type: 'string' } },
            weather: { type: 'string' },
          },
        },
        audio: {
          type: 'object',
          properties: {
            dialogue: { type: 'string' },
            music: { type: 'string' },
            sfx: { type: 'string' },
            ambience: { type: 'string' },
          },
        },
        meta: {
          type: 'object',
          properties: {
            mood: { type: 'array', items: { type: 'string' } },
            style: { type: 'array', items: { type: 'string' } },
          },
        },
        technical: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['narrative'],
    };
  }

  private isIrSparse(ir: VideoPromptIR): boolean {
    return (
      ir.subjects.length === 0 &&
      ir.actions.length === 0 &&
      ir.camera.movements.length === 0 &&
      !ir.camera.angle &&
      !ir.camera.shotType &&
      !ir.environment.setting &&
      ir.environment.lighting.length === 0 &&
      !ir.environment.weather &&
      ir.meta.mood.length === 0 &&
      ir.meta.style.length === 0
    );
  }

  /**
   * Map semantic spans from GLiNER/Aho-Corasick to IR fields
   */
  private mapSpansToIR(spans: any[], ir: VideoPromptIR): void {
    for (const span of spans) {
      const category = span.category || '';
      const text = span.text?.trim();
      if (!text) continue;

      const lowerText = text.toLowerCase();

      // Subject Mapping
      if (category.startsWith('subject.')) {
        if (!ir.subjects.some(s => s.text.toLowerCase() === lowerText)) {
          ir.subjects.push({ text, attributes: [] });
        }
      } 
      // Action Mapping
      else if (category.startsWith('action.')) {
        if (!ir.actions.includes(lowerText)) {
          ir.actions.push(lowerText);
        }
      } 
      // Camera Mapping
      else if (category.startsWith('camera.') || category.startsWith('shot.')) {
        if (category === 'camera.movement') {
          if (!ir.camera.movements.includes(lowerText)) {
            ir.camera.movements.push(lowerText);
          }
        } else if (category === 'camera.angle') {
          ir.camera.angle = lowerText;
        } else if (category === 'shot.type') {
          ir.camera.shotType = lowerText;
        }
      } 
      // Environment Mapping
      else if (category.startsWith('environment.')) {
        if (category === 'environment.location') {
          ir.environment.setting = text;
        } else if (category === 'environment.weather') {
          ir.environment.weather = lowerText;
        }
      } 
      // Lighting Mapping
      else if (category.startsWith('lighting.')) {
        if (!ir.environment.lighting.includes(lowerText)) {
          ir.environment.lighting.push(lowerText);
        }
      } 
      // Style Mapping
      else if (category.startsWith('style.')) {
        if (!ir.meta.style.includes(lowerText)) {
          ir.meta.style.push(lowerText);
        }
      } 
      // Audio Mapping
      else if (category.startsWith('audio.')) {
        if (category === 'audio.score') ir.audio.music = text;
        else if (category === 'audio.soundEffect') ir.audio.sfx = text;
      }
    }
  }

  /**
   * Robust fallback using regex and compromise for full IR extraction
   * Now non-destructive: analyzes text without stripping/mangling it
   */
  private extractBasicHeuristics(text: string, ir: VideoPromptIR): void {
    const lowerText = text.toLowerCase();
    
    // 1. Camera Extraction (Movements first, longest first)
    const movements: Record<string, string> = {
      'tracking shot': 'tracking shot', 'crane shot': 'crane shot',
      'pan left': 'pan left', 'pan right': 'pan right',
      'tilt up': 'tilt up', 'tilt down': 'tilt down',
      'zoom in': 'zoom in', 'zoom out': 'zoom out',
      'dolly in': 'dolly in', 'dolly out': 'dolly out',
      'truck left': 'truck left', 'truck right': 'truck right',
      'pan': 'pan', 'tilt': 'tilt', 'dolly': 'dolly', 'zoom': 'zoom',
      'truck': 'truck', 'crane': 'crane', 'tracking': 'tracking', 'steadicam': 'steadicam',
      'handheld': 'handheld', 'follow': 'follow', 'push in': 'push in', 'pull out': 'pull out'
    };
    
    const sortedMovementKeys = Object.keys(movements).sort((a, b) => b.length - a.length);
    for (const key of sortedMovementKeys) {
        if (lowerText.includes(key)) {
            const val = movements[key]!;
            if (!ir.camera.movements.includes(val)) ir.camera.movements.push(val);
        }
    }

    const shotTypes: Record<string, string> = {
      'extreme close up': 'extreme close-up', 'close up': 'close-up', 
      'wide shot': 'wide shot', 'long shot': 'long shot', 'full shot': 'full shot',
      'medium shot': 'medium shot', 'establishing shot': 'establishing shot', 
      'two shot': 'two shot', 'cowboy shot': 'cowboy shot', 'pov shot': 'POV', 'pov': 'POV'
    };
    const sortedShotKeys = Object.keys(shotTypes).sort((a, b) => b.length - a.length);
    for (const key of sortedShotKeys) {
        if (lowerText.includes(key)) {
            const val = shotTypes[key];
            if (val) ir.camera.shotType = val;
            break;
        }
    }

    const angles: Record<string, string> = {
      'bird\'s eye view': 'bird\'s eye view', 'bird\'s eye': 'bird\'s eye view',
      'worm\'s eye view': 'worm\'s eye view', 'worm\'s eye': 'worm\'s eye view',
      'low angle': 'low angle', 'high angle': 'high angle', 'overhead': 'overhead',
      'dutch angle': 'dutch angle', 'eye level': 'eye level', 'wide angle': 'wide angle',
      'telephoto': 'telephoto'
    };
    const sortedAngleKeys = Object.keys(angles).sort((a, b) => b.length - a.length);
    for (const key of sortedAngleKeys) {
        if (lowerText.includes(key)) {
            const val = angles[key];
            if (val) ir.camera.angle = val;
            break;
        }
    }

    // 2. Environment Extraction
    const lightingTerms = ['natural light', 'sunlight', 'daylight', 'moonlight', 'neon', 'cinematic lighting', 'golden hour', 'blue hour'];
    for (const term of lightingTerms.sort((a, b) => b.length - a.length)) {
        if (lowerText.includes(term)) {
            ir.environment.lighting.push(term);
        }
    }

    const weatherTerms = ['sunny', 'cloudy', 'rainy', 'snowing', 'snowy', 'stormy', 'foggy', 'misty', 'windy', 'hazy'];
    for (const term of weatherTerms) {
        if (new RegExp(`\\b${term}\\b`, 'i').test(lowerText)) {
            ir.environment.weather = term;
            break;
        }
    }

    const commonLocations = ['outside', 'inside', 'indoors', 'outdoors'];
    for (const loc of commonLocations) {
        if (new RegExp(`\\b${loc}\\b`, 'i').test(lowerText)) {
            ir.environment.setting = loc;
            break;
        }
    }

    const settingPattern = /\b(?:in|at|on|inside|outside)\s+(?:a|an|the)?\s*([a-z]+(?:\s+[a-z]+){0,2})\b/i;
    const match = lowerText.match(settingPattern);
    if (match && match[1]) {
      const val = match[1].trim();
      const nonSettings = ['morning', 'afternoon', 'evening', 'night', 'day', 'sunrise', 'sunset', 'is', 'was'];
      if (val.length > 2 && !nonSettings.includes(val)) {
        ir.environment.setting = val;
      }
    }

    // 3. Subject Extraction (Simple NLP detection)
    const commonSubjects = ['man', 'woman', 'person', 'child', 'dog', 'cat', 'someone', 'figure', 'character', 'protagonist', 'subject'];
    for (const s of commonSubjects) {
        const subjectPattern = new RegExp(`\\b(a|an|the)?\\s*${s}\\b`, 'i');
        if (subjectPattern.test(lowerText)) {
            if (!ir.subjects.some(existing => existing.text.toLowerCase() === s)) {
                ir.subjects.push({ text: s, attributes: [] });
            }
        }
    }

    // Fallback: Use NLP to find the main noun if no common subject found
    if (ir.subjects.length === 0) {
        const doc = nlp(text); // Use original case text for better NLP
        const firstNoun = doc.nouns().first().text('normal').toLowerCase();
        if (firstNoun && firstNoun.length > 2 && !this.isCameraOrStyle(firstNoun)) {
            ir.subjects.push({ text: firstNoun, attributes: [] });
        }
    }

    // 4. Action Extraction
    const commonActions = ['walking', 'running', 'jumping', 'sitting', 'standing', 'dancing', 'talking', 'looking', 'holding', 'reaching', 'falling', 'flying', 'swimming', 'driving', 'staring'];
    for (const a of commonActions) {
        if (new RegExp(`\\b${a}\\b`, 'i').test(lowerText)) {
            if (!ir.actions.includes(a)) ir.actions.push(a);
        }
    }

    if (ir.actions.length === 0) {
        const doc = nlp(text);
        const firstVerb = doc.verbs().filter(v => !v.has('#Auxiliary')).first().text('normal').toLowerCase();
        if (firstVerb && firstVerb.length > 2) ir.actions.push(firstVerb);
    }

    // 5. Style Extraction
    const styles = ['cinematic', 'photorealistic', 'anime', 'cartoon', 'noir', 'vintage', 'retro', 'cyberpunk', 'realism', 'surreal'];
    for (const style of styles) {
      if (lowerText.includes(style)) {
          if (!ir.meta.style.includes(style)) ir.meta.style.push(style);
      }
    }
  }

  private cleanText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  // ============================================================
  // Structural Parsing
  // ============================================================

  private parseInputStructure(text: string): { narrative: string; technical?: Record<string, string>; alternatives?: any[] } {
    if (text.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.narrative || parsed.description) {
          return {
            narrative: parsed.narrative || parsed.description,
            technical: parsed.technical,
            alternatives: parsed.alternatives
          };
        }
      } catch (e) {}
    }

    // Match common markdown headers or bold/plain labels
    const specsMatch = this.matchSectionHeader(text, [...TECHNICAL_HEADER_LABELS]);
    const altsMatch = this.matchSectionHeader(text, [...ALTERNATIVE_HEADER_LABELS]);

    let narrativeEndIndex = text.length;
    if (specsMatch && specsMatch.index !== undefined) {
      narrativeEndIndex = Math.min(narrativeEndIndex, specsMatch.index);
    }
    if (altsMatch && altsMatch.index !== undefined) {
      narrativeEndIndex = Math.min(narrativeEndIndex, altsMatch.index);
    }

    const sections: { narrative: string; technical?: Record<string, string>; alternatives?: any[] } = {
      narrative: text.substring(0, narrativeEndIndex).trim()
    };

    if (specsMatch) {
      const specsSection = this.extractSectionText(text, specsMatch);
      if (specsSection) {
        sections.technical = this.parseTechnicalSpecs(specsSection);
      }
    }

    return sections;
  }

  private extractSectionText(fullText: string, match: RegExpMatchArray | null): string | null {
    if (!match || match.index === undefined) return null;

    const contentStart = match.index + match[0].length;
    const nextHeaderIndex = this.findNextHeaderIndex(fullText, contentStart);
    return fullText.substring(contentStart, nextHeaderIndex).trim();
  }

  private matchSectionHeader(text: string, labels: readonly string[]): RegExpMatchArray | null {
    const pattern = this.getHeaderRegex(labels);
    return text.match(pattern);
  }

  private findNextHeaderIndex(fullText: string, startIndex: number): number {
    const allLabels = [...TECHNICAL_HEADER_LABELS, ...ALTERNATIVE_HEADER_LABELS];
    const remainder = fullText.substring(startIndex);
    const nextHeaderMatch = remainder.match(this.getHeaderRegex(allLabels));
    if (nextHeaderMatch && nextHeaderMatch.index !== undefined) {
      return startIndex + nextHeaderMatch.index;
    }
    return fullText.length;
  }

  private getHeaderRegex(labels: readonly string[]): RegExp {
    const escaped = labels.map((label) => this.escapeRegex(label));
    return new RegExp(
      `(?:^|\\n)\\s*(?:\\*\\*|##)?\\s*(?:${escaped.join('|')})\\s*(?:\\*\\*|:)?\\s*(?:\\n|$)`,
      'i'
    );
  }

  private parseTechnicalSpecs(specsText: string): Record<string, string> {
    const specs: Record<string, string> = {};
    const lines = specsText.split('\n');
    const regex = /[-*]\s*(.+?)\s*:\s*(.+)/;
    
    for (const line of lines) {
      const match = line.match(regex);
      if (match && match[1] && match[2]) {
        let key = match[1].replace(/\*\*/g, '').trim().toLowerCase();
        let value = match[2].trim();
        if (value.startsWith('**')) value = value.substring(2).trim();
        specs[key] = value;
      }
    }
    return specs;
  }

  private enrichFromTechnicalSpecs(technical: Record<string, string>, ir: VideoPromptIR): void {
    if (technical['camera']) {
      const val = technical['camera'].toLowerCase();
      if (!ir.camera.shotType) {
        if (val.includes('close-up')) ir.camera.shotType = 'close-up';
        else if (val.includes('wide')) ir.camera.shotType = 'wide shot';
      }
      if (!ir.camera.angle) {
        if (val.includes('high-angle')) ir.camera.angle = 'high angle';
        else if (val.includes('low-angle')) ir.camera.angle = 'low angle';
      }
    }

    if (technical['lighting']) {
      const val = technical['lighting'];
      if (ir.environment.lighting.length === 0) {
        ir.environment.lighting.push(val);
      }
    }

    if (technical['audio']) {
      const val = technical['audio'];
      if (val.toLowerCase().includes('music') || val.toLowerCase().includes('score')) {
         ir.audio.music = val;
      } else if (val.toLowerCase().includes('dialogue')) {
         ir.audio.dialogue = val;
      } else {
         ir.audio.sfx = val;
      }
    }

    if (technical['style']) {
      const val = technical['style'];
      if (!ir.meta.style.includes(val)) {
        ir.meta.style.push(val);
      }
    }
  }

  private isCameraOrStyle(text: string): boolean {
    const lower = text.toLowerCase();
    return lower.includes('shot') || lower.includes('view') || lower.includes('angle') || 
           lower.includes('style') || lower.includes('render');
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private enrichIR(ir: VideoPromptIR): void {
    if (ir.environment.lighting.length === 0) {
      if (ir.meta.style.includes('cyberpunk')) ir.environment.lighting.push('neon lighting');
      else if (ir.meta.style.includes('cinematic')) ir.environment.lighting.push('dramatic lighting');
    }

    if (ir.camera.movements.length === 0) {
      if (ir.actions.includes('running')) ir.camera.movements.push('tracking shot');
    }
  }
}
