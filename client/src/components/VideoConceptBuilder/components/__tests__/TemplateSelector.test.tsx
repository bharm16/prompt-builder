import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TemplateSelector } from '../TemplateSelector';
import { TEMPLATE_LIBRARY } from '../../config/templates';

describe('TemplateSelector', () => {
  describe('error handling', () => {
    it('renders all available template buttons', () => {
      render(<TemplateSelector onLoadTemplate={vi.fn()} />);

      const templateNames = Object.values(TEMPLATE_LIBRARY).map((template) => template.name);
      templateNames.forEach((name) => {
        expect(screen.getByText(name)).toBeInTheDocument();
      });
    });
  });

  describe('edge cases', () => {
    it('shows a preview of the first two element values', () => {
      render(<TemplateSelector onLoadTemplate={vi.fn()} />);

      const [firstTemplate] = Object.values(TEMPLATE_LIBRARY);
      const preview = Object.values(firstTemplate.elements).slice(0, 2).join(' • ');

      expect(screen.getByText(preview)).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('invokes onLoadTemplate with the selected key', async () => {
      const onLoadTemplate = vi.fn();
      const user = userEvent.setup();

      render(<TemplateSelector onLoadTemplate={onLoadTemplate} />);

      const [firstKey, firstTemplate] = Object.entries(TEMPLATE_LIBRARY)[0];
      await user.click(screen.getByText(firstTemplate.name));

      expect(onLoadTemplate).toHaveBeenCalledWith(firstKey);
    });
  });
});
