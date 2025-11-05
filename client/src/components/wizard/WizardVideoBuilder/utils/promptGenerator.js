/**
 * Prompt Generation Utilities
 * 
 * Handles formatting form data into the expected prompt structure.
 */

/**
 * Format form data into elements structure
 */
export function formatElements(formData) {
  return {
    subject: formData.subject,
    action: formData.action,
    location: formData.location,
    time: formData.time,
    mood: formData.mood,
    style: formData.style,
    event: formData.event,
    // Note: Old system had subject descriptors, wizard doesn't yet
    subjectDescriptor1: '',
    subjectDescriptor2: '',
    subjectDescriptor3: '',
  };
}

/**
 * Format technical parameters from form data
 */
export function formatTechnicalParams(formData) {
  return {
    camera: formData.camera || {},
    lighting: formData.lighting || {},
    composition: formData.composition || {},
    motion: formData.motion || {},
    effects: formData.effects || {},
  };
}

/**
 * Format metadata for the concept
 */
export function formatMetadata(formData) {
  return {
    format: 'wizard',
    technicalParams: formatTechnicalParams(formData),
  };
}

