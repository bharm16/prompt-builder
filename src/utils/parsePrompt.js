/**
 * Lightweight grammatical chunking + tiny domain hints (no heavy ML).
 * Works in the browser, deterministic, fast.
 *
 * Domain-agnostic phrase extraction using linguistic patterns:
 * - Noun phrase extraction (Adj+Noun, Noun+Noun compounds)
 * - Prepositional phrase extraction ("in black coat", "with shallow depth")
 * - Camera movement detection (verbs + direction)
 * - Technical specification extraction (35mm, 24fps, 2.39:1)
 * - Semantic categorization with tiny domain lexicons
 */

export const COLORS = ['black','white','red','blue','green','brown','gray','grey','golden','silver','crimson','neon','desaturated'];
export const TIME_OF_DAY = ['dawn','sunrise','golden hour','noon','afternoon','sunset','twilight','blue hour','night','overcast'];
export const LIGHTING_QUAL = ['soft','harsh','dramatic','diffuse','overcast','backlit','rim','sidelight','natural','ambient'];
export const CAMERA_VERBS = ['dolly','dollies','dollying','zoom','zooms','pans','pan','tilt','tilts','truck','pedestal','crane','roll','rack','pull','push'];
export const CAMERA_NOUNS = ['close-up','closeup','medium shot','wide shot','establishing shot','profile','35mm','50mm','85mm'];

export const TECH_PATTERNS = [
  { rx: /\b(\d{2,3})mm\b/gi, role: 'Technical' },
  { rx: /\b(\d{2})fps\b/gi,  role: 'Technical' },
  { rx: /\b(\d+)\s?-\s?(\d+)s\b/gi, role: 'Technical' },
  { rx: /\b(1\.33:1|1\.85:1|2\.39:1|4:3|16:9)\b/gi, role: 'Technical' },
];

/**
 * Quick sentence-ish split
 */
function splitClauses(text) {
  return text.split(/(?<=[\.\!\?])\s+|\s*(?:,|\|)\s*/).filter(Boolean);
}

/**
 * Naive POS-ish helpers (no external deps; good enough for our domain)
 */
const isAdj = (w) => /ly$/.test(w) === false && /^(soft|harsh|dramatic|weathered|bare|desaturated|shallow|deep|golden|gray|grey|black|white|red|blue|green|brown|silver|crimson|neon|natural|ambient|diffuse|overcast|period-accurate)$/i.test(w);
const isNoun = (w) => /^(coat|frock|hat|uniform|jacket|dress|gown|cloak|boots|gloves|face|beard|hair|eyes|hands|profile|trees|cemetery|headstones|carriages|sky|battlefield|grounds|crowd|podium|paper|papers|camera|shadows|lighting|palette|depth|field|dof|shot|frame|sunlight)$/i.test(w) || /^[a-z]{3,}s$/i.test(w);

/**
 * Collect Noun Phrases: Adj+Noun(+Noun) / Noun+Noun compounds
 */
