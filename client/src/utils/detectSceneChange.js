const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const defaultConfirm = (message) => {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }
  return true;
};

const extractSceneContext = (fullPrompt, targetValue) => {
  if (!fullPrompt) {
    return {
      changedField: 'Unknown Field',
      affectedFields: {},
      sectionHeading: null,
      sectionContext: null,
    };
  }

  const normalizedTarget = typeof targetValue === 'string' ? targetValue.toLowerCase().trim() : '';
  const sectionRegex = /\*\*(.+?)\*\*([\s\S]*?)(?=\*\*|$)/g;
  let matchedFields = null;
  let matchedHeading = null;
  let matchedContext = null;
  let fallbackFields = null;
  let fallbackHeading = null;
  let fallbackContext = null;

  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(fullPrompt))) {
    const heading = sectionMatch[1].trim();
    const body = sectionMatch[2] || '';
    const fields = {};

    const fieldRegex = /- ([^:]+): \[(.*?)\]/g;
    let fieldMatch;
    let foundInSection = false;
    while ((fieldMatch = fieldRegex.exec(body))) {
      const fieldName = fieldMatch[1].trim();
      const fieldValue = fieldMatch[2].trim();
      fields[fieldName] = fieldValue;

      if (!foundInSection && normalizedTarget && fieldValue.toLowerCase().includes(normalizedTarget)) {
        foundInSection = true;
      }
    }

    if (foundInSection && !matchedFields) {
      matchedFields = { ...fields };
      matchedHeading = heading;
      matchedContext = body.trim();
    } else if (!matchedFields && Object.keys(fields).length > 0 && !fallbackFields) {
      fallbackFields = { ...fields };
      fallbackHeading = heading;
      fallbackContext = body.trim();
    }

    if (matchedFields) {
      break;
    }
  }

  const selectedFields = matchedFields || fallbackFields || {};
  const heading = matchedHeading || fallbackHeading || null;
  const context = matchedContext || fallbackContext || null;

  let changedField = 'Unknown Field';
  if (normalizedTarget && Object.keys(selectedFields).length > 0) {
    const match = Object.entries(selectedFields).find(([, value]) =>
      value.toLowerCase().includes(normalizedTarget)
    );
    if (match) {
      changedField = match[0];
    }
  }

  return {
    changedField,
    affectedFields: selectedFields,
    sectionHeading: heading,
    sectionContext: context,
  };
};

export async function detectAndApplySceneChange({
  originalPrompt,
  updatedPrompt,
  oldValue,
  newValue,
  fetchImpl,
  confirmSceneChange,
}) {
  const sourcePrompt = typeof originalPrompt === 'string' ? originalPrompt : '';
  const baselinePrompt =
    typeof updatedPrompt === 'string' ? updatedPrompt : sourcePrompt;

  if (!sourcePrompt || !baselinePrompt) {
    return baselinePrompt || sourcePrompt;
  }

  if (!oldValue || !newValue || oldValue === newValue) {
    return baselinePrompt;
  }

  const {
    changedField,
    affectedFields,
    sectionHeading,
    sectionContext,
  } = extractSceneContext(sourcePrompt, oldValue);
  const normalizedAffectedFields = affectedFields || {};

  const fetchFn =
    fetchImpl || (typeof fetch !== 'undefined' ? fetch : undefined);

  if (!fetchFn) {
    return baselinePrompt;
  }

  const confirmFn = confirmSceneChange || defaultConfirm;

  try {
    const response = await fetchFn('/api/detect-scene-change', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'dev-key-12345',
      },
      body: JSON.stringify({
        changedField: changedField || 'Unknown Field',
        oldValue,
        newValue,
        fullPrompt: baselinePrompt,
        affectedFields: normalizedAffectedFields,
        sectionHeading,
        sectionContext,
      }),
    });

    if (!response || !response.ok) {
      return baselinePrompt;
    }

    const result = await response.json();

    if (!result || !result.isSceneChange || result.confidence === 'low') {
      return baselinePrompt;
    }

    const confirmationMessage =
      `🎬 Scene Change Detected!\n\n` +
      `Changing from "${oldValue}" to "${newValue}" represents a complete environment change.\n\n` +
      `Would you like to automatically update the related location fields to match this new environment?\n\n` +
      `${result.reasoning || ''}`;

    const shouldUpdate = confirmFn(confirmationMessage);

    if (!shouldUpdate || !result.suggestedUpdates) {
      return baselinePrompt;
    }

    let finalPrompt = baselinePrompt;

    Object.entries(result.suggestedUpdates).forEach(([fieldName, newFieldValue]) => {
      const oldFieldValue = normalizedAffectedFields[fieldName];

      if (!oldFieldValue || !newFieldValue) {
        return;
      }

      const pattern = new RegExp(
        `(- ${escapeRegExp(fieldName)}: \\[)${escapeRegExp(oldFieldValue)}(\\])`,
        'g'
      );

      finalPrompt = finalPrompt.replace(
        pattern,
        `$1${newFieldValue}$2`
      );
    });

    return finalPrompt;
  } catch (error) {
    console.error('Error detecting scene change:', error);
    return baselinePrompt;
  }
}

export default detectAndApplySceneChange;
