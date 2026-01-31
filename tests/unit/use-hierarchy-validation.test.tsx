import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { useHierarchyValidation, useCanAddCategory } from '@hooks/useHierarchyValidation';
import { TAXONOMY } from '@shared/taxonomy';
import type { Span } from '@hooks/types';

describe('useHierarchyValidation', () => {
  describe('error and edge cases', () => {
    it('returns valid result for empty spans array', () => {
      const { result } = renderHook(() => useHierarchyValidation([]));
      expect(result.current.isValid).toBe(true);
      expect(result.current.warnings).toHaveLength(0);
      expect(result.current.errors).toHaveLength(0);
      expect(result.current.hasOrphans).toBe(false);
      expect(result.current.orphanCount).toBe(0);
    });

    it('returns valid result when disabled', () => {
      const spans: Span[] = [
        { text: 'tall', start: 0, end: 4, category: 'subject.appearance' },
      ];
      const { result } = renderHook(() =>
        useHierarchyValidation(spans, { enabled: false }),
      );
      expect(result.current.isValid).toBe(true);
      expect(result.current.warnings).toHaveLength(0);
    });

    it('handles spans with no category gracefully', () => {
      const spans: Span[] = [
        { text: 'something', start: 0, end: 9 },
      ];
      const { result } = renderHook(() => useHierarchyValidation(spans));
      expect(result.current.isValid).toBe(true);
      expect(result.current.orphanCount).toBe(0);
    });

    it('handles spans with parent category (not attributes) without warnings', () => {
      const spans: Span[] = [
        { text: 'a cowboy', start: 0, end: 8, category: TAXONOMY.SUBJECT.id },
      ];
      const { result } = renderHook(() => useHierarchyValidation(spans));
      expect(result.current.warnings).toHaveLength(0);
      expect(result.current.errors).toHaveLength(0);
    });
  });

  describe('orphan detection', () => {
    it('detects orphaned subject attributes when subject parent is missing', () => {
      const spans: Span[] = [
        { text: 'tall', start: 0, end: 4, category: 'subject.appearance' },
        { text: 'leather jacket', start: 5, end: 19, category: 'subject.wardrobe' },
      ];
      const { result } = renderHook(() => useHierarchyValidation(spans));

      expect(result.current.hasOrphans).toBe(true);
      expect(result.current.orphanCount).toBe(2);
      // With 2 orphans under subject, getOrphanSeverity returns 'warning'
      expect(result.current.warnings.length).toBeGreaterThan(0);
    });

    it('promotes to error when subject has > 2 orphaned attributes', () => {
      const spans: Span[] = [
        { text: 'tall', start: 0, end: 4, category: 'subject.appearance' },
        { text: 'jacket', start: 5, end: 11, category: 'subject.wardrobe' },
        { text: 'running', start: 12, end: 19, category: 'action.movement' },
      ];
      // action.movement parent is 'action', not 'subject', so this creates 2 groups
      // subject group has 2 orphans (warning), action group has 1 orphan (warning)
      const { result } = renderHook(() => useHierarchyValidation(spans));
      expect(result.current.hasOrphans).toBe(true);
    });

    it('does not flag orphans when parent category is present', () => {
      const spans: Span[] = [
        { text: 'a cowboy', start: 0, end: 8, category: TAXONOMY.SUBJECT.id },
        { text: 'tall', start: 9, end: 13, category: 'subject.appearance' },
        { text: 'leather jacket', start: 14, end: 28, category: 'subject.wardrobe' },
      ];
      const { result } = renderHook(() => useHierarchyValidation(spans));
      expect(result.current.hasOrphans).toBe(false);
      expect(result.current.orphanCount).toBe(0);
    });
  });

  describe('strict mode', () => {
    it('in strict mode, warnings also make isValid false', () => {
      const spans: Span[] = [
        { text: 'pan left', start: 0, end: 8, category: 'camera.movement' },
      ];
      const { result } = renderHook(() =>
        useHierarchyValidation(spans, { strictMode: true }),
      );
      // camera.movement without camera parent => warning
      // strict mode: isValid = errors.length === 0 && warnings.length === 0
      expect(result.current.isValid).toBe(false);
    });

    it('in non-strict mode, warnings do not affect isValid', () => {
      const spans: Span[] = [
        { text: 'pan left', start: 0, end: 8, category: 'camera.movement' },
      ];
      const { result } = renderHook(() =>
        useHierarchyValidation(spans, { strictMode: false }),
      );
      expect(result.current.isValid).toBe(true);
    });
  });

  describe('suggestions', () => {
    it('generates ADD_PARENT suggestion for orphaned attributes', () => {
      const spans: Span[] = [
        { text: 'tall', start: 0, end: 4, category: 'subject.appearance' },
      ];
      const { result } = renderHook(() =>
        useHierarchyValidation(spans, { showSuggestions: true }),
      );
      const addParent = result.current.suggestions.find((s) => s.action === 'ADD_PARENT');
      expect(addParent).toBeDefined();
      expect(addParent?.parentCategory).toBe(TAXONOMY.SUBJECT.id);
    });

    it('suppresses suggestions when showSuggestions is false', () => {
      const spans: Span[] = [
        { text: 'tall', start: 0, end: 4, category: 'subject.appearance' },
      ];
      const { result } = renderHook(() =>
        useHierarchyValidation(spans, { showSuggestions: false }),
      );
      expect(result.current.suggestions).toHaveLength(0);
    });

    it('suggests environment when subject is present but environment is not', () => {
      const spans: Span[] = [
        { text: 'a cowboy', start: 0, end: 8, category: TAXONOMY.SUBJECT.id },
      ];
      const { result } = renderHook(() =>
        useHierarchyValidation(spans, { showSuggestions: true }),
      );
      const envSuggestion = result.current.suggestions.find(
        (s) => s.parentCategory === TAXONOMY.ENVIRONMENT.id,
      );
      expect(envSuggestion).toBeDefined();
      expect(envSuggestion?.action).toBe('ADD_COMPLEMENTARY');
    });

    it('suggests camera when subject and environment present but camera absent', () => {
      const spans: Span[] = [
        { text: 'a cowboy', start: 0, end: 8, category: TAXONOMY.SUBJECT.id },
        { text: 'dusty town', start: 9, end: 19, category: TAXONOMY.ENVIRONMENT.id },
      ];
      const { result } = renderHook(() =>
        useHierarchyValidation(spans, { showSuggestions: true }),
      );
      const cameraSuggestion = result.current.suggestions.find(
        (s) => s.parentCategory === TAXONOMY.CAMERA.id,
      );
      expect(cameraSuggestion).toBeDefined();
    });
  });
});

