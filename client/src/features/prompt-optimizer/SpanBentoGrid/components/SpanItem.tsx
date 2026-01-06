import { memo } from 'react';
import type { SpanItemProps } from './types';

/**
 * Individual span display with confidence badge
 * Clickable button that triggers scroll-to-highlight and suggestions
 */
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const cleaned = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  switch (max) {
    case rn:
      h = ((gn - bn) / delta) % 6;
      break;
    case gn:
      h = (bn - rn) / delta + 2;
      break;
    default:
      h = (rn - gn) / delta + 4;
      break;
  }
  h = h * 60;
  if (h < 0) h += 360;
  return { h, s, l };
};

const mutedCategoryColor = (bgColor: string | undefined): string | undefined => {
  if (!bgColor) return bgColor;
  const rgb = hexToRgb(bgColor);
  if (!rgb) return bgColor;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const s = clamp01(hsl.s * 0.85);
  const l = clamp01(hsl.l * 0.9);
  return `hsl(${Math.round(hsl.h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
};

export const SpanItem = memo<SpanItemProps>(
  ({ span, onClick, onHoverChange, backgroundColor }) => {
    const handleClick = (): void => {
      onClick?.(span);
    };

    const bg = mutedCategoryColor(backgroundColor);

    return (
      <button
        type="button"
        className="pc-outline-token"
        style={bg ? { background: bg } : undefined}
        onMouseEnter={() => onHoverChange?.(span.id)}
        onMouseLeave={() => onHoverChange?.(null)}
        onClick={handleClick}
        title={span.quote}
      >
        {span.quote}
      </button>
    );
  }
);

SpanItem.displayName = 'SpanItem';
