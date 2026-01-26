import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CapabilitiesPanel } from '@features/prompt-optimizer/components/CapabilitiesPanel';
import type { CapabilitiesSchema } from '@shared/capabilities';

const schema: CapabilitiesSchema = {
  provider: 'test',
  model: 'test-model',
  version: '1',
  fields: {
    quality: {
      type: 'enum',
      values: ['low', 'high'],
      default: 'low',
      ui: { control: 'segmented', label: 'Quality', group: 'Options', order: 1 },
    },
    prompt: {
      type: 'string',
      ui: { label: 'Prompt', group: 'Advanced', order: 1 },
    },
  },
};

describe('CapabilitiesPanel', () => {
  describe('error handling', () => {
    it('shows loading text when schema is missing and loading', () => {
      render(
        <CapabilitiesPanel
          generationParams={{}}
          onChange={vi.fn()}
          schema={null}
          isLoading
        />
      );

      expect(screen.getByText('Loading model settings...')).toBeInTheDocument();
    });

    it('shows an error when schema is missing', () => {
      render(
        <CapabilitiesPanel
          generationParams={{}}
          onChange={vi.fn()}
          schema={null}
          error="Boom"
        />
      );

      expect(screen.getByText('Settings unavailable: Boom')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('excludes fields listed in excludeFields', () => {
      render(
        <CapabilitiesPanel
          generationParams={{ quality: 'low', prompt: 'hello' }}
          onChange={vi.fn()}
          schema={schema}
          excludeFields={['prompt']}
        />
      );

      expect(screen.queryByText('Prompt')).toBeNull();
      expect(screen.getByText('Quality')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('updates values when a segmented option is selected', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <CapabilitiesPanel
          generationParams={{ quality: 'low', prompt: 'hello' }}
          onChange={onChange}
          schema={schema}
        />
      );

      await user.click(screen.getByRole('button', { name: 'high' }));

      expect(onChange).toHaveBeenCalledWith({
        quality: 'high',
        prompt: 'hello',
      });
    });
  });
});
