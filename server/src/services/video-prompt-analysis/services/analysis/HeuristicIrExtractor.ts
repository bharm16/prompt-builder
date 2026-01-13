import nlp from 'compromise';
import type { VideoPromptIR } from '../../types';

/**
 * Robust fallback using regex and compromise for full IR extraction
 * Now non-destructive: analyzes text without stripping/mangling it
 */
export function extractBasicHeuristics(text: string, ir: VideoPromptIR): void {
  const lowerText = text.toLowerCase();

  // 1. Camera Extraction (Movements first, longest first)
  const movements: Record<string, string> = {
    'tracking shot': 'tracking shot',
    'crane shot': 'crane shot',
    'pan left': 'pan left',
    'pan right': 'pan right',
    'tilt up': 'tilt up',
    'tilt down': 'tilt down',
    'zoom in': 'zoom in',
    'zoom out': 'zoom out',
    'dolly in': 'dolly in',
    'dolly out': 'dolly out',
    'truck left': 'truck left',
    'truck right': 'truck right',
    'pan': 'pan',
    'tilt': 'tilt',
    'dolly': 'dolly',
    'zoom': 'zoom',
    'truck': 'truck',
    'crane': 'crane',
    'tracking': 'tracking',
    'steadicam': 'steadicam',
    'handheld': 'handheld',
    'follow': 'follow',
    'push in': 'push in',
    'pull out': 'pull out',
  };

  const sortedMovementKeys = Object.keys(movements).sort((a, b) => b.length - a.length);
  for (const key of sortedMovementKeys) {
    if (lowerText.includes(key)) {
      const val = movements[key];
      if (val && !ir.camera.movements.includes(val)) ir.camera.movements.push(val);
    }
  }

  const shotTypes: Record<string, string> = {
    'extreme close up': 'extreme close-up',
    'close up': 'close-up',
    'wide shot': 'wide shot',
    'long shot': 'long shot',
    'full shot': 'full shot',
    'medium shot': 'medium shot',
    'establishing shot': 'establishing shot',
    'two shot': 'two shot',
    'cowboy shot': 'cowboy shot',
    'pov shot': 'POV',
    'pov': 'POV',
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
    "bird's eye view": "bird's eye view",
    "bird's eye": "bird's eye view",
    "worm's eye view": "worm's eye view",
    "worm's eye": "worm's eye view",
    'low angle': 'low angle',
    'high angle': 'high angle',
    'overhead': 'overhead',
    'dutch angle': 'dutch angle',
    'eye level': 'eye level',
    'wide angle': 'wide angle',
    'telephoto': 'telephoto',
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
  const lightingTerms = [
    'natural light',
    'sunlight',
    'daylight',
    'moonlight',
    'neon',
    'cinematic lighting',
    'golden hour',
    'blue hour',
  ];
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
  const commonSubjects = [
    'man',
    'woman',
    'person',
    'child',
    'dog',
    'cat',
    'someone',
    'figure',
    'character',
    'protagonist',
    'subject',
  ];
  for (const s of commonSubjects) {
    const subjectPattern = new RegExp(`\\b(a|an|the)?\\s*${s}\\b`, 'i');
    if (subjectPattern.test(lowerText)) {
      if (!ir.subjects.some((existing) => existing.text.toLowerCase() === s)) {
        ir.subjects.push({ text: s, attributes: [] });
      }
    }
  }

  // Fallback: Use NLP to find the main noun if no common subject found
  if (ir.subjects.length === 0) {
    const doc = nlp(text); // Use original case text for better NLP
    const firstNoun = doc.nouns().first().text('normal').toLowerCase();
    if (firstNoun && firstNoun.length > 2 && !isCameraOrStyle(firstNoun)) {
      ir.subjects.push({ text: firstNoun, attributes: [] });
    }
  }

  // 4. Action Extraction
  const commonActions = [
    'walking',
    'running',
    'jumping',
    'sitting',
    'standing',
    'dancing',
    'talking',
    'looking',
    'holding',
    'reaching',
    'falling',
    'flying',
    'swimming',
    'driving',
    'staring',
  ];
  for (const a of commonActions) {
    if (new RegExp(`\\b${a}\\b`, 'i').test(lowerText)) {
      if (!ir.actions.includes(a)) ir.actions.push(a);
    }
  }

  if (ir.actions.length === 0) {
    const doc = nlp(text);
    const firstVerb = doc.verbs().filter((v) => !v.has('#Auxiliary')).first().text('normal').toLowerCase();
    if (firstVerb && firstVerb.length > 2) ir.actions.push(firstVerb);
  }

  // 5. Style Extraction
  const styles = [
    'cinematic',
    'photorealistic',
    'anime',
    'cartoon',
    'noir',
    'vintage',
    'retro',
    'cyberpunk',
    'realism',
    'surreal',
  ];
  for (const style of styles) {
    if (lowerText.includes(style)) {
      if (!ir.meta.style.includes(style)) ir.meta.style.push(style);
    }
  }
}

function isCameraOrStyle(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('shot') ||
    lower.includes('view') ||
    lower.includes('angle') ||
    lower.includes('style') ||
    lower.includes('render')
  );
}
