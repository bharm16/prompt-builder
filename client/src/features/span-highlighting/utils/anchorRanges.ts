import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';

const log = logger.child('anchorRanges');
const NODE_FILTER = typeof NodeFilter !== 'undefined' ? NodeFilter.SHOW_TEXT : null;

interface TextNodeEntry {
  node: Node;
  start: number;
  end: number;
}

interface TextNodeIndex {
  nodes: TextNodeEntry[];
  length: number;
}

interface NodeTarget {
  node: Node;
  localOffset: number;
}

interface RangeMapping {
  range: Range;
  start: NodeTarget;
  end: NodeTarget;
  nodeIndex: TextNodeIndex;
}

interface WrapRangeSegmentsOptions {
  root: Node;
  start: number;
  end: number;
  createWrapper: (mapping: {
    node: Node;
    globalStart: number;
    globalEnd: number;
    localStart: number;
    localEnd: number;
  }) => HTMLElement | null;
  nodeIndex?: TextNodeIndex;
}

const createWalker = (root: Node | null): TreeWalker | null => {
  if (!root || !NODE_FILTER || !root.ownerDocument?.createTreeWalker) {
    return null;
  }
  return root.ownerDocument.createTreeWalker(
    root,
    NODE_FILTER,
    {
      acceptNode: (node: Node | null): number => {
        if (!node || typeof node.nodeValue !== 'string') return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.length) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );
};

export const buildTextNodeIndex = (root: Node | null): TextNodeIndex => {
  if (!root) {
    return { nodes: [], length: 0 };
  }

  const walker = createWalker(root);
  if (!walker) {
    return { nodes: [], length: 0 };
  }

  const nodes: TextNodeEntry[] = [];
  let globalOffset = 0;
  let current = walker.nextNode();

  while (current) {
    const value = current.nodeValue ?? '';
    const start = globalOffset;
    const end = start + value.length;
    nodes.push({ node: current, start, end });
    globalOffset = end;
    current = walker.nextNode();
  }

  return { nodes, length: globalOffset };
};

const resolveNodeForOffset = (index: number, nodes: TextNodeEntry[]): NodeTarget | null => {
  if (!nodes.length) return null;
  if (index <= 0) {
    const first = nodes[0]!;
    return { node: first.node, localOffset: 0 };
  }

  const clamped = Math.max(0, index);

  for (let i = 0; i < nodes.length; i += 1) {
    const entry = nodes[i]!;
    if (clamped > entry.end) continue;

    if (clamped === entry.end) {
      const next = nodes[i + 1];
      if (next) {
        return { node: next.node, localOffset: 0 };
      }
      return {
        node: entry.node,
        localOffset: entry.end - entry.start,
      };
    }

    if (clamped >= entry.start && clamped < entry.end) {
      return { node: entry.node, localOffset: clamped - entry.start };
    }
  }

  const last = nodes[nodes.length - 1]!;
  return { node: last.node, localOffset: last.end - last.start };
};

export const mapGlobalRangeToDom = (
  root: Node | null,
  start: number,
  end: number,
  options: { nodeIndex?: TextNodeIndex } = {}
): RangeMapping | null => {
  if (!root || typeof start !== 'number' || typeof end !== 'number') {
    return null;
  }

  // Disallow entirely negative ranges
  if (end <= 0) {
    return null;
  }

  const index = options.nodeIndex ?? buildTextNodeIndex(root);
  if (!index.nodes.length) return null;

  const startTarget = resolveNodeForOffset(start, index.nodes);
  const endTarget = resolveNodeForOffset(end, index.nodes);
  if (!startTarget || !endTarget) return null;

  const range = root.ownerDocument?.createRange
    ? root.ownerDocument.createRange()
    : null;

  if (!range) return null;

  try {
    range.setStart(startTarget.node, startTarget.localOffset);
    range.setEnd(endTarget.node, endTarget.localOffset);
  } catch (error) {
    const info = sanitizeError(error);
    log.warn('Unable to set range', {
      operation: 'mapGlobalRangeToDom',
      error: info.message,
      errorName: info.name,
    });
    return null;
  }

  return {
    range,
    start: startTarget,
    end: endTarget,
    nodeIndex: index,
  };
};

export const surroundRange = ({
  root,
  start,
  end,
  createWrapper,
  nodeIndex,
}: {
  root: Node | null;
  start: number;
  end: number;
  createWrapper: (mapping: RangeMapping) => HTMLElement | null;
  nodeIndex?: TextNodeIndex;
}): HTMLElement | null => {
  if (!root || typeof createWrapper !== 'function') return null;

  const mapping = mapGlobalRangeToDom(root, start, end, nodeIndex ? { nodeIndex } : {});
  if (!mapping?.range) return null;

  const wrapper = createWrapper(mapping);
  if (!wrapper) return null;

  try {
    mapping.range.surroundContents(wrapper);
    return wrapper;
  } catch (error) {
    const info = sanitizeError(error);
    log.warn('Failed to surround contents', {
      operation: 'surroundRange',
      error: info.message,
      errorName: info.name,
    });
    return null;
  } finally {
    mapping.range.detach?.();
  }
};

const isTextNode = (node: Node | null | undefined): boolean => {
  if (!node) return false;
  if (typeof Node !== 'undefined' && Node.TEXT_NODE != null) {
    return node.nodeType === Node.TEXT_NODE;
  }
  return node.nodeType === 3;
};

const findFirstOverlappingNodeIndex = (nodes: TextNodeEntry[], start: number): number => {
  if (!Array.isArray(nodes) || !nodes.length) {
    return -1;
  }

  let low = 0;
  let high = nodes.length - 1;
  let candidate = nodes.length;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const entry = nodes[mid]!;

    if (start < entry.end) {
      candidate = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return candidate === nodes.length ? -1 : candidate;
};

export const wrapRangeSegments = ({
  root,
  start,
  end,
  createWrapper,
  nodeIndex,
}: WrapRangeSegmentsOptions): HTMLElement[] => {
  if (!root || typeof createWrapper !== 'function') {
    return [];
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [];
  }

  const index = nodeIndex ?? buildTextNodeIndex(root);
  if (!index?.nodes?.length) {
    return [];
  }

  const wrappers: HTMLElement[] = [];
  const doc = root.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
  if (!doc?.createRange) {
    return wrappers;
  }

  const startIndex = findFirstOverlappingNodeIndex(index.nodes, start);
  if (startIndex === -1) {
    return wrappers;
  }

  for (let i = startIndex; i < index.nodes.length; i += 1) {
    const entry = index.nodes[i]!;
    if (!isTextNode(entry.node)) {
      continue;
    }

    if (entry.end <= start) {
      continue;
    }

    if (entry.start >= end) {
      break;
    }

    const segmentStart = Math.max(start, entry.start);
    const segmentEnd = Math.min(end, entry.end);
    if (segmentEnd <= segmentStart) {
      continue;
    }

    const localStart = segmentStart - entry.start;
    const localEnd = segmentEnd - entry.start;
    if (localEnd <= localStart) {
      continue;
    }

    const range = doc.createRange();
    try {
      range.setStart(entry.node, localStart);
      range.setEnd(entry.node, localEnd);
    } catch (error) {
      range.detach?.();
      continue;
    }

    const wrapper = createWrapper({
      node: entry.node,
      globalStart: segmentStart,
      globalEnd: segmentEnd,
      localStart,
      localEnd,
    });

    if (!wrapper) {
      range.detach?.();
      continue;
    }

    try {
      range.surroundContents(wrapper);
      wrappers.push(wrapper);
    } catch (error) {
      const info = sanitizeError(error);
      log.warn('Failed to wrap segment', {
        operation: 'wrapRangeSegments',
        error: info.message,
        errorName: info.name,
      });
    } finally {
      range.detach?.();
    }
  }

  return wrappers;
};
