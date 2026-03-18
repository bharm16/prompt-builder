import { describe, expect, it, vi } from 'vitest';

import { TAXONOMY } from '#shared/taxonomy';
import { OrphanDetector } from '../OrphanDetector';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe('OrphanDetector', () => {
  it('suppresses subject orphan detection when a subject exists', () => {
    const detector = new OrphanDetector();

    const result = detector.detectOrphanedSubjectAttributes([
      { category: TAXONOMY.SUBJECT.id, text: 'runner' },
      { category: TAXONOMY.SUBJECT.attributes.WARDROBE, text: 'jacket' },
    ]);

    expect(result).toBeNull();
  });

  it('suppresses camera orphan detection when a camera parent exists', () => {
    const detector = new OrphanDetector();

    const result = detector.detectOrphanedCameraAttributes([
      { category: TAXONOMY.CAMERA.id, text: 'camera' },
      { category: TAXONOMY.CAMERA.attributes.MOVEMENT, text: 'slow pan' },
    ]);

    expect(result).toBeNull();
  });

  it('returns false for non-attribute spans in isSpanOrphaned', () => {
    const detector = new OrphanDetector();

    expect(
      detector.isSpanOrphaned(
        { category: TAXONOMY.SUBJECT.id, text: 'runner' },
        [{ category: TAXONOMY.SUBJECT.id, text: 'runner' }]
      )
    ).toBe(false);
  });
});
