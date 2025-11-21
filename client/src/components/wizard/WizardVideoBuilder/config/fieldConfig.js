/**
 * WizardVideoBuilder Field Configuration
 * 
 * Defines the mobile field view configuration with taxonomy mappings.
 */

import { TAXONOMY } from '@shared/taxonomy';

export const MOBILE_FIELDS = [
  {
    name: 'subject',
    taxonomyId: TAXONOMY.SUBJECT.id,
    label: 'What\'s the main focus of your video?',
    description: 'This could be a person, object, animal, or anything else',
    placeholder: 'e.g., A professional athlete',
    required: true,
  },
  {
    name: 'action',
    taxonomyId: TAXONOMY.SUBJECT.attributes.ACTION,
    label: 'What\'s the subject doing?',
    description: 'Describe the movement, activity, or transformation',
    placeholder: 'e.g., running through',
    required: true,
  },
  {
    name: 'location',
    taxonomyId: TAXONOMY.ENVIRONMENT.attributes.LOCATION,
    label: 'Where is all this happening?',
    description: 'Describe the setting or environment',
    placeholder: 'e.g., a sun-drenched beach',
    required: true,
  },
  {
    name: 'time',
    taxonomyId: TAXONOMY.LIGHTING.attributes.TIME,
    label: 'When does this happen?',
    description: 'Time of day, era, or season (optional but recommended)',
    placeholder: 'e.g., during golden hour',
    required: false,
  },
  {
    name: 'mood',
    taxonomyId: TAXONOMY.STYLE.attributes.AESTHETIC,
    label: 'What\'s the emotional atmosphere?',
    description: 'The feeling you want to evoke (optional but recommended)',
    placeholder: 'e.g., energetic and joyful',
    required: false,
  },
  {
    name: 'style',
    taxonomyId: TAXONOMY.STYLE.id,
    label: 'What visual style are you going for?',
    description: 'The aesthetic treatment (optional but recommended)',
    placeholder: 'e.g., cinematic',
    required: false,
  },
  {
    name: 'event',
    taxonomyId: TAXONOMY.ENVIRONMENT.attributes.CONTEXT,
    label: 'Any specific context or occasion?',
    description: 'The broader story or event (optional)',
    placeholder: 'e.g., a celebration',
    required: false,
  },
];

