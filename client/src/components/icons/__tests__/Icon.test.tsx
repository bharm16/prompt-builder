import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Icon, createIconComponent, type IconName, type IconSize } from '../Icon';
import { iconSizes } from '@/styles/tokens';
import { logger } from '@/services/LoggingService';

vi.mock('@/services/LoggingService', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('Icon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('returns null and logs a warning when icon name is missing', () => {
      const { container } = render(<Icon name={'NotARealIcon' as IconName} />);

      expect(container.firstChild).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Icon not found', {
        component: 'Icon',
        iconName: 'NotARealIcon',
      });
    });

    it('falls back to md size when token is unknown', () => {
      const { container } = render(
        <Icon name={'User' as IconName} size={'unknown' as IconSize} />
      );

      const svg = container.querySelector('svg[data-icon="User"]');
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('size', String(Number.parseInt(iconSizes.md, 10)));
    });
  });

  describe('edge cases', () => {
    it('maps size token to numeric pixel value and merges style color', () => {
      const { container } = render(
        <Icon
          name={'User' as IconName}
          size="lg"
          color="#123456"
          style={{ marginLeft: '4px' }}
        />
      );

      const svg = container.querySelector('svg[data-icon="User"]');
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('size', String(Number.parseInt(iconSizes.lg, 10)));
      expect(svg).toHaveStyle({ color: '#123456', marginLeft: '4px' });
    });

    it('createIconComponent forwards props to the base Icon', () => {
      const UserIcon = createIconComponent('User' as IconName);
      const { container } = render(
        <UserIcon className="custom" aria-label="alert" size={18} />
      );

      const svg = container.querySelector('svg[data-icon="User"]');
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('size', '18');
      expect(svg).toHaveClass('custom');
      expect(svg).toHaveAttribute('aria-label', 'alert');
    });
  });

  describe('core behavior', () => {
    it('renders icon with numeric size and accessibility attributes', () => {
      const { container } = render(
        <Icon
          name={'User' as IconName}
          size={22}
          className="icon-class"
          aria-label="Profile"
          aria-hidden={false}
        />
      );

      const svg = container.querySelector('svg[data-icon="User"]');
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute('size', '22');
      expect(svg).toHaveClass('icon-class');
      expect(svg).toHaveAttribute('aria-label', 'Profile');
      expect(svg).toHaveAttribute('aria-hidden', 'false');
    });
  });
});
