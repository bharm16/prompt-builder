import nlp from 'compromise';
import { extractSemanticSpans } from '../../../../llm/span-labeling/nlp/NlpSpanService';
import type { VideoPromptIR } from '../../types';

/**
 * Service responsible for analyzing raw text and extracting structured VideoPromptIR
 * Uses a hybrid approach:
 * 1. Deterministic structural parsing (Narrative vs Specs)
 * 2. Semantic Entity Extraction (GLiNER) for high-fidelity role detection
 */
export class VideoPromptAnalyzer {
  
  /**
   * Analyze raw text and produce a structured Intermediate Representation (IR)
   * 
   * @param text - The raw user input
   * @returns Structured VideoPromptIR
   */
  async analyze(text: string): Promise<VideoPromptIR> {
    const ir: VideoPromptIR = {
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
      raw: text,
    };

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

    // Match common markdown headers or bold capitalized labels
    const specsMatch = text.match(/\n?\s*(?:\*\*|##)\s*(?:TECHNICAL SPECS|Technical Specs)\s*(?:\*\*|:)?/i);
    const altsMatch = text.match(/\n?\s*(?:\*\*|##)\s*(?:ALTERNATIVE APPROACHES|Alternative Approaches)\s*(?:\*\*|:)?/i);

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
      const specsSection = this.extractSectionText(text, specsMatch[0]);
      if (specsSection) {
        sections.technical = this.parseTechnicalSpecs(specsSection);
      }
    }

    return sections;
  }

  private extractSectionText(fullText: string, header: string): string | null {
    const start = fullText.indexOf(header);
    if (start === -1) return null;

    const contentStart = start + header.length;
    const nextHeaderMatch = fullText.substring(contentStart).match(/\n\s*(\*\*|##)/);
    
    if (nextHeaderMatch && nextHeaderMatch.index !== undefined) {
      return fullText.substring(contentStart, contentStart + nextHeaderMatch.index).trim();
    }
    
    return fullText.substring(contentStart).trim();
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
