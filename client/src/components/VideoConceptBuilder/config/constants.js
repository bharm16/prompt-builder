/**
 * Constants for Video Concept Builder
 *
 * This file contains all constant values used throughout the Video Concept Builder:
 * - Element keys and organization
 * - Subject descriptor connector words
 * - Element hierarchy and dependencies
 * - Element groupings
 * - Technical section ordering
 */

// Subject descriptor keys
export const SUBJECT_DESCRIPTOR_KEYS = [
  'subjectDescriptor1',
  'subjectDescriptor2',
  'subjectDescriptor3',
];

// Primary element keys
export const PRIMARY_ELEMENT_KEYS = [
  'subject',
  'action',
  'location',
  'time',
  'mood',
  'style',
  'event',
];

// Element card display order
export const ELEMENT_CARD_ORDER = PRIMARY_ELEMENT_KEYS;

// Subject connector words for descriptor parsing
export const SUBJECT_CONNECTOR_WORDS = [
  'with',
  'holding',
  'carrying',
  'wearing',
  'using',
  'playing',
  'strumming',
  'standing',
  'sitting',
  'leaning',
  'bathed',
  'surrounded',
  'and',
  'gazing',
  'watching',
  'dancing',
  'singing',
  'running',
  'walking',
  'cradling',
  'clutching',
  'embracing',
  'guarding',
  'lit',
  'framed',
  'draped',
  'illuminated',
  'tuning',
  'polishing',
  'shining',
];

// Element dependency hierarchy
export const ELEMENT_HIERARCHY = {
  subject: { priority: 1, dependencies: [] },
  subjectDescriptor1: { priority: 1.1, dependencies: ['subject'] },
  subjectDescriptor2: { priority: 1.2, dependencies: ['subject'] },
  subjectDescriptor3: { priority: 1.3, dependencies: ['subject'] },
  action: { priority: 2, dependencies: ['subject'] },
  location: { priority: 3, dependencies: ['subject', 'action'] },
  time: { priority: 4, dependencies: ['location'] },
  mood: { priority: 5, dependencies: ['subject', 'action'] },
  style: { priority: 6, dependencies: ['mood'] },
  event: { priority: 7, dependencies: ['subject', 'action'] },
};

// Element groups for smart organization
export const ELEMENT_GROUPS = {
  core: ['subject', 'action', 'location'],
  subjectDescriptors: SUBJECT_DESCRIPTOR_KEYS,
  atmosphere: ['mood', 'time'],
  style: ['style'],
  context: ['event'],
};

// Technical section display order
export const TECHNICAL_SECTION_ORDER = [
  'camera',
  'lighting',
  'color',
  'format',
  'audio',
  'postProduction',
];

// Helper function to check if a key is a subject descriptor
export const isSubjectDescriptorKey = (key) => SUBJECT_DESCRIPTOR_KEYS.includes(key);
