import type { VideoPromptIR } from '../../types';

/**
 * Service responsible for analyzing raw text and extracting structured VideoPromptIR
 * Consolidates regex patterns and logic from various strategies into a single source of truth.
 */
export class VideoPromptAnalyzer {
  
  /**
   * Analyze raw text and produce a structured Intermediate Representation (IR)
   * 
   * @param text - The raw user input
   * @returns Structured VideoPromptIR
   */
  analyze(text: string): VideoPromptIR {
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
      raw: text,
    };

    const cleanText = this.cleanText(text);

    // Extraction Pipeline
    this.extractCamera(cleanText, ir);
    this.extractEnvironment(cleanText, ir); // Setting, lighting, weather
    this.extractSubjectsAndActions(cleanText, ir); // Subjects and their actions
    this.extractAudio(cleanText, ir);
    this.extractMeta(cleanText, ir); // Mood, style, temporal

    // Enrichment (Basic inference)
    this.enrichIR(ir);

    return ir;
  }

  private cleanText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  // ============================================================ 
  // Extraction Logic
  // ============================================================ 

  private extractCamera(text: string, ir: VideoPromptIR): void {
    const lowerText = text.toLowerCase();

    // Shot Types
    const shotTypes: Record<string, string> = {
      'wide shot': 'wide shot', 'long shot': 'long shot', 'full shot': 'full shot',
      'medium shot': 'medium shot', 'close up': 'close-up', 'extreme close up': 'extreme close-up',
      'macro': 'macro shot', 'establishing shot': 'establishing shot', 'two shot': 'two shot',
      'cowboy shot': 'cowboy shot', 'over the shoulder': 'over-the-shoulder', 'pov': 'POV'
    };

    for (const [key, value] of Object.entries(shotTypes)) {
      if (lowerText.includes(key)) {
        ir.camera.shotType = value;
        break; // Assume one primary shot type
      }
    }

    // Camera Angles
    const angles: Record<string, string> = {
      'low angle': 'low angle', 'high angle': 'high angle', 'overhead': 'overhead',
      'bird\'s eye': 'bird\'s eye view', 'worm\'s eye': 'worm\'s eye view',
      'dutch angle': 'dutch angle', 'eye level': 'eye level'
    };

    for (const [key, value] of Object.entries(angles)) {
      if (lowerText.includes(key)) {
        ir.camera.angle = value;
        break;
      }
    }

    // Camera Movements
    const movements: Record<string, string> = {
      'pan': 'pan', 'tilt': 'tilt', 'dolly': 'dolly', 'zoom': 'zoom',
      'truck': 'truck', 'crane': 'crane', 'handheld': 'handheld', 'steadicam': 'steadicam',
      'tracking': 'tracking', 'follow': 'follow', 'push in': 'push in', 'pull out': 'pull out',
      'orbit': 'orbit', 'arc': 'arc'
    };

    for (const [key, value] of Object.entries(movements)) {
      // Check for whole words to avoid matching "pan" in "company"
      if (new RegExp(`\b${key}\b`, 'i').test(lowerText)) {
        ir.camera.movements.push(value);
      }
    }
  }

  private extractEnvironment(text: string, ir: VideoPromptIR): void {
    const lowerText = text.toLowerCase();

    // Lighting
    const lightingTerms = [
      'natural light', 'sunlight', 'daylight', 'moonlight', 'neon', 'cinematic lighting',
      'studio lighting', 'soft lighting', 'hard lighting', 'volumetric', 'rim light',
      'backlit', 'golden hour', 'blue hour', 'low key', 'high key', 'chiaroscuro'
    ];

    for (const term of lightingTerms) {
      if (lowerText.includes(term)) {
        ir.environment.lighting.push(term);
      }
    }

    // Weather
    const weatherTerms = [
      'sunny', 'cloudy', 'rainy', 'snowing', 'stormy', 'foggy', 'misty', 'windy', 'hazy'
    ];

    for (const term of weatherTerms) {
      if (new RegExp(`\b${term}\b`, 'i').test(lowerText)) {
        ir.environment.weather = term;
        break;
      }
    }

    // Setting (Heuristic: "in [location]", "at [location]")
    // This is hard to perfect with regex, but we can catch common patterns.
    const settingPattern = /\b(?:in|at|on|inside|outside)\s+(?:a|an|the)?\s*([a-z]+(?:\s+[a-z]+){0,3})\b/i;
    const match = text.match(settingPattern);
    if (match && match[1]) {
      // Filter out non-settings like "in the morning", "at night" (temporal)
      const nonSettings = ['morning', 'afternoon', 'evening', 'night', 'day', 'sunrise', 'sunset'];
      if (!nonSettings.includes(match[1].toLowerCase())) {
        ir.environment.setting = match[1].trim();
      }
    }
  }

  private extractSubjectsAndActions(text: string, ir: VideoPromptIR): void {
    // Subject Extraction
    // Look for noun phrases that are likely subjects
    // "A [adjective] [noun] [verb]"
    
    // Simplistic subject finder: look for "a/an/the [words] is/are/walking/etc"
    // or just capture the first likely noun phrase
    
    const subjectIndicators = ['man', 'woman', 'person', 'child', 'dog', 'cat', 'car', 'robot', 'creature', 'character'];
    const subjectsFound: Set<string> = new Set();

    // Check for specific common subjects
    for (const indicator of subjectIndicators) {
      const regex = new RegExp(`\b(?:a|an|the)?\s*(\w+\s+)?${indicator}\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        subjectsFound.add(match[0].trim());
      }
    }
    
    // If explicit common subjects found, use them
    if (subjectsFound.size > 0) {
      for (const subj of subjectsFound) {
         ir.subjects.push({ text: subj, attributes: [] });
      }
    } else {
      // Fallback: Try to grab the start of the prompt if it looks like a subject
      // e.g. "Futuristic city with..."
      const startMatch = text.match(/^([a-z]+(?:\s+[a-z]+){0,2})/i);
      if (startMatch && startMatch[1] && !this.isCameraOrStyle(startMatch[1])) {
         ir.subjects.push({ text: startMatch[1], attributes: [] });
      }
    }

    // Attributes (Adjectives attached to subjects or general style)
    // This is hard to link to specific subjects with regex, so we'll do general attribute extraction if needed later.
    // For now, we rely on the synthesis step to place adjectives correctly if they were part of the subject string.

    // Action Extraction
    // Look for gerunds (-ing words)
    const actionRegex = /\b(\w+ing)\b/gi;
    let actionMatch;
    const ignoredIngs = ['lighting', 'setting', 'morning', 'evening', 'amazing', 'interesting', 'building'];
    
    while ((actionMatch = actionRegex.exec(text)) !== null) {
      const word = actionMatch[1].toLowerCase();
      if (!ignoredIngs.includes(word)) {
        ir.actions.push(word);
      }
    }
  }

  private extractAudio(text: string, ir: VideoPromptIR): void {
    const lowerText = text.toLowerCase();

    // Dialogue
    const dialoguePatterns = [
      /["']([^"']+)["']/g,
      /says?\s+["']([^"']+)["']/gi,
      /speaking\s+["']([^"']+)["']/gi,
    ];

    for (const pattern of dialoguePatterns) {
      const match = text.match(pattern);
      if (match) {
        // Extract content from quotes if present
        const content = match[0].match(/["']([^"']+)["']/);
        if (content && content[1]) {
          ir.audio.dialogue = content[1];
          break; // Assume one main dialogue line for now
        }
      }
    }

    // Music
    const musicPatterns = [
      /(?:music|soundtrack|score)[:\s]+([^.!?,]+)/i,
      /(?:playing|with)\s+(\w+\s+music)/i,
      /(\w+\s+(?:music|melody|tune))/i,
    ];

    for (const pattern of musicPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        ir.audio.music = match[1].trim();
        break;
      }
    }

    // SFX / Ambience
    const sfxPatterns = [
      /(?:ambient|ambience|background)\s*(?:sound|noise|audio)?[:\s]+([^.!?,]+)/i,
      /(?:sounds?\s+of|hearing)\s+([^.!?,]+)/i,
    ];

    for (const pattern of sfxPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        ir.audio.sfx = match[1].trim();
        break;
      }
    }
  }

  private extractMeta(text: string, ir: VideoPromptIR): void {
    const lowerText = text.toLowerCase();

    // Styles
    const styles = [
      'cinematic', 'photorealistic', 'anime', 'cartoon', 'oil painting', 'sketch',
      'cyberpunk', 'steampunk', 'noir', 'vintage', 'retro', 'minimalist', 'abstract',
      'surreal', 'fantasy', 'sci-fi', 'documentary', '3d render', 'unreal engine'
    ];

    for (const style of styles) {
      if (lowerText.includes(style)) {
        ir.meta.style.push(style);
      }
    }

    // Moods
    const moods = [
      'happy', 'sad', 'angry', 'scary', 'tense', 'peaceful', 'calm', 'energetic',
      'melancholic', 'romantic', 'mysterious', 'dreamy', 'dark', 'gloomy', 'bright'
    ];

    for (const mood of moods) {
      if (lowerText.includes(mood)) {
        ir.meta.mood.push(mood);
      }
    }
    
    // Temporal
    const temporalTerms = ['then', 'after', 'before', 'later', 'suddenly', 'meanwhile'];
    const temporalFound: string[] = [];
    for (const term of temporalTerms) {
        if (new RegExp(`\b${term}\b`, 'i').test(lowerText)) {
            temporalFound.push(term);
        }
    }
    if (temporalFound.length > 0) {
        ir.meta.temporal = temporalFound;
    }
  }

  private isCameraOrStyle(text: string): boolean {
    const lower = text.toLowerCase();
    return lower.includes('shot') || lower.includes('view') || lower.includes('angle') || 
           lower.includes('style') || lower.includes('render');
  }

  // ============================================================ 
  // Enrichment Logic (Inference)
  // ============================================================ 

  private enrichIR(ir: VideoPromptIR): void {
    // 1. Infer Lighting from Style/Mood
    if (ir.environment.lighting.length === 0) {
      if (ir.meta.style.includes('cyberpunk') || ir.meta.style.includes('sci-fi')) {
        ir.environment.lighting.push('neon lighting');
      } else if (ir.meta.style.includes('noir') || ir.meta.mood.includes('mysterious')) {
        ir.environment.lighting.push('low key lighting');
        ir.environment.lighting.push('shadows');
      } else if (ir.meta.mood.includes('happy') || ir.environment.weather === 'sunny') {
        ir.environment.lighting.push('bright sunlight');
      } else if (ir.meta.style.includes('cinematic')) {
        ir.environment.lighting.push('dramatic lighting');
      }
    }

    // 2. Infer Camera from Action
    if (ir.camera.movements.length === 0) {
      if (ir.actions.includes('running') || ir.actions.includes('chasing')) {
        ir.camera.movements.push('tracking shot'); // or "dolly"
      } else if (ir.actions.includes('flying')) {
        ir.camera.movements.push('aerial view'); // strictly an angle/shot type but fits here for movement implication
      }
    }
    
    // 3. Infer Setting if missing
    if (!ir.environment.setting) {
        if (ir.meta.style.includes('cyberpunk')) {
            ir.environment.setting = 'futuristic city street';
        } else if (ir.meta.style.includes('fantasy')) {
            ir.environment.setting = 'magical forest';
        }
    }
  }
}
