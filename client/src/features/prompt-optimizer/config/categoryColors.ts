export type CategoryHighlightColor = {
  bg: string;
  border: string;
  ring: string;
};

const hexToRgba = (hex: string, alpha: number): string => {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = Number.parseInt(cleaned.slice(0, 2), 16);
  const g = Number.parseInt(cleaned.slice(2, 4), 16);
  const b = Number.parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const build = (hex: string): CategoryHighlightColor => ({
  bg: hexToRgba(hex, 0.12),
  border: hexToRgba(hex, 0.35),
  ring: hexToRgba(hex, 0.18),
});

export const categoryColors = {
  shot: build('#0891b2'),
  subject: build('#ea580c'),
  action: build('#e11d48'),
  environment: build('#059669'),
  lighting: build('#ca8a04'),
  camera: build('#0284c7'),
  style: build('#7c3aed'),
  technical: build('#475569'),
  audio: build('#c026d3'),
} as const;

export const DEFAULT_CATEGORY_COLOR = build('#94a3b8');
