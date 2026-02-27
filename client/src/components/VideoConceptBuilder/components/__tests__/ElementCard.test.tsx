import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ElementCard } from '../ElementCard';
import type { ElementConfig } from '../types';
import type { Elements, ElementKey } from '../../hooks/types';

const DummyIcon = () => <svg data-testid="dummy-icon" />;

const baseConfig: ElementConfig = {
  icon: DummyIcon,
  label: 'Subject',
  placeholder: 'Describe subject',
  color: 'slate',
  examples: ['example one', 'example two'],
  group: 'core',
  optional: false,
  taxonomyId: null,
};

const descriptorConfigs: Record<string, ElementConfig> = {
  subjectDescriptor1: {
    icon: DummyIcon,
    label: 'Descriptor 1',
    placeholder: 'Descriptor 1 placeholder',
    color: 'slate',
    examples: ['with hat'],
    group: 'subjectDescriptors',
    optional: true,
    taxonomyId: null,
  },
  subjectDescriptor2: {
    icon: DummyIcon,
    label: 'Descriptor 2',
    placeholder: 'Descriptor 2 placeholder',
    color: 'slate',
    examples: ['wearing coat'],
    group: 'subjectDescriptors',
    optional: true,
    taxonomyId: null,
  },
  subjectDescriptor3: {
    icon: DummyIcon,
    label: 'Descriptor 3',
    placeholder: 'Descriptor 3 placeholder',
    color: 'slate',
    examples: ['glowing eyes'],
    group: 'subjectDescriptors',
    optional: true,
    taxonomyId: null,
  },
};

const defaultElements: Elements = {
  subject: 'cat',
  subjectDescriptor1: 'with hat',
  subjectDescriptor2: '',
  subjectDescriptor3: '',
  action: '',
  cameraMovement: '',
  location: '',
  time: '',
  mood: '',
  style: '',
  event: '',
};

describe('ElementCard', () => {
  describe('error handling', () => {
    it('shows rework indicator when descriptor compatibility is low', () => {
      render(
        <ElementCard
          elementKey="subject"
          config={baseConfig}
          value="cat"
          isActive={false}
          compatibility={0.4}
          elements={defaultElements}
          compatibilityScores={{ subjectDescriptor1: 0.4 }}
          descriptorCategories={{}}
          elementConfig={descriptorConfigs}
          onValueChange={vi.fn()}
          onFetchSuggestions={vi.fn(async () => {})}
        />
      );

      expect(screen.getByText('Rework')).toBeInTheDocument();
    });

    it('omits descriptor cards when configuration is missing', () => {
      render(
        <ElementCard
          elementKey="subject"
          config={baseConfig}
          value="cat"
          isActive={false}
          compatibility={0.9}
          elements={defaultElements}
          compatibilityScores={{}}
          descriptorCategories={{}}
          elementConfig={{ subjectDescriptor1: descriptorConfigs.subjectDescriptor1! }}
          onValueChange={vi.fn()}
          onFetchSuggestions={vi.fn(async () => {})}
        />
      );

      expect(screen.getByPlaceholderText('Descriptor 1 placeholder')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Descriptor 2 placeholder')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Descriptor 3 placeholder')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('does not render descriptor section for non-subject elements', () => {
      render(
        <ElementCard
          elementKey="action"
          config={{ ...baseConfig, label: 'Action', placeholder: 'Describe action' }}
          value="running"
          isActive={false}
          compatibility={0.9}
          elements={defaultElements}
          compatibilityScores={{}}
          descriptorCategories={{}}
          elementConfig={descriptorConfigs}
          onValueChange={vi.fn()}
          onFetchSuggestions={vi.fn()}
        />
      );

      expect(screen.queryByText(/optional subject descriptors/i)).not.toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('invokes onValueChange when example is clicked', () => {
      const onValueChange = vi.fn();

      render(
        <ElementCard
          elementKey="subject"
          config={baseConfig}
          value=""
          isActive={false}
          compatibility={0.9}
          elements={defaultElements}
          compatibilityScores={{}}
          descriptorCategories={{}}
          elementConfig={descriptorConfigs}
          onValueChange={onValueChange}
          onFetchSuggestions={vi.fn(async () => {})}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'example one' }));

      expect(onValueChange).toHaveBeenCalledWith('subject', 'example one');
      expect(screen.getByRole('button', { name: /^AI$/ })).toBeInTheDocument();
    });

    it('triggers input and AI actions for descriptor cards', () => {
      const onValueChange = vi.fn();
      const onFetchSuggestions = vi.fn(async () => {});

      render(
        <ElementCard
          elementKey="subject"
          config={baseConfig}
          value="cat"
          isActive={true}
          compatibility={0.9}
          elements={defaultElements}
          compatibilityScores={{ subjectDescriptor1: 0.9 }}
          descriptorCategories={{
            subjectDescriptor1: {
              label: 'Physical',
              confidence: 0.8,
              colors: { bg: '#fff', text: '#000', border: '#111' },
            },
          }}
          elementConfig={descriptorConfigs}
          onValueChange={onValueChange}
          onFetchSuggestions={onFetchSuggestions}
        />
      );

      const descriptorInput = screen.getByPlaceholderText('Descriptor 1 placeholder');
      fireEvent.change(descriptorInput, { target: { value: ' sparkling' } });

      expect(onValueChange).toHaveBeenCalled();
      expect(screen.getByText('Physical')).toBeInTheDocument();

      fireEvent.click(screen.getAllByRole('button', { name: /ai fill/i })[0]!);
      expect(onFetchSuggestions).toHaveBeenCalledWith('subjectDescriptor1' as ElementKey);
    });
  });
});
