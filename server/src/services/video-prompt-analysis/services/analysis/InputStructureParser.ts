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

export interface ParsedInputSections {
  narrative: string;
  technical?: Record<string, string>;
  alternatives?: unknown[];
}

export function parseInputStructure(text: string): ParsedInputSections {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    const parsed = tryParseJsonStructure(trimmed);
    if (parsed) return parsed;
  }

  const specsMatch = matchSectionHeader(text, [...TECHNICAL_HEADER_LABELS]);
  const altsMatch = matchSectionHeader(text, [...ALTERNATIVE_HEADER_LABELS]);

  let narrativeEndIndex = text.length;
  if (specsMatch?.index !== undefined) {
    narrativeEndIndex = Math.min(narrativeEndIndex, specsMatch.index);
  }
  if (altsMatch?.index !== undefined) {
    narrativeEndIndex = Math.min(narrativeEndIndex, altsMatch.index);
  }

  const sections: ParsedInputSections = {
    narrative: text.substring(0, narrativeEndIndex).trim(),
  };

  if (specsMatch) {
    const specsSection = extractSectionText(text, specsMatch);
    if (specsSection) {
      sections.technical = parseTechnicalSpecs(specsSection);
    }
  }

  return sections;
}

function tryParseJsonStructure(text: string): ParsedInputSections | null {
  try {
    const parsed = JSON.parse(text);
    if (isRecord(parsed)) {
      const narrative =
        typeof parsed.narrative === 'string'
          ? parsed.narrative
          : typeof parsed.description === 'string'
            ? parsed.description
            : '';
      if (narrative) {
        const technical = isRecord(parsed.technical) ? coerceTechnicalRecord(parsed.technical) : undefined;
        const alternatives = Array.isArray(parsed.alternatives) ? parsed.alternatives : undefined;
        const result: ParsedInputSections = { narrative };
        if (technical) {
          result.technical = technical;
        }
        if (alternatives) {
          result.alternatives = alternatives;
        }
        return result;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function coerceTechnicalRecord(value: Record<string, unknown>): Record<string, string> | undefined {
  const entries = Object.entries(value);
  if (entries.length === 0) return undefined;

  const technical: Record<string, string> = {};
  for (const [key, val] of entries) {
    if (typeof val === 'string' && val.trim()) {
      technical[key] = val.trim();
    }
  }

  return Object.keys(technical).length > 0 ? technical : undefined;
}

function extractSectionText(fullText: string, match: RegExpMatchArray | null): string | null {
  if (!match || match.index === undefined) return null;

  const contentStart = match.index + match[0].length;
  const nextHeaderIndex = findNextHeaderIndex(fullText, contentStart);
  return fullText.substring(contentStart, nextHeaderIndex).trim();
}

function matchSectionHeader(text: string, labels: readonly string[]): RegExpMatchArray | null {
  const pattern = getHeaderRegex(labels);
  return text.match(pattern);
}

function findNextHeaderIndex(fullText: string, startIndex: number): number {
  const allLabels = [...TECHNICAL_HEADER_LABELS, ...ALTERNATIVE_HEADER_LABELS];
  const remainder = fullText.substring(startIndex);
  const nextHeaderMatch = remainder.match(getHeaderRegex(allLabels));
  if (nextHeaderMatch && nextHeaderMatch.index !== undefined) {
    return startIndex + nextHeaderMatch.index;
  }
  return fullText.length;
}

function getHeaderRegex(labels: readonly string[]): RegExp {
  const escaped = labels.map((label) => escapeRegex(label));
  return new RegExp(
    `(?:^|\\n)\\s*(?:\\*\\*|##)?\\s*(?:${escaped.join('|')})\\s*(?:\\*\\*|:)?\\s*(?:\\n|$)`,
    'i'
  );
}

function parseTechnicalSpecs(specsText: string): Record<string, string> {
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