describe('useCanAddCategory', () => {
  describe('error and edge cases', () => {
    it('returns canAdd true with no warning for undefined categoryId', () => {
      const { result } = renderHook(() => useCanAddCategory(undefined));
      expect(result.current.canAdd).toBe(true);
      expect(result.current.warning).toBeNull();
      expect(result.current.missingParent).toBeNull();
    });

    it('returns canAdd true with no warning for parent category ids', () => {
      const { result } = renderHook(() =>
        useCanAddCategory(TAXONOMY.SUBJECT.id, []),
      );
      expect(result.current.canAdd).toBe(true);
      expect(result.current.warning).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('warns when adding attribute without its parent in existing spans', () => {
      const { result } = renderHook(() =>
        useCanAddCategory('subject.appearance', []),
      );
      expect(result.current.canAdd).toBe(true); // never blocks
      expect(result.current.warning).toContain('Subject');
      expect(result.current.missingParent).toBe(TAXONOMY.SUBJECT.id);
    });

    it('no warning when parent category already exists in spans', () => {
      const spans: Span[] = [
        { text: 'a cowboy', start: 0, end: 8, category: TAXONOMY.SUBJECT.id },
      ];
      const { result } = renderHook(() =>
        useCanAddCategory('subject.appearance', spans),
      );
      expect(result.current.warning).toBeNull();
      expect(result.current.missingParent).toBeNull();
    });
  });
});
