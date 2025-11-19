/**
 * Element Configuration for Video Concept Builder
 *
 * Defines the configuration for each element type including:
 * - Display properties (icon, label, color)
 * - Input guidance (placeholder, examples)
 * - Categorization (group, optional/required status)
 * - Taxonomy mapping (taxonomyId, taxonomyGroup)
 */

import {
  User,
  Zap,
  MapPin,
  Calendar,
  Palette,
  Sparkles,
  Lightbulb,
  Tag,
} from 'lucide-react';
import { TAXONOMY } from '@shared/taxonomy';

export const ELEMENT_CONFIG = {
  subject: {
    icon: User,
    label: 'Subject',
    taxonomyId: TAXONOMY.SUBJECT.id,
    placeholder: 'Who/what with 2-3 visual details (e.g., "elderly historian with trembling hands")',
    color: 'slate',
    examples: [
      'elderly street musician with weathered hands',
      'matte black DJI drone with amber LEDs',
      'bengal cat with spotted coat',
    ],
    group: 'core',
    optional: false,
  },
  subjectDescriptor1: {
    icon: Tag,
    label: 'Descriptor 1',
    taxonomyId: null, // Content-dependent
    taxonomyGroup: TAXONOMY.SUBJECT.id, // Scoped to Subject entity
    placeholder: 'Optional visual detail (e.g., "with weathered hands")',
    color: 'slate',
    examples: [
      'with weathered hands',
      'wearing a sun-faded suit',
      'holding a silver harmonica',
    ],
    group: 'subjectDescriptors',
    optional: true,
  },
  subjectDescriptor2: {
    icon: Tag,
    label: 'Descriptor 2',
    taxonomyId: null, // Content-dependent
    taxonomyGroup: TAXONOMY.SUBJECT.id, // Scoped to Subject entity
    placeholder: 'Optional second detail (e.g., "strumming a guitar")',
    color: 'slate',
    examples: [
      'strumming a worn guitar',
      'bathed in warm window light',
      'surrounded by curious onlookers',
    ],
    group: 'subjectDescriptors',
    optional: true,
  },
  subjectDescriptor3: {
    icon: Tag,
    label: 'Descriptor 3',
    taxonomyId: null, // Content-dependent
    taxonomyGroup: TAXONOMY.SUBJECT.id, // Scoped to Subject entity
    placeholder: 'Optional third detail (e.g., "strings vibrating with each note")',
    color: 'slate',
    examples: [
      'strings vibrating with each note',
      'eyes closed in concentration',
      'rain collecting on the brim of his hat',
    ],
    group: 'subjectDescriptors',
    optional: true,
  },
  action: {
    icon: Zap,
    label: 'Action',
    taxonomyId: TAXONOMY.SUBJECT.attributes.ACTION,
    placeholder: 'ONE specific action (e.g., "leaping over concrete barriers")',
    color: 'slate',
    examples: [
      'sprinting through rain-slicked alley',
      'dissolving into clear water',
      'catching spinning basketball',
    ],
    group: 'core',
  },
  location: {
    icon: MapPin,
    label: 'Location',
    taxonomyId: TAXONOMY.ENVIRONMENT.attributes.LOCATION,
    placeholder: 'Specific place with atmosphere (e.g., "neon-lit Tokyo alley at midnight")',
    color: 'slate',
    examples: [
      'neon-lit Tokyo alley at midnight',
      'weathered lighthouse on rocky coast',
      'abandoned industrial warehouse with broken windows',
    ],
    group: 'core',
  },
  time: {
    icon: Calendar,
    label: 'Time',
    taxonomyId: TAXONOMY.LIGHTING.attributes.TIME,
    placeholder: 'Lighting quality (e.g., "golden hour with warm shadows")',
    color: 'slate',
    examples: [
      'golden hour with warm backlight',
      'blue hour dusk with deep shadows',
      'harsh midday sun with high contrast',
    ],
    group: 'atmosphere',
  },
  mood: {
    icon: Palette,
    label: 'Mood',
    taxonomyId: TAXONOMY.STYLE.attributes.AESTHETIC,
    placeholder: 'Atmosphere with visual cues (e.g., "tense with low-key lighting")',
    color: 'slate',
    examples: [
      'dramatic with deep shadows',
      'serene with soft diffused light',
      'energetic with dynamic movement',
    ],
    group: 'atmosphere',
  },
  style: {
    icon: Sparkles,
    label: 'Style',
    taxonomyId: TAXONOMY.STYLE.id,
    placeholder: 'Film stock or aesthetic (NOT "cinematic")',
    color: 'slate',
    examples: [
      'shot on 35mm film',
      'film noir with high-contrast shadows',
      'documentary verité handheld',
    ],
    group: 'style',
  },
  event: {
    icon: Lightbulb,
    label: 'Context',
    taxonomyId: TAXONOMY.ENVIRONMENT.attributes.CONTEXT,
    placeholder: "Event or narrative moment (e.g., \"product reveal moment\")",
    color: 'slate',
    examples: [
      'product reveal moment',
      'celebration with confetti falling',
      'demonstration of new technique',
    ],
    group: 'context',
  },
};