function collectNPs(s) {
  const out = [];
  const words = [...s.matchAll(/\b[\w'-]+\b/g)].map(m => ({ w: m[0], i: m.index }));

  for (let i=0; i<words.length; i++){
    const w = words[i].w;
    // try Adjective(s) + Noun(s)
    if (isAdj(w) || isNoun(w)) {
      let j=i, hasNoun=false, buf=[w], end=words[i].i+w.length;
      // gather adjectives
      while (j+1<words.length && isAdj(words[j+1].w)) {
        j++;
        buf.push(words[j].w);
        end=words[j].i+words[j].w.length;
      }
      // gather nouns
      while (j+1<words.length && isNoun(words[j+1].w)) {
        j++;
        buf.push(words[j].w);
        end=words[j].i+words[j].w.length;
        hasNoun=true;
      }
      if (hasNoun && buf.length>=2) {
        const text = s.slice(words[i].i, end);
        out.push({
          text,
          start: words[i].i,
          end,
          role: 'Descriptive',
          norm: text.toLowerCase(),
          confidence: 0.75
        });
        i=j;
      }
    }
  }

  // Prepositional chunks: "in black frock coat", "with shallow depth of field"
  const ppRx = /\b(in|with|under|against|through)\s+([^\.,\|\n]+)/gi;
  let m;
  while ((m = ppRx.exec(s))) {
    const text = m[0];
    out.push({
      text,
      start: m.index,
      end: m.index+text.length,
      role: 'Descriptive',
      norm: text.replace(/^(in|with|under|against|through)\s+/i,'').toLowerCase(),
      confidence: 0.7
    });
  }

  return out;
}

/**
 * Collect Camera Moves
 */
function collectCameraMoves(s) {
  const out = [];
  const rx = /\b(?:\w+\s+){0,2}?(dolly|dollies|dollying|zoom|zooms|pan|pans|tilt|tilts|truck|pedestal|crane|roll|rack|pull|push)(?:\s+\w+){0,3}\b/gi;
  let m;
  while ((m = rx.exec(s))) {
    const text = m[0];
    out.push({
      text,
      start: m.index,
      end: m.index+text.length,
      role: 'CameraMove',
      norm: text.toLowerCase(),
      confidence: 0.9
    });
  }
  return out;
}

/**
 * Collect Technical specs (35mm, 24fps, 2.39:1, etc.)
 */
function collectTechnical(s) {
  const out = [];
  for (const { rx, role } of TECH_PATTERNS) {
    let m;
    while ((m = rx.exec(s))) {
      out.push({
        text: m[0],
        start: m.index,
        end: m.index+m[0].length,
        role,
        norm: m[0].toLowerCase(),
        confidence: 0.99
      });
    }
  }
  return out;
}

/**
 * Categorize spans based on semantic hints
 */
function categorize(a) {
  const s = a.text.toLowerCase();

  // Check if already tagged as CameraMove or Technical (high priority)
  if (a.role === 'CameraMove') return 'CameraMove';
  if (a.role === 'Technical') return 'Technical';

  // Check for camera verbs (high priority - before Environment check)
  if (CAMERA_VERBS.some(v => s.includes(v))) return 'CameraMove';

  // Check for lighting keywords explicitly (before TimeOfDay)
  if (s.includes('lighting') || s.includes('shadows') || s.includes('light')) return 'Lighting';
  if (LIGHTING_QUAL.some(t => s.includes(t)) && !s.includes('overcast sky')) return 'Lighting';

  if (TIME_OF_DAY.some(t => s.includes(t))) return 'TimeOfDay';
  if (CAMERA_NOUNS.some(n => s.includes(n)) || s.includes('depth of field') || /\bdof\b/.test(s)) return 'Framing';
  if (/\b(coat|frock|hat|uniform|jacket|dress|gown|cloak|boots|gloves)\b/.test(s)) return 'Wardrobe';
  if (/\b(face|beard|hair|eyes|hands|profile|wrinkles|weathered)\b/.test(s)) return 'Appearance';
  if (/\b(trees|cemetery|headstones|carriages|sky|battlefield|grounds|crowd|podium)\b/.test(s)) return 'Environment';
  if (/\b(papers?|carriage)\b/.test(s)) return 'Environment';
  if (COLORS.some(c => s.includes(c)) || s.includes('palette')) return 'Color';

  return 'Descriptive';
}

/**
 * Merge adjacent/overlapping spans of the same role
 * Note: We'll need the original input to extract merged text correctly
 */
function mergeAdjacent(chunks, originalInput) {
  // Sort by start position
  chunks.sort((a,b) => a.start - b.start || b.end - a.end);

  const out = [];
  for (const c of chunks) {
    const last = out[out.length-1];
    if (last && c.start <= last.end + 1 && last.role === c.role) {
      // Extend the span to cover both ranges
      last.end = Math.max(last.end, c.end);
      // Extract the actual text from the original input using the merged indices
      if (originalInput) {
        last.text = originalInput.slice(last.start, last.end);
        last.norm = last.text.toLowerCase();
      }
      last.confidence = Math.max(last.confidence, c.confidence);
    } else {
      out.push({...c});
    }
  }
  return out;
}

/**
 * Main parser: Extract swappable units from prompt text
 *
 * @param {string} input - The prompt text to parse
 * @returns {Array<{text: string, start: number, end: number, role: string, norm: string, confidence: number}>}
 */
export function parsePrompt(input) {
  let spans = [];

  // First, extract technical specs from the entire input (including TECHNICAL SPECS section)
  spans.push(...collectTechnical(input));

  // Then parse the main body (strip technical specs section for NP and camera move extraction)
  const headRx = /\*\*TECHNICAL SPECS\*\*[\s\S]*$/i;
  const body = input.replace(headRx, '');

  const clauses = splitClauses(body);

  for (const c of clauses) {
    spans.push(...collectNPs(c));
    spans.push(...collectCameraMoves(c));
  }

  spans = spans.map(s => ({ ...s, role: categorize(s) }));
  spans = mergeAdjacent(spans, input);

  // Keep swappables: prefer phrase-length or domain-tagged
  spans = spans.filter(s => /\b\w+\s+\w+/.test(s.text) || s.role !== 'Descriptive');

  // Tidy leading prepositions
  spans = spans.map(s => {
    const t = s.text.replace(/^(in|with|under|against|through)\s+/i,'').trim();
    return { ...s, text: t, norm: t.toLowerCase() };
  });

  return spans;
}

/**
 * Get statistics about detected spans
 */
export function getParseStats(spans) {
  const roleCount = {};
  spans.forEach(s => {
    roleCount[s.role] = (roleCount[s.role] || 0) + 1;
  });

  return {
    totalSpans: spans.length,
    roleDistribution: roleCount,
    avgConfidence: spans.reduce((sum, s) => sum + s.confidence, 0) / spans.length || 0
  };
}
