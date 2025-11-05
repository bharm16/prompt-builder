/**
 * Field Configuration for StepAtmosphere
 * 
 * Defines the atmosphere fields (time, mood, style, event) with their labels,
 * descriptions, placeholders, and validation rules.
 */

export const ATMOSPHERE_FIELDS = [
  {
    name: 'location',
    label: 'Location',
    description: 'Where does it take place? (setting, environment)',
    placeholder: 'e.g., a sun-drenched beach, a futuristic city, an ancient forest',
    required: false,
  },
  {
    name: 'time',
    label: 'Time',
    description: 'When does it happen? (time of day, era, season) - Optional',
    placeholder: 'e.g., during golden hour, at midnight, in the 1920s',
    required: false,
  },
  {
    name: 'mood',
    label: 'Mood',
    description: "What's the emotional atmosphere? - Optional",
    placeholder: 'e.g., energetic and joyful, mysterious and tense, calm and peaceful',
    required: false,
  },
  {
    name: 'style',
    label: 'Style',
    description: 'What visual treatment? (cinematic, documentary, etc.) - Optional',
    placeholder: 'e.g., cinematic, documentary, vintage film, minimalist',
    required: false,
  },
  {
    name: 'event',
    label: 'Event',
    description: "What's the context or occasion? - Optional",
    placeholder: 'e.g., a celebration, a chase scene, a quiet moment',
    required: false,
  },
];

// Field navigation order for keyboard shortcuts
export const FIELD_ORDER = ['location', 'time', 'mood', 'style', 'event'];

// Check if any atmosphere field has data
export const hasAnyAtmosphereData = (formData) => {
  return formData.time || formData.mood || formData.style || formData.event;
};

