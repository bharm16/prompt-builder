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
] as const;

// Primary element keys
export const PRIMARY_ELEMENT_KEYS = [
  'subject',
  'action',
  'cameraMovement',
  'location',
  'time',
  'mood',
  'style',
  'event',
] as const;

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
] as const;

// Element dependency hierarchy
export interface ElementHierarchyEntry {
  priority: number;
  dependencies: readonly string[];
}

export const ELEMENT_HIERARCHY: Record<string, ElementHierarchyEntry> = {
  subject: { priority: 1, dependencies: [] },
  subjectDescriptor1: { priority: 1.1, dependencies: ['subject'] },
  subjectDescriptor2: { priority: 1.2, dependencies: ['subject'] },
  subjectDescriptor3: { priority: 1.3, dependencies: ['subject'] },
  action: { priority: 2, dependencies: ['subject'] },
  cameraMovement: { priority: 2.5, dependencies: ['action'] },
  location: { priority: 3, dependencies: ['subject', 'action'] },
  time: { priority: 4, dependencies: ['location'] },
  mood: { priority: 5, dependencies: ['subject', 'action'] },
  style: { priority: 6, dependencies: ['mood'] },
  event: { priority: 7, dependencies: ['subject', 'action'] },
} as const;

// Element groups for smart organization
export const ELEMENT_GROUPS = {
  core: ['subject', 'action', 'location'],
  subjectDescriptors: SUBJECT_DESCRIPTOR_KEYS,
  camera: ['cameraMovement'],
  atmosphere: ['mood', 'time'],
  style: ['style'],
  context: ['event'],
} as const;

// Technical section display order
export const TECHNICAL_SECTION_ORDER = [
  'camera',
  'lighting',
  'color',
  'format',
  'audio',
  'postProduction',
] as const;

// Helper function to check if a key is a subject descriptor
export function isSubjectDescriptorKey(key: string): boolean {
  return SUBJECT_DESCRIPTOR_KEYS.includes(key as typeof SUBJECT_DESCRIPTOR_KEYS[number]);
}

