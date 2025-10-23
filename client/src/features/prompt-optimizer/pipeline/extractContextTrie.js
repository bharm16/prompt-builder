import { createSpan } from './spanUtils.js';
import { logSpanLifecycle, parserDebugLog } from '../../../utils/parserDebug.js';

const DEFAULT_CONTEXT_PRIORITY = 3;

const mapElementToCategory = (element) => {
  const mappings = {
    subject: 'subject',
    action: 'action',
    location: 'environment',
    time: 'timeOfDay',
    mood: 'mood',
    style: 'style',
    event: 'event',
  };
  return mappings[element] ?? element;
};

const mapSemanticGroupToCategory = (groupName, context) => {
  if (typeof context?.mapGroupToCategory === 'function') {
    const mapped = context.mapGroupToCategory(groupName);
    if (mapped) return mapped;
  }
  const fallback = {
    cameraMovements: 'camera',
    lightingQuality: 'lighting',
    aesthetics: 'style',
  };
  return fallback[groupName] ?? 'context';
};

const normalizePattern = (value) =>
  typeof value === 'string'
    ? value.normalize('NFC').trim()
    : '';

const collectContextPatterns = (promptContext) => {
  if (!promptContext || typeof promptContext !== 'object') {
    return [];
  }

  const patterns = [];

  if (promptContext.elements) {
    Object.entries(promptContext.elements).forEach(([element, value]) => {
      const normalized = normalizePattern(value);
      if (!normalized) return;
      patterns.push({
        phrase: normalized,
        category: mapElementToCategory(element),
        weight: DEFAULT_CONTEXT_PRIORITY,
      });
    });
  }

  if (promptContext.keywordMaps) {
    Object.entries(promptContext.keywordMaps).forEach(([element, keywords]) => {
      const category = mapElementToCategory(element);
      (keywords || []).forEach((keyword) => {
        const normalized = normalizePattern(keyword);
        if (!normalized) return;
        patterns.push({
          phrase: normalized,
          category,
          weight: DEFAULT_CONTEXT_PRIORITY - 0.25,
        });
      });
    });
  }

  if (promptContext.semanticGroups) {
    Object.entries(promptContext.semanticGroups).forEach(([groupName, terms]) => {
      const category = mapSemanticGroupToCategory(groupName, promptContext);
      (terms || []).forEach((term) => {
        const normalized = normalizePattern(term);
        if (!normalized) return;
        patterns.push({
          phrase: normalized,
          category,
          weight: DEFAULT_CONTEXT_PRIORITY - 0.5,
        });
      });
    });
  }

  const deduped = [];
  const seen = new Set();

  patterns.forEach((entry) => {
    const key = `${entry.category}:${entry.phrase.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(entry);
  });

  parserDebugLog('context:patterns', {
    count: deduped.length,
    categories: [...new Set(deduped.map(p => p.category))],
  });

  return deduped;
};

const createTrieNode = () => ({
  children: new Map(),
  failure: null,
  outputs: [],
});

const buildTrie = (patterns) => {
  const root = createTrieNode();

  patterns.forEach((pattern) => {
    const value = pattern.phrase.toLowerCase();
    let node = root;
    for (const char of value) {
      if (!node.children.has(char)) {
        node.children.set(char, createTrieNode());
      }
      node = node.children.get(char);
    }
    node.outputs.push(pattern);
  });

  const queue = [];
  root.children.forEach((child) => {
    child.failure = root;
    queue.push(child);
  });

  while (queue.length) {
    const current = queue.shift();

    current.children.forEach((child, char) => {
      let failure = current.failure;
      while (failure && !failure.children.has(char)) {
        failure = failure.failure;
      }
      child.failure = failure ? failure.children.get(char) : root;
      child.outputs = child.outputs.concat(child.failure.outputs);
      queue.push(child);
    });
  }

  return root;
};

const searchWithTrie = (trie, text) => {
  const matches = [];

  let node = trie;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    while (node && !node.children.has(char)) {
      node = node.failure;
    }
    node = node ? node.children.get(char) || trie : trie;
    if (!node) {
      node = trie;
      continue;
    }
    if (node.outputs.length) {
      node.outputs.forEach((pattern) => {
        matches.push({
          pattern,
          end: index + 1,
        });
      });
    }
  }

  return matches;
};

export const extractContextSpans = ({ canonical, promptContext }) => {
  if (!promptContext?.hasContext?.()) {
    return [];
  }

  const patterns = collectContextPatterns(promptContext);
  if (!patterns.length) {
    return [];
  }

  const trie = buildTrie(patterns);
  const lowerText = canonical.normalized.toLowerCase();

  const matches = searchWithTrie(trie, lowerText);
  const spans = [];

  matches.forEach(({ pattern, end }) => {
    const start = end - pattern.phrase.length;
    const span = createSpan({
      canonical,
      start,
      end,
      category: pattern.category,
      source: 'CONTEXT',
      confidence: 1,
      metadata: {
        priority: pattern.weight,
        locked: true,
      },
    });
    logSpanLifecycle({ stage: 'context_match', span, extra: { pattern: pattern.phrase } });
    spans.push(span);
  });

  return spans;
};

