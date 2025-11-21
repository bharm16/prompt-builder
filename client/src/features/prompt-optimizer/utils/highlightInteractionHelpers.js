/**
 * Finds a highlighted word element from a click target by traversing up the DOM tree.
 * 
 * @param {HTMLElement} targetElement - The element that was clicked
 * @param {HTMLElement} rootElement - The root element to stop traversal at
 * @returns {HTMLElement|null} The found .value-word element or null
 */
export function findHighlightNode(targetElement, rootElement) {
  if (!targetElement || !rootElement) {
    return null;
  }

  let node = targetElement;
  
  while (node && node !== rootElement) {
    if (node.classList && node.classList.contains('value-word')) {
      return node;
    }
    node = node.parentElement;
  }
  
  return null;
}

/**
 * Extracts metadata from a highlighted word element's dataset.
 * 
 * @param {HTMLElement} node - The .value-word element
 * @param {Object} parseResult - Parse result containing spans array
 * @returns {Object|null} Extracted metadata or null
 */
export function extractHighlightMetadata(node, parseResult) {
  if (!node || !node.dataset) {
    return null;
  }

  const wordText = node.textContent.trim();
  const {
    category,
    source,
    spanId,
    start,
    end,
    startGrapheme,
    endGrapheme,
    validatorPass,
    confidence,
    quote,
    leftCtx,
    rightCtx,
    idempotencyKey,
  } = node.dataset;

  const metadata = {
    category: category || null,
    source: source || null,
    spanId: spanId || null,
    start: start ? Number(start) : -1,
    end: end ? Number(end) : -1,
    startGrapheme: startGrapheme ? Number(startGrapheme) : -1,
    endGrapheme: endGrapheme ? Number(endGrapheme) : -1,
    validatorPass: validatorPass !== 'false',
    confidence: confidence ? Number(confidence) : null,
    quote: quote || wordText,
    leftCtx: leftCtx || '',
    rightCtx: rightCtx || '',
    idempotencyKey: idempotencyKey || null,
  };

  // Enhance with full span details if available
  if (metadata.spanId && Array.isArray(parseResult?.spans)) {
    const spanDetail = parseResult.spans.find((span) => span.id === metadata.spanId);
    if (spanDetail) {
      metadata.span = { ...spanDetail };
    }
  }

  return metadata;
}

/**
 * Creates a Range object for a DOM node and returns selection offsets.
 * 
 * @param {HTMLElement} node - The node to create a range for
 * @param {HTMLElement} rootElement - The root element for offset calculation
 * @param {Function} getOffsetsFn - Function to calculate offsets (from textSelection.js)
 * @returns {Object} Object containing range, rangeClone, and offsets
 */
export function createHighlightRange(node, rootElement, getOffsetsFn) {
  if (!node || !rootElement || !getOffsetsFn) {
    return { range: null, rangeClone: null, offsets: null };
  }

  const range = document.createRange();
  range.selectNodeContents(node);
  const rangeClone = range.cloneRange();
  const offsets = getOffsetsFn(rootElement, rangeClone);

  return { range, rangeClone, offsets };
}

/**
 * Updates the browser selection to highlight a specific range.
 * 
 * @param {Range} range - The range to select
 */
export function selectRange(range) {
  if (!range) {
    return;
  }

  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

