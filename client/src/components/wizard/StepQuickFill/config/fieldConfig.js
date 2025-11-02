/**
 * Field Configuration for Quick Fill Step
 *
 * Defines all form fields with metadata:
 * - Core Concept fields (subject, descriptors, action)
 * - Atmosphere & Style fields (location, time, mood, style, event)
 *
 * Each field includes:
 * - id: Field identifier
 * - label: Display label
 * - description: Helper text (shown on focus)
 * - placeholder: Placeholder example
 * - required: Whether field is required
 * - delay: Staggered animation delay (ms)
 * - section: Which column the field belongs to
 *
 * @module fieldConfig
 */

/**
 * Core Concept Fields (Left Column)
 * Required: subject, action
 * Optional: descriptor1, descriptor2, descriptor3
 */
export const CORE_CONCEPT_FIELDS = [
  {
    id: 'subject',
    label: 'Subject',
    description: "What's the main focus? (e.g., person, object, animal)",
    placeholder: 'e.g., A professional athlete',
    required: true,
    delay: 0,
    section: 'core',
  },
  {
    id: 'descriptor1',
    label: 'Descriptor 1',
    description: 'Physical appearance (optional)',
    placeholder: 'e.g., muscular and toned',
    required: false,
    delay: 50,
    section: 'core',
  },
  {
    id: 'descriptor2',
    label: 'Descriptor 2',
    description: 'Visual details (optional)',
    placeholder: 'e.g., wearing a red jersey',
    required: false,
    delay: 100,
    section: 'core',
  },
  {
    id: 'descriptor3',
    label: 'Descriptor 3',
    description: 'Physical state (optional)',
    placeholder: 'e.g., in mid-stride',
    required: false,
    delay: 150,
    section: 'core',
  },
  {
    id: 'action',
    label: 'Action',
    description: "What's happening?",
    placeholder: 'e.g., running through',
    required: true,
    delay: 200,
    section: 'core',
  },
];

/**
 * Atmosphere & Style Fields (Right Column)
 * All optional
 */
export const ATMOSPHERE_FIELDS = [
  {
    id: 'location',
    label: 'Location',
    description: 'Where does it take place?',
    placeholder: 'e.g., a sun-drenched beach',
    required: false,
    delay: 250,
    section: 'atmosphere',
  },
  {
    id: 'time',
    label: 'Time',
    description: 'When does it happen?',
    placeholder: 'e.g., during golden hour',
    required: false,
    delay: 300,
    section: 'atmosphere',
  },
  {
    id: 'mood',
    label: 'Mood',
    description: 'Emotional atmosphere',
    placeholder: 'e.g., energetic and joyful',
    required: false,
    delay: 350,
    section: 'atmosphere',
  },
  {
    id: 'style',
    label: 'Style',
    description: 'Visual treatment',
    placeholder: 'e.g., cinematic',
    required: false,
    delay: 400,
    section: 'atmosphere',
  },
  {
    id: 'event',
    label: 'Event',
    description: 'Context or occasion',
    placeholder: 'e.g., a celebration',
    required: false,
    delay: 450,
    section: 'atmosphere',
  },
];

/**
 * All fields combined
 */
export const FIELD_CONFIG = [...CORE_CONCEPT_FIELDS, ...ATMOSPHERE_FIELDS];

/**
 * Total number of fields (for progress calculation)
 */
export const TOTAL_FIELDS = FIELD_CONFIG.length;

/**
 * Section metadata for headers
 */
export const SECTIONS = {
  core: {
    title: 'Core Concept',
    subtitle: 'Define the essence of your video',
    icon: 'zap',
    iconBg: 'linear-gradient(135deg, #FF385C 0%, #E03252 100%)',
    iconShadow: 'rgba(255, 56, 92, 0.3)',
  },
  atmosphere: {
    title: 'Atmosphere & Style',
    subtitle: 'Add mood, timing, and visual treatment',
    icon: 'sparkles',
    iconBg: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
    iconShadow: 'rgba(139, 92, 246, 0.3)',
  },
};
