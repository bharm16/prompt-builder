/**
 * Subject Descriptor Utilities for Video Concept Builder
 *
 * Contains business logic for composing and decomposing subject values with descriptors.
 * These are pure functions with no side effects.
 */

import { SUBJECT_CONNECTOR_WORDS, SUBJECT_DESCRIPTOR_KEYS } from '../config/constants';

/**
 * Normalizes a descriptor value by removing leading punctuation and whitespace
 * @param {string} value - The descriptor value to normalize
 * @returns {string} Normalized value
 */
export function normalizeDescriptor(value) {
  return value?.replace(/^[,;:\-\s]+/, '').trim() || '';
}

/**
 * Splits text into descriptor segments based on connector words
 * @param {string} text - Text to split
 * @returns {string[]} Array of descriptor segments
 */
export function splitDescriptorSegments(text) {
  if (!text) return [];

  const words = text.trim().split(/\s+/);
  const segments = [];
  let current = '';

  words.forEach((word) => {
    const lower = word.toLowerCase();
    if (SUBJECT_CONNECTOR_WORDS.includes(lower)) {
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
 * @param {string} subjectValue - The base subject value
 * @param {string[]} descriptorValues - Array of descriptor values
 * @returns {string} Composed subject string
 */
export function composeSubjectValue(subjectValue, descriptorValues) {
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
      index === 0 && SUBJECT_CONNECTOR_WORDS.includes(firstWord);
    result = shouldAttachWithSpace ? `${result} ${descriptor}` : `${result}, ${descriptor}`;
  });

  return result;
}

/**
 * Decomposes a subject value into base subject and descriptor array
 * @param {string} subjectValue - The composed subject value to decompose
 * @returns {{subject: string, descriptors: string[]}} Object with subject and descriptors
 */
export function decomposeSubjectValue(subjectValue) {
  if (!subjectValue) {
    return {
      subject: '',
      descriptors: ['', '', ''],
    };
  }

  let working = subjectValue.trim();
  const descriptors = [];

  const connectorRegex = new RegExp(`\\b(${SUBJECT_CONNECTOR_WORDS.join('|')})\\b`, 'i');
  const commaParts = working.split(',').map((part) => part.trim()).filter(Boolean);

  if (commaParts.length > 1) {
    working = commaParts[0];
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

  const uniqueDescriptors = [];
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
 * @param {Object} sourceElements - Object with element values
 * @returns {Object} Elements with composed subject value
 */
export function buildComposedElements(sourceElements) {
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
