const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const defaultConfirm = (message) => {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }
  return true;
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

  const whereMatch = sourcePrompt.match(
    /\*\*WHERE - LOCATION\/SETTING\*\*[\s\S]*?(?=\*\*WHEN|$)/
  );

  if (!whereMatch) {
    return baselinePrompt;
  }

  const whereSection = whereMatch[0];
  const envLabelIndex = whereSection.indexOf('- Environment Type:');
  const selectionIndex = whereSection.indexOf(oldValue);

  if (envLabelIndex === -1 || selectionIndex === -1) {
    return baselinePrompt;
  }

  const envTypeMatch = whereSection.match(/- Environment Type: \[(.*?)\]/);
  if (!envTypeMatch) {
    return baselinePrompt;
  }

  const nextFieldIndex = whereSection.indexOf('- Architectural Details:');
  const isEnvironmentType =
    selectionIndex > envLabelIndex &&
    (nextFieldIndex === -1 || selectionIndex < nextFieldIndex);

  if (!isEnvironmentType) {
    return baselinePrompt;
  }

  const affectedFieldsMap = {
    'Architectural Details':
      whereSection.match(/- Architectural Details: \[(.*?)\]/)?.[1] || '',
    'Environmental Scale':
      whereSection.match(/- Environmental Scale: \[(.*?)\]/)?.[1] || '',
    'Atmospheric Conditions':
      whereSection.match(/- Atmospheric Conditions: \[(.*?)\]/)?.[1] || '',
    'Background Elements':
      whereSection.match(/- Background Elements: \[(.*?)\]/)?.[1] || '',
    'Foreground Elements':
      whereSection.match(/- Foreground Elements: \[(.*?)\]/)?.[1] || '',
    'Spatial Depth':
      whereSection.match(/- Spatial Depth: \[(.*?)\]/)?.[1] || '',
    'Environmental Storytelling':
      whereSection.match(/- Environmental Storytelling: \[(.*?)\]/)?.[1] || '',
  };

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
        changedField: 'Environment Type',
        oldValue,
        newValue,
        fullPrompt: baselinePrompt,
        affectedFields: affectedFieldsMap,
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
      const oldFieldValue = affectedFieldsMap[fieldName];

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
