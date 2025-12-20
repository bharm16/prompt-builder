/**
 * Scene Context Parser
 * 
 * Extracts structured scene context from formatted prompt text
 */

interface SceneContext {
  changedField: string;
  affectedFields: Record<string, string>;
  sectionHeading: string | null;
  sectionContext: string | null;
}

/**
 * Extract scene context from a full prompt
 * Parses markdown-like structure to extract field values and context
 */
export function extractSceneContext(
  fullPrompt: string | null | undefined,
  targetValue: unknown
): SceneContext {
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
  let matchedFields: Record<string, string> | null = null;
  let matchedHeading: string | null = null;
  let matchedContext: string | null = null;
  let fallbackFields: Record<string, string> | null = null;
  let fallbackHeading: string | null = null;
  let fallbackContext: string | null = null;

  let sectionMatch: RegExpExecArray | null;
  while ((sectionMatch = sectionRegex.exec(fullPrompt)) !== null) {
    const heading = sectionMatch[1]?.trim() ?? '';
    const body = sectionMatch[2] ?? '';
    const fields: Record<string, string> = {};

    const fieldRegex = /- ([^:]+): \[(.*?)\]/g;
    let fieldMatch: RegExpExecArray | null;
    let foundInSection = false;
    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      const fieldName = fieldMatch[1]?.trim() ?? '';
      const fieldValue = fieldMatch[2]?.trim() ?? '';
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
}
