import type { ReactElement } from 'react';
import { Palette } from 'lucide-react';

export function StylesPanel(): ReactElement {
  return (
    <div className="flex flex-col h-full items-center justify-center">
      <Palette className="w-12 h-12 text-[#A1AFC5] mb-4" />
      <p className="text-sm text-[#A1AFC5]">Style presets coming soon</p>
    </div>
  );
}
