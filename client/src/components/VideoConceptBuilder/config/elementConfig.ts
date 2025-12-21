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
  Grid as Palette,
  Star as Sparkles,
  Zap as Lightbulb,
  Tag,
  Video,
} from '@geist-ui/icons';
import type React from 'react';
import { TAXONOMY } from '@shared/taxonomy';

export interface ElementConfig {
  icon: React.ComponentType<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }>;
  label: string;
  taxonomyId: string | null;
  taxonomyGroup?: string;
  placeholder: string;
  color: string;
  examples: readonly string[];
  group: string;
  optional?: boolean;
}

export const ELEMENT_CONFIG: Record<string, ElementConfig> = {
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
    ] as const,
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
    ] as const,
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
    ] as const,
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
    ] as const,
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
    ] as const,
    group: 'core',
  },
  cameraMovement: {
    icon: Video,
    label: 'Camera Movement',
    taxonomyId: TAXONOMY.CAMERA.attributes.MOVEMENT,
    placeholder: 'How the camera moves (e.g., "slow dolly in toward subject")',
    color: 'blue',
    examples: [
      'slow dolly in toward subject',
      'handheld tracking alongside',
      'crane up revealing scene',
      'static with rack focus shift',
    ] as const,
    group: 'camera',
    optional: true,
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
    ] as const,
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
    ] as const,
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
    ] as const,
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
    ] as const,
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
    ] as const,
    group: 'context',
  },
} as const;

