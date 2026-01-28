import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ElementGrid } from '../ElementGrid';
import { ELEMENT_CARD_ORDER } from '../../config/constants';
import type { Elements } from '../../hooks/types';

vi.mock('../ElementCard', () => ({
  ElementCard: ({ elementKey, isActive, value }: { elementKey: string; isActive: boolean; value: string }) => (
    <div data-testid={`card-${elementKey}`} data-active={isActive ? 'true' : 'false'}>
      <span>{elementKey}</span>
      <span>{value}</span>
    </div>
  ),
}));

describe('ElementGrid', () => {
  const elements: Elements = {
    subject: 'cat',
    subjectDescriptor1: '',
    subjectDescriptor2: '',
    subjectDescriptor3: '',
    action: 'jumping',
    cameraMovement: '',
    location: '',
    time: '',
    mood: '',
    style: '',
    event: '',
  };

  describe('error handling', () => {
    it('renders no active cards when activeElement is null', () => {
      render(
        <ElementGrid
          elements={elements}
          activeElement={null}
          compatibilityScores={{}}
          descriptorCategories={{}}
          onValueChange={async () => {}}
          onFetchSuggestions={async () => {}}
        />
      );

      const activeCards = ELEMENT_CARD_ORDER.filter((key) =>
        screen.getByTestId(`card-${key}`).getAttribute('data-active') === 'true'
      );

      expect(activeCards).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('passes element values to cards for display', () => {
      render(
        <ElementGrid
          elements={elements}
          activeElement={null}
          compatibilityScores={{}}
          descriptorCategories={{}}
          onValueChange={async () => {}}
          onFetchSuggestions={async () => {}}
        />
      );

      expect(screen.getByTestId('card-subject')).toHaveTextContent('cat');
      expect(screen.getByTestId('card-action')).toHaveTextContent('jumping');
    });
  });

  describe('core behavior', () => {
    it('marks only the active element card as active', () => {
      render(
        <ElementGrid
          elements={elements}
          activeElement="action"
          compatibilityScores={{}}
          descriptorCategories={{}}
          onValueChange={async () => {}}
          onFetchSuggestions={async () => {}}
        />
      );

      expect(screen.getByTestId('card-action')).toHaveAttribute('data-active', 'true');
      expect(screen.getByTestId('card-subject')).toHaveAttribute('data-active', 'false');
    });
  });
});
