/**
 * Subject Descriptor Utilities for Video Concept Builder
 *
 * Contains business logic for composing and decomposing subject values with descriptors.
 * These are pure functions with no side effects.
 */

import { SUBJECT_CONNECTOR_WORDS, SUBJECT_DESCRIPTOR_KEYS } from '../config/constants';

export interface Elements {
  [key: string]: string | undefined;
}

export interface ComposedElements extends Elements {
  subjectDescriptors: string[];
}

export interface DecomposedSubject {
  subject: string;
  descriptors: string[];
}

/**
 * Normalizes a descriptor value by removing leading punctuation and whitespace
 */
export function normalizeDescriptor(value: string | undefined): string {
  return value?.replace(/^[,;:\-\s]+/, '').trim() || '';
}

/**
 * Splits text into descriptor segments based on connector words
 */
export function splitDescriptorSegments(text: string | undefined): string[] {
  if (!text) return [];

  const words = text.trim().split(/\s+/);
  const segments: string[] = [];
  let current = '';

  words.forEach((word) => {
    const lower = word.toLowerCase();
    if (SUBJECT_CONNECTOR_WORDS.includes(lower as typeof SUBJECT_CONNECTOR_WORDS[number])) {
      if (current.trim()) {
        segments.push(current.trim());
      }
      current = word;
    } else if (current) {
      current = `${current} ${word}`;
    } else {
      current = word;
    }
  });

  if (current.trim()) {
    segments.push(current.trim());
  }

  return segments;
}

/**
 * Composes a subject value with its descriptors into a single string
 */
export function composeSubjectValue(
  subjectValue: string | undefined,
  descriptorValues: (string | undefined)[]
): string {
  const base = subjectValue?.trim() || '';
  const cleanedDescriptors = descriptorValues
    .map(normalizeDescriptor)
    .filter(Boolean);

  if (!base && cleanedDescriptors.length === 0) {
    return '';
  }

  if (!base) {
    return cleanedDescriptors.join(', ');
  }

  let result = base;
  cleanedDescriptors.forEach((descriptor, index) => {
    if (!descriptor) return;
    const firstWord = descriptor.split(/\s+/)[0]?.toLowerCase() || '';
    const shouldAttachWithSpace =
      index === 0 && SUBJECT_CONNECTOR_WORDS.includes(firstWord as typeof SUBJECT_CONNECTOR_WORDS[number]);
    result = shouldAttachWithSpace ? `${result} ${descriptor}` : `${result}, ${descriptor}`;
  });

  return result;
}

/**
 * Decomposes a subject value into base subject and descriptor array
 */
export function decomposeSubjectValue(subjectValue: string | undefined): DecomposedSubject {
  if (!subjectValue) {
    return {
      subject: '',
      descriptors: ['', '', ''],
    };
  }

  let working = subjectValue.trim();
  const descriptors: string[] = [];

  const connectorRegex = new RegExp(`\\b(${SUBJECT_CONNECTOR_WORDS.join('|')})\\b`, 'i');
  const commaParts = working.split(',').map((part) => part.trim()).filter(Boolean);

  if (commaParts.length > 1) {
    working = commaParts[0] || '';
    descriptors.push(...commaParts.slice(1));
  }

  const connectorMatch = connectorRegex.exec(working);
  if (connectorMatch) {
    const connectorIndex = connectorMatch.index;
    const remainder = working.slice(connectorIndex).trim();
    if (remainder) {
      descriptors.unshift(remainder);
    }
    working = working.slice(0, connectorIndex).trim();
  }

  const descriptorCandidates = descriptors.flatMap((descriptor) => {
    const segments = splitDescriptorSegments(descriptor);
    return segments.length > 0 ? segments : [descriptor];
  });

  const uniqueDescriptors: string[] = [];
  descriptorCandidates.forEach((descriptor) => {
    const normalized = normalizeDescriptor(descriptor);
    if (normalized && !uniqueDescriptors.includes(normalized)) {
      uniqueDescriptors.push(normalized);
    }
  });

  while (uniqueDescriptors.length < SUBJECT_DESCRIPTOR_KEYS.length) {
    uniqueDescriptors.push('');
  }

  return {
    subject: working,
    descriptors: uniqueDescriptors.slice(0, SUBJECT_DESCRIPTOR_KEYS.length),
  };
}

/**
 * Builds composed elements from source elements
 */
export function buildComposedElements(sourceElements: Elements): ComposedElements {
  const descriptorValues = SUBJECT_DESCRIPTOR_KEYS.map((key) => sourceElements[key] || '');
  const subjectWithDescriptors = composeSubjectValue(sourceElements.subject, descriptorValues);

  return {
    ...sourceElements,
    subject: subjectWithDescriptors,
    subjectDescriptors: descriptorValues
      .map(normalizeDescriptor)
      .filter(Boolean),
  };
}

