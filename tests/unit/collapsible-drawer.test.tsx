import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';

import { CollapsibleDrawer } from '@/components/CollapsibleDrawer/CollapsibleDrawer';
import { DrawerToggle } from '@/components/CollapsibleDrawer/components/DrawerToggle';
import { useDrawerState } from '@/components/CollapsibleDrawer/hooks/useDrawerState';

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@promptstudio/system/components/ui', () => {
  const createIcon = (name: string) => {
    const IconComponent = () => null;
    IconComponent.displayName = name;
    return IconComponent;
  };

  return {
    Icon: ({ icon }: { icon?: { displayName?: string; name?: string } }) => (
      <span data-testid="drawer-icon" data-icon={icon?.displayName || icon?.name} />
    ),
    CaretLeft: createIcon('CaretLeft'),
    CaretRight: createIcon('CaretRight'),
    CaretUp: createIcon('CaretUp'),
    CaretDown: createIcon('CaretDown'),
  };
});

describe('CollapsibleDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('hides overlay when drawer is closed in overlay mode', () => {
      render(
        <CollapsibleDrawer isOpen={false} onToggle={vi.fn()} displayMode="overlay">
          <div>Content</div>
        </CollapsibleDrawer>
      );

      expect(screen.queryByRole('presentation')).toBeNull();
    });

    it('closes on Escape key when open', () => {
      const { result } = renderHook(() => useDrawerState({ defaultOpen: true }));

      expect(result.current.isOpen).toBe(true);
      fireEvent.keyDown(window, { key: 'Escape' });

      expect(result.current.isOpen).toBe(false);
    });

    it('ignores toggle shortcuts when focus is in an input', () => {
      const { result } = renderHook(() => useDrawerState({ defaultOpen: true, position: 'left' }));
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      fireEvent.keyDown(input, { key: '[' });

      expect(result.current.isOpen).toBe(true);
      document.body.removeChild(input);
    });
  });

  describe('edge cases', () => {
    it('reads initial open state from localStorage', () => {
      window.localStorage.setItem('drawer-state', 'false');

      const { result } = renderHook(() =>
        useDrawerState({ defaultOpen: true, storageKey: 'drawer-state' })
      );

      expect(result.current.isOpen).toBe(false);

      act(() => result.current.open());
      expect(result.current.isOpen).toBe(true);
      expect(window.localStorage.setItem).toHaveBeenCalledWith('drawer-state', 'true');
    });

    it('uses collapsed height for bottom position when closed', () => {
      const { container } = render(
        <CollapsibleDrawer
          isOpen={false}
          onToggle={vi.fn()}
          position="bottom"
          collapsedHeight="50px"
          height="200px"
        >
          <div>Content</div>
        </CollapsibleDrawer>
      );

      const wrapper = container.querySelector('[data-position="bottom"]');
      expect(wrapper).toHaveStyle({ height: '50px' });
    });

    it('renders the correct toggle icon for left position when closed', () => {
      render(<DrawerToggle isOpen={false} onToggle={vi.fn()} position="left" />);

      expect(screen.getByTestId('drawer-icon')).toHaveAttribute('data-icon', 'CaretRight');
    });
  });

  describe('core behavior', () => {
    it('renders overlay and triggers toggle when clicked', () => {
      const onToggle = vi.fn();
      render(
        <CollapsibleDrawer isOpen={true} onToggle={onToggle} displayMode="overlay">
          <div>Content</div>
        </CollapsibleDrawer>
      );

      const overlay = screen.getByRole('presentation');
      fireEvent.click(overlay);

      expect(onToggle).toHaveBeenCalled();
    });
  });
});
