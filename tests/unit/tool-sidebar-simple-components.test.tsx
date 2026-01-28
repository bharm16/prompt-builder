import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { AppIcon } from '@/types';

import { ToolNavButton } from '@components/ToolSidebar/components/ToolNavButton';
import { ToolPanel } from '@components/ToolSidebar/components/ToolPanel';
import { StylesPanel } from '@components/ToolSidebar/components/panels/StylesPanel';

vi.mock(
  '@utils/cn',
  () => ({
    cn: (...classes: Array<string | false | null | undefined>) =>
      classes.filter(Boolean).join(' '),
  }),
  { virtual: true }
);

const DummyIcon: AppIcon = (props) => <svg data-testid="dummy-icon" {...props} />;

describe('ToolSidebar simple components', () => {
  describe('error handling', () => {
    it('renders header variant without aria-pressed even when active', () => {
      render(
        <ToolNavButton
          icon={DummyIcon}
          label="Sessions"
          isActive
          onClick={vi.fn()}
          variant="header"
        />
      );

      const button = screen.getByRole('button', { name: 'Sessions' });
      expect(button.getAttribute('aria-pressed')).toBeNull();
      const icon = within(button).getByTestId('dummy-icon');
      expect(icon.getAttribute('class')).toContain('text-[#A1AFC5]');
    });

    it('keeps data-panel attribute when children are null', () => {
      const { container } = render(
        <ToolPanel activePanel="styles">{null}</ToolPanel>
      );

      const panel = container.querySelector('[data-panel="styles"]');
      expect(panel).not.toBeNull();
    });

    it('updates data-panel when activePanel changes', () => {
      const { container, rerender } = render(
        <ToolPanel activePanel="sessions">Content</ToolPanel>
      );

      expect(container.querySelector('[data-panel="sessions"]')).not.toBeNull();

      rerender(<ToolPanel activePanel="create">Content</ToolPanel>);
      expect(container.querySelector('[data-panel="create"]')).not.toBeNull();
    });
  });

  describe('edge cases', () => {
    it('renders inactive nav button styling and aria-pressed false', () => {
      render(
        <ToolNavButton
          icon={DummyIcon}
          label="Create"
          isActive={false}
          onClick={vi.fn()}
        />
      );

      const button = screen.getByRole('button', { name: 'Create' });
      expect(button).toHaveAttribute('aria-pressed', 'false');
      const icon = within(button).getByTestId('dummy-icon');
      expect(icon.getAttribute('class')).toContain('text-[#A1AFC5]');
    });

    it('shows the styles placeholder message', () => {
      render(<StylesPanel />);

      expect(
        screen.getByText('Style presets coming soon')
      ).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('renders active styling and triggers onClick', () => {
      const onClick = vi.fn();

      render(
        <ToolNavButton
          icon={DummyIcon}
          label="Studio"
          isActive
          onClick={onClick}
        />
      );

      const button = screen.getByRole('button', { name: 'Studio' });
      expect(button).toHaveAttribute('aria-pressed', 'true');
      const icon = within(button).getByTestId('dummy-icon');
      expect(icon.getAttribute('class')).toContain('text-white');

      button.click();
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
