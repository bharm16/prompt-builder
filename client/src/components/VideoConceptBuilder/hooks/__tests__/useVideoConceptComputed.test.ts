import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useVideoConceptComputed } from '../useVideoConceptComputed';
import type { Elements } from '../types';
import { detectDescriptorCategoryClient } from '@utils/subjectDescriptorCategories';

vi.mock('@utils/subjectDescriptorCategories', () => ({
  detectDescriptorCategoryClient: vi.fn(),
}));

describe('useVideoConceptComputed', () => {
  const mockDetect = vi.mocked(detectDescriptorCategoryClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('excludes descriptor categories when detection confidence is too low', () => {
      mockDetect.mockReturnValue({
        label: null,
        confidence: 0.4,
        colors: null,
      } as never);

      const elements = {
        subject: 'cat',
        subjectDescriptor1: 'red coat',
        subjectDescriptor2: '',
        subjectDescriptor3: '',
        action: '',
        cameraMovement: '',
        location: '',
        time: '',
        mood: '',
        style: '',
        event: '',
      } as Elements;

      const { result } = renderHook(() =>
        useVideoConceptComputed(elements, { subject: 'cat' })
      );

      expect(result.current.descriptorCategories).toEqual({});
    });

    it('excludes descriptor categories when detection lacks required metadata', () => {
      mockDetect.mockReturnValue({
        label: 'Physical',
        confidence: 0.8,
        colors: null,
      } as never);

      const elements = {
        subject: 'cat',
        subjectDescriptor1: 'with blue eyes',
        subjectDescriptor2: '',
        subjectDescriptor3: '',
        action: '',
        cameraMovement: '',
        location: '',
        time: '',
        mood: '',
        style: '',
        event: '',
      } as Elements;

      const { result } = renderHook(() =>
        useVideoConceptComputed(elements, { subject: 'cat' })
      );

      expect(result.current.descriptorCategories).toEqual({});
    });
  });

  describe('edge cases', () => {
    it('handles empty elements without dividing by zero', () => {
      const { result } = renderHook(() =>
        useVideoConceptComputed({} as Elements, {})
      );

      expect(result.current.totalElementSlots).toBe(0);
      expect(result.current.completionPercent).toBe(0);
      expect(result.current.isReadyToGenerate).toBe(false);
    });

    it('builds preview text from available composed elements only', () => {
      const elements = {
        subject: 'cat',
        action: '',
        location: 'garden',
        time: '',
        mood: '',
        style: '',
        event: '',
        cameraMovement: '',
        subjectDescriptor1: '',
        subjectDescriptor2: '',
        subjectDescriptor3: '',
      } as Elements;

      const { result } = renderHook(() =>
        useVideoConceptComputed(elements, {
          subject: 'cat',
          action: '',
          location: 'garden',
        })
      );

      expect(result.current.conceptPreviewText).toBe('cat • garden');
    });
  });

  describe('core behavior', () => {
    it('flags readiness when at least three elements are filled', () => {
      const elements = {
        subject: 'cat',
        action: 'jumping',
        location: 'garden',
        time: '',
        mood: '',
        style: '',
        event: '',
        cameraMovement: '',
        subjectDescriptor1: '',
        subjectDescriptor2: '',
        subjectDescriptor3: '',
      } as Elements;

      const { result } = renderHook(() =>
        useVideoConceptComputed(elements, {
          subject: 'cat',
          action: 'jumping',
          location: 'garden',
        })
      );

      expect(result.current.filledCount).toBe(3);
      expect(result.current.isReadyToGenerate).toBe(true);
    });

    it('includes descriptor categories when detection qualifies', () => {
      mockDetect.mockReturnValue({
        label: 'Physical',
        confidence: 0.8,
        colors: { bg: '#fff', text: '#000', border: '#111' },
      } as never);

      const elements = {
        subject: 'cat',
        subjectDescriptor1: 'with blue eyes',
        subjectDescriptor2: '',
        subjectDescriptor3: '',
        action: '',
        cameraMovement: '',
        location: '',
        time: '',
        mood: '',
        style: '',
        event: '',
      } as Elements;

      const { result } = renderHook(() =>
        useVideoConceptComputed(elements, { subject: 'cat' })
      );

      expect(result.current.descriptorCategories.subjectDescriptor1).toEqual({
        label: 'Physical',
        confidence: 0.8,
        colors: { bg: '#fff', text: '#000', border: '#111' },
      });
    });
  });
});
